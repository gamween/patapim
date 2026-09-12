// slug: mpt-vault-asset, run 3. Reuses the cached run-2 accounts and objects.
// Probes: fractional PeriodicPayment on an integral asset, share-denominated
// withdrawal, issuer lock/clawback over a vault-held security, cover withdraw.
import fs from 'node:fs'
import { Wallet } from 'xrpl'
import { encode, encodeForSigning } from 'ripple-binary-codec'
import { sign } from 'ripple-keypairs'
import { connect, submit, createdId, hex, sleep } from '../lib/lending.mjs'

const CACHE = '/private/tmp/claude-501/-Users-fianso-Development-hackathons-patapim/8aa6c9a4-f1d0-41c5-ad64-3a3f5d140504/scratchpad/mpt-vault-asset-seeds.json'
const IDS = {
  SEC: '00010749431A4B5B17B09D06F551A73EDDBC2C4A824F74AA',
  VAULT: 'CE69EA8055D1EC8A5716167B8D93905D2245EE6A35988A5A8F780365C771599E',
  SHARE: '00000001213BB420F789B609D8E93A7A86E08C6551B294EF',
  PSEUDO: 'rhp5FcTaNmjAywoieMWL3jZdejJHZ6MFsJ',
  BROKER: '1A7B6241935426C3220B110E1046EC1581E2B6CF520CC6B10BB4C4A62435A036',
  LOAN: '69741624517CA108C5D96C1EDD1C72AC659E88DF191642C3765094B491D562EC',
}
const J = (o) => JSON.stringify(o)
const log = []
const rec = (s, r, n = '') => { log.push({ s, code: r.code, hash: r.hash ?? null, n }); return r }

async function rawSubmit(client, wallet, tx, label, expect = 'tesSUCCESS') {
  try {
    const p = await client.autofill(tx)
    p.SigningPubKey = wallet.publicKey
    p.TxnSignature = sign(encodeForSigning(p), wallet.privateKey)
    const r = await client.submitAndWait(encode(p))
    const code = r.result.meta.TransactionResult
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(40)} ${code.padEnd(22)} ${r.result.hash}`)
    return { code, meta: r.result.meta, hash: r.result.hash }
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(40)} ${String(e.message).slice(0, 180)}`)
    return { code: 'THROWN', error: String(e.message) }
  }
}
const le = async (client, req) => { try { return (await client.request({ ...req, ledger_index: 'validated' })).result.node } catch (e) { return { ERR: String(e.message).slice(0, 140) } } }
const mpts = async (client, a) => { try { const r = await client.request({ command: 'account_objects', account: a, type: 'mptoken', ledger_index: 'validated' }); return r.result.account_objects.map(o => ({ id: o.MPTokenIssuanceID, amt: o.MPTAmount ?? '0', flags: o.Flags ?? 0 })) } catch (e) { return [{ ERR: String(e.message).slice(0, 90) }] } }

