# repo-hygiene — keep / fix / delete, every tracked file

Reviewer pass, 12 September 2026. Repository at `a45d5cd`, then `cce8bb3` (the tree moved twice
while I read it; every line number below was re-checked against `cce8bb3`).
`git ls-files` = 71 files, not 68.

My job was to find what is wrong. Nothing here is a compliment.

---

## 0. The three that actually cost points

### H-1 · The front end has no stylesheet. Every class name on both pages resolves to nothing.

`web/app/globals.css` is 49 lines and defines exactly four selectors: `html`, `body`, `*`, `a`.
It is the unmodified `create-next-app` default (`--background` / `--foreground`,
`font-family: Arial, Helvetica, sans-serif`). It has been touched by exactly one commit, `49caa01`,
the initial import (`git log --oneline -- web/app/globals.css`).

`layout.tsx`, `page.tsx` and `vault/[id]/page.tsx` between them use **33 distinct class names**:

```
page nav brand nav-links section row grid grid-2 grid-3 grid-4 eyebrow lede muted mono
card tile label value sub btn btn-primary badge badge-accent badge-positive badge-warn
badge-danger steps step step-n table-wrap num provenance
```

**Zero of them exist.** The landing page and the vault dashboard render as unstyled document flow on
white. `vault/[id]/page.tsx:135` also reads `var(--danger)`, which is not declared either.

`web/README.md` makes this worse. It says, in the present tense:

> `app/globals.css`. Every colour, radius, shadow, font and spacing step in the app is a variable
> declared at the top of this file.

and then tabulates "The class vocabulary — everything on both pages is built from these, **all
defined in `globals.css`**". That table is a specification for work that has not been done, written
as a description of work that has. Whoever picks up the handoff will change variables that do not
exist and see nothing change.

`docs/PLAN.md` line 2 of the to-do table lists the design pass as pending and prices it at "10% of
the score, and the dashboard is the demo surface". So the gap is known. The document that hands the
work over is the thing that is wrong: it describes the finished state as the current state.

**Fix:** write `globals.css` against the vocabulary the pages already use (it is a closed list of 33
classes plus `--danger`), and change `web/README.md`'s framing from "here is what exists" to "here is
the contract the pages expect". Until the CSS lands, the dashboard cannot be demoed.

### H-2 · The "live vault" the landing page links to is empty, expired, and still called Recall.

`web/lib/config.ts:15` pins `DEMO_VAULT = 6B79B084…D6D2C13C`. `web/app/page.tsx:70` puts it behind
the primary call to action, "Open the live vault".

Fetched from the public devnet just now:

```
Data:             "526563616C6C2064656D6F207661756C74"  → "Recall demo vault"
SubscriptionDate: 842540660   RedemptionDate: 842540960   (both hours in the past)
AssetsTotal / AssetsAvailable / LossUnrealized:  all absent → all read 0
share issuance 0000000146F9D925…:  OutstandingAmount "0"
```

So the page a judge lands on from the hero button shows: phase `redemption`, Assets total **0**,
Available liquidity **0**, Unrealised loss **0**, Price per share **—**, Utilisation **—**, and one
loan marked *paid off*. Every headline figure is zero or an em dash, and the on-chain `Data` field
carries the pre-rename product name, which is visible on `devnet.xrpl.org/vault/6B79…` too.

`docs/PLAN.md` item 7 says to refresh "the evidence file, the README transaction table and the
report". It does not mention `web/lib/config.ts`. That omission is how this survives to Sunday.

**Fix:** add `DEMO_VAULT` to the freeze checklist, and repoint it at whatever
`node scripts/demo.mjs provision` creates on the morning. Until then the landing page should not
advertise a live vault it drained.

### H-3 · `read-vault.mjs` still ships the share-price bug the developer report is built around.

