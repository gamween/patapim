# pr-refute — an attempt to kill ripple/explorer#1342

Assignment: assume we misunderstood, prove the gap does not exist, and close the PR.
Result: **the attempt failed. The gap is real, reproduced live on two deployments with
third-party objects, and the fix works.** Four things are nevertheless wrong, one of them
in our own repository, and one of them is a piece of prior art we missed that a maintainer
will raise in the first sentence of their review.

Everything below was checked on 12 September 2026. No file in
`/Users/fianso/Development/hackathons/patapim` or `/tmp/explorer` was modified
(`git status --porcelain` in `/tmp/explorer` is empty); this notes file is the one exception.

---

## (a) Does the gap exist? Reproduced, live, twice, with objects that are not ours

I drove the real search box (not the `/search/:id` URL) with a native-setter `input` event plus a
bubbling `Enter` keydown, and read `location.pathname` after settle.

**devnet.xrpl.org** (deployed build is `main`: its placeholder still reads
`Search by Token, Address, Ledger, Txn, VaultID or LedgerHash`):

| pasted | landed on |
|---|---|
| `F230A0F8…9E5DA8` — a **third party's** Vault | `/vault/F230A0F8…9E5DA8` ✅ |
| `6B79B084…D6D2C13C` — our Vault | `/vault/6B79B084…D6D2C13C` ✅ |
| `0000018A4E54F377D5B1FFD573CB3000A8F135FA068A16BA68BC998349FBEF72` — a **third party's** LoanBroker | `/search/0000018A…` ❌ not found |
| `055FDE07…D0BE9F` — our LoanBroker | `/search/055FDE07…` ❌ |
| `A7920C44…F54165` — our Loan | `/search/A7920C44…` ❌ |

**custom.xrpl.org against the official hackathon devnet**
(`lending-hackathon.dev.ripplex.io:51233`, network_id 4001, rippled 3.4.0-rc1), with a broker
belonging to another team:

| pasted | landed on |
|---|---|
| `AFD50F1462951A75264DF6F352FD1282D7ED799D70E4292790630C851AAC9151` — Vault | `/…:51233/vault/AFD50F14…` ✅ |
| `00F69C343C95C27790E41432BDED4B4535E5A37EDE1665EEEA74BAE3BF59F346` — LoanBroker on that vault | `/…:51233/search/00F69C34…` ❌ |

RPC confirms all four lookups `determineHashType` performs genuinely fail for a broker index on
public devnet (`s.devnet.rippletest.net:51234`, 3.4.0-rc5, network_id 2):
`tx` → `txnNotFound`; `ledger{ledger_hash}` → `lgrNotFound`; `nft_info` → `unknownCmd`;
and `ledger_entry` succeeds but `getVault` rejects it, `src/rippled/lib/rippled.ts:888-890`
(`if (resp.node?.LedgerEntryType !== 'Vault') throw new Error('Not a Vault', 404)`).

The destination claim holds too. The vault page at
`devnet.xrpl.org/vault/6B79B084…D6D2C13C` renders, in its own text,
`LOAN BROKER ID 055FDE074EC86E62F94F32D296898DA8A9D2586262AD1B912CA6066377D0BE9F` and
`LOAN ID A7920C4…54165` (truncated, `VaultLoans/LoanRow.tsx:163` `truncateId(loan.index)`).

The devnet-wide scale: 195 LoanBroker objects across 195 distinct vaults on public devnet as of
today. This is not a one-team edge case.

**The fix works.** I ran the PR branch locally (`vite serve`, `VITE_ENVIRONMENT=devnet`,
`VITE_RIPPLED_HOST=s.devnet.rippletest.net`) against real devnet and searched the same strings:

