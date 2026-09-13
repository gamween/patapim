// Builds docs/ON-CHAIN.md: every account and every ledger object we created, with explorer links,
// and verifies that every recorded transaction still resolves with the type and result we claim.
// Run it after any provisioning run:  node scripts/gen-onchain-inventory.mjs
import fs from 'node:fs'
import { Client } from 'xrpl'

const WSS = 'wss://s.devnet.rippletest.net:51233/'
const EX = 'https://devnet.xrpl.org'
const RUNS = [
  ['fund-term.json', 'Fund I, in term: the live loan book', 'the vault the landing page opens: subscribed, closed, 2,000,000 TBL on loan to a market maker against 102% cash collateral, until Tuesday 15 September 12:00 CEST'],
  ['fund-offering.json', 'Fund II, open for subscription: where a judge signs', 'subscription open until Wednesday 16 September 18:00 CEST, then a 91 day term. The two demo investor accounts in `docs/DEMO-ACCOUNTS.md` deposit here'],
  ['recall-t2.json', 'Flagship lifecycle, 12 September', 'subscription, gated deposit, loan of securities, the three phase rejections, repayment, redemption'],
  ['default-arc-cover100000.json', 'Default arc, full indemnity', 'impairment then default; the cover absorbs the whole loan and the lenders are untouched'],
  ['default-arc-cover10000.json', 'Default arc, ten percent cover', 'the same default at a ten percent cover rate, where the lenders take the loss'],
  ['standing-demo.json', 'Standing vault of 12 September, superseded by Fund I', 'the vault the landing page advertised on Saturday; its loan falls due on Sunday afternoon, so the app now opens Fund I'],
]
const ROLE = {
  issuer: 'Transfer agent, issues the security TBL',
  cashIssuer: 'Cash issuer, issues the collateral token USDX',
  pricing: 'Price provider, owns the TBL/USD Price Oracle',
  agent: 'Lending agent: credential issuer, domain owner, vault owner, loan broker owner',
  lender: 'Beneficial owner, the lender',
  borrower: 'Borrower, the market maker',
  investorEligible: 'Demo investor with a credential, see `docs/DEMO-ACCOUNTS.md`',
  investorIneligible: 'Demo investor without a credential, see `docs/DEMO-ACCOUNTS.md`',
}

const short = (s, n = 10) => (s ? `${s.slice(0, n)}…${s.slice(-4)}` : '')
const acct = (a) => (a ? `[\`${short(a, 8)}\`](${EX}/accounts/${a})` : '—')
const txl = (h) => `[\`${h.slice(0, 8)}\`](${EX}/transactions/${h})`

