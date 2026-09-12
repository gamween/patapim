# Developer report, team patapim

| | |
|---|---|
| **Track** | 2, closed-ended vault, Lending Protocol V1.1 |
| **Flavour** | Loaded: XLS-65 and XLS-66 plus MPTs, Credentials, Permissioned Domains and Escrow |
| **Environment** | Public XRPL Devnet, `wss://s.devnet.rippletest.net:51233`, network_id 2, rippled `3.4.0-rc5` |
| **Library** | `xrpl.js@5.2.0-beta.0`, `ripple-binary-codec@2.11.0` |
| **Team** | patapim |

We built Recall, a securities lending market: eligible holders lend a tokenised security from a
fixed-term vault through a lending agent who indemnifies them with first-loss capital. Everything
below happened to us while building it, in order. Every claim carries a transaction hash, a file
and line, or a pull request number.

---

## 1. The library the brief mandates cannot originate a loan

This cost us the first hour and it is the only issue that stopped us dead.

`signLoanSetByCounterparty` in `xrpl.js@5.2.0-beta.0` produces a `CounterpartySignature` the ledger
refuses: `fails local checks: Counterparty: Invalid signature.` The same `LoanSet`, same accounts,
same network, succeeds with stable `xrpl.js@5.2.0`, transaction
`42BDEBF81958D716070F1852CB5560A2DFBE05B017357838ACF35A9A3004A530`. Everything before it,
`VaultCreate`, `VaultDeposit`, `LoanBrokerSet`, `LoanBrokerCoverDeposit`, returns `tesSUCCESS` on
both versions, so the fault is isolated to the signature.

The cause is one argument. rippled #8162, merged on 2026-09-03 and gated on `fixCleanup3_4_0`,
gave the counterparty signature its own hash prefixes. `fixCleanup3_4_0` is enabled on both
hackathon networks, so the new prefixes are live. Stable 5.2.0 routes through
`computeSignature(tx, key, undefined, 'counterparty')` and reaches `encodeForSigningCounterparty`.
The beta has no `role` parameter and calls `encodeForSigning`, the ordinary transaction encoder.
`ripple-binary-codec@2.11.0`, a dependency of **both** versions, already exports the correct
function: the beta simply never calls it.

The same defect ships in Ripple's own reference application,
`ripple/xrpl-reference-app-lending-sav`, which pins `xrpl@4.6.0` and signs with `encodeForSigning`.

**What we did.** Called `encodeForSigningCounterparty` ourselves,
`scripts/lib/lending.mjs → signCounterparty()`, twelve lines. With it the mandated beta runs the
whole flow.

**Proposed fix.** Backport the `role` argument to the beta line, two call sites in
`counterpartySigner.ts`. Better, publish one release carrying both the closed-ended vault types and
the counterparty fix, and drop the pinned beta from the brief.

## 2. No published version of the library has both halves of the feature

Diffing the two published tarballs: only `5.2.0-beta.0` types `VaultKind`, `SubscriptionDate`,
`RedemptionDate`, `LEVersion`, `CredentialIDs` on `VaultWithdraw` and `MemoData` on `VaultDelete`.
Only stable `5.2.0` signs counterparties correctly. `npm install xrpl` gives you `5.2.0`, which
cannot model a closed-ended vault at all, with no deprecation notice pointing anywhere. Semver reads
backwards: the pre-release is newer in protocol coverage than the stable that supersedes it.

`xrpl-py` has no counterparty signing prefix at all, so loan origination is impossible from Python,
while the tutorials present Python as a peer of JavaScript.

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

**You cannot ask the ledger which phase a vault is in.** The entry exposes two dates and no phase,
and the comparison clock is the parent ledger close time, which appears only in a C++ comment. We
derived phase dates from the machine clock and waited on the same clock, and spent a full probe run
submitting into a phase we thought we had left. Every client will reimplement this, and some will
reimplement it wrong. *Proposal: return a `phase` field from `vault_info`, and say in the docs which
clock decides.*

**The amount due is not representable.** `tecINSUFFICIENT_PAYMENT` does not carry the amount owed;
fetching it from the `Loan` entry gives `PeriodicPayment: "1000000.142695042164"` on a token whose
`AssetScale` is 0. No payment can equal that value, the client must round, and nothing says in which
direction or whether rounding up crosses into `tfLoanOverpayment` and its fee. In the same family,
`VaultWithdraw` denominated in assets silently under-delivers one unit: asked 500000, received
499999, `tesSUCCESS`. Withdraw by shares.

**Reading a position takes four calls and two divisions.** Price per share is the number that
matters most and it is not on the vault: shares outstanding live on the share `MPTokenIssuance` as
`OutstandingAmount`, and nothing points there. Utilisation is client-side arithmetic. Loans are
listed neither from the vault nor from the broker owner but from the `LoanBroker` pseudo-account.
*Proposal: `SharesTotal` and `SharePrice` on the vault entry, or a `vault_info` that returns the
dashboard view in one call.*

---

## Smaller things, one line each

| Category | Finding | Proposed fix |
|---|---|---|
| client libraries | `LoanSet` is missing from `txToFlag`, so its documented object form of `Flags` always throws | add the entry |
| client libraries | `autofill` prints an unconditional console line on every `LoanSet`, even with no counterparty | remove it, or expose the multiplier on the returned transaction |
| client libraries | `vault_info` is untyped, forcing `(client as any).request` in every consumer | add the request and response types |
| protocol | `VaultCreate` costs 2 XRP on one hackathon network and 0.2 XRP on the other, undocumented on both | document it as one incremental owner reserve, network dependent |
| protocol | Lending transactions are excluded from `Batch` at compile time, a mitigation for a counterparty-signature bypass, while a Ripple product manager publicly describes repo settlement built on co-signed atomic batches | say so in the Batch documentation and in the XLS-66 roadmap |
| infrastructure | The two event faucets return incompatible JSON and fund by amounts differing tenfold, and neither shape is what `client.fundWallet()` expects | serve one shape, or document both next to the URLs |
| documentation | Around forty result codes returned by the lending transactors appear on no reference page | generate the code tables from the transactors |
| documentation | The XLS-89 metadata validator reveals conditional requirements only after the unconditional ones are satisfied, one submitted transaction at a time | validate the whole schema at once and link the standard in the warning |

---

## What we contributed back

A pull request to `ripple/explorer` making `LoanBroker` and `Loan` ledger entry identifiers
resolvable from the search box. The objects already render inside the vault page and resolve over
RPC, but pasting either identifier into search returns "Could not find any Transactions, Vaults,
Ledgers or NFTs that match the specified ID", because `determineHashType` in `Search.tsx` probes
exactly four types. `getLoanBroker()` is already implemented, exported and unit tested, and the
parent chain `Loan.LoanBrokerID → LoanBroker.VaultID → Vault` is two hops.

Every finding above was also filed through the event's own capture hook, pre-classified in its
taxonomy, so the aggregate is a query rather than a reading exercise.
