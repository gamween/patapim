# patapim: securities lending, native on the XRP Ledger

**XRPL Lending Protocol Hackathon, Paris, September 2026 · Track 2, closed-ended vaults · public XRPL Devnet**

*Written for the submission on 13 September 2026. Figures and fund phases are those of that day; the funds keep running on Devnet and the app reads their live phase.*

App: https://patapim-gamma.vercel.app · Video: https://youtu.be/rl5IiE9Bn8A · Code: https://github.com/gamween/patapim · Team: Sofiane Ben Taleb (@gamween), Armand Séchon (@STOOOKEEE)

## The problem

Tokenised Treasury bills and money market funds are arriving on public ledgers, and their holders can
only hold them. In traditional markets, agency securities lending is how long-only portfolios earn on
their holdings: an agent lends the securities to market makers for a fee and stands behind the lenders.
On chain, for regulated securities, that market does not exist yet.

## What patapim does

A lending agent runs a **fixed-term fund** whose asset is the security itself.

| Step | What happens | XRPL primitive |
|---|---|---|
| Subscription | Eligible holders deposit the security and receive fund shares | Closed-ended Single Asset Vault (XLS-65), Credentials, Permissioned Domain |
| First-loss capital | The agent posts capital, in the same security, that absorbs defaults first | Loan broker cover (XLS-66) |
| Loan | A market maker borrows the securities for a fixed term; agent and borrower both sign | `LoanSet` with two signatures |
| Collateral | The borrower posts cash collateral worth 102% of the loan, priced by an on-ledger oracle | Token escrow of an MPT, Price Oracle |
| Return | The borrower returns the securities with the fee; lenders keep 90% of it | `LoanPay`, management fee |
| Default | Past the grace period the agent's capital repays the fund | `LoanManage`, cover liquidation |

No smart contract: every step is a native ledger object, and every figure in the app is read from the
validated ledger.

## Conventions we follow, and where they come from

- **Lending fee in basis points a year**, the way securities lending quotes it: 25 bps on the demo loan.
- **Fee split 90/10**, lender and agent: the lender-friendly end of published agency splits, and the most
  the protocol allows (`ManagementFeeRate` caps at 10%).
- **Collateral margin 102%**, the customary same-currency margin, set at origination.
- **First-loss capital, not an unlimited indemnity**: on default the cover pays
  `min(DebtTotal × CoverRateMinimum × CoverRateLiquidation, principal)`, capped by what was posted.
- **NAV per share net of unrealised loss**, the XLS-65 exit exchange rate, which Maple Finance also uses.
- **Fund return = lending fee × utilisation × (1 − agent share)**, the supply-rate identity of lending pools.

Every source is quoted in `docs/research/lending-conventions.md`.

## Live on XRPL Devnet

| | Fund I, in term | Fund II, open for subscription |
|---|---|---|
| Assets | 5,000,000 TBL | 3,000,000 TBL and counting |
| On loan | 2,000,000 TBL at 25 bps, returns 15 September | none, lending opens after subscription |
| First-loss capital | 2,500,000 TBL, 125% of debt | 2,500,000 TBL |
| Collateral | 2,014,500.00 USDX, 102.0% of market value | none |
| Closes / matures | closed / 16 September 2026 | 16 September / 16 December 2026 |

**Sign it yourself.** Open Fund II, connect a wallet with XRPL Commons' xrpl-connect, or load a Devnet
demo key in the Sign tab; the two demo accounts are in `docs/DEMO-ACCOUNTS.md`, keys on request. The investor with a credential is accepted, `tesSUCCESS`; the one without is
refused by the ledger, `tecNO_AUTH`. The wallet, or the page with the mandated
`xrpl.js@5.2.0-beta.0`, signs; the server only relays the signed transaction.

Every account and object, with an explorer link and each of the 76 transactions re-verified against the
ledger: `docs/ON-CHAIN.md`.

## What building it taught us

The full developer report is three pages, `DEVELOPER-REPORT.md`. The three findings that cost the most:

1. **The mandated library cannot originate a loan.** `xrpl.js@5.2.0-beta.0` signs the borrower's
   signature with the wrong hash prefix, so the ledger rejects every `LoanSet`. We call the codec
   ourselves; `5.2.0-beta.1`, published during the event, fixes it. Reproduced offline in one second.
2. **The two hackathon networks enforce different lending rules** behind the same lending amendments,
   and nothing a developer can query tells them apart.
3. **A closed-ended vault protects the calendar, not the cash.** A loan left unpaid leaves lenders unable
   to redeem at maturity, and the protocol has no recall. We propose `tfLoanCall`, the recall right every
   securities lender holds.

Also found: a permissioned domain gates lenders but not borrowers (the fix is open as XLS-Standards #484
and rippled #6517), impairment ignores the grace period, no lending transaction can be delegated, and neither
the Crossmark nor the GemWallet extension can sign a vault transaction yet.

## Contributed back

[ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342), open and awaiting review: it makes the
XRPL Explorer search resolve a loan broker or loan id to the vault that holds it, where today it answers
"not found".

*Demonstration on XRPL Devnet with a fictitious security (TBL) and a fictitious cash token (USDX). Funds and
institutions named are market context, not partners.*
