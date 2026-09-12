// Demo harness. One file, two verbs.
//
//   node scripts/demo.mjs provision [minutesUntilBoundary]
//       Builds the whole world on the public devnet and leaves the vault in Subscription with the
//       Subscription to Investment boundary set to fall N minutes from now, so a phase gate fires
//       live on screen during the pitch. Prints a runbook. Default 4 minutes.
//
//   node scripts/demo.mjs <step>
//       deposit-ok       an eligible lender subscribes
//       deposit-blocked  an account with no credential is refused, tecNO_AUTH
//       deposit-late     a deposit after the boundary, tecEXPIRED
//       loan             the loan of securities, two signatures
//       impair           the agent impairs the unpaid loan
//       default          the agent declares default, the cover repays the vault
//       state            print the vault, the broker and the loan as the dashboard sees them
//
// State lives in .demo/state.json, which is gitignored: it holds devnet seeds.
import fs from 'node:fs'
import { Wallet } from 'xrpl'
import { connect, fund, hex, sleep, createdId, submit, submitLoanSet } from './lib/lending.mjs'

const STATE = '.demo/state.json'
const MPT = { CanLock: 0x2, RequireAuth: 0x4, CanEscrow: 0x8, CanTrade: 0x10, CanTransfer: 0x20, CanClawback: 0x40 }
const LoanManageFlags = { tfLoanDefault: 65536, tfLoanImpair: 131072 }
const KYC = hex('patapim.eligible.v1')

const ledgerNow = async (c) => (await c.request({ command: 'ledger', ledger_index: 'validated' })).result.ledger.close_time
const load = () => JSON.parse(fs.readFileSync(STATE, 'utf8'))
const save = (s) => { fs.mkdirSync('.demo', { recursive: true }); fs.writeFileSync(STATE, JSON.stringify(s, null, 2)) }
const wallets = (s) => Object.fromEntries(Object.entries(s.seeds).map(([k, v]) => [k, Wallet.fromSeed(v)]))
const clock = (t) => new Date((t + 946684800) * 1000).toLocaleTimeString('en-GB')

