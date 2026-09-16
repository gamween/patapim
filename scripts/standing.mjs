// The standing book: what a judge opens after the pitch.
//
//   node scripts/standing.mjs [loanDueDays=2] [termDays=3] [offeringTermDays=91]
//
// One lending agent runs two closed-ended funds over the same tokenised T-bill, on the public
// XRPL Devnet, one fund in each phase so that both states are visible at once:
//
//   Fund I, in term.   Subscribed, closed, one loan of securities out to a market maker. The loan
//                      returns loanDueDays after provisioning, the fund matures at termDays.
//   Fund II, offering. Open for subscription until Fund I matures, then a real term of
//                      offeringTermDays. This is where a judge signs a VaultDeposit themselves.
//
// The dates are fixed once from the validated ledger's close time when the script starts, printed
// and written down. When they pass, each fund simply moves to its next phase: the app reads the
// phase from the ledger, never from a calendar.
//
// The parameters follow agency securities lending conventions, each documented in
// docs/research/lending-conventions.md:
//   - the lender's return is the lending fee, quoted annualised in basis points (InterestRate)
//   - the agent keeps a share of that fee, the fee split (ManagementFeeRate, 10% of interest)
//   - the agent indemnifies the lender against borrower default with first-loss cover sized to
//     absorb 100% of the debt (CoverRateMinimum and CoverRateLiquidation at 100%)
//   - the borrower posts cash collateral at 102% of the loan's market value, priced from an
//     on-ledger Price Oracle, in a token escrow the agent can only claim after the grace period
//
// Seeds go to .demo/standing.json, which is gitignored. The two demo investor accounts are listed in
// docs/DEMO-ACCOUNTS.md, without their keys, which the team shares with judges on request.
import fs from 'node:fs'
import { Wallet } from 'xrpl'
import { connect, hex, sleep, createdId, submit, submitLoanSet, ledgerNow, MPT, LoanManageFlags, RIPPLE_EPOCH } from './lib/lending.mjs'

// ---------------------------------------------------------------------------------------------
// Terms, in days from the validated ledger close at start, then fixed in Ripple epoch seconds
// (unix - 946684800). Computed once, written down, never derived from the wall clock: every phase
// decision below reads the validated ledger's close_time.
const [LOAN_DUE_DAYS = 2, TERM_DAYS = 3, OFFERING_TERM_DAYS = 91] = process.argv.slice(2).map(Number)
const DAY = 86400
const TERM_SUBSCRIPTION_SECONDS = 240 // Fund I's own offering, compressed: it opens and closes now
const iso = (t) => new Date((t + RIPPLE_EPOCH) * 1000).toISOString()

const LENDING_FEE = 250 // InterestRate, tenth of a basis point, annualised: 25 bps
const FEE_SPLIT = 10000 // ManagementFeeRate, tenth of a basis point of interest: 10% to the agent
const COVER_RATE = 100000 // CoverRateMinimum and CoverRateLiquidation: 100%
const GRACE = 86400 // one day, the settlement cycle for a returned Treasury (T+1)
const PRICE = { base: 'TBL', quote: 'USD', value: 9875, scale: 4 } // reference price 0.9875
const MARGIN_PCT = 102 // collateral margin on a same-currency loan

const PRINCIPAL = 2000000
const KYC = hex('patapim.eligible.v1')
const tfVaultPrivate = 0x00010000
const STATE = '.demo/standing.json'
const FAUCET = 'https://faucet.devnet.rippletest.net/accounts'

const ev = { term: [], offering: [], shared: [] }
const rec = (book, step, r, note) => { ev[book].push({ step, code: r?.code, hash: r?.hash, note }); return r }
const must = (r, label) => { if (!r?.ok) throw new Error(`${label} failed: ${r?.code} ${r?.error ?? ''}`); return r }

const waitLedger = async (c, target, label) => {
  let t = await ledgerNow(c)
  while (t <= target) { await sleep(4000); t = await ledgerNow(c) }
  console.log(`\n--- ${label} (ledger ${t}, target ${target}) ---`)
}
const entry = async (c, req) => (await c.request({ command: 'ledger_entry', ledger_index: 'validated', ...req })).result.node

