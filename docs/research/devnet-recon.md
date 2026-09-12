# devnet-recon — empirical ground truth on both hackathon networks

Probed 2026-09-12, ~11:33–11:55 UTC (13:33–13:55 CEST), from a machine in Europe.
Everything below is either a raw response captured in this session or a primary source (rippled C++, npm package contents, GitHub API). Nothing is inferred from docs.

---

## 0. HEADLINE — the one finding that decides the track

**`LoanBrokerSet` against an OPEN-ENDED vault succeeds on the custom Hackathon Devnet and FAILS with `tecNO_PERMISSION` on the public XRPL Devnet.**

Empirically, same script, same xrpl.js build (5.2.0-beta.0), both networks:

```
[T1] VaultCreate OPEN                              -> tesSUCCESS  979087ADFE135FC9B61E25F7A4CC5C652DE45F55D1BC387511DDA1AFCD123635
[T1] LoanBrokerSet on OPEN vault                   -> tesSUCCESS  1FCA68C43FB206E40B4F35A84E474F51C2D49C9EC6CC4F3EB3749E4F6AE9F8E5
[T1] VaultCreate CLOSED                            -> tesSUCCESS  A777D07C42A1F7B4735E70B4BF526125E22494C4B2FD01069DA4C88FC5C6FD2B
[T1] LoanBrokerSet on CLOSED vault (Subscription)  -> tesSUCCESS  51389A8BF7B0B014981D54DAF3A622141489C64285F529567644342C3072FD9F

[T2] VaultCreate OPEN                              -> tesSUCCESS  4F5A3197E3616E6F031458C8348518AEC0B7DEC0E452827BC577A9FE8EC7BD43
[T2] LoanBrokerSet on OPEN vault                   -> tecNO_PERMISSION  088685840AAC464244D7FA7FA8368B1B4448B36D178ABE30EB3D994DA6EDB8E9
[T2] VaultCreate CLOSED                            -> tesSUCCESS  735A3D7467977D900FFA0F560583257A228154E1C9C4A0393AE2759D42B98680
[T2] LoanBrokerSet on CLOSED vault (Subscription)  -> tesSUCCESS  DAFB6F7332D6DF9ADD8F5CA43AC175A9E34155DD9747C6B0B3130B12EF3965D7
```

### Why

Both networks have `LendingProtocolV1_1` ENABLED. Under LP V1.1, rippled mainline rejects open-ended vaults at `LoanBrokerSet::preclaim`:

`src/libxrpl/tx/transactors/lending/LoanBrokerSet.cpp` (rippled master, commit 94037361992ad75b32a6b2659b655ab96b7cb7c2):

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

That came from PR https://github.com/XRPLF/rippled/pull/8076 ("fix: Reject open-ended vaults at LoanBrokerSet", merged 2026-08-26 into `develop`).

The custom hackathon node is built from branch `ripple/lending-hackathon`, whose HEAD commit is literally the revert of that PR:

```
440018c0fe3ae85562b0d7cfadab2bce792fd55a  2026-09-10T03:18:57Z  Revert "fix: Reject open-ended vaults at LoanBrokerSet (#8076)"
```
(https://github.com/XRPLF/rippled/tree/ripple/lending-hackathon — via `gh api repos/XRPLF/rippled/branches/ripple/lending-hackathon`)

### Consequences (act on these)

1. **Track 1's open-ended-vault flow is ONLY possible on the custom Hackathon Devnet.** If you point Track 1 code at public Devnet you get `tecNO_PERMISSION` at the first `LoanBrokerSet` and nothing after it works.
2. **Track 2's closed-ended flow runs on BOTH networks** (verified above). The custom devnet is therefore a strictly larger capability surface. If you want a fast rehearsal loop for a Track 2 build, you can rehearse on the custom devnet — but the *submission* must be on public Devnet per the rules, and PPS/accounting may differ because of #8076-adjacent behaviour, so re-run end-to-end on Devnet before freeze.
3. **Do not mix.** networkID differs (4001 vs 2), reserves and fees differ 10x, and the faucet contracts are incompatible (see §4).

---

## 1. server_info / server_state — raw

### Track 1 — `https://lending-hackathon.dev.ripplex.io:51234`
```json
{"result":{"info":{"build_version":"3.4.0-rc1","complete_ledgers":"3-64234","hostid":"LEER",
"io_latency_ms":1,"last_close":{"converge_time_s":2,"proposers":4},"load_factor":1,
"network_id":4001,"peers":4,
"ports":[{"port":"2459","protocol":["peer"]},{"port":"51233","protocol":["ws2","wss2"]},{"port":"50051","protocol":["grpc"]}],
"pubkey_node":"n9LRnfD3GeEMzXPQmbL9GGhJUSmaHLSg3PYkr9Bm6Xgh41ft96W7","server_state":"full",
"time":"2026-Sep-12 11:33:10.614888 UTC","uptime":17215,
"validated_ledger":{"age":1,"base_fee_xrp":1e-05,"reserve_base_xrp":10,"reserve_inc_xrp":2,"seq":64234},
"validation_quorum":4},"status":"success"}}
```

### Track 2 — `https://s.devnet.rippletest.net:51234/`
```json
{"result":{"info":{"build_version":"3.4.0-rc5","complete_ledgers":"4442942-5251653","hostid":"JUTE",
"io_latency_ms":1,"last_close":{"converge_time_s":2.003,"proposers":5},"load_factor":1,
"network_id":2,"peers":23,
"ports":[{"port":"2459","protocol":["peer"]},{"port":"50051","protocol":["grpc"]}],
"pubkey_node":"n9M1eA3x9aA2PEoWAPa8tBJXVSvrmPtGBfebCjSsbwoFh245KgFR","server_state":"full",
"time":"2026-Sep-12 11:33:12.149597 UTC","uptime":56246,
"validated_ledger":{"age":4,"base_fee_xrp":1e-06,"reserve_base_xrp":1,"reserve_inc_xrp":0.2,"seq":5251653},
"validation_quorum":4},"status":"success"}}
```

### Side by side

| | Track 1 custom | Track 2 public Devnet |
|---|---|---|
| build_version | `3.4.0-rc1` (branch `ripple/lending-hackathon`, #8076 reverted) | `3.4.0-rc5` |
| network_id | **4001** | **2** |
| server_state | `full` | `full` |
| complete_ledgers | `3-64234` → `3-64401` (no gaps, genesis-fresh) | `4442942-5251794` (history truncated at 4442942) |
| validation_quorum / peers | 4 / 4 | 4 / 23 |
| base fee | **10 drops** | **1 drop** |
| account reserve | **10 XRP base, 2 XRP/object** | **1 XRP base, 0.2 XRP/object** |
| ledger close interval (measured, 60 s window) | **3.00 s** (20 ledgers / 60 s) | **3.39 s** (18 ledgers / 61 s) |
| JSON-RPC RTT from Europe (median of 8) | **~0.34 s** | **~0.66 s** |
| WSS handshake | `101 Switching Protocols`, `Server: xrpld-3.4.0-rc1` | `101 Switching Protocols`, `Server: xrpld-3.4.0-rc5` |

`3.4.0-rc5` does **not** exist as a public tag in XRPLF/rippled (198 tags enumerated via `gh api repos/XRPLF/rippled/tags --paginate`; only `3.4.0-rc1`, `3.4.0-b1..b3` match `3.4`). You cannot audit the exact source running on public Devnet.

Neither node advertises its JSON-RPC port in `server_info.ports` even though both answer JSON-RPC on 51234; T2 does not advertise its WS port either, though 51233 answers.

---

## 2. Amendments — every ID mapped to a name, definitively

Method: read the Amendments ledger entry
`ledger_entry {"index":"7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4","ledger_index":"validated"}`,
then map IDs to names with the **`feature` RPC, which is open (non-admin) on both nodes** — no need for the xrpl.org table at all.

Verification that the two sources agree exactly:
```
T1: feature RPC enabled set == Amendments ledger object EXACT MATCH   (48 entries)
T2: feature RPC enabled set == Amendments ledger object EXACT MATCH   (89 entries)
```
Neither Amendments object has a `Majorities` field → **no amendment is in voting on either network; nothing can flip during the hackathon.**

### The eight you asked about — definitive

| Amendment | Amendment ID | Track 1 | Track 2 |
|---|---|---|---|
| **SingleAssetVault** | `81BD2619B6B3C8625AC5D0BC01DE17F06C3F0AB95C7C87C93715B87A4FD240D8` | **ENABLED** | **ENABLED** |
| **LendingProtocol** (V1) | `565B90CA1AB2B9D42208ED10884188C64F9E19083DECB9634AAF06EB03299509` | **ENABLED** | **ENABLED** |
| **LendingProtocolV1_1** | `A360E2BFD775A5B0DCE1C36C16DF31B72735A57584FD163655D2F9564F8E7AC8` | **ENABLED** | **ENABLED** |
| LendingProtocolV1_2 | — | **not in the node's feature list at all** (registered on rippled master as `Supported::No`) | same |
| **PermissionedDomains** | `A730EB18A9D4BB52502C898589558B4CCEB4BE10044500EE5581137A2E80E849` | **ENABLED** | **ENABLED** |
| **Credentials** | `1CB67D082CF7D9102412D34258CEDB400E659352D3B207348889297A6D90F5EF` | **ENABLED** | **ENABLED** |
| **TokenEscrow** | `138B968F25822EFBF54C00F97031221C47B1EAB8321D93C7C2AEAF85F04EC5DF` | **ENABLED** | **ENABLED** |
| fixTokenEscrowV1 | `32B8614321F7E070419115ABEAB1742EA20F3E3AF34432B5E2F474F8083260DC` | **ENABLED** | **ENABLED** |
| **MPTokensV1** | `950AE2EA4654E47F04AA8739C0B214E242097E802FD372D24047A89AB1F5EC38` | **ENABLED** | **ENABLED** |
| MPTokensV2 | — | not in feature list (`Supported::No` on master) | same |
| **DynamicMPT** | `58E92F338758479C06084E1B6BA366BAD8F75E5329A7F0EEAFFFDA51E5106B7F` | **ENABLED** | **ENABLED** |
| **Sponsor** (sponsored fees & reserves) | `BE1F90581635DBCEBFC4678C4B54FEDDC1A17B50FD02CFE765A4132A342126AC` | **ENABLED** | **ENABLED** |
| PermissionedDEX | `677E401A423E3708363A36BA8B3A7D019D21AC5ABD00387BDBEA6BDE4C91247E` | ENABLED | ENABLED |
| PermissionDelegationV1_1 | (enabled, see full list) | ENABLED | ENABLED |
| BatchV1_1 | (enabled, see full list) | ENABLED | ENABLED |
| DeepFreeze | `DAF3A6EB04FA5DC51E8E4F23E9B7022B693EFA636F23F22664746C77B5786B23` | ENABLED | ENABLED |
| ConfidentialTransfer | (enabled) | ENABLED | ENABLED |

**Every "Loaded"-flavour primitive on the table is live on both networks.** Permissioned Domains + Credentials, TokenEscrow (+ its fix), Sponsor (sponsored fees/reserves), MPTs including DynamicMPT. Nothing to check at runtime — pick freely.

### Amendment-set difference between the two networks

Every amendment enabled on Track 1 is also enabled on Track 2. Track 2 has 41 more, and **all 41 are retired amendments** — verified by extracting the `XRPL_RETIRE_FEATURE(...)` / `XRPL_RETIRE_FIX(...)` list from `include/xrpl/protocol/detail/features.macro` and diffing: the set difference is empty.

The 41: `CheckCashMakesTrustLine Checks Clawback DeletableAccounts DepositAuth DepositPreauth DisallowIncoming ExpandedSignerList fix1513 fix1515 fix1543 fix1571 fix1578 fix1623 fix1781 fixAmendmentMajorityCalc fixAMMOverflowOffer fixCheckThreading fixDisallowIncomingV1 fixInnerObjTemplate fixMasterKeyAsRegularKey fixNFTokenRemint fixNFTokenReserve fixNonFungibleTokensV1_2 fixPayChanRecipientOwnerDir fixQualityUpperBound fixReducedOffersV1 fixRmSmallIncreasedQOffers fixSTAmountCanonicalize fixTakerDryOfferRemoval fixTrustLinesToSelf fixUniversalNumber Flow FlowSortStrands HardenedValidations ImmediateOfferKilled MultiSignReserve NegativeUNL NonFungibleTokensV1_1 RequireFullyCanonicalSig TicketBatch`

A retired amendment's behaviour is compiled in permanently and it is absent from a genesis-fresh network's amendment table. **So: `Clawback`, `Checks`, `DepositAuth`, `Escrow`, tickets, multisign etc. all work on the custom devnet even though they do not appear in its Amendments object.** Do not read the shorter list as "missing features".

### Full enabled list, Track 1 (48)
```
AMM 8CC0774A3BF66D1D22E76BBDA8E8A232E6B6313834301B3B23E8601196AE6455
AMMClawback 726F944886BCDF7433203787E93DD9AA87FAB74DFE3AF4785BA03BEFC97ADA1F
BatchV1_1 9F287AED3CDB50A7BD1ACEC24296A30C9B5230CCD136219317AC790E3B884377
ConfidentialTransfer 2110E4A19966E2EF517C0A8C56A5F35099D7665B0BB89D7B126B30D50B86AAD5
Credentials 1CB67D082CF7D9102412D34258CEDB400E659352D3B207348889297A6D90F5EF
DID DB432C3A09D9D5DFC7859F39AE5FF767ABC59AED0A9FB441E83B814D8946C109
DeepFreeze DAF3A6EB04FA5DC51E8E4F23E9B7022B693EFA636F23F22664746C77B5786B23
DynamicMPT 58E92F338758479C06084E1B6BA366BAD8F75E5329A7F0EEAFFFDA51E5106B7F
DynamicNFT C1CE18F2A268E6A849C27B3DE485006771B4C01B2FCEC4F18356FE92ECD6BB74
LendingProtocol 565B90CA1AB2B9D42208ED10884188C64F9E19083DECB9634AAF06EB03299509
LendingProtocolV1_1 A360E2BFD775A5B0DCE1C36C16DF31B72735A57584FD163655D2F9564F8E7AC8
MPTokensV1 950AE2EA4654E47F04AA8739C0B214E242097E802FD372D24047A89AB1F5EC38
NFTokenMintOffer EE3CF852F0506782D05E65D49E5DCC3D16D50898CD1B646BAE274863401CC3CE
PermissionDelegationV1_1 0F48FF561C709540328F31F1C97FD512ACC8B4E42138A161CB0E21ECA292540B
PermissionedDEX 677E401A423E3708363A36BA8B3A7D019D21AC5ABD00387BDBEA6BDE4C91247E
PermissionedDomains A730EB18A9D4BB52502C898589558B4CCEB4BE10044500EE5581137A2E80E849
PriceOracle 96FD2F293A519AE1DB6F8BED23E4AD9119342DA7CB6BAFD00953D16C54205D8B
SingleAssetVault 81BD2619B6B3C8625AC5D0BC01DE17F06C3F0AB95C7C87C93715B87A4FD240D8
Sponsor BE1F90581635DBCEBFC4678C4B54FEDDC1A17B50FD02CFE765A4132A342126AC
TokenEscrow 138B968F25822EFBF54C00F97031221C47B1EAB8321D93C7C2AEAF85F04EC5DF
XChainBridge C98D98EE9616ACD36E81FDEB8D41D349BF5F1B41DD64A0ABC1FE9AA5EA267E9C
XRPFees 93E516234E35E08CA689FA33A6D38E103881F8DCB53023F728C307AA89D515A7
fixAMMClawbackRounding 5E9586DB3D765B4C5794658FB6BB385071E9838DF4016027E6E26820C8526724
fixAMMv1_1 35291ADD2D79EB6991343BDA0912269C817D0F094B02226C1C14AD2858962ED4
fixAMMv1_2 1E7ED950F2F13C4F8E2A54103B74D57D5D298FFDBD005936164EE9E6484C438C
fixAMMv1_3 7CA70A7674A26FA517412858659EBC7EDEEF7D2D608824464E6FDEFD06854E14
fixCleanup3_1_3 303ACB16CF8DBD3B5C34F131A9D19A7DE01AE05F480A8A682B869D1B4AAC8CFC
fixCleanup3_2_0 21B8D2F76F68E11E9C077A43BBBC394136E9987E99DDB73966DD68419467E431
fixCleanup3_3_0 3298D47E1F3A8A24FECAA30F699B8FE1DD234E072834BA099AD8180FFCE0FEC4
fixCleanup3_4_0 98433DD001A5737F773D74F8CA2A25A065089C73B2E611C760BAF369E4FECA76
fixDirectoryLimit 41765F664A8D67FF03DDB1C1A893DE6273690BA340A6C2B07C8D29D0DD013D3A
fixEmptyDID 755C971C29971C9F20C6F080F2ED96F87884E40AD19554A5EBECDCEC8A1F77FE
fixEnforceNFTokenTrustline 763C37B352BE8C7A04E810F8E462644C45AFEAD624BF3894A08E5C917CF9FF39
fixEnforceNFTokenTrustlineV2 B32752F7DCC41FB86534118FC4EEC8F56E7BD0A7DB60FD73F93F257233C08E3A
fixFillOrKill 3318EA0CF0755AF15DAC19F2B5C5BCBFF4B78BDD57609ACCAABE2C41309B051A
fixFrozenLPTokenTransfer 83FD6594FF83C1D105BD2B41D7E242D86ECB4A8220BD9AF4DA35CB0F69E39B2A
fixIncludeKeyletFields 6143A27B71F7DAF9330ECA7C5EC3D54C8083A4FDEF7016737EEC06AB61E82EE0
fixInnerObjTemplate2 9196110C23EA879B4229E51C286180C7D02166DA712559F634372F5264D0EC59
fixInvalidTxFlags 8EC4304A06AF03BE953EA6EDA494864F6F3F30AA002BABA35869FBB8C6AE5D52
fixMPTDeliveredAmount AB8D932A5F338903FE5BCBD80B611FFED70839ABA3170E9CE01D947C0EDEDCF2
fixNFTokenPageLinks C7981B764EC4439123A86CC7CCBA436E9B3FF73B3F10A0AE51882E404522FC41
fixPayChanCancelAfter D3456A862DC07E382827981CA02E21946E641877F19B8889031CC57FDCAC83E2
fixPreviousTxnID 7BB62DC13EC72B775091E9C71BF8CF97E122647693B50C5E87A80DFD6FCFAC50
fixPriceOracleOrder FF2D1E13CF6D22427111B967BD504917F63A900CECD320D6FD3AC9FA90344631
fixReducedOffersV2 31E0DA76FB8FB527CADCDF0E61CB9C94120966328EFA9DCA202135BAF319C0BA
fixRemoveNFTokenAutoTrustLine DF8B4536989BDACE3F934F29423848B9F1D76D09BE6A1FCFE7E7F06AA26ABEAD
fixTokenEscrowV1 32B8614321F7E070419115ABEAB1742EA20F3E3AF34432B5E2F474F8083260DC
fixXChainRewardRounding 2BF037D90E1B676B17592A8AF55E88DB465398B4B597AE46EECEE1399AB05699
```

### Full enabled list, Track 2 (89)
```
AMM 8CC0774A3BF66D1D22E76BBDA8E8A232E6B6313834301B3B23E8601196AE6455
AMMClawback 726F944886BCDF7433203787E93DD9AA87FAB74DFE3AF4785BA03BEFC97ADA1F
BatchV1_1 9F287AED3CDB50A7BD1ACEC24296A30C9B5230CCD136219317AC790E3B884377
CheckCashMakesTrustLine 98DECF327BF79997AEC178323AD51A830E457BFC6D454DAF3E46E5EC42DC619F
Checks 157D2D480E006395B76F948E3E07A45A05FE10230D88A7993C71F97AE4B1F2D1
Clawback 56B241D7A43D40354D02A9DC4C8DF5C7A1F930D92A9035C4E12291B3CA3E1C2B
ConfidentialTransfer 2110E4A19966E2EF517C0A8C56A5F35099D7665B0BB89D7B126B30D50B86AAD5
Credentials 1CB67D082CF7D9102412D34258CEDB400E659352D3B207348889297A6D90F5EF
DID DB432C3A09D9D5DFC7859F39AE5FF767ABC59AED0A9FB441E83B814D8946C109
DeepFreeze DAF3A6EB04FA5DC51E8E4F23E9B7022B693EFA636F23F22664746C77B5786B23
DeletableAccounts 30CD365592B8EE40489BA01AE2F7555CAC9C983145871DC82A42A31CF5BAE7D9
DepositAuth F64E1EABBE79D55B3BB82020516CEC2C582A98A6BFE20FBE9BB6A0D233418064
DepositPreauth 3CBC5C4E630A1B82380295CDA84B32B49DD066602E74E39B85EF64137FA65194
DisallowIncoming 47C3002ABA31628447E8E9A8B315FAA935CE30183F9A9B86845E469CA2CDC3DF
DynamicMPT 58E92F338758479C06084E1B6BA366BAD8F75E5329A7F0EEAFFFDA51E5106B7F
DynamicNFT C1CE18F2A268E6A849C27B3DE485006771B4C01B2FCEC4F18356FE92ECD6BB74
ExpandedSignerList B2A4DB846F0891BF2C76AB2F2ACC8F5B4EC64437135C6E56F3F859DE5FFD5856
Flow 740352F2412A9909880C23A559FCECEDA3BE2126FED62FC7660D628A06927F11
FlowSortStrands AF8DF7465C338AE64B1E937D6C8DA138C0D63AD5134A68792BBBE1F63356C422
HardenedValidations 1F4AFA8FA1BC8827AD4C0F682C03A8B671DCDF6B5C4DE36D44243A684103EF88
ImmediateOfferKilled 75A7E01C505DD5A179DFE3E000A9B6F1EDDEB55A12F95579A23E15B15DC8BE5A
LendingProtocol 565B90CA1AB2B9D42208ED10884188C64F9E19083DECB9634AAF06EB03299509
LendingProtocolV1_1 A360E2BFD775A5B0DCE1C36C16DF31B72735A57584FD163655D2F9564F8E7AC8
MPTokensV1 950AE2EA4654E47F04AA8739C0B214E242097E802FD372D24047A89AB1F5EC38
MultiSignReserve 586480873651E106F1D6339B0C4A8945BA705A777F3F4524626FF1FC07EFE41D
NFTokenMintOffer EE3CF852F0506782D05E65D49E5DCC3D16D50898CD1B646BAE274863401CC3CE
NegativeUNL B4E4F5D2D6FB84DF7399960A732309C9FD530EAE5941838160042833625A6076
NonFungibleTokensV1_1 32A122F1352A4C7B3A6D790362CC34749C5E57FCE896377BFDC6CCD14F6CD627
PermissionDelegationV1_1 0F48FF561C709540328F31F1C97FD512ACC8B4E42138A161CB0E21ECA292540B
PermissionedDEX 677E401A423E3708363A36BA8B3A7D019D21AC5ABD00387BDBEA6BDE4C91247E
PermissionedDomains A730EB18A9D4BB52502C898589558B4CCEB4BE10044500EE5581137A2E80E849
PriceOracle 96FD2F293A519AE1DB6F8BED23E4AD9119342DA7CB6BAFD00953D16C54205D8B
RequireFullyCanonicalSig 00C1FC4A53E60AB02C864641002B3172F38677E29C26C5406685179B37E1EDAC
SingleAssetVault 81BD2619B6B3C8625AC5D0BC01DE17F06C3F0AB95C7C87C93715B87A4FD240D8
Sponsor BE1F90581635DBCEBFC4678C4B54FEDDC1A17B50FD02CFE765A4132A342126AC
TicketBatch 955DF3FA5891195A9DAEFA1DDC6BB244B545DDE1BAA84CBB25D5F12A8DA68A0C
TokenEscrow 138B968F25822EFBF54C00F97031221C47B1EAB8321D93C7C2AEAF85F04EC5DF
XChainBridge C98D98EE9616ACD36E81FDEB8D41D349BF5F1B41DD64A0ABC1FE9AA5EA267E9C
XRPFees 93E516234E35E08CA689FA33A6D38E103881F8DCB53023F728C307AA89D515A7
fix1513 67A34F2CF55BFC0F93AACD5B281413176FEE195269FA6D95219A2DF738671172
fix1515 5D08145F0A4983F23AFFFF514E83FAD355C5ABFBB6CAB76FB5BC8519FF5F33BE
fix1543 CA7C02118BA27599528543DFE77BA6838D1B0F43B447D4D7F53523CE6A0E9AC2
fix1571 7117E2EC2DBF119CA55181D69819F1999ECEE1A0225A7FD2B9ED47940968479C
fix1578 FBD513F1B893AC765B78F250E6FFA6A11B573209D1842ADC787C850696741288
fix1623 58BE9B5968C4DA7C59BA900961828B113E5490699B21877DEF9A31E9D0FE5D5F
fix1781 25BA44241B3BD880770BFA4DA21C7180576831855368CBEC6A3154FDE4A7676E
fixAMMClawbackRounding 5E9586DB3D765B4C5794658FB6BB385071E9838DF4016027E6E26820C8526724
fixAMMOverflowOffer 12523DF04B553A0B1AD74F42DDB741DE8DC06A03FC089A0EF197E2A87F1D8107
fixAMMv1_1 35291ADD2D79EB6991343BDA0912269C817D0F094B02226C1C14AD2858962ED4
fixAMMv1_2 1E7ED950F2F13C4F8E2A54103B74D57D5D298FFDBD005936164EE9E6484C438C
fixAMMv1_3 7CA70A7674A26FA517412858659EBC7EDEEF7D2D608824464E6FDEFD06854E14
fixAmendmentMajorityCalc 4F46DF03559967AC60F2EB272FEFE3928A7594A45FF774B87A7E540DB0F8F068
fixCheckThreading 8F81B066ED20DAECA20DF57187767685EEF3980B228E0667A650BAF24426D3B4
fixCleanup3_1_3 303ACB16CF8DBD3B5C34F131A9D19A7DE01AE05F480A8A682B869D1B4AAC8CFC
fixCleanup3_2_0 21B8D2F76F68E11E9C077A43BBBC394136E9987E99DDB73966DD68419467E431
fixCleanup3_3_0 3298D47E1F3A8A24FECAA30F699B8FE1DD234E072834BA099AD8180FFCE0FEC4
fixCleanup3_4_0 98433DD001A5737F773D74F8CA2A25A065089C73B2E611C760BAF369E4FECA76
fixDirectoryLimit 41765F664A8D67FF03DDB1C1A893DE6273690BA340A6C2B07C8D29D0DD013D3A
fixDisallowIncomingV1 15D61F0C6DB6A2F86BCF96F1E2444FEC54E705923339EC175BD3E517C8B3FF91
fixEmptyDID 755C971C29971C9F20C6F080F2ED96F87884E40AD19554A5EBECDCEC8A1F77FE
fixEnforceNFTokenTrustline 763C37B352BE8C7A04E810F8E462644C45AFEAD624BF3894A08E5C917CF9FF39
fixEnforceNFTokenTrustlineV2 B32752F7DCC41FB86534118FC4EEC8F56E7BD0A7DB60FD73F93F257233C08E3A
fixFillOrKill 3318EA0CF0755AF15DAC19F2B5C5BCBFF4B78BDD57609ACCAABE2C41309B051A
fixFrozenLPTokenTransfer 83FD6594FF83C1D105BD2B41D7E242D86ECB4A8220BD9AF4DA35CB0F69E39B2A
fixIncludeKeyletFields 6143A27B71F7DAF9330ECA7C5EC3D54C8083A4FDEF7016737EEC06AB61E82EE0
fixInnerObjTemplate C393B3AEEBF575E475F0C60D5E4241B2070CC4D0EB6C4846B1A07508FAEFC485
fixInnerObjTemplate2 9196110C23EA879B4229E51C286180C7D02166DA712559F634372F5264D0EC59
fixInvalidTxFlags 8EC4304A06AF03BE953EA6EDA494864F6F3F30AA002BABA35869FBB8C6AE5D52
fixMPTDeliveredAmount AB8D932A5F338903FE5BCBD80B611FFED70839ABA3170E9CE01D947C0EDEDCF2
fixMasterKeyAsRegularKey C4483A1896170C66C098DEA5B0E024309C60DC960DE5F01CD7AF986AA3D9AD37
fixNFTokenPageLinks C7981B764EC4439123A86CC7CCBA436E9B3FF73B3F10A0AE51882E404522FC41
fixNFTokenRemint AE35ABDEFBDE520372B31C957020B34A7A4A9DC3115A69803A44016477C84D6E
fixNFTokenReserve 03BDC0099C4E14163ADA272C1B6F6FABB448CC3E51F522F978041E4B57D9158C
fixNonFungibleTokensV1_2 73761231F7F3D94EC3D8C63D91BDD0D89045C6F71B917D1925C01253515A6669
fixPayChanCancelAfter D3456A862DC07E382827981CA02E21946E641877F19B8889031CC57FDCAC83E2
fixPayChanRecipientOwnerDir 621A0B264970359869E3C0363A899909AAB7A887C8B73519E4ECF952D33258A8
fixPreviousTxnID 7BB62DC13EC72B775091E9C71BF8CF97E122647693B50C5E87A80DFD6FCFAC50
fixPriceOracleOrder FF2D1E13CF6D22427111B967BD504917F63A900CECD320D6FD3AC9FA90344631
fixQualityUpperBound 89308AF3B8B10B7192C4E613E1D2E4D9BA64B2EE2D5232402AE82A6A7220D953
fixReducedOffersV1 27CD95EE8E1E5A537FF2F89B6CEB7C622E78E9374EBD7DCBEDFAE21CD6F16E0A
fixReducedOffersV2 31E0DA76FB8FB527CADCDF0E61CB9C94120966328EFA9DCA202135BAF319C0BA
fixRemoveNFTokenAutoTrustLine DF8B4536989BDACE3F934F29423848B9F1D76D09BE6A1FCFE7E7F06AA26ABEAD
fixRmSmallIncreasedQOffers B6B3EEDC0267AB50491FDC450A398AF30DBCD977CECED8BEF2499CAB5DAC19E2
fixSTAmountCanonicalize 452F5906C46D46F407883344BFDD90E672B672C5E9943DB4891E3A34FEEEB9DB
fixTakerDryOfferRemoval 2CD5286D8D687E98B41102BDD797198E81EA41DF7BD104E6561FEB104EFF2561
fixTokenEscrowV1 32B8614321F7E070419115ABEAB1742EA20F3E3AF34432B5E2F474F8083260DC
fixTrustLinesToSelf F1ED6B4A411D8B872E65B9DCB4C8B100375B0DD3D62D07192E011D6D7F339013
fixUniversalNumber 2E2FB9CF8A44EB80F4694D38AADAE9B8B7ADAFD2F092E10068E61C98C4F092B0
fixXChainRewardRounding 2BF037D90E1B676B17592A8AF55E88DB465398B4B597AE46EECEE1399AB05699
```

---

## 3. Empirical vault/broker probes (raw evidence)

All submitted with `xrpl.js@5.2.0-beta.0`, wallets from each network's own faucet.

### VaultCreate works on both, open AND closed

`tx` on the Track-1 **closed-ended** vault (api_version 1 shape):
```json
{"result":{"Account":"rhSGbdWqivxZ2J4HywPe3KoZ9WxaqC7stF","Asset":{"currency":"XRP"},
"Fee":"2000000","Flags":0,"LastLedgerSequence":64388,"NetworkID":4001,
"RedemptionDate":842532106,"Sequence":64367,"SubscriptionDate":842528506,
"TransactionType":"VaultCreate","VaultKind":1,"WithdrawalPolicy":1,
"ctid":"C000FB7200000FA1","date":842528400,
"hash":"577914D4B4F214A0B0E63C9C5F06CAB97DB2A8C250AEB2CA3CB683A7CA1FB00F",
"ledger_index":64370,"status":"success","validated":true}}
```
Track-2 equivalent (`C9A39439926955056BEE0363742759D3857F5C871A91EA99777855101F06D088`): `Fee:"200000"`, `VaultKind:1`, **no `NetworkID` field** (network ids < 1025 do not carry `NetworkID`; 4001 does — autofill handles this, but note it if you hand-build blobs).

Resulting `Vault` ledger object as read back from Track 1 `account_objects`:
```json
{"Account":"ra7uUe8Tp8hfLc2zqwDaXoN3V5cSm2tg42","Asset":{"currency":"XRP"},"Flags":0,
 "LEVersion":1,"LedgerEntryType":"Vault","Owner":"rEqT51GwrnNYgrjHAyRwTYRkqgY3tPoPT7",
 "OwnerNode":"0","RedemptionDate":842532058,"Sequence":64351,
 "ShareMPTID":"000000013C1F6F5BB66A051153A4DB7FF9D473E213B2C3AA",
 "SubscriptionDate":842528458,"VaultKind":1,"WithdrawalPolicy":1,
 "index":"97155537D1C66F69516D35E1CAAB1CFBA41A7CFE15087F4390D164638B2DE700"}
```
Note `LEVersion: 1` — present on vaults on both networks, and present in the binary codec (`LEVersion` UInt8 nth=6) but **absent from the xrpl.js `Vault` interface in 5.2.0 stable** (present in 5.2.0-beta.0/beta.1).

Each `VaultCreate` also creates an `MPToken` for the creator and an `MPTokenIssuance` on the vault pseudo-account. Vault pseudo-account reserve seen on T1: `12.00 XRP` (10 base + 2 for the issuance).

### VaultCreate fee is one owner-reserve increment

`client.autofill()` on Track 1 produced:
```
VaultCreate    Fee = 2000000 drops  (= reserve_inc, 2 XRP)
VaultDeposit   Fee = 12 drops
LoanBrokerSet  Fee = 12 drops
Payment        Fee = 12 drops
LoanSet        -> THREW: "Entry not found."
```
Source: `xrpl/dist/npm/sugar/autofill.js`
```js
const isSpecialTxCost = ['AccountDelete','AMMCreate','VaultCreate'].includes(tx.TransactionType)
...
else if (isSpecialTxCost) { baseFee = yield fetchOwnerReserveFee(client) }   // server_state.validated_ledger.reserve_inc
```
So a `VaultCreate` costs **2 XRP on Track 1** and **0.2 XRP on Track 2**. With the Track-1 faucet handing out exactly 1000 XRP and refusing top-ups, budget accordingly (a demo that creates half a dozen vaults burns 12 XRP in fees alone — fine, but the reserves add up faster: 10 XRP base + 2 XRP per owned object).

### `LoanBrokerSet` parameter bounds (discovered the hard way)

`CoverRateMinimum: 1000000` → xrpl.js `ValidationError: LoanBrokerSet: CoverRateMinimum must be between 0 and 100000 inclusive`.
`100000` is 100 % at 1e-3 precision, i.e. these rates are **parts-per-100000**. `10000` = 10 %. Same bound applies to `CoverRateLiquidation`.

### Transaction types actually present in the binary codec (identical in 5.2.0-beta.0, 5.2.0-beta.1 and 5.2.0 stable; `ripple-binary-codec@2.11.0`)

```
VaultCreate=65  VaultSet=66  VaultDelete=67  VaultDeposit=68  VaultWithdraw=69  VaultClawback=70
LoanBrokerSet=74  LoanBrokerCoverDeposit=76  LoanBrokerCoverWithdraw=77  LoanBrokerCoverClawback=78
LoanBrokerDelete=75  LoanSet=80  LoanDelete=81  LoanManage=82  LoanPay=84
Ledger entries: Vault=132 (0x0084)  LoanBroker=136 (0x0088)  Loan=137 (0x0089)
```
**There is no `LoanDraw` / `LoanDrawdown` transaction type.** Confirmed against `include/xrpl/protocol/detail/transactions.macro` on rippled master — 71–73 are explicitly reserved ("Reserve 72-73 for future Vault-related transactions"), and nothing named "draw" exists. `LoanBrokerCoverClawback` (78) exists and is **not** in the event brief's list.

Relevant binary-codec field types (all three SDK builds identical):
```
VaultKind UInt8 nth=22          SubscriptionDate UInt32 nth=75     RedemptionDate UInt32 nth=76
LEVersion UInt8 nth=6           VaultID Hash256 nth=35             ShareMPTID Hash192 nth=2
LoanBrokerID Hash256 nth=37     LoanID Hash256 nth=38              MPTokenIssuanceID Hash192 nth=1
AssetsTotal/AssetsAvailable/AssetsMaximum/LossUnrealized/DebtTotal/DebtMaximum/CoverAvailable/
  LoanOriginationFee/LoanServiceFee/PrincipalOutstanding/PeriodicPayment/
  InterestOutstanding/ManagementFeeOutstanding  -> type "Number"  (XRPLNumber, string in JSON)
ManagementFeeRate UInt16 nth=22   CoverRateMinimum UInt32 nth=62   CoverRateLiquidation UInt32 nth=63
InterestRate UInt32 nth=65  LateInterestRate UInt32 nth=66  CloseInterestRate UInt32 nth=67
PaymentInterval UInt32 nth=55  GracePeriod UInt32 nth=56  StartDate UInt32 nth=54
NextPaymentDueDate UInt32 nth=58  PaymentRemaining UInt32 nth=59  LoanSequence UInt32 nth=61
LoanScale Int32 nth=1  WithdrawalPolicy UInt8 nth=20
```

---

## 4. Faucets — tested with real POSTs, and they are NOT the same API

### Track 1 — `https://lending-hackathon-faucet.dev.ripplex.io/accounts`
```
POST {}  ->  HTTP/1.1 200, Content-Type: application/json, X-Powered-By: Express, Access-Control-Allow-Origin: *
{"account":{"address":"rEQbLj7Ka9CY3vHFoqhkkZef36MFGW3rRr","secret":"sEd[redacted devnet seed]"},"balance":1000}
```
- Funds **1000 XRP** per call, brand-new ed25519 account (`sEd...` seeds).
- **No `classicAddress`, no `xAddress`, no `seed`, no `amount`, no `transactionHash` field.**
- Latency ~0.28–0.55 s. Account is validated on-ledger within a few seconds (`Balance: "1000000000"`).
- **No rate limiting observed**: 6 back-to-back calls, all 200, all funded.
- `GET /accounts` → 404. `GET /` → 404 `Cannot GET /`. No web UI, no docs endpoint.
- **`destination` is silently ignored.** `POST {"destination":"rEQbLj..."}` returns a *new* account and the named account's balance is unchanged (still `1000000000`). Same with `{"destination":..., "xrpAmount":"5000"}`. **You cannot top up an existing account on Track 1.** To assemble >1000 XRP you must drain several fresh faucet accounts with `Payment`s.

### Track 2 — `https://faucet.devnet.rippletest.net/accounts`
```
POST {}  ->  HTTP/1.1 200
{"account":{"xAddress":"X7qkQ...","address":"rfF9GUV5kyVxfy5sjWXDGdFsxyu8YiHyhH","classicAddress":"rfF9GUV5kyVxfy5sjWXDGdFsxyu8YiHyhH"},
 "amount":100,"transactionHash":"ABD2397BD8DB4131A02895CE6E90068D58C6BAA0FE1AD03E6758438BE83069F0","seed":"sEd[redacted devnet seed]"}
```
- Funds **100 XRP** per call. Latency ~0.63–0.69 s.
- **No rate limiting observed**: 5 back-to-back calls, all 200. No `RateLimit-*` or `Retry-After` headers.
- **`destination` and `xrpAmount` ARE honoured.** `POST {"destination":"rfF9GU...","xrpAmount":"1000"}` returned `{"amount":1000,"transactionHash":"BF0ED2..."}` and the balance went `100000000 → 1100000000`. Top-ups work; this is how you assemble a big lender on Track 2.
- `GET /` → 404 `Cannot GET /`.

### `client.fundWallet()` — works on Track 2, BROKEN on Track 1
```
T1 custom: fundWallet FAILED XRPLFaucetError: The faucet account is undefined
T2 devnet: fundWallet OK addr=rfWNTA4H1qythtvF5tJU9yqptXrEvJkwZF balance=100
```
(`client.fundWallet(null, { faucetHost: 'lending-hackathon-faucet.dev.ripplex.io' })`)

Root cause, `xrpl/dist/npm/Wallet/fundWallet.js`:
```js
const classicAddress = body.account.classicAddress;                       // line 57
return processSuccessfulResponse(client, classicAddress, walletToFund, startingBalance);
...
if (!classicAddress) { return Promise.reject(new XRPLFaucetError(`The faucet account is undefined`)) }   // line 66-67
```
The Track-1 faucet returns `account.address` but **not** `account.classicAddress`, so `fundWallet` always rejects. Also, xrpl.js can never infer the host: `defaultFaucets.js` only maps `networkID` 1 → Testnet and 2 → Devnet; networkID 4001 throws `Faucet URL is not defined or inferrable`.

**Workaround to use on Track 1** — do not call `fundWallet`, call the faucet yourself:
```js
const j = await (await fetch('https://lending-hackathon-faucet.dev.ripplex.io/accounts',
  {method:'POST', headers:{'content-type':'application/json'}, body:'{}'})).json()
const wallet = Wallet.fromSeed(j.account.secret)   // NB: .account.secret, not .seed
// then poll account_info until it resolves; the faucet returns before the tx validates
```

---

## 5. Explorers — both render, verified in a real browser

Both hosts serve a 2150-byte client-rendered SPA shell, so `curl` proves nothing beyond reachability. Loaded both in Chrome and read the rendered DOM.

- `https://custom.xrpl.org/lending-hackathon.dev.ripplex.io:51233/` → HTTP 200, `<title>XRPL Explorer</title>`, bundle `/assets/index-CQTZ_-aN.js` (1 566 437 B).
- `https://devnet.xrpl.org` → HTTP 200, same title, **different** bundle `/assets/index-BIEe6eAG.js` (1 564 483 B). Not byte-identical to the custom one.

Both bundles contain the strings `VaultCreate, VaultDeposit, VaultWithdraw, VaultSet, VaultClawback, LoanBrokerSet, LoanSet, LoanPay, LoanManage, LoanDelete, LoanBrokerCoverDeposit, MPTokenIssuanceCreate` — i.e. both know the lending transaction types.

Rendered, Track 1, a closed-ended `VaultCreate`
(`/transactions/577914D4B4F214A0B0E63C9C5F06CAB97DB2A8C250AEB2CA3CB683A7CA1FB00F`):
```
VaultCreate / Success
HASH: 577914D4...  CTID: C000FB7200000FA1
Simple|Detailed|Raw
Asset  XRP
Withdrawal Policy  vaultStrategyFirstComeFirstServe
DATE/TIME (UTC) 9/12/2026, 11:40:00 AM
LEDGER INDEX 64370
ACCOUNT rhSGbdWqivxZ2J4HywPe3KoZ9WxaqC7stF
SEQUENCE NUMBER 64367
TRANSACTION COST 2.00
```
Rendered, Track 2, same transaction type — identical layout, `TRANSACTION COST 0.20`.

**The Simple view omits `VaultKind`, `SubscriptionDate` and `RedemptionDate`** even though the transaction carries them. A closed-ended vault is visually indistinguishable from an open-ended one in the explorer's default view. Fine for a judge who clicks "Raw"; bad for a demo. Plan to show the ledger object via `ledger_entry`/`account_objects` in your own UI rather than relying on the explorer to make the point.

Vault pseudo-account pages render correctly, e.g. Track 1 `/accounts/ra7uUe8Tp8hfLc2zqwDaXoN3V5cSm2tg42`:
```
XRP BALANCE 0.00   RESERVE BALANCE 12.00
Assets Issued: MPTs (1)
Transactions: rEqT51Gw... VAULT CREATE Success 9/12/2026, 11:39:03 AM  "CREATEVAULT FOR XRP"
```

Deep links to accounts and transactions both return 200 and render. Use them in the submission.

---

## 6. xrpl.js version reality — the brief's pin is right, and here's why

`npm view xrpl time`:
```
5.1.0          2026-08-25T00:29:45.635Z
5.2.0-beta.0   2026-09-10T13:42:46.142Z
5.2.0-beta.1   2026-09-11T16:59:54.345Z
5.2.0          2026-09-11T22:20:39.737Z     <- stable, published LAST NIGHT
```
dist-tags: `latest: 5.2.0`, `beta-experimental: 5.2.0-beta.1`.

**`5.2.0` stable does NOT carry closed-ended vault support.** Diffing the installed packages:

`models/transactions/vaultCreate.d.ts` — beta.0/beta.1 have, stable does **not**:
```ts
export declare enum VaultKind { vaultKindOpen = 0, vaultKindClosed = 1 }
export interface VaultCreate extends BaseTransaction {
  ... VaultKind?: number; SubscriptionDate?: number; RedemptionDate?: number;
}
```
`models/ledger/Vault.d.ts` — beta has `LEVersion?`, `VaultKind?`, `SubscriptionDate?`, `RedemptionDate?`; stable has none of them.

Beta-only runtime validation in `validateVaultCreate` (absent from stable):
```js
const MIN_INVESTMENT_PERIOD = 180
const MAX_INVESTMENT_PERIOD = 946708560
// 'VaultCreate: A close-ended vault requires both SubscriptionDate and RedemptionDate'
// `VaultCreate: RedemptionDate - SubscriptionDate must be within [180, 946708560) seconds`
// 'VaultCreate: SubscriptionDate and RedemptionDate can only be set on a close-ended vault (VaultKind=1)'
// 'VaultCreate: Data must be a hex string with an even number of characters'   (stable: 'must be a valid hex string')
```
`loanBrokerCoverWithdraw` in beta also validates `CredentialIDs` (`validateCredentialsList(..., MAX_AUTHORIZED_CREDENTIALS)`); stable does not.

**The minimum investment period is 180 seconds.** That is your floor for compressing a closed-ended vault into the event timeline: `RedemptionDate - SubscriptionDate >= 180 s`. (I used 600 s and 3600 s successfully.)

`5.2.0-beta.0` and `5.2.0-beta.1` have **byte-identical** `vaultCreate.js`. If beta.0 ever goes missing from the registry, beta.1 is a drop-in.

Mitigating detail: `ripple-binary-codec@2.11.0` `definitions.json` is **byte-identical across all three** and already contains `VaultKind`/`SubscriptionDate`/`RedemptionDate`. Tested on stable 5.2.0:
```
validate(VaultCreate w/ VaultKind) -> PASSED (no throw)
round-trip keeps VaultKind/SubscriptionDate/RedemptionDate? {"VaultKind":1,"SubscriptionDate":...,"RedemptionDate":...}
VaultKind enum exported? false
```
So stable 5.2.0 will still *sign and submit* a closed-ended vault correctly from JavaScript; it just has no TypeScript types, no `VaultKind` enum export, and no client-side guard rails. **In TypeScript it will not compile.** Stay on the pinned beta.

---

## 7. Operational notes for the build

- **Ripple epoch offset is 946684800.** `SubscriptionDate`/`RedemptionDate` are seconds since the Ripple epoch, not Unix. A ledger `close_time` of `842528491` was observed while `Date.now()/1000 ≈ 1789213291`.
- **Track 1 tx must carry `NetworkID: 4001`** (autofill adds it because 4001 > 1024). Track 2 must **not** carry `NetworkID` (network id 2).
- Track 1 `LastLedgerSequence` window: with 3.0 s ledgers, xrpl.js's default +20 gives ~60 s. Fine.
- The custom-devnet faucet returns before the funding transaction validates. Poll `account_info` (I needed up to ~3 s) before the first submit, or you get `actNotFound`.
- `client.autofill()` on a `LoanSet` performs a `ledger_entry` lookup of `LoanBrokerID` to count the counterparty's signers; if the broker does not exist yet you get a bare **`Entry not found.`** with no mention of LoanSet or the broker id. It also prints a `console.warn` on *every* LoanSet. Source: `sugar/autofill.js` `fetchCounterPartySignersCount`.
- **The `feature` RPC is open (non-admin) on both nodes.** Fastest possible way to answer "is X enabled here": one POST, no amendment tables, no docs.

## 8. Reproduce

Scripts and captures live in the session scratchpad:
`a local scratch directory`
(`probe.mjs`, `broker.mjs`, `fundwallet.mjs`, `fee.mjs`, `stable_test.mjs`, `t1_feature.json`, `t2_feature.json`, `t1_named.txt`, `t2_named.txt`).

One-liner to re-confirm the headline at any point:
```bash
curl -s -X POST https://lending-hackathon.dev.ripplex.io:51234 -H 'Content-Type: application/json' \
  -d '{"method":"feature","params":[{}]}' \
| jq -r '.result.features|to_entries[]|select(.value.name|test("SingleAssetVault|LendingProtocol"))|"\(.value.name) enabled=\(.value.enabled)"'
```

---

## 9. Protocol timing constants (from rippled source, decisive for Track 2 compression)

`include/xrpl/protocol/Protocol.h` (rippled master @ 94037361992ad75b32a6b2659b655ab96b7cb7c2):
```cpp
constexpr std::uint32_t kLoanRedemptionBuffer = std::chrono::seconds{60}.count();     // line 357
constexpr std::uint32_t kMinInvestmentPeriod  = std::chrono::seconds{180}.count();    // line 369
constexpr std::uint32_t kMaxInvestmentPeriod  = std::chrono::seconds{std::chrono::years{30}}.count();  // line 371
```
`include/xrpl/tx/transactors/lending/LoanSet.h:68`:
```cpp
static constexpr std::uint32_t kMinPaymentInterval = 60;
```
`src/libxrpl/ledger/helpers/VaultHelpers.cpp:274-279`:
```cpp
isValidClosedEndedGap(std::uint32_t sub, std::uint32_t red)
{ ... return r >= s + kMinInvestmentPeriod && r < s + kMaxInvestmentPeriod; }
```
Violation returns **`temMALFORMED`** from `VaultCreate::preflight` (`VaultCreate.cpp:118-121`), and a missing `SubscriptionDate`/`RedemptionDate` on a closed-ended vault is also `temMALFORMED`.

`src/libxrpl/tx/transactors/lending/LoanSet.cpp:336`:
```cpp
if (finalPayment + kLoanRedemptionBuffer > vault->at(sfRedemptionDate))   // rejected
```
and the source asserts the constants are mutually consistent (`LoanSet.cpp:47`):
```cpp
static_assert(kMinInvestmentPeriod >= LoanSet::kMinPaymentInterval + kLoanRedemptionBuffer + 1);
```

### Tightest legal Track 2 timeline
- `RedemptionDate - SubscriptionDate >= 180 s` (hard floor).
- `PaymentInterval >= 60 s`.
- The loan's **final payment must land at least 60 s before `RedemptionDate`**.
- Public Devnet runs on wall-clock; ledgers close every ~3.4 s, so 180 s ≈ 53 ledgers.

A safe demo shape: `SubscriptionDate = now + 120`, `RedemptionDate = SubscriptionDate + 600`; inside Investment, originate a loan with `PaymentInterval = 60`, 3–5 payments, final payment ≥ 60 s before `RedemptionDate`. Verified `VaultCreate` with a 600 s and a 3600 s gap; both `tesSUCCESS` on both networks.