const main = async () => {
  const client = new Client(WSS)
  await client.connect()
  const entry = async (req) => (await client.request({ command: 'ledger_entry', ledger_index: 'validated', ...req }).catch(() => null))?.result?.node ?? null

  let md = `# On chain

Everything patapim created on the public XRPL Devnet, with a link for each. Regenerate with
\`node scripts/gen-onchain-inventory.mjs\`, which also re-verifies every transaction against the
ledger rather than against this file.

Network: **XRPL Devnet**, \`wss://s.devnet.rippletest.net:51233\`, network_id 2, rippled 3.4.0-rc5.
Explorer: ${EX}

The XRP Ledger has no contract addresses. What a contract address would name elsewhere is a ledger
object id here: the vault, the loan broker, the loan, the token issuances, the permissioned domain.
The vault page on the explorer shows the vault, its broker and its loans together.

`
  let checked = 0, mismatched = 0

  for (const [file, title, blurb] of RUNS) {
    const p = `docs/evidence/${file}`
    if (!fs.existsSync(p)) continue
    const ev = JSON.parse(fs.readFileSync(p, 'utf8'))
    const vault = await entry({ index: ev.vaultID })
    const broker = await entry({ index: ev.brokerID })
    const loan = ev.loanID ? await entry({ index: ev.loanID }) : null
    const iss = await entry({ mpt_issuance: ev.SEC })
    const shares = vault?.ShareMPTID ? await entry({ mpt_issuance: vault.ShareMPTID }) : null

    md += `## ${title}\n\n${blurb}. Evidence: [\`docs/evidence/${file}\`](./evidence/${file}).\n\n`
    md += `### Accounts\n\n| Role | Address |\n|---|---|\n`
    if (ev.accounts) {
      for (const [role, address] of Object.entries(ev.accounts)) md += `| ${ROLE[role] ?? role} | ${acct(address)} |\n`
    } else {
      md += `| Transfer agent, issues the security | ${acct(iss?.Issuer)} |\n`
      md += `| Lending agent, owns the vault and the broker | ${acct(vault?.Owner)} |\n`
      if (loan?.Borrower) md += `| Borrower, the market maker | ${acct(loan.Borrower)} |\n`
    }
    md += `| Vault pseudo-account, holds the pooled securities | ${acct(vault?.Account)} |\n`
    md += `| Loan broker pseudo-account, holds the loans | ${acct(broker?.Account)} |\n\n`

    md += `### Ledger objects\n\n| Object | Id | What it is |\n|---|---|---|\n`
    md += `| Vault | [\`${ev.vaultID}\`](${EX}/vault/${ev.vaultID}) | closed-ended, \`VaultKind 1\` |\n`
    md += `| Loan broker | \`${ev.brokerID}\` | the lending agent, on the vault page under Loans |\n`
    if (ev.loanID) md += `| Loan | \`${ev.loanID}\` | the loan of securities |\n`
    md += `| Security, MPT issuance | \`${ev.SEC}\` | TBL, the vault asset, require-auth |\n`
    md += `| Vault shares, MPT issuance | \`${vault?.ShareMPTID ?? '—'}\` | the lender position${shares?.OutstandingAmount ? `, ${shares.OutstandingAmount} outstanding` : ''} |\n`
    if (ev.CASH) md += `| Cash, MPT issuance | \`${ev.CASH}\` | USDX, the collateral token, \`AssetScale 2\` |\n`
    md += `| Permissioned domain | \`${ev.domainID}\` | the eligibility gate |\n`
    if (ev.oracle) md += `| Price Oracle | owner ${acct(ev.oracle.account)}, \`OracleDocumentID ${ev.oracle.documentID}\` | TBL/USD reference price |\n`
    if (ev.escrow) {
      const escrows = (await client.request({ command: 'account_objects', account: ev.escrow.owner, type: 'escrow', ledger_index: 'validated' }).catch(() => null))?.result?.account_objects ?? []
      for (const e of escrows) md += `| Collateral escrow | \`${e.index}\` | owner ${acct(ev.escrow.owner)}, sequence ${ev.escrow.sequence}, \`FinishAfter ${e.FinishAfter}\`, \`CancelAfter ${e.CancelAfter}\` |\n`
    }
    md += `\n`

    if (vault) {
      md += `Vault state now: assets \`${vault.AssetsTotal ?? 0}\`, available \`${vault.AssetsAvailable ?? 0}\`, unrealised loss \`${vault.LossUnrealized ?? 0}\`.`
      if (vault.AssetsMaximum) md += ` Maximum \`${vault.AssetsMaximum}\`.`
      if (vault.SubscriptionDate) md += ` Subscription closes \`${vault.SubscriptionDate}\`, redemption opens \`${vault.RedemptionDate}\`, Ripple epoch.`
      md += `\n\n`
    }
    if (broker) md += `Broker: cover \`${broker.CoverAvailable ?? 0}\`, debt \`${broker.DebtTotal ?? 0}\`, ceiling \`${broker.DebtMaximum ?? 0}\`, cover rate \`${broker.CoverRateMinimum ?? 0}\` and liquidation rate \`${broker.CoverRateLiquidation ?? 0}\` in tenths of a basis point, management fee \`${broker.ManagementFeeRate ?? 0}\`.\n\n`
    if (loan) md += `Loan: flags \`${loan.Flags ?? 0}\`, principal \`${loan.PrincipalOutstanding ?? 0}\`, outstanding \`${loan.TotalValueOutstanding ?? 0}\`, interest rate \`${loan.InterestRate ?? 0}\`, next payment due \`${loan.NextPaymentDueDate ?? '—'}\`, grace \`${loan.GracePeriod ?? 0}\` seconds.\n\n`
    else if (ev.loanID) md += `Loan: deleted from the ledger once settled.\n\n`

    md += `### Transactions\n\n| Step | Result | Verified on chain | Link |\n|---|---|---|---|\n`
    for (const e of ev.events ?? []) {
      if (!e.hash) continue
      checked += 1
      const tx = await client.request({ command: 'tx', transaction: e.hash }).catch(() => null)
      const onchain = tx?.result?.meta?.TransactionResult
      const type = tx?.result?.tx_json?.TransactionType ?? tx?.result?.TransactionType ?? '?'
      const ok = onchain === e.code
      if (!ok) mismatched += 1
      md += `| ${e.step} | \`${e.code}\` | ${ok ? `yes, \`${type}\`` : `**MISMATCH: ledger says \`${onchain}\`**`} | ${txl(e.hash)} |\n`
    }
    md += `\n`
  }

  md += `---\n\n${checked} transactions re-verified against the ledger, ${mismatched} mismatch${mismatched === 1 ? '' : 'es'}.\n`
  fs.writeFileSync('docs/ON-CHAIN.md', md)
  console.log(`docs/ON-CHAIN.md written. ${checked} transactions verified, ${mismatched} mismatch(es).`)
  await client.disconnect()
  if (mismatched) process.exit(1)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
