# ACTION-LIST — adjudicated, ordered, to the 12:30 freeze

Reviewer: adjudication round. Baseline: **`feed7cc`** (HEAD). Every reviewer above worked against
`a45d5cd`, `cce8bb3` or `a0f00a9`. **Several of their blockers are already fixed.** Everything below
was re-verified by me against HEAD, the live ledger, live xrpl.org, or the explorer source — not
against another reviewer's note.

---

## 0. The one-line verdict

The PR is relevant and should ship. The build clears the Track 2 minimum bar on chain. **The two
things that will actually cost us points are (a) the developer report proposes adding two things to
xrpl.org that are already on xrpl.org, on the two pages the brief itself hands us as Resources, and
(b) there is no slide deck and no stylesheet.** Everything else is an hour of text edits.

---

## 1. Where a reviewer was TOO GENEROUS — re-verified myself

### 1.1 "The gap is real, keep the PR" — holds, and is stronger than they argued
`pr-refute` and `pr-regression` rested the relevance claim partly on a browser click. I proved it
from the source instead, which is what a maintainer will check:

- `git show origin/main:src/containers/Header/Search.tsx` — `determineHashType` builds exactly four
  lookups: `getTransaction`, `getVault`, `getLedger`, `getNFTInfo`. A LoanBroker/Loan id is a
  256-bit hash, so it enters `HASH256_REGEX`, all four reject, `type === null`, and it routes to
  `SEARCH_RESULT_ROUTE`.
- `/tmp/explorer/src/rippled/lib/rippled.ts:888` — `if (resp.node?.LedgerEntryType !== 'Vault')
  throw new Error('Not a Vault', 404)`. Merged as #1320.
- Live RPC: `055FDE07…D0BE9F` → `LoanBroker`, `VaultID 6B79B084…`; `A7920C44…F54165` → `Loan`,
  `LoanBrokerID 055FDE07…`. The parent chain is intact.
- `gh pr view 1342` → OPEN, MERGEABLE, 2 commits, `REVIEW_REQUIRED`, not draft.

**The developer's fear is unfounded. There is no misunderstanding. Keep the PR.**

### 1.2 "All hashes verify" — holds for the flagship, and the yield finding is understated
I re-pulled the four hashes that carry the product claim. They validate. But the metadata is
sharper than anyone wrote:

`LoanPay FD3E8AE8…` declares `Amount 2000001`. On chain:
borrower `rK22Ct…` 11,900,000 → 9,900,000 (**−2,000,000**), vault pseudo-account `rDyMktFPL…`
3,000,000 → 5,000,000 (**+2,000,000**), `AssetsTotal` **unchanged at 5,000,000**,
`DebtTotal` 2,000,000 → 0.

**Exactly 2,000,000 moved. The declared extra unit moved nowhere — not to the vault, not to the
broker.** DEVELOPER-REPORT.md:102 says "our loan repaid 2000001 on 2000000", which overstates the
yield by the only unit there was. The true statement is better and free: *the ledger accepted a
LoanPay declaring 2,000,001, settled 2,000,000, and closed the debt.* Use it.

### 1.3 "web/lib/ledger.ts is correct" — holds, and it is now the only correct one
`web/lib/ledger.ts:121,127` genuinely computes `nav = assetsTotal - lossUnrealized` and
`pricePerShare = nav / sharesOutstanding`. Confirmed. But `scripts/read-vault.mjs:44`,
`scripts/demo.mjs:134` and `scripts/default-arc.mjs:86` all still ship the naive formula at HEAD.
That is why `docs/evidence/default-arc-*.json` records `"pricePerShare": "1.00000000"` at the
`impaired` state, and why **README.md:90 prints `1.00` in the impaired row** — the exact number the
report's second headline finding calls a bug, three sections above the finding.

### 1.4 "The product is not easy" — holds, verified against Ripple's own reference app
Cloned `ripple/xrpl-reference-app-lending-sav` fresh: **zero** occurrences of `VaultKind`,
`SubscriptionDate`, `RedemptionDate`, `PermissionedDomain`; pins `xrpl ^4.6.0`. Track 2 plus the
Loaded eligibility leg cannot be forked from it. This claim is safe to make in the pitch.

