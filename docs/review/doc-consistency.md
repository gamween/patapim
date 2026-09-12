# Document consistency review — every factual claim against code and chain

Reviewer slug: `doc-consistency`. Run 12 September 2026, against `a0f00a9` (the repo moved twice
mid-review: `a45d5cd` → `cce8bb3` → `a0f00a9`; everything below is re-verified against `a0f00a9`).

Scope: `README.md`, `DEVELOPER-REPORT.md`, `SUBMISSION.md`, `web/README.md`, `docs/PLAN.md`,
`docs/AUDIT-CHECKLIST.md`, `docs/CONTRIBUTION-explorer-search.md`, `docs/feedback/FRICTION-LOG.md`.

Method: every hash re-submitted to `https://s.devnet.rippletest.net:51234/` (`tx`) or
`https://lending-hackathon.dev.ripplex.io:51234`; every file:line opened; every spec quote fetched
from `XRPLF/XRPL-Standards`; every PR/issue/commit read through `gh`; both packages re-downloaded
from npm and diffed.

---

## A. What is wrong

### A-1 (blocker) "an identical amendment list" is false — the sets differ by 41 amendments
`DEVELOPER-REPORT.md:55` (heading) and `:67` ("the amendment set is identical"),
`FRICTION-LOG.md:238` (F-011 heading), `web/lib/config.ts:3`.

    feature RPC, enabled amendments:
      public devnet  (network_id 2,    3.4.0-rc5): 89
      custom devnet  (network_id 4001, 3.4.0-rc1): 48
      only on public, 41 of them: Checks, Clawback, DepositAuth, DepositPreauth, Flow,
        NegativeUNL, TicketBatch, fix1513 … fixUniversalNumber
      only on custom: 0 (strict subset)

The report contradicts itself two sentences apart: `:65` says "`TicketBatch` also differs between
them", `:67` says "the amendment set is identical". The lending-specific claim is true and is the
one worth keeping — `LendingProtocol`, `LendingProtocolV1_1` and `fixCleanup3_4_0` are enabled on
both, verified. `docs/AUDIT-CHECKLIST.md:31-34` tells a reviewer to reproduce exactly this finding,
so it is the first thing an auditor or a judge will check.

**Fix.** "behind an identical *lending* amendment list" / "the lending amendment set is identical:
`LendingProtocol`, `LendingProtocolV1_1` and `fixCleanup3_4_0` are enabled on both, and the 41
amendments that differ are all unrelated to lending." Same edit in F-011 and `web/lib/config.ts:3`.

### A-2 (blocker) README's headline promise is false for the vault README points at
`README.md:5-6` "the ledger's default logic makes the lenders whole"; `README.md:30` "The ledger
refuses to originate a loan the cover cannot absorb"; `README.md:101-102` "it is why this vault is
configured at one hundred percent".

On chain, the LoanBroker of the vault in README's own table
(`B52A10D8AD4F4545FF3F12630728CEB567C6E80F4A20239313B6292CB227D412`, vault
`1D5C0C8E…2687`, the current `web/lib/config.ts:15` `DEMO_VAULT`):

    CoverRateMinimum   10000      (ten percent, not one hundred)
    CoverRateLiquidation 100000
    CoverAvailable      500000
    …and LoanSet 784DA553… originated a 2,000,000 loan against it, tesSUCCESS

`scripts/recall-spine.mjs:93` hardcodes `CoverRateMinimum: 10000`. Only `scripts/demo.mjs:80` uses
100000, and no evidence file exists from `demo.mjs`. The previous run's broker
(`055FDE07…`) was 10000 too. So:

- `:30` is falsified by README's own row: cover 500,000 absorbed a 2,000,000 loan origination. By
  the repo's own F-014 the cover would pay `min(500000, 10% × 2000000) = 200000`.
- `:5-6` is falsified: on this vault a default leaves lenders carrying 1,800,000 of 2,000,000.
- `:101-102` "this vault is configured at one hundred percent" is simply not true of any vault the
  repo has published evidence for.

