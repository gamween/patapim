# Submission checklist

XRPL Lending Protocol Hackathon, Paris, 13 September 2026, 13:00 CEST.

| | Deliverable | State |
|---|---|---|
| ☑ | **DevEx feedback form**, team members and GitHub handles | filled on 13 September with the team block below |
| ☑ | Public GitHub repository | [gamween/patapim](https://github.com/gamween/patapim) |
| ☑ | README: what it does, setup, track, environment, library version, every XLS-65/66 transaction used | [`README.md`](./README.md) |
| ☑ | Links to verified on-chain transactions | the README table, and [`docs/ON-CHAIN.md`](./docs/ON-CHAIN.md): 76 transactions re-verified against the ledger |
| ☑ | Manual developer-feedback report at the repository root, three pages maximum | [`DEVELOPER-REPORT.md`](./DEVELOPER-REPORT.md), three pages rendered on A4 at 11 pt, on Letter at 12 pt and in GitHub's style |
| ☑ | DevEx hook installed and reporting, on every developer machine | pseudonym `witty-iguana-68` on this machine; confirm the second machine before 12:30 |
| ☑ | Contribution back | [ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342), open, tests and lint passing |
| ☑ | Slide deck, ten slides maximum | ten slides, [`docs/PATAPIM-DECK.pdf`](./docs/PATAPIM-DECK.pdf) |
| ☑ | Deployed app a judge can use | [patapim-gamma.vercel.app](https://patapim-gamma.vercel.app): Fund I in term, Fund II open for subscription, wallet connect by xrpl-connect, Sign tab with a demo-key fallback, accounts in [`docs/DEMO-ACCOUNTS.md`](./docs/DEMO-ACCOUNTS.md) |
| ☑ | Borrower eligibility gap | nothing to disclose privately: publicly tracked as XRPL-Standards #484 and rippled #6517, both open. Mention it to a mentor as courtesy. Finding F-018 |
| ☑ | Video demo, appreciated | [youtu.be/rl5IiE9Bn8A](https://youtu.be/rl5IiE9Bn8A), app only, from the script and shot list in [`docs/deck/VIDEO-SCRIPT.md`](./docs/deck/VIDEO-SCRIPT.md); linked from the README header |
| ☐ | Live demo rehearsed | Fund I and Fund II stand until 16 September; for a live phase flip, `node scripts/demo.mjs provision 4 10` about ten minutes before the slot |
| ☑ | One-pagers | [English](./docs/ONE-PAGER.en.md), [français](./docs/ONE-PAGER.fr.md) |

## Team block, for the form

| | |
|---|---|
| Team | patapim |
| Members | Sofiane Ben Taleb, [@gamween](https://github.com/gamween) · Armand Séchon, [@STOOOKEEE](https://github.com/STOOOKEEE) |
| Track | 2, closed-ended vault, Lending Protocol V1.1 |
| Flavour | Loaded |
| Environment | Public XRPL Devnet, network_id 2, rippled 3.4.0-rc5 |
| Library | xrpl.js@5.2.0-beta.0 |
| Repository | https://github.com/gamween/patapim |
| App | https://patapim-gamma.vercel.app |
| Video | https://youtu.be/rl5IiE9Bn8A |

## Pitch, from the brief

Four minutes of live demo then two minutes of questions, per the Notion brief. The Ripple challenge
deck says five and three instead. Worth settling with a mentor before presenting.

Cover: the use case, the on-chain flow, the three most important friction points, the proposed
improvements, and what we contributed back.
