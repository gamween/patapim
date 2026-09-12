# On chain

Everything patapim created on the public XRPL Devnet, with a link for each. Regenerate with
`node scripts/gen-onchain-inventory.mjs`, which also re-verifies every transaction against the
ledger rather than against this file.

Network: **XRPL Devnet**, `wss://s.devnet.rippletest.net:51233`, network_id 2, rippled 3.4.0-rc5.
Explorer: https://devnet.xrpl.org

## Flagship lifecycle

subscription, gated deposit, loan of securities, the three phase rejections, redemption. Evidence: [`docs/evidence/recall-t2.json`](./evidence/recall-t2.json).

### Accounts

| Role | Address |
|---|---|
| Transfer agent, issues the security | [`rDtxwh8S…ex3x`](https://devnet.xrpl.org/accounts/rDtxwh8S4bfyrDWcR75pdhHajKVbkMex3x) |
| Lending agent, owns the vault and the broker | [`rM9M879Z…Bpbg`](https://devnet.xrpl.org/accounts/rM9M879Z7GdqULyrWGqy472QVCRYMABpbg) |
| Borrower, the market maker | [`rPsgiX5m…bdfi`](https://devnet.xrpl.org/accounts/rPsgiX5mLjAKdtWZVoxPiuRFQaM8Rmbdfi) |
| Vault pseudo-account, holds the pooled securities | [`rHNnBbX9…S179`](https://devnet.xrpl.org/accounts/rHNnBbX9ec552WscnrTR7wU17RdiMaS179) |
| Loan broker pseudo-account, holds the loans | [`rMid2Ric…NvMb`](https://devnet.xrpl.org/accounts/rMid2Ricybo3MzfJw3SA1NiMUvBqKsNvMb) |

### Ledger objects

| Object | Id | What it is |
|---|---|---|
| Tokenised security, MPT | `005046368D74C3FF53A394C9437077DB23D28899819BC244` | the vault asset, require-auth |
| Permissioned domain | `59B5FD0BDD013A2AE30058E980D6BB58ACB460017A7CF835964AE3557AF5007E` | the eligibility gate |
| Vault | [`B3A3AB0811E2…959E`](https://devnet.xrpl.org/vault/B3A3AB0811E29F626DA0224F2A90395B11EFCB43CAD10176029F70FCB2E1959E) | closed-ended, `VaultKind 1` |
| Vault shares, MPT | `00000001B1FAE95C56DF856CB835507B9A6C90A2B5920A2B` | the lender position, 0 outstanding |
| Loan broker | `B3B87055DFDCBFA0176315E6B50E53E2BE12E44F188FD2F53D2FCDD2BD262D19` | the lending agent |
| Loan | `21955930259A36DC23E4E722F783C72E37CAC73552AC673BDB7FA742E415E344` | the loan of securities |

Vault state now: assets `0`, available `0`, unrealised loss `0`. Subscription closes `842558460`, redemption opens `842558760`, Ripple epoch.

Broker: cover `500000`, debt `0`, ceiling `4000000`, cover rate `10000` parts per 100000.

Loan: flags `0`, outstanding `0`.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| MPTokenIssuanceCreate | `tesSUCCESS` | yes, `MPTokenIssuanceCreate` | [`69A38645`](https://devnet.xrpl.org/transactions/69A38645EBED7B2900E928DD5893914B06E5C9A0FB64F22C1183B182D2F7C3DD) |
| PermissionedDomainSet | `tesSUCCESS` | yes, `PermissionedDomainSet` | [`878653B1`](https://devnet.xrpl.org/transactions/878653B16FAB04BA428A96FF1740E6F46BEE53FBCB6333CC1FD424B672A165DE) |
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`565318B0`](https://devnet.xrpl.org/transactions/565318B02FEAC00080F137BE3B66C1E3B080B0580A06F6FD1A1A78A55B1B0C5E) |
| VaultDeposit lender | `tesSUCCESS` | yes, `VaultDeposit` | [`F8D70563`](https://devnet.xrpl.org/transactions/F8D70563711AFC3EFBA0EF61F3DA6E7944DDB6B2A34F3632DBB78049C0D83391) |
| VaultDeposit mm (gated) | `tecNO_AUTH` | yes, `VaultDeposit` | [`30C4B86F`](https://devnet.xrpl.org/transactions/30C4B86FF9456761892943E69E0C2EC338A1EFE9F7CCF4AE1160ED831AEDB6F9) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`98BB53E0`](https://devnet.xrpl.org/transactions/98BB53E08D518482166E91AD1FFED0421B72D080E26CC9F0601EE8ACCBC97062) |
| CoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`C5D955D8`](https://devnet.xrpl.org/transactions/C5D955D818CB9D920E03BA2FCF8A101D284E87A86388B65A8022B74F7B16B555) |
| VaultDeposit after close | `tecEXPIRED` | yes, `VaultDeposit` | [`E4F68FB0`](https://devnet.xrpl.org/transactions/E4F68FB08B8DDA19E962A7B3A90485CF94CD3168C688D776000EC1ADBDEB9D7C) |
| VaultWithdraw during Investment | `tecTOO_SOON` | yes, `VaultWithdraw` | [`32077697`](https://devnet.xrpl.org/transactions/32077697369163583D1D1BD43F18325D6608A70EC2814A49EDA60DDF38F44CAF) |
| LoanSet | `tesSUCCESS` | yes, `LoanSet` | [`DDD61141`](https://devnet.xrpl.org/transactions/DDD611413B8354071CB27DD291652E01424C52D82901611CC6DE042036972C12) |
| EscrowCreate collateral | `tesSUCCESS` | yes, `EscrowCreate` | [`05F9AF64`](https://devnet.xrpl.org/transactions/05F9AF64190D7FAB70DB730F03921928CE2BF71B5656F2D0CA54C99571F0D936) |
| LoanPay full | `tesSUCCESS` | yes, `LoanPay` | [`71DE04C6`](https://devnet.xrpl.org/transactions/71DE04C60FBC85F87CCC6283CDAA5985DF18DFF5A9DDE90694805B77927978C4) |
| EscrowCancel collateral | `tesSUCCESS` | yes, `EscrowCancel` | [`7CE7D679`](https://devnet.xrpl.org/transactions/7CE7D67939902D50FA93B691C081CAE1D81299852AB56B266320A634789611A4) |
| LoanSet in redemption | `tecEXPIRED` | yes, `LoanSet` | [`3C01AF18`](https://devnet.xrpl.org/transactions/3C01AF182E2D99FBEE493459B61E381D8B90A1BDA13A2A118CA338CBA8E43FFD) |
| VaultWithdraw by shares | `tesSUCCESS` | yes, `VaultWithdraw` | [`2FAB3F9D`](https://devnet.xrpl.org/transactions/2FAB3F9D56AE3E331E3427741FDFA5F192A4592A294B011074B5B04089D79138) |

## Default arc, full indemnity

the cover absorbs the whole loan, the lenders are untouched. Evidence: [`docs/evidence/default-arc-cover100000.json`](./evidence/default-arc-cover100000.json).

### Accounts

| Role | Address |
|---|---|
| Transfer agent, issues the security | [`rLrbdswX…hUVp`](https://devnet.xrpl.org/accounts/rLrbdswXDUwEAoVzzQirY9AHJtdYHmhUVp) |
| Lending agent, owns the vault and the broker | [`rHxzwnkJ…Bk16`](https://devnet.xrpl.org/accounts/rHxzwnkJG8fMhyDudQ1EzX575ax7ZeBk16) |
| Borrower, the market maker | [`rnkwmyv3…Hu6E`](https://devnet.xrpl.org/accounts/rnkwmyv3dJ8Xrk9i1hJA2sYyFwkaH7Hu6E) |
| Vault pseudo-account, holds the pooled securities | [`rBHhsscL…eWR2`](https://devnet.xrpl.org/accounts/rBHhsscLKAwfwnvTXhaHQqWdsTfjNjeWR2) |
| Loan broker pseudo-account, holds the loans | [`rLpjnNBg…pNjy`](https://devnet.xrpl.org/accounts/rLpjnNBgSXzwV2gq7yLERVdffcpeA9pNjy) |

### Ledger objects

| Object | Id | What it is |
|---|---|---|
| Tokenised security, MPT | `00503937D0874A52BF76E1D6916D06AB29F9DEA52344F492` | the vault asset, require-auth |
| Permissioned domain | `526393E8BE14A22463065B43FD59153C67B23B10ABC7C3A45030A90E2C2AE5E1` | the eligibility gate |
| Vault | [`CC9CB7BF175B…0C4D`](https://devnet.xrpl.org/vault/CC9CB7BF175BFD7BA448E7C247A7E5BB7D8D16C0F4D93A462C157A4D1B5F0C4D) | closed-ended, `VaultKind 1` |
| Vault shares, MPT | `0000000170BA726A2B299EF7525FE5D09655D51C13D6ACE3` | the lender position, 5000000 outstanding |
| Loan broker | `603F0208FF71BE8DDD08BF90E5FCBC88D4CA556BC1B5F32CDBB4B41DFF1FA51C` | the lending agent |
| Loan | `D94FF2EFADEC188F8046C6A742895FE2E91D80382AFE3186417169103129E2D4` | the loan of securities |

Vault state now: assets `5000000`, available `5000000`, unrealised loss `0`. Subscription closes `842547717`, redemption opens `842548317`, Ripple epoch.

Broker: cover `500000`, debt `0`, ceiling `4000000`, cover rate `100000` parts per 100000.

Loan: flags `196608`, outstanding `0`.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`46AABC26`](https://devnet.xrpl.org/transactions/46AABC26E1D807CA88F81E66FB59E288DF0BF96547FAE3EC8942BE4405D61E26) |
| VaultDeposit | `tesSUCCESS` | yes, `VaultDeposit` | [`B659C8D5`](https://devnet.xrpl.org/transactions/B659C8D50FD38708D8E1313CED982EF1EDE0BEA539AA9ECD4E21957D56FD363C) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`D71F17AE`](https://devnet.xrpl.org/transactions/D71F17AE42DF80E6B3D758650429EBE69F6536437F902B2CE7BA8155FE52B078) |
| CoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`880B7F59`](https://devnet.xrpl.org/transactions/880B7F595BC2ADA09BBA3A84B783065E884F57E11C5DB4D5DEFC939DEE4C2F0E) |
| LoanSet | `tesSUCCESS` | yes, `LoanSet` | [`EDF10740`](https://devnet.xrpl.org/transactions/EDF107402242DB11C46B0DB87CDD97704CBB851840A3A49CC0BD31DD14B61C41) |
| LoanManage impair (too early) | `tesSUCCESS` | yes, `LoanManage` | [`5227A096`](https://devnet.xrpl.org/transactions/5227A0967246FE5AE7A60F879900FF42062FFBCF71C20648494FC2EAC8DA5F48) |
| LoanManage impair | `tecNO_PERMISSION` | yes, `LoanManage` | [`03933F6D`](https://devnet.xrpl.org/transactions/03933F6DCA3C73B306CF4FFC44B4B8426DC28C6CAF9F9F2F3707224D7B8897B6) |
| LoanManage default | `tesSUCCESS` | yes, `LoanManage` | [`95AD6692`](https://devnet.xrpl.org/transactions/95AD6692375BFD184155472FA105571BA9C9A836B221BB36F11CAA4F699C81D4) |

## Default arc, ten percent cover

the same default at a ten percent cover rate, where the lenders take the loss. Evidence: [`docs/evidence/default-arc-cover10000.json`](./evidence/default-arc-cover10000.json).

### Accounts

| Role | Address |
|---|---|
| Transfer agent, issues the security | [`r4hoArT6…ARW1`](https://devnet.xrpl.org/accounts/r4hoArT6GFjdi1v8nXpnLbYmvaL7pHARW1) |
| Lending agent, owns the vault and the broker | [`raJaxGGk…SVmw`](https://devnet.xrpl.org/accounts/raJaxGGkv6vmZWivibNfiRpFVgXLF5SVmw) |
| Borrower, the market maker | [`r4cD6urd…WmYM`](https://devnet.xrpl.org/accounts/r4cD6urdDjG4fp5myCAgbtVnnxyxsuWmYM) |
| Vault pseudo-account, holds the pooled securities | [`r41n2a28…nVVg`](https://devnet.xrpl.org/accounts/r41n2a28nvtZXup8WVtoJC726LNDDtnVVg) |
| Loan broker pseudo-account, holds the loans | [`r9D3ugwk…eEZz`](https://devnet.xrpl.org/accounts/r9D3ugwks1skVdRdLRSnUAbT9wXrrEeEZz) |

### Ledger objects

| Object | Id | What it is |
|---|---|---|
| Tokenised security, MPT | `005038C0E71310C57FCFD1FA4B9E9E12BDE50D97303F1E64` | the vault asset, require-auth |
| Permissioned domain | `B37A70C16E4DFBAD5D9F30A693213B9EA4B578DBD97D0E8789D412E978DF4F90` | the eligibility gate |
| Vault | [`FEC5DB46C0FB…BABA`](https://devnet.xrpl.org/vault/FEC5DB46C0FB8C409523DE20B28F7C6AF0F993DBFC44FA4BC53BBF0F29C2BABA) | closed-ended, `VaultKind 1` |
| Vault shares, MPT | `00000001EFD3414211732B0512F2A4BD9FDF3662DA6B149D` | the lender position, 5000000 outstanding |
| Loan broker | `F3EE8CF695E95554B7B31F804F423EE11D279D651DBBBA096E2168B032B314AD` | the lending agent |
| Loan | `670BADA2E83B9D07699FF6B611456674A11D1D3B66D8E8847E721BD3BE927CCC` | the loan of securities |

Vault state now: assets `3200000`, available `3200000`, unrealised loss `0`. Subscription closes `842547355`, redemption opens `842547955`, Ripple epoch.

Broker: cover `800000`, debt `0`, ceiling `4000000`, cover rate `10000` parts per 100000.

Loan: flags `196608`, outstanding `0`.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`FB588544`](https://devnet.xrpl.org/transactions/FB588544CE04535428FED827935E197D653212082ED764997DCBB3301DB5153B) |
| VaultDeposit | `tesSUCCESS` | yes, `VaultDeposit` | [`E9777713`](https://devnet.xrpl.org/transactions/E97777138928FF9974011571C7BDEE8EF604664231A7A7571D26A6997BD10E2E) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`256A7812`](https://devnet.xrpl.org/transactions/256A7812CAF116A89AB53BFF3A857F2C6BDEB853C1ED8DEB49B93EF783FA183C) |
| CoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`EC170D81`](https://devnet.xrpl.org/transactions/EC170D81726570C01306A7B9CAAF56E551C353012A2EF8A3A6C2ACAB745B2D47) |
| LoanSet | `tesSUCCESS` | yes, `LoanSet` | [`5C65F0A5`](https://devnet.xrpl.org/transactions/5C65F0A51F7EE7A992DA1B296D77C5E2893B8FDEC86A5E75E4895FE45D86CD05) |
| LoanManage impair (too early) | `tesSUCCESS` | yes, `LoanManage` | [`A3734858`](https://devnet.xrpl.org/transactions/A3734858DD8D5DF2E19384B882682083BA338FC1EECED00E3E7A3357DD62F55D) |
| LoanManage impair | `tecNO_PERMISSION` | yes, `LoanManage` | [`C9F00989`](https://devnet.xrpl.org/transactions/C9F009890DB54D8D0DC464403A6893FF95CE461FD71CC04C1E068044638BA649) |
| LoanManage default | `tesSUCCESS` | yes, `LoanManage` | [`D4F71EBF`](https://devnet.xrpl.org/transactions/D4F71EBF5F3234A8C47D2DBC16E7C17AA1A4C12E7858D6EDF392E7FF62F7F035) |

## Standing demo vault

the live vault the landing page advertises, left in Investment with a drawn loan. Evidence: [`docs/evidence/standing-demo.json`](./evidence/standing-demo.json).

### Accounts

| Role | Address |
|---|---|
| Transfer agent, issues the security | [`rBwU7PvT…rnHq`](https://devnet.xrpl.org/accounts/rBwU7PvTSWx9rAFmRLf5xyhVhccuudrnHq) |
| Lending agent, owns the vault and the broker | [`r9RrYWqq…Am2N`](https://devnet.xrpl.org/accounts/r9RrYWqqANVqaGNTTs9j7eeYiHWrf9Am2N) |
| Borrower, the market maker | [`rKoM6ZPW…7S5n`](https://devnet.xrpl.org/accounts/rKoM6ZPW8P5gZv384cU4ScfdVwqArW7S5n) |
| Vault pseudo-account, holds the pooled securities | [`rn4t6dRC…VcRH`](https://devnet.xrpl.org/accounts/rn4t6dRCShGLvz36hnXmqZGqC7gjzPVcRH) |
| Loan broker pseudo-account, holds the loans | [`rPXmPeUg…8e3g`](https://devnet.xrpl.org/accounts/rPXmPeUgV3Z32o98CGL5upUYNC63xd8e3g) |

### Ledger objects

| Object | Id | What it is |
|---|---|---|
| Tokenised security, MPT | `005047816F6E93FF4027878DF0E68EDE3564DE25547C5051` | the vault asset, require-auth |
| Permissioned domain | `9200CA563850C11940BB7666344C98E411F4AEC33E4E35E825DBC3CF5C96A908` | the eligibility gate |
| Vault | [`FAB518C7FC61…0132`](https://devnet.xrpl.org/vault/FAB518C7FC616F2BEAE22537F94B53C33AF9138FC472FAF0043057B6C3020132) | closed-ended, `VaultKind 1` |
| Vault shares, MPT | `000000013004654E139759B62C0AE3AEEA33401D2184838A` | the lender position, 5000000 outstanding |
| Loan broker | `794653A2DFABC2811C9E2748109AECB50384F9B9C9A39E7BACE7E47177F1DEA9` | the lending agent |
| Loan | `1D4630153B6EA3E59E1ACF621171C4B288DFB66BE30BD338E47DD73791B95BB8` | the loan of securities |

Vault state now: assets `5000000`, available `3000000`, unrealised loss `0`. Subscription closes `842559790`, redemption opens `842624590`, Ripple epoch.

Broker: cover `2500000`, debt `2000000`, ceiling `4000000`, cover rate `100000` parts per 100000.

Loan: flags `0`, outstanding `2000183`.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|

---

31 transactions re-verified against the ledger, 0 mismatches.
