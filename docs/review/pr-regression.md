# PR #1342 — hostile regression review

Scope: https://github.com/ripple/explorer/pull/1342, branch `gamween:search-resolve-loan-objects`,
commits `b72eaed` + `8c361b5`, 3 files, +84/-21. Working copy `/tmp/explorer` (read-only; all
mutation experiments were run on a copy in the scratchpad, `/tmp/explorer` verified
`git status --short` clean afterwards).

Base: `0232381` "Use ripple-binary-codec@2.9.0 (#1338)" — the clone is depth-1, so no upstream
history beyond that commit is available locally; upstream history questions were answered via
`gh api`.

## Verdict up front

The PR is relevant. The gap is real and provable at code level, not merely by clicking. But the
change ships **one genuine new crash path that did not exist before**, **one test that does not
test what it claims**, and **one self-inflicted design objection** (it enshrines the MPT gap in an
assertion). None of it is fatal; all of it is a reviewer's legitimate ammunition.

---

## Relevance: is there actually a problem? (the developer's first question)

Yes. Three independent proofs, no clicking required.

1. **Code on `main`.** `src/rippled/lib/rippled.ts:887-889`:
   ```js
   if (resp.node?.LedgerEntryType !== 'Vault') {
     throw new Error('Not a Vault', 404)
   }
   ```
   `determineHashType` on `main` probes exactly four lookups — `getTransaction`, `getVault`,
   `getLedger({ledger_hash})`, `getNFTInfo`. A `LoanBroker` or `Loan` index rejects all four by
   construction. That guard came from the merged PR ripple/explorer#1320
   ("fix: Reject non-Vault ledger entries in getVault").

2. **`/search/:id` is a dead end.** `src/containers/SearchResult/index.tsx` is four lines:
   `const SearchResult = () => <NoMatch title="hash_not_found" />`. There is no secondary lookup
   on that page. Not-found is literally all that happens.

3. **The deployed devnet explorer is pre-PR.** `curl https://devnet.xrpl.org/locales/en-US/translations.json`
   returns `"Search by Token, Address, Ledger, Txn, VaultID or LedgerHash"` and
   `"Could not find any Transactions, Vaults, Ledgers or NFTs that match the specified ID"` — the
   strings this PR replaces. The deployment is on the code path proven in (1).

4. **No route exists for either object.** `grep "export const .*_ROUTE" src/containers/App/routes.ts`
   lists 19 routes; there is no `LOAN_ROUTE` and no `LOAN_BROKER_ROUTE`, despite
   ripple/explorer#1281 ("Explorer Lending Protocol Object Page") having merged. So routing to the
   vault page is the only option available today.

5. **The premise "the vault page renders all three" holds for our objects**, checked live on public
   devnet (`https://s.devnet.rippletest.net:51234/`):
   - `account_objects(rf7HcB1SpJRVy7Dc5goUkykFUqVChmGUcd, type=loan_broker)` returns exactly
     `055FDE07…BE9F` with `VaultID = 6B79B084…C13C`. That is what
     `src/containers/Vault/VaultLoans/index.tsx:57-77` fetches (from `vaultPseudoAccount`, filtered
     on `VaultID === vaultId`).
   - `account_objects(rGcATBBKFCavZJvkfmNbbvJJk5YRdRAudA, type=loan)` returns exactly
     `A7920C44…4165` with `LoanBrokerID = 055FDE07…BE9F`. That is what
     `VaultLoans/index.tsx:96-121` fetches (from `broker.Account`, filtered on `LoanBrokerID`).
   - Field names confirmed live: `LoanBroker.VaultID` exists, `Loan.LoanBrokerID` exists. The code
     reads the right fields.

**Conclusion: the PR is not based on a misunderstanding.** See "P4" below for the one place the PR
body overclaims about what the user actually sees when they land.

---

## (a) Does `getVault` → `getLedgerEntry` change behaviour for any input that previously resolved?

**No.** This is the cleanest part of the change.

Both functions issue a byte-identical request:

| | request |
|---|---|
| `getVault` (`rippled.ts:861-865`) | `{command:'ledger_entry', index: id, ledger_index:'validated'}` |
| `getLedgerEntry` (`rippled.ts:93-102`) | `{command:'ledger_entry', index: id, ledger_index: ledgerIndex ?? 'validated'}` |

