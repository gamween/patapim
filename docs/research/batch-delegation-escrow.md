# batch-delegation-escrow — Batch (XLS-56), PermissionDelegation (XLS-75), TokenEscrow (XLS-85) against XLS-65/66 lending

Team patapim. Track 1 custom hackathon devnet, `rippled 3.4.0-rc1`, `network_id 4001`, `xrpl.js 5.2.0-beta.0`.
Source read: `XRPLF/rippled` tag `3.4.0-rc1`, commit `2ad4def35fd8580da027462517ba3375cc005c94` ("chore: Bump version to 3.4.0-rc1 (#8171)").

Scripts:
- `/Users/fianso/Development/hackathons/patapim/scripts/experiments/batch-delegation-escrow.mjs`
- `/Users/fianso/Development/hackathons/patapim/scripts/experiments/batch-delegation-escrow-2.mjs`
- `/Users/fianso/Development/hackathons/patapim/scripts/experiments/batch-delegation-escrow-3.mjs`

Every negative below is paired with a **control** that succeeds, so a failure is never just our malformed transaction.

---

## Headline

1. **The entire Vault + Loan family — all 15 transaction types — is hard-excluded from Batch.** Not amendment-gated, not configurable. Verified `temINVALID_INNER_BATCH`.
2. **The entire Vault + Loan family — all 15 transaction types — is non-delegable under XLS-75.** No tx-level permission, and zero granular permissions exist for any of them. Verified `temMALFORMED` x15, and `temINVALID` when a delegate tries anyway.
3. **XLS-66 has no collateral field at all.** `ltLOAN` (`include/xrpl/protocol/detail/ledger_entries.macro:546`) carries no collateral; the only credit protection is the LoanBroker's first-loss cover. So "escrowed IOU/MPT as loan collateral" is not a protocol feature and cannot be one today.
4. **But vault SHARES are escrowable by default, and the escrow-as-collateral loop works end to end.** A holder escrowed 50,000,000 vault shares to a counterparty, the counterparty finished the escrow and then redeemed 50 XRP out of a vault it had never deposited into. All `tesSUCCESS`.
5. **And that loop is batchable.** `Batch[EscrowCreate(vault shares), Payment]` = `tesSUCCESS`. Lending itself cannot be batched, but the escrow-of-shares pattern that substitutes for collateral can be — atomic "lock the collateral, release the cash".
6. **Escrow can never be sent to a pseudo-account**, so collateral can never be escrowed *to* a Vault or a LoanBroker. `tecNO_PERMISSION`, twice.

---

## 1. Batch (XLS-56 / `BatchV1_1`) x lending

### Ground truth in the source

`include/xrpl/tx/transactors/system/Batch.h:60-76`:

```cpp
static constexpr auto kDisabledTxTypes = std::to_array<TxType>({
    ttVAULT_CREATE, ttVAULT_SET, ttVAULT_DELETE, ttVAULT_DEPOSIT, ttVAULT_WITHDRAW,
    ttVAULT_CLAWBACK, ttLOAN_BROKER_SET, ttLOAN_BROKER_DELETE, ttLOAN_BROKER_COVER_DEPOSIT,
    ttLOAN_BROKER_COVER_WITHDRAW, ttLOAN_BROKER_COVER_CLAWBACK, ttLOAN_SET, ttLOAN_DELETE,
    ttLOAN_MANAGE, ttLOAN_PAY,
});
```

`src/libxrpl/tx/transactors/system/Batch.cpp:290-295` rejects any inner whose type is in that array with `temINVALID_INNER_BATCH`, **before** the `tfInnerBatchTxn` check and before inner preflight. The array is `constexpr` — it is not gated on `featureLendingProtocol`, `featureLendingProtocolV1_1` or `featureBatchV1_1`. There is no way to turn it on.

### Why it exists

`src/test/app/lending/LoanLifecycle_test.cpp:497-499`:

```cpp
// From FIND-001
testcase << "Batch Bypass Counterparty";
```

Both `src/test/app/Batch_test.cpp` (`testLoan`, lines 3139-3320) and `LoanLifecycle_test.cpp` (`testBatchBypassCounterparty`) are written against a compile-time toggle:

```cpp
bool const lendingBatchEnabled = !std::ranges::any_of(
    Batch::kDisabledTxTypes, [](auto const& disabled) { return disabled == ttLOAN_SET; });
```

and then assert `lendingBatchEnabled ? temBAD_SIGNATURE : temINVALID_INNER_BATCH`. So the full lending-in-batch behaviour is implemented and tested, and the exclusion list is a late mitigation for a finding (FIND-001) where a Batch could be used to forge/bypass the LoanSet counterparty signature. The test at `Batch_test.cpp:3264-3288` even documents the intended fee behaviour: "LoanSet normally charges at least 2x base fee, but since the signature check is done by the batch, it only charges the base fee."

