// Full closed-ended (Lending Protocol V1.1) lifecycle probe on the public XRPL Devnet.
// Walks Subscription -> Investment -> Redemption in real wall-clock time and records
// exactly which transactions the ledger accepts or rejects in each phase.
import { connect, fund, hex, sleep, nowRipple, createdId, submit, submitLoanSet } from './lib/lending.mjs'

const SUB_SECONDS = 150   // subscription window length
const RED_SECONDS = 540   // redemption starts here
const log = []
const rec = (phase, action, r, expected) => log.push({ phase, action, code: r.code, expected, hash: r.hash })

const main = async () => {
  const t0 = Date.now()
  const el = () => Math.round((Date.now() - t0) / 1000)
  const { client, net } = await connect('t2')
  const broker = await fund(net, 'broker')
  const lender = await fund(net, 'lender')
  const borrower = await fund(net, 'borrower')
  await sleep(5000)

  const base = nowRipple()
  const subscriptionDate = base + SUB_SECONDS
  const redemptionDate = base + RED_SECONDS
  console.log(`  SubscriptionDate=${subscriptionDate} RedemptionDate=${redemptionDate} (ripple epoch, +${SUB_SECONDS}s / +${RED_SECONDS}s)`)

  const v = await submit(client, broker, {
    TransactionType: 'VaultCreate', Account: broker.classicAddress,
    Asset: { currency: 'XRP' }, WithdrawalPolicy: 1, Data: hex('patapim closed'),
    VaultKind: 1, SubscriptionDate: subscriptionDate, RedemptionDate: redemptionDate,
  }, 'VaultCreate closed')
  const vaultId = createdId(v.meta, 'Vault')
  console.log(`       VaultID ${vaultId}`)
  if (!vaultId) { await client.disconnect(); return }

  console.log(`\n--- PHASE 1 SUBSCRIPTION (t+${el()}s) ---`)
  rec('subscription', 'VaultDeposit', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId, Amount: '40000000',
  }, 'VaultDeposit lender', 'tesSUCCESS'), 'accepted')

  const b = await submit(client, broker, {
    TransactionType: 'LoanBrokerSet', Account: broker.classicAddress, VaultID: vaultId,
    ManagementFeeRate: 100, DebtMaximum: '30000000', CoverRateMinimum: 1000, CoverRateLiquidation: 1000,
  }, 'LoanBrokerSet')
  const brokerId = createdId(b.meta, 'LoanBroker')
  console.log(`       LoanBrokerID ${brokerId}`)
  await submit(client, broker, {
    TransactionType: 'LoanBrokerCoverDeposit', Account: broker.classicAddress, LoanBrokerID: brokerId, Amount: '4000000',
  }, 'LoanBrokerCoverDeposit')

  const loanTx = (total, interval) => ({
    TransactionType: 'LoanSet', Account: broker.classicAddress, Counterparty: borrower.classicAddress,
    LoanBrokerID: brokerId, PrincipalRequested: '10000000', InterestRate: 5000,
    PaymentInterval: interval, PaymentTotal: total, GracePeriod: 60, Data: hex('patapim loan'),
  })
  rec('subscription', 'LoanSet', await submitLoanSet(client, broker, borrower, loanTx(2, 60), 'LoanSet during Subscription', 'REJECT'), 'rejected: lending blocked')

  const waitUntil = async (sec, label) => {
    const target = t0 + sec * 1000
    while (Date.now() < target) { await sleep(5000) }
    console.log(`\n--- ${label} (t+${el()}s) ---`)
  }

  await waitUntil(SUB_SECONDS + 20, 'PHASE 2 INVESTMENT')
  rec('investment', 'VaultDeposit', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId, Amount: '5000000',
  }, 'VaultDeposit during Investment', 'REJECT'), 'rejected: deposits blocked')
  rec('investment', 'VaultWithdraw', await submit(client, lender, {
    TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: vaultId, Amount: '1000000',
  }, 'VaultWithdraw during Investment', 'REJECT'), 'rejected: withdrawals blocked')

  // Deliberately overlong loan: final payment would land after RedemptionDate.
  rec('investment', 'LoanSet too long', await submitLoanSet(client, broker, borrower, loanTx(20, 3600), 'LoanSet past RedemptionDate', 'REJECT'), 'rejected: final payment after redemption')

  const loan = await submitLoanSet(client, broker, borrower, loanTx(2, 60), 'LoanSet within window', 'tesSUCCESS')
  rec('investment', 'LoanSet ok', loan, 'accepted')
  const loanId = loan.meta && createdId(loan.meta, 'Loan')
  console.log(`       LoanID ${loanId}`)

  if (loanId) {
    await sleep(20000)
    rec('investment', 'LoanPay partial', await submit(client, borrower, {
      TransactionType: 'LoanPay', Account: borrower.classicAddress, LoanID: loanId, Amount: '3000000',
    }, 'LoanPay partial'), 'accepted')
    await sleep(10000)
    rec('investment', 'LoanPay full', await submit(client, borrower, {
      TransactionType: 'LoanPay', Account: borrower.classicAddress, LoanID: loanId, Amount: '9000000', Flags: 131072,
    }, 'LoanPay full (tfLoanFullPayment)'), 'accepted')
  }

  await waitUntil(RED_SECONDS + 20, 'PHASE 3 REDEMPTION')
  rec('redemption', 'LoanSet', await submitLoanSet(client, broker, borrower, loanTx(2, 60), 'LoanSet during Redemption', 'REJECT'), 'rejected: new loans blocked')
  rec('redemption', 'VaultWithdraw', await submit(client, lender, {
    TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: vaultId, Amount: '40000000',
  }, 'VaultWithdraw during Redemption'), 'accepted')

  const entry = await client.request({ command: 'ledger_entry', index: vaultId, ledger_index: 'validated' }).catch((e) => ({ error: e.message }))
  console.log('\n--- VAULT FINAL STATE ---')
  console.log(JSON.stringify(entry.result?.node ?? entry, null, 2))
  console.log('\n--- PHASE / ACTION MATRIX ---')
  for (const r of log) console.log(`  ${r.phase.padEnd(13)} ${r.action.padEnd(18)} -> ${String(r.code).padEnd(24)} (expected ${r.expected})`)
  await client.disconnect()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