Search passes no `ledgerIndex`, so `'validated'` both ways. Consequences:

- **A real Vault**: `getVault` returned `resp.node` after asserting the type; `resolveLedgerEntry`
  destructures `{ node }` off the full `resp` and switches on the same field. Same outcome, same
  route (`VAULT_ROUTE`, `id.toUpperCase()`), same array slot.
- **Every non-Vault entry**: `getVault` threw `Not a Vault`; `resolveLedgerEntry` throws
  `Unsupported ledger entry X` from the `default` case. Both are rejections, both are swallowed by
  `Promise.allSettled`. Identical fall-through.
- **Networks without the Lending amendment (mainnet, testnet)**: the request is unchanged, so
  behaviour there is bit-for-bit unchanged. Nothing to regress.

**Ordering / double-resolution.** `results.find(r => r.status === 'fulfilled')` takes array order,
and slot 1 is still the ledger-entry slot — the same slot `getVault` held. So the tie-break
priority (transaction > ledger object > ledger hash > NFT) is preserved exactly. A 256-bit value
cannot be simultaneously a tx hash, a ledger object index, a ledger hash and an NFTokenID except
by collision, and the pre-existing comment at `Search.tsx:82` already covers that.

Two divergences exist between the two functions but neither is reachable from Search:

- `getVault` handled `resp.error === 'entryNotFound'`; `getLedgerEntry` tests
  `resp.error_message === 'entryNotFound'` instead. Both then fall into the generic
  `if (resp.error_message) throw` at `rippled.ts:152`, so either way the promise rejects. If
  rippled ever returned `error` with no `error_message`, `getLedgerEntry` would return a response
  with `node === undefined` — which lands in `default:` and throws anyway. Rejection either way.
- `getVault` had a `not hex string` → 400 branch. `getLedgerEntry` does not. Unreachable:
  `HASH256_REGEX.test(id)` gates the whole block (`Search.tsx:109`).

---

## (b) Every other ledger entry type a 256-bit index can name

Important framing for the PR body: **this is not a new behaviour.** On `main`, every one of these
already fell through to `hash_not_found`, because `getVault` rejected everything that was not a
Vault. The PR changes nothing here. It does, however, *choose* not to close gaps it is now one line
away from closing, and one of those choices is actively awkward.

| LedgerEntryType | explorer page exists? | fall-through correct? |
|---|---|---|
| `Offer`, `RippleState`, `Escrow`, `PayChannel`, `Check`, `DID`, `Credential`, `PermissionedDomain`, `DepositPreauth`, `Ticket`, `Delegate`, `Oracle`, `DirectoryNode`, `SignerList`, `NFTokenPage`, `Bridge`, `XChainOwnedClaimID` | no | **yes** — nowhere to send them |
| `MPTokenIssuance` | **yes**, `MPT_ROUTE` (`/mpt/:id`, routes.ts:76) | **no — see P3** |
| `AMM` | **yes**, `AMM_POOL_ROUTE` (`/amm/:id/:tab?`, routes.ts:96), keyed by the AMM account address, which is `node.Account` | debatable; closable in one case |
| `AccountRoot` — including the **vault pseudo-account** and the **loan-broker pseudo-account** | **yes**, `ACCOUNT_ROUTE`, but only reachable by r-address, not by entry index | debatable; ripple/explorer#1146 already plans to redirect this |
| `NFTokenOffer` | partially — offers are listed on `/nft/:id`; the node carries `NFTokenID` | debatable |
| `Vault`, `LoanBroker`, `Loan` | yes, via `/vault/:id` | handled by this PR |

Verified live that the gap is trivially closable for MPT: `ledger_entry` on our own issuance
returns a node that **already contains** `mpt_issuance_id`:

```
index:            87AF0B464DD75063D212C9633832A99B74FBC08CB9260B0966A862B93B014BB1
mpt_issuance_id:  005030892D3FABDAF2FBE7B6F2A3E0DBB6A69B504018B2C0
```

so `case 'MPTokenIssuance': return { type: 'mpt', id: node.mpt_issuance_id }` is a two-line case.

---

## (c) Latency and failure modes of the extra `getLoanBroker` call

