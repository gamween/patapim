# XRPL Lending Documentation Audit (slug: `docs-audit`)

Audit date: **2026-09-12**.
Docs source audited: `github.com/XRPLF/xrpl-dev-portal` @ commit `dc29bc4c895dd6268cdf1142cd7919f6dc8844b4` (2026-09-10, "Merge pull request #3917 from XRPLF/fast-follow-2") — this is the commit backing live xrpl.org.
Protocol source audited: `github.com/XRPLF/rippled` @ `develop` = `94037361992ad75b32a6b2659b655ab96b7cb7c2` (2026-09-10).
Spec audited: `github.com/XRPLF/XRPL-Standards` — `XLS-0065-single-asset-vault` (updated 2026-09-08), `XLS-0065/65.1`, `XLS-0066-lending-protocol` (updated 2026-09-09), `XLS-0066/66.2`.

Every claim below was verified against primary sources (rippled C++, live RPC on both devnets, npm/PyPI package contents). Reproduction commands are inline.

---

## 0. Network ground truth (verify before trusting any doc)

```bash
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"method":"server_info","params":[{}]}' \
  https://lending-hackathon.dev.ripplex.io:51234 | jq '.result.info|{build_version,network_id}'
# -> {"build_version":"3.4.0-rc1","network_id":4001}

curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"method":"server_info","params":[{}]}' \
  https://s.devnet.rippletest.net:51234/ | jq '.result.info|{build_version,network_id}'
# -> {"build_version":"3.4.0-rc5","network_id":2}
```

**Amendments — `LendingProtocolV1_1` is enabled on BOTH networks**, not only Track 2:

```bash
for h in https://lending-hackathon.dev.ripplex.io:51234 https://s.devnet.rippletest.net:51234/; do
  curl -s -X POST -H 'Content-Type: application/json' -d '{"method":"feature","params":[{}]}' $h \
  | jq -r '.result.features|to_entries[]|"\(.value.name)\t\(.value.enabled)"' | grep -iE 'lend|vault'
done
```
Both return:
```
LendingProtocol          true
SingleAssetVault         true
LendingProtocolV1_1      true
```
Also `fixCleanup3_4_0 = true` on both (this is the XLS-66.2 impairment-timing amendment).

**Implication for the build:** closed-ended vaults, cash-basis accounting, `VaultDelete.MemoData` and the new impairment timing are all live on the *custom hackathon devnet* too. Track 1 is not a "V1-only" network. Both networks expose an identical vault/loan field set and an identical flag set (`server_definitions` diff shows the only differences are unrelated smart-contract / confidential-MPT fields).

---

## 1. THE HEADLINE DEFECT — closed-ended vaults are 100% undocumented

The entire `LendingProtocolV1_1` closed-ended vault feature — which is Track 2's whole minimum bar — has **zero** coverage anywhere in the docs repo.

Exhaustive grep over the whole portal repo (`docs/` + `_code-samples/`):

```bash
cd xrpl-dev-portal
for t in VaultKind SubscriptionDate RedemptionDate "closed-ended" LendingProtocolV1_1 LEVersion "cash basis" VaultPhase tfVaultDonation; do
  echo "[$t] $(grep -ril "$t" docs _code-samples | tr '\n' ' ')"
done
```
Result: **`VaultKind`, `SubscriptionDate`, `RedemptionDate`, `closed-ended`, `LendingProtocolV1_1`, `LEVersion`, `cash basis`, `VaultPhase` → NOT FOUND ANYWHERE.**

Yet all of it is live. From `rippled/include/xrpl/protocol/detail/ledger_entries.macro` L501-523:

```cpp
LEDGER_ENTRY(ltVAULT, 0x0084, Vault, vault, ({
    ...
    {sfWithdrawalPolicy,     SoeRequired},
    {sfScale,                SoeDefault},
    {sfLEVersion,            SoeDefault},
    {sfVaultKind,            SoeDefault},
    {sfSubscriptionDate,     SoeOptional},
    {sfRedemptionDate,       SoeOptional},
    // no SharesTotal ever (use MPTIssuance.sfOutstandingAmount)
    // no PermissionedDomainID ever (use MPTIssuance.sfDomainID)
}))
```

and `transactions.macro` L~780:
```cpp
TRANSACTION(ttVAULT_CREATE, 65, VaultCreate, ..., ({
    {sfAsset, SoeRequired, SoeMptSupported},
    {sfAssetsMaximum, SoeOptional},
    {sfMPTokenMetadata, SoeOptional},
    {sfDomainID, SoeOptional},
    {sfWithdrawalPolicy, SoeOptional},
    {sfData, SoeOptional},
    {sfScale, SoeOptional},
    {sfVaultKind, SoeOptional},
    {sfSubscriptionDate, SoeOptional},
    {sfRedemptionDate, SoeOptional},
}))
```

