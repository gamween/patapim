# Credentials + Permissioned Domains gating a Single Asset Vault

Slug `credentials-domains-vault`. XRPL Lending Protocol Hackathon, Paris, 12-13 Sept 2026, team patapim.

Everything below is either a line of rippled source at tag `3.4.0-rc1` (the exact build Track 1 runs),
a line of the XLS-65 spec, or a transaction hash on the Track 1 hackathon devnet. Nothing is inferred.

| | |
|---|---|
| Network | Track 1, `wss://lending-hackathon.dev.ripplex.io:51233`, `rippled 3.4.0-rc1`, `network_id 4001` |
| Client | `xrpl.js@5.2.0-beta.0` |
| rippled source | `git clone https://github.com/XRPLF/rippled`, `git worktree add /tmp/rippled-rc1 3.4.0-rc1` -> commit `2ad4def35` "chore: Bump version to 3.4.0-rc1 (#8171)" |
| Scripts | `scripts/experiments/credentials-domains-vault.mjs` (run 1: the full gating matrix, revocation, expiry), `-2.mjs` (run 2: share-id discovery, the borrower question, the full revoked exit), `-3.mjs` (run 3: `LoanBrokerCoverWithdraw.CredentialIDs`) |
| Raw logs | `/private/tmp/.../scratchpad/run1.log`, `run2.log`, `run3.log` (transient); every hash is reproduced below |
| Spec | <https://raw.githubusercontent.com/XRPLF/XRPL-Standards/master/XLS-0065-single-asset-vault/README.md> |

---

## 0. Amendment ground truth, obtained without admin access

`feature` is an admin-only RPC, so on a devnet you cannot ask "which amendments are on" by name.
You can: read the Amendments ledger object (`index 7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4`)
and match each 256-bit id against `SHA512Half(featureName)` for every name in
`include/xrpl/protocol/detail/features.macro`. Reusable snippet, ~20 lines:

```js
const half = s => crypto.createHash('sha512').update(s,'utf8').digest('hex').slice(0,64).toUpperCase()
// POST {"method":"ledger_entry","params":[{"index":"7DB0788C...6EF4","ledger_index":"validated"}]}
// then: result.node.Amendments.includes(half('fixCleanup3_4_0'))
```

Track 1 has exactly **48** amendments enabled and **every one of them is a name known to the
`3.4.0-rc1` source** - i.e. the network is a clean 3.4.0-rc1 network with no strays. Track 2 has 89.

Both networks, verified:

| feature | id | t1 | t2 |
|---|---|---|---|
| `Credentials` | `1CB67D08...F5EF` | ON | ON |
| `PermissionedDomains` | `A730EB18...E849` | ON | ON |
| `SingleAssetVault` | `81BD2619...40D8` | ON | ON |
| `LendingProtocol` | `565B90CA...9509` | ON | ON |
| `LendingProtocolV1_1` | `A360E2BF...7AC8` | ON | ON |
| `fixCleanup3_1_3` | `303ACB16...8CFC` | ON | ON |
| `fixCleanup3_2_0` | `21B8D2F7...E431` | ON | ON |
| `fixCleanup3_3_0` | `3298D47E...FEC4` | ON | ON |
| **`fixCleanup3_4_0`** | `98433DD0...CA76` | **ON** | **ON** |
| `PermissionedDEX` | `677E401A...247E` | ON | ON |
| **`MPTokensV2`** | `BE2D87DF...B2EB` | **off** | **off** |
| `SmartEscrow` | `78ECD9CE...E296` | off | off |
| `LendingProtocolV1_2` | `5AE2B8F0...C824` | off | off |

`fixCleanup3_4_0` being ON is load-bearing for everything below: it is what enables
`VaultWithdraw.CredentialIDs` and the destination-side domain check.
`MPTokensV2` being off is what makes one of Ripple's own tests unreproducible here (see §8).

---

## 1. Where the gate actually lives: the share issuance, not the Vault

This is the single most important structural fact and it is easy to get wrong.

`VaultCreate.cpp:244` passes `DomainID` into the **`MPTokenIssuance` of the shares**, and
`VaultSet.cpp:152-168` writes/erases it there too. The `Vault` ledger entry never has a `DomainID`
field. Proven live - the `Vault` entry's full key list after a `VaultCreate` **with** `DomainID`:

```
Account, Asset, Data, Flags, LEVersion, LedgerEntryType, Owner, OwnerNode,
PreviousTxnID, PreviousTxnLgrSeq, Sequence, ShareMPTID, WithdrawalPolicy, index
```

no `DomainID`. It is at `vault_info -> vault.shares.DomainID`:

