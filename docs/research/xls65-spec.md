# XLS-65 Single Asset Vault — implementation reference

Research slug: `xls65-spec`. Compiled 2026-09-12 for team **patapim**, XRPL Lending Protocol Hackathon.

Everything below is sourced. Where the spec markdown, xrpl.org and the rippled source disagree,
**the source and the live ledger win** and the disagreement is logged in `## Friction`.

---

## 0. Canonical sources and status

| What | Where | Notes |
| --- | --- | --- |
| Spec markdown (authoritative) | <https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0065-single-asset-vault/README.md> (raw: <https://raw.githubusercontent.com/XRPLF/XRPL-Standards/master/XLS-0065-single-asset-vault/README.md>) | `xls: 65`, `title: Single Asset Tokenized Vault`, `status: Draft`, `category: Amendment`, `created: 2024-04-12`, `updated: 2026-09-08`, `requires: XLS-33` |
| Patch spec | <https://github.com/XRPLF/XRPL-Standards/blob/master/XLS-0065-single-asset-vault/65.1/README.md> | `xls: 65.1`, `title: Vault Deletion Memo`, `status: Draft`, `created: 2026-09-04`, `updated: 2026-09-09` |
| Rendered site | <https://xls.xrpl.org/xls/XLS-0065-single-asset-vault.html> | **`https://xls.xrpl.org/xls/XLS-0065` is a 404** |
| rippled transactors | <https://github.com/XRPLF/rippled/tree/develop/src/libxrpl/tx/transactors/vault> | `VaultCreate.cpp`, `VaultSet.cpp`, `VaultDelete.cpp`, `VaultDeposit.cpp`, `VaultWithdraw.cpp`, `VaultClawback.cpp` |
| Share/asset maths | <https://github.com/XRPLF/rippled/blob/develop/src/libxrpl/ledger/helpers/VaultHelpers.cpp> + [`VaultHelpers.h`](https://github.com/XRPLF/rippled/blob/develop/include/xrpl/ledger/helpers/VaultHelpers.h) | |
| Constants | <https://github.com/XRPLF/rippled/blob/develop/include/xrpl/protocol/Protocol.h> | lines ~289-375 |
| Flags | <https://github.com/XRPLF/rippled/blob/develop/include/xrpl/protocol/TxFlags.h> lines 196-198 | |
| `vault_info` handler | <https://github.com/XRPLF/rippled/blob/develop/src/xrpld/rpc/handlers/VaultInfo.cpp> | |
| xrpl.org concept/tx docs | <https://xrpl.org/docs/references/protocol/transactions/types/vaultcreate>, <https://xrpl.org/docs/references/protocol/ledger-data/ledger-entry-types/vault> | stale vs source; see Friction |

### Amendments

- `SingleAssetVault` (`featureSingleAssetVault`) — the base amendment: `Vault` ledger entry + the six vault transactions.
- `LendingProtocolV1_1` (`featureLendingProtocolV1_1`) — adds `MemoData` on `VaultDelete`, **and also** `VaultKind` /
  `SubscriptionDate` / `RedemptionDate` on `VaultCreate`, `LEVersion` on the ledger entry, and the closed-ended phase gates.
  Only the `MemoData` part is written up in XLS-65.1.
- `fixCleanup3_1_3`, `fixCleanup3_2_0`, `fixCleanup3_3_0`, `fixCleanup3_4_0` materially change vault rounding,
  sole-shareholder handling, freeze handling and private-vault withdrawal rules. **All four are enabled on both hackathon networks.**

### Live network state (verified 2026-09-12 by `server_info` / `feature`)

| | Track 1 `https://lending-hackathon.dev.ripplex.io:51234` | Track 2 `https://s.devnet.rippletest.net:51234/` |
| --- | --- | --- |
| build_version | `3.4.0-rc1` | `3.4.0-rc5` |
| network_id | 4001 | 2 |
| `SingleAssetVault` | enabled | enabled |
| `LendingProtocol` | enabled | enabled |
| **`LendingProtocolV1_1`** | **enabled** | **enabled** |
| `fixCleanup3_1_3/3_2_0/3_3_0/3_4_0` | all enabled | all enabled |
| `fixCleanup3_5_0` | supported, **not** enabled | not present |
| `PermissionedDomains`, `Credentials`, `MPTokensV1`, `DynamicMPT`, `TokenEscrow`, `Sponsor` | enabled | enabled |
| `server_definitions` hash | `04E3D63E410F9060E305B1361B4941C9B369CE3B696F1B7C128AC51ECE1D6253` | `1EA05B0FC11101F7C500BD0DAC794A8BC746A7FBA6250B75489603EB820E0FF5` |

> **Track-selection consequence.** `LendingProtocolV1_1` is enabled on *both* networks, so the V1/V1.1 split in the
> event brief is **not** enforced by amendments. Closed-ended vaults, cash-basis `LEVersion=1` and the `tecEXPIRED`
> / `tecTOO_SOON` phase gates are live on the Track 1 custom devnet too. Every vault created on either network today
> gets `LEVersion: 1` (cash-basis).

---

## 1. Transaction type numbers and ledger entry type

Verified from `server_definitions` on both networks (identical).

| Transaction | `TRANSACTION_TYPES` value |
| --- | --- |
| `VaultCreate` | 65 (`ttVAULT_CREATE`) |
| `VaultSet` | 66 (`ttVAULT_SET`) |
| `VaultDelete` | 67 (`ttVAULT_DELETE`) |
| `VaultDeposit` | 68 (`ttVAULT_DEPOSIT`) |
| `VaultWithdraw` | 69 (`ttVAULT_WITHDRAW`) |
| `VaultClawback` | 70 (`ttVAULT_CLAWBACK`) |

`LEDGER_ENTRY_TYPES.Vault = 132` = `0x0084`. Object space key for the keylet is `0x0056` (ASCII `V`).

**VaultID derivation** (spec §3.1.1): `SHA512Half( 0x0056 || AccountID(owner) || Sequence )`, where `Sequence` is the
transaction `Sequence`, or `TicketSequence` if a ticket was used. You do **not** need to compute it: read it from
`meta.AffectedNodes[].CreatedNode.LedgerIndex` where `LedgerEntryType == "Vault"`, or ask
`vault_info` with `owner` + `seq`.

---

## 2. SField types (from `server_definitions`, both networks)

| Field | Internal type | nth |
| --- | --- | --- |
| `VaultID` | `Hash256` | 35 |
| `DomainID` | `Hash256` | 34 |
| `ShareMPTID` | **`Hash192`** (spec says `UINT192`) | 2 |
| `Asset` | `Issue` | 3 |
| `Amount` | `Amount` (STAmount) | 1 |
| `AssetsAvailable` | `Number` | 2 |
| `AssetsMaximum` | `Number` | 3 |
| `AssetsTotal` | `Number` | 4 |
| `LossUnrealized` | `Number` | 5 |
| `Scale` | `UInt8` | 4 |
| `WithdrawalPolicy` | `UInt8` | 20 |
| `VaultKind` | `UInt8` | 22 |
| `LEVersion` | `UInt8` | 6 |
| `SubscriptionDate` | `UInt32` | 75 |
| `RedemptionDate` | `UInt32` | 76 |
| `Data` | `Blob` (VL) | 27 |
| `MPTokenMetadata` | `Blob` (VL) | 30 |
| `MemoData` | `Blob` (VL) | 13 |
| `Holder` | `AccountID` | 11 |
| `Destination` | `AccountID` | 3 |
| `DestinationTag` | `UInt32` | 14 |
| `CredentialIDs` | `Vector256` | 5 |

`Number`-typed fields are rendered in JSON as **strings** (`"AssetsTotal": "10000000"`), not JSON numbers,
despite the spec's "JSON Type: number".

---

## 3. Live transaction formats (`server_definitions.TRANSACTION_FORMATS`, both networks identical)

```
VaultCreate    Asset(REQ), AssetsMaximum(OPT), MPTokenMetadata(OPT), DomainID(OPT),
               WithdrawalPolicy(OPT), Data(OPT), Scale(OPT),
               VaultKind(OPT), SubscriptionDate(OPT), RedemptionDate(OPT)
VaultSet       VaultID(REQ), AssetsMaximum(OPT), DomainID(OPT), Data(OPT)
VaultDelete    VaultID(REQ), MemoData(OPT)
VaultDeposit   VaultID(REQ), Amount(REQ)
VaultWithdraw  VaultID(REQ), Amount(REQ), Destination(OPT), DestinationTag(OPT), CredentialIDs(OPT)
VaultClawback  VaultID(REQ), Holder(REQ), Amount(OPT)

LedgerEntry Vault
   PreviousTxnID(REQ), PreviousTxnLgrSeq(REQ), Sequence(REQ), OwnerNode(REQ), Owner(REQ),
   Account(REQ), Data(OPT), Asset(REQ), AssetsTotal(DEF), AssetsAvailable(DEF),
   AssetsMaximum(DEF), LossUnrealized(DEF), ShareMPTID(REQ), WithdrawalPolicy(REQ),
   Scale(DEF), LEVersion(DEF), VaultKind(DEF), SubscriptionDate(OPT), RedemptionDate(OPT)
```

`DEF` = "default": the field has a default value and **is omitted from JSON when it equals that default**.
This is why `AssetsTotal`, `AssetsAvailable`, `LossUnrealized` and `Scale` are *absent* from a freshly
created vault (verified live — see §11).

---

## 4. Flags

`TRANSACTION_FLAGS.VaultCreate` (live): `{"tfVaultPrivate":65536,"tfVaultShareNonTransferable":131072}`
`LEDGER_ENTRY_FLAGS.Vault` (live): `{"lsfVaultPrivate":65536}`

| Flag | Hex | Decimal | Where |
| --- | --- | --- | --- |
| `tfVaultPrivate` | `0x00010000` | 65536 | `VaultCreate` only. Copied to the ledger entry as `lsfVaultPrivate`. |
| `tfVaultShareNonTransferable` | `0x00020000` | 131072 | `VaultCreate` only. **Not** stored on the `Vault` entry; it is encoded by *omitting* `lsfMPTCanTransfer` from the share `MPTokenIssuance`. |
| `lsfVaultPrivate` | `0x00010000` | 65536 | `Vault` ledger entry |

Source: `include/xrpl/protocol/TxFlags.h` lines 196-198:
```
TRANSACTION(VaultCreate,
    TF_FLAG(tfVaultPrivate, lsfVaultPrivate)
    TF_FLAG(tfVaultShareNonTransferable, 0x00020000),
```
`VaultCreate::doApply` writes `vault->at(sfFlags) = tx.getFlags() & tfVaultPrivate;` — only the privacy bit survives.

`VaultDeposit`, `VaultWithdraw`, `VaultSet`, `VaultDelete` and `VaultClawback` have **no transaction-specific flags**
in `server_definitions` on either network. In particular **there is no `tfVaultDonation` flag** — see Open questions.

---

## 5. Vault ledger entry — real field list

Spec §3.1.2 plus the three fields the spec omits.

| Field | Type | Present? | Default | Meaning |
| --- | --- | --- | --- | --- |
| `LedgerEntryType` | UInt16 | always | `0x0084` / `"Vault"` | |
| `index` / `LedgerIndex` | Hash256 | always | | object id (spec table wrongly types this `UINT16`) |
| `Flags` | UInt32 | always | 0 | only `lsfVaultPrivate` |
| `PreviousTxnID` / `PreviousTxnLgrSeq` | Hash256 / UInt32 | always | | |
| `Sequence` | UInt32 | always | | the creating tx `Sequence` (or `TicketSequence`) |
| `OwnerNode` | UInt64 | always | | |
| `Owner` | AccountID | always | | the vault owner (a real account) |
| `Account` | AccountID | always | | the **pseudo-account** that holds assets and issues shares |
| `Data` | Blob | optional | absent | ≤ 256 bytes, hex. Mutable via `VaultSet`. |
| `Asset` | Issue | always | | `{"currency":"XRP"}` \| `{"currency":..,"issuer":..}` \| `{"mpt_issuance_id":..}` |
| `AssetsTotal` | Number | **omitted when 0** | 0 | assets available + assets out on loan |
| `AssetsAvailable` | Number | **omitted when 0** | 0 | assets on hand, withdrawable |
| `LossUnrealized` | Number | **omitted when 0** | 0 | "paper loss"; only a connected protocol moves it |
| `AssetsMaximum` | Number | omitted when 0 | 0 | 0 = uncapped. Mutable via `VaultSet`. |
| `ShareMPTID` | Hash192 | always | | the share `MPTokenIssuance` id |
| `WithdrawalPolicy` | UInt8 | always | 1 | only value = 1 |
| `Scale` | UInt8 | **omitted when 0** | 6 for IOU, forced 0 for XRP/MPT | |
| `LEVersion` | UInt8 | **omitted when 0** | 1 on anything created today | `0 = Legacy` (accrual), `1 = CashBasis`. **Undocumented in XLS-65.** |
| `VaultKind` | UInt8 | **omitted when 0** | 0 | `0 = OpenEnded`, `1 = ClosedEnded`. **Undocumented in XLS-65.** |
| `SubscriptionDate` | UInt32 | closed-ended only | | Ripple-epoch seconds, immutable. **Undocumented in XLS-65.** |
| `RedemptionDate` | UInt32 | closed-ended only | | Ripple-epoch seconds, immutable. **Undocumented in XLS-65.** |

> **There is no `SharesTotal` field on the Vault entry.** The spec's formulas use `Γ_shares` / "SharesTotal" and the
> event brief's `PPS = AssetsTotal / SharesTotal`; the number actually lives in
> `MPTokenIssuance(Vault.ShareMPTID).OutstandingAmount`. `VaultHelpers.cpp` reads
> `issuance->at(sfOutstandingAmount)` everywhere. `vault_info` returns it at `vault.shares.OutstandingAmount`
> (a decimal **string**).

### Reserve / fee cost of a vault

- `VaultCreate` increments the owner's `OwnerCount` **by 2** (the `Vault` entry + the share `MPTokenIssuance`),
  then checks `preFeeBalance_ < accountReserve(...)` → `tecINSUFFICIENT_RESERVE`.
- It **also destroys one incremental owner reserve as fee** (XLS-64 pseudo-account rule). On devnet the
  autofilled `Fee` for `VaultCreate` was **`200000` drops (0.2 XRP)** — verified live. xrpl.js 5.2.0-beta.0's
  `autofill` computes this correctly; do not hand-set `Fee: "10"`.
- The depositor also pays a reserve for their share `MPToken` (created on first deposit).
- `VaultDelete` decrements `OwnerCount` by 2 and deletes the pseudo-account.

### Pseudo-account and share MPT

`VaultCreate` creates an `AccountRoot` with `VaultID` set (XLS-64). It is the asset custodian and the share issuer.
It cannot send transactions and refuses incoming funds (`VaultWithdraw` to a pseudo-account → `tecPSEUDO_ACCOUNT`
post-`fixCleanup3_4_0`).

Share `MPTokenIssuance` flags, from `VaultCreate::doApply`:
```cpp
std::uint32_t mptFlags = 0;
if (!tx.isFlag(tfVaultShareNonTransferable))
    mptFlags |= (lsfMPTCanEscrow | lsfMPTCanTrade | lsfMPTCanTransfer);   // 0x08|0x10|0x20 = 56
if (tx.isFlag(tfVaultPrivate))
    mptFlags |= lsfMPTRequireAuth;                                        // 0x04
```
| | Transferable | Non-transferable |
| --- | --- | --- |
| Public vault | `Flags = 56` (0x38) | `Flags = 0` |
| Private vault | `Flags = 60` (0x3C) | `Flags = 4` |

`AssetScale` on the share issuance = `Vault.Scale` (so 0, and therefore absent, for XRP and MPT vaults).
`TransferFee` = 0 (absent). **`MaximumAmount` is not set at all** — contrary to spec §3.1.6.2.1, which claims
`0xFFFFFFFFFFFFFFFF`. The protocol ceiling is `kMaxMpTokenAmount = 0x7FFF'FFFF'FFFF'FFFF` (2^63−1), `Protocol.h`.

---

## 6. `Scale` and the asset↔share conversion

### Constants (`include/xrpl/protocol/Protocol.h`)
```cpp
constexpr std::size_t  kMaxMpTokenMetadataLength = 1024;
constexpr std::uint64_t kMaxMpTokenAmount        = 0x7FFF'FFFF'FFFF'FFFFull;
constexpr std::size_t  kMaxDataPayloadLength     = 256;
constexpr std::uint8_t kVaultStrategyFirstComeFirstServe = 1;
constexpr std::uint8_t kVaultDefaultIouScale     = 6;
constexpr std::uint8_t kVaultMaximumIouScale     = 18;   // 10^19 > 2^64-1 > 10^18
constexpr std::uint8_t kMaxAssetCheckDepth       = 5;
enum class VaultVersion : uint8_t { Legacy = 0, CashBasis };
enum class VaultKind    : uint8_t { OpenEnded = 0, ClosedEnded = 1 };
enum class VaultPhase   : uint8_t { NoPhase = 0, Subscription, Investment, Redemption };
constexpr std::uint32_t kLoanRedemptionBuffer = 60;          // seconds
constexpr std::uint32_t kMinInvestmentPeriod  = 180;         // seconds
constexpr std::uint32_t kMaxInvestmentPeriod  = 946708560;   // 30 Gregorian years
```

### Scale rules
- **IOU**: `Scale` settable 0…18 at `VaultCreate`, default **6**.
- **XRP**: `Scale` must be **absent**; forced to 0. Supplying it → `temMALFORMED`
  (`VaultCreate::preflight`: `if (vaultAsset.holds<MPTIssue>() || vaultAsset.native()) return temMALFORMED;`).
- **MPT**: same — `Scale` must be absent, forced to 0.
- `Scale != 0` is written to the entry; `Scale == 0` is left off (default).

Note the XRP arithmetic: `Amount` for an XRP vault is in **drops**, and `Scale = 0`, so
**depositing 10 XRP into an empty vault mints 10,000,000 shares = 1 share per drop** — verified live.
The spec's "10 × 10^6" phrasing makes it look like a 10^6 scale factor is applied; it is not, the factor
is the drops denomination.

### Exchange formulas — the real implementation

All from `src/libxrpl/ledger/helpers/VaultHelpers.cpp`. Let
`A = Vault.AssetsTotal`, `S = MPTokenIssuance.OutstandingAmount`, `ι = Vault.LossUnrealized`,
`σ = 10^Scale`.

**Deposit, assets → shares** (`assetsToSharesDeposit`):
```
if A == 0:  Δshares = trunc( Δassets * σ )          // first deposit into an empty vault
else:       Δshares = trunc( S * Δassets / A )      // TRUNCATED (round down)
```

**Deposit, shares → assets** (`sharesToAssetsDeposit`, the recompute step):
```
if A == 0:  Δassets = Δshares / σ
else:       Δassets = A * Δshares / S               // NOT truncated
```
`VaultDeposit::doApply` does the round-trip: compute `Δshares` (truncated), convert back to
`Δassets'`, refuse if `Δassets' > Amount` (`tecINTERNAL`), then post-`fixCleanup3_4_0` clamp
`Δassets'` down to the posterior `AssetsTotal` scale via `clampToAssetsTotalScale`. The depositor is
debited `Δassets'`, **which can be slightly less than `Amount`**. `Vault.AssetsTotal` and
`Vault.AssetsAvailable` both increase by exactly `Δassets'`.

**Withdrawal denominator** (`assetsTotalForWithdrawal`):
```
Γ = A - ι      normally
Γ = A          when the submitter is the SOLE remaining shareholder (fixCleanup3_2_0, isSoleShareholder)
```

**Withdraw by asset amount** (`assetsToSharesWithdraw`):
```
Δshares = S * Δassets_requested / Γ
```
- pre-`fixCleanup3_4_0`: rounded to nearest (this is what the spec still says)
- **post-`fixCleanup3_4_0` (live on both hackathon networks): TRUNCATED**, so the payout never exceeds
  the request. If it truncates to 0 → `tecPRECISION_LOSS`.

**Redeem by share amount** (`sharesToAssetsWithdraw`):
```
Δassets = Γ * Δshares / S
```
Then, post-`fixCleanup3_4_0`, non-final withdrawals clamp the payout down to the posterior `AssetsTotal`
scale (`clampToAssetsTotalScale(vault, -assetsWithdrawn)`).

**Rounding direction summary** — the submitter never controls it:
| Operation | Direction |
| --- | --- |
| deposit → shares minted | **down** (truncate) |
| deposit → assets actually debited | down, clamped to posterior `AssetsTotal` scale |
| withdraw-by-asset → shares burned | **down** (truncate) post-3.4.0; nearest before |
| redeem-by-share → assets paid | exact ratio, then clamped **down** to posterior scale |

**Final withdrawal special case** (`fixCleanup3_2_0`): if `sharesRedeemed == OutstandingAmount`
(burning every outstanding share), the payout is overridden to the whole of `AssetsAvailable` and the
vault's `AssetsTotal` and `AssetsAvailable` are both set to **exactly 0** — deliberately, so no dust is
left stranded and the vault becomes deletable. This path requires `LossUnrealized == 0`.

`clampToAssetsTotalScale` returns `tecPRECISION_LOSS` when the rounded delta collapses to ≤ 0
(sub-1-ULP change). `debitIsNonZeroDust` rejects a non-zero payout too small to move the stored
`AssetsTotal` — also `tecPRECISION_LOSS`.

### WithdrawalPolicy

Exactly one value exists: `vaultStrategyFirstComeFirstServe`. Its numeric value is **`1`** (a `UInt8`).
`VaultCreate::preflight` rejects anything else with `temMALFORMED`;
`VaultWithdraw::preclaim` treats a stored value other than 1 as `tefINTERNAL`.
xrpl.js exports `VaultWithdrawalPolicy.vaultStrategyFirstComeFirstServe === 1`.

---

## 7. Transaction-by-transaction reference

### 7.1 `VaultCreate` (tt 65)

```json
{
  "TransactionType": "VaultCreate",
  "Account": "rOWNER...",
  "Asset": { "currency": "XRP" },
  "Flags": 0,
  "Data": "68656C6C6F",
  "AssetsMaximum": "1000000",
  "MPTokenMetadata": "7B...",
  "WithdrawalPolicy": 1,
  "DomainID": "….64 hex….",
  "Scale": 6,
  "VaultKind": 1,
  "SubscriptionDate": 842528579,
  "RedemptionDate": 842528759
}
```
`Asset` forms: `{"currency":"XRP"}` · `{"currency":"USD","issuer":"rISSUER"}` · `{"mpt_issuance_id":"<48 hex>"}`.
`AssetsMaximum` is a decimal **string** (`Number`). Dates are **Ripple epoch** seconds (`unix - 946684800`).

**Preflight (`temMALFORMED` unless noted)** — `VaultCreate::preflight`, none of which the spec documents (§3.2.5.1 is `_TBD_`):
1. `Data` present and empty, or > 256 bytes.
2. `WithdrawalPolicy` present and `!= 1`.
3. `DomainID` present and zero.
4. `DomainID` present and `tfVaultPrivate` not set.
5. `AssetsMaximum` present and negative.
6. `MPTokenMetadata` present and empty, or > 1024 bytes.
7. `Scale` present while `Asset` is XRP or MPT.
8. `Scale` present and > 18.
9. `VaultKind` present and not in {0,1}.
10. `SubscriptionDate` or `RedemptionDate` present while kind is not ClosedEnded.
11. Kind is ClosedEnded and either date is missing.
12. Closed-ended gap violates `180 <= Redemption - Subscription < 946708560`.
13. Unknown flag bits → `temINVALID_FLAG` (mask `tfVaultCreateMask`). **Verified live**: `Flags: 0x00040000` → `temINVALID_FLAG`, "The transaction has an invalid flag."
14. `VaultKind`/`SubscriptionDate`/`RedemptionDate` present without `LendingProtocolV1_1`,
    or `DomainID` without `PermissionedDomains`, or `MPTokensV1` off → `temDISABLED`.

**Preclaim**:
| Condition | Code |
| --- | --- |
| asset cannot be held (`canAddHolding`) | varies (`tecNO_AUTH`, `terNO_RIPPLE`, `terNO_ACCOUNT`, …) |
| the asset's issuer is itself a pseudo-account (e.g. another vault's shares, AMM LPTokens) | `tecWRONG_ASSET` |
| asset frozen/locked for the owner | `tecFROZEN` (IOU) / `tecLOCKED` (MPT) |
| `DomainID` names a non-existent `PermissionedDomain` | `tecOBJECT_NOT_FOUND` |
| pseudo-account address collision | `terADDRESS_COLLISION` |
| `SubscriptionDate` or `RedemptionDate` already in the past | `tecEXPIRED` |

