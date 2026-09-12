# xrpl.js / xrpl-py support for XLS-65 + XLS-66 — verified state

Research slug: `xrpljs-sdk`. All claims below were verified against npm metadata, unpacked
package source, rippled C++ source, and **live transactions on both devnets** on 2026-09-12.

---

## TL;DR — the headline

**Use `xrpl@5.2.0` (stable, latest) for BOTH tracks. Do NOT use `xrpl@5.2.0-beta.0`.**

`xrpl@5.2.0-beta.0` — the version the event brief mandates for Track 2 — **cannot originate a
loan on either devnet.** Its `signLoanSetByCounterparty()` signs the counterparty signature with
the wrong hash prefix. Every `LoanSet` it produces is rejected with
`fails local checks: Counterparty: Invalid signature.` Since `LoanSet` *requires* a
`CounterpartySignature` (rippled returns `temBAD_SIGNER` without one), **no loan can be created
at all with the beta.** This kills both track minimum bars if you follow the brief literally.

`xrpl@5.2.0` stable signs it correctly and completes the entire lifecycle, including
closed-ended (V1.1) vaults, even though its TypeScript types do not yet declare the
closed-ended fields.

---

## 1. npm state

`npm view xrpl dist-tags` (2026-09-12):

```json
{
  "latest": "5.2.0",
  "beta-experimental": "5.2.0-beta.1",
  "batch-experimental": "5.1.0-batch.1",
  "smart-escrow-experimental": "5.1.0-smartescrow.1",
  "smart-contract-experimental": "4.7.0-smartcontract.0",
  "ripple-lib": "1.10.1"
}
```

Publish times (`npm view xrpl time`):

| version | published |
|---|---|
| `5.1.0` | 2026-08-25T00:29:45Z |
| `5.2.0-beta.0` | 2026-09-10T13:42:46Z |
| `5.2.0-beta.1` | 2026-09-11T16:59:54Z |
| **`5.2.0` (latest)** | **2026-09-11T22:20:39Z** |

**The stable 5.2.0 was published the day before the hackathon, superseding the beta the brief
names.** `5.2.0-beta.0` metadata: `engines.node >= 20.19.0`, depends on
`ripple-binary-codec@^2.11.0-beta.0`. Stable 5.2.0 depends on `ripple-binary-codec@^2.11.0`.

---

## 2. Transaction models — which exist where

`src/models/transactions/` file lists in `5.2.0` and `5.2.0-beta.0` are **byte-for-byte identical
in membership**. Both ship all fifteen lending/vault transactors. `5.1.0` already had them too.

```
vaultCreate  vaultSet  vaultDeposit  vaultWithdraw  vaultClawback  vaultDelete
loanBrokerSet  loanBrokerDelete  loanBrokerCoverDeposit  loanBrokerCoverWithdraw
loanBrokerCoverClawback  loanSet  loanPay  loanManage  loanDelete
```

Binary codec `TRANSACTION_TYPES` (from `ripple-binary-codec@2.11.0-beta.0/dist/enums/definitions.json`):

| code | type | code | type |
|---|---|---|---|
| 65 | VaultCreate | 76 | LoanBrokerCoverDeposit |
| 66 | VaultSet | 77 | LoanBrokerCoverWithdraw |
| 67 | VaultDelete | 78 | LoanBrokerCoverClawback |
| 68 | VaultDeposit | 80 | LoanSet |
| 69 | VaultWithdraw | 81 | LoanDelete |
| 70 | VaultClawback | 82 | LoanManage |
| 74 | LoanBrokerSet | 84 | LoanPay |
| 75 | LoanBrokerDelete | | |

**There is no drawdown transaction type.** Codes 72, 73, 79, 83 are unused. See §7.

### 2.1 The only source differences between `5.2.0` and `5.2.0-beta.0`

Diffing all fifteen models, only four files differ, and the beta is a strict superset **at the
type level only**:

| file | beta adds | in stable? |
|---|---|---|
| `vaultCreate.ts` | `VaultKind`, `SubscriptionDate`, `RedemptionDate` + `VaultKind` enum + close-ended validation | fields absent from TS, **but accepted on the wire** |
| `vaultWithdraw.ts` | `CredentialIDs?: string[]` | absent |
| `vaultDelete.ts` | `MemoData?: string` | absent |
| `loanBrokerCoverWithdraw.ts` | `CredentialIDs?: string[]` | absent |
| `loanSet.ts`, `loanPay.ts`, `loanManage.ts`, `vaultSet.ts`, `vaultDeposit.ts`, `vaultClawback.ts`, `loanBrokerSet.ts`, `loanDelete.ts`, `loanBrokerDelete.ts`, `loanBrokerCoverDeposit.ts`, `loanBrokerCoverClawback.ts` | **IDENTICAL** | — |

