# Submission checklist

XRPL Lending Protocol Hackathon, Paris, 13 September 2026, 13:00 CEST.

| | Deliverable | State |
|---|---|---|
| ☐ | **DevEx feedback form**, team members and GitHub handles | **link not published anywhere**: not in either version of the brief, not in the three decks, not on the Notion page. Ask the organizers for it, then fill it with the team block below. |
| ☑ | Public GitHub repository | [gamween/patapim](https://github.com/gamween/patapim) |
| ☑ | README: what it does, setup, track, environment, library version, every XLS-65/66 transaction used | [`README.md`](./README.md) |
| ☑ | Links to verified on-chain transactions | in the README table and [`docs/evidence/recall-t2.json`](./docs/evidence/recall-t2.json) |
| ☑ | Manual developer-feedback report at the repository root, three pages maximum | [`DEVELOPER-REPORT.md`](./DEVELOPER-REPORT.md) |
| ☑ | DevEx hook installed and reporting, on every developer machine | both machines, pseudonym `witty-iguana-68` for this one |
| ☑ | Contribution back | [ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342) |
| ☐ | Slide deck, ten slides maximum | with the design |
| ☐ | Security issue reported privately to a mentor before presenting | the borrower eligibility gap, see the developer report |
| ☐ | Live demo rehearsed against a vault timed for the pitch slot | provisioning script to run on the morning |

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

## Pitch, from the brief

Four minutes of live demo then two minutes of questions, per the Notion brief. The Ripple challenge
deck says five and three instead. Worth settling with a mentor before Sunday.

Cover: the use case, the on-chain flow, the three most important friction points, the proposed
improvements, and what we contributed back.
