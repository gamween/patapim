# rippled C++ source: XLS-65 Vaults + XLS-66 Lending Protocol

Research slug: `rippled-source`. Written 2026-09-12 for team **patapim**, XRPL Lending Protocol Hackathon.
Everything below is read from source, package metadata, or the live ledgers. Nothing is inferred from blog posts or the event brief.

Working clone (scratchpad, disposable):
`a local scratch checkout of rippled`

---

## 0. TL;DR — the three things that change the plan

1. **`LendingProtocolV1_1` is ENABLED on BOTH devnets.** Verified at the ledger level (the `Amendments` object), not just via the `feature` RPC. The event brief's framing "Track 1 = Lending Protocol V1, Track 2 = V1.1" is not what the networks run. Consequence: **every vault you create on either network gets `LEVersion = 1` (CashBasis)**, so Track 1 also uses cash-basis accounting, and closed-ended vaults are creatable on Track 1 too.
2. **The only production-code difference between the two networks is 16 lines in `LoanBrokerSet.cpp`.** `git diff ripple/lending-hackathon develop -- src/libxrpl include/xrpl src/xrpld` → 1 file, +16 lines. The hackathon branch reverts PR #8076, so `LoanBrokerSet` accepts open-ended vaults there; on the public devnet it returns `tecNO_PERMISSION`. **Proved live on both networks** (see §2.3).
3. **`tfVaultDonation` does not exist.** There is no donation flag, no donation code path, and no `sfVaultDonation`-ish field anywhere in `develop` or `ripple/lending-hackathon`. `VaultDeposit` has no flags at all. Do not build a demo that depends on it. (A `tapanito/vault-donation` branch exists, unmerged, last commit 2026-09-09.)

---

## 1. What is actually deployed

### 1.1 Live network fingerprints (verified 2026-09-12)

| | Track 1 "custom hackathon devnet" | Track 2 "public XRPL Devnet" |
|---|---|---|
| RPC | `https://lending-hackathon.dev.ripplex.io:51234` | `https://s.devnet.rippletest.net:51234/` |
| `build_version` | `3.4.0-rc1` | `3.4.0-rc5` |
| `network_id` | 4001 | 2 |
| enabled amendments | 48 | 89 |
| matching source | `XRPLF/rippled` branch `ripple/lending-hackathon` @ `440018c0f` | **no public branch or tag matches** (see friction) |

```bash
curl -s -X POST https://lending-hackathon.dev.ripplex.io:51234 \
  -H 'Content-Type: application/json' -d '{"method":"server_info","params":[{}]}' | jq .result.info.build_version
```

### 1.2 Lending-relevant amendments, both networks

Amendment IDs are `sha512half(<amendment name>)`; I checked each against `ledger_entry {"amendments": true}` on each network rather than trusting the `feature` RPC.

| Amendment | Track 1 | Track 2 | Notes |
|---|---|---|---|
| `SingleAssetVault` | ENABLED | ENABLED | XLS-65 |
| `LendingProtocol` | ENABLED | ENABLED | XLS-66 |
| **`LendingProtocolV1_1`** | **ENABLED** | **ENABLED** | closed-ended vaults, cash basis, phase gates |
| `LendingProtocolV1_2` | no | no | registered placeholder only (`Supported::No`) |
| `fixCleanup3_1_3` | ENABLED | ENABLED | |
| `fixCleanup3_2_0` | ENABLED | ENABLED | |
| `fixCleanup3_3_0` | ENABLED | ENABLED | |
| **`fixCleanup3_4_0`** | **ENABLED** | **ENABLED** | XLS-66.2 impairment timing + counterparty signature prefix |
| `fixCleanup3_5_0` | no | no | placeholder |
| `PermissionedDomains`, `Credentials` | ENABLED | ENABLED | "Loaded" flavour ingredient |
| `TokenEscrow`, `fixTokenEscrowV1` | ENABLED | ENABLED | "Loaded" flavour ingredient |
| `Sponsor` | ENABLED | ENABLED | sponsored fees/reserves |
| `MPTokensV1`, `DynamicMPT` | ENABLED | ENABLED | |
| `BatchV1_1` | ENABLED | ENABLED | `Batch` (older name) not enabled |
| `PermissionedDEX` | ENABLED | ENABLED | |

Reproduce:
```bash
for n in SingleAssetVault LendingProtocol LendingProtocolV1_1 fixCleanup3_4_0 Sponsor TokenEscrow; do
  H=$(printf "$n" | openssl dgst -sha512 -binary | xxd -p -c 200 | cut -c1-64 | tr 'a-f' 'A-F')
  grep -q "$H" amendments.txt && echo "$n ENABLED" || echo "$n no"
done
```

Amendment declarations: `include/xrpl/protocol/detail/features.macro:19,25,31,44`
```cpp
XRPL_FEATURE(LendingProtocolV1_2,         Supported::No,  VoteBehavior::DefaultNo)
XRPL_FEATURE(LendingProtocolV1_1,         Supported::Yes, VoteBehavior::DefaultNo)
XRPL_FEATURE(LendingProtocol,             Supported::Yes, VoteBehavior::DefaultNo)
XRPL_FEATURE(SingleAssetVault,            Supported::Yes, VoteBehavior::DefaultNo)
```
None of these is in a released version. The newest GitHub release of `XRPLF/rippled` is **3.3.0** (2026-08-06). `3.4.0-rc1` is the newest tag. `3.4.0-rc5` (what the public Devnet runs) is **not** a public tag, branch, or release.

### 1.3 The hackathon branch

```
$ git log --oneline ripple/lending-hackathon -3
440018c0f Revert "fix: Reject open-ended vaults at LoanBrokerSet (#8076)"
028783661 feat: Apply .macro changes from ripple/smart-escrow (#8157)
21890d9da feat: Register featureLendingProtocolV1_2 amendment (#8185)
```
Commit message of `440018c0f`:
> This reverts commit 421af6db796631da4ff8b78f5d3bafae0fd3ca32 for the lending hackathon branch, so that LoanBrokerSet once again accepts open-ended vaults when featureLendingProtocolV1_1 is enabled.

PR #8076 "fix: Reject open-ended vaults at LoanBrokerSet" merged into `develop` 2026-08-26 → https://github.com/XRPLF/rippled/pull/8076

---

## 2. Track-deciding facts

### 2.1 The 16 lines

`src/libxrpl/tx/transactors/lending/LoanBrokerSet.cpp:149-161` (present on `develop`, reverted on `ripple/lending-hackathon`), inside `preclaim`, in the *create* branch only (`sfLoanBrokerID` absent):

```cpp
// LP V1.1: only closed-ended vaults may host a loan broker. ...
if (ctx.view.rules().enabled(featureLendingProtocolV1_1) &&
    getVaultKind(sleVault) != VaultKind::ClosedEnded)
{
    JLOG(ctx.j.warn()) << "LoanBroker requires a closed-ended Vault.";
    return tecNO_PERMISSION;
}
```
Note it is enforced **only at broker creation**, not on broker update (`VaultID` is immutable on update anyway).

### 2.2 Cash basis applies everywhere (this is the biggest correction to the brief)

