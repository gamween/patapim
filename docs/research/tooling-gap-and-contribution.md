# Tooling gap & contribution — XLS-65/66 (slug: tooling-gap-and-contribution)

Date: 2026-09-12. Team patapim. All claims carry a source (URL, path:line, commit, tx/ledger id).

---

## 0. Headline recommendation

**Ship one PR to `ripple/explorer`: make `LoanBroker` and `Loan` ledger-entry IDs resolvable
from the explorer search box / URL, routing them to the existing Vault page.**

Why this one:
- It is the *only* gap found where the destination UI **already exists and is already deployed**,
  but is **unreachable by ID**. The fix is plumbing, not new UI. Hours, not days.
- The repo is Ripple-owned and the judge is Ripple DevRel. Maximum "contributing back" bonus.
- It reproduces live, on **the organizers' own hackathon devnet**, with our own on-chain objects.
- It matches the 40% rubric line literally: *"cite the exact spot, propose the fix."*

---

## 1. Explorer: does anything render Vault / LoanBroker / Loan ledger entries?

### 1.1 Answer: YES for Vault (by URL), YES for LoanBroker+Loan (nested), NO by ID for either.

`ripple/explorer` @ `023238105f33127bfbb1ed4d44b77f04d23b468a` (2026-08-17, "Use ripple-binary-codec@2.9.0 (#1338)").
Note `XRPLF/explorer` **404s**; the repo is `ripple/explorer`.

Routes (`src/containers/App/routes.ts`):
- `VAULT_ROUTE = '/vault/:id'`  — exists
- `VAULTS_ROUTE = '/vaults'`    — exists but **feature-flagged off**
- **No** `/loanbroker/:id`, **no** `/loan/:id`.

`src/containers/App/featureFlags.ts:1`:
```ts
export const FEATURE_VAULTS_PAGE = false
```
Used at `src/containers/App/index.tsx:99` (`FEATURE_VAULTS_PAGE && [VAULTS_ROUTE, Vaults]`) and
`src/containers/App/navigation.ts:41`. So the vault **index/listing** page and its nav entry are
disabled; the vault **detail** page `/vault/:id` is NOT gated and ships.

Transaction rendering is complete — all 15 lending tx types have components
(`src/containers/shared/components/Transaction/`, registered at `index.ts:61-75,144-158`):
VaultCreate, VaultSet, VaultDeposit, VaultWithdraw, VaultClawback, VaultDelete,
LoanBrokerSet, LoanBrokerDelete, LoanBrokerCoverDeposit, LoanBrokerCoverWithdraw,
LoanBrokerCoverClawback, LoanSet, LoanDelete, LoanManage, LoanPay.

### 1.2 Live proof it renders (hackathon devnet)

`https://custom.xrpl.org/lending-hackathon.dev.ripplex.io:51233/vault/BC5C3DC048877619445A981AC2598074EC8B96BC9F803AEFDDADCE9ADF734614`
renders our vault: title "Single Asset Vault", DATA `patapim open`, TVL 49.00M XRP,
AVAILABLE TO BORROW 44.00M, WITHDRAWAL POLICY "First Come First Served",
SHARES `00000001072FDFF4D064B66BF883A9F3FBB6408 0D99DCFF3`.

Scrolling down, a **Loans** section renders the LoanBroker in full —
LOAN BROKER ID `E9943031B5B279524FDFA8BCF6D11A163525C5195F24A212EEE61F48E9FEDD7B`,
TOTAL DEBT 5.00M, MAXIMUM DEBT 40.00M, MANAGEMENT FEE 0.10%, FIRST-LOSS CAPITAL 5.00M,
COVER RATE MINIMUM 1.00%, COVER RATE LIQUIDATION 1.00% — and a loans table row
LOAN ID `0A4EF44...68B61`, BORROWER `r34bLsP...YLAK`, AMOUNT REQUESTED 10.0M,
INTEREST RATE 5.00%, OUTSTANDING 5.0M, STATUS "Current".

So the explorer **does** render all three entry types. Components:
`src/containers/Vault/VaultLoans/{index,BrokerTabs,BrokerDetails,BrokerLoansTable,LoanRow}.tsx`.

