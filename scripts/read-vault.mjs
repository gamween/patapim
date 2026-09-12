// Read path for a dashboard: everything a UI needs about a vault, a broker and its loans,
// using only public rippled RPC. Written to answer the organizers' own feedback question:
// "Could you read position value, utilisation, available liquidity and accrued yield
//  without guessing from ledger objects?"
// Usage: node scripts/read-vault.mjs t1|t2 <VaultID> [holderAddress]
import { Client } from 'xrpl'
import { NETS } from './lib/lending.mjs'

const calls = []
async function rpc(client, req, why) {
  calls.push({ why, req })
  try { return (await client.request(req)).result } catch (e) { return { error: e.data?.error ?? e.message } }
}

const main = async () => {
  const [key = 't1', vaultId, holder] = process.argv.slice(2)
  if (!vaultId) { console.error('usage: node scripts/read-vault.mjs t1|t2 <VaultID> [holder]'); process.exit(1) }
  const client = new Client(NETS[key].wss)
  await client.connect()

  const vault = await rpc(client, { command: 'ledger_entry', index: vaultId, ledger_index: 'validated' }, 'the vault itself')
  const v = vault.node
  if (!v) { console.log('vault introuvable:', JSON.stringify(vault)); await client.disconnect(); return }
  console.log('\n=== VAULT ===')
  console.log(`  kind             ${v.VaultKind === 1 ? 'closed-ended' : 'open-ended'} (VaultKind=${v.VaultKind ?? 'absent'})`)
  console.log(`  asset            ${JSON.stringify(v.Asset)}`)
  console.log(`  owner            ${v.Owner}`)
  console.log(`  pseudo-account   ${v.Account}`)
  console.log(`  AssetsTotal      ${v.AssetsTotal ?? '(champ absent)'}`)
  console.log(`  AssetsAvailable  ${v.AssetsAvailable ?? '(champ absent)'}`)
  console.log(`  LossUnrealized   ${v.LossUnrealized ?? '(champ absent)'}`)
  console.log(`  AssetsMaximum    ${v.AssetsMaximum ?? '(champ absent)'}`)
  console.log(`  ShareMPTID       ${v.ShareMPTID}`)
  console.log(`  Scale            ${v.Scale ?? '(champ absent)'}`)
  console.log(`  dates            SubscriptionDate=${v.SubscriptionDate ?? '-'} RedemptionDate=${v.RedemptionDate ?? '-'}`)

  // SharesTotal is NOT on the vault: it lives on the share MPTokenIssuance as OutstandingAmount.
  const iss = await rpc(client, { command: 'ledger_entry', mpt_issuance: v.ShareMPTID, ledger_index: 'validated' }, 'shares outstanding, to compute price per share')
  const outstanding = iss.node?.OutstandingAmount
  console.log('\n=== SHARES ===')
  console.log(`  OutstandingAmount ${outstanding ?? '(illisible: ' + JSON.stringify(iss).slice(0, 120) + ')'}`)
  const assets = Number(v.AssetsTotal ?? 0)
  const shares = Number(outstanding ?? 0)
  console.log(`  price per share   ${shares > 0 ? (assets / shares).toFixed(8) : 'n/a (0 share)'}  [AssetsTotal / OutstandingAmount, calcul client]`)
  console.log(`  utilisation       ${assets > 0 ? (((assets - Number(v.AssetsAvailable ?? 0)) / assets) * 100).toFixed(2) + ' %' : 'n/a'}  [(AssetsTotal - AssetsAvailable) / AssetsTotal, calcul client]`)

  if (holder) {
    const pos = await rpc(client, { command: 'ledger_entry', mptoken: { mpt_issuance_id: v.ShareMPTID, account: holder }, ledger_index: 'validated' }, 'a holder position')
    const amt = pos.node?.MPTAmount
    console.log('\n=== POSITION ===')
    console.log(`  ${holder}`)
    console.log(`  shares            ${amt ?? '(illisible: ' + JSON.stringify(pos).slice(0, 120) + ')'}`)
    if (amt && shares > 0) console.log(`  value in asset    ${((Number(amt) / shares) * assets).toFixed(0)}`)
  }

  // Loan brokers and loans owned by the vault owner.
  const objs = await rpc(client, { command: 'account_objects', account: v.Owner, ledger_index: 'validated', limit: 200 }, 'brokers and loans of the vault owner')
  const byType = {}
  for (const o of objs.account_objects ?? []) (byType[o.LedgerEntryType] ??= []).push(o)
  console.log('\n=== OBJETS DU PROPRIETAIRE ===')
  for (const [t, list] of Object.entries(byType)) console.log(`  ${t.padEnd(22)} ${list.length}`)
  for (const b of byType.LoanBroker ?? []) {
    console.log(`\n  LoanBroker ${b.index}`)
    for (const [k, val] of Object.entries(b)) if (!['LedgerEntryType', 'index', 'PreviousTxnID', 'PreviousTxnLgrSeq', 'OwnerNode'].includes(k)) console.log(`    ${k.padEnd(22)} ${JSON.stringify(val)}`)
  }
  for (const l of byType.Loan ?? []) {
    console.log(`\n  Loan ${l.index}`)
    for (const [k, val] of Object.entries(l)) if (!['LedgerEntryType', 'index', 'PreviousTxnID', 'PreviousTxnLgrSeq', 'OwnerNode'].includes(k)) console.log(`    ${k.padEnd(22)} ${JSON.stringify(val)}`)
  }

  console.log('\n=== APPELS RPC UTILISES ===')
  calls.forEach((c, i) => console.log(`  ${i + 1}. ${c.why}\n     ${JSON.stringify(c.req)}`))
  await client.disconnect()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