This is the single most damaging inconsistency: F-014 is presented as the team's sharpest finding,
and the product ships configured on the wrong side of it.

**Fix.** Either set `recall-spine.mjs:93` to `CoverRateMinimum: 100000` with cover ≥ debt and
re-run, or change `:5-6`, `:30` and `:101-102` to say what the demo vault actually is.

### A-3 (serious) README contradicts itself on the lending fee, 37 lines apart
`README.md:33-34` "the borrower returns the securities with the fee … The lenders' share price rises
by the fee actually delivered" versus `README.md:71-77` "`LoanOriginationFee` … is taken from the
drawdown and paid to the broker rather than the vault" and F-016.

Verified in the metadata of `784DA553098DD10D4E35F45FC7BB8BC55081FA86DE2D509B5161D5F05F67A72A`:
borrower `rK22C…` 10,000,000 → 11,900,000; broker owner `rJp5P…` 9,500,000 → 9,600,000; vault
`AssetsTotal` 5,000,000 → 5,000,000; `Loan.PrincipalOutstanding` 2,000,000. F-016's table is exactly
right. `README.md:34` is the stale sentence and must go.

The same holds in the earlier run: `LoanPay CAF24C84…` repaid 2,000,001 and the vault's
`AssetsTotal` stayed at 5,000,000 (only `AssetsAvailable` moved 3,000,000 → 5,000,000); the lender
withdrew 5,000,000 shares for exactly 5,000,000 TBL. Zero yield, twice.

### A-4 (serious) "Vault shares inherit the underlying security's authorisation gate … There is no
second credential scheme" is false
`README.md:113-114`, contradicting `README.md:26-28` and the evidence file's own note
`"domain gates lenders"`.

- The share `MPTokenIssuance` carries its own `DomainID`
  (`0000000146F9D925863F75B121DD5CC34317A24B7611EDA8` → `DomainID
  1B3C6F07…96C8`). That *is* a second, separate scheme.
- `scripts/recall-spine.mjs:55-58` authorises the market maker on the security MPT and pays it
  10,000,000 TBL. It is fully eligible on the security, and its `VaultDeposit` is still refused
  `tecNO_AUTH` (`D4C93863…`, and `81A6043E…` in the new run). So eligibility on the security is
  demonstrably **not** eligibility on the lender position.

**Fix.** "The vault's share issuance carries its own `DomainID`, so eligibility is enforced on the
lender position independently of the security's own authorisation."

### A-5 (serious) README's "Loaded" table cites hashes from a superseded run, and one primitive has
no hash at all
`README.md:106-111`.

| README row | hash it shows | which run | in the current evidence file? |
|---|---|---|---|
| `MPTokenIssuanceCreate` | `B1F39818…` | previous run | no — current is `7679B968…` |
| `PermissionedDomainSet` | `006858D1…` | previous run | no — current is `AB5472A6…` |
| `EscrowCreate` | `387AFEE3…` | previous run | no — current is `939E88A6…` |
| `CredentialCreate` / `CredentialAccept` | "in the evidence file" | — | **no: `grep -c Credential docs/evidence/recall-t2.json` → 0** |

So README shows two different hashes for the same `MPTokenIssuanceCreate`, `PermissionedDomainSet`
and `EscrowCreate` within one page (lines 47/48/57 versus 108/110/111), and the Credentials
primitive — a third of the Loaded claim — has **no published hash anywhere in the repository**.
`recall-spine.mjs:62-63` fires `CredentialCreate` and `CredentialAccept` through `submit()` without
`rec()`, so they never reach the evidence file. All four superseded hashes still resolve
`tesSUCCESS`, so nothing is fabricated; the page is just self-inconsistent and one row is a dead
pointer.

**Fix.** `rec()` the two credential steps in `recall-spine.mjs`, re-run, and regenerate or delete
the "other primitives" table — `gen-evidence-table.mjs` already covers three of its four rows.

