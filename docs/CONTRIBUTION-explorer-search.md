# Contribution back: make loan broker and loan identifiers resolvable in the XRPL Explorer

**Opened as [ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342).**

Review round one: the automated reviewer asked for loan brokers to be named explicitly in both
search strings, since `LoanBroker` became a distinct resolvable type while the copy only said
`Loan`. Applied in `8c361b5`. The required checks are waiting on a maintainer to approve the
workflow run, which is the normal gate for a first-time external contributor, and the repository
requires two approving reviews with write access.

Verified on 12 September 2026 against `ripple/explorer` at `main` and against the live Devnet
explorer. Everything below is reproducible.

## The gap, reproduced on the live explorer

Our own loan broker, created on Devnet during this hackathon:

```
https://devnet.xrpl.org/search/055FDE074EC86E62F94F32D296898DA8A9D2586262AD1B912CA6066377D0BE9F
→ "Could not find any Transactions, Vaults, Ledgers or NFTs that match the specified ID"
```

Our own loan:

```
https://devnet.xrpl.org/search/A7920C443CA7AD71803F7F8E230FC7E1B53FC560EF10DD5EA59DE9D621F54165
→ same "NOT FOUND"
```

Screenshot: [`docs/evidence/explorer-search-loan-not-found.jpg`](./evidence/explorer-search-loan-not-found.jpg).

Both identifiers are rendered by that same explorer, two clicks away, on the vault page:

```
https://devnet.xrpl.org/vault/6B79B084F9EA00FB3B8B368D5710F50A871D488DE43095500B38C9FAD6D2C13C
→ Loans · Broker 1 · LOAN BROKER ID 055FDE07…D0BE9F · FIRST-LOSS CAPITAL 500.00K TBL
  All Loans · LOAN ID A7920C4…54165 · 5.00% · Paid Off
```

The search placeholder states the supported set in the product's own words:
`Search by Token, Address, Ledger, Txn, VaultID or LedgerHash`.

## Where it is in the code

| What | Where |
|---|---|
| The resolver, four lookups only: transaction, vault, ledger, NFT | `src/containers/Header/Search.tsx:42`, `determineHashType` |
| The failure branch that produces the message | `Search.tsx`, `type === null` → `SEARCH_RESULT_ROUTE` |
| `getLoanBroker`, already written | `src/rippled/lib/rippled.ts:895`, exported at `:953` |
| already consumed in production code | `src/containers/shared/components/Transaction/utils/vaultUtils.ts:31` |
| already unit tested | `src/rippled/lib/test/rippled.test.ts:119,135,146` |
| the destination page, already rendering brokers and loans | `src/containers/Vault/VaultLoans/{index,BrokerTabs,BrokerDetails,LoanRow}.tsx` |
| routes: a vault route exists, no loan or broker route | `src/containers/App/routes.ts:82` `VAULT_ROUTE` |

So the resolver is the only missing piece. The parent chain is two hops and both are already fetchable:
`Loan.LoanBrokerID → LoanBroker.VaultID → Vault`.

## Why this is legitimate and not already done

Searching every issue and pull request in `ripple/explorer` for "loan" returns four results, and
none of them is about search:

| | |
|---|---|
| #1259 | `feat: Support for XLS-0066 Lending Protocol`, merged 2025-12-15 |
| #1281 | `Explorer Lending Protocol Object Page`, merged 2026-03-11 |
| #1292 | `Feature: Vault Rankings Page`, merged 2026-03-20 |
| #1328 | `fix(vault): scale XRP drops & MPT amounts on Vault detail page`, open |

The search area is alive and being extended right now, which makes the timing good and the change
adjacent rather than conflicting:

| | |
|---|---|
| #1340 | `Add MPT ticker/issuer search alongside IOU search`, opened 2026-09-08 by a Ripple engineer, still open |
| #1120 | `Explorer Search is misleading when clicking "enter"`, open, the sibling symptom |
| #916 | `Rewrite search system`, open since 2024 |

The repository is MIT licensed, not archived, last pushed 2026-09-11, and its `CONTRIBUTING.md`
opens with "We're thrilled you're interested".

## The change

1. Add two lookups to `determineHashType`: `getLoanBroker`, and a loan lookup by ledger entry index.
2. Resolve a `LoanBroker` hit to its `VaultID`, and a `Loan` hit to `LoanBrokerID` then `VaultID`.
3. Route both to the existing vault page, deep linking the broker tab so the object the user pasted
   is the one in view.
4. Update the placeholder and the not-found copy, which both enumerate the supported types.
5. Tests next to the existing `getLoanBroker` cases.

Roughly forty to eighty lines plus tests. No new page, no new route, no new RPC helper.

## A second, smaller thing found on the way

On the same vault page, for a closed-ended vault:

- `VaultKind`, `SubscriptionDate` and `RedemptionDate` are not displayed at all, so a fixed-term
  vault is indistinguishable from an open-ended one. Ours shows no term anywhere.
- `TOTAL VALUE LOCKED`, `AVAILABLE TO BORROW` and `UNREALIZED LOSS` render as `--` rather than `0`
  when the ledger omits the field because it sits at its default. The explorer reads absent as
  unknown, when it means zero.

Both are small and both are the user-visible face of a finding in our developer report.