`ripple-binary-codec@2.11.0` (stable) **already contains** `VaultKind` (nth 22, UInt8),
`SubscriptionDate` (nth 75, UInt32), `RedemptionDate` (nth 76, UInt32),
`CounterpartySignature` (nth 37, STObject, `isSigningField: false`), `Counterparty`
(nth 26, AccountID), `MemoData` (nth 13, Blob), `CredentialIDs` (nth 5, Vector256).

**Verified live:** stable `xrpl@5.2.0` created a closed-ended vault on public devnet —
`6EDB20D5399221F894D2A7DBE8FBE6682F5474CEE984BC104A60CF356CAB1015` → `tesSUCCESS`, resulting
`Vault` carries `VaultKind=1`. Stable's `validate()` passes the extra fields through without
complaint. So the beta's advantage is TypeScript ergonomics and client-side guardrails, nothing
on the wire.

---

## 3. THE BLOCKER: counterparty signing is broken in the beta

### 3.1 The mechanism, from rippled source

`src/libxrpl/protocol/Sign.cpp` (branches `staging/3.4.x` **and** `ripple/lending-hackathon`,
identical):

```cpp
HashPrefix
signingPrefix(SignatureRole role, bool multiSigning, Rules const& rules)
{
    // Before fixCleanup3_4_0 every signature on a transaction covered the same
    // bytes, so a signature could be moved from one role to another.
    if (!rules.enabled(fixCleanup3_4_0))
        return multiSigning ? HashPrefix::TxMultiSign : HashPrefix::TxSign;

    switch (role)
    {
        case SignatureRole::Transaction:
            return multiSigning ? HashPrefix::TxMultiSign : HashPrefix::TxSign;
        case SignatureRole::Counterparty:
            return multiSigning ? HashPrefix::CounterpartyTxMultiSign
                                : HashPrefix::CounterpartyTxSign;
        case SignatureRole::Sponsor:
            return multiSigning ? HashPrefix::SponsorTxMultiSign : HashPrefix::SponsorTxSign;
    }
}
```

`include/xrpl/protocol/HashPrefix.h`:

```cpp
TxSign                    = makeHashPrefix('S','T','X'),   // 0x53545800
TxMultiSign               = makeHashPrefix('S','M','T'),   // 0x534D5400
CounterpartyTxSign        = makeHashPrefix('C','P','T'),   // 0x43505400
CounterpartyTxMultiSign   = makeHashPrefix('C','P','M'),   // 0x43504D00
```

**`fixCleanup3_4_0` is ENABLED on BOTH devnets** (verified via the public `feature` RPC, §5).
So a counterparty signature MUST cover the `CPT` prefix.

### 3.2 What each library does

`xrpl@5.2.0` stable, `src/Wallet/utils.ts` — correct:

```ts
export type SignatureRole = 'transaction' | 'counterparty' | 'sponsor'

const SIGNING_ENCODERS: Record<SignatureRole, {...}> = {
  transaction:  { single: encodeForSigning,             multi: encodeForMultisigning },
  counterparty: { single: encodeForSigningCounterparty, multi: encodeForMultisigningCounterparty },
  sponsor:      { single: encodeForSigningSponsor,      multi: encodeForMultisigningSponsor },
}
```
and `counterpartySigner.ts` calls `computeSignature(tx, wallet.privateKey, undefined, 'counterparty')`.

`xrpl@5.2.0-beta.0` — **broken**. `computeSignature` has no `role` parameter and
`counterpartySigner.ts` calls plain `computeSignature(tx, wallet.privateKey)`, i.e. the `STX`
prefix. `ripple-binary-codec@2.11.0-beta.0` does not even export the counterparty encoders:

| encoder | `2.11.0` (stable) | `2.11.0-beta.0` |
|---|---|---|
| `encodeForSigning` | yes | yes |
| `encodeForMultisigning` | yes | yes |
| `encodeForSigningCounterparty` | **yes** | **NO** |
| `encodeForMultisigningCounterparty` | **yes** | **NO** |
| `encodeForSigningSponsor` | **yes** | **NO** |
| `encodeForMultisigningSponsor` | **yes** | **NO** |

