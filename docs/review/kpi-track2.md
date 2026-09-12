# Track 2 conformance review — slug `kpi-track2`

Reviewer scope: extract the Track 2 requirements verbatim from the two Notion prints and the Ripple
challenge deck, judge the repository against each one, verify every hash on chain myself.
All on-chain verification done against `https://s.devnet.rippletest.net:51234/`
(`build_version` `3.4.0-rc5`, `network_id` 2, confirmed by `server_info`) and, where a hash was not
found there, against `https://lending-hackathon.dev.ripplex.io:51234` (`3.4.0-rc1`, `network_id` 4001).

## 0. The sources, and where they disagree

Union of the two Notion prints: print 1 carries the appendix (event contacts, "Track 1 amendment
note", "Track 2 accounting note") which print 2 drops; print 2 adds the wifi block,
`HOOK INVITE CODE: BFT-PARIS-26`, the slides swisstransfer link and "Browser wallet extension"
under resources, and truncates the "Additional developer tools" list. **The Track 2 section is
byte-identical in substance across both prints.** No contradiction between the prints themselves.

Contradictions between Notion and the Ripple challenge deck:

| | Notion (both prints) | Challenge deck |
|---|---|---|
| Pitch | "Present a 4-minute live demo, followed by 2 minutes of Q&A" | "5 min presentation + live demo · 3 min Q&A" |
| Track 2 rejections | "Demonstrate rejected `VaultDeposit`, `VaultWithdraw` and `LoanSet` transactions at the wrong phase" | "05 Show rejected VaultDeposit and VaultWithdraw **during Investment**" / "06 Show a rejected LoanSet **during Redemption**" |

Both are already logged as F-005 in `docs/feedback/FRICTION-LOG.md:123` and in `SUBMISSION.md`.
I judge against the **union**, i.e. the deck's stricter phase assignment.

## 1. Conformance table

### Environment rules — "Choose your environment first · Do not mix tracks, endpoints or xrpl.js versions."

| # | Requirement (verbatim) | Verdict | Evidence |
|---|---|---|---|
| E1 | Track 2 Vault: "Closed-ended" | **MET** | `VaultCreate` `0CBE12AB…CC246`, `VaultKind: 1` in tx and in the created `Vault` node |
| E2 | Track 2 Protocol: "Lending Protocol V1.1" | **MET** | vault node carries `LEVersion: 1`, `SubscriptionDate`, `RedemptionDate`; phase gates fire |
| E3 | Track 2 Network: "Public XRPL Devnet" / RPC `https://s.devnet.rippletest.net:51234/` | **MET** | all 13 flagship hashes validated on that RPC; `web/lib/config.ts:6` points there |
| E4 | Track 2 Library: "`xrpl.js@5.2.0-beta.0` required" | **MET with a caveat** | `package-lock.json` pins `5.2.0-beta.0`; installed tree is `5.2.0-beta.0`. But `package.json` declares `"xrpl": "^5.2.0-beta.0"`, and `npm view 'xrpl@^5.2.0-beta.0' version` resolves to `5.2.0-beta.0`, `5.2.0-beta.1` **and stable `5.2.0`**. See gap G-7 |
| E5 | "Do not mix tracks, endpoints or xrpl.js versions" | **DISCLOSED DEVIATION** | The product is single-network. The developer report deliberately crosses networks and library versions for its two headline findings, which is legitimate DevEx work — but finding 1's wording misstates it. See gap G-2 |
| E6 | "Install the mandatory XRPL DevEx hook on every developer's machine" | **PARTLY VERIFIABLE** | `.xrpl-devex/identity.json`: `participant_id witty-iguana-68`, `team patapim`, `invite_code BFT-PARIS-26`, 3.9 MB of `sent.jsonl`. The second machine I cannot verify from here |

### Track 2 minimum bar

| # | Requirement (verbatim) | Verdict | Proof |
|---|---|---|---|
| T2-1 | "Create a closed-ended vault with dates compressed to the event timeline." | **MET** | `0CBE12AB9ACDD12E2659A5FD0EC9505A37EFF55D56A0447AF83D4967D93CC246` — `VaultKind: 1`, `SubscriptionDate: 842540660` (2026-09-12T15:04:20Z), `RedemptionDate: 842540960` (15:09:20Z). 5-minute Investment window on the event day |
| T2-2 | "Deposit capital during Subscription." | **MET** | `CE5C7E595B0D9761B10BE9114AEF38597A03A9620A1590EE7DEC56528B47D06C`, `tesSUCCESS`, 5,000,000 TBL, ledger 5255333, close time 842540610 < 842540660 |
| T2-3 | "During Investment, originate and fund a loan whose final payment occurs before Redemption." | **MET, checked arithmetically** | `318A74E5F7083E919F316531B08F81AFFF5F409C35EDD40B21422D53DE516927`, tx date 842540681 (inside Investment). Created `Loan` node: `StartDate 842540690`, `PaymentInterval 60`, `PaymentRemaining 2` → final payment due **842540810**, which is 150 s before `RedemptionDate` 842540960. Funding is atomic with origination: same meta shows `Vault.AssetsAvailable 5000000 → 3000000` and borrower `MPTAmount 10000000 → 12000000`. No separate drawdown transaction exists in XLS-66 (report row 7 says so) |
| T2-4 | "During Redemption, withdraw capital plus accrued yield." | **HALF MET** | `CD270519367CD55D2818F91D1BD8389C4971DC7B01B3A9EEAE34E4D92DAB5591`, `tesSUCCESS`, tx date 842540982 > 842540960, so genuinely in Redemption. **But the accrued yield is exactly zero**: the lender deposited 5,000,000 and withdrew 5,000,000; `Vault.AssetsTotal` reads 5,000,000 at deposit and 5,000,000 after `LoanPay`. See gap G-3 |
| T2-5a | deck: "Show rejected VaultDeposit … during Investment" | **MET** | `7B9D16FA25DA3F54B7B3A13A63C21AB06775346264A4D1EC12228EBCFD709291`, `tecEXPIRED`, ledger 5255354, on the product vault |
| T2-5b | deck: "Show rejected … VaultWithdraw during Investment" | **MET ON CHAIN, NOT SURFACED** | Exists: `01F68F66C19823BCC8366A8B0AB7BE6573446DC875DA261411783FB228975D42`, `VaultWithdraw` `tecTOO_SOON`, public devnet, vault `A35C2342…`. It is only in `docs/research/v11-closed-ended.md:673`. **Absent from `README.md`, from `docs/evidence/*.json`, and from the pitch demo.** See gap G-1 |
| T2-5c | deck: "Show a rejected LoanSet during Redemption" | **MET** | `61FFF1E1E12CEF9924FB3F68E072292B6DD69B4DEE70F0F3903A71A09027B432`, `tecEXPIRED`, on the product vault. (Bonus: `LoanSet` during Subscription `tecTOO_SOON` `FB400B208663CFAC3CB3906A40BCBE03A1AE4CD2F4A68B233816ED90D3AAEEBD`, also only in research notes) |
| T2-6 | "Wrap the lifecycle in a credible use case." | **MET** | Agency securities lending with an indemnifying agent. Genuinely non-obvious: the vault asset is the security, not cash |
| T2-7 | "Make the on-chain lifecycle short enough to complete during the event, **while modelling the real-world duration in the UI or narrative**." | **NOT MET as shipped** | See gap G-4 |

### Flavour rules

| Requirement (verbatim) | Verdict | Evidence |
|---|---|---|
| "Loaded: the Vanilla baseline plus another ledger primitive, such as Permissioned Domains and Credentials, TokenEscrow, sponsored fees/reserves or MPTs." | **MET** for MPT / Credentials / Permissioned Domain; **weak** for Escrow | MPT security `005030892D3FABDAF2FBE7B6F2A3E0DBB6A69B504018B2C0`, `Flags 126` → `RequireAuth` set, verified. Domain `006858D1…`, carried onto the share issuance `0000000146F9D925…` whose `DomainID` is `1B3C6F07…`, verified by `ledger_entry`. Escrow: see gap G-5 |
| "Add another primitive only when it creates a meaningful use case or useful feedback about the integration." | MPT/Credentials/Domain yes (they generate F-013, F-014 and the borrower-eligibility gap). **Escrow generates neither** | no Escrow finding in `DEVELOPER-REPORT.md` or `FRICTION-LOG.md` |

### Submission deliverables

| Requirement (verbatim) | Verdict |
|---|---|
| "Public GitHub repository" | MET, `github.com/gamween/patapim` |
| "README covering what the project does, setup, track, environment, library version and **every XLS-65/66 transaction used**" | **PARTLY MET** — the table omits `LoanManage`, `VaultSet`, `VaultClawback`, `LoanBrokerCoverWithdraw`, all of which appear under `scripts/`. `LoanManage` appears only as prose links lower down |
| "Links to verified on-chain transactions" | MET, all verified by me |
| "Slide deck of up to 10 slides" | **NOT DONE** — `SUBMISSION.md` marks it ☐ |
| "Manual developer-feedback report at the repository root, maximum three pages" | MET in placement; **3-page limit at risk**: `DEVELOPER-REPORT.md` is 1,937 words plus five tables |
| "Completed DevEx feedback form with team members and GitHub handles" | **NOT DONE**, link reportedly unpublished |
| "Potential protocol security issues must be reported privately to a mentor before any presentation" | **NOT DONE** — `SUBMISSION.md` marks the borrower-eligibility gap ☐ |

## 2. Gaps, most serious first

**G-1 — The third required rejection is not in the submission artefacts.**
The deck demands a rejected `VaultWithdraw` during Investment. It exists on chain
(`01F68F66…`, verified `tecTOO_SOON`) but lives only in `docs/research/v11-closed-ended.md:673`,
a 660 KB research directory no judge will read. `README.md:56-57` instead says the gate is "in
`scripts/probe-t2.mjs`" — and `scripts/probe-t2.mjs` writes no evidence file at all (it only
`console.log`s, see its final loop at line ~96), so pointing at it hands the judge nothing.
`docs/evidence/recall-t2.json` has 13 events and none of them is a rejected `VaultWithdraw`.
Fix: add the row `| VaultWithdraw | refused during Investment | tecTOO_SOON | 01F68F66 |` to the
README table, and the `LoanSet`-during-Subscription row (`FB400B20…`) beside it.

