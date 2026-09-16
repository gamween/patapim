// Credentials + Permissioned Domains gating a Single Asset Vault, proven on the
// TRACK 1 hackathon devnet (rippled 3.4.0-rc1, network_id 4001).
//
// Slug: credentials-domains-vault.  Run: node scripts/experiments/credentials-domains-vault.mjs
//
// What this proves on chain, with hashes:
//   A  CredentialCreate / CredentialAccept wire format + tecDUPLICATE + tecNO_TARGET
//   B  PermissionedDomainSet wire format + tecNO_PERMISSION for a non-owner
//   C  VaultCreate.DomainID rules (temMALFORMED x2, tecOBJECT_NOT_FOUND, tesSUCCESS)
//      and that the Vault entry NEVER stores DomainID - the share MPTokenIssuance does
//   D  VaultDeposit gating: tecNO_AUTH for the uncredentialed, tesSUCCESS for the
//      credentialed, tesSUCCESS for the vault owner with no credential at all
//   E  What CredentialIDs is actually for (destination DepositAuth, not the domain)
//   F  A domain-gated vault does NOT gate the BORROWER: LoanSet to an account that
//      was refused at VaultDeposit succeeds
//   G  REVOCATION: delete a shareholder's credential while they hold shares
//   H  EXPIRY: a tec-failed VaultDeposit still DELETES the expired credential
//
// rippled 3.4.0-rc1 references (worktree of XRPLF/rippled at tag 3.4.0-rc1):
//   VaultDeposit.cpp:179-184        private vault -> checkVaultDomain(SuppressExpired::Yes)
//   VaultDeposit.cpp:267-273        doApply -> enforceMPTokenAuthorization
//   VaultWithdraw.cpp:227-248       fixCleanup3_4_0: domain check on BOTH submitter and dest
//   VaultWithdraw.cpp:296-299       "if you have a share ... indefinitely authorized to withdraw"
//   VaultHelpers.cpp:308-328        checkVaultDomain reads DomainID off the share issuance
//   MPTokenHelpers.cpp:481-575      enforceMPTokenAuthorization
//   CredentialHelpers.cpp:208-244   validDomain
//   CredentialHelpers.cpp:130-205   checkFields / valid
//   View.cpp:464-508                canWithdraw -> CredentialIDs -> authorizedDepositPreauth
import { Client } from 'xrpl'
import { NETS, fund, createdId, sleep, hex, submitLoanSet } from '../lib/lending.mjs'

const NET = NETS.t1
const log = []
const ZERO256 = '0'.repeat(64)
const KYC   = hex('recall.eligible.v1')   // the credential type the domain accepts
const OTHER = hex('recall.other.v1')      // a type the domain does NOT accept

const rec = (o) => { log.push(o); return o }
const J = (x) => JSON.stringify(x)

// submitAndWait turns tem*/tef* into a thrown Error, so use the raw `submit`
// command whenever a preflight rejection is the expected answer.
async function raw(client, wallet, tx, label, expect) {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.request({ command: 'submit', tx_blob: signed.tx_blob })
    const code = r.result.engine_result
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(52)} ${String(code).padEnd(22)} ${signed.hash}`)
    return rec({ label, code, hash: signed.hash, expect })
  } catch (e) {
    console.log(`  THROW ${label.padEnd(51)} ${String(e.message).slice(0, 130)}`)
    return rec({ label, code: 'THROWN(xrpl.js)', error: String(e.message), expect })
  }
}

async function go(client, wallet, tx, label, expect = 'tesSUCCESS') {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.submitAndWait(signed.tx_blob)
    const code = r.result.meta.TransactionResult
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(52)} ${String(code).padEnd(22)} ${r.result.hash}`)
    return rec({ label, code, hash: r.result.hash, meta: r.result.meta, expect })
  } catch (e) {
    console.log(`  THROW ${label.padEnd(51)} ${String(e.message).slice(0, 130)}`)
    return rec({ label, code: 'THROWN(xrpl.js)', error: String(e.message), expect })
  }
}

