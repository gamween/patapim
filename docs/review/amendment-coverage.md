# amendment-coverage — what we actually exercised on chain, and what we only read about

Review round, 2026-09-12. Every hash below was re-fetched with the `tx` RPC against the network named,
today, by this reviewer. Nothing is taken from our own notes on trust.

Method: enumerated every `TransactionType:` literal in `scripts/` including `scripts/experiments/`
(26 distinct types), mapped each to the amendment that introduces it, then read the `Amendments`
ledger entry `7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4` on both networks and
mapped the ids against `sha512half(name)` over `include/xrpl/protocol/detail/features.macro`
(XRPLF/rippled `develop`, fetched today).

## 0. The two amendment sets, measured

| | T1 `lending-hackathon.dev.ripplex.io:51234` | T2 `s.devnet.rippletest.net:51234` |
|---|---|---|
| `build_version` | 3.4.0-rc1 | 3.4.0-rc5 |
| `network_id` | 4001 | 2 |
| `Amendments` entries | **48** | **89** |

T1's set is a strict subset of T2's. The 41 extra on T2 are **all** `XRPL_RETIRE_FEATURE` /
`XRPL_RETIRE_FIX` entries (CheckCashMakesTrustLine, Checks, Clawback, DeletableAccounts, DepositAuth,
DepositPreauth, DisallowIncoming, ExpandedSignerList, Flow, FlowSortStrands, HardenedValidations,
ImmediateOfferKilled, MultiSignReserve, NegativeUNL, NonFungibleTokensV1_1, RequireFullyCanonicalSig,
TicketBatch and 24 `fix*`): T2's ledger predates their retirement and carries them; T1 is a fresh
genesis and has them compiled in permanently instead. So the *effective* rule set is the same and the
*ledger entry* is not.

**This contradicts `DEVELOPER-REPORT.md:55` and `:67`.** See finding P1.

## 1. Amendments genuinely exercised — a landed transaction, hash verified today

| Amendment | XLS | Transaction | Hash | Net | Result |
|---|---|---|---|---|---|
| `SingleAssetVault` | 65 | `VaultCreate` | `0CBE12AB9ACDD12E2659A5FD0EC9505A37EFF55D56A0447AF83D4967D93CC246` | T2 | tesSUCCESS |
| `LendingProtocol` | 66 | `LoanBrokerSet` | `B3974D7F04236070B8C03FA2B3B637EFC8C980010ABE74514784D29892D3DDA2` | T2 | tesSUCCESS |
| `LendingProtocolV1_1` | 66 | `LoanBrokerSet` on an open-ended vault | `DD751B834867010B29ABDC73A965D0AA33DCC00AEAA3C784210FFA067B7A95D5` (T2, tecNO_PERMISSION) vs `59496BAE17EEE32D4E1E4E6BFD1A0764FEA645A4A42BCCB13F038F691D606F85` (T1, tesSUCCESS) | both | the V1.1 gate, proven by differential |
| `MPTokensV1` | 33 | `MPTokenIssuanceCreate` | `B1F39818B7C96E4A25541B89285726B8E1485383D5AC6D720C35896784C8C0A2` | T2 | tesSUCCESS |
| `PermissionedDomains` | 80 | `PermissionedDomainSet` | `006858D1930599611342CCA5F49F05CA3F2B19B061D43F67F580C9B2BDD35BEF` | T2 | tesSUCCESS |
| `Credentials` | 70 | `CredentialDelete` | `9CB97855F25CC7AD5CCCD853EDACDB7AE1015C043B9650AC4773BC2204BD6D21` | T2 | tesSUCCESS — **research run only, not in any evidence file** |
| `BatchV1_1` | 56 | `Batch[Payment,Payment]` / `Batch[EscrowCreate(shares),Payment]` | `8E1BB6F0AFE0FA34A1E8C3DA785BAF42CB376BA4CB12A5303A2D46F106F6FA7D` / `1849A91252370FD6DAAB205221F97BA8FE5413581B401FE0E1B6A79F525F18D2` | T1 | tesSUCCESS |
| `PermissionDelegationV1_1` | 74/75 | `DelegateSet` + a delegated `Payment` | `EFBE6D9E4216EE744465D7A0B0D18D948B3B05A5FF2D2760F1FA8D3EB66728A5`, `EEC3E3AD4D5DC5C6202E75D35CC093ED39E8E516976BE1FB145C4F4F3AF6B7F2`, `C9FA910CC59F3AEF07598F4D4CDC6BCB31211AB6146731F7BD3DC0912A934793` | T1 | tesSUCCESS |
| `TokenEscrow` | 85 | `EscrowCreate` of vault shares (`Amount:{mpt_issuance_id:0000000139AC1BEB0A5A90E77FF85297066FB6E411963479, value:"50000000"}`), then `EscrowFinish` | `4CCB95E8A5EB5C08FEF6FD5FA92C1477DC0375453DA4C00AE3CE4D5E396D44C6`, `34FC53501A08697556CBE80D3701CE50F04CF7FC494843766B1BE995D088EFDA` | T1 | tesSUCCESS — **experiment only, T1 only** |
| `Escrow` (retired, core) | — | `EscrowCreate`, `Amount:"20000000"` drops | `387AFEE307549019CAE5555EE5599894BA75B3BCFEB0925C33AF8125BBD380FC` | T2 | tesSUCCESS |