```json
"shares": { "LedgerEntryType":"MPTokenIssuance", "Flags":60,
            "DomainID":"85C135A92DED1D49E980E4A40FB0130A28C044B287F0641F6887719A1736EC90",
            "mpt_issuance_id":"000000012A7CA0D61D36E4A39BCBBA3C93017434D5178B46", ... }
```

`Flags: 60` = `0x3C` = `lsfMPTRequireAuth|lsfMPTCanEscrow|lsfMPTCanTrade|lsfMPTCanTransfer`
(`LedgerFormats.h:184-191`), set by `VaultCreate.cpp:214-216`.

`checkVaultDomain` (`VaultHelpers.cpp:308-328`) reads the domain off that issuance and has the
footgun documented in its own header (`VaultHelpers.h:274-281`):

> "a vault with no domain set has no authorized participants at all, and every subject fails with `tecNO_AUTH`."

So `tfVaultPrivate` **without** `DomainID` is a legal vault that nobody but the owner can ever join.

## 2. Exact transaction JSON, as sent and accepted

```jsonc
// CredentialCreate  - issuer -> subject. CredentialType and URI are hex blobs.
{ "TransactionType":"CredentialCreate", "Account":"<issuer>", "Subject":"<holder>",
  "CredentialType":"<hex, 1..64 bytes>",          // CredentialCreate.cpp:71-76
  "URI":"<hex, 1..256 bytes, optional>",          // CredentialCreate.cpp:64-69
  "Expiration":<ripple-epoch seconds, optional> } // CredentialCreate.cpp:121-135

// CredentialAccept - the SUBJECT submits. No CredentialID: it is keyed by the triple.
{ "TransactionType":"CredentialAccept", "Account":"<holder>",
  "Issuer":"<issuer>", "CredentialType":"<hex>" }

// CredentialDelete - subject OR issuer (or anyone, if expired). CredentialDelete.cpp:87-92
{ "TransactionType":"CredentialDelete", "Account":"<issuer or subject>",
  "Subject":"<holder>", "Issuer":"<issuer>", "CredentialType":"<hex>" }

// PermissionedDomainSet - omit DomainID to CREATE, include it to MODIFY.
{ "TransactionType":"PermissionedDomainSet", "Account":"<domain owner>",
  "AcceptedCredentials":[ { "Credential": { "Issuer":"<issuer>", "CredentialType":"<hex>" } } ] }

// VaultCreate - DomainID is ONLY legal together with tfVaultPrivate (0x00010000).
{ "TransactionType":"VaultCreate", "Account":"<owner>", "Asset":{"currency":"XRP"},
  "Flags":65536, "DomainID":"<64 hex>", "WithdrawalPolicy":1, "Data":"<hex>" }

// VaultSet - DomainID of 64 zeros REMOVES the domain (VaultSet.cpp:163-166).
{ "TransactionType":"VaultSet", "Account":"<owner>", "VaultID":"<64 hex>", "DomainID":"<64 hex or 0*64>" }

// VaultWithdraw with CredentialIDs - the SUBMITTER's own credentials, for the DESTINATION's DepositAuth.
{ "TransactionType":"VaultWithdraw", "Account":"<holder>", "VaultID":"<64 hex>",
  "Amount":"1000000", "Destination":"<dest>", "CredentialIDs":["<64 hex>"] }
```

`CredentialCreate` with `Subject == Account` is **auto-accepted**: `CredentialCreate.cpp:167-170`
sets `lsfAccepted` directly. Verified on ledger, `Flags = 65536 = 0x10000 = lsfAccepted`
(tx `3D56A91E87816AE776B8A8EBCDA1C2EA51052B2D2A0C6A403782CE886D8C8AFC`).

## 3. The enforcement matrix, proven on Track 1

Every row below is a real transaction on `network_id 4001`.

### Setup, transaction hashes (run 1)

| what | hash |
|---|---|
| CredentialCreate issuer->alice | `45E1FDE2B1FE916B03ADA7464DD114FC05D5B5BCC56E01CEA928992D3669A00A` |
| CredentialCreate issuer->bob, with `Expiration` | `8526F54CEFB7218117DAA2675B97520B767087D147F47A93656F0E06ADF23A93` |
| CredentialAccept alice | `4E28B4D515EFA2799703807CDEC028E9DBC9D253E2DC85F82089509F6B95945F` |
| PermissionedDomainSet (create) | `29026AFE2A40EB9E3AF8AF63EADE3D4898A8B471D0A91A134DD27CF7E83416EF` |
| VaultCreate private + DomainID | `2682956FD2E61DE760E9AD4720DB604FFBE85C912FC3FF99512559B6A7A36D94` |