### 1.5 "Both networks, identical amendments" — FALSE, and everyone hedged differently
Live `feature` RPC, today: **public devnet 89 enabled, custom hackathon devnet 48**. Custom is a
**strict subset**. The 41 extras are all pre-2023 retired amendments (`Checks`, `Clawback`,
`DepositAuth`, `Flow`, `NegativeUNL`, `TicketBatch`, `fix1513`…`fixUniversalNumber`).
All eleven lending-relevant amendments (`LendingProtocol`, `LendingProtocolV1_1`, `SingleAssetVault`,
`MPTokensV1`, `PermissionedDomains`, `Credentials`, `fixCleanup3_4_0`, `TokenEscrow`, `Sponsor`,
`PermissionDelegationV1_1`, `BatchV1_1`) are enabled on **both**.

The finding survives intact; only the sentence is wrong — and it contradicts itself two lines
earlier (`:65` "TicketBatch also differs" vs `:67` "the amendment set is identical").

---

## 2. Where a reviewer was TOO HARSH, WRONG, or STALE — **do not spend a minute on these**

| Claim | Reviewer | Status |
|---|---|---|
| "The rejected `VaultWithdraw` during Investment is in no submission artefact" (**blocker**) | kpi-track2, kpi-deliverables | **STALE — already fixed.** README.md:55 carries it (`tecTOO_SOON`, `2541A17D…`) and `recall-t2.json` has 14 events including `VaultWithdraw during Investment`. Minimum-bar item 05 is fully discharged in the table. |
| "`vaultData()` is a dead branch, no script writes JSON `Data`" | repo-hygiene | **STALE.** Live vault `1D5C0C8E…` `Data` decodes to `{"n":"patapim","term_days":90,"note":"demo compresses a 90 day term"}`. The term block renders. |
| "DEMO_VAULT is `6B79B084…`, on-chain name still 'Recall demo vault'" | repo-hygiene, non-trivial | **STALE id.** It is `1D5C0C8E…` at HEAD and the branding is fixed. *The substance still holds* — see 3.1. |
| "`sent.jsonl` has 15 items, F-016 unfiled" / "22 submitted, 14 filed" | doc-consistency, kpi-deliverables, PLAN.md | **STALE.** `grep -c '"kind":"feedback"' .xrpl-devex/sent.jsonl` → **17**; friction log has **F-001…F-017**. They match. |
| "The `LoanSet` refused during Subscription has no evidence" | kpi-deliverables | **WRONG.** `scripts/probe-t2.mjs:54` submits it and records it. README.md:64-66 is accurate. No hash is published, which is a nit, not a gap. |
| "Run a `Sponsor` / fee-sponsorship transaction tonight" | amendment-coverage | **DO NOT.** Fresh spine required, best case one more hash on a bonus primitive, worst case a `temINVALID_FLAG` we already have three of. |
| "Add `CloseInterestRate` to manufacture yield" | non-trivial | **DO NOT.** Its settlement target is unverified (the reviewer says so), it needs a full rerun, and it risks trading a *measured, honest* finding for a number we cannot explain under Q&A. |
| "Rename `recall-spine.mjs` → `patapim-spine.mjs`" | repo-hygiene | **DO NOT.** Touches README, SUBMISSION, PLAN, web/README and config.ts for zero points, hours before freeze. |
| "Report is 5 pages" | kpi-deliverables | **CORRECT** — independently estimated 5.2 A4 pages (252 rendered lines at 48/page, 2,149 words, 4 tables). Act on it. |

---

## 3. Contradictions between reviewers, resolved

**3.1 Is DEMO_VAULT live or drained?** Drained. `ledger_entry 1D5C0C8E…` today returns **no
`AssetsTotal`, no `AssetsAvailable`**, `RedemptionDate 842550010` (past). The lender withdrew all
5,000,000 (`1C206948…`). A judge clicking the hero CTA sees zeros. repo-hygiene is right on
substance, wrong on the id. **Must be re-provisioned Sunday morning.**

**3.2 Which cover rate is the flagship at?** `scripts/recall-spine.mjs:93` → `CoverRateMinimum:
10000` (**10%**), cover deposit `500000`. README.md:101-102 says "it is why this vault is configured
at one hundred percent". **The sentence is false.** kpi-track2 and doc-consistency are right.