Nine amendments plus core. All twenty-odd hashes in `docs/evidence/*.json` and the ones I sampled
from `docs/research/` resolve to validated transactions with the stated result codes — **no
fabrication anywhere**, and the research notes correctly disclose that `tem*` "hashes" are locally
computed ids (`docs/research/batch-delegation-escrow.md:77`).

## 2. Touched but never landed a transaction

| Amendment | What we did | Why nothing landed |
|---|---|---|
| `Sponsor` (XLS-68) | `VaultCreate` / `VaultDeposit` / `LoanBrokerSet` with `SponsorFlags: 2` | all three `temINVALID_FLAG` — a `tem` never reaches a ledger. **Zero landed Sponsor transactions on either network.** |
| `PermissionedDEX` (XLS-81) | `OfferCreate` against the share MPT | `temDISABLED` (needs `MPTokensV2`, not enabled) |
| `MPTokensV2` (XLS-82) | same | not enabled on either network |

## 3. Enabled on both networks, never touched at all

`DynamicMPT`, `ConfidentialTransfer`, `PriceOracle`, `DID`, `AMM`, `AMMClawback`, `DeepFreeze`,
`DynamicNFT`, `NFTokenMintOffer`, `XChainBridge`, `XRPFees`, plus 26 `fix*`.

`DynamicMPT` is the one that matters: our vault asset **is** a live-issuer MPT, so
`MPTokenIssuanceSet{MPTokenMetadata|TransferFee|DomainID}` mid-loan is directly on the product's
path. `grep -rn "MPTokenMetadata|TransferFee|MutableFlags" scripts/` shows `MPTokenMetadata` only
ever at issuance time (`MPTokensV1`), and `MPTokenIssuanceSet` only ever with `tfMPTLock`/`tfMPTUnlock`
(`scripts/experiments/mpt-vault-asset-3.mjs:80-107`) — also `MPTokensV1`. Our own
`docs/research/amendment-map.md:334` ranks this R4 ★★★★☆ "untested by anyone, including me" and we
never ran it.

## 4. Judgement

**Average, and it looks thinner from the outside than it is.**

Nine amendments with landed transactions across two networks is genuinely above the median for a
weekend. But the brief's Loaded definition names four primitives — *"Permissioned Domains and
Credentials, TokenEscrow, sponsored fees and reserves, MPTs"*
(`XRPL Lending Protocol Hackathon Challenge.txt:100-103`) — and against that list:

- Permissioned Domains: **strong**, in the demo, hash in the README.
- MPTs: **strong**, in the demo, hash in the README.
- Credentials: **submitted evidence contains zero credential hashes** (finding P2).
- TokenEscrow: **not in the submission at all**. The demo's escrow is XRP (`Amount:"20000000"`),
  i.e. the 2017 retired core `Escrow`, not the XLS-85 amendment. The real TokenEscrow work exists,
  on T1, in an experiment nobody will read.
