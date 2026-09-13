# On chain

Everything patapim created on the public XRPL Devnet, with a link for each. Regenerate with
`node scripts/gen-onchain-inventory.mjs`, which also re-verifies every transaction against the
ledger rather than against this file.

Network: **XRPL Devnet**, `wss://s.devnet.rippletest.net:51233`, network_id 2, rippled 3.4.0-rc5.
Explorer: https://devnet.xrpl.org

The XRP Ledger has no contract addresses. What a contract address would name elsewhere is a ledger
object id here: the vault, the loan broker, the loan, the token issuances, the permissioned domain.
The vault page on the explorer shows the vault, its broker and its loans together.

## Fund I, in term: the live loan book

the vault the landing page opens: subscribed, closed, 2,000,000 TBL on loan to a market maker against 102% cash collateral, until Tuesday 15 September 12:00 CEST. Evidence: [`docs/evidence/fund-term.json`](./evidence/fund-term.json).

### Accounts

| Role | Address |
|---|---|
| Transfer agent, issues the security TBL | [`rncTqM69…pUSu`](https://devnet.xrpl.org/accounts/rncTqM69x4otgZ5ZAc7MykPn8yeQmzpUSu) |
| Cash issuer, issues the collateral token USDX | [`rhzoMyZp…L1i5`](https://devnet.xrpl.org/accounts/rhzoMyZpa5eZuzybzZZZjsy8pGtANVL1i5) |
| Price provider, owns the TBL/USD Price Oracle | [`rJhyrQk6…jFrw`](https://devnet.xrpl.org/accounts/rJhyrQk6XxJcdFeyTWVcn2aSxRS8LZjFrw) |
| Lending agent: credential issuer, domain owner, vault owner, loan broker owner | [`rU57MqUw…V6ks`](https://devnet.xrpl.org/accounts/rU57MqUwaPcKF4rTYx4cN8osyT8SkDV6ks) |
| Beneficial owner, the lender | [`rpHuHbBy…yUrK`](https://devnet.xrpl.org/accounts/rpHuHbBytD3CG6DXvNpm3odFHLkvmSyUrK) |
| Borrower, the market maker | [`rnLnMVxh…43cE`](https://devnet.xrpl.org/accounts/rnLnMVxhicYy3Jg4LGFoCvXwbnejyx43cE) |
| Demo investor with a credential, seed published in `docs/DEMO-ACCOUNTS.md` | [`rM7nDFZZ…VnNC`](https://devnet.xrpl.org/accounts/rM7nDFZZPqHnS1UqRBgdsrVSxNWqpMVnNC) |
| Demo investor without a credential, seed published in `docs/DEMO-ACCOUNTS.md` | [`rKsP5GqU…22EN`](https://devnet.xrpl.org/accounts/rKsP5GqUeHHnJsgRnXmK8Q4QryxfRR22EN) |
| Vault pseudo-account, holds the pooled securities | [`rPu8zCzm…WJ4n`](https://devnet.xrpl.org/accounts/rPu8zCzmdcTrovrXNaeJApxqCznsx9WJ4n) |
| Loan broker pseudo-account, holds the loans | [`rJoiZDjD…jXpH`](https://devnet.xrpl.org/accounts/rJoiZDjDv8qNTzjEKqyi22Dn59ho1XjXpH) |

### Ledger objects

| Object | Id | What it is |
|---|---|---|
| Vault | [`B5EC8B2CFF11828C7A3B2552FD14F370659D1CB6857547A3A720E568E1F14730`](https://devnet.xrpl.org/vault/B5EC8B2CFF11828C7A3B2552FD14F370659D1CB6857547A3A720E568E1F14730) | closed-ended, `VaultKind 1` |
| Loan broker | `22731477DB5E866A4FEB929A99091B09C686BE098A63F40F88D2D98C737A6AD5` | the lending agent, on the vault page under Loans |
| Loan | `F9B11DDA5EFA85457CB17F89EFC99C813B155B41A19A6E2A67242EDB2A596D1F` | the loan of securities |
| Security, MPT issuance | `00504E4C3295762322513439250B2F050A1B016CE5563126` | TBL, the vault asset, require-auth |
| Vault shares, MPT issuance | `00000001FB4ECA99A091C2574B7A586C58ECDB41E83357FD` | the lender position, 5000000 outstanding |
| Cash, MPT issuance | `00504E4C2BD6C9B523B46C3A87963369E2205F00DD1C8CE7` | USDX, the collateral token, `AssetScale 2` |
| Permissioned domain | `E6B24E9C6C23DBE2098364844AEEFD418E15CCC4039FB1B87773CA79A9F1625F` | the eligibility gate |
| Price Oracle | owner [`rJhyrQk6…jFrw`](https://devnet.xrpl.org/accounts/rJhyrQk6XxJcdFeyTWVcn2aSxRS8LZjFrw), `OracleDocumentID 1` | TBL/USD reference price |
| Collateral escrow | `0DD22E34B3BF99787A14CB94EEC5ECFA4D327B5E63CB26FC06E40D186E5F8A31` | owner [`rnLnMVxh…43cE`](https://devnet.xrpl.org/accounts/rnLnMVxhicYy3Jg4LGFoCvXwbnejyx43cE), sequence 5262926, `FinishAfter 842868000`, `CancelAfter 842889600` |

Vault state now: assets `5000000`, available `3000000`, unrealised loss `0`. Subscription closes `842565880`, redemption opens `842889600`, Ripple epoch.

Broker: cover `2500000`, debt `2000000`, ceiling `4000000`, cover rate `100000` and liquidation rate `100000` in tenths of a basis point, management fee `10000`.

Loan: flags `0`, principal `2000000`, outstanding `2000035`, interest rate `250`, next payment due `842781611`, grace `86400` seconds.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| MPTokenIssuanceCreate security | `tesSUCCESS` | yes, `MPTokenIssuanceCreate` | [`E0DB910E`](https://devnet.xrpl.org/transactions/E0DB910ED8A998BB676EBA722F81AA407F478CE537A8D639727C092A1E7D11CC) |
| MPTokenIssuanceCreate cash | `tesSUCCESS` | yes, `MPTokenIssuanceCreate` | [`87968F08`](https://devnet.xrpl.org/transactions/87968F088EBA0FD547761D7C965736522285B651B64351FD1B8C0DF1CD8FF39B) |
| CredentialCreate lender | `tesSUCCESS` | yes, `CredentialCreate` | [`7B51B7FA`](https://devnet.xrpl.org/transactions/7B51B7FAD6C42705E0CE85DC377384F187E7E0AA0145B9F830CFF1F5AE597333) |
| CredentialAccept lender | `tesSUCCESS` | yes, `CredentialAccept` | [`6984F81C`](https://devnet.xrpl.org/transactions/6984F81C7D9069F5A34F6FD26C34FA5DDE9761958671A67CE7AFC0F5FC4DAE14) |
| PermissionedDomainSet | `tesSUCCESS` | yes, `PermissionedDomainSet` | [`78B5D46C`](https://devnet.xrpl.org/transactions/78B5D46C8F4AB2FA204979DD334F26E36DFF99D82D8642A5A0CFCF03A5D5BC25) |
| OracleSet | `tesSUCCESS` | yes, `OracleSet` | [`B512F0BE`](https://devnet.xrpl.org/transactions/B512F0BECC2C1BF95456556DB88E359A47B654B7CBB271CBB1BCFF42BCED1E73) |
| Payment USDX to borrower | `tesSUCCESS` | yes, `Payment` | [`BA2E91A3`](https://devnet.xrpl.org/transactions/BA2E91A3013CF433A10340FEEB2FA3208D506E79B711AFFC4F011E15ED771422) |
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`55E22E8B`](https://devnet.xrpl.org/transactions/55E22E8B490ADBC1936C999178203FA7E583710B79122D92A83E977D16FC6F25) |
| VaultDeposit lender | `tesSUCCESS` | yes, `VaultDeposit` | [`AD55ABF0`](https://devnet.xrpl.org/transactions/AD55ABF0DD04E3AEE44946222284778CC2A6471E28A84BEE3CCA294C0B704081) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`991A8FCF`](https://devnet.xrpl.org/transactions/991A8FCF8B4DEB3FA0B46638D65C2FC1D69D4C491E0476E86C5FEC71FEA6FB86) |
| LoanBrokerCoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`3E832B6B`](https://devnet.xrpl.org/transactions/3E832B6B4E9E3CADC4D8B2A507F54C23C383581604A75D80EF6DBEF92B2AB63D) |
| VaultDeposit after close | `tecEXPIRED` | yes, `VaultDeposit` | [`39103704`](https://devnet.xrpl.org/transactions/39103704E67B1DD68D78E22DF0B6AA96C30109F1E75FCFA6E36BE70AB4DC7ADA) |
| VaultWithdraw during term | `tecTOO_SOON` | yes, `VaultWithdraw` | [`0E5C4E92`](https://devnet.xrpl.org/transactions/0E5C4E9290834E9561D047EF93F56D9A667C6636A606BE1348299BD2AC0FFD57) |
| LoanSet | `tesSUCCESS` | yes, `LoanSet` | [`1A370179`](https://devnet.xrpl.org/transactions/1A37017921F7AEFC76A76933CF937716EBF090EF8078860B3192C08B726E5646) |
| EscrowCreate collateral | `tesSUCCESS` | yes, `EscrowCreate` | [`DDF576E8`](https://devnet.xrpl.org/transactions/DDF576E8ADF005B4D3EDE412ED9AF289DD47C9FF064A37C093A345F3E5258B51) |
| VaultSet reference price pointer | `tesSUCCESS` | yes, `VaultSet` | [`A77D656A`](https://devnet.xrpl.org/transactions/A77D656A8B6D6A265C4F9756224D42F99B016A9522361E2DBE2E2A442607F62F) |

## Fund II, open for subscription: where a judge signs

subscription open until Wednesday 16 September 18:00 CEST, then a 91 day term. The two demo investor accounts in `docs/DEMO-ACCOUNTS.md` deposit here. Evidence: [`docs/evidence/fund-offering.json`](./evidence/fund-offering.json).

### Accounts

| Role | Address |
|---|---|
| Transfer agent, issues the security TBL | [`rncTqM69…pUSu`](https://devnet.xrpl.org/accounts/rncTqM69x4otgZ5ZAc7MykPn8yeQmzpUSu) |
| Cash issuer, issues the collateral token USDX | [`rhzoMyZp…L1i5`](https://devnet.xrpl.org/accounts/rhzoMyZpa5eZuzybzZZZjsy8pGtANVL1i5) |
| Price provider, owns the TBL/USD Price Oracle | [`rJhyrQk6…jFrw`](https://devnet.xrpl.org/accounts/rJhyrQk6XxJcdFeyTWVcn2aSxRS8LZjFrw) |
| Lending agent: credential issuer, domain owner, vault owner, loan broker owner | [`rU57MqUw…V6ks`](https://devnet.xrpl.org/accounts/rU57MqUwaPcKF4rTYx4cN8osyT8SkDV6ks) |
| Beneficial owner, the lender | [`rpHuHbBy…yUrK`](https://devnet.xrpl.org/accounts/rpHuHbBytD3CG6DXvNpm3odFHLkvmSyUrK) |
| Borrower, the market maker | [`rnLnMVxh…43cE`](https://devnet.xrpl.org/accounts/rnLnMVxhicYy3Jg4LGFoCvXwbnejyx43cE) |
| Demo investor with a credential, seed published in `docs/DEMO-ACCOUNTS.md` | [`rM7nDFZZ…VnNC`](https://devnet.xrpl.org/accounts/rM7nDFZZPqHnS1UqRBgdsrVSxNWqpMVnNC) |
| Demo investor without a credential, seed published in `docs/DEMO-ACCOUNTS.md` | [`rKsP5GqU…22EN`](https://devnet.xrpl.org/accounts/rKsP5GqUeHHnJsgRnXmK8Q4QryxfRR22EN) |
| Vault pseudo-account, holds the pooled securities | [`rEShUHu6…KDVq`](https://devnet.xrpl.org/accounts/rEShUHu6FeH2W3JnG467tstZ2pFzXQKDVq) |
| Loan broker pseudo-account, holds the loans | [`r3KiR6ty…U5ix`](https://devnet.xrpl.org/accounts/r3KiR6tyTUojaahYRpp6WtoKXv2JpnU5ix) |

### Ledger objects

| Object | Id | What it is |
|---|---|---|
| Vault | [`B8286CD54ED120116C66C4B3F8663E6E06E7A593A9395B84497894A586A74530`](https://devnet.xrpl.org/vault/B8286CD54ED120116C66C4B3F8663E6E06E7A593A9395B84497894A586A74530) | closed-ended, `VaultKind 1` |
| Loan broker | `3D4E887081C40BC126D26C6E2FD2883476CBBC023C194A0AF941A6770FFFBEBA` | the lending agent, on the vault page under Loans |
| Security, MPT issuance | `00504E4C3295762322513439250B2F050A1B016CE5563126` | TBL, the vault asset, require-auth |
| Vault shares, MPT issuance | `000000019E4ED3A9645729D633558E005BBF860311912687` | the lender position, 3001000 outstanding |
| Cash, MPT issuance | `00504E4C2BD6C9B523B46C3A87963369E2205F00DD1C8CE7` | USDX, the collateral token, `AssetScale 2` |
| Permissioned domain | `E6B24E9C6C23DBE2098364844AEEFD418E15CCC4039FB1B87773CA79A9F1625F` | the eligibility gate |
| Price Oracle | owner [`rJhyrQk6…jFrw`](https://devnet.xrpl.org/accounts/rJhyrQk6XxJcdFeyTWVcn2aSxRS8LZjFrw), `OracleDocumentID 1` | TBL/USD reference price |

Vault state now: assets `3001000`, available `3001000`, unrealised loss `0`. Maximum `20000000`. Subscription closes `842889600`, redemption opens `850755600`, Ripple epoch.

Broker: cover `2500000`, debt `0`, ceiling `16000000`, cover rate `100000` and liquidation rate `100000` in tenths of a basis point, management fee `10000`.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| MPTokenAuthorize investorEligible opts in | `tesSUCCESS` | yes, `MPTokenAuthorize` | [`1E40DC60`](https://devnet.xrpl.org/transactions/1E40DC607CEF4C992C9F9B554B76E53CB87ACFD108E60049A235CD5B28614438) |
| MPTokenAuthorize issuer authorises investorEligible | `tesSUCCESS` | yes, `MPTokenAuthorize` | [`ECA91AE3`](https://devnet.xrpl.org/transactions/ECA91AE377730F210E193159A4F919E3505F57B96D828EC54C7E38E478B3C260) |
| Payment 1000000 TBL to investorEligible | `tesSUCCESS` | yes, `Payment` | [`5C769E54`](https://devnet.xrpl.org/transactions/5C769E5421A54DF9EB5733CBC2E7293EDC6F9CEF9A298F99FEFA3CF4AB57621B) |
| MPTokenAuthorize investorIneligible opts in | `tesSUCCESS` | yes, `MPTokenAuthorize` | [`3873FF36`](https://devnet.xrpl.org/transactions/3873FF36CDEFA2B0F01DAF54E515304CDF46967138F5EBB297160E0BF509E7F1) |
| MPTokenAuthorize issuer authorises investorIneligible | `tesSUCCESS` | yes, `MPTokenAuthorize` | [`BA611201`](https://devnet.xrpl.org/transactions/BA6112012BD14F3D160F4C0DA23C3437D8BB499F3CE14C56E1257E2CD827AAC1) |
| Payment 1000000 TBL to investorIneligible | `tesSUCCESS` | yes, `Payment` | [`AE349725`](https://devnet.xrpl.org/transactions/AE349725B54B1F56F692D95E716A4576233D2F6738F7D59B6465FFDB07FF9A9E) |
| CredentialCreate investorEligible | `tesSUCCESS` | yes, `CredentialCreate` | [`BB637ADE`](https://devnet.xrpl.org/transactions/BB637ADEEAD6B3646B7FECE5DE3336F9D0C27D9D2D1EAF5667573B9C13666F5D) |
| CredentialAccept investorEligible | `tesSUCCESS` | yes, `CredentialAccept` | [`47BF2C05`](https://devnet.xrpl.org/transactions/47BF2C05564459D66B94A3E9656FEF8316A31A8AF252EAC8739325FBBF7A3F71) |
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`90ECCBBE`](https://devnet.xrpl.org/transactions/90ECCBBE6A272C6A50121C53D14CE8C74FAB7E78639E033D99E9A0BCA8C6DCD6) |
| VaultDeposit lender | `tesSUCCESS` | yes, `VaultDeposit` | [`1A3B1D7A`](https://devnet.xrpl.org/transactions/1A3B1D7ADDAFC62919C2984D207483003DD7BCA7182D43BB65AA3A28FDFD2FE3) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`B8D1FE76`](https://devnet.xrpl.org/transactions/B8D1FE76A55A0319147601635A48329D5F91DF5D6C15DE77919571EE04FFE42B) |
| LoanBrokerCoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`BFA20ADF`](https://devnet.xrpl.org/transactions/BFA20ADFCA3C9035888456F93BD9730C588A42F43B3C4E9F0A73ADD6B0B801C3) |
| VaultDeposit eligible investor | `tesSUCCESS` | yes, `VaultDeposit` | [`F018B925`](https://devnet.xrpl.org/transactions/F018B9251EDAC42FF724928A653DD4FC70107D49122D815797D62B856C1D33DB) |
| VaultDeposit ineligible investor | `tecNO_AUTH` | yes, `VaultDeposit` | [`F8492DE0`](https://devnet.xrpl.org/transactions/F8492DE06B84745498EE8A6DA34AF7C1119BBFBBD11C4F54A05895E45497AC0E) |
| LoanSet during offering | `tecTOO_SOON` | yes, `LoanSet` | [`1AC3D6C2`](https://devnet.xrpl.org/transactions/1AC3D6C28A8DD2A493E270BAAD12E50C69210CD5D6AF426D2642B2150C4D558F) |
| VaultSet reference price pointer | `tesSUCCESS` | yes, `VaultSet` | [`27DCF904`](https://devnet.xrpl.org/transactions/27DCF90448CD18E32B80CBACE66875B20FBFD49D54EC6918B43B7822D91EAB1C) |

## Flagship lifecycle, 12 September

subscription, gated deposit, loan of securities, the three phase rejections, repayment, redemption. Evidence: [`docs/evidence/recall-t2.json`](./evidence/recall-t2.json).

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
| Vault | [`B3A3AB0811E29F626DA0224F2A90395B11EFCB43CAD10176029F70FCB2E1959E`](https://devnet.xrpl.org/vault/B3A3AB0811E29F626DA0224F2A90395B11EFCB43CAD10176029F70FCB2E1959E) | closed-ended, `VaultKind 1` |
| Loan broker | `B3B87055DFDCBFA0176315E6B50E53E2BE12E44F188FD2F53D2FCDD2BD262D19` | the lending agent, on the vault page under Loans |
| Loan | `21955930259A36DC23E4E722F783C72E37CAC73552AC673BDB7FA742E415E344` | the loan of securities |
| Security, MPT issuance | `005046368D74C3FF53A394C9437077DB23D28899819BC244` | TBL, the vault asset, require-auth |
| Vault shares, MPT issuance | `00000001B1FAE95C56DF856CB835507B9A6C90A2B5920A2B` | the lender position, 0 outstanding |
| Permissioned domain | `59B5FD0BDD013A2AE30058E980D6BB58ACB460017A7CF835964AE3557AF5007E` | the eligibility gate |

Vault state now: assets `0`, available `0`, unrealised loss `0`. Subscription closes `842558460`, redemption opens `842558760`, Ripple epoch.

Broker: cover `500000`, debt `0`, ceiling `4000000`, cover rate `10000` and liquidation rate `100000` in tenths of a basis point, management fee `1000`.

Loan: flags `0`, principal `0`, outstanding `0`, interest rate `5000`, next payment due `—`, grace `60` seconds.

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

impairment then default; the cover absorbs the whole loan and the lenders are untouched. Evidence: [`docs/evidence/default-arc-cover100000.json`](./evidence/default-arc-cover100000.json).

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
| Vault | [`CC9CB7BF175BFD7BA448E7C247A7E5BB7D8D16C0F4D93A462C157A4D1B5F0C4D`](https://devnet.xrpl.org/vault/CC9CB7BF175BFD7BA448E7C247A7E5BB7D8D16C0F4D93A462C157A4D1B5F0C4D) | closed-ended, `VaultKind 1` |
| Loan broker | `603F0208FF71BE8DDD08BF90E5FCBC88D4CA556BC1B5F32CDBB4B41DFF1FA51C` | the lending agent, on the vault page under Loans |
| Loan | `D94FF2EFADEC188F8046C6A742895FE2E91D80382AFE3186417169103129E2D4` | the loan of securities |
| Security, MPT issuance | `00503937D0874A52BF76E1D6916D06AB29F9DEA52344F492` | TBL, the vault asset, require-auth |
| Vault shares, MPT issuance | `0000000170BA726A2B299EF7525FE5D09655D51C13D6ACE3` | the lender position, 5000000 outstanding |
| Permissioned domain | `526393E8BE14A22463065B43FD59153C67B23B10ABC7C3A45030A90E2C2AE5E1` | the eligibility gate |

Vault state now: assets `5000000`, available `5000000`, unrealised loss `0`. Subscription closes `842547717`, redemption opens `842548317`, Ripple epoch.

Broker: cover `500000`, debt `0`, ceiling `4000000`, cover rate `100000` and liquidation rate `100000` in tenths of a basis point, management fee `1000`.

Loan: flags `196608`, principal `0`, outstanding `0`, interest rate `5000`, next payment due `—`, grace `60` seconds.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`46AABC26`](https://devnet.xrpl.org/transactions/46AABC26E1D807CA88F81E66FB59E288DF0BF96547FAE3EC8942BE4405D61E26) |
| VaultDeposit | `tesSUCCESS` | yes, `VaultDeposit` | [`B659C8D5`](https://devnet.xrpl.org/transactions/B659C8D50FD38708D8E1313CED982EF1EDE0BEA539AA9ECD4E21957D56FD363C) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`D71F17AE`](https://devnet.xrpl.org/transactions/D71F17AE42DF80E6B3D758650429EBE69F6536437F902B2CE7BA8155FE52B078) |
| CoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`880B7F59`](https://devnet.xrpl.org/transactions/880B7F595BC2ADA09BBA3A84B783065E884F57E11C5DB4D5DEFC939DEE4C2F0E) |
| LoanSet | `tesSUCCESS` | yes, `LoanSet` | [`EDF10740`](https://devnet.xrpl.org/transactions/EDF107402242DB11C46B0DB87CDD97704CBB851840A3A49CC0BD31DD14B61C41) |
| LoanManage impair (due, grace still running) | `tesSUCCESS` | yes, `LoanManage` | [`5227A096`](https://devnet.xrpl.org/transactions/5227A0967246FE5AE7A60F879900FF42062FFBCF71C20648494FC2EAC8DA5F48) |
| LoanManage impair (already impaired) | `tecNO_PERMISSION` | yes, `LoanManage` | [`03933F6D`](https://devnet.xrpl.org/transactions/03933F6DCA3C73B306CF4FFC44B4B8426DC28C6CAF9F9F2F3707224D7B8897B6) |
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
| Vault | [`FEC5DB46C0FB8C409523DE20B28F7C6AF0F993DBFC44FA4BC53BBF0F29C2BABA`](https://devnet.xrpl.org/vault/FEC5DB46C0FB8C409523DE20B28F7C6AF0F993DBFC44FA4BC53BBF0F29C2BABA) | closed-ended, `VaultKind 1` |
| Loan broker | `F3EE8CF695E95554B7B31F804F423EE11D279D651DBBBA096E2168B032B314AD` | the lending agent, on the vault page under Loans |
| Loan | `670BADA2E83B9D07699FF6B611456674A11D1D3B66D8E8847E721BD3BE927CCC` | the loan of securities |
| Security, MPT issuance | `005038C0E71310C57FCFD1FA4B9E9E12BDE50D97303F1E64` | TBL, the vault asset, require-auth |
| Vault shares, MPT issuance | `00000001EFD3414211732B0512F2A4BD9FDF3662DA6B149D` | the lender position, 5000000 outstanding |
| Permissioned domain | `B37A70C16E4DFBAD5D9F30A693213B9EA4B578DBD97D0E8789D412E978DF4F90` | the eligibility gate |

Vault state now: assets `3200000`, available `3200000`, unrealised loss `0`. Subscription closes `842547355`, redemption opens `842547955`, Ripple epoch.

Broker: cover `800000`, debt `0`, ceiling `4000000`, cover rate `10000` and liquidation rate `100000` in tenths of a basis point, management fee `1000`.

Loan: flags `196608`, principal `0`, outstanding `0`, interest rate `5000`, next payment due `—`, grace `60` seconds.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`FB588544`](https://devnet.xrpl.org/transactions/FB588544CE04535428FED827935E197D653212082ED764997DCBB3301DB5153B) |
| VaultDeposit | `tesSUCCESS` | yes, `VaultDeposit` | [`E9777713`](https://devnet.xrpl.org/transactions/E97777138928FF9974011571C7BDEE8EF604664231A7A7571D26A6997BD10E2E) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`256A7812`](https://devnet.xrpl.org/transactions/256A7812CAF116A89AB53BFF3A857F2C6BDEB853C1ED8DEB49B93EF783FA183C) |
| CoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`EC170D81`](https://devnet.xrpl.org/transactions/EC170D81726570C01306A7B9CAAF56E551C353012A2EF8A3A6C2ACAB745B2D47) |
| LoanSet | `tesSUCCESS` | yes, `LoanSet` | [`5C65F0A5`](https://devnet.xrpl.org/transactions/5C65F0A51F7EE7A992DA1B296D77C5E2893B8FDEC86A5E75E4895FE45D86CD05) |
| LoanManage impair (due, grace still running) | `tesSUCCESS` | yes, `LoanManage` | [`A3734858`](https://devnet.xrpl.org/transactions/A3734858DD8D5DF2E19384B882682083BA338FC1EECED00E3E7A3357DD62F55D) |
| LoanManage impair (already impaired) | `tecNO_PERMISSION` | yes, `LoanManage` | [`C9F00989`](https://devnet.xrpl.org/transactions/C9F009890DB54D8D0DC464403A6893FF95CE461FD71CC04C1E068044638BA649) |
| LoanManage default | `tesSUCCESS` | yes, `LoanManage` | [`D4F71EBF`](https://devnet.xrpl.org/transactions/D4F71EBF5F3234A8C47D2DBC16E7C17AA1A4C12E7858D6EDF392E7FF62F7F035) |

## Standing vault of 12 September, superseded by Fund I

the vault the landing page advertised on Saturday; its loan falls due on Sunday afternoon, so the app now opens Fund I. Evidence: [`docs/evidence/standing-demo.json`](./evidence/standing-demo.json).

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
| Vault | [`FAB518C7FC616F2BEAE22537F94B53C33AF9138FC472FAF0043057B6C3020132`](https://devnet.xrpl.org/vault/FAB518C7FC616F2BEAE22537F94B53C33AF9138FC472FAF0043057B6C3020132) | closed-ended, `VaultKind 1` |
| Loan broker | `794653A2DFABC2811C9E2748109AECB50384F9B9C9A39E7BACE7E47177F1DEA9` | the lending agent, on the vault page under Loans |
| Loan | `1D4630153B6EA3E59E1ACF621171C4B288DFB66BE30BD338E47DD73791B95BB8` | the loan of securities |
| Security, MPT issuance | `005047816F6E93FF4027878DF0E68EDE3564DE25547C5051` | TBL, the vault asset, require-auth |
| Vault shares, MPT issuance | `000000013004654E139759B62C0AE3AEEA33401D2184838A` | the lender position, 5000000 outstanding |
| Permissioned domain | `9200CA563850C11940BB7666344C98E411F4AEC33E4E35E825DBC3CF5C96A908` | the eligibility gate |

Vault state now: assets `5000000`, available `3000000`, unrealised loss `0`. Subscription closes `842559790`, redemption opens `842624590`, Ripple epoch.

Broker: cover `2500000`, debt `2000000`, ceiling `4000000`, cover rate `100000` and liquidation rate `100000` in tenths of a basis point, management fee `1000`.

Loan: flags `0`, principal `2000000`, outstanding `2000183`, interest rate `5000`, next payment due `842617452`, grace `60` seconds.

### Transactions

| Step | Result | Verified on chain | Link |
|---|---|---|---|
| CredentialCreate lender | `tesSUCCESS` | yes, `CredentialCreate` | [`637B18C4`](https://devnet.xrpl.org/transactions/637B18C454203E3F132838C6DCF45E97B13836FF9C1289ABA3592FFC61A5FC28) |
| CredentialAccept lender | `tesSUCCESS` | yes, `CredentialAccept` | [`BCC0A216`](https://devnet.xrpl.org/transactions/BCC0A216D663B3C74C80CE3A601B3CEBC1B4F087577B03E9F20ABEF2AFE7B9A9) |
| PermissionedDomainSet | `tesSUCCESS` | yes, `PermissionedDomainSet` | [`783802C2`](https://devnet.xrpl.org/transactions/783802C249DDBE1DCEF43511CDD77B693C79F5A3B08F580BEC1D9A7A3A978EC3) |
| VaultCreate | `tesSUCCESS` | yes, `VaultCreate` | [`8293E877`](https://devnet.xrpl.org/transactions/8293E8774426C7232E6C3E06752CA4867E982EA1F65CF701FA18E11B333E0B4D) |
| LoanBrokerSet | `tesSUCCESS` | yes, `LoanBrokerSet` | [`17BB4425`](https://devnet.xrpl.org/transactions/17BB44256D4855B6E46BB8FC76B93FB6C5B99856C7EB21CD9B1B186282102E81) |
| CoverDeposit | `tesSUCCESS` | yes, `LoanBrokerCoverDeposit` | [`F6925468`](https://devnet.xrpl.org/transactions/F69254683E44AECEEB17B49B8380E8949EDDFAC3864DED05DC919FD5AACED6C8) |
| VaultDeposit lender | `tesSUCCESS` | yes, `VaultDeposit` | [`43EEA67B`](https://devnet.xrpl.org/transactions/43EEA67B0F9B842F4C81971A4EFBC2925CAD7E91C45E65618F6CC7AFA841191C) |
| LoanSet | `tesSUCCESS` | yes, `LoanSet` | [`FAE60FDE`](https://devnet.xrpl.org/transactions/FAE60FDE85E0F7205DD8F5F400A9C9132426237CC7828A4B7E1C2F19984C0AFC) |
| VaultSet term metadata | `tesSUCCESS` | yes, `VaultSet` | [`1E034E77`](https://devnet.xrpl.org/transactions/1E034E77B69539566985ABD88716CBB11DDC83F314761B84CD95F7BFDF808FBA) |

---

72 transactions re-verified against the ledger, 0 mismatches.
