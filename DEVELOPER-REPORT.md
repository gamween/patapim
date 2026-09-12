# Developer report, team patapim

| | |
|---|---|
| **Track** | 2, closed-ended vault, Lending Protocol V1.1 |
| **Flavour** | Loaded: XLS-65 and XLS-66 plus MPTs, Credentials, Permissioned Domains and Escrow |
| **Environment** | Public XRPL Devnet, `wss://s.devnet.rippletest.net:51233`, network_id 2, rippled `3.4.0-rc5` |
| **Library** | `xrpl.js@5.2.0-beta.0`, `ripple-binary-codec@2.11.0` |
| **Team** | patapim |

We built patapim, a securities lending market: eligible holders lend a tokenised security from a
fixed-term vault through a lending agent who indemnifies them. Everything below happened to us while
building it. Every claim carries a transaction hash, a file and line, or a pull request number.

---

## 1. The library the brief mandates cannot originate a loan

The only issue that stopped us dead, and it cost the first hour.

`signLoanSetByCounterparty` in `xrpl.js@5.2.0-beta.0` produces a `CounterpartySignature` the ledger
refuses: `fails local checks: Counterparty: Invalid signature.` The same `LoanSet`, same accounts,
same network, succeeds with stable `xrpl.js@5.2.0`, tx
`42BDEBF81958D716070F1852CB5560A2DFBE05B017357838ACF35A9A3004A530`. Everything before it returns
`tesSUCCESS` on both versions, so the fault is isolated to the signature.

The cause is one argument. rippled #8162, merged 2026-09-03 and gated on `fixCleanup3_4_0`, which is
enabled on both hackathon networks, gave the counterparty signature its own hash prefixes. Stable
routes through `computeSignature(tx, key, undefined, 'counterparty')` to
`encodeForSigningCounterparty`; the beta has no `role` parameter and calls `encodeForSigning`.
`ripple-binary-codec@2.11.0`, a dependency of **both**, already exports the right function. The beta
never calls it. The same defect ships in Ripple's own reference application,
`ripple/xrpl-reference-app-lending-sav`, which pins `xrpl@4.6.0`.

**What we did.** Called `encodeForSigningCounterparty` ourselves,
`scripts/lib/lending.mjs → signCounterparty()`, twelve lines. With it the mandated beta runs the
whole flow.

**Proposed fix.** Backport the `role` argument to the beta line, two call sites in
`counterpartySigner.ts`. Better, publish one release carrying both the closed-ended vault types and
the counterparty fix, and drop the pinned beta from the brief.

## 2. No published version of the library has both halves of the feature

Diffing the published tarballs: only `5.2.0-beta.0` types `VaultKind`, `SubscriptionDate`,
`RedemptionDate`, `LEVersion`, `CredentialIDs` and `MemoData`. Only stable `5.2.0` signs
counterparties correctly. `npm install xrpl` gives `5.2.0`, which cannot model a closed-ended vault
at all, with no notice pointing anywhere: semver reads backwards, the pre-release is newer in
protocol coverage than the stable that supersedes it. `xrpl-py` has no counterparty prefix at all,
so origination is impossible from Python while the tutorials present it as a peer of JavaScript.

**Proposed fix.** One release with both, and a version-to-feature matrix on the lending docs
landing page: which client version covers V1, which covers V1.1.

## 3. The two hackathon networks enforce different rules behind an identical amendment list

We ran the same `LoanBrokerSet` against an open-ended vault on both networks:

| network | build | result |
|---|---|---|
| custom hackathon devnet, network_id 4001 | 3.4.0-rc1 | `tesSUCCESS`, `59496BAE17EEE32D4E1E4E6BFD1A0764FEA645A4A42BCCB13F038F691D606F85` |
| public XRPL devnet, network_id 2 | 3.4.0-rc5 | `tecNO_PERMISSION`, `DD751B834867010B29ABDC73A965D0AA33DCC00AEAA3C784210FFA067B7A95D5` |

Both report `LendingProtocol` and `LendingProtocolV1_1` enabled, read from the Amendments ledger
entry and mapped against `features.macro`. `TicketBatch` also differs between them. So the brief's
appendix warning was right and the custom devnet keeps V1 behaviour, but a participant cannot
discover that: `build_version` names no published tag, the amendment set is identical, and the only
way to learn which semantics apply is to send a transaction and read the rejection.

