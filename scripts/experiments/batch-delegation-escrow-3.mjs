// Third pass:
//  C. does xrpl.js's missing tfInnerBatchTxn actually bite? (autofillBatchTxn never sets it)
//  D. what IS atomically batchable next to a vault: EscrowCreate of vault SHARES + a Payment,
//     i.e. "lock the collateral and release the cash in one transaction".
import { connect, fund, submit, createdId, hex, sleep, nowRipple } from '../lib/lending.mjs'

const TF_INNER_BATCH = 0x40000000
const TF_ALL_OR_NOTHING = 0x00010000
const log = []
const rec = (s, r, n = '') => { log.push({ s, code: r.code, hash: r.hash ?? null, n }); return r }

async function trySubmit(client, wallet, tx, label, expect) {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.submit(signed.tx_blob)
    const code = r.result.engine_result
    console.log(`  ${expect ? (code === expect ? 'OK  ' : 'DIFF') : '    '} ${label.padEnd(50)} ${String(code).padEnd(24)} ${signed.hash}`)
    console.log(`       msg: ${r.result.engine_result_message}`)
    return { code, hash: signed.hash }
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(50)} ${String(e.message).slice(0, 200)}`)
    return { code: 'THROWN', error: String(e.message) }
  }
}

const main = async () => {
  const { client, net } = await connect('t1')
  const A = await fund(net, 'A3')
  const B = await fund(net, 'B3')
  await sleep(4000)

  const v = rec('D0 VaultCreate', await submit(client, A, {
    TransactionType: 'VaultCreate', Account: A.classicAddress, Asset: { currency: 'XRP' },
    WithdrawalPolicy: 1, Data: hex('batchable escrow'),
  }, 'VaultCreate open-ended XRP'))
  const vaultId = createdId(v.meta, 'Vault')
  const SHARE = (await client.request({ command: 'ledger_entry', index: vaultId, ledger_index: 'validated' })).result.node.ShareMPTID
  console.log(`       VaultID ${vaultId}  SHARE ${SHARE}`)
  rec('D0b VaultDeposit 200 XRP', await submit(client, A, {
    TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: vaultId, Amount: '200000000',
  }, 'VaultDeposit 200 XRP'))

  console.log('\n##### C - inner batch flag #####')
  // Inner WITHOUT tfInnerBatchTxn, exactly what xrpl.js autofill leaves you with.
  rec('C1 Batch inners missing tfInnerBatchTxn', await trySubmit(client, A, {
    TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_ALL_OR_NOTHING,
    RawTransactions: [
      { RawTransaction: { TransactionType: 'Payment', Account: A.classicAddress, Destination: B.classicAddress, Amount: '1000000', Fee: '0', SigningPubKey: '' } },
      { RawTransaction: { TransactionType: 'Payment', Account: A.classicAddress, Destination: B.classicAddress, Amount: '2000000', Fee: '0', SigningPubKey: '' } },
    ],
  }, 'Batch[Payment,Payment] w/o tfInnerBatchTxn', 'temINVALID_FLAG'))

  console.log('\n##### D - escrow of vault shares IS batchable #####')
  const finishAfter = nowRipple() + 600
  const inner = (tx) => ({ ...tx, Flags: (tx.Flags ?? 0) | TF_INNER_BATCH, Fee: '0', SigningPubKey: '' })
  rec('D1 Batch[EscrowCreate(shares), Payment]', await trySubmit(client, A, {
    TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_ALL_OR_NOTHING,
    RawTransactions: [
      { RawTransaction: inner({ TransactionType: 'EscrowCreate', Account: A.classicAddress, Destination: B.classicAddress, Amount: { mpt_issuance_id: SHARE, value: '60000000' }, FinishAfter: finishAfter }) },
      { RawTransaction: inner({ TransactionType: 'Payment', Account: A.classicAddress, Destination: B.classicAddress, Amount: '5000000' }) },
    ],
  }, 'Batch[EscrowCreate(vault shares),Payment]', 'tesSUCCESS'))

  await sleep(6000)
  const am = (await client.request({ command: 'account_objects', account: A.classicAddress, type: 'mptoken', ledger_index: 'validated' })).result.account_objects
  console.log(`       A share MPToken after batch: ${JSON.stringify(am)}`)
  const esc = (await client.request({ command: 'account_objects', account: A.classicAddress, type: 'escrow', ledger_index: 'validated' })).result.account_objects
  console.log(`       A escrows: ${JSON.stringify(esc)}`)

  console.log('\n===== SUMMARY =====')
  for (const r of log) console.log(`${String(r.code).padEnd(24)} ${r.s.padEnd(44)} ${r.hash ?? ''} ${r.n}`)
  console.log(`\nVAULT=${vaultId}\nSHARE=${SHARE}\nA=${A.classicAddress}\nB=${B.classicAddress}`)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