**Latency: small, and only on the Loan path.** Measured against public devnet from this machine:
cold (fresh TLS) round trip ≈ 690-765 ms; warm, connection reused, ≈ 161 ms. The explorer holds a
persistent websocket (`ExplorerXrplClient`), so the realistic marginal cost is one warm round trip,
~160 ms.

It does **not** slow down anything else. `determineHashType` awaits `Promise.allSettled`, so the
total is the max of the four lookups — but the second hop only runs when the first hop already
returned `LedgerEntryType: 'Loan'`, i.e. only when the Loan *is* the answer. A transaction hash, a
ledger hash, an NFT id or an unknown hash never triggers it: the ledger-entry lookup rejects or
hits `default` on the first response.

**New failure modes introduced:**

1. If the broker read fails — broker deleted between the two `'validated'` reads, RPC hiccup,
   `getLoanBroker`'s own `LedgerEntryType !== 'LoanBroker'` guard (`rippled.ts:919-921`) firing —
   the whole Loan resolution rejects and the user gets `hash_not_found` for a Loan that demonstrably
   exists. Slightly worse than an honest error, but there is nowhere better to send them today.
2. **The crash path — see P1.** This is the one that matters.

**Simplification a reviewer will likely ask for.** The second hop re-implements what the switch
already does. Recursing removes the `getLoanBroker` import entirely and inherits the type guard:

```ts
case 'Loan': {
  const { vaultId } = await resolveLedgerEntry(node.LoanBrokerID, rippledContext)
  return { type: 'loan', vaultId }
}
```

---

## (d) Error handling

**Nothing downstream reads the message.** `Promise.allSettled` discards `reason` and
`determineHashType` only inspects `status === 'fulfilled'` (`Search.tsx:84-87`). No `catch`, no
`trackException`, no string matching anywhere in the chain. Grep confirms `getVault` /
`getLedgerEntry` / `getLoanBroker` have no other caller in Search's path; the only other consumers
are `src/containers/shared/components/Transaction/utils/vaultUtils.ts:12,31`, which this PR does
not touch, so `getVault`'s `Not a Vault` guard (#1320) stays live and exported.

Two cosmetic asymmetries worth knowing about, neither functional today:

- `rippled.ts` throws the repo's custom `Error(message, code)` imported from `./utils`
  (`rippled.ts:6`). `resolveLedgerEntry` throws the **global** `Error` with no code. If anyone later
  wires rejection reasons into analytics, our reason is the odd one out.
- `` `Unsupported ledger entry ${node?.LedgerEntryType}` `` renders as
  `Unsupported ledger entry undefined` when `node` is absent. Never surfaced to a user, but it will
  be the string in a future debug session.

---

## (e) Full test suite, lint, prettier, tsc, build

Everything run on the branch in `/tmp/explorer`, node v22.20.0.

| check | command | result |
|---|---|---|
| full jest | `npx jest --ci --env=jsdom --runInBand` | **291 suites: 289 pass, 2 fail. 1699 tests: 1659 pass, 40 fail.** |
| same 2 suites on `main` | checkout main, same command | **2 failed, 40 failed tests — identical.** Pre-existing. |
| eslint | `npx eslint --ext=js,jsx,ts,tsx --max-warnings 0 .` | clean |
| stylelint | `npm run lint:css` | clean |
| prettier | `npm run format:check` | clean |
| full CI lint job | `npm run lint:ci` | clean |
| tsc | `npx tsc --noEmit` and `npm run build-ts` | clean |
| vite build | `npm run build` | clean (only the pre-existing >500 kB chunk warning) |
| Search suite alone | `npx jest src/containers/Header/test/Search.test.js` | 4 passed |

**The two failures are environmental and pre-existing, not caused by this PR:**
- `src/containers/shared/test/amendmentUtils.test.ts` — `AxiosError: Network Error` at
  `amendmentUtils.ts:30`, requesting `${process.env.VITE_DATA_URL}/amendments/info`. `/tmp/explorer`
  has no `.env` (only `.env.example`), so the URL is literally `undefined/amendments/info`. CI sets
  `VITE_DATA_URL: https://data.xrpl.org/v1/network` (`.github/workflows/nodejs.yml`).
- `src/containers/Ledgers/test/LedgersPage.test.js` — `TypeError: Cannot read properties of null
  (reading 'textContent')`, same root cause class.