`DomainID D870FD25E2A3BC548C9ECB40E064BE9DEA2D8CB4FD1124AF3BD6EFD4F329C969`,
`VaultID 63CD422DBBCF32A4D484225564848B64727FFB315B3CD757ED95426C17406075`.

### Negatives that close questions

| transaction | result | hash / note | source |
|---|---|---|---|
| `CredentialCreate` duplicate triple | `tecDUPLICATE` | `84EBFF9F...8142` | `CredentialCreate.cpp:95-99` |
| `CredentialCreate` to an unfunded subject | `tecNO_TARGET` | `80DA39E9...3E2A` | `CredentialCreate.cpp:89-93` |
| `PermissionedDomainSet` by a non-owner | `tecNO_PERMISSION` | `63B1A2BE...EBF8` | `PermissionedDomainSet.cpp:70-71` |
| `VaultCreate` `DomainID` all-zero + private | `temMALFORMED` | `BFF32089...6AA9` | `VaultCreate.cpp:74-78` |
| `VaultCreate` `DomainID` not on ledger | `tecOBJECT_NOT_FOUND` | `F05D5E71...D31C` | `VaultCreate.cpp:149-153` |
| `VaultDeposit`, accepted credential of a type the domain does NOT list | `tecNO_AUTH` | `AC51B0B0...0101` | `VaultDeposit.cpp:179-184` |
| `VaultWithdraw` `Destination` outside the domain | `tecNO_AUTH` | `44CED302...138C8` | `VaultWithdraw.cpp:241-248` |
| `VaultSet DomainID = 0`, then any non-owner deposit | `tecNO_AUTH` | `41495F33...15FF` | `VaultHelpers.cpp:319-321` |

### Positives

| transaction | result | hash |
|---|---|---|
| `VaultDeposit` by a domain member | `tesSUCCESS` | `D54E5CC9772C7113BA21574DA5BD7FE205B977E5DEB8940E4572711CDD924B47` |
| `VaultDeposit` by the vault **owner, holding no credential at all** | `tesSUCCESS` | `3B45CA066CBC547E6D2AD5F92BDE6BABD6B5CF0577F76BFAA324B3BBD356FBFF` |
| `VaultWithdraw` to self | `tesSUCCESS` | `1B10F834467FADA7E31E7DDB6A31ED7514C8B629CD2E6FD91A0B10352DB64823` |
| `VaultWithdraw` -> another domain member | `tesSUCCESS` | `D9D6F7DA68DD58FB19FC37A0B1C3A2C8988E8A5D5E131E78FC26B3F99921A15B` |

The owner exemption is `VaultDeposit.cpp:179` (`&& account != vault->at(sfOwner)`) and matches
XLS-65 §2.3 ("the Vault Owner has an implicit permission ... they do not have to have credentials").

### The flag that explains everything downstream

Two share `MPToken` entries on the same issuance, read off the validated ledger:

| holder | how they got in | `MPToken.Flags` |
|---|---|---|
| vault **owner** | `VaultCreate` / owner branch, `authorizeMPToken(..., holderID)` `VaultDeposit.cpp:289-306` | **2** = `lsfMPTAuthorized` |
| domain **member** (alice) | `enforceMPTokenAuthorization` -> `authorizeMPToken(..., no flags)` `MPTokenHelpers.cpp:565-573` | **0** |

rippled says so itself, `MPTokenHelpers.cpp:544-550`: "authorized by the domain. Ignore
authorization flag `lsfMPTAuthorized` **because it is meaningless**."

Nothing is ever persisted in a domain member's `MPToken`. Their access is recomputed from live
credentials on every single transaction. That is why revocation bites instantly (§5).

## 4. What `CredentialIDs` is for. It is NOT the domain.

`VaultWithdraw.CredentialIDs` and `LoanBrokerCoverWithdraw.CredentialIDs` have nothing to do with
the vault's permissioned domain. They are the standard XLS-70 deposit-authorization escape hatch:
the **submitter** presents credentials that the **destination** has pre-authorised with
`DepositPreauth.AuthorizeCredentials`. Path: `VaultWithdraw.cpp:173` -> `View.cpp:480-505` ->
`credentials::authorizedDepositPreauth` (`CredentialHelpers.cpp:246-270`), which looks up
`keylet::depositPreauth(dst, sortedCredentialSet)`.

Proven as a four-step live sequence:

