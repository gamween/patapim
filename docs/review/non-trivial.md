# Review: "non-trivial use of XLS-65/66", patapim against the field

Reviewer slug `non-trivial`. Written 2026-09-12, against the repository at commit `a45d5cd`
(`scripts/recall-spine.mjs` was edited under me mid-review; I judged the state on disk at the time
of reading, which already contains the added `VaultWithdraw`-during-Investment gate at line 102).

Everything below is checked against the live public Devnet (`https://s.devnet.rippletest.net:51234/`,
`build_version` 3.4.0-rc5, `network_id` 2), against `server_definitions`, against the live
documentation, and against six other repositories from this event.

---

## 1. The baseline: what a competent team actually ships here

Three sources, in increasing order of usefulness.

### 1.1 The official code samples are the floor, and they are higher than we assumed

`XRPLF/xrpl-dev-portal/_code-samples/lending-protocol/js/` is copy-paste ready and, in
`lendingSetup.js` alone, already does:

- `MPTokenIssuanceCreate` (lines 96-104) — an **MPT as the vault asset**
- `PermissionedDomainSet` with `AcceptedCredentials` (lines 107-115)
- `CredentialCreate` × 3 and `CredentialAccept` × 3 (lines 121-193)
- `VaultCreate` with `Flags: tfVaultPrivate` **and** `DomainID` (lines 202-208)
- `LoanBrokerSet`, `VaultDeposit`, then `createLoan.js` with two-party signing, `loanPay.js`,
  `loanManage.js`, `coverDepositAndWithdraw.js`, `coverClawback.js`

**Consequence for us:** three of the four primitives we bill as the "Loaded" half — MPT vault asset,
Credentials, Permissioned Domain — are the documented default path, not a differentiator. A team
that reads the tutorial gets them in an afternoon. Our escrow leg is the only one off that path,
and see §3.3 for how thin it is.

### 1.2 The reference application does *not* cover Track 2

`ripple/xrpl-reference-app-lending-sav` (cloned, `main`): grep for `VaultKind`,
`SubscriptionDate`, `RedemptionDate`, `closed-ended` → **zero hits**; grep for `DomainID`,
`CredentialCreate`, `PermissionedDomain`, `Escrow` → **zero hits**; `package.json` pins
`"xrpl": "^4.6.0"`, which cannot type the closed-ended fields at all. It has Auth0 + MongoDB,
three role dashboards, API routes, XRP/IOU/MPT assets, `LoanManage` default and cleanup.

So a Track 1 team can fork a production-grade app and be at the minimum bar in an hour. A Track 2
team has to write the closed-ended machine itself. **Track 2 is intrinsically the harder track and
we are on it.** That is real and we should say it once, plainly, in the pitch.

### 1.3 The actual field at this event (the only baseline that counts)

Six sibling repositories, all created 2026-09-12, found by GitHub search:

| repo | track / flavour | what it has |
|---|---|---|
| `edenbd1/article-18` | **2, Loaded** | closed-ended ELTIF fund, **two lenders**, 15 logged tx, all six phase gates as rejections, credential + domain gate, three `LoanPay` with `tfLoanLatePayment`, XLS-68 sponsored-fee experiments, HTML fact sheet, `FEEDBACK.md` with 8+ findings and a `repro/` directory |
| `charlyppr/xrpl-lending` ("Exit Lane") | 1, Loaded | secondary market in vault shares via **two crossed escrows on one PREIMAGE-SHA-256 condition**, 10 findings each with a hash |
| `frytegg/xrpl-vault-fragility-oracle` | — | third-party solvency rating / capital gate over XLS-66 vaults |
| `jninom8/recognitium-xrpl-hackathon` | — | private agreements + receipts, TS front end |
| `MylittleQueercat/XRPL_Lending_Protocol_Hackathon_Project` | — | "Raise", TS, PR-based workflow, design pass |
| `DVB-Ali-Noe/hackathon_xrpl_lending` | — | empty at 13:35 |

The median of *that* field is: one script that walks the lifecycle, a README with hashes, a thin
front end, a feedback file with three to five findings. The **top** of that field is `article-18`,
which is a direct architectural neighbour of ours and beats us on two axes (multi-lender, all six
gates in one canonical run) while losing on others (XRP asset not a security, no default arc, no
live ledger-reading dashboard, no contribution-back PR that I could find).

---

## 2. Where we clearly clear the bar

Each of these is verified, not asserted.