Both fail identically on `main`. Nothing to report to the maintainer here.

Note: `jest.config.js` sets `coverageThreshold` global 70/80/80/80 and CI runs `test:ci` with
`--coverage`. The new code is exercised by the new assertions, so this is not a risk — but the
`getLoanBroker`-rejects branch and the `vaultId`-missing branch are uncovered.

---

## (f) en-US-only translation change

**Acceptable, and consistent with how this repo already behaves.** Evidence:

- `src/i18n/index.ts` (or equivalent) sets `fallbackLng: 'en-US'` and `returnNull: false`.
- All six other locales already carry `"hash_not_found": null` — `ca-CA:76`, `es-ES:77`, `fr-FR:77`,
  `ja-JP:77`, `ko-KR:77`, `my-MM:77`. With `fallbackLng` + `returnNull:false`, they render the
  en-US string. So the updated `hash_not_found` reaches every locale immediately.
- The precedent is unambiguous: when vault search landed, `en-US` became
  `"… Txn, VaultID or LedgerHash"` while `fr-FR` stayed `"Rechercher par adresse, registre ou
  transaction"` and `ko-KR` stayed `"주소, 원장 또는 트랜잭션으로 검색"` — neither ever mentioned
  Vault. The repo lets locale placeholders drift and has done so through at least one prior
  feature.
- The PR template has a "Translation Updates" checkbox, but `CONTRIBUTING.md` states no
  all-locales requirement — its "Requirements for a Successful Pull Request" are only: tests and
  linter pass locally, drafts marked as drafts, code of conduct.

One honest caveat to have an answer ready for: `header.search.placeholder` is a **non-null** stale
string in the other six locales, so it does **not** fall back. A French user still sees a
placeholder naming neither Vault nor Loan. That is pre-existing and was already true before this
PR, but a maintainer may reasonably ask us to null the six stale placeholders so they fall back to
the accurate English one. Cheap to do, worth pre-empting.

---

## The list a maintainer could legitimately reject on

### P1 — BLOCKER. New uncaught `TypeError` escapes `getRoute`, silently killing the search box.

`src/containers/Header/Search.tsx:126`:
```ts
path = buildPath(VAULT_ROUTE, { id: match!.vaultId!.toUpperCase() })
```

`HashMatch.vaultId` is `string | undefined` (`Search.tsx:43-46`), and the two `!`s assert away a
guarantee the type system does not have. Before this PR `getRoute` was effectively total —
`determineHashType` used `allSettled` and never threw, and the one other throw-capable call
(`classicAddressToXAddress`) is inside a `try/catch` at `Search.tsx:189-203`. Now it can throw.

`handleSearch` (`Search.tsx:220-228`) does `const route = await getRoute(...)` with **no
try/catch**, from a `keydown` handler. An async rejection in an event handler is not caught by any
React error boundary. Production result: the user presses Enter and **nothing happens at all** —
no navigation, no `hash_not_found` page, no `track('search', …)` event, and `callback()` (which
closes the mobile search overlay) never fires. Worse than a not-found.

**Proved by mutation.** On a scratchpad copy, changing `vaultId: node.VaultID` to
`vaultId: node.WrongField`:
```
TypeError: Cannot read properties of undefined (reading 'toUpperCase')
    at getRoute (src/containers/Header/Search.tsx:126:59)
    at handleSearch (src/containers/Header/Search.tsx:221:19)
```

Reachability is low — `VaultID` is required on `LoanBroker` in XLS-66, confirmed present on our
live devnet object — but "a malformed or future ledger object bricks the search box" is exactly the
class of thing a reviewer refuses to sign off on, and the fix is free.

**Fix.** Make `HashMatch` a discriminated union so both `!`s become impossible, and guard at the
source:

```ts
type HashMatch =
  | { type: 'transactions' | 'vault' | 'ledgers' | 'nft' }
  | { type: 'loanBroker' | 'loan'; vaultId: string }
```
with, in `resolveLedgerEntry`, `if (!node.VaultID) throw new Error('LoanBroker has no VaultID')`
before returning, and likewise for `broker.VaultID`; then in `getRoute`:
```ts
} else if (match?.type === 'loanBroker' || match?.type === 'loan') {
  path = buildPath(VAULT_ROUTE, { id: match.vaultId.toUpperCase() })
```
Optionally also wrap the `getRoute` call in `handleSearch` in try/catch so no future throw can ever
brick the box. That is a separate hardening the maintainer may or may not want in this PR.

