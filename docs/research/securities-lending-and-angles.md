# Securities lending market thesis + use-case bake-off

Slug: `securities-lending-and-angles`. Compiled 2026-09-12, XRPL Lending Protocol Hackathon (Paris).

**Method.** Every claim carries a primary source: a company press release, a GitHub comment fetched
through the GitHub GraphQL API, a line of `rippled` source, or a live RPC call made today against the
two hackathon networks. Secondary press is used only where a primary source is paywalled, and is
labelled as such. Anything I could not verify is in §9 Open questions, not in the body.

---

# PART 1 — THE MARKET THESIS BEHIND "RECALL"

## 1. Tokenised securities that exist on XRPL today

### 1.1 Aviva Investors USD Liquidity Fund — VERIFIED, live, 29 July 2026

Primary source: Aviva Investors company news,
<https://www.avivainvestors.com/en-gb/about/company-news/2026/07/aviva-investors-launches-tokenised-share-class-for-usd-liquidity-fund/>
(fetched 2026-09-12; the page 403s to WebFetch, it must be curled with a browser UA).

Verbatim:

> "Aviva Investors has launched a tokenised share class for the Aviva Investors US Dollar (USD)
> Liquidity Fund, allowing investment in the fund in tokenised format, on the XRP Ledger"

> "The launch was supported by Komainu who provided regulated institutional digital asset custody,
> with tokenisation infrastructure provided by Licuido"

> "As part of this launch, the new tokenised share class has also been approved by the Central Bank
> of Ireland (CBI), marking a regulatory first with regards to tokenised fund structures."

> "The Fund, which was initially launched in its 'traditional' structure in 2020, targets low-risk
> returns and daily liquidity by offering investors exposure to high-grade US dollar-denominated
> short-term debt instruments. The new share class will be available to eligible investors with
> digital wallets, with all assets held by the fund's custodian, The Bank of New York Mellon."

Ripple quote in the same release, **Nigel Khakoo, SVP Trading and Markets**:

> "This is a landmark moment for fund tokenisation. Aviva Investors has demonstrated that it is
> possible to bring a regulated, institutional-grade tokenised product to market on live
> infrastructure, with real investor protections in place."

Facts a jury will accept: first Aviva fund tokenisation; XRPL; CBI-approved; BNY custody of the
underlying; Komainu digital custody; Licuido tokenisation. Aviva Investors AUM £246bn at 30 Jun 2025
(same page). The Ripple/Aviva partnership was announced earlier in 2026 — Ripple's own later release
says "earlier this year"; press reports date the partnership announcement to 11 February 2026
(secondary, e.g. Cointelegraph/Yahoo coverage).

**Three corrections to how the Recall concept currently uses this datapoint:**

1. The release does **not** say the tokens are non-transferable. "Available to eligible investors
   with digital wallets" is an eligibility statement. The "not freely transferable / digital twin"
   framing comes from secondary press, not from Aviva. Do not assert it on stage.
2. The release says nothing about collateral, lending or repo. The "next step" argument must be
   sourced from Ripple (§2), not from Aviva.
3. A USD **liquidity (money-market) fund** share class is not a securities-lending *supply* asset.
   Nobody borrows MMF shares to sell them short. What institutions do with an MMF share is **post it
   as collateral**. See §4.3 — this reframes Recall from "securities lending" to the
   **collateral-upgrade / collateral-transformation** segment of securities lending, which is the
   correct and defensible framing.

### 1.2 Ripple's investments in a transfer agent and in collateral mobility — VERIFIED, 3 August 2026

Primary source: Ripple press release,
<https://ripple.com/ripple-press/ripple-strengthens-digital-capital-markets-infrastructure-with-investments-in-zilo-and-licuido/>
dated 3 August 2026, full text curled 2026-09-12.

The two targets: **ZILO** (global transfer agency technology) and **Licuido** (tokenisation and
trading platform). Verbatim from the release:

> "Together, these deals are bringing regulated transfer agency, issuance, and collateral mobility to
> Ripple's infrastructure on the XRP Ledger (XRPL)."

> "Issuers, investors and liquidity providers all face the same constraints: collateral that sits
> idle instead of being put to work, settlement that takes longer than it should, and no easy way to
> unlock liquidity and mobilize collateral securely, confidentially, and compliantly."

> "Tokenized funds can be used as collateral from the point of issuance, and trades settle atomically
> on the XRPL"

> "ZILO's transfer agency and fund administration technology ... giving institutions the regulated
> record they need to **run lending and collateral markets** with confidence."

> "Licuido's platform gives traditional financial assets, including fund shares, the same portability
> and utility already available to other asset classes ... so they can move freely as digital
> collateral through onchain atomic settlement infrastructure."

Brian Lynch, CEO and Co-Founder, Licuido:

> "Ripple's backing helps us to scale that infrastructure and our collateral marketplace, on the
> XRPL, helping institutions turn assets that have sat idle on their balance sheets into liquidity
> they can actually use."