xrpl.js was likewise built expecting it: `signMultiBatch` (`node_modules/xrpl/dist/npm/Wallet/batchSigner.js:63-70`) explicitly adds a `LoanSet` inner's `Counterparty` to the set of required batch signers.

### Live results (Track 1)

| # | Transaction | Result | Hash |
|---|---|---|---|
| 1.1 | **CONTROL** `Batch[Payment, Payment]`, `tfIndependent` | `tesSUCCESS` | `8E1BB6F0AFE0FA34A1E8C3DA785BAF42CB376BA4CB12A5303A2D46F106F6FA7D` |
| 1.2 | `Batch[VaultDeposit, LoanPay]`, `tfAllOrNothing` | `temINVALID_INNER_BATCH` | `CE57C84828F00B61DBCEBF6995FB25AA3523BD70C3183233C93BEDF0DF8AE66D` |
| 1.3 | `Batch[VaultDeposit, Payment]` | `temINVALID_INNER_BATCH` | `8DFDF17BADF8B89F553E1EE5943D7785481D8787C3F894102D0548B9E7F386D2` |
| 1.4 | `Batch[VaultCreate, Payment]` | `temINVALID_INNER_BATCH` | `6545E5A9B0E0458423785F59FF6CBF93C77ACCDC31BE871D5140BC0E52EE253E` |
| 1.5 | `Batch[LoanBrokerSet, Payment]` | `temINVALID_INNER_BATCH` | `3172D7CCFF9509ABE1F60F9E114CAF4DAD2379F31DDB6B370BE37A0B69E3C0EC` |

`engine_result_message`: `Malformed: Invalid inner batch transaction.`

The control proves the envelope (`tfInnerBatchTxn` on every inner, `Fee: "0"`, empty `SigningPubKey`, correct fee arithmetic, no `BatchSigners` needed because every inner account is the outer account) is correct. **Not our bug — a deliberate protocol exclusion.**

`temINVALID_INNER_BATCH` is a `tem` code: it never reaches a validated ledger, so `submitAndWait` cannot observe it. We read `engine_result` from the raw `submit` command; the hashes above are the locally computed transaction IDs.

### What IS batchable next to a vault

`Batch[EscrowCreate(vault shares), Payment]` with `tfAllOrNothing` — `tesSUCCESS`, hash `1849A91252370FD6DAAB205221F97BA8FE5413581B401FE0E1B6A79F525F18D2`.
After it, the holder's share MPToken reads `MPTAmount 140000000 / LockedAmount 60000000` and a share-denominated `Escrow` object exists. This is the atomic "pledge and pay" primitive that the lending family cannot give you.

### Docs check: **correct**

`https://xrpl.org/docs/references/protocol/transactions/types/batch` already documents this under `temINVALID_INNER_BATCH`: "Currently-disabled transactions include: LoanBrokerCoverClawback, LoanBrokerCoverDeposit, LoanBrokerCoverWithdraw, LoanBrokerDelete, LoanBrokerSet, LoanDelete, LoanManage, LoanPay, LoanSet, VaultCreate, VaultSet, VaultDelete, VaultDeposit, VaultWithdraw, and VaultClawback." Credit where due — this one is right and current.

---

## 2. PermissionDelegation (XLS-75 / `PermissionDelegationV1_1`) x lending

### Ground truth in the source

`include/xrpl/protocol/TxSettings.h:11,77`: `enum class Delegation { Delegable, NotDelegable };` with `Delegation delegable{Delegation::NotDelegable};` as the **default**.
In `include/xrpl/protocol/detail/transactions.macro`, not one of the 15 Vault/Loan `TRANSACTION(...)` entries sets `.delegable = Delegation::Delegable` (VaultCreate at :773, VaultSet :796, VaultDelete :812, VaultDeposit :827, VaultWithdraw :841, VaultClawback :859, LoanBrokerSet :889, LoanBrokerDelete :908, LoanBrokerCoverDeposit :921, LoanBrokerCoverWithdraw :934, LoanBrokerCoverClawback :952, LoanSet :965, LoanDelete :994, LoanManage :1006, LoanPay :1022). They all inherit `NotDelegable`.

Full tally for 3.4.0-rc1: **56 delegable, 26 non-delegable**. The 26: AccountSet, SetRegularKey, SignerListSet, AccountDelete, DelegateSet, VaultCreate, VaultSet, VaultDelete, VaultDeposit, VaultWithdraw, VaultClawback, Batch, LoanBrokerSet, LoanBrokerDelete, LoanBrokerCoverDeposit, LoanBrokerCoverWithdraw, LoanBrokerCoverClawback, LoanSet, LoanDelete, LoanManage, LoanPay, ConfidentialMPTConvert, SponsorshipTransfer, EnableAmendment, SetFee, UNLModify.