`VaultCreate::doApply`, `src/libxrpl/tx/transactors/vault/VaultCreate.cpp:276-287`:
```cpp
if (view().rules().enabled(featureLendingProtocolV1_1))
{
    vault->at(sfLEVersion) = std::to_underlying(VaultVersion::CashBasis);
    auto const kind = getVaultKind(tx);
    vault->at(sfVaultKind) = std::to_underlying(kind);
    if (kind == VaultKind::ClosedEnded) { /* Subscription/RedemptionDate */ }
}
```
`src/libxrpl/ledger/helpers/LendingHelpers.cpp:249-261`:
```cpp
// Cash-basis accounting applies only when featureLendingProtocolV1_1 is
// enabled AND the specific Vault was created under it (LEVersion ==
// VaultVersion::CashBasis). Vaults created before activation keep accrual-basis
// accounting forever, even after the amendment later turns on.
bool cashBasisEnabled(SLE::const_ref vaultSle)
{ return getVaultVersion(vaultSle) == VaultVersion::CashBasis; }
```

Accounting deltas, `LendingHelpers.cpp:182-247`:

| | accrual (Legacy vault) | **cash basis (every vault you can create today)** |
|---|---|---|
| origination | `AssetsTotal += interestDue`, `DebtTotal += principal + interestDue` | **`AssetsTotal += 0`, `DebtTotal += principal`** |
| payment | `AssetsTotal += valueChange`, `DebtTotal += (principal+interest paid) - valueChange` | **`AssetsTotal += interestPaid`, `DebtTotal += principalPaid`** |
| default exposure | `TotalValueOutstanding - ManagementFeeOutstanding` | **`PrincipalOutstanding`** |
| `AssetsMaximum` gate at origination | applies | **skipped entirely** (`loanOriginationExceedsVaultMaximum` returns `false`) |

**Verified live on the Track 1 custom devnet** — a vault another team built:
- vault `8F8CCB7AFDD9214483D41F87C385C4081818ED27D06F6A38A39437C7F4475F15`: `LEVersion: 1`, no `VaultKind` (open-ended), `AssetsTotal = "25008219"`, `AssetsAvailable` absent (=0)
- its loan: `PrincipalOutstanding = "25008219"`, `TotalValueOutstanding = "25013700"`
- its broker `AAAA1EB1…`: `DebtTotal = "25008219"`

`DebtTotal == PrincipalOutstanding` exactly, and `AssetsTotal == PrincipalOutstanding` (not principal + interest). That is cash basis on the *open-ended* Track 1 network.

**PPS consequence:** because interest is only recognised when a payment lands, share price is flat between payments and steps up at each `LoanPay`. A "watch yield accrue" demo will show a staircase, not a ramp. Plan the pitch around that.

### 2.3 Live side-by-side proof

Same script, same xrpl.js (`5.2.0-beta.0`), open-ended XRP vault, then `LoanBrokerSet`:

```
t2 (public devnet, 3.4.0-rc5)
  VaultCreate(open-ended, Fee=10 drops): tesSUCCESS  hash=5E444410F77925AE49215B0BCF954BDD805AAC5402FA329B926F0649FB775B0C
  new Vault NewFields: {"LEVersion":1, ... ,"WithdrawalPolicy":1}     (no VaultKind → OpenEnded)
  LoanBrokerSet(open-ended vault): tecNO_PERMISSION  hash=438D68492DBFC4C55ABCF6AA4A3B0BB51E31CA4C91F0506AADDE0A63F295C5A5

t1 (custom hackathon devnet, 3.4.0-rc1)
  VaultCreate(open-ended, Fee=10 drops): tesSUCCESS  hash=54E917A9D50234BE4D5F74025983184F7ADD261897F5BA2E955852A659B00113
  new Vault NewFields: {"LEVersion":1, ...}
  LoanBrokerSet(open-ended vault): tesSUCCESS        hash=807D2A1CD44CE4B70A4DBFF41120E9920243818E51F7606B132DDC91988910FA
```

Both `VaultCreate` transactions used **`Fee: "10"` drops** and succeeded. See §7.1.

---

## 3. Exact constants (from `include/xrpl/protocol/Protocol.h`)

```cpp
kMaxMpTokenMetadataLength   = 1024          // bytes, MPTokenMetadata
kMaxDataPayloadLength       = 256           // bytes, Data / VaultDelete MemoData
kMaxMpTokenAmount           = 0x7FFF'FFFF'FFFF'FFFF
kVaultStrategyFirstComeFirstServe = 1       // only legal WithdrawalPolicy
kVaultDefaultIouScale       = 6             // IOU vaults, default Scale
kVaultMaximumIouScale       = 18            // Scale bound; MPT/XRP forced to 0
kLoanRedemptionBuffer       = 60 s          // final payment must precede RedemptionDate by >= 60s
kMinInvestmentPeriod        = 180 s         // RedemptionDate - SubscriptionDate, inclusive lower bound
kMaxInvestmentPeriod        = 30 years (946708560 s), exclusive upper bound
kLoanPaymentsPerFeeIncrement       = 5
kLoanMaximumPaymentsPerTransaction = 100
kMaxAssetCheckDepth         = 5

// rates, all in tenth-of-basis-points; 100'000 == 100%
kMaxManagementFeeRate   = TenthBips16(10'000)   //  10%
kMaxCoverRate           = TenthBips32(100'000)  // 100%
kMaxOverpaymentFee      = TenthBips32(100'000)
kMaxInterestRate        = TenthBips32(100'000)
kMaxLateInterestRate    = TenthBips32(100'000)
kMaxCloseInterestRate   = TenthBips32(100'000)
kMaxOverpaymentInterestRate = TenthBips32(100'000)
```

`include/xrpl/tx/transactors/lending/LoanSet.h:64-73`:
```cpp
kMinPaymentTotal    = 1
kDefaultPaymentTotal= 1
kMinPaymentInterval = 60     // seconds
kDefaultPaymentInterval = 60
kDefaultGracePeriod = 60
```

Enums (`Protocol.h:327-350`):
```cpp
enum class VaultVersion : uint8_t { Legacy = 0, CashBasis = 1 };
enum class VaultKind    : uint8_t { OpenEnded = 0, ClosedEnded = 1 };
enum class VaultPhase   : uint8_t { NoPhase = 0, Subscription, Investment, Redemption };
```

### 3.1 Minimum viable Track-2 timeline

`static_assert(kMinInvestmentPeriod >= LoanSet::kMinPaymentInterval + kLoanRedemptionBuffer + 1)`
(`LoanSet.cpp:46`). So the absolute floor is:

- `SubscriptionDate = T`
- `RedemptionDate   = T + 180` (minimum legal gap)
- origination must happen at `t > T` (Investment starts strictly after `SubscriptionDate`)
- a 1-payment loan with `PaymentInterval = 60` originated at `t` needs `t + 60 + 60 <= T + 180`, i.e. `t <= T + 60`

A realistic compressed demo: `SubscriptionDate = now + 120`, `RedemptionDate = SubscriptionDate + 600`, `PaymentInterval = 60`, `PaymentTotal = 3` (final payment at `t + 180`, comfortably 60s+ before redemption). Remember the clock is the **parent ledger close time**, and devnet ledgers close ~3-4s apart.

---

## 4. Transaction reference, straight from the source of truth

`include/xrpl/protocol/detail/transactions.macro`. `SoeRequired` / `SoeOptional` is what the serializer enforces; everything else is a `preflight`/`preclaim` check.

