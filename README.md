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
   collateral. The lenders' share price rises by the fee actually delivered.
5. **Default.** Past the grace period the agent declares default: the cover repays the vault in
   securities and the collateral rebuilds the cover.

## Every XLS-65 and XLS-66 transaction we use

All verified on the public XRPL Devnet. One full lifecycle, end to end, from
[`docs/evidence/recall-t2.json`](./docs/evidence/recall-t2.json).

| Transaction | Role in patapim | Result | Hash |
|---|---|---|---|
| `VaultCreate` | the fixed-term lender pool, `VaultKind: 1`, asset is the security, gated by `DomainID` | `tesSUCCESS` | [`0CBE12AB`](https://devnet.xrpl.org/transactions/0CBE12AB9ACDD12E2659A5FD0EC9505A37EFF55D56A0447AF83D4967D93CC246) |
| `VaultDeposit` | an eligible holder subscribes | `tesSUCCESS` | [`CE5C7E59`](https://devnet.xrpl.org/transactions/CE5C7E595B0D9761B10BE9114AEF38597A03A9620A1590EE7DEC56528B47D06C) |
| `VaultDeposit` | a holder with no credential is refused by the domain | `tecNO_AUTH` | [`D4C93863`](https://devnet.xrpl.org/transactions/D4C938639DD005D8B4AD6ADB06425AC6E15047C15C02B80386AAA2E07C3DBC88) |
| `VaultDeposit` | subscription window closed, the phase gate fires | `tecEXPIRED` | [`7B9D16FA`](https://devnet.xrpl.org/transactions/7B9D16FA25DA3F54B7B3A13A63C21AB06775346264A4D1EC12228EBCFD709291) |
| `LoanBrokerSet` | the lending agent, with its debt ceiling and cover rates | `tesSUCCESS` | [`B3974D7F`](https://devnet.xrpl.org/transactions/B3974D7F04236070B8C03FA2B3B637EFC8C980010ABE74514784D29892D3DDA2) |
| `LoanBrokerCoverDeposit` | first-loss capital, posted in the security | `tesSUCCESS` | [`2365CA11`](https://devnet.xrpl.org/transactions/2365CA117DE89E212E2C19B03C603328BE76E6967FEBC07CA591FD1D1D9AD607) |
| `LoanSet` | the loan of securities, agent signs, borrower counter-signs | `tesSUCCESS` | [`318A74E5`](https://devnet.xrpl.org/transactions/318A74E5F7083E919F316531B08F81AFFF5F409C35EDD40B21422D53DE516927) |
| `LoanPay` | the borrower returns the securities and the fee | `tesSUCCESS` | [`CAF24C84`](https://devnet.xrpl.org/transactions/CAF24C84D9ED1DAC098C0D85FC069BD878719B374FF2FAEC9595C132E91C0AFE) |
| `LoanSet` | new lending refused once redemption opens | `tecEXPIRED` | [`61FFF1E1`](https://devnet.xrpl.org/transactions/61FFF1E1E12CEF9924FB3F68E072292B6DD69B4DEE70F0F3903A71A09027B432) |
| `VaultWithdraw` | the lender redeems, by shares | `tesSUCCESS` | [`CD270519`](https://devnet.xrpl.org/transactions/CD270519367CD55D2818F91D1BD8389C4971DC7B01B3A9EEAE34E4D92DAB5591) |

The remaining phase gate, `VaultWithdraw` refused during Investment with `tecTOO_SOON`, and
`LoanSet` refused during Subscription with `tecTOO_SOON`, are in
[`scripts/probe-t2.mjs`](./scripts/probe-t2.mjs), which walks the three phases on an XRP vault.

## The other primitives, the Loaded half

| Primitive | What it does here | Hash |
|---|---|---|
| `MPTokenIssuanceCreate` | the tokenised security, require-auth so the transfer agent keeps control | [`B1F39818`](https://devnet.xrpl.org/transactions/B1F39818B7C96E4A25541B89285726B8E1485383D5AC6D720C35896784C8C0A2) |
| `CredentialCreate` / `CredentialAccept` | eligibility, issued by the agent, accepted by the lender | in the evidence file |
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