Granular permissions are the other escape hatch, and there are none: `include/xrpl/protocol/detail/permissions.macro` defines exactly 12, over only `ttTRUST_SET`, `ttACCOUNT_SET`, `ttPAYMENT` and `ttMPTOKEN_ISSUANCE_SET`. **Zero for any Vault or Loan type.**

Enforcement:
- `src/libxrpl/tx/transactors/delegate/DelegateSet.cpp:42-43` — `if (!Permission::getInstance().isDelegable(...)) return temMALFORMED;`
- `src/libxrpl/protocol/Permissions.cpp:254` — `delegable != Delegation::NotDelegable && amendmentEnabled(...)`
- `src/libxrpl/tx/Transactor.cpp:234-251` — if `sfDelegate` is present and the type is neither delegable nor granular, **preflight1 returns `temINVALID`**, short-circuiting before `checkPermission` ever runs.

`Permission::txToPermissionType` = `txType + 1` (`Permissions.cpp:259-262`), so VaultDeposit (ttVAULT_DEPOSIT = 68) has permission value 69.

### Live results (Track 1)

Controls first:

| # | Transaction | Result | Hash |
|---|---|---|---|
| 2.1 | **CONTROL** `DelegateSet Authorize=C Permissions=[Payment]` | `tesSUCCESS` | `EFBE6D9E4216EE744465D7A0B0D18D948B3B05A5FF2D2760F1FA8D3EB66728A5` |
| 2.2 | **CONTROL** C submits `Payment` with `Account=A, Delegate=C` | `tesSUCCESS` | `EEC3E3AD4D5DC5C6202E75D35CC093ED39E8E516976BE1FB145C4F4F3AF6B7F2` |

Resulting `Delegate` ledger object on A: `Permissions:[{"Permission":{"PermissionValue":"Payment"}}]`, index `282E0E7EAB25723EACAE09D45A24AE605B33DD977FA2546BB30EE6632B3F447A`.

Then all 15 lending permissions, one `DelegateSet` each — every one `temMALFORMED` ("Malformed transaction."):

| Permission | Hash |
|---|---|
| VaultCreate | `56047308CBD02D240830B2C00E64BF4355F61EDA6C7B3127BC544D538FF80400` |
| VaultSet | `B10708010DF9E5C778C0B5D8BE776ABC267614D08460B86BE428595090F5922B` |
| VaultDelete | `C5EEA941D8B1F921BDF66222361D3B355CC7EADFDDFCF5D73B809EB175CCEC51` |
| VaultDeposit | `6679479894678A7A90CC147CA2E27E0FDED2F73555E3A4A2D83EB92A9C3871B7` |
| VaultWithdraw | `85F51624F427E18FCEEDD74B05B005043F55FBD1ABB4F778053C03F078E3CB58` |
| VaultClawback | `20A64418D4D4B09ACEE05F11C1163F58E1C54AA107E2737DDD91EF9B33C169A6` |
| LoanBrokerSet | `7A969D2147123AD0E8C060E9FD1CE12506281FFD7B89126CC4913D009E90B6CF` |
| LoanBrokerDelete | `D9FDD1AD99373DD0D1CD3776443441833C501DEB3BBE36B3455E40D5C4BB41A5` |
| LoanBrokerCoverDeposit | `E5064A5795FFB283AE4A757E085774DE4765214229ED1F1B060DCAB68BA96777` |
| LoanBrokerCoverWithdraw | `6E118A2D32DF20B24220F6BA31E4C6FDB2FFD13620776B91D09BD1CBDC84B68A` |
| LoanBrokerCoverClawback | `9368BC54E29814CB2C616EABC5F5992AD1CC074778FD5F967D7E6B7A3D9ABC19` |
| LoanSet | `C69A99E8FA85B8B081D4D5E849691E32CCDB23D8947EB55DAF0E15F38DE32DBE` |
| LoanDelete | `307A9EFCDB8D2D02B8FCFB1218A523EC17307A8D31257D56D334CA8B680AC9D9` |
| LoanManage | `A39F4E8E92977DF8CB4CC8BC76D451466313678426363883A18875CBDE2F2F28` |
| LoanPay | `C0657D5047133C96AEC3BA25849364EAD459C6986D4A2D721924FD787D683949` |