**doApply**: `tecINSUFFICIENT_RESERVE` if the owner cannot cover `OwnerCount += 2`.

Verified live (devnet, xrpl.js 5.2.0-beta.0 client-side validation fires before some of these reach the server):

| Attempt | Result |
| --- | --- |
| XRP vault + `Scale: 6` | client throw `VaultCreate: Scale parameter must not be provided for XRP or MPT assets` |
| `WithdrawalPolicy: 2` | server `temMALFORMED` |
| `DomainID` on a public vault | client throw `VaultCreate: Cannot set DomainID unless tfVaultPrivate flag is set.` |
| `VaultKind:1` gap 179 s | client throw `RedemptionDate - SubscriptionDate must be within [180, 946708560) seconds` |
| `VaultKind:1` with only `SubscriptionDate` | client throw `A close-ended vault requires both SubscriptionDate and RedemptionDate` |
| `VaultKind:0` with dates | client throw `SubscriptionDate and RedemptionDate can only be set on a close-ended vault (VaultKind=1)` |
| `VaultKind: 2` | client throw `VaultKind must be 0 (open-ended) or 1 (close-ended)` |
| `VaultKind:1` with both dates in the past | server **`tecEXPIRED`** |

### 7.2 `VaultSet` (tt 66)

```json
{ "TransactionType":"VaultSet", "Account":"rOWNER", "VaultID":"<64 hex>",
  "Data":"…", "AssetsMaximum":"25", "DomainID":"<64 hex>" }
```
Mutable: `Data`, `AssetsMaximum`, `DomainID` (the latter is written to the **share `MPTokenIssuance`**, not the Vault).
`DomainID: "0"*64` removes the domain. `Asset`, `Scale`, `WithdrawalPolicy`, privacy, transferability and the
closed-ended dates are **immutable**.

