<div align="center">

# 🌳 patapim

**Securities lending, native on the XRP Ledger: a fixed-term, credential-gated fund that lends a tokenised security through a lending agent who puts first-loss capital on the line.**

[![XRPL Devnet](https://img.shields.io/badge/XRPL-Devnet%20(2)-1257d4?style=flat-square)](https://devnet.xrpl.org)
[![Track 2](https://img.shields.io/badge/Track%202-closed--ended%20vault-0f9d58?style=flat-square)](#the-trade)
[![xrpl.js](https://img.shields.io/badge/xrpl.js-5.2.0--beta.0-363636?style=flat-square)](https://www.npmjs.com/package/xrpl/v/5.2.0-beta.0)
[![Contribution](https://img.shields.io/badge/ripple%2Fexplorer-%231342-7c3aed?style=flat-square)](https://github.com/ripple/explorer/pull/1342)
[![XLS-65 · XLS-66](https://img.shields.io/badge/XLS--65%20%C2%B7%20XLS--66-Lending%20Protocol-b54708?style=flat-square)](https://xls.xrpl.org/xls/XLS-0066-lending-protocol)

**XRPL Lending Protocol Hackathon · Paris · 12-13 September 2026**

**[Open the app](https://patapim-gamma.vercel.app)** · **[Jury deck](https://patapim-gamma.vercel.app/deck/index.html)** · **[Developer report](./DEVELOPER-REPORT.md)** · **[One-pager](./docs/ONE-PAGER.en.md)** · **[En français](./docs/ONE-PAGER.fr.md)**

</div>

patapim lets holders of a tokenised security lend it, for a fee, through a lending agent. Eligible
holders subscribe to a fixed-term fund, the agent posts first-loss capital in the same security, a
market maker borrows the securities against cash collateral, and if the securities do not come back
the agent's capital repays the fund. No smart contract: every step is a native XRPL object, and every
figure in the app is read from the validated ledger.

> Tokenised treasuries and money market funds are arriving on XRPL, and a holder can only sit on
> them. In traditional finance, agency securities lending is how long-only portfolios earn on their
> holdings. On chain, for regulated securities, that market does not exist yet, and every primitive
> it needs already shipped.

## Table of contents

- [Try it yourself](#try-it-yourself)
- [The trade](#the-trade)
- [On the ledger](#on-the-ledger)
- [What building it made visible](#what-building-it-made-visible)
- [The default arc](#the-default-arc)
- [Every transaction, verified](#every-transaction-verified)
- [Deployed addresses](#deployed-addresses)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Contributing back](#contributing-back)
- [Team](#team)

## Try it yourself

The app is deployed at **https://patapim-gamma.vercel.app**. It opens **Fund I**, a fund in its term
with one loan of securities out. The vault picker also lists **Fund II**, open for subscription until
Wednesday 16 September 18:00 CEST.

1. Open Fund II and go to the **Sign** tab.
2. Load one of the two demo keys published on purpose in [`docs/DEMO-ACCOUNTS.md`](./docs/DEMO-ACCOUNTS.md).
3. Sign a `VaultDeposit`. The investor with a credential gets `tesSUCCESS` and a position; the one
   without gets `tecNO_AUTH`, refused by the permissioned domain. The same deposit into Fund I gets
   `tecEXPIRED`: its subscription period is over.

The page signs in your browser with `xrpl.js@5.2.0-beta.0`. The key stays in the tab: the server only
relays the signed transaction to XRPL Devnet and reads the result from a validated ledger. Browser
wallets are not offered, because the published Crossmark and GemWallet extensions cannot encode a
vault transaction or a multi-purpose token amount (finding F-019).

## The trade

Each parameter follows the convention of the market it comes from. Sources and quotes:
[`docs/research/lending-conventions.md`](./docs/research/lending-conventions.md).

1. **Subscription.** Holders carrying an on-chain credential accepted by the agent's permissioned
   domain deposit the tokenised security into a closed-ended fund: a subscription period, then an
   investment period, then redemption, the lifecycle of a closed-end fund.
2. **First-loss capital.** The lending agent owns the fund's vault and loan broker and posts cover in
   the same security. At a 100% cover rate the ledger refuses any loan the cover could not absorb.
   It is capped capital, not the unlimited indemnity a bank agent lender gives, and the app says so.
3. **The loan.** A market maker borrows 2,000,000 TBL for a fixed term, at a lending fee of 25 bps a
   year. The agent signs, the borrower counter-signs: one `LoanSet`, two signatures. It is a term
   loan: the protocol has no recall, which is the proposal at the end of the developer report.
4. **Collateral.** The borrower posts cash collateral at **102% of the loan's market value**, the
   customary same-currency margin, in a token escrow to the agent. The market value comes from an
   on-ledger Price Oracle. The agent can claim the escrow only after the payment date and a one-day
   grace period, the settlement cycle of a returned Treasury.
5. **Return.** Lenders receive the interest net of the agent's fee split, **90/10**, the
   lender-friendly end of published agency splits and the most XLS-66 allows (`ManagementFeeRate`
   caps at 10%). The app reports the fund's lending return as fee × utilisation × (1 − agent share),
   the identity lending pools use for supply rates.
6. **Default.** Past the grace period the agent can declare default, and the first-loss capital pays
   the fund `min(DebtTotal × CoverRateMinimum × CoverRateLiquidation, principal)`, capped by the cover
   available. At 100% the fund's NAV per share does not move. Verified on chain, not asserted.

## On the ledger

| Securities lending | XRPL object | Notes |
|---|---|---|
| Lender pool | Closed-ended Single Asset Vault | XLS-65, `VaultKind: 1`, the asset is the tokenised security |
| Lending agent | `LoanBroker` | XLS-66, owned by the agent, one per fund |
| First-loss capital | `LoanBrokerCoverDeposit` | posted and paid in the security itself |
| Eligibility | Credentials and a Permissioned Domain | the vault's share issuance carries the `DomainID` |
| The security | Multi-purpose token, TBL | require-auth: the transfer agent authorises every holder |
| Cash collateral | Multi-purpose token, USDX, in a token escrow | `FinishAfter` for the agent, `CancelAfter` for the borrower |
| Reference price | Price Oracle, TBL/USD | named in the vault's `Data`, read by the app |
| Loan of securities | `LoanSet`, two signatures | agent signs, borrower counter-signs |
| Settlement delay | `GracePeriod` | one day, before default can be declared |

Holding the security is not enough to lend it. The share issuance carries its own `DomainID`, so the
ledger enforces lender eligibility on the fund position, independently of the security's require-auth
gate: a holder needs both, which is exactly what the demo account without a credential shows.

## What building it made visible

Developer experience is the event's primary deliverable; the full report is
[`DEVELOPER-REPORT.md`](./DEVELOPER-REPORT.md). The three that cost us the most:

- **The library the brief mandates cannot originate a loan.** `signLoanSetByCounterparty` in
  `xrpl.js@5.2.0-beta.0` signs with the ordinary transaction prefix and rippled rejects it. Stable
  5.2.0 signs correctly but lacks the closed-ended vault types; 5.2.0-beta.1, published during the
  event, has both. Reproduced offline in one second: `node scripts/experiments/counterparty-signature.mjs`.
- **The two hackathon networks enforce different lending rules behind the same lending amendments.**
  `LoanBrokerSet` against an open-ended vault is `tesSUCCESS` on one and `tecNO_PERMISSION` on the
  other, and nothing in `server_info` or the amendment set tells them apart.
- **A closed-ended vault protects the calendar, not the cash.** The ledger refuses a loan whose
  schedule outlives the vault, but a loan left unpaid leaves lenders unable to withdraw, with no
  recall path. We propose `tfLoanCall`.

## The default arc

Run twice, the only difference being `CoverRateMinimum`. At 100%:

| state | vault assets | unrealised loss | NAV per share | agent cover |
|---|---|---|---|---|
| loan drawn, 2,000,000 TBL | 5,000,000 | 0 | 1.00 | 2,500,000 |
| impaired | 5,000,000 | 2,000,000 | **0.60** | 2,500,000 |
| **defaulted** | **5,000,000** | 0 | **1.00** | **500,000** |

Impairment is a paper loss: NAV per share, `(AssetsTotal − LossUnrealized) / shares`, drops to 0.60
while `AssetsTotal` does not move. On default the cover pays the whole loan and the lenders are made
whole. At a ten percent cover rate the same default takes the vault to 3,200,000 and NAV per share to
0.64, although the agent had posted enough to absorb half the loan: the rate, before the balance,
decides what the cover pays. That contrast is finding F-014.

## Every transaction, verified

The flagship lifecycle on XRPL Devnet, regenerated from the chain by
`node scripts/gen-evidence-table.mjs`. The standing funds, the default arcs and the demo account
transactions are in [`docs/ON-CHAIN.md`](./docs/ON-CHAIN.md): 76 transactions, each re-verified
against the ledger by `node scripts/gen-onchain-inventory.mjs`.

<!-- evidence:start -->

| Transaction | Role in patapim | Result | Hash |
|---|---|---|---|
| `MPTokenIssuanceCreate` | the tokenised security, require-auth so the transfer agent keeps control | `tesSUCCESS` | [`69A38645`](https://devnet.xrpl.org/transactions/69A38645EBED7B2900E928DD5893914B06E5C9A0FB64F22C1183B182D2F7C3DD) |
| `PermissionedDomainSet` | the eligibility whitelist the vault carries on its share issuance | `tesSUCCESS` | [`878653B1`](https://devnet.xrpl.org/transactions/878653B16FAB04BA428A96FF1740E6F46BEE53FBCB6333CC1FD424B672A165DE) |
| `VaultCreate` | the fixed-term lender pool, `VaultKind: 1`, asset is the security, gated by `DomainID` | `tesSUCCESS` | [`565318B0`](https://devnet.xrpl.org/transactions/565318B02FEAC00080F137BE3B66C1E3B080B0580A06F6FD1A1A78A55B1B0C5E) |
| `VaultDeposit` | an eligible holder subscribes | `tesSUCCESS` | [`F8D70563`](https://devnet.xrpl.org/transactions/F8D70563711AFC3EFBA0EF61F3DA6E7944DDB6B2A34F3632DBB78049C0D83391) |
| `VaultDeposit` | a holder with no credential is refused by the domain | `tecNO_AUTH` | [`30C4B86F`](https://devnet.xrpl.org/transactions/30C4B86FF9456761892943E69E0C2EC338A1EFE9F7CCF4AE1160ED831AEDB6F9) |
| `LoanBrokerSet` | the lending agent, with its debt ceiling and cover rates | `tesSUCCESS` | [`98BB53E0`](https://devnet.xrpl.org/transactions/98BB53E08D518482166E91AD1FFED0421B72D080E26CC9F0601EE8ACCBC97062) |
| `LoanBrokerCoverDeposit` | first-loss capital, posted in the security | `tesSUCCESS` | [`C5D955D8`](https://devnet.xrpl.org/transactions/C5D955D818CB9D920E03BA2FCF8A101D284E87A86388B65A8022B74F7B16B555) |
| `VaultDeposit` | the subscription window has closed, the phase gate fires | `tecEXPIRED` | [`E4F68FB0`](https://devnet.xrpl.org/transactions/E4F68FB08B8DDA19E962A7B3A90485CF94CD3168C688D776000EC1ADBDEB9D7C) |
| `VaultWithdraw` | capital is locked for the term, the second phase gate | `tecTOO_SOON` | [`32077697`](https://devnet.xrpl.org/transactions/32077697369163583D1D1BD43F18325D6608A70EC2814A49EDA60DDF38F44CAF) |
| `LoanSet` | the loan of securities, agent signs, borrower counter-signs | `tesSUCCESS` | [`DDD61141`](https://devnet.xrpl.org/transactions/DDD611413B8354071CB27DD291652E01424C52D82901611CC6DE042036972C12) |
| `EscrowCreate` | the borrower posts XRP in escrow to the agent, reclaimable after CancelAfter | `tesSUCCESS` | [`05F9AF64`](https://devnet.xrpl.org/transactions/05F9AF64190D7FAB70DB730F03921928CE2BF71B5656F2D0CA54C99571F0D936) |
| `LoanPay` | the borrower returns the securities with the interest, in full | `tesSUCCESS` | [`71DE04C6`](https://devnet.xrpl.org/transactions/71DE04C60FBC85F87CCC6283CDAA5985DF18DFF5A9DDE90694805B77927978C4) |
| `EscrowCancel` | the borrower recovers the collateral after CancelAfter | `tesSUCCESS` | [`7CE7D679`](https://devnet.xrpl.org/transactions/7CE7D67939902D50FA93B691C081CAE1D81299852AB56B266320A634789611A4) |
| `LoanSet` | new lending refused once redemption opens, the third phase gate | `tecEXPIRED` | [`3C01AF18`](https://devnet.xrpl.org/transactions/3C01AF182E2D99FBEE493459B61E381D8B90A1BDA13A2A118CA338CBA8E43FFD) |
| `VaultWithdraw` | the lender redeems, denominated in shares | `tesSUCCESS` | [`2FAB3F9D`](https://devnet.xrpl.org/transactions/2FAB3F9D56AE3E331E3427741FDFA5F192A4592A294B011074B5B04089D79138) |

<!-- evidence:end -->

XLS-65 and XLS-66 transactions used, and where: `VaultCreate`, `VaultDeposit`, `VaultWithdraw`,
`VaultSet`, `LoanBrokerSet`, `LoanBrokerCoverDeposit`, `LoanSet`, `LoanPay` above and in the standing
funds; `LoanManage` impair and default in the default arcs; `VaultClawback` and
`LoanBrokerCoverWithdraw` in `scripts/experiments/`. The Loaded primitives
alongside them: `MPTokenIssuanceCreate`, `MPTokenAuthorize`, `CredentialCreate`, `CredentialAccept`,
`PermissionedDomainSet`, `OracleSet`, `EscrowCreate` with an MPT amount, `EscrowCancel`.

**On yield.** The lender's return is interest. On the flagship run, compressed into minutes, it
rounded to nothing: the `LoanPay` declared 2,000,001 and settled 2,000,000. The standing Fund I is
dated in days instead, so its 25 bps accrue visibly: 35 TBL due at return, 32 to the lenders after the
agent's tenth. `LoanOriginationFee` does not help, it goes to the broker owner (F-016). The flag the
workshop teaches for injecting yield, a donation on `VaultDeposit`, is not in the implementation: it
is open rippled pull request #6383, `tfVaultDonate`, behind `LendingProtocolV1_2`.

## Deployed addresses

The XRP Ledger has no contract addresses: what a contract address names elsewhere is a ledger object
id here. The explorer's vault page shows the vault, its loan broker and its loans together.

| | Fund I, in term | Fund II, open for subscription |
|---|---|---|
| Vault | [`B5EC8B2C…4730`](https://devnet.xrpl.org/vault/B5EC8B2CFF11828C7A3B2552FD14F370659D1CB6857547A3A720E568E1F14730) | [`B8286CD5…4530`](https://devnet.xrpl.org/vault/B8286CD54ED120116C66C4B3F8663E6E06E7A593A9395B84497894A586A74530) |
| Loan broker | `22731477DB5E866A4FEB929A99091B09C686BE098A63F40F88D2D98C737A6AD5` | `3D4E887081C40BC126D26C6E2FD2883476CBBC023C194A0AF941A6770FFFBEBA` |
| Loan | `F9B11DDA5EFA85457CB17F89EFC99C813B155B41A19A6E2A67242EDB2A596D1F` | none, lending opens after subscription |
| Vault shares, MPT | `00000001FB4ECA99A091C2574B7A586C58ECDB41E83357FD` | `000000019E4ED3A9645729D633558E005BBF860311912687` |
| Subscription closes | 12 September 2026, 22:04 UTC | 16 September 2026, 16:00 UTC |
| Redemption opens | 16 September 2026, 16:00 UTC | 16 December 2026, 17:00 UTC |

Shared by both funds:

| | |
|---|---|
| Lending agent, vault and broker owner | [`rU57MqUwaPcKF4rTYx4cN8osyT8SkDV6ks`](https://devnet.xrpl.org/accounts/rU57MqUwaPcKF4rTYx4cN8osyT8SkDV6ks) |
| Security TBL, MPT issuance | `00504E4C3295762322513439250B2F050A1B016CE5563126`, issuer [`rncTqM69…pUSu`](https://devnet.xrpl.org/accounts/rncTqM69x4otgZ5ZAc7MykPn8yeQmzpUSu) |
| Cash USDX, MPT issuance | `00504E4C2BD6C9B523B46C3A87963369E2205F00DD1C8CE7`, issuer [`rhzoMyZp…L1i5`](https://devnet.xrpl.org/accounts/rhzoMyZpa5eZuzybzZZZjsy8pGtANVL1i5) |
| Permissioned domain | `E6B24E9C6C23DBE2098364844AEEFD418E15CCC4039FB1B87773CA79A9F1625F` |
| Price Oracle TBL/USD | owner [`rJhyrQk6XxJcdFeyTWVcn2aSxRS8LZjFrw`](https://devnet.xrpl.org/accounts/rJhyrQk6XxJcdFeyTWVcn2aSxRS8LZjFrw), `OracleDocumentID 1` |
| Borrower, the market maker | [`rnLnMVxhicYy3Jg4LGFoCvXwbnejyx43cE`](https://devnet.xrpl.org/accounts/rnLnMVxhicYy3Jg4LGFoCvXwbnejyx43cE) |
| Demo investors | see [`docs/DEMO-ACCOUNTS.md`](./docs/DEMO-ACCOUNTS.md) |

Every account and object, including the historical runs, with a link for each:
[`docs/ON-CHAIN.md`](./docs/ON-CHAIN.md).

## Repository structure

```
scripts/              the ledger work
  lib/lending.mjs     shared client, including our own counterparty signer
  standing.mjs        provisions the two standing funds, collateral, oracle and demo investors
  recall-spine.mjs    the flagship lifecycle, end to end
  default-arc.mjs     impairment, default, and the cover settling it
  demo.mjs            the pitch harness: a vault timed to the slot, then one step per beat
  read-vault.mjs      the read path, and the calls it takes
  experiments/        what we fired at the ledger to establish the findings
web/                  the app: Next.js; server routes read the ledger and relay signed transactions
  lib/finance.ts      every lending metric the dashboard shows, with its definition
docs/
  ON-CHAIN.md         every account and object we created, with explorer links
  DEMO-ACCOUNTS.md    the two demo keys, published on purpose
  ONE-PAGER.en.md     the product on one page, and ONE-PAGER.fr.md in French
  evidence/           transaction hashes per run, machine readable
  research/           the sourced notes behind the report and the lending conventions
  review/             the adversarial reviews of our own submission, including the external audit
  feedback/           the running friction log
DEVELOPER-REPORT.md   the deliverable: three pages, every claim with a hash, a file or a pull request
SUBMISSION.md         the deliverable checklist
```

## Getting started

Node 20.19 or newer, the floor `xrpl.js` declares.

```bash
npm install                          # xrpl.js@5.2.0-beta.0, ripple-binary-codec, ripple-keypairs

node scripts/experiments/counterparty-signature.mjs   # finding 1, offline, one second
node scripts/read-vault.mjs t2 B5EC8B2CFF11828C7A3B2552FD14F370659D1CB6857547A3A720E568E1F14730
node scripts/gen-onchain-inventory.mjs                # re-verifies every hash against the ledger

node scripts/standing.mjs            # a fresh standing world on Devnet, about eight minutes
node scripts/recall-spine.mjs        # the flagship lifecycle, about seven minutes
node scripts/default-arc.mjs         # the default arc at a 100% cover rate

cd web && npm install && npm run build && npm run start   # the app, http://localhost:3000
```

`scripts/lib/lending.mjs` holds the shared client. Its `signCounterparty()` deliberately does not use
`signLoanSetByCounterparty` from xrpl.js, which is broken in the version this track mandates.

## Contributing back

[ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342), opened during the event.
Pasting a `LoanBroker` or `Loan` identifier into the XRPL Explorer search returns not-found although
the explorer already renders both on the vault page. One `ledger_entry` call switched on
`LedgerEntryType` resolves all three: the same request count for vaults and brokers, one extra hop
for a loan. Detail and prior art in
[`docs/CONTRIBUTION-explorer-search.md`](./docs/CONTRIBUTION-explorer-search.md).

## Team

**patapim**: Sofiane Ben Taleb ([@gamween](https://github.com/gamween)) and Armand Séchon
([@STOOOKEEE](https://github.com/STOOOKEEE)).

Demonstration on XRPL Devnet with a fictitious security and a fictitious cash token. Funds and
institutions named in this repository are market context, not partners. The front end's art direction
is adapted from a public reference study whose provenance is recorded in `docs/reference/`.

MIT licence, see [`LICENSE`](./LICENSE).
