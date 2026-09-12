# amendment-map — every enabled amendment, and where it touches a Vault or a Loan

Compiled 2026-09-12. Sources, in order of authority:

- **rippled `master`** cloned at `94037361992ad75b32a6b2659b655ab96b7cb7c2` ("ci: Exclude Rust unit tests from code coverage (#8203)", 2026-09-10). Paths below are relative to that tree.
- **XRPL-Standards** cloned at `0200ec57ec70836be04eee436a8e9e9a92e67989` (2026-09-11).
- **Live ledger**: Track 1 `https://lending-hackathon.dev.ripplex.io:51234` (3.4.0-rc1, network_id 4001) and Track 2 `https://s.devnet.rippletest.net:51234/` (3.4.0-rc5, network_id 2). Every tx hash quoted is from one of those two.

Builds on `docs/research/devnet-recon.md` (which established the enabled sets). This document does **not** repeat that; it answers *what each amendment introduces* and *what happens when you point it at a Vault or a Loan*.

---

## 0. The sponsored-fees question, settled

The assignment flagged XLS-68 as unconfirmed. It is **ENABLED on both networks**, name `Sponsor`, amendment ID `BE1F90581635DBCEBFC4678C4B54FEDDC1A17B50FD02CFE765A4132A342126AC`, `Supported::Yes` at `include/xrpl/protocol/detail/features.macro:23`.

`feature` RPC, both nodes, 2026-09-12:
```
Sponsor  enabled=true  supported=true  BE1F90581635DBCEBFC4678C4B54FEDDC1A17B50FD02CFE765A4132A342126AC
```

But see §4.1 — enabled does **not** mean usable from a vault or a loan. It is not.

### 0.1 Why a sweep can miss it, and a trap you must not fall into

`feature` reports **retired** amendments with `enabled: false`. Retired amendments are compiled in permanently and never appear in a genesis-fresh network's `Amendments` object, so the RPC has nothing to report and prints `false`.

Concretely, on **both** networks:
```
Escrow       enabled=false  supported=true  07D43DCE529B15A10827E5E04943B496762F9A88E3268269D69C44BE49E21104
```
yet `XRPL_RETIRE_FEATURE(Escrow)` sits at `include/xrpl/protocol/detail/features.macro:132`, and an `EscrowCreate` submitted to public Devnet returned **tesSUCCESS**:
`C960AF10D264215B05DC922D33E3DE7D8E28DFEFB0E563CC79C9B190B8F0768E`.

So `enabled: false` from `feature` is ambiguous between *"not activated"* and *"retired, always on"*. `TicketBatch` shows the same split across the two networks (`false` on T1, `true` on T2) purely because T2's ledger predates retirement.

---

## 1. The map

Legend: **LE** = ledger entries introduced. Status is the `status:` front-matter of the XLS at the commit above.