- Sponsored fees and reserves: **zero landed transactions, ever**.

Half the Loaded surface the brief asks for is either unsurfaced or unlanded, while the breadth we do
have (Batch, PermissionDelegation, TokenEscrow) is buried in a 660 KB research tree that a judge
scoring "verifiable transactions on Devnet" will not open.

## 5. The single highest-value test still available tonight (< 30 min)

**Sponsored fees and reserves — XLS-68 — on the demo's own vault.** It is the only primitive the
brief names by name for which we have never landed a single transaction, and the SDK already
supports it: `xrpl.Wallet/sponsorSigner.js` exports `signAsSponsor()` and
`ripple-binary-codec` exports `encodeForSigningSponsor` — no hand-encoding, unlike our counterparty
path. `Sponsor` is enabled on both networks
(`BE1F90581635DBCEBFC4678C4B54FEDDC1A17B50FD02CFE765A4132A342126AC`).

Transaction by transaction, on a fresh T2 spine:

1. **`MPTokenAuthorize{Account: lender, MPTokenIssuanceID: <ShareMPTID>, Sponsor: agent, SponsorFlags: 2}`**,
   agent signs with `signAsSponsor`. `ttMPTOKEN_AUTHORIZE` is on the reserve allow-list — verified
   directly against `src/libxrpl/ledger/helpers/SponsorHelpers.cpp` at tag `3.4.0-rc1` **and** on
   `develop`. Expect `tesSUCCESS`, then read `SponsoringOwnerCount` on the agent's `AccountRoot` and
   `SponsoredOwnerCount` on the lender's. This is the "the lending agent pays the lender's reserve to
   onboard them" story that `amendment-map.md:281` calls the best available and explicitly never ran.
2. **`CredentialCreate{Account: agent, Subject: lender, CredentialType: KYC, Sponsor: <sp>, SponsorFlags: 2}`** —
   `ttCREDENTIAL_CREATE` is also on the allow-list. Same idea, on the eligibility leg.
3. **`VaultDeposit{… Sponsor: agent, SponsorFlags: 1}`** — *fee* sponsorship of a vault transaction.
   This is the sharp one. We assert in `amendment-map.md:266` that fee sponsorship works for vaults,
   citing rippled's own `Sponsor_test.cpp:5547 testFeeSponsoredVaultInvariant`, and we have never
   submitted it. `tesSUCCESS` gives the pitch a real line — *"the agent pays every lender's gas, hash
   here"* — on the exact transaction the product's lenders send. `temINVALID_FLAG` would contradict
   rippled's own unit test and is worth more than the demo.
4. **`EscrowCreate{… Sponsor: agent, SponsorFlags: 2}`** for the market maker's collateral —
   `ttESCROW_CREATE` is on the allow-list, so the agent can carry the borrower's escrow reserve. One
   line change to `scripts/recall-spine.mjs:112-115`.
5. Keep one negative in the same run as a control: **`VaultCreate{… SponsorFlags: 2}` → `temINVALID_FLAG`**,
   so the report has the positive and the negative from one session.

Budget: steps 1 and 3 alone are ~15 minutes and convert the weakest of the brief's four named
primitives from "three `tem` rejections" into "a landed hash plus a spec finding".

**Runner-up, ~10 minutes:** change `scripts/recall-spine.mjs:112-115` so the collateral escrow carries
an MPT `Amount` instead of `"20000000"` drops. We have already proven MPT escrow works
(`4CCB95E8…`, T1); doing it on T2 in the demo makes the README's "Loaded … Escrow" line actually mean
XLS-85 rather than a retired 2017 feature.

## 6. Findings