Plus:
- `Permissions=[Payment, VaultDeposit]` → `temMALFORMED`, `4EB4BF9F5F868360E22854E597B53DFA2D3F43F66C658A1468BDFD53603D6895`. **One non-delegable entry poisons the whole array** — you cannot grant the good half.
- C submits `VaultDeposit` with `Account=A, Delegate=C` (no Delegate object could ever grant it) → **`temINVALID`**, "The transaction is ill-formed.", `C481860854DEA2876DE4D42B1B67E8B61054BF9DEE7E16B7A291395B0E28072E`. We predicted `terNO_DELEGATE_PERMISSION`; `Transactor::preflight1` (`Transactor.cpp:249-250`) short-circuits first. Worth knowing: **`terNO_DELEGATE_PERMISSION` is unreachable for a non-delegable type** — you get a `tem` code that looks like a client bug.
- Numeric permission values DO work on the wire: `DelegateSet Permissions=[{PermissionValue: 1}]` (1 = Payment) → `tesSUCCESS`, `C9FA910CC59F3AEF07598F4D4CDC6BCB31211AB6146731F7BD3DC0912A934793`, and the ledger object reads back as the string `"Payment"`. `PermissionValue: 69` (VaultDeposit) → `temMALFORMED`, `0A2EAC70F60E176ADBFFBB01BB3B80780BBABEC78696D7F4E3DEC85C5ABC1D3A`. These two had to be signed by hand with `ripple-binary-codec` + `ripple-keypairs` because xrpl.js refuses numeric values client-side (see friction F-3).

### Docs check

- `https://xrpl.org/docs/references/protocol/data-types/permission-values` **does** list all 15 Vault/Loan types as non-delegable, with the correct numeric values (VaultCreate 66, VaultDeposit 69, LoanPay 85 — consistent with `txType + 1`). Good.
- **But** the sentence introducing that table says: "If you attempt to grant these permissions to a delegate, the transaction fails with a result code such as `tecNO_PERMISSION`." That is wrong. `DelegateSet::preflight` returns **`temMALFORMED`** — confirmed 15 times on chain. The `DelegateSet` reference page gets it right ("temMALFORMED - One of the permissions can't be delegated"), so xrpl.org contradicts itself.

---

## 3. TokenEscrow (XLS-85) x vaults and loans

### Can an escrowed IOU or MPT serve as loan collateral? **No — there is no collateral in XLS-66 at all.**

`ltLOAN` (`include/xrpl/protocol/detail/ledger_entries.macro:546`) has no collateral field: Borrower, fees, rates, StartDate, PaymentInterval, GracePeriod, PaymentRemaining, PeriodicPayment, PrincipalOutstanding, TotalValueOutstanding, ManagementFeeOutstanding, LoanScale. `LoanSet` (`transactions.macro:965-992`) has no collateral field either. The only credit protection is the LoanBroker's first-loss cover (`LoanBrokerCoverDeposit`), posted by the broker, not the borrower. Loans are unsecured by construction. This is a **negative result that closes the question**: no escrow arrangement can be registered as collateral against a `Loan` object today.

### Can escrow and a vault touch the same asset? **Yes — and vault shares are escrowable by default.**

`src/libxrpl/tx/transactors/vault/VaultCreate.cpp:212-216`:

```cpp
std::uint32_t mptFlags = 0;
if (!tx.isFlag(tfVaultShareNonTransferable))
    mptFlags |= (lsfMPTCanEscrow | lsfMPTCanTrade | lsfMPTCanTransfer);
if (tx.isFlag(tfVaultPrivate))
    mptFlags |= lsfMPTRequireAuth;
```

Verified on chain: a plain `VaultCreate` produced a share `MPTokenIssuance` with `Flags = 56` = `0x38` = `lsfMPTCanEscrow (0x8) | lsfMPTCanTrade (0x10) | lsfMPTCanTransfer (0x20)`. With `tfVaultShareNonTransferable (0x00020000)`: `Flags = 0`.

**This is irreversible.** `VaultSet` (`transactions.macro:793-803`) accepts only `AssetsMaximum`, `DomainID`, `Data`. `VaultCreate` never sets `sfMutableFlags` on the share issuance, and the issuer is a pseudo-account that cannot sign an `MPTokenIssuanceSet`. Whatever you choose at creation is permanent for the life of the vault.

### The full collateral loop, end to end