| tt | Name | Required fields | Optional fields |
|---|---|---|---|
| 65 | `VaultCreate` | `Asset` | `AssetsMaximum`, `MPTokenMetadata`, `DomainID`, `WithdrawalPolicy`, `Data`, `Scale`, **`VaultKind`**, **`SubscriptionDate`**, **`RedemptionDate`** |
| 66 | `VaultSet` | `VaultID` | `AssetsMaximum`, `DomainID`, `Data` |
| 67 | `VaultDelete` | `VaultID` | `MemoData` (XLS-65.1, V1.1 only) |
| 68 | `VaultDeposit` | `VaultID`, `Amount` | — (**no flags**) |
| 69 | `VaultWithdraw` | `VaultID`, `Amount` | `Destination`, `DestinationTag`, `CredentialIDs` |
| 70 | `VaultClawback` | `VaultID`, `Holder` | `Amount` |
| 74 | `LoanBrokerSet` | `VaultID` | `LoanBrokerID`, `Data`, `ManagementFeeRate`, `DebtMaximum`, `CoverRateMinimum`, `CoverRateLiquidation` |
| 75 | `LoanBrokerDelete` | `LoanBrokerID` | — |
| 76 | `LoanBrokerCoverDeposit` | `LoanBrokerID`, `Amount` | — |
| 77 | `LoanBrokerCoverWithdraw` | `LoanBrokerID`, `Amount` | `Destination`, `DestinationTag`, `CredentialIDs` |
| 78 | `LoanBrokerCoverClawback` | *(none)* | `LoanBrokerID`, `Amount` |
| 80 | `LoanSet` | `LoanBrokerID`, `PrincipalRequested` | `Data`, `Counterparty`, `CounterpartySignature`, `LoanOriginationFee`, `LoanServiceFee`, `LatePaymentFee`, `ClosePaymentFee`, `OverpaymentFee`, `InterestRate`, `LateInterestRate`, `CloseInterestRate`, `OverpaymentInterestRate`, `PaymentTotal`, `PaymentInterval`, `GracePeriod` |
| 81 | `LoanDelete` | `LoanID` | — |
| 82 | `LoanManage` | `LoanID` | — |
| 84 | `LoanPay` | `LoanID`, `Amount` | — |

**There is no `LoanAccept` and no drawdown transaction.** `LoanSet::doApply` disburses the principal in the same transaction that creates the loan:
```cpp
accountSendMulti(view, vaultPseudo, vaultAsset,
    {{borrower, principalRequested - originationFee}, {brokerOwner, originationFee}},
    j_, WaiveTransferFee::Yes);
```
(`LoanSet.cpp`, doApply). "Origination + borrower acceptance + drawdown" are one `LoanSet`, made mutual by `CounterpartySignature`.

### 4.1 Flags (`include/xrpl/protocol/TxFlags.h`)

```
VaultCreate : tfVaultPrivate 0x00010000, tfVaultShareNonTransferable 0x00020000
LoanSet     : tfLoanOverpayment 0x00010000
LoanPay     : tfLoanOverpayment 0x00010000, tfLoanFullPayment 0x00020000, tfLoanLatePayment 0x00040000
LoanManage  : tfLoanDefault 0x00010000, tfLoanImpair 0x00020000, tfLoanUnimpair 0x00040000
```
`VaultDeposit`, `VaultWithdraw`, `VaultSet`, `VaultDelete`, `VaultClawback`, `LoanBroker*` have **no transaction-specific flags**.
`LoanPay` flags are mutually exclusive (`popcount > 1` → `temINVALID_FLAG`). `LoanManage` flags likewise.

### 4.2 Ledger entries (`ledger_entries.macro`)

```
ltVAULT 0x0084: Sequence, OwnerNode, Owner, Account(pseudo), Data?, Asset,
                AssetsTotal, AssetsAvailable, AssetsMaximum, LossUnrealized,
                ShareMPTID, WithdrawalPolicy, Scale, LEVersion, VaultKind,
                SubscriptionDate?, RedemptionDate?
                // no SharesTotal ever (use MPTokenIssuance.OutstandingAmount)
                // no PermissionedDomainID ever (use MPTokenIssuance.DomainID)
ltLOAN_BROKER 0x0088: Sequence, OwnerNode, VaultNode, VaultID, Account(pseudo), Owner,
                LoanSequence, Data, ManagementFeeRate, OwnerCount, DebtTotal,
                DebtMaximum, CoverAvailable, CoverRateMinimum, CoverRateLiquidation
ltLOAN 0x0089: OwnerNode, LoanBrokerNode, LoanBrokerID, LoanSequence, Borrower,
                LoanOriginationFee, LoanServiceFee, LatePaymentFee, ClosePaymentFee,
                OverpaymentFee, InterestRate, LateInterestRate, CloseInterestRate,
                OverpaymentInterestRate, StartDate, PaymentInterval, GracePeriod,
                PreviousPaymentDueDate, NextPaymentDueDate, PaymentRemaining,
                PeriodicPayment, PrincipalOutstanding, TotalValueOutstanding,
                ManagementFeeOutstanding, LoanScale
```
`SoeDefault` fields are **omitted from JSON when zero**. `vault_info` on a brand-new vault returns no `AssetsTotal`, `AssetsAvailable`, `LossUnrealized`, `VaultKind`. Treat missing as `0` / `OpenEnded`.

---

## 5. Check order and every error code, from the transactors

### 5.1 `VaultCreate` (`src/libxrpl/tx/transactors/vault/VaultCreate.cpp`)

`checkExtraFeatures` → `temDISABLED` if: `MPTokensV1` off; `DomainID` present and `PermissionedDomains` off; **any of `VaultKind` / `SubscriptionDate` / `RedemptionDate` present and `LendingProtocolV1_1` off**.

`preflight` (in order):
1. `Data` > 256 bytes → `temMALFORMED`
2. `WithdrawalPolicy != 1` → `temMALFORMED`
3. `DomainID == 0` → `temMALFORMED`; **`DomainID` present without `tfVaultPrivate` → `temMALFORMED`**
4. `AssetsMaximum < 0` → `temMALFORMED`
5. `MPTokenMetadata` empty or > 1024 bytes → `temMALFORMED`
6. `Scale` present and asset is MPT or XRP → `temMALFORMED`; `Scale > 18` → `temMALFORMED`
7. `VaultKind` present and not in {0,1} → `temMALFORMED`
8. not closed-ended but `SubscriptionDate` or `RedemptionDate` present → `temMALFORMED`
9. closed-ended and either date missing → `temMALFORMED`
10. `!(RedemptionDate >= SubscriptionDate + 180 && RedemptionDate < SubscriptionDate + 946708560)` → `temMALFORMED`

`preclaim`:
1. `canAddHolding(view, asset)` (IOU: issuer `DefaultRipple` → `terNO_RIPPLE`; MPT: `lsfMPTCanTransfer` → `tecNO_AUTH`, `lsfMPTLocked` → `tecLOCKED`)
2. asset issuer is a pseudo-account → **`tecWRONG_ASSET`**
3. asset frozen for the creator → `tecFROZEN` (IOU) / `tecLOCKED` (MPT)
4. `DomainID` does not resolve → `tecOBJECT_NOT_FOUND`
5. pseudo-account address collision → `terADDRESS_COLLISION`
6. `SubscriptionDate` or `RedemptionDate` already in the past → **`tecEXPIRED`**