**P1 — `DEVELOPER-REPORT.md:55` and `:67` say the two networks have an identical amendment set. They do not, and the page contradicts itself.**
The heading reads *"…behind an identical amendment list"*; line 67 reads *"the amendment set is
identical"*; line 66, two lines earlier, reads *"`TicketBatch` also differs between them."*
Measured today: T1 has 48 entries, T2 has 89, 41 differ. The point we want — that the *effective*
rules are the same because all 41 are retired amendments, so a participant cannot tell V1 from V1.1
behaviour from the amendment list — is both true and stronger than what is written, and it is the
proposed-fix paragraph's whole premise. As written a judge running the two lines of `jq` we ourselves
recommend gets a different answer from the sentence. **Fix:** replace the sentence with *"the two
`Amendments` entries differ only by 41 retired amendments that T2's older ledger still carries; every
live amendment, `LendingProtocol` and `LendingProtocolV1_1` included, is enabled on both, so the
amendment list cannot distinguish the two behaviours"* and retitle §3 to *"…behind an
indistinguishable amendment list"*.

**P2 — `README.md:90` says the `CredentialCreate` / `CredentialAccept` hashes are "in the evidence file". They are not.**
`grep -c Credential docs/evidence/recall-t2.json` → `0`. `scripts/recall-spine.mjs:62-63` submits both
credential transactions through bare `submit()` instead of `rec()`, so they never enter `ev[]`.
Same for the six `MPTokenAuthorize` and three `Payment` calls at `scripts/recall-spine.mjs:55-58`.
Net effect: the Credentials amendment — one of the four the brief names for Loaded — has **no hash
anywhere in the submitted artefacts**, and the README points at a file that does not contain what it
claims. **Fix:** wrap those four submits in `rec(...)` and re-run the spine, or change the README cell
to name the hash directly.

**P3 — `docs/evidence/recall-t2.json` is stale relative to `scripts/recall-spine.mjs`.**
The current script `rec()`s 14 steps; the committed file has 13. Missing:
`VaultWithdraw during Investment` (`scripts/recall-spine.mjs:105`, the third phase rejection, expected
`tecTOO_SOON`) — added after the evidence was captured. A judge who re-runs the spine gets a file that
does not match the one in the repository. **Fix:** re-run and recommit, which also fixes P2.

**P4 — `docs/evidence/default-arc-cover100000.json` labels read backwards.**
`LoanManage impair (too early)` → `tesSUCCESS` (`5227A096…`, `Flags: 131072`, ledger 5257599), then
`LoanManage impair` → `tecNO_PERMISSION` (`03933F6D…`, same flags, ledger 5257618, i.e. *later*). The
impairment that did the work is the one labelled "too early"; the second failed because the loan was
already impaired. Both verified on chain. A reader of the evidence file concludes the opposite of what
happened. **Fix:** relabel to `LoanManage impair (before the due date — accepted)` and
`LoanManage impair (already impaired) → tecNO_PERMISSION`, and say so in one line of `note`.

**P5 — `docs/research/amendment-map.md:259` and `:369` say the reserve-sponsorship allow-list has 23 entries. It has 25.**
Counted directly in `src/libxrpl/ledger/helpers/SponsorHelpers.cpp` at tag `3.4.0-rc1` (what T1 runs)
and on `develop`: 25 `tt*` entries. This number appears inside finding A-2, which we intend to file as
a PR against XLS-0068 — a wrong count in a spec correction is the one error that will get the PR
closed. **Fix:** 23 → 25, both places.

**P6 — the Loaded claim rests on a retired amendment.**
`README.md:12` reads *"Loaded: XLS-65 and XLS-66 plus MPTs, Credentials, Permissioned Domains,
Escrow"*, and `README.md:92` cites `387AFEE3…`, an `EscrowCreate` with `Amount: "20000000"` drops —
the core `Escrow` feature, `XRPL_RETIRE_FEATURE(Escrow)`, shipped 2017, not an amendment under test.
The brief names **TokenEscrow** (XLS-85) in the Loaded definition. We have TokenEscrow working
(`4CCB95E8…` / `34FC5350…`) but only on T1 and only in an experiment. **Fix:** either say "Escrow (core,
XRP)" and stop implying XLS-85, or spend ten minutes making the demo escrow carry an MPT `Amount` on
T2. The second is better.