Also in the release: Ripple "defining the token standard" for the Aviva work; RLUSD is "the regulated
cash leg for delivery-versus-payment transactions".

**Both claims in the Recall concept are verified**: Aviva tokenising a dollar liquidity fund
(29 Jul 2026) and Ripple investing in a transfer agent (ZILO) and in collateral mobility (Licuido)
(3 Aug 2026), six weeks before this hackathon.

## 2. What Ripple has said about the step *after* issuance

### 2.1 The money quote — Nigel Khakoo, 3 August 2026

> "Tokenization of assets is only the starting point: the real value lies in what can be done with a
> token, including buying, selling, and settling trades instantly, or **using it as collateral to
> borrow, lend, or post margin**," said Nigel Khakoo, SVP, Trading and Markets at Ripple. "Our
> partnerships with Aviva Investors, Franklin Templeton and DBS demonstrate how asset managers are
> focused on deploying tokenized fund structures at scale."

(Same URL as §1.2. This single sentence is the whole Recall thesis in Ripple's own words.)

### 2.2 Ripple's lending-protocol manifesto — 29 June 2026

<https://ripple.com/insights/the-xrpl-lending-protocol-bringing-credit-infrastructure-onchain/>
(full text curled 2026-09-12).

> "But moving an asset onchain is only half the job. Real financial markets depend on what happens
> next: borrowing against assets, putting them to work as collateral, accessing liquidity without
> having to sell. That layer — lending and credit — barely exists onchain yet, and its absence is
> what stops tokenized markets from functioning like real capital markets"

> "In traditional markets, those are separate systems. Custody and issuance live in one place.
> Financing — **repo, margin lending, structured credit, working capital facilities** — runs through
> another. That second layer is what makes assets productive, not just portable."

> "The protocol supports first-loss capital at the facility level. Pool administrators or
> underwriters put junior capital at risk ahead of senior liquidity providers."

> "Institutions handle the credit judgment off-chain, while the protocol standardizes execution once
> terms have been agreed."

Named worked examples in that post: payment provider bridging a 48-hour settlement window; market
maker financing inventory without selling; treasury deploying idle assets. **Securities lending is
not among them** — which is precisely the whitespace.

### 2.3 The single best fact in this whole document — a judge is building the sibling product

**Shota (Ripple), who ran the Lending Protocol workshop at this hackathon and is on the jury, wrote
on 12 August 2026 in XRPL-Standards discussion #589 ("Amendment XLS: On-Chain Cosigner"):**

> "Hey Brett, Shota here from ripple - product manager for cosigner. Yes, this is solving a real
> problem we're hitting. **We're building repo settlement on XRPL where counterparties need to
> co-sign an atomic Batch transaction.** Today, all wallets involved in a settlement flow have to be
> on the same custody instance for the off-chain signature orchestration to work. That's fine for a
> pilot with a small number of parties, but it breaks down quickly: once the issuer, the
> participants, and the transfer agent each use their own custody platform (which is the realistic
> institutional setup), there's no protocol-native way to coordinate signatures across them. ...
> **Ripple custody will be the immediate customer.** More names will be going public as we work
> through onboarding and contracting."

Source: <https://github.com/XRPLF/XRPL-Standards/discussions/589>, comment by GitHub user
`Shotaripple`, created `2026-08-12T10:53:10Z`. Retrieved verbatim today via
`gh api graphql` against `XRPLF/XRPL-Standards` discussion 589. Discussion opened 2026-07-23 by
`shawnxie999` (Shawn Xie, Zhiyuan Wang, Chenna Keshava B S, Mayukha Vadari).

Two consequences for us:

- **Securities lending is the sibling of repo.** Repo = sell-and-repurchase against cash. Securities
  lending = lend the security against collateral. Same desks, same collateral schedules, same
  tri-party agents, same default/buy-in mechanics. Recall is the adjacent product to the one the
  judge is personally shipping.
- **It tells us how to build the signing leg.** Shota's stated primitive is "co-sign an atomic Batch
  transaction". `LoanSet` inside a `Batch` (consent from `BatchSigners` instead of
  `CounterpartySignature`) is exactly that, it is legal today on both nets
  (`BatchV1_1` enabled; `docs/research/xls66-spec.md:390-395`), and almost nobody will demo it.

In the same thread, `Tapanito` (an XLS-66 author) posted a caveat we should quote in our feedback:

> "In addition, this proposal does not solve the requirements for the Lending Protocol. Conceptually,
> when a proposal to issue a loan is created on-chain, the funds for that loan must be reserved so
> that once the transaction is signed, the funds are guaranteed to be available for the Loan."

(`Tapanito`, 2026-08-06, same discussion.) That is an *unfunded-commitment* gap in XLS-66 and it is
adjacent to our headline finding.

## 3. Is anyone already building securities lending — on XRPL, or on chain at all?

### 3.1 On XRPL: nobody is doing securities lending. Verified by enumeration.