**Proposed fix.** Expose the effective lending protocol version, publish the source for the build
each network runs, and put a one-page amendment diff in the event brief. It is two lines of `jq`
against the `feature` RPC of both nodes.

---

## Specification against implementation against documentation

The divergences we hit, each verified against the shipped code rather than inferred.

| # | Subject | Specification or docs say | The ledger does |
|---|---|---|---|
| 1 | `LoanPay` transaction type | XLS-66 documents type 83 | type 84 |
| 2 | `VaultClawback` prerequisite | XLS-65 line 702: fails without `lsfMPTCanLock` | only `lsfMPTCanClawback` is checked; we clawed back from a vault whose MPT had no `CanLock`, `553C31E8…` |
| 3 | `VaultWithdraw` and domains | XLS-65 appendix A.2: withdrawals ignore permissioned-domain rules | false since `fixCleanup3_4_0`: the destination is checked |
| 4 | Vault numeric fields | spec and reference pages: always present | omitted from JSON whenever equal to their default, `VaultKind` absent rather than `0` |
| 5 | Closed-ended vaults | absent from all 559 xrpl.org pages, spec PR XRPL-Standards #587 open since 2026-07-21 | fully shipped and enabled on both networks |
| 6 | Interest injection | the workshop deck teaches `VaultDeposit` with `tfVaultDonation` | no such flag exists in `server_definitions` or anywhere in the source |
| 7 | The brief's minimum bar | "execute a drawdown" | no drawdown transaction exists |
| 8 | Reference application | `github.com/ripple/lending-demo` | 404; the live one is `ripple/xrpl-reference-app-lending-sav` |

---

## What the protocol made hard

**Impairment does not move `AssetsTotal`, so the obvious share price is wrong.** We walked a loan to
default and snapshotted the vault at each step. On impairment, `LossUnrealized` went to 2000000 and
`AssetsTotal` stayed at 5000000, so `AssetsTotal / OutstandingAmount`, the only formula the field
names suggest, still read 1.00 for a vault whose lenders were carrying a forty percent write-down.
We shipped that bug in our own dashboard and found it by impairing a loan on chain, not by reading
anything. The ledger settles `VaultWithdraw` against `AssetsTotal - LossUnrealized`, so the correct
formula exists only in the source. *Proposal: put the net asset value formula on the vault concepts
page, and expose it as a field.*

**"First-loss capital" absorbs a rate of the debt, not the first loss.** Same run, cover 1000000
against a 2000000 loan at `CoverRateMinimum: 10000`, ten percent. On default the vault lost 1800000
and the cover lost 200000: exactly the configured rate, with the lenders taking the other ninety
percent, although the posted cover could have absorbed half the loan. Price per share went from 1.00 to 0.64. Re-running the identical arc at
`CoverRateMinimum: 100000` settles it: the cover absorbs the whole loan, assets hold at 5000000 and
the share price stays at 1.00. So the parameter that reads as a floor on how much cover to post in
fact decides how much of a default it absorbs, and a broker can sit on ten times the capital it will
ever pay out. For a product whose promise to lenders is indemnification, that is the most expensive
misunderstanding in XLS-66, and nothing in the field tables corrects it. *Proposal: document the
default settlement arithmetic with a worked example, and treat a cover rate of 100000 as the
documented way to express full indemnity.*

**A closed-ended vault protects the calendar, not the cash.** `LoanSet` is refused with
`tecNO_PERMISSION` when the amortisation schedule would end after `RedemptionDate`, so the ledger
does enforce something. But a loan created inside the window and left unpaid leaves the vault
illiquid at redemption: `AssetsTotal` 40000000 against `AssetsAvailable` 30000000, lender withdrawal
`tecINSUFFICIENT_FUNDS`, `D587939404866E8E09373D12B52CBCDA81EFBBAAE8AA528CD0E0381D9FF06E68`. There
is no recovery path in the redemption phase: the broker cannot call the loan early and
`LoanManage` default only writes the position down. The author of the specification named the cause
himself in XRPL-Standards discussion #589: "when a proposal to issue a loan is created on-chain, the
funds for that loan must be reserved". *Proposal: a `tfLoanCall` flag on `LoanManage` for
`LendingProtocolV1_2`, letting the broker call a loan before term against the borrower's grace
period, so a fixed-term vault can guarantee liquidity at its own maturity.*