**G-2 — `DEVELOPER-REPORT.md:22-24` says "same network" and it is not the same network.**
The report's headline finding claims the control `LoanSet` "succeeds with stable `xrpl.js@5.2.0`,
tx `42BDEBF81958D716070F1852CB5560A2DFBE05B017357838ACF35A9A3004A530`". I looked that hash up:
`txnNotFound` on the public devnet, `LoanSet tesSUCCESS` on the **custom hackathon devnet**
(`3.4.0-rc1`, `network_id 4001`). `docs/feedback/FRICTION-LOG.md:24` gets it right
("Repro, custom hackathon devnet"); the report compressed that away. The same report, finding 3,
argues the two networks enforce different rules — so a judge can reasonably object that the
positive control was run against a different build. The beta *failure* is reproduced on the public
devnet (`docs/research/v11-closed-ended.md`, "LoanSet via unpatched signLoanSetByCounterparty →
local reject"), but that failure is client-side and never reached a ledger, so there is no
public-devnet positive control at all. Fix: say "the identical transaction on the custom hackathon
devnet", and either run the stable-library control on the public devnet or state plainly that the
control is cross-network and why that is still conclusive (the rejection is local to the client).

**G-3 — The flagship lifecycle realises zero yield, and the README says the share price rises.**
`README.md` step 4: "The lenders' share price rises by the fee actually delivered."
On chain: `LoanPay` `CAF24C84…` was submitted with `Amount 2000001` but the meta moves exactly
2,000,000 (borrower `MPTAmount 12000000 → 10000000`, vault `3000000 → 5000000`), and
`Vault.AssetsTotal` reads `5000000` before and `5000000` after. The lender then withdrew
`5000000` for a `5000000` deposit. Price per share: 1.00 → 1.00. The cause is the loan being
repaid in full at 842540712, 38 s before the first payment was even due, so 22 s of accrual at 5 %
on 2,000,000 rounds to nothing on an `AssetScale: 0` token. The brief's bar item 4 is "withdraw
capital plus accrued yield" and the Track 2 feedback question is "Did cash-basis accounting behave
as expected: realised interest on payment rather than at origination?" — both are answered only in
`docs/research/v11-closed-ended.md` §11.1 (`LoanPay` `DA26AE7F…`, `AssetsTotal 80000000 →
80000226`), not in anything the README shows. Fix: either raise `InterestRate`/principal so the
flagship run realises a visible fee, or delete the "share price rises" sentence and put the
§11.1 table in the README as the cash-basis evidence.

**G-4 — The "model the real-world duration in the UI or narrative" requirement is not met anywhere
a judge will look.** The UI block exists (`web/app/vault/[id]/page.tsx:171`, guarded on
`meta.term_days`) and `web/lib/ledger.ts:167 vaultData()` parses it out of `Vault.Data`. But:
the evidence vault `6B79B084…` has `Data` = `526563616C6C2064656D6F207661756C74` = **"Recall demo
vault"**, not JSON — so the block renders nothing; `scripts/demo.mjs` (the pitch harness) writes
`Data: hex('patapim')`, also not JSON — so the pitch vault renders nothing either. Only the
*uncommitted working-tree* edit to `scripts/recall-spine.mjs:81` writes
`{"n":"patapim","term_days":90,…}`, and that script has not been run since. Nothing in `README.md`,
`DEVELOPER-REPORT.md` or `web/app/page.tsx` states a real-world term (grep for "90 day", "term_days",
"real-world" returns nothing outside `web/lib` and the working-tree script). Fix: add one sentence
to the README ("a 90-day securities loan compressed to five minutes") and make `demo.mjs` write the
same JSON `Data` as `recall-spine.mjs`.

**G-5 — The collateral escrow can never go back to the borrower, and the README says it does.**
`README.md` step 4: "the borrower returns the securities with the fee and **recovers the
collateral**"; the Loaded table calls it "held bilaterally". The actual object, `EscrowCreate`
`387AFEE307549019CAE5555EE5599894BA75B3BCFEB0925C33AF8125BBD380FC`:
`Destination` = the agent, `FinishAfter 842540720`, **no `CancelAfter`, no `Condition`**.
Per xrpl.org EscrowCancel: "If the corresponding EscrowCreate transaction did not specify a
`CancelAfter` time, the EscrowCancel transaction fails." So the 20 XRP is irreversibly destined for
the agent; after `FinishAfter` anyone may `EscrowFinish` and it pays the agent. I confirmed the
escrow is still sitting unspent under the borrower's `account_objects` right now. No `EscrowFinish`
or `EscrowCancel` appears anywhere outside `scripts/experiments/batch-delegation-escrow-2.mjs`.
Fix: add `CancelAfter` (or a crypto-condition) so the return leg is real, run the `EscrowFinish`
in the flow, or downgrade the README wording to "posts XRP into a time-locked escrow to the agent"
and drop "bilaterally" and "recovers".

**G-6 — `README.md` contradicts its own evidence on both the cover rate and the credential scheme.**
(a) "That is finding F-014 …, and it is why **this vault is configured at one hundred percent**."
The flagship broker `055FDE07…`, read live, is `CoverRateMinimum: 10000` — **ten** percent
(`scripts/recall-spine.mjs:93`). Only `scripts/demo.mjs:80` uses 100000. As written the README
claims the ten-percent configuration is the hundred-percent one.
(b) "Vault shares **inherit the underlying security's authorisation gate**, so eligibility on the
security is eligibility on the lender position. There is no second credential scheme."
False as built: the security MPT `00503089…` has `DomainID: null` and gates by `RequireAuth` +
explicit `MPTokenAuthorize`; the *vault share* issuance `0000000146F9…` carries
`DomainID 1B3C6F07…`, set on `VaultCreate`. The market maker **is** authorised on the security
(it holds 10,000,000 TBL, it repaid in TBL) and was still refused `tecNO_AUTH` at `VaultDeposit`
(`D4C93863…`) — precisely because the credential/domain is a second, independent scheme. The
sentence inverts the mechanism the demo depends on.

**G-7 — Reproducibility against the mandated library.** `package.json` declares
`"xrpl": "^5.2.0-beta.0"`, which semver-matches stable `5.2.0` (`npm view` confirms). The lockfile
saves you for `npm ci` / `npm install`, but the brief says the beta is *required* and the team's own
finding 2 says stable "cannot model a closed-ended vault at all". Also `scripts/lib/lending.mjs:7-8`
imports `ripple-binary-codec` and `ripple-keypairs` directly while neither is a declared dependency —
they resolve only as transitive deps of `xrpl`. Fix: pin `"xrpl": "5.2.0-beta.0"` exactly and
declare the two codecs.

**G-8 — The pitch demo as scripted does not cover the Track 2 minimum bar.**
`scripts/demo.mjs` offers `deposit-ok`, `deposit-blocked`, `deposit-late`, `loan`, `impair`,
`default`, `state`. There is **no** `withdraw` step (bar item 4), **no** rejected `VaultWithdraw`
(bar item 5), **no** rejected `LoanSet` in Redemption (deck item 06) and no `LoanPay`. Its
`redemptionDate` is `subscriptionDate + 600`, i.e. ten minutes past the boundary, which a 4- or
5-minute pitch cannot reach. Separately, `scripts/demo.mjs:139` prints
`price per share = assets / shares` — it does **not** net off `LossUnrealized`, which is the exact
bug commit `ec7464f` fixed in `web/lib/ledger.ts:121`. Run `demo.mjs impair` on stage and the
harness prints 1.00 while the dashboard next to it prints 0.60.

**G-9 — `docs/evidence/default-arc-*.json` mislabels its own impairment steps.**
The row `"step": "LoanManage impair (too early)"` records `tesSUCCESS`, and the row
`"step": "LoanManage impair"` records `tecNO_PERMISSION`. I verified the flags:
`5227A096…` / `A3734858…` carry `Flags 131072` (`tfLoanImpair`) and succeeded;
`03933F6D…` / `C9F00989…` carry the same flag and failed **because the loan was already impaired**,
not because it was early. `scripts/default-arc.mjs:111` still calls the first one "(too early)".
Commit `3b07635` recorded the corrected understanding in prose but never fixed the labels, so the
evidence file now reads as "impairment was rejected" to anyone opening it.

**G-10 — `web/lib/config.ts:15 DEMO_VAULT` points at a fully drained vault.** Live read of
`6B79B084…`: `AssetsTotal` absent (0), share issuance `OutstandingAmount "0"`, phase permanently
`redemption`. `readVault()` returns `pricePerShare: null` and `utilisation: null`. Anyone who
clones the repo and runs `npm run dev` sees an empty dashboard. Also its on-chain `Data` still says
**"Recall demo vault"** — the pre-rename product name, visible on the explorer page the PR links to.

## 3. Minor / presentation

- `README.md` and `DEVELOPER-REPORT.md` quote Track **1**'s bar ("execute a drawdown", report
  row 7) while submitting Track 2. Correct as a documentation finding, but label it as Track 1's bar.