### P2 — SERIOUS. The Loan test passes with a completely wrong broker id.

`src/containers/Header/test/Search.test.js:198-201` sets
`mockGetLoanBroker.mockResolvedValue({ VaultID: vaultID })` and never asserts the call arguments.
The mock answers any input.

**Proved by mutation.** Replacing `getLoanBroker(rippledContext, node.LoanBrokerID)` with
`getLoanBroker(rippledContext, 'TOTALLY_WRONG_ID')` in the scratchpad copy:
`Tests: 4 passed, 4 total`. The only genuinely new hop this PR introduces — Loan → its broker — is
not tested in substance. A misspelled field (`node.LoanBrokerId`) would ship green.

**Fix.** Add
`expect(mockGetLoanBroker).toHaveBeenCalledWith(expect.anything(), loanBrokerID)` after the loan
assertion, or make the mock argument-sensitive
(`mockImplementation((_, id) => id === loanBrokerID ? Promise.resolve({VaultID: vaultID}) : Promise.reject())`).

Related, weaker: at the loan-broker and loan assertions, `mockGetNFTInfo` is still resolving
`{nft_id: nftoken}` left over from line ~162, so slots 1 and 3 both fulfil and the assertions pass
only because `find` takes array order. It is not wrong, but it is accidental. A reviewer who notices
will ask for a `mockGetNFTInfo.mockRejectedValue` before the new block.

### P3 — SERIOUS. The test cements the MPT gap the PR is one case away from closing.

`Search.test.js:206-212` picks `MPTokenIssuance` as the example of "an object the search does not
route to" and asserts it lands on `/search/:id`. Of every unhandled type, `MPTokenIssuance` is the
**one that already has a page** (`MPT_ROUTE`, `/mpt/:id`, `routes.ts:76`) and whose `ledger_entry`
node already carries `mpt_issuance_id` (verified live, above). The PR body sells the design as "the
next ledger object type is a case rather than another round trip" — and then writes a test whose
job is to guarantee the most obvious next case never happens.

A reviewer reading that test will ask either "then add the case" or "pick a type with no page, like
`Ticket` or `DepositPreauth`". Right now the PR argues against itself.

**Fix.** Either add
```ts
case 'MPTokenIssuance':
  return { type: 'mpt', id: node.mpt_issuance_id }
```
(plus an `mpt` branch in `getRoute`; this also means `HashMatch` needs a generic `id`, not a
`vaultId`-shaped field — worth restructuring alongside P1), or change the fall-through test to a
type with genuinely no page. Do not leave `MPTokenIssuance` as the negative example.

### P4 — SERIOUS (accuracy of the claim, not of the code). "Lands on the vault page that already renders them" is only true for a single-broker vault.

`src/containers/Vault/VaultLoans/index.tsx:50` initialises `selectedBrokerIndex` to `0`, and
`index.tsx:163-166` sorts brokers by loan count descending before selecting. Brokers are rendered as
tabs (`BrokerTabs.tsx`), and a broker's loans only appear inside its own tab
(`BrokerDetails.tsx`).

So on a vault with more than one broker, searching broker #2's id navigates to `/vault/:id` with
**broker #1's tab open** — the object you searched for is not on screen, with no indication of which
tab to click. Same for a Loan. `VAULT_ROUTE` (`routes.ts:82`) takes only `{ id }`, so there is no
tab or anchor parameter to target.

Our own devnet vault has exactly one broker, which is why this never showed up in testing. The PR
body's line "both land on the vault page that already renders them" is an overclaim for the general
case.

