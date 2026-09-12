# patapim

**Securities lending, native on the XRP Ledger.** Eligible holders lend a tokenised security from a
fixed-term vault through a lending agent, for a fee. If the borrower does not return the securities
in time, the agent's own first-loss capital repays the vault and the ledger's default logic makes
the lenders whole. No smart contract: only native XRPL objects.

| | |
|---|---|
| **Event** | XRPL Lending Protocol Hackathon, Paris, 12-13 September 2026 |
| **Track** | 2, closed-ended vault, Lending Protocol V1.1 |
| **Flavour** | Loaded: XLS-65 and XLS-66 plus MPTs, Credentials, Permissioned Domains, Escrow |
| **Network** | Public XRPL Devnet, `wss://s.devnet.rippletest.net:51233`, network_id 2, rippled `3.4.0-rc5` |
| **Library** | `xrpl.js@5.2.0-beta.0`, `ripple-binary-codec@2.11.0` |
| **Developer report** | [`DEVELOPER-REPORT.md`](./DEVELOPER-REPORT.md) |

## Why

Tokenised treasuries and money market funds are arriving on XRPL. A holder can hold them, and that
is all: no lending fee, and nobody can borrow them to post as collateral. In traditional finance,
agency securities lending is what makes long-only portfolios work. On chain, for regulated
securities, that market does not exist yet. Every primitive it needs already shipped.

## The trade

1. **Subscription.** Eligible holders, carrying an on-chain credential accepted by the agent's
   permissioned domain, deposit the tokenised security into a fixed-term vault. The vault's asset is
   the security itself, not cash.
2. **Indemnity.** The lending agent owns the vault and the loan broker and posts first-loss cover
   denominated in the same security. The ledger refuses to originate a loan the cover cannot absorb.
3. **Borrow.** A market maker escrows XRP and signs a request; the agent counter-signs. One
   transaction, two signatures.
4. **Return.** At maturity the borrower returns the securities with the fee and recovers the
   collateral. The lender's return is the interest the loan carries; the lending fee, measured, goes
   to the agent rather than to the vault, which is finding F-016.
5. **Default.** Past the grace period the agent declares default: the cover repays the vault in
   securities and the collateral rebuilds the cover.

## Every XLS-65 and XLS-66 transaction we use

All verified on the public XRPL Devnet. One full lifecycle, end to end, from
[`docs/evidence/recall-t2.json`](./docs/evidence/recall-t2.json).

<!-- evidence:start -->