const main = async () => {
  const { client } = await connect('t1')
  const seeds = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const { issuer, agent, lender, mm } = Object.fromEntries(Object.entries(seeds).map(([k, v]) => [k, Wallet.fromSeed(v)]))
  console.log(`  issuer=${issuer.classicAddress} agent=${agent.classicAddress} lender=${lender.classicAddress} mm=${mm.classicAddress}`)

  // --- exact state we inherit
  const loan0 = await le(client, { command: 'ledger_entry', index: IDS.LOAN })
  console.log('\n-- inherited Loan: ' + J(loan0))
  console.log('-- inherited Vault: ' + J(await le(client, { command: 'ledger_entry', vault: IDS.VAULT })))

  // ============ A. the fractional PeriodicPayment on an integral asset
  console.log('\n== A. PeriodicPayment is fractional; the asset is integral')
  const PP = loan0.PeriodicPayment
  console.log(`      PeriodicPayment = ${PP}   (vault asset is an MPT: integer units only)`)
  rec('A1 LoanPay exact PeriodicPayment', await rawSubmit(client, mm, {
    TransactionType: 'LoanPay', Account: mm.classicAddress, LoanID: IDS.LOAN,
    Amount: { mpt_issuance_id: IDS.SEC, value: PP },
  }, `LoanPay Amount=${PP}`))
  const due = loan0.TotalValueOutstanding
  rec('A2 LoanPay exact TotalValueOutstanding', await submit(client, mm, {
    TransactionType: 'LoanPay', Account: mm.classicAddress, LoanID: IDS.LOAN,
    Amount: { mpt_issuance_id: IDS.SEC, value: String(due) },
  }, `LoanPay Amount=${due} (full)`))
  console.log('      Loan after: ' + J(await le(client, { command: 'ledger_entry', index: IDS.LOAN })))
  console.log('      Vault after: ' + J(await le(client, { command: 'ledger_entry', vault: IDS.VAULT })))
  console.log('      Broker after: ' + J(await le(client, { command: 'ledger_entry', index: IDS.BROKER })))

  // ============ B. withdraw denominated in SHARES
  console.log('\n== B. VaultWithdraw denominated in the share MPT')
  const before = await mpts(client, lender.classicAddress)
  console.log('      lender before: ' + J(before))
  rec('B1 VaultWithdraw Amount = shares', await submit(client, lender, {
    TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: IDS.VAULT,
    Amount: { mpt_issuance_id: IDS.SHARE, value: '1000000' },
  }, 'VaultWithdraw (1000000 shares)'))
  console.log('      lender after : ' + J(await mpts(client, lender.classicAddress)))

  // ============ C. issuer control over a security sitting in a vault
  console.log('\n== C. issuer lock / clawback over the security inside the vault')
  rec('C1 MPTokenIssuanceSet global lock', await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceSet', Account: issuer.classicAddress,
    MPTokenIssuanceID: IDS.SEC, Flags: 0x00000001, // tfMPTLock
  }, 'MPTokenIssuanceSet tfMPTLock (global)'))
  rec('C2 VaultDeposit while globally locked', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: IDS.VAULT,
    Amount: { mpt_issuance_id: IDS.SEC, value: '1000' },
  }, 'VaultDeposit (globally locked)', 'tecLOCKED'))
  rec('C3 VaultWithdraw while globally locked', await submit(client, lender, {
    TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: IDS.VAULT,
    Amount: { mpt_issuance_id: IDS.SEC, value: '1000' },
  }, 'VaultWithdraw (globally locked)', 'tecLOCKED'))
  rec('C4 unlock', await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceSet', Account: issuer.classicAddress,
    MPTokenIssuanceID: IDS.SEC, Flags: 0x00000002, // tfMPTUnlock
  }, 'MPTokenIssuanceSet tfMPTUnlock'))
  rec('C5 individual lock on the vault pseudo-account', await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceSet', Account: issuer.classicAddress,
    MPTokenIssuanceID: IDS.SEC, Holder: IDS.PSEUDO, Flags: 0x00000001,
  }, 'lock the vault pseudo-account holding'))
  rec('C6 VaultDeposit with pseudo locked', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: IDS.VAULT,
    Amount: { mpt_issuance_id: IDS.SEC, value: '1000' },
  }, 'VaultDeposit (pseudo locked)', 'tecLOCKED'))
  rec('C7 unlock pseudo', await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceSet', Account: issuer.classicAddress,
    MPTokenIssuanceID: IDS.SEC, Holder: IDS.PSEUDO, Flags: 0x00000002,
  }, 'unlock the vault pseudo-account holding'))

  console.log('\n   VaultClawback: the security issuer pulls assets out of the vault')
  const vaultBefore = await le(client, { command: 'ledger_entry', vault: IDS.VAULT })
  console.log('      vault before: ' + J({ AssetsTotal: vaultBefore.AssetsTotal, AssetsAvailable: vaultBefore.AssetsAvailable }))
  rec('C8 VaultClawback by asset issuer', await submit(client, issuer, {
    TransactionType: 'VaultClawback', Account: issuer.classicAddress, VaultID: IDS.VAULT,
    Holder: lender.classicAddress, Amount: { mpt_issuance_id: IDS.SEC, value: '100000' },
  }, 'VaultClawback (issuer, 100000 SEC)'))
  console.log('      vault after : ' + J(await le(client, { command: 'ledger_entry', vault: IDS.VAULT })))
  console.log('      lender after: ' + J(await mpts(client, lender.classicAddress)))
  rec('C9 VaultClawback by the vault OWNER (not issuer)', await submit(client, agent, {
    TransactionType: 'VaultClawback', Account: agent.classicAddress, VaultID: IDS.VAULT,
    Holder: lender.classicAddress, Amount: { mpt_issuance_id: IDS.SEC, value: '1000' },
  }, 'VaultClawback (vault owner)', 'tecNO_PERMISSION'))

  // ============ D. cover withdraw in the security
  console.log('\n== D. LoanBrokerCoverWithdraw in the security')
  rec('D1 LoanBrokerCoverWithdraw', await submit(client, agent, {
    TransactionType: 'LoanBrokerCoverWithdraw', Account: agent.classicAddress, LoanBrokerID: IDS.BROKER,
    Amount: { mpt_issuance_id: IDS.SEC, value: '200000' },
  }, 'LoanBrokerCoverWithdraw (SEC)'))
  console.log('      Broker: ' + J(await le(client, { command: 'ledger_entry', index: IDS.BROKER })))

  // ============ E. non-transferable shares over an MPT asset
  console.log('\n== E. tfVaultShareNonTransferable with an MPT asset')
  const nv = rec('E1 VaultCreate tfVaultShareNonTransferable', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: IDS.SEC }, Flags: 0x00020000,
  }, 'VaultCreate (non-transferable shares)'))
  const nvId = createdId(nv.meta, 'Vault')
  if (nvId) {
    const n = await le(client, { command: 'ledger_entry', vault: nvId })
    console.log('      share issuance: ' + J(await le(client, { command: 'ledger_entry', mpt_issuance: n.ShareMPTID })))
  }

  console.log('\n===== SUMMARY =====')
  for (const r of log) console.log(`${String(r.code).padEnd(20)} ${r.s.padEnd(46)} ${r.hash ?? ''} ${r.n}`)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
