<div align="center">

# 🌳 patapim

**Securities lending, native on the XRP Ledger — a fixed-term, credential-gated vault that lends tokenised securities through an indemnified agent.**

[![XRPL Devnet](https://img.shields.io/badge/XRPL-Devnet%20(2)-1257d4?style=flat-square)](https://devnet.xrpl.org)
[![Track 2](https://img.shields.io/badge/Track%202-closed--ended%20vault-0f9d58?style=flat-square)](#the-trade)
[![xrpl.js](https://img.shields.io/badge/xrpl.js-5.2.0--beta.0-363636?style=flat-square)](https://www.npmjs.com/package/xrpl/v/5.2.0-beta.0)
[![Contribution](https://img.shields.io/badge/ripple%2Fexplorer-%231342-7c3aed?style=flat-square)](https://github.com/ripple/explorer/pull/1342)
[![XLS-65 · XLS-66](https://img.shields.io/badge/XLS--65%20%C2%B7%20XLS--66-Lending%20Protocol-b54708?style=flat-square)](https://xls.xrpl.org/xls/XLS-0066)

**XRPL Lending Protocol Hackathon · Paris · 12-13 September 2026**

</div>

patapim lets holders of a tokenised security lend it, for a fee, through a lending agent who
indemnifies them with its own capital. Eligible holders subscribe to a fixed-term vault, the agent
posts first-loss cover denominated in the same security, a market maker borrows against escrowed
collateral, and if the securities do not come back the cover repays the vault. No smart contract:
every step is a native XRPL object.

> Tokenised treasuries and money market funds are arriving on XRPL, and a holder can only sit on
> them. In traditional finance, agency securities lending is what makes long-only portfolios work.
> On chain, for regulated securities, that market does not exist yet, and every primitive it needs
> already shipped.

## Table of contents

- [The trade](#the-trade)
- [On the ledger](#on-the-ledger)
- [What building it made visible](#what-building-it-made-visible)
- [The default arc](#the-default-arc)
- [Every transaction, verified](#every-transaction-verified)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Deployed addresses](#deployed-addresses)
- [Contributing back](#contributing-back)
- [Team](#team)
- [License](#license)

## The trade

1. **Subscription.** Eligible holders, carrying an on-chain credential accepted by the agent's
   permissioned domain, deposit the tokenised security into a fixed-term vault. The vault's asset is
   the security itself, not cash.
2. **Indemnity.** The lending agent owns the vault and the loan broker and posts first-loss cover in
   the same security. The ledger refuses to originate a loan the cover cannot absorb.
3. **Borrow.** A market maker escrows XRP and signs a request; the agent counter-signs. One
   transaction, two signatures.
4. **Return.** At maturity the borrower returns the securities and the fee, and the escrowed
   collateral is released back. The lender's return is the interest the loan carries; the lending
   fee, measured, goes to the agent rather than to the vault, which is finding F-016.
5. **Default.** Past the grace period the agent declares default. The first-loss cover, sized at one
   hundred percent of the loan, repays the vault in securities: the vault does not shrink and the
   lenders' share price does not move. Verified on chain, not asserted.

## On the ledger

| Securities lending | XRPL object | Notes |
|---|---|---|
| Lender pool | Closed-ended Single Asset Vault | XLS-65, `VaultKind: 1`, asset is the tokenised security |
| Lending agent | `LoanBroker` | XLS-66, owns the vault and the loan book |
| Agent indemnity | First-loss cover | posted and paid in the security itself |
| Eligibility | Credentials plus Permissioned Domain | the gate is carried by the vault's share issuance |
| The security | Multi-purpose token | issuer keeps clawback, lock and authorisation |
| Settlement delay | `GracePeriod` | on the loan, before default can be declared |
| Collateral | Escrowed XRP | `FinishAfter` for the agent, `CancelAfter` for the borrower |
| Loan of securities | `LoanSet`, two signatures | agent signs, borrower counter-signs |

Vault shares inherit the underlying security's authorisation gate, so eligibility on the security is
eligibility on the lender position.

## What building it made visible

Developer experience is the event's primary deliverable and the full report is
[`DEVELOPER-REPORT.md`](./DEVELOPER-REPORT.md). The three that cost us the most:

- **The library the brief mandates cannot originate a loan.** `signLoanSetByCounterparty` in
  `xrpl.js@5.2.0-beta.0` signs with the ordinary transaction encoder; rippled rejects it. The same
  `LoanSet` succeeds on stable 5.2.0, which in turn lacks the closed-ended vault types. No published
  version has both halves. We shipped the workaround in `scripts/lib/lending.mjs`.
- **The two hackathon networks enforce different lending rules behind the same lending amendments.**
  `LoanBrokerSet` against an open-ended vault is `tesSUCCESS` on one and `tecNO_PERMISSION` on the
  other, and nothing in `server_info` or the amendment set tells them apart.
- **A closed-ended vault protects the calendar, not the cash.** The ledger refuses a loan whose
  schedule outlives the vault, but a loan left unpaid leaves lenders unable to withdraw, with no
  recall path. We propose `tfLoanCall`.

## The default arc

Run twice, the only difference being `CoverRateMinimum`.

| state | vault assets | unrealised loss | price per share | agent cover |
|---|---|---|---|---|
| loan drawn, 2,000,000 TBL | 5,000,000 | 0 | 1.00 | 2,500,000 |
| impaired | 5,000,000 | 2,000,000 | 1.00 | 2,500,000 |
| **defaulted** | **5,000,000** | 0 | **1.00** | **500,000** |

The cover absorbs the entire loan and the lenders are untouched. At a ten percent cover rate the
same default takes the vault to 3,200,000 and the share price to 0.64: the rate, not the balance,
decides what the cover absorbs. That contrast is finding F-014.

## Every transaction, verified

One full lifecycle on XRPL Devnet, regenerated from the chain by
`node scripts/gen-evidence-table.mjs`.

<!-- evidence:start -->

| Transaction | Role in patapim | Result | Hash |
|---|---|---|---|
| `MPTokenIssuanceCreate` | the tokenised security, require-auth so the transfer agent keeps control | `tesSUCCESS` | [`69A38645`](https://devnet.xrpl.org/transactions/69A38645EBED7B2900E928DD5893914B06E5C9A0FB64F22C1183B182D2F7C3DD) |
| `PermissionedDomainSet` | the eligibility whitelist the vault carries on its share issuance | `tesSUCCESS` | [`878653B1`](https://devnet.xrpl.org/transactions/878653B16FAB04BA428A96FF1740E6F46BEE53FBCB6333CC1FD424B672A165DE) |
| `VaultCreate` | the fixed-term lender pool, `VaultKind: 1`, asset is the security, gated by `DomainID` | `tesSUCCESS` | [`565318B0`](https://devnet.xrpl.org/transactions/565318B02FEAC00080F137BE3B66C1E3B080B0580A06F6FD1A1A78A55B1B0C5E) |
| `VaultDeposit` | an eligible holder subscribes | `tesSUCCESS` | [`F8D70563`](https://devnet.xrpl.org/transactions/F8D70563711AFC3EFBA0EF61F3DA6E7944DDB6B2A34F3632DBB78049C0D83391) |
| `VaultDeposit` | a holder with no credential is refused by the domain | `tecNO_AUTH` | [`30C4B86F`](https://devnet.xrpl.org/transactions/30C4B86FF9456761892943E69E0C2EC338A1EFE9F7CCF4AE1160ED831AEDB6F9) |
| `LoanBrokerSet` | the lending agent, with its debt ceiling and cover rates | `tesSUCCESS` | [`98BB53E0`](https://devnet.xrpl.org/transactions/98BB53E08D518482166E91AD1FFED0421B72D080E26CC9F0601EE8ACCBC97062) |
| `CoverDeposit` | first-loss capital, posted in the security | `tesSUCCESS` | [`C5D955D8`](https://devnet.xrpl.org/transactions/C5D955D818CB9D920E03BA2FCF8A101D284E87A86388B65A8022B74F7B16B555) |
| `VaultDeposit` | the subscription window has closed, the phase gate fires | `tecEXPIRED` | [`E4F68FB0`](https://devnet.xrpl.org/transactions/E4F68FB08B8DDA19E962A7B3A90485CF94CD3168C688D776000EC1ADBDEB9D7C) |
| `VaultWithdraw` | capital is locked for the term, the second phase gate | `tecTOO_SOON` | [`32077697`](https://devnet.xrpl.org/transactions/32077697369163583D1D1BD43F18325D6608A70EC2814A49EDA60DDF38F44CAF) |
| `LoanSet` | the loan of securities, agent signs, borrower counter-signs | `tesSUCCESS` | [`DDD61141`](https://devnet.xrpl.org/transactions/DDD611413B8354071CB27DD291652E01424C52D82901611CC6DE042036972C12) |
| `EscrowCreate` | the borrower posts XRP collateral, held bilaterally | `tesSUCCESS` | [`05F9AF64`](https://devnet.xrpl.org/transactions/05F9AF64190D7FAB70DB730F03921928CE2BF71B5656F2D0CA54C99571F0D936) |
| `LoanPay` | the borrower returns the securities and the fee | `tesSUCCESS` | [`71DE04C6`](https://devnet.xrpl.org/transactions/71DE04C60FBC85F87CCC6283CDAA5985DF18DFF5A9DDE90694805B77927978C4) |
| `EscrowCancel` | the collateral is released back to the borrower | `tesSUCCESS` | [`7CE7D679`](https://devnet.xrpl.org/transactions/7CE7D67939902D50FA93B691C081CAE1D81299852AB56B266320A634789611A4) |
| `LoanSet` | new lending refused once redemption opens, the third phase gate | `tecEXPIRED` | [`3C01AF18`](https://devnet.xrpl.org/transactions/3C01AF182E2D99FBEE493459B61E381D8B90A1BDA13A2A118CA338CBA8E43FFD) |
| `VaultWithdraw` | the lender redeems, denominated in shares | `tesSUCCESS` | [`2FAB3F9D`](https://devnet.xrpl.org/transactions/2FAB3F9D56AE3E331E3427741FDFA5F192A4592A294B011074B5B04089D79138) |

<!-- evidence:end -->

**On yield.** A lender's return is interest, and interest over a term compressed into minutes rounds
to nothing. `LoanOriginationFee` does not help: it is taken from the drawdown and paid to the broker.
The mechanism the Lending Protocol workshop teaches for injecting yield into a closed-ended vault, a
`VaultDeposit` carrying `tfVaultDonation`, does not exist in the implementation. Findings F-006 and
F-016.

## Repository structure

```
scripts/            the ledger work
  lib/lending.mjs   shared client, including our own counterparty signer
  recall-spine.mjs  the full lifecycle, end to end
  default-arc.mjs   impairment, default, and the cover settling it
  demo.mjs          the demo harness: provision a vault timed to the pitch, then one step per beat
  probe-t2.mjs      the three phases walked on an XRP vault
  read-vault.mjs    the read path, and the calls it takes
  experiments/      what we fired at the ledger to establish the findings
web/                the app: Next.js, server rendered, reads the ledger through its own API route
docs/
  ON-CHAIN.md       every account and object we created, with explorer links
  evidence/         transaction hashes per run, machine readable
  research/         the sourced notes behind the report
  review/           the adversarial review of our own submission
  feedback/         the running friction log
  PLAN.md           what is left, the demo timing, the risks
  AUDIT-CHECKLIST.md  what a second reviewer should check, with the command for each item
DEVELOPER-REPORT.md the deliverable: three pages, every claim with a hash or a file and line
SUBMISSION.md       the deliverable checklist
```

## Getting started

Node 22 or newer.

```bash
npm install                          # xrpl.js@5.2.0-beta.0 and the codec, nothing else

node scripts/recall-spine.mjs        # provisions a full lifecycle on Devnet, about seven minutes
node scripts/default-arc.mjs         # the default arc, full indemnity by default
node scripts/read-vault.mjs t2 <VaultID> [holder]
node scripts/gen-onchain-inventory.mjs   # re-verifies every hash against the ledger

cd web && npm install && npm run dev # the app, http://localhost:3000
```

`scripts/lib/lending.mjs` holds the shared client. Note `signCounterparty()`: it deliberately does
not use `signLoanSetByCounterparty` from xrpl.js, which is broken in the version this track mandates.

## Deployed addresses

The live vault, the one the app reads and the one to open in the explorer:

| | |
|---|---|
| Vault | [`FAB518C7…0132`](https://devnet.xrpl.org/vault/FAB518C7FC616F2BEAE22537F94B53C33AF9138FC472FAF0043057B6C3020132) |
| Lending agent | [`r9RrYWqq…Am2N`](https://devnet.xrpl.org/accounts/r9RrYWqqANVqaGNTTs9j7eeYiHWrf9Am2N) |
| Loan broker | `794653A2DFABC2811C9E2748109AECB50384F9B9C9A39E7BACE7E47177F1DEA9` |
| The security, MPT | `005047816F6E93FF4027878DF0E68EDE3564DE25547C5051` |

Every account and every object we created, with a link for each, is in
[`docs/ON-CHAIN.md`](./docs/ON-CHAIN.md), regenerated by `node scripts/gen-onchain-inventory.mjs`,
which re-verifies every transaction against the ledger rather than against the file.

## Contributing back

[ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342), opened during the event.
Pasting a `LoanBroker` or `Loan` identifier into the XRPL Explorer search returned not-found although
the explorer already renders both on the vault page. One `ledger_entry` call switched on
`LedgerEntryType` resolves all three, with the request count unchanged. Detail and prior art in
[`docs/CONTRIBUTION-explorer-search.md`](./docs/CONTRIBUTION-explorer-search.md).

## Team

**patapim** — Sofiane Ben Taleb ([@gamween](https://github.com/gamween)) and Armand Séchon
([@STOOOKEEE](https://github.com/STOOOKEEE)).

Demonstration on XRPL Devnet with a fictitious security. Funds and institutions named in this
repository are market context, not partners.

## License

MIT. See [`LICENSE`](./LICENSE).