| Amendment (as `feature` names it) | XLS | Spec | Status | Transactions | LE | Enabled T1/T2 |
|---|---|---|---|---|---|---|
| `SingleAssetVault` | 65 | [XLS-0065](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0065-single-asset-vault) | Draft | `VaultCreate`(65) `VaultSet`(66) `VaultDelete`(67) `VaultDeposit`(68) `VaultWithdraw`(69) `VaultClawback`(70) | `Vault` | yes / yes |
| `LendingProtocol` | 66 | [XLS-0066](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0066-lending-protocol) | Draft | `LoanBrokerSet`(74) `LoanBrokerDelete`(75) `LoanBrokerCoverDeposit`(76) `LoanBrokerCoverWithdraw`(77) `LoanBrokerCoverClawback`(78) `LoanSet`(80) `LoanDelete`(81) `LoanManage`(82) `LoanPay`(84) | `LoanBroker`, `Loan` | yes / yes |
| `LendingProtocolV1_1` | 66 | same | Draft | none new — gates fields/behaviour inside the above | none | yes / yes |
| `LendingProtocolV1_2` | 66 | same | — | **`Supported::No`**, absent from both nodes | — | no / no |
| `MPTokensV1` | 33 | [XLS-0033](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0033-multi-purpose-tokens) | Final | `MPTokenIssuanceCreate`(54) `MPTokenIssuanceDestroy`(55) `MPTokenIssuanceSet`(56) `MPTokenAuthorize`(57) | `MPTokenIssuance`, `MPToken` | yes / yes |
| `MPTokensV2` | 82 | [XLS-0082](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0082-mpt-dex) | Draft | none new — unlocks MPT on the DEX | none | **no / no** |
| `DynamicMPT` | 94 | [XLS-0094](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0094-dynamic-MPT) | Final | none new — adds mutate semantics to `MPTokenIssuanceSet` (`MPTokenMetadata`, `TransferFee`, `ImmutableFlags`, `tfMPTSet*`) | none | yes / yes |
| `Credentials` | 70 | [XLS-0070](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0070-credentials) | Final | `CredentialCreate`(58) `CredentialAccept`(59) `CredentialDelete`(60) | `Credential` | yes / yes |
| `PermissionedDomains` | 80 | [XLS-0080](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0080-permissioned-domains) | Final | `PermissionedDomainSet`(62) `PermissionedDomainDelete`(63) | `PermissionedDomain` | yes / yes |
| `PermissionedDEX` | 81 | [XLS-0081](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0081-permissioned-dex) | Final | none new — adds `DomainID` + `tfHybrid` to `OfferCreate` | none | yes / yes |
| `TokenEscrow` | 85 | [XLS-0085](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0085-token-escrow) | Final | none new — extends `EscrowCreate/Finish/Cancel` to IOU + MPT | none (reuses `Escrow`) | yes / yes |
| `BatchV1_1` | 56 | [XLS-0056](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0056-batch) | Final | `Batch`(71) | none | yes / yes |
| `PermissionDelegationV1_1` | 74 + 75 | [XLS-0074](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0074-account-permissions), [XLS-0075](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0075-permission-delegation) | Final | `DelegateSet`(64) | `Delegate` | yes / yes |
| `Sponsor` | 68 | [XLS-0068](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0068-sponsored-fees-and-reserves) | Draft | `SponsorshipTransfer`(90) `SponsorshipSet`(91) | `Sponsorship` | yes / yes |
| `PriceOracle` | 47 | [XLS-0047](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0047-PriceOracles) | Final | `OracleSet`(51) `OracleDelete`(52) | `Oracle` | yes / yes |
| `SmartEscrow` | 100 | [XLS-0100](https://github.com/XRPLF/XRPL-Standards/tree/master/XLS-0100-smart-escrows) | Draft | — | — | **no / no** (`Supported::No`) |

Tx type numbers are from `include/xrpl/protocol/detail/transactions.macro`; ledger entries from `include/xrpl/protocol/detail/ledger_entries.macro`. Vault-adjacent specs with no amendment of their own: XLS-64 pseudo-account (Draft), XLS-90 MPT domain (Draft), XLS-98 vault metadata (Draft).

---

## 2. Where each amendment actually touches a Vault or a Loan

Exhaustive list of every `feature*` reference inside the vault and lending transactors:

```
lending/LoanBrokerCoverWithdraw.cpp:33   featureCredentials
lending/LoanBrokerSet.cpp:156            featureLendingProtocolV1_1
lending/LoanSet.cpp:319                  featureLendingProtocolV1_1
lending/LoanSet.cpp:75                   featureBatchV1_1
vault/VaultCreate.cpp:276                featureLendingProtocolV1_1
vault/VaultCreate.cpp:41                 featureMPTokensV1
vault/VaultCreate.cpp:44                 featurePermissionedDomains
vault/VaultCreate.cpp:47                 featureLendingProtocolV1_1
vault/VaultDelete.cpp:33                 featureLendingProtocolV1_1
vault/VaultDeposit.cpp:110               featureLendingProtocolV1_1
vault/VaultSet.cpp:23                    featurePermissionedDomains
vault/VaultWithdraw.cpp:37               featureCredentials
vault/VaultWithdraw.cpp:90               featureLendingProtocolV1_1
```
(`grep -rnE 'feature[A-Za-z0-9_]+' src/libxrpl/tx/transactors/{lending,vault}/`)

**Four amendments are wired in: `MPTokensV1`, `PermissionedDomains`, `Credentials`, `BatchV1_1` (defensively only).** `Sponsor`, `PermissionedDEX`, `TokenEscrow`, `DynamicMPT` and `PermissionDelegationV1_1` appear **nowhere** in vault or lending code. Their interaction is therefore whatever the generic machinery does — which is the interesting part, and where §4 lives.

### 2.1 The privilege system — the real cross-amendment contract

`include/xrpl/protocol/TxSettings.h:19-39` defines `Privilege`, a per-transaction bitfield declared in `transactions.macro` and **enforced in the invariant checkers** (`src/libxrpl/tx/invariants/{InvariantCheck,MPTInvariant,VaultInvariant}.cpp`). Vault/loan declarations:

| Tx | Privileges |
|---|---|
| `VaultCreate` | `CreatePseudoAcct \| CreateMptIssuance \| MustModifyVault` |
| `VaultSet` | `MustModifyVault` |
| `VaultDelete` | `MustDeleteAcct \| DestroyMptIssuance \| MustModifyVault` |
| `VaultDeposit` | `MayAuthorizeMpt \| MustModifyVault` |
| `VaultWithdraw` | `MayDeleteMpt \| MayAuthorizeMpt \| MustModifyVault` |
| `VaultClawback` | `MayDeleteMpt \| MustModifyVault` |
| `LoanBrokerSet` | `CreatePseudoAcct \| MayAuthorizeMpt` |
| `LoanBrokerDelete` | `MustDeleteAcct \| MayAuthorizeMpt` |
| `LoanSet` / `LoanPay` | `MayAuthorizeMpt \| MustModifyVault` |

Note what is **absent**: no vault or loan transaction carries `OverrideFreeze`. And `MustModifyVault` means a `LoanSet` or `LoanPay` that does *not* move the vault's numbers trips `tecINVARIANT_FAILED` rather than a friendly error.

---

## 3. Confirmed on chain — the seams, with hashes

All submitted 2026-09-12. Where xrpl.js refused client-side, the transaction was hand-encoded with `ripple-binary-codec` and submitted as a raw blob so the answer is rippled's, not the SDK's.

### 3.1 `Batch` × Vault/Loan — categorically impossible

`include/xrpl/tx/transactors/system/Batch.h:60-75` declares `kDisabledTxTypes` containing **all fifteen** vault and loan transaction types. `src/libxrpl/tx/transactors/system/Batch.cpp:290-295` returns `temINVALID_INNER_BATCH` for any of them.

Verified, **identical on both networks**, each against a passing two-Payment control:

| Batch contents | T1 | T2 |
|---|---|---|
| `[VaultDeposit, Payment]` | `temINVALID_INNER_BATCH` | `temINVALID_INNER_BATCH` |
| `[VaultCreate, Payment]` | `temINVALID_INNER_BATCH` | `temINVALID_INNER_BATCH` |
| `[LoanBrokerSet, Payment]` | `temINVALID_INNER_BATCH` | `temINVALID_INNER_BATCH` |
| `[LoanPay, Payment]` | `temINVALID_INNER_BATCH` | `temINVALID_INNER_BATCH` |
| **control** `[Payment, Payment]` | **`tesSUCCESS`** | **`tesSUCCESS`** |

### 3.2 `PermissionDelegationV1_1` × Vault/Loan — not delegable

`TxSettings::delegable` defaults to `Delegation::NotDelegable` (`include/xrpl/protocol/TxSettings.h:77`) and **no vault or loan transaction overrides it**. There are also zero vault/loan entries in `include/xrpl/protocol/detail/permissions.macro` (13 granular permissions, all trustline/account/payment/MPT).

`DelegateSet` raw-submitted, both networks:

| Permission granted | Result |
|---|---|
| `VaultDeposit` | `temMALFORMED` |
| `LoanSet` | `temMALFORMED` |
| `LoanPay` | `temMALFORMED` |
| **control** `MPTokenAuthorize` | **`tesSUCCESS`** |

**This one is documented** — XLS-0075 README line 375 names all fifteen explicitly. It is not in the rippled error message, not in the SDK, and the error is a bare `temMALFORMED`.

### 3.3 `Sponsor` × Vault/Loan — fee yes, reserve no

`src/libxrpl/ledger/helpers/SponsorHelpers.cpp:28-60` is an **allow-list** of 23 types eligible for `spfSponsorReserve`. No vault or loan type is on it. `Transactor::preflight1Sponsor` (`src/libxrpl/tx/Transactor.cpp:206-216`) returns `temINVALID_FLAG`.

Raw-submitted with `SponsorFlags: 2`, both networks:

| Tx | Result |
|---|---|
| `VaultCreate` | `temINVALID_FLAG` |
| `VaultDeposit` | `temINVALID_FLAG` |
| `LoanBrokerSet` | `temINVALID_FLAG` |

**Fee** sponsorship (`spfSponsorFee`) does work — `src/test/app/Sponsor_test.cpp:5547` `testFeeSponsoredVaultInvariant` covers fee-sponsored `VaultDeposit`/`VaultWithdraw`, and there are two dedicated regression tests at `src/test/app/vault/VaultBugs_test.cpp:1940` and `:2423`.

### 3.4 `PermissionedDEX` / MPT DEX × vault shares — the flag is a lie

`src/libxrpl/tx/transactors/dex/OfferCreate.cpp:69-77`:
```cpp
bool OfferCreate::checkExtraFeatures(PreflightContext const& ctx)
{
    if (ctx.tx.isFieldPresent(sfDomainID) && !ctx.rules.enabled(featurePermissionedDEX))
        return false;
    return ctx.rules.enabled(featureMPTokensV2) ||
        (!ctx.tx[sfTakerPays].holds<MPTIssue>() && !ctx.tx[sfTakerGets].holds<MPTIssue>());
}
```
`MPTokensV2` (XLS-82) is `Supported::No` and enabled on neither network. **No MPT can be placed on any DEX order book, permissioned or not.**

Meanwhile XLS-0065 README line 182 specifies that public vault shares are minted with `lsfMPTCanEscrow | lsfMPTCanTrade | lsfMPTCanTransfer`, and the ledger agrees — share issuance `00000001A7A0E7E4CB850BBE2CC88C4FBD0126210745E1B2` on public Devnet reads `"Flags": 56` = `0x38` = exactly those three bits, `lsfMPTCanTrade` included.

`OfferCreate` against that very issuance: **`temDISABLED`**, both networks.

> **Vault shares carry a tradeable flag that nothing on either hackathon network will accept.** For Recall this kills any design where the buy-back leg trades vault shares — and, more importantly, any design where the *tokenised security itself* is an MPT and is meant to be bought back on the permissioned DEX. **If the security must trade on the permissioned DEX, it has to be an IOU, not an MPT.**

### 3.5 `TokenEscrow` × vault shares — works, and is tested

`src/test/app/vault/VaultShares_test.cpp:235` escrows 500 vault shares and asserts `sfLockedAmount == 500`. The `fixCleanup3_1_3` branch at `:256-274` is a fixed bug where `removeEmptyHolding` deleted an `MPToken` that still had a locked balance. Both networks have `fixCleanup3_1_3` enabled. This combination is *not* virgin territory.

### 3.6 `Credentials` / `PermissionedDomains` × private vault — revocation does not lock anyone out

Full run on public Devnet, private vault `15FBDC8E0F192E55B0557C0988D5B3D9304A069F9237F452A4931143A10B4317`, shares `00000001444F391927912A5054FA69588E1E954107544231`, domain `1678F2C15A95EA1AC82022F79D2486C589FCACDC46B86FF9A0BDA3005CE01C56`:

| Step | Result | Hash |
|---|---|---|
| alice deposits (in domain) | `tesSUCCESS` | `BA2CEBC7010B786A9453058C2A2D94BECC197BCC5390C7C9C53C086E23BBA966` |
| bob deposits (in domain) | `tesSUCCESS` | `FACB573FE63F890529E9AE4D0C5F42462E9D3BBEE95012FEF1163EA7AE0528C3` |
| carol deposits (never in domain) | `tecNO_AUTH` | `4ECADF34413019A5774D11EE73C91B91592AA9B83A8CF5F0F1BE66606A642313` |
| issuer revokes bob's credential | `tesSUCCESS` | `9CB97855F25CC7AD5CCCD853EDACDB7AE1015C043B9650AC4773BC2204BD6D21` |
| bob deposits after revocation | `tecNO_AUTH` | `8F62C27A537B1102286B2D1FEFAFE392D7F99E37ECECB078046535119CE67D96` |
| **bob withdraws after revocation** | **`tesSUCCESS`** | `E46236C4DEEC8F472A7BAB353BE7A144AA92AE8384D6FB40B95760AA14622373` |
| bob withdraws again | `tesSUCCESS` | `910FC7469C2D6BF6D2220D3677747ABA6290D979A5D872B64E486DAAB8EEF092` |
| alice pays shares → revoked bob | `tecNO_AUTH` | `32E48A9E5B91DFD7E6D8937AAADC080755B8C605A17FB4BC50570E51C0DC4388` |
| alice pays shares → carol | `tecNO_AUTH` | `89FA0660927BE39E0702028A21B08B978A4870AC3FBEC4D218201350E70BCCB0` |

**Mechanism, and it is deliberate.** `src/libxrpl/tx/transactors/vault/VaultWithdraw.cpp:226-227`:
```cpp
if (fix340Enabled && vault->isFlag(lsfVaultPrivate) && dstAcct != account &&
    dstAcct != vaultAsset.getIssuer())
```
Withdrawing **to self** skips the domain check entirely. The comment above it says so: *"Withdrawing to self is never restricted: losing vault access must not strand funds already deposited."* `fix340Enabled` is `fixCleanup3_4_0`, enabled on both networks.

XLS-0065 documents this — as **one sentence in the §1 overview** (README line 51: *"To prevent Vault Owner from locking away depositor funds, any shareholder can withdraw funds"*) — and **not** in §3.x `VaultWithdraw`'s failure-conditions table, where an implementer building a compliance control would look.

> For Recall: **credential revocation is not a lockout.** A holder whose eligibility lapses keeps the right to pull the underlying security out. If the story needs a hard stop, it has to be `VaultClawback` or an MPT freeze, not domain removal.

I probed the `requireAuth` escape hatch at `src/libxrpl/ledger/helpers/MPTokenHelpers.cpp:458-465` ("*We ignore error from validDomain if we found sleToken*") as a possible way to push shares to a revoked holder. **It does not open one** — the payment to revoked bob returned `tecNO_AUTH`. Reported here so nobody re-runs it.

### 3.7 `LoanSet` counterparty-signature bypass — closed, defence in depth

`LoanSet::preflight` (`src/libxrpl/tx/transactors/lending/LoanSet.cpp:90`) only demands a `CounterpartySignature` when `tfInnerBatchTxn` is **absent**:
```cpp
if (!tx.isFlag(tfInnerBatchTxn) && !counterPartySig)
    return temBAD_SIGNER;
```
So on its face, setting `tfInnerBatchTxn` on a standalone `LoanSet` would skip the borrower's signature. It does not work, and there are three independent guards:
1. `Transactor.cpp:290` — `isFlag(tfInnerBatchTxn) != parentBatchId.has_value()` → `temINVALID_INNER_BATCH`.
2. `apply.cpp:71` — rejected at local checks: *"Batch inner transactions are never considered validly signed."* (this is what actually fired, both networks).
3. `Batch::kDisabledTxTypes` — `ttLOAN_SET` can never be an inner transaction anyway.

Control: the same `LoanSet` without the flag and without a signature → `temBAD_SIGNER`, as designed.

**Not a vulnerability.** But it means the whole `tfInnerBatchTxn` branch in `LoanSet::preflight` (lines 74-92) is unreachable code guarding a path the Batch disable-list already forecloses.

---

## 4. Ranked — interactions no document and no test appears to cover

Ranking is by *(value to the pitch) × (probability nobody at Ripple has run it)*. Each carries the exact sequence.

### R1 — XLS-66 specifies `LoanSet` inside a `Batch`; rippled forbids it outright ★★★★★

**The spec and the implementation flatly contradict each other.**

XLS-0066 README:
- line 1014 — *"If the `LoanSet` transaction is **not** part of a `Batch` transaction, the total fee calculation… Otherwise, the fee is based on the total number of signatures in the outer transaction. See Batch Fees…"*
- §3.8.5.1 line 1059 — failure condition 2: *"`CounterpartySignature` is not present **and the transaction is not part of a `Batch` inner transaction**. (`temBAD_SIGNER`)"*
- §3.8.5.1 line 1060 — failure condition 3: *"**The transaction is a `Batch` inner transaction** and the `Counterparty` field is not specified. (`temBAD_SIGNER`)"*

rippled implements those two conditions verbatim at `LoanSet.cpp:75-92` — and then makes them unreachable by putting `ttLOAN_SET` in `Batch::kDisabledTxTypes`. XLS-0056 (batch) never mentions vaults or loans at all: `grep -icE 'vault|loan' XLS-0056-batch/README.md` returns 1, and that one hit is the phrase "flash loans" in the motivation section.

**Sequence (run, both networks, `temINVALID_INNER_BATCH`):**
```
1. VaultCreate (closed-ended)                     -> tesSUCCESS
2. Batch{ tfAllOrNothing, RawTransactions: [
     LoanSet{ tfInnerBatchTxn, Counterparty: borrower, no CounterpartySignature },
     Payment{ tfInnerBatchTxn, 1 drop } ] }       -> temINVALID_INNER_BATCH
   control: Batch[Payment, Payment]               -> tesSUCCESS
```

**Proposed fix (this is the PR to open).** Two of them, both cheap:
- *XLS-0066*: strike failure conditions 2 and 3 in §3.8.5.1 and the Batch clause in §3.8.1's fee paragraph, replacing them with: *"`LoanSet` may not appear as a `Batch` inner transaction; `Batch` rejects it with `temINVALID_INNER_BATCH`."*
- *XLS-0056*: add a "Disallowed inner transactions" subsection listing the fifteen vault/loan types, mirroring `Batch::kDisabledTxTypes`, so the list has a normative home outside a C++ header.

### R2 — XLS-68 states a deny-list; rippled implements an allow-list, and every vault/loan tx falls outside it ★★★★★

XLS-0068 §8.3.4 "Transactions that cannot be sponsored" (README lines 517-527) says: *"All transactions (other than pseudo-transactions) may use the `spfSponsorFee` flag… However, **some** transactions will not support the `spfSponsorReserve` flag"* — and then names exactly two: `Batch`, and pseudo-transactions.

rippled does the opposite: `SponsorHelpers.cpp:28-60` is a closed allow-list of 23 transaction types. A reader of XLS-68 would reasonably conclude that `VaultCreate` — which creates a `Vault`, a pseudo-`AccountRoot` **and** an `MPTokenIssuance`, i.e. the single most reserve-hungry transaction in the protocol — is reserve-sponsorable. It is not.

Worse, the failure is a bare `temINVALID_FLAG` with no indication which flag or why.

**Sequence (run, both networks):**
```
VaultCreate  { Asset: XRP, Sponsor: <sp>, SponsorFlags: 2 }   -> temINVALID_FLAG
VaultDeposit { Sponsor: <sp>, SponsorFlags: 2 }               -> temINVALID_FLAG
LoanBrokerSet{ Sponsor: <sp>, SponsorFlags: 2 }               -> temINVALID_FLAG
```

**Proposed fix.** Rewrite XLS-68 §8.3.4 as an allow-list mirroring `isReserveSponsorAllowed`, with a one-line rationale for the vault/loan exclusion ("pseudo-account reserves have no defined sponsorship semantics in v1"). And expose it: add the eligible-type list to the `server_definitions` response per XLS-0097, so an SDK can refuse client-side with a real message instead of the ledger returning `temINVALID_FLAG`.

**Onboarding note worth pitching.** `ttMPTOKEN_AUTHORIZE` **is** on the allow-list. So a lending agent *can* pay the share-token reserve for an incoming LP — by sponsoring a standalone `MPTokenAuthorize` for the vault's `ShareMPTID` before the LP's first `VaultDeposit`. I have not run this; it is the single best reserve-sponsorship story available and is written up as U1 below.

### R3 — Vault shares are minted `lsfMPTCanTrade` on a network with no MPT DEX ★★★★☆

Covered in §3.4 with the on-chain `Flags: 56` and the `temDISABLED`. Nobody has written this down: XLS-0065 §182 promises the flag, XLS-0082 (the amendment that would honour it) is Draft and `Supported::No`, and no test in `src/test/app/vault/` mentions `PermissionedDEX` or `OfferCreate` (`grep -rl PermissionedDEX src/test/app/vault/ src/test/app/lending/` → zero files).

**Sequence (run, both networks):**
```
1. VaultCreate (public, XRP)                                    -> tesSUCCESS
2. ledger_entry mpt_issuance=<ShareMPTID>                       -> "Flags": 56  (CanEscrow|CanTrade|CanTransfer)
3. OfferCreate{ TakerGets:{mpt_issuance_id:<ShareMPTID>}, TakerPays: XRP }
                                                                -> temDISABLED
```

**Proposed fix.** XLS-0065 §3.1.x should carry a note: *"`lsfMPTCanTrade` on vault shares has no effect until XLS-82 (`MPTokensV2`) is enabled; on networks without it, shares are transferable by `Payment` and escrowable, but not placeable on an order book."* Same note belongs on the xrpl.org Single Asset Vault page.

### R4 — `DynamicMPT` against a live vault's **asset** issuance ★★★★☆ (untested by anyone, including me)

Zero coverage in either direction: `grep -rl DynamicMPT src/test/app/vault/ src/test/app/lending/` → nothing; `grep -rl 'Vault\|Loan' src/test/app/MPToken_test.cpp` hits only `VaultCreate`/`VaultClawback` in unrelated cases. XLS-0094 never mentions vaults or loans.

The surface is real and directly aimed at Recall, where the vault's asset **is** the tokenised security and its issuer is a live party. Under `DynamicMPT` that issuer may, mid-loan, call `MPTokenIssuanceSet` to:
- change `TransferFee` (`MPTokenIssuanceSet.cpp:103-107`, capped at `kMaxTransferFee`)
- rewrite `MPTokenMetadata`
- **set `DomainID`** on the asset issuance, retro-gating who may hold it — including the vault pseudo-account and the loan-broker pseudo-account, neither of which can hold a credential
- seal capabilities via `ImmutableFlags`

XLS-0065 §3.1.9 and §A.5 do say the vault waives transfer fees (`WaiveTransferFee::Yes` at `VaultDeposit.cpp:392,420`, `VaultWithdraw.cpp:552`, `LoanBrokerCoverDeposit.cpp:179`, `LoanManage.cpp:283`, `LoanBrokerCoverClawback.cpp:375`), so a fee change should be inert inside the vault — **but nothing says what happens to a `LoanPay` from a borrower who is not the vault.**

The `DomainID` case is the sharp one and nobody has written it down anywhere.

**Sequence to run:**
```
1. MPTokenIssuanceCreate  (tfMPTCanTransfer|tfMPTCanEscrow|tfMPTRequireAuth), issuer = SEC
2. VaultCreate            Asset = that MPT, closed-ended
3. MPTokenAuthorize       lender + borrower + vault pseudo-account as needed
4. VaultDeposit           lender deposits the security
5. LoanBrokerSet + LoanBrokerCoverDeposit + LoanSet (two signatures) -> loan live
6. >>> SEC submits MPTokenIssuanceSet { MPTokenIssuanceID: <asset>, DomainID: <new domain> }
7. LoanPay                borrower repays
8. VaultWithdraw          lender redeems
```
Open questions 6→8 answers: does step 6 even succeed while the issuance is held by pseudo-accounts that can hold no credential? If it does, do 7 and 8 return `tecNO_AUTH`, stranding the loan? Is the `XRPL_ASSERT(sleIssuance->isFlag(lsfMPTRequireAuth))` at `MPTokenHelpers.cpp:451-453` reachable as an assertion failure?

Variant: repeat step 6 with `TransferFee: 5000` instead of `DomainID` and check whether `LoanPay` and `LoanBrokerCoverWithdraw` charge it. Every asset move I could find in the vault and lending transactors passes `WaiveTransferFee::Yes` (`VaultDeposit.cpp:392,420`, `VaultWithdraw.cpp:552`, `VaultClawback.cpp:483,519`, `LoanBrokerCoverDeposit.cpp:179`, `LoanBrokerCoverClawback.cpp:375`, `LoanBrokerDelete.cpp:157`, `LoanManage.cpp:283`), so the expectation is "no fee charged anywhere". `LoanBrokerCoverWithdraw` reaches its transfer through a different helper and passes `WaiveMPTCanTransfer` rather than `WaiveTransferFee` (`LoanBrokerCoverWithdraw.cpp:117`) — a different knob, and the one place worth actually measuring rather than reading.

### R5 — `TokenEscrow` of **closed-ended** vault shares across `RedemptionDate` ★★★☆☆

`VaultShares_test.cpp:235` escrows shares of an **open-ended** vault (no `VaultKind`, no `RedemptionDate` anywhere in that file). `VaultClosedEnded_test.cpp` never mentions escrow. So the combination of *shares locked in an escrow* with *a vault phase transition* is untested.

This matters because of the headline product finding already in our notes: a closed-ended vault can reach Redemption while illiquid. Shares sitting in an escrow whose `FinishAfter` lands after `RedemptionDate` are a second, independent way to be unable to redeem — and `sfLockedAmount` is invisible to `AssetsAvailable`.

**Sequence to run:**
```
1. VaultCreate closed-ended, SubscriptionDate = T+60, RedemptionDate = T+600
2. VaultDeposit (Subscription phase)                       -> tesSUCCESS
3. EscrowCreate of N shares, FinishAfter = RedemptionDate + 60
4. wait past RedemptionDate
5. VaultWithdraw of the escrowed shares                    -> ?  (expect tecINSUFFICIENT_FUNDS / tecLOCKED)
6. EscrowFinish after RedemptionDate                       -> ?  does the destination receive shares in a redeemed vault
7. VaultDelete                                             -> ?  can the owner delete a vault with shares locked in escrow
```
Step 7 is the interesting one: `VaultDelete` carries `MustDeleteAcct | DestroyMptIssuance`, and destroying an `MPTokenIssuance` with a non-zero `sfLockedAmount` outstanding should be impossible. If it is not, that is an invariant hole.

### R6 — `LoanBrokerCoverWithdraw` + `CredentialIDs` — **covered; do not spend time here** ★☆☆☆☆

`LoanBrokerCoverWithdraw.cpp:33` is the only credential reference anywhere in the lending transactors: it accepts `sfCredentialIDs` so a cover withdrawal can satisfy a `DepositAuth`-protected destination.

I initially flagged this as untested. **It is not.** `src/test/app/lending/LoanBroker_test.cpp:2706-2754` covers the happy path, the pre-fix disabled path, an invalid credential index, duplicated indices, and a non-matching credential. Recorded here so the team does not re-derive it.

The one thing still missing is documentation: XLS-0066 never mentions `DepositAuth` or `CredentialIDs` on `LoanBrokerCoverWithdraw` at all, so the field exists in the binary format and the tests with no normative description. That is a docs fix, not an experiment.

### R7 — `PermissionedDEX` as the buy-back leg, with an **IOU** security ★★★☆☆

Given R3, Recall's buy-back must use an IOU. Nothing tests a permissioned-domain offer whose counterparty is a **pseudo-account** (the loan broker), and pseudo-accounts cannot hold credentials — `Sponsor_test.cpp:365` shows the ledger returns `tecPSEUDO_ACCOUNT` when a pseudo-account is named as a sponsee, which is the same class of restriction.

**Sequence to run:**
```
1. Credentials + PermissionedDomainSet D
2. IOU security issued by SEC; both market-maker and lending agent in D
3. VaultCreate closed-ended, Asset = the IOU, DomainID = D
4. full spine to a defaulted loan, LoanManage -> default
5. OfferCreate { DomainID: D, TakerGets: <IOU>, TakerPays: XRP } submitted by the LENDING AGENT
6. OfferCreate { DomainID: D, ... } submitted by the LOAN BROKER pseudo-account  -> impossible, no key
```
Step 6 is the design constraint to state out loud in the pitch: **a loan-broker pseudo-account can never place an order.** Every buy-back has to be routed through the agent's own account, which is a real architectural fact about XLS-66 that no document states.

### R8 — Reserve accounting when a vault pseudo-account's owner hits the reserve ceiling ★★☆☆☆

`VaultCreate` autofills a fee of one owner-reserve increment (2 XRP on T1, 0.2 XRP on T2) and creates three reserve-bearing objects. `Sponsor` cannot help (R2). No test covers a `VaultDeposit` that fails purely because the depositor cannot afford the `MPToken` reserve for the shares while `MayAuthorizeMpt` is set. Low value, easy to hit in a live demo.

---

## 5. DevEx friction, with the exact spot and the fix

| # | Where | What | Proposed fix |
|---|---|---|---|
| A-1 | XLS-0066 README §3.8.1 line 1014, §3.8.5.1 lines 1059-1060 | Spec normatively describes `LoanSet` as a `Batch` inner transaction; `Batch::kDisabledTxTypes` (`Batch.h:60-75`) makes it impossible. Verified `temINVALID_INNER_BATCH` on both networks. | Delete the three Batch clauses from XLS-66; add a "Disallowed inner transactions" section to XLS-0056 listing the 15 vault/loan types. |
| A-2 | XLS-0068 README §8.3.4 lines 517-527 | Spec frames reserve sponsorship as a deny-list naming only `Batch` + pseudo-transactions. rippled uses a 23-entry **allow-list** (`SponsorHelpers.cpp:28-60`) that excludes every vault and loan type. Failure is an unexplained `temINVALID_FLAG`. | Rewrite §8.3.4 as the allow-list; publish it via `server_definitions` (XLS-0097) so SDKs can fail client-side with a real message. |
| A-3 | `feature` RPC, both nodes | Retired amendments report `enabled: false`, indistinguishable from "not activated". `Escrow` reads `false` on both networks yet `EscrowCreate` returns `tesSUCCESS` (`C960AF10D264215B05DC922D33E3DE7D8E28DFEFB0E563CC79C9B190B8F0768E`). `TicketBatch` reads `false` on T1, `true` on T2, for the same reason. | Add `"retired": true` to the `feature` response for `XRPL_RETIRE_FEATURE`/`XRPL_RETIRE_FIX` entries, or omit them. One-line change in the handler; prevents every new team from concluding escrow is unavailable. |
| A-4 | `Batch.cpp:231-235` | A `Batch` with exactly **one** inner transaction returns `temARRAY_EMPTY` — "Malformed: Array is empty" — when the array is not empty. The log line says "txns array must have at least 2 entries", the error code does not. Cost ~20 minutes to diagnose. | Return `temARRAY_TOO_SMALL` (or reuse `temMALFORMED`) and make the message say "Batch requires at least 2 inner transactions". |
| A-5 | xrpl.js 5.2.0-beta.0 client validation | `VaultCreate` with `SponsorFlags: 2` is rejected client-side with *"VaultCreate cannot use spfSponsorReserve flag (does not create ledger objects)"*. The parenthetical is **factually wrong** — `VaultCreate` creates a `Vault`, a pseudo-`AccountRoot` and an `MPTokenIssuance`. The correct reason is that it is not on rippled's reserve-sponsorship allow-list. | Change the message to "…is not eligible for reserve sponsorship (see XLS-68 §8.3.4)". Drop the false claim. |
| A-6 | `DelegateSet`, both networks | Granting a vault/loan permission returns a bare `temMALFORMED` with no hint that the type is categorically non-delegable. The list exists only in XLS-0075 line 375. | Emit a distinct error (`temDISABLED`, or a JLOG naming the type), and surface the non-delegable set in `server_definitions`. |
| A-7 | XLS-0065 README | The rule that a private-vault shareholder may always withdraw **to self** regardless of domain membership — the reason credential revocation is not a lockout — appears only in §1 prose (line 51) and a rippled code comment (`VaultWithdraw.cpp:221-225`). It is absent from §3.x `VaultWithdraw` failure conditions. | Add it to the `VaultWithdraw` section as an explicit exemption, alongside the asset-issuer exemption which is equally undocumented. |
| A-8 | XLS-0065 README §182 | Vault shares are specified and minted with `lsfMPTCanTrade` (on-chain `Flags: 56`), but MPT order books require XLS-82 / `MPTokensV2`, which is `Supported::No`. `OfferCreate` → `temDISABLED`. | Note in XLS-0065 that `lsfMPTCanTrade` is inert until XLS-82 activates. Mirror on the xrpl.org vault page. |

---

## 6. What this means for Recall — four hard constraints

1. **The buy-back leg cannot use an MPT.** No MPT trades on any order book on either network (§3.4). If the tokenised security is an MPT, the permissioned-DEX buy-back does not exist. Either make the security an IOU, or drop the DEX leg and settle the buy-back bilaterally.
2. **No atomicity anywhere.** Every multi-step move — post cover *and* open the loan, declare default *and* draw cover *and* place the buy-back — is a sequence of independent transactions. `Batch` refuses all fifteen vault/loan types (§3.1). The tri-party choreography must be presented as "signed off-ledger, submitted in order", never as atomic.
3. **The agent cannot delegate.** `PermissionDelegationV1_1` is enabled and useless here: no vault or loan transaction is delegable (§3.2). A tri-party operator account cannot be granted narrow rights over the vault; it needs the owner's key, or a `SignerList` on the owner account. That is the honest architecture.
4. **Revoking eligibility does not freeze a position.** A holder whose credential is deleted can still withdraw to self (§3.6, two `tesSUCCESS` hashes). Concentration and eligibility limits have to be enforced at `LoanSet` counter-signature time by the agent, because the ledger will not enforce them afterwards.

The upside: each of these is a *finding*, and the brief pays 40% for findings with a proposed fix. R1 and R2 are both one-paragraph PRs against XRPL-Standards and both are backed by transactions on the judges' own network.