| Failure | Code |
| --- | --- |
| `VaultID` zero | `temMALFORMED` |
| `Data` present, empty or > 256 B | `temMALFORMED` |
| `AssetsMaximum` negative | `temMALFORMED` |
| none of `Data`/`AssetsMaximum`/`DomainID` given | `temMALFORMED` *(verified live)* |
| vault missing | `tecNO_ENTRY` |
| submitter ≠ `Owner` | `tecNO_PERMISSION` |
| `DomainID` given and vault is not private | `tecNO_PERMISSION` |
| `DomainID` non-zero and domain missing | `tecOBJECT_NOT_FOUND` |
| `AssetsMaximum != 0` and `< AssetsTotal` | `tecLIMIT_EXCEEDED` |

Note `VaultSet` is **not** phase-gated: it works in every closed-ended phase.

### 7.3 `VaultDelete` (tt 67)

```json
{ "TransactionType":"VaultDelete", "Account":"rOWNER", "VaultID":"<64 hex>",
  "MemoData":"77696E642D646F776E" }
```
`MemoData` needs `LendingProtocolV1_1`; decoded length must be 1…256 bytes. Present-but-empty is invalid.
It is *not* written to any ledger entry — it survives only in the transaction record.

| Failure | Code |
| --- | --- |
| `VaultID` zero | `temMALFORMED` |
| `MemoData` present without `LendingProtocolV1_1` | `temDISABLED` |
| `MemoData` empty or > 256 B | `temMALFORMED` |
| vault missing | `tecNO_ENTRY` |
| submitter ≠ `Owner` | `tecNO_PERMISSION` |
| `AssetsAvailable != 0` | `tecHAS_OBLIGATIONS` *(verified live)* |
| `AssetsTotal != 0` | `tecHAS_OBLIGATIONS` |
| `OutstandingAmount != 0` | `tecHAS_OBLIGATIONS` |
| share issuance missing / wrong issuer | `tecOBJECT_NOT_FOUND` / `tecNO_PERMISSION` |

