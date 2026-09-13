# Plan

Submission Sunday 13 September, 13:00 CEST. Code freeze 12:30.

## Done

| | |
|---|---|
| Track and use case | Track 2, closed-ended vault, Loaded flavour, agency securities lending |
| Flagship lifecycle | every Track 2 minimum-bar step on the public devnet, `docs/evidence/recall-t2.json` |
| Default arc | proven twice, at a 10% and a 100% cover rate, `docs/evidence/default-arc-cover*.json` |
| Standing book | Fund I in term with a collateralised loan, Fund II open for subscription, `scripts/standing.mjs`, until 16 September |
| App | https://patapim-gamma.vercel.app, reads the ledger, Sign tab relays a browser-signed transaction |
| Developer report | `DEVELOPER-REPORT.md`, three pages in three renderings |
| Deck | nine slides, `docs/PATAPIM-DECK.pdf`, live at `/deck/index.html` |
| One-pagers | `docs/ONE-PAGER.en.md`, `docs/ONE-PAGER.fr.md` |
| Contribution back | [ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342), open |
| External audit | `docs/review/FABLE-AUDIT.md`, every blocking item resolved, see its resolution section |

## Left to do, in order

| # | What | Who | Why it matters |
|---|---|---|---|
| 1 | **DevEx form**, once the organizers publish the link | Sofiane | required, blocked on them |
| 2 | Confirm the DevEx hook runs on the second machine | Armand | required per developer |
| 3 | Rehearse the four minutes against Fund I, Fund II and a pitch vault | both | 10% of the score |
| 4 | Settle 4+2 against 5+3 minutes with a mentor | Sofiane | the two briefs disagree |

## The demo, four minutes

| | |
|---|---|
| 0:00 | the problem in two sentences: tokenised securities that can only sit still |
| 0:30 | Fund II, Sign tab: the demo key without a credential is refused `tecNO_AUTH`, the one with a credential subscribes `tesSUCCESS` |
| 1:30 | Fund I: in term, deposits refused `tecEXPIRED`; the loan at 25 bps, 102% collateral, first-loss capital at 125% of debt |
| 2:00 | the loan of securities: one `LoanSet`, two signatures, and the explorer showing the same book |
| 2:30 | the default arc from verified hashes: impairment takes NAV per share to 0.60, the cover restores it to 1.00 |
| 3:15 | the three friction points and what we propose, ending on `tfLoanCall` |
| 3:45 | the contribution back, one PR open on their explorer |

For a live phase flip on stage, `node scripts/demo.mjs provision 4 10` about ten minutes before the slot,
then `deposit-ok`, `deposit-blocked`, and `deposit-late` once the boundary passes. The minimum investment
period is 180 seconds, so the default arc is shown from its hashes.

## Risks

| risk | mitigation |
|---|---|
| devnet is slow or unreachable during the pitch | the explorer pages and the deck's verified hashes, open in tabs |
| a judge moves the demo investors' tokens or deletes the credential | `node scripts/standing.mjs` re-provisions in about eight minutes; update `web/lib/config.ts` and `docs/DEMO-ACCOUNTS.md` |
| Fund I's loan passes its due date | it falls due on 15 September 12:00 CEST, after the judging |
| a late change breaks the front at 12:29 | freeze the front at 11:00 and touch nothing but copy after that |
| the DevEx form link never arrives | ask a mentor in person during the Sunday morning coaching slot |
