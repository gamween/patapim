// Follow-up to batch-delegation-escrow:
//  A. numeric PermissionValue on the wire (xrpl.js refuses it client-side; does rippled?)
//  B. the full "vault shares as escrowed collateral" loop: escrow -> finish -> the
//     RECEIVER redeems the underlying out of a vault it never deposited into.
import { encode, encodeForSigning } from 'ripple-binary-codec'
import { sign as kpSign } from 'ripple-keypairs'
import { connect, fund, submit, createdId, hex, sleep, nowRipple } from '../lib/lending.mjs'

const log = []
const rec = (s, r, n = '') => { log.push({ s, code: r.code, hash: r.hash ?? null, n }); return r }

// Sign + submit WITHOUT going through xrpl.js model validation.
async function rawSubmit(client, wallet, tx, label, expect) {
  const ai = await client.request({ command: 'account_info', account: tx.Account, ledger_index: 'validated' })
  const li = await client.getLedgerIndex()
  const full = { ...tx, Fee: tx.Fee ?? '20', Sequence: ai.result.account_data.Sequence, LastLedgerSequence: li + 20, NetworkID: 4001, SigningPubKey: wallet.publicKey }
  full.TxnSignature = kpSign(encodeForSigning(full), wallet.privateKey)
  const blob = encode(full)
  const r = await client.submit(blob)
  const code = r.result.engine_result
  console.log(`  ${expect ? (code === expect ? 'OK  ' : 'DIFF') : '    '} ${label.padEnd(46)} ${String(code).padEnd(26)} ${r.result.tx_json?.hash ?? ''}`)
  console.log(`       msg: ${r.result.engine_result_message}`)
  return { code, hash: r.result.tx_json?.hash, msg: r.result.engine_result_message }
}

const main = async () => {
  const { client, net } = await connect('t1')
  const A = await fund(net, 'A2-owner')
  const B = await fund(net, 'B2-taker')
  await sleep(4000)

  // ─────────────── A. numeric PermissionValue
  console.log('\n##### A - numeric PermissionValue on the wire #####')
  // Payment is ttPAYMENT = 0, so its permission value is 0 + 1 = 1.
  rec('A1 DelegateSet PermissionValue=1 (Payment)', await rawSubmit(client, A, {
    TransactionType: 'DelegateSet', Account: A.classicAddress, Authorize: B.classicAddress,
    Permissions: [{ Permission: { PermissionValue: 1 } }],
  }, 'DelegateSet [1] == Payment', 'tesSUCCESS'))
  await sleep(5000)
  const d = await client.request({ command: 'account_objects', account: A.classicAddress, type: 'delegate', ledger_index: 'validated' })
  console.log(`       Delegate object: ${JSON.stringify(d.result.account_objects)}`)
  // VaultDeposit is ttVAULT_DEPOSIT = 68 -> permission value 69.
  rec('A2 DelegateSet PermissionValue=69 (VaultDeposit)', await rawSubmit(client, A, {
    TransactionType: 'DelegateSet', Account: A.classicAddress, Authorize: B.classicAddress,
    Permissions: [{ Permission: { PermissionValue: 69 } }],
  }, 'DelegateSet [69] == VaultDeposit', 'temMALFORMED'))

  // ─────────────── B. vault shares as escrowed collateral, end to end
  console.log('\n##### B - vault shares escrowed, then seized by the receiver #####')
  const v = rec('B1 VaultCreate open-ended XRP', await submit(client, A, {
    TransactionType: 'VaultCreate', Account: A.classicAddress, Asset: { currency: 'XRP' },
    WithdrawalPolicy: 1, Data: hex('share collateral loop'),
  }, 'VaultCreate open-ended XRP'))
  const vaultId = createdId(v.meta, 'Vault')
  const vn = (await client.request({ command: 'ledger_entry', index: vaultId, ledger_index: 'validated' })).result.node
  const SHARE = vn.ShareMPTID
  console.log(`       VaultID ${vaultId}  ShareMPTID ${SHARE}`)

  rec('B2 VaultDeposit 200 XRP by A', await submit(client, A, {
    TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: vaultId, Amount: '200000000',
  }, 'VaultDeposit 200 XRP (A)'))

  // The escrow receiver must already hold an MPToken for the share issuance.
  rec('B3 B authorizes the SHARE MPT', await submit(client, B, {
    TransactionType: 'MPTokenAuthorize', Account: B.classicAddress, MPTokenIssuanceID: SHARE,
  }, 'MPTokenAuthorize(share) by a non-depositor'))

  const finishAfter = nowRipple() + 20
  const ai = await client.request({ command: 'account_info', account: A.classicAddress, ledger_index: 'validated' })
  const escrowSeq = ai.result.account_data.Sequence
  rec('B4 EscrowCreate 50M shares A -> B', await submit(client, A, {
    TransactionType: 'EscrowCreate', Account: A.classicAddress, Destination: B.classicAddress,
    Amount: { mpt_issuance_id: SHARE, value: '50000000' }, FinishAfter: finishAfter,
  }, 'EscrowCreate 50M shares -> B'))
  console.log(`       escrow OfferSequence = ${escrowSeq}`)

  console.log('       waiting out FinishAfter ...')
  while (nowRipple() < finishAfter + 8) await sleep(5000)

  rec('B5 EscrowFinish by B', await submit(client, B, {
    TransactionType: 'EscrowFinish', Account: B.classicAddress, Owner: A.classicAddress, OfferSequence: escrowSeq,
  }, 'EscrowFinish (B takes the shares)'))

  const bm = (await client.request({ command: 'account_objects', account: B.classicAddress, type: 'mptoken', ledger_index: 'validated' })).result.account_objects
  console.log(`       B MPTokens: ${JSON.stringify(bm)}`)
  const am = (await client.request({ command: 'account_objects', account: A.classicAddress, type: 'mptoken', ledger_index: 'validated' })).result.account_objects
  console.log(`       A MPTokens: ${JSON.stringify(am)}`)
  const before = await client.request({ command: 'account_info', account: B.classicAddress, ledger_index: 'validated' })
  console.log(`       B XRP before withdraw: ${before.result.account_data.Balance}`)

  // B now redeems the underlying XRP out of a vault it never deposited into.
  rec('B6 VaultWithdraw by B using seized shares', await submit(client, B, {
    TransactionType: 'VaultWithdraw', Account: B.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SHARE, value: '50000000' },
  }, 'VaultWithdraw by the share taker'))
  const after = await client.request({ command: 'account_info', account: B.classicAddress, ledger_index: 'validated' })
  console.log(`       B XRP after withdraw:  ${after.result.account_data.Balance}`)
  const vn2 = (await client.request({ command: 'ledger_entry', index: vaultId, ledger_index: 'validated' })).result.node
  console.log(`       vault now: AssetsTotal=${vn2.AssetsTotal} AssetsAvailable=${vn2.AssetsAvailable}`)

  console.log('\n===== SUMMARY =====')
  for (const r of log) console.log(`${String(r.code).padEnd(26)} ${r.s.padEnd(46)} ${r.hash ?? ''} ${r.n}`)
  console.log(`\nVAULT=${vaultId}\nSHARE=${SHARE}\nA=${A.classicAddress}\nB=${B.classicAddress}`)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
