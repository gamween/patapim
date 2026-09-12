# XLS-66 Lending Protocol — exhaustive build notes

Research slug: `xls66-spec`. Compiled 2026-09-12 for the XRPL Lending Protocol Hackathon (patapim).

**Primary sources used**

| What | URL / path |
|---|---|
| Spec markdown (master, 2696 lines, `updated: 2026-09-09`) | https://raw.githubusercontent.com/XRPLF/XRPL-Standards/master/XLS-0066-lending-protocol/README.md |
| Rendered spec | https://xls.xrpl.org/xls/XLS-0066-lending-protocol |
| XLS-66.2 patch (impairment timing, merged 2026-09-11) | https://raw.githubusercontent.com/XRPLF/XRPL-Standards/master/XLS-0066-lending-protocol/66.2/README.md |
| rippled implementation (clone of `develop` @ `94037361992ad75b32a6b2659b655ab96b7cb7c2`, 2026-09-10) | https://github.com/XRPLF/rippled |
| Track 1 custom devnet (`rippled 3.4.0-rc1`, network_id 4001) | https://lending-hackathon.dev.ripplex.io:51234 |
| Track 2 public devnet (`rippled 3.4.0-rc5`, network_id 2) | https://s.devnet.rippletest.net:51234/ |
| xrpl.js 5.2.0 / 5.2.0-beta.0 | npm |

All "live ledger" claims below were produced by `curl`-ing `server_info`, `server_definitions`, `feature`,
`ledger_entry`, `ledger_data`, `account_objects`, `vault_info` against those two endpoints on 2026-09-12.

---

## 0. Ground-truth corrections to the event brief (READ FIRST)

### 0.1 `LoanPay` TransactionType is **84**, not 83

The spec §3.11.1 and the rendered page both say `TransactionType` default value `83`.
The running ledgers say **84**, and **83 is unassigned** on both networks.

```
# server_definitions -> TRANSACTION_TYPES (identical on both endpoints)
LoanBrokerSet 74, LoanBrokerDelete 75, LoanBrokerCoverDeposit 76,
LoanBrokerCoverWithdraw 77, LoanBrokerCoverClawback 78,
LoanSet 80, LoanDelete 81, LoanManage 82, (83 = unassigned), LoanPay 84
```

Impact: only matters if you hand-build binary; xrpl.js uses the string name, so it is safe.
But it is a real, citable spec-vs-implementation defect.

### 0.2 Both hackathon networks have `LendingProtocolV1_1` AND `fixCleanup3_4_0` ENABLED

`feature` on both endpoints returns `enabled: true` for, among others:
`LendingProtocol`, `LendingProtocolV1_1`, `SingleAssetVault`, `fixCleanup3_1_3`, `fixCleanup3_2_0`,
`fixCleanup3_3_0`, `fixCleanup3_4_0`, `BatchV1_1`, `Credentials`, `PermissionedDomains`,
`PermissionDelegationV1_1`, `TokenEscrow`, `fixTokenEscrowV1`, `MPTokensV1`, `DynamicMPT`,
`PermissionedDEX`, `Sponsor`, `fixMPTDeliveredAmount`.
Amendment id for `LendingProtocolV1_1` is `A360E2BF…` on both.
Only `fixCleanup3_5_0` is disabled on Track 1 (and `TicketBatch`, which Track 1's fresh net never enabled).

Consequences:

1. **Every vault created now is cash-basis on BOTH tracks.** `VaultCreate::doApply` sets
   `sfLEVersion = VaultVersion::CashBasis` unconditionally when `featureLendingProtocolV1_1` is on
   (`src/libxrpl/tx/transactors/vault/VaultCreate.cpp:276-278`). Verified live: the existing Track-1
   vault `4E75909E…DE50` returns `"LEVersion": 1` from `vault_info`, with
   `AssetsTotal 300000000 == AssetsAvailable 200000000 + DebtTotal 100000000` — i.e. interest was NOT
   credited into `AssetsTotal` at origination. Accrual (whole-life) accounting is unreachable here.
2. **`fixCleanup3_4_0` changes the LoanSet counterparty signing bytes** (see §5). Any SDK older than
   xrpl.js 5.2.0-beta.0 / ripple-binary-codec 2.11.0-beta.1 signs the wrong prefix and fails.
3. **`fixCleanup3_4_0` changes impairment and lateness semantics** (see §8/§9): impair only when
   already late, no `NextPaymentDueDate` rewriting, and all boundaries are *exclusive*.

### 0.3 No `LoanAccept` transaction exists

XRPL-Standards PR #570 (`XLS-65/66: Add LendingProtocolV1_1 two-step loan creation`, open, draft=false,
head `daa770c066d3`) proposes `LoanAccept` + `Borrower`/`StartDate` on `LoanSet` + `lsfLoanPending` +
`Vault.AssetsReserved`. **None of it is in 3.4.0.** `server_definitions` has no `LoanAccept`, no
`AssetsReserved`, no `lsfLoanPending`. Build against the dual-signature `CounterpartySignature` flow.

### 0.4 `tfVaultDonation` could not be verified anywhere