> **Trap nobody spotted.** The obvious fix — set `:93` to `100000` — **breaks the flagship run**.
> At 100% a 2,000,000 loan requires 2,000,000 of cover and only 500,000 is posted, so the `LoanSet`
> fails and the whole lifecycle dies. It is a **two-line** change: `CoverRateMinimum: 100000` **and**
> the cover deposit `'500000'` → `'2500000'` (the agent holds 10,000,000 TBL; `default-arc.mjs`
> already proves 2,500,000 works at 100%).

**3.3 Pitch length, 4+2 or 5+3?** **4+2.** Both Notion prints say it twice each (agenda table and
submission section); only the Ripple deck says 5+3, and that deck defers to the Notion twice
("All information is in the Notion"). Build the 4-minute cut. kpi-deliverables is right.

**3.4 Are the evidence impair labels backwards?** Yes, in **both** files. `"LoanManage impair (too
early)"` → `tesSUCCESS`, then `"LoanManage impair"` → `tecNO_PERMISSION`. Source:
`scripts/default-arc.mjs:111` and `:114`. All three reviewers agree; confirmed at HEAD.

---

## 4. The single most likely markdown nobody named

**The report fails the mechanical conformance checklist the brief publishes for it — and that
checklist governs the 40% criterion.**

Both Notion prints, identically:

> "For each issue, capture the **category, title, description, repro steps or relevant
> transaction/code link, severity, library and version.** Categories are **client libraries, UX,
> missing primitive, documentation/tutorials, or other.**"

Measured against `DEVELOPER-REPORT.md` at HEAD:

- **Severity: absent from every finding.** `grep -niE "severity|severe|critical|blocker"` returns
  **one** hit, and it is the prose phrase "the single biggest custody blocker" at :165.
- **Category: present on 9 of roughly 26 findings** — only the "Smaller things" table has the
  column. Of those nine, **six say `protocol` and one says `infrastructure`, and neither label
  exists in the brief's taxonomy.** Only `client libraries` and `documentation` map.
- The three numbered findings and all seven essays carry **no category and no severity at all**.

And the compounding one, under a criterion that says in the deck *"Proposals score above flagging"*:

- **The delegation finding is the only essay in the report with no `*Proposal:*` line** —
  `DEVELOPER-REPORT.md:160-165`, verified. It is the finding the report itself calls *"the single
  biggest custody blocker in XLS-66 today"*. **We flag our strongest finding and propose nothing.**

A rubric-driven judge marks the mandatory 40% deliverable non-conformant on page count, category
taxonomy and severity **before scoring a word of content**. Two of those three nobody above named.
Total cost to fix: under an hour.

---

## 5. ORDERED ACTION LIST

Assume ~4.5h tonight and ~4.5h Sunday 08:00–12:30, two people. **Tracks A and B run in parallel.**

### TRACK A — Armand. Presentation: 10% + a named submission deliverable.

| # | Action | Effort |
|---|---|---|
| **A1** | **`web/app/globals.css`.** It is still the untouched create-next-app default — 49 lines, four selectors — while the pages use **33 class names, none defined**, plus an undeclared `var(--danger)` at `vault/[id]/page.tsx:135`. Write against the closed list: `page nav nav-links brand btn btn-primary card grid grid-2 grid-3 grid-4 tile label value num sub mono muted eyebrow lede section row steps step step-n badge badge-accent badge-danger badge-positive table-wrap provenance` + `--danger`. Then fix `web/README.md`, which describes these classes in the present tense as "all defined in globals.css". | **1.5h** |
| **A2** | **Slide deck, 10 slides max.** Does not exist — `find` over the whole tree returns nothing. Named deliverable in both Notion prints *and* deck slide 06, and it carries most of the 10%. Storyboard already written: `docs/PLAN.md` 4-minute runbook. Link it from README.md and SUBMISSION.md. | **2h** |
| **A3** | Replace `web/app/favicon.ico` (byte-identical to the Next.js default). Any 32×32 that is not Vercel's. | **10 min** |

> A1 before A2 so the deck can screenshot a styled dashboard.

### TRACK B — Sofiane. Report first (40%), then README (30%), then the run.

**Phase 1 — the report. Tonight, first, before anything else.**

