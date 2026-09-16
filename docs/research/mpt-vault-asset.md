# What a Single Asset Vault can hold as its `Asset` — and can Recall actually be built?

Research slug: `mpt-vault-asset`. Team **patapim**, XRPL Lending Protocol Hackathon, 2026-09-12.
Every claim below carries a transaction hash on the **Track 1 hackathon devnet**
(`wss://lending-hackathon.dev.ripplex.io:51233`, rippled `3.4.0-rc1`, `network_id 4001`,
client `xrpl.js@5.2.0-beta.0`), a rippled source line on branch `ripple/lending-hackathon` @ `440018c0f`,
or a spec line. Nothing here is inferred.

Scripts: `scripts/experiments/mpt-vault-asset.mjs` … `-5.mjs`; only the run-1 script `scripts/experiments/mpt-vault-asset.mjs` was kept in the repository, the other runs' scripts were not.
Raw logs: scratchpad `mpt-run1.txt` … `mpt-run5.txt`.

---

## 0. Verdict — Recall is buildable, end to end, today

**A Single Asset Vault holds XRP, an IOU, or an MPT, and the entire XLS-66 lending spine runs in MPT
units.** We originated, serviced and repaid a loan whose principal, interest, first-loss cover and
vault shares are all denominated in a tokenised security MPT. No step is impossible.

Canonical run (run 2, Track 1, all `tesSUCCESS`):

| Step | Tx | Hash |
|---|---|---|
| 1 | `MPTokenIssuanceCreate` (the security) | `1C643E808E470344E167284B5A9C98F3E535FA7D82D0AB3A159EFB68B1B4FF80` |
| 2 | `VaultCreate`, `Asset = {mpt_issuance_id}` | `82A7330F3726FD036E5E6F5D7F78F810716B06A14034B16ADD77490461F90759` |
| 3 | `VaultDeposit` 6 000 000 units of the security | `9D4D017AAB8B6E423A42729963329AE644434F1F29F70131E0E4F39CE01A9F7B` |
| 4 | `LoanBrokerSet` on the MPT vault | `64E45CF40AD0ABA05AB19C7A48535A9728B8761A22B03F12532CFD713CE00F76` |
| 5 | `LoanBrokerCoverDeposit` **in the security** | `A42B65F3C663C977EA5919CC89BCC7774EEF37265529DFDB00AD1B9C666D4A01` |
| 6 | `LoanSet`, principal 2 000 000 security units, two signatures | `0065BF5093748B8D9B15A3A7D652DEFD52C8109BA7108E1910444EC9C4AE07EA` |
| 7 | `LoanPay` in the security | `D1F44A7FA4CF38D8C54A832B752711564291AD2DCE5299D8B8F74ED1B0255445` |
| 8 | `VaultWithdraw` back into the security | `794DF7E2DFF1D671C06613577E104934CB5D1204158B6535D956423358223DD8` |
| 9 | `LoanPay` closing payment, loan fully discharged | `E2F016625C5E684472731A10484EA3F4ABDDCA2824AA63999343433472B2039E` |
| 10 | `LoanBrokerCoverWithdraw` in the security | `DF5E6440358FB983B1871BE8F9E1AFE51FDD4FDD34FCB9CBBF6EB9EAAA47D13E` |

Live objects from that run:

```
security MPT   SEC     = 00010749431A4B5B17B09D06F551A73EDDBC2C4A824F74AA
vault                  = CE69EA8055D1EC8A5716167B8D93905D2245EE6A35988A5A8F780365C771599E
vault pseudo-account   = rhp5FcTaNmjAywoieMWL3jZdejJHZ6MFsJ
share MPT              = 00000001213BB420F789B609D8E93A7A86E08C6551B294EF
loan broker            = 1A7B6241935426C3220B110E1046EC1581E2B6CF520CC6B10BB4C4A62435A036
broker pseudo-account  = rEByYhKPzwM6123AJkqktcaenvKmmuZYmv
loan                   = 69741624517CA108C5D96C1EDD1C72AC659E88DF191642C3765094B491D562EC
```