Same bundle ships on the public devnet explorer: `https://devnet.xrpl.org/assets/index-BIEe6eAG.js`
contains `"/vault/:id"`. Vault `33EAD34802AF01B75EFA6308E9F1B6388BCA8609E2AE6D7F38D264B25CA5DB6B`
exists on public devnet (`ledger_entry` → `LedgerEntryType: "Vault"`, Owner `rPfDvNcjqF9BmUnQETCVNqnvXo7YEmZfpQ`).

### 1.3 THE GAP — the bug to fix

`src/containers/Header/Search.tsx:42-61`:
```ts
const determineHashType = async (id, rippledContext) => {
  const lookups: Promise<string>[] = [
    getTransaction(rippledContext, id).then(() => 'transactions'),
    getVault(rippledContext, id).then(() => 'vault'),
    getLedger(rippledContext, { ledger_hash: id.toUpperCase() }).then(() => 'ledgers'),
    getNFTInfo(rippledContext, id).then(() => 'nft'),
  ]
  ...
}
```
Only four types are probed. **LoanBroker and Loan are not.** A 64-hex LoanBroker/Loan ID
therefore falls through to `SEARCH_RESULT_ROUTE` → `src/containers/SearchResult/index.tsx`,
which is a two-line stub:
```ts
const SearchResult = () => <NoMatch title="hash_not_found" />
```
`public/locales/en-US/translations.json:77`:
```
"hash_not_found": "Could not find any Transactions, Vaults, Ledgers or NFTs that match the specified ID"
```
(The message enumerates exactly the four probed types — confirming the source reading.)

**Live reproduction, hackathon devnet, 2026-09-12:**
- `.../search/E9943031B5B279524FDFA8BCF6D11A163525C5195F24A212EEE61F48E9FEDD7B` (our LoanBroker)
  → "Could not find any Transactions, Vaults, Ledgers or NFTs that match the specified ID"
- `.../search/0A4EF448F6090CA08B532CAEE7BF58402408C59DB4170CFF84C3A5DD52D68B61` (our Loan)
  → same NOT FOUND page

…while both objects are rendered by the explorer **two clicks away** on the vault page,
and both resolve fine over RPC (`ledger_entry` → `LoanBroker` / `Loan`).

The search placeholder even advertises the limit:
`"Search by Token, Address, Ledger, Txn, VaultID or LedgerHash"`.

### 1.4 Why the fix is cheap — the pieces already exist

- `getLoanBroker(rippledSocket, loanBrokerId)` is **already implemented** at
  `src/rippled/lib/rippled.ts:895-923`, **already exported** (`export {` block at :924, entry `getLoanBroker`),
  **already unit-tested** (`src/rippled/lib/test/rippled.test.ts:107-146`),
  and **already consumed** by `src/containers/shared/components/Transaction/utils/vaultUtils.ts:1,31`.
  It is simply never called from `Search.tsx`.
- Generic `getLedgerEntry` exists and is already used by `LoanRow.tsx` to fetch Loan entries.
- The parent chain resolves in two RPC hops, verified on chain:
  `Loan 0A4EF448…D68B61` → `.LoanBrokerID` = `E9943031…E9FEDD7B`
  → `LoanBroker.VaultID` = `BC5C3DC0…DF734614` (exactly our vault).
- The Vault page already has broker tabs (`VaultLoans/index.tsx:52` `selectedBrokerIndex` state,
  `:167,:175`) and expandable loan rows — so a deep link has a real destination to land on.

### 1.5 Proposed PR (scope: ~40-80 lines + tests)

1. `src/rippled/lib/rippled.ts` — add `getLoan()` mirroring `getLoanBroker()` (:895), asserting
   `LedgerEntryType === 'Loan'`; add to the `export {` block at :924.
2. `src/containers/Header/Search.tsx:46-52` — add two lookups:
   ```ts
   getLoanBroker(rippledContext, id).then(() => 'loanbroker'),
   getLoan(rippledContext, id).then(() => 'loan'),
   ```
3. `src/containers/Header/Search.tsx:85-97` — resolve to the parent vault:
   `loanbroker` → read `.VaultID`, route `/vault/<VaultID>?broker=<id>`;
   `loan` → read `.LoanBrokerID` → `.VaultID`, route `/vault/<VaultID>?broker=<brokerId>&loan=<id>`.
4. `src/containers/Vault/VaultLoans/index.tsx:52` — seed `selectedBrokerIndex` from the `broker`
   query param; auto-expand the matching `LoanRow` from `loan`.