### 7.4 `VaultDeposit` (tt 68)

```json
{ "TransactionType":"VaultDeposit", "Account":"rLENDER", "VaultID":"<64 hex>",
  "Amount":"10000000" }
```
`Amount` is an STAmount in the **vault asset**: drops string for XRP, `{"currency","issuer","value"}` for IOU,
`{"mpt_issuance_id","value"}` for MPT.

| Failure | Code |
| --- | --- |
| `VaultID` zero | `temMALFORMED` |
| `Amount <= 0` | `temBAD_AMOUNT` |
| vault missing | `tecNO_ENTRY` |
| **closed-ended vault in Investment or Redemption phase** | **`tecEXPIRED`** *(V1.1 only, undocumented in XLS-65)* |
| `Amount` asset ≠ `Vault.Asset` | `tecWRONG_ASSET` *(verified live)* |
| MPT asset not transferable | `tecNO_AUTH` |
| asset globally/individually locked | `tecLOCKED` |
| IOU globally frozen or depositor trust line frozen | `tecFROZEN` |
| shares locked for depositor | `tecLOCKED` |
| private vault, non-owner, no domain on the share issuance | `tecNO_AUTH` |
| private vault, non-owner, not a domain member | `tecNO_AUTH` (or `tecEXPIRED` credential, suppressed here) |
| depositor lacks an authorized holding for the asset | `tecNO_AUTH` |
| `Amount` rounds to 0 at vault scale | `tecPRECISION_LOSS` |
| depositor balance < rounded amount | `tecINSUFFICIENT_FUNDS` |
| `Amount` rounds to 0 at the depositor's trust-line scale (IOU) | `tecPRECISION_LOSS` |
| computed shares == 0 | `tecPRECISION_LOSS` |
| `Number` overflow during conversion | `tecPATH_DRY` |
| deposit would push `AssetsTotal` past `AssetsMaximum` | `tecLIMIT_EXCEEDED` |

State: mint `Δshares` to the depositor's share `MPToken` (created on first deposit), raise
`OutstandingAmount`, raise `AssetsTotal` and `AssetsAvailable` by `Δassets'`, move `Δassets'`
depositor → pseudo-account with `WaiveTransferFee::Yes`.

### 7.5 `VaultWithdraw` (tt 69)

