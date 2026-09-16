// Experiment: batch-delegation-escrow
// Three amendment combinations against XLS-65/66 lending on the Track 1 hackathon devnet:
//   (1) XLS-56 Batch          x Vault/Loan inner transactions
//   (2) XLS-75 PermissionDelegation x Vault/Loan permissions
//   (3) XLS-85 TokenEscrow    x vault shares / pseudo-accounts
// Every assertion has a control case so we can tell "our malformed tx" from "real gap".
import { connect, fund, submit, createdId, hex, sleep, nowRipple } from '../lib/lending.mjs'

const TF_INNER_BATCH = 0x40000000
const TF_ALL_OR_NOTHING = 0x00010000
const TF_INDEPENDENT = 0x00080000
const TF_VAULT_SHARE_NON_TRANSFERABLE = 0x00020000
const LSF_MPT_CAN_ESCROW = 0x8

const log = []
const rec = (step, r, note = '') => { log.push({ step, code: r.code, hash: r.hash ?? null, note }); return r }

// submitAndWait cannot observe tem*/ter* results (they never reach a validated ledger).
// trySubmit reports the raw engine_result from the `submit` command instead.
async function trySubmit(client, wallet, tx, label, expect) {
  try {
    const prepared = await client.autofill(tx)
    const signed = wallet.sign(prepared)
    const r = await client.submit(signed.tx_blob)
    const code = r.result.engine_result
    const mark = expect ? (code === expect ? 'OK  ' : 'DIFF') : '    '
    console.log(`  ${mark} ${label.padEnd(46)} ${String(code).padEnd(26)} ${signed.hash}`)
    console.log(`       msg: ${r.result.engine_result_message}`)
    return { code, hash: signed.hash, msg: r.result.engine_result_message, prepared }
  } catch (e) {
    console.log(`  ERR  ${label.padEnd(46)} ${String(e.message).slice(0, 180)}`)
    return { code: 'THROWN', error: String(e.message) }
  }
}

const objs = async (client, account, type) =>
  (await client.request({ command: 'account_objects', account, type, ledger_index: 'validated' })).result.account_objects

