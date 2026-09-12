// Part 2 of the credentials-domains-vault probe. Closes the three questions run 1
// left open (run 1 log: docs/research/credentials-domains-vault.md):
//   1. the share MPTokenIssuanceID is NOT in the VaultCreate metadata -> get it from vault_info
//   2. does a domain-gated vault gate the BORROWER? (run 1 fumbled LoanBrokerSet locally)
//   3. after revocation: share PAYMENT and DEX OFFER in shares, and a full exit to self
// Run: node scripts/experiments/credentials-domains-vault-2.mjs
import { Client } from 'xrpl'
import { NETS, fund, createdId, sleep, hex, submitLoanSet } from '../lib/lending.mjs'

const NET = NETS.t1
const log = []
const rec = (o) => { log.push(o); return o }
const J = (x) => JSON.stringify(x)
const KYC = hex('recall.eligible.v1')

async function go(client, wallet, tx, label, expect = 'tesSUCCESS') {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.submitAndWait(signed.tx_blob)
    const code = r.result.meta.TransactionResult
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(50)} ${String(code).padEnd(22)} ${r.result.hash}`)
    return rec({ label, code, hash: r.result.hash, meta: r.result.meta, expect })
  } catch (e) {
    console.log(`  THROW ${label.padEnd(49)} ${String(e.message).slice(0, 140)}`)
    return rec({ label, code: 'THROWN(xrpl.js)', error: String(e.message), expect })
  }
}

const objects = (client, account, type) =>
  client.request({ command: 'account_objects', account, type, ledger_index: 'validated' })
    .then(r => r.result.account_objects).catch(() => [])

async function shares(client, account, mptid) {
  const m = (await objects(client, account, 'mptoken')).find(o => o.MPTokenIssuanceID === mptid)
  return m ? { MPTAmount: m.MPTAmount ?? '0', Flags: m.Flags ?? 0 } : null
}

const main = async () => {
  const client = new Client(NET.wss)
  await client.connect()
  const info = await client.request({ command: 'server_info' })
  console.log(`\n=== ${NET.name}\n  rippled ${info.result.info.build_version}  network_id ${info.result.info.network_id}`)

  const issuer  = await fund(NET, 'issuer');  await sleep(1500)
  const alice   = await fund(NET, 'alice');   await sleep(1500)
  const mallory = await fund(NET, 'mallory'); await sleep(1500)

  console.log('\n-- setup: credential, domain, private vault')
  const cA = await go(client, issuer, { TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: alice.classicAddress, CredentialType: KYC }, 'CredentialCreate issuer->alice')
  const aliceCred = createdId(cA.meta, 'Credential')
  await go(client, alice, { TransactionType: 'CredentialAccept', Account: alice.classicAddress,
    Issuer: issuer.classicAddress, CredentialType: KYC }, 'CredentialAccept alice')
  const cS = await go(client, issuer, { TransactionType: 'CredentialCreate', Account: issuer.classicAddress,
    Subject: issuer.classicAddress, CredentialType: KYC }, 'CredentialCreate issuer->issuer (self)')
  const selfCred = createdId(cS.meta, 'Credential')

  const pd = await go(client, issuer, { TransactionType: 'PermissionedDomainSet', Account: issuer.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: issuer.classicAddress, CredentialType: KYC } }] }, 'PermissionedDomainSet')
  const domainID = createdId(pd.meta, 'PermissionedDomain')

  const vc = await go(client, issuer, { TransactionType: 'VaultCreate', Account: issuer.classicAddress,
    Asset: { currency: 'XRP' }, DomainID: domainID, Flags: 0x00010000, WithdrawalPolicy: 1,
    Data: hex('recall part 2') }, 'VaultCreate private + DomainID')
  const vaultID = createdId(vc.meta, 'Vault')

  // Q1: where does the share MPTokenIssuanceID come from?
  const created = (vc.meta?.AffectedNodes ?? []).map(n => n.CreatedNode).filter(Boolean)
  console.log('\n-- Q1. share MPTokenIssuanceID discovery')
  console.log(`       VaultCreate CreatedNode types: ${created.map(n => n.LedgerEntryType).join(', ')}`)
  const issuanceCN = created.find(n => n.LedgerEntryType === 'MPTokenIssuance')
  console.log(`       MPTokenIssuance CreatedNode.NewFields keys: ${Object.keys(issuanceCN?.NewFields ?? {}).join(', ')}`)
  console.log(`       ...NewFields.MPTokenIssuanceID = ${issuanceCN?.NewFields?.MPTokenIssuanceID}`)
  const vaultLE = await client.request({ command: 'ledger_entry', vault: vaultID, ledger_index: 'validated' }).then(r => r.result.node)
  console.log(`       Vault.ShareMPTID              = ${vaultLE.ShareMPTID}`)
  const vi = await client.request({ command: 'vault_info', vault_id: vaultID }).then(r => r.result)
  console.log(`       vault_info.vault.shares       = ${J(vi.vault.shares)}`)
  rec({ label: 'vault_info.vault.shares', value: vi.vault.shares })
  const shareID = vaultLE.ShareMPTID
  console.log(`       -> using ShareMPTID ${shareID}`)

  await go(client, alice, { TransactionType: 'VaultDeposit', Account: alice.classicAddress, VaultID: vaultID, Amount: '300000000' }, 'VaultDeposit alice')
  await go(client, issuer, { TransactionType: 'VaultDeposit', Account: issuer.classicAddress, VaultID: vaultID, Amount: '100000000' }, 'VaultDeposit issuer (owner)')
  await go(client, mallory, { TransactionType: 'VaultDeposit', Account: mallory.classicAddress, VaultID: vaultID, Amount: '10000000' },
    'VaultDeposit mallory (no credential)', 'tecNO_AUTH')

  // Q2: the BORROWER is not domain-gated
  console.log('\n-- Q2. can an account the vault REFUSED as a depositor still BORROW from it?')
  const lb = await go(client, issuer, { TransactionType: 'LoanBrokerSet', Account: issuer.classicAddress, VaultID: vaultID,
    ManagementFeeRate: 1000, DebtMaximum: '100000000', CoverRateMinimum: 1000, CoverRateLiquidation: 1000 }, 'LoanBrokerSet on the private vault')
  const brokerID = createdId(lb.meta, 'LoanBroker')
  console.log(`       LoanBrokerID ${brokerID}`)
  await go(client, issuer, { TransactionType: 'LoanBrokerCoverDeposit', Account: issuer.classicAddress, LoanBrokerID: brokerID, Amount: '20000000' }, 'LoanBrokerCoverDeposit')

  const loan = await submitLoanSet(client, issuer, mallory, {
    TransactionType: 'LoanSet', Account: issuer.classicAddress, Counterparty: mallory.classicAddress,
    LoanBrokerID: brokerID, PrincipalRequested: '10000000', InterestRate: 5000,
    PaymentInterval: 300, PaymentTotal: 2, GracePeriod: 60, Data: hex('borrower outside the domain'),
  }, 'LoanSet, BORROWER = the refused depositor')
  rec({ label: 'LoanSet to a non-domain borrower', code: loan.code, hash: loan.hash })
  const loanID = loan.meta ? createdId(loan.meta, 'Loan') : null
  console.log(`       LoanID ${loanID}`)
  if (loanID) {
    await go(client, mallory, { TransactionType: 'LoanPay', Account: mallory.classicAddress, LoanID: loanID, Amount: '6000000' },
      'LoanPay by the non-domain borrower')
  }

  // Q3: revocation, in full
  console.log('\n-- Q3. revoke alice, then try every way out of the position')
  const b0 = await shares(client, alice.classicAddress, shareID)
  console.log(`       alice shares before revocation: ${J(b0)}`)
  rec({ label: 'alice shares before revocation', value: b0 })

  await go(client, issuer, { TransactionType: 'CredentialDelete', Account: issuer.classicAddress,
    Subject: alice.classicAddress, Issuer: issuer.classicAddress, CredentialType: KYC }, 'CredentialDelete (revoke alice)')
  const b1 = await shares(client, alice.classicAddress, shareID)
  console.log(`       alice shares after revocation:  ${J(b1)}`)
  rec({ label: 'alice shares after revocation', value: b1 })

  await go(client, alice, { TransactionType: 'VaultDeposit', Account: alice.classicAddress, VaultID: vaultID, Amount: '1000000' },
    'revoked: VaultDeposit', 'tecNO_AUTH')
  await go(client, alice, { TransactionType: 'Payment', Account: alice.classicAddress, Destination: issuer.classicAddress,
    Amount: { mpt_issuance_id: shareID, value: '1' } }, 'revoked: PAY 1 share to a domain member', 'tecNO_AUTH')
  await go(client, alice, { TransactionType: 'OfferCreate', Account: alice.classicAddress,
    TakerGets: { mpt_issuance_id: shareID, value: '1' }, TakerPays: '1000000' },
    'revoked: rest a DEX SELL offer in shares', 'tecUNFUNDED_OFFER')
  await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID,
    Amount: '1000000', Destination: issuer.classicAddress }, 'revoked: withdraw -> a domain member', 'tecNO_AUTH')

  const b2 = await shares(client, alice.classicAddress, shareID)
  const all = await go(client, alice, { TransactionType: 'VaultWithdraw', Account: alice.classicAddress, VaultID: vaultID,
    Amount: { mpt_issuance_id: shareID, value: b2.MPTAmount } }, `revoked: withdraw ALL ${b2.MPTAmount} shares to SELF`)
  const b3 = await shares(client, alice.classicAddress, shareID)
  console.log(`       alice shares after the full exit: ${J(b3)}`)
  console.log(`       delivered: ${J(all.meta?.delivered_amount ?? all.meta?.DeliveredAmount)}`)
  rec({ label: 'alice shares after full exit', value: b3, delivered: all.meta?.delivered_amount })

  // and the mirror: can a revoked holder still RECEIVE shares?
  await go(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: alice.classicAddress,
    Amount: { mpt_issuance_id: shareID, value: '1' } }, 'a domain member PAYS 1 share TO the revoked holder', 'tecNO_AUTH')

  console.log('\n-- SUMMARY')
  for (const r of log.filter(r => r.code)) {
    const flag = r.expect && r.code !== r.expect ? `  <== DIFF, expected ${r.expect}` : ''
    console.log(`  ${String(r.code).padEnd(22)} ${String(r.label).padEnd(52)} ${r.hash ?? ''}${flag}`)
  }
  console.log('\nIDs\n' + JSON.stringify({ issuer: issuer.classicAddress, alice: alice.classicAddress, mallory: mallory.classicAddress,
    aliceCred, selfCred, domainID, vaultID, shareID, brokerID, loanID }, null, 2))
  await client.disconnect()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