Track 1 was chosen deliberately: its branch reverts PR #8076, so `LoanBrokerSet` accepts an
**open-ended** vault there, which removes the wall-clock phase gates from the loop. The MPT
behaviour itself is amendment-identical on Track 2.

---

## 1. The exact `Asset` shape, in the transaction and on the wire

`Asset` is an `STIssue`, not an amount. Three legal shapes, all verified live:

```jsonc
"Asset": { "currency": "XRP" }                                 // 3FD359E5C6B61622FA584C8AF1C413FE2BD158C18E5E327F9B36B50C32F0560C
"Asset": { "currency": "EUR", "issuer": "rJ7Q8Eas…" }          // 6684F0552D9DF0DA85E3501B82A682B407440FF06ADB253E0C32D295C2D6D245 (Scale 4)
"Asset": { "mpt_issuance_id": "00010749431A4B5B17B09D06F551A73EDDBC2C4A824F74AA" }
```

Full working `VaultCreate` for the MPT case (copy-pasteable):

```json
{
  "TransactionType": "VaultCreate",
  "Account": "rntcbm47JJRs4gPhd4FSmPvnY9FcJm3nT9",
  "Asset": { "mpt_issuance_id": "00010749431A4B5B17B09D06F551A73EDDBC2C4A824F74AA" },
  "WithdrawalPolicy": 1,
  "Data": "726563616C6C2073656375726974696573207661756C74"
}
```
→ `tesSUCCESS`, `82A7330F…0759`. Note: **no `Scale`**, and no `AssetsMaximum` needed.
`VaultCreate` autofills a 200 000-drop fee on Track 1.

The amount-carrying transactions (`VaultDeposit`, `VaultWithdraw`, `LoanBrokerCoverDeposit`,
`LoanBrokerCoverWithdraw`, `LoanPay`, `VaultClawback`) take the MPT **amount** shape instead —
the same id plus a `value`:

```json
{ "mpt_issuance_id": "00010749431A4B5B17B09D06F551A73EDDBC2C4A824F74AA", "value": "6000000" }
```

`LoanSet.PrincipalRequested` is **not** an amount object: it is a bare `XRPLNumber` string
(`"2000000"`) and the asset is implied by the broker's vault.

### Is the SDK modelling it?

Yes, in both the beta we use and the published stable, contrary to what the `Currency` name suggests.

- `node_modules/xrpl/dist/npm/models/transactions/vaultCreate.d.ts:20` — `Asset: Currency;`
- `node_modules/xrpl/dist/npm/models/common/index.d.ts:14-17` — `interface MPTCurrency { mpt_issuance_id: string }` and
  `export type Currency = IssuedCurrency | MPTCurrency | XRP;`
- `node_modules/xrpl/dist/npm/models/transactions/common.js:122-131` — `isCurrency()` accepts a
  one-key record whose key is `mpt_issuance_id`.
- Same three facts hold in **`xrpl@5.2.0` stable** (checked by unpacking the published tarball:
  `package/dist/npm/models/common/index.d.ts:17`, `…/transactions/common.js:122`).

The binary codec is where it gets interesting. `ripple-binary-codec@2.11.0`,
`dist/types/issue.js` — an MPT `Issue` is **44 bytes**: `issuerAccountID(20) ‖ NO_ACCOUNT(20) ‖ sequence little-endian(4)`,
where `NO_ACCOUNT` is the sentinel AccountID `0x…0001`. The 24-byte `mpt_issuance_id` you pass in JSON is
`sequence big-endian(4) ‖ issuerAccountID(20)` and the codec re-orders it. `toJSON()` reverses that by
length-sniffing (`MPT_WIDTH = 44`). So the codec accepts it happily; the constraint is that the object
must have **exactly one** key `mpt_issuance_id` — `isIssueObject()` at `issue.js:15-19` rejects any extra key,
so passing an *amount* (`{mpt_issuance_id, value}`) where an *issue* is expected fails at encode time.

---