async function fundAccount(label, attempt = 1) {
  try {
    const res = await fetch(FAUCET, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const j = await res.json()
    if (!j.seed) throw new Error(JSON.stringify(j).slice(0, 160))
    const w = Wallet.fromSeed(j.seed)
    console.log(`  funded ${label.padEnd(20)} ${w.classicAddress}`)
    return w
  } catch (e) {
    if (attempt >= 5) throw e
    await sleep(3000 * attempt)
    return fundAccount(label, attempt + 1)
  }
}

const main = async () => {
  if (!(LOAN_DUE_DAYS > 0 && TERM_DAYS > LOAN_DUE_DAYS && OFFERING_TERM_DAYS > 0)) {
    throw new Error('usage: node scripts/standing.mjs [loanDueDays=2] [termDays=3] [offeringTermDays=91], the loan falls due before Fund I matures')
  }
  const { client } = await connect('t2')
  const close = await ledgerNow(client)
  const TERM_LOAN_DUE = close + LOAN_DUE_DAYS * DAY // the loan of securities returns
  const TERM_REDEMPTION = close + TERM_DAYS * DAY // Fund I matures
  const OFFERING_CLOSE = TERM_REDEMPTION // Fund II subscription closes as Fund I matures
  const OFFERING_REDEMPTION = OFFERING_CLOSE + OFFERING_TERM_DAYS * DAY // Fund II matures
  console.log(`\n--- terms, from validated ledger close ${close} ${iso(close)} ---`)
  for (const [what, t] of [['Fund I loan due', TERM_LOAN_DUE], ['Fund I matures', TERM_REDEMPTION], ['Fund II closes', OFFERING_CLOSE], ['Fund II matures', OFFERING_REDEMPTION]]) {
    console.log(`  ${what.padEnd(16)} ${t}  ${iso(t)}`)
  }

  console.log('\n--- accounts ---')
  const w = {}
  for (const role of ['issuer', 'cashIssuer', 'pricing', 'agent', 'lender', 'borrower', 'investorEligible', 'investorIneligible']) {
    w[role] = await fundAccount(role)
  }
  fs.mkdirSync('.demo', { recursive: true })
  const seeds = Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v.seed]))
  fs.writeFileSync(STATE, JSON.stringify({ seeds }, null, 2))
  await sleep(6000)

  console.log('\n--- 1. the security and the cash ---')
  const sec = rec('shared', 'MPTokenIssuanceCreate security', must(await submit(client, w.issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: w.issuer.classicAddress,
    AssetScale: 0, MaximumAmount: '1000000000',
    Flags: MPT.CanTransfer | MPT.CanTrade | MPT.CanEscrow | MPT.CanClawback | MPT.CanLock | MPT.RequireAuth,
    MPTokenMetadata: hex(JSON.stringify({
      ticker: 'TBL', name: 'patapim demo T-bill', desc: 'Fictitious tokenised 3-month US Treasury bill, 1 TBL = USD 1 face value',
      icon: 'https://raw.githubusercontent.com/gamween/patapim/main/web/app/icon.svg',
      asset_class: 'rwa', asset_subclass: 'treasury', issuer_name: 'patapim demo transfer agent',
    })),
  }, 'MPTokenIssuanceCreate TBL'), 'security'))
  const SEC = sec.meta.mpt_issuance_id

  const cash = rec('shared', 'MPTokenIssuanceCreate cash', must(await submit(client, w.cashIssuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: w.cashIssuer.classicAddress,
    AssetScale: 2, MaximumAmount: '100000000000',
    Flags: MPT.CanTransfer | MPT.CanTrade | MPT.CanEscrow,
    MPTokenMetadata: hex(JSON.stringify({
      ticker: 'USDX', name: 'patapim demo cash', desc: 'Fictitious tokenised USD used as securities lending collateral',
      icon: 'https://raw.githubusercontent.com/gamween/patapim/main/web/app/icon.svg',
      asset_class: 'rwa', asset_subclass: 'stablecoin', issuer_name: 'patapim demo cash issuer',
    })),
  }, 'MPTokenIssuanceCreate USDX'), 'cash'))
  const CASH = cash.meta.mpt_issuance_id
  console.log(`       TBL  ${SEC}\n       USDX ${CASH}`)

  // Require-auth security: every holder opts in, then the transfer agent authorises it.
  const holdings = { agent: '10000000', lender: '10000000', borrower: '100000', investorEligible: '1000000', investorIneligible: '1000000' }
  for (const [role, amount] of Object.entries(holdings)) {
    const pub = role.startsWith('investor')
    const r1 = must(await submit(client, w[role], { TransactionType: 'MPTokenAuthorize', Account: w[role].classicAddress, MPTokenIssuanceID: SEC }, `${role} opts in to TBL`), 'opt in')
    const r2 = must(await submit(client, w.issuer, { TransactionType: 'MPTokenAuthorize', Account: w.issuer.classicAddress, MPTokenIssuanceID: SEC, Holder: w[role].classicAddress }, `issuer authorises ${role}`), 'authorise')
    const r3 = must(await submit(client, w.issuer, { TransactionType: 'Payment', Account: w.issuer.classicAddress, Destination: w[role].classicAddress, Amount: { mpt_issuance_id: SEC, value: amount } }, `issue ${amount} TBL to ${role}`), 'issue')
    if (pub) {
      rec('offering', `MPTokenAuthorize ${role} opts in`, r1)
      rec('offering', `MPTokenAuthorize issuer authorises ${role}`, r2)
      rec('offering', `Payment ${amount} TBL to ${role}`, r3)
    }
  }
  for (const role of ['borrower', 'agent']) {
    must(await submit(client, w[role], { TransactionType: 'MPTokenAuthorize', Account: w[role].classicAddress, MPTokenIssuanceID: CASH }, `${role} opts in to USDX`), 'cash opt in')
  }
  rec('term', 'Payment USDX to borrower', must(await submit(client, w.cashIssuer, {
    TransactionType: 'Payment', Account: w.cashIssuer.classicAddress, Destination: w.borrower.classicAddress,
    Amount: { mpt_issuance_id: CASH, value: '300000000' },
  }, 'issue 3,000,000.00 USDX to the borrower'), 'cash issue'))

  console.log('\n--- 2. eligibility ---')
  const expires = close + 365 * 86400
  for (const role of ['lender', 'investorEligible']) {
    const c1 = must(await submit(client, w.agent, { TransactionType: 'CredentialCreate', Account: w.agent.classicAddress, Subject: w[role].classicAddress, CredentialType: KYC, Expiration: expires }, `credential to ${role}`), 'credential')
    const c2 = must(await submit(client, w[role], { TransactionType: 'CredentialAccept', Account: w[role].classicAddress, Issuer: w.agent.classicAddress, CredentialType: KYC }, `${role} accepts`), 'accept')
    const book = role === 'lender' ? 'shared' : 'offering'
    rec(book, `CredentialCreate ${role}`, c1)
    rec(book, `CredentialAccept ${role}`, c2)
  }
  const pd = rec('shared', 'PermissionedDomainSet', must(await submit(client, w.agent, {
    TransactionType: 'PermissionedDomainSet', Account: w.agent.classicAddress,
    AcceptedCredentials: [{ Credential: { Issuer: w.agent.classicAddress, CredentialType: KYC } }],
  }, 'PermissionedDomainSet'), 'domain'))
  const domainID = createdId(pd.meta, 'PermissionedDomain')

  console.log('\n--- 3. the reference price ---')
  const oracleClose = await ledgerNow(client)
  rec('shared', 'OracleSet', must(await submit(client, w.pricing, {
    TransactionType: 'OracleSet', Account: w.pricing.classicAddress, OracleDocumentID: 1,
    Provider: hex('patapim demo pricing'), AssetClass: hex('treasury'),
    LastUpdateTime: oracleClose + RIPPLE_EPOCH,
    PriceDataSeries: [{ PriceData: { BaseAsset: PRICE.base, QuoteAsset: PRICE.quote, AssetPrice: PRICE.value, Scale: PRICE.scale } }],
  }, 'OracleSet TBL/USD 0.9875'), 'oracle'))

  console.log('\n--- 4. two funds ---')
  const base = await ledgerNow(client)
  const termSubscription = base + TERM_SUBSCRIPTION_SECONDS
  const vcTerm = rec('term', 'VaultCreate', must(await submit(client, w.agent, {
    TransactionType: 'VaultCreate', Account: w.agent.classicAddress,
    Asset: { mpt_issuance_id: SEC }, WithdrawalPolicy: 1, DomainID: domainID, Flags: tfVaultPrivate,
    VaultKind: 1, SubscriptionDate: termSubscription, RedemptionDate: TERM_REDEMPTION,
    Data: hex(JSON.stringify({ n: 'patapim TBL lending fund I', o: `${w.pricing.classicAddress}/1` })),
  }, 'VaultCreate Fund I'), 'vault term'))
  const vaultTerm = createdId(vcTerm.meta, 'Vault')

  const vcOff = rec('offering', 'VaultCreate', must(await submit(client, w.agent, {
    TransactionType: 'VaultCreate', Account: w.agent.classicAddress,
    Asset: { mpt_issuance_id: SEC }, WithdrawalPolicy: 1, DomainID: domainID, Flags: tfVaultPrivate,
    AssetsMaximum: '20000000',
    VaultKind: 1, SubscriptionDate: OFFERING_CLOSE, RedemptionDate: OFFERING_REDEMPTION,
    Data: hex(JSON.stringify({ n: 'patapim TBL lending fund II', o: `${w.pricing.classicAddress}/1` })),
  }, 'VaultCreate Fund II'), 'vault offering'))
  const vaultOffering = createdId(vcOff.meta, 'Vault')
  console.log(`       Fund I  ${vaultTerm}\n       Fund II ${vaultOffering}`)

  rec('term', 'VaultDeposit lender', must(await submit(client, w.lender, { TransactionType: 'VaultDeposit', Account: w.lender.classicAddress, VaultID: vaultTerm, Amount: { mpt_issuance_id: SEC, value: '5000000' } }, 'lender subscribes 5,000,000 to Fund I'), 'deposit term'))
  rec('offering', 'VaultDeposit lender', must(await submit(client, w.lender, { TransactionType: 'VaultDeposit', Account: w.lender.classicAddress, VaultID: vaultOffering, Amount: { mpt_issuance_id: SEC, value: '3000000' } }, 'lender subscribes 3,000,000 to Fund II'), 'deposit offering'))

  const brokers = {}
  for (const [book, vaultID, ceiling] of [['term', vaultTerm, '4000000'], ['offering', vaultOffering, '16000000']]) {
    const lb = rec(book, 'LoanBrokerSet', must(await submit(client, w.agent, {
      TransactionType: 'LoanBrokerSet', Account: w.agent.classicAddress, VaultID: vaultID,
      ManagementFeeRate: FEE_SPLIT, DebtMaximum: ceiling, CoverRateMinimum: COVER_RATE, CoverRateLiquidation: COVER_RATE,
    }, `LoanBrokerSet ${book}`), 'broker'))
    brokers[book] = createdId(lb.meta, 'LoanBroker')
    rec(book, 'LoanBrokerCoverDeposit', must(await submit(client, w.agent, {
      TransactionType: 'LoanBrokerCoverDeposit', Account: w.agent.classicAddress, LoanBrokerID: brokers[book],
      Amount: { mpt_issuance_id: SEC, value: '2500000' },
    }, `first-loss cover ${book}, 2,500,000 TBL`), 'cover'))
  }

  console.log('\n--- 5. the judge path, proven before anyone tries it ---')
  rec('offering', 'VaultDeposit eligible investor', await submit(client, w.investorEligible, { TransactionType: 'VaultDeposit', Account: w.investorEligible.classicAddress, VaultID: vaultOffering, Amount: { mpt_issuance_id: SEC, value: '1000' } }, 'eligible investor subscribes 1,000'))
  rec('offering', 'VaultDeposit ineligible investor', await submit(client, w.investorIneligible, { TransactionType: 'VaultDeposit', Account: w.investorIneligible.classicAddress, VaultID: vaultOffering, Amount: { mpt_issuance_id: SEC, value: '1000' } }, 'ineligible investor is refused', 'tecNO_AUTH'))
  rec('offering', 'LoanSet during offering', await submitLoanSet(client, w.agent, w.borrower, {
    TransactionType: 'LoanSet', Account: w.agent.classicAddress, Counterparty: w.borrower.classicAddress,
    LoanBrokerID: brokers.offering, PrincipalRequested: '100000', InterestRate: LENDING_FEE,
    PaymentInterval: 3600, PaymentTotal: 1, GracePeriod: 3600,
  }, 'no lending before the fund closes', 'tecTOO_SOON'))

  await waitLedger(client, termSubscription + 4, '6. Fund I closes, the term begins')
  rec('term', 'VaultDeposit after close', await submit(client, w.lender, { TransactionType: 'VaultDeposit', Account: w.lender.classicAddress, VaultID: vaultTerm, Amount: { mpt_issuance_id: SEC, value: '1000' } }, 'subscription closed', 'tecEXPIRED'))
  const shareTerm = (await entry(client, { index: vaultTerm })).ShareMPTID
  rec('term', 'VaultWithdraw during term', await submit(client, w.lender, { TransactionType: 'VaultWithdraw', Account: w.lender.classicAddress, VaultID: vaultTerm, Amount: { mpt_issuance_id: shareTerm, value: '1000' } }, 'capital locked for the term', 'tecTOO_SOON'))

  const start = await ledgerNow(client)
  const interval = TERM_LOAN_DUE - start
  const loan = rec('term', 'LoanSet', must(await submitLoanSet(client, w.agent, w.borrower, {
    TransactionType: 'LoanSet', Account: w.agent.classicAddress, Counterparty: w.borrower.classicAddress,
    LoanBrokerID: brokers.term, PrincipalRequested: String(PRINCIPAL), InterestRate: LENDING_FEE,
    PaymentInterval: interval, PaymentTotal: 1, GracePeriod: GRACE,
    Data: hex('patapim TBL loan 1, term, fee 25 bps'),
  }, 'LoanSet 2,000,000 TBL to the market maker, two signatures'), 'loan'))
  const loanID = createdId(loan.meta, 'Loan')

  console.log('\n--- 7. cash collateral at 102% of market value ---')
  const oracle = await entry(client, { oracle: { account: w.pricing.classicAddress, oracle_document_id: 1 } })
  const pd0 = oracle.PriceDataSeries[0].PriceData
  const price = BigInt(parseInt(pd0.AssetPrice, 16)) // AssetPrice is hex on the ledger entry
  const scale = BigInt(pd0.Scale)
  // cents = principal * price / 10^scale * margin/100 * 100, rounded up
  const num = BigInt(PRINCIPAL) * price * BigInt(MARGIN_PCT)
  const den = 10n ** scale
  const cents = (num + den - 1n) / den
  const escrow = rec('term', 'EscrowCreate collateral', must(await submit(client, w.borrower, {
    TransactionType: 'EscrowCreate', Account: w.borrower.classicAddress, Destination: w.agent.classicAddress,
    Amount: { mpt_issuance_id: CASH, value: cents.toString() },
    FinishAfter: TERM_LOAN_DUE + GRACE, CancelAfter: TERM_REDEMPTION,
    Memos: [{ Memo: { MemoType: hex('collateral'), MemoData: hex(`102% of loan ${loanID.slice(0, 8)} market value at oracle TBL/USD`) } }],
  }, `EscrowCreate ${cents} USDX cents to the agent`), 'escrow'))
  const escrowSeq = (await client.request({ command: 'tx', transaction: escrow.hash })).result.tx_json.Sequence

  const state = {
    network: 'XRPL Devnet', seeds,
    accounts: Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v.classicAddress])),
    SEC, CASH, domainID, oracle: { account: w.pricing.classicAddress, documentID: 1 },
    term: { vaultID: vaultTerm, brokerID: brokers.term, loanID, subscriptionDate: termSubscription, loanDueDate: TERM_LOAN_DUE, redemptionDate: TERM_REDEMPTION, escrow: { owner: w.borrower.classicAddress, sequence: escrowSeq } },
    offering: { vaultID: vaultOffering, brokerID: brokers.offering, subscriptionDate: OFFERING_CLOSE, redemptionDate: OFFERING_REDEMPTION },
  }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2))

  const { seeds: _omit, ...pub } = state
  const common = { network: 'XRPL Devnet', SEC, CASH, domainID, oracle: pub.oracle, accounts: pub.accounts }
  fs.writeFileSync('docs/evidence/fund-term.json', JSON.stringify({ ...common, ...pub.term, events: [...ev.shared, ...ev.term] }, null, 2) + '\n')
  fs.writeFileSync('docs/evidence/fund-offering.json', JSON.stringify({ ...common, ...pub.offering, events: ev.offering }, null, 2) + '\n')

  console.log('\n--- STATE ---')
  console.log(JSON.stringify(pub, null, 2))
  console.log('\n--- EVIDENCE ---')
  for (const book of ['shared', 'term', 'offering']) for (const e of ev[book]) console.log(`  ${book.padEnd(9)} ${String(e.code).padEnd(18)} ${e.step.padEnd(40)} ${e.hash ?? ''}`)
  console.log('\nwritten: .demo/standing.json (seeds), docs/evidence/fund-term.json, docs/evidence/fund-offering.json')
  await client.disconnect()
}
// node scripts/standing.mjs annotate
// Writes the reference price pointer into each fund's Data with VaultSet, so the dashboard finds
// the Price Oracle from the vault itself: `o` is "<oracle owner>/<OracleDocumentID>".
async function annotate() {
  const s = JSON.parse(fs.readFileSync(STATE, 'utf8'))
  const { client } = await connect('t2')
  const agent = Wallet.fromSeed(s.seeds.agent)
  for (const [book, name] of [['term', 'patapim TBL lending fund I'], ['offering', 'patapim TBL lending fund II']]) {
    const data = hex(JSON.stringify({ n: name, o: `${s.oracle.account}/${s.oracle.documentID}` }))
    const r = must(await submit(client, agent, { TransactionType: 'VaultSet', Account: agent.classicAddress, VaultID: s[book].vaultID, Data: data }, `VaultSet ${book}: name and reference price pointer`), 'annotate')
    const file = `docs/evidence/fund-${book}.json`
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
    doc.events.push({ step: 'VaultSet reference price pointer', code: r.code, hash: r.hash })
    fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n')
  }
  await client.disconnect()
}

