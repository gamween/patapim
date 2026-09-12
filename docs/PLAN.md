# Implementation plan

Submission Sunday 13 September, 13:00 CEST. Code freeze 12:30.

## Done

| | |
|---|---|
| Track and use case | Track 2, closed-ended vault, Loaded flavour, securities lending |
| Ledger spine | full lifecycle verified on the public devnet, every step with a hash, `docs/evidence/recall-t2.json` |
| Loaded primitives | MPT security, Credentials, Permissioned Domain, Escrow collateral, all proven on chain |
| Read path | `scripts/read-vault.mjs` and `web/lib/ledger.ts` |
| Front | landing and live vault dashboard, `web/` |
| Developer report | `DEVELOPER-REPORT.md`, three pages |
| Contribution back | [ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342) |
| Automated feedback | 14 items filed through the event hook, plus one checkpoint analysis |

## Left to do, in order

| # | What | Who | Why it matters |
|---|---|---|---|
| 1 | **Default arc on chain**: originate, miss the payment, `LoanManage` impair, `LoanManage` default, first-loss cover repays the vault, lender position unchanged | me | the half of the story we have not yet proven, and the most convincing 120 seconds of the demo |
| 2 | **Design pass** on the landing and the dashboard | Armand | 10% of the score, and the dashboard is the demo surface |
| 3 | **Demo provisioning script**: a vault whose phase boundary falls inside the pitch slot, so a rejection fires live on screen | me | the phases run on wall clock and cannot be fast forwarded |
| 4 | **Slide deck**, ten slides maximum | Armand | required |
| 5 | **Report the borrower eligibility gap privately to a mentor** | Fianso | required by the brief before presenting |
| 6 | **DevEx form**, once the organizers publish the link | Fianso | required, blocked on them |
| 7 | Final pass: refresh the evidence file, the README transaction table and the report from the last run | me | the hashes must match what we demo |
| 8 | Rehearse the four minutes | all | 10% of the score |

## The demo, four minutes

| | |
|---|---|
| 0:00 | the problem in two sentences, tokenised securities that can only sit still |
| 0:30 | the vault on screen, in Subscription, an eligible lender deposits, a non-eligible one is refused `tecNO_AUTH` live |
| 1:30 | the phase flips on screen, the refused list changes by itself, a deposit now returns `tecEXPIRED` |
| 2:00 | the loan of securities, two signatures, one transaction |
| 2:30 | the borrower misses the payment, the agent impairs then defaults, the first-loss cover repays the vault, the lender's share price does not move |
| 3:15 | the three friction points and what we propose, ending on `tfLoanCall` |
| 3:45 | the contribution back, one PR already open on their explorer |

The default arc and the three-phase walk cannot both run live inside four minutes: the minimum
investment period alone is 180 seconds. Whichever is not live is shown from verified hashes.

## Risks

| risk | mitigation |
|---|---|
| the demo vault is in the wrong phase at pitch time | provision it from a script with the boundary set against the ledger clock, and keep a second vault one phase behind as a spare |
| devnet is slow or unreachable during the pitch | record the run the night before, and keep the explorer pages open in tabs |
| a late change breaks the front at 12:29 | freeze the front at 11:00 and touch nothing but copy after that |
| the DevEx form link never arrives | ask a mentor in person during the Sunday morning coaching slot |