| # | Transaction | Result | Hash |
|---|---|---|---|
| B1 | `VaultCreate` open-ended XRP (A) | `tesSUCCESS` | `9D6F7E15CD91DE45F79D68F9C15173D43A3042355472E9D955AD09B77727EB2A` |
| B2 | `VaultDeposit` 200 XRP (A) | `tesSUCCESS` | `EAD41698F127000540072AD9580427EBC08C892935FC62D3794A3F5AE5544D0A` |
| B3 | `MPTokenAuthorize` on the SHARE MPT by B, a non-depositor | `tesSUCCESS` | `F7E9B5E1AC7B18C3CA4F9E6F8F67A7B77F670B006410256FCAE3D0843819832C` |
| B4 | `EscrowCreate` 50,000,000 shares A → B | `tesSUCCESS` | `4CCB95E8A5EB5C08FEF6FD5FA92C1477DC0375453DA4C00AE3CE4D5E396D44C6` |
| B5 | `EscrowFinish` by B | `tesSUCCESS` | `34FC53501A08697556CBE80D3701CE50F04CF7FC494843766B1BE995D088EFDA` |
| B6 | `VaultWithdraw` by B using the seized shares | `tesSUCCESS` | `9FD50A89B301CDDA4AE36110E9B60B60E786AEADC98AF76D17277422CB12230B` |

Vault `62A555AF9842F84EDCDBD7E49C2AB062AC259ED8299362F2C489DB786F87A6C1`, share `0000000139AC1BEB0A5A90E77FF85297066FB6E411963479`.
B's XRP went 999,999,976 → 1,049,999,964 drops. Vault `AssetsTotal` 200,000,000 → 150,000,000. **B redeemed 50 XRP from a vault it never deposited into, purely by receiving escrowed shares.** That is a working, native, non-custodial collateral pledge-and-seize primitive for any XLS-65 vault position.

### Escrow accounting against the vault

After escrowing 25% of A's shares (hash `914D138D4896858DFBE14A3F29887CDE42A6A875F8BF898166ACCE39098FEDBF`):

- A's share `MPToken`: `MPTAmount 75000000`, **`LockedAmount 25000000`** — `lockEscrowMPT` (`src/libxrpl/ledger/helpers/MPTokenHelpers.cpp:717-777` (`sfMPTAmount` decremented at :756, `sfLockedAmount` incremented at :768-774)) subtracts from `sfMPTAmount` and adds to `sfLockedAmount`.
- Share `MPTokenIssuance`: `OutstandingAmount 100000000` **unchanged**, `LockedAmount 25000000` added.
- `Vault`: `AssetsTotal 100000000`, `AssetsAvailable 100000000` — **unchanged**. The vault does not know its shares are encumbered.

`VaultWithdraw` correctly respects the lock, because `accountHolds` for MPT reads `sfMPTAmount` only (`src/libxrpl/ledger/helpers/TokenHelpers.cpp:448`) and `VaultWithdraw.cpp:440-445` compares against it:

| Transaction | Result | Hash |
|---|---|---|
| `VaultWithdraw` of the FULL original share balance | `tecINSUFFICIENT_FUNDS` | `77770763BAE228E3AC2C5FA815908923DD7FCCBE89C5CEE890F5CB8FC6CB7FBB` |
| `VaultWithdraw` of the unlocked remainder only | `tesSUCCESS` | `6D96C9E2BA0DA3A26DCFF246F743C00F88D1CFDF8F4AE517C7282F22EBD5938D` |

Accounting is consistent — a clean negative result, no bug here.

### You cannot escrow anything TO a Vault or a LoanBroker

`src/libxrpl/tx/transactors/escrow/EscrowCreate.cpp:349-354`:

```cpp
// Pseudo-accounts cannot receive escrow. ...
if (isPseudoAccount(sled))
    return tecNO_PERMISSION;
```

| Transaction | Result | Hash |
|---|---|---|
| `EscrowCreate` XRP → vault pseudo-account `rGbGHhizFafk5r9HnuAMCXh3229NRhFT4G` | `tecNO_PERMISSION` | `5CEAEC78146E45D857D21998F4986143EBF89C209825F0919808F23E23A56B61` |
| `EscrowCreate` XRP → LoanBroker pseudo-account `rfkAF2ShDJQJBA7x6iHjn1KDtZXhqDKV4Q` | `tecNO_PERMISSION` | `997F16E685E755673CC0D586B56D53F87BE660E939C21FC487551F4FC929431E` |

(The LoanBroker was real: closed-ended vault `642FF95878516FAF7B92F501A1CB6BF2C298DA1E03AEBDC692DB774C1EA198B3`, `LoanBrokerSet` `3819CF01A3F44781256CAEDE9F63CEA3CBF334F4AB292BC83D641257E13A8B7B`, broker `9F5863664D2A51853E0BC13B425CA57C528C447ACFA8ADC8602814DC8E65C50F`. Note `LoanBrokerSet::preclaim` under `LendingProtocolV1_1` requires a **closed-ended** vault — `src/libxrpl/tx/transactors/lending/LoanBrokerSet.cpp:147-162`, returning `tecNO_PERMISSION` for an open-ended vault.)

So the obvious design — "borrower escrows collateral to the LoanBroker, broker releases on default" — is impossible. Collateral escrow must be peer-to-peer or to a tri-party account.