- `web/README.md` is an internal handoff ("**Mine, tell me before changing**", "Do not fight the
  structure"). It is committed to a public submission repo and reads as team-internal.
- `DEVELOPER-REPORT.md` at 1,937 words + 5 tables is on the edge of the mandated 3 pages. Render it
  to PDF and measure before submitting.
- The `LoanBroker` in the flagship run has `CoverRateLiquidation: 100000` and `CoverRateMinimum: 10000`;
  the default-arc runs vary only `CoverRateMinimum`. F-014's claim ("the rate, not the balance,
  decides") is supported by the two arcs — 10 % absorbed 200,000 of a 2,000,000 loan, 100 % absorbed
  all of it — and I verified every hash in both files.

## 4. What I verified and found sound

- All 13 hashes in `docs/evidence/recall-t2.json`: validated, correct transaction type, correct
  result code, all on public devnet.
- All 8 hashes in each of `docs/evidence/default-arc-cover100000.json` and
  `default-arc-cover10000.json`: validated on public devnet, flags match the claimed intent.
- All 12 spot-checked hashes from `docs/research/v11-closed-ended.md` §11: every one validated on
  public devnet with the stated result code, including the `tecNO_PERMISSION` for a schedule that
  would end inside the 60 s redemption buffer (`38AC1C60…`) and the accepted one beside it
  (`13823CD6…`).
- `DEVELOPER-REPORT.md` finding 3's two hashes: `59496BAE…` `tesSUCCESS` on the custom devnet,
  `DD751B83…` `tecNO_PERMISSION` on the public devnet, network ids and build versions as claimed.
- `D587939404…` `VaultWithdraw tecINSUFFICIENT_FUNDS` on the public devnet, as the report states.
- `web/lib/ledger.ts` `PHASE_RULES` matches the on-chain matrix I verified, gate by gate.