// node scripts/standing.mjs settle
// The borrower never returned the securities. Once the grace period has run out, the agent settles
// Fund I the way the default arc does: impair the loan, declare default so the first-loss cover
// repays the vault, then claim the borrower's cash collateral from the escrow, which is only open to
// the agent between FinishAfter (due date plus grace) and CancelAfter (the fund's maturity).
async function settle() {
  const s = JSON.parse(fs.readFileSync(STATE, 'utf8'))
  const { client } = await connect('t2')
  const agent = Wallet.fromSeed(s.seeds.agent)
  const { vaultID, brokerID, loanID, escrow } = s.term
  const file = 'docs/evidence/fund-term.json'
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'))
  const states = []
  const snapshot = async (label) => {
    const v = await entry(client, { index: vaultID })
    const b = await entry(client, { index: brokerID })
    const sh = await entry(client, { mpt_issuance: v.ShareMPTID })
    const assets = Number(v.AssetsTotal ?? 0), loss = Number(v.LossUnrealized ?? 0), shares = Number(sh.OutstandingAmount ?? 0)
    const row = {
      label, AssetsTotal: v.AssetsTotal ?? '0', AssetsAvailable: v.AssetsAvailable ?? '0', LossUnrealized: v.LossUnrealized ?? '0',
      shares: String(shares), navPerShare: shares > 0 ? ((assets - loss) / shares).toFixed(6) : null,
      DebtTotal: b.DebtTotal ?? '0', CoverAvailable: b.CoverAvailable ?? '0',
    }
    console.log(`   [${label}] assets=${row.AssetsTotal} loss=${row.LossUnrealized} nav=${row.navPerShare} debt=${row.DebtTotal} cover=${row.CoverAvailable}`)
    states.push(row)
  }
  const loan = await entry(client, { index: loanID })
  const close = await ledgerNow(client)
  const graceOver = Number(loan.NextPaymentDueDate) + Number(loan.GracePeriod)
  if (close <= graceOver) throw new Error(`grace period still running until ${iso(graceOver)}`)
  console.log(`\n--- settlement of Fund I (ledger ${iso(close)}, payment was due ${iso(Number(loan.NextPaymentDueDate))}) ---`)
  await snapshot('past grace, unpaid')
  const steps = [
    ['LoanManage impair', { TransactionType: 'LoanManage', Account: agent.classicAddress, LoanID: loanID, Flags: LoanManageFlags.tfLoanImpair }, 'impaired'],
    ['LoanManage default', { TransactionType: 'LoanManage', Account: agent.classicAddress, LoanID: loanID, Flags: LoanManageFlags.tfLoanDefault }, 'defaulted, cover absorbs'],
    ['EscrowFinish collateral', { TransactionType: 'EscrowFinish', Account: agent.classicAddress, Owner: escrow.owner, OfferSequence: escrow.sequence }, 'collateral claimed'],
  ]
  for (const [step, tx, after] of steps) {
    const r = must(await submit(client, agent, tx, step), step)
    doc.events.push({ step, code: r.code, hash: r.hash })
    await snapshot(after)
  }
  doc.settlement = { at: close, states }
  fs.writeFileSync(file, JSON.stringify(doc, null, 2) + '\n')
  console.log(`\nwritten: ${file}`)
  await client.disconnect()
}

const verbs = { annotate, settle }
const verb = verbs[process.argv[2]] ?? main
verb().catch((e) => { console.error('FATAL', e); process.exit(1) })