## 2. What the issuer must configure on the `MPTokenIssuance` first

| Flag | Needed for | Evidence |
|---|---|---|
| `lsfMPTCanTransfer` (`tfMPTCanTransfer` 0x20) | **Mandatory.** Without it `VaultCreate` returns `tecNO_AUTH`. | live `D161689F415E93B08F40059E242AA9F6239AC71480AF93F1CF7678A027FB4E9E`; source `src/libxrpl/ledger/helpers/MPTokenHelpers.cpp` `canAddHolding(ReadView, MPTIssue)`: `if (!issuance->isFlag(lsfMPTCanTransfer)) return tecNO_AUTH;` |
| `lsfMPTRequireAuth` (0x04) | Optional, and it does **not** block the vault. See §3. | live `F7BB1D1B…9CA0` (create) + `C9A720108AF94EAC3810588E426301F2EC7EE8DF31A924F805EDCE6806075CA0` (deposit) |
| `lsfMPTCanClawback` (0x40) | Required only if the issuer wants `VaultClawback`. Absent → `tecNO_PERMISSION`. | live `7778D4610D1026AE5D73576C98E3D7F3C1BC16111B0C0F4655248526D0775470`; source `VaultClawback.cpp` preclaim, MPT visitor: `if (!mptIssue->isFlag(lsfMPTCanClawback)) … return tecNO_PERMISSION;` |
| `lsfMPTCanLock` (0x02) | **Not required by the implementation, although the spec says it is.** See §7.1. | live `553C31E8AF09B2129CE6DDAC98269874FF0CC1BA5D3AA4C2ECCB619B0E3A818A` |
| `lsfMPTCanEscrow`, `lsfMPTCanTrade` | Not consulted by any vault/lending code path. | absent from every `canAddHolding` / `canTransfer` / vault preclaim |

Other issuance settings: `AssetScale` on the security is **decorative** as far as the vault is concerned.
Our security had `AssetScale: 2` and the vault stores raw integer units; the vault's own `Scale`
is forced to 0 (§4). `MaximumAmount` on the security is untouched by the vault.

Nonexistent issuance → `tecOBJECT_NOT_FOUND` (live `612F9A986F921FFE611FED597D4788B90F69F0B93935B31507A2E5532798A915`,
using a well-formed id with a real issuer and sequence `FFFFFFFF`).