5. `public/locales/en-US/translations.json:77` — update `hash_not_found` to include Loan Brokers
   and Loans; update the search placeholder string.
6. Tests alongside the existing `rippled.test.ts` / `Search` tests.

Optional stretch (only if time): flip `FEATURE_VAULTS_PAGE` behind an env var rather than a
hardcoded `false`, so custom-network operators can enable the `/vaults` index.

### 1.6 Prior-art check — it does not already exist

`ripple/explorer` open PRs (2026-09-12): #1341, #1340, #1339, #1335, #1332, #1329, #1328, #1318,
#1302, #1198, #1146, #1134, #988, #987, #985, #898. None adds LoanBroker/Loan search resolution.
Issue/PR search for `loan in:title` → **zero results**.

Closest: **PR #1146 "feat: Add basic ledger entry page"** — but it is a **draft**, opened
2025-03-31, last touched 2026-05-21, 27 files / +829, i.e. predates the lending amendments and is
stale. It adds a *generic* field-dump entry page; it does not route lending IDs to the purpose-built
Vault UI. Our PR is smaller, targeted, and complementary.

---

## 2. Second, cheaper contribution: the official reference app ships a broken counterparty signer

`github.com/ripple/lending-demo` → **404**.
`github.com/ripple/xrpl-reference-app-lending-sav` → exists, "Reference App for the XLS-66 Lending
Protocol and XLS-65 Single Asset Vault amendments", @ `b92c9906c3892d90c9383eec1d8af4020046fc15`
(2026-07-16). Deployed at **lending.xls-demo.com** (RippleX Ecosystem Growth Team; targets Devnet;
Broker / Depositor / Borrower roles; email sign-in provisions four funded devnet wallets).

`package.json` pins `"xrpl": "^4.6.0"`; `package-lock.json` resolves **xrpl 4.6.0** and
**ripple-binary-codec 2.7.0**.

`src/lib/xrpl/loan.ts:90-109` signs LoanSet via `signLoanSetByCounterparty`, reached through a cast:
```ts
const fullySigned = (xrpl as unknown as {
  signLoanSetByCounterparty: (wallet: Wallet, blob: string) => { tx_blob: string };
}).signLoanSetByCounterparty(borrowerWallet, brokerSigned.tx_blob);
```

**This is the same bug we already reported for xrpl.js 5.2.0-beta.0, and it is present in 4.6.0.**
In xrpl 4.6.0, `dist/npm/Wallet/counterpartySigner.js` computes the counterparty signature with
`computeSignature(tx, wallet.privateKey)`, and `dist/npm/Wallet/utils.js:36-44`:
```js
function computeSignature(tx, privateKey, signAs) {
    if (signAs) { ... encodeForMultisigning ... }
    return sign(encodeForSigning(tx), privateKey);   // ordinary tx encoder
}
```
`encodeForSigningCounterparty` appears **nowhere** in xrpl 4.6.0.

Measured, decisive evidence (ripple-binary-codec, same LoanSet payload):
```
encodeForSigning            prefix = 53545800   ("STX\0")
encodeForSigningCounterparty prefix = 43505400   ("CPT\0")
identical? false
```
Different prefix ⇒ different signed bytes ⇒ the counterparty signature is invalid ⇒ rippled rejects.