async function provision(minutes) {
  const { client, net } = await connect('t2')
  const issuer = await fund(net, 'issuer')
  const agent = await fund(net, 'agent')
  const lender = await fund(net, 'lender')
  const mm = await fund(net, 'marketmkr')
  const outsider = await fund(net, 'outsider')
  await sleep(5000)

  const iss = await submit(client, issuer, {
    TransactionType: 'MPTokenIssuanceCreate', Account: issuer.classicAddress,
    AssetScale: 0, MaximumAmount: '1000000000',
    Flags: MPT.CanTransfer | MPT.CanTrade | MPT.CanEscrow | MPT.CanClawback | MPT.CanLock | MPT.RequireAuth,
    MPTokenMetadata: hex(JSON.stringify({
      ticker: 'TBL', name: 'patapim demo T-Bill', desc: 'Demo tokenised treasury bill',
      icon: 'https://patapim.example/tbl.png', asset_class: 'rwa', asset_subclass: 'treasury',
      issuer_name: 'patapim demo transfer agent',
    })),
  }, 'MPTokenIssuanceCreate')
  const SEC = iss.meta?.mpt_issuance_id
  for (const [w, n] of [[lender, 'lender'], [mm, 'marketmkr'], [agent, 'agent'], [outsider, 'outsider']]) {
    await submit(client, w, { TransactionType: 'MPTokenAuthorize', Account: w.classicAddress, MPTokenIssuanceID: SEC }, `${n} opts in`)
    await submit(client, issuer, { TransactionType: 'MPTokenAuthorize', Account: issuer.classicAddress, MPTokenIssuanceID: SEC, Holder: w.classicAddress }, `authorise ${n}`)
    await submit(client, issuer, { TransactionType: 'Payment', Account: issuer.classicAddress, Destination: w.classicAddress, Amount: { mpt_issuance_id: SEC, value: '10000000' } }, `issue TBL to ${n}`)
  }
  // Only the lender is eligible. The outsider deliberately holds the security but no credential.
  await submit(client, agent, { TransactionType: 'CredentialCreate', Account: agent.classicAddress, Subject: lender.classicAddress, CredentialType: KYC }, 'credential to the lender')
  await submit(client, lender, { TransactionType: 'CredentialAccept', Account: lender.classicAddress, Issuer: agent.classicAddress, CredentialType: KYC }, 'lender accepts')
  const pd = await submit(client, agent, { TransactionType: 'PermissionedDomainSet', Account: agent.classicAddress, AcceptedCredentials: [{ Credential: { Issuer: agent.classicAddress, CredentialType: KYC } }] }, 'PermissionedDomainSet')
  const domainID = createdId(pd.meta, 'PermissionedDomain')

  const base = await ledgerNow(client)
  const subscriptionDate = base + minutes * 60
  const redemptionDate = subscriptionDate + 600
  const vc = await submit(client, agent, {
    TransactionType: 'VaultCreate', Account: agent.classicAddress,
    Asset: { mpt_issuance_id: SEC }, WithdrawalPolicy: 1, DomainID: domainID, Flags: 0x00010000,
    VaultKind: 1, SubscriptionDate: subscriptionDate, RedemptionDate: redemptionDate,
    Data: hex('patapim'),
  }, 'VaultCreate')
  const vaultID = createdId(vc.meta, 'Vault')
  const lb = await submit(client, agent, {
    TransactionType: 'LoanBrokerSet', Account: agent.classicAddress, VaultID: vaultID,
    ManagementFeeRate: 1000, DebtMaximum: '4000000',
    // 100000 is one hundred percent, in parts per 100000. The cover absorbs the whole loan at
    // default, which is the entire promise to the lender. At 10000 it would absorb a tenth of it
    // and the lenders would eat the rest: see finding F-014.
    CoverRateMinimum: 100000, CoverRateLiquidation: 100000,
  }, 'LoanBrokerSet')
  const brokerID = createdId(lb.meta, 'LoanBroker')
  await submit(client, agent, { TransactionType: 'LoanBrokerCoverDeposit', Account: agent.classicAddress, LoanBrokerID: brokerID, Amount: { mpt_issuance_id: SEC, value: '2500000' } }, 'first-loss cover, 2,500,000 TBL against a 2,000,000 loan')

  save({
    seeds: { issuer: issuer.seed, agent: agent.seed, lender: lender.seed, mm: mm.seed, outsider: outsider.seed },
    SEC, domainID, vaultID, brokerID, subscriptionDate, redemptionDate, loanID: null,
  })

  console.log(`\n${'='.repeat(78)}\nRUNBOOK\n${'='.repeat(78)}`)
  console.log(`  dashboard   http://localhost:3000/vault/${vaultID}`)
  console.log(`  explorer    https://devnet.xrpl.org/vault/${vaultID}`)
  console.log(`  Subscription closes at ${clock(subscriptionDate)}, Redemption opens at ${clock(redemptionDate)}`)
  console.log(`\n  before the boundary`)
  console.log(`    node scripts/demo.mjs deposit-ok        eligible lender subscribes`)
  console.log(`    node scripts/demo.mjs deposit-blocked   no credential, tecNO_AUTH`)
  console.log(`\n  after the boundary, the page flips on its own`)
  console.log(`    node scripts/demo.mjs deposit-late      tecEXPIRED`)
  console.log(`    node scripts/demo.mjs loan              the loan of securities`)
  console.log(`    node scripts/demo.mjs impair            after the grace period`)
  console.log(`    node scripts/demo.mjs default           the cover repays the vault`)
  console.log(`\n  node scripts/demo.mjs state             at any point`)
  await client.disconnect()
}