A vault whose asset is issued by a **pseudo-account** is refused: `tecWRONG_ASSET`
(live `D2576BB5CC1A2A198E8287DDF38B4A6505F82FF5FA8A693BCEC673810F9BFA69`, using another vault's share MPT).
Source `VaultCreate.cpp:136-143`, with the comment *"we do not want a vault to hold such assets … as they
would be impossible to clawback"*. So **no vault-of-vault-shares**, and no AMM LPToken vaults.

The vault owner **may** be the security issuer (self-issued security):
`VaultCreate` `1458974DB9974D661370EA37AEC656E619CE0976AC815F4DDB7880A6B026388C`, deposit
`97122523306C7AC12ECC9C295B61DC41F475784CFF0A80FC5457CD1AB3ED203B`. One wrinkle: when issuer == owner,
`VaultClawback` **must** carry an explicit `Amount` or it returns `tecWRONG_ASSET`
(`0EAC6B9FCE3CBBBA436A250681A82A5FE06AE82E0D9EEBF9A2607D304EBE7E7E`; with `Amount`,
`6607C090EC09D834382F31F03B6315C8849F0FF32AEC11607E8C3872F3C3E390`). Source `VaultClawback.cpp:112-117`:
*"Ambiguous case: If Issuer is Owner they must specify the asset."*

---

## 3. Does the vault pseudo-account need authorising, and who authorises it? **No, and nobody.**

This was the question most likely to kill Recall. It does not.

1. `VaultCreate.doApply()` calls `addEmptyHolding(…, pseudoId, …, asset, …)` (`VaultCreate.cpp:204`).
   For an MPT that is `MPTokenHelpers.cpp` `addEmptyHolding`, which calls `authorizeMPToken(...)` with no
   `holderID` — it creates an `MPToken` for the pseudo-account with `(*mptoken)[sfFlags] = 0`.
   **Observed:** immediately after `VaultCreate`, `account_objects` on `rhp5FcTaNmjAywoieMWL3jZdejJHZ6MFsJ`
   returns exactly one MPToken, `{"id":"00010749…74AA","amt":"0","flags":0}`.
2. That `MPToken` never gets `lsfMPTAuthorized`. It does not need it. `requireAuth(ReadView, MPTIssue, …)`
   in `MPTokenHelpers.cpp` short-circuits:
   ```cpp
   auto const isPseudoAccountExempt = [&] {
       return (featureSAVEnabled || featureMPTV2Enabled) && isPseudoAccount(view, account); };
   …
   if (fix330Enabled && isPseudoAccountExempt()) return tesSUCCESS;
   ```
   with the comment *"Pseudo-accounts (Vault, LoanBroker, AMM) hold assets on behalf of their participants.
   They are implicitly authorized for any MPT they hold."* Both `SingleAssetVault` and `fixCleanup3_3_0`
   are enabled on both hackathon networks.
3. **Proved on chain.** A vault whose asset is a `tfMPTRequireAuth` MPT, whose pseudo-account the issuer
   never authorised (`flags: 0` after create), accepted a deposit: `tesSUCCESS`,
   `C9A720108AF94EAC3810588E426301F2EC7EE8DF31A924F805EDCE6806075CA0`. The pseudo's holding then reads
   `{"amt":"2000000","flags":0}` — funded, still unauthorised, still working.
4. The gate still applies to **humans**. A depositor with no `MPToken` on the gated security gets
   `tecNO_AUTH` (`41D3556D45FF4E442EB41F7525113165E1D17BCCF03DAF6125E00E6A7CA7449C`), from
   `VaultDeposit.cpp:187` `requireAuth(ctx.view, vaultAsset, account)`.

**For Recall this is exactly the behaviour we want:** the transfer agent keeps `RequireAuth` on the
security and authorises eligible holders one by one; the vault, the loan broker and their pseudo-accounts
need no special treatment from the issuer.

---

## 4. What happens to the share MPT when the asset is itself an MPT

The vault mints a second, separate `MPTokenIssuance` for its shares, issued by the **vault pseudo-account**.
Observed share issuance for the MPT-asset vault:

```json
{"Flags":56,"Issuer":"rhp5FcTaNmjAywoieMWL3jZdejJHZ6MFsJ","LedgerEntryType":"MPTokenIssuance",
 "OutstandingAmount":"0","ReferenceHolding":"C68F15268A4F13C2F7E189D780E06A1FE6C9599D700A10FA8BE53BB9021891D3",
 "Sequence":1,"mpt_issuance_id":"00000001213BB420F789B609D8E93A7A86E08C6551B294EF"}
```

1. **`AssetScale` is absent, i.e. 0**, even though the underlying security has `AssetScale: 2`.
   `VaultCreate.cpp:208-210`: `scale = (asset.holds<MPTIssue>() || asset.native()) ? 0 : tx[~sfScale].value_or(kVaultDefaultIouScale)`.
   The vault's own `Scale` field is likewise never written (absent on the ledger entry).
   Consequence: **shares are integral, 1 share = 1 raw security unit at inception**
   (`assetsToSharesDeposit` in `VaultHelpers.cpp:37-44` returns `Number(mantissa, exponent + Scale).truncate()`
   when `AssetsTotal == 0`). Observed: deposit 6 000 000 → 6 000 000 shares, `OutstandingAmount` 6 000 000.
2. **`Flags: 56` = 0x38 = `lsfMPTCanEscrow|lsfMPTCanTrade|lsfMPTCanTransfer`** on a public vault with
   transferable shares (`VaultCreate.cpp:212-216`). With `tfVaultShareNonTransferable` (0x20000) the share
   issuance comes out with **`Flags: 0`** — verified, `7A566DE0BDC6D2374F3ABC28D285E6F3D44E0586445C2FB16813D82B1D227AFB`.
   This matches XLS-65 §3.1.6.2 table ("Public Vault / Non-Transferable → No Flags").
3. **`ReferenceHolding` points at the pseudo-account's `MPToken` for the underlying.** Verified equal to
   the index of the pseudo's MPToken: `C68F1526…91D3` in both places (`VaultCreate.cpp:226-232`,
   gated by `fixCleanup3_2_0`, enabled on both networks).