Searched `XRPLF/XRPL-Standards` discussions via GitHub GraphQL for `securities lending`, `collateral`
and `repo` (2026-09-12):

| Hit | # | Date | What it actually is |
|---|---|---|---|
| `0066 XLS-66d: XRP Ledger-native Lending Protocol` | 190 | 2024-04-12 | the amendment itself |
| `Ecosystem Proposal: Ward Protocol — Deterministic Default Resolution for XLS-66` | 474 | 2026-02-16 | an **insurance / default-resolution** layer: XLS-20 policy NFTs (taxon 281), PREIMAGE-SHA-256 escrow, 9-step claim validation. Not securities lending. |
| `Amendment Idea: Native Risk Sleeve for XRPL Credit Facilities` | 617 | 2026-09-03 | a proposal to mandate an XRP sleeve in vault collateral baskets. Not securities lending. |
| `Amendment XLS: On-Chain Cosigner` | 589 | 2026-07-23 | Shota's repo-settlement thread (§2.3) |
| `Collateralised Loans` | 259 | 2024-12-13 | pre-XLS-66 idea |

The only named XRPL lending businesses are **Clearpool + Cicada Partners + Ripple** (announced
Aug 2026 — Clearpool supplies infrastructure, Cicada underwrites, Ripple invests; borrowers are
"fintech and payment companies"; loans in RLUSD; building on Devnet), and **Evernorth** (XRP supply
side). Neither is securities lending. **VS1 Finance** is publicly designing bond tokenisation on the
primitives. Whitespace confirmed.

XLS-66's own abstract is explicit that this is **not** a collateral protocol
(`XLS-0066-lending-protocol/README.md:21-23`):

> "The protocol offers straightforward on-chain **uncollateralized** fixed-term loans... This version
> intentionally skips the complex mechanisms of automated on-chain collateral and liquidation
> management."

and §4.1 "Uncollateralized Lending" justifies it. **This is the single biggest honesty constraint on
Recall** and must be addressed head-on, not papered over (§4.4).

### 3.2 Off XRPL: it is the hottest thing in capital markets right now

- **HQLAᵡ** (Deutsche Börse-backed, R3 Corda): the incumbent DLT securities-lending/collateral-swap
  platform. First live securities lending transaction on Corda with Credit Suisse and ING (2018);
  Deutsche Börse-HQLAᵡ platform live transactions with UBS and Commerzbank swapping baskets of German
  government bonds against corporate bonds (Nov 2019). Mechanism: legal title moves by transferring a
  **Digital Collateral Record (DCR)**; the securities never leave their custodian. Permissioned,
  bilateral, not a public ledger.
  <https://www.hqla-x.com/post/redefining-collateral-mobility>
- **Canton Network**, blog dated **8 September 2026** — four days before this hackathon —
  <https://www.canton.network/blog/onchain-collateral-repo-tokenization>: DTCC plus 30+ market
  participants ran live production trades including intraday US Treasury repo (~15–20 minutes) and
  securities lending. Stephane Pellerin, BNP Paribas: *"We acted as the lender in an intraday
  securities lending transaction involving US Treasuries tokenized by the DTCC Tokenization
  Service."* Steven Hood, Marex: *"With tokenization and repo done on the Canton Network, you can do
  a repo for four hours. You can do a repo over the weekend."*

**Read this correctly.** It is not "someone already did it, pick something else". It is: the entire
institutional market moved into on-chain collateral in the last eight weeks, Ripple bought the
plumbing for it six weeks ago, a Ripple PM is building the repo half of it — and **the XRPL has no
securities-lending story at all**. That is the pitch.

### 3.3 Regulatory tailwind with a date on it

SEC Rule **10c-1a** securities-lending transparency: reporting compliance date extended to
**28 September 2026**, public dissemination to **29 March 2027** (SEC exemptive order 28 Jul 2025);
FINRA's reporting system is **SLATE**. Source: Dechert OnPoint,
<https://www.dechert.com/knowledge/onpoint/2025/8/sec-extends-compliance-deadlines-for-securities-lending-transpar.html>
— *"The reporting deadline was extended from January 2, 2026 to September 28, 2026, and the
dissemination deadline from April 2, 2026 to March 29, 2027."*

**Sixteen days after this hackathon, every US securities loan becomes a reportable event.** On XRPL
every loan is already a public ledger object with a hash. That is a free slide.

### 3.4 Market size

- S&P Global Market Intelligence, H1 2026: securities-lending revenue **US$8.799bn**, +33% YoY;
  average balances **US$4.054tn**, +34% YoY (reported by Securities Finance Times / Finadium).
- EquiLend, H1 2026: record **US$9.1bn**.

Two vendors, two numbers, same order of magnitude — quote one and name the vendor. Use ~US$4tn of
balances and ~US$9bn of half-year revenue.

## 4. Agency securities lending, precisely enough to survive a Ripple jury

