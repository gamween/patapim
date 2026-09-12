// slug: mpt-vault-asset, run 5.
// XLS-65 §3.7.2 item 4.3 says VaultClawback fails if MPTokenIssuance.lsfMPTCanLock is NOT set.
// rippled VaultClawback.cpp preclaim only checks lsfMPTCanClawback. Which is true on chain?
import fs from 'node:fs'
import { Wallet } from 'xrpl'
import { connect, submit, createdId } from '../lib/lending.mjs'
const CACHE = '/private/tmp/claude-501/-Users-fianso-Development-hackathons-patapim/8aa6c9a4-f1d0-41c5-ad64-3a3f5d140504/scratchpad/mpt-vault-asset-seeds.json'
const F = { tfMPTCanLock: 0x2, tfMPTCanTrade: 0x10, tfMPTCanTransfer: 0x20, tfMPTCanClawback: 0x40 }

const main = async () => {
  const { client } = await connect('t1')
  const s = JSON.parse(fs.readFileSync(CACHE, 'utf8'))
  const { issuer, agent, lender } = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Wallet.fromSeed(v)]))

  console.log('\n== CanClawback SET, CanLock NOT set')
  const r = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 0, MaximumAmount: '1000000',
    Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade | F.tfMPTCanClawback,   // deliberately NO tfMPTCanLock
  }, 'MPTokenIssuanceCreate CLAW-NOLOCK')
  const ID = r.meta?.mpt_issuance_id
  console.log(`      ID = ${ID}`)
  const issu = await client.request({ command: 'ledger_entry', mpt_issuance: ID, ledger_index: 'validated' })
  console.log('      issuance flags = ' + issu.result.node.Flags + '  (0x40=CanClawback 0x2=CanLock 0x20=CanTransfer 0x10=CanTrade)')

  await submit(client, lender, { TransactionType: 'MPTokenAuthorize', Account: lender.classicAddress, MPTokenIssuanceID: ID }, 'lender opts in')
  await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: lender.classicAddress, Amount: { mpt_issuance_id: ID, value: '500000' } }, 'Payment -> lender')
  const v = await submit(client, agent, { TransactionType: 'VaultCreate', Account: agent.classicAddress, Asset: { mpt_issuance_id: ID } }, 'VaultCreate (CanClawback, no CanLock)')
  const vid = createdId(v.meta, 'Vault')
  console.log(`      VaultID = ${vid}`)
  await submit(client, lender, { TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vid, Amount: { mpt_issuance_id: ID, value: '200000' } }, 'VaultDeposit')
  await submit(client, issuer, {
    TransactionType: 'VaultClawback', Account: issuer.classicAddress, VaultID: vid,
    Holder: lender.classicAddress, Amount: { mpt_issuance_id: ID, value: '50000' },
  }, 'VaultClawback (spec says should FAIL)', 'tecNO_PERMISSION')
  const vn = await client.request({ command: 'ledger_entry', vault: vid, ledger_index: 'validated' })
  console.log('      vault after: ' + JSON.stringify({ AssetsTotal: vn.result.node.AssetsTotal, AssetsAvailable: vn.result.node.AssetsAvailable }))
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