### A-6 (serious) `docs/AUDIT-CHECKLIST.md` publishes the formula the report calls a bug
`AUDIT-CHECKLIST.md:64-66`: "**Price per share.** `AssetsTotal / OutstandingAmount` … Compare the
figure on `/vault/<id>` against `node scripts/read-vault.mjs t2 <id>`. They must agree to the last
digit shown."

That is the naive formula `DEVELOPER-REPORT.md:110-117` and F-013 identify as wrong, and
`web/README.md:71` and `web/lib/ledger.ts:121,127` correctly use `(AssetsTotal - LossUnrealized) /
OutstandingAmount`. Worse, the check as written **cannot pass** on an impaired vault, because
`scripts/read-vault.mjs:44` still prints the naive figure. A reviewer following the checklist on the
impaired state would read 1.00 from the CLI and 0.60 from the page and conclude the dashboard is
broken.

The naive formula is still live in three places: `scripts/read-vault.mjs:44`,
`scripts/demo.mjs:134`, `scripts/default-arc.mjs:86`. The third is why the `price per share` column
in `docs/evidence/default-arc-*.json` and in the README tables at `:87-91` reads **1.00 at the
impaired state**, where the repo's own corrected formula gives (5,000,000 − 2,000,000) / 5,000,000 =
**0.60**. F-013's table at least labels its column "naive `AssetsTotal / shares`"; README's does not,
and `README.md:93` then says "the lenders' share price does not move" on the strength of it.

**Fix.** Correct the checklist to the NAV formula; fix `read-vault.mjs:44`, `demo.mjs:134` and
`default-arc.mjs:86`; label or recompute the README column. `demo.mjs state` run after
`demo.mjs impair` on stage will otherwise print 1.00 next to a dashboard showing 0.60.

### A-7 (serious) "Every finding above was also filed through the event's own capture hook" is false
`DEVELOPER-REPORT.md`, last line; and `AUDIT-CHECKLIST.md:113-115` repeats the claim inverted.

`.xrpl-devex/sent.jsonl` contains exactly **15** `kind: "feedback"` items, and they map one-to-one
onto F-001…F-015. The report contains findings that are in none of them, including:

- the whole eight-row "Specification against implementation" table,
- "No vault or loan transaction is delegable" (the custody blocker),
- "A permissioned domain gates lenders, not borrowers" (the security finding),
- smaller things: `Batch` exclusion, `txToFlag`, `VaultWithdraw` under-delivery, ~40 undocumented
  result codes, "no way to ask the ledger which phase a vault is in".

F-016 was written after the last send and is not in `sent.jsonl` either.

`AUDIT-CHECKLIST.md:113-115` compounds it: "cut the 'Smaller things' table first: it is the only
section whose items are also filed through the event hook, so nothing is lost." That is backwards —
most of the *narrative* sections are filed and roughly half the smaller-things table is not, so the
advice deletes precisely the findings that exist nowhere else.