### Non-transferable shares cannot be escrowed

Vault created with `tfVaultShareNonTransferable` → share issuance `Flags = 0` (hash `AE2EC3E483620B01103861FEB3808FFFBC7A7C7F39339F75C27ED01456EB54FE`); `EscrowCreate` of its shares → `tecNO_PERMISSION`, hash `8C1B3B1FDE2066B4D5B6C4ABC28C78DDB5F39B77FE3B24B2605D157D6609BC9E`, from `EscrowCreate.cpp:280-282`.

### Other gates worth knowing (source-read, not exercised here)

- Escrowing an **IOU** requires the issuer to have `lsfAllowTrustLineLocking` set, and the issuer may not escrow its own IOU (`EscrowCreate.cpp:200-209`).
- The escrow **receiver must already hold an MPToken** for the issuance or `EscrowFinish` fails (`MPTokenHelpers.cpp:868-873`). We worked around it with `MPTokenAuthorize` (hash `F7E9B5E1AC7B18C3CA4F9E6F8F67A7B77F670B006410256FCAE3D0843819832C`) — note this succeeded for an account that had never touched the vault, which is what makes a public vault's shares freely pledgeable.

---

## What this means for Recall

- **Do not design any flow that needs two lending transactions to be atomic.** No Batch, no delegation. A LoanSet plus a cover top-up, or a LoanManage impair plus a clawback, are two separate transactions with a gap in between.
- **The lending agent cannot be a delegate.** An operations key cannot be granted `LoanManage` or `LoanBrokerCoverDeposit`. The only separation-of-duties tools left for a LoanBroker owner are the regular key and a SignerList — both all-or-nothing over the whole account. This is the single biggest institutional-custody blocker in XLS-66 today.
- **Collateral lives outside the loan, in escrow of vault shares.** Escrow to the broker is impossible, so collateral is a bilateral (or tri-party multisig) escrow whose `FinishAfter` is the loan's `GracePeriod` and whose `CancelAfter` returns it on repayment. Off-protocol linkage is unavoidable.
- **Pick share transferability at VaultCreate and never again.** For a securities-lending vault you want the default (escrowable, tradable, transferable). `tfVaultShareNonTransferable` would make the LP position un-pledgeable forever.
- **`Batch[EscrowCreate(shares), Payment]` works.** That is the one atomic primitive we can actually build on: lock the pledge and release the cash in a single transaction.

---

## DevEx friction (with proposed fixes)

### F-1 — xrpl.js `validateBatch` does not know about `Batch::kDisabledTxTypes`
- **Where**: `xrpl@5.2.0-beta.0`, `dist/npm/models/transactions/batch.js:14-40`, `validateBatchInnerTransaction`. It rejects nested Batch and a missing `tfInnerBatchTxn`, but has no list of disabled inner types.
- **Cost**: you sign, fee-calculate, round-trip to a node and get `temINVALID_INNER_BATCH` ("Malformed: Invalid inner batch transaction.") which names neither the offending inner nor its type.
- **Fix**: add, next to the existing checks, a set mirroring `Batch::kDisabledTxTypes`:
  `const DISABLED_INNER_BATCH_TRANSACTIONS = new Set(['VaultCreate','VaultSet','VaultDelete','VaultDeposit','VaultWithdraw','VaultClawback','LoanBrokerSet','LoanBrokerDelete','LoanBrokerCoverDeposit','LoanBrokerCoverWithdraw','LoanBrokerCoverClawback','LoanSet','LoanDelete','LoanManage','LoanPay'])`
  and throw `Batch: RawTransactions[${index}] TransactionType ${tx.TransactionType} cannot be an inner Batch transaction.`
- **Second fix, in rippled**: `Batch.cpp:290-295` should log which inner and which type. Today `JLOG` is silent on this branch while every neighbouring branch logs `"txID: " << hash`. One line.

### F-2 — xrpl.js `NON_DELEGABLE_TRANSACTIONS` is 17 entries short
- **Where**: `dist/npm/models/transactions/delegateSet.js:7-17`. It lists 9: AccountSet, SetRegularKey, SignerListSet, DelegateSet, AccountDelete, Batch, EnableAmendment, SetFee, UNLModify.
- **Ground truth**: rippled 3.4.0-rc1 has 26 non-delegable types. Missing from the SDK: all 6 Vault types, all 9 Loan types, ConfidentialMPTConvert, SponsorshipTransfer.
- **Cost**: `validate()` passes, the transaction is signed and submitted, and the node answers `temMALFORMED` / "Malformed transaction." — which names nothing at all. With a 10-entry `Permissions` array you have no idea which entry was rejected.
- **Fix**: extend the set to the full 26 and, better, generate it from `definitions.json` so it cannot drift again. rippled already carries the data in `transactions.macro` as `.delegable`; exporting it into `definitions.json` would let every client library derive the list.
- **Fix in rippled**: `DelegateSet::preflight` (`DelegateSet.cpp:42-43`) should `JLOG` the rejected permission value, and ideally return a distinct code (e.g. `temBAD_PERMISSION`) rather than bare `temMALFORMED`, which is also what a duplicate entry and a self-authorize return.

