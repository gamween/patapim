// Regenerates the transaction table in README.md from docs/evidence/recall-t2.json, so the hashes
// on the page can never drift from the hashes on the chain. Run it after every spine run.
//   node scripts/gen-evidence-table.mjs
import fs from 'node:fs'

const ROLE = {
  MPTokenIssuanceCreate: 'the tokenised security, require-auth so the transfer agent keeps control',
  PermissionedDomainSet: 'the eligibility whitelist the vault carries on its share issuance',
  VaultCreate: 'the fixed-term lender pool, `VaultKind: 1`, asset is the security, gated by `DomainID`',
  'VaultDeposit lender': 'an eligible holder subscribes',
  'VaultDeposit mm (gated)': 'a holder with no credential is refused by the domain',
  LoanBrokerSet: 'the lending agent, with its debt ceiling and cover rates',
  CoverDeposit: 'first-loss capital, posted in the security',
  'VaultDeposit after close': 'the subscription window has closed, the phase gate fires',
  'VaultWithdraw during Investment': 'capital is locked for the term, the second phase gate',
  LoanSet: 'the loan of securities, agent signs, borrower counter-signs',
  'EscrowCreate collateral': 'the borrower posts XRP in escrow to the agent, reclaimable after CancelAfter',
  'LoanPay full': 'the borrower returns the securities with the interest, in full',
  'EscrowCancel collateral': 'the borrower recovers the collateral after CancelAfter',
  'LoanSet in redemption': 'new lending refused once redemption opens, the third phase gate',
  'VaultWithdraw by shares': 'the lender redeems, denominated in shares',
}

const ev = JSON.parse(fs.readFileSync('docs/evidence/recall-t2.json', 'utf8'))
const rows = ev.events
  .filter((e) => e.hash)
  .map((e) => {
    const first = e.step.split(' ')[0].replace(/[^A-Za-z]/g, '')
    const tx = first === 'CoverDeposit' ? 'LoanBrokerCoverDeposit' : first
    const role = ROLE[e.step] ?? e.step
    const short = e.hash.slice(0, 8)
    return `| \`${tx}\` | ${role} | \`${e.code}\` | [\`${short}\`](https://devnet.xrpl.org/transactions/${e.hash}) |`
  })

const table = [
  '| Transaction | Role in patapim | Result | Hash |',
  '|---|---|---|---|',
  ...rows,
].join('\n')

const START = '<!-- evidence:start -->'
const END = '<!-- evidence:end -->'
let readme = fs.readFileSync('README.md', 'utf8')
if (!readme.includes(START)) {
  console.error(`README.md has no ${START} marker. Add the markers around the table first.`)
  process.exit(1)
}
readme = readme.replace(
  new RegExp(`${START}[\\s\\S]*?${END}`),
  `${START}\n\n${table}\n\n${END}`,
)
fs.writeFileSync('README.md', readme)
console.log(`README.md: ${rows.length} transactions written from docs/evidence/recall-t2.json`)
console.log(`vault ${ev.vaultID}`)