const main = async () => {
  const { client, net } = await connect('t1')
  const A = await fund(net, 'A-owner')
  const B = await fund(net, 'B-other')
  const C = await fund(net, 'C-delegate')
  await sleep(4000)

  // ───────────────────────────────────────────── setup: one open-ended XRP vault
  console.log('\n##### SETUP #####')
  const v = rec('0 VaultCreate open-ended XRP', await submit(client, A, {
    TransactionType: 'VaultCreate', Account: A.classicAddress,
    Asset: { currency: 'XRP' }, WithdrawalPolicy: 1, Data: hex('batch-delegation-escrow'),
  }, 'VaultCreate open-ended XRP'))
  const vaultId = createdId(v.meta, 'Vault')
  console.log(`       VaultID ${vaultId}`)
  const vaultNode = (await client.request({ command: 'ledger_entry', index: vaultId, ledger_index: 'validated' })).result.node
  const SHARE = vaultNode.ShareMPTID
  const PSEUDO = vaultNode.Account
  console.log(`       ShareMPTID ${SHARE}`)
  console.log(`       vault pseudo-account ${PSEUDO}`)

  rec('0b VaultDeposit 100 XRP', await submit(client, A, {
    TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: vaultId, Amount: '100000000',
  }, 'VaultDeposit 100 XRP'))

  const shareIssuance = (await client.request({
    command: 'ledger_entry', mpt_issuance: SHARE, ledger_index: 'validated',
  })).result.node
  console.log(`       share MPTokenIssuance Flags=${shareIssuance.Flags} (lsfMPTCanEscrow=${(shareIssuance.Flags & LSF_MPT_CAN_ESCROW) ? 'SET' : 'CLEAR'})  OutstandingAmount=${shareIssuance.OutstandingAmount}`)
  const myShares = (await objs(client, A.classicAddress, 'mptoken')).find(o => o.MPTokenIssuanceID === SHARE)
  console.log(`       A share MPToken: ${JSON.stringify(myShares)}`)
  const shareBal = BigInt(myShares?.MPTAmount ?? '0')

  // ───────────────────────────────────────────── PART 1: XLS-56 Batch
  console.log('\n##### PART 1 - BATCH (XLS-56 / BatchV1_1) #####')

  const inner = (tx) => ({ ...tx, Flags: TF_INNER_BATCH, Fee: '0', SigningPubKey: '' })

  // 1.1 CONTROL: a batch of two plain Payments must succeed, proving our envelope is right.
  const ctrl = await trySubmit(client, A, {
    TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_INDEPENDENT,
    RawTransactions: [
      { RawTransaction: inner({ TransactionType: 'Payment', Account: A.classicAddress, Destination: B.classicAddress, Amount: '1000000' }) },
      { RawTransaction: inner({ TransactionType: 'Payment', Account: A.classicAddress, Destination: C.classicAddress, Amount: '1000000' }) },
    ],
  }, 'CONTROL Batch[Payment,Payment]', 'tesSUCCESS')
  rec('1.1 CONTROL Batch[Payment,Payment]', ctrl)

  await sleep(5000)

  // 1.2 the assignment: Batch[VaultDeposit, LoanPay]
  const fakeLoanId = 'A'.repeat(64)
  const r12 = await trySubmit(client, A, {
    TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_ALL_OR_NOTHING,
    RawTransactions: [
      { RawTransaction: inner({ TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: vaultId, Amount: '1000000' }) },
      { RawTransaction: inner({ TransactionType: 'LoanPay', Account: A.classicAddress, LoanID: fakeLoanId, Amount: '1000000' }) },
    ],
  }, 'Batch[VaultDeposit,LoanPay]', 'temINVALID_INNER_BATCH')
  rec('1.2 Batch[VaultDeposit,LoanPay]', r12)

  // 1.3 one lending inner is enough to poison the whole batch
  const r13 = await trySubmit(client, A, {
    TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_ALL_OR_NOTHING,
    RawTransactions: [
      { RawTransaction: inner({ TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: vaultId, Amount: '1000000' }) },
      { RawTransaction: inner({ TransactionType: 'Payment', Account: A.classicAddress, Destination: B.classicAddress, Amount: '1000000' }) },
    ],
  }, 'Batch[VaultDeposit,Payment]', 'temINVALID_INNER_BATCH')
  rec('1.3 Batch[VaultDeposit,Payment]', r13)

  // 1.4 VaultCreate inner (the whole Vault family should be excluded too)
  const r14 = await trySubmit(client, A, {
    TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_ALL_OR_NOTHING,
    RawTransactions: [
      { RawTransaction: inner({ TransactionType: 'VaultCreate', Account: A.classicAddress, Asset: { currency: 'XRP' }, WithdrawalPolicy: 1 }) },
      { RawTransaction: inner({ TransactionType: 'Payment', Account: A.classicAddress, Destination: B.classicAddress, Amount: '1000000' }) },
    ],
  }, 'Batch[VaultCreate,Payment]', 'temINVALID_INNER_BATCH')
  rec('1.4 Batch[VaultCreate,Payment]', r14)

  // 1.5 LoanBrokerSet inner
  const r15 = await trySubmit(client, A, {
    TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_ALL_OR_NOTHING,
    RawTransactions: [
      { RawTransaction: inner({ TransactionType: 'LoanBrokerSet', Account: A.classicAddress, VaultID: vaultId }) },
      { RawTransaction: inner({ TransactionType: 'Payment', Account: A.classicAddress, Destination: B.classicAddress, Amount: '1000000' }) },
    ],
  }, 'Batch[LoanBrokerSet,Payment]', 'temINVALID_INNER_BATCH')
  rec('1.5 Batch[LoanBrokerSet,Payment]', r15)

  // 1.6 does xrpl.js client-side validation flag it? (it did not throw above => no)
  try {
    const { validate } = await import('xrpl')
    validate({
      TransactionType: 'Batch', Account: A.classicAddress, Flags: TF_ALL_OR_NOTHING, Fee: '40', Sequence: 1,
      RawTransactions: [
        { RawTransaction: { TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: vaultId, Amount: '1000000', Flags: TF_INNER_BATCH, Fee: '0', Sequence: 2, SigningPubKey: '' } },
        { RawTransaction: { TransactionType: 'LoanPay', Account: A.classicAddress, LoanID: fakeLoanId, Amount: '1000000', Flags: TF_INNER_BATCH, Fee: '0', Sequence: 3, SigningPubKey: '' } },
      ],
    })
    console.log('  NOTE xrpl.js validate() accepted Batch[VaultDeposit,LoanPay] client-side (no local guard)')
    rec('1.6 xrpl.js validate() client-side', { code: 'ACCEPTED' }, 'no client-side guard for disabled inner types')
  } catch (e) {
    console.log(`  NOTE xrpl.js validate() rejected: ${e.message}`)
    rec('1.6 xrpl.js validate() client-side', { code: 'REJECTED' }, e.message)
  }

  // ───────────────────────────────────────────── PART 2: XLS-75 PermissionDelegation
  console.log('\n##### PART 2 - PERMISSION DELEGATION (XLS-75 / PermissionDelegationV1_1) #####')

  // 2.1 CONTROL: delegate Payment to C
  rec('2.1 CONTROL DelegateSet [Payment]', await submit(client, A, {
    TransactionType: 'DelegateSet', Account: A.classicAddress, Authorize: C.classicAddress,
    Permissions: [{ Permission: { PermissionValue: 'Payment' } }],
  }, 'CONTROL DelegateSet [Payment]'))
  const delegates = await objs(client, A.classicAddress, 'delegate')
  console.log(`       Delegate object: ${JSON.stringify(delegates)}`)

  // 2.2 CONTROL: C actually uses it
  rec('2.2 CONTROL delegated Payment by C', await submit(client, C, {
    TransactionType: 'Payment', Account: A.classicAddress, Delegate: C.classicAddress,
    Destination: B.classicAddress, Amount: '1000000',
  }, 'CONTROL delegated Payment (A via C)'))

  // 2.3 every Vault / Loan permission, one at a time
  const LENDING_PERMS = [
    'VaultCreate', 'VaultSet', 'VaultDelete', 'VaultDeposit', 'VaultWithdraw', 'VaultClawback',
    'LoanBrokerSet', 'LoanBrokerDelete', 'LoanBrokerCoverDeposit', 'LoanBrokerCoverWithdraw',
    'LoanBrokerCoverClawback', 'LoanSet', 'LoanDelete', 'LoanManage', 'LoanPay',
  ]
  for (const p of LENDING_PERMS) {
    const r = await trySubmit(client, A, {
      TransactionType: 'DelegateSet', Account: A.classicAddress, Authorize: C.classicAddress,
      Permissions: [{ Permission: { PermissionValue: p } }],
    }, `DelegateSet [${p}]`, 'temMALFORMED')
    rec(`2.3 DelegateSet [${p}]`, r)
  }

  // 2.4 mixed array: does one non-delegable entry poison a valid one?
  rec('2.4 DelegateSet [Payment,VaultDeposit]', await trySubmit(client, A, {
    TransactionType: 'DelegateSet', Account: A.classicAddress, Authorize: C.classicAddress,
    Permissions: [{ Permission: { PermissionValue: 'Payment' } }, { Permission: { PermissionValue: 'VaultDeposit' } }],
  }, 'DelegateSet [Payment,VaultDeposit]', 'temMALFORMED'))

  // 2.5 C tries a VaultDeposit on A's behalf anyway
  rec('2.5 delegated VaultDeposit by C', await trySubmit(client, C, {
    TransactionType: 'VaultDeposit', Account: A.classicAddress, Delegate: C.classicAddress,
    VaultID: vaultId, Amount: '1000000',
  }, 'delegated VaultDeposit (A via C)', 'terNO_DELEGATE_PERMISSION'))

  // 2.6 numeric permission value instead of the name (VaultDeposit = ttVAULT_DEPOSIT 68 + 1)
  rec('2.6 DelegateSet [69 numeric]', await trySubmit(client, A, {
    TransactionType: 'DelegateSet', Account: A.classicAddress, Authorize: C.classicAddress,
    Permissions: [{ Permission: { PermissionValue: 69 } }],
  }, 'DelegateSet [PermissionValue=69]', 'temMALFORMED'))

  // ───────────────────────────────────────────── PART 3: XLS-85 TokenEscrow x vault
  console.log('\n##### PART 3 - TOKEN ESCROW (XLS-85) x VAULT #####')
  const finishAfter = nowRipple() + 120
  const escrowAmt = (shareBal / 4n).toString()
  console.log(`       A holds ${shareBal} shares; escrowing ${escrowAmt}`)

  // 3.1 escrow vault SHARES to an ordinary account
  rec('3.1 EscrowCreate vault shares -> B', await submit(client, A, {
    TransactionType: 'EscrowCreate', Account: A.classicAddress, Destination: B.classicAddress,
    Amount: { mpt_issuance_id: SHARE, value: escrowAmt }, FinishAfter: finishAfter,
  }, 'EscrowCreate(vault shares) -> ordinary acct'))

  const after31 = (await objs(client, A.classicAddress, 'mptoken')).find(o => o.MPTokenIssuanceID === SHARE)
  console.log(`       A share MPToken after escrow: ${JSON.stringify(after31)}`)
  const iss31 = (await client.request({ command: 'ledger_entry', mpt_issuance: SHARE, ledger_index: 'validated' })).result.node
  console.log(`       share issuance after escrow: OutstandingAmount=${iss31.OutstandingAmount} LockedAmount=${iss31.LockedAmount}`)
  const vault31 = (await client.request({ command: 'ledger_entry', index: vaultId, ledger_index: 'validated' })).result.node
  console.log(`       vault after escrow: AssetsTotal=${vault31.AssetsTotal} AssetsAvailable=${vault31.AssetsAvailable}`)

  // 3.2 withdraw the FULL original share balance -> must fail, shares are locked
  rec('3.2 VaultWithdraw full share balance', await trySubmit(client, A, {
    TransactionType: 'VaultWithdraw', Account: A.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SHARE, value: shareBal.toString() },
  }, 'VaultWithdraw ALL shares (some escrowed)', 'tecINSUFFICIENT_FUNDS'))

  // 3.3 withdraw only the unlocked part -> succeeds
  rec('3.3 VaultWithdraw unlocked shares', await submit(client, A, {
    TransactionType: 'VaultWithdraw', Account: A.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SHARE, value: (shareBal - BigInt(escrowAmt)).toString() },
  }, 'VaultWithdraw unlocked shares only'))

  // 3.4 escrow shares TO the vault pseudo-account (the "pledge collateral to the pool" idea)
  rec('3.4 EscrowCreate shares -> vault pseudo', await trySubmit(client, B, {
    TransactionType: 'EscrowCreate', Account: B.classicAddress, Destination: PSEUDO,
    Amount: '10000000', FinishAfter: finishAfter,
  }, 'EscrowCreate XRP -> vault pseudo-account', 'tecNO_PERMISSION'))

  // 3.5 closed-ended vault + LoanBroker, then escrow XRP to the LoanBroker pseudo-account
  const base = nowRipple()
  const cv = rec('3.5a VaultCreate closed-ended', await submit(client, A, {
    TransactionType: 'VaultCreate', Account: A.classicAddress, Asset: { currency: 'XRP' },
    WithdrawalPolicy: 1, VaultKind: 1, SubscriptionDate: base + 3600, RedemptionDate: base + 7200,
    Data: hex('closed for broker'),
  }, 'VaultCreate closed-ended XRP'))
  const cvId = createdId(cv.meta, 'Vault')
  let brokerPseudo = null
  if (cvId) {
    await submit(client, A, { TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: cvId, Amount: '50000000' }, 'VaultDeposit into closed vault')
    const b = rec('3.5b LoanBrokerSet', await submit(client, A, {
      TransactionType: 'LoanBrokerSet', Account: A.classicAddress, VaultID: cvId,
      ManagementFeeRate: 100, DebtMaximum: '25000000', CoverRateMinimum: 1000, CoverRateLiquidation: 2500,
    }, 'LoanBrokerSet on closed vault'))
    const brokerId = b.meta && createdId(b.meta, 'LoanBroker')
    if (brokerId) {
      const bn = (await client.request({ command: 'ledger_entry', index: brokerId, ledger_index: 'validated' })).result.node
      brokerPseudo = bn.Account
      console.log(`       LoanBrokerID ${brokerId}  pseudo ${brokerPseudo}`)
      rec('3.6 EscrowCreate XRP -> LoanBroker pseudo', await trySubmit(client, B, {
        TransactionType: 'EscrowCreate', Account: B.classicAddress, Destination: brokerPseudo,
        Amount: '10000000', FinishAfter: finishAfter,
      }, 'EscrowCreate XRP -> LoanBroker pseudo-account', 'tecNO_PERMISSION'))
    }
  }

  // 3.7 non-transferable shares cannot be escrowed
  const nv = rec('3.7a VaultCreate tfVaultShareNonTransferable', await submit(client, A, {
    TransactionType: 'VaultCreate', Account: A.classicAddress, Asset: { currency: 'XRP' },
    WithdrawalPolicy: 1, Flags: TF_VAULT_SHARE_NON_TRANSFERABLE, Data: hex('non-transferable'),
  }, 'VaultCreate tfVaultShareNonTransferable'))
  const nvId = createdId(nv.meta, 'Vault')
  if (nvId) {
    const nvNode = (await client.request({ command: 'ledger_entry', index: nvId, ledger_index: 'validated' })).result.node
    const nvShare = nvNode.ShareMPTID
    const nvIss = (await client.request({ command: 'ledger_entry', mpt_issuance: nvShare, ledger_index: 'validated' })).result.node
    console.log(`       non-transferable share issuance Flags=${nvIss.Flags} (lsfMPTCanEscrow=${(nvIss.Flags & LSF_MPT_CAN_ESCROW) ? 'SET' : 'CLEAR'})`)
    await submit(client, A, { TransactionType: 'VaultDeposit', Account: A.classicAddress, VaultID: nvId, Amount: '10000000' }, 'VaultDeposit into non-transferable vault')
    const nvBal = (await objs(client, A.classicAddress, 'mptoken')).find(o => o.MPTokenIssuanceID === nvShare)
    rec('3.7b EscrowCreate non-transferable shares', await trySubmit(client, A, {
      TransactionType: 'EscrowCreate', Account: A.classicAddress, Destination: B.classicAddress,
      Amount: { mpt_issuance_id: nvShare, value: String(BigInt(nvBal?.MPTAmount ?? '0') / 2n) }, FinishAfter: finishAfter,
    }, 'EscrowCreate non-transferable shares', 'tecNO_PERMISSION'))
  }

  console.log('\n===== SUMMARY =====')
  for (const r of log) console.log(`${String(r.code).padEnd(26)} ${r.step.padEnd(44)} ${r.hash ?? ''} ${r.note}`)
  console.log(`\nVAULT=${vaultId}\nSHARE=${SHARE}\nPSEUDO=${PSEUDO}\nBROKER_PSEUDO=${brokerPseudo}`)
  console.log(`A=${A.classicAddress}\nB=${B.classicAddress}\nC=${C.classicAddress}`)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
