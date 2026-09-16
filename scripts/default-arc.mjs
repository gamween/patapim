// The default arc: what patapim exists for.
// A loan of securities goes unpaid past its grace period, the lending agent impairs it, then
// declares default, and the first-loss cover repays the vault so the lenders' position holds.
// Closed-ended vault, MPT asset, public XRPL Devnet.
import fs from 'node:fs'
import { connect, fund, hex, sleep, createdId, submit, submitLoanSet, ledgerNow, MPT, LoanManageFlags } from './lib/lending.mjs'

const SUB_IN = 45, INVEST_LEN = 600
// Agency securities lending is indemnified: the agent covers the whole loan, not a slice of it.
// CoverRateMinimum is in parts per 100000, so 100000 is 100%.
const COVER_RATE = Number(process.argv[2] ?? 100000)
const COVER_AMOUNT = process.argv[3] ?? '2500000'
const ev = []
const rec = (step, r, note) => { ev.push({ step, code: r?.code, hash: r?.hash, note }); return r }

const waitLedger = async (c, target, label) => {
  let t = await ledgerNow(c)
  while (t < target) { await sleep(4000); t = await ledgerNow(c) }
  console.log(`\n--- ${label} (ledger ${t}) ---`)
}

const main = async () => {
  const { client, net } = await connect('t2')
  const issuer = await fund(net, 'issuer')
  const agent = await fund(net, 'agent')
  const lender = await fund(net, 'lender')
  const mm = await fund(net, 'marketmkr')
  await sleep(5000)

  console.log('\n--- security and eligibility ---')
  const iss = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 0, MaximumAmount: '1000000000',
    Flags: MPT.CanTransfer | MPT.CanTrade | MPT.CanEscrow | MPT.CanClawback | MPT.CanLock | MPT.RequireAuth,
    MPTokenMetadata: hex(JSON.stringify({
      ticker: 'TBL', name: 'patapim demo T-Bill', desc: 'Demo tokenised treasury bill',
      icon: 'https://raw.githubusercontent.com/gamween/patapim/main/web/app/icon.svg', asset_class: 'rwa', asset_subclass: 'treasury',
      issuer_name: 'patapim demo transfer agent',
    })),
  }, 'MPTokenIssuanceCreate')
  const SEC = iss.meta?.mpt_issuance_id
  console.log(`       SEC ${SEC}`)
  for (const [w, n] of [[lender, 'lender'], [mm, 'marketmkr'], [agent, 'agent']]) {
    await submit(client, w, { TransactionType: 'MPTokenAuthorize', Account: w.classicAddress, MPTokenIssuanceID: SEC }, `${n} opts in`)
    await submit(client, issuer, { TransactionType: 'MPTokenAuthorize', Account: issuer.classicAddress, MPTokenIssuanceID: SEC, Holder: w.classicAddress }, `issuer authorises ${n}`)
    await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: w.classicAddress, Amount: { mpt_issuance_id: SEC, value: '10000000' } }, `issue TBL to ${n}`)
  }
  const KYC = hex('patapim.eligible.v1')
  await submit(client, agent, { TransactionType: 'CredentialCreate', Account: agent.classicAddress, Subject: lender.classicAddress, CredentialType: KYC }, 'CredentialCreate')
  await submit(client, lender, { TransactionType: 'CredentialAccept', Account: lender.classicAddress, Issuer: agent.classicAddress, CredentialType: KYC }, 'CredentialAccept')
  const pd = await submit(client, agent, { TransactionType: 'PermissionedDomainSet', Account: agent.classicAddress, AcceptedCredentials: [{ Credential: { Issuer: agent.classicAddress, CredentialType: KYC } }] }, 'PermissionedDomainSet')
  const domainID = createdId(pd.meta, 'PermissionedDomain')

  const base = await ledgerNow(client)
  const subscriptionDate = base + SUB_IN
  const redemptionDate = subscriptionDate + INVEST_LEN
  const vc = rec('VaultCreate', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: SEC }, WithdrawalPolicy: 1, DomainID: domainID, Flags: 0x00010000,
    VaultKind: 1, SubscriptionDate: subscriptionDate, RedemptionDate: redemptionDate,
    Data: hex('patapim default arc'),
  }, 'VaultCreate closed + MPT + domain'))
  const vaultID = createdId(vc.meta, 'Vault')
  console.log(`       VaultID ${vaultID}`)

  rec('VaultDeposit', await submit(client, lender, { TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultID, Amount: { mpt_issuance_id: SEC, value: '5000000' } }, 'lender subscribes 5,000,000 TBL'))
  const lb = rec('LoanBrokerSet', await submit(client, agent, {
    TransactionType: 'LoanBrokerSet', Account: agent.classicAddress, VaultID: vaultID,
    ManagementFeeRate: 1000, DebtMaximum: '4000000', CoverRateMinimum: COVER_RATE, CoverRateLiquidation: 100000,
  }, 'LoanBrokerSet'))
  const brokerID = createdId(lb.meta, 'LoanBroker')
  rec('CoverDeposit', await submit(client, agent, { TransactionType: 'LoanBrokerCoverDeposit', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount: { mpt_issuance_id: SEC, value: COVER_AMOUNT } }, `agent posts ${COVER_AMOUNT} TBL of first-loss cover`))

  const snapshot = async (label) => {
    const v = (await client.request({ command: 'ledger_entry', index: vaultID, ledger_index: 'validated' })).result.node
    const b = (await client.request({ command: 'ledger_entry', index: brokerID, ledger_index: 'validated' })).result.node
    const s = (await client.request({ command: 'ledger_entry', mpt_issuance: v.ShareMPTID, ledger_index: 'validated' })).result.node
    const assets = Number(v.AssetsTotal ?? 0), loss = Number(v.LossUnrealized ?? 0), shares = Number(s.OutstandingAmount ?? 0)
    const row = {
      label,
      AssetsTotal: v.AssetsTotal ?? '0', AssetsAvailable: v.AssetsAvailable ?? '0',
      LossUnrealized: v.LossUnrealized ?? '0', shares: String(shares),
      // NAV per share, net of the unrealised loss: what the ledger redeems a share against.
      pricePerShare: shares ? ((assets - loss) / shares).toFixed(8) : 'n/a',
      CoverAvailable: b.CoverAvailable ?? '0', DebtTotal: b.DebtTotal ?? '0',
    }
    console.log(`   [${label}] assets=${row.AssetsTotal} available=${row.AssetsAvailable} loss=${row.LossUnrealized} pps=${row.pricePerShare} cover=${row.CoverAvailable} debt=${row.DebtTotal}`)
    return row
  }
  const states = []
  states.push(await snapshot('after funding'))

  await waitLedger(client, subscriptionDate + 8, 'INVESTMENT: the loan')
  const loan = rec('LoanSet', await submitLoanSet(client, agent, mm, {
    TransactionType: 'LoanSet', Account: agent.classicAddress, Counterparty: mm.classicAddress,
    LoanBrokerID: brokerID, PrincipalRequested: '2000000', InterestRate: 5000,
    PaymentInterval: 60, PaymentTotal: 2, GracePeriod: 60, Data: hex('patapim loan that defaults'),
  }, 'LoanSet 2,000,000 TBL'))
  const loanID = loan.meta && createdId(loan.meta, 'Loan')
  console.log(`       LoanID ${loanID}`)
  if (!loanID) { await client.disconnect(); return }
  states.push(await snapshot('loan drawn'))

  const l0 = (await client.request({ command: 'ledger_entry', index: loanID, ledger_index: 'validated' })).result.node
  console.log(`       NextPaymentDueDate ${l0.NextPaymentDueDate}  GracePeriod ${l0.GracePeriod}  PeriodicPayment ${l0.PeriodicPayment}`)

  console.log('\n--- the borrower does not pay ---')
  await waitLedger(client, Number(l0.NextPaymentDueDate) + 5, 'payment due, nothing arrives')
  // Impairment unlocks at the due date and ignores GracePeriod (LoanManage.cpp, isPaymentLate): this succeeds.
  rec('LoanManage impair (due, grace still running)', await submit(client, agent, { TransactionType: 'LoanManage', Account: agent.classicAddress, LoanID: loanID, Flags: LoanManageFlags.tfLoanImpair }, 'impair once the payment is due', 'tesSUCCESS'))

  await waitLedger(client, Number(l0.NextPaymentDueDate) + Number(l0.GracePeriod) + 8, 'grace period over')
  // Already impaired: the ledger refuses a second impairment.
  rec('LoanManage impair (already impaired)', await submit(client, agent, { TransactionType: 'LoanManage', Account: agent.classicAddress, LoanID: loanID, Flags: LoanManageFlags.tfLoanImpair }, 'impair an impaired loan', 'tecNO_PERMISSION'))
  states.push(await snapshot('impaired'))

  rec('LoanManage default', await submit(client, agent, { TransactionType: 'LoanManage', Account: agent.classicAddress, LoanID: loanID, Flags: LoanManageFlags.tfLoanDefault }, 'agent declares default'))
  states.push(await snapshot('defaulted, cover absorbs'))

  const lf = await client.request({ command: 'ledger_entry', index: loanID, ledger_index: 'validated' }).catch(() => null)
  console.log('\n--- LOAN AFTER DEFAULT ---')
  console.log(lf?.result?.node ? JSON.stringify(lf.result.node, null, 2) : 'loan entry deleted')

  console.log('\n--- STATE ACROSS THE ARC ---')
  for (const s of states) console.log(`  ${s.label.padEnd(26)} assets=${String(s.AssetsTotal).padEnd(9)} loss=${String(s.LossUnrealized).padEnd(9)} pps=${String(s.pricePerShare).padEnd(12)} cover=${String(s.CoverAvailable).padEnd(9)} debt=${s.DebtTotal}`)
  console.log('\n--- EVIDENCE ---')
  for (const e of ev) console.log(`  ${String(e.code).padEnd(22)} ${e.step.padEnd(30)} ${e.hash ?? ''}`)
  fs.mkdirSync('docs/evidence', { recursive: true })
  fs.writeFileSync(`docs/evidence/default-arc-cover${COVER_RATE}.json`, JSON.stringify({ network: 't2-public-devnet', SEC, domainID, vaultID, brokerID, loanID, subscriptionDate, redemptionDate, states, events: ev }, null, 2))
  console.log(`\nwritten: docs/evidence/default-arc-cover${COVER_RATE}.json`)
  await client.disconnect()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