`doApply`: `dirLink`; `OwnerCount += 2`; balance < reserve → `tecINSUFFICIENT_RESERVE`; create pseudo-account; `addEmptyHolding`; create share `MPTokenIssuance` with
`lsfMPTCanEscrow|lsfMPTCanTrade|lsfMPTCanTransfer` unless `tfVaultShareNonTransferable`, plus `lsfMPTRequireAuth` if `tfVaultPrivate`.

> **Footgun.** `checkVaultDomain` (`VaultHelpers.cpp:308-328`) returns `tecNO_AUTH` when the share issuance has **no** `DomainID`. So a vault created with `tfVaultPrivate` and **no** `DomainID` has *zero* authorised participants — only the owner can ever deposit. And `DomainID` without `tfVaultPrivate` is `temMALFORMED`. Private vault ⇒ you must set both.

### 5.2 `VaultDeposit`

`preflight`: `VaultID == 0` → `temMALFORMED`; `Amount <= 0` → `temBAD_AMOUNT`.

`preclaim`:
1. vault missing → `tecNO_ENTRY`
2. **V1.1 phase gate**: phase ∈ {Investment, Redemption} → **`tecEXPIRED`**
3. `Amount.asset != Vault.Asset` → `tecWRONG_ASSET`
4. `canTransfer` fails → its code
5. share issuance missing / locked → `tefINTERNAL`
6. freeze checks (`checkDepositFreeze` post-3.3.0) → `tecFROZEN` / `tecLOCKED`
7. private vault and depositor != owner → `checkVaultDomain(..., SuppressExpired::Yes)` → `tecNO_AUTH` / `tecEXPIRED`-tolerated
8. `requireAuth` on the asset
9. post-3.2.0: amount rounds to zero at vault scale → `tecPRECISION_LOSS`
10. balance < rounded amount → `tecINSUFFICIENT_FUNDS`
11. post-3.2.0 IOU: amount is zero at the depositor's trust-line scale → `tecPRECISION_LOSS`

`doApply`: mint shares (`assetsToSharesDeposit`, truncating), convert back (`sharesToAssetsDeposit`) so the depositor is debited only for what was minted, clamp to the `AssetsTotal` grid (3.4.0), then
`AssetsTotal += assetsDeposited; AssetsAvailable += assetsDeposited;` and only **after** that:
```cpp
auto const maximum = *vault->at(sfAssetsMaximum);
if (maximum != 0 && *vault->at(sfAssetsTotal) > maximum) return tecLIMIT_EXCEEDED;
```
Zero shares minted → `tecPRECISION_LOSS`. `Number` overflow → `tecPATH_DRY`.

### 5.3 `VaultWithdraw`

`preclaim`:
1. vault missing → `tecNO_ENTRY`
2. **V1.1 phase gate**: phase == Investment → **`tecTOO_SOON`** (Subscription and Redemption both allow withdrawals)
3. `Amount.asset` is neither the vault asset nor the share MPT → `tecWRONG_ASSET`
4. `canTransfer` (post-3.2.0 waives `lsfMPTCanTransfer` so an issuer cannot trap depositors)
5. `WithdrawalPolicy != 1` → `tefINTERNAL`
6. credentials valid → credential codes
7. post-3.4.0: destination is a pseudo-account → **`tecPSEUDO_ACCOUNT`**
8. `canWithdraw` (deposit-auth / destination-tag / credentials)
9. `requireAuth` on the destination (`StrongAuth` when `Destination != Account`)
10. post-3.4.0 private vault, third-party destination: `checkVaultDomain` on **both** submitter and destination, `SuppressExpired::No` → `tecNO_AUTH` / `tecEXPIRED`
11. freeze checks

`doApply` (the liquidity guardrail you want for the demo):
```cpp
if (*assetsAvailable < assetsWithdrawn) return tecINSUFFICIENT_FUNDS;   // "vault doesn't hold enough assets"
```
plus `tecINSUFFICIENT_FUNDS` if the account holds fewer shares, `tecPRECISION_LOSS` for sub-ULP / zero-share cases, `tecPATH_DRY` on `Number` overflow.
Final withdrawal (burning every outstanding share) is only allowed when `LossUnrealized == 0`.

### 5.4 `VaultSet` / `VaultDelete` / `VaultClawback`

`VaultSet`: nothing to update → `temMALFORMED`; not owner → `tecNO_PERMISSION`; `DomainID` on a non-private vault → `tecNO_PERMISSION`; domain missing → `tecOBJECT_NOT_FOUND`; new `AssetsMaximum != 0 && < AssetsTotal` → `tecLIMIT_EXCEEDED`.
`VaultDelete`: `MemoData` without `LendingProtocolV1_1` → `temDISABLED`; > 256 bytes → `temMALFORMED`; not owner → `tecNO_PERMISSION`; `AssetsAvailable != 0`, `AssetsTotal != 0`, or `OutstandingAmount != 0` → `tecHAS_OBLIGATIONS`.
`VaultClawback`: `Amount < 0` → `temBAD_AMOUNT`; XRP amount → `temMALFORMED`; **`Amount` absent or zero means "all"**.

### 5.5 `LoanBrokerSet`

`preflight`: `Data` > 256 → `temINVALID`; `ManagementFeeRate > 10'000` → `temINVALID`; `CoverRateMinimum`/`CoverRateLiquidation` > 100'000 → `temINVALID`; `DebtMaximum` outside `[0, kMaxMpTokenAmount]` → `temINVALID`; on update, any of `ManagementFeeRate` / `CoverRateMinimum` / `CoverRateLiquidation` present → `temINVALID` (they are immutable); `LoanBrokerID == 0` or `VaultID == 0` → `temINVALID`; **`CoverRateMinimum` and `CoverRateLiquidation` must both be zero or both non-zero** → `temINVALID`.

`preclaim`: vault missing → `tecNO_ENTRY`; account != `Vault.Owner` → `tecNO_PERMISSION`;
*update path*: broker missing → `tecNO_ENTRY`; changing `VaultID` → `tecNO_PERMISSION`; not broker owner → `tecNO_PERMISSION`; new `DebtMaximum != 0 && < DebtTotal` → `tecLIMIT_EXCEEDED`;
*create path*: **`LendingProtocolV1_1` && vault not closed-ended → `tecNO_PERMISSION`** (reverted on Track 1); `canAddHolding`; vault pseudo-account frozen → `tecFROZEN`/`tecLOCKED`;
then `DebtMaximum` not representable in the asset → `tecPRECISION_LOSS`.

`doApply` (create): `dirLink` into the owner's dir **and** the vault pseudo-account's dir (`sfVaultNode`); `OwnerCount += 2`; `tecINSUFFICIENT_RESERVE`; create broker pseudo-account; `addEmptyHolding`; `LoanSequence = 1`.

### 5.6 `LoanSet` — the one with the dual signature