1. **The closed-ended machine is real and it is ours.** `VaultKind: 1` + `SubscriptionDate` +
   `RedemptionDate` on chain, vault `6B79B084…C13C`, read back live today: `VaultKind: 1`,
   `SubscriptionDate: 842540660`, `RedemptionDate: 842540960`, `LEVersion: 1`. Phases judged
   against the **parent ledger close time**, not `Date.now()` — `scripts/recall-spine.mjs:14-23`
   and `web/lib/ledger.ts:22-26`. Most teams will get this wrong once; we wrote the reason down.

2. **The vault asset is a require-auth MPT security, and the pseudo-account problem is solved.**
   `MPTokenIssuanceCreate` with `RequireAuth` (`scripts/recall-spine.mjs:44`), issuance
   `005030892D…B2C0` live with `Flags: 126`. The non-obvious part — the vault pseudo-account is
   never authorised by the issuer and does not need to be — is established in
   `docs/research/mpt-vault-asset.md:143-170` with the rippled source and a deposit hash. This is
   above the sample, which creates a plain `CanTransfer|CanClawback|CanTrade` MPT with no auth gate.

3. **The gate is carried where we say it is.** Live read of share issuance
   `0000000146F9D925863F75B121DD5CC34317A24B7611EDA8` returns
   `"DomainID": "1B3C6F07…96C8"`, `Flags: 60` (`RequireAuth|CanEscrow|CanTrade|CanTransfer`). The
   README claim is literally true on the ledger.

4. **The default arc, run twice, is the best thing in the repository.** Two full arcs differing only
   in `CoverRateMinimum`, with per-step vault/broker snapshots
   (`docs/evidence/default-arc-cover{100000,10000}.json`). Nobody else in the field has an
   impairment-to-default arc at all, let alone a parameter sweep. The numbers reproduce the
   documented formula exactly (§3.1), which is itself a good sign.

5. **The dashboard computes NAV correctly.** `web/lib/ledger.ts:112-119` nets `LossUnrealized` off
   `AssetsTotal`, and the loan-status derivation (`:141-156`) adds an "overdue" state the explorer
   does not have. Read-only, server-rendered, four traced RPC calls. That is a real product surface,
   not a mock.

6. **The phase table we ship matches the authoritative one.** `web/lib/ledger.ts:37-52` against
   `https://opensource.ripple.com/docs/lending-protocol-v1-1/closed-ended-vaults` — identical.

---

## 3. Where a sharp judge pushes back

Ordered by how much damage it does.

### 3.1 BLOCKER — two headline findings are contradicted by live documentation, and by our own notes

**(a) First-loss capital.** `DEVELOPER-REPORT.md` (section "What the protocol made hard", 2nd item)
says the cover-rate behaviour is "the most expensive misunderstanding in XLS-66, and nothing in the
field tables corrects it", and proposes "document the default settlement arithmetic with a worked
example".

It is documented, in three places:

- `https://xrpl.org/docs/concepts/tokens/lending-protocol` → "First-Loss Capital" carries
  `DefaultCovered = min((DebtTotal x CoverRateMinimum) x CoverRateLiquidation, DefaultAmount)`
  **with a full worked example** (1,090 / 10% / 10% → 10.9 covered, 1,079.1 lost). Verified live:
  `curl https://xrpl.org/docs/concepts/tokens/lending-protocol | grep "DefaultCovered      = min"`
  → hit.
- The same page's field list already says `CoverRateLiquidation` is "the maximum percentage of the
  minimum required cover *(DebtTotal x CoverRateMinimum)* that will be placed in the asset vault to
  cover a loan default". The reference page
  `docs/references/protocol/ledger-data/ledger-entry-types/loanbroker.md:70-72` repeats it.
- **Our own research note** `docs/research/xls66-spec.md:655-657` and `:739-753` transcribes the
  formula *and* the same worked example, attributed to XLS-66 §3.1.11.

Our measured numbers are the formula, exactly: 10% run, `min(2,000,000 × 0.1 × 1.0, 2,000,000) =
200,000`, observed cover 1,000,000 → 800,000; 100% run, `min(2,000,000 × 1.0 × 1.0, 2,000,000) =
2,000,000`, observed 2,500,000 → 500,000. We reproduced the spec and reported it as an undocumented
trap.

And `edenbd1/article-18`'s `FEEDBACK.md` §8 is the **same finding**, measured the same way
(5 XRP cover, 10%/50%, effective coverage 5%). Two teams, one jury, same item — the one who frames
it honestly wins it.