### 3.3 Empirical proof — same script, same ledger, two libraries

Hackathon devnet, open-ended vault + broker + cover already in place:

```
LoanSet counterparty-signed by xrpl@5.2.0-beta.0 -> THROW fails local checks: Counterparty: Invalid signature.
LoanSet counterparty-signed by xrpl@5.2.0-stable -> tesSUCCESS  D95613B031994662C2F39DD6FE003A2DF2AC6CFFEC63C5D2CFED552F0E23B314
```

Public devnet, closed-ended vault during the Investment phase:

```
[INV] LoanSet via xrpl@5.2.0-beta.0 -> THROW fails local checks: Counterparty: Invalid signature.
[INV] LoanSet via xrpl@5.2.0-stable -> tesSUCCESS 3241A3B2DCF3EF6D4D2809708287D6B099264F563769D2282A55E5BA5FB52D30
```

`LoanSet` without any `CounterpartySignature` is rejected in preflight
(`src/libxrpl/tx/transactors/lending/LoanSet.cpp`):

```cpp
if (!tx.isFlag(tfInnerBatchTxn) && !counterPartySig)
{
    JLOG(ctx.j.warn()) << "LoanSet transaction must have a CounterpartySignature.";
    return temBAD_SIGNER;
}
```

So there is no workaround inside the beta short of hand-rolling the `CPT` prefix.

### 3.4 xrpl-py has the identical bug

`xrpl-py==5.2.0b0` (PyPI, published 2026-09-11 — newest Python release; `latest` is `5.1.0`)
ships `xrpl/transaction/counterparty_signer.py` with `sign_loan_set_by_counterparty`, but:

```python
from xrpl.core.binarycodec import encode, encode_for_multisigning, encode_for_signing
...
    return keypairs_sign(bytes.fromhex(encode_for_signing(tx_json)), ...)
```

and `xrpl/core/binarycodec/main.py` defines only:

```python
_TRANSACTION_SIGNATURE_PREFIX = 0x53545800
_PAYMENT_CHANNEL_CLAIM_PREFIX = 0x434C4D00
_TRANSACTION_MULTISIG_PREFIX  = 0x534D5400
_BATCH_PREFIX                 = 0x42434800
```

No `0x43505400`. Grep for `43505400` across `xrpl/core/` returns nothing.
**There is currently no working Python path to originate a loan.** `xrpl-py` 5.2.0b0 *does* have
the closed-ended models (`vault_kind`, `subscription_date`, `redemption_date`, `VaultKind` enum,
`MIN_INVESTMENT_PERIOD = 180`) and its bundled definitions.json has `VaultKind`/`SubscriptionDate`/
`RedemptionDate`; `xrpl-py` 5.1.0 does not.

---

## 4. `tfVaultDonation` DOES NOT EXIST

The event brief states closed-ended interest is injected "via VaultDeposit with the
tfVaultDonation flag (raises PPS without minting shares)". **This is not true of any shipped build.**

- No `tfVaultDonation` / `Donation` string anywhere in `xrpl@5.2.0`, `xrpl@5.2.0-beta.0`, or `xrpl-py`.
- `VaultDepositFlags` is `undefined` at runtime in both JS versions — **`VaultDeposit` has no flags enum at all.**
- rippled `include/xrpl/protocol/TxFlags.h` on `develop`, `master`, `3.4.0-b1` **and**
  `ripple/lending-hackathon` declares vault flags only on `VaultCreate`:
  ```
  TRANSACTION(VaultCreate,
      TF_FLAG(tfVaultPrivate, lsfVaultPrivate)
      TF_FLAG(tfVaultShareNonTransferable, 0x00020000),
      MASK_ADJ(0))
  ```
  There is no `TRANSACTION(VaultDeposit, ...)` flag block.
- GitHub code search for `tfVaultDonation` across all of GitHub: **0 results.**
- **Live probe on public devnet** — `VaultDeposit` with each plausible flag value:
  ```
  VaultDeposit Flags=0x10000 -> temINVALID_FLAG
  VaultDeposit Flags=0x20000 -> temINVALID_FLAG
  VaultDeposit Flags=0x40000 -> temINVALID_FLAG
  ```

**Yield reaches lenders through `LoanPay`, not through a donation flag.** Verified: a `LoanPay`
of 50000015 drops moved the vault from `AssetsTotal = 500000000` to `AssetsTotal = 500000020`
(+20 drops of interest, net of the 5% `ManagementFeeRate`) and `AssetsAvailable` 400000000 →
450000015. That is the cash-basis recognition described in the brief, and it needs no flag.