The report's headline protocol finding, and F-013, is that `AssetsTotal / OutstandingAmount`
overstates the position because impairment writes into `LossUnrealized` and leaves `AssetsTotal`
alone. `web/lib/ledger.ts:121,127` was fixed in `ec7464f` and now computes
`nav = assetsTotal - lossUnrealized`.

`scripts/read-vault.mjs:44` was not:

```js
console.log(`  price per share   ${shares > 0 ? (assets / shares).toFixed(8) : 'n/a (0 share)'}  [AssetsTotal / OutstandingAmount, calcul client]`)
```

`README.md:106` lists that script as "the read path". `docs/AUDIT-CHECKLIST.md` §3 instructs the
reviewer to "Compare the figure on `/vault/<id>` against `node scripts/read-vault.mjs t2 <id>`. They
must agree to the last digit shown." On any vault with an impaired loan — i.e. on the exact state the
demo is built to show — they will not agree, and the script is the one that is wrong. The repository
ships a runnable demonstration of the bug it claims to have found, labelled as its read path.

`scripts/demo.mjs:134` has the same naive formula in the `state` verb, which is the command in the
printed runbook.

**Fix:** subtract `LossUnrealized` in both, and print the loss alongside so the arithmetic is visible.

---

## 1. Delete

| Path | Why |
|---|---|
| `web/app/favicon.ico` | byte-identical to the `create-next-app` default (`md5 c30c7d42707a47a3f4591831641e50dc`, matches every template under `create-next-app/dist/templates/*/app/favicon.ico`). The Next.js triangle is in the browser tab for the whole pitch. Replace, do not merely delete. |
| `scripts/experiments/mpt-vault-asset-2.mjs` `-3` `-4` `-5` | all four hardcode `CACHE = '/private/tmp/claude-501/-Users-fianso-Development-hackathons-patapim/8aa6c9a4-f1d0-41c5-ad64-3a3f5d140504/scratchpad/mpt-vault-asset-seeds.json'`, a session-scoped agent scratchpad. They cannot run on any other machine or after this session, and the path itself advertises the tooling. Referenced by no document. `-3` additionally hardcodes six object IDs from a run nobody can reproduce. Either delete, or keep only if §3 is done. |
| `scripts/experiments/mpt-vault.mjs` | superseded by `mpt-vault-asset.mjs` + `mpt-vault-lending.mjs`, asks the same question ("can a Single Asset Vault hold an MPT as its Asset?"), referenced nowhere, carries two unused imports. |
| `scripts/experiments/credentials-domains-vault-2.mjs`, `-3.mjs` | referenced by no document. `credentials-domains-vault.md` names only run 1. If their findings are in the note, the scripts are redundant; if they are not, the note is incomplete. |
| `scripts/experiments/mpt-vault-lending.mjs` | referenced nowhere; its content is the ancestor of `scripts/recall-spine.mjs`, which supersedes it entirely. |
| `docs/feedback/FRICTION-LOG.md:137` | stray `<!-- next items appended as they are hit -->` sitting between F-005 and F-006, mid-document. Scaffolding. |
| `docs/AUDIT-CHECKLIST.md:82-88` | see §2, S-1. Not the checklist item — the "Known and accepted" paragraph inside it. |
| `package.json` scaffolding fields | `"main": "index.js"` (no `index.js` exists), `"description": ""`, `"keywords": []`, `"author": ""`, and `"scripts": {"test": "echo \"Error: no test specified\" && exit 1"}`. A judge who types `npm test` in a submission repository gets a deliberate failure. |

Seven of the fifteen files in `scripts/experiments/` are referenced by no document at all:
`credentials-domains-vault-2`, `-3`, `mpt-vault-asset-2` through `-5`, `mpt-vault-lending`,
`mpt-vault`.

---

## 2. Fix

### S-1 · The audit checklist publicly signposts the devnet seeds left in the git history.

`docs/AUDIT-CHECKLIST.md:82-88`:

> **Known and accepted:** two research notes captured faucet responses verbatim and were redacted in
> the working tree. The superseded commits still carry those strings.