*What survives, and is still worth a finding:* the **naming**. `CoverRateMinimum` is described as
"the percentage of debt that must be covered" — a posting floor — and nothing at the point of use
says the same number is also the liquidation base, so a broker can hold 10× the capital it will
ever pay. Re-write as: "the arithmetic is correct and documented on the concepts page; the field
name and the `LoanBrokerSet` reference page are where a developer actually looks, and neither says
the floor doubles as the cap. Proposal: one sentence on the `LoanBrokerSet` and `LoanBroker` pages,
and a link from the field table to the worked example." That version is defensible in front of the
person who wrote the page.

**(b) The share-price formula.** The report says "the correct formula exists only in the source.
*Proposal: put the net asset value formula on the vault concepts page*". It **is** on the vault
concepts page: `https://xrpl.org/docs/concepts/tokens/single-asset-vaults`, section "Exchange
Algorithm", `// ExchangeRate = (AssetsTotal - LossUnrealized) / SharesTotal`, with a $1.0m / $900k
worked example and a two-rate (deposit vs withdrawal) explanation. Verified live by grep. Our own
`docs/research/prior-art-local.md:205` and `docs/research/rippled-source.md:494` already had it.

*What survives:* the `Vault` **reference** page (`ledger-entry-types/vault.md:59,62`) defines
`AssetsTotal` and `LossUnrealized` with no pointer to the exchange algorithm, and `vault_info`
returns neither NAV nor share price — so a developer who starts at the reference page, as we did,
ships the wrong number. Keep the experience, drop the "documented nowhere" claim, change the
proposal to "cross-link the reference fields to the exchange algorithm, and return NAV from
`vault_info`".

**(c) Third, smaller, same class.** The smaller-things table says `VaultCreate` "costs 2 XRP on one
hackathon network and 0.2 XRP on the other, documented on neither". The mechanism is documented —
`docs/concepts/accounts/pseudo-accounts.md:35`: an owned pseudo-account "increases the owner's XRP
reserve by one incremental owner reserve … in addition to any other reserve requirements" — and the
per-network value is one call away: `server_state` returns `reserve_inc` 200000 on public Devnet and
2000000 on the hackathon Devnet (both checked today). Re-frame as "the cost is a reserve, not a fee,
and nothing on the `VaultCreate` page says how many increments it takes", or drop it.

This matters more than any code issue on this list: the rubric is 40% feedback quality, and a judge
who opens one tab can retire two of our six headline items.

### 3.2 SERIOUS — the flagship run delivers no yield, so the Track 2 minimum bar is not fully evidenced

Track 2 minimum bar item 4 is "During Redemption, withdraw capital **plus accrued yield**".

On chain, in our own canonical run: `VaultDeposit` 5,000,000 TBL
(`CE5C7E59…`), `VaultWithdraw` delivered **5,000,000 TBL** (`CD270519…`, `Amount.value` "5000000",
vault `AssetsTotal` 5,000,000 → 0). The `LoanPay` (`CAF24C84…`) moved `AssetsAvailable`
3,000,000 → 5,000,000 and left `AssetsTotal` at 5,000,000: **the vault received principal and
nothing else.** Price per share never left 1.00000000.

Cause: `InterestRate: 5000` (5%) over a 60-second `PaymentInterval` on an `AssetScale: 0` token —
the periodic interest is ~0.14 units (the ledger itself prints `PeriodicPayment
"1000000.142695042164"`, live on loan `A7920C44…`), and the loan was closed early with
`tfLoanFullPayment` after ~20 seconds. The fee truncates to zero.

Two claims ride on it and are currently false on chain:
- `README.md`, "The trade" step 4: "The lenders' share price rises by the fee actually delivered."
- `web/app/page.tsx:36` (STEPS "Return"): same sentence.

`article-18` does not have this problem: their lenders redeem "principal + yield" over three real
`LoanPay`s. This is the single most quotable gap between us and the nearest competitor.

### 3.3 SERIOUS — the escrow leg is one transaction, and two claims exceed it

`EscrowCreate` appears exactly once in the product path (`scripts/recall-spine.mjs:112-115`,
hash `387AFEE3…`): 20 XRP, `Destination` = agent, `FinishAfter: base + 120`, no `Condition`, no
`CancelAfter`, no link to the loan, and **no `EscrowFinish` or `EscrowCancel` anywhere outside
`scripts/experiments/`**. It is also created *after* `LoanSet`, so it collateralises nothing even
narratively.