---

## 5. Network reality — the two devnets are NOT what the brief assumes

`feature` RPC is public on both (no admin needed).

| | Hackathon devnet | Public devnet |
|---|---|---|
| RPC | `https://lending-hackathon.dev.ripplex.io:51234` | `https://s.devnet.rippletest.net:51234/` |
| build | **3.4.0-rc1** | **3.4.0-rc5** |
| network_id | 4001 | 2 |
| `SingleAssetVault` | ENABLED | ENABLED |
| `LendingProtocol` | ENABLED | ENABLED |
| **`LendingProtocolV1_1`** | **ENABLED** | **ENABLED** |
| `fixCleanup3_4_0` | **ENABLED** | **ENABLED** |
| `Credentials`, `PermissionedDomains`, `TokenEscrow`, `MPTokensV1`, `DynamicMPT`, `Sponsor`, `BatchV1_1` | ENABLED | ENABLED |
| `fixUniversalNumber` | off | ENABLED |
| `TicketBatch` | off | ENABLED |
| total enabled | 48 | 89 |

**Both networks report `LendingProtocolV1_1` enabled**, contradicting the brief's "Track 1 = V1,
Track 2 = V1.1" split. But the amendment name does not mean the same thing on both, because the
builds differ (rc1 vs rc5):

`staging/3.4.x` (→ public devnet rc5), `LoanBrokerSet.cpp` preclaim:

```cpp
// LP V1.1: only closed-ended vaults may host a loan broker. The
// lending protocol relies on the closed-ended Subscription /
// Investment / Redemption phase structure; attaching a broker to
// an open-ended vault has no well-defined lifecycle. VaultCreate
// stays unrestricted so existing open-ended flows keep working;
// the constraint is enforced here, at the point where the vault
// is first bound to the lending protocol.
if (ctx.view.rules().enabled(featureLendingProtocolV1_1) &&
    getVaultKind(sleVault) != VaultKind::ClosedEnded)
{
    JLOG(ctx.j.warn()) << "LoanBroker requires a closed-ended Vault.";
    return tecNO_PERMISSION;
}
```

**Verified live, and the two networks behave differently:**

| | open-ended vault + `LoanBrokerSet` | closed-ended vault + `LoanBrokerSet` |
|---|---|---|
| Hackathon devnet (rc1) | **`tesSUCCESS`** | **`tesSUCCESS`** |
| Public devnet (rc5) | **`tecNO_PERMISSION`** | **`tesSUCCESS`** |

So the hackathon devnet is a **superset**: it runs both open- and closed-ended lending. The
public devnet enforces closed-ended only. Track 1's "open-ended vault + loan broker" bar is
buildable **only** on the hackathon devnet.

---

## 6. Field-by-field interfaces (from `5.2.0-beta.0` source, the superset)

### VaultCreate
```ts
interface VaultCreate extends BaseTransaction {
  TransactionType: 'VaultCreate'
  Asset: Currency                 // required
  Data?: string                   // hex, <=256 bytes
  AssetsMaximum?: XRPLNumber
  MPTokenMetadata?: string        // hex, XLS-89
  WithdrawalPolicy?: number       // VaultWithdrawalPolicy.vaultStrategyFirstComeFirstServe = 0x0001
  DomainID?: string               // requires tfVaultPrivate
  Scale?: number                  // IOU only, 0..18; must be absent for XRP/MPT
  VaultKind?: number              // BETA ONLY in TS. 0=open, 1=closed
  SubscriptionDate?: number       // BETA ONLY in TS. Ripple-epoch seconds
  RedemptionDate?: number         // BETA ONLY in TS. Ripple-epoch seconds
}
enum VaultCreateFlags { tfVaultPrivate = 0x00010000, tfVaultShareNonTransferable = 0x00020000 }
enum VaultKind { vaultKindOpen = 0, vaultKindClosed = 1 }   // beta only
```
Beta-only client-side rules: `VaultKind` must be 0 or 1; dates must be integers; closed-ended
requires **both** dates; `RedemptionDate - SubscriptionDate` ∈ `[180, 946708560)`; dates are
rejected unless `VaultKind === 1`. **Stable enforces none of these** (verified: stable's
`validate()` accepted `SubscriptionDate` with no `VaultKind`).