`preflight`:
- `SponsorFlags` with reserve sponsorship → `temINVALID_FLAG` (**reserve sponsorship is not allowed on LoanSet**)
- inner batch txn (`tfInnerBatchTxn` + `BatchV1_1`) without `Counterparty` → `temBAD_SIGNER`
- not an inner batch txn and no `CounterpartySignature` → `temBAD_SIGNER`
- bad signing key inside `CounterpartySignature` → `temBAD_SIGNER`
- `Data` non-empty and > 256 → `temINVALID`
- `LoanServiceFee` / `LatePaymentFee` / `ClosePaymentFee` negative → `temINVALID`
- `PrincipalRequested <= 0` → `temINVALID`
- `LoanOriginationFee` negative or `> PrincipalRequested` → `temINVALID`
- each rate above its max → `temINVALID`
- `PaymentTotal <= 0` → `temINVALID`
- `PaymentInterval < 60` → `temINVALID`
- `GracePeriod < 60` or `> PaymentInterval` → `temINVALID`
- `LoanBrokerID == 0` → `temINVALID`

`checkSign`: the counter-signer is `Counterparty` if present, otherwise `LoanBroker.Owner`.
`calculateBaseFee`: `base + (signers in CounterpartySignature, min 1) * base` → **a plain single-signed LoanSet costs 2× base fee**. Observed live: `Fee: "24"` on the hackathon devnet where base is 12.

`preclaim`, in order:
1. schedule overflow guard (`StartDate + interval*total + grace` must fit in `uint32`) → **`tecKILLED`** (four separate messages)
2. broker missing → `tecNO_ENTRY`
3. neither `Account` nor `Counterparty` is `LoanBroker.Owner` → `tecNO_PERMISSION`
4. borrower `AccountRoot` missing → `terNO_ACCOUNT`
5. vault missing → `tefBAD_LEDGER`
6. **V1.1 phases**: Subscription → **`tecTOO_SOON`**; Redemption → **`tecEXPIRED`**; Investment → if
   `StartDate + PaymentInterval*PaymentTotal + 60 > Vault.RedemptionDate` → **`tecNO_PERMISSION`**
7. **accrual only** (skipped for cash-basis vaults): vault at `AssetsMaximum` → `tecLIMIT_EXCEEDED`
8. value fields not representable in the asset → `tecPRECISION_LOSS`
9. `canAddHolding`
10. vault pseudo frozen → `tecFROZEN`/`tecLOCKED`; broker pseudo deep-frozen; borrower frozen; broker owner deep-frozen

`doApply`:
1. `Vault.AssetsAvailable < PrincipalRequested` → **`tecINSUFFICIENT_FUNDS`** ("Insufficient assets available in the Vault to fund the loan") ← *the clean "insufficient liquidity" guardrail demo*
2. `computeLoanProperties` → `PeriodicPayment`, `TotalValueOutstanding`, `LoanScale`, `firstPaymentPrincipal`
3. `loanOriginationExceedsVaultMaximum` → `tecLIMIT_EXCEEDED` (accrual only)
4. value fields with more precision than `LoanScale` → `tecPRECISION_LOSS`
5. `checkLoanGuards` — four `tecPRECISION_LOSS` traps, see §6.2
6. `DebtMaximum != 0 && DebtMaximum < DebtTotal + delta` → `tecLIMIT_EXCEEDED`
7. `CoverAvailable < minimumBrokerCover(newDebtTotal, CoverRateMinimum, vault)` → **`tecINSUFFICIENT_FUNDS`** ("Insufficient first-loss capital to cover the loan") ← *the clean first-loss-cover guardrail demo*
8. borrower `OwnerCount += 1`, reserve → `tecINSUFFICIENT_RESERVE`
9. `addEmptyHolding` for borrower (and broker owner if origination fee > 0), `requireAuth(StrongAuth)`
10. `accountSendMulti` → principal − fee to borrower, fee to broker owner
11. create the `Loan`; `NextPaymentDueDate = StartDate + PaymentInterval`; `PaymentRemaining = PaymentTotal`
12. `AssetsAvailable -= PrincipalRequested; AssetsTotal += assetsTotalDelta` (0 under cash basis)
13. `DebtTotal += debtTotalDelta`; broker `OwnerCount += 1`; `LoanSequence += 1` (rollover → `tecMAX_SEQUENCE_REACHED`)

`StartDate` is `view.header().closeTime`, i.e. the **current ledger's** close time (not the parent's).

### 5.7 `LoanPay`

`preflight`: `LoanID == 0` → `temINVALID`; `Amount <= 0` → `temBAD_AMOUNT`; more than one of `tfLoanLatePayment`/`tfLoanFullPayment`/`tfLoanOverpayment` → `temINVALID_FLAG`.

`calculateBaseFee`: base fee scales with how many payments the amount could cover — one extra base fee per 5 payments, capped at `100/5 = 20` increments (post-`fixCleanup3_1_3`). Budget for it.

`preclaim`: loan missing → `tecNO_ENTRY`; `Loan.Borrower != Account` → **`tecNO_PERMISSION`** (only the borrower may pay); `tfLoanOverpayment` on a loan without `lsfLoanOverpayment` → `tecNO_PERMISSION`; `PaymentRemaining == 0 || PrincipalOutstanding == 0` → **`tecKILLED`**; `Amount.asset != Vault.Asset` → `tecWRONG_ASSET`; borrower frozen; vault pseudo deep-frozen; `requireAuth`; borrower balance < `Amount` → `tecINSUFFICIENT_FUNDS` (**no partial payments** — you must hold the full stated `Amount` even if the loan takes less).

`doApply` → `loanMakePayment` (`LendingHelpers.cpp:2253`):
```cpp
if (paymentType != LoanPaymentType::Late && isPaymentLate(view, loan))
    return std::unexpected(tecEXPIRED);   // "Use the tfLoanLatePayment transaction flag"
```
← *the clean "out-of-schedule payment" guardrail demo*: let `NextPaymentDueDate` pass, then submit a plain `LoanPay` → `tecEXPIRED`.
Under `fixCleanup3_4_0` (enabled on both networks) "late" is **strictly** `now > NextPaymentDueDate`; paying exactly at the due instant is still on time.
An impaired loan is auto-unimpaired before the payment is applied.

### 5.8 `LoanManage`

`preflight`: `LoanID == 0` → `temINVALID`; more than one flag → `temINVALID_FLAG`. No flags at all is a legal no-op.

`preclaim`: loan missing → `tecNO_ENTRY`; loan already defaulted → `tecNO_PERMISSION`; impair an already-impaired loan → `tecNO_PERMISSION`; unimpair a loan that is neither impaired nor defaulted → `tecNO_PERMISSION`; `PaymentRemaining == 0` → `tecNO_PERMISSION`; **`tfLoanDefault` before `NextPaymentDueDate + GracePeriod` has strictly passed → `tecTOO_SOON`**; caller is not `LoanBroker.Owner` → `tecNO_PERMISSION`.

`impairLoan` (post-3.4.0): **loan must already be late → `tecTOO_SOON`**; `LossUnrealized += loanVaultExposure`; if `LossUnrealized > AssetsTotal - AssetsAvailable` → `tecLIMIT_EXCEEDED`. `NextPaymentDueDate` is **not** moved (XLS-66.2).