Verified: `git log --all` shows seed strings in `49caa01` and `82f68dd`, both pushed to the public
repository. Leaving throwaway devnet seeds in history is a defensible call. Publishing a paragraph
in the same repository that tells a reader they are there, and in which commits, is not — it
converts an obscure residue into a signposted one, in the one document a security-minded judge will
read most carefully. Keep the decision, delete the roadmap to it.

### S-2 · `docs/CONTRIBUTION-explorer-search.md` "The change" describes a plan that did not ship.

The section is written as five numbered future-tense items. Against the actual branch
(`/tmp/explorer`, `8c361b5`, `git diff origin/main...HEAD`):

| Doc says | What shipped |
|---|---|
| 1. "Add two lookups to `determineHashType`: `getLoanBroker`, and a loan lookup by ledger entry index" | one `getLedgerEntry` switched on `LedgerEntryType`, plus a `getLoanBroker` hop for loans only |
| 3. "Route both to the existing vault page, **deep linking the broker tab** so the object the user pasted is the one in view" | **not implemented.** `Search.tsx:123-126` builds a bare `VAULT_ROUTE`. No tab parameter anywhere in the diff. |
| 5. "Tests next to the existing `getLoanBroker` cases" | tests are in `src/containers/Header/test/Search.test.js`, not beside the `rippled.test.ts` cases |

Item 3 is the one that matters: it is a user-visible promise the PR does not keep, sitting in a
document that links to the PR. Rewrite the section in the past tense against the diff, and either
implement the deep link or move it to a "not in this PR" line.

Related, `DEVELOPER-REPORT.md`, last section: "The fix replaces the vault lookup with a single
`ledger_entry` call switched on `LedgerEntryType`, **so the request count is unchanged**". True for a
Vault and a LoanBroker. For a Loan it is one call more, because `Search.tsx:60` chains
`getLoanBroker` to find the parent vault. Say "unchanged for vaults and brokers, one extra hop for a
loan" and the claim survives contact with the diff.

### S-3 · The default-arc evidence files label their impairments backwards.

`docs/evidence/default-arc-cover100000.json` and `…10000.json`, which `README.md` cites as the proof
of the default arc, both contain:

```
"step": "LoanManage impair (too early)",  "code": "tesSUCCESS"
"step": "LoanManage impair",              "code": "tecNO_PERMISSION"
```

The labels come from `scripts/default-arc.mjs:111` (`'LoanManage impair (too early)'`, message
`'impair before the grace period ends'`) and `:114` (`'agent impairs the loan'`). They were written
before F-015 pinned the boundary — commit `3b07635`, "impairment unlocks at the due date and ignores
the grace period". The script now fires the first impair at `NextPaymentDueDate + 5`, which succeeds
because that is the real precondition, and the second after the grace period, which fails with
`tecNO_PERMISSION` because the loan is already impaired.

The behaviour is right and it is exactly what the report claims. The labels say the opposite. A judge
who opens the evidence file reads "too early → succeeded" then "impair → no permission" and
concludes the run failed. `README.md` compounds it by citing hash `5227A096…` as "`LoanManage`
impair" while the evidence file calls that same hash "(too early)".

**Fix:** rename the two steps to `LoanManage impair (at due date, grace still running)` and
`LoanManage impair (already impaired)`, re-run, or hand-edit the two JSON labels and say so.

### S-4 · `ripple-binary-codec` and `ripple-keypairs` are imported but not declared.

`scripts/lib/lending.mjs:7-8` imports both directly. `package.json` declares only
`{"xrpl": "^5.2.0-beta.0"}`. They resolve today purely because npm hoists xrpl's transitive
dependencies to the top of `node_modules`. Under pnpm's default strict layout, Yarn PnP, or any
future npm hoisting change, `node scripts/recall-spine.mjs` fails at import on a clean clone —
which is the first command in the README and in `docs/AUDIT-CHECKLIST.md` §6.

