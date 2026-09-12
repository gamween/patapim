// Credentials + Permissioned Domains gating a Single Asset Vault, end to end,
// on the public XRPL devnet (Track 2, rippled 3.4.0-rc5).
//
// Proves, with on-ledger transactions:
//   A. CredentialCreate / CredentialAccept / PermissionedDomainSet wire format.
//   B. VaultCreate DomainID rules (temMALFORMED without tfVaultPrivate, zero, tecOBJECT_NOT_FOUND).
//   C. Who is blocked at VaultDeposit: uncredentialed, unaccepted, wrong type -> tecNO_AUTH.
//   D. Who is blocked at VaultWithdraw: the *destination* must also be in the domain
//      (fixCleanup3_4_0, VaultWithdraw.cpp:241-249) -> tecNO_AUTH.
//   E. What CredentialIDs is for: it is NOT the domain. It satisfies the destination's
//      DepositAuth via a credential-based DepositPreauth (View.cpp:480-505).
//   F. The same on LoanBrokerCoverWithdraw.
//   G. VaultSet DomainID = 0 locks every non-owner out of a private vault.
//
// Run: node scripts/experiments/credentials-domain.mjs
import { Client, Wallet } from 'xrpl'
import { NETS, fund, createdId, sleep, hex } from '../lib/lending.mjs'

const NET = NETS.t2
const log = []
const record = (o) => { log.push(o); return o }

// submitAndWait swallows tem*/tef* codes into a thrown Error, so use the raw
// `submit` command when we expect a preflight rejection: it returns engine_result.
async function submitRaw(client, wallet, tx, label, expect) {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.request({ command: 'submit', tx_blob: signed.tx_blob })
    const code = r.result.engine_result
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(46)} ${String(code).padEnd(22)} ${signed.hash}`)
    return record({ label, code, hash: signed.hash, expect })
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(46)} ${String(e.message).slice(0, 200)}`)
    return record({ label, code: 'THROWN', error: String(e.message), expect })
  }
}

async function go(client, wallet, tx, label, expect = 'tesSUCCESS') {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.submitAndWait(signed.tx_blob)
    const code = r.result.meta.TransactionResult
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(46)} ${String(code).padEnd(22)} ${r.result.hash}`)
    return record({ label, code, hash: r.result.hash, meta: r.result.meta, expect })
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(46)} ${String(e.message).slice(0, 200)}`)
    return record({ label, code: 'THROWN', error: String(e.message), expect })
  }
}

const ZERO256 = '0'.repeat(64)
const KYC = hex('recall.kyc.v1')          // 1A bytes, <= 64 -> legal CredentialType
const OTHER = hex('recall.notlisted.v1')  // a type the domain does NOT accept