```json
// withdraw a fixed asset amount
{ "TransactionType":"VaultWithdraw", "Account":"rLENDER", "VaultID":"<64 hex>",
  "Amount":"1000000", "Destination":"rOTHER", "DestinationTag":42,
  "CredentialIDs":["<64 hex>"] }

// redeem a fixed number of shares
{ "TransactionType":"VaultWithdraw", "Account":"rLENDER", "VaultID":"<64 hex>",
  "Amount": { "mpt_issuance_id":"<48 hex>", "value":"5000000" } }
```
`Amount` may be **either** the vault asset (withdraw path) **or** the vault share MPT (redeem path).
`CredentialIDs` is real (`Vector256`, present in xrpl.js ≥ 5.2.0-beta.0) and is **not in the XLS-65 markdown**.

| Failure | Code |
| --- | --- |
| `VaultID` zero, or `Destination` zero | `temMALFORMED` |
| `Amount <= 0` | `temBAD_AMOUNT` |
| malformed `CredentialIDs` | `temMALFORMED` / `temDISABLED` |
| vault missing | `tecNO_ENTRY` |
| **closed-ended vault in Investment phase** | **`tecTOO_SOON`** *(V1.1 only, undocumented)* |
| `Amount` asset is neither the vault asset nor the share | `tecWRONG_ASSET` |
| asset non-transferable to destination | varies |
| stored `WithdrawalPolicy != 1` | `tefINTERNAL` |
| bad / expired credentials | `tecEXPIRED`, `tecBAD_CREDENTIALS`, … |
| destination is a pseudo-account | `tecPSEUDO_ACCOUNT` (`fixCleanup3_4_0`) |
| destination missing / needs a tag / requires deposit auth | `tecNO_DST` / `tecDST_TAG_NEEDED` / `tecNO_PERMISSION` |
| submitter holds fewer shares than needed | `tecINSUFFICIENT_FUNDS` |
| `AssetsAvailable` < payout | `tecINSUFFICIENT_FUNDS` *(verified live: withdrawing 99 XRP from a 10 XRP vault)* |
| computed shares == 0, or payout is sub-ULP dust | `tecPRECISION_LOSS` |
| `Number` overflow | `tecPATH_DRY` |
| private vault, third-party destination, submitter or destination outside the domain | `tecNO_AUTH` / `tecEXPIRED` (`fixCleanup3_4_0`) |
| freeze/lock on asset for pseudo-account, submitter or destination | `tecFROZEN` / `tecLOCKED` |

Notes:
- Withdrawing **to yourself** from a private vault is always allowed — by design, so revoking a credential
  cannot strand funds. Sending to a **third party** does enforce domain membership of both ends
  (post-`fixCleanup3_4_0`). **The XLS-65 FAQ A.2 says the opposite.**
- The share `MPToken` is deleted when it hits zero, unless the holder is the vault owner.
- `lsfMPTCanTransfer` is deliberately bypassed on this path (`WaiveMPTCanTransfer::Yes`) so an issuer cannot trap funds.

### 7.6 `VaultClawback` (tt 70)

```json
{ "TransactionType":"VaultClawback", "Account":"rISSUER", "VaultID":"<64 hex>",
  "Holder":"rHOLDER", "Amount": { "currency":"USD","issuer":"rISSUER","value":"100" } }
```
`Amount` is optional; **`Amount` is an `Amount` (STAmount), not a `NUMBER`** as the spec claims. Omitting it means
"all". `Amount` may be denominated in the **vault asset** (issuer clawback) or in the **vault share** (owner burn).

Preflight: `VaultID` zero → `temMALFORMED`; negative `Amount` → `temBAD_AMOUNT`; XRP `Amount` → `temMALFORMED`.

Preclaim highlights (the spec lists these without any error codes):
- vault missing → `tecNO_ENTRY`
- `Holder` is a pseudo-account → `tecPSEUDO_ACCOUNT` (`fixCleanup3_4_0`)
- `Amount` omitted and the asset issuer **is** the vault owner → `tecWRONG_ASSET` (ambiguous, must be explicit)
- share-denominated: submitter ≠ vault owner → `tecNO_PERMISSION`; allowed **only** when
  `OutstandingAmount > 0` and `AssetsTotal == AssetsAvailable == 0` else `tecNO_PERMISSION`;
  a non-zero `Amount` must equal the holder's entire share balance else `tecLIMIT_EXCEEDED`
- asset-denominated: XRP → `tecNO_PERMISSION`; submitter ≠ asset issuer → `tecNO_PERMISSION`;
  issuer == holder → `tecNO_PERMISSION`; MPT issuance missing → `tecOBJECT_NOT_FOUND`;
  `lsfMPTCanClawback` unset / `lsfAllowTrustLineClawback` unset / `lsfNoFreeze` set → refused

Clawback is capped at `min(Vault.AssetsAvailable, Δassets)` — a partial clawback is normal, not an error.

---

## 8. Closed-ended vaults (`LendingProtocolV1_1`) — the undocumented half

Not in XLS-65 or XLS-65.1 at all; reconstructed from `Protocol.h` + `VaultHelpers.cpp` + live tests.

```
VaultKind:        0 = OpenEnded (default, field omitted), 1 = ClosedEnded
SubscriptionDate: UInt32 Ripple-epoch seconds (unix - 946684800), immutable
RedemptionDate:   UInt32 Ripple-epoch seconds, immutable
Constraint at create: 180 <= RedemptionDate - SubscriptionDate < 946708560
Both dates must be in the future at create time, else tecEXPIRED.
```

Phase is derived from the **parent ledger close time**, not the current wall clock:
```cpp
if (!isClosedEnded)                                         return NoPhase;
if (!hasExpired(view, sub, ExpiryComparison::Exclusive))     return Subscription;  // now <= sub
if (!hasExpired(view, red))                                  return Investment;    // sub < now <= red  (inclusive)
                                                             return Redemption;    // now > red
```

| Phase | `VaultDeposit` | `VaultWithdraw` | `VaultSet` |
| --- | --- | --- | --- |
| Subscription | allowed *(verified live)* | allowed *(verified live)* | allowed |
| Investment | **`tecEXPIRED`** | **`tecTOO_SOON`** | allowed |
| Redemption | **`tecEXPIRED`** | allowed | allowed |

Note the error-code choice is counter-intuitive: withdrawing "too early" is `tecTOO_SOON`, but depositing
"too late" is `tecEXPIRED` — and depositing during Redemption is also `tecEXPIRED`, which is the same code you get
for creating a vault with dates already in the past.

`LEVersion = 1` (`VaultVersion::CashBasis`) is set on **every** vault created while `LendingProtocolV1_1` is
enabled — open-ended included. So on today's devnets you cannot create a Legacy/accrual-basis vault.

Verified live, closed-ended vault `34DFF6E753EB495D7989E7C129EDF75864C73BD3BFFE0C467FBA708B881FB5F9`
on public devnet (owner `rDm8sWGQowgtZgaxpYL1F2y31zu7FXwQXZ`, `SubscriptionDate` 842528579,
`RedemptionDate` 842528759), `NewFields`:
```json
{"Account":"rUxJoSGftEmLQwH5Y8YmvkNa9ycqQa74Fj","LEVersion":1,
 "Owner":"rDm8sWGQowgtZgaxpYL1F2y31zu7FXwQXZ","RedemptionDate":842528759,
 "Sequence":5251767,"ShareMPTID":"00000001831F1EE7B452310966ED03CB1447E1F6D5D662F9",
 "SubscriptionDate":842528579,"VaultKind":1,"WithdrawalPolicy":1}
```

---

## 9. Permissioned domains / credentials

- Only a **private** vault (`tfVaultPrivate`) may carry a `DomainID`. The domain id is stored on the share
  `MPTokenIssuance`, not on the `Vault` entry, and `vault_info` surfaces it at `vault.shares.DomainID`.