Both are named as part of the declared environment in `README.md` and `DEVELOPER-REPORT.md`
(`ripple-binary-codec@2.11.0`), so declaring them is also the honest thing. `README.md:102`'s
"`npm install` — xrpl.js@5.2.0-beta.0, nothing else" is then wrong and should say what it pins.

### S-5 · Half the script output is in French.

`web/README.md` states the convention: "Copy is English, the audience is the jury." The scripts
break it, and `read-vault.mjs` is the one the README tells a reviewer to run:

| file:line | string |
|---|---|
| `scripts/read-vault.mjs:23` | `vault introuvable:` |
| `scripts/read-vault.mjs:29,30,31,32,34` | `(champ absent)` ×5 |
| `scripts/read-vault.mjs:41,52` | `(illisible: …)` |
| `scripts/read-vault.mjs:44,45` | `calcul client` |
| `scripts/read-vault.mjs:60` | `=== OBJETS DU PROPRIETAIRE ===` |
| `scripts/read-vault.mjs:71` | `=== APPELS RPC UTILISES ===` |
| `scripts/recall-spine.mjs:151` | `écrit: docs/evidence/recall-t2.json` |
| `scripts/default-arc.mjs:130` | `écrit: docs/evidence/default-arc.json` |
| `scripts/experiments/open-vault-both-nets.mjs:19` | `fee payé:` |

`open-vault-both-nets.mjs` is the script `docs/AUDIT-CHECKLIST.md` §1 hands to an external reviewer
to reproduce finding 3.

### S-6 · `default-arc.mjs:130` prints a filename it did not write.

```js
fs.writeFileSync(`docs/evidence/default-arc-cover${COVER_RATE}.json`, …)   // :129
console.log('\nécrit: docs/evidence/default-arc.json')                      // :130
```

Copy-paste leftover from before the cover-rate parameter existed. Anyone following the run output
looks for a file that is not there.

### S-7 · `vaultData()` is a dead branch: no script writes JSON into `Data`.

`web/lib/ledger.ts:167-175` (added in `cce8bb3`) parses the vault's `Data` field as JSON and returns
`{n, term_days, note}`. `web/app/vault/[id]/page.tsx:171-178` renders a "**N** day term, compressed
to Xm Ys for this demonstration" block when `meta.term_days` is set.

Every `VaultCreate` in the repository writes a plain string:

```
scripts/recall-spine.mjs:78   Data: hex('patapim demo vault')
scripts/demo.mjs:71           Data: hex('patapim')
scripts/default-arc.mjs:64    Data: hex('patapim default arc')
scripts/probe-t2.mjs:27       Data: hex('patapim closed')
scripts/probe.mjs:14          Data: hex('patapim open')
```

`JSON.parse('patapim demo vault')` throws, the `catch` returns `{}`, `meta.term_days` is undefined,
the block never renders. The comment above the function says "The brief asks for that duration to be
modelled somewhere; modelling it on chain means the dashboard reads it rather than inventing it" —
which is the right idea, executed on only one of the two sides. Either make `demo.mjs` write
`hex(JSON.stringify({n:'patapim T-Bill lending vault', term_days: 30}))`, or drop the function and
the block. Shipping the reader without the writer is worse than shipping neither.

### S-8 · `probe-t2.mjs` decides phases on the wall clock, and the README recommends it.

`scripts/recall-spine.mjs:14-16` carries the lesson as a comment:

> Vault phases are compared against the PARENT LEDGER CLOSE TIME, not the wall clock of the machine
> submitting. Deriving the dates from `Date.now()` and then waiting on `Date.now()` is how you end up
> submitting into the phase you thought you had left.

`probe-t2.mjs` does exactly that. `:20` `const base = nowRipple()` — and `nowRipple()` is
`Math.floor(Date.now()/1000) - RIPPLE_EPOCH` (`scripts/lib/lending.mjs:26`). `:56-58`:

```js
const waitUntil = async (sec, label) => {
  const target = t0 + sec * 1000
  while (Date.now() < target) { await sleep(5000) }
```

`README.md:105` lists it as a thing to run, and it is the script the README cites as the home of the
two phase-gate rejections not present in `recall-t2.json`. `docs/AUDIT-CHECKLIST.md` §2 tells the
reviewer to `grep -rn "Date.now\|new Date()" scripts/ web/lib/` and says "Every phase comparison must
read `ledger.close_time`. This already cost us one full run." That grep fails on the team's own
script. Either port it to `ledgerNow`/`waitLedger` (both already written, in `recall-spine.mjs` and
`default-arc.mjs`), or note in the README that it is a wall-clock probe and may drift.

Sidenote: `ledgerNow` and `waitLedger` are copy-pasted three times, verbatim, across
`recall-spine.mjs:17-23`, `default-arc.mjs:18-23` and `demo.mjs:27`. They belong in
`scripts/lib/lending.mjs` next to `nowRipple`, which would also make the wall-clock helper the odd
one out instead of the default.

### S-9 · The F-001 reproduction command does not exist.

`docs/feedback/FRICTION-LOG.md:23`: "Repro, custom hackathon devnet, `scripts/probe.mjs t1 open`".
`scripts/probe.mjs:5` reads `const key = process.argv[2] ?? 't1'` and nothing else from `argv`.
There is no `open` argument and no library-version switch, so the command as written cannot produce
the two-row comparison table that follows it. `docs/AUDIT-CHECKLIST.md` §1 asks a reviewer to
"reproduce [finding 1] from the report alone".

**Fix:** `node scripts/probe.mjs t1`, plus the sentence that says to swap the installed `xrpl`
version between the two runs.

### S-10 · Dead code

| file:line | what |
|---|---|
| `scripts/recall-spine.mjs:10` | `nowRipple` imported, never called |
| `scripts/recall-spine.mjs:30-31` | `const t0` / `const el` — `el()` is never called (it is in `probe-t2.mjs`, which is where this was copied from) |
| `scripts/default-arc.mjs:9` | `tfLoanUnimpair: 262144` never used |
| `scripts/default-arc.mjs:111` | `expect` is `'REJECT_OR_OK'`, which no result code can equal, so `submit()` always prints `DIFF` for that line even when it behaves correctly |
| `scripts/experiments/mpt-vault.mjs:11` | `Client`, `Wallet` imported, unused |
| `scripts/experiments/credentials-domain.mjs:18` | `Wallet` imported, unused |
| `scripts/experiments/credentials-domains-vault.mjs:30` | `nowRipple` imported, unused |
| `scripts/experiments/batch-delegation-escrow.mjs:7` | `Client` imported, unused; `e31` assigned, unused |
| `scripts/experiments/mpt-vault-asset-3.mjs:8`, `-4.mjs:6` | `hex`, `sleep` imported, unused |
| `scripts/lib/lending.mjs:65` | `signCounterparty` is exported but consumed only by `submitLoanSet` in the same file. Keeping the export is right — `README.md` and finding 1 both point at it by name — but it is the only export with no external caller and should not be mistaken for an API. |

### S-11 · Build noise and stock config

- `npx next build` prints: *"We detected multiple lockfiles and selected … `/patapim/package-lock.json`
  as the root directory. Detected additional lockfiles: `/patapim/web/package-lock.json`"*. Both
  lockfiles are legitimate (two separate projects). Set `turbopack: { root: __dirname }` in
  `web/next.config.ts`, which is otherwise still the stock file with `/* config options here */`
  as its entire body.
- `web/app/globals.css` retains the scaffold's `--background`/`--foreground` and
  `font-family: Arial, Helvetica, sans-serif`.