Claims that exceed it:
- `web/app/page.tsx:34` "The collateral is released." — no transaction releases it.
- `README.md` "the borrower returns the securities with the fee **and recovers the collateral**".
- The dashboard mapping row `['Collateral', 'Escrowed XRP', 'held bilaterally, released on return']`.

For contrast, `charlyppr/xrpl-lending` built two crossed escrows sharing one PREIMAGE-SHA-256
condition to make a share swap atomic. That is what "Loaded with TokenEscrow" looks like when the
primitive is load-bearing. Ours is decoration, and a judge who asks "show me the release" gets
nothing. Either close the loop or downgrade the language to "a collateral escrow is posted; release
and forfeiture are out of scope for the demo".

### 3.4 SERIOUS — the guardrail we advertise is never demonstrated

`web/app/page.tsx:26` and `README.md` step 2: "The ledger refuses to originate **any** loan the
cover cannot absorb."

- As a general statement it is false, and our own 10% arc proves it: cover 1,000,000, loan
  2,000,000 originated `tesSUCCESS`, cover absorbed 200,000, lenders lost 1,800,000.
- As a statement about a 100%-cover configuration it is true but **unevidenced**: there is no
  rejected `LoanSet` in any evidence file. Every rejection we ship is a phase gate.
- It cannot even fire on the live demo vault: broker `055FDE07…` reads `CoverRateMinimum: 10000`,
  `CoverAvailable: "500000"`, `DebtMaximum: "4000000"` — minimum required at the ceiling is 400,000,
  below the cover, so the guardrail is unreachable by construction.

### 3.5 The live demo vault contradicts the narrative in three ways

`web/lib/config.ts:15` points at `6B79B084…C13C`. Read live today:

- Its broker is at **`CoverRateMinimum: 10000`** — 10%, the configuration the README calls the one
  where "the lenders lose" — while the landing page says the cover is "sized at one hundred percent
  of the loan" and the README says "it is why this vault is configured at one hundred percent".
  A judge who clicks "Open the live vault" lands on the ten-percent vault.
- Its `Data` decodes to **"Recall demo vault"** and the security metadata to "Recall demo T-Bill" /
  "Recall demo transfer agent" — the pre-rename branding, rendered by our own dashboard, which reads
  the name from the ledger (`web/lib/ledger.ts:163-175`).
- It is fully wound down: `AssetsTotal` absent (0), shares outstanding 0, loan paid off. The
  dashboard's headline demo is an empty vault.

`scripts/demo.mjs provision` fixes all three on the morning, but `DEMO_VAULT` is a hand-edited
constant; if the provisioning run is skipped or the paste is missed, this is what the jury sees.

### 3.6 The rest of the "we don't do it" list, ranked by whether anyone will care

| gap | will a judge care? |
|---|---|
| single lender, single deposit | **yes** — the pitch is a *pool*; `article-18` has two lenders for ten extra lines |
| no yield delivered (§3.2) | **yes** — it is a minimum-bar line |
| no wallet signing; seeds in scripts | **some** — the brief v2 lists `xrpl-connect` and a browser extension under Resources; nobody at this scale will have it, but "how would a real lender sign?" is a likely Q&A question |
| no secondary transfer of shares | **some** — a rival built exactly this; our shares *are* transferable (`Flags: 60`), so it is an unexercised capability, not an impossibility |
| no oracle, no permissioned DEX leg | no |
| fictitious security | no — everyone's is |
| `VaultSet`, `VaultClawback`, `LoanBrokerCoverWithdraw`, `LoanDelete`, `VaultDelete`, `tfLoanLatePayment`, `tfLoanOverpayment`, `CloseInterestRate`, `LoanOriginationFee` all unused in the product path | **mildly** — they are in `scripts/experiments/` but not in the story; `article-18` uses `tfLoanLatePayment` in its canonical run |

### 3.7 Two small factual wrinkles

- `README.md`: "Vault shares inherit the underlying security's authorisation gate … **There is no
  second credential scheme.**" We do run a second scheme: `patapim.eligible.v1` credential +
  permissioned domain, and it is that scheme — not the MPT gate — that produces our `tecNO_AUTH`
  (`D4C93863…`, an account that *is* authorised on the security but holds no credential; in
  `demo.mjs` the "outsider" is deliberately built that way). The sentence is true about the ledger
  mechanism and misleading about our own demo. Rephrase to "a holder needs both: the issuer's
  authorisation on the security, and the agent's credential to enter the pool".
