# jury-and-social — who judges us, what they are pushing, what to put on the slides

Research date: 2026-09-12. Every claim below carries a URL, a PR number, a commit hash or a
live-ledger query. Anything I could not verify is in "Open questions" at the bottom.

---

## 1 · The people

### 1.1 Maxime Dienger — Ripple, Senior Developer Advocate. Wrote the brief, ran the XRPL workshop.

| fact | source |
|---|---|
| GitHub `krkmu`, name "Max", bio **"Software & blockchain Engineer \| Dev Advocate @Ripple"**, company Ripple, location London, blog `https://www.krkmu.dev/`, X `@krkmu_` | `GET https://api.github.com/users/krkmu`, 2026-09-12 |
| Pinned repo `RippleDevRel/xrpl-js-python-simple-scripts` | https://github.com/krkmu |
| Former president of KRYPTOSPHERE, ESILV fintech alumnus, first functional ring-signature implementation on XRPL | https://www.esilv.fr/une-equipe-de-lesilv-distinguee-a-ethdenver-2025-une-2%E1%B5%89-place-sur-la-track-ripple/ |

**He built the feedback pipe that is installed in this repo.** `RippleDevRel/xrpl-devex-hook`
("XRPL DevEx Capture: participant hook for Coding Agents (Hackathon)") — his public events show
him pushing to it on 2026-09-10 and 2026-09-11, i.e. the two days before the event
(`GET https://api.github.com/users/krkmu/events/public`). The config names our event:

```json
// https://raw.githubusercontent.com/RippleDevRel/xrpl-devex-hook/main/hook/devex.config.json
{ "event": "btf-paris-2026-09",
  "focus_features": ["xls-65", "xls-66"],
  "endpoint": "https://xrpl-devex.maximed.workers.dev", ... }
```

`maximed.workers.dev` — his own Cloudflare account. **He is the consumer of our feedback, and he
reads it as SQL, not prose.** From `docs/TAXONOMY.md` in that repo, verbatim:

> "Every row that lands in D1, from any channel, carries these classification fields. **This is
> what makes post-event analysis a SQL query instead of a reading exercise.**"

The columns he will group by: `surface` ∈ {protocol, docs, sdk, infra, tooling, unknown};
`friction_type` ∈ {retry_loop, doc_gap, wrong_model, expectation, error_message, dead_end,
workaround, docs_broken, terminology, timing, praise, raw}; plus `feature`, `evidence`
(observed | reported | inferred), `channel`, `tx_type`, `result_code`, `attempts`,
`elapsed_seconds`, `failed`.
Source: https://github.com/RippleDevRel/xrpl-devex-hook/blob/main/docs/TAXONOMY.md

**He also runs the divergence tracker.** `krkmu/xrplf-activity-summary` — "XRPL Monday Brew ☕",
published at https://xrplbrew.com, "weekly brews on Mondays, daily espressos Tuesday through
Friday", generated with Claude. It tracks **rippled, xrpl.js, xrpl-py, xrpl-dev-portal, clio,
XRPL-Standards, xrpl4j and `ripple/opensource.ripple.com`** and pulls amendment lifecycle from
**two** sources — "rippled's `features.macro`" and "xrpl.org's `known-amendments.md`".
Source: https://raw.githubusercontent.com/krkmu/xrplf-activity-summary/main/README.md

> Read that again. His hobby project exists to reconcile *what rippled implements* against *what
> the spec says* against *what the docs say*. A finding shaped like that divergence lands in his
> own mental model with zero translation cost.

His own writing voice, from the 2026-08-31→09-06 brew — note the standing disclaimer he repeats
every week:

> "*Note: All rippled changes below were merged to the `develop` branch and are not yet live on
> the network. A tagged release is required for any change to reach production.*"
> "*…treat the feature as merged-but-pending-release and phrase availability accordingly.*"

Source: https://raw.githubusercontent.com/krkmu/xrplf-activity-summary/main/output/2026-08-31_2026-09-06.md

**Adjacent interest, out of scope for us:** he is the author of the Machine Payments Protocol
(`krkmu/mpp-specs`, `krkmu/mpp`, `ripple/xrpl-mpp-sdk`, `RippleDevRel/agentic-mpp-demo`), all
pushed 2026-09-05 → 2026-09-09. The organizers put MPP/agentic tooling out of scope — do not
build on it, but know that agentic payments is his current obsession and that he cares about how
coding agents experience XRPL (the hook has per-agent adapters for Claude Code, Cursor, Codex,
GitHub Copilot and Grok).