- Verified clean: `npx tsc --noEmit` exits 0, `npx next build` succeeds, `node --check` passes on all
  21 `.mjs` files, no `TODO`/`FIXME`/`XXX` anywhere, no live seed strings in the working tree.

### S-12 · The developer report has grown past its own stated budget.

`docs/AUDIT-CHECKLIST.md` §6 says the report "is currently around 1760 words across four tables,
which is close to the limit". It is now **1937 words / 179 lines**. The brief caps it at three pages.
The checklist already names the cut: "cut the *Smaller things, one line each* table first: it is the
only section whose items are also filed through the event hook, so nothing is lost." Take the advice,
and update the word count in the checklist so it stops under-reporting.

### S-13 · The old product name survives in the two most-linked artefacts.

`580919b` renamed the product to patapim. Still called Recall:

- `scripts/recall-spine.mjs` — the flagship script, named in `README.md:104`, `web/README.md:23` and
  `web/lib/config.ts:14`
- `docs/evidence/recall-t2.json` — the evidence file cited in `README.md:41`, `SUBMISSION.md:10` and
  `docs/PLAN.md:10`
- the on-chain `Data` of the live demo vault (H-2)
- `KYC = hex('recall.eligible.v1')` in four experiment scripts, versus `patapim.eligible.v1` in the
  five current ones

Renaming the two files costs one `git mv` and four sed edits and removes the "this was something else
last week" read. It is cosmetic; it is also the first thing a judge sees in `README.md`'s Run-it block.

---

## 3. `docs/research/` — 660 KB, 17 files, no way in

Sizes: `xls66-spec.md` 53 KB, `lending-demo.md` 55 KB, `xls65-spec.md` 51 KB, `rippled-source.md`
49 KB, down to `tooling-gap-and-contribution.md` 18 KB. Total 660 KB, ~9,700 lines.

The content is good. `tooling-gap-and-contribution.md` §0 is the reasoning behind the explorer PR and
is the single best argument in the repository for why that PR and not another one. `devnet-recon.md`
§0 is the two-network finding before it became F-011. `docs-audit.md` is a full audit of the docs
portal at a named commit. This is not filler.

But nothing points into it. `README.md:122` gives it one line — "the sourced notes behind the
report" — and no document anywhere cites an individual note. `DEVELOPER-REPORT.md` cites transaction
hashes and rippled PRs, never a research file. `docs/feedback/FRICTION-LOG.md` cites none either. The
only other mention is `docs/AUDIT-CHECKLIST.md:83`, telling a reviewer to grep it for seeds.

So a judge on a four-minute budget meets a directory of seventeen 30-to-55 KB files with no index,
opens one at random, and reads 900 lines of C++ line references. That reads as volume, not rigour,
which is the opposite of what it is.

**Keep it — and add `docs/research/README.md`**, one table, seventeen rows, three columns: file, the
one question it answers, and the finding it produced. Roughly:

| note | the question | what came out |
|---|---|---|
| `tooling-gap-and-contribution.md` | what is worth contributing back, and why that one | ripple/explorer#1342 |
| `devnet-recon.md` | which network enforces which lending semantics | F-011, report finding 3 |
| `xrpljs-sdk.md` | does the mandated SDK work | F-001/F-002, report findings 1 and 2 |
| … | | |

Half a page, and 660 KB stops being noise. Also fix, while you are there, `rippled-source.md:7` and
`devnet-recon.md:533`, which cite
`/private/tmp/claude-501/-Users-fianso-Development-hackathons-patapim/8aa6c9a4-…/scratchpad/` as the
location of their evidence: a session-scoped agent scratchpad that no reader can reach, presented as
a working directory.

Add `scripts/experiments/README.md` on the same principle — one line per script saying which finding
it established and, where it applies, that it is a record of a run and not a runnable file.

---

## 4. Keep, despite looking superfluous