### VaultSet / VaultDeposit / VaultWithdraw / VaultClawback / VaultDelete
```ts
interface VaultSet      { VaultID: string; Data?: string; AssetsMaximum?: XRPLNumber; DomainID?: string }
interface VaultDeposit  { VaultID: string; Amount: Amount | MPTAmount }        // NO flags field at all
interface VaultWithdraw { VaultID: string; Amount: Amount | MPTAmount; Destination?: Account;
                          DestinationTag?: number; CredentialIDs?: string[] /* beta only */ }
interface VaultClawback { VaultID: string; Holder: Account; Amount?: ClawbackAmount }
interface VaultDelete   { VaultID: string; MemoData?: string /* beta only, hex <=256B */ }
```

### LoanBrokerSet
```ts
interface LoanBrokerSet extends BaseTransaction {
  TransactionType: 'LoanBrokerSet'
  VaultID: string                 // required, 64-hex
  LoanBrokerID?: string           // present = update
  Data?: string                   // hex, <=512 chars
  ManagementFeeRate?: number      // 0..10000  (1/10 bp)
  DebtMaximum?: XRPLNumber        // >= 0; 0 = unlimited
  CoverRateMinimum?: number       // 0..100000
  CoverRateLiquidation?: number   // 0..100000
}
```
Client rule: `CoverRateMinimum` and `CoverRateLiquidation` must be both zero or both non-zero.

### LoanSet (the one that matters)
```ts
interface LoanSet extends BaseTransaction {
  TransactionType: 'LoanSet'
  LoanBrokerID: string            // required, 64-hex
  PrincipalRequested: XRPLNumber  // required, > 0
  CounterpartySignature?: CounterpartySignature   // REQUIRED in practice (temBAD_SIGNER without)
  Counterparty?: Account          // defaults to LoanBroker.Owner
  Data?: string                   // hex <=512
  LoanOriginationFee?: XRPLNumber // <= PrincipalRequested
  LoanServiceFee?: XRPLNumber
  LatePaymentFee?: XRPLNumber
  ClosePaymentFee?: XRPLNumber
  OverpaymentFee?: number             // 0..100000
  InterestRate?: number               // 0..100000 (1/10 bp)
  LateInterestRate?: number           // 0..100000
  CloseInterestRate?: number          // 0..100000
  OverpaymentInterestRate?: number    // 0..100000
  PaymentTotal?: number               // >= 1 (rippled kMinPaymentTotal), default 1
  PaymentInterval?: number            // >= 60 (kMinPaymentInterval), default 60
  GracePeriod?: number                // rippled: [60, PaymentInterval]. xrpl.js only checks the max!
  Flags?: number | LoanSetFlagsInterface
}
interface CounterpartySignature { SigningPubKey?: string; TxnSignature?: string; Signers?: Signer[] }
enum LoanSetFlags { tfLoanOverpayment = 0x00010000 }
```

### LoanPay / LoanManage / LoanDelete / broker cover
```ts
interface LoanPay    { LoanID: string; Amount: Amount | MPTAmount; Flags?: ... }
enum LoanPayFlags    { tfLoanOverpayment = 0x00010000, tfLoanFullPayment = 0x00020000,
                       tfLoanLatePayment = 0x00040000 }   // at most one may be set
interface LoanManage { LoanID: string; Flags?: ... }
enum LoanManageFlags { tfLoanDefault = 0x00010000, tfLoanImpair = 0x00020000,
                       tfLoanUnimpair = 0x00040000 }      // Impair + Unimpair mutually exclusive
interface LoanDelete { LoanID: string }
interface LoanBrokerDelete          { LoanBrokerID: string }
interface LoanBrokerCoverDeposit    { LoanBrokerID: string; Amount: Amount | MPTAmount }
interface LoanBrokerCoverWithdraw   { LoanBrokerID: string; Amount: Amount | MPTAmount;
                                      Destination?: Account; DestinationTag?: number;
                                      CredentialIDs?: string[] /* beta only */ }
interface LoanBrokerCoverClawback   { LoanBrokerID?: string; Amount?: IssuedCurrencyAmount | MPTAmount }
```

### Autofill
`client.autofill()` **does** handle `LoanSet` specially: `fetchCounterPartySignersCount()` resolves
the counterparty (explicit `Counterparty`, else `ledger_entry` on `LoanBrokerID` → `LoanBroker.Owner`),
reads its signer list, and raises `Fee` accordingly. It emits an unconditional `console.warn`:
`"For LoanSet transaction the auto calculated Fee accounts for total number of signers the
counterparty has to avoid transaction failure."` Present in both versions.

