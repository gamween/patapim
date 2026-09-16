# Devnet demo accounts

Two throwaway accounts on the public XRPL Devnet (network_id 2) let anyone, a judge first, sign a real
transaction against a patapim fund and watch the ledger accept or refuse it. They hold test XRP from the
faucet and a fictitious security, TBL, which has no value anywhere.

**About their keys.** They were published on this page for the judges on 13 September 2026, then taken
out of the tree the same morning (commit `59964c8`); they remain readable in the git history, which is
fine for Devnet accounts that hold nothing of value, and it is why they must never be reused for
anything else. Every other key patapim uses lives in `.demo/`, which is gitignored and never pushed.

## The two investors

| | Holds a credential | Address |
|---|---|---|
| **Eligible investor** | yes, `patapim.eligible.v1` issued by the lending agent and accepted | [`rM7nDFZZPqHnS1UqRBgdsrVSxNWqpMVnNC`](https://devnet.xrpl.org/accounts/rM7nDFZZPqHnS1UqRBgdsrVSxNWqpMVnNC) |
| **Ineligible investor** | no | [`rKsP5GqUeHHnJsgRnXmK8Q4QryxfRR22EN`](https://devnet.xrpl.org/accounts/rKsP5GqUeHHnJsgRnXmK8Q4QryxfRR22EN) |

Both were authorised by the transfer agent to hold TBL and each received 1,000,000 TBL. The only
difference between them is the credential, so a refusal can only come from the permissioned domain.

## What the ledger answered during the event

The two standing funds were provisioned in two different phases, so that a fund in its term and a
fund open for subscription could be shown side by side. Every row below was signed through the app's
own relay before the submission; the hashes are in
[`docs/evidence/fund-offering.json`](./evidence/fund-offering.json) and
[`docs/evidence/fund-term.json`](./evidence/fund-term.json).

| Fund | Phase at the time | Account | Transaction | The ledger answered |
|---|---|---|---|---|
| [Fund II](https://patapim-gamma.vercel.app/vault/B8286CD54ED120116C66C4B3F8663E6E06E7A593A9395B84497894A586A74530) | Subscription, until 16 September 2026 16:00 UTC | eligible | `VaultDeposit` 1,000 TBL | `tesSUCCESS`, shares minted |
| Fund II | Subscription | ineligible | `VaultDeposit` 1,000 TBL | `tecNO_AUTH`, refused by the domain |
| Fund II | Subscription | eligible | `VaultWithdraw` its shares | `tesSUCCESS`, redemptions are open while subscribing |
| [Fund I](https://patapim-gamma.vercel.app/vault/B5EC8B2CFF11828C7A3B2552FD14F370659D1CB6857547A3A720E568E1F14730) | Investment, until 16 September 2026 16:00 UTC | either | `VaultDeposit` | `tecEXPIRED`, the subscription period is over |

A closed-ended vault's dates are immutable, so both funds have moved on: since 16 September 2026
16:00 UTC Fund I is in redemption and Fund II is in its term until 16 December 2026. A deposit into
either now gets `tecEXPIRED`; the eligibility contrast needs a fund in subscription, which
`node scripts/standing.mjs` provisions afresh in about eight minutes, after which this page and
`web/lib/config.ts` take the new ids.

## How to sign

Open a fund and connect a wallet with **Connect Wallet**, or go to the **Sign** tab and use **No
wallet? Use a Devnet demo key**. A wallet must be on XRPL Devnet and able to sign a vault transaction
with an MPT amount: Xaman can, and its backend accepts a `VaultDeposit` payload forced to `DEVNET`;
Crossmark and GemWallet cannot (`docs/feedback/FRICTION-LOG.md`, F-019).

The transaction is signed on the visitor's side, by the wallet or in the browser with
`xrpl.js@5.2.0-beta.0`. Only the signed transaction goes to the server, which relays it to XRPL Devnet
and reads the validated result.

## If an account stops working

Whoever holds a key can move the TBL, delete the credential or spend the XRP. If the eligible account has
lost its credential or its TBL, re-provision with `node scripts/standing.mjs`, which creates a fresh world,
then update this page and `web/lib/config.ts` with the new ids. The faucet refills XRP:
`curl -X POST https://faucet.devnet.rippletest.net/accounts -H 'Content-Type: application/json' -d '{"destination":"<address>"}'`.

## For auditors

No seed is in the working tree:

```bash
git grep -nE "\bs[Ee]d[A-Za-z0-9]{27,}"   # must print nothing
```