- **`docs/PLAN.md`** — an internal to-do list in a public repository, naming both members and what is
  unfinished. It reads as candour rather than mess, and the demo-minute-by-minute block plus the risk
  table are genuinely the best evidence that the four minutes were designed rather than improvised.
  Keep it. It must be true at 12:30 though: today it still lists the design pass and the slides as
  open, which is fine now and will be an own goal at 13:00.
- **`docs/AUDIT-CHECKLIST.md`** — the only document in the repository written to disprove the
  submission. Keep it, minus the paragraph in §2/S-1.
- **`docs/feedback/FRICTION-LOG.md`** — 20 KB, and a superset of the report it generates. It is the
  proof the report is a distillation rather than a retrospective invention, and the timestamps and
  raw output belong here rather than in a three-page deliverable. Keep. One repair: **F-004 is
  wrong**, and is corrected sixteen hundred words later by F-011 ("**This corrects our earlier report
  F-004**"). F-004 itself carries no forward pointer, so a top-down reader meets the wrong conclusion
  first and may never reach the right one. Add one bold line under the F-004 heading:
  *superseded by F-011*.
- **`scripts/probe.mjs`** — targets Track 1 by default and is absent from the README's Run-it block,
  so it looks orphaned. It is the F-001 repro (`docs/feedback/FRICTION-LOG.md:23`), i.e. the source of
  the single strongest finding in the report. Keep, and fix the command in the log per S-9.
- **`scripts/experiments/open-vault-both-nets.mjs`** — 27 lines, no `main()`, top-level await in a
  loop. Looks like a scratch file. It is the reproduction the audit checklist hands to an external
  reviewer for report finding 3. Keep; just de-French line 19.
- **`docs/evidence/explorer-search-loan-not-found.jpg`** — 28 KB binary in a code repo. It is the
  only artefact proving the explorer gap was reproduced on the live devnet rather than read out of
  the source. Keep.
- **`web/package-lock.json` alongside the root one** — two lockfiles is a smell, but `web/` is a
  genuinely separate npm project with its own `package.json` and its own build. Keep both; silence
  the Next warning per S-11.
- **`scripts/experiments/batch-delegation-escrow*.mjs` (3 files)** — numbered variants that look like
  iterations. They are: each header states what the previous run left open, and all three are cited
  by `docs/research/batch-delegation-escrow.md`. They are the evidence behind the report's
  delegation finding ("Fifteen `DelegateSet` attempts, fifteen `temMALFORMED`"), which is the one
  the report calls "the single biggest custody blocker in XLS-66 today". Keep all three.
- **`scripts/experiments/credentials-domain.mjs` vs `credentials-domains-vault.mjs`** — two files
  whose names differ by one letter, on two different networks (t2 and t1 respectively), both cited by
  `docs/research/credentials-domains-vault.md`. Confusing, not redundant. Keep; consider renaming the
  first to `credentials-domain-t2.mjs`.

---

## 5. Verification log

```
git ls-files | wc -l                      → 71
node --check on all 21 .mjs               → all pass
cd web && npx tsc --noEmit                → exit 0
cd web && npx next build                  → success, 3 routes, multiple-lockfile warning
md5 web/app/favicon.ico                   → c30c7d42707a47a3f4591831641e50dc
  == create-next-app/dist/templates/{app,app-tw,default,default-tw}/{js,ts}/**/favicon.ico
git grep -nE "sEd[A-Za-z0-9]{27,}"        → nothing in the working tree
git log --all, per-commit grep            → seeds present in 49caa01 and 82f68dd
ledger_entry 6B79B084…D6D2C13C            → Data "Recall demo vault", no AssetsTotal, dates past
ledger_entry mpt_issuance 0000000146F9…   → OutstandingAmount "0"
ledger_entry A7920C44…F54165              → Loan still present, PeriodicPayment 1000000.142695042164
ledger_entry 055FDE07…D0BE9F              → LoanBroker present, CoverAvailable 500000
/tmp/explorer git diff origin/main…HEAD   → 3 files, +84/-21, no broker-tab deep link
```