### Signing helpers
Both versions export `signLoanSetByCounterparty` and `combineLoanSetCounterpartySigners`
from the package root. Only stable's is correct (§3).

---

## 7. There is no drawdown transaction — `LoanSet` funds the borrower

No `LoanDraw`/drawdown type exists (type codes 72, 73, 79, 83 are unused). Verified on the
hackathon devnet from `LoanSet` `D95613B0…` metadata:

```
MODIFIED AccountRoot rLWTcZ… (vault pseudo-account)  Balance 50000000 -> 40000000
MODIFIED AccountRoot rUMQd6… (borrower)              Balance 1000000000 -> 1009999976
CREATED  Loan E02C0C7D…
```

Principal is delivered to the borrower atomically at origination. The brief's "execute a
drawdown" is satisfied by `LoanSet` itself, not a separate step.

Created `Loan` object shape:
```json
{ "Borrower": "rUMQd6…", "LoanBrokerID": "FE5342FD…", "LoanSequence": 1,
  "PrincipalOutstanding": "10000000", "TotalValueOutstanding": "10000012",
  "PeriodicPayment": "2500002.972796374161", "PaymentRemaining": 4,
  "PaymentInterval": 300, "GracePeriod": 120, "InterestRate": 5000,
  "StartDate": 842528661, "NextPaymentDueDate": 842528961 }
```

---

## 8. PPS: `SharesTotal` is NOT on the Vault object

The brief says `PPS = AssetsTotal / SharesTotal`. The `Vault` ledger entry has **no `SharesTotal`
field.** Full node from public devnet after the lifecycle:

```json
{ "LedgerEntryType": "Vault", "Account": "resPb8…", "Owner": "r9NtBC…",
  "Asset": {"currency":"XRP"}, "AssetsTotal": "45000000", "AssetsAvailable": "35000000",
  "ShareMPTID": "00000001070162A77A958D1EC6E2BD974E40207F977498CF",
  "VaultKind": 1, "SubscriptionDate": 842528816, "RedemptionDate": 842528996,
  "WithdrawalPolicy": 1, "Flags": 0, "LEVersion": 1 }
```

Share supply lives on the share MPT. Second call required:

```js
const vault  = (await client.request({command:'ledger_entry', index: vaultID})).result.node
const shares = (await client.request({command:'ledger_entry', mpt_issuance: vault.ShareMPTID})).result.node
const pps    = Number(vault.AssetsTotal) / Number(shares.OutstandingAmount)
```
`MPTokenIssuance.OutstandingAmount` was `"45000000"`, matching `AssetsTotal` (PPS = 1.0 here).
Also note zero-valued fields are omitted entirely from `Vault` — a fresh vault has no
`AssetsTotal` key at all, so read defensively.

---

## 9. Verified Track 2 lifecycle (public devnet, `xrpl@5.2.0` stable)

Closed-ended vault, `SubscriptionDate = now+100`, `RedemptionDate = SubscriptionDate+180`:

| phase | transaction | result | hash |
|---|---|---|---|
| Subscription | `VaultCreate` (VaultKind 1) | `tesSUCCESS` | `8AA45A334E0E8584A1B7DFF6EFFC409089404AE6E6A543A36821B3BD8E650222` |
| Subscription | `VaultDeposit` 50 XRP | `tesSUCCESS` | `56B4A799C05834BF1CECDC24BED3F1AAE1E843E68067D55F9590F1E32346FCA1` |
| Subscription | `LoanBrokerSet` | `tesSUCCESS` | `6A9C0AC0FBF75956B8276AA609196C6345709A024F9BCA0397EBA8EE55A01013` |
| Subscription | `LoanBrokerCoverDeposit` | `tesSUCCESS` | `B0A8E95357358BBCAAD024DA6026943F56CEF0000BA5500F52428E6205060CA0` |
| **Investment** | `VaultDeposit` | **`tecEXPIRED`** | `14C1EFB55468E2F584FA6A8A9C7B71A4EBF257AFA2BE58F7C06F87095CF3B4FA` |
| **Investment** | `VaultWithdraw` | **`tecTOO_SOON`** | `97068829B2F8CFE851748EEC8E4AFEB64820290137D8F941EB6BAA579EF1A5AB` |
| Investment | `LoanSet` (stable) | `tesSUCCESS` | `3241A3B2DCF3EF6D4D2809708287D6B099264F563769D2282A55E5BA5FB52D30` |
| **Redemption** | `LoanSet` | **`tecEXPIRED`** | `720365414F2E9FAEB1D936416BDC32EC246830C95EB30E4B029544F3C191B13E` |
| Redemption | `VaultWithdraw` | `tesSUCCESS` | `44C209A556DDE24A74703B2656D8913A99CDF28574E7031CE903818C8EBF23B7` |