async function act(step) {
  const s = load()
  const { client } = await connect('t2')
  const w = wallets(s)
  const amt = (v) => ({ mpt_issuance_id: s.SEC, value: String(v) })
  const now = await ledgerNow(client)
  const phase = now < s.subscriptionDate ? 'subscription' : now < s.redemptionDate ? 'investment' : 'redemption'
  console.log(`  phase now: ${phase}`)

  if (step === 'deposit-ok') await submit(client, w.lender, { TransactionType: 'VaultDeposit', Account: w.lender.classicAddress, VaultID: s.vaultID, Amount: amt(5000000) }, 'eligible lender subscribes')
  else if (step === 'deposit-blocked') await submit(client, w.outsider, { TransactionType: 'VaultDeposit', Account: w.outsider.classicAddress, VaultID: s.vaultID, Amount: amt(1000000) }, 'no credential', 'tecNO_AUTH')
  else if (step === 'deposit-late') await submit(client, w.lender, { TransactionType: 'VaultDeposit', Account: w.lender.classicAddress, VaultID: s.vaultID, Amount: amt(1000), }, 'after the window closed', 'tecEXPIRED')
  else if (step === 'loan') {
    const r = await submitLoanSet(client, w.agent, w.mm, {
      TransactionType: 'LoanSet', Account: w.agent.classicAddress, Counterparty: w.mm.classicAddress,
      LoanBrokerID: s.brokerID, PrincipalRequested: '2000000', InterestRate: 5000,
      PaymentInterval: 60, PaymentTotal: 2, GracePeriod: 60, Data: hex('patapim demo loan'),
    }, 'loan of securities, two signatures')
    const loanID = r.meta && createdId(r.meta, 'Loan')
    if (loanID) { s.loanID = loanID; save(s); console.log(`       LoanID ${loanID}`) }
  } else if (step === 'impair') await submit(client, w.agent, { TransactionType: 'LoanManage', Account: w.agent.classicAddress, LoanID: s.loanID, Flags: LoanManageFlags.tfLoanImpair }, 'agent impairs')
  else if (step === 'default') await submit(client, w.agent, { TransactionType: 'LoanManage', Account: w.agent.classicAddress, LoanID: s.loanID, Flags: LoanManageFlags.tfLoanDefault }, 'agent declares default')
  else if (step === 'state') {
    const v = (await client.request({ command: 'ledger_entry', index: s.vaultID, ledger_index: 'validated' })).result.node
    const b = (await client.request({ command: 'ledger_entry', index: s.brokerID, ledger_index: 'validated' })).result.node
    const sh = (await client.request({ command: 'ledger_entry', mpt_issuance: v.ShareMPTID, ledger_index: 'validated' })).result.node
    const assets = Number(v.AssetsTotal ?? 0), shares = Number(sh.OutstandingAmount ?? 0)
    console.log(`  assets ${assets}  available ${v.AssetsAvailable ?? 0}  loss ${v.LossUnrealized ?? 0}`)
    console.log(`  shares ${shares}  price per share ${shares ? (assets / shares).toFixed(8) : 'n/a'}`)
    console.log(`  cover ${b.CoverAvailable ?? 0}  debt ${b.DebtTotal ?? 0}`)
    if (s.loanID) {
      const l = await client.request({ command: 'ledger_entry', index: s.loanID, ledger_index: 'validated' }).catch(() => null)
      console.log(l?.result?.node ? `  loan outstanding ${l.result.node.TotalValueOutstanding} flags ${l.result.node.Flags} next due ${clock(l.result.node.NextPaymentDueDate)}` : '  loan entry gone')
    }
  } else console.log('unknown step')
  await client.disconnect()
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'provision') provision(Number(arg ?? 4)).catch((e) => { console.error('FATAL', e); process.exit(1) })
else act(cmd ?? 'state').catch((e) => { console.error('FATAL', e); process.exit(1) })