`defaultLoan`:
```
totalDefaultAmount = loanVaultExposure(vault, loan)          // cash basis: PrincipalOutstanding
minimumCover       = ceil(DebtTotal * CoverRateMinimum)
defaultCovered     = min( ceil(minimumCover * CoverRateLiquidation), totalDefaultAmount, CoverAvailable )
AssetsTotal     -= floor(totalDefaultAmount - defaultCovered)
AssetsAvailable += defaultCovered
DebtTotal       -= totalDefaultAmount
CoverAvailable  -= defaultCovered
Loan: set lsfLoanDefault; TotalValueOutstanding = PrincipalOutstanding =
      ManagementFeeOutstanding = PaymentRemaining = NextPaymentDueDate = 0
then accountSend(brokerPseudo -> vaultPseudo, defaultCovered)
```
Note `defaultCovered` is `CoverRateLiquidation` applied to the *minimum required cover*, not to `CoverAvailable`.

### 5.9 `LoanBrokerCover*` and the deletes

`LoanBrokerCoverDeposit`: `LoanBrokerID == 0` → `temINVALID`; `Amount <= 0` or illegal → `temBAD_AMOUNT`; broker missing → `tecNO_ENTRY`; not broker owner → `tecNO_PERMISSION`; wrong asset → `tecWRONG_ASSET`; rounds to zero → `tecPRECISION_LOSS`; insufficient funds → `tecINSUFFICIENT_FUNDS`.
`LoanBrokerCoverWithdraw`: adds `tecPSEUDO_ACCOUNT` for a pseudo destination, and **two** `tecINSUFFICIENT_FUNDS` cases: `CoverAvailable < Amount`, and `CoverAvailable - Amount < minimumCover`.
`LoanBrokerCoverClawback`: both fields optional but **at least one** required → `temINVALID`; native (XRP) `Amount` → `temBAD_AMOUNT` ("XRP has no counterparty"); `Amount == 0` means "take it all down to the minimum cover"; without `LoanBrokerID` the `Amount.issuer` must be the broker pseudo-account and must not be the submitter.
`LoanBrokerDelete`: `OwnerCount != 0` or `DebtTotal != 0` → `tecHAS_OBLIGATIONS`.
`LoanDelete`: `PaymentRemaining > 0` → `tecHAS_OBLIGATIONS`; caller must be broker owner **or** borrower → `tecNO_PERMISSION`.

---

## 6. Rounding and share maths (`VaultHelpers.cpp`, `LendingHelpers.cpp`)

### 6.1 Vault share conversions

```cpp
// deposit: assets -> shares, TRUNCATED (shares are MPT integers)
assetsToSharesDeposit:  assetsTotal == 0 ? trunc(assets * 10^Scale)
                                         : trunc(sharesTotal * assets / assetsTotal)
// deposit: shares -> assets, exact
sharesToAssetsDeposit:  assetsTotal == 0 ? shares * 10^-Scale
                                         : assetsTotal * shares / sharesTotal
// withdraw: uses assetsTotalForWithdrawal = AssetsTotal - LossUnrealized  (unless waived)
assetsToSharesWithdraw: rounds to NEAREST by default, TRUNCATES when TruncateShares::Yes
sharesToAssetsWithdraw: assetsTotal * shares / sharesTotal
```
`WaiveUnrealizedLoss::Yes` is applied only when the redeemer is the **sole** shareholder (`isSoleShareholder`), so the last holder out is not penalised for a loss they alone own.

`clampToAssetsTotalScale` (post-`fixCleanup3_4_0`): debits round the magnitude **down** at the posterior scale; credits floor the posterior total and take the difference. A delta smaller than 1 ULP → `tecPRECISION_LOSS`. Integral assets (XRP, MPT) are a no-op.

Deposit does a deliberate round trip — assets → truncated shares → assets — and debits the depositor only for what the minted shares are worth; if the round trip ever returned *more* than the requested amount it aborts with `tecINTERNAL`.

### 6.2 Loan maths

`loanPeriodicRate = interestRate_tenthBips * paymentInterval / (365*24*3600)` — note **365-day year**, `kSecondsInYear = 31'536'000`.
`LoanScale = max(vaultAssetsTotalScale, exponent(periodicPayment * paymentTotal))`; all loan values are rounded to it.
`PeriodicPayment` is stored **unrounded** (observed live: `"25013700.13119221382"` on an XRP loan) and must be rounded **up** when paying.

`checkLoanGuards` — four ways `LoanSet` dies with `tecPRECISION_LOSS`:
1. interest rate > 0 but computed total interest <= 0
2. `firstPaymentPrincipal <= 0` — the first period's principal portion rounds away, so the loan could never amortise
3. `roundPeriodicPayment(...) == 0`
4. `ceil(TotalValueOutstanding / roundedPeriodicPayment) != PaymentTotal` — the rounded payment cannot settle the loan in exactly the requested number of payments

Guard 4 is the one that bites on small XRP loans with many payments. If `LoanSet` returns `tecPRECISION_LOSS`, raise the principal or reduce `PaymentTotal`.

---

## 7. Concrete developer-experience findings (the 40%)

### 7.1 `xrpl.js` autofill overcharges `VaultCreate` by ~200,000×  ← strongest single finding

`packages/xrpl/src/sugar/autofill.ts:378-382`:
```ts
const isSpecialTxCost = [
  'AccountDelete',
  'AMMCreate',
  'VaultCreate',
].includes(tx.TransactionType)
...
} else if (isSpecialTxCost) {
  baseFee = await fetchOwnerReserveFee(client)   // = server_state.validated_ledger.reserve_inc
}
```
and lines 451-453 deliberately **bypass the `maxFeeXRP` cap** for these types, so the usual safety net does not fire.

But in rippled, `VaultCreate` does **not** override `calculateBaseFee`. `Transactor::calculateOwnerReserveFee` is referenced by exactly three transactors — `AccountDelete.cpp:63`, `AMMCreate.cpp:91`, `LedgerStateFix.cpp:90` — and `VaultCreate` is not one of them. `VaultCreate.h` declares no `calculateBaseFee`.

Effect on both devnets (`reserve_inc = 2000000` drops): every `VaultCreate` sent through `client.autofill` / `submitAndWait` burns **2 XRP** instead of 10 drops. Every `VaultCreate` I found on the hackathon devnet (8 of them in ~90 ledgers) has `"Fee": "2000000"`.

Proof it is unnecessary — same transaction with an explicit fee, on both networks:
- public devnet `5E444410F77925AE49215B0BCF954BDD805AAC5402FA329B926F0649FB775B0C`, `Fee: "10"`, `tesSUCCESS`
- hackathon devnet `54E917A9D50234BE4D5F74025983184F7ADD261897F5BA2E955852A659B00113`, `Fee: "10"`, `tesSUCCESS`
- `LoanBrokerSet` also creates a pseudo-account and is charged the ordinary base fee (`Fee: "12"`, `tesSUCCESS`)

**Fix:** drop `'VaultCreate'` from `isSpecialTxCost` in `packages/xrpl/src/sugar/autofill.ts`. (Or, if the intent was to charge an owner-reserve fee, add the `calculateBaseFee` override in `VaultCreate.cpp` — but then `LoanBrokerSet` needs the same treatment, and neither is in the spec.)

### 7.2 `xrpl.js` 5.2.0 stable dropped the closed-ended vault typings that 5.2.0-beta.0 has

| package | `VaultKind` / `SubscriptionDate` / `RedemptionDate` on `VaultCreate` |
|---|---|
| `xrpl@4.6.0` | no |
| `xrpl@5.2.0-beta.0` (2026-09-10) | **yes**, plus `enum VaultKind { vaultKindOpen = 0, vaultKindClosed = 1 }` |
| `xrpl@5.2.0` (2026-09-11, `latest`) | **no** — the fields and the enum are gone again |

