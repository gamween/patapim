// Open-ended (Lending Protocol V1) end-to-end probe. Usage: node scripts/probe.mjs [t2|t1]
import { connect, fund, hex, sleep, createdId, submit, submitLoanSet } from './lib/lending.mjs'

const main = async () => {
  const key = process.argv[2] ?? 't2'
  const { client, net } = await connect(key)
  const broker = await fund(net, 'broker')
  const lender = await fund(net, 'lender')
  const borrower = await fund(net, 'borrower')
  await sleep(5000)

  const v = await submit(client, broker, {
    TransactionType: 'VaultCreate', Account: broker.classicAddress,
    Asset: { currency: 'XRP' }, WithdrawalPolicy: 1, Data: hex('patapim open'), VaultKind: 0,
  }, 'VaultCreate open-ended')
  const vaultId = createdId(v.meta, 'Vault')
  console.log(`       VaultID ${vaultId}`)
  if (!vaultId) { await client.disconnect(); return }

  await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId, Amount: '50000000',
  }, 'VaultDeposit lender')

  const b = await submit(client, broker, {
    TransactionType: 'LoanBrokerSet', Account: broker.classicAddress, VaultID: vaultId,
    ManagementFeeRate: 100, DebtMaximum: '40000000', CoverRateMinimum: 1000, CoverRateLiquidation: 1000,
  }, 'LoanBrokerSet')
  const brokerId = createdId(b.meta, 'LoanBroker')
  console.log(`       LoanBrokerID ${brokerId}`)
  if (!brokerId) { await client.disconnect(); return }

  await submit(client, broker, {
    TransactionType: 'LoanBrokerCoverDeposit', Account: broker.classicAddress, LoanBrokerID: brokerId, Amount: '5000000',
  }, 'LoanBrokerCoverDeposit')

  const loan = await submitLoanSet(client, broker, borrower, {
    TransactionType: 'LoanSet', Account: broker.classicAddress, Counterparty: borrower.classicAddress,
    LoanBrokerID: brokerId, PrincipalRequested: '10000000', InterestRate: 5000,
    PaymentInterval: 300, PaymentTotal: 2, GracePeriod: 60, Data: hex('patapim loan'),
  }, 'LoanSet (broker + borrower)')
  const loanId = loan.meta && createdId(loan.meta, 'Loan')
  console.log(`       LoanID ${loanId}`)
  if (loanId) {
    console.log(`       ${net.tx}${loan.hash}`)
    await submit(client, borrower, {
      TransactionType: 'LoanPay', Account: borrower.classicAddress, LoanID: loanId, Amount: '6000000',
    }, 'LoanPay')
    await submit(client, lender, {
      TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: vaultId, Amount: '1000000',
    }, 'VaultWithdraw lender')
  }
  await client.disconnect()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
