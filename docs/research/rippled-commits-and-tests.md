# rippled: lending/vault commit history, release provenance, and test-coverage map

Slug: `rippled-commits-and-tests`. Written 2026-09-12.
Working copies (blobless clone, kept for the weekend):

- `/tmp/rippled` — worktree pinned at tag **`3.4.0-rc1` = commit `2ad4def35fd8580da027462517ba3375cc005c94`** (2026-09-03). Every `file:line` in this document refers to this tree unless stated otherwise.
- `/tmp/rippled-dev` — worktree at `origin/develop` = `94037361992ad75b32a6b2659b655ab96b7cb7c2` ("ci: Exclude Rust unit tests from code coverage (#8203)").

Probe scripts written for this note live in the session scratchpad
(`openended-broker.mjs`, `batch-lending2.mjs`, `vaultdelete-broker.mjs`, `grace-lockout.mjs`);
they import `scripts/lib/lending.mjs` from this repo and were run against both hackathon networks.

---

## 0. Executive summary — the five things that matter

1. **The two hackathon networks do not run the same protocol rules, and nothing in `server_info` tells you.** Track 1 accepts a `LoanBrokerSet` on an *open-ended* vault; Track 2 rejects it with `tecNO_PERMISSION`. Both advertise the same non-retired amendment set. Track 1 is running the branch `ripple/lending-hackathon`, whose HEAD commit `440018c0f` (Kenny Lei, 2026-09-09) is literally `Revert "fix: Reject open-ended vaults at LoanBrokerSet (#8076)"`, and whose `BuildInfo.cpp` still says `3.4.0-rc1`. Build the demo closed-ended and it runs on both.
2. **`3.4.0-rc5` does not exist in public rippled.** Track 2 advertises it; there is no such tag, no such release, and `staging/3.4.x` is byte-identical to `3.4.0-rc1`. You cannot read the code the public devnet runs.
3. **XLS-56 Batch and XLS-65/66 are mutually exclusive by design.** All 15 vault and lending transaction types are hard-listed in `include/xrpl/tx/transactors/system/Batch.h:60-76`; any Batch containing one is rejected `temINVALID_INNER_BATCH`. Proven on both networks with a passing 2-payment control.
4. **rippled's loan test suite runs with `LendingProtocolV1_1` switched OFF** (`src/test/app/lending/LoanTestBase.h:91`, `src/test/app/lending/LoanBroker_test.cpp:81`). Both hackathon networks run it ON. The entire 3 020-line `LoanBroker_test.cpp` — every first-loss-cover path — has zero coverage in the configuration the judges' own devnets are running.
5. **A branch that rippled marks unreachable is reachable in three transactions.** `VaultCreate` → `LoanBrokerSet` → `VaultDelete` returns `tecHAS_OBLIGATIONS` from `src/libxrpl/tx/transactors/vault/VaultDelete.cpp:164`, a line carrying `// LCOV_EXCL_LINE`. `VaultDelete::preclaim` has no loan-broker check. Verified on both networks with a control.

---

## 1. Release provenance and what each network is actually running

### 1.1 Verified on chain

| | Track 1 (hackathon) | Track 2 (public devnet) |
|---|---|---|
| `build_version` | `3.4.0-rc1` | `3.4.0-rc5` |
| `network_id` | 4001 | 2 |
| amendments in the ledger `Amendments` object | 48 | 89 |
| *non-retired* amendments | 48 | 48 |

The 41-amendment difference is **entirely retired amendments** (`Checks`, `Clawback`, `DepositAuth`,
`Flow`, `ExpandedSignerList`, `MultiSignReserve`, `TicketBatch`, `NonFungibleTokensV1_1`, `fix1513`…),
all listed under `XRPL_RETIRE_FEATURE` / `XRPL_RETIRE_FIX` at
`include/xrpl/protocol/detail/features.macro:92-150`. Retired amendments are unconditionally active
in 3.4.0, so their absence from a fresh network's `Amendments` object is cosmetic.
**Do not read Track 1's shorter list as "fewer features".** I nearly filed that as a finding; it is not one.