`ripple-binary-codec@2.11.0` (what 5.2.0 depends on) *does* know all four fields including `LEVersion`, so this is a **TypeScript-surface regression only**: `validate()` tolerates the extra fields and `encode`/`decode` round-trip them correctly (verified). A JS user is fine; a TS user gets a compile error on the one feature the whole of Track 2 is about, on the version `npm i xrpl` installs today.

**Fix:** restore the three optional fields and the `VaultKind` enum in `packages/xrpl/src/models/transactions/vaultCreate.ts` on the 5.2.x line, and add a regression test that a closed-ended `VaultCreate` type-checks.

### 7.3 The hackathon faucet response shape breaks `client.fundWallet()`

```
$ curl -s -X POST https://lending-hackathon-faucet.dev.ripplex.io/accounts -d '{}'
{"account":{"address":"rPHS…","secret":"sEdT…"},"balance":1000}

$ curl -s -X POST https://faucet.devnet.rippletest.net/accounts -d '{}'
{"account":{"xAddress":"…","address":"rE1H…","classicAddress":"rE1H…"},"amount":100,"transactionHash":"…","seed":"sEdT…"}
```
`xrpl.js` reads `body.account.classicAddress` (`Wallet/fundWallet.ts`, `requestFunding` → `processSuccessfulResponse`). The hackathon faucet omits `classicAddress` and nests the key as `account.secret` instead of top-level `seed`, so `await client.fundWallet(null, {faucetHost, faucetPath})` fails with:
```
XRPLFaucetError: The faucet account is undefined
```
which says nothing about the real cause. Every Track 1 team hits this in their first five minutes.

**Fix (one line, server side):** add `classicAddress` (and ideally `seed` + `amount`) to the hackathon faucet response so it matches the devnet faucet contract. **Fix (client side):** in `processSuccessfulResponse`, fall back to `body.account.address` and throw `Faucet response missing account.classicAddress; got keys [...]` instead of "undefined".
**Workaround for us:** `POST` the faucet directly and `xrpl.Wallet.fromSeed(res.account.secret)`.

### 7.4 The entire V1.1 feature set is unspecified

`XRPLF/XRPL-Standards` contains `XLS-0065-single-asset-vault/README.md`, `XLS-0066-lending-protocol/README.md`, plus two sub-drafts: `65.1` (VaultDelete `MemoData`) and `66.2` (impairment timing). Grepping all four documents:

| term | XLS-65 | XLS-66 |
|---|---|---|
| `SubscriptionDate` | 0 | 0 |
| `RedemptionDate` | 0 | 0 |
| `VaultKind` | 0 | 0 |
| `ClosedEnded` / "closed-ended" | 0 | 0 |
| `LEVersion` | 0 | 0 |
| `CashBasis` / "cash-basis" | 0 | 0 |

There is **no published specification** for closed-ended vaults, the Subscription/Investment/Redemption phase machine, `kMinInvestmentPeriod`, `kLoanRedemptionBuffer`, or cash-basis accounting — i.e. for everything `LendingProtocolV1_1` adds, which is live on both devnets and is the entire premise of Track 2. There is no gap in the numbering either (65.1 and 66.2 exist; 66.1 and a 65.x for closed-ended vaults do not appear).

**Fix:** publish `XLS-65.2 Closed-Ended Vaults` and `XLS-66.1 Cash-Basis Accounting` alongside 65.1/66.2, covering: the `VaultKind`/`SubscriptionDate`/`RedemptionDate` fields and their `temMALFORMED`/`tecEXPIRED` conditions; the phase table with the exact result code per blocked transaction (`VaultDeposit` → `tecEXPIRED`, `VaultWithdraw` → `tecTOO_SOON`, `LoanSet` → `tecTOO_SOON`/`tecEXPIRED`/`tecNO_PERMISSION`); the `kMinInvestmentPeriod = 180 s` / `kMaxInvestmentPeriod = 30 y` / `kLoanRedemptionBuffer = 60 s` bounds; and the accrual-vs-cash delta table from §2.2. I can supply the delta table and the phase/result-code matrix as a PR — both are transcribed directly from the transactors here.

### 7.5 XLS-66 §3.8 describes accounting that no live network performs

XLS-66 §3.8.6 "State Changes" step 6:
> Increase `Vault.AssetsTotal` by `InterestDue` (interest owed to the Vault, excluding management fee).

§3.8.5.2 checks 6, 14, 19, 20 are all written in terms of `InterestDue`:
> 19. `LoanBroker.DebtMaximum != 0` and `LoanBroker.DebtMaximum < LoanBroker.DebtTotal + PrincipalRequested + InterestDue`

None of that happens on either devnet. Under cash basis (`LEVersion = 1`, every vault you can create): `AssetsTotal` is unchanged at origination, `DebtTotal` increases by `PrincipalRequested` alone, and checks 6 and 14 are skipped outright (`loanOriginationExceedsVaultMaximum` returns `false` immediately for cash-basis vaults, `LoanSet.cpp` preclaim guards check 6 with `getVaultVersion(vault) != VaultVersion::CashBasis`).

**Fix:** mark §3.8.6 step 6 and §3.8.5.2 checks 6/14/19/20 as accrual-basis-only and add the cash-basis column, pointing at the amendment that switches them.

### 7.6 xrpl.org `VaultCreate` page: three concrete errors

https://xrpl.org/docs/references/protocol/transactions/types/vaultcreate
(source: `XRPLF/xrpl-dev-portal`, `docs/references/protocol/transactions/types/vaultcreate.md`)

1. **"Transaction Cost"** says
   > Instead of the standard minimum of 0.00001 XRP, VaultCreate must destroy an incremental owner reserve, currently 0.2 XRP.

   Not true in the code (§7.1) and disproved live at `Fee: "10"` drops on both devnets. The page's own example JSON contradicts it with `"Fee": "5000000"` (5 XRP). **Fix:** delete the section, or replace with "standard base fee; the owner reserve for the Vault plus its pseudo-account is checked, not burned — `tecINSUFFICIENT_RESERVE` if the owner cannot cover two additional owner reserves."
2. **`DomainID` row** says
   > If provided, the transaction creates a private vault

   It does not. `VaultCreate.cpp:80-83` rejects `DomainID` without `tfVaultPrivate` with `temMALFORMED`. **Fix:** "Requires the `tfVaultPrivate` flag; `DomainID` without it is `temMALFORMED`. A vault with `tfVaultPrivate` and **no** `DomainID` has no authorised participants at all — every non-owner deposit fails with `tecNO_AUTH`."
3. **Field table is missing `VaultKind`, `SubscriptionDate`, `RedemptionDate`**, and the error table is missing `tecWRONG_ASSET` (pseudo-account issuer), `terADDRESS_COLLISION`, and `tecEXPIRED` (a date already in the past). **Fix:** add all six, gated on `LendingProtocolV1_1`.

### 7.7 The official lending code samples pin `xrpl ^4.6.0`