const objects = (client, account, type) =>
  client.request({ command: 'account_objects', account, type, ledger_index: 'validated' })
    .then(r => r.result.account_objects).catch(e => [{ error: String(e.message) }])

const deleted = (meta, type) =>
  (meta?.AffectedNodes ?? []).filter(n => n.DeletedNode?.LedgerEntryType === type)
    .map(n => n.DeletedNode.LedgerIndex)

async function shareBalance(client, account, mptid) {
  const os = await objects(client, account, 'mptoken')
  const m = os.find(o => o.MPTokenIssuanceID === mptid)
  return m ? { amount: m.MPTAmount ?? '0', flags: m.Flags ?? 0, index: m.index } : null
}

async function closeTime(client) {
  const r = await client.request({ command: 'ledger', ledger_index: 'validated' })
  return r.result.ledger.close_time
}

const main = async () => {
  const client = new Client(NET.wss)
  await client.connect()
  const info = await client.request({ command: 'server_info' })
  const xrpljs = (await import('xrpl/package.json', { with: { type: 'json' } })).default.version
  console.log(`\n=== ${NET.name}`)
  console.log(`  rippled ${info.result.info.build_version}  network_id ${info.result.info.network_id}  xrpl.js ${xrpljs}`)

  console.log('\n-- 0. fund 4 actors')
  const issuer  = await fund(NET, 'issuer')    // credential issuer + domain owner + vault owner + broker owner
  await sleep(1500)
  const alice   = await fund(NET, 'alice')     // LP, credential REVOKED mid-experiment
  await sleep(1500)
  const bob     = await fund(NET, 'bob')       // LP with an EXPIRING credential; withdrawal destination
  await sleep(1500)
  const mallory = await fund(NET, 'mallory')   // never a domain member; later the BORROWER
  await sleep(1500)

  const ct = await closeTime(client)
  const bobExpiry = ct + 330   // seconds, Ripple epoch: bob's credential dies mid-run
  console.log(`  ledger close_time ${ct} (ripple epoch); bob credential Expiration = ${bobExpiry}`)

  // ============================================================= A. credentials
  console.log('\n-- A. CredentialCreate / CredentialAccept')
  const cA = await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: alice.classicAddress, CredentialType: KYC,
    URI: hex('https://recall.example/eligibility/alice'),
  }, 'CredentialCreate issuer->alice (KYC)')
  const aliceCred = createdId(cA.meta, 'Credential')

  const cB = await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: bob.classicAddress, CredentialType: KYC, Expiration: bobExpiry,
  }, 'CredentialCreate issuer->bob (KYC, Expiration)')
  const bobCred = createdId(cB.meta, 'Credential')

  const cM = await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: mallory.classicAddress, CredentialType: OTHER,
  }, 'CredentialCreate issuer->mallory (WRONG type)')
  const malCred = createdId(cM.meta, 'Credential')
  console.log(`       aliceCred ${aliceCred}\n       bobCred   ${bobCred}\n       malCred   ${malCred}`)

  await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: alice.classicAddress, CredentialType: KYC,
  }, 'CredentialCreate duplicate', 'tecDUPLICATE')

  await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: 'rGWrZyQqhTp9Xu7G5Pkayo7bXjH4k4QYpf', CredentialType: KYC,
  }, 'CredentialCreate to an unfunded subject', 'tecNO_TARGET')

  // pre-accept state: does an UNACCEPTED credential admit you?
  await go(client, alice,   { TransactionType: 'CredentialAccept', Account: alice.classicAddress,   Issuer: issuer.classicAddress, CredentialType: KYC }, 'CredentialAccept alice')
  await go(client, bob,     { TransactionType: 'CredentialAccept', Account: bob.classicAddress,     Issuer: issuer.classicAddress, CredentialType: KYC }, 'CredentialAccept bob')
  await go(client, mallory, { TransactionType: 'CredentialAccept', Account: mallory.classicAddress, Issuer: issuer.classicAddress, CredentialType: OTHER }, 'CredentialAccept mallory (wrong type)')

  // self-issued credential for the issuer: auto-accepted (CredentialCreate.cpp:167-170)
  const cS = await go(client, issuer, {
    TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: issuer.classicAddress, CredentialType: KYC,
  }, 'CredentialCreate self-issued (auto-accept?)')
  const selfCred = createdId(cS.meta, 'Credential')
  const selfSle = (await objects(client, issuer.classicAddress, 'credential')).find(o => o.index === selfCred)
  console.log(`       self-issued credential Flags = ${J(selfSle?.Flags)} (0x10000 = lsfAccepted)`)
  rec({ label: 'self-issued credential flags', value: selfSle?.Flags })

  // ============================================================= B. domain
  console.log('\n-- B. PermissionedDomainSet')
  await raw(client, issuer, {
    TransactionType: 'PermissionedDomainSet', Account: issuer.classicAddress, AcceptedCredentials: [],
  }, 'PermissionedDomainSet with an empty array', 'temARRAY_EMPTY')

  const pd = await go(client, issuer, {
    TransactionType: 'PermissionedDomainSet', Account: issuer.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: KYC } }],
  }, 'PermissionedDomainSet create')
  const domainID = createdId(pd.meta, 'PermissionedDomain')
  console.log(`       DomainID ${domainID}`)

  const pd2 = await go(client, issuer, {
    TransactionType: 'PermissionedDomainSet', Account: issuer.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: hex('nobody.holds.this') } }],
  }, 'PermissionedDomainSet second (empty) domain')
  const domain2ID = createdId(pd2.meta, 'PermissionedDomain')

  await go(client, alice, {
    TransactionType: 'PermissionedDomainSet', Account: alice.classicAddress, DomainID: domainID,
    AcceptedCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: KYC } }],
  }, 'PermissionedDomainSet by a non-owner', 'tecNO_PERMISSION')

  // ============================================================= C. VaultCreate
  console.log('\n-- C. VaultCreate + DomainID')
  const tfVaultPrivate = 0x00010000
  await raw(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: domainID,
  }, 'VaultCreate DomainID WITHOUT tfVaultPrivate', 'temMALFORMED')

  await raw(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: ZERO256, Flags: tfVaultPrivate,
  }, 'VaultCreate DomainID all-zero', 'temMALFORMED')

  await go(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: 'F'.repeat(64), Flags: tfVaultPrivate,
  }, 'VaultCreate DomainID not on the ledger', 'tecOBJECT_NOT_FOUND')

  const vc = await go(client, issuer, {
    TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: domainID, Flags: tfVaultPrivate,
    Data: hex('recall domain-gated vault'), WithdrawalPolicy: 1,
  }, 'VaultCreate private + DomainID')
  const vaultID = createdId(vc.meta, 'Vault')
  const shareID = (vc.meta?.AffectedNodes ?? []).map(n => n.CreatedNode)
    .find(n => n?.LedgerEntryType === 'MPTokenIssuance')?.NewFields?.MPTokenIssuanceID
  console.log(`       VaultID     ${vaultID}\n       ShareMPTID  ${shareID}`)
  if (!vaultID) { await client.disconnect(); return }

  const vaultNode = await client.request({ command: 'ledger_entry', vault: vaultID, ledger_index: 'validated' })
    .then(r => r.result.node).catch(e => ({ error: String(e.message) }))
  const issuanceNode = await client.request({ command: 'ledger_entry', mpt_issuance: shareID, ledger_index: 'validated' })
    .then(r => r.result.node).catch(e => ({ error: String(e.message) }))
  console.log(`       Vault entry has DomainID? ${'DomainID' in vaultNode}  keys: ${Object.keys(vaultNode).join(',')}`)
  console.log(`       share MPTokenIssuance.DomainID = ${issuanceNode.DomainID}  Flags=${issuanceNode.Flags}`)
  rec({ label: 'vault entry', node: vaultNode })
  rec({ label: 'share issuance', node: issuanceNode })
  const vi = await client.request({ command: 'vault_info', vault_id: vaultID }).then(r => r.result).catch(e => ({ error: String(e.message) }))
  console.log(`       vault_info surfaces the domain at vault.shares.DomainID = ${vi?.vault?.shares?.DomainID}`)
  rec({ label: 'vault_info', value: vi })

  // ============================================================= D. deposit gating
  console.log('\n-- D. VaultDeposit gating')
  await go(client, mallory, { TransactionType: 'VaultDeposit', Account: mallory.classicAddress, VaultID: vaultID, Amount: '10000000' },
    'deposit: mallory, accepted cred of the WRONG type', 'tecNO_AUTH')

  const dA = await go(client, alice, { TransactionType: 'VaultDeposit', Account: alice.classicAddress, VaultID: vaultID, Amount: '200000000' },
    'deposit: alice (domain member)')
  const aliceMpt = (dA.meta?.AffectedNodes ?? []).map(n => n.CreatedNode).find(n => n?.LedgerEntryType === 'MPToken')
  console.log(`       alice share MPToken auto-created, NewFields = ${J(aliceMpt?.NewFields)}`)
  rec({ label: 'alice MPToken on creation', node: aliceMpt })

  await go(client, bob, { TransactionType: 'VaultDeposit', Account: bob.classicAddress, VaultID: vaultID, Amount: '100000000' },
    'deposit: bob (domain member, expiring cred)')

  const dO = await go(client, issuer, { TransactionType: 'VaultDeposit', Account: issuer.classicAddress, VaultID: vaultID, Amount: '100000000' },
    'deposit: vault OWNER (exempt from the domain)')
  const ownerMpt = (dO.meta?.AffectedNodes ?? []).map(n => n.CreatedNode).find(n => n?.LedgerEntryType === 'MPToken')
  console.log(`       owner share MPToken NewFields = ${J(ownerMpt?.NewFields)}  (lsfMPTAuthorized = 2)`)
  rec({ label: 'owner MPToken on creation', node: ownerMpt })

  // ============================================================= E. CredentialIDs
  console.log('\n-- E. VaultWithdraw destination gating + what CredentialIDs is for')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'withdraw to SELF (no domain check at all)')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: mallory.classicAddress },
    'withdraw -> mallory (destination outside domain)', 'tecNO_AUTH')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress },
    'withdraw -> bob (destination inside domain)')

  await go(client, bob, { TransactionType: 'AccountSet', Account: bob.classicAddress, SetFlag: 9 }, 'bob sets asfDepositAuth')

  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress },
    'withdraw -> bob w/ DepositAuth, no CredentialIDs', 'tecNO_PERMISSION')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [aliceCred] },
    'withdraw + CredentialIDs, no DepositPreauth yet', 'tecNO_PERMISSION')
  await go(client, bob, {
    TransactionType: 'DepositPreauth', Account: bob.classicAddress,
    AuthorizeCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: KYC } }],
  }, 'bob DepositPreauth(AuthorizeCredentials)')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [aliceCred] },
    'withdraw + CredentialIDs + preauth -> ALLOWED')

  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [bobCred] },
    'CredentialIDs belonging to someone else', 'tecBAD_CREDENTIALS')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: ['A'.repeat(64)] },
    'CredentialIDs that does not exist', 'tecBAD_CREDENTIALS')
  await raw(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [aliceCred, aliceCred] },
    'CredentialIDs duplicated', 'temMALFORMED')
  await raw(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [] },
    'CredentialIDs empty array', 'temMALFORMED')
  await raw(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [ZERO256] },
    'CredentialIDs zero hash', 'temMALFORMED')

  // ============================================================= F. the borrower is NOT gated
  console.log('\n-- F. does the domain gate the BORROWER? (LoanBroker on a private vault)')
  const lb = await go(client, issuer, {
    TransactionType: 'LoanBrokerSet', Account: issuer.classicAddress, VaultID: vaultID,
    ManagementFeeRate: 1000, DebtMaximum: '100000000', CoverRateMinimum: 100000, CoverRateLiquidation: 1000000,
  }, 'LoanBrokerSet on the domain-gated vault')
  const brokerID = createdId(lb.meta, 'LoanBroker')
  console.log(`       LoanBrokerID ${brokerID}`)
  if (brokerID) {
    await go(client, issuer, { TransactionType: 'LoanBrokerCoverDeposit', Account: issuer.classicAddress, LoanBrokerID: brokerID, Amount: '20000000' },
      'LoanBrokerCoverDeposit')
    const loan = await submitLoanSet(client, issuer, mallory, {
      TransactionType: 'LoanSet', Account: issuer.classicAddress, Counterparty: mallory.classicAddress,
      LoanBrokerID: brokerID, PrincipalRequested: '10000000', InterestRate: 5000,
      PaymentInterval: 300, PaymentTotal: 2, GracePeriod: 60, Data: hex('borrower outside the domain'),
    }, 'LoanSet: BORROWER = mallory, refused at VaultDeposit')
    rec({ label: 'LoanSet to a non-domain borrower', code: loan.code, hash: loan.hash })
    console.log(`       LoanID ${loan.meta ? createdId(loan.meta, 'Loan') : '-'}`)

    await go(client, issuer, { TransactionType: 'LoanBrokerCoverWithdraw', Account: issuer.classicAddress, LoanBrokerID: brokerID, Amount: '1000000', Destination: bob.classicAddress },
      'coverWithdraw -> bob DepositAuth, no CredentialIDs', 'tecNO_PERMISSION')
    await go(client, issuer, { TransactionType: 'LoanBrokerCoverWithdraw', Account: issuer.classicAddress, LoanBrokerID: brokerID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [aliceCred] },
      'coverWithdraw + a credential issuer is not the subject of', 'tecBAD_CREDENTIALS')
    await go(client, issuer, { TransactionType: 'LoanBrokerCoverWithdraw', Account: issuer.classicAddress, LoanBrokerID: brokerID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [selfCred] },
      'coverWithdraw + own self-issued credential -> ALLOWED')
  }

  // ============================================================= G. REVOCATION
  console.log('\n-- G. REVOKE alice\'s credential while she holds shares')
  const before = await shareBalance(client, alice.classicAddress, shareID)
  console.log(`       alice shares BEFORE revocation: ${J(before)}`)
  rec({ label: 'alice shares before revocation', value: before })

  const del = await go(client, issuer, {
    TransactionType: 'CredentialDelete', Account: issuer.classicAddress,
    Subject: alice.classicAddress, Issuer: issuer.classicAddress, CredentialType: KYC,
  }, 'CredentialDelete by the ISSUER (revocation)')
  console.log(`       deleted Credential entries: ${J(deleted(del.meta, 'Credential'))}`)
  const stillThere = (await objects(client, alice.classicAddress, 'credential')).filter(o => o.index === aliceCred)
  console.log(`       alice credential still on ledger? ${stillThere.length > 0}`)

  const after = await shareBalance(client, alice.classicAddress, shareID)
  console.log(`       alice shares AFTER revocation:  ${J(after)}`)
  rec({ label: 'alice shares after revocation', value: after })

  await go(client, alice, { TransactionType: 'VaultDeposit', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'G1 revoked: VaultDeposit', 'tecNO_AUTH')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'G2 revoked: VaultWithdraw to SELF')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: bob.classicAddress, CredentialIDs: [aliceCred] },
    'G3 revoked: VaultWithdraw -> bob (+ dead CredentialIDs)', 'tecBAD_CREDENTIALS')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: issuer.classicAddress },
    'G4 revoked: VaultWithdraw -> issuer (a domain member)', 'tecNO_AUTH')
  await go(client, alice, { TransactionType: 'Payment', Account: alice.classicAddress, Destination: issuer.classicAddress,
    Amount: { mpt_issuance_id: shareID, value: '1' } },
    'G5 revoked: pay 1 SHARE to a domain member', 'tecNO_AUTH')
  await go(client, alice, { TransactionType: 'OfferCreate', Account: alice.classicAddress,
    TakerGets: { mpt_issuance_id: shareID, value: '1' }, TakerPays: '1000000' },
    'G6 revoked: rest a DEX sell offer in shares', 'tecUNFUNDED_OFFER')

  const rest = await shareBalance(client, alice.classicAddress, shareID)
  console.log(`       alice shares remaining: ${J(rest)}`)
  if (rest && rest.amount !== '0') {
    await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID,
      Amount: { mpt_issuance_id: shareID, value: rest.amount } },
      'G7 revoked: withdraw EVERY remaining share to self')
    const end = await shareBalance(client, alice.classicAddress, shareID)
    console.log(`       alice shares at the end: ${J(end)}`)
    rec({ label: 'alice shares at the end', value: end })
  }

  // ============================================================= H. EXPIRY
  console.log('\n-- H. bob\'s credential EXPIRES while he holds shares')
  let now = await closeTime(client)
  while (now <= bobExpiry) {
    console.log(`       waiting for expiry: close_time ${now} < ${bobExpiry}`)
    await sleep(15000)
    now = await closeTime(client)
  }
  const bobCredBefore = (await objects(client, bob.classicAddress, 'credential')).filter(o => o.index === bobCred)
  console.log(`       bob credential on ledger before the failing tx? ${bobCredBefore.length > 0}  ${J(bobCredBefore[0]?.Expiration)}`)
  rec({ label: 'bob credential before expiry tx', value: bobCredBefore[0] })

  const expDep = await go(client, bob, { TransactionType: 'VaultDeposit', Account: bob.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'H1 expired: VaultDeposit', 'tecEXPIRED')
  console.log(`       Credential entries DELETED by that FAILED tx: ${J(deleted(expDep.meta, 'Credential'))}`)
  rec({ label: 'credentials deleted by the tecEXPIRED deposit', value: deleted(expDep.meta, 'Credential') })
  const bobCredAfter = (await objects(client, bob.classicAddress, 'credential')).filter(o => o.index === bobCred)
  console.log(`       bob credential still on ledger after? ${bobCredAfter.length > 0}`)

  await go(client, bob, { TransactionType: 'VaultWithdraw', Account: bob.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'H2 expired: VaultWithdraw to SELF')
  await go(client, bob, { TransactionType: 'VaultWithdraw', Account: bob.classicAddress, VaultID: vaultID, Amount: '1000000', Destination: issuer.classicAddress },
    'H3 expired: VaultWithdraw -> issuer', 'tecNO_AUTH')

  // ============================================================= I. clearing the domain
  console.log('\n-- I. VaultSet DomainID rules')
  await go(client, issuer, { TransactionType: 'VaultSet', Account: issuer.classicAddress, VaultID: vaultID, DomainID: domain2ID },
    'VaultSet -> a domain nobody can join')
  await go(client, issuer, { TransactionType: 'VaultSet', Account: issuer.classicAddress, VaultID: vaultID, DomainID: ZERO256 },
    'VaultSet DomainID = 0 (clears it)')
  const cleared = await client.request({ command: 'ledger_entry', mpt_issuance: shareID, ledger_index: 'validated' })
    .then(r => r.result.node).catch(e => ({ error: String(e.message) }))
  console.log(`       share issuance after clearing: DomainID=${cleared.DomainID}  Flags=${cleared.Flags}`)
  rec({ label: 'share issuance after DomainID=0', node: cleared })
  await go(client, bob, { TransactionType: 'VaultDeposit', Account: bob.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'I1 deposit after DomainID=0 (nobody can join)', 'tecNO_AUTH')
  await go(client, bob, { TransactionType: 'VaultWithdraw', Account: bob.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'I2 withdraw to self after DomainID=0')

  // ============================================================= summary
  console.log('\n-- SUMMARY (code / expected / label / hash)')
  for (const r of log.filter(r => r.code)) {
    const flag = r.expect && r.code !== r.expect ? `  <== DIFF, expected ${r.expect}` : ''
    console.log(`  ${String(r.code).padEnd(22)} ${String(r.label).padEnd(54)} ${r.hash ?? ''}${flag}`)
  }
  console.log('\nIDs\n' + JSON.stringify({
    issuer: issuer.classicAddress, alice: alice.classicAddress, bob: bob.classicAddress, mallory: mallory.classicAddress,
    aliceCred, bobCred, malCred, selfCred, domainID, domain2ID, vaultID, shareID, brokerID,
  }, null, 2))

  await client.disconnect()
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