Non-retired set on both networks (identical, 48):
`AMM, AMMClawback, BatchV1_1, ConfidentialTransfer, Credentials, DID, DeepFreeze, DynamicMPT,
DynamicNFT, LendingProtocol, LendingProtocolV1_1, MPTokensV1, NFTokenMintOffer,
PermissionDelegationV1_1, PermissionedDEX, PermissionedDomains, PriceOracle, SingleAssetVault,
Sponsor, TokenEscrow, XChainBridge, XRPFees` plus 26 `fix*` amendments including
**`fixCleanup3_1_3`, `fixCleanup3_2_0`, `fixCleanup3_3_0`, `fixCleanup3_4_0` — all four enabled on both**.
`LendingProtocolV1_2` is registered on develop (`21890d9da`, Vito Tumas, 2026-09-09, PR #8185) but
enabled on neither network.

Two amendments nobody will think to combine with lending and that are live on both:
**`Sponsor`** (sponsored reserves, new in 3.4.0) and **`ConfidentialTransfer`**.

Method: `ledger_entry` on the well-known Amendments index
`7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4`, matched against
sha512half of each name from `features.macro`.

### 1.2 The Track 1 build is not the Track 1 tag

`XRPLF/rippled` carries a branch **`ripple/lending-hackathon`**. It is `3.4.0-rc1` plus 8 commits;
`src/libxrpl/protocol/BuildInfo.cpp:26` still reads `versionString = "3.4.0-rc1"`. Its HEAD is:

```
440018c0f  2026-09-09  Kenny Lei  Revert "fix: Reject open-ended vaults at LoanBrokerSet (#8076)"
```

Decisive experiment (`openended-broker.mjs`): create an open-ended vault (no `VaultKind`),
then `LoanBrokerSet` on it.

| Network | Result | Tx hash |
|---|---|---|
| Track 1 | **`tesSUCCESS`** | `8A54DED1D4F807CEE7F8DB16608A5055BA4BFACAE499C5940665D32211AE0858` |
| Track 2 | **`tecNO_PERMISSION`** | `849188F494EDFD440E3265975146C0D108DBA3997240952837D22FB1E70C8177` |

(VaultCreate hashes: T1 `858E9B3510DC61BFF2A3725568B0E2D06A0FD8D47B76FDBBC8FDAF9B7A79908E`,
T2 `180EAB3C0EB483680553102A87CA67894DBDE67FCF078C831B5A3C7653D260BB`.)

The public tag `3.4.0-rc1` contains PR #8076 (merged 2026-08-26, 6 days before the tag). Therefore
Track 1 is **not** the tag it names. The rule being reverted is
`src/libxrpl/tx/transactors/lending/LoanBrokerSet.cpp:147-162`.

### 1.3 `3.4.0-rc5` is unobtainable

- `git tag` after `git fetch --tags`: the only 3.4 tags are `3.4.0-b1 b2 b3` and `3.4.0-rc1`.
- `gh api repos/XRPLF/rippled/git/ref/tags/3.4.0-rc5` → 404. `releases/tags/3.4.0-rc5` → 404.
- `origin/staging/3.4.x` has **zero commits ahead of `3.4.0-rc1`** and the same `versionString`.
- No commit anywhere in the repo matches `--grep="3.4.0-rc[2-5]"`.

So "what differs between rc1 and rc5" cannot be answered from public sources. What *can* be said:
the one rule difference observed between the networks (§1.2) is explained by the hackathon branch
on Track 1, not by rc5 on Track 2 — Track 2 behaves like the public rc1 tag.

### 1.4 Open upstream branches that tell you where XLS-65/66 is going

Fetched and inspected:

- **`a1q123456/adding-perimissioned-domain-to-lending`** (JCW, last commit `710dd81e8`, 2026-06-06).
  Adds `XRPL_FEATURE(LendingPermissionedDomain, Supported::No, VoteBehavior::DefaultNo)`, a
  `tfLoanBrokerPrivate` flag and `sfDomainID` on `LoanBroker`, and a borrower-side domain check in
  `LoanSet::preclaim`. **None of this exists in 3.4.0.** See §4.3.
- **`a1q123456/support-lending-in-batch`** — the in-progress fix for §3.
- **`a1q123456/split-loan-set-and-loan-accept`** (+ `-implementation`, `-temp`) — `LoanSet` is being
  split into `LoanSet` + `LoanAccept`, i.e. the dual-signature `CounterpartySignature` pattern (the
  one the xrpl.js bug is in) is on its way out.
- **`a1q123456/tighten-vault-and-loan-delete-invariant-checks`** → open PR #8183 (2026-09-07).
- **`tapanito/vault-donation`** — a branch for the vault-donation mechanism the workshop deck
  describes and that does not exist in 3.4.0.
- **`ripple/lending-protocol-fv`**, `ripple/lending-stage`, `ximinez/lending-XLS-66-archive*`.

Open PRs touching this surface at the time of writing: #8204 (LoanBrokerDelete asset auth),
#8183 (delete invariants), #8152 (MPT issuance flags never cleared), #8018/#8017/#8016
(vault dust custody), #8002 (cross-scale arithmetic in loan default/payment).

---

## 2. Commit and PR history

202 commits touch `*Vault*`, `*Loan*`, `*lending*` (dedup'd across the 3.2/3.3 release-branch
back-merges). Full raw list saved at `/tmp/lending-commits.txt`. The spine:

| Date merged | PR | Author | What |
|---|---|---|---|
| 2025-05-20 | #5224 | Bronek Kozicki | **Add single asset vault (XLS-65d)** — the `SingleAssetVault` amendment |
| 2025-09-04 | #5652 | Bronek Kozicki | Add `Scale` to SingleAssetVault |
| 2025-10-08 | #5518 | Bronek Kozicki | Add vault invariants |
| 2025-12-02 | #5270 | Ed Hennis (`ximinez`) | **Implement Lending Protocol (unsupported)** — the `LendingProtocol` amendment |
| 2026-01-12/13 | #6156, #6102 | Ed Hennis | Improve and fix bugs in Lending Protocol — XLS-66 |
| 2026-03-11 | #6489 | yinyiqian1 | Mark SAV and Lending transactions as `NotDelegable` |
| 2026-04-24 | #6638 | Mayukha Vadari | Move `LendingHelpers` into `libxrpl/ledger/helpers` |
| 2026-07-01 | #6324 | Vito Tumas (`Tapanito`) | **Introduce `LendingProtocolV1_1` amendment**, `MemoData` on `VaultDelete` |
| 2026-07-30 | #7817 | Vito Tumas | **Implement LoanBroker cash-basis accounting** |
| 2026-08-12 | #7921 | JCW (`a1q123456`) | **Add a new closed-ended vault to extend SAV** |
| 2026-08-26 | #8076 | Vito Tumas | **Reject open-ended vaults at LoanBrokerSet** (reverted on the hackathon branch) |
| 2026-08-27 | #7732 | JCW | Add vault invariants (second wave) |
| 2026-09-03 | #8171 | Bart | Bump version to 3.4.0-rc1 |

**Age of the surface we are being asked to build on: the closed-ended vault is 31 days old at
the hackathon; the rule that a LoanBroker requires one is 17 days old; cash-basis accounting is
44 days old.**

### 2.1 The fixes that landed *after* the feature — what broke

The interesting signal is the density and the subject matter. 40+ `fix:` PRs land against
vault/lending after the features merge. The last ten days before rc1 alone:

```
2026-08-27 #8119 Waive unrealized-loss discount on sole-holder VaultClawback
2026-08-26 #8111 Refuse a pseudo-account as the vault clawback holder
2026-08-26 #6557 Prevent early loan impairment and due-date manipulation
2026-08-26 #8057 Clamp Vault Deposit, Withdraw, and Clawback to assetsTotal grid
2026-08-26 #8076 Reject open-ended vaults at LoanBrokerSet
2026-08-25 #8075 Prevent vault clawback and withdraw overrun
2026-08-25 #8055 Absorb Vault invariant rounding noise
2026-08-24 #7977 Tighten destination checks on vault withdrawal
2026-08-24 #7877 Remove credentials pinned to Vault, LoanBroker, and AMM pseudo-accounts
2026-08-24 #8013 Exempt vault and loan broker accounts from IOU authorization
2026-08-21 #8014 Reject vault deposits that move nothing from the depositor
2026-08-20 #8015 Return specific and consistent errors from vault_info
2026-08-20 #7107 Check credential for LoanBrokerCoverWithdraw and VaultWithdraw
2026-08-19 #7950 Reject VaultWithdraw fixed-share amounts that round to zero
2026-08-19 #7932 Exempt loan default from asset freeze
2026-08-18 #7843 Conserve funds correctly when LoanPay fee payee is below reserve
```

Three clusters, and they are the three places to go hunting:

- **Rounding / scale / precision** (#8057, #8075, #8055, #7950, #7272, #7274, #7360, #7050, #7093,
  #7033, #7139, #5997, #6217). Every single one is a vault-accounting arithmetic bug. This is the
  most bug-dense area in the whole subsystem and the fixes are still landing (open PRs #8002, #8016-8018).
- **Freeze / authorization / credential interaction** (#7932, #8013, #7877, #7107, #7382, #7125).
  Every one is "primitive X was not considered when the vault or broker pseudo-account is a party".
- **Pseudo-account handling** (#8111, #7877, #5954). The vault and broker pseudo-accounts keep
  turning out to be reachable as a *holder*, *destination*, or *credential subject* where the
  authors did not expect it.

### 2.2 `LendingProtocolV1_1` at code level — the complete gate list

Both networks have this amendment on, so this is the live behaviour. Eleven sites, all verified
identical between `3.4.0-rc1` and `origin/develop`:

| Site | Effect when V1_1 enabled |
|---|---|
| `vault/VaultCreate.cpp:47-51` | `VaultKind` / `SubscriptionDate` / `RedemptionDate` accepted (otherwise `checkExtraFeatures` fails the tx) |
| `vault/VaultCreate.cpp:276-287` | New vaults get `sfLEVersion = VaultVersion::CashBasis`, `sfVaultKind`, and the two dates |
| `vault/VaultDelete.cpp:33` | `sfMemoData` accepted |
| `vault/VaultDeposit.cpp:110-119` | **`tecEXPIRED`** if the vault is in Investment or Redemption |
| `vault/VaultWithdraw.cpp:90-98` | **`tecTOO_SOON`** if the vault is in Investment |
| `lending/LoanSet.cpp:319-344` | `tecTOO_SOON` in Subscription, `tecEXPIRED` in Redemption, `tecNO_PERMISSION` if `StartDate + Interval*Total + 60s > RedemptionDate` |
| `lending/LoanBrokerSet.cpp:147-162` | **`tecNO_PERMISSION` unless the vault is closed-ended** (this is what Track 1 reverts) |
| `ledger/helpers/LendingHelpers.h:341-400`, `.cpp:251` | Accounting model switches from `accrual::` (interest recognised into `AssetsTotal`/`DebtTotal` at origination) to `cash_basis::` (principal-only; interest recognised as paid). Dispatch requires **both** the amendment **and** `Vault.LEVersion == CashBasis`, so pre-amendment vaults keep accrual for life. |
| `invariants/InvariantCheck.cpp:1209-1231` | `sfVaultKind`, `sfSubscriptionDate`, `sfRedemptionDate`, `sfSequence`, `sfOwnerNode`, `sfOwner`, `sfWithdrawalPolicy`, `sfScale`, `sfLEVersion`, `sfAsset`, `sfAccount`, `sfShareMPTID` become immutable |
| `invariants/InvariantCheck.cpp:1186-1207` | `lsfLoanOverpayment` may never toggle; `lsfLoanDefault` becomes write-once |
| `invariants/LoanBrokerInvariant.cpp:125-134`, `LoanInvariant.cpp:54-60`, `VaultInvariant.cpp:555-557` | Delete-path invariants move/relax |

Closed-ended constants, `include/xrpl/protocol/Protocol.h:349-368`:
`kLoanRedemptionBuffer = 60 s`, `kMinInvestmentPeriod = 180 s`,
`kMaxInvestmentPeriod = 946 708 560 s` (30 Gregorian years). Gap rule at
`ledger/helpers/VaultHelpers.cpp:273-279`: `min <= Redemption - Subscription < max`.
Phase derivation at `VaultHelpers.cpp:289-306`: Subscription is inclusive of
`now == SubscriptionDate`; Investment starts strictly after.

**Only three transactors ever ask what phase a vault is in.** `grep -rn 'getVaultPhase' src/libxrpl`
returns `LoanSet.cpp:321`, `VaultDeposit.cpp:112`, `VaultWithdraw.cpp:92` and nothing else.
`VaultSet`, `VaultClawback`, `VaultDelete`, `LoanPay`, `LoanManage`, `LoanDelete`,
`LoanBrokerSet` (modify), `LoanBrokerDelete`, `LoanBrokerCoverDeposit/Withdraw/Clawback` are
all phase-blind. That single fact is the mechanism behind most of §4.

---

## 3. Batch (XLS-56) × Lending (XLS-65/66): blocked by construction

`include/xrpl/tx/transactors/system/Batch.h:60-76`:

```cpp
static constexpr auto kDisabledTxTypes = std::to_array<TxType>({
    ttVAULT_CREATE, ttVAULT_SET, ttVAULT_DELETE, ttVAULT_DEPOSIT, ttVAULT_WITHDRAW,
    ttVAULT_CLAWBACK, ttLOAN_BROKER_SET, ttLOAN_BROKER_DELETE, ttLOAN_BROKER_COVER_DEPOSIT,
    ttLOAN_BROKER_COVER_WITHDRAW, ttLOAN_BROKER_COVER_CLAWBACK, ttLOAN_SET, ttLOAN_DELETE,
    ttLOAN_MANAGE, ttLOAN_PAY,
});
```

Enforced at `src/libxrpl/tx/transactors/system/Batch.cpp:289-295` → `temINVALID_INNER_BATCH`.
All 15 vault/lending types. `BatchV1_1` is enabled on both networks; so is `LendingProtocol`.
They cannot be used together.

Verified on chain (`batch-lending2.mjs`), with a control that passes so the result is not a
malformed-batch artefact:

| Batch contents | Track 1 | Track 2 |
|---|---|---|
| `[Payment, Payment]` (control) | `tesSUCCESS` `C058909FABDAFF577BAF45337EB41DF322F09F09D464ABDFD31397015807A8A5` | `tesSUCCESS` `EE42AAD772FC06C3B3EDE2E4D41B141A7F7DD284CF4D60EA82B4E4389FD0F47E` |
| `[VaultDeposit, Payment]` | `temINVALID_INNER_BATCH` | `temINVALID_INNER_BATCH` |
| `[Payment, LoanPay]` | `temINVALID_INNER_BATCH` | `temINVALID_INNER_BATCH` |

Two DevEx problems here, both fixable:

- **F-1 (docs).** Nothing in the XLS-56 material or the `Batch` documentation lists the 15
  forbidden inner types. You find out by reading a private C++ header. *Proposed fix:* publish
  `kDisabledTxTypes` in the Batch docs page and expose it in `server_definitions` so SDKs can
  validate client-side.
- **F-2 (errors).** `Batch.cpp:350` collapses **any** failing inner preflight into the same
  `temINVALID_INNER_BATCH` used for a disabled type, with the real reason only in a `JLOG(debug)`
  the devnet user cannot read. I burned two probe cycles on this: my first control batch failed
  with `temINVALID_INNER_BATCH` and I had to read rippled to discover the reason was
  `temREDUNDANT` on a self-payment inner. *Proposed fix:* return the inner's own `NotTEC` (or add
  the failing inner index + code to the error payload of `submit`/`simulate`).

`PermissionDelegationV1_1` is also enabled on both networks and is equally unusable with lending:
`include/xrpl/protocol/detail/transactions.macro:22` makes `Delegation::NotDelegable` the default
and no vault or lending `TRANSACTION(...)` entry overrides it (PR #6489, 2026-03-11);
`include/xrpl/protocol/detail/permissions.macro` contains no vault or loan granular permission.

---

## 4. Test-coverage map

### 4.1 The suites

Sources: 15 transactors, 5 908 lines (`src/libxrpl/tx/transactors/{vault,lending}/`),
plus 1 957 lines of invariants and 330 lines of `VaultHelpers.cpp`.
Tests: 29 341 lines across `src/test/app/vault/` (14 suites) and `src/test/app/lending/` (12 suites).
Split out of the old monoliths by #8041 (`Vault_test`, 2026-08-18) and #7864 (`Loan_test`, 2026-08-04).

Error surface: **137 distinct `return te*` sites, 15 transactors**, of which `tecNO_PERMISSION` is
used by 10 different transactors for 10 different reasons. **192 of those returns carry
`// LCOV_EXCL_*`**, i.e. the authors assert they are unreachable and exclude them from coverage
measurement (`VaultClawback.cpp` 25, `VaultDelete.cpp` 25, `VaultWithdraw.cpp` 23, `LoanPay.cpp` 19).
§4.6 shows one of those 192 is reachable in three transactions.

### 4.2 THE structural gap: the lending suite tests a configuration neither network can produce

```
src/test/app/lending/LoanTestBase.h:91
    FeatureBitset const all_{jtx::testableAmendments() - featureLendingProtocolV1_1};

src/test/app/lending/LoanBroker_test.cpp:81
    FeatureBitset const all_{jtx::testableAmendments() - featureLendingProtocolV1_1};
    // ...this suite exercises loan-broker mechanics on plain open-ended vaults.

src/test/app/vault/VaultTestBase.h:116
    FeatureBitset const all_{test::jtx::testableAmendments()};     // V1_1 IS included
```

Count of `featureLendingProtocolV1_1` opt-ins per lending suite:

| Suite | lines | V1_1 opt-ins |
|---|---|---|
| `LoanCashBasis_test.cpp` | 1 280 | 20 |
| `LoanInvariants_test.cpp` | 1 122 | 4 (2 real) |
| `LoanSet_test.cpp` | 846 | 2 |
| `LoanValidation_test.cpp` | 625 | 2 |
| `LoanLifecycle_test.cpp` | 704 | 1 (comment) |
| `LoanSecurity_test.cpp` | 1 194 | 1 (comment) |
| `LendingHelpers_test.cpp` | 2 019 | 1 (comment) |
| **`LoanBroker_test.cpp`** | **3 020** | **0** |
| **`LoanPay_test.cpp`** | **1 525** | **0** |
| **`LoanRounding_test.cpp`** | **1 256** | **0** |
| **`LoanCoverFreezeAuth_test.cpp`** | **913** | **0** |
| **`LoanMisc_test.cpp`** | **573** | **0** |

So on the hackathon networks (V1_1 on, closed-ended mandatory on Track 2, cash-basis accounting):

- the **entire first-loss-cover surface** — `LoanBrokerSet` modify, `LoanBrokerCoverDeposit`,
  `LoanBrokerCoverWithdraw`, `LoanBrokerCoverClawback`, `LoanBrokerDelete`, and their freeze /
  lock / require-auth interactions — is covered **only** by suites that disable the amendment;
- **every `LoanPay` rounding and late-payment path** is covered only under accrual accounting;
  cash-basis `LoanPay` is covered only by `LoanCashBasis_test.cpp`'s own cases.

*Proposed fix (PR-able):* parameterise `LoanTestBase::all_` over `{all_, all_ | featureLendingProtocolV1_1}`
the way `LoanCashBasis_test.cpp:837` and `:907` already do for two cases, and let
`createVaultAndBroker`'s existing auto-promotion (`LoanTestBase.h:514-520`) supply the closed-ended vault.

Bonus: `LoanBatch_test` (the randomised loan fuzzer, `LoanMisc_test.cpp:438-541`) and
`LoanArbitrary_test` are declared `BEAST_DEFINE_TESTSUITE_MANUAL` at `LoanMisc_test.cpp:570-571`,
i.e. **not run in CI**.

### 4.3 Credentials and Permissioned Domains × lending: the borrower is not gated at all

`grep -rn 'Domain\|Credential' src/libxrpl/tx/transactors/lending/` returns hits in exactly one
file: `LoanBrokerCoverWithdraw.cpp` (lines 8, 32-33, 57, 121-124) — and only for `sfCredentialIDs`
on the *withdrawing account's* DepositPreauth, gated on `featureCredentials && fixCleanup3_4_0`.

- `LoanSet` has **no** domain or credential check. It validates the borrower with
  `requireAuth(view, vaultAsset, borrower, AuthType::StrongAuth)` (`LoanSet.cpp:609`) — that is
  MPT/IOU issuer authorization, not Permissioned Domain membership.
- `LoanBroker` has no `sfDomainID` and no `lsfLoanBrokerPrivate` flag in 3.4.0
  (`include/xrpl/protocol/detail/ledger_entries.macro:ltLOAN_BROKER`,
  `transactions.macro:ttLOAN_BROKER_SET`).

**Consequence for a tokenised-security vault:** a private, domain-gated vault restricts who may
*hold shares*. It does not restrict who may *borrow the underlying*. A LoanBroker on that vault
can disburse the security to any account that is authorized on the asset itself. The permissioned
perimeter has a hole exactly where a securities-lending story needs it not to.

**This is acknowledged upstream and unfinished.** Branch
`a1q123456/adding-perimissioned-domain-to-lending`, commit `710dd81e8`, adds
`featureLendingPermissionedDomain`, `tfLoanBrokerPrivate` + `sfDomainID` on the broker, and a
domain check in `LoanSet::preclaim` guarded on the new amendment. Last touched 2026-06-06; not merged.

Today's only workable eligibility lever for borrowers is `lsfMPTRequireAuth` on the security MPT
plus per-holder `MPTokenAuthorize` by the issuer — issuer-by-issuer, not domain-based.

### 4.4 Closed-ended phase coverage, suite by suite

`grep -c 'ClosedEnded|vaultKind|subscriptionDate|redemptionDate'` per vault suite:

| Suite | hits | verdict |
|---|---|---|
| `VaultBugs_test.cpp` | 23 | covered |
| `VaultRPC_test.cpp` | 9 (`testRPCClosedEnded`) | covered |
| `VaultClawback_test.cpp` | 4 | covered |
| `VaultClosedEnded_test.cpp` | the suite | 10 cases — see below |
| **`VaultDomain_test.cpp`** | **0** | no closed-ended × permissioned domain test exists |
| **`VaultFreeze_test.cpp`** | **0** | no closed-ended × frozen IOU / locked MPT test exists |
| **`VaultSoleShareholder_test.cpp`** | **0** | sole-holder exit never tested in Redemption |
| **`VaultScale_test.cpp`** | **0** | no closed-ended × non-default `Scale` |
| **`VaultShares_test.cpp`** | **0** | no closed-ended × non-transferable / confidential shares |
| **`VaultLifecycle_test.cpp`** | **0** | `testWithMPT` and `testWithIOU` are open-ended only |
| **`VaultValidation_test.cpp`** | **0** | — |

`VaultClosedEnded_test.cpp` (1 009 lines, 10 cases, `run()` at :992-1003):
`testVaultCreateClosedEnded`, `…SubscriptionDateBoundary`, `testVaultPhaseDerivation`,
`…OpenEnded`, `testVaultDepositClosedEnded`, `testVaultWithdrawClosedEnded`,
`testVaultClosedEndedLifecycle`, `testVaultLoanLatePaymentAfterInvestment`,
`testVaultClosedEndedMultipleLoans`, `testVaultClawbackClosedEndedPhases`.

**Nine of the ten use `Asset const asset = xrpIssue()`** (lines 63, 322, 386, 465, 504, 549, 629,
788, 855). The tenth (`testVaultClawbackClosedEndedPhases`, line 952) is the only one with a
non-XRP asset — an IOU, for clawback. **There is no closed-ended test with an MPT asset anywhere.**
There is no `domain`, `credential`, `Domain`, `Credential` or `tfVaultPrivate` token in the whole file.

In the lending suites, phase-boundary behaviour is tested in **one place only**:
`LoanSet_test.cpp:640-760` (`testLoanSetClosedEnded`), six cases — Subscription rejection,
Redemption rejection, Investment success, buffer violation, exact-boundary accept/reject, and a
`kMinInvestmentPeriod` vault. Excellent work, XRP-only, and it covers `LoanSet` alone.
Everywhere else the default `redemptionOffset` is **10 years** (`LoanTestBase.h:124`) and
`createVaultAndBroker` jumps straight to `SubscriptionDate + 1` (`LoanTestBase.h:553-559`), so
**no lending test ever crosses into the Redemption phase** except via `LoanSet_test.cpp`.

### 4.5 First-loss cover: the payout formula and what nobody tests

`src/libxrpl/tx/transactors/lending/LoanManage.cpp:146-171`:

```
defaultCovered = min(
    tenthBipsOfValue( tenthBipsOfValue(broker.DebtTotal, CoverRateMinimum), CoverRateLiquidation ),
    totalDefaultAmount,
    broker.CoverAvailable )
```

Two properties worth saying out loud, both straight from the code:

- The first term is a function of the broker's **aggregate `DebtTotal`**, not of the defaulting
  loan's own exposure. With the suite's own defaults (`CoverRateMinimum` 10 %,
  `CoverRateLiquidation` 25 %, `LoanTestBase.h:98-101`) that is **2.5 % of total book debt**.
- It is read **before** any adjustment (`brokerDebtTotalProxy` captured at :147), so defaulting the
  same loan when the book is larger pays out more cover; and the first loan to default draws cover
  computed on everyone else's debt too.

**No test in the repository ever defaults one loan while another loan is outstanding on the same
broker.** `tfLoanDefault` appears in 7 test files; `LoanCashBasis_test.cpp:725-743` is the only
place a second loan is created at all, and it never defaults either of them.

`CoverRateMinimum`/`CoverRateLiquidation` bounds: `kMaxCoverRate = percentageToTenthBips(100) = 100 000`
(`include/xrpl/protocol/Protocol.h:158-159`), checked at `LoanBrokerSet.cpp:47-50`.
xrpl.js `loanBrokerSet.js:40-42` enforces the same bound client-side and is **correct** — my first
probe passed 1 000 000 and was rightly rejected by the SDK before it reached the ledger. Not a bug.

### 4.6 Reachable "unreachable": `VaultDelete` with a live LoanBroker

`LoanBrokerSet.cpp:252` links the broker into the **vault pseudo-account's** owner directory:

```cpp
if (auto const ter = dirLink(view, vaultPseudoID, broker, sfVaultNode))
```

`VaultDelete::preclaim` (`VaultDelete.cpp:44-93`) checks owner, `AssetsAvailable`, `AssetsTotal`,
and the share issuance's `OutstandingAmount` — **it never looks for a LoanBroker**. The failure
therefore happens in `doApply`, at:

```cpp
// src/libxrpl/tx/transactors/vault/VaultDelete.cpp:162-164
// The pseudo-account's directory should have been deleted already.
if (view().peek(keylet::ownerDir(pseudoID)))
    return tecHAS_OBLIGATIONS;  // LCOV_EXCL_LINE
```

Verified on chain (`vaultdelete-broker.mjs`), three transactions from a funded account, with a
control proving the empty vault deletes cleanly:

| Step | Track 1 | Track 2 |
|---|---|---|
| `VaultDelete`, no broker (control) | `tesSUCCESS` `CAF9C3CE7C92D8A2C7EB50DC88B6B508A6CC98FB72354D46DCBF5123DCA6282C` | `tesSUCCESS` `8FACBF78DDA313902454A09C420447D168DBFDFB8FCB55DB9F3E11CB46774014` |
| `VaultCreate` → `LoanBrokerSet` → `VaultDelete` | `tecHAS_OBLIGATIONS` `874DCF4CFD06E1E0970023F42D8B2ECA2B473AA0362BB1A067838D8F26CDE99E` | `tecHAS_OBLIGATIONS` `3AA64C4250A368921F399D603F38F5548B6808759F436B57C61D86CEDF4F35C9` |

Both vaults were identical (closed-ended, zero assets, zero outstanding shares); the *only*
difference is the attached broker, and the control proves `preclaim` passes for that shape.
So the `tecHAS_OBLIGATIONS` is returned from `doApply`. Line 164 is the first candidate; the four
later ones (`:169`, `:177`, `:184`, `:191`) are also `LCOV_EXCL`. Either way the headline holds:
**a coverage-exempt "should be impossible" branch is reachable in three transactions, and the user
pays a burned fee for a condition `preclaim` could have caught.**

Corroborating evidence that the authors are unsure about these paths:
`src/test/app/lending/LoanBroker_test.cpp:1190-1193` carries the literal comment
`all tecHAS_OBLIGATIONS (can any of these happen?)`.
No test anywhere calls `VaultDelete` on a vault with a live broker
(`LoanBroker_test.cpp:514` deletes a vault that does not exist, expecting `tecNO_ENTRY`).

*Proposed fix:* add to `VaultDelete::preclaim`, after the `AssetsTotal` check —
`if (view.exists(keylet::ownerDir(vault->at(sfAccount)))) return tecHAS_OBLIGATIONS;` — with a
`JLOG` naming the broker, drop the `LCOV_EXCL_LINE` on `:164`, and add a
`VaultLifecycle_test` case. Small, self-contained, exactly the shape of the "contribute back" bonus.

### 4.7 The headline product finding, sharpened with the grace period

The team's finding — a closed-ended vault can reach Redemption while illiquid — has a precise and
worse form. Three constraints that do not compose:

1. `LoanSet.cpp:333-343` only requires `StartDate + PaymentInterval*PaymentTotal + 60 s < RedemptionDate`.
   **`GracePeriod` is not in that expression.**
2. `LoanSet.cpp:133-139`: `validNumericRange(GracePeriod, PaymentInterval, kDefaultGracePeriod)` —
   i.e. `60 <= GracePeriod <= PaymentInterval`, with no relation to `RedemptionDate`.
3. `LoanManage.cpp:104-114`: `tfLoanDefault` returns `tecTOO_SOON` until
   `NextPaymentDueDate + GracePeriod` has passed (exclusive under `fixCleanup3_4_0`, enabled on both networks).

So the loan's last payment can fall 60 s before `RedemptionDate` while its grace period runs until
`RedemptionDate + (PaymentInterval − 60)`. During that window the vault is in Redemption:
`VaultDeposit` is `tecEXPIRED` (`VaultDeposit.cpp:110-119`), `VaultWithdraw` is capped at
`AssetsAvailable`, `VaultDelete` is `tecHAS_OBLIGATIONS` (`VaultDelete.cpp:56-66`), and the lender
cannot declare default to pull the cover. With `kMaxInvestmentPeriod = 30 years` the window can be
made years long. `LoanInvariant.cpp:66-95` re-checks only the same schedule bound, only at creation
(`if (!before && isTesSuccess(result))`).

No test covers it: the sole Redemption-phase loan test,
`VaultClosedEnded_test.cpp:773-837` (`testVaultLoanLatePaymentAfterInvestment`), uses default
schedule parameters and asserts only that a late `LoanPay` succeeds.

*Proposed fix:* include `GracePeriod` in the `LoanSet` maturity bound —
`finalPayment + GracePeriod + kLoanRedemptionBuffer <= RedemptionDate` — and mirror it in
`LoanInvariant`. One line each, and it makes "the vault can always be wound up at Redemption" true.

### 4.8 A small, precise test gap worth a PR

`VaultWithdraw.cpp:223-228` documents an escape hatch:

> Two cases deliberately skip the check. Withdrawing to self is never restricted: losing vault
> access must not strand funds already deposited.

and implements it as `dstAcct != account && dstAcct != vaultAsset.getIssuer()`.
`VaultDomain_test.cpp::testDomainLossAfterAcquisition` sets up exactly the scenario (depositor
acquires shares, then the credential is deleted), asserts that P2P transfer is `tecNO_AUTH` and a
DEX offer is `tecUNFUNDED_OFFER` — and **never asserts that the self-withdraw escape hatch works**.
The one behaviour the comment promises is the one behaviour not tested. Adding
`env(vault.withdraw({.depositor = depositor, ...}))` expecting `tesSUCCESS` to that test is a
three-line PR. (I checked this carefully because I first suspected a stranding bug; the code is
correct, only the test is missing.)

---

## 5. Ranked untested surface — where to hunt, highest first

1. **First-loss cover under `LendingProtocolV1_1`.** `LoanBroker_test.cpp` (3 020 lines) and
   `LoanCoverFreezeAuth_test.cpp` (913 lines) both run with the amendment off. Cover deposit /
   withdraw / clawback / broker delete under cash-basis accounting on a closed-ended vault is
   untested end to end. Highest density of prior bugs (#7125, #7274, #7932, #8013) + zero coverage.
2. **Default while a second loan is outstanding.** §4.5. The payout formula reads broker-wide
   `DebtTotal`; nothing tests the interaction, and the ordering effect is economically real.
3. **`GracePeriod` past `RedemptionDate`.** §4.7. Demonstrable on devnet in ~6 minutes with
   `kMinInvestmentPeriod = 180 s`.
4. **Closed-ended vault whose asset is an MPT.** Zero tests anywhere. The `Scale`/precision cluster
   (#8057, #8075, #8055, #7950) is the most bug-dense area in the subsystem and the phase logic has
   never met it on an integral asset.
5. **Closed-ended × private vault × Permissioned Domain.** `VaultDomain_test.cpp` has zero
   closed-ended references; `VaultClosedEnded_test.cpp` has zero domain references. The two
   features have literally never been tested in the same `Env`.
6. **Phase-blind transactors in Redemption.** `VaultSet` (can change `DomainID`, `AssetsMaximum`,
   `Data` at any phase), `VaultClawback`, `LoanManage` impair/unimpair, `LoanDelete`,
   `LoanBrokerDelete`, `LoanBrokerCoverWithdraw` — none consults `getVaultPhase`, none is tested
   across a phase boundary.
7. **Closed-ended × freeze / deep-freeze / MPT lock.** `VaultFreeze_test.cpp`: zero closed-ended
   references. A frozen asset plus a Redemption deadline is a deadlock candidate.
8. **`VaultDelete` / `LoanBrokerDelete` teardown ordering.** §4.6, plus the 25 `LCOV_EXCL` returns
   in `VaultDelete.cpp` and 13 in `LoanBrokerDelete.cpp`, plus the authors' own
   "can any of these happen?" comment.
9. **Sole shareholder in Redemption.** `VaultSoleShareholder_test.cpp`: zero closed-ended
   references, and #8119 (2026-08-27) was a sole-holder clawback bug found 16 days before rc1.
10. **`Sponsor` × vault/lending.** `Sponsor` is enabled on both networks and brand new in 3.4.0.
    `VaultBugs_test.cpp` has three sponsored-withdraw regressions; nothing tests sponsorship with
    the lending transactors at all.

---

## 6. Consequences for what we build

- **Build closed-ended.** It is the only shape that works on both networks (Track 2 rejects
  open-ended brokers; Track 1 accepts both). Do not rely on Track 1's open-ended acceptance:
  it is a local revert, not the protocol.
- **Do not plan on Batch.** §3. If the demo wants atomicity across vault + loan operations, that
  atomicity does not exist today, and saying so with `temINVALID_INNER_BATCH` receipts is worth
  more than pretending otherwise.
- **Do not plan on Permission Delegation for the lending agent.** §3, last paragraph.
- **Borrower eligibility must be enforced with `lsfMPTRequireAuth` + `MPTokenAuthorize` on the
  security MPT**, not with a Permissioned Domain, because `LoanSet` does not read domains (§4.3).
  Say this on the slide and cite the upstream branch that is fixing it.
- **The strongest "Loaded" combinations that are live, untested and relevant:**
  closed-ended vault with an MPT asset (gap #4), private vault + PermissionedDEX for the
  collateral leg (`VaultDomain_test.cpp::testDomainCheckBuyerSideOffer` exists, closed-ended
  version does not), `TokenEscrow` on vault shares (`VaultClawback_test.cpp::testVaultEscrowedMPT`
  exists, closed-ended version does not), and `Sponsor` anywhere near a loan (gap #10).

---

## 7. DevEx friction observed while doing this work

| # | Where | What | Proposed fix |
|---|---|---|---|
| R-1 | Both devnets, `server_info` | `build_version` is not a build identity. Track 1 says `3.4.0-rc1` but runs `ripple/lending-hackathon` (`440018c0f`) with PR #8076 reverted; Track 2 says `3.4.0-rc5`, which exists in no public tag, release or branch. Two networks, one advertised version each, neither resolvable to source. | Add the git commit SHA to `server_info` (rippled already embeds it in some builds) and, for event networks, publish the exact branch/commit next to the RPC URL. One line in the hackathon README would have saved an hour. |
| R-2 | `Batch.cpp:350` | Every inner-transaction preflight failure returns the same `temINVALID_INNER_BATCH` as a disabled inner type; the real code is only in a server debug log. Cost me two probe cycles. | Propagate the inner `NotTEC`, or add `{inner_index, inner_result}` to the error response of `submit` and `simulate`. |
| R-3 | `Batch.h:60-76` | The 15 forbidden inner transaction types are documented nowhere outside a private C++ header. | List them in the Batch docs and expose them in `server_definitions`. |
| R-4 | `tecNO_PERMISSION` across lending | Ten transactors return it for ten different reasons (open-ended vault, wrong owner, loan already defaulted, maturity past `RedemptionDate`, non-private vault…). The reason exists only in `JLOG`. | Split the codes (`tecWRONG_VAULT_KIND`, `tecAFTER_REDEMPTION`, `tecLOAN_DEFAULTED`) or surface the log reason in metadata. |
| R-5 | `LoanSet` maturity bound | The bound is evaluated against the ledger close time **at execution**, not at submission (`getStartDate(ctx.view)`, `LoanSet.cpp:334`). Near `RedemptionDate` a transaction that is valid when you build it becomes `tecNO_PERMISSION` by the time it applies — this happened to me on Track 2, tx `079A16E62F414D5DD5EA0623BE6B5337A2EAC68266400396A493D1D1ED0ACCAF`. rippled's own test warns about it at `LoanSet_test.cpp:723-726`. | Document that `StartDate` is the applying ledger's close time, and tell SDK users to leave margin; better, let `LoanSet` accept an explicit `StartDate` or return the computed one in metadata. |
| R-6 | `VaultDelete` | Fails in `doApply` (fee burned) for a condition `preclaim` could detect — a live LoanBroker in the vault pseudo-account's directory — on a line marked `LCOV_EXCL_LINE`. | §4.6. |
| R-7 | `git clone` + release tooling | `XRPLF/rippled` has 3.4.0 release candidates that are neither tagged nor released on GitHub, and a `staging/3.4.x` branch identical to rc1. There is no way to answer "what is rc5". | Tag release candidates, or point the devnet status page at the commit. |

---

## 8. Open questions

- Which of the five `tecHAS_OBLIGATIONS` returns in `VaultDelete::doApply` actually fires in §4.6.
  Deciding it needs a local debug build; the finding (a `LCOV_EXCL` branch is reachable) holds either way.
- What `3.4.0-rc5` contains relative to `3.4.0-rc1`. Not answerable from public sources; the only
  behavioural difference I found between the networks is explained by Track 1's branch, not by rc5.
- Whether the hackathon organisers intend Track 1's open-ended acceptance, or whether the revert is
  a leftover from an earlier workshop script. Worth asking Maxime directly — it is a good question
  to be seen asking.
- `LendingProtocolV1_2` (registered `21890d9da`, 2026-09-09, `Supported::No`) is empty of behaviour
  on develop. Not on either network.