4. **The share MPT inherits the underlying's permission gate, transitively.** This is the single most
   important consequence for a securities product, and it is not obvious from any document.
   - `canTransfer` (`MPTokenHelpers.cpp:631-654`) follows `ReferenceHolding` and recurses into the
     underlying asset: *"Third-party transfers inherit the underlying's transferability."*
   - `requireAuth` (`MPTokenHelpers.cpp:53-67`) reads the issuer's `sfVaultID`, loads the vault, and
     recurses on `Vault.Asset` for the account being checked.
   - **Proved.** Over a vault whose asset is a `RequireAuth` security: an account not authorised on the
     security *can* opt in to the share MPT (`MPTokenAuthorize` → `tesSUCCESS`,
     `2C731A80C28167373FEFB56449099BB44E84AEBD6FA844526A3A6E67353F731D`) but **cannot receive shares**:
     `Payment` of the share → `tecNO_AUTH`, `0669426643CA8B42AF8ED184B1B64C35B1D8383D83D8639B1C6C2C4ECCDAC1A3`.
     Control over the ungated vault: the same two transactions both succeed
     (`6320BA729EA71C281A6432FF3715CCD4296EB5387B5DF44D9968FE6DD4675A64`,
     `A70BD2DF23ECE6F90740AC8E8A875260F7FF5D840F3CF9CE8598E25BA075DD4E`).
   - Recall reading: **eligibility on the security is automatically eligibility on the LP position.**
     You do not need a second credential scheme for the shares. And the gate is enforced at *transfer*,
     not at *opt-in*, which is a trap for any UI that treats a successful `MPTokenAuthorize` as "this user
     can now hold the token".

---

## 5. Issuer controls reach inside the vault

All verified live, all relevant to a securities-lending story where the transfer agent must retain control.