### 4.1 The trade

1. A **beneficial owner** (pension fund, insurer, UCITS, ETF) owns securities that sit idle.
2. A **lending agent** — usually the custodian bank — runs the programme under a master agreement
   (GMSLA in Europe, MSLA in the US), lends out of a pooled or segregated programme, and splits
   revenue with the owner. Typical split ranges **50/50 for small programmes to 90% to the lender for
   large ones** (Callan, "Securities Lending 101").
3. A **borrower** — a broker-dealer, prime broker or market maker — borrows to cover a short, make a
   delivery, or upgrade collateral.
4. The borrower posts **collateral at 102% of value for US loans, 105% for non-US loans**, marked to
   market daily with mark-up/mark-down (Callan; and standard agency lending agreements filed with the
   SEC).
5. Economics: with **cash collateral**, the lender pays the borrower a **rebate** and keeps the
   reinvestment spread. With **non-cash collateral**, the borrower pays a **pre-negotiated lending
   fee**. (Callan.)
6. Loans are usually **open** — recallable on demand — or, less often, **term**.
7. **Recall**: the owner can demand the security back, to sell it or to vote it. The borrower must
   return equivalent securities within the market settlement cycle.
8. **Borrower default**: the agent applies the collateral to **buy in** equivalent securities in the
   market. If the collateral falls short, **borrower-default indemnification** makes the owner whole
   out of the agent's own balance sheet. Finadium: *"in the event of a counterparty default, the
   agent would first use the available collateral (typically collateralized from 102-105%) to
   repurchase the client's securities or return an equivalent amount of cash"*; if insufficient,
   *"the agent lender would use its own capital"*. Indemnification is **contingent and unfunded** —
   it is a balance-sheet promise, and regulation (leverage ratio, HQLA buffers) has made it
   expensive.
9. Named risks: counterparty default, **cash-collateral reinvestment loss** (the thing that actually
   blew up in 2008), liquidity mismatch, operational failure.

### 4.2 The mapping, restated so it holds

| Recall | XRPL object | Honest verdict |
|---|---|---|
| Lendable pool of a tokenised security | Closed-ended `Vault` whose `Asset` **is the security** | **Correct and strong.** XLS-65 vaults are single-asset and asset-agnostic. Nobody has demoed a vault whose asset is a security. |
| Lending agent | `LoanBroker` (owns the vault, sets `CoverRateMinimum`/`CoverRateLiquidation`, counter-signs) | **Correct.** The agent's economic role — origination, servicing, loss absorption, fee — is exactly the LoanBroker's. |
| Borrower-default indemnification | `LoanBrokerCoverDeposit` first-loss cover, **denominated in the security itself** | **Directionally right, and actually stronger than TradFi.** But say it precisely: TradFi indemnity is *unfunded and contingent*; XLS-66 cover is *pre-funded and on-ledger*. Frame it as "we replace a balance-sheet promise with posted capital a regulator can see" — that is a feature, and it is true. |
| Buy-in after default | Collateral sells on the **permissioned DEX** to repurchase the security and rebuild cover | **Correct mechanic**, with a hard technical constraint — see §4.5. |
| Settlement / fail window | `GracePeriod` | **Approximate.** `GracePeriod` is the window after a missed *payment* before `tfLoanDefault` is allowed. Call it the "fail-to-return window", not "settlement delay", and say the analogy is approximate. Min 60s, `GracePeriod ∈ [60, PaymentInterval]` (`xls66-spec.md:220`). |
| Eligibility | `Credentials` + `PermissionedDomain`, private vault (`tfVaultPrivate` + `DomainID`) | **Correct.** Note the quirk: `DomainID` is stored on the **share `MPTokenIssuance`**, not on the `Vault` (`xls65-spec.md:587-588`). |
| Collateral valuation | XLS-47 `PriceOracle` | **Available.** `PriceOracle` and `fixPriceOracleOrder` verified ENABLED on both networks today via `feature` RPC. But XLS-66 never reads an oracle — the valuation is *our* off-ledger logic, published on-ledger. Say so. |
| Concentration limit | `CoverRateMinimum × CoverRateLiquidation` | **WRONG. Fix this before the pitch.** A concentration limit caps exposure to one issue or one borrower as a % of the programme. `CoverRate*` govern the adequacy of first-loss cover versus the broker's outstanding debt. They are different risk controls. Say instead: "`CoverRateMinimum` is our *capital adequacy* floor; concentration is enforced off-ledger by the agent and published in the loan memo." A collateral-desk person on the jury will catch this. |

### 4.3 Reframe the story: this is a collateral-upgrade trade, not equity short-cover

The borrower in the concept "needs quality collateral" and posts XRP. In the trade taxonomy that is a
**collateral transformation / collateral upgrade**: a party holding lower-quality or non-eligible
assets borrows HQLA to meet margin, repo or regulatory requirements, paying a fee. This is a large,
real, fee-based (non-cash-collateral) segment of securities lending, and it is the *only* segment in
which a money-market-fund share class is a sensible loan asset. It also matches Ripple's own words
("collateral that sits idle instead of being put to work"). Say "collateral upgrade" on stage and the
domain people relax.