Confirmed live on both devnets:
```bash
curl -s -X POST -H 'Content-Type: application/json' -d '{"method":"server_definitions","params":[{}]}' \
  https://s.devnet.rippletest.net:51234/ \
| jq -r '.result.FIELDS[]|select(.[0]|test("^(VaultKind|SubscriptionDate|RedemptionDate|LEVersion)$"))|"\(.[0]) \(.[1].type) nth=\(.[1].nth)"'
# VaultKind UInt8 nth=22 ; SubscriptionDate UInt32 nth=75 ; RedemptionDate UInt32 nth=76
```

### The facts the docs should contain (from `rippled/include/xrpl/protocol/Protocol.h`)

```cpp
enum class VaultVersion : uint8_t { Legacy = 0, CashBasis };   // sfLEVersion
enum class VaultKind : std::uint8_t { OpenEnded = 0, ClosedEnded = 1 };  // sfVaultKind
enum class VaultPhase : std::uint8_t { NoPhase = 0, Subscription, Investment, Redemption };

constexpr std::uint32_t kLoanRedemptionBuffer = 60;        // seconds
constexpr std::uint32_t kMinInvestmentPeriod  = 180;       // seconds
constexpr std::uint32_t kMaxInvestmentPeriod  = 946708560; // 30 Gregorian years
```

From `include/xrpl/ledger/helpers/VaultHelpers.h`:
- Phase derives from the **parent ledger close time** vs the two immutable dates.
- "Subscription is inclusive of `now == SubscriptionDate`; Investment starts strictly after."
- `isValidClosedEndedGap(sub, red)` requires `kMinInvestmentPeriod <= (red - sub) < kMaxInvestmentPeriod`, i.e. **at least 180 seconds** between the two dates.
- `VaultInvariant.h`: "Immutability of VaultKind, SubscriptionDate and RedemptionDate is enforced" — the dates cannot be changed after `VaultCreate`.

`VaultCreate::preflight` (`src/libxrpl/tx/transactors/vault/VaultCreate.cpp`) rejects, all with `temMALFORMED`:
- `VaultKind` present but not 0 or 1;
- `SubscriptionDate`/`RedemptionDate` present when kind is not ClosedEnded;
- ClosedEnded without **both** dates;
- a gap outside `[180s, 30y)`.

`VaultCreate::preclaim` returns **`tecEXPIRED`** if either date is already in the past.

### Phase enforcement — the exact rejection codes (Track 2's required demo)

| Action | Phase | Result | Source |
|---|---|---|---|
| `VaultDeposit` | Investment **or** Redemption | **`tecEXPIRED`** | `VaultDeposit.cpp` L110-118 |
| `VaultWithdraw` | Investment | **`tecTOO_SOON`** | `VaultWithdraw.cpp` L90-97 |
| `LoanSet` | Subscription | **`tecTOO_SOON`** | `LoanSet.cpp` L319-326 |
| `LoanSet` | Redemption | **`tecEXPIRED`** | `LoanSet.cpp` L327-331 |
| `LoanSet` | Investment, final payment within 60s of `RedemptionDate` | **`tecNO_PERMISSION`** | `LoanSet.cpp` L332-343 |

`LoanSet.cpp` L332-343 verbatim:
```cpp
if (phase == VaultPhase::Investment)
{
    auto const finalPayment =
        std::uint64_t{getStartDate(ctx.view)} + (std::uint64_t{interval} * total);
    if (finalPayment + kLoanRedemptionBuffer > vault->at(sfRedemptionDate))
    {
        JLOG(ctx.j.warn())
            << "Final loan payment date is fewer than " << kLoanRedemptionBuffer
            << " seconds before the vault's redemption date.";
        return tecNO_PERMISSION;
    }
}
```
with `getStartDate(view) = view.header().closeTime.time_since_epoch().count()` (L226-229) — i.e. **`StartDate` is the ledger close time at origination; `LoanSet` has no `StartDate` input field.**

**None of `tecEXPIRED`, `tecTOO_SOON` or this `tecNO_PERMISSION` case appears on any of the VaultDeposit / VaultWithdraw / LoanSet reference pages.**

### `tfVaultDonation` does not exist

Verified three ways — it is **not** a real flag:
```bash
curl -s -X POST -H 'Content-Type: application/json' -d '{"method":"server_definitions","params":[{}]}' \
  https://s.devnet.rippletest.net:51234/ | jq -r '.result.TRANSACTION_FLAGS|to_entries[]|select(.key|test("Vault|Loan"))'
```
Live output (identical on both devnets):
```
LoanManage:  {"tfLoanDefault":65536,"tfLoanImpair":131072,"tfLoanUnimpair":262144}
LoanPay:     {"tfLoanFullPayment":131072,"tfLoanLatePayment":262144,"tfLoanOverpayment":65536}
LoanSet:     {"tfLoanOverpayment":65536}
VaultCreate: {"tfVaultPrivate":65536,"tfVaultShareNonTransferable":131072}
```
`VaultDeposit` has **no flags at all**. `grep -rn "Donation" rippled/include/xrpl/protocol/ rippled/src/libxrpl/tx/transactors/vault/` → no matches. `xrpl.js@5.2.0-beta.0`'s `VaultDeposit` model is `{ VaultID, Amount }` only.

