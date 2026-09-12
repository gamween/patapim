// Builds docs/ON-CHAIN.md: every account and every ledger object we created, with explorer links,
// and verifies that every recorded transaction still resolves with the type and result we claim.
// Run it after any spine or arc run:  node scripts/gen-onchain-inventory.mjs
import fs from 'node:fs'
import { Client } from 'xrpl'

const WSS = 'wss://s.devnet.rippletest.net:51233/'
const EX = 'https://devnet.xrpl.org'
const RUNS = [
  ['recall-t2.json', 'Flagship lifecycle', 'subscription, gated deposit, loan of securities, the three phase rejections, redemption'],
  ['default-arc-cover100000.json', 'Default arc, full indemnity', 'the cover absorbs the whole loan, the lenders are untouched'],
  ['default-arc-cover10000.json', 'Default arc, ten percent cover', 'the same default at a ten percent cover rate, where the lenders take the loss'],
  ['standing-demo.json', 'Standing demo vault', 'the live vault the landing page advertises, left in Investment with a drawn loan'],
]

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
    md += `| Transfer agent, issues the security | ${acct(iss?.Issuer)} |\n`
    md += `| Lending agent, owns the vault and the broker | ${acct(vault?.Owner)} |\n`
    if (loan?.Borrower) md += `| Borrower, the market maker | ${acct(loan.Borrower)} |\n`
    md += `| Vault pseudo-account, holds the pooled securities | ${acct(vault?.Account)} |\n`
    md += `| Loan broker pseudo-account, holds the loans | ${acct(broker?.Account)} |\n\n`

    md += `### Ledger objects\n\n| Object | Id | What it is |\n|---|---|---|\n`
    md += `| Tokenised security, MPT | \`${ev.SEC}\` | the vault asset, require-auth |\n`
    md += `| Permissioned domain | \`${ev.domainID}\` | the eligibility gate |\n`
    md += `| Vault | [\`${short(ev.vaultID, 12)}\`](${EX}/vault/${ev.vaultID}) | closed-ended, \`VaultKind 1\` |\n`
    md += `| Vault shares, MPT | \`${vault?.ShareMPTID ?? '—'}\` | the lender position${shares?.OutstandingAmount ? `, ${shares.OutstandingAmount} outstanding` : ''} |\n`
    md += `| Loan broker | \`${ev.brokerID}\` | the lending agent |\n`
    if (ev.loanID) md += `| Loan | \`${ev.loanID}\` | the loan of securities |\n`
    md += `\n`

    if (vault) {
      md += `Vault state now: assets \`${vault.AssetsTotal ?? 0}\`, available \`${vault.AssetsAvailable ?? 0}\`, unrealised loss \`${vault.LossUnrealized ?? 0}\`.`
      if (vault.SubscriptionDate) md += ` Subscription closes \`${vault.SubscriptionDate}\`, redemption opens \`${vault.RedemptionDate}\`, Ripple epoch.`
      md += `\n\n`
    }
    if (broker) md += `Broker: cover \`${broker.CoverAvailable ?? 0}\`, debt \`${broker.DebtTotal ?? 0}\`, ceiling \`${broker.DebtMaximum ?? 0}\`, cover rate \`${broker.CoverRateMinimum ?? 0}\` parts per 100000.\n\n`
    if (loan) md += `Loan: flags \`${loan.Flags ?? 0}\`, outstanding \`${loan.TotalValueOutstanding ?? 0}\`.\n\n`

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
  console.log(`docs/ON-CHAIN.md écrit. ${checked} transactions vérifiées, ${mismatched} divergence(s).`)
  await client.disconnect()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