- Dead code: `scripts/recall-spine.mjs:10` imports `nowRipple`, never used; `:30-31` define `t0`
  and `el()`, never called.

---

## 4. Verdict on the rubric line

**Above the bar on XLS-65/66 surface; at or slightly below the top of this field on the things the
rubric weights most.**

- *Non-trivial use of XLS-65/66*: **clearly cleared.** Closed-ended `VaultKind: 1` machine, all
  three phases and four distinct rejection codes on chain, first-loss cover posted and consumed,
  impairment and default with a measured parameter sweep, an MPT-security vault asset with
  require-auth, two-party `LoanSet` signed with our own counterparty encoder because the mandated
  library cannot. That is more XLS-66 state machine than the reference app exercises and more than
  any sibling repo I read.
- *Verifiable transactions on Devnet*: **cleared**, with the yield caveat in §3.2.
- *Creativity / use case (20%)*: **good but not unique.** Securities lending is a sharper story than
  "vault + loan", but `article-18`'s ELTIF Article 18(1) mapping is at least as sharp and comes with
  market numbers. Our differentiator is the **indemnity** — the agent's own capital repaying the
  vault — and it is the only part of the pitch nobody else has. Lead with it.
- *Developer feedback (40%)*: **this is where we are exposed**, not because the report is thin but
  because §3.1 makes two of its six headline items retractable in one browser tab, and one more is
  duplicated by a competitor.

## 5. The two highest-value additions before the freeze

**#1 — Make the fee real, in one extra provisioning run. (fixes §3.2, and two false claims)**

Add a close/prepayment fee to the loan so an early full return actually pays the pool. `LoanSet`
accepts `CloseInterestRate`, `ClosePaymentFee`, `LoanServiceFee`, `LatePaymentFee` (confirmed in
`server_definitions.TRANSACTION_FORMATS.LoanSet` on rc5); we use none of them. With
`CloseInterestRate: 2000` (2%) on a 2,000,000 principal, the `tfLoanFullPayment` return delivers
~40,000 units the vault keeps, `AssetsTotal` goes 5,000,000 → 5,040,000, price per share 1.00 →
1.008, and the lender withdraws more than they put in. That single field turns "withdraw capital
plus accrued yield" from a claim into a hash, and adds a fifth XLS-66 field to the transaction
inventory.

*Effort:* one line in `scripts/recall-spine.mjs` / `scripts/demo.mjs`, plus one ~8-minute devnet
run you are doing anyway to refresh `DEMO_VAULT`. *Risk:* low-medium — confirm on the run that the
close fee lands in the vault and not in the broker's pocket (read `AssetsTotal` before/after; if it
goes to the broker, fall back to raising `InterestRate` and stretching `PaymentInterval` so the
interest exceeds one unit). Do it once, early, and if it misbehaves you have lost eight minutes and
can ship the current wording minus the yield sentence.

**#2 — In the same run, prove the cover guardrail and add a second lender. (fixes §3.4 and the
biggest structural thinness)**

- Guardrail: with `CoverRateMinimum: 100000` and cover 2,500,000, submit a `LoanSet` for 3,000,000
  (inside `DebtMaximum` 4,000,000) and record the rejection. That is the "first-loss cover
  behaviour" guardrail the brief names by name, it is the only non-phase rejection we would own, and
  it makes "the ledger refuses to originate a loan the cover cannot absorb" a hash instead of a
  sentence — while forcing the sentence to be qualified correctly ("at a hundred percent cover
  rate").
- Second lender: fund one more wallet, one more `CredentialCreate`/`Accept`, one more
  `VaultDeposit` at a different size, and let both redeem. Ten lines, and the vault stops being a
  one-person vault. It also gives the dashboard a second `?holder=` position to show live.

*Effort:* ~30 lines, same run as #1. *Risk:* low. The only unknown is the rejection code for
insufficient cover (expect `tecINSUFFICIENT_FUNDS` or `tecNO_PERMISSION`); whatever comes back is
the finding, so there is no way to lose.

**Explicitly not recommended before the freeze:** closing the escrow loop (§3.3). `EscrowFinish`
against a `FinishAfter` you have to wait out, on a devnet you cannot fast-forward, in the last hours,
for a primitive that is decoration in the story — the cheaper fix is to soften three sentences.

**Free and mandatory regardless:** the §3.1 rewrites. They cost writing time, no ledger risk, and
they protect 40% of the score.