- `checkVaultDomain` reads the domain **from the share issuance**: a private vault with no domain set has
  *no* authorized participants; every non-owner fails `tecNO_AUTH`.
- The vault **owner** is implicitly authorized to deposit and withdraw without credentials.
- Deposit tolerates an *expired* credential (`SuppressExpired::Yes`; `doApply` deletes it). Withdraw does not.
- `VaultWithdraw.CredentialIDs` lets the submitter present credentials for the destination's `DepositPreauth` check.

## 10. Frozen / locked assets

Spec §3.1.8: when the vault asset is frozen, funds can only be withdrawn by setting `Destination` = the asset
`Issuer`, frozen assets cannot be deposited, and shares cannot be transferred. The `fixCleanup3_3_0`
implementation (`checkDepositFreeze` / `checkWithdrawFreeze`) checks the pseudo-account, the submitter and the
destination. Post-`fixCleanup3_4_0` the private-vault domain check explicitly exempts
`dstAcct == vaultAsset.getIssuer()` to keep that recovery path open.

Transfer fees are **never** charged on `VaultDeposit`/`VaultWithdraw` (`WaiveTransferFee::Yes` in both transactors).

---

## 11. `vault_info` RPC — the spec is wrong about the request

**Real parameters** (`src/xrpld/rpc/handlers/VaultInfo.cpp`):
- `vault_id` — hex string, **or**
- `owner` (classic address) **and** `seq` (positive 32-bit int, the creating transaction `Sequence`)
- plus the standard `ledger_hash` / `ledger_index`

XLS-65 §3.9.1 documents a single field named **`vault`**. That is not accepted:
```
$ curl -d '{"method":"vault_info","params":[{"vault":"00…01"}]}' https://s.devnet.rippletest.net:51234/
{"error":"invalidParams","error_code":31,
 "error_message":"Must specify either 'vault_id' or both 'owner' and 'seq'."}
```
Errors: `invalidParams` (31) for a bad/absent selector, `entryNotFound` (98) for a missing vault or a
missing share issuance.

**Live response for a freshly created XRP vault** (public devnet, before any deposit):
```json
{"vault":{
  "Account":"rJi2UvoapWpZvRTPVK7TkdoSCvjWCe1V5r",
  "Asset":{"currency":"XRP"},
  "Flags":0, "LEVersion":1, "LedgerEntryType":"Vault",
  "Owner":"rDm8sWGQowgtZgaxpYL1F2y31zu7FXwQXZ", "OwnerNode":"0",
  "PreviousTxnID":"C649DB123358A37E2745F94D414ECA915291F1DD849692C7A715BA4D85356D94",
  "PreviousTxnLgrSeq":5251766, "Sequence":5251760,
  "ShareMPTID":"00000001C3DA3D37997E9AAF1B2A3E0FB21F72B1400D41EF",
  "WithdrawalPolicy":1,
  "index":"DCA610B8144C330E5BE04C4FBE0672234F689EC101CBC7E187640AB0EB8860C3",
  "shares":{"Flags":56,"Issuer":"rJi2UvoapWpZvRTPVK7TkdoSCvjWCe1V5r",
            "LedgerEntryType":"MPTokenIssuance","OutstandingAmount":"0","OwnerNode":"0",
            "Sequence":1,"mpt_issuance_id":"00000001C3DA3D37997E9AAF1B2A3E0FB21F72B1400D41EF",
            "index":"4E7E6C66874B4D9EE1FBE5E8FE26F5CE1AAC185BAD21519CEF77D81E26D205B5"}}}
```
**`AssetsTotal`, `AssetsAvailable`, `LossUnrealized` and `Scale` are all missing.** Both XLS-65 §3.9.2 and
xrpl.org mark them "always present" / "required". After a 10 XRP deposit they appear as
`"AssetsTotal":"10000000","AssetsAvailable":"10000000"` (decimal strings). Client code must read them as
`Number(v.AssetsTotal ?? 0)`.

`vault_list` is **Clio-only** and returns `unknownCmd` (32) on both hackathon rippled endpoints — verified.

---

## 12. Verified live transcript (public XRPL devnet, 2026-09-12)

Owner `rDm8sWGQowgtZgaxpYL1F2y31zu7FXwQXZ`, xrpl.js `5.2.0-beta.0`, WSS `wss://s.devnet.rippletest.net:51233/`.

| # | Action | Result |
| --- | --- | --- |
| 1 | `VaultCreate` XRP, no optional fields. Fee autofilled `200000` drops. | `tesSUCCESS` `C649DB123358A37E2745F94D414ECA915291F1DD849692C7A715BA4D85356D94` |
| | Created: `AccountRoot` (pseudo `rJi2UvoapWpZvRTPVK7TkdoSCvjWCe1V5r`, `Flags` 26214400, `VaultID` set), `MPTokenIssuance` (`Flags` 56), 2× `DirectoryNode`, owner `MPToken`, `Vault` | |
| 2 | `VaultDeposit` 10 XRP (`Amount:"10000000"`) | `tesSUCCESS`; `AssetsTotal=AssetsAvailable=10000000`, `OutstandingAmount=10000000`, owner `MPToken.MPTAmount=10000000` → **1 share per drop** |
| 3 | `VaultWithdraw` `Amount:"99000000"` | `tecINSUFFICIENT_FUNDS` |
| 4 | `VaultWithdraw` `Amount:{mpt_issuance_id, value:"1000000"}` | `tesSUCCESS` (redeem path) → `OutstandingAmount` 9000000 |
| 5 | `VaultDeposit` with a USD amount into an XRP vault | `tecWRONG_ASSET` |
| 6 | `VaultDelete` on a non-empty vault | `tecHAS_OBLIGATIONS` |
| 7 | `VaultSet` with no mutable field | `temMALFORMED` |
| 8 | `VaultCreate` `WithdrawalPolicy: 2` | `temMALFORMED` |
| 9 | closed-ended `VaultCreate` with past dates | `tecEXPIRED` |
| 10 | closed-ended `VaultCreate`, gap 180 s | `tesSUCCESS` `DA643E78763ADD09B40B755236C2AEFFD8837A6CED1BD23FAF1A00E249C86EF7` |
| 11 | deposit + withdraw during Subscription | both `tesSUCCESS` |

---

## 13. Ambiguities the spec leaves open

1. §3.1.10 `Invariants`, §3.2.5.1 `VaultCreate` data verification, §3.2.7, §3.7.4, §3.9.3, §3.9.4,
   §4 `Rationale` and §5 `Security Considerations` are all literally `**TBD**` / `_TBD_`.
2. Nothing says where `SharesTotal` lives. The formulas use `Γ_shares` with no pointer to
   `MPTokenIssuance.OutstandingAmount`.
3. Nothing says `Number`-typed fields serialize as JSON strings, nor that default-valued fields are omitted.
4. `Scale` for the **initial** deposit into an empty vault: the spec gives `Δshares = Δassets × σ` with no rounding
   direction; the code truncates.
5. The `first-come-first-serve` policy is described as "a depositor to redeem any amount of assets provided they
   have a sufficient number of shares" — but `AssetsAvailable` also gates it (`tecINSUFFICIENT_FUNDS`),
   which the policy section never mentions.
6. `LossUnrealized` — "Only a protocol connected to the Vault may increase or decrease" it. No transaction in
   XLS-65 touches it; the mechanism lives entirely in XLS-66.
7. §3.7 says `VaultClawback` "must respect any future fees or penalties" — undefined today.
8. Whether a `Vault` may hold another vault's shares: the spec is silent; the code refuses
   (`tecWRONG_ASSET` for pseudo-account issuers) and carries a `kMaxAssetCheckDepth = 5` recursion guard,
   which suggests nested vaults were once intended.

---

## 14. Verified live transcript — IOU vault with `Scale`, and the closed-ended lifecycle