| step | result | hash |
|---|---|---|
| bob `AccountSet SetFlag: 9` (`asfDepositAuth`) | `tesSUCCESS` | `6854665D1FB27AC5B6BFA09DF15E705C42093B6518BA7D99ADDFE648823E7E74` |
| withdraw -> bob, **no** `CredentialIDs` | `tecNO_PERMISSION` | `C43D04262D1AF3048E4B1D777470EC85988D9AA67184FEA9A65482311308EB44` |
| withdraw -> bob **with** `CredentialIDs`, before bob preauthorises | `tecNO_PERMISSION` | `3E4EC68331367C33A1A41C389538BA43BDF251F391D2F576C1DFB4BAEE9E446D` |
| bob `DepositPreauth{AuthorizeCredentials:[{Issuer,CredentialType}]}` | `tesSUCCESS` | `C632F238EFB563270F7B1B82D61DB2E252F67586BEA2F1C4D365F8A7267B9F64` |
| withdraw -> bob with `CredentialIDs` | **`tesSUCCESS`** | `A4A191B9C7516FF0054E620E3D770D21BD2DC56DC4245966FD37859AA53ABB6E` |

Field-level negatives (`CredentialHelpers.cpp:165-205` / `130-163`):

| input | result | hash |
|---|---|---|
| a credential whose `Subject` is someone else | `tecBAD_CREDENTIALS` | `AFAE59CFF6165C469DE2B9F265374E9D902E883CAB2E1621F3ACA628005B03E7` |
| a credential id that is not on the ledger | `tecBAD_CREDENTIALS` | `0FE21C1E423F70CC187EB383C67807B2015EBFECF3BF1F2FEADC868C728C879C` |
| `CredentialIDs: [0x00..00]` | `temMALFORMED` | `545A0FED9D1A43674E53FE428F08DACEED534B51014C0B74D86D447CC22D20BD` |
| `CredentialIDs: []` | **blocked client-side** by xrpl.js | "VaultWithdraw: Credentials cannot be an empty array" |
| `CredentialIDs: [x, x]` | **blocked client-side** by xrpl.js | "VaultWithdraw: Credentials cannot contain duplicate elements" |

Same field on `LoanBrokerCoverWithdraw` (`LoanBrokerCoverWithdraw.cpp:32-35, 57, 121-132`), with
the wrinkle that the broker owner must present a credential **of which it is itself the subject** -
a self-issued one works (§2). Run 3, broker
`C471B37628700F4128E9C2150C288C08A5BF4B9AB475939239A6D241CAD32533`:

| | result | hash |
|---|---|---|
| coverWithdraw -> dest, before dest sets `asfDepositAuth` | `tesSUCCESS` | `D6C372BDCFD65B9027B8D3080AF850091300E4445F12CE5FD8AD2CE18B8CAD5C` |
| coverWithdraw -> DepositAuth dest, no `CredentialIDs` | `tecNO_PERMISSION` | `F328C1CF1930259A24CFB00031B71A73825A66913F4B8800274BC150BD12DD22` |
| coverWithdraw presenting a credential the broker owner is **not the subject of** | `tecBAD_CREDENTIALS` | `CDEBF37F7E58DC79CDCD45BEFAB0DB58FA3387242308617F1B4091C9521F0156` |
| coverWithdraw with its own self-issued credential, **before** the destination preauthorises | `tecNO_PERMISSION` | `DFA863DBEB210ECA6BC9F9F2F7A3753EBDA4C353938C5250250C4400EFA890EE` |
| destination `DepositPreauth{AuthorizeCredentials}` | `tesSUCCESS` | `2A1ECD0299E3D4BBA1090649F9DC5A260B6A92A53DF17EC1E285343ED3646094` |
| coverWithdraw with its own credential + preauth | **`tesSUCCESS`** | `ADEFFCA42F79331E557AA3375BB4436581EC00F7A6717467B75BD3B32114CC0C` |

Note the asymmetry, from source: `VaultWithdraw` runs `checkVaultDomain` on a third-party
`Destination` (`VaultWithdraw.cpp:241-248`), **`LoanBrokerCoverWithdraw` does not** - there is no
`checkVaultDomain` anywhere under `src/libxrpl/tx/transactors/lending/`. So first-loss cover can be
paid out of a domain-gated vault's broker to an account that is not in the domain. Our run 3
destination happened to be a domain member, so this is source-derived, not yet proven live with a
non-member destination (open question 5).

## 5. THE REVOCATION EXPERIMENT

Question nobody had written up: **revoke a shareholder's credential while they still hold shares.**
Run 2, `vaultID DED95D4261A9F81C8DC351BFD593948D9284D4E767815C896120CE1CC350A9D2`,
`shareID 000000012A7CA0D61D36E4A39BCBBA3C93017434D5178B46`, alice `rGUb16wRinCTLrPaz6Q5nTpjxHz8yokhTv`.

Alice deposits 300 XRP -> `MPToken {MPTAmount:"300000000", Flags:0}`.
Issuer submits `CredentialDelete` (`A6B8609A121F333C0217FFC4FA29E9B8306D97334E54E3DD445D4948B75B577E`).