### F-3 — xrpl.js refuses numeric `PermissionValue` that the protocol accepts
- **Where**: `dist/npm/models/transactions/delegateSet.js:41-43` — `if (typeof permissionValue !== 'string') throw new ValidationError('DelegateSet: PermissionValue must be a string')`. The TypeScript type (`delegateSet.d.ts`) is `PermissionValue: string`.
- **Ground truth**: `ripple-binary-codec` encodes a number fine, and rippled accepts it — `PermissionValue: 1` gave `tesSUCCESS` (`C9FA910CC59F3AEF07598F4D4CDC6BCB31211AB6146731F7BD3DC0912A934793`). xrpl.org documents both forms and even warns "Not all client libraries support numeric PermissionValue types" — xrpl.js is one of them.
- **Fix**: widen the type to `string | number` and accept an integer in `[1, 65536] ∪ granular values`. We had to drop to `ripple-binary-codec` + `ripple-keypairs` and hand-sign to test this at all.

### F-4 — `temINVALID` when a delegate submits a non-delegable transaction
- **Where**: `src/libxrpl/tx/Transactor.cpp:242-250`.
- **Cost**: a delegate submitting `VaultDeposit` on someone's behalf gets `temINVALID` / "The transaction is ill-formed." That reads as "you built the transaction wrong", not "this transaction type can never be delegated". `terNO_DELEGATE_PERMISSION` exists and is exactly the right message, but is unreachable on this path. Hash `C481860854DEA2876DE4D42B1B67E8B61054BF9DEE7E16B7A291395B0E28072E`.
- **Fix**: return `temDISABLED` or a new `temNOT_DELEGABLE` with a distinct message, or at minimum `JLOG(ctx.j.debug())` the transaction type. The existing comment says the early exit is to keep non-delegable types out of `invokeCheckPermission` — that is fine, the code just needs to be legible.

### F-5 — xrpl.org contradicts itself on the DelegateSet failure code
- **Where**: `https://xrpl.org/docs/references/protocol/data-types/permission-values`, immediately above "List of Non-Delegable Permissions": *"If you attempt to grant these permissions to a delegate, the transaction fails with a result code such as `tecNO_PERMISSION`."*
- **Ground truth**: `temMALFORMED`, per `DelegateSet.cpp:42-43` and 15 transaction hashes above. `tecNO_PERMISSION` never occurs on this path — it is not even a `NotTEC`, so `preflight` could not return it. The sibling page `.../transactions/types/delegateset` says `temMALFORMED` correctly.
- **Fix**: change that sentence to "...fails with `temMALFORMED`." One-word docs PR.

### F-6 — `EscrowCreate` docs omit the pseudo-account rule
- **Where**: `https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate`. Its `tecNO_PERMISSION` entry says only "the issuer hasn't enabled the Allow Trust Line Locking flag for a Trust Line Token."
- **Ground truth**: `EscrowCreate.cpp:349-354` also returns `tecNO_PERMISSION` when the **Destination is a pseudo-account** (AMM, Vault, LoanBroker) — hashes `5CEAEC78...` and `997F16E6...`. It also returns `tecNO_PERMISSION` when the sender is the issuer (`:200-202`, `:270-272`) and when an MPT issuance lacks `lsfMPTCanEscrow` (`:280-282`).
- **Fix**: expand the `tecNO_PERMISSION` bullet into the four documented causes. This matters a lot for lending: "escrow the collateral to the LoanBroker" is the first thing everyone tries.

### F-7 — `VaultCreate` docs never say what flags the share issuance gets
- **Where**: `https://xrpl.org/docs/references/protocol/transactions/types/vaultcreate`. `tfVaultShareNonTransferable` is documented only as "Indicates the vault share is non-transferable."
- **Ground truth**: `VaultCreate.cpp:212-216`. Without the flag the share `MPTokenIssuance` is created with `lsfMPTCanEscrow | lsfMPTCanTrade | lsfMPTCanTransfer` (observed `Flags = 56`); with it, `Flags = 0`. `tfVaultPrivate` additionally adds `lsfMPTRequireAuth`. **And the choice is permanent** — `VaultSet` cannot change it and the pseudo-account issuer cannot sign an `MPTokenIssuanceSet`.
- **Why it matters**: by default, every depositor's LP position in every public vault is escrowable, tradable on the DEX and freely transferable. That is a real economic property a vault operator should be making deliberately.
- **Fix**: add to the VaultCreate page: "By default the vault's share MPTokenIssuance is created with the Can Escrow, Can Trade and Can Transfer flags. Set `tfVaultShareNonTransferable` to create it with no flags. This cannot be changed after the vault is created."

