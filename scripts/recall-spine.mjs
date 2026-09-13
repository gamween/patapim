// patapim, full spine on the PUBLIC XRPL devnet (Track 2, rippled 3.4.0-rc5).
// Everything below was proven on the Track 1 network by the research agents; rc5 enforces
// Lending Protocol V1.1 strictly, so it all has to be re-proven here before we build on it.
//
// Flow: tokenised security (MPT, require-auth) -> eligibility (Credential + PermissionedDomain)
//    -> closed-ended vault whose ASSET IS THE SECURITY -> lender subscribes -> lending agent
//    -> first-loss cover in securities -> loan of securities to a market maker, two signatures
//    -> XRP collateral escrowed to the agent -> repayment -> redemption.
import fs from 'node:fs'
import { connect, fund, hex, sleep, nowRipple, createdId, submit, submitLoanSet } from './lib/lending.mjs'

const MPT = { CanLock: 0x2, RequireAuth: 0x4, CanEscrow: 0x8, CanTrade: 0x10, CanTransfer: 0x20, CanClawback: 0x40 }

// Vault phases are compared against the PARENT LEDGER CLOSE TIME, not the wall clock of the
// machine submitting. Deriving the dates from Date.now() and then waiting on Date.now() is how
// you end up submitting into the phase you thought you had left. Read the ledger, always.
const ledgerNow = async (client) =>
  (await client.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger.close_time
const waitLedger = async (client, target, label) => {
  let t = await ledgerNow(client)
  while (t < target) { await sleep(4000); t = await ledgerNow(client) }
  console.log(`\n--- ${label} (ledger ${t}, target was ${target}) ---`)
}
const KYC = hex('patapim.eligible.v1')
const SUB_IN = 60, INVEST_LEN = 300
const ev = []
const rec = (step, r, note) => { ev.push({ step, code: r?.code, hash: r?.hash, note }); return r }

const main = async () => {
  const t0 = Date.now()
  const el = () => Math.round((Date.now() - t0) / 1000)
  const { client, net } = await connect('t2')

  const issuer = await fund(net, 'issuer')    // transfer agent, issues the tokenised security
  const agent = await fund(net, 'agent')      // lending agent: vault owner + loan broker + credential issuer
  const lender = await fund(net, 'lender')    // eligible securities holder
  const mm = await fund(net, 'marketmkr')     // borrower
  await sleep(5000)

  console.log('\n--- 1. TOKENISED SECURITY (MPT, require-auth) ---')
  const iss = rec('MPTokenIssuanceCreate', await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 0, MaximumAmount: '1000000000',
    Flags: MPT.CanTransfer | MPT.CanTrade | MPT.CanEscrow | MPT.CanClawback | MPT.CanLock | MPT.RequireAuth,
    MPTokenMetadata: hex(JSON.stringify({
      ticker: 'TBL', name: 'patapim demo T-Bill', desc: 'Demo tokenised treasury bill for the XRPL lending hackathon',
      icon: 'https://raw.githubusercontent.com/gamween/patapim/main/web/app/icon.svg', asset_class: 'rwa', asset_subclass: 'treasury',
      issuer_name: 'patapim demo transfer agent',
    })),
  }, 'MPTokenIssuanceCreate TBL'))
  const SEC = iss.meta?.mpt_issuance_id
  console.log(`       SEC = ${SEC}`)
  if (!SEC) { await client.disconnect(); return }

  for (const [w, n] of [[lender, 'lender'], [mm, 'marketmkr'], [agent, 'agent']]) {
    await submit(client, w, { TransactionType: 'MPTokenAuthorize', Account: w.classicAddress, MPTokenIssuanceID: SEC }, `${n} opts in`)
    await submit(client, issuer, { TransactionType: 'MPTokenAuthorize', Account: issuer.classicAddress, MPTokenIssuanceID: SEC, Holder: w.classicAddress }, `issuer authorises ${n}`)
    await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: w.classicAddress, Amount: { mpt_issuance_id: SEC, value: '10000000' }, }, `issue TBL -> ${n}`)
  }

  console.log('\n--- 2. ELIGIBILITY (Credential + PermissionedDomain) ---')
  await submit(client, agent, { TransactionType: 'CredentialCreate', Account: agent.classicAddress, Subject: lender.classicAddress, CredentialType: KYC }, 'CredentialCreate -> lender')
  await submit(client, lender, { TransactionType: 'CredentialAccept', Account: lender.classicAddress, Issuer: agent.classicAddress, CredentialType: KYC }, 'CredentialAccept lender')
  const pd = rec('PermissionedDomainSet', await submit(client, agent, {
    TransactionType: 'PermissionedDomainSet', Account: agent.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: agent.classicAddress, CredentialType: KYC } }],
  }, 'PermissionedDomainSet'))
  const domainID = createdId(pd.meta, 'PermissionedDomain')
  console.log(`       DomainID = ${domainID}`)

  console.log('\n--- 3. CLOSED-ENDED VAULT, ASSET = THE SECURITY ---')
  const base = await ledgerNow(client)
  const subscriptionDate = base + SUB_IN
  const redemptionDate = subscriptionDate + INVEST_LEN
  const vc = rec('VaultCreate', await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: SEC }, WithdrawalPolicy: 1, DomainID: domainID, Flags: 0x00010000,
    VaultKind: 1, SubscriptionDate: subscriptionDate, RedemptionDate: redemptionDate,
    // The brief asks for the real-world duration to be modelled in the UI or the narrative. It is
    // modelled on chain instead, so the dashboard reads it from the vault rather than inventing it.
    Data: hex(JSON.stringify({ n: 'patapim', term_days: 90, note: 'demo compresses a 90 day term' })),
  }, 'VaultCreate closed + MPT + domain'))
  const vaultID = createdId(vc.meta, 'Vault')
  console.log(`       VaultID = ${vaultID}   Subscription closes t+${SUB_IN}s, Redemption opens t+${SUB_IN + INVEST_LEN}s`)
  if (!vaultID) { await client.disconnect(); return }

  console.log('\n--- 4. SUBSCRIPTION: eligible lender in, everyone else out ---')
  rec('VaultDeposit lender', await submit(client, lender, { TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultID, Amount: { mpt_issuance_id: SEC, value: '5000000' } }, 'VaultDeposit eligible lender'))
  rec('VaultDeposit mm (gated)', await submit(client, mm, { TransactionType: 'VaultDeposit', Account: mm.classicAddress, VaultID: vaultID, Amount: { mpt_issuance_id: SEC, value: '1000' } }, 'VaultDeposit NON-eligible', 'tecNO_AUTH'), 'domain gates lenders')

  const lb = rec('LoanBrokerSet', await submit(client, agent, {
    TransactionType: 'LoanBrokerSet', Account: agent.classicAddress, VaultID: vaultID,
    ManagementFeeRate: 1000, DebtMaximum: '4000000', CoverRateMinimum: 10000, CoverRateLiquidation: 100000,
  }, 'LoanBrokerSet'))
  const brokerID = createdId(lb.meta, 'LoanBroker')
  console.log(`       LoanBrokerID = ${brokerID}`)
  rec('CoverDeposit', await submit(client, agent, { TransactionType: 'LoanBrokerCoverDeposit', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount: { mpt_issuance_id: SEC, value: '500000' } }, 'cover in securities'))

  await waitLedger(client, subscriptionDate + 8, '5. INVESTMENT: the loan of securities')

  rec('VaultDeposit after close', await submit(client, lender, { TransactionType: 'VaultDeposit', Account: lender.classicAddress, VaultID: vaultID, Amount: { mpt_issuance_id: SEC, value: '1000' } }, 'VaultDeposit after subscription closed', 'tecEXPIRED'))
  // The minimum bar asks for three rejections at the wrong phase. This is the third, and it belongs
  // on the product's own vault rather than on a side probe.
  const shareIdEarly = (await client.request({ command: 'ledger_entry', index: vaultID, ledger_index: 'validated' })).result.node.ShareMPTID
  rec('VaultWithdraw during Investment', await submit(client, lender, { TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: vaultID, Amount: { mpt_issuance_id: shareIdEarly, value: '1000' } }, 'VaultWithdraw before Redemption opens', 'tecTOO_SOON'))
  const loan = rec('LoanSet', await submitLoanSet(client, agent, mm, {
    TransactionType: 'LoanSet', Account: agent.classicAddress, Counterparty: mm.classicAddress,
    LoanBrokerID: brokerID, PrincipalRequested: '2000000',
    // The lending fee is the whole point for the lender. An interest rate over a two minute loan
    // rounds to nothing, so the fee is where the yield shows up, exactly as a securities lending
    // fee works: the borrower pays for the loan of the security.
    LoanOriginationFee: '100000', InterestRate: 5000,
    PaymentInterval: 60, PaymentTotal: 2, GracePeriod: 60, Data: hex('patapim demo loan'),
  }, 'LoanSet securities + 100,000 TBL lending fee, 2 signatures'))
  const loanID = loan.meta && createdId(loan.meta, 'Loan')
  console.log(`       LoanID = ${loanID}`)

  console.log('\n--- 6. COLLATERAL: market maker escrows XRP to the agent ---')
  // Tri-party collateral, crudely but honestly: FinishAfter is when the agent may seize it, and
  // CancelAfter is when the borrower may reclaim it if the agent has not. Without CancelAfter the
  // collateral could never come back, which is not what the product claims.
  rec('EscrowCreate collateral', await submit(client, mm, {
    TransactionType: 'EscrowCreate', Account: mm.classicAddress, Destination: agent.classicAddress,
    Amount: '20000000', FinishAfter: base + 120, CancelAfter: base + 240,
  }, 'EscrowCreate XRP collateral, reclaimable'))
  const escrowSeq = (await client.request({ command: 'tx', transaction: ev[ev.length - 1].hash }))
    .result.tx_json.Sequence

  if (loanID) {
    await sleep(20000)
    const l = await client.request({ command: 'ledger_entry', index: loanID, ledger_index: 'validated' }).catch(() => null)
    const due = l?.result?.node
    console.log(`       PeriodicPayment=${due?.PeriodicPayment} TotalValueOutstanding=${due?.TotalValueOutstanding}`)
    const pay = String(Math.ceil(Number(due?.TotalValueOutstanding ?? 2100000)))
    rec('LoanPay full', await submit(client, mm, { TransactionType: 'LoanPay', Account: mm.classicAddress, LoanID: loanID, Amount: { mpt_issuance_id: SEC, value: pay }, Flags: 131072 }, 'LoanPay full (tfLoanFullPayment)'))
  }

  await waitLedger(client, redemptionDate + 8, '7. REDEMPTION: the lender exits')
  // The securities came back, so the collateral goes back to the borrower.
  rec('EscrowCancel collateral', await submit(client, mm, {
    TransactionType: 'EscrowCancel', Account: mm.classicAddress,
    Owner: mm.classicAddress, OfferSequence: escrowSeq,
  }, 'EscrowCancel, collateral returns to the borrower'))

  rec('LoanSet in redemption', await submitLoanSet(client, agent, mm, {
    TransactionType: 'LoanSet', Account: agent.classicAddress, Counterparty: mm.classicAddress,
    LoanBrokerID: brokerID, PrincipalRequested: '100000', InterestRate: 5000,
    PaymentInterval: 60, PaymentTotal: 1, GracePeriod: 60,
  }, 'LoanSet during Redemption', 'tecEXPIRED'))
  const pos = await client.request({ command: 'ledger_entry', index: vaultID, ledger_index: 'validated' })
  const shares = pos.result.node.ShareMPTID
  const mine = await client.request({ command: 'ledger_entry', mptoken: { mpt_issuance_id: shares, account: lender.classicAddress }, ledger_index: 'validated' }).catch(() => null)
  const myShares = mine?.result?.node?.MPTAmount
  console.log(`       lender holds ${myShares} shares`)
  rec('VaultWithdraw by shares', await submit(client, lender, { TransactionType: 'VaultWithdraw', Account: lender.classicAddress, VaultID: vaultID, Amount: { mpt_issuance_id: shares, value: myShares } }, 'VaultWithdraw by SHARES'))

  const final = await client.request({ command: 'ledger_entry', index: vaultID, ledger_index: 'validated' })
  console.log('\n--- VAULT FINAL ---'); console.log(JSON.stringify(final.result.node, null, 2))
  console.log('\n--- EVIDENCE ---'); for (const e of ev) console.log(`  ${String(e.code).padEnd(22)} ${e.step.padEnd(28)} ${e.hash ?? ''}`)
  fs.mkdirSync('docs/evidence', { recursive: true })
  fs.writeFileSync('docs/evidence/recall-t2.json', JSON.stringify({ network: 't2-public-devnet', SEC, domainID, vaultID, brokerID, loanID, subscriptionDate, redemptionDate, events: ev }, null, 2))
  console.log('\nwritten: docs/evidence/recall-t2.json')
  await client.disconnect()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