**Her position is untouched.** Immediately after revocation her `MPToken` still reads
`{MPTAmount:"300000000", Flags:0}` - the ledger entry is not clawed back, locked, or flagged.
Then:

| action, as a revoked holder | result | hash |
|---|---|---|
| `VaultDeposit` more | `tecNO_AUTH` | `8BD3C6261FEC5708F8DB931BC5480F3DA753EFFDC375ED8D25E16B9CD899EEEB` |
| `Payment` of 1 share to a **domain member** | `tecNO_AUTH` | `DF5C8A78A33AD4EB0BFD35DBAC4E3FD214492DAE4E0EF4B212F0DFA37F874AED` |
| `VaultWithdraw` -> a **domain member** | `tecNO_AUTH` | `B052F722B45BF01484E603670CF6B4940281A623C886E39B0935731406352458` |
| `VaultWithdraw` -> **self**, all 300000000 shares | **`tesSUCCESS`** | `9A09186CA0D8075ACC90CF48A80843C9DEBB662FDCE72731A3BC47D632AB373A` |
| a domain member `Payment`s 1 share **to** the revoked holder | `tecNO_AUTH` | `C9C5FF4D0A2A57FC71159381E50980ABAB5FC5EC1ABF6E3AB6420FBBFCE25FB3` |

After the full exit alice holds **no** share `MPToken` at all (`account_objects` returns none).

Run 1 reproduced the same shape with a different `Destination` and a stale credential id
(`E27331475376644D1373744E107980C70AEACF725395CC07DA5F33A06ED12A5F` self-withdraw `tesSUCCESS`;
`7FF74FF4499F0CFF0AE30B3F0DF758513FB39E42C384BE66A400795E48042670` third-party `tecNO_AUTH`;
`70AE19EAB0FE460F59D8AA019D601FAB997BA50F64A0ECDEC7858E4B53F3A5ED` presenting the now-deleted
credential id -> `tecBAD_CREDENTIALS`, i.e. `CredentialIDs` dies with the credential).

**Verdict.** Revocation does not strand the position and does not confiscate it. It converts a
transferable holding into a **one-way, redeem-to-self-only** holding. The revoked holder's only
exit is `VaultWithdraw` back to their own account, which always works:
`VaultWithdraw.cpp:296-299` - "we intentionally do not check `lsfVaultPrivate` ... if you have a
share in the vault, it means you were at some point authorized to deposit into it, and this means
you are also indefinitely authorized to withdraw it to yourself."

Note the asymmetry this creates for a securities-lending product: revocation cannot force an exit.
The issuer can stop a holder trading, but only `VaultClawback` can actually move their shares,
and that is the asset issuer's power, not the vault owner's or the domain owner's.

## 6. Expiry is different from revocation: a FAILED transaction that deletes ledger state

`validDomain` (`CredentialHelpers.cpp:216-243`) cannot delete an expired credential because it only
has a `ReadView`. So `VaultDeposit` preclaim converts `tecEXPIRED` to success
(`SuppressExpired::Yes`, `VaultDeposit.cpp:181`) precisely so that `doApply`'s
`enforceMPTokenAuthorization` can run `verifyValidDomain`, **delete** the expired credential, and
then return `tecEXPIRED` (`MPTokenHelpers.cpp:507-527`).

Proven live. Bob's credential carried `Expiration: 842537800`. After that close time:

- credential present on ledger: `true`
- `VaultDeposit` -> **`tecEXPIRED`**, hash `E18F06BC01D1D35780E9E6C2FA8AC951A557266704C64B2FAB8498CCBD20821D`
- that failed transaction's metadata contains
  `DeletedNode {LedgerEntryType: "Credential", LedgerIndex: "7DEF15EE8258D17891A82C7301A4A090F868F2F593FF0E335DE2044B20020B3D"}`
- credential present on ledger afterwards: `false`