### 1.2 "Shota" — Ripple, Product Manager. Ran the Lending Protocol workshop.

GitHub handle **`Shotaripple`** (account created 2024-08-01, no public repos, no public events —
he surfaces only in discussion comments). Identified in
https://github.com/XRPLF/XRPL-Standards/discussions/589 ("Amendment XLS: On-Chain Cosigner",
opened by `shawnxie999` 2026-07-23), comment dated **2026-08-12T10:53:10Z**, verbatim:

> "Hey Brett, **Shota here from ripple - product manager for cosigner.** Yes, this is solving a
> real problem we're hitting. **We're building repo settlement on XRPL where counterparties need
> to co-sign an atomic Batch transaction.** Today, all wallets involved in a settlement flow have
> to be on the same custody instance for the off-chain signature orchestration to work. That's
> fine for a pilot with a small number of parties, but it breaks down quickly: once the issuer,
> the participants, and the transfer agent each use their own custody platform (which is the
> realistic institutional setup), there's no protocol-native way to coordinate signatures across
> them. … **Ripple custody will be the immediate customer.** More names will be going public as we
> work through onboarding and contracting."

This is the single most useful sentence in the whole research pass. **The man who ran the Lending
Protocol workshop is, by his own words, a product manager shipping repo settlement with
multi-party co-signing of atomic Batch transactions.** "Recall" (securities lending, tri-party
collateral, two-signature LoanSet) is the same trade family. Say "repo" and "tri-party" out loud.

Press coverage of the same comment (weaker source, use the GitHub link instead):
https://finance.yahoo.com/markets/crypto/articles/ripple-building-repo-settlement-xrpl-122146506.html

### 1.3 XLS-65 and XLS-66 authors

Both specs, identical header line:

```
author: Vytautas Vito Tumas <vtumas@ripple.com>, Aanchal Malhotra <amalhotra@ripple.com>
```

- XLS-65 "Single Asset Tokenized Vault", created 2024-04-12, **updated 2026-09-08**, status Draft.
  https://raw.githubusercontent.com/XRPLF/XRPL-Standards/master/XLS-0065-single-asset-vault/README.md
- XLS-66 "Lending Protocol", created 2024-10-18, **updated 2026-09-09**, status Draft,
  `implementation: https://github.com/XRPLF/rippled/pull/5270`.
  https://raw.githubusercontent.com/XRPLF/XRPL-Standards/master/XLS-0066-lending-protocol/README.md

**Vito Tumas** = GitHub `Tapanito` (name "Vito Tumas", company Ripple). He is the active
maintainer: he authored the last three merged spec commits and merged two of them **the day
before the hackathon**:

| merged | sha | commit |
|---|---|---|
| 2026-09-11T15:12:56Z | `e299c3386` | XLS-65: Add MemoData field to VaultDelete (#470) |
| 2026-09-11T15:09:50Z | `6e9b9edd5` | XLS-66: Update impairment logic (#496) |
| 2026-09-04T12:16:47Z | `53f744f4a` | xls-66: fix equation (23) to include managementFee_overpayment (#495) |

(`GET https://api.github.com/repos/XRPLF/XRPL-Standards/commits?path=…`)

The body of XRPL-Standards#496, verbatim, is a confession of an economic attack — **and it says
where the report came from**:

> "A broker can 'impair' a loan immediately after it is created. Because the minimum grace period
> is only 60 seconds, the broker can force a default before the borrower has any realistic time to
> make the first payment. **(This issue was reported from the Bug Bounty Program)** … a broker
> colluding with the borrower can repeatedly impair and unimpair an overdue loan to keep pushing
> the due date forward without recording any payment. This permanently blocks default eligibility
> … leaving the vault and its depositors with an uncollectable exposure."

That is the exact genre of our headline finding (a closed-ended vault can reach Redemption while
illiquid). **They pay for findings in this shape and they merged one yesterday.**

**Aanchal Malhotra** — co-author on both specs, `amalhotra@ripple.com`. No public GitHub activity
found under an obvious handle (see Open questions).

**rippled implementation** — PR https://github.com/XRPLF/rippled/pull/5270 "Lending Protocol
implementation XLS-66", opened 2025-01-31 by `ximinez` (**Ed Hennis**, Ripple), merged
**2025-12-02T16:38:17Z**. Reviewers: `Bronek`, `Tapanito`, `dangell7`, `gregtatcam`, `ximinez`.
Ed Hennis is the person Reece Merrick pointed at for "XRPL lending protocol overview"
(https://x.com/reece_merrick/status/2002221544056262987).

Other names that recur on the lending surface, worth knowing if they walk past the table:
`a1q123456` (author of the closed-ended vault implementation and the batch-lending PR),
`mvadari` (Mayukha Vadari — authored the counterparty signature-prefix fix), `shawnxie999`
(On-Chain Cosigner XLS author), `YogiBearXRP` (filed the open vault-invariant issue).

---

## 2 · The narrative Ripple is pushing right now

### 2.1 "Security-first road to mainnet" — this is the frame, and it is six weeks old at most

RippleX, "The Road Toward Mainnet: A Security-First Approach to XRPL Lending Protocol",
J. Ayo Akinyele, **2026-06-18**.
https://dev.to/ripplexdev/the-road-toward-mainnet-a-security-first-approach-to-xrpl-lending-protocol-3bn6

Verbatim, the load-bearing lines:

> "As XRPL continues to grow in complexity and the value secured by the network increases, we
> recognized that the previous model was no longer sufficient. **Advances in AI are also rapidly
> reducing the cost of vulnerability discovery, making it increasingly important to identify
> issues as early as possible in the development lifecycle.**"

> "The Lending Protocol (XLS-66) and Single Asset Vault (SAV) - XLS-65 are among the first major
> amendments to undergo this full review process, **making them some of the most rigorously tested
> amendments in XRPL's history.**"

> "Single Asset Vault is a foundational primitive that looks simple on the surface (deposit,
> withdraw, get shares) but is **deeply complex in practice because it introduces a share price
> model that creates new economic attack surfaces everywhere it touches another feature.**"

The ten phases, with numbers we can cite:

| phase | dates | outcome |
|---|---|---|
| Halborn SAV audit | 2025-02-17 → 2025-03-13 | 7 findings: 2 Critical, 1 High, 2 Medium, 1 Low, 1 Info |
| **Immunefi Attackathon** | launched 2025-10-27, $200,000 in RLUSD, 35,498 lines of C/C++ in scope | **455 submissions, 131 researchers, 94 unique valid findings: 15 Critical · 19 High · 17 Medium · 20 Low · 23 Insights** |
| Halborn re-audit | from 2025-12-15, one month | — |
| Mainnet release + validator voting | 2026-01-28/29, rippled v3.1.0 | — |
| **XRPL Commons independent test** | March 2026 | **"257 test cases across 10 categories … 257 out of 257 tests passed, representing a 100% pass rate"** |
| AI Red Team + bug bounty | 2026-03 → 2026-05 | 20 tickets, 7 confirmed bugs; "an inverted invariant that would have allowed phantom collateral to go undetected, a fee-free network spam vector in LoanPay, and a node deadlock via integer overflow"; "a confirmed first-depositor vault attack" |
| Formal verification, Common Prefix, Lean 4 | 8 weeks, Feb–Apr 2026 | "exposed subtle edge cases … including **vault invariant violations**, loan payment assertion failures, arithmetic rounding errors, and **discrepancies between the XLS specification and the implementation**" |
| Partner adoption | — | Evernorth, SOIL, VS1.Finance |

And the commitment that puts our Track 2 work inside their current release:

> "Building on the findings from v1.0, **we are planning a v1.1 enhancement amendment** to
> incorporate partner feedback and operational learnings. The release includes both user-facing
> improvements and targeted protocol enhancements and is **scheduled for Q3 this year.**"

Q3 2026 is now. `LendingProtocolV1_1` is enabled on both hackathon networks (verified below).

### 2.2 Where the amendment actually stands — verified live today

```
POST https://xrplcluster.com/  {"method":"feature"}        # mainnet, 2026-09-12
SingleAssetVault    enabled=false  supported=true
LendingProtocol     enabled=false  supported=true
BatchV1_1           enabled=false  supported=true
PermissionDelegationV1_1 enabled=false supported=true
```

Vote counts, https://api.xrpscan.com/api/v1/amendments, 2026-09-12:

| amendment | yes | threshold | introduced |
|---|---|---|---|
| BatchV1_1 | 26 | 28 | 3.3.0 |
| PermissionDelegationV1_1 | 19 | 28 | 3.3.0 |
| **SingleAssetVault** | **15** | 28 | 3.1.0 |
| **LendingProtocol** | **12** | 28 | 3.1.0 |

Press corroboration (weaker, but gives the percentage the room will have heard): "The Lending
Protocol amendment is currently undergoing validator voting with 31.43% of tokens cast"
— https://coingape.com/xrp-news-xrp-ledger-eyes-major-v3-4-0-upgrade-with-lending-protocol-next-week/ (2026-09-11).
Same article: **v3.4.0 ships "next week"**, carrying Lending Protocol v1.1; and XRPL Operations
ran an X Space on **2026-09-11 at 13:00 EST** with XRPLF CTO Angell Denis, RippleX's Ayo Akinyele
and Jazzi Cooper, and **Vito Tumas**.

> The headline: **the amendment they most want on mainnet is the one with the fewest votes.**
> 12 of 28. Anything that materially de-risks it is worth more to these judges than anything
> that merely looks good.

### 2.3 What both hackathon networks actually have (verified live, 2026-09-12)

```
Track 1  https://lending-hackathon.dev.ripplex.io:51234     Track 2  https://s.devnet.rippletest.net:51234/
SingleAssetVault          enabled=true                      SingleAssetVault          enabled=true
LendingProtocol           enabled=true                      LendingProtocol           enabled=true
LendingProtocolV1_1       enabled=true                      LendingProtocolV1_1       enabled=true
BatchV1_1                 enabled=true                      BatchV1_1                 enabled=true
PermissionDelegationV1_1  enabled=true                      PermissionDelegationV1_1  enabled=true
fixCleanup3_4_0           enabled=true                      fixCleanup3_4_0           enabled=true
fixCleanup3_5_0           enabled=false                     (absent)
TicketBatch               enabled=FALSE  ←                  TicketBatch               enabled=true
```

Two things fall out of that table:

1. **`fixCleanup3_4_0` is live on both networks**, which means the counterparty signing bytes
   changed under us. rippled#8162 (`mvadari`, merged 2026-09-03) adds role-specific hash prefixes
   — `CounterpartySignature` → `CPT` single-sign / `CPM` multi-sign, `SponsorSignature` → `SPN`/`SPM`
   — and the PR body names the attack it closes:
   > "Before the fix, every signature on a transaction covered the same bytes, so a signature made
   > for one role could be copied into another. `LoanSecurity_test::testSignatureCopiedBetweenRoles`
   > covers the concrete case: a lender signs the `CounterpartySignature` slot of a `LoanSet` that
   > names the lender as fee sponsor, and the borrower copies that signature into
   > `SponsorSignature`, making the lender pay the fee without ever agreeing to sponsor it."

   Our F-001 (xrpl.js 5.2.0-beta.0 signs the counterparty slot with the ordinary encoder) sits
   directly on top of a nine-day-old protocol change. I verified the SDK side: published
   `ripple-binary-codec@2.11.0` carries `counterpartyTransactionSig: bytes(0x43505400)` ("CPT")
   and `counterpartyTransactionMultiSig: bytes(0x43504d00)` ("CPM"), both commented
   `(fixCleanup3_4_0)`, and exports `encodeForSigningCounterparty` / `encodeForMultisigningCounterparty`.
   Our workaround is the forward-correct one. Say so.

2. **`TicketBatch` is disabled on Track 1 and enabled on Track 2.** An unannounced divergence
   between the two networks participants are told to choose between. Worth one feedback row on
   its own (`surface: infra`, `friction_type: expectation`).

### 2.4 The gaps the maintainers themselves have named and not closed

**(a) The lending protocol has no on-chain way to reserve funds for a proposed loan.**
Vito Tumas, on the On-Chain Cosigner discussion, 2026-08-06, verbatim:

> "In addition, **this proposal does not solve the requirements for the Lending Protocol.
> Conceptually, when a proposal to issue a loan is created on-chain, the funds for that loan must
> be reserved so that once the transaction is signed, the funds are guaranteed to be available for
> the Loan.**"

https://github.com/XRPLF/XRPL-Standards/discussions/589

Shawn Xie's reply, 2026-08-20: "Yeah I don't think it fixes all the problems. There's no way to
guarantee that all pre-requisites of the proposed transaction is fulfilled - that'd still require
off-chain coordination."

**This is our headline finding, stated by the spec author as an open problem.** A closed-ended
vault can reach `RedemptionDate` illiquid because nothing reserves or guarantees the assets behind
an agreed loan. We found the consequence; he named the cause. Put both on the same slide.

**(b) The vault value-conservation invariant is switched off for the whole lending flow. Still open.**
https://github.com/XRPLF/rippled/issues/7690, opened 2026-07-01 by `YogiBearXRP`, **state: open**,
verbatim:

> "`VaultInvariant.cpp:1049-1054` — `ttLOAN_SET` / `ttLOAN_MANAGE` / `ttLOAN_PAY` are literally
> `// TBD → return true`. Loan transactions move real vault assets and mutate `sfAssetsAvailable`/
> `sfAssetsTotal`, yet are exempted from `ValidVault`. The only 'funds conserved' / 'pseudo balance
> agrees' checks on that path are `#if !NDEBUG` asserts (no-ops in Release). … **the last line of
> defense is switched off for the most complex value flow in the system** … Still `// TBD` on develop."

**(c) Lending inside a Batch is not merged.** https://github.com/XRPLF/rippled/pull/6360
"feat: Support lending in batch" (`a1q123456`), opened 2026-02-12, **still open**, labels
`DraftRunCI`, `PR: has conflicts`, last touched 2026-09-01. Yet `BatchV1_1` is **enabled** on both
hackathon networks. Whatever a `LoanSet` inside a `Batch` does on devnet today is, by definition,
behaviour nobody has specified. That is the cleanest "Loaded" experiment available.

**(d) The closed-ended vault is live on devnet with no published specification.**
- Implementation: https://github.com/XRPLF/rippled/pull/7921 "feat: Add a new closed ended vault to
  extend SAV", `a1q123456`, label `feature: LP1.1`, **merged**, updated 2026-08-26. Body:
  "Adds three fields to the `Vault` ledger entry and to `VaultCreate`: `sfVaultKind` (`UINT8`),
  `sfSubscriptionDate` (`UINT32`), `sfRedemptionDate` (`UINT32`) … Subscription → Investment →
  Redemption."
- Specification: https://github.com/XRPLF/XRPL-Standards/pull/587 "Closed-ended Vault",
  `a1q123456`, opened 2026-07-21, **state: open**, `mergeable_state: "behind"`, last updated
  2026-09-08.
- Published XLS-65 on `master`: **grep for `VaultKind`, `SubscriptionDate`, `RedemptionDate`,
  "closed-ended" → zero hits.**
- https://opensource.ripple.com/docs/xls-65-single-asset-vault → no mention.
- https://xrpl.org/docs/concepts/tokens/single-asset-vaults → no mention. It documents only
  `Scale`, `LossUnrealized`, public vs private vaults via Credentials and Permissioned Domains.

**Three sources of truth, and the feature we built on appears in none of them.** This is the exact
divergence Maxime's Monday Brew exists to find, and it is the strongest single slide we have for
the 40%.

Related and also undocumented: https://github.com/XRPLF/XRPL-Standards/pull/469
"adds VaultDepositBlock flag" (`Tapanito`, open since 2026-02-12, gated by `LendingProtocolV1_1`)
and its implementation https://github.com/XRPLF/rippled/pull/6361 (open, label `feature: LP1.2`).

**(e) The nearest fix to our headline finding does not cover it.**
https://github.com/XRPLF/rippled/pull/8151 "fix: Add 60s buffer before closed-ended vault
redemption", `Tapanito`, merged 2026-09-01:

> "Closed-ended `LoanSet` could originate a loan whose last scheduled payment lands on
> `RedemptionDate`. Once the vault enters Redemption, deposits are already closed and the remaining
> Investment window is gone, so there is no time left to collect that payment before the vault
> starts paying out LPs. Reject `LoanSet` when the final payment is fewer than 60 seconds before
> `RedemptionDate` … Raise `kMinInvestmentPeriod` from 60s to 180s."

They fixed *schedule* overrun. They did not fix *non-payment*: a loan whose schedule fits inside
the window but which is simply not repaid still leaves the vault illiquid at Redemption. Frame our
finding as "#8151 closed the timing half; here is the credit half."

### 2.5 The institutional story, and who is already lined up to buy it

Ripple Insights, "The XRPL Lending Protocol: Bringing Credit Infrastructure Onchain",
Jasmine Cooper, **2026-06-29**.
https://ripple.com/insights/the-xrpl-lending-protocol-bringing-credit-infrastructure-onchain/

> "lending and credit - barely exists onchain yet, and **its absence is what stops tokenized
> markets from functioning like real capital markets**"
> "Institutions handle the credit judgment off-chain, while the protocol standardizes execution
> once terms have been agreed"
> "verifiable credentials determine who can participate and under what conditions"
> "Pool administrators or underwriters put junior capital at risk ahead of senior liquidity providers"
> RWAs named: "treasuries, money market funds, stablecoins, commodities, and private credit"
> Developers "can begin integrating and testing on devnet today"; activation "subject to validator approval".

Ripple Insights, "Institutional DeFi on XRPL: Scaling Real-World Finance with XRP at the Core",
Team Ripple, **2026-02-05**.
https://ripple.com/insights/institutional-defi-on-xrpl-scaling-real-world-finance-with-xrp-at-the-core/
Named use cases include **"High-grade collateral issuance and escrow"** and
**"Delivery-versus-payment (DvP) workflows in repo markets"**. Roadmap: Lending Protocol
(XLS-65/66) in Q2 2026. Only quoted executive is Sagar Shah, Chief Business Officer, **Evernorth**:
"By participating in this native lending ecosystem, Evernorth aims to help unlock what could be a
multi-billion dollar annual yield opportunity for the XRP community."

XRPL Commons, "Credit Comes On-Chain: Introducing XRPL Lending", Odelia Torteman, Head of Digital
Assets, **2026-09-02**.
https://www.xrpl-commons.org/newsroom/credit-comes-on-chain-introducing-xrpl-lending
Names "RLUSD and MPT-based RWAs as collateral within permissioned vaults", "market makers to
finance inventory without selling core assets", "payment providers drawing short-duration
liquidity to bridge settlement timing gaps", and closes with **"Those who move first will define
the standards the market adopts."**

Ecosystem names to drop, all sourced: **Evernorth, SOIL, VS1.Finance** (RippleX security post,
Phase 9); **Cicada Credit and Clearpool** — @xrpl_commons, verbatim tweet text:
"Institutional lending is coming natively to the XRP Ledger. No smart contracts needed. @Ripple,
@CicadaCredit, and @ClearpoolFin stand ready to deploy real-world, $RLUSD-powered credit directly
on-chain as soon as the Lending Protocol (XLS-66) and Single Asset Vault (XLS-65)…"
https://x.com/xrpl_commons/status/2090836747898753209 ; Clearpool's own framing:
"XRPL takes a different path, lending as a native ledger primitive. XLS-65 (Single Asset Vault)
and XLS-66 (Lending Protocol) build the vault and the loan into the ledger itself."
https://x.com/ClearpoolFin/status/2094299764494127222 ; SOIL:
"Ripple just introduced the XRPL Lending Protocol and $SOIL is among the first teams building on
it … institutional lending flows on XRPL using single asset vault for pooling $RLUSD & lending
protocol for fixed loan terms." https://x.com/soil_farm/status/2020975373606121610

### 2.6 The calendar they are steering towards

| when | what | source |
|---|---|---|
| "next week" from 2026-09-11 | **rippled v3.4.0**, carrying Lending Protocol v1.1 | coingape 2026-09-11; rippled#8171 bumped to `3.4.0-rc1` on 2026-09-03 |
| Q3 2026 | LendingProtocol **v1.1 enhancement amendment** | RippleX 2026-06-18, verbatim above |
| 2026-10-24/25 | XRP Ledger Hackathon, New York | https://www.xrpl-commons.org/newsroom/credit-comes-on-chain-introducing-xrpl-lending |
| **2026-10-27 → 29** | **Swell 2026, The Shed, Hudson Yards NYC — first Swell merged with XRPL Apex**, 1,500+ attendees, 75+ speakers, 50+ sessions, tracks include RWA tokenization, DeFi, AI and agentic finance | https://coingape.com/trending/ripple-swell-2026-date-schedule-featured-speakers-xrp-and-rlusd-impact/ ; https://news.bitcoin.com/featured/ripple-confirms-75-speakers-for-swell-2026-expects-1500-attendees/ |
| no date | mainnet activation of XLS-65/66 | 12/28 and 15/28 validators; no date anywhere |

**There is no dated mainnet commitment.** Do not claim one on a slide. The honest line is:
"open for voting since v3.1.0 on 28 January 2026; 12 of 28 validators as of this morning; 80% for
two continuous weeks required."

---

## 3 · Deliverable — the five things our submission must contain

### ① A protocol finding on the V1.1 surface, framed as the next phase of *their* security pipeline

Not "we found a bug". **"Your pipeline has eleven phases and stops at v1.0. We ran phase twelve on
v1.1."** The Attackathon scoped 35,498 lines and closed triage on 2026-01-07; the closed-ended
vault merged 2026-08-26 (rippled#7921), seven months later. XRPL Commons' 257/257 was March 2026,
also before it.

> Quote on the slide: "**Advances in AI are also rapidly reducing the cost of vulnerability
> discovery, making it increasingly important to identify issues as early as possible in the
> development lifecycle.**" — J. Ayo Akinyele, RippleX, 2026-06-18,
> https://dev.to/ripplexdev/the-road-toward-mainnet-a-security-first-approach-to-xrpl-lending-protocol-3bn6

Pair our finding with the two they already own: XRPL-Standards#496 (impairment, "reported from the
Bug Bounty Program", merged 2026-09-11) and rippled#8151 (60s redemption buffer, merged
2026-09-01). Say: #8151 closed the *schedule* half; the *credit* half is open, and Vito Tumas named
the underlying cause himself in discussion #589 ("the funds for that loan must be reserved").

### ② Every piece of feedback pre-classified in Maxime's own taxonomy

Ship a table whose columns are literally his D1 columns — `surface`, `friction_type`, `feature`,
`tx_type`, `result_code`, `evidence`, `attempts`, `elapsed_seconds` — and submit the same rows
through `/xrpl-feedback` and `/xrpl-session-analysis` so they land in his database as
`evidence: observed`, not `reported`. Use `feature: xls-65` / `xls-66` (his `focus_features`).

> Quote on the slide: "**This is what makes post-event analysis a SQL query instead of a reading
> exercise.**" — `docs/TAXONOMY.md`,
> https://github.com/RippleDevRel/xrpl-devex-hook/blob/main/docs/TAXONOMY.md

Every one of our nine existing findings already fits: xrpl.js counterparty signing → `sdk` /
`workaround`; phantom `tfVaultDonation` in the workshop deck → `docs` / `wrong_model`;
`vault_info` taking `vault_id` not `vault` → `docs` / `docs_broken`; omitted default fields →
`protocol` / `expectation`; `PeriodicPayment` in fractional drops → `protocol` / `expectation`;
`Scale` must be absent for XRP/MPT → `docs` / `doc_gap`. Add `TicketBatch` disabled on Track 1 but
enabled on Track 2 → `infra` / `expectation`.

### ③ A spec ↔ implementation ↔ docs divergence table, with PR numbers

One slide, four columns: *rippled has it* / *XLS says* / *xrpl.org says* / *opensource.ripple.com
says*. Lead row:

| | rippled | XLS-65 master | xrpl.org | opensource.ripple.com |
|---|---|---|---|---|
| `VaultKind`, `SubscriptionDate`, `RedemptionDate`, Subscription→Investment→Redemption | **merged**, PR #7921, live on both hackathon devnets | **absent** (spec PR #587 open since 2026-07-21, `mergeable_state: behind`) | **absent** | **absent** |
| `VaultDepositBlock` | PR #6361 open | absent (spec PR #469 open) | absent | absent |

This is his Monday Brew rendered as a hackathon finding: his tool reads amendment state from
"rippled's `features.macro`" *and* "xrpl.org's `known-amendments.md`" precisely because they drift.
Our whole Track 2 phase matrix is empirical documentation of an unspecified feature — **offer it
as the missing spec text.**

> Quote on the slide, his own standing disclaimer: "*A tagged release is required for any change
> to reach production … treat the feature as merged-but-pending-release and phrase availability
> accordingly.*" — https://xrplbrew.com, 2026-08-31→09-06 brew.

### ④ Something merged, or at minimum opened, before we present — the explicit BONUS

The brief says "BONUS for contributing back: a PR, a docs correction, a reusable code sample, a
reference implementation." Cheapest high-value targets, in order:

1. **A review comment or a commit on XRPL-Standards#587** supplying the closed-ended failure-condition
   table we verified on chain, with our transaction hashes. The PR is open, `behind`, and its author
   `a1q123456` is the same person who wrote the implementation. Lowest friction, highest relevance.
2. **A docs PR to `XRPLF/xrpl-dev-portal`** adding closed-ended vaults to
   `docs/concepts/tokens/single-asset-vaults`, and fixing `vault_info` to say `vault_id` (or
   `owner` + `seq`), not `vault`.
3. **A comment on `XRPLF/rippled` issue #7690** (open, vault invariant is `// TBD` for the whole
   lending path) attaching our illiquid-redemption trace as the concrete consequence.
4. **A reusable `signLoanSetByCounterparty` sample** pinned to `ripple-binary-codec@2.11.0`'s
   `encodeForSigningCounterparty` — verified correct against the `CPT`/`CPM` prefixes that
   rippled#8162 introduced and `fixCleanup3_4_0` turned on across both networks.

Note also that rippled#8067 added `AGENTS.md`/`CLAUDE.md` to the repo "for AI coding agents" —
contributing back *through* an agent is on-message, not a confession.

### ⑤ A use case in the exact words of the two people in the room

**Shota.** He is a product manager shipping **repo settlement with multi-party co-signing of atomic
Batch transactions, with Ripple Custody as the first customer**. "Recall" — tri-party securities
lending, collateral posted on a shared multisig account, a two-signature `LoanSet`, an agent that
counter-signs after checking eligibility — is his trade family with a different name. Use *his*
vocabulary: repo, tri-party, transfer agent, custody instance, DvP.

> Quote on the slide: "**We're building repo settlement on XRPL where counterparties need to
> co-sign an atomic Batch transaction** … once the issuer, the participants, and the transfer
> agent each use their own custody platform (which is the realistic institutional setup), there's
> no protocol-native way to coordinate signatures across them." — Shota, Ripple PM,
> https://github.com/XRPLF/XRPL-Standards/discussions/589, 2026-08-12

**Maxime.** His brief asks for a "lending story that would go live and get traction, or a missing
developer tool" — and Ripple has already published the DvP-repo use case
(2026-02-05 Insights) while XRPL Commons has published the market-maker-inventory-financing one
(2026-09-02). Land inside that published taxonomy and name the firms already waiting: Evernorth,
SOIL, VS1.Finance, Cicada Credit, Clearpool.

> Closing quote for the last slide: "**Those who move first will define the standards the market
> adopts.**" — Odelia Torteman, XRPL Commons, 2026-09-02,
> https://www.xrpl-commons.org/newsroom/credit-comes-on-chain-introducing-xrpl-lending

---

## 4 · Tone and framing notes for the deck

- **Never claim a mainnet date.** There is none. Say "12 of 28 validators this morning" and let
  the room do the arithmetic. Being the team that got the number right is worth more than a
  confident guess.
- **Say "not yet live on the network."** It is the phrase Maxime repeats in every weekly brew.
- **Proposals score above flagging** is in the brief; it is also the culture: XRPL-Standards#496's
  body ends with "Our solution: …" followed by two bullet points. Copy that shape exactly —
  *symptom, cause, two-bullet fix*.
- **Do not touch MPP, x402, Claw Credit, agentic SDKs** — out of scope per organizers, even though
  MPP is Maxime's own project. Touching it reads as flattery and breaks a stated rule.
- Ripple-side vocabulary that lands: "first-loss capital", "off-chain underwriting, on-chain
  execution", "permissioned vault", "share price model", "economic attack surface",
  "defense-in-depth", "institutional DeFi". All taken verbatim from their own posts.
- Six weeks after this hackathon is Swell 2026 + XRPL Apex, NYC, 27–29 October, first merged
  edition. Anything we hand them that they can reuse on a Swell slide is worth disproportionately
  more than a demo.

---

## 5 · Open questions (unverified)

1. **Shota's surname.** `Shotaripple` on GitHub, no name field, no public repos, no public events.
   The only self-identification is "Shota here from ripple - product manager for cosigner". Not
   confirmed that the cosigner PM is the same person who ran the Lending Protocol workshop, though
   "Shota (Ripple)" plus the lending/repo overlap makes it very likely. **Ask him at the event.**
2. **Aanchal Malhotra's GitHub handle.** Named on both spec headers as `amalhotra@ripple.com`; no
   matching public activity found in XRPLF or RippleDevRel during this pass.
3. **X/Twitter content could not be fetched directly.** `x.com` returns HTTP 402 to WebFetch and
   `xcancel.com` refused the connection; `publish.twitter.com/oembed` returns empty. Every tweet
   quoted above comes from search-result titles, which reproduce the tweet text verbatim but
   cannot be independently re-read. **@krkmu_'s own timeline was not readable at all** — his
   recent activity is reconstructed entirely from GitHub. If someone has a logged-in browser,
   ten minutes on @krkmu_, @RippleXDev and @xrpl_commons would firm this up.
4. **Whether a `LoanSet` inside a `Batch` succeeds on the hackathon devnets.** rippled#6360 is
   open and conflicted, `BatchV1_1` is enabled. Untested by us. This is a one-transaction
   experiment with a very high chance of producing a headline.
5. **Whether the workshop decks (Maxime's XRPL workshop, Shota's Lending workshop) are public.**
   Not found online; we hold them only as event material.
6. **The `xrpl-devex-hook` ingest key is committed in the public repo**
   (`"ingest_key": "3fd187145dca5b22b761947d49abd5d750e4f09ca2bf56f2"` in
   `hook/devex.config.json`). That is presumably deliberate for a participant hook, but it means
   anyone can post rows as any pseudonym. Worth mentioning to him privately and in person, not on
   a slide — it is his tool, and a public write-up would be a bad look for a guest.