| pasted | landed on |
|---|---|
| our LoanBroker `055FDE07…` | `/vault/6B79B084…D6D2C13C` ✅ |
| our Loan `A7920C44…` | `/vault/6B79B084…D6D2C13C` ✅ |
| third party's LoanBroker `0000018A…` | `/vault/F230A0F8…9E5DA8` ✅ |
| PermissionedDomain `EF98FDBA404CBEB4F746DA1026B859E260BBB459D111268F6A26BBC7C4811A04` (the object from PR #1320) | `/search/EF98FDBA…` ✅ still not found |
| `FFFF…FFFF` | `/search/FFFF…` ✅ |
| tx `CD270519…DAB5591` | `/transactions/CD270519…` ✅ |
| ledger hash `BD009997…D7FB4F` | `/ledgers/BD009997…` ✅ |

`npx jest src/containers/Header/test/Search.test.js` → 4 passed.
`npm run lint:ci` (eslint `--max-warnings 0` + stylelint + `prettier --check`, repo-wide) → exit 0.
`npx tsc --build` → exit 0.
Full suite: 289/291 suites pass; the 2 failures are `Ledgers/test/LedgersPage.test.js` and
`shared/test/amendmentUtils.test.ts`, neither of which imports `Search.tsx`; amendmentUtils fails on
a live axios call to `VITE_DATA_URL`, i.e. environmental. I did **not** run these against `main` to
prove they are pre-existing — worktree creation would have modified the clone.

## (b) Did Ripple leave it out deliberately? One strong signal, and it cuts our way

**ripple/explorer#1320, `fix: Reject non-Vault ledger entries in getVault`, ckeshava, merged
2026-05-04.** Its stated bug: *"user specifies the hash of a `PermissionedDomain` object however
they are redirected to a `Vault` page incorrectly"*. That is a maintainer, four months ago,
explicitly deciding that a non-Vault ledger entry must **not** land on a vault page. Before #1320,
a LoanBroker id resolved to `/vault/<the broker's own id>` — a broken page. #1320 turned that into
not-found. Our PR is the third state: resolve it to the vault that actually renders it.

I verified the PR preserves #1320 exactly: the PermissionedDomain index from that PR still lands on
`/search/…` on our branch (table above). No maintainer comment on #1320, #1259 or #1281 mentions
loan brokers or loans in search. Nothing in XLS-0066 (`XRPLF/XRPL-Standards`, `VaultID` required on
`LoanBroker` line 155, `LoanBrokerID` required on `Loan` line 423) says loan objects should not be
first-class in an explorer. Issue #916 *Rewrite search system* (open since 2024-01-10) states the
intended design as *"on failure of all display a message saying what types of items were searched
for"* — which is the same principle as our `hash_not_found` copy change.

Conclusion: not deliberate omission. But **the PR body never mentions #1320**, and that is the one
objection a reviewer will reach for.

## (c) Prior art we missed — this is the real problem

**ripple/explorer#1146, `feat: Add basic ledger entry page`, mvadari, OPEN, DRAFT, base `staging`,
created 2025-03-31, last updated 2026-05-21, branch `entry-page`.**

It adds a generic `/entry/:id/:tab?` route (`routes.ts:55` on that branch) and an `Entry` container,
and rewires `determineHashType` so that **any** resolvable `ledger_entry` routes to `/entry/<id>`:

```ts
try { await getTransaction(...); return 'transactions' }
catch { try { await getLedgerEntry(rippledContext, id); return 'entry' } catch { return 'nft' } }
```

Approved by two reviewers, reviewed by ckeshava, still a draft, ~4 months stale, and predates both
the Vault page (#1281, merged 2026-03-11) and #1320.

This is the maintainers' own long-term answer to the exact class of problem our PR solves. It does
not make our PR wrong — #1146 is stale, in draft, on a branch that is no longer the default
(`main` became default in #1288), and a generic field dump is a worse destination for a broker than
the vault page that already renders its first-loss capital, debt ceiling and loan table. But if the
PR body does not name #1146, the review reads as "we already have a PR for this".

Nothing else exists: 53 branches on `ripple/explorer`, none named for loans; `routes.ts` on `main`
has `VAULT_ROUTE` and `VAULTS_ROUTE` and no loan or broker route; `gh issue list --state all` shows
no issue about loan search; #1340, #1341, #1339, #1328, #1335, #1332, #1329, #1302, #1318 (the open
PRs) touch MPT search, vault flags, vault scaling, sponsored fees, dynamic MPT, NFT flags, MPT-DEX
and fee voting — none touches `determineHashType`. No merge conflict: `mergeable: MERGEABLE`.

## (d) Can the resolution be wrong in principle? No, but the destination is under-specified

**Collision.** No new surface. The PR replaces one `ledger_entry` call with one `ledger_entry` call;
it does not widen the set of ids sent to any other lookup. Ledger entry indices, transaction hashes
and ledger hashes are SHA-512Half over disjoint namespace prefixes; NFT ids are structured, not
hashes. The pre-existing comment in `Search.tsx` already covers this. Refutation fails.

**Dangling parent.** `LoanBroker.VaultID` is required (XLS-66 §, `Yes/Yes`), and a `LoanBroker` is
added to the vault pseudo-account's owner directory (`LoanBrokerSet`, "Add `LoanBrokerID` to the
`OwnerDirectory` of the Vault's _pseudo-account_"), so a vault cannot be deleted out from under a
broker. `Loan.LoanBrokerID` is likewise required. If the broker is gone, `getLoanBroker` rejects and
the search falls through to not-found, i.e. today's behaviour. Refutation fails.

**Destination.** This one lands. `VAULT_ROUTE` is `/vault/:id` with no tab or anchor
(`src/containers/App/routes.ts:82`). The vault page picks its broker with local state,
`VaultLoans/index.tsx:52` `useState(0)`, after sorting brokers by loan count descending
(`index.tsx:160`). Loans are paginated ten per page (`BrokerLoansTable.tsx:9`) and the loan id is
rendered truncated. So for a vault with more than one broker, searching broker #2 silently shows
broker #1's panel, and searching a loan on page 3 shows page 1. Today no vault on devnet has more
than one broker (195 brokers, 195 vaults — I scanned `ledger_data type=loan_broker` to exhaustion),
so the defect is latent, not live. It is still the thing a maintainer will name.

## Problems to fix

1. **`docs/CONTRIBUTION-explorer-search.md` describes a PR we did not ship.** Line 91:
   *"Route both to the existing vault page, **deep linking the broker tab** so the object the user
   pasted is the one in view."* The shipped PR does no such thing — there is no tab parameter and no
   anchor. Line 89 also says *"Add two lookups to `determineHashType`"*, where the shipped change
   removes one and switches on `LedgerEntryType`. That file is an earlier design note wearing the
   PR's name. It is linked from nothing else, but it is in a public repo a judge can read.
2. **The PR body does not mention #1320 or #1146.** Both are one sentence each and both turn a
   likely objection into evidence of homework.
3. **The "Reproduced on Devnet" links are the destination, not the reproduction.**
   `/search/:id` is a static page — `SearchResult/index.tsx` is literally
   `const SearchResult = () => <NoMatch title="hash_not_found" />`. It shows "not found" for a valid
   vault id too. (In fairness ckeshava used the same shorthand on #1320.) Phrase it as the action.
4. **The PR body does not follow `.github/pull_request_template.md`**, which CONTRIBUTING.md
   requires ("Fill in the PR template"). No *High Level Overview of Change*, no *Type of Change*
   checkboxes.
5. **Open issue #1291** asks for `header.search.placeholder` to be re-translated after #1281 changed
   it. We change it again. One comment on #1291 costs nothing.
6. Minor code nits a reviewer may raise: `HashMatch.type` is `string` rather than a union, and the
   routing uses `match!.vaultId!` — a discriminated union removes both assertions.
7. CI has not run: both `Explorer CI` and `Copilot Setup Steps` sit at `action_required` on
   `8c361b5` (normal first-time-contributor gate). Our local `lint:ci`, `tsc --build` and the Search
   suite all pass, which is worth one line in the PR.

## Verdict

Worth a maintainer's time. Do not close it. Add #1320 and #1146 to the body, state the
single-broker-tab limitation honestly, fill the template, and fix the stale line in
`docs/CONTRIBUTION-explorer-search.md`.