Supporting fact for why a tokenised MMF share is a prized collateral asset: under EMIR's margin RTS
(Commission Delegated Regulation (EU) 2016/2251) **units or shares in UCITS are eligible collateral
for initial margin**, subject to conditions and concentration limits. Aviva's fund is a European
UCITS money market fund.

### 4.4 The thing a domain expert *will* attack, and the answer

**"XLS-66 loans are uncollateralised. Where is your 102%?"**

It is not in the loan object, and pretending otherwise is fatal. The honest architecture:

- The loan object carries the *security* leg (principal, fee, schedule, cover).
- The *collateral* leg lives in a separate on-ledger object. The concept says "tri-party multisig
  account". Better: **`TokenEscrow`** (`TokenEscrow` + `fixTokenEscrowV1` verified ENABLED on both
  networks today), which can hold IOU/MPT collateral with a finish condition and a cancel-after —
  a real tri-party agent analogue, enforceable by the ledger rather than by three signers'
  goodwill. It also buys us another amendment to stress.
- Say out loud: "XLS-66 deliberately has no collateral leg (spec §4.1). We built one *beside* it out
  of TokenEscrow and the permissioned DEX, and here is exactly where the seam leaks." That sentence
  is worth more than any feature, because it is the 40% criterion: cite the exact spot, propose the
  fix.

**Other expert objections to pre-empt:**

1. **The borrow fee is paid in securities.** XLS-66 repays principal + interest in the vault asset.
   If the asset is a fund share, the borrower must return *more shares than they borrowed*. In TradFi
   the fee is paid in cash. Answer: for a collateral-upgrade trade on an accruing MMF share this is
   defensible (the share accretes), but name the limitation and file it as feedback: **XLS-66 has no
   way to denominate the fee in an asset other than the loan asset.** That is a genuine spec gap for
   securities finance.
2. **"Recall" is the wrong name for a closed-ended, fixed-term structure.** In securities lending,
   *recall* is the lender's right to demand the security back on demand — the defining feature of an
   *open* loan. A closed-ended vault with a fixed `RedemptionDate` is the opposite. Either rename, or
   own it explicitly: "the ledger recalls for you — `RedemptionDate` is a hard, protocol-enforced
   recall date, which is what a term trade actually needs for LCR treatment." Pick one and say it in
   the first 20 seconds.
3. **No cash-collateral reinvestment risk.** Good — say so. It removes the one risk that actually
   caused losses in 2008. It is a real selling point and it is free.
4. **Fixed term is not a bug.** Term securities loans (>30 days) are exactly what borrowers pay up
   for, because term funding gets better liquidity-coverage treatment. Closed-ended vaults are the
   right primitive for term trades.

### 4.5 A hard technical constraint the concept currently violates

**Multi-Purpose Tokens cannot trade on the XRPL DEX.** XLS-33 deliberately scoped the DEX out;
DEX support is a separate, not-yet-live amendment (XLS-82, "MPT DEX Integration"). Verified today:
a `feature` RPC dump of all 106 amendments on **both** networks contains **no MPT-DEX amendment at
all** — only `MPTokensV1` and `DynamicMPT`.

Therefore: **if the tokenised security is an MPT, the permissioned-DEX buy-in leg is impossible.**
Recall must issue the security as a **trust-line (IOU) token** with a domain-gated order book
(`PermissionedDEX` verified ENABLED on both networks). Consequences:
- IOU vault ⇒ `Scale` is meaningful (it must be *absent* for XRP and MPT vaults).
- Private vault + `DomainID` + IOU is a supported combination (`xls65-spec.md:761-766`).
- The vault's *share* token is an MPT regardless — that is XLS-65's own design.

This is also good feedback material: **"the ledger lets you build a lending market in an asset it
cannot let you liquidate"** is a crisp, true, one-sentence finding about the MPT/DEX gap.

---

# PART 2 — USE-CASE BAKE-OFF

## 5. Scoring rules

Five axes, 0–5, weighted to mirror the actual rubric (40% feedback / 30% technical / 20% creativity):

- **A. Amendments exercised** — how many distinct amendments, and how non-trivially.
- **B. Minimum bar for free** — how much of the required spine (VaultCreate → VaultDeposit →
  LoanBrokerSet → CoverDeposit → LoanSet 2-sig → LoanPay → VaultWithdraw) the story needs *anyway*,
  versus bolting on.
- **C. 4-minute wall-clock demoability** on a live devnet where you cannot advance ledger time.
- **D. Originality.**
- **E. Developer-feedback yield** — how many untested seams it forces you across. This is 40% of the
  event score, so it is weighted double below.

### 5.1 The wall-clock budget, measured not guessed

From `rippled` constants recorded in our own source notes:

| Constant | Value | Source |
|---|---|---|
| `kMinPaymentInterval` | **60 s** | `docs/research/xls66-spec.md:218` |
| `kDefaultGracePeriod` / minimum | **60 s**, and `GracePeriod ∈ [60, PaymentInterval]` | `xls66-spec.md:220`, `:415` |
| `kMinInvestmentPeriod` (closed-ended) | **180 s** — `180 <= RedemptionDate - SubscriptionDate < 946708560` | `docs/research/v11-closed-ended.md:173-193` |
| `kLoanRedemptionBuffer` | **60 s** — `StartDate + PaymentInterval*PaymentTotal + 60 <= RedemptionDate` | `v11-closed-ended.md:304, 320` |

So:
- **Default is reachable in ~120 s** (first payment due at `StartDate + 60`, default allowed after a
  further 60 s grace). A full originate → miss → impair → default → cover-drawdown arc **fits in a
  4-minute demo**. This is the single most under-appreciated fact of the weekend.
- **A closed-ended vault's three-phase life costs 180 s minimum**, and a loan inside it must finish
  60 s before `RedemptionDate`. You can walk Subscription → Investment → Redemption in a demo, but
  you **cannot** also fit a comfortable default arc into the same 180 s. Budget one or the other, or
  pre-stage the vault before the timer starts.
- Drive everything from `ledger(ledger_index="validated").close_time`, never `Date.now()`
  (`v11-closed-ended.md:240, 790`).

## 6. The scorecard

| # | Use case | A. Amendments | B. Min bar free | C. 4-min demo | D. Original | E. Feedback (×2) | **Total /35** |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|
| 1 | Trade receivables finance | 2 | 5 | 5 | 1 | 2 (4) | **17** |
| 2 | Institutional term credit + first-loss | 2 | 5 | 4 | 1 | 3 (6) | **18** |
| 3 | Treasury yield on idle stablecoin | 1 | 3 | 5 | 1 | 2 (4) | **14** |
| 4 | Impairment, default and recovery | 2 | 5 | 4 | 2 | 5 (10) | **23** |
| 5 | Compliance-gated lending market | 4 | 5 | 4 | 2 | 4 (8) | **23** |
| 6 | Fixed-income pool (closed-ended) | 3 | 5 | 3 | 2 | 4 (8) | **21** |
| 7 | Private credit fund | 4 | 5 | 3 | 2 | 4 (8) | **22** |
| 8 | Seasonal / campaign financing | 2 | 4 | 5 | 2 | 3 (6) | **19** |
| 9 | Tokenised bond issuance | 3 | 4 | 4 | 3 | 4 (8) | **22** |
| 10 | Structured savings | 3 | 3 | 4 | 3 | 3 (6) | **19** |
| **11** | **Recall — securities lending / collateral upgrade** | **5** | **5** | **3** | **5** | **5 (10)** | **28** |

### 6.1 Notes per row (why the numbers are what they are)

1. **Trade receivables finance.** The deck's own first example. XLS-65/66 and nothing else. Every
   other team will build it. Zero new seams ⇒ zero new feedback.
2. **Institutional term credit with first-loss.** Same, plus `LoanBrokerCoverDeposit`. Some feedback
   value in cover accounting (`LossUnrealized` is omitted from JSON when zero — already one of our
   findings).
3. **Treasury yield on idle stablecoin.** Vault-only. It does not even need the loan half, so it
   *fails* the minimum bar rather than covering it. Beautiful UI, nothing to report.
4. **Impairment, default and recovery.** Highest feedback yield of the organizers' list: the
   impairment-timing change (XLS-66.2, `fixCleanup3_4_0`) is days old, and xrpl.org still documents
   the *pre-amendment* behaviour — we already logged this (`docs/research/docs-audit.md:320-328`).
   But as a *product* it is a test suite, not a story. Scores 20% creativity near zero.
5. **Compliance-gated lending market.** Genuinely Loaded: `Credentials`, `PermissionedDomains`,
   `tfVaultPrivate` + `DomainID`, `CredentialIDs` on `LoanSet`. Good feedback (the domain lives on
   the share issuance; stable xrpl.js lacks `CredentialIDs`). But it is the deck's own suggestion and
   the single most predictable "Loaded" move in the room.
6/7. **Fixed-income pool / private credit fund.** Closed-ended vaults are completely undocumented —
   `VaultKind`, `SubscriptionDate`, `RedemptionDate` return **zero** matches across xrpl.org
   (`v11-closed-ended.md:116`). Great feedback. Demo cost is the 180 s floor.
8. **Seasonal / campaign financing.** Runs into a real gap — XLS-66 has one uniform `PaymentInterval`
   and no bullet/balloon/irregular amortisation. That gap is worth reporting but the story is thin.
9. **Tokenised bond issuance.** MPT-as-vault-asset is thinly trodden, `DynamicMPT` is fresh, and it
   collides head-on with the MPT/DEX gap (§4.5). Decent.
