// Part 3: LoanBrokerCoverWithdraw.CredentialIDs, the one branch runs 1 and 2 did not reach.
// Run: node scripts/experiments/credentials-domains-vault-3.mjs
import { Client } from 'xrpl'
import { NETS, fund, createdId, sleep, hex } from '../lib/lending.mjs'
const NET = NETS.t1, KYC = hex('recall.eligible.v1'), log = []
async function go(client, w, tx, label, expect = 'tesSUCCESS') {
  try {
    const r = await client.submitAndWait(w.sign(await client.autofill(tx)).tx_blob)
    const code = r.result.meta.TransactionResult
    console.log(`  ${code === expect ? 'OK  ' : 'DIFF'} ${label.padEnd(50)} ${code.padEnd(22)} ${r.result.hash}`)
    log.push({ label, code, hash: r.result.hash, expect }); return { code, meta: r.result.meta, hash: r.result.hash }
  } catch (e) { console.log(`  THROW ${label.padEnd(49)} ${String(e.message).slice(0,130)}`); log.push({label,code:'THROWN',expect}); return {} }
}
const main = async () => {
  const client = new Client(NET.wss); await client.connect()
  const i = await client.request({ command: 'server_info' })
  console.log(`\n=== Track 1  rippled ${i.result.info.build_version}  network_id ${i.result.info.network_id}`)
  const agent = await fund(NET, 'agent'); await sleep(1500)      // cred issuer + domain owner + vault owner + broker owner
  const dest  = await fund(NET, 'dest');  await sleep(1500)      // domain member, DepositAuth on

  const cd = await go(client, agent, { TransactionType:'CredentialCreate', Account: agent.classicAddress, Subject: dest.classicAddress, CredentialType: KYC }, 'CredentialCreate agent->dest')
  const destCred = createdId(cd.meta, 'Credential')
  await go(client, dest, { TransactionType:'CredentialAccept', Account: dest.classicAddress, Issuer: agent.classicAddress, CredentialType: KYC }, 'CredentialAccept dest')
  const cs = await go(client, agent, { TransactionType:'CredentialCreate', Account: agent.classicAddress, Subject: agent.classicAddress, CredentialType: KYC }, 'CredentialCreate agent->agent (self)')
  const selfCred = createdId(cs.meta, 'Credential')
  const pd = await go(client, agent, { TransactionType:'PermissionedDomainSet', Account: agent.classicAddress, AcceptedCredentials:[{Credential:{Issuer:agent.classicAddress,CredentialType:KYC}}] }, 'PermissionedDomainSet')
  const domainID = createdId(pd.meta, 'PermissionedDomain')
  const vc = await go(client, agent, { TransactionType:'VaultCreate', Account: agent.classicAddress, Asset:{currency:'XRP'}, DomainID: domainID, Flags: 0x00010000, WithdrawalPolicy: 1 }, 'VaultCreate private + DomainID')
  const vaultID = createdId(vc.meta, 'Vault')
  await go(client, agent, { TransactionType:'VaultDeposit', Account: agent.classicAddress, VaultID: vaultID, Amount:'200000000' }, 'VaultDeposit (owner)')
  const lb = await go(client, agent, { TransactionType:'LoanBrokerSet', Account: agent.classicAddress, VaultID: vaultID, ManagementFeeRate:1000, DebtMaximum:'100000000', CoverRateMinimum:1000, CoverRateLiquidation:1000 }, 'LoanBrokerSet')
  const brokerID = createdId(lb.meta, 'LoanBroker')
  await go(client, agent, { TransactionType:'LoanBrokerCoverDeposit', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount:'50000000' }, 'LoanBrokerCoverDeposit')

  console.log('\n-- LoanBrokerCoverWithdraw destination gating')
  await go(client, agent, { TransactionType:'LoanBrokerCoverWithdraw', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount:'1000000', Destination: dest.classicAddress }, 'coverWithdraw -> dest, no DepositAuth yet')
  await go(client, dest, { TransactionType:'AccountSet', Account: dest.classicAddress, SetFlag: 9 }, 'dest sets asfDepositAuth')
  await go(client, agent, { TransactionType:'LoanBrokerCoverWithdraw', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount:'1000000', Destination: dest.classicAddress }, 'coverWithdraw -> DepositAuth dest, no CredentialIDs', 'tecNO_PERMISSION')
  await go(client, agent, { TransactionType:'LoanBrokerCoverWithdraw', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount:'1000000', Destination: dest.classicAddress, CredentialIDs:[destCred] }, 'coverWithdraw + a credential agent is NOT the subject of', 'tecBAD_CREDENTIALS')
  await go(client, agent, { TransactionType:'LoanBrokerCoverWithdraw', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount:'1000000', Destination: dest.classicAddress, CredentialIDs:[selfCred] }, 'coverWithdraw + own self-issued cred, no preauth', 'tecNO_PERMISSION')
  await go(client, dest, { TransactionType:'DepositPreauth', Account: dest.classicAddress, AuthorizeCredentials:[{Credential:{Issuer:agent.classicAddress,CredentialType:KYC}}] }, 'dest DepositPreauth(AuthorizeCredentials)')
  await go(client, agent, { TransactionType:'LoanBrokerCoverWithdraw', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount:'1000000', Destination: dest.classicAddress, CredentialIDs:[selfCred] }, 'coverWithdraw + own cred + preauth -> ALLOWED')

  console.log('\n-- SUMMARY')
  for (const r of log) console.log(`  ${String(r.code).padEnd(22)} ${r.label.padEnd(52)} ${r.hash ?? ''}${r.expect && r.code!==r.expect ? '  <== DIFF, expected '+r.expect : ''}`)
  console.log('\nIDs\n' + JSON.stringify({ agent: agent.classicAddress, dest: dest.classicAddress, destCred, selfCred, domainID, vaultID, brokerID }, null, 2))
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