### 14a. IOU vault, default `Scale = 6` (public devnet)
Issuer `rN64qnnX8Txx4b7kyug1VsUeS1PeSjPcEd` (DefaultRipple set), owner/lender `rP8h9gsabJ4M7cjz1QCbzNCaSpW5BFxohm`,
vault `5373B10A6FE81B1244399F0D242792FF9F02346DD37726D2920E273C3BB5E098`.

`Vault` `NewFields` at creation — note `Scale: 6` **is** written (non-default) while `AssetsTotal` etc. are not:
```json
{"Account":"rDGmV8Dv2w1mJsJ5odn41pYfhQPhpjqZDE",
 "Asset":{"currency":"USD","issuer":"rN64qnnX8Txx4b7kyug1VsUeS1PeSjPcEd"},
 "LEVersion":1,"Owner":"rP8h9gsabJ4M7cjz1QCbzNCaSpW5BFxohm","Scale":6,
 "Sequence":5251818,"ShareMPTID":"00000001869CE473BAB065D751C72EC4D5CBD7AE3CECB647","WithdrawalPolicy":1}
```
Share `MPTokenIssuance`:
```json
{"AssetScale":6,"Flags":56,"Issuer":"rDGmV8Dv2w1mJsJ5odn41pYfhQPhpjqZDE",
 "LedgerEntryType":"MPTokenIssuance","OutstandingAmount":"0",
 "ReferenceHolding":"D197255C858AF56096DAF6DCE0B45F1CC0C2AC4BE5B145E1E49D308B9CE0C9C1",
 "Sequence":1,"mpt_issuance_id":"00000001869CE473BAB065D751C72EC4D5CBD7AE3CECB647"}
```
`AssetScale` = `Vault.Scale` as specified. **`ReferenceHolding`** is a `fixCleanup3_2_0` addition
(`keylet::trustLine(pseudo, issue)` for IOU, `keylet::mptoken(...)` for MPT) that appears in neither XLS-65 nor XLS-33.
No `MaximumAmount` and no `TransferFee` are written.

| # | Action | Result |
| --- | --- | --- |
| S5 | `VaultDeposit` `{"currency":"USD","issuer":…,"value":"20.3"}` | `tesSUCCESS` → `AssetsTotal="20.3"`, `OutstandingAmount="20300000"` — **exactly the spec's 20.3 × 10^6 example** |
| S6 | `VaultDeposit` value `"0.000000001"` (below 1 ULP at `Scale` 6) | **`tecPRECISION_LOSS`** — "The amounts used by the transaction cannot interact." |
| S7 | `VaultSet` `AssetsMaximum:"25"` | `tesSUCCESS` |
| S8 | `VaultDeposit` `"10"` (would take total to 30.3 > 25) | **`tecLIMIT_EXCEEDED`** |
| S9 | `VaultSet` `AssetsMaximum:"5"` (< `AssetsTotal` 20.3) | **`tecLIMIT_EXCEEDED`** |
| S10 | `VaultCreate` IOU `Scale: 19` | xrpl.js client throw `Scale must be a number between 0 and 18 inclusive for IOU assets` |

`AssetsTotal` for an IOU vault renders as a decimal string: `"20.3"`, not `"20300000"`.

### 14b. Closed-ended vault, full lifecycle (public devnet)
Vault `34DFF6E753EB495D7989E7C129EDF75864C73BD3BFFE0C467FBA708B881FB5F9`,
`SubscriptionDate` 842528579, `RedemptionDate` 842528759 (180 s apart, the minimum).

| Phase | Action | Result |
| --- | --- | --- |
| Subscription | `VaultDeposit` 5 XRP | `tesSUCCESS` `9D101694EF3C987C695FABB49B220B8C8DDE80084DBFC496DAA0FCD72FA76B0A` |
| Subscription | `VaultWithdraw` 1 XRP | `tesSUCCESS` |
| **Investment** | `VaultDeposit` 1 XRP | **`tecEXPIRED`** — "Expiration time is passed." |
| **Investment** | `VaultWithdraw` 1 XRP | **`tecTOO_SOON`** — "It is too early to attempt the requested operation. Please wait." |
| **Redemption** | `VaultDeposit` 1 XRP | **`tecEXPIRED`** |
| Redemption | `VaultWithdraw` more shares than held | `tecINSUFFICIENT_FUNDS` |
| Redemption | `VaultWithdraw` `{mpt_issuance_id, value:"4000000"}` (all shares) | `tesSUCCESS` `CA697FABBC0BB886FC47C38FA75B8878A925DED798F278B540E1530E9BB9D3C7` |
| Redemption | `vault_info` after full redemption | `AssetsTotal` / `AssetsAvailable` **absent again** (both exactly 0 by the final-withdrawal rule), `OutstandingAmount: "0"` |
| Redemption | `VaultDelete` with `MemoData` (hex of `wind-down complete`) | `tesSUCCESS` `B16275E0DBD63B9E57DFF5A7E148AEB5416EA6C3E3D3913CCBA51E83A193338F` |
| after | `vault_info` | `entryNotFound` |

An earlier `VaultDelete` attempted while shares were still outstanding returned `tecHAS_OBLIGATIONS`
(`6B702B882362D2881E892911DFD46C606E36CD4F76CD9BC0B20D5DF11A6E3878`).

---

## 15. Copy-paste recipes (xrpl.js ≥ 5.2.0-beta.0, verified)

```js
import { Client, Wallet, convertStringToHex, VaultCreateFlags,
         VaultWithdrawalPolicy, VaultKind } from 'xrpl'

const RIPPLE_EPOCH = 946684800
const toRipple = (unixSeconds) => unixSeconds - RIPPLE_EPOCH

// 1. open-ended public XRP vault — let autofill set Fee (it computes 0.2 XRP, not 10 drops)
const create = { TransactionType: 'VaultCreate', Account: owner.classicAddress,
                 Asset: { currency: 'XRP' } }               // NO Scale for XRP or MPT

// 1b. private IOU vault with a permissioned domain
const createPriv = {
  TransactionType: 'VaultCreate', Account: owner.classicAddress,
  Asset: { currency: 'USD', issuer: ISSUER },
  Flags: VaultCreateFlags.tfVaultPrivate,                   // 0x00010000
  DomainID: domainId,                                       // ONLY legal with tfVaultPrivate
  Scale: 6,                                                 // 0..18, IOU only
  AssetsMaximum: '1000000',                                 // decimal STRING
  WithdrawalPolicy: VaultWithdrawalPolicy.vaultStrategyFirstComeFirstServe, // === 1
  Data: convertStringToHex(JSON.stringify({ n: 'Fund II' })) // <= 256 bytes decoded
}

// 1c. closed-ended vault compressed to an event timeline
const now = Math.floor(Date.now() / 1000)
const createClosed = {
  TransactionType: 'VaultCreate', Account: owner.classicAddress,
  Asset: { currency: 'XRP' },
  VaultKind: VaultKind.vaultKindClosed,                     // 1
  SubscriptionDate: toRipple(now + 15 * 60),
  RedemptionDate:   toRipple(now + 15 * 60 + 45 * 60)       // gap must be in [180, 946708560)
}

// 2. grab the VaultID from metadata
const vaultId = res.result.meta.AffectedNodes
  .find(n => n.CreatedNode?.LedgerEntryType === 'Vault').CreatedNode.LedgerIndex
const shareMPTID = res.result.meta.AffectedNodes
  .find(n => n.CreatedNode?.LedgerEntryType === 'Vault').CreatedNode.NewFields.ShareMPTID

// 3. deposit / withdraw / redeem
const deposit  = { TransactionType: 'VaultDeposit',  Account: a, VaultID: vaultId, Amount: '10000000' }
const withdraw = { TransactionType: 'VaultWithdraw', Account: a, VaultID: vaultId, Amount: '1000000' }
const redeem   = { TransactionType: 'VaultWithdraw', Account: a, VaultID: vaultId,
                   Amount: { mpt_issuance_id: shareMPTID, value: '5000000' } }

// 4. read state — DEFAULTED FIELDS ARE ABSENT
const { vault } = (await client.request({ command: 'vault_info', vault_id: vaultId })).result
//   or: { command: 'vault_info', owner: ownerAddress, seq: creatingTxSequence }
const assetsTotal     = Number(vault.AssetsTotal     ?? 0)
const assetsAvailable = Number(vault.AssetsAvailable ?? 0)
const lossUnrealized  = Number(vault.LossUnrealized  ?? 0)
const scale           = Number(vault.Scale           ?? 0)   // NOT 6 by default in the JSON
const sharesTotal     = Number(vault.shares.OutstandingAmount)  // there is no Vault.SharesTotal
const pps             = sharesTotal === 0 ? 1 : assetsTotal / sharesTotal
```