10. **Structured savings.** Retail-flavoured; a Ripple jury optimising for institutional adoption
    will not reward it.
11. **Recall.** See §7.

## 7. The winner: Recall

### 7.1 Why it wins on each rubric line

**40% developer feedback.** Feedback quality is a function of how many untested seams you cross.
Every use case on the organizers' list lives inside one surface. Recall is the only candidate that
forces the ledger across **vault × loan × permissioned DEX × price oracle × token escrow × batch
co-signing × credentials/domain**, with a vault whose asset is a security rather than cash. Seams we
can already name before writing a line of code:

- A closed-ended vault enforces that the loan **schedule** ends before `RedemptionDate`
  (`kLoanRedemptionBuffer`, `v11-closed-ended.md:304`) but **not that the loan is repaid** — a lender
  can reach Redemption with an illiquid vault and `VaultWithdraw` fails `tecINSUFFICIENT_FUNDS`.
  Already verified by us with hashes. This is a **spec-level** finding, PR-able against
  `XLS-0066-lending-protocol`, and it is *the* securities-lending failure mode (a loan that outlives
  the fund's redemption date).
- Spec/implementation divergence next door: the spec text says only "strictly before
  `RedemptionDate`" and never mentions the 60 s `kLoanRedemptionBuffer`
  (`v11-closed-ended.md:345-346`). A schedule ending 30 s before redemption satisfies the spec and is
  rejected by the ledger. Concrete, citable, fixable.
- **MPTs cannot be liquidated on the DEX** (§4.5) — the ledger will let you originate a lending
  market in an asset class it gives you no way to buy in.
- **The fee cannot be denominated separately from the principal** (§4.4.1) — a real securities-finance
  requirement XLS-66 has no field for.
- `Tapanito`'s own unfunded-commitment caveat (§2.3) is the same family of problem; quoting an XLS-66
  author back at the jury is strong.
- Bonus DevEx bug found while scoping the tri-party signer design, see §8.

**30% technical execution — "non-trivial use of XLS-65/66".** A closed-ended, credential-gated vault
whose asset is a tokenised security, whose first-loss cover is denominated in that same security, and
whose loans are originated by a `LoanSet` **inside an atomic `Batch`** (the co-signing path, not
`CounterpartySignature`) is close to the least trivial thing these two amendments can be made to do.
`BatchV1_1` is enabled on both nets and the Batch path for `LoanSet` is real
(`xls66-spec.md:390-395`: inner `Fee` must be `"0"`, `Counterparty` required, consent from
`BatchSigners`).

**20% creativity and use case — "a lending story that would go live and get traction".**
Six weeks ago Ripple bought a transfer agent and a collateral-mobility platform, explicitly "to run
lending and collateral markets". Its SVP of Trading and Markets said the value of a token is "using
it as collateral to borrow, lend, or post margin". A judge is building repo settlement on XRPL and
said so in public on 12 August. Aviva's UCITS money market fund went live on XRPL on 29 July with
BNY as custodian. The one thing missing from that stack is the lending/collateral-upgrade layer on
top of the fund share. Recall is that layer, and it is not a hypothetical market — it is
US$4tn of balances and ~US$9bn of half-year revenue, with US reporting going live 16 days from now.

**10% presentation.** The narrative writes itself in three beats: *(1) Ripple put a UCITS money
market fund on XRPL in July. (2) Ripple bought the collateral plumbing in August and said the point
of a token is to lend it. (3) Here is the first securities loan of that fund share on XRPL — and here
are the four places the ledger is not ready.*

**Bonus for contributing back.** Two PR-able artefacts fall straight out: a spec patch to
`XLS-0066-lending-protocol` for the redemption/repayment gap and the undocumented
`kLoanRedemptionBuffer`, and a reusable code sample for `LoanSet`-inside-`Batch` co-signing — which
is literally what Shota said Ripple Custody needs.

### 7.2 What Recall must give up to be demoable in four minutes

C scored only 3, and that is the honest weakness. Mitigations, in order:

1. **The security is an IOU, not an MPT** (forced by §4.5).
2. **Pre-stage the vault and the domain before the clock starts.** Create the permissioned domain,
   issue credentials, create the closed-ended vault and fund the cover off-camera. The demo starts at
   the first deposit.
3. **Pick one timed arc, not two.** Either the three-phase closed-ended walk (180 s) *or* the
   default/buy-in arc (120 s). Recommendation: run the **default/buy-in arc live** (it is the
   dramatic one and it ends on the permissioned DEX), and show the closed-ended illiquidity finding
   from **pre-recorded transaction hashes** that the audience can verify in the explorer.
4. **Drive the clock from `ledger.close_time`.**

### 7.3 The hedge, if the room wants safety

Build Recall's *plumbing*, pitch the **compliance-gated closed-ended securities lending facility** —
which is simultaneously organizer use cases 5, 6, 7 and 9 on the scorecard. If the DEX buy-in leg
fails on stage, you still have four of the organizers' own use cases covered, the full minimum bar,
and every finding intact. The buy-in is the encore, not the load-bearing wall.

---

## 8. DevEx friction found while doing this research

### 8.1 `feature` RPC reports permanently-active retired amendments as `"enabled": false`

**Where.** `feature` RPC on both hackathon networks. Verified 2026-09-12:

```
$ curl -s -X POST https://s.devnet.rippletest.net:51234/ -d '{"method":"feature","params":[{"feature":"Escrow"}]}'
{"result":{"07D43DCE529B15A10827E5E04943B496762F9A88E3268269D69C44BE49E21104":
  {"enabled":false,"name":"Escrow","supported":true},"status":"success"}}
```

Full disabled list on public Devnet (17 of 106): `CryptoConditions, CryptoConditionsSuite,
EnforceInvariants, Escrow, FeeEscalation, FlowCross, MultiSign, PayChan, SortedDirectories, TickSize,
TrustSetAuth, fix1201, fix1368, fix1373, fix1512, fix1523, fix1528`. Identical on the Track 1
hackathon net for the feature entries.

**Why it is wrong.** Every one of those is declared retired in
`include/xrpl/protocol/detail/features.macro` — `XRPL_RETIRE_FEATURE(Escrow)` is line 132, with
`MultiSign`, `PayChan`, `CryptoConditions`, `TickSize`, `TrustSetAuth` in the same block, under the
comment *"The following amendments have been active for at least two years. Their pre-amendment code
has been removed and the identifiers are deprecated."* They are unconditionally active. Yet
`feature` says `enabled: false`.

**Why it bit us.** Recall's tri-party collateral leg needs multi-signing and `TokenEscrow`. A
preflight amendment check — the exact thing the workshop tells you to write — concludes that
`MultiSign` and `Escrow` are unavailable on Devnet and sends you to redesign around them. Both work
perfectly. Note the inconsistency that makes it worse: other retired features in the same block
(`Clawback`, `DepositAuth`, `DepositPreauth`, `Checks`, `ExpandedSignerList`) *do* report
`enabled: true`, so the output looks authoritative rather than obviously broken.

**Proposed fix.** In `doFeature`, emit retired amendments as
`{"enabled": true, "retired": true, "supported": true}` — sourcing `retired` from the
`XRPL_RETIRE_FEATURE` / `XRPL_RETIRE_FIX` macro lists — or, minimally, add
`"note": "retired: permanently active"`. Second-best, and cheap: document on
`xrpl.org/docs/references/http-websocket-apis/public-api-methods/server-info-methods/feature` that
`enabled: false` on a retired amendment means "active, pre-dates the amendment table", and list them.

### 8.2 xrpl.org has no page telling you MPTs cannot trade on the DEX

`MPTokensV1` is enabled, MPTs carry a "Can Trade" capability flag, and `VaultCreate` happily accepts
`Asset: {mpt_issuance_id}`. Nothing in the XLS-65/66 material warns that the resulting asset has no
order book, because DEX support is a separate unactivated amendment (XLS-82). A developer designing a
lending market around a tokenised security discovers this only when the liquidation leg fails.
**Proposed fix:** one admonition block on the MPT concept page and on the XLS-65 `Asset` field
documentation: *"MPTs cannot currently be traded on the DEX or AMM (XLS-82 not yet active). If your
vault asset must be liquidatable on-ledger, use a trust-line token."*

### 8.3 The Aviva press page 403s to ordinary fetchers

Minor, but it cost time: `avivainvestors.com` returns HTTP 403 without a browser `User-Agent`. Worth
knowing for any team citing it in a deck.

---

## 9. Open questions (unverified — do not assert these)

1. **Which XRPL token standard the Aviva share class actually uses** (MPT vs trust line). Ripple's
   3 Aug release says Ripple is "defining the token standard", but no primary source names it. This
   matters: if it is an MPT, the real instrument cannot be liquidated on the DEX today (§4.5).
2. **Whether the Aviva tokens are transferable.** Secondary press says "not freely transferable";
   the Aviva release does not say it.
3. **Exact date of the Ripple/Aviva partnership announcement** — press says 11 Feb 2026; I did not
   find the Ripple primary release for it.
4. **Whether an IOU vault's pseudo-account auto-creates the trust line** on first `VaultDeposit`, or
   whether the issuer must authorise it (`RequireAuth` interplay). Untested — this is on the critical
   path for Recall and should be probed first thing.
5. **Whether `PermissionedDEX` offers can be placed by a vault or LoanBroker pseudo-account**, which
   the buy-in leg needs. Untested.
6. **Whether `TokenEscrow` accepts the same IOU while the issuer has `RequireAuth`/domain gating on.**
   Untested.
7. Whether ISLA's own H1 2026 market report confirms the S&P/EquiLend figures — the ISLA PDF is not
   machine-readable from here.