| # | Action | Effort |
|---|---|---|
| **B1** | **Kill the two xrpl.org contradictions.** Highest-value edit in the repo. ① `:116-117` "the correct formula exists only in the source. *Proposal: put the net asset value formula on the vault concepts page*" — it **is** on that page, verbatim: `// ExchangeRate = (AssetsTotal - LossUnrealized) / SharesTotal` with a $1.0m/$900k worked example. ② `:127-129` "nothing in the field tables corrects it. *Proposal: document the default settlement arithmetic with a worked example*" — `DefaultCovered = min((DebtTotal x CoverRateMinimum) x CoverRateLiquidation, DefaultAmount)` is on the lending-protocol concepts page **with a 1,090/10%/10% worked example that predicts our two arcs to the unit**. **Both pages are listed in the brief's own Resources block.** Keep the lived experience (we shipped the bug, we found it by impairing a loan); move the complaint to where it survives: the *reference* pages. `ledger-entry-types/vault.md` defines `AssetsTotal` and `LossUnrealized` with no pointer to the exchange algorithm, and `vault_info` returns neither NAV nor share price; the `LoanBroker` field table describes `CoverRateMinimum` as a posting floor without saying it is also the liquidation base. **Proposal becomes: cross-link the reference field tables to the two worked examples, and return NAV from `vault_info`.** | **40 min** |
| **B2** | **`:55` and `:67`** → "behind an **identical lending** amendment list". Replace `:67` with: "the two Amendments entries differ only by 41 pre-2023 retired amendments the public devnet's older ledger still carries; every lending amendment — `LendingProtocol`, `LendingProtocolV1_1` and `fixCleanup3_4_0` — is enabled on both, so the amendment list cannot distinguish the two behaviours." Fold `:65`'s TicketBatch sentence in as the example. Same edit at `docs/feedback/FRICTION-LOG.md:238` and `web/lib/config.ts:3`. | **15 min** |
| **B3** | **Add a `*Proposal:*` to the delegation finding (`:160-165`).** Suggested: *"add `.delegable` to the lending entries in `transactions.macro` and define granular permissions in `permissions.macro`, starting with `LoanManage` and `LoanBrokerCoverDeposit` — the two an operations key needs and a treasury key must not have."* | **10 min** |
| **B4** | **Conformance pass (§4).** Give every finding a **category from the brief's taxonomy** (`client libraries`, `UX`, `missing primitive`, `documentation/tutorials`, `other`) and a **severity**. Remap the smaller-things table: `protocol` → `missing primitive`, `infrastructure` → `other`, `documentation` → `documentation/tutorials`. Cheapest shape that reads well: a `**Category** · **Severity**` line under each numbered finding and each essay heading. | **45 min** |
| **B5** | **Cut to 3 pages.** Currently ~5.2 A4 pages / 2,149 words. Target ≤1,300 words. Cut in this order: (i) the illiquidity essay `:131-141` folds into one smaller-things row; (ii) the grace-period essay `:143-151` becomes one row; (iii) smaller-things 9 rows → 5 (drop faucets, VaultCreate cost, `tecINSUFFICIENT_PAYMENT`, four-calls-to-read); (iv) spec table 8 rows → 6 (drop rows 7 and 8). **Do not cut** findings 1-3, the NAV/first-loss/delegation essays, or "What we contributed back". Then re-measure. | **45 min** |
| **B6** | `:102` — replace "our loan repaid 2000001 on 2000000" with the measured truth from §1.2: *"the ledger accepted a `LoanPay` declaring 2,000,001, settled exactly 2,000,000 into the vault and closed the debt; `AssetsTotal` never moved."* Free upgrade, already verified. `:193` — soften "Every finding above was also filed" → "Findings F-001 to F-017 were filed through the event's capture hook as they happened." | **10 min** |

**Phase 2 — README and scripts. Tonight, after the report.**