A `tec` result that permanently deletes a ledger object belonging to a third party (the issuer paid
that object's reserve) is not something any doc mentions. It is also a clean garbage-collection
design - worth calling out, not a bug.

Post-expiry, bob behaves exactly like a revoked holder: withdraw to self `tesSUCCESS`
(`A5173ADC15738B65CBF6F78D03300A06BB219373E751913FF2823A2D5C97D6FF`), withdraw to a third party
`tecNO_AUTH` (`E4E5EE6D3B0BD38BB1CDD35DD05BFE6326101F761D774B7EA1AB503130F6DF4B`).

`VaultWithdraw` uses `SuppressExpired::No` (`VaultWithdraw.cpp:241-248`), deliberately: there is no
doApply cleanup step there, so it reports `tecEXPIRED` rather than tolerating it.

## 7. THE PRODUCT FINDING: the domain gates lenders, NOT borrowers

Searched every lending transactor at `3.4.0-rc1` for domain enforcement:

```
$ grep -rn "CredentialIDs\|DomainID\|checkVaultDomain\|credentials::" src/libxrpl/tx/transactors/lending/
LoanBrokerCoverWithdraw.cpp:32,57,122,124     <- CredentialIDs only, destination DepositAuth
```

`LoanSet.cpp:609` and `:637` call `requireAuth(view, vaultAsset, borrower/brokerOwner, StrongAuth)` -
that is authorization to hold the **underlying asset**, never membership of the **share** domain.
There is no `checkVaultDomain` anywhere in `LoanSet`, `LoanPay`, `LoanManage`, `LoanBrokerSet`.

Proven, same vault, same block of transactions, run 2. `mallory` (`rK5mYCC9iaBN11LxS1ohDwp55W8chDgdVa`)
holds no credential and is not in the domain:

| | result | hash |
|---|---|---|
| `VaultDeposit` by mallory | **`tecNO_AUTH`** | `494E39BC5491398F86AD68B01464C1F2FE64921F1296B90A5241E3CEC7C024C1` |
| `LoanSet` with `Counterparty = mallory`, 10 XRP principal | **`tesSUCCESS`** | `577E6AC5838036F3286FFC1814654DB4A39E1DC9E1903EB9E4FFB1F8EC03D448` |
| `LoanPay` by mallory | **`tesSUCCESS`** | `1544A25B27E243254CA8565EF83EE808027B1589BFA87D3024F7077AA00F767B` |

`LoanID F157672EBB4FB14F894018C52EAF7B86838CBC052D6A9E3B8C8660C56CD42AA6`,
`LoanBrokerID 0C6FD19A4A1D87051B8E2766206795D13D8110A6B370FD0D0CB5596329F04A34`.

**An account the vault refused as a depositor borrowed the vault's assets minutes later.**

This is defensible protocol design - the `LoanSet` two-signature scheme already gives the broker a
veto, so borrower eligibility is the broker's job, not the domain's. But it is completely
undocumented, it is the opposite of what "private vault" reads like, and for a regulated
securities-lending product (Recall) it means:

> a permissioned domain on the vault is an **LP whitelist only**. Borrower eligibility must be
> enforced off the domain - by the LoanBroker owner refusing to counter-sign, or by making the
> vault asset itself an MPT with `lsfMPTRequireAuth`.

## 8. What could NOT be tested here, and why

rippled's own `src/test/app/vault/VaultDomain_test.cpp` (887 lines, present at `3.4.0-rc1`) has
`testDomainLossAfterAcquisition` at line 296, which asserts a revoked holder's DEX offer fails with
`tecUNFUNDED_OFFER`, and `testDomainCheckBuyerSideOffer` at line 406, which asserts a non-member
buyer gets `tecNO_AUTH`.

**Neither can be reproduced on either hackathon network.** `OfferCreate::checkExtraFeatures`
(`OfferCreate.cpp:70-77`) requires `featureMPTokensV2` for any MPT leg, and `MPTokensV2` is
`Supported::No` in `features.macro:25` and off on both devnets. Live attempt:

```
OfferCreate TakerGets {mpt_issuance_id: <shares>, value: "1"}
  -> temDISABLED  "The transaction requires logic that is currently disabled."
```

The P2P half of the same spec rule **is** testable and does hold: `Payment` of shares by a revoked
holder -> `tecNO_AUTH` (§5). So on these networks the access-control story for vault shares is
"payments yes, order book not at all".

## 9. Where the spec is wrong

**XLS-65 Appendix A.2** (raw README, the FAQ near line 1153) states, verbatim:

> "### A.2 Why can any account that holds Vaults shares submit a `VaultWithdraw` transaction?
>  The `VaultWithdraw` transaction does not respect the permissioned domain rules. In other words,
>  any account that holds the shares of the Vault can withdraw them."

That is **false since `fixCleanup3_4_0`**, which is enabled on both hackathon networks.
`VaultWithdraw.cpp:227-248` checks the domain on **both** the submitter and the destination whenever
the vault is private and `Destination != Account` and `Destination != asset issuer`. Live proof:
`44CED302400DD4E1A77F9728F4D8FEE1107844986AA50617754F18F405D138C8` -> `tecNO_AUTH`.

Proposed replacement text for A.2, which also preserves the intent the FAQ was written to explain:

> The `VaultWithdraw` transaction does not respect the permissioned domain rules **when the
> destination is the submitter's own account**. A shareholder whose credentials are later revoked or
> expired can always redeem to themselves, so vault access can never be used to strand funds.
> Since `fixCleanup3_4_0`, paying a withdrawal out to a *third party* from a private vault does
> require both the submitter and the `Destination` to be members of the vault's permissioned
> domain (`tecNO_AUTH` otherwise); the asset issuer is exempt as a destination so that a frozen
> asset always has a return path.

**XLS-65 §3.5.2** (the `VaultDeposit` failure list, item 6) lists only `tecNO_AUTH` for the private
vault case. It omits `tecEXPIRED`, which is what you actually get when the credential exists but has
expired, and it does not mention that the failing transaction deletes the credential (§6).
Proposed addition after item 6.2:

> 6.3 The depositor's matching credential has expired. (`tecEXPIRED`) The expired `Credential`
>     object is deleted as part of applying this failed transaction.

**XLS-65 contains the string `CredentialIDs` zero times** (`grep -c` on the raw README). The field
is real, is in `TRANSACTION_FORMATS` for `VaultWithdraw` and `LoanBrokerCoverWithdraw`, is gated on
`featureCredentials && fixCleanup3_4_0`, and is shipped in `xrpl.js@5.2.0-beta.0`.
Proposed fix: add a `CredentialIDs` row to the `VaultWithdraw` field table reading
"Credentials held by `Account`, presented to satisfy the `Destination`'s deposit authorization
(see XLS-70). Unrelated to the Vault's `DomainID`." plus the three failure codes
`temMALFORMED` (empty / duplicated / zero id), `tecBAD_CREDENTIALS` (not on ledger, not accepted,
or not owned by `Account`), `tecNO_PERMISSION` (no matching `DepositPreauth`).

## 10. DevEx friction, with the exact spot and the fix

**F-CD-01. `Vault.DomainID` is a write-only field.** You set `DomainID` on `VaultCreate`, and the
`Vault` entry you read back has no such field. You have to know that it lives on the share
`MPTokenIssuance`.
*Spot:* <https://xrpl.org/docs/references/protocol/transactions/types/vaultcreate> `DomainID` row,
and the XLS-65 §3.2.3 field table line 345.
*Fix:* change the description to "The `PermissionedDomain` object ID applied to the **share
`MPTokenIssuance`** of this Vault. The `Vault` object itself does not store it; read it back at
`vault_info -> vault.shares.DomainID`." Same edit on the `VaultSet` row.

**F-CD-02. `VaultCreate` metadata does not give you the share `MPTokenIssuanceID`.** The
`CreatedNode` for the `MPTokenIssuance` has `NewFields: {DomainID, Flags, Issuer, Sequence}` and no
`MPTokenIssuanceID`, even though every other MPT flow surfaces it. You must read the `Vault` entry's
`ShareMPTID` or call `vault_info`. Cost us a whole failed script section (run 1 §G5/G6 ran with
`shareID = undefined`).
*Spot:* `VaultCreate` metadata; `fixIncludeKeyletFields` is enabled on both networks and should
arguably cover this.
*Fix:* include `MPTokenIssuanceID` in the `MPTokenIssuance` `CreatedNode.NewFields`, as
`MPTokenIssuanceCreate` already does. Failing that, one sentence in the `VaultCreate` doc:
"the share `MPTokenIssuanceID` is not in the metadata; read `Vault.ShareMPTID`."

**F-CD-03. `temDISABLED` never names the missing amendment.** `OfferCreate` with an MPT leg on a
network without `MPTokensV2` returns "The transaction requires logic that is currently disabled." -
no hint which of the 100+ amendments. On a devnet where you cannot call the admin `feature` RPC,
that is a dead end.
*Spot:* `Transactor::checkExtraFeatures` dispatch; `OfferCreate.cpp:70-77`.
*Fix:* have `checkExtraFeatures` return the missing feature name (e.g. `std::optional<uint256>`)
and put it in `engine_result_message`: "temDISABLED: requires amendment MPTokensV2".

**F-CD-04. There is no non-admin way to list enabled amendments by name.** `feature` is admin-only.
Every devnet debugging session starts with "is this amendment even on here".
*Fix (we already built it, offer it as a PR):* a `bin/` script, or a public `feature` variant with
no voting info, that returns `{name, id, enabled}` for the Amendments object by hashing
`features.macro` names. Ours is 20 lines and is in §0 above.

**F-CD-05. `tfVaultPrivate` without `DomainID` is silently a dead vault.** It is a legal
`VaultCreate` that only the owner can ever use, and nothing warns you. rippled documents the trap in
a header comment (`VaultHelpers.h:274-281`); the public docs and the spec do not.
*Fix:* XLS-65 §3.2.3, under `DomainID`: "Omitting `DomainID` while setting `tfVaultPrivate`
produces a Vault with no authorized participants: every non-owner `VaultDeposit` returns
`tecNO_AUTH` until a `VaultSet` supplies a `DomainID`." Ideally also a `rippled` warning log.

**F-CD-06. xrpl.js 5.2.0-beta.0 client-side validation shadows three server error codes.**
`PermissionedDomainSet` with `AcceptedCredentials: []`, and `VaultWithdraw` with an empty or
duplicated `CredentialIDs`, all throw in the client before reaching the network, so you never see
`temARRAY_EMPTY` / `temMALFORMED`. That validation is *correct and good*, but it means a developer
learning the protocol cannot discover the real codes, and a test suite that asserts on server codes
cannot run.
*Fix:* none needed to the validation. Add the server code to the thrown message, e.g.
"PermissionedDomainSet: Credentials cannot be an empty array (rippled would return temARRAY_EMPTY)".

**F-CD-07. Praise, and it is worth saying.** `CoverRateLiquidation: 1000000` was rejected client-side
with "CoverRateLiquidation must be between 0 and 100000 inclusive", matching `kMaxCoverRate =
percentageToTenthBips(100)` in `Protocol.h:158` exactly. The xrpl.js lending models are accurate
against the source. This saved a devnet round trip. (It also means the *other* probe script in this
repo, `scripts/experiments/credentials-domain.mjs`, will fail its whole section G on the same value.)

## 11. Answers to the assignment, in one line each

- **Exact JSON for CredentialCreate / CredentialAccept / PermissionedDomainSet** - §2, all four
  verified with `tesSUCCESS` hashes.
- **How `DomainID` on VaultCreate/VaultSet is enforced** - it is copied to the share
  `MPTokenIssuance` (`VaultCreate.cpp:244`, `VaultSet.cpp:152-168`) and enforced by
  `checkVaultDomain` (`VaultHelpers.cpp:308-328`) at `VaultDeposit` preclaim
  (`VaultDeposit.cpp:179-184`, `SuppressExpired::Yes`), at `VaultDeposit` doApply via
  `enforceMPTokenAuthorization` (`VaultDeposit.cpp:267-273`), and at `VaultWithdraw` preclaim
  against **both** submitter and destination (`VaultWithdraw.cpp:227-248`, `SuppressExpired::No`).
- **Against whom** - depositors and, on third-party payouts, the withdrawing shareholder and the
  destination. **Not** the vault owner (exempt). **Not** the borrower (§7). Share **recipients** are
  checked by the MPT machinery on `Payment` (`tecNO_AUTH`, §5).
- **Error codes** - `tecNO_AUTH` for non-membership and for "no domain configured";
  `tecEXPIRED` when a matching credential exists but has expired and the caller does not suppress it;
  `temMALFORMED` / `tecOBJECT_NOT_FOUND` at `VaultCreate` / `VaultSet` for bad `DomainID`.
- **What `CredentialIDs` is for** - destination deposit-authorization, not the domain. §4.
- **Does `tfVaultPrivate` interact with domains** - yes, mandatorily and in both directions:
  `DomainID` without `tfVaultPrivate` is `temMALFORMED` at create and `tecNO_PERMISSION` at
  `VaultSet` (`VaultSet.cpp:90-94`); `tfVaultPrivate` without `DomainID` is a vault nobody can join.
- **Revocation while holding shares** - §5. Position intact, deposits and transfers dead,
  redeem-to-self always works.

## 12. Open questions

1. Can `VaultClawback` pull shares from a revoked holder who refuses to redeem? Not tested; the
   asset here was XRP, which has no clawback. Needs an IOU or MPT vault.
2. Does `LoanBrokerCoverDeposit` check the domain when the cover is posted in the vault's asset by a
   non-member? `LoanBrokerCoverDeposit.cpp:80,98` only call `canTransfer` / `requireAuth`, so
   probably not, but we did not run it from a non-member account.
3. Behaviour when the `PermissionedDomain` object is **deleted** (not the credential):
   `validDomain` returns `tecOBJECT_NOT_FOUND` (`CredentialHelpers.cpp:210-213`), so every
   depositor would get `tecOBJECT_NOT_FOUND` rather than `tecNO_AUTH`. Not verified live.
4. `MPTokensV2` is `Supported::No` at `3.4.0-rc1`, yet `VaultDomain_test.cpp:388-397` asserts DEX
   behaviour that requires it. Is share trading meant to ship with XLS-65, or is that test aspirational?
5. `LoanBrokerCoverWithdraw` to a destination **outside** the vault's permissioned domain: source
   says it is allowed (no `checkVaultDomain` in the lending transactors), not proven live.