**The two rejection codes differ and are both non-obvious:** blocked deposit → `tecEXPIRED`,
blocked withdrawal → `tecTOO_SOON`. Both are `tec` (ledger-included, fee burnt) so they are
demonstrable on an explorer — good for the guardrail requirement.

Minimum viable timing: `RedemptionDate - SubscriptionDate >= 180`, and a loan's final payment
must land at least `kLoanRedemptionBuffer` (60s) before `RedemptionDate`. With
`PaymentInterval = 60, PaymentTotal = 1`, a 180s investment window works.

---

## 10. Working transaction JSON

Closed-ended vault (`Scale` must be omitted for XRP):
```json
{ "TransactionType": "VaultCreate", "Account": "r...",
  "Asset": { "currency": "XRP" }, "WithdrawalPolicy": 1,
  "VaultKind": 1, "SubscriptionDate": 842528816, "RedemptionDate": 842528996 }
```

Loan broker with first-loss cover:
```json
{ "TransactionType": "LoanBrokerSet", "Account": "r...", "VaultID": "<64-hex>",
  "ManagementFeeRate": 500, "CoverRateMinimum": 1000, "CoverRateLiquidation": 1000 }
```

LoanSet — the two-party dance that actually works:
```js
const { Client, Wallet, signLoanSetByCounterparty } = require('xrpl') // MUST be 5.2.0 stable
const filled = await client.autofill({
  TransactionType: 'LoanSet', Account: borrower.classicAddress,
  LoanBrokerID: brokerID, PrincipalRequested: '10000000',
  PaymentInterval: 300, PaymentTotal: 4, InterestRate: 5000, GracePeriod: 120,
})
const firstParty = borrower.sign(filled)                              // borrower signs
const both = signLoanSetByCounterparty(brokerOwner, firstParty.tx_blob) // broker counter-signs
await client.submitAndWait(both.tx_blob)                              // submit the blob
```
Order is enforced: `signLoanSetByCounterparty` throws
`"Transaction must be first signed by first party."` if `TxnSignature`/`SigningPubKey` are absent,
and `"Transaction is already signed by the counterparty."` if re-applied.

Repayment:
```json
{ "TransactionType": "LoanPay", "Account": "<borrower>", "LoanID": "<64-hex>", "Amount": "50000015" }
```

Custom faucet (hackathon) — `client.fundWallet` does **not** work, see §11:
```bash
curl -sX POST https://lending-hackathon-faucet.dev.ripplex.io/accounts
# {"account":{"address":"r...","secret":"sEd..."},"balance":1000}
```
```js
const w = Wallet.fromSeed(resp.account.secret)
```

---

## 11. DevEx friction log

1. **[HIGH] `signLoanSetByCounterparty` is broken in `xrpl@5.2.0-beta.0` and `xrpl-py==5.2.0b0`.**
   Uses the `STX` prefix instead of `CPT`; `ripple-binary-codec@2.11.0-beta.0` does not export
   `encodeForSigningCounterparty`. Every `LoanSet` fails `Counterparty: Invalid signature`, and
   `LoanSet` cannot omit the signature (`temBAD_SIGNER`). Fix: backport the `SignatureRole`
   plumbing from `5.2.0` stable into the beta line, and add `_COUNTERPARTY_SIGNATURE_PREFIX =
   0x43505400` + `encode_for_signing_counterparty` to `xrpl-py`. Ship a regression test that
   signs against a `fixCleanup3_4_0`-enabled ledger.

2. **[HIGH] The hackathon brief mandates the broken version.** Track 2 says
   "xrpl.js@5.2.0-beta.0 REQUIRED", but stable `5.2.0` shipped 2026-09-11T22:20Z, before the
   event, and is the only version that works. Fix: update the brief to `xrpl@5.2.0`.

3. **[HIGH] `tfVaultDonation` does not exist.** Documented as the closed-ended interest
   mechanism; absent from rippled, both SDKs, and GitHub globally; live probes return
   `temINVALID_FLAG`. `VaultDeposit` has no flags at all. Fix: remove it from the brief and
   document that interest reaches lenders via `LoanPay` raising `Vault.AssetsTotal`.