`XRPLF/xrpl-dev-portal`, `_code-samples/lending-protocol/js/package.json`:
```json
{ "dependencies": { "xrpl": "^4.6.0" } }
```
4.6.0 shipped 2026-02-12 and has no `VaultKind`/`SubscriptionDate`/`RedemptionDate`, so the samples cannot demonstrate the V1.1 behaviour that is live on the Devnet they connect to (`wss://s.devnet.rippletest.net:51233`). **Fix:** bump to the version that carries the closed-ended vault models (today: `5.2.0-beta.0`/`-beta.1`; ideally 5.2.1 once §7.2 is fixed) and add a `createClosedEndedVault.js` sample.

### 7.8 Broken spec link inside rippled

`src/libxrpl/tx/invariants/LoanInvariant.cpp:97`:
```cpp
// https://github.com/Tapanito/XRPL-Standards/blob/xls-66-lending-protocol/XLS-0066d-lending-protocol/README.md#3223-invariants
```
That URL returns **404** (verified). It is a personal fork branch that has moved. **Fix:** point at `https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0066-lending-protocol/README.md#327-invariants`.

### 7.9 The Devnet that Track 2 must target runs code nobody can read

Public Devnet reports `3.4.0-rc5`. `XRPLF/rippled` has no `3.4.0-rc5` tag, no `release/3.4.x` branch, and `develop` is still at `3.4.0-rc1`. Its `server_definitions` also lacks the `Bytecode`/`Gas`/`VMReturnCode` fields that `develop` and the hackathon branch have (from #8157, merged 2026-09-09), so it is a release-branch build cut around rc1 with fixes on top — but nobody outside Ripple can confirm which. For a contest judged 40% on developer feedback, participants cannot diff the binary they are told to build against.
**Fix:** push the `3.4.0-rc2..rc5` tags (or the release branch) to `XRPLF/rippled`, and put the exact commit SHA in the hackathon README next to each endpoint.

### 7.10 Smaller papercuts

- **`temINVALID` vs `temMALFORMED` is split by subsystem, not by meaning.** Every vault transactor returns `temMALFORMED`; every lending transactor returns `temINVALID` for the identical class of error (zero ID, oversized `Data`). `VaultDelete` even mixes both in one preflight. Fix: document the convention, or unify.
- **`tecKILLED` for a schedule-overflow `LoanSet` and for paying off an already-closed loan.** `tecKILLED` reads as "the transaction did something and was stopped"; these are plain validation failures. `temINVALID` / `tecNO_PERMISSION` would be clearer. It is also charged a fee.
- **`SoeDefault` fields vanish from JSON.** `vault_info` on a fresh vault returns no `AssetsTotal`, `AssetsAvailable`, `LossUnrealized`, `VaultKind`. Nothing in the docs says these are absent-when-zero. Fix: say so on the `Vault` ledger-entry page, or have `vault_info` always emit them.
- **`LoanSet` costs 2× base fee minimum** because of `CounterpartySignature`. Correct per spec §3.8.1.1 but easy to miss; `autofill` does handle it (it queries the counterparty's signer list).
- **Reserve sponsorship is silently forbidden on `LoanSet`** (`temINVALID_FLAG`) — relevant if we go "Loaded" with XLS-68. Fee sponsorship is still allowed.

---

## 8. Things to use in the build

**Guardrail demos, ranked by how cleanly they fail:**
1. *Insufficient liquidity*: `LoanSet` with `PrincipalRequested > Vault.AssetsAvailable` → `tecINSUFFICIENT_FUNDS`.
2. *Out-of-schedule payment*: wait past `NextPaymentDueDate`, submit `LoanPay` without `tfLoanLatePayment` → `tecEXPIRED` with an explicit log line naming the flag.
3. *First-loss cover*: set `CoverRateMinimum` non-zero, under-fund `LoanBrokerCoverDeposit`, then `LoanSet` → `tecINSUFFICIENT_FUNDS` ("Insufficient first-loss capital"). Or `LoanBrokerCoverWithdraw` below the minimum → `tecINSUFFICIENT_FUNDS`.
4. *Track 2 phase gates*: `VaultDeposit` in Investment → `tecEXPIRED`; `VaultWithdraw` in Investment → `tecTOO_SOON`; `LoanSet` in Redemption → `tecEXPIRED`; `LoanSet` in Investment whose final payment is within 60s of `RedemptionDate` → `tecNO_PERMISSION`.
5. *Bonus, uniquely V1.1*: `LoanManage` with `tfLoanImpair` on a loan that is not yet late → `tecTOO_SOON` (the `fixCleanup3_4_0` / XLS-66.2 rule). Nobody else will demo this.

**Counterparty signing, the exact flow** (`xrpl.js`, `Wallet/counterpartySigner.ts`):
```js
import { Wallet, signLoanSetByCounterparty } from 'xrpl'
const prepared = await client.autofill(loanSetTx)        // Counterparty set to the other party
const first    = borrowerWallet.sign(prepared)           // party A signs normally
const both     = signLoanSetByCounterparty(brokerWallet, first.tx_blob)  // party B counter-signs
await client.submitAndWait(both.tx_blob)
```
Constraints read from the source: must be a `LoanSet`; must not already carry a `CounterpartySignature`; the first party must have signed first (`TxnSignature` + `SigningPubKey` present) or it throws `Transaction must be first signed by first party.`. For multisig, pass `{multisign: true|address}` and combine with `combineLoanSetCounterpartySigners`.
The counterparty signature uses its **own hash prefixes** — `CounterpartyTxSign = 'CPT\0'` (0x43505400) and `CounterpartyTxMultiSign = 'CPM\0'` (0x43504D00), added by rippled PR #8162 and gated on `fixCleanup3_4_0`, which is enabled on both networks. `ripple-binary-codec` ≥ 2.11.0 implements them unconditionally (`encodeForSigningCounterparty`), so a network without `fixCleanup3_4_0` would reject SDK-produced signatures. Not a problem here — both networks have it — but do not point this code at a third network without checking.

**Reading state:** `vault_info {vault_id}` returns the vault plus its share `MPTokenIssuance` (including `OutstandingAmount`, which is where `SharesTotal` lives — the Vault entry deliberately has no `SharesTotal`). `ledger_entry {loan_broker: <id>}` and `ledger_entry {loan: …}` work. Loans appear in the borrower's `account_objects` **and** in the broker pseudo-account's owner directory.
`PPS = AssetsTotal / MPTokenIssuance.OutstandingAmount`, with `AssetsTotal` defaulting to 0 when absent.

---

## 9. Open questions

- Which commit is `3.4.0-rc5`? Not public. Everything I state about Track 2 comes from `develop` @ `9403736` plus the empirical probe; a fix merged after rc1 into a release branch but not into `develop` would be invisible to me.
- Is there a `LendingProtocolV1_2` behaviour change we should care about? The amendment is registered (`Supported::No`) and disabled on both networks; I found no transactor keyed on it. Not usable.
- `tapanito/vault-donation` exists (last commit 2026-09-09, "test: Match donate invariant expected codes to the split vault suite") but is unmerged and unreachable from either deployed build. If the organisers claim `tfVaultDonation` works, ask them which build.
- I did not run the closed-ended path end to end on the public devnet (create closed-ended vault → deposit → wait out Subscription → `LoanSet` → `LoanPay` → wait out Investment → `VaultWithdraw`). The `LoanBrokerSet` probe is proof of the gate; the timing floor (§3.1) is read from the source, not from a live run.