**The grace period protects the borrower's payment, not their standing.** Firing `tfLoanImpair` at
three different moments pins the boundary: `tecTOO_SOON` before the payment falls due, `tesSUCCESS`
eleven seconds after it falls due with forty nine seconds of grace still running, and
`tecNO_PERMISSION` once already impaired. Impairment unlocks at the due date and ignores
`GracePeriod` entirely, so a borrower who is one second late can be marked down while still holding
the whole window the loan granted them, and that mark-down is what moves `LossUnrealized` and what
the lender sees. Both designs are defensible; nothing states which one ships. *Proposal: one sentence
on the `LoanManage` page saying impairment is available once a payment is past due, independently of
`GracePeriod`.*

**A permissioned domain gates lenders, not borrowers.** Same vault, same minute: a non-member
`VaultDeposit` is refused `tecNO_AUTH`, then a `LoanSet` naming that same account as counterparty
succeeds. There is no `checkVaultDomain` anywhere under the lending transactors. A market described
as a compliance-gated lending market therefore gates who supplies capital and not who borrows it.
*Proposal: honour the vault's `DomainID` on the loan counterparty, or document loudly that borrower
eligibility is entirely off-protocol.*

**No vault or loan transaction is delegable.** Every lending entry in `transactions.macro` omits
`.delegable`, and `permissions.macro` defines no granular permission over any of them. Fifteen
`DelegateSet` attempts, fifteen `temMALFORMED`, against a control `DelegateSet[Payment]` that
succeeds. An institution cannot give an operations key the right to call `LoanManage` or
`LoanBrokerCoverDeposit`. For a product whose whole premise is an agent acting for others, this is
the single biggest custody blocker in XLS-66 today.

---

## Smaller things, one line each

| Category | Finding | Proposed fix |
|---|---|---|
| protocol | No way to ask the ledger which phase a vault is in, and the deciding clock (parent ledger close time) is in a C++ comment. It cost us a full run | return a `phase` from `vault_info` and name the clock |
| protocol | `tecINSUFFICIENT_PAYMENT` hides the amount owed, and `PeriodicPayment` publishes `1000000.142695042164` on an `AssetScale: 0` token | return a payable figure in the error |
| protocol | Reading one lender position takes four calls and two client-side divisions | a `vault_info` that returns the dashboard view |
| protocol | `VaultWithdraw` in assets under-delivers one unit on an integral asset, `tesSUCCESS`, asked 500000 got 499999 | document the rounding, or recommend withdrawing by shares |
| protocol | `VaultCreate` costs 2 XRP on one hackathon network and 0.2 XRP on the other, documented on neither | document it as one incremental owner reserve |
| protocol | Lending transactions are excluded from `Batch` at compile time, a mitigation for a counterparty-signature bypass, while a Ripple product manager publicly describes repo settlement built on co-signed atomic batches | say so in the Batch docs and the XLS-66 roadmap |
| client libraries | `LoanSet` is missing from `txToFlag`, so its documented object form of `Flags` always throws; `autofill` also prints a console line on every `LoanSet` | add the entry, drop the line |
| infrastructure | The two event faucets return incompatible JSON, fund by amounts differing tenfold, and neither shape is what `client.fundWallet()` expects | serve one shape |
| documentation | Around forty result codes returned by the lending transactors appear on no reference page | generate the tables from the transactors |

## What we contributed back

[ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342), opened during the event,
making `LoanBroker` and `Loan` ledger entry identifiers resolvable from the search box. The objects already render inside the vault page and resolve over
RPC, but pasting either identifier into search returns "Could not find any Transactions, Vaults,
Ledgers or NFTs that match the specified ID", because `determineHashType` in `Search.tsx` probes
exactly four types. The fix replaces the vault lookup with a single `ledger_entry` call switched on
`LedgerEntryType`, so the request count is unchanged and the next object type costs a case rather
than a round trip. Four tests, lint, format and typecheck clean.

Every finding above was also filed through the event's own capture hook, pre-classified in its
taxonomy, so the aggregate is a query rather than a reading exercise.