| # | Action | Effort |
|---|---|---|
| **B7** | **README self-contradictions.** ① `:34` delete "The lenders' share price rises by the fee actually delivered" — it is contradicted by `:71-77` and by the chain. ② `:101-102` "it is why this vault is configured at one hundred percent" — either do B10 or change to "which is why the demo vault is provisioned at one hundred percent". ③ `:109` "in the evidence file" — **`grep -c Credential docs/evidence/recall-t2.json` returns 0.** Fix by B10, or state the hashes inline. ④ `:113-114` "shares inherit the underlying security's authorisation gate… no second credential scheme" — **false**: the share issuance carries its own `DomainID`, and the market maker is authorised on the security yet still refused `tecNO_AUTH` (`81A6043E…`). Replace with: *"the share issuance carries its own `DomainID`, so lender eligibility is enforced on the share position by the permissioned domain, independently of the security's require-auth gate. A holder needs both."* ⑤ `:33` and `:57` — `EscrowCreate 939E88A6…` has `FinishAfter` only, no `CancelAfter`, `Destination` = agent, and nothing finishes or cancels it anywhere outside `scripts/experiments/`. Delete "held bilaterally" and "recovers the collateral"; say *"the borrower posts an XRP collateral escrow to the agent; release and forfeiture are modelled off-chain in this demo."* | **45 min** |
| **B8** | **Make the README table demonstrate the finding instead of contradicting it.** `:87-91` prints `price per share 1.00` at the **impaired** row — the naive number the report calls a bug. Add a second column: `price per share (naive) 1.00` beside `NAV per share 0.60`. Then fix the source so it cannot come back: `scripts/read-vault.mjs:44`, `scripts/demo.mjs:134`, `scripts/default-arc.mjs:86` → `(assets - loss) / shares`, printing `LossUnrealized` alongside. Also correct `docs/AUDIT-CHECKLIST.md:64`, which currently instructs a reviewer to verify the wrong formula. | **30 min** |
| **B9** | **Small, cheap, all verified at HEAD.** ① Add a `LoanManage` row to the README table (impair `5227A096…`, default `95AD6692…`) — the brief requires *"every XLS-65/66 transaction used"* and this one is the entire default arc; add a line naming `VaultSet`, `VaultClawback`, `LoanBrokerCoverWithdraw` as exercised in `scripts/experiments/`. ② README `:53` `CoverDeposit` → `LoanBrokerCoverDeposit` (no such type as `CoverDeposit`; fix `scripts/recall-spine.mjs:98` label + `scripts/gen-evidence-table.mjs` ROLE key). ③ README `:118` "Node 18 or newer" → **"Node 20.19 or newer"** (`xrpl` engines `>=20.19.0`, Next `>=20.9.0`). ④ `package.json`: pin `"xrpl": "5.2.0-beta.0"` exactly, declare `ripple-binary-codec` and `ripple-keypairs` (both imported at `scripts/lib/lending.mjs:7-8`, declared nowhere), drop `"main": "index.js"`, fill `description`/`author`, remove the `npm test` that exits 1. ⑤ Relabel `scripts/default-arc.mjs:111` → `'LoanManage impair, due but inside grace'` and `:114` → `'LoanManage impair, already impaired'`, and hand-edit the four label strings in the two evidence JSONs. ⑥ Delete the "Known and accepted" seeds paragraph at `docs/AUDIT-CHECKLIST.md:84-88` — the working tree is clean; stop signposting the history. ⑦ Translate the nine French strings in `scripts/read-vault.mjs` (README tells the judge to run it). | **50 min** |

**Phase 3 — the de-risking run. Tonight, ~23:00. Do not leave this to Sunday.**

| # | Action | Effort |
|---|---|---|
| **B10** | Edit `scripts/recall-spine.mjs`: ① wrap the two credential submits (`:62-63`) in `rec(...)` so the hashes reach the evidence file and B7③ resolves itself; ② **`:93` `CoverRateMinimum: 100000` AND `:98` cover `'500000'` → `'2500000'` together** (see §3.2 — changing one alone kills the run); ③ `:121` add `CancelAfter: base + 300` beside `FinishAfter`. Then **run it once tonight**. It proves the two-line cover change before Sunday, when there is no time to recover. Regenerate with `node scripts/gen-evidence-table.mjs`, repoint `web/lib/config.ts:15`. **If the `LoanSet` fails, revert ② and take the README wording fix in B7② instead — do not debug it at 12:29.** | **30 min** |

**Phase 4 — the PR. Tonight or Sunday, 40 minutes total. It is a bonus item; it does not outrank the report.**