**Gotchas that will cost you a submission:**
- `Fee` — `VaultCreate` costs one incremental owner reserve (0.2 XRP on devnet). Autofill. Never hardcode `"10"`.
- `Scale` — omit for XRP and MPT or you get `temMALFORMED`.
- `AssetsMaximum` / `AssetsTotal` are **strings**.
- For an XRP vault, `Amount` is in **drops** and shares come out 1:1 with drops.
- After the final withdrawal `AssetsTotal` / `AssetsAvailable` vanish from the JSON rather than reading `"0"`.
- `vault_list` does not exist on rippled — Clio only.

---

## 16. Friction log (every item has a URL and a proposed fix)

See the structured return for the machine-readable version. Summary:

1. `https://xls.xrpl.org/xls/XLS-0065` → **404**. Real URL is `…/xls/XLS-0065-single-asset-vault.html`.
   *Fix:* add a redirect from the bare `XLS-00NN` form, or publish the short slug as an alias.
2. `vault_info` request field documented as `vault` (§3.9.1); the server wants `vault_id`, or `owner` + `seq`.
   *Fix:* correct the table and add the `owner`+`seq` row; add a `vault_info` page to xrpl.org (currently 404).
3. `vault_info` §3.9.2 marks `AssetsTotal`, `AssetsAvailable`, `Scale` "Always Present: Yes"; they are omitted
   when default. Same error on xrpl.org's ledger-entry page ("Required: Yes").
   *Fix:* mark them "No — omitted when equal to the default; read as 0" and say so once in a note.
4. `VaultKind`, `SubscriptionDate`, `RedemptionDate`, `LEVersion` are live on both hackathon devnets and in
   `server_definitions`, and appear in no spec document. XLS-65.1 documents only the `MemoData` part of
   `LendingProtocolV1_1`. *Fix:* an XLS-65.2 covering closed-ended vaults, or fold §8 of this document into 65.1.
5. `VaultWithdraw.CredentialIDs` is in `TRANSACTION_FORMATS` and in xrpl.js, and in no spec table. *Fix:* add the row.
6. XLS-65 FAQ A.2 — "`VaultWithdraw` does not respect the permissioned domain rules" — is false post-`fixCleanup3_4_0`
   for third-party destinations. *Fix:* rewrite as "withdrawing to yourself or to the asset issuer is never
   domain-gated; a third-party `Destination` requires both the submitter and the destination to be domain members."
7. §3.2.5.1 (`VaultCreate` data verification) is `_TBD_` and §3.2.5.2 lists conditions with **no error codes**,
   while `VaultSet`/`VaultDelete`/`VaultDeposit`/`VaultWithdraw` do carry codes. §3.7.2 (`VaultClawback`) has
   no codes at all. *Fix:* §7.1 and §7.6 of this document are a drop-in replacement.
8. §3.1.6.2.1 claims the share issuance has `MaximumAmount = 0xFFFFFFFFFFFFFFFF`. The field is never written and
   the protocol cap is `kMaxMpTokenAmount = 0x7FFF'FFFF'FFFF'FFFF`. *Fix:* "`MaximumAmount` is not set; the
   implicit ceiling is 2^63−1."
9. `Vault.LedgerIndex` is typed `UINT16` in the §3.1.2 table (should be `HASH256`); `ShareMPTID` is typed
   `UINT192` / JSON `number` (it is `Hash192` and a hex **string**); `VaultClawback.Amount` is typed `NUMBER`
   (it is `Amount`/STAmount); every `Number` field is typed JSON `number` (they serialize as strings).
10. `VaultCreate.WithdrawalPolicy` default is given as the string `"FirstComeFirstServe"` in §3.2.1 while §3.2.3
    names the constant `vaultStrategyFirstComeFirstServe` with value `0x0001` — three spellings, and the real
    value is the `UInt8` `1`. xrpl.org repeats `0x0001`. *Fix:* one name, one decimal value, everywhere.
11. §3.6.1 links `[Withdraw formula](#21723-withdraw)` and `[Redeem formula](#21722-redeem)` — both anchors are
    dead (the sections are 3.1.7.2.3 / 3.1.7.2.2). *Fix:* `#31723-withdraw` / `#31722-redeem`.
12. The `vault_list` section is numbered `### 4.2` but sits inside `## 3. Specification`, before `## 4. Rationale`.
    Its `ledger_hash` is described as "A 20-byte hex string" (it is 32 bytes). `vault_list` is also Clio-only and
    returns `unknownCmd` on both hackathon endpoints — the spec never says which server implements it.
13. The IOU `vault_info` example (§3.9.5) is **invalid JSON** — line 862 of the raw markdown is `   "Scale": 6,` followed immediately by `  }`, so `jq` refuses the block, and the MPT
    example invents fields that do not exist (`Share`, `ShareTotal`, `WithdrawalPolicy: "0x0001"` as a string,
    an `Asset.value`). *Fix:* replace both with real `vault_info` output (§11 and §14a here).
14. §3.1.6.1.2 says XRP `Scale` is fixed at 0, then computes "10 XRP → 10,000,000 shares (10 × 10^6)". The 10^6 is
    the drops denomination, not a scale factor. *Fix:* "`Amount` is in drops; with `Scale = 0` an empty XRP vault
    mints one share per drop."
15. Nothing tells you `Γ_shares` lives in `MPTokenIssuance.OutstandingAmount`. *Fix:* one sentence in §3.1.7.2 and a
    `SharesTotal` note in the ledger-entry table.
16. §3.1.7.2.3 says withdraw-by-asset rounds shares **to the nearest** whole number. Post-`fixCleanup3_4_0`
    (live everywhere) it **truncates**. *Fix:* state the post-amendment behaviour and name the amendment.
17. `ReferenceHolding` on the share `MPTokenIssuance` (`fixCleanup3_2_0`) is documented nowhere.
18. `xrpl@5.2.0` (npm `latest`) has no `VaultKind` / `SubscriptionDate` / `RedemptionDate` / `MemoData` /
    `CredentialIDs`. Closed-ended vaults require `5.2.0-beta.0` or `-beta.1`.
    The xrpl.org vault tutorials say `npm install xrpl` with no version. *Fix:* pin the version in the tutorials.
19. xrpl.js validates `Scale`, `DomainID`-without-`tfVaultPrivate`, `VaultKind` and the closed-ended date gap
    client-side with good messages, but **not** `WithdrawalPolicy ∈ {1}` nor `VaultSet` with nothing to update —
    those cost a round trip and a fee for a `temMALFORMED`. *Fix:* add both to
    `validateVaultCreate` / `validateVaultSet`.
20. Phase-gate error codes are surprising: withdrawing during Investment is `tecTOO_SOON` ("too early") even though
    you are *after* `SubscriptionDate`, and depositing during Redemption is `tecEXPIRED` — the same code
    `VaultCreate` returns for dates in the past. *Fix:* a dedicated `tecVAULT_PHASE` (or at minimum document the
    mapping in one table).