const main = async () => {
  const client = new Client(NET.wss)
  await client.connect()
  const info = await client.request({ command: 'server_info' })
  console.log(`\n=== ${NET.name}`)
  console.log(`  rippled ${info.result.info.build_version}  network_id ${info.result.info.network_id}`)
  const xrpljs = (await import('xrpl/package.json', { with: { type: 'json' } })).default.version
  console.log(`  xrpl.js ${xrpljs}`)

  console.log('\n-- 0. fund actors')
  const issuer = await fund(NET, 'issuer')   // credential issuer + domain owner + vault owner
  await sleep(1200)
  const alice = await fund(NET, 'alice')     // gets the credential -> admitted
  await sleep(1200)
  const bob = await fund(NET, 'bob')         // credentialed + DepositAuth, the withdrawal destination
  await sleep(1200)
  const mallory = await fund(NET, 'mallory') // never credentialed
  await sleep(1200)

  // ---------------------------------------------------------------- A. credentials
  console.log('\n-- A. CredentialCreate / CredentialAccept')
  const cAlice = await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: alice.classicAddress, CredentialType: KYC,
    URI: hex('https://example.test/kyc/alice'),
  }, 'CredentialCreate issuer->alice')
  const aliceCredID = createdId(cAlice.meta, 'Credential')
  console.log(`       Credential ledger index (alice): ${aliceCredID}`)

  const cBob = await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: bob.classicAddress, CredentialType: KYC,
  }, 'CredentialCreate issuer->bob')
  const bobCredID = createdId(cBob.meta, 'Credential')

  // mallory gets a credential of a type the domain will NOT list
  const cMal = await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: mallory.classicAddress, CredentialType: OTHER,
  }, 'CredentialCreate issuer->mallory (wrong type)')
  const malCredID = createdId(cMal.meta, 'Credential')

  // duplicate -> tecDUPLICATE (CredentialCreate.cpp:95-99)
  await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: alice.classicAddress, CredentialType: KYC,
  }, 'CredentialCreate duplicate', 'tecDUPLICATE')

  // ---------------------------------------------------------------- B. domain
  console.log('\n-- B. PermissionedDomainSet')
  await submitRaw(client, issuer, {
    TransactionType: 'PermissionedDomainSet', Account: issuer.classicAddress,
    AcceptedCredentials: [],
  }, 'PermissionedDomainSet empty array', 'temARRAY_EMPTY')

  const pd = await go(client, issuer, {
    TransactionType: 'PermissionedDomainSet', Account: issuer.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: KYC } }],
  }, 'PermissionedDomainSet create')
  const domainID = createdId(pd.meta, 'PermissionedDomain')
  console.log(`       DomainID: ${domainID}`)

  // a domain nobody can join: accepts a credential type nobody holds
  const pd2 = await go(client, issuer, {
    TransactionType: 'PermissionedDomainSet', Account: issuer.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: hex('nobody') } }],
  }, 'PermissionedDomainSet second domain')
  const domain2ID = createdId(pd2.meta, 'PermissionedDomain')

  // not the owner -> tecNO_PERMISSION (PermissionedDomainSet.cpp:70-71)
  await go(client, alice, {
    TransactionType: 'PermissionedDomainSet', Account: alice.classicAddress, DomainID: domainID,
    AcceptedCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: KYC } }],
  }, 'PermissionedDomainSet by non-owner', 'tecNO_PERMISSION')

  // ---------------------------------------------------------------- C. VaultCreate gating
  console.log('\n-- C. VaultCreate + DomainID')
  await submitRaw(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: domainID,
  }, 'VaultCreate DomainID without tfVaultPrivate', 'temMALFORMED')

  await submitRaw(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: ZERO256, Flags: 0x00010000,
  }, 'VaultCreate DomainID all zero', 'temMALFORMED')

  await go(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: 'F'.repeat(64), Flags: 0x00010000,
  }, 'VaultCreate DomainID not on ledger', 'tecOBJECT_NOT_FOUND')

  const vc = await go(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: domainID, Flags: 0x00010000, // tfVaultPrivate
    Data: hex('recall-domain-probe'),
  }, 'VaultCreate private + DomainID')
  const vaultID = createdId(vc.meta, 'Vault')
  const shareID = vc.meta?.AffectedNodes?.map(n => n.CreatedNode)
    .find(n => n?.LedgerEntryType === 'MPTokenIssuance')?.NewFields?.MPTokenIssuanceID
  console.log(`       VaultID: ${vaultID}`)
  console.log(`       ShareMPTID: ${shareID}`)

  const issuanceEntry = await client.request({
    command: 'ledger_entry', mpt_issuance: shareID, ledger_index: 'validated',
  }).catch(e => ({ error: String(e.message) }))
  console.log(`       share MPTokenIssuance DomainID field: ${JSON.stringify(issuanceEntry.result?.node?.DomainID)}`)
  record({ label: 'share issuance node', node: issuanceEntry.result?.node })

  // ---------------------------------------------------------------- D. who may deposit
  console.log('\n-- D. VaultDeposit gating')
  await go(client, alice, {
    TransactionType: 'VaultDeposit', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '10000000',
  }, 'deposit: credential NOT yet accepted', 'tecNO_AUTH')

  await go(client, mallory, {
    TransactionType: 'VaultDeposit', Account: mallory.classicAddress,
    VaultID: vaultID, Amount: '10000000',
  }, 'deposit: no credential at all', 'tecNO_AUTH')

  await go(client, alice, {
    TransactionType: 'CredentialAccept', Account: alice.classicAddress,
    Issuer: issuer.classicAddress, CredentialType: KYC,
  }, 'CredentialAccept alice')
  await go(client, bob, {
    TransactionType: 'CredentialAccept', Account: bob.classicAddress,
    Issuer: issuer.classicAddress, CredentialType: KYC,
  }, 'CredentialAccept bob')
  await go(client, mallory, {
    TransactionType: 'CredentialAccept', Account: mallory.classicAddress,
    Issuer: issuer.classicAddress, CredentialType: OTHER,
  }, 'CredentialAccept mallory (wrong type)')

  const dep = await go(client, alice, {
    TransactionType: 'VaultDeposit', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '60000000',
  }, 'deposit: credential accepted -> admitted')
  const mptCreated = dep.meta?.AffectedNodes?.map(n => n.CreatedNode)
    .find(n => n?.LedgerEntryType === 'MPToken')
  console.log(`       MPToken auto-created for alice: ${!!mptCreated} flags=${JSON.stringify(mptCreated?.NewFields?.Flags)}`)
  record({ label: 'alice share MPToken', node: mptCreated })

  await go(client, mallory, {
    TransactionType: 'VaultDeposit', Account: mallory.classicAddress,
    VaultID: vaultID, Amount: '10000000',
  }, 'deposit: accepted credential, wrong type', 'tecNO_AUTH')

  // owner is exempt from the domain check (VaultDeposit.cpp:179)
  await go(client, issuer, {
    TransactionType: 'VaultDeposit', Account: issuer.classicAddress,
    VaultID: vaultID, Amount: '10000000',
  }, 'deposit: vault owner (exempt, no credential)')

  // bob joins too, so he is a legal withdrawal destination later
  await go(client, bob, {
    TransactionType: 'VaultDeposit', Account: bob.classicAddress,
    VaultID: vaultID, Amount: '10000000',
  }, 'deposit: bob (credentialed)')

  // ---------------------------------------------------------------- E. withdrawal destination
  console.log('\n-- E. VaultWithdraw destination gating')
  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000',
  }, 'withdraw to self (no domain check)')

  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: mallory.classicAddress,
  }, 'withdraw to mallory (outside domain)', 'tecNO_AUTH')

  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
  }, 'withdraw to bob (inside domain, no DepositAuth)')

  // ---------------------------------------------------------------- F. CredentialIDs
  console.log('\n-- F. what CredentialIDs actually does')
  await go(client, bob, {
    TransactionType: 'AccountSet', Account: bob.classicAddress, SetFlag: 9, // asfDepositAuth
  }, 'bob sets asfDepositAuth')

  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
  }, 'withdraw to bob, DepositAuth, no CredentialIDs', 'tecNO_PERMISSION')

  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
    CredentialIDs: [aliceCredID],
  }, 'withdraw + CredentialIDs, no DepositPreauth yet', 'tecNO_PERMISSION')

  await go(client, bob, {
    TransactionType: 'DepositPreauth', Account: bob.classicAddress,
    AuthorizeCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: KYC } }],
  }, 'bob DepositPreauth(AuthorizeCredentials)')

  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
    CredentialIDs: [aliceCredID],
  }, 'withdraw + CredentialIDs + preauth -> allowed')

  // negatives on the CredentialIDs field itself
  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
    CredentialIDs: [bobCredID],
  }, 'CredentialIDs of someone else (bob\'s)', 'tecBAD_CREDENTIALS')

  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
    CredentialIDs: ['A'.repeat(64)],
  }, 'CredentialIDs that does not exist', 'tecBAD_CREDENTIALS')

  await submitRaw(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
    CredentialIDs: [aliceCredID, aliceCredID],
  }, 'CredentialIDs duplicated', 'temMALFORMED')

  await submitRaw(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
    CredentialIDs: [],
  }, 'CredentialIDs empty array', 'temMALFORMED')

  await submitRaw(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress,
    CredentialIDs: [ZERO256],
  }, 'CredentialIDs zero hash', 'temMALFORMED')

  // ---------------------------------------------------------------- G. loan broker cover
  console.log('\n-- G. LoanBrokerCoverWithdraw + CredentialIDs')
  const lb = await go(client, issuer, {
    TransactionType: 'LoanBrokerSet', Account: issuer.classicAddress, VaultID: vaultID,
    ManagementFeeRate: 1000, DebtMaximum: '100000000',
    CoverRateMinimum: 100000, CoverRateLiquidation: 1000000,
  }, 'LoanBrokerSet on the private vault')
  const brokerID = createdId(lb.meta, 'LoanBroker')
  console.log(`       LoanBrokerID: ${brokerID}`)

  if (brokerID) {
    await go(client, issuer, {
      TransactionType: 'LoanBrokerCoverDeposit', Account: issuer.classicAddress,
      LoanBrokerID: brokerID, Amount: '20000000',
    }, 'LoanBrokerCoverDeposit')

    await go(client, issuer, {
      TransactionType: 'LoanBrokerCoverWithdraw', Account: issuer.classicAddress,
      LoanBrokerID: brokerID, Amount: '1000000', Destination: bob.classicAddress,
    }, 'coverWithdraw -> bob DepositAuth, no creds', 'tecNO_PERMISSION')

    // the broker owner is the credential ISSUER, who holds no credential itself
    await go(client, issuer, {
      TransactionType: 'LoanBrokerCoverWithdraw', Account: issuer.classicAddress,
      LoanBrokerID: brokerID, Amount: '1000000', Destination: bob.classicAddress,
      CredentialIDs: [aliceCredID],
    }, 'coverWithdraw + alice creds (not subject)', 'tecBAD_CREDENTIALS')

    // give the broker owner its own credential of the preauthorised type
    await go(client, issuer, {
      TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
      Subject: issuer.classicAddress, CredentialType: KYC,
    }, 'CredentialCreate self-issued (auto-accepted)')
    const selfCred = await client.request({
      command: 'account_objects', account: issuer.classicAddress, type: 'credential', ledger_index: 'validated',
    }).catch(() => null)
    const selfCredID = selfCred?.result?.account_objects?.find(
      o => o.Subject === issuer.classicAddress && o.CredentialType === KYC)?.index
    console.log(`       issuer self-credential: ${selfCredID}`)

    await go(client, issuer, {
      TransactionType: 'LoanBrokerCoverWithdraw', Account: issuer.classicAddress,
      LoanBrokerID: brokerID, Amount: '1000000', Destination: bob.classicAddress,
      CredentialIDs: [selfCredID],
    }, 'coverWithdraw + own creds + preauth -> allowed')
  }

  // ---------------------------------------------------------------- H. clearing the domain
  console.log('\n-- H. VaultSet DomainID rules')
  await go(client, issuer, {
    TransactionType: 'VaultSet', Account: issuer.classicAddress, VaultID: vaultID,
    DomainID: domain2ID,
  }, 'VaultSet switch to a domain nobody holds')

  await go(client, bob, {
    TransactionType: 'VaultDeposit', Account: bob.classicAddress,
    VaultID: vaultID, Amount: '1000000',
  }, 'deposit after domain switch (bob had shares)', 'tecNO_AUTH')

  await go(client, issuer, {
    TransactionType: 'VaultSet', Account: issuer.classicAddress, VaultID: vaultID,
    DomainID: ZERO256,
  }, 'VaultSet DomainID = 0 (clears the domain)')

  const after = await client.request({
    command: 'ledger_entry', mpt_issuance: shareID, ledger_index: 'validated',
  }).catch(e => ({ error: String(e.message) }))
  console.log(`       share issuance DomainID after clear: ${JSON.stringify(after.result?.node?.DomainID)}`)

  await go(client, alice, {
    TransactionType: 'VaultDeposit', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000',
  }, 'deposit after DomainID=0 (alice, credentialed)', 'tecNO_AUTH')

  await go(client, alice, {
    TransactionType: 'VaultWithdraw', Account: alice.classicAddress,
    VaultID: vaultID, Amount: '1000000',
  }, 'withdraw to self after DomainID=0')

  console.log('\n-- summary')
  for (const r of log.filter(r => r.code)) {
    const flag = r.expect && r.code !== r.expect ? ' <== UNEXPECTED (expected ' + r.expect + ')' : ''
    console.log(`  ${String(r.code).padEnd(22)} ${r.label}${flag}`)
  }
  console.log('\nIDs')
  console.log(JSON.stringify({
    issuer: issuer.classicAddress, alice: alice.classicAddress,
    bob: bob.classicAddress, mallory: mallory.classicAddress,
    aliceCredID, bobCredID, malCredID, domainID, domain2ID, vaultID, shareID,
  }, null, 2))

  await client.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