4. **[HIGH] `LendingProtocolV1_1` means different things on the two devnets.** Both report it
   enabled, but rc1 (hackathon) permits a loan broker on an open-ended vault while rc5 (public)
   returns `tecNO_PERMISSION`. Amendment name is not a capability signal. Fix: publish the exact
   build/commit per network, or gate the open-ended restriction behind its own amendment.

5. **[MED] `client.fundWallet` cannot use the hackathon faucet.** `fundWallet` reads
   `body.account.classicAddress` (`src/Wallet/fundWallet.ts:171`); the hackathon faucet returns
   `{"account":{"address","secret"},"balance"}` with no `classicAddress`, no `xAddress`, no
   top-level `seed`. Result: `XRPLFaucetError: The faucet account is undefined` — an error that
   names neither the faucet nor the missing field. Fix: accept `account.address` as a fallback
   and name the offending host/field in the error.

6. **[MED] `GracePeriod` minimum is not validated client-side.** rippled requires
   `GracePeriod ∈ [60, PaymentInterval]` (`kDefaultGracePeriod = 60` used as the minimum in
   `validNumericRange`). `validateLoanSet` only rejects `GracePeriod > PaymentInterval`, so
   `GracePeriod: 30` passes validation and dies on-ledger as bare `temINVALID` with no field
   named. Cost me a full round-trip to diagnose. Fix: add the `>= 60` check with a message
   naming the field.

7. **[MED] `temINVALID` from `LoanSet` names no field.** Preflight has ~12 distinct
   `return temINVALID` sites (Data length, three fee minimums, principal, five rate ranges,
   PaymentTotal, PaymentInterval, GracePeriod) all returning the same opaque code. Fix: emit
   distinct codes or include the field name in the returned error / `JLOG` at `warn`.

8. **[MED] `SharesTotal` is not on the `Vault` object.** PPS is documented as
   `AssetsTotal / SharesTotal` but the entry exposes only `AssetsTotal`, `AssetsAvailable` and
   `ShareMPTID`; supply is `MPTokenIssuance.OutstandingAmount`, a second `ledger_entry` call.
   Zero-valued fields are also omitted entirely. Fix: document the two-call pattern and ship a
   `getVaultPricePerShare(client, vaultID)` helper.

9. **[MED] Closed-ended phase rejections use surprising, inconsistent codes.** Deposit outside
   subscription → `tecEXPIRED`; withdraw before redemption → `tecTOO_SOON`; `LoanSet` during
   redemption → `tecEXPIRED`. Neither code mentions vault phases. Fix: introduce
   `tecVAULT_WRONG_PHASE`, or document the mapping prominently.

10. **[LOW] Closed-ended fields are missing from stable `5.2.0`'s TypeScript types** even though
    its binary codec and `validate()` accept them, so TS users must cast. Conversely the beta's
    close-ended guardrails are absent from stable. Fix: port the `VaultKind` enum, the three
    fields and the validation block from the beta into the stable line.

11. **[LOW] `client.autofill` prints an unconditional `console.warn` on every `LoanSet`.** Noisy
    in scripted/CI use and not actionable. Fix: drop it, or route through a logger/`once` guard.

12. **[LOW] No `LoanDraw`/drawdown transaction exists**, but the brief lists "execute a drawdown"
    as a distinct deliverable. `LoanSet` transfers principal atomically at origination. Fix:
    reword the brief; document that origination and drawdown are one transaction.

---

## 12. Recommendation

- **Use `xrpl@5.2.0` (stable) for whichever track you pick.** It is the only library that can
  originate a loan, and it can create closed-ended vaults despite the missing TS types.
  Add a local `.d.ts` augmentation for `VaultKind`/`SubscriptionDate`/`RedemptionDate`.
- **Track 1 (hackathon devnet) is the lower-risk build**: open-ended vaults accept loan brokers
  there, wall-clock phase timing is irrelevant, and the faucet grants 1000 XRP (vs 100 on public
  devnet — the public faucet forces small test amounts).
- **Track 2 is fully verified as buildable** on public devnet, end to end, with real hashes — but
  every run is gated by wall-clock phases (min 180s investment window) and 100 XRP accounts.
- Items 1, 3 and 4 above are strong candidates for the "contributing back" bonus: a one-line
  prefix fix to `xrpl-py`, and a brief/docs correction on `tfVaultDonation`.