| Action | Result | Hash |
|---|---|---|
| `MPTokenIssuanceSet tfMPTLock` (global lock on the security) then `VaultDeposit` | `tecLOCKED` | `7672358C93541DF8B9861A4A58CAA0CCD88E988BD74B8147FACC7F5862FDD0F1` |
| same, then `VaultWithdraw` | `tecLOCKED` | `21C0CB726C7B7022E4BDF9E8CA336D3CFC7B609F7EADA5F7D409263A46EB687E` |
| individual lock **on the vault pseudo-account's holding**, then `VaultDeposit` | `tecLOCKED` | `D875F67092E47CC4FFCADCAE22966E4F1BB3D10FF6830B94D06667248CE95342` |
| `VaultClawback` by the **security issuer** against a depositor | `tesSUCCESS` (`AssetsTotal` 4 500 003 → 4 400 004, holder's shares 4 499 902 → 4 399 902) | `597B0D5AF78B6D6981A88F501C71B6017D88773590BE8DC320ED3ED00A7E114F` |
| `VaultClawback` by the **vault owner** (not the issuer) | `tecNO_PERMISSION` | `711458917F777992E695FD23EF8E29D96231CC3C7FED0141D3065A2121A9618E` |

So: the issuer can freeze the whole float, freeze one vault, or claw back a specific holder's exposure
*through* the vault, and the vault operator cannot. A regulator-grade control surface, already built.

---

## 6. Arithmetic in an integral asset — the part that will bite a builder

An MPT has no sub-unit. The lending maths does. Three concrete consequences, all measured.

### 6.1 `PeriodicPayment` is published as a number nobody can pay

Loan `69741624…62EC` on a vault whose asset is an integral MPT:

```json
"PeriodicPayment": "1000000.713471313672",
"PrincipalOutstanding": "2000000",
"TotalValueOutstanding": "2000002"
```

Submitting exactly that as `LoanPay.Amount` is **not possible at all**: `xrpl.js` throws
`1000000.713471313672 is an illegal amount` before the transaction is built, because an MPT amount is an
integer by construction. The borrower has to guess a rounding direction. Paying
`TotalValueOutstanding` = `1000001` closed the loan cleanly
(`E2F016625C5E684472731A10484EA3F4ABDDCA2824AA63999343433472B2039E`;
afterwards `PrincipalOutstanding`, `TotalValueOutstanding` and `PaymentRemaining` are all gone from the entry,
i.e. zero).
This is the MPT-flavoured version of our existing **F-008** (which measured it in XRP drops); in MPT it is
worse, because there is no granularity at all rather than a fine one.

### 6.2 Fractional inputs are rejected, in two different places, with two different failures

- `VaultDeposit` with `value: "100.5"` → **client-side throw**, `100.5 is an illegal amount`; never reaches the ledger.
- `LoanSet` with `PrincipalRequested: "1000000.5"` → **on-ledger** `tecPRECISION_LOSS`,
  `5CB721FF3A45518EDE08F518DECF6BF6A6BA4A70BBA9B28D8C9F2E30BF86FA65`.
  (`PrincipalRequested` is a plain number field, so nothing stops it being fractional at the codec level.)

The same logical error is a thrown JS exception on one transaction and a fee-charging `tec` on another.

### 6.3 `VaultWithdraw` in assets silently under-delivers by one unit

Requested `500000` of the security; received `499999`; burned `499999` shares.
(`794DF7E2DFF1D671C06613577E104934CB5D1204158B6535D956423358223DD8`: holder
4 000 000 → 4 499 999 units, 6 000 000 → 5 500 001 shares. Vault before the call: `AssetsTotal` 6 000 002 against
6 000 000 shares outstanding, i.e. a share price just over 1 after the first interest payment.)

This is **intentional**, and documented only in a source comment
(`VaultWithdraw.cpp` doApply, fixed-assets branch):

> *Post-amendment: truncate shares so `assetsWithdrawn <= requested amount` by construction.*

`tesSUCCESS` with a silent shortfall. The share-denominated path has no such gap: asking for
`1000000` shares delivered exactly `1000000` units
(`ED5F01CFD2662C0BCD47AB5A34580DD888650717E2B26CC5FC237241DC7E7E4C`).
**Practical rule for an MPT vault: withdraw by shares, not by assets.**

---

## 7. Findings to report (40% of the score)

### 7.1 NEW · XLS-65 requires `lsfMPTCanLock` for `VaultClawback`; rippled does not

**Category** spec vs implementation · **Severity** medium

`XLS-0065-single-asset-vault/README.md` line 702, in the `VaultClawback` failure conditions
(§3.7.2, "If `Vault.Asset` is an `MPT` and:"):

> 3. If the `MPTokenIssuance.lsfMPTCanLock` flag is NOT set (the asset cannot be locked).

rippled's `VaultClawback::preclaim` checks only `lsfMPTCanClawback`:

```cpp
[&](MPTIssue const& issue) -> TER {
    auto const mptIssue = ctx.view.read(keylet::mptokenIssuance(issue.getMptID()));
    if (mptIssue == nullptr) return tecOBJECT_NOT_FOUND;
    if (!mptIssue->isFlag(lsfMPTCanClawback)) { … return tecNO_PERMISSION; }
    return tesSUCCESS;
}
```

**Measured:** an MPT issued with `Flags = 112` (`0x70` = `CanTrade|CanTransfer|CanClawback`, **no** `CanLock`,
`B5229F80083A26D4B58C15AF9D4CAD805CADEC9B7339E17C1D78DB4DBCF5A33B`) backed a vault
(`08D187998A6762DE18E245DCD8EAE14BC2ACCCF0E33A60551A5BD5517FAB7344`) and a deposit
(`523B2D6D4F3169D078A33ABE54ADAF292949CE033A0F278C4B6B5B2D0C0BE424`). `VaultClawback` then returned
**`tesSUCCESS`** — `553C31E8AF09B2129CE6DDAC98269874FF0CC1BA5D3AA4C2ECCB619B0E3A818A` — where the spec says it must fail.
Vault went 200 000 → 150 000.

**Proposed fix** (pick one, and say which): either add
`if (!mptIssue->isFlag(lsfMPTCanLock)) return tecNO_PERMISSION;` to the MPT visitor in `VaultClawback.cpp`,
or delete item 4.3 from XLS-65 §3.7.2 and note in the rationale that MPT clawback does not require the
asset to be lockable (unlike the IOU path, which really does reject `lsfNoFreeze` issuers).
Either way the IOU and MPT branches should be described symmetrically: the IOU branch checks
`lsfAllowTrustLineClawback` **and** `!lsfNoFreeze`; the MPT branch checks one flag.

### 7.2 NEW · Nothing documents that vault shares inherit the underlying MPT's auth and transfer gates

**Category** documentation · **Severity** high (for any RWA build)

`xrpl.org/docs/references/protocol/transactions/types/vaultcreate` says only *"If the asset is an MPT, the
transaction creates an `MPToken` object for the vault's pseudo-account."* Neither that page, the
Single Asset Vaults concept page, nor XLS-65 §3.1.6.2 mentions that the **share** MPT is transitively
governed by the **asset** MPT through `sfReferenceHolding` and the recursive `requireAuth`.

A builder who reads the docs will conclude that shares in a public vault are freely transferable
(`Flags: 56` says `lsfMPTCanTransfer`). They are not, if the underlying requires auth:
`tecNO_AUTH` on a share `Payment`, `0669426643CA8B42AF8ED184B1B64C35B1D8383D83D8639B1C6C2C4ECCDAC1A3`,
even though the recipient's own `MPTokenAuthorize` on the share succeeded a moment earlier
(`2C731A80C28167373FEFB56449099BB44E84AEBD6FA844526A3A6E67353F731D`).

**Proposed fix** Add a subsection "Permissions on vault shares" to the Single Asset Vaults concept page:
state that `MPTokenIssuance(ShareMPTID).ReferenceHolding` points at the pseudo-account's holding of the
underlying, that `canTransfer` and `requireAuth` recurse through it, and that therefore *a holder must be
authorised on the vault's asset in order to hold or receive vault shares*. Add `tecNO_AUTH` to the
documented result codes of `Payment` when the delivered amount is a vault share. One sentence on the
`vaultcreate` page's `Asset` field would also help: *"If the asset requires authorization, so do the shares."*

### 7.3 NEW · The vault pseudo-account's exemption from `RequireAuth` is source-only

**Category** documentation · **Severity** medium

The single most load-bearing fact for building an RWA vault — *the issuer does not have to authorise the
vault* — exists only as a comment in `MPTokenHelpers.cpp`. We had to read the C++ to be sure, and it is a
go/no-go question for anyone tokenising a permissioned asset.

**Proposed fix** One line on the `vaultcreate` reference page under `Asset`:
*"If the asset's `MPTokenIssuance` has `lsfMPTRequireAuth`, the vault's pseudo-account is implicitly
authorised; the issuer does not need to submit `MPTokenAuthorize` for it. Depositors still do."*
Same line on the `LoanBroker` page for the cover pseudo-account.

### 7.4 NEW · `VaultWithdraw` in assets returns `tesSUCCESS` while delivering less than requested

**Category** UX / documentation · **Severity** medium

§6.3 above. Asked for 500 000, got 499 999, no warning, no flag in metadata saying the request was trimmed.
For an integral asset the rounding step is a whole unit; for an MPT with `AssetScale 0` representing whole
bonds, that is a whole bond.

**Proposed fix** Document the truncation on the `vaultwithdraw` page ("the amount delivered may be less
than `Amount`; shares are truncated so the payout never exceeds the request"), and recommend the
share-denominated form when the asset is an MPT. Better still, surface `DeliveredAmount` in the metadata
of `VaultWithdraw` the way `Payment` does for partial payments — right now the only way to learn what you
actually received is to diff `account_objects` before and after.

### 7.5 NEW · The same fractional-amount mistake fails client-side on one transaction and on-ledger on another

**Category** SDK / UX · **Severity** low

`VaultDeposit {value:"100.5"}` throws in `xrpl.js` (`100.5 is an illegal amount`) and costs nothing;
`LoanSet {PrincipalRequested:"1000000.5"}` submits and burns a fee for `tecPRECISION_LOSS`
(`5CB721FF3A45518EDE08F518DECF6BF6A6BA4A70BBA9B28D8C9F2E30BF86FA65`).

**Proposed fix** Add a check to `validateLoanSet` in `xrpl.js`: when the broker's vault asset is an MPT the
SDK cannot know it offline, but it *can* reject a `PrincipalRequested` with a fractional part for any
asset when the caller passes the vault asset, and at minimum the `LoanSet` docs should list
`tecPRECISION_LOSS` with the note "the principal must be representable in the vault asset's units".

### 7.6 EXTENDS F-008 · `PeriodicPayment` on an MPT-denominated loan is not merely imprecise, it is unpayable

§6.1. Our earlier F-008 measured `"PeriodicPayment": "5000003.567356568362"` against XRP drops. On an MPT
vault the field reads `"1000000.713471313672"` and the client library refuses to build *any* transaction
carrying it, because MPT amounts are integers. The borrower must round, in a direction nothing documents,
and rounding up may cross into `tfLoanOverpayment` territory with its own fee.

**Proposed fix** (strengthened) Add a read-only `AmountDue` to the `Loan` entry, already rounded to the
vault asset's representable granularity, and return it in the `tecINSUFFICIENT_PAYMENT` error.

---

## 8. What this means for Recall, concretely

- **Lender pool = closed-ended vault whose `Asset` is the tokenised security.** Built and funded live:
  `VaultCreate` with `VaultKind:1`, `SubscriptionDate`, `RedemptionDate` **and** an MPT asset →
  `tesSUCCESS`, `E5955A98667895F61C6CEA073A7A7690EA3FF9DF50EE5E8E69F3255A77EC1B6A`
  (vault `5F2B68E4FA1671029D57492F5AFE8E9E1CF75189036ED6DE01FE688A2AD01989`, entry carries
  `VaultKind: 1`, `LEVersion: 1`), followed by a subscription-phase `VaultDeposit` of the security,
  `2071B9832BBEBA81233E5571DC31371626D73812DC0AF2C53447FE1FE1B08411`. The closed-ended phase matrix we
  already verified is therefore orthogonal to the asset type.
- **Eligibility comes for free.** Put `lsfMPTRequireAuth` on the security; the vault, the broker and their
  pseudo-accounts need nothing, depositors need `MPTokenAuthorize` + issuer authorisation, and the LP
  shares inherit the same gate without a second credential scheme (§3, §4.4). Layering
  `tfVaultPrivate` + `DomainID` on top adds the credential check on the *share* issuance, a second,
  independent gate.
- **First-loss cover in the security works** (`A42B65F3…4A01`), as does withdrawing it
  (`DF5E6440…D13E`), so the "cover repays the vault in securities" leg of the default story is real.
- **The transfer agent keeps control**: global lock, per-holder lock, and clawback all reach through the
  vault (§5).
- **Do the maths in whole units.** Denominate the security with `AssetScale 0` (or accept that the
  vault ignores the scale), quote loans as integers, withdraw by shares, and round the closing payment
  up to `TotalValueOutstanding`. Everything else in §6 becomes a non-issue.
- **One real constraint:** you cannot build a vault whose asset is another vault's shares
  (`tecWRONG_ASSET`), so no fund-of-funds / tranching by nesting vaults. Tranching has to be done with
  two sibling vaults over the same security and different brokers.