Version bisect of `ripple-binary-codec` (fresh installs, checking exported symbols):
| version | counterparty encoders |
|---|---|
| 2.7.0 (reference app's lock) | ABSENT |
| 2.8.0 | ABSENT |
| 2.9.0 | ABSENT |
| 2.10.0 | ABSENT |
| **2.11.0** | `encodeForSigningCounterparty`, `encodeForMultisigningCounterparty` |

`xrpl@5.2.0` (npm `latest`, published 2026-09-11) depends on `ripple-binary-codec ^2.11.0` and
routes correctly — `dist/npm/Wallet/utils.js:43`:
```js
single: (tx) => encodeForSigningCounterparty(tx),
```

**Proposed fix (one line + lockfile):** bump `xrpl` to `^5.2.0` in
`ripple/xrpl-reference-app-lending-sav/package.json`. Caveat to state in the PR: stable 5.2.0 lacks
`VaultKind`, `SubscriptionDate`, `RedemptionDate`, `CredentialIDs` (our earlier finding), so the
app must keep passing those as raw fields.

Caveat on our own claim: verified by source reading + encoder-prefix measurement, **not** by running
the reference app end-to-end (it needs Auth0 + MongoDB). See open_questions.

---

## 3. The rest of the tooling map (checked, not chosen)

### 3.1 XRPL Docs MCP server — `mcp.xrpledger.ai` — NOT a gap
Streamable HTTP MCP, stateless (no `mcp-session-id` header returned). Requires
`MCP-Protocol-Version: 2025-11-25`; sending the older `2025-03-26` returns
`-32600 Unsupported protocol version`. `serverInfo`: `mcp-xrpledger-ai` v1.0.0.
Three tools: `XRPLDocsTarget___search_documentation`, `___read_documentation`, `___read_sections`.

It **does** know lending. Query "LoanSet counterparty signature XLS-66" returns
`xrpl-org/docs/references/protocol/transactions/types/loanset.md` @ score 0.864, including the
correct two-party signing flow. Query "VaultCreate single asset vault XLS-65" returns
`xrpl-standards/XLS-0065-single-asset-vault/README.md` @ 0.828. It indexes both xrpl.org docs and
the XLS specs. No contribution needed.
Minor: the returned loanset.md cites `rippled/blob/release/3.3.x/...` and
"(Open for Voting: 37.14%)", while both hackathon networks run 3.4.0-rc — docs lag the network.

### 3.2 `XRPL-Commons/xrpl-connect` — no lending awareness, but nothing to fix
Note the org is **`XRPL-Commons`**, not `XRPLCommons` (that 404s). Repo @
`a45d7216bb93472a57fcdb53bf957135916aa5c6` (2026-09-11), 23 stars, "framework-agnostic wallet
connection toolkit". Packages: core, ui, react, vue, xrpl-connect + adapters
(ledger, gemwallet, xaman, metamask-snap, xyra, walletconnect, crossmark, otsu).

Grep for `VaultCreate|LoanSet|VaultDeposit|LoanBroker` across the repo → **zero hits**.
But this is by design: there is **no `TransactionType` allow-list anywhere in `packages/core/src`**,
so transactions are passed through opaquely to the wallet. Lending txs are therefore *structurally*
supported; whether they sign depends entirely on the wallet adapter's own encoder.
Networks: `packages/core/src/types.ts:29,39,41-58` — `StandardNetworkId = 'mainnet'|'testnet'|'devnet'`
plus arbitrary custom ids, so the hackathon network is reachable.
Peer dep `xrpl: ^3.0.0 || ^4.0.0 || ^5.0.0` — permissive, so a consumer can supply 5.2.0.
**Verdict: not the gap.** Real risk is per-adapter (a wallet that doesn't know `CPT\0` cannot
counter-sign a LoanSet) — worth a sentence in the pitch, too big to fix by Sunday.

### 3.3 `XRPL-Commons/scaffold-xrp` — has a real bug, but low leverage
@ `9d25d7c8600b5a5138b236269817bda42fc1e3e2` (2026-07-28). Next.js stack with multi-wallet connector.
`apps/web/components/VaultInteraction.js` (and the Nuxt twin `apps/web-nuxt/components/VaultInteraction.vue`)
builds only VaultDeposit/VaultWithdraw — **no** VaultCreate, no loan transactions at all — and at
`:42-47` emits:
```js
const transaction = {
  TransactionType: action === "deposit" ? "VaultDeposit" : "VaultWithdraw",
  Account: ..., VaultID: vaultId, Amount: String(parsedAmount),
  ComputationAllowance: 1000000,
  Fee: "1000000",
};
```
`ComputationAllowance` is a smart-contract field, **not** a vault field. Verified: `server_definitions`
on the hackathon devnet returns **no** field matching `/Computation/` at all. So this transaction
carries a field the network does not define, and hard-codes a 1 XRP fee.
Fixable in ~5 lines, but it is a Commons repo, not judged, and lower visibility than ripple/explorer.

### 3.4 Others
- `XRPL-Commons/bedrock` — "modular toolkit for smart-contracts on XRPL built in Go" (2026-08-19).
  Smart contracts, not XLS-65/66. Out of scope (and SmartEscrow is not enabled on either network).
- `tests.xrpl-commons.org` — HTTP 200, reachable. Related repo `XRPL-Commons/xrpl-test`
  ("tests vector to all xrpl client to test against", 2026-03-29). Not inspected in depth.
- **XRPL CLI** — no `xrpl-cli` package on npm (registry returns null). npm search for "xrpl cli"
  surfaces no official Ripple CLI. If a CLI is meant, it is not on npm under that name.
- `XRPL-Commons/xrpl-dev-skills` — "Claude skill for XRPL dApp development" (2026-02-12). Predates
  the lending amendments; possible but low-value target.

---

## 4. DevEx friction log (exact spot + proposed fix)

| # | Spot | Friction | Proposed fix |
|---|---|---|---|
| F1 | `ripple/explorer` `src/containers/Header/Search.tsx:46-52` | LoanBroker and Loan IDs are unresolvable; user gets "hash not found" although the explorer renders both on the vault page | Add `getLoanBroker`/`getLoan` to `determineHashType`, route via parent vault |
| F2 | `ripple/explorer` `public/locales/en-US/translations.json:77` + search placeholder | Copy says "Transactions, Vaults, Ledgers or NFTs" / "Token, Address, Ledger, Txn, VaultID or LedgerHash" — silently excludes lending entries | Include Loan Brokers and Loans in both strings |
| F3 | `ripple/explorer` `src/containers/App/featureFlags.ts:1` | `FEATURE_VAULTS_PAGE = false` hardcoded — no vault index and no nav entry on any network, incl. the hackathon devnet | Read from env/network config so custom deployments can enable it |
| F4 | `ripple/xrpl-reference-app-lending-sav` `package.json` + lock | Pins xrpl 4.6.0 / rbc 2.7.0, whose `signLoanSetByCounterparty` signs with `encodeForSigning` (`STX\0`) instead of `encodeForSigningCounterparty` (`CPT\0`) | Bump to `xrpl@^5.2.0` (rbc ≥2.11.0) |
| F5 | `ripple/xrpl-reference-app-lending-sav` `src/lib/xrpl/loan.ts:100-104` | Has to `as unknown as {...}` cast to reach `signLoanSetByCounterparty` — the helper is not surfaced on the typed top-level export | Export it (and `combineLoanSetCounterpartySigners`) from xrpl.js' public typings |
| F6 | `XRPL-Commons/scaffold-xrp` `apps/web/components/VaultInteraction.js:42-47` | Sends `ComputationAllowance` on VaultDeposit/VaultWithdraw — field absent from `server_definitions` — and hardcodes `Fee: "1000000"` | Drop `ComputationAllowance`; let `autofill` set the fee |
| F7 | `mcp.xrpledger.ai` | Rejects the widely-used `2025-03-26` MCP protocol version with `-32600`; returns no `mcp-session-id`, so a standard session handshake silently yields nothing | Accept older protocol revisions, or document the required `MCP-Protocol-Version` header |
| F8 | docs via MCP | `loanset.md` cites `rippled release/3.3.x` and "Open for Voting: 37.14%" while both hackathon networks run 3.4.0-rc with LendingProtocol **enabled** | Refresh amendment status + source links for 3.4.x |
| F9 | `github.com/ripple/lending-demo` | 404 — dead reference passed around | Point people at `ripple/xrpl-reference-app-lending-sav` |
| F10 | `XRPLF/explorer` | 404 — the explorer lives at `ripple/explorer` | Docs/readme should name the right org |

---

## 5. Shipping plan (before Sunday 12:30)

1. Fork `ripple/explorer`, branch `feat/resolve-loanbroker-and-loan-ids`.
2. `getLoan()` in `rippled.ts` + export (mirror `getLoanBroker`, :895-923). Unit test next to
   `rippled.test.ts:107`.
3. `Search.tsx` — two extra lookups + parent-vault resolution + query params.
4. `VaultLoans/index.tsx:52` — seed selected broker / expand loan from query params.
5. Translations (:77 + placeholder).
6. Record the before/after on the hackathon devnet with our own IDs (we have the failing
   screenshots already) — that is the demo slide.
7. Open the PR. Then a 1-line PR (or issue) on `xrpl-reference-app-lending-sav` for F4, citing the
   `STX\0` vs `CPT\0` measurement.

Demo line: *"Paste our loan broker ID into Ripple's own explorer on Ripple's own hackathon network —
not found. The object is rendered two clicks away. Here is the PR."*
