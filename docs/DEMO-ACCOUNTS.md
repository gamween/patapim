# Devnet demo accounts, published on purpose

These two keys are **deliberately public**. They control throwaway accounts on the public XRPL
Devnet (network_id 2) that hold test XRP from the faucet and a fictitious security, TBL, which has no
value anywhere. They exist so that anyone, a judge first, can sign a real transaction against a
patapim fund and watch the ledger accept or refuse it. Every other key patapim uses stays out of this
repository: they live in `.demo/`, which is gitignored.

Never reuse these keys, never send them anything of value, and never paste a key that controls real
funds into any page.

## The two investors

| | Holds a credential | Address | Family seed |
|---|---|---|---|
| **Eligible investor** | yes, `patapim.eligible.v1` issued by the lending agent and accepted | [`rM7nDFZZPqHnS1UqRBgdsrVSxNWqpMVnNC`](https://devnet.xrpl.org/accounts/rM7nDFZZPqHnS1UqRBgdsrVSxNWqpMVnNC) | `sEdTm12jmhB8ixUzpruKsquBAUMdBR4` |
| **Ineligible investor** | no | [`rKsP5GqUeHHnJsgRnXmK8Q4QryxfRR22EN`](https://devnet.xrpl.org/accounts/rKsP5GqUeHHnJsgRnXmK8Q4QryxfRR22EN) | `sEdSWT233PtTxUT4BTp5H476pfVXEk1` |

Both were authorised by the transfer agent to hold TBL and each received 1,000,000 TBL. The only
difference between them is the credential, so a refusal can only come from the permissioned domain.

## What to try

Open the app, choose **Fund II** in the vault picker, go to the **Sign** tab and load one key.

| Fund | Phase | Account | Transaction | The ledger answers |
|---|---|---|---|---|
| [Fund II](https://patapim-gamma.vercel.app/vault/B8286CD54ED120116C66C4B3F8663E6E06E7A593A9395B84497894A586A74530) | Subscription, until 16 September 18:00 CEST | eligible | `VaultDeposit` 1,000 TBL | `tesSUCCESS`, shares minted |
| Fund II | Subscription | ineligible | `VaultDeposit` 1,000 TBL | `tecNO_AUTH`, refused by the domain |
| Fund II | Subscription | eligible | `VaultWithdraw` its shares | `tesSUCCESS`, redemptions are open while subscribing |
| [Fund I](https://patapim-gamma.vercel.app/vault/B5EC8B2CFF11828C7A3B2552FD14F370659D1CB6857547A3A720E568E1F14730) | Investment, until 16 September 18:00 CEST | either | `VaultDeposit` | `tecEXPIRED`, the subscription period is over |

The page signs in the browser with `xrpl.js@5.2.0-beta.0`. The key never leaves the tab: only the
signed transaction goes to the server, which relays it to XRPL Devnet and reads the validated result.

Every row above was signed through the app's own relay before publication; the hashes are in
[`docs/evidence/fund-offering.json`](./evidence/fund-offering.json) and
[`docs/evidence/fund-term.json`](./evidence/fund-term.json).

## If a key stops working

Anyone holding these keys can move the TBL, delete the credential or spend the XRP. If the eligible
account has lost its credential or its TBL, re-provision with `node scripts/standing.mjs`, which
creates a fresh world, then update this page and `web/lib/config.ts` with the new ids. The faucet refills XRP:
`curl -X POST https://faucet.devnet.rippletest.net/accounts -H 'Content-Type: application/json' -d '{"destination":"<address>"}'`.

## For auditors

These are the only seeds in the working tree. The check:

```bash
git grep -nE "\bs[Ee]d[A-Za-z0-9]{27,}" -- . ':!docs/DEMO-ACCOUNTS.md'   # must print nothing
git grep -c "sEd" -- web/                                                 # must print nothing
```