| Transaction | Role in patapim | Result | Hash |
|---|---|---|---|
| `MPTokenIssuanceCreate` | the tokenised security, require-auth so the transfer agent keeps control | `tesSUCCESS` | [`7679B968`](https://devnet.xrpl.org/transactions/7679B968F09FF0F798E47A37D46B36906163A80CCCF846504EAEC4C770912B10) |
| `PermissionedDomainSet` | the eligibility whitelist the vault carries on its share issuance | `tesSUCCESS` | [`AB5472A6`](https://devnet.xrpl.org/transactions/AB5472A6C2FCC11F420EA8EB6D1F51AC5E7F28582808BF6CAE3CD041BD3F7AC7) |
| `VaultCreate` | the fixed-term lender pool, `VaultKind: 1`, asset is the security, gated by `DomainID` | `tesSUCCESS` | [`B7DB66AE`](https://devnet.xrpl.org/transactions/B7DB66AE66F3E27EE91273ACE67AA63276BBB19ADA27AFE2344CA647FF9A6B2C) |
| `VaultDeposit` | an eligible holder subscribes | `tesSUCCESS` | [`B805D0A8`](https://devnet.xrpl.org/transactions/B805D0A8A13C65A244131AABED6087397A87E82AF8A6FF2AC5AD99B7399826D5) |
| `VaultDeposit` | a holder with no credential is refused by the domain | `tecNO_AUTH` | [`81A6043E`](https://devnet.xrpl.org/transactions/81A6043E1DE7512590274BD2A0A35243D64BE3E9520BA071604BBBCBD53F3C41) |
| `LoanBrokerSet` | the lending agent, with its debt ceiling and cover rates | `tesSUCCESS` | [`6C5715F2`](https://devnet.xrpl.org/transactions/6C5715F2C7B89F92C80B8DF82F29B704F38C6086713565A3BAF088538DFB152B) |
| `CoverDeposit` | first-loss capital, posted in the security | `tesSUCCESS` | [`B440E96E`](https://devnet.xrpl.org/transactions/B440E96EA895A20A38D4C0F7451CE01D451B42E5A3A194A5FD2231F58A5D548E) |
| `VaultDeposit` | the subscription window has closed, the phase gate fires | `tecEXPIRED` | [`AAF85BB5`](https://devnet.xrpl.org/transactions/AAF85BB5EF807F97BC24ED2142B070C7BFAF3A6EBB17F1D518BC820C3CD8BA8D) |
| `VaultWithdraw` | capital is locked for the term, the second phase gate | `tecTOO_SOON` | [`2541A17D`](https://devnet.xrpl.org/transactions/2541A17D6B30672E75BA3018F9319050B1F437932D1618FED2F270072902F6D2) |
| `LoanSet` | the loan of securities, agent signs, borrower counter-signs | `tesSUCCESS` | [`784DA553`](https://devnet.xrpl.org/transactions/784DA553098DD10D4E35F45FC7BB8BC55081FA86DE2D509B5161D5F05F67A72A) |
| `EscrowCreate` | the borrower posts XRP collateral, held bilaterally | `tesSUCCESS` | [`939E88A6`](https://devnet.xrpl.org/transactions/939E88A6786DC1C49BC9DB91F69975111658BA91B645FE81C9240B08565EDAFA) |
| `LoanPay` | the borrower returns the securities and the fee | `tesSUCCESS` | [`FD3E8AE8`](https://devnet.xrpl.org/transactions/FD3E8AE83AA89FA104ECFEADE7D4333A0CE863A1F08AE4D22667CD32D706A799) |
| `LoanSet` | new lending refused once redemption opens, the third phase gate | `tecEXPIRED` | [`531EB6E9`](https://devnet.xrpl.org/transactions/531EB6E9A8A5F5F86834F5F029A833A4003CF60B072EF5F484E395189DD8E424) |
| `VaultWithdraw` | the lender redeems, denominated in shares | `tesSUCCESS` | [`1C206948`](https://devnet.xrpl.org/transactions/1C2069485728A1243E87F9EE2E952531C0B4B438CC57D9F481ADA4C923CC7B07) |

<!-- evidence:end -->

All three phase rejections the minimum bar asks for are in that table, on this vault. A fourth,
`LoanSet` refused during Subscription with `tecTOO_SOON`, is in
[`scripts/probe-t2.mjs`](./scripts/probe-t2.mjs), which walks the three phases on an XRP vault.

Regenerate the table from the chain record with `node scripts/gen-evidence-table.mjs` after any run,
so the hashes on this page cannot drift from the hashes on the ledger.

**On yield.** A lender's return here is interest, and interest over a term compressed into minutes
rounds to nothing: this loan repaid 2,000,001 on a principal of 2,000,000. That is not a shortcut we
took, it is a property of the protocol we measured. `LoanOriginationFee` does not help, it is taken
from the drawdown and paid to the broker rather than the vault. The mechanism the Lending Protocol
workshop teaches for injecting yield into a closed-ended vault, a `VaultDeposit` carrying
`tfVaultDonation`, does not exist in the implementation. Findings F-006 and F-016 in
[`DEVELOPER-REPORT.md`](./DEVELOPER-REPORT.md).

## The default arc

The half of the story that matters to a lender: the borrower does not return the securities, and the
agent's own capital makes the vault whole. Run twice on Devnet with the only difference being
`CoverRateMinimum`, and the difference is the whole lesson.

**Indemnified at one hundred percent**, `docs/evidence/default-arc-cover100000.json`:

| state | vault assets | unrealised loss | price per share | agent cover |
|---|---|---|---|---|
| loan drawn, 2,000,000 TBL | 5,000,000 | 0 | 1.00 | 2,500,000 |
| impaired | 5,000,000 | 2,000,000 | 1.00 | 2,500,000 |
| **defaulted** | **5,000,000** | 0 | **1.00** | **500,000** |

The cover absorbs the entire loan, the vault does not shrink, and the lenders' share price does not
move. [`LoanSet`](https://devnet.xrpl.org/transactions/EDF107402242DB11C46B0DB87CDD97704CBB851840A3A49CC0BD31DD14B61C41)
· [`LoanManage` impair](https://devnet.xrpl.org/transactions/5227A0967246FE5AE7A60F879900FF42062FFBCF71C20648494FC2EAC8DA5F48)
· [`LoanManage` default](https://devnet.xrpl.org/transactions/95AD6692375BFD184155472FA105571BA9C9A836B221BB36F11CAA4F699C81D4)

**At a ten percent cover rate**, `docs/evidence/default-arc-cover10000.json`: the same default takes
the vault from 5,000,000 to 3,200,000 and the share price from 1.00 to 0.64, while the cover gives
up only 200,000 of the 1,000,000 posted. The rate, not the balance, decides what the cover absorbs.
That is finding F-014 in the developer report, and it is why this vault is configured at one
hundred percent.

## The other primitives, the Loaded half

| Primitive | What it does here | Hash |
|---|---|---|
| `MPTokenIssuanceCreate` | the tokenised security, require-auth so the transfer agent keeps control | [`B1F39818`](https://devnet.xrpl.org/transactions/B1F39818B7C96E4A25541B89285726B8E1485383D5AC6D720C35896784C8C0A2) |
| `CredentialCreate` | eligibility, issued by the agent to the lender | [`16807269`](https://devnet.xrpl.org/transactions/16807269E4228770A1AE6BBCE465C2C387964CA7854533182F10FAEEAC52E9A8) |
| `CredentialAccept` | the lender accepts it, which is what the domain checks | [`40C8CB8B`](https://devnet.xrpl.org/transactions/40C8CB8B8B7C9ABF6D051330D8F56C5B773BFA1D1DBF4496C52DEB64404B58FD) |
| `PermissionedDomainSet` | the whitelist the vault's share issuance carries | [`006858D1`](https://devnet.xrpl.org/transactions/006858D1930599611342CCA5F49F05CA3F2B19B061D43F67F580C9B2BDD35BEF) |
| `EscrowCreate` | the borrower's XRP collateral, held bilaterally | [`387AFEE3`](https://devnet.xrpl.org/transactions/387AFEE307549019CAE5555EE5599894BA75B3BCFEB0925C33AF8125BBD380FC) |

Vault shares inherit the underlying security's authorisation gate, so eligibility on the security is
eligibility on the lender position. There is no second credential scheme.

## Run it

Node 18 or newer.

```bash
npm install                         # xrpl.js@5.2.0-beta.0, nothing else

node scripts/recall-spine.mjs       # provisions a full lifecycle on Devnet, ~7 minutes
node scripts/probe-t2.mjs           # walks the three phases on an XRP vault
node scripts/read-vault.mjs t2 <VaultID> [holder]   # the read path, and the calls it takes

cd web && npm install && npm run dev  # the dashboard, http://localhost:3000
```

`scripts/lib/lending.mjs` holds the shared client. Note `signCounterparty()`: it deliberately does
not use `signLoanSetByCounterparty` from xrpl.js, which is broken in the version this track
mandates. See finding 1 of the developer report.

## Layout

```
scripts/          the ledger work: shared lib, the patapim lifecycle, the phase probes, the read path
scripts/experiments/   what we fired at the ledger to establish the findings
web/              the dashboard, Next.js, reads the ledger server side, no wallet needed
docs/evidence/    transaction hashes per run
docs/research/    the sourced notes behind the report
docs/feedback/    the running friction log
DEVELOPER-REPORT.md    the deliverable
docs/AUDIT-CHECKLIST.md   what a second reviewer should check
```

## Team

patapim.