**Fix.** Cheapest: disclose it in the PR body and offer a follow-up ("a `?broker=` param or a
`#loan-<id>` anchor on `VAULT_ROUTE` would scroll to and select the searched object; happy to do it
here or as a follow-up"). Proposing it before a maintainer finds it turns a weakness into evidence
we read the vault page.

### P5 — MINOR. Upstream already has a draft doing this generically: ripple/explorer#1146.

`feat: Add basic ledger entry page` (draft, open since 2025-03-31, last touched 2026-05-21,
+829/-69 across 27 files) adds an `ENTRY_ROUTE` `/entry/:id` and **modifies the same two files we
do** — `src/containers/Header/Search.tsx` and `src/rippled/lib/rippled.ts`. Its Search patch:

```diff
-    return 'nft'
+    try {
+      await getLedgerEntry(rippledContext, id)
+      return 'entry'
+    } catch (e2) {
+      return 'nft'
+    }
```

That patch is badly stale — it predates the `Promise.allSettled` refactor and calls
`getLedgerEntry(ctx, id)` positionally, which no longer matches the signature — so it is unlikely
to land as-is. But a maintainer can legitimately say "we already plan to route every ledger index
to a generic entry page; your three special cases duplicate that and will conflict."

**Fix.** Pre-empt it in the PR body: the two are complementary, and the right end state is that
`Vault` / `LoanBroker` / `Loan` keep the richer vault page while everything else goes to `/entry`.
The `switch` in this PR is exactly the shape that makes that split trivial. Say so before they do.

### P6 — MINOR. `'loanBroker'` is the only camelCase analytics category.

`Search.tsx:222-225` sends `search_category: route?.type` to `track('search', …)`. Every existing
value is lowercase or snake: `transactions`, `ledgers`, `accounts`, `nft`, `vault`, `mpt`, `token`,
`validators`, `hash_not_found`. `'loanBroker'` breaks that. Whoever owns the analytics dashboards
will notice. `'loan_broker'` costs nothing.

### P7 — MINOR. `interface HashMatch { type: string }` is untyped where a union is free.

`Search.tsx:43-46`. `type: string` gives up all narrowing, which is precisely what forces the two
`!` assertions in P1. Fixing P1 with a discriminated union fixes this at the same time. Also note
`match!.vaultId!` is the only double non-null assertion in production source in this repo — of 13
occurrences of `x!.` across `src`, nine are in test files, and the production ones
(`NFTHeader.tsx:132`, `TablePicker/index.tsx:147-148`) cannot crash a top-level handler.

### P8 — MINOR. The Loan hop duplicates the switch instead of recursing.

`Search.tsx:62-64` calls `getLoanBroker`, which re-issues the same `ledger_entry` request the
function already knows how to make and re-checks the type guard the switch already performs.
Recursing (see (c) above) drops the `getLoanBroker` import and three lines.

### P9 — COSMETIC. Global `Error` vs the repo's custom `Error`; `undefined` in the message.

`Search.tsx:66`. `rippled.ts` imports `Error` from `./utils` (a two-arg `Error(message, code)`);
`resolveLedgerEntry` throws the global one. Harmless today because `allSettled` eats it. And
`` `Unsupported ledger entry ${node?.LedgerEntryType}` `` prints `… undefined` when `node` is
absent.

---

## What I could not verify

- I did not drive the deployed `devnet.xrpl.org` SPA in a browser. The "reproduced live" claim in
  the PR body rests on the developer's own earlier session. What I verified independently is
  stronger in kind but different in form: the deployed locale bundle is pre-PR, and `main`'s code
  cannot resolve these ids. I would not change the PR body's wording, but be aware the live click
  is not something I re-ran.
- I did not test against the custom hackathon devnet
  (`https://lending-hackathon.dev.ripplex.io:51234`); all live checks are on public devnet, which is
  where the PR's cited objects live.
- The clone is depth-1, so "how previous PRs handled the other six locales" was answered from the
  current state of the seven locale files plus `gh pr list`, not from per-commit history.
- Coverage numbers: I ran jest without `--coverage` (CI runs with it). Given 289/291 suites pass and
  the failures are environmental, threshold risk is nil, but I did not produce the number.

## Reproduction commands

```
cd /tmp/explorer
npx jest --ci --env=jsdom --runInBand                 # 289/291 suites; 2 env failures, also on main
npm run lint:ci                                        # clean
npx tsc --noEmit && npm run build-ts && npm run build  # clean
curl https://devnet.xrpl.org/locales/en-US/translations.json | jq -r '.hash_not_found'
curl -s -X POST https://s.devnet.rippletest.net:51234/ -H 'Content-Type: application/json' \
  -d '{"method":"account_objects","params":[{"account":"rf7HcB1SpJRVy7Dc5goUkykFUqVChmGUcd","type":"loan_broker","ledger_index":"validated"}]}'
```