Under `LendingProtocolV1_1` + `VaultVersion::CashBasis`, yield reaches the vault through `LoanPay` (interest is recognised when a payment delivers it), via `cash_basis::` dispatchers in `include/xrpl/ledger/helpers/LendingHelpers.h` L369-386:
```
// Public dispatchers: pick cash_basis:: if featureLendingProtocolV1_1 is
// enabled AND the Vault's LEVersion (VaultHelpers::getVaultVersion) is
// VaultVersion::CashBasis, else accrual::.
```
`LoanSet.cpp` L346-352 confirms the divergence:
```cpp
// Accrual origination credits interestDue into AssetsTotal, so a vault
// already at AssetsMaximum cannot take another loan. Cash-basis origination
// does not change AssetsTotal (see cash_basis::loanOriginationDeltas), so
// this leftover accrual gate must not apply there.
```

---

## 2. Pages that do not exist

| Requested URL | HTTP | Reality |
|---|---|---|
| `https://xrpl.org/docs/tutorials/lending` | **404** | never existed |
| `https://xrpl.org/docs/concepts/tokens/single-asset-vault` (singular) | **404** | real page is `single-asset-vaults` (plural) |
| `https://xrpl.org/docs/tutorials/defi/lending` | **404** | no index page; `sidebars.yaml` L236 declares a `group: Set Up Lending` with **no landing page** |

`docs/tutorials/defi/lending/` contains only two subdirectories and no `index.md`. Every other major tutorial area has a landing page.

Sidebar ordering is also backwards (`sidebars.yaml` L236-256):
```yaml
- group: Set Up Lending
  items:
    - group: Use the Lending Protocol      # listed FIRST
        - create-a-loan-broker
        - claw-back-cover                  # before deposit-and-withdraw-cover
        - deposit-and-withdraw-cover
        - create-a-loan
        ...
    - group: Use Single Asset Vaults       # listed SECOND, but is the prerequisite
```
You cannot create a loan broker without a vault, and you cannot claw back cover you have not deposited.

---

## 3. Reference pages — field tables vs rippled source

Diff produced by parsing `transactions.macro` and each page's field table:

| Transaction page | Fields in source but **missing from the docs** |
|---|---|
| `vaultcreate` | **`VaultKind`, `SubscriptionDate`, `RedemptionDate`** |
| `vaultdelete` | **`MemoData`** |
| `vaultwithdraw` | **`CredentialIDs`** |
| `loanbrokercoverwithdraw` | **`CredentialIDs`** |
| `loanset` | `CounterpartySignature` (absent from the main table; only a sub-section) |

`VaultDelete.MemoData` is specified in XLS-65.1 ("Vault Deletion Memo"), gated on `LendingProtocolV1_1`, and enforced in `VaultDelete.cpp` L33-38:
```cpp
if (ctx.tx.isFieldPresent(sfMemoData) && !ctx.rules.enabled(featureLendingProtocolV1_1))
    return temDISABLED;
// The sfMemoData field is an optional field used to record the deletion reason.
if (!validDataLength(ctx.tx[~sfMemoData], kMaxDataPayloadLength))   // 256 bytes
    return temMALFORMED;
```

`VaultWithdraw.CredentialIDs` is especially confusing because the page states:
> "The `VaultWithdraw` transaction does not respect the Permissioned Domain rules."