### F-8 — `submitAndWait` cannot observe `tem*` / `ter*` results
- **Where**: `xrpl@5.2.0-beta.0`. `tem` results never reach a validated ledger, so `client.submitAndWait()` throws or hangs and the `engine_result` is lost. Every negative test in this report had to use `client.submit()` and read `engine_result` manually.
- **Fix**: `submitAndWait` should reject immediately with an error carrying `engine_result` and `engine_result_message` whenever the initial `submit` returns a `tem*`, `tef*` or `tel*` code, instead of waiting for a validation that will never come. This is the single biggest time sink when probing new amendments.

### F-9 (mild, corrected) — `autofillBatchTxn` does not set `tfInnerBatchTxn`
- `dist/npm/sugar/autofill.js:298-339` fills `Sequence`, `Fee: '0'`, `SigningPubKey: ''` and `NetworkID` on every inner, but not the mandatory `tfInnerBatchTxn` flag that `Batch::preflight` requires (`Batch.cpp:297-303`, `temINVALID_FLAG`).
- **We predicted this would reach the network; it does not.** `validateBatchInnerTransaction` (`batch.js:18-20`) catches it client-side with a clear message: `Batch: RawTransactions[0] must contain the \`tfInnerBatchTxn\` flag.` Reported here as a small inconsistency, not a bug: everything else mandatory on an inner is autofilled, this one thing you must remember. **Fix**: set `txn.Flags = (txn.Flags ?? 0) | GlobalFlags.tfInnerBatchTxn` in `autofillBatchTxn`.

---

## Accounts and objects used

Track 1 (`lending-hackathon.dev.ripplex.io`):
- Run 1: A `rM8hX2JV3g5RtQJc1c15n4zZnDb6nKv6rJ`, B `rBgJBQeD13Kx4r8mdjR2q64hHDrBsLSwVA`, C `raopfE19fhwcrQsPSj9TJh5pjmZjxU45uu`.
  Vault `AC0FA02D734B046E93C6E21D6326349460061E7AF31C3D6810F783711BAB1AC6`, share `00000001AB04C8354D4CECE02F7423B628B77F665F2866D9`, pseudo `rGbGHhizFafk5r9HnuAMCXh3229NRhFT4G`.
  Closed vault `642FF958...`, LoanBroker `9F5863664D2A51853E0BC13B425CA57C528C447ACFA8ADC8602814DC8E65C50F`, broker pseudo `rfkAF2ShDJQJBA7x6iHjn1KDtZXhqDKV4Q`.
- Run 2: A `rGRQerv1pBjZD7SeNy2WeXinYi34rUzaYw`, B `rhSRcRnUvRKN2dnEV3MhJNiZ3QWKyWs7Qy`, vault `62A555AF9842F84EDCDBD7E49C2AB062AC259ED8299362F2C489DB786F87A6C1`.
- Run 3: A `rBgHsmYBfzGdbwZAuo73AerQrNeyZyVE6A`, B `rL9caa5DBoavagWShj2fA6Kfvh2nE1vVaC`, vault `9B66BD712747D1922C69993FD607B641002888C43B40A047DFC753ECFB2D54AA`.

## Open questions
- Not tested: whether a **private** vault (`tfVaultPrivate` → `lsfMPTRequireAuth` on shares) blocks escrow of shares to a counterparty that lacks the domain credential. `EscrowCreate.cpp:305-312` calls `requireAuth(..., AuthType::WeakAuth)` on both sender and destination, plus `canTransfer`, so it should — untested.
- Not tested: escrow of an **IOU** that is a vault's underlying asset, which additionally needs `lsfAllowTrustLineLocking` on the issuer (`EscrowCreate.cpp:204-209`).
- Not tested on Track 2 (public devnet, 3.4.0-rc5). `3.4.0-rc5` is not a public tag in `XRPLF/rippled`, so the exact source for that build could not be read. Behaviour is expected to be identical since `kDisabledTxTypes` and the `delegable` defaults are not amendment-gated, but that is an inference, not a measurement.
- No GitHub PR or issue could be found for `kDisabledTxTypes` via `gh api search/issues` or `search/code`; the only reference is the "FIND-001" comment in `LoanLifecycle_test.cpp:498`, which suggests an internal security-review identifier rather than a public issue.