| # | Action | Effort |
|---|---|---|
| **B11** | **`docs/CONTRIBUTION-explorer-search.md` is in our repo and a judge reads it, and it describes a PR we did not ship.** It promises "deep linking the broker tab so the object the user pasted is the one in view" (`VAULT_ROUTE` is `/vault/:id`, no tab) and says the change "adds two lookups" (it **removes** one and switches on `LedgerEntryType`). Rewrite "The change" in the past tense against commit `b72eaed`: one `getLedgerEntry` switched on `LedgerEntryType`; one extra hop via `getLoanBroker` for a Loan only; both route to `/vault/<VaultID>` with **no** tab deep link; two en-US strings; four tests; **+84/−21 across three files**. | **20 min** |
| **B12** | **PR body.** Add two paragraphs: **#1320** (merged 2026-05-04, *"Reject non-Vault ledger entries in getVault"*) — say plainly that this change preserves it, the default case still throws, and a PermissionedDomain id still returns not-found; without naming it our diff reads as a partial revert of a maintainer's own fix. **#1146** (`feat: Add basic ledger entry page`, OPEN draft, base `staging` — **which is no longer the default branch, `main` is** — last touched 2026-05-21) — state the position: a broker or loan is better served by the vault page that already renders its cover, debt ceiling and loan table than by a generic field dump, and this switch is the shape that makes the split trivial. Invite the maintainer to say if they would rather land #1146 first. Add one line noting CI is gated on first-time-contributor approval and what passed locally. | **20 min** |

**Phase 5 — Sunday morning, in this order.**

| # | Action | Effort |
|---|---|---|
| **B13** | 08:30 — rerun `scripts/recall-spine.mjs` (or `demo.mjs provision`) for a **live** vault; regenerate the table; repoint `web/lib/config.ts:15`; open the dashboard and confirm it is not zeros. | **45 min** |
| **B14** | 09:30 — re-render the report, confirm ≤3 pages. Tick SUBMISSION.md. **Report the borrower-eligibility gap to a mentor privately** — the brief makes it a precondition of presenting and the box is still unticked. **Ask a mentor for the DevEx form link** (genuinely unpublished — not in either print, either deck, or the hook repo). Settle 4+2 vs 5+3 while you are there. | **45 min** |
| **B15** | 11:00 — rehearse the 4-minute cut twice against the live vault. Freeze at 12:30 with the last 30 minutes empty. | **1.5h** |

---

## 6. DO NOT START — cannot be finished and verified before 12:30

- **Any transaction that needs a fresh spine to prove a new primitive.** `Sponsor` fee/reserve
  sponsorship, `TokenEscrow` with an MPT amount, a second lender, `DynamicMPT` against the live
  issuance. Each is a provisioning run plus a README rewrite for at best one bonus hash.
- **Chasing yield via `CloseInterestRate`.** Unverified settlement target, full rerun, and it trades
  a measured finding for an unexplainable number in Q&A. The "On yield" paragraph at README:71-77 is
  already the right answer to minimum-bar item 04 — *keep it and say it out loud in the pitch.*
- **`EscrowFinish` / `EscrowCancel` as a live demo step.** `FinishAfter` cannot be fast-forwarded on
  devnet. Reword the README (B7⑤) instead.
- **Refactoring `HashMatch` into a discriminated union in the explorer PR.** Correct, but it is a
  bonus item with no reviewer assigned. Only if Track B finishes early.
- **Renaming `recall-spine.mjs` / `recall-t2.json`.** Six referencing files, zero points.
- **Porting `probe-t2.mjs` off `Date.now()`**, deleting unreferenced experiment scripts, adding a
  `docs/research/` index, moving `docs/PLAN.md` under `docs/internal/`. All correct, all invisible
  to a judge on a four-minute budget, all after the freeze.
- **Re-running the two default arcs.** Hand-edit the four labels (B9⑤); the hashes and codes are
  already right.

---

## 7. Still open, and only a human can close it

1. **Is the DevEx hook installed on the second machine?** SUBMISSION.md asserts "both machines"; only
   `witty-iguana-68` is visible locally. The brief makes it mandatory **per developer**.
2. **Where is the DevEx feedback form?** Verified unpublished across both prints, three decks and the
   hook repo. It is a listed submission deliverable. Only the organizers can unblock it.
3. **Will the report be judged as rendered pages or as Markdown?** The cap is "3 pages" but the
   artefact lives at the repo root. Cut to three anyway — it is the only reading that cannot lose.
4. **`553C31E8…`** (the only hash in the spec table) is on the **custom** devnet while the report's
   header declares network_id 2. Either label the cell or drop the hash.