…while the transaction nevertheless accepts `CredentialIDs` (for the *destination's* deposit authorisation). The page never explains this.

### Ledger entry pages

`Vault` entry page omits **`LEVersion`, `VaultKind`, `SubscriptionDate`, `RedemptionDate`**.

The page also never states where two things a developer needs actually live. rippled says it outright in `ledger_entries.macro`:
```cpp
// no SharesTotal ever (use MPTIssuance.sfOutstandingAmount)
// no PermissionedDomainID ever (use MPTIssuance.sfDomainID)
```
- The concepts page defines `Γ_shares` = "the total number of shares currently issued by the vault" and PPS = `AssetsTotal / SharesTotal`, but **`SharesTotal` is not a field on anything**. You must read `vault_info` → `shares.OutstandingAmount`.
- `VaultCreate` takes `DomainID` as input, but the `Vault` entry has no `DomainID`; it is on the share `MPTokenIssuance`. `VaultHelpers.h` confirms: *"The domain is read from the share issuance rather than from the vault."*

---

## 4. Error codes documented vs returned by the transactor

Generated by diffing `grep -oE '\b(tem|tec|ter|tef)[A-Z_]+'` over each `src/libxrpl/tx/transactors/**/<Tx>.cpp` against each reference page's error table.

**In the source but NOT documented:**

| Page | Undocumented codes actually returned |
|---|---|
| `vaultcreate` | `tecWRONG_ASSET`, `terADDRESS_COLLISION`, `tecEXPIRED` |
| `vaultdelete` | `temDISABLED`, `temMALFORMED`, `tecOBJECT_NOT_FOUND` |
| `vaultdeposit` | **`tecEXPIRED`**, `tecPATH_DRY`, `tecPRECISION_LOSS` |
| `vaultwithdraw` | **`tecEXPIRED`, `tecTOO_SOON`**, `tecHAS_OBLIGATIONS`, `tecPRECISION_LOSS`, `tecPSEUDO_ACCOUNT` |
| `vaultclawback` | `tecHAS_OBLIGATIONS`, `tecPATH_DRY`, `tecPSEUDO_ACCOUNT` |
| `loanbrokerset` | `tecLIMIT_EXCEEDED`, `tecPRECISION_LOSS` |
| `loanbrokerdelete` | `tecNO_PERMISSION` (see typo below), `temINVALID` |
| `loanbrokercoverdeposit` | `tecPRECISION_LOSS` |
| `loanbrokercoverwithdraw` | `tecPSEUDO_ACCOUNT` |
| `loanbrokercoverclawback` | `tecOBJECT_NOT_FOUND` |
| `loanset` | **`tecEXPIRED`, `tecTOO_SOON`**, `tecKILLED`, `tecDUPLICATE`, `tecMAX_SEQUENCE_REACHED`, `tecPRECISION_LOSS`, `temINVALID_FLAG`, `terNO_ACCOUNT`, `terNO_RIPPLE` |
| `loanpay` | **`tecINSUFFICIENT_FUNDS`**, `tecLIMIT_EXCEEDED`, `tecDUPLICATE`, `tecPRECISION_LOSS`, `temINVALID_FLAG` |

`LoanPay` missing `tecINSUFFICIENT_FUNDS` is the worst of these: it is the single most likely failure a borrower hits, and it is not on the page.

**Typo — a result code that does not exist.**
`docs/references/protocol/transactions/types/loanbrokerdelete.md` documents **`tec_NO_PERMISSION`** (underscore after `tec`). No such code exists. Correct spelling: `tecNO_PERMISSION`.

---

## 5. Statements that are wrong against the source

### 5.1 `DomainID` does not create a private vault — it requires one

`vaultcreate.md`, `DomainID` row:
> "The `PermissionedDomain` object ID associated with the shares of this vault. **If provided, the transaction creates a private vault**, which restricts access to accounts with credentials in the specified Permissioned Domain."

`VaultCreate.cpp` preflight L76-84:
```cpp
if (auto const domain = ctx.tx[~sfDomainID])
{
    if (*domain == beast::kZero)
        return temMALFORMED;
    if (!ctx.tx.isFlag(tfVaultPrivate))
        return temMALFORMED;  // DomainID only allowed on private vaults
}
```
Passing `DomainID` **without** `tfVaultPrivate` returns `temMALFORMED`. Copy the documented behaviour and the transaction fails.
**Fix:** "Requires the `tfVaultPrivate` flag. Supplying `DomainID` without `tfVaultPrivate`, or a `DomainID` of all zeroes, returns `temMALFORMED`."

### 5.2 `Scale` must be **omitted** for XRP and MPT vaults, not set to 0

`vaultcreate.md` / `vault.md` / `vault_info.md` all say:
> "For **XRP** and **MPTs**, this is fixed at `0`."

`VaultCreate.cpp` L96-105:
```cpp
if (auto const scale = ctx.tx[~sfScale])
{
    auto const vaultAsset = ctx.tx[sfAsset];
    if (vaultAsset.holds<MPTIssue>() || vaultAsset.native())
        return temMALFORMED;
    if (scale > kVaultMaximumIouScale)   // 18
        return temMALFORMED;
}
```
Presence of `Scale` on an XRP or MPT vault is `temMALFORMED` regardless of value — including `Scale: 0`.
**Fix:** "Trust line tokens only. Must be **omitted** for XRP and MPT vaults; including it at all — even as `0` — returns `temMALFORMED`."

### 5.3 Impairment behaviour is documented as the pre-amendment behaviour (two pages)

`docs/concepts/tokens/lending-protocol.md`, "Impairment":
> "The impairment mechanism **moves the due date of the next payment to the time the loan is impaired**, allowing the loan to default more quickly. However, if the borrower makes a payment before that date, the impairment status is automatically cleared."

`docs/references/protocol/ledger-data/ledger-entry-types/loan.md`, admonition:
> "The impairment mechanism **moves up the `NextPaymentDueDate`** to the time the loan is impaired, allowing the loan to default quicker."

XLS-66.2 ("Lending Protocol Impairment Timing", created 2026-09-04, updated 2026-09-09), abstract:
> "Under the `fixCleanup3_4_0` amendment, a Loan can be impaired only after its payment is already overdue; impairing and unimpairing **leave `Loan.NextPaymentDueDate` unchanged**, and the payment due-date and default grace-period boundaries are exclusive: a payment is late only when the current ledger close time is greater than `Loan.NextPaymentDueDate`, and default is allowed only when it is greater than `Loan.NextPaymentDueDate + Loan.GracePeriod`. Equality at either boundary is not expired."

`fixCleanup3_4_0` is **enabled = true on both devnets** (verified above). Both doc passages therefore describe behaviour that no longer exists on any network a hackathon team can reach. `loanmanage.md` likewise never mentions that impair now fails when the payment is not yet overdue.

### 5.4 Concept page invents field names that do not exist

`docs/concepts/tokens/lending-protocol.md`, first-loss-capital worked example, uses `PrincipleOutstanding` (5 occurrences) and `SharesTotal`.
- The real field is **`PrincipalOutstanding`** (`ledger_entries.macro` L~620). "Principle" is a different English word; grepping for it in the SDKs finds nothing.
- **`SharesTotal` is not a field on any ledger entry** (`// no SharesTotal ever`). Same page also writes "outstanding loan **principle**" in the payment-processing section.

### 5.5 An arithmetic formula that contradicts its own worked value

Same page:
```
DebtTotal       = DebtTotal - PrincipleOutstanding + InterestOutstanding
                = 1,090 - (1,000 + 90)
                = 0 Tokens
```
As written, `1090 - 1000 + 90 = 180`, not `0`. The parentheses are missing from the formula.
**Fix:** `DebtTotal = DebtTotal - (PrincipalOutstanding + InterestOutstanding)`.

### 5.6 Interest rates and fees lists are incomplete and use non-field names

Concept page says "There are **three** interest rates associated with a loan": Interest Rate, Late Interest Rate, **"Full Payment Rate"**.
Actual `Loan` fields: `InterestRate`, `LateInterestRate`, **`CloseInterestRate`**, **`OverpaymentInterestRate`** — four, and "Full Payment Rate" maps to no field name.

Fees list gives "**Early Payment Fee**" and omits `OverpaymentFee`.
Actual `Loan` fee fields: `LoanOriginationFee`, `LoanServiceFee`, `LatePaymentFee`, **`ClosePaymentFee`**, **`OverpaymentFee`**, plus `LoanBroker.ManagementFeeRate`.

---

## 6. Code samples in the reference pages that will not work as written

### 6.1 `loanset.md` — the example JSON omits the required `LoanBrokerID`

The field table marks `LoanBrokerID` **Required? = Yes**. The example JSON block does not contain it. Copy-paste → the transaction is rejected.

The same example also includes `"hash": "831EEFF1..."` and lists `hash` in the **fields table** as `Required? Yes`, Internal Type `Hash256`. `hash` is not a transaction field at all — it is computed and returned by the server. `SigningPubKey` and `TxnSignature` are likewise [common fields], not `LoanSet` fields.

### 6.2 Invalid JSON in published code blocks

Programmatic check of every ```` ```json ```` block across the lending docs:

| File | Line | Problem |
|---|---|---|
| `ledger-entry-types/vault.md` | 22 | **trailing comma** after `"WithdrawalPolicy": 1,` → not parseable |
| `transactions/types/vaultwithdraw.md` | 31 | **trailing comma** after `"VaultID": "A7B7…",` → not parseable |
| `vault-methods/vault_info.md` | 160 | Commandline tab uses a ```` ```json ```` fence containing `Loading: "/etc/xrpld.cfg"` / `Connecting to 127.0.0.1:5005` — not JSON. The *request* Commandline tab (L43) correctly uses ```` ```sh ````. |

### 6.3 Ledger-entry examples serialise `Number` and `UInt64` fields as JSON numbers

`STNumber::getText()` (`src/libxrpl/protocol/STNumber.cpp` L50-53) is `return to_string(value_);` — STNumber fields **always** come back from the ledger as JSON **strings**. UInt64 fields likewise serialise as strings.

`loanbroker.md` example emits `"DebtTotal": 50000`, `"DebtMaximum": 100000`, `"CoverAvailable": 10000`, `"OwnerNode": 2`, `"VaultNode": 1` — all numbers, all contradicting that page's own field table (which says JSON Type `String` for the Number fields). `loan.md` does the same for `LoanOriginationFee`, `PrincipalOutstanding`, `TotalValueOutstanding`, `ManagementFeeOutstanding`, `PeriodicPayment`, `OwnerNode`, `LoanBrokerNode`.

A real response proves it — from `vault_info.md`'s own example on the same site: `"OwnerNode": "0"`, `"OutstandingAmount": "0"`.

Worse, the two ledger-entry pages disagree with each other for the *same* internal type: `vault.md` lists `OwnerNode` as JSON Type **String**; `loanbroker.md` and `loan.md` list it as **Number**.

`loanbroker.md` and `loan.md` also emit `"Flags": "0"` — a string — where Flags is a number.

### 6.4 `loanpay.md` example uses a bare-number `Amount`

```json
"Amount": 1000,
```
`Amount` is an `STAmount`. For XRP it must be a **string of drops** (`"1000"`); for a token, an object. Written this way it does not round-trip.

---

## 7. `vault_info` reference page

`docs/references/http-websocket-apis/public-api-methods/vault-methods/vault_info.md`

1. **Vault Description Object table is wrong on types.** It lists `Flags` as **String** and `WithdrawalPolicy` as **String**; the page's own example response shows `"Flags": 65536` and `"WithdrawalPolicy": 1` (numbers). It lists `AssetsAvailable`/`AssetsTotal`/`LossUnrealized` as **Number**; they are returned as strings.
2. **Table omits fields the example response contains:** `Data`, `LedgerEntryType`, `Owner`, `OwnerNode`, `PreviousTxnID`, `PreviousTxnLgrSeq`, `Sequence`.
3. **Table omits `VaultKind`, `SubscriptionDate`, `RedemptionDate`, `LEVersion`** — so there is no documented way to read a closed-ended vault's phase.
4. **Undocumented error.** Page lists only `invalidParams`. Live:
   ```bash
   curl -s -X POST -H 'Content-Type: application/json' \
     -d '{"method":"vault_info","params":[{"vault_id":"9E48171960CD9F62C3A7B6559315A510AE544C3F51E02947B5D4DAC8AA66C3BA"}]}' \
     https://s.devnet.rippletest.net:51234/
   # {"error":"entryNotFound","error_code":98,"error_message":"Entry not found.",...}
   ```
5. **`Scale` vs `AssetScale` confusion.** The Vault object carries `Scale`; the `shares` object carries `AssetScale`. Both are documented as "decimal precision for share calculations" with no explanation of the difference. `server_definitions` confirms two distinct fields: `Scale` (UInt8 nth=4) and `AssetScale` (UInt8 nth=5).
6. **Never says `shares.OutstandingAmount` is the share supply** — the only route to computing PPS.
7. **Frontmatter inconsistency:** the page has no `status`, no `requiredAmendment`, and no `{% amendment-disclaimer %}`, despite requiring `SingleAssetVault`. Every vault/loan transaction page has all three.

---

## 8. Undocumented defaults on `LoanSet`

`loanset.md` lists `PaymentInterval`, `PaymentTotal`, `GracePeriod` as `Required? No` with **no stated default**. You cannot compute a payment schedule without them. From `include/xrpl/tx/transactors/lending/LoanSet.h` L65-72:

```cpp
static constexpr std::uint32_t kDefaultPaymentTotal    = 1;
static constexpr std::uint32_t kMinPaymentInterval     = 60;
static constexpr std::uint32_t kDefaultPaymentInterval = 60;
static constexpr std::uint32_t kDefaultGracePeriod     = 60;
```

Also undocumented: `LoanSet.cpp` L254-258 returns **`tecKILLED`** when `GracePeriod` exceeds the remaining protocol time (`kMaxTime = 4'294'967'295` minus the ledger close time) — a bare `tecKILLED` with no page entry is unguessable.

`loanset.md` does document `temINVALID` as "the `GracePeriod` can't be longer than the `PaymentInterval` or less than `60` seconds", but never states the defaults themselves.

---

## 9. Stale `[[Source]]` links compound the field gaps

`vault.md`, `loan.md` and `loanbroker.md` each carry a hard-pinned source link:
```
[[Source]](https://github.com/XRPLF/rippled/blob/a5d238e7d4fa6ef2b539b759d58744d0a1c33c0c/include/xrpl/protocol/detail/ledger_entries.macro#L478-L496 "Source")
```
Commit `a5d238e7…` is dated **2026-05-20** (`GET /repos/XRPLF/rippled/commits/a5d238e7…` → `commit.committer.date = 2026-05-20T19:46:45Z`), ~4 months behind the docs commit. Fetching that file at that commit, L478-496 is indeed `ltVAULT` — but **that snapshot has no `sfLEVersion`, `sfVaultKind`, `sfSubscriptionDate`, `sfRedemptionDate`.**

So a developer who distrusts the field table and clicks "Source" to check gets a stale snapshot that *agrees* with the stale table. Line-pinned permalinks to a 4-month-old commit are worse than no link.

The transaction pages use a different, better mechanism (`{% source-link path="src/libxrpl/tx/transactors/vault/VaultCreate.cpp" /%}`, branch-relative). The two systems should be unified on the branch-relative one.

---

## 10. Copy-paste and consistency defects (small but cheap to fix)

| File | Text | Correction |
|---|---|---|
| `vaultdelete.md` | "Besides errors that can occur for all transactions, **VaultCreate** transactions can result in…" | `VaultDelete` |
| `loanbroker.md` | `Data` = "Arbitrary metadata about the **vault**." | "…about the loan broker." |
| `loanbroker.md` | "## LoanBroker Reserve — **`Loan` entries** incur one owner reserve from the account that creates it." | "`LoanBroker` entries incur…" |
| `loanbroker.md` | `Owner` = "The account address of the **vault owner**." | "…of the LoanBroker owner." |
| `loan.md` | `PreviousPaymentDueDate` = "The timestamp of when the previous payment **was made**" | "…when the previous payment **was due**" (field is `sfPreviousPaymentDueDate`) |
| `loanmanage.md` | "Indicates **the the** loan should be impaired." (×2) | "the" |
| `lending-protocol.md` L11 | "**depostitor** protections" | "depositor" |
| `loanbroker.md` L91 | `[ticket](/docs/concepts/accounts/tickets.md)` — absolute path **with** `.md` | `vault.md` L~140 uses the relative form `[Ticket](../../../../concepts/accounts/tickets)`; unify |
| `vaultdelete.md` | Common-fields link is an absolute `https://xrpl.org/...` URL | every sibling page uses a relative link |
| `vaultcreate.md` frontmatter | no `status: not_enabled` | every other vault/loan tx page has it, so VaultCreate renders without the "not enabled" banner |
| `vaultcreate.md` example | `"Fee": "5000000"` (5 XRP) | the page's own "Transaction Cost" section says the cost is the incremental owner reserve, "currently 0.2 XRP" = `"200000"` drops. The example is 25× that. |
| `vaultcreate.md` | `WithdrawalPolicy` "The default value is `0x0001`" | the field is a `UInt8`; hex notation for a one-byte enum reads as a flag. Say `1`. Also: `VaultCreate.cpp` L69-72 rejects **any** value other than 1 with `temMALFORMED` — including `0`. |
| `vaultcreate.md` | `MPTokenMetadata` "limited to 1024 bytes" | also: an **empty** `MPTokenMetadata` is `temMALFORMED` (`metadata->empty() \|\| metadata->length() > kMaxMpTokenMetadataLength`) |
| `vault.md` | `ShareMPTID` Internal Type **`UInt192`** | `server_definitions` says **`Hash192`**: `jq '.result.FIELDS[]\|select(.[0]=="ShareMPTID")'` → `{"type":"Hash192","nth":2}` |
| `vault.md` Flags table | only `lsfVaultPrivate` | there is no `lsf` flag for non-transferable shares; transferability is read from `lsfMPTCanTransfer` on the share `MPTokenIssuance`. The page should say so. |
| `lending-protocol.md` | "asset issuers can [claw back](…/types/clawback.md) funds from the vault" | links to the generic `Clawback` transaction; the relevant ones are `VaultClawback` and `LoanBrokerCoverClawback` |

---

## 11. SDK / tooling friction found while auditing

### 11.1 `xrpl-py` cannot build a closed-ended vault at all

```bash
curl -s https://raw.githubusercontent.com/XRPLF/xrpl-py/main/xrpl/models/transactions/vault_create.py \
  | grep -cE 'vault_kind|subscription_date|redemption_date'   # -> 0
curl -s https://raw.githubusercontent.com/XRPLF/xrpl-py/main/xrpl/models/transactions/vault_delete.py \
  | grep -c memo_data                                          # -> 0
```
`xrpl-py` main (latest release 5.1.0) has `VaultCreate` with `domain_id`, `scale`, `withdrawal_policy` — but **no** `vault_kind`, `subscription_date`, `redemption_date`, and `VaultDelete` has **no** `memo_data`. `xrpl.js@5.2.0-beta.0` has all four. The lending tutorials present JavaScript and Python side by side as equals; a Python developer following the Python tab cannot reach the V1.1 feature set.

### 11.2 The official sample destroys `console.warn` to hide an SDK warning

`_code-samples/lending-protocol/js/createLoan.js` L35-36:
```js
// Suppress unnecessary console warning from autofilling LoanSet.
console.warn = () => {}
```
The warning comes from `xrpl/dist/npm/sugar/autofill.js` L225:
```js
console.warn(`For LoanSet transaction the auto calculated Fee accounts for total number of signers the counterparty has to avoid transaction failure.`);
```
It fires on **every** `autofill()` of a `LoanSet`, whether or not the counterparty uses a signer list. The documented workaround globally disables `console.warn` for the rest of the process — which will also silence the `MPT_META_WARNING_HEADER` validation warnings the same library emits from `validateVaultCreate`. Fix: emit only when the counterparty actually has a `SignerList`, and route it through an opt-in logger rather than `console.warn`.

### 11.3 The closed-ended fields are wire-supported far earlier than they are typed

Verified by installing each version and round-tripping through `ripple-binary-codec`:

| xrpl.js | `definitions.json` has `VaultKind`/`SubscriptionDate`/`RedemptionDate` | `encode`/`decode` round-trips them | typed on the `VaultCreate` interface |
|---|---|---|---|
| 4.6.0 | yes | yes | **no** |
| 5.2.0 (latest stable) | yes | yes | **no** |
| 5.2.0-beta.0 | yes | yes | yes |
| 5.2.0-beta.1 | yes | yes | yes |

`xrpl.validate()` does not reject the fields on 4.6.0/5.2.0 either — it silently accepts them. So on stable xrpl.js you can build and submit a working closed-ended vault, but TypeScript will not tell you the fields exist and nothing in the docs will either. Discovery is effectively impossible without reading rippled.

### 11.4 Naming divergence between rippled and xrpl.js

| rippled | xrpl.js 5.2.0-beta.0 |
|---|---|
| `VaultKind::OpenEnded` / `ClosedEnded` | `VaultKind.vaultKindOpen` / `vaultKindClosed` |
| "closed-ended" (comments, `VaultHelpers.h`) | "**close-ended**" in the thrown error string |

`vaultCreate.js` L102:
```js
throw new ValidationError('VaultCreate: SubscriptionDate and RedemptionDate can only be set on a close-ended vault (VaultKind=1)');
```
Searching the docs for the SDK's error wording ("close-ended") finds nothing; searching for rippled's ("closed-ended") also finds nothing. Pick one spelling and use it in all three places.

### 11.5 Tutorials never name a network or a minimum library version

`create-a-single-asset-vault.md` step 1 is bare `npm install xrpl` (resolves to `latest`), while `_code-samples/vaults/js/package.json` pins `"xrpl": "^4.5.0"` and `_code-samples/lending-protocol/js/package.json` pins `"xrpl": "^4.6.0"` — three different answers on one page. No tutorial states that `SingleAssetVault` is not enabled on Mainnet or Testnet, or that the samples hard-code `wss://s.devnet.rippletest.net:51233`, or how to point them at a different network. For anyone on a custom devnet this is the first thing they need and it is nowhere on the page.

---

## 12. What I could not determine

- `VaultSet` cannot change `VaultKind`/`SubscriptionDate`/`RedemptionDate` (the invariant enforces immutability), but I did not read `VaultSet.cpp` closely enough to state the result code for attempting it.
- I did not execute a full closed-ended lifecycle end-to-end on devnet (no funded accounts in this audit), so the phase-boundary codes are source-verified but not transaction-verified.
- `LoanDelete`/`LoanBrokerDelete` interaction with a closed-ended vault in Redemption phase is not covered here.
- Whether `xrpl.org` is rebuilt from `main` on a schedule (so how long a docs PR takes to appear) is unknown.

---

## 13. Addendum — two more undocumented `VaultSet` behaviours

`docs/references/protocol/transactions/types/vaultset.md` misses both.

**(a) A `VaultSet` that changes nothing is rejected.** `VaultSet.cpp` L53-58:
```cpp
if (!ctx.tx.isFieldPresent(sfDomainID) && !ctx.tx.isFieldPresent(sfAssetsMaximum) &&
    !ctx.tx.isFieldPresent(sfData))
{
    JLOG(ctx.j.debug()) << "VaultSet: nothing is being updated.";
    return temMALFORMED;
}
```
At least one of `DomainID`, `AssetsMaximum`, `Data` must be present. The page's `temMALFORMED` row only mentions oversized `Data`.

**(b) `DomainID: 0` clears the domain; the vault stays private.** `VaultSet.cpp` L152-167:
```cpp
if (auto const domainId = tx[~sfDomainID]; domainId)
{
    if (*domainId != beast::kZero)
    {
        // In VaultSet::preclaim we enforce that lsfVaultPrivate must have
        // been set in the vault. We currently do not support making such a
        // vault public (i.e. removal of lsfVaultPrivate flag). The
        // sfDomainID flag must be set in the MPTokenIssuance object and can
        // be freely updated.
        sleIssuance->setFieldH256(sfDomainID, *domainId);
    }
    else if (sleIssuance->isFieldPresent(sfDomainID))
    {
        sleIssuance->makeFieldAbsent(sfDomainID);
    }
    view().update(sleIssuance);
}
```
Three facts the page never states: the domain is written to the **share `MPTokenIssuance`**, not to the `Vault`; passing an all-zero `DomainID` **removes** it; and a private vault can never be made public. Note the consequence of clearing the domain on a private vault — per `VaultHelpers.h`, *"a vault with no domain set has no authorized participants at all, and every subject fails with `tecNO_AUTH`"* — so `DomainID: 0` on a private vault silently locks out every future depositor. That deserves a warning admonition, not silence.

Contrast with `VaultCreate`, where `DomainID` of all zeroes is `temMALFORMED` (`VaultCreate.cpp` L78-80). Same field, opposite meaning on the two transactions, documented on neither.
