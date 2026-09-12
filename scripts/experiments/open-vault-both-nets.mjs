// Decisive: is an open-ended vault usable as a lending pool on BOTH hackathon networks?
// The brief warned that enabling Lending Protocol V1.1 would restrict new loans to closed-ended
// vaults. Both networks report LendingProtocolV1_1 enabled. Do they behave the same?
import { connect, fund, hex, sleep, createdId, submit } from '../lib/lending.mjs'

for (const key of ['t1', 't2']) {
  const { client, net } = await connect(key)
  const broker = await fund(net, 'broker')
  const lender = await fund(net, 'lender')
  await sleep(5000)
  const v = await submit(client, broker, {
    TransactionType: 'VaultCreate', Account: broker.classicAddress,
    Asset: { currency: 'XRP' }, WithdrawalPolicy: 1, Data: hex('open-ended probe'), VaultKind: 0,
  }, 'VaultCreate open-ended')
  const vaultId = createdId(v.meta, 'Vault')
  if (vaultId) {
    // what did VaultCreate actually cost?
    const tx = await client.request({ command: 'tx', transaction: v.hash })
    console.log(`       fee payé: ${tx.result.tx_json?.Fee ?? tx.result.Fee} drops`)
    await submit(client, lender, { TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId, Amount: '20000000' }, 'VaultDeposit')
    await submit(client, broker, {
      TransactionType: 'LoanBrokerSet', Account: broker.classicAddress, VaultID: vaultId,
      ManagementFeeRate: 100, DebtMaximum: '10000000', CoverRateMinimum: 1000, CoverRateLiquidation: 1000,
    }, 'LoanBrokerSet sur vault OUVERT')
  }
  await client.disconnect()
}