### A-8 (serious) The mandatory three-page report is drifting, and the checklist's own number is stale
`AUDIT-CHECKLIST.md:112-115` says "currently around 1760 words across four tables". Actual:
`wc -w DEVELOPER-REPORT.md` → **2149** words, four tables, 194 lines. Both briefs and the challenge
deck cap the manual report at 3 pages (Notion brief p.11; challenge deck slide 06 "Manual developer
report, max 3 pages"). 2149 words plus four tables renders past three pages in most settings.

### A-9 (medium) Twelve transaction hashes exist only as 8-character prefixes, nowhere in full
`FRICTION-LOG.md` cites `9DD4F5C8…F2F3` (F-015), `60E499EA…B2BC`, `C15C80B7…F87F`, `50B7887C…E11E`,
`6F288748…7EA0`, `B1AC2EE1…9402`, `C717D339…9F00`, `1A80A637…ADC0` (F-006/F-007),
`C1BC35CC…1C3C`, `F32A68AC…3F89` (F-008), `44B98E6A…59AA`, `13F8E75B…9C6D` (F-012).
`grep -rho '<prefix>[0-9A-F]\{56\}'` over the whole repository returns nothing for any of them, and
rippled has no prefix lookup, so none can be verified by anyone but the authors. `DEVELOPER-REPORT`
inherits one: `553C31E8…` at `:83`.

The F-015 one matters most: `9DD4F5C8…` is the *only* evidence for the `tecTOO_SOON`-before-due-date
half of "impairment unlocks at the due date", the claim the directive singles out. The two published
default-arc runs contain no pre-due impair attempt at all — `scripts/default-arc.mjs:110` waits until
`NextPaymentDueDate + 5` before the first one.

**Fix.** Paste the full hashes, or drop the claims that rest on them.

### A-10 (medium) The one hash in the report's spec table is on the wrong network
`DEVELOPER-REPORT.md:83` cites `553C31E8…` for the `VaultClawback` / `lsfMPTCanLock` divergence.
Resolved: **not found** on the public devnet; found on the custom hackathon devnet, ledger 67580,
`VaultClawback` `tesSUCCESS`. The report's header declares the environment as "Public XRPL Devnet …
network_id 2, rippled 3.4.0-rc5", and `AUDIT-CHECKLIST.md:22-23` says "All of them are on
network_id 2. None from the custom hackathon devnet." The finding was established on rc1, and the
report does not say so. Whether it reproduces on rc5 is untested.

The same applies to the `DelegateSet` paragraph: the control `EFBE6D9E…` and the fifteen
`temMALFORMED` in `docs/research/batch-delegation-escrow.md:114-119` are custom-devnet transactions.
The report cites no hash there, so nothing is wrong on the page — but a reviewer asked to reproduce
on network 2 will not find them.

### A-11 (medium) `docs/CONTRIBUTION-explorer-search.md` describes an implementation that was not shipped
`:83-91` "The change": "1. Add two lookups to `determineHashType`: `getLoanBroker`, and a loan lookup
by ledger entry index." The merged branch does the opposite — it **replaces** the vault lookup with
one `getLedgerEntry` switched on `LedgerEntryType`, which is the design `DEVELOPER-REPORT.md`
describes correctly ("so the request count is unchanged"). Diff `0232381..8c361b5`:

    -    getVault(rippledContext, id).then(() => 'vault'),
    +    resolveLedgerEntry(id, rippledContext),

So the two documents describe two different PRs and only the report matches the code. `:91`
"Roughly forty to eighty lines plus tests" is also planning language against a shipped `+84/-21`.

### A-12 (medium) `README.md:118` "Node 18 or newer" is wrong
`node_modules/xrpl/package.json` → `engines.node ">=20.19.0"`;
`web/node_modules/next/package.json` (16.3.5) → `engines.node ">=20.9.0"`. A judge on Node 18
following the README fails at `npm install`. Say Node 20.19 or newer.

Related, `package.json` declares `"xrpl": "^5.2.0-beta.0"`, a caret range that also satisfies stable
`5.2.0` — the version the report says "cannot model a closed-ended vault at all". Only
`package-lock.json` pins the beta. `scripts/lib/lending.mjs:7-8` imports `ripple-binary-codec` and
`ripple-keypairs`, neither of which is a declared dependency.

### A-13 (medium) Two wrong cross-references to findings that do not exist where they are cited
- `README.md:76`: "Findings F-006 and F-016 in [`DEVELOPER-REPORT.md`]". `DEVELOPER-REPORT.md`
  contains no F-numbers at all — F-nnn is the friction-log numbering. And friction-log **F-006** is
  "Phase-gate rejections reuse two generic codes for four different gates", nothing to do with yield.
- `FRICTION-LOG.md:394` (inside F-016): "That flag does not exist … (finding F-006)". Same error;
  the `tfVaultDonation` finding is row 6 of the report's spec table, not F-006.

### A-14 (medium) `AUDIT-CHECKLIST.md:47-48` "No phase decision uses `Date.now()`" fails on the
shipped code
`scripts/probe-t2.mjs:20` derives the vault's `SubscriptionDate`/`RedemptionDate` from
`nowRipple()` (`scripts/lib/lending.mjs:26`, `Date.now()`), and `:58` waits on
`while (Date.now() < target)`. `probe-t2.mjs` is the script `README.md:124` tells a judge to run.
`recall-spine.mjs`, `default-arc.mjs`, `demo.mjs` and `web/lib/ledger.ts` all read `ledger.close_time`
correctly. `recall-spine.mjs:10` still imports `nowRipple` and never uses it.

### A-15 (minor) README's transaction table names a transaction type that does not exist
`README.md:53` row `` `CoverDeposit` ``. The real type is `LoanBrokerCoverDeposit` (confirmed by
`tx B440E96E…`, and by `server_definitions`). Cause: `scripts/gen-evidence-table.mjs:27` builds the
type column from the first word of the evidence step label. The same line produces `EscrowCreate`
from "EscrowCreate collateral" (right by luck) and `VaultWithdraw` from "VaultWithdraw during
Investment" (right). The brief asks the README to list "every XLS-65/66 transaction used", so a
made-up type name in that table is a bad look. Either rename the step in `recall-spine.mjs:98` or map
it in `ROLE`.

### A-16 (minor) F-015's "11 seconds / 49 seconds" belongs to the second hash, not the first
`FRICTION-LOG.md:353` and `DEVELOPER-REPORT.md:144-146`. Measured against the parent ledger close
time, which is the clock rippled uses:

| tx | due | parent close | delta | grace left |
|---|---|---|---|---|
| `A3734858…F55D` (listed first) | 842547440 | 842547452 (ledger 5257482) | **12 s** | 48 s |
| `5227A096…5F48` ("reproduced") | 842547801 | 842547812 (ledger 5257598) | **11 s** | 49 s |

The claim itself holds — `GracePeriod` is 60 on both loans and both impairs succeeded well inside it
— only the attribution is off by one row. The `tecNO_PERMISSION` rows (`C9F00989…`, `03933F6D…`)
are both after grace expiry *and* already impaired, so they cannot distinguish the two causes; the
text at `:354` correctly says "already impaired".

### A-17 (minor) The evidence files label the successful impair "(too early)"
`docs/evidence/default-arc-cover*.json`: `"step": "LoanManage impair (too early)", "code":
"tesSUCCESS"` followed by `"step": "LoanManage impair", "code": "tecNO_PERMISSION"`. From
`scripts/default-arc.mjs:111` the label encodes the *expectation*, not the result. A judge reading
the evidence file sees the two lines as swapped. Rename to "impair inside the grace period".

### A-18 (minor) `PeriodicPayment` is quoted with two different values in two documents
`FRICTION-LOG.md:194` (F-008): `"PeriodicPayment": "5000003.567356568362"`, framed as XRP ("XRP has
no fraction below one drop"). `DEVELOPER-REPORT.md:174`: `1000000.142695042164` "on an
`AssetScale: 0` token". The second is verified — it is the value on the `Loan` created by
`5C65F0A5…` and by `EDF10740…`. The first is from an XRP-vault run whose two cited hashes
(`C1BC35CC…`, `F32A68AC…`) are among the unresolvable prefixes of A-9. The report silently swaps the
run, so the number and its framing no longer belong to the `tecINSUFFICIENT_PAYMENT` incident it is
attached to.

### A-19 (minor) `docs/PLAN.md:16` "14 items filed through the event hook, plus one checkpoint analysis"
Actual: **15** feedback items in `.xrpl-devex/sent.jsonl` (16 findings now exist, F-016 unfiled), and
**two** checkpoint analyses in `.xrpl-devex/analyses.log`
(`session-analysis-20260912-160901`, `session-analysis-20260912-184940`).

### A-20 (minor) Quote used out of context, and a hedge worth adding
`DEVELOPER-REPORT.md:136-139` attributes to "the author of the specification … in XRPL-Standards
discussion #589" the line "when a proposal to issue a loan is created on-chain, the funds for that
loan must be reserved". Verified: the words are exact, the speaker is `Tapanito` = Vito Tumas
(Ripple), who is an author of XLS-66. But discussion #589 is *On-Chain Cosigner*, and the comment is
about reserving funds behind a pending co-signature proposal — not about a closed-ended vault being
illiquid at `RedemptionDate`. "named the cause himself" over-reads it. Say "made the same point in a
neighbouring context".

`DEVELOPER-REPORT.md:125` / F-014 `FRICTION-LOG.md:338`: "a broker can sit on ten times the capital it will
ever pay out". The cited run is 1,000,000 posted against 200,000 paid — **five** times. The general
statement is unbounded and true; the number is not the one the evidence shows.

`DEVELOPER-REPORT.md:88` row 7 cites "the brief's minimum bar: 'execute a drawdown'". That phrase is
in **Track 1's** minimum bar (Notion brief p.6 step 4; challenge deck slide 02 item 04). Track 2's
bar, the one this submission is judged against, has no drawdown step. Worth one word of precision.

### A-21 (unverified) Claims I could not check
- `DEVELOPER-REPORT.md:86` "absent from all **559** xrpl.org pages". The substance is confirmed —
  `xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/vault` documents no `VaultKind`,
  `SubscriptionDate`, `RedemptionDate`, and gives no NAV formula — but the page count is not
  reproducible from anything in the repo.
- `DEVELOPER-REPORT.md:181` "Around forty result codes … appear on no reference page." Not counted.
- `DEVELOPER-REPORT.md:84` row 3, "false since `fixCleanup3_4_0`: the destination is checked". Not
  tested on chain in this review; no hash is offered.
- `DEVELOPER-REPORT.md:178` "a Ripple product manager publicly describes repo settlement built on
  co-signed atomic batches". No source in the report.
- `docs/CONTRIBUTION-explorer-search.md:8-9` "the repository requires two approving reviews with
  write access". `CONTRIBUTING.md` says nothing of the kind; `gh pr view` reports only
  `reviewDecision: REVIEW_REQUIRED`. Probably read off the PR UI; unverifiable from outside.
- `SUBMISSION.md:12` "both machines" for the DevEx hook. Only this machine is inspectable.

---

## B. What holds — checked, and it checks out

**Every transaction hash in the repository resolves, with the stated type and the stated result.**
All 14 rows of the regenerated README table (`7679B968`, `AB5472A6`, `B7DB66AE`, `B805D0A8`,
`81A6043E`, `6C5715F2`, `B440E96E`, `AAF85BB5`, `2541A17D`, `784DA553`, `939E88A6`, `FD3E8AE8`,
`531EB6E9`, `1C206948`), all 10 rows of the superseded table, all 16 events across the two
default-arc evidence files, and `DD751B83…`, `D5879394…` on network 2, `42BDEBF8…`, `59496BAE…`,
`553C31E8…`, `EFBE6D9E…` on network 4001. Zero mismatches. Nothing is relabelled.

**Finding 1, the SDK signature bug, is exactly right.** Both tarballs re-downloaded:
`xrpl@5.2.0` `src/Wallet/counterpartySigner.ts` passes `'counterparty'` at both call sites
(multisign and single-signer); `5.2.0-beta.0` omits it at both. `utils.ts` in stable declares
`role: SignatureRole = 'transaction'` with `SIGNING_ENCODERS[role]`; the beta has no `role` and calls
`encodeForSigning`. `ripple-binary-codec@2.11.0` exports `encodeForSigningCounterparty`.
rippled #8162 "fix: Add signature prefixes for sfCounterpartySignature and sfSponsorSignature"
merged 2026-09-03. `fixCleanup3_4_0` is enabled on both networks. F-001's diff block is accurate.
`scripts/lib/lending.mjs:70` uses the right encoder and `:81` passes `decode(signed.tx_blob)`, both
as `AUDIT-CHECKLIST.md:42-46` requires.

**The spec-versus-implementation table is accurate where it is checkable.**
XLS-66 line 1347 does document `LoanPay` as `83`; `server_definitions` on devnet returns `84` (83 is
unassigned). XLS-65 **line 702** is verbatim "If the `MPTokenIssuance.lsfMPTCanLock` flag is NOT set".
XLS-65 **A.2** is verbatim "The `VaultWithdraw` transaction does not respect the permissioned domain
rules". XRPL-Standards PR **#587 "Closed-ended Vault"**, open, created **2026-07-21**.
`tfVaultDonation` appears three times in the Lending Protocol workshop deck and nowhere in
`server_definitions`. `github.com/ripple/lending-demo` → 404; `ripple/xrpl-reference-app-lending-sav`
→ 200.

**F-016 and the yield paragraph are exact.** Every number in F-016's table is in the metadata of
`784DA553…`, including `PrincipalOutstanding: 2000000` and `TotalValueOutstanding: 2000001`.

**F-012's fee figures follow from the ledger.** `server_state`: `reserve_inc` 200000 drops on the
public devnet, 2000000 on the custom one — the 0.2 / 2 XRP split, exactly 10×.

**F-004's ledger_entry index is right.** `7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4`
is the `Amendments` entry, 89 enabled.

**The smaller-things client-library row is right.** `LoanSet` is absent from `txToFlag`
(`node_modules/xrpl/dist/npm/models/utils/flags.js:65-86`, which lists `LoanManage` and `LoanPay`), while `loanSet.d.ts:22`
types `Flags?: number | LoanSetFlagsInterface`. `sugar/autofill.js:222-225` `console.warn`s on every
`LoanSet`.

**The explorer contribution is real and its references are accurate.** PR #1342 open, branch
`gamween:search-resolve-loan-objects`, 3 files, **+84/−21**, commits `b72eaed` and `8c361b5` (the
review-round commit the doc cites). `Search.tsx:42` on `main` **is** `determineHashType`;
`rippled.ts:895`/`:953`; `vaultUtils.ts:31`; `rippled.test.ts:119,135,146`; `routes.ts:82`
`VAULT_ROUTE` — all correct. The quoted placeholder and not-found strings are byte-exact against
`main`. Copilot's review did ask for `LoanBroker` in both strings. `npx jest --env=jsdom --ci
src/containers/Header/test/Search.test.js` → **4 passed**. Merge dates for #1259 (2025-12-15),
#1281 (2026-03-11), #1292 (2026-03-20) are all exact; #1328, #1340, #1120, #916 states are right;
MIT, not archived, last push 2026-09-11; `CONTRIBUTING.md` line 5 does open "We're thrilled you're
interested". `LSF_LOAN_DEFAULT`/`LSF_LOAN_IMPAIRED` in `web/lib/ledger.ts:145-146` match
`src/containers/Vault/VaultLoans/utils.ts:7-8`, and the on-chain flags confirm both
(impair → 131072, default → 196608).

**The brief citations in `SUBMISSION.md` and F-005 are right.** Notion brief: 4-minute demo +
2-minute Q&A (p.11 and the Sunday schedule). Challenge deck slide 05: "5 min presentation + live
demo · 3 min Q&A". Judging 40/30/20/10 in both. Track 2 minimum-bar wording matches F-005's table.
The DevEx feedback form is required in both prints with no link anywhere, as `SUBMISSION.md:7` says.
GitHub handles `gamween` and `STOOOKEEE` both exist.

**Minimum-bar coverage, as claimed at `README.md:64-66`.** The three phase rejections the bar asks
for are all in the table on one vault: `VaultDeposit tecEXPIRED`, `VaultWithdraw tecTOO_SOON`,
`LoanSet tecEXPIRED`. The deck's stricter phrasing (deposit and withdraw *during Investment*,
`LoanSet` *during Redemption*) is satisfied too.
