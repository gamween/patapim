// Experiment 2 (slug mpt-vault-asset): is the WHOLE lending spine denominated in a
// tokenised-security MPT? Closed-ended vault whose Asset is an MPT, LoanBroker on it,
// first-loss cover paid in the security, LoanSet / LoanPay in security units.
// Target: TRACK 2 public XRPL devnet (LendingProtocolV1_1).
import { connect, fund, submit, submitLoanSet, createdId, hex, sleep, nowRipple } from '../lib/lending.mjs'

const SUB = 150   // subscription window (s)
const RED = 900   // redemption start (s)
const F = { tfMPTCanLock: 0x2, tfMPTRequireAuth: 0x4, tfMPTCanEscrow: 0x8, tfMPTCanTrade: 0x10, tfMPTCanTransfer: 0x20, tfMPTCanClawback: 0x40 }
const log = []
const rec = (step, r, note = '') => { log.push({ step, code: r.code, hash: r.hash ?? null, note }); return r }

const main = async () => {
  const t0 = Date.now(); const el = () => Math.round((Date.now() - t0) / 1000)
  const { client, net } = await connect('t2')
  const issuer = await fund(net, 'issuer')
  const agent = await fund(net, 'agent')      // lending agent = vault owner + LoanBroker owner
  const lender = await fund(net, 'lender')    // security holder depositing into the vault
  const mm = await fund(net, 'marketmkr')     // borrower
  await sleep(4000)

  // --- the tokenised security
  const iss = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 2, MaximumAmount: '1000000000',
    Flags: F.tfMPTCanTransfer | F.tfMPTCanTrade | F.tfMPTCanEscrow | F.tfMPTCanClawback | F.tfMPTCanLock,
  }, 'MPTokenIssuanceCreate TBILL')
  const SEC = iss.meta?.mpt_issuance_id
  rec('1 MPTokenIssuanceCreate (security)', iss, `mpt_issuance_id=${SEC}`)
  console.log(`       SEC = ${SEC}`)

  for (const [w, n] of [[lender, 'lender'], [mm, 'marketmkr'], [agent, 'agent']]) {
    await submit(client, w, { TransactionType: 'MPTokenAuthorize', Account: w.classicAddress, MPTokenIssuanceID: SEC }, `MPTokenAuthorize ${n}`)
    await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: w.classicAddress, Amount: { mpt_issuance_id: SEC, value: '5000000' } }, `Payment SEC -> ${n}`)
  }

  // --- closed-ended vault denominated in the security
  const base = nowRipple()
  const subscriptionDate = base + SUB, redemptionDate = base + RED
  const v = rec('2 VaultCreate closed-ended, Asset=MPT', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: SEC }, WithdrawalPolicy: 1, Data: hex('recall securities vault'),
    VaultKind: 1, SubscriptionDate: subscriptionDate, RedemptionDate: redemptionDate,
  }, 'VaultCreate (closed, MPT asset)'))
  const vaultId = createdId(v.meta, 'Vault')
  console.log(`       VaultID ${vaultId}`)
  if (!vaultId) { await client.disconnect(); return }

  console.log(`\n--- SUBSCRIPTION (t+${el()}s) ---`)
  rec('3 VaultDeposit security into vault', await submit(client, lender, {
    TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultId,
    Amount: { mpt_issuance_id: SEC, value: '2000000' },
  }, 'VaultDeposit (security)'))

  // --- lending agent = LoanBroker on a security-denominated vault
  const b = rec('4 LoanBrokerSet on MPT vault', await submit(client, agent, {
    TransactionType: 'LoanBrokerSet', Account: agent.classicAddress, VaultID: vaultId,
    ManagementFeeRate: 100, DebtMaximum: '1500000', CoverRateMinimum: 1000, CoverRateLiquidation: 1000,
    Data: hex('recall lending agent'),
  }, 'LoanBrokerSet (MPT vault)'))
  const brokerId = createdId(b.meta, 'LoanBroker')
  console.log(`       LoanBrokerID ${brokerId}`)

  // fractional DebtMaximum against an integral MPT -> tecPRECISION_LOSS?
  rec('4b LoanBrokerSet fractional DebtMaximum', await submit(client, agent, {
    TransactionType: 'LoanBrokerSet', Account: agent.classicAddress, LoanBrokerID: brokerId, DebtMaximum: '1500000.5',
  }, 'LoanBrokerSet DebtMaximum=1500000.5', 'tecPRECISION_LOSS'))

  if (brokerId) {
    rec('5 LoanBrokerCoverDeposit in SECURITY', await submit(client, agent, {
      TransactionType: 'LoanBrokerCoverDeposit', Account: agent.classicAddress, LoanBrokerID: brokerId,
      Amount: { mpt_issuance_id: SEC, value: '300000' },
    }, 'LoanBrokerCoverDeposit (security)'))
    const bo = await client.request({ command: 'ledger_entry', index: brokerId, ledger_index: 'validated' }).catch(e => ({ error: e.message }))
    console.log('       LoanBroker: ' + JSON.stringify(bo.result?.node ?? bo))
  }

  // --- wait for Investment phase, then originate the securities loan
  const waitUntil = async (sec, label) => { while (Date.now() < t0 + sec * 1000) await sleep(5000); console.log(`\n--- ${label} (t+${el()}s) ---`) }
  await waitUntil(SUB + 25, 'INVESTMENT')

  const loanTx = (principal) => ({
    TransactionType: 'LoanSet', Account: agent.classicAddress, Counterparty: mm.classicAddress,
    LoanBrokerID: brokerId, PrincipalRequested: principal, InterestRate: 5000,
    PaymentInterval: 60, PaymentTotal: 2, GracePeriod: 60, Data: hex('securities loan'),
  })
  rec('6b LoanSet fractional principal', await submitLoanSet(client, agent, mm, loanTx('500000.5'), 'LoanSet Principal=500000.5', 'tecPRECISION_LOSS'))

  const loan = rec('6 LoanSet in security units', await submitLoanSet(client, agent, mm, loanTx('500000'), 'LoanSet (security principal)'))
  const loanId = loan.meta && createdId(loan.meta, 'Loan')
  console.log(`       LoanID ${loanId}`)
  if (loanId) {
    const lo = await client.request({ command: 'ledger_entry', index: loanId, ledger_index: 'validated' }).catch(e => ({ error: e.message }))
    console.log('       Loan: ' + JSON.stringify(lo.result?.node ?? lo))
    // did the market maker actually receive the SECURITY?
    const mo = await client.request({ command: 'account_objects', account: mm.classicAddress, type: 'mptoken', ledger_index: 'validated' })
    console.log('       marketmaker MPTokens: ' + JSON.stringify(mo.result.account_objects.map(o => ({ id: o.MPTokenIssuanceID, amt: o.MPTAmount }))))

    await sleep(15000)
    rec('7 LoanPay in security units', await submit(client, mm, {
      TransactionType: 'LoanPay', Account: mm.classicAddress, LoanID: loanId,
      Amount: { mpt_issuance_id: SEC, value: '300000' },
    }, 'LoanPay (security)'))
  }

  console.log('\n===== SUMMARY =====')
  for (const r of log) console.log(`${String(r.code).padEnd(20)} ${r.step.padEnd(40)} ${r.hash ?? ''} ${r.note}`)
  console.log(`\nSEC=${SEC}\nVAULT=${vaultId}\nBROKER=${brokerId}`)
  await client.disconnect()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