Not in `server_definitions.TRANSACTION_FLAGS` (which lists flags only for
`AMMClawback, AMMDeposit, AMMWithdraw, AccountSet, Batch, EnableAmendment, LoanManage, LoanPay, LoanSet,
MPTokenAuthorize, MPTokenIssuanceCreate, MPTokenIssuanceSet, NFTokenCreateOffer, NFTokenMint, OfferCreate,
Payment, PaymentChannelClaim, SponsorshipSet, SponsorshipTransfer, TrustSet, VaultCreate,
XChainModifyBridge, universal`), not in rippled `develop` (`grep -rn Donation` in TxFlags.h and
`src/libxrpl/tx/transactors/vault/` returns nothing), not in XLS-65 master, not in the closed-ended
vault draft (PR #587 branch `a1q123456/term-vault`). Treat as **does not exist** until proven.

---

## 1. Architecture in one paragraph

A `Vault` (XLS-65) holds pooled lender capital and issues MPT shares. A `LoanBroker` (XLS-66) sits
between the Vault and the borrowers: it is owned by the *same account as the Vault owner*, has its own
pseudo-account holding First-Loss Capital, and tracks `DebtTotal` owed back to the Vault. A `Loan` is the
bilateral agreement; it is owned (reserve-wise) by the Borrower and also directory-linked to the
LoanBroker pseudo-account. Principal flows Vault-pseudo → Borrower at `LoanSet`; repayments flow
Borrower → Vault-pseudo (+ fees to broker owner or broker pseudo) at `LoanPay`.

---

## 2. Ledger entries

### 2.1 `LoanBroker` (`LedgerEntryType` 0x0088 = 136, RPC type `loan_broker`)

ID = `SHA512-Half(0x006C ('l') || Owner AccountID || Sequence-or-TicketSequence)`
(`LedgerNameSpace::LoanBroker = 'l'`, `src/libxrpl/protocol/Indexes.cpp:104,588-591`).

Live `LEDGER_ENTRY_FORMATS.LoanBroker` (optionality 0=required, 1=optional, 2=default):

| Field | Type | Opt | Notes |
|---|---|---|---|
| `PreviousTxnID` | Hash256 | 0 | |
| `PreviousTxnLgrSeq` | UInt32 | 0 | |
| `Sequence` | UInt32 | 0 | tx sequence that created it |
| `OwnerNode` | UInt64 | 0 | page in the Owner's directory |
| `VaultNode` | UInt64 | 0 | page in the **Vault pseudo-account's** directory |
| `VaultID` | Hash256 | 0 | |
| `Account` | AccountID | 0 | the LoanBroker **pseudo-account** (holds first-loss capital) |
| `Owner` | AccountID | 0 | the human broker account |
| `LoanSequence` | UInt32 | 0 | monotonically increasing; seeds `LoanID`; starts at 1 |
| `Data` | Blob | 2 | ≤ 256 bytes |
| `ManagementFeeRate` | UInt16 | 2 | 1/10 bps, 0..10000 (= 0..**10%**) |
| `OwnerCount` | UInt32 | 2 | number of **active** Loans |
| `DebtTotal` | Number | 2 | owed to the Vault |
| `DebtMaximum` | Number | 2 | 0 = unlimited |
| `CoverAvailable` | Number | 2 | first-loss capital |
| `CoverRateMinimum` | UInt32 | 2 | 1/10 bps, 0..100000 (0..100%) |
| `CoverRateLiquidation` | UInt32 | 2 | 1/10 bps, 0..100000 |

Reserve: **2 owner reserves** (object + pseudo-account). Account-deletion blocker: yes.

Real live object (Track 1, `ledger_entry` by index `03C19904CC4E7D7FF4B40A5DE8A41A408143AB06F7525A367ABF0A78824A212B`):

```json
{
  "Account": "rKKAqaWQSmjzXRjZL6aCGHEvhyFsHpYh5B",
  "CoverAvailable": "50000000", "CoverRateLiquidation": 5000, "CoverRateMinimum": 10000,
  "Data": "43592D4841434B2062726F6B6572",
  "DebtMaximum": "1000000000", "DebtTotal": "100000000",
  "Flags": 0, "LedgerEntryType": "LoanBroker", "LoanSequence": 2,
  "ManagementFeeRate": 2000,
  "Owner": "rPx8KDHN3KdEnexVTFJijr8RH26oQhxTWm", "OwnerCount": 1,
  "OwnerNode": "0", "VaultNode": "0",
  "VaultID": "4E75909E40B05E55C2BD12C663147ECC5FD9CDF3AEB0DC23BA6A73FC87CADE50",
  "Sequence": 63964
}
```

### 2.2 `Loan` (`LedgerEntryType` 0x0089 = 137, RPC type `loan`)

ID = `SHA512-Half(0x004C ('L') || LoanBrokerID || LoanBroker.LoanSequence)`
(`LedgerNameSpace::Loan = 'L'`, `Indexes.cpp:105,594-597`). Note the sequence used is the **broker's
`LoanSequence` at the time of creation**, which `LoanSet` then increments.

Live `LEDGER_ENTRY_FORMATS.Loan`:

`PreviousTxnID(0)`, `PreviousTxnLgrSeq(0)`, `OwnerNode(0)`, `LoanBrokerNode(0)`, `LoanBrokerID(0)`,
`LoanSequence(0)`, `Borrower(0)`, `LoanOriginationFee(2)`, `LoanServiceFee(2)`, `LatePaymentFee(2)`,
`ClosePaymentFee(2)`, `OverpaymentFee(2)`, `InterestRate(2)`, `LateInterestRate(2)`,
`CloseInterestRate(2)`, `OverpaymentInterestRate(2)`, `StartDate(0)`, `PaymentInterval(0)`,
`GracePeriod(2)`, `PreviousPaymentDueDate(2)`, `NextPaymentDueDate(2)`, `PaymentRemaining(2)`,
`PeriodicPayment(0)`, `PrincipalOutstanding(2)`, `TotalValueOutstanding(2)`,
`ManagementFeeOutstanding(2)`, `LoanScale(2)`.

Semantics (spec §3.2.2):
- `TotalValueOutstanding` = remaining principal + all scheduled interest + management fee on that interest.
  Rounded **UP** to asset scale.
- `PrincipalOutstanding`, `ManagementFeeOutstanding` rounded **HALF_EVEN**.
- `TotalInterestOutstanding` is **derived, not stored**:
  `TotalValueOutstanding − PrincipalOutstanding − ManagementFeeOutstanding`.
- `PeriodicPayment` is stored at full precision; the borrower must pay it **rounded UP** to the asset scale.
- `LoanScale` (Int32) is the common rounding exponent, derived from the total loan value at creation:
  `loanScale = max(vaultAssetsTotalScale, STAmount{asset, periodicPayment*paymentsRemaining}.exponent())`
  (`LendingHelpers.cpp:2181-2207`).
- **The stored fields are authoritative. Do not recompute them from the closed-form formulas** (spec
  §3.2.9 "Important", and A-3.1 "Important Note").

Reserve: 1 owner reserve, charged to the **Borrower**. Account-deletion blocker for the Borrower: yes.

Flags (`LEDGER_ENTRY_FLAGS.Loan` live, matches spec §3.2.3):

| Flag | Value |
|---|---|
| `lsfLoanDefault` | `0x00010000` (65536) |
| `lsfLoanImpaired` | `0x00020000` (131072) |
| `lsfLoanOverpayment` | `0x00040000` (262144) |

---

## 3. Transaction inventory (live `TRANSACTION_FORMATS`)

```
LoanBrokerSet            74  VaultID(req) LoanBrokerID(opt) Data(opt) ManagementFeeRate(opt)
                             DebtMaximum(opt) CoverRateMinimum(opt) CoverRateLiquidation(opt)
LoanBrokerDelete         75  LoanBrokerID(req)
LoanBrokerCoverDeposit   76  LoanBrokerID(req) Amount(req)
LoanBrokerCoverWithdraw  77  LoanBrokerID(req) Amount(req) Destination(opt) DestinationTag(opt)
                             CredentialIDs(opt)          <-- NOT IN THE SPEC
LoanBrokerCoverClawback  78  LoanBrokerID(opt) Amount(opt)
LoanSet                  80  LoanBrokerID(req) Data(opt) Counterparty(opt) CounterpartySignature(opt)
                             LoanOriginationFee(opt) LoanServiceFee(opt) LatePaymentFee(opt)
                             ClosePaymentFee(opt) OverpaymentFee(opt) InterestRate(opt)
                             LateInterestRate(opt) CloseInterestRate(opt) OverpaymentInterestRate(opt)
                             PrincipalRequested(req) PaymentTotal(opt) PaymentInterval(opt) GracePeriod(opt)
LoanDelete               81  LoanID(req)
LoanManage               82  LoanID(req)                  (+ common Flags)
LoanPay                  84  LoanID(req) Amount(req)      (+ common Flags)   <-- spec says 83
```

Transaction flags, live (`TRANSACTION_FLAGS`), all match the spec:

```
LoanSet    : tfLoanOverpayment 0x00010000
LoanManage : tfLoanDefault 0x00010000, tfLoanImpair 0x00020000, tfLoanUnimpair 0x00040000
LoanPay    : tfLoanOverpayment 0x00010000, tfLoanFullPayment 0x00020000, tfLoanLatePayment 0x00040000
```
All three sets are **mutually exclusive** within their transaction (`std::popcount(flagsSet) > 1` →
`temINVALID_FLAG`, `LoanPay.cpp:89-98`).

### Protocol constants (`include/xrpl/protocol/Protocol.h`, `include/xrpl/tx/transactors/lending/LoanSet.h`)

| Constant | Value | Meaning |
|---|---|---|
| `kMaxManagementFeeRate` | 10000 tenth-bips = **10%** | `LoanBrokerSet.ManagementFeeRate` cap |
| `kMaxCoverRate` | 100000 = 100% | `CoverRateMinimum`, `CoverRateLiquidation` cap |
| `kMaxInterestRate`, `kMaxLateInterestRate`, `kMaxCloseInterestRate`, `kMaxOverpaymentInterestRate`, `kMaxOverpaymentFee` | 100000 = 100% | all per-loan rates |
| `kMinPaymentInterval` | **60 s** | |
| `kDefaultPaymentInterval` | 60 s | |
| `kDefaultGracePeriod` | **60 s** (also the *minimum*) | `GracePeriod ∈ [60, PaymentInterval]` |
| `kDefaultPaymentTotal` | 1 | |
| `kMaxDataPayloadLength` | 256 bytes | |
| `kLoanPaymentsPerFeeIncrement` | **5** | LoanPay fee: 1 base fee per 5 estimated payments |
| `kLoanMaximumPaymentsPerTransaction` | **100** | max payments settled by one LoanPay |
| `kLoanRedemptionBuffer` | **60 s** | closed-ended: last payment must be ≥ 60 s before `RedemptionDate` |
| `kMinInvestmentPeriod` | **180 s** | closed-ended: `RedemptionDate − SubscriptionDate ≥ 180` |
| `kMaxInvestmentPeriod` | 946708560 s (30 Gregorian years) | |
| `secondsPerYear` | 31 536 000 (365×24×3600) | used for all rate conversions |

---

## 4. `LoanBrokerSet` (74)

Creates when `LoanBrokerID` is absent, modifies when present. Only `Data` and `DebtMaximum` are mutable;
`ManagementFeeRate`, `CoverRateMinimum`, `CoverRateLiquidation` are **fixed at creation**.

```json
{
  "TransactionType": "LoanBrokerSet",
  "Account": "rBrokerOwner...",
  "VaultID": "4AF1...F54",
  "Data": "48656C6C6F",
  "ManagementFeeRate": 2000,
  "DebtMaximum": "1000000000",
  "CoverRateMinimum": 10000,
  "CoverRateLiquidation": 5000,
  "Fee": "10",
  "Sequence": 3964022
}
```
`ManagementFeeRate: 2000` = 2000/100000 = **2% of interest**. `CoverRateMinimum: 10000` = **10% of DebtTotal**.
`CoverRateLiquidation: 5000` = **5% of the minimum cover** gets liquidated per default.

**Data verification (`temINVALID` unless noted)** — spec §3.3.3.1:
1. `VaultID` zero. 2. `Data` present, non-empty and > 256 bytes. 3. `ManagementFeeRate` ∉ [0,10000].
4. `CoverRateMinimum` ∉ [0,100000]. 5. `CoverRateLiquidation` ∉ [0,100000]. 6. `DebtMaximum` negative
or too large. 7. **Exactly one of `CoverRateMinimum`/`CoverRateLiquidation` is zero** (both-or-neither).
8. `LoanBrokerID` present and zero. 9. `LoanBrokerID` present and the tx tries to change a fixed field.

**Protocol-level**, create path: `tecNO_ENTRY` (no Vault), `tecNO_PERMISSION` (submitter ≠ `Vault.Owner`;
also if the asset holding cannot be added), `tecFROZEN`/`tecLOCKED` (Vault pseudo-account frozen),
`tecINSUFFICIENT_RESERVE` (needs 2 reserves).
Modify path: `tecNO_ENTRY`, `tecNO_PERMISSION` (submitter ≠ `LoanBroker.Owner`; or `VaultID` mismatch),
`tecLIMIT_EXCEEDED` (`DebtMaximum` reduced below current `DebtTotal`, `LoanBrokerSet.cpp:143`).
Both: `tecPRECISION_LOSS` (a Number field cannot be represented in the asset, `LoanBrokerSet.cpp:181`).

State changes on create: insert `LoanBroker`; create the pseudo-account `AccountRoot` with
`AccountRoot.LoanBrokerID` set; create `RippleState`/`MPToken` for the pseudo-account; link into the
submitter's directory (`OwnerNode`) and the Vault pseudo-account's directory (`VaultNode`);
`OwnerCount += 2`.

---

## 5. `LoanSet` (80) — the dual-signature mechanism (the hard part)

### 5.1 It is NOT XRPL multisign. It is a second, role-scoped signature slot.

`CounterpartySignature` is an **inner STObject** at field code `sfCounterpartySignature`
(`UNTYPED_SFIELD(sfCounterpartySignature, OBJECT, 37, SField::kSmdDefault, SField::kNotSigning)`,
`include/xrpl/protocol/detail/sfields.macro:422`). Live definitions confirm
`{"type":"STObject","nth":37,"isSigningField":false,"isSerialized":true}` — it is serialized into the tx
but **excluded from every signing blob**.

Inner fields (`InnerObjectFormats.cpp:156`, spec §3.8.1.1):

| Field | Type | Notes |
|---|---|---|
| `SigningPubKey` | Blob | single-sign path |
| `TxnSignature` | Blob | single-sign path |
| `Signers` | STArray | multi-sign path (same `Signer{Account,SigningPubKey,TxnSignature}` shape) |

Exactly one of {`SigningPubKey`+`TxnSignature`} or {`Signers`, optionally empty `SigningPubKey`}.

### 5.2 The exact bytes that are signed (with `fixCleanup3_4_0` ON — i.e. both hackathon nets)

`src/libxrpl/protocol/Sign.cpp:53-72` + `src/libxrpl/protocol/STTx.cpp:171-176, 249-267, 463-468`:

```
signingBlob(role, multiSigning) = 4-byte HashPrefix || tx.addWithoutSigningFields()
                                   [ || signerAccountID   for the multi-sign variant ]
```

Hash prefixes (`include/xrpl/protocol/HashPrefix.h`, `makeHashPrefix(a,b,c) = a<<24 | b<<16 | c<<8`):

| Role | Single | Multi |
|---|---|---|
| Transaction (the `Account`) | `TxSign` `'S','T','X'` = **0x53545800** | `TxMultiSign` `'S','M','T'` = **0x534D5400** |
| **Counterparty** | `CounterpartyTxSign` `'C','P','T'` = **0x43505400** | `CounterpartyTxMultiSign` `'C','P','M'` = **0x43504D00** |
| Sponsor | `SponsorTxSign` `'S','P','N'` = 0x53504E00 | `SponsorTxMultiSign` `'S','P','M'` = 0x53504D00 |

Before `fixCleanup3_4_0` every role used the plain `TxSign`/`TxMultiSign` prefix, so a signature could be
moved between roles — that is exactly what the fix closes. **On both hackathon networks the fix is ON, so
the counterparty MUST use `0x43505400` / `0x43504D00`.**

`addWithoutSigningFields` emits every field whose `isSigningField` is true. Critically, `SigningPubKey`
**is** a signing field and `TxnSignature`/`Signers`/`CounterpartySignature` are **not**. Therefore:

> **The initiator must sign first.** The counterparty signs a blob that contains the initiator's
> `SigningPubKey` (empty string if the initiator multisigned). Any later change to `Account`, `Fee`,
> `Sequence`, `LastLedgerSequence`, `SigningPubKey` or any loan term invalidates the counterparty signature.

`Transactor::checkSign` then resolves who the counterparty *is*
(`src/libxrpl/tx/transactors/lending/LoanSet.cpp:153-181`):

```cpp
counterSigner = tx[~sfCounterparty]                       // if present
              : view.read(keylet::loanBroker(tx[sfLoanBrokerID]))->at(sfOwner);  // else the broker owner
if (!counterSigner) return temBAD_SIGNER;
// then normal key-authorisation rules (master key / RegularKey / SignerList quorum) for that account
```
and `preclaim` derives the Borrower:
```cpp
counterparty = tx[~sfCounterparty].value_or(brokerOwner);
if (account != brokerOwner && counterparty != brokerOwner) return tecNO_PERMISSION;
borrower = (counterparty == brokerOwner) ? account : counterparty;
```
So **one of `Account` / `Counterparty` must be `LoanBroker.Owner`; the other one is the Borrower.**

### 5.3 Concrete construction steps

**Flow A — Borrower initiates** (spec §3.8.3):
1. Borrower builds the tx with `Account = borrower`, agreed terms, and optionally
   `Counterparty = LoanBroker.Owner` (omitting it means "the broker owner"). Autofill `Fee`,
   `Sequence`, `LastLedgerSequence`.
2. Borrower signs normally → sets `SigningPubKey` + `TxnSignature` (prefix 0x53545800).
3. Sends the blob/JSON to the broker.
4. Broker verifies terms **and** the borrower's signature.
5. Broker signs with the counterparty prefix and fills `CounterpartySignature`.
6. Broker submits.

**Flow B — Broker initiates**: identical but `Account = LoanBroker.Owner`, `Counterparty = borrower`
(**required** in this direction), and the Borrower produces `CounterpartySignature` and submits.

With xrpl.js 5.2.0 (or 5.2.0-beta.0), both halves exist:

```js
import { Client, Wallet, signLoanSetByCounterparty, combineLoanSetCounterpartySigners } from 'xrpl'

// party 1 (initiator)
const prepared = await client.autofill(loanSetTx)     // fills Fee with the extra counterparty base fee
const first = borrower.sign(prepared)                 // -> { tx_blob, hash }

// party 2 (counterparty) — single sign
const { tx_blob } = signLoanSetByCounterparty(brokerWallet, first.tx_blob)
await client.submitAndWait(tx_blob)

// party 2 — multisign variant
const a = signLoanSetByCounterparty(w1, first.tx_blob, { multisign: true })
const b = signLoanSetByCounterparty(w2, first.tx_blob, { multisign: true })
const { tx_blob: combined } = combineLoanSetCounterpartySigners([a.tx_blob, b.tx_blob])
```
`signLoanSetByCounterparty` throws if `TxnSignature`/`SigningPubKey` are missing (initiator must sign
first) or if `CounterpartySignature` already exists. Under the hood it calls
`encodeForSigningCounterparty` / `encodeForMultisigningCounterparty` from ripple-binary-codec ≥ 2.11.0,
which use `HashPrefix.counterpartyTransactionSig = 0x43505400` /
`counterpartyTransactionMultiSig = 0x43504D00`.

### 5.4 Fee

`LoanSet::calculateBaseFee` (`LoanSet.cpp:184-208`):
```
fee = Transactor::calculateBaseFee(view, tx)  +  signerCount * baseFee
signerCount = CounterpartySignature.Signers.size()  if Signers present
            : CounterpartySignature.TxnSignature present ? 1 : 0
```
So outside a Batch the minimum is **2 × base fee** (1 for the account signature + 1 for the
counterparty), and more if either side multisigns. `client.autofill()` handles this — it calls
`fetchCounterPartySignersCount` and prints a `console.warn` every time (noise; see friction).

### 5.5 Batch alternative (no CounterpartySignature)

If `tfInnerBatchTxn` is set and `BatchV1_1` is enabled (it is, on both nets), `LoanSet` may omit
`CounterpartySignature` entirely — but then `Counterparty` becomes **required** (`temBAD_SIGNER` if
missing, `LoanSet.cpp:73-79`). Consent then comes from the outer `Batch`'s `BatchSigners`, inner `Fee`
must be `"0"`, and fee sponsorship on inner txs is rejected (`Batch.cpp:337-340`).
`LoanSet::preflight` also **rejects reserve sponsorship** outright: `if (tx.isFieldPresent(sfSponsorFlags)
&& isReserveSponsored(tx)) return temINVALID_FLAG;` (`LoanSet.cpp:67-71`) — you cannot sponsor the
Borrower's loan reserve via XLS-68 on this transaction.

### 5.6 `LoanSet` failure conditions

**Data verification** (spec §3.8.5.1, matches `LoanSet::preflight`):
1. `LoanBrokerID` zero → `temINVALID`.
2. `CounterpartySignature` absent and not a Batch inner tx → `temBAD_SIGNER`.
3. Batch inner tx and `Counterparty` absent → `temBAD_SIGNER`.
4. Invalid signing key inside `CounterpartySignature` → `temBAD_SIGNER`.
5. `Data` non-empty and > 256 bytes → `temINVALID`.
6. `LoanServiceFee` / `LatePaymentFee` / `ClosePaymentFee` negative → `temINVALID`.
7. `PrincipalRequested <= 0` → `temINVALID`.
8. `LoanOriginationFee` negative or > `PrincipalRequested` → `temINVALID`.
9-13. `InterestRate`, `OverpaymentFee`, `LateInterestRate`, `CloseInterestRate`,
   `OverpaymentInterestRate` above 100000 → `temINVALID`.
14. `PaymentTotal <= 0` → `temINVALID`.
15. `PaymentInterval < 60` → `temINVALID`.
16. `GracePeriod < 60` **or** `GracePeriod > PaymentInterval` → `temINVALID`.

**Protocol-level** (spec §3.8.5.2, cross-checked against `preclaim`/`doApply`):
1. No `Counterparty` and `CounterpartySignature` is not from `LoanBroker.Owner` → `temBAD_SIGNER`.
2. Schedule overflow — `StartDate + PaymentInterval*PaymentTotal + GracePeriod` must fit in uint32
   (`kMaxTime = 4294967295`), checked as four separate guards → `tecKILLED` (`LoanSet.cpp:236-278`).
3. No `LoanBroker` → `tecNO_ENTRY`.
4. Neither `Account` nor `Counterparty` is `LoanBroker.Owner` → `tecNO_PERMISSION`.
5. Borrower `AccountRoot` missing → `terNO_ACCOUNT`.
6. **(accrual vaults only)** `Vault.AssetsMaximum != 0 && AssetsTotal >= AssetsMaximum` →
   `tecLIMIT_EXCEEDED`. **Skipped for cash-basis vaults** (`LoanSet.cpp:339-347`) — so on the hackathon
   nets this gate is off.
7. Value fields not representable in the asset → `tecPRECISION_LOSS` (twice: preclaim on the raw asset,
   and doApply once `loanScale` is known).
8. Cannot add asset holding → `tecNO_PERMISSION` (issuer-level: DefaultRipple for IOU, `lsfMPTCanTransfer` for MPT).
9. Vault pseudo-account frozen → `tecFROZEN` / `tecLOCKED`.
10. Broker pseudo-account deep-frozen → `tecFROZEN` / `tecLOCKED`.
11. Borrower frozen → `tecFROZEN` / `tecLOCKED`.
12. `LoanBroker.Owner` deep-frozen → `tecFROZEN` / `tecLOCKED`.
13. `Vault.AssetsAvailable < PrincipalRequested` → **`tecINSUFFICIENT_FUNDS`** ← *this is the clean
    "insufficient liquidity" guardrail demo for Track 1.*
14. Interest would push `AssetsTotal` past `AssetsMaximum` → `tecLIMIT_EXCEEDED` (accrual only).
15. Total interest ≤ 0 for a non-zero interest rate → `tecPRECISION_LOSS` (guard 1).
16. First payment's principal portion ≤ 0 → `tecPRECISION_LOSS` (guard 2).
17. Rounded periodic payment == 0 → `tecPRECISION_LOSS` (guard 3).
18. Rounding makes the number of payments ≠ `PaymentTotal` → `tecPRECISION_LOSS` (guard 4).
    (guards: `LendingHelpers.cpp:1883-1958`)
19. `DebtMaximum != 0 && DebtMaximum < DebtTotal + debtDelta` → `tecLIMIT_EXCEEDED`.
20. `CoverAvailable < minimumBrokerCover(newDebtTotal, CoverRateMinimum, vault)` →
    `tecINSUFFICIENT_FUNDS` ← *this is the clean "first-loss cover" guardrail demo.*
21. Borrower below reserve → `tecINSUFFICIENT_RESERVE`.
22/23. Borrower or broker owner not authorised for the asset → `tecNO_AUTH`.
24. `LoanBroker.LoanSequence` wrapped to 0 → `tecMAX_SEQUENCE_REACHED`.

**Closed-ended vault gates (V1_1, `LoanSet.cpp:319-347`)** — Track 2 minimum-bar material:
```cpp
phase = getVaultPhase(view, vault);
if (phase == Subscription) return tecTOO_SOON;
if (phase == Redemption)   return tecEXPIRED;      // <-- "rejected LoanSet during Redemption"
if (phase == Investment) {
    finalPayment = ledgerCloseTime + interval*total;
    if (finalPayment + 60 > vault->at(sfRedemptionDate)) return tecNO_PERMISSION;
}
```
`getVaultPhase` (`VaultHelpers.cpp:290-306`): `NoPhase` unless `VaultKind == ClosedEnded`;
Subscription while `parentCloseTime <= SubscriptionDate` (inclusive of the boundary);
Investment while `parentCloseTime < RedemptionDate`; Redemption at/after `RedemptionDate`.

**State changes** (spec §3.8.6, cash-basis variant in `LendingHelpers.cpp:224-228`):
- insert `Loan`, `Borrower.OwnerCount += 1`;
- create Borrower's holding, and the broker owner's holding if `LoanOriginationFee > 0`;
- `accountSendMulti(vaultPseudo → {borrower: PrincipalRequested − LoanOriginationFee,
  brokerOwner: LoanOriginationFee}, WaiveTransferFee::Yes)`;
- `Vault.AssetsAvailable -= PrincipalRequested`;
- `Vault.AssetsTotal += assetsTotalDelta` where
  **accrual**: `assetsTotalDelta = InterestDue`, `debtTotalDelta = Principal + InterestDue`;
  **cash-basis**: `assetsTotalDelta = 0`, `debtTotalDelta = PrincipalRequested`;
- `LoanBroker.DebtTotal += debtTotalDelta`, `OwnerCount += 1`, `LoanSequence += 1`;
- directory-link the Loan into the broker pseudo-account (`LoanBrokerNode`) and the Borrower (`OwnerNode`).
- `Loan.StartDate = view.header().closeTime` (current ledger close time),
  `Loan.NextPaymentDueDate = StartDate + PaymentInterval`, `Loan.PreviousPaymentDueDate = 0`.

Example (from the spec, with the `LoanPay`-84 caveat noted elsewhere):

```json
{
  "TransactionType": "LoanSet",
  "Account": "rBrokerOwner...",
  "LoanBrokerID": "A947...614",
  "Flags": 65536,
  "Counterparty": "rBorrower...",
  "CounterpartySignature": {
    "SigningPubKey": "ED...",
    "TxnSignature": "02EB..."
  },
  "LoanOriginationFee": "0", "LoanServiceFee": "0",
  "LatePaymentFee": "0", "ClosePaymentFee": "0", "OverpaymentFee": 0,
  "InterestRate": 500, "LateInterestRate": 0,
  "CloseInterestRate": 0, "OverpaymentInterestRate": 0,
  "PrincipalRequested": "1000",
  "PaymentTotal": 12, "PaymentInterval": 3600, "GracePeriod": 60,
  "Fee": "20", "Sequence": 3964250
}
```
`Flags: 65536` = `tfLoanOverpayment`, which sets `lsfLoanOverpayment` on the Loan and is the
*precondition* for ever using `tfLoanOverpayment` on `LoanPay`.

---

## 6. `LoanBrokerCoverDeposit` (76) / `LoanBrokerCoverWithdraw` (77) / `LoanBrokerCoverClawback` (78)

### Deposit
`{ TransactionType, Account (= broker owner), LoanBrokerID, Amount }`.
Failures: `temINVALID` (zero ID), `temBAD_AMOUNT` (≤0 or illegal), `tecNO_ENTRY`, `tecNO_PERMISSION`
(not the owner; or the asset is not transferable), `tecWRONG_ASSET`, `tecFROZEN`/`tecLOCKED`
(submitter frozen, or broker pseudo deep-frozen), `tecNO_AUTH`, `tecINSUFFICIENT_FUNDS`,
`tecPRECISION_LOSS` (`LoanBrokerCoverDeposit.cpp:120` — sub-cover-scale dust is rejected early).
Effect: move `Amount` submitter → broker pseudo (transfer fee waived); `CoverAvailable += Amount`.

### Withdraw
`{ TransactionType, Account, LoanBrokerID, Amount, Destination?, DestinationTag?, CredentialIDs? }`.

**`CredentialIDs` is implemented but undocumented in XLS-66.** It is gated on
`featureCredentials && fixCleanup3_4_0` (`LoanBrokerCoverWithdraw.cpp:32-33`) — both enabled on both
hackathon nets — and is consumed by `credentials::checkFields` (preflight) and `credentials::valid` +
`canWithdraw`/`authorizedDepositPreauth` (preclaim, lines 57, 121-131). It lets the broker withdraw to a
`Destination` that has `lsfDepositAuth` and a credential-based `DepositPreauth`. This is the natural
Permissioned-Domains/Credentials seam for a "Loaded" build.

Failures: `temINVALID`, `temBAD_AMOUNT`, `temMALFORMED` (zero `Destination`), `tecPSEUDO_ACCOUNT`
(destination is a pseudo-account), `tecNO_ENTRY`, `tecNO_PERMISSION`, `tecWRONG_ASSET`, `tecNO_DST`,
`tecDST_TAG_NEEDED`, `tecNO_AUTH`, `tecFROZEN`/`tecLOCKED`, and two liquidity guards:
```
CoverAvailable < Amount                                   -> tecINSUFFICIENT_FUNDS
CoverAvailable - Amount < DebtTotal * CoverRateMinimum     -> tecINSUFFICIENT_FUNDS
```
Post-`fixCleanup3_2_0` the withdraw path **waives the `lsfMPTCanTransfer` requirement** so an issuer
cannot trap a broker's first-loss capital (`LoanBrokerCoverWithdraw.cpp:113-118`) — not in the spec.

### Clawback (issuer only)
`{ TransactionType, Account (= issuer), LoanBrokerID?, Amount? }`. Either may be omitted but not both.
If `LoanBrokerID` is absent it is derived from `Account(Amount.issuer).LoanBrokerID`, which requires
`Amount` to be an IOU whose issuer is the broker **pseudo-account** (not the submitter).
`ClawAmount = min(Amount or ∞, CoverAvailable − DebtTotal×CoverRateMinimum)`; if that headroom is ≤ 0 →
`tecINSUFFICIENT_FUNDS`. XRP cannot be clawed back (`tecNO_PERMISSION`); IOU needs
`lsfAllowTrustLineClawback` and not `lsfNoFreeze`; MPT needs `lsfMPTCanClawback`.
`temBAD_AMOUNT` if `Amount` is XRP or negative; `temINVALID` for the missing-ID/MPT and
issuer-is-submitter combinations.

---

## 7. `LoanPay` (84)

`{ TransactionType, Account (= Loan.Borrower), LoanID, Amount, Flags? }`.

### 7.1 Non-standard fee — 1 base fee per 5 payments

`LoanPay::calculateBaseFee` (`LoanPay.cpp:104-209`). The spec says "standard transaction fee"; the
implementation does not:
```
if (tfLoanFullPayment or tfLoanLatePayment)            -> normalCost
if (Loan.PaymentRemaining <= 5)                        -> normalCost
if (isPaymentLate(...))                                -> normalCost
regularPayment = roundUp(Loan.PeriodicPayment, loanScale) + Loan.LoanServiceFee
if (Amount >= regularPayment * 100)                    -> 20 * normalCost   // capped
feeIncrements = max(1, ceil((Amount / regularPayment) / 5))
                                                       -> feeIncrements * normalCost
```
Rounding mode for the estimate is Upward when `tfLoanOverpayment` is set, Downward otherwise.
The spec's own example JSON uses `"Fee": "24"` without explaining why. **`client.autofill()` does NOT
model this** — it only special-cases `LoanSet`. If you sweep many periods in one `LoanPay`, set `Fee`
yourself or the tx is rejected for insufficient fee.

### 7.2 Failure conditions

Preflight: `temINVALID` (zero `LoanID`), `temBAD_AMOUNT` (`Amount <= 0`), `temINVALID_FLAG` (>1 of the
three flags).
Preclaim (`LoanPay.cpp:212-311`): `tecNO_ENTRY`; `tecNO_PERMISSION` (submitter ≠ `Loan.Borrower`;
also `tfLoanOverpayment` without `lsfLoanOverpayment` — **`tecNO_PERMISSION` post-`fixCleanup3_1_3`,
`temINVALID_FLAG` before**, so on the hackathon nets expect `tecNO_PERMISSION`, not the spec's
`temINVALID_FLAG`); `tecKILLED` (`PaymentRemaining == 0 || PrincipalOutstanding == 0`);
`tecWRONG_ASSET`; `tecFROZEN`/`tecLOCKED` (borrower frozen, vault pseudo deep-frozen);
`tecNO_AUTH`; `tecINSUFFICIENT_FUNDS` (the borrower must hold the **full `Amount`** even if the loan
takes less — no partial payments).
doApply: `tecFROZEN`/`tecLOCKED` if **both** the broker owner and the broker pseudo-account are
deep-frozen (no valid fee destination, `LoanPay.cpp:378-388`);
`tecEXPIRED` if late without `tfLoanLatePayment` (`LendingHelpers.cpp:2286-2296`);
`tecTOO_SOON` if `tfLoanLatePayment` is set but the loan is not late (`LendingHelpers.cpp:1064`);
`tecINSUFFICIENT_PAYMENT` if `Amount < totalDue` for late / full / regular
(`LendingHelpers.cpp:1116, 1241, 1732`);
`tecKILLED` if `tfLoanFullPayment` with `PaymentRemaining == 1` (`LendingHelpers.cpp:1159`).

**Lateness (amendment-gated, `LendingHelpers.cpp:172-180`):**
```cpp
isPaymentLate(view, loan) = hasExpired(view, loan[sfNextPaymentDueDate],
                              fixCleanup3_4_0 ? Exclusive : Inclusive);
// hasExpired (View.cpp:49-63):
//   Inclusive: view.parentCloseTime() >= boundary
//   Exclusive: view.parentCloseTime() >  boundary
```
Two things to internalise: (a) with `fixCleanup3_4_0` (both nets) a payment **exactly at**
`NextPaymentDueDate` is still on time; (b) the clock is **`parentCloseTime`**, i.e. the close time of the
*previous* ledger, not "now". Budget ~4-8 s of slack in any timing demo.

### 7.3 Fee destination (spec §3.11.5 step 1, `LoanPay.cpp:360-388`)

```cpp
sendBrokerFeeToOwner =  CoverAvailable >= minimumBrokerCover(DebtTotal, CoverRateMinimum, vault)
                     && !isDeepFrozen(brokerOwner, asset)
                     && !requireAuth(asset, brokerOwner, StrongAuth);
brokerPayee = sendBrokerFeeToOwner ? LoanBroker.Owner : LoanBroker.Account /*pseudo*/;
// if routed to the pseudo-account, LoanBroker.CoverAvailable increases by the fee
```
i.e. **when cover is below the minimum, all broker fees are diverted into the first-loss pool** instead
of blocking payments. That is a very demonstrable guardrail: under-fund the cover, make a payment, show
the fee landing in `CoverAvailable` rather than the owner's balance.

### 7.4 Payment maths (Appendix A-2 / A-3)

All rates are 1/10 bps; `secondsPerYear = 31 536 000`.

```
(1)  periodicRate      = InterestRate * PaymentInterval / secondsPerYear
(2)  latePeriodicRate  = LateInterestRate * secondsOverdue / secondsPerYear
(3)  secondsOverdue    = parentCloseTime - Loan.NextPaymentDueDate
(4)  secondsSinceLastPayment = parentCloseTime - max(PreviousPaymentDueDate, StartDate)
(5)  raisedRate        = (1 + periodicRate)^paymentsRemaining
(6)  factor            = periodicRate * raisedRate / (raisedRate - 1)
(7)  periodicPayment   = PrincipalOutstanding * factor
(8)  interest          = PrincipalOutstanding * periodicRate
(9)  principal         = periodicPayment - interest
(10) PrincipalOutstanding = periodicPayment / factor         (reverse)
(11)   zero-interest:  PrincipalOutstanding = periodicPayment * paymentsRemaining
(12) managementFee           = interest * managementFeeRate
(13) managementFee_late      = latePaymentInterest_gross * managementFeeRate
(14) managementFee_overpay   = overpaymentInterest_gross * managementFeeRate
(15) totalDue_late = periodicPayment + LoanServiceFee + LatePaymentFee + latePaymentInterest_net
(16) latePaymentInterest_gross = PrincipalOutstanding * latePeriodicRate
(17) latePaymentInterest_net   = gross - managementFee_late
(18) valueChange_late = latePaymentInterest_net                       (always > 0)
(19) overpaymentAmount = amount - periodicPaymentsCovered*(periodicPayment + LoanServiceFee)
(20) overpaymentInterest_gross = overpaymentAmount * OverpaymentInterestRate
(21) overpaymentInterest_net   = gross - managementFee_overpay
(22) overpaymentFee            = overpaymentAmount * OverpaymentFee
(23) principalPortion = overpaymentAmount - overpaymentInterest_net
                        - managementFee_overpay - overpaymentFee
(24) valueChange_reamortisation = newTotalValueOutstanding_ledger - (oldTotalValue - overpaymentAmount)
(24a) diffTotal = TotalValueOutstanding_ledger - (truePrincipal + trueInterest + trueMgmtFee)
(24b) newTruePrincipal = truePrincipal - principalPortion
(24c) newTotalValueOutstanding_ledger = newTrueTotalValue + diffTotal
(25) valueChange_overpayment = overpaymentInterest_net + valueChange_reamortisation   (usually < 0)
(26) totalDue_full = PrincipalOutstanding + accruedInterest + prepaymentPenalty + ClosePaymentFee
(27) accruedInterest    = PrincipalOutstanding * periodicRate * secondsSinceLastPayment / PaymentInterval
(28) prepaymentPenalty  = PrincipalOutstanding * CloseInterestRate
(29) valueChange_full   = (accruedInterest + prepaymentPenalty) - totalInterestOutstanding_net
(30) totalValueOutstanding = periodicPayment * paymentsRemaining
(31) totalInterestOutstanding_gross = totalValueOutstanding - PrincipalOutstanding
(32) managementFeeOutstanding       = gross * managementFeeRate
(33) totalInterestOutstanding_net   = gross - managementFeeOutstanding
(34) DefaultAmount   = PrincipalOutstanding + InterestOutstanding_net        <-- ACCRUAL
     DefaultAmount   = PrincipalOutstanding                                  <-- CASH-BASIS
(35) DefaultCovered  = min((DebtTotal * CoverRateMinimum) * CoverRateLiquidation, DefaultAmount,
                           CoverAvailable)
(36) Loss            = DefaultAmount - DefaultCovered
(37) FundsReturned   = DefaultCovered
```

**Final-payment override** (spec A-3.2.1, `compute_payment_due`): when `PaymentRemaining == 1` the
amortisation formula is discarded and `periodicPayment := TotalValueOutstanding`, so the loan always
settles to exactly zero. Implement this or you leave dust.

**Zero-interest special case**: `periodicPayment = PrincipalOutstanding / paymentsRemaining`, `interest = 0`.

**Minimum payable amounts:**
- on time: `roundUp(PeriodicPayment, loanScale) + LoanServiceFee`
- late: the above `+ LatePaymentFee + latePaymentInterest_net + managementFee_late`
- full early: eq. (26); rejected with `tecKILLED` if only one payment remains.

**Excess funds are silently ignored** (not refunded, not charged) when overpayment is not permitted —
the tx still succeeds. Overpayment is **never** allowed on a late payment.

**Rounding rules** (`compute_payment_due`, `calculate_rounded_interest_breakdown`):
`principal` → DOWN; `interest`/`managementFee` → HALF_EVEN then clamped to ≥ 0 and to the outstanding
balances; a final "excess" reconciliation subtracts from interest, then fee, then principal so the parts
never exceed the rounded periodic payment.

### 7.5 State changes

```
totalPaidByBorrower = principalPaid + interestPaid + feePaid
totalToVault        = round(principalPaid + interestPaid, vaultScale)
totalToBroker       = feePaid   -> brokerOwner  OR  brokerPseudo(CoverAvailable += feePaid)

accrual  : Vault.AssetsTotal += valueChange ; LoanBroker.DebtTotal -= (totalToVault - valueChange)
cash     : Vault.AssetsTotal += interestPaid; LoanBroker.DebtTotal -= principalPaid   (valueChange unused)
           (LendingHelpers.cpp:212-218 accrual::loanPaymentDeltas / 241-245 cash_basis::loanPaymentDeltas)
Vault.AssetsAvailable += totalToVault
```
An impaired loan is **automatically unimpaired before the payment is processed**
(`LoanPay.cpp:396-403`), which reverses `Vault.LossUnrealized`.

Loan updates: `PaymentRemaining -= 1` per settled cycle; `PreviousPaymentDueDate = NextPaymentDueDate`;
`NextPaymentDueDate += PaymentInterval` per cycle; balances decremented; on overpayment
`PeriodicPayment` is recomputed from the reduced principal (re-amortisation) with `diffTotal` preserved.
Full early repayment zeroes `PrincipalOutstanding`, `TotalValueOutstanding`,
`ManagementFeeOutstanding`, `PaymentRemaining`.

---

## 8. `LoanManage` (82) — impair / unimpair / default

`{ TransactionType, Account (= LoanBroker.Owner), LoanID, Flags }`. Flags mutually exclusive.

**Preclaim** (`LoanManage.cpp:63-131`):
1. No Loan → `tecNO_ENTRY`.
2. `lsfLoanDefault` already set → `tecNO_PERMISSION` (a defaulted loan is immutable).
3. Already impaired + `tfLoanImpair` → `tecNO_PERMISSION`.
4. Not impaired/defaulted + `tfLoanUnimpair` → `tecNO_PERMISSION`.
5. `PaymentRemaining == 0` → `tecNO_PERMISSION`.
6. `tfLoanDefault` and **not** `hasExpired(NextPaymentDueDate + GracePeriod, Exclusive)` → `tecTOO_SOON`.
   With `fixCleanup3_4_0` the boundary is exclusive: you need `parentCloseTime > due + grace`.
7. Submitter ≠ `LoanBroker.Owner` → `tecNO_PERMISSION`.

**doApply**:
8. `tfLoanImpair` and `!isPaymentLate` → `tecTOO_SOON` (`LoanManage.cpp:295-300`, **only under
   `fixCleanup3_4_0`**; this is the whole point of XLS-66.2). *Note this check is in doApply, so the fee
   is consumed and the result is a `tec`, not a `tem`.*
9. `tfLoanImpair` and `Vault.LossUnrealized + exposure > Vault.AssetsTotal - Vault.AssetsAvailable` →
   `tecLIMIT_EXCEEDED` (`LoanManage.cpp:310-318`).

**Impair** — `Vault.LossUnrealized += loanVaultExposure(vault, loan)` where
`exposure = TotalValueOutstanding − ManagementFeeOutstanding` (accrual) or `PrincipalOutstanding`
(cash-basis); set `lsfLoanImpaired`. With `fixCleanup3_4_0`: **`NextPaymentDueDate` is unchanged**
(pre-fix it was pulled forward to `parentCloseTime` when the loan was not yet late).

**Unimpair** — reverse the `LossUnrealized`, clear `lsfLoanImpaired`. With `fixCleanup3_4_0`:
`NextPaymentDueDate` unchanged. Pre-fix it was rewritten to
`max(PreviousPaymentDueDate, StartDate) + PaymentInterval`, or `parentCloseTime + PaymentInterval` if
that had already passed.

**Default** (`LoanManage::defaultLoan`, `LoanManage.cpp:133-284`):
```
DefaultAmount   = loanVaultExposure(vault, loan)                         // cash-basis: PrincipalOutstanding
MinimumCover    = roundUp(DebtTotal * CoverRateMinimum)
DefaultCovered  = min( roundUp(MinimumCover * CoverRateLiquidation), DefaultAmount, CoverAvailable )
VaultLoss       = DefaultAmount - DefaultCovered

Vault.AssetsTotal     -= VaultLoss
Vault.AssetsAvailable += DefaultCovered
if (lsfLoanImpaired)  Vault.LossUnrealized -= DefaultAmount
LoanBroker.DebtTotal      -= DefaultAmount
LoanBroker.CoverAvailable -= DefaultCovered
Loan: set lsfLoanDefault; TotalValueOutstanding = PaymentRemaining = PrincipalOutstanding
      = ManagementFeeOutstanding = NextPaymentDueDate = 0
accountSend(brokerPseudo -> vaultPseudo, DefaultCovered, WaiveTransferFee::Yes)
```
Worked example from spec §3.1.11 (accrual): DebtTotal 1090, CoverRateMinimum 10%,
CoverRateLiquidation 10%, CoverAvailable 1000, loan 1000 principal + 90 interest →
`DefaultCovered = min(1090×0.1×0.1, 1090) = 10.9`, `Loss = 1079.1`,
`AssetsTotal 100090 → 99010.9`, `AssetsAvailable 99000 → 99010.9`, `CoverAvailable 1000 → 989.1`.

---

## 9. `LoanDelete` (81) and `LoanBrokerDelete` (75)

`LoanDelete { LoanID }` — submitted by **either** the Borrower or the broker owner.
`temINVALID` (zero), `tecNO_ENTRY`, `tecHAS_OBLIGATIONS` (`PaymentRemaining > 0`),
`tecNO_PERMISSION` (wrong submitter).
Effects: unlink from both directories, delete, `LoanBroker.OwnerCount -= 1`,
**if `LoanBroker.OwnerCount == 0` then `LoanBroker.DebtTotal = 0`** (forgives rounding dust),
`Borrower.OwnerCount -= 1`.

`LoanBrokerDelete { LoanBrokerID }` — broker owner only.
`temINVALID`, `tecNO_ENTRY`, `tecNO_PERMISSION`, `tecHAS_OBLIGATIONS` (`OwnerCount != 0`, or
`DebtTotal` still non-zero after scaling — a defensive check), `tecFROZEN`/`tecLOCKED` if
`CoverAvailable > 0` and the owner is deep-frozen (the remaining cover must be returnable).
Effects: unlink from the owner's and the Vault pseudo-account's directories, transfer all
`CoverAvailable` back to the owner, delete the pseudo-account's holding, delete the pseudo-account
`AccountRoot`, delete the `LoanBroker`, `OwnerCount -= 2`.

Teardown order: all Loans → LoanBroker → Vault.

---

## 10. Freeze / clawback matrix (spec §2.1, §3.1.7)

| Action | Effect |
|---|---|
| Freeze broker **pseudo-account** | `LoanSet` fails; `LoanBrokerCoverWithdraw` fails; payments still work; `CoverDeposit` still works |
| Deep-freeze broker pseudo-account | + `LoanPay` fails (no fee sink); `CoverDeposit` fails |
| Deep-freeze broker **owner** | fees are redirected to the cover pool; `LoanSet` fails; `LoanBrokerDelete` fails while cover remains |
| Freeze **borrower** | borrower cannot pay; obligation persists |
| Freeze **vault pseudo-account** | `LoanSet` fails (cannot send principal) |
| Deep-freeze vault pseudo-account | `LoanPay` fails (cannot receive) |
| Global freeze | all origination, payments and cover movements blocked |

---

## 11. Querying lending state (verified live)

```bash
# by index — works for LoanBroker and Loan
curl -s -X POST $RPC -H 'Content-Type: application/json' \
  -d '{"method":"ledger_entry","params":[{"index":"<LoanBrokerID>","ledger_index":"validated"}]}'

# named accessor also works
  -d '{"method":"ledger_entry","params":[{"loan_broker":"<id>","ledger_index":"validated"}]}'

# by owner
  -d '{"method":"account_objects","params":[{"account":"rOwner...","type":"loan_broker","ledger_index":"validated"}]}'
# borrower's loans:  "type":"loan"   on the Borrower account
# broker's loans:    "type":"loan"   on the LoanBroker.Account (pseudo-account)

# scan
  -d '{"method":"ledger_data","params":[{"ledger_index":"validated","type":"loan_broker","limit":10}]}'

# vault (returns the Vault + its MPTokenIssuance under "shares")
  -d '{"method":"vault_info","params":[{"vault_id":"<VaultID>","ledger_index":"validated"}]}'
```

---

## 12. DevEx friction log (with proposed fixes)

1. **`LoanPay` TransactionType is 83 in the spec, 84 on the ledger.**
   Fix §3.11.1's default-value cell to `84` and add a note that 83 is reserved/unused.
   Source: spec line 1347 vs `server_definitions.TRANSACTION_TYPES` on both nets.

2. **xrpl.js: `LoanSet` is missing from `txToFlag`, so object-form flags throw.** Reproduced on 5.2.0
   and 5.2.0-beta.0:
   ```
   convertTxFlagsToNumber({TransactionType:'LoanSet', Flags:{tfLoanOverpayment:true}})
   -> ValidationError: Invalid flag tfLoanOverpayment. Valid flags are {"1073741824":"tfInnerBatchTxn",...}
   ```
   `LoanSet.d.ts` declares `Flags?: number | LoanSetFlagsInterface`, so the typed API is unusable.
   Fix: one line in `packages/xrpl/src/models/utils/flags.ts` — add `LoanSet: LoanSetFlags` to `txToFlag`.
   (Ideal "contribute back" PR: tiny, verifiable, with a unit test.)

3. **xrpl.js `LoanBrokerCoverWithdraw.CredentialIDs` regressed between 5.2.0-beta.0 and 5.2.0.**
   `diff x5.2.0-beta.0/.../loanBrokerCoverWithdraw.d.ts x5.2.0/.../loanBrokerCoverWithdraw.d.ts` →
   `9d8 < CredentialIDs?: string[]`. The beta validator calls
   `validateCredentialsList(tx.CredentialIDs, ..., MAX_AUTHORIZED_CREDENTIALS)`; 5.2.0 does not declare or
   validate the field at all, even though the ledger accepts it (`featureCredentials + fixCleanup3_4_0`,
   both enabled). Fix: restore the field and the validator call in 5.2.x.

4. **`CredentialIDs` on `LoanBrokerCoverWithdraw` is entirely absent from XLS-66.**
   Implemented at `src/libxrpl/tx/transactors/lending/LoanBrokerCoverWithdraw.cpp:32-33, 57, 121-131`.
   Fix: add the field to the §3.6.1 table, add the `credentials::checkFields` / `credentials::valid`
   failure conditions (`temMALFORMED`, `tecBAD_CREDENTIALS`, `tecEXPIRED`) and say it exists to satisfy a
   destination's `DepositAuth`/`DepositPreauth`.

5. **`LoanPay`'s fee is not the standard fee; the spec says it is.** §3.11.3 reads "This transaction uses
   the standard transaction fee", but `LoanPay::calculateBaseFee` charges one base fee per
   `kLoanPaymentsPerFeeIncrement = 5` estimated payments, capped at
   `kLoanMaximumPaymentsPerTransaction / 5 = 20`. The spec's own example even shows `"Fee": "24"`.
   Fix: document the formula in §3.11.3 and cross-reference the two constants.

6. **xrpl.js `autofill` does not model the `LoanPay` fee**, only `LoanSet`. A catch-up payment covering
   many periods is autofilled at the base fee and rejected. Fix: mirror `calculateBaseFee` for `LoanPay`
   (it needs `PeriodicPayment`, `LoanServiceFee`, `PaymentRemaining` — one `ledger_entry` call, which
   autofill already does for `LoanSet`'s signer count).

7. **xrpl.js `autofill` prints a `console.warn` on every `LoanSet`.**
   `sugar/autofill.js:225`: *"For LoanSet transaction the auto calculated Fee accounts for total number of
   signers the counterparty has to avoid transaction failure."* Unconditional log noise in a library.
   Fix: delete it, or put it behind the client's logging config.

8. **xrpl.js client-side validation is materially weaker than rippled's preflight.** All of these pass
   `validate()` and then fail on-ledger:
   | Case | rippled result |
   |---|---|
   | `LoanSet` with `GracePeriod: 30` | `temINVALID` (min is 60) |
   | `LoanSet` with `PaymentTotal: 0` | `temINVALID` |
   | `LoanSet` with `LoanOriginationFee > PrincipalRequested` | `temINVALID` |
   | `LoanSet` without `CounterpartySignature` (non-Batch) | `temBAD_SIGNER` |
   | `LoanManage` with `tfLoanDefault | tfLoanImpair` | `temINVALID_FLAG` |
   `validateLoanManage` only checks Impair-vs-Unimpair and, in the object-flag branch, never even reads
   `tfLoanDefault`. Fix: add the four `LoanSet` checks and make `LoanManage`'s exclusivity check cover all
   three flags (and include `tfLoanDefault` in the object→number fold).

9. **`temBAD_SIGNER` is listed under "Protocol-Level Failures".** Spec §3.8.5.2 item 1 returns a `tem`
   code from a section that is otherwise `tec`/`ter`. It is really a signature-check (`checkSign`) result.
   Fix: move it to §3.8.5.1 or add a note that signature-derived failures stay `tem`.

10. **`CounterpartySignature` is marked `Required: Yes` in §3.8.1 but is `SoeOptional` in the ledger
    format and optional in the Batch path.** Spec's own §3.8.5.1 item 2 and the rippled comment
    ("Counterparty signature is optional. Presence is checked in preflight") contradict the table.
    Fix: mark it "Conditional — required unless the transaction is a `Batch` inner transaction".

11. **`tecNO_PERMISSION` vs `temINVALID_FLAG` for overpayment-without-permission.** Spec §3.11.4.2 item 3
    says `temINVALID_FLAG`; rippled returns `tecNO_PERMISSION` once `fixCleanup3_1_3` is enabled
    (`LoanPay.cpp:233-237`) — which it is on both hackathon nets. Fix: amendment-gate the documented code.

12. **`ManagementFeeRate` range annotation is wrong.** §3.3.1 says "Valid values are between 0 and 10000
    inclusive (1% - 10%)". 0..10000 tenth-bips is **0% - 10%**, and 1 is 0.001%, not 1%.
    (XRPL-Standards PR #625 fixes the adjacent `CoverRateMinimum` wording but not this.)
    Fix: change "(1% - 10%)" to "(0% – 10%)".

13. **`LoanBroker` / `Loan` / all nine transactions have `Invariants: TBD`.** §3.1.8, §3.2.7, §3.3.5,
    §3.5.5, §3.6.5, §3.7.5, §3.8.7, §3.10.6, §3.11.6. Meanwhile rippled ships
    `src/libxrpl/tx/invariants/LoanInvariant.cpp` and `LoanBrokerInvariant.cpp`.
    Fix: transcribe the implemented invariants into the spec — they are the contract implementers need.

14. **`hasExpired` compares against `parentCloseTime`, and nothing in XLS-66 says so.** The spec says
    "current ledger close time" / `lastLedgerCloseTime`. In rippled every lateness, grace and phase test
    goes through `hasExpired(view, …)` → `view.parentCloseTime()` (`View.cpp:49-63`). That is one ledger
    (~4 s, up to a 10 s close-time resolution) behind wall-clock.
    Fix: define the reference clock once in §2.5 as "the parent ledger's close time" and use it everywhere.

15. **The build running the hackathon (`3.4.0-rc5`) has no public git tag.**
    `git ls-remote --tags https://github.com/XRPLF/rippled` lists only `3.4.0-b1/b2/b3/rc1`. You cannot
    pin a source tree to the public devnet's behaviour. Fix: push release-candidate tags, or publish the
    commit hash in `server_info`.

16. **Spec URL shape.** `https://xls.xrpl.org/xls/XLS-0066` → HTTP 404; the working URL is
    `https://xls.xrpl.org/xls/XLS-0066-lending-protocol` (folder slug, not XLS number).
    Fix: add a redirect from `/xls/XLS-00NN` to the slugged page.

17. **The equation glossary's `overpaymentFee = overpaymentAmount * overpaymentFee`** (A-3.2.3) uses the
    same name for the rate and the result. Fix: rename to `overpaymentFeeRate` as in eq. (22).

18. **No `LoanBrokerSet` example of the *modify* path, and no statement of which fields are immutable in
    the fields table.** The immutability only appears as failure condition §3.3.3.1 item 9.
    Fix: add a "Constant after creation" column to §3.3.1.

---

## 13. Open questions

- Whether the organisers intend Track 1 to be "V1 accrual accounting" despite `LendingProtocolV1_1`
  being enabled on the custom devnet and `VaultCreate` stamping `LEVersion: 1` on every new vault.
  As built, both tracks get cash-basis.
- `tfVaultDonation` — not found in rippled, in `server_definitions`, in XLS-65 master, or in the
  closed-ended vault draft. Source unknown.
- Whether `3.4.0-rc5` (public devnet) differs from `develop @ 9403736` in any lending code path;
  no tag exists to diff against.
- `Vault.LossUnrealized` handling when a loan is impaired and then the vault's assets move — the
  `tecLIMIT_EXCEEDED` guard is a point-in-time check only.
