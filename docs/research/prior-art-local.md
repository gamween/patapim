# Prior art — local repos (slug: prior-art-local)

Researched 2026-09-12 for the XRPL Lending Protocol Hackathon (patapim).
Two local repos read in full:

- `/Users/fianso/Development/hackathons/Pyramid (outdated)` — PBW 2026 project, XLS-65/66 vaults + loans on **WASM Devnet**, `xrpl@4.5.0-smartescrow.4`.
- `/Users/fianso/Development/hackathons/counsel` — production-grade XRPL Next.js app (parimutuel prediction market), Testnet, `xrpl@^5.0.0`.

Everything below is from reading those files plus live probes of the two hackathon RPC endpoints and the published xrpl.js tarballs. No claim here is inferred.

---

## PART 1 — PYRAMID

### 1.1 Network and library it was built against

`/Users/fianso/Development/hackathons/Pyramid (outdated)/apps/web/lib/networks.js`:

```js
export const NETWORKS = {
  DEVNET: {
    id: "wasm-devnet",
    name: "WASM Devnet",
    networkId: 2002,
    wss: "wss://wasm.devnet.rippletest.net:51233",
    faucet: "https://wasmfaucet.devnet.rippletest.net/accounts",
    explorer: "https://devnet.xrpl.org",
  },
};
```

Library, from `apps/web/package.json` and `apps/watcher/package.json`:
`"xrpl": "npm:xrpl@4.5.0-smartescrow.4"` (confirmed in `pnpm-lock.yaml:5264` → `/xrpl@4.5.0-smartescrow.4:`).

**This network no longer applies.** Live probe today:

| | Track 1 (`lending-hackathon.dev.ripplex.io:51234`) | Track 2 (`s.devnet.rippletest.net:51234`) |
|---|---|---|
| `build_version` | `3.4.0-rc1` | `3.4.0-rc5` |
| `network_id` | **4001** | **2** |
| `base_fee_xrp` | `1e-05` (10 drops) | `1e-06` (1 drop) |
| `reserve_base_xrp` | **10** | **1** |
| `complete_ledgers` | `5-64811` (fresh chain) | `4442942-5252141` |

Consequences: every hardcoded `NetworkID: 2002` and `Fee: "12"` in Pyramid is wrong for both tracks. Worse, the NetworkID *rule* differs per track — see 1.6.

### 1.2 Every file that touches a vault or loan transaction

```
apps/web/scripts/setup-devnet.mjs          ← the crown jewel: full lifecycle, raw signing, cosign
apps/watcher/src/cosign-handler.js         ← server-side broker+borrower signing, liquidity guard
apps/web/lib/xrpl-signing.js               ← type-agnostic autofill/encode/sign/submit/extractCreatedId
apps/web/lib/submitRaw.js                  ← just a Set of "needs raw signing" tx types + predicate
apps/web/hooks/useVault.js                 ← VaultCreate / VaultDeposit / VaultWithdraw + vault_info reads
apps/web/hooks/useLoan.js                  ← LoanBrokerSet / CoverDeposit / LoanSet / LoanPay / LoanManage / LoanDelete
apps/web/hooks/useLoanMarket.js            ← browser hook, all writes proxied to server
apps/web/components/VaultInteraction.js    ← deposit/withdraw form
apps/web/components/LoanInteraction.js     ← borrow/repay form
apps/web/components/loans/ActiveLoans.js   ← loan list, reads PrincipalOutstanding / TotalValueOutstanding
apps/web/components/loans/LoanRepayModal.js ← min-payment UI + XRPL error-code → friendly message map
apps/web/components/loans/LoanManageModal.js
apps/web/components/loans/LoanMarketplace.js
apps/web/components/loans/LoanBorrowModal.js
apps/web/lib/constants.js                  ← LOAN_PAY_FLAGS / LOAN_MANAGE_FLAGS / LENDING defaults
apps/web/app/api/loans/{available,borrow,cosign,manage,prepare,repay,close,status}/route.js
apps/watcher/src/index.js                  ← express endpoints for the above
docs/xrpl-reference.md                     ← hand-built XLS-65/66 field + flag reference
```

### 1.3 The exact transaction-building code (paste-ready, then judged)

#### VaultCreate + VaultDeposit + LoanBrokerSet + LoanBrokerCoverDeposit
`apps/web/scripts/setup-devnet.mjs`:

```js
const vaultResult = await submitRawTx(client, owner, {
  TransactionType: "VaultCreate",
  Account: owner.address,
  Asset: { currency: "XRP" },
})
const vaultId = vaultResult.meta?.AffectedNodes?.find(
  (n) => n.CreatedNode?.LedgerEntryType === "Vault"
)?.CreatedNode?.LedgerIndex

await submitRawTx(client, owner, {
  TransactionType: "VaultDeposit",
  Account: owner.address,
  VaultID: vaultId,
  Amount: String(depositDrops),
})

const brokerResult = await submitRawTx(client, owner, {
  TransactionType: "LoanBrokerSet",
  Account: owner.address,
  VaultID: vaultId,
  ManagementFeeRate: 1000,
})
const loanBrokerId = brokerResult.meta?.AffectedNodes?.find(
  (n) => n.CreatedNode?.LedgerEntryType === "LoanBroker"
)?.CreatedNode?.LedgerIndex

await submitRawTx(client, owner, {
  TransactionType: "LoanBrokerCoverDeposit",
  Account: owner.address,
  LoanBrokerID: loanBrokerId,
  Amount: String(coverDrops),
})
```

#### LoanSet with CounterpartySignature (the single most valuable piece)
`apps/web/scripts/setup-devnet.mjs`, `createLoanOnVault()`:

```js
const prepared = {
  TransactionType: "LoanSet",
  Account: owner.address,
  LoanBrokerID: loanBrokerId,
  Counterparty: borrower.address,
  PrincipalRequested: String(principalDrops),
  InterestRate: 500,
  PaymentTotal: 12,
  PaymentInterval: 2592000,
  GracePeriod: 604800,
  Fee: "24",
  Sequence: acctInfo.result.account_data.Sequence,
  LastLedgerSequence: ledgerInfo.result.ledger_current_index + 20,
  NetworkID: 2002,
  SigningPubKey: owner.publicKey,       // <-- MUST be set before signing data is computed
}
// Both parties sign the same bytes: encodeForSigning(tx) prepends 0x53545800
// and includes only isSigningField:true fields (strips TxnSignature, CounterpartySignature).
const signingData = encodeForSigning(prepared)
prepared.TxnSignature = rawSign(signingData, owner.privateKey)          // broker
prepared.CounterpartySignature = {                                     // borrower
  SigningPubKey: borrower.publicKey,
  TxnSignature: rawSign(signingData, borrower.privateKey),
}
const tx_blob = encode(prepared)
const result = await client.request({ command: "submit", tx_blob })
```

**Verified still correct.** `ripple-binary-codec@2.11.0-beta.0` `definitions.json` gives
`CounterpartySignature {"isSerialized": true, "isSigningField": false, "isVLEncoded": false, "nth": 37, "type": "STObject"}`
and `SigningPubKey {"isSigningField": true, ...}`. So `encodeForSigning` strips the counterparty object and *includes* the broker's SigningPubKey — which is exactly why the broker's pubkey must already be on the object before either party signs. Both hackathon devnets list `CounterpartySignature` and `Counterparty` in `server_definitions` FIELDS.

There is also a `CounterpartySponsor` (AccountID, `isSigningField: true`) field on both devnets that Pyramid never used — relevant to the "sponsored fees and reserves" Loaded flavour.

#### LoanPay
```js
await submitRawTx(client, borrower, {
  TransactionType: "LoanPay",
  Account: borrower.address,
  LoanID: loanId,
  Amount: String(amountDrops),
  Flags: 0x00020000,   // tfLoanFullPayment
})
```

#### LoanManage / LoanDelete
`apps/watcher/src/cosign-handler.js` — note the correction made in commit `80467c8` ("use broker wallet for LoanManage/LoanDelete, not borrower"):

```js
async manageLoan({ loanId, flags }) {
  return this._signAndSubmitRaw(this.getOwnerWallet(), {
    TransactionType: "LoanManage", LoanID: loanId, Flags: flags,
  })
}
async closeLoan({ loanId }) {
  return this._signAndSubmitRaw(this.getOwnerWallet(), {
    TransactionType: "LoanDelete", LoanID: loanId,
  })
}
```

#### Flags (`apps/web/lib/constants.js`)
```js
export const LOAN_PAY_FLAGS = {
  tfLoanOverpayment: 0x00010000,
  tfLoanFullPayment: 0x00020000,
  tfLoanLatePayment: 0x00040000,
}
export const LOAN_MANAGE_FLAGS = {
  tfLoanDefault: 0x00010000,
  tfLoanImpair: 0x00020000,
  tfLoanUnimpair: 0x00040000,
}
```
**All six verified identical** to `xrpl@5.2.0-beta.0` `models/transactions/loanPay.js` (`LoanPayFlags` 65536/131072/262144) and `loanManage.js` (`LoanManageFlags` 65536/131072/262144).

#### Liquidity guardrail check (reusable for the Track-1 "rejected transaction" demo)
`apps/watcher/src/cosign-handler.js`:
```js
const vaultEntry = await client.request({ command: "ledger_entry", index: vaultId })
const available = parseInt(vaultEntry.result.node?.AssetsAvailable || "0", 10)
if (available < principalDrops) {
  throw new Error(`Insufficient liquidity: ${(available / 1_000_000).toFixed(2)} XRP available`)
}
```

#### Vault reads + share price
`apps/web/hooks/useVault.js`:
```js
const response = await client.request({ command: "vault_info", vault_id: vaultId })
const vault = response.result.vault
// sharePrice = (AssetsTotal - LossUnrealized) / OutstandingAmount
const sharePrice = totalShares > 0
  ? (totalAssets - lossUnrealized) / totalShares
  : 1 / Math.pow(10, vault.Scale || 0)
```
and share balance via
```js
await client.request({ command: "ledger_entry",
  mptoken: { mpt_issuance_id: vaultInfo.mptIssuanceId, account } })
```
**Verified the RPC shapes still resolve** on both hackathon endpoints (probed with a zero vault id; both return `entryNotFound`, i.e. the command and params parsed):
- `vault_info {vault_id}` — OK on Track 1 and Track 2.
- `ledger_entry {vault: "<hex>"}` — OK on both.
- `ledger_entry {loan: {loan_broker_id, loan_seq}}` — OK on Track 1 (returns a computed `index`).
- `ledger_entry {loan_broker: {owner, seq}}` — OK on Track 1.

Note the event brief says `PPS = AssetsTotal / SharesTotal`; Pyramid subtracts `LossUnrealized` first. Both appear in Pyramid's own `docs/xrpl-reference.md`. Worth confirming against the spec — see open questions.

### 1.4 What Pyramid does NOT have

- **No drawdown step.** Neither devnet exposes a drawdown transaction type. `server_definitions` on both lists exactly: `LoanBrokerCoverClawback, LoanBrokerCoverDeposit, LoanBrokerCoverWithdraw, LoanBrokerDelete, LoanBrokerSet, LoanDelete, LoanManage, LoanPay, LoanSet, VaultClawback, VaultCreate, VaultDelete, VaultDeposit, VaultSet, VaultWithdraw`. No `LoanDraw`, no `LoanDrawdown`. Grepping the whole `xrpl@5.2.0-beta.0` dist for `drawdown|loandraw` returns nothing. The Track-1 "execute a drawdown" requirement therefore maps onto something else (LoanSet itself? a LoanManage flag? a LoanPay-adjacent mechanic?) — **open question**, do not assume.
- **No VaultSet, VaultDelete, VaultClawback, LoanBrokerCoverWithdraw, LoanBrokerDelete usage.** Only the `RAW_TX_TYPES` Set in `lib/submitRaw.js` names some of them.
- **No closed-ended vault anything** — no `VaultKind`, `SubscriptionDate`, `RedemptionDate`. Pyramid predates V1.1 entirely.
- **No first-loss-cover demonstration** beyond depositing cover.
- **No tests.** Zero test files in the repo.

### 1.5 Does the Pyramid transaction code still match the current protocol?

Checked field-by-field against `xrpl@5.2.0-beta.0`'s `validateLoanSet` / `validateVaultCreate` and against both devnets' `server_definitions`.

| Pyramid construct | Verdict |
|---|---|
| `VaultCreate { Asset: {currency:"XRP"} }` | Still valid. `validateVaultCreate` requires `Asset` (isCurrency); `Scale` must **not** be set for XRP or MPT assets. |
| `VaultDeposit/Withdraw { VaultID, Amount }` | Still valid, unchanged shape. |
| `LoanBrokerSet { VaultID, ManagementFeeRate }` | Still valid. SDK now also exposes `LoanBrokerID` (update mode), `DebtMaximum`, `CoverRateMinimum`, `CoverRateLiquidation`. |
| `LoanBrokerCoverDeposit { LoanBrokerID, Amount }` | Name confirmed present on both devnets. |
| `LoanSet { LoanBrokerID, Counterparty, PrincipalRequested, InterestRate, PaymentTotal, PaymentInterval, GracePeriod }` | Still valid, **but** `PrincipalRequested` must be a string (`XRPLNumber = string`), `PaymentInterval >= 60`, and **`GracePeriod` must not exceed `PaymentInterval`**. Pyramid's 2592000/604800 pass. Many new optional fields now exist: `LoanOriginationFee`, `LoanServiceFee`, `LatePaymentFee`, `ClosePaymentFee`, `OverpaymentFee`, `LateInterestRate`, `CloseInterestRate`, `OverpaymentInterestRate`, `Data`. Rate fields cap at 100000. |
| `CounterpartySignature { SigningPubKey, TxnSignature }` | Still valid; SDK type also permits `Signers[]` (multisig counterparty). |
| `LoanPay`, `LoanManage`, `LoanDelete` + flags | Still valid, flags byte-identical. |
| `NetworkID: 2002` | **Wrong.** See 1.6. |
| `Fee: "12"` / `"24"` | **Wrong for Track 1** (base fee 10 drops there, and the fee escalates); Track 2 base fee is 1 drop. Use `client.autofill`. |
| Raw signing via `ripple-keypairs` deep path | **Obsolete.** See 1.7. |

### 1.6 NetworkID: the one that will silently bite

`xrpl@5.2.0-beta.0` `dist/npm/sugar/autofill.js`:
```js
const RESTRICTED_NETWORKS = 1024;
const REQUIRED_NETWORKID_VERSION = '1.11.0';
...
if (client.networkID !== undefined && client.networkID > RESTRICTED_NETWORKS) { ... txn.NetworkID = client.networkID }
```

- **Track 1** `network_id = 4001` → `NetworkID` **is required** on every transaction.
- **Track 2** `network_id = 2` → `NetworkID` **must be omitted**.

Pyramid hardcodes `2002` in five places (`setup-devnet.mjs` ×3, `cosign-handler.js` ×2, `lib/xrpl-signing.js` via `DEFAULT_NETWORK.networkId`). Copying any of them verbatim yields a transaction that will not apply. `client.autofill()` handles this correctly on both tracks; hand-rolled autofill does not.

### 1.7 The raw-signing workaround is dead — and that is good news

Pyramid's whole server-side architecture exists for one reason, stated in `apps/web/hooks/useLoan.js`:

> `xrpl@4.5.0-smartescrow.4` doesn't support XLS-66 transaction types (LoanBrokerSet, LoanSet, LoanPay, etc.) in its `validate()` function. Write operations will fail in the browser via wallet adapters.

and in `docs/superpowers/specs/2026-04-12-browser-cosign-loans-marketplace-design.md`:

> xrpl.js@4.5.0-smartescrow.4 rejects XLS-66 transaction types … in its `validate()` function. Wallet adapters (Xaman, Crossmark, GemWallet) all route through xrpl.js, so loan operations never reach the wallet for signing.

**That constraint is gone.** `xrpl@5.2.0-beta.0` ships first-class models and validators for all 15 lending transaction types (`dist/npm/models/transactions/{loanSet,loanPay,loanManage,loanDelete,loanBrokerSet,loanBrokerDelete,loanBrokerCoverDeposit,loanBrokerCoverWithdraw,loanBrokerCoverClawback,vaultCreate,vaultSet,vaultDelete,vaultDeposit,vaultWithdraw,vaultClawback}.js`).

Also, `Wallet.sign()` in 5.2.0-beta.0 rejects only a pre-set `TxnSignature` or `Signers`:
```js
if (tx.TxnSignature || tx.Signers) {
  throw new ValidationError('txJSON must not contain "TxnSignature" or "Signers" properties');
}
```
It leaves `CounterpartySignature` alone, runs `validate(tx)` (LoanSet is now known), sets `SigningPubKey = this.publicKey`, signs, and `encode`s the full object. So the modern cosign flow is:

```js
const prepared = await client.autofill({ TransactionType: "LoanSet", Account: broker.address, ... })
prepared.SigningPubKey = broker.publicKey                 // needed: it IS a signing field
const signingData = encodeForSigning(prepared)
const counterparty = {
  SigningPubKey: borrower.publicKey,
  TxnSignature: ripplekeypairs.sign(signingData, borrower.privateKey),
}
const { tx_blob } = broker.sign({ ...prepared, CounterpartySignature: counterparty })
await client.submitAndWait(tx_blob)
```
(Pass `prepared` without `TxnSignature`; `Wallet.sign` adds it.) This keeps Pyramid's proven *semantics* and drops ~200 lines of hand-rolled autofill/submit/poll.

Pyramid's `ripple-keypairs` import hack is pure pnpm friction and must not be copied:
```js
const keypairsPath = join(dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/.pnpm/xrpl@4.5.0-smartescrow.4/node_modules/ripple-keypairs/dist/index.js")
const { sign: rawSign } = await import(keypairsPath)
```
`ripple-keypairs@^3.0.0` is a direct npm package (it is xrpl's own declared dependency). Just `npm i ripple-keypairs` and `import { sign } from "ripple-keypairs"`.

### 1.8 xrpl.js version trap discovered while checking this

npm publish times (`npm view xrpl time`):
```
5.2.0-beta.0  2026-09-10T13:42:46Z
5.2.0-beta.1  2026-09-11T16:59:54Z
5.2.0         2026-09-11T22:20:39Z   <-- `latest` since yesterday evening
```
Comparing the extracted tarballs:

- `5.2.0-beta.0` and `5.2.0-beta.1` `VaultCreate` have `VaultKind`, `SubscriptionDate`, `RedemptionDate`; `VaultWithdraw` has `CredentialIDs?: string[]`.
- **`5.2.0` stable has none of them.** `VaultKind` enum is absent, the three closed-ended fields are absent, `CredentialIDs` is absent from `VaultWithdraw`.

So `npm install xrpl` today installs 5.2.0 and **cannot build a closed-ended vault** (Track 2's entire premise) and cannot attach credentials to a VaultWithdraw (a Loaded-flavour seam). The event's instruction to pin `xrpl.js@5.2.0-beta.0` is correct and load-bearing — but nothing in the package metadata warns you, and the higher stable version number reads as "newer". Pin it in `package.json` as an exact version, and add a CI/startup assertion.

Track 2 closed-ended constraints, straight from `5.2.0-beta.0` `vaultCreate.js` (values that will save hours on the day):
```js
const MIN_INVESTMENT_PERIOD = 180;          // seconds
const MAX_INVESTMENT_PERIOD = 946708560;    // seconds
// closed-ended requires BOTH dates; RedemptionDate - SubscriptionDate ∈ [180, 946708560)
// dates are integer seconds since the Ripple Epoch (not Unix)
// SubscriptionDate/RedemptionDate on a non-closed vault => ValidationError
// DomainID requires the tfVaultPrivate flag to be set
// Scale must NOT be set for XRP or MPT assets; for IOU it is 0..18
```

Also note: `tfVaultDonation` does **not** exist anywhere in `xrpl@5.2.0-beta.0`, `5.2.0-beta.1` or `5.2.0` (grep for `donation`, case-insensitive, across the whole dist: zero hits). `VaultDeposit` in the SDK is `{ VaultID, Amount }` with **no `Flags` field and no flags enum**. If the closed-ended yield injection really is `VaultDeposit` + `tfVaultDonation`, the SDK cannot express it and `validateVaultDeposit` is the wrong shape. Flag this loudly — it is a concrete, high-value DevEx finding.

### 1.9 Pyramid's own reference doc

`docs/xrpl-reference.md` is a genuinely good hand-built XLS-65/66 cheat sheet (tx table with required fields, all flag values in hex+decimal, Vault/Loan/MPToken ledger entry field tables, `vault_info` response shape, `ledger_entry` param variants, the LoanSet cosign order). It also encodes two facts worth re-verifying against V1/V1.1:
- Vault deposit/redemption exchange-rate formulas.
- `LoanSet` flags table lists only `tfLoanOverpayment: 0x00010000` — matches `LoanSetFlags` in 5.2.0-beta.0 exactly.
It links every row to an `xrpl.org/docs/references/protocol/transactions/types/{name}` URL. Those links are worth re-checking for 404s — a cheap friction harvest.

---

## PART 2 — COUNSEL

Mature, tested, shipped. 25 test files / ~200 `it()` blocks, CI keeper workflow, i18n, SPEC.md, docs/. This is where the *infrastructure* comes from.

### 2.1 Reusable XRPL core (`src/lib/xrpl/`)

| File | What it gives you | Reuse verdict |
|---|---|---|
| `client.ts` | `withClient(fn)` — connect, run, always disconnect. 12 lines. | **Steal verbatim**, swap `WSS_ENDPOINT`. |
| `tx.ts` | `signAndSubmit(client, wallet, tx, attempts)` with autofill + `RETRYABLE` regex + backoff, and `normalizeResult(res)` → `{hash, validated, engineResult, success, ledgerIndex}`. | **Steal verbatim.** The retry predicate is the subtle part: `/LastLedgerSequence\|tefMAX_LEDGER\|terQUEUED\|telINSUF_FEE_QUEUE/i` — only provably-unapplied failures retry, so a re-autofill can never double-apply. |
| `rpc.ts` | `rpc(method, params, timeoutMs)` — JSON-RPC over HTTP with AbortController, plus paginated `httpAccountTx`. No websocket, serverless-safe. | **Steal.** Both hackathon tracks publish an HTTPS RPC endpoint; this is the read path. |
| `accountTx.ts` | `normalizeEntry` handling **both rippled api_version 1 and 2** (`tx` vs `tx_json`, `date` vs `close_time_iso`), `fetchAccountTx` with marker pagination and an explicit truncation error, `txFailed()`, `deliveredDrops()`. | **Steal.** The v1/v2 normalisation alone saves an hour. |
| `reader.ts` | `LedgerReader` interface with `httpReader()` / `wsReader(client)` implementations. | **Steal** — one interface, two transports, lets the same indexer run in Next.js and in a script. |
| `wallet.ts` | `Wallet.fromSeed` wrappers per role. | Steal the *pattern* (named roles), not the counsel-specific names. |
| `account.ts` | `getReserves(client)` (reads `reserve_base_xrp`/`reserve_inc_xrp` from `server_info`), `getBalanceXrp`, `hasSignerList`, `disableMasterKey`, `setRequireDest`. | **Steal `getReserves`** — Track 1 has a 10 XRP base reserve, you will need to compute funding. |
| `multisign.ts` | `setSignerList`, `multiSignAndSubmit` using `client.autofill(tx, signers.length)` + `wallet.sign(prepared, true)` + `multisign(blobs)`. | Keep in the back pocket: XLS-66 `CounterpartySignature` accepts a `Signers[]` array, so a multisig counterparty is expressible. |
| `memo.ts` | Hex memo codec, typed namespace constants, `findJsonMemo`. | **Steal** for attaching a credible use-case narrative on-ledger (loan purpose, borrower identity ref, invoice id). |
| `drops.ts` | `xrpToDrops` / `dropsToXrp`, dependency-free (so the server bundle never loads `xrpl`/`ws`). | Steal. |
| `address.ts` | Dependency-free base58check classic-address validation. | Steal if you validate addresses at an API boundary. |
| `payment.ts` | `buildTaggedPayment` — always sets `SourceTag`. | Steal the discipline: put a project source tag on every tx for verifiable attribution during judging. |
| `faucet.ts` | `client.fundWallet(wallet ?? null, {...})`. | Steal; change `faucetHost` per track. |

### 2.2 Wallet connect layer (`src/lib/wallet/`)

`connectors.ts` — GemWallet + Crossmark + Xaman behind one `connectWallet(kind, onPending, signal)` / `submitSignedBet(kind, tx, ...)` API. Notable defensive tricks:
- `findHash(obj)` recursively hunts a 64-hex `hash`/`txid` anywhere in a wallet's response, because each SDK returns a different shape.
- Xaman runs server-side (`/api/xaman/payload`) so the API secret never reaches the browser; the client polls `/api/xaman/payload/[uuid]` with a 5-minute deadline and an `AbortSignal`.
- `crossmarkNetwork()` probes `methods.getNetwork()` then `session.network` then the sign-in response, because the surface moved between SDK versions.

`network.ts` — `assertWalletNetwork(walletResponse, expected)`: scans any wallet response for a network token (`mainnet|testnet|devnet|xahau`), refuses a positive mismatch, does **not** block on an unrecognised shape. Re-checked before every signature, not just at connect.

`WalletContext.tsx` — React provider with `hydrated` flag (so consumers never redirect on a not-yet-read localStorage session), `AbortController` per connect attempt, `CancelledError` swallowing, localStorage persistence under a versioned key.

**Caveat that matters here:** counsel's connectors are typed to `Payment` and only ever submit Payments. Gem/Crossmark/Xaman will very likely refuse an unknown `LoanSet`/`VaultDeposit` transaction type, and Xaman's payload endpoint validates the tx server-side. Treat the connector layer as *structure to copy*, and plan the lending writes as operator-signed (like counsel's own settlement path and like Pyramid's watcher) unless a wallet is proven to pass XLS-66 through.

### 2.3 Test harness and script harness

- `vitest.config.ts` — 12 lines, `include: ["test/**/*.test.ts"]`, node env, `@` → `./src` alias. Copy as-is.
- Tests are **pure-function tests on transaction builders and math**, never network tests. E.g. `test/payment.test.ts` asserts drops conversion, SourceTag defaulting, DestinationTag pass-through. That is exactly the right shape for a 23-hour build: test the LoanSet/VaultCreate *builders*, and let the e2e script prove the ledger.
- `scripts/cli.ts` — a 45-line lazy-import command router (`pnpm cli <cmd>`), with a `package.json` script `tsx --env-file=.env.local scripts/cli.ts`. **Steal verbatim.** It is the single highest-leverage file in either repo for a hackathon: one entry point, zero framework.
- `scripts/lib/console.ts` — `heading/info/ok/warn/fail/kv/txOk/acctLink` with ANSI colours and explorer deep links. `txOk(label, hash)` prints a clickable explorer URL for every transaction. **Steal verbatim, repoint `EXPLORER_BASE`.** This is how you produce a judge-facing transcript of verifiable devnet transactions for free.
- `scripts/lib/env-file.ts` — `setEnvVars({...})` writes back into `.env.local` (in-place key update, mode 0600) *and* `process.env`, so a setup script can provision accounts and persist their seeds in one run. **Steal verbatim** — exactly what a vault/broker/borrower provisioning script needs.
- `scripts/e2e.ts` — the model to copy: numbered `heading()` phases, fund fresh wallets from the faucet mid-run, assert an exact expected balance delta (`Math.abs(gained - 48.5) < 0.01`), then **re-run settlement to prove idempotency**. Rewritten for lending this becomes the demo script and the evidence artefact in one.

### 2.4 App / API patterns worth lifting

- `src/lib/config.ts` — lazy secret reads (`required(name)` only when used, so `next build` never needs a seed), eager public config, `NETWORK` + `PUBLIC_NETWORK` split with a comment explaining that `NEXT_PUBLIC_*` must be a *static* reference for Next to inline it, `assertTestnet()` hard guard on every fund-moving path, `EXPLORER_BASE` derived from network.
- `src/lib/errors.ts` + `src/lib/api/error.ts` — `CodedError(code, message, params)` and `apiError(status, code, message)`: stable machine code for the UI to localise, English message for logs/API. Pairs with Pyramid's error-code→friendly-message map in `LoanRepayModal.js` (`tecKILLED`, `tecINSUFFICIENT_PAYMENT`, `telINSUF_FEE`, `tecINSUFFICIENT_FUNDS`).
- `src/lib/api/ratelimit.ts` — 15-line in-memory limiter. Enough.
- `src/lib/hooks/useLiveMarket.ts` — one refcounted shared poller per resource id, with a `seq` guard so a slow earlier response cannot overwrite a newer one, primed immediately for the first subscriber. **Steal for live vault PPS / loan state.** Strictly better than Pyramid's `setInterval` per hook in `useLoanMarket.js`.
- `src/components/PhaseBadge.tsx` — phase → colour-class map. Track 2's Subscription / Investment / Redemption phases are exactly this component with three keys.
- `.github/workflows/keeper.yml` — cron-driven ledger-derived keeper, keys in repo secrets not on the web host. Overkill for 23 hours, but the pattern (`*/5 * * * *` + `concurrency: group`) is how you'd run a Track-2 phase watcher.
- `docs/xrpl-v5.md` — records the three xrpl.js 4→5 breaking changes. The one that can bite: **`Wallet.fromSeed` in 5.x infers the curve from the seed prefix** (`sEd...` = Ed25519, everything else = secp256k1) instead of defaulting to Ed25519. Faucet-generated seeds are `sEd...` so this is a non-issue, but a hand-written secp256k1 seed derives a different address than it did on 4.x. `scripts/verify-v5.ts` is the on-chain proof pattern.

---

## PART 3 — STEAL THIS / SKIP THAT

### STEAL — copy with minimal edits

| What | From | Notes |
|---|---|---|
| `withClient()` | `counsel/src/lib/xrpl/client.ts` | verbatim |
| `signAndSubmit` + `normalizeResult` + `RETRYABLE` | `counsel/src/lib/xrpl/tx.ts` | verbatim; works for every lending tx type on xrpl 5.2.0-beta.0 |
| HTTP `rpc()` + `httpAccountTx` | `counsel/src/lib/xrpl/rpc.ts` | verbatim, repoint `RPC_ENDPOINT` |
| `normalizeEntry` / `fetchAccountTx` / `txFailed` / `deliveredDrops` | `counsel/src/lib/xrpl/accountTx.ts` | verbatim; handles api_version 1 and 2 |
| `LedgerReader` (`httpReader`/`wsReader`) | `counsel/src/lib/xrpl/reader.ts` | verbatim |
| `getReserves` | `counsel/src/lib/xrpl/account.ts` | needed: Track 1 base reserve is 10 XRP |
| `xrpToDrops` / `dropsToXrp` | `counsel/src/lib/xrpl/drops.ts` | verbatim |
| memo codec + typed namespace | `counsel/src/lib/xrpl/memo.ts` | use-case narrative on-ledger |
| CLI router | `counsel/scripts/cli.ts` | verbatim — highest leverage file in either repo |
| console/explorer-link helpers | `counsel/scripts/lib/console.ts` | verbatim; `txOk()` = free judge evidence |
| `setEnvVars` | `counsel/scripts/lib/env-file.ts` | verbatim; provision + persist seeds in one run |
| e2e script shape (numbered phases, faucet mid-run, exact-delta assertion, idempotent re-run) | `counsel/scripts/e2e.ts` | rewrite for lending |
| vitest config + pure-builder test style | `counsel/vitest.config.ts`, `counsel/test/payment.test.ts` | verbatim |
| `CodedError` / `apiError` | `counsel/src/lib/errors.ts`, `src/lib/api/error.ts` | verbatim |
| refcounted shared poller with `seq` guard | `counsel/src/lib/hooks/useLiveMarket.ts` | verbatim, repoint URL |
| `PhaseBadge` | `counsel/src/components/PhaseBadge.tsx` | → Subscription/Investment/Redemption |
| lazy-secret config + `assertTestnet` guard shape | `counsel/src/lib/config.ts` | rename to `assertHackathonNetwork()` pinned to the chosen track |
| **CounterpartySignature cosign semantics** | `Pyramid/apps/web/scripts/setup-devnet.mjs` `createLoanOnVault()` | the ONE thing counsel cannot give you — verified still correct against the codec |
| **`extractCreatedId(txResult, "Vault"\|"LoanBroker"\|"Loan")`** | `Pyramid/apps/web/lib/xrpl-signing.js` | how you get a VaultID / LoanBrokerID / LoanID at all |
| `LOAN_PAY_FLAGS` / `LOAN_MANAGE_FLAGS` | `Pyramid/apps/web/lib/constants.js` | verified byte-identical to the SDK enums |
| Liquidity precheck before origination | `Pyramid/apps/watcher/src/cosign-handler.js` | reuse as the Track-1 guardrail demo |
| `tec*` → friendly message map | `Pyramid/apps/web/components/loans/LoanRepayModal.js` | good UX, and good raw material for feedback |
| Vault share-price read + MPToken balance read | `Pyramid/apps/web/hooks/useVault.js` | RPC shapes re-verified live on both tracks |
| XLS-65/66 cheat sheet | `Pyramid/docs/xrpl-reference.md` | update it; do not trust it blind |
| Broker-vs-borrower actor mapping (LoanManage/LoanDelete are broker actions) | `Pyramid` commit `80467c8` | a bug they already paid for once |
| Dynamic fee from `server_info` (`base_fee_xrp * load_factor`) | `Pyramid/apps/watcher/src/cosign-handler.js` `getCurrentFee()` | better than hardcoding; `client.autofill` is better still |

### SKIP — do not copy

| What | Why |
|---|---|
| `Pyramid/apps/web/lib/networks.js` (WASM devnet, `networkId: 2002`) | wrong network, wrong id, wrong fee, wrong reserve for both tracks |
| every hardcoded `NetworkID: 2002` (5 sites) | Track 1 needs 4001; Track 2 must omit NetworkID entirely (`RESTRICTED_NETWORKS = 1024`) |
| every hardcoded `Fee: "12"` / `"24"` | Track 1 base fee is 10 drops; use `client.autofill` |
| `Pyramid/apps/web/lib/submitRaw.js` `RAW_TX_TYPES` + `needsRawSigning()` | the premise is false on xrpl 5.2.0-beta.0 — all 15 types are first-class |
| `Pyramid` deep-path `ripple-keypairs` import | `npm i ripple-keypairs` |
| `Pyramid` hand-rolled `autofill` / `submitAndWait` poll loops (`xrpl-signing.js`, `cosign-handler.js`, `setup-devnet.mjs` all duplicate it) | `client.autofill` + `client.submitAndWait` do it correctly, including NetworkID |
| the whole watcher-bot + 8 Next.js proxy routes architecture | it exists only to work around the old SDK gap; one CLI script + one operator signer replaces it |
| `Pyramid` multisign `submitCosignedTx()` (`534D5400` prefix, manual signer sort) | never used for loans; counsel's `multiSignAndSubmit` is the tested version if you need multisig |
| `Pyramid` committed devnet seeds (`apps/web/scripts/devnet-addresses.json`, `apps/web/lib/constants.js`, `apps/watcher/src/config.js`) | dead WASM-devnet accounts, and seeds must never be committed |
| `Pyramid` three.js / shader / landing components | pure weight |
| `counsel` connectors typed to `Payment` only | wallet extensions will likely refuse XLS-66 types; copy the structure, not the assumption |
| `counsel` parimutuel/DPM/dispute/oracle/promo/i18n/geo modules | domain-specific, irrelevant |
| `npm i xrpl` (→ 5.2.0 stable) | stable 5.2.0 **dropped** `VaultKind`/`SubscriptionDate`/`RedemptionDate`/`CredentialIDs`. Pin `5.2.0-beta.0` exactly for Track 2 |

### The 30-minute skeleton

1. `package.json`: `xrpl` pinned exact (`5.2.0-beta.0` for Track 2), `ripple-keypairs`, `tsx`, `vitest`.
2. Copy `counsel/scripts/cli.ts`, `scripts/lib/console.ts`, `scripts/lib/env-file.ts`, `src/lib/xrpl/{client,tx,rpc,accountTx,reader,account,drops,memo}.ts`, `vitest.config.ts`.
3. New `src/lib/config.ts` from counsel's, with a single `TRACK` constant fixing wss/rpc/faucet/explorer/networkId, and a startup assertion that `server_info.network_id` matches.
4. New `src/lib/lending/build.ts`: pure builders for VaultCreate/VaultDeposit/VaultWithdraw/LoanBrokerSet/LoanBrokerCoverDeposit/LoanSet/LoanPay/LoanManage — unit-tested the way `test/payment.test.ts` tests `buildTaggedPayment`.
5. New `src/lib/lending/cosign.ts`: the Pyramid CounterpartySignature flow rewritten on `client.autofill` + `Wallet.sign`.
6. `scripts/setup.ts` (provision + `setEnvVars`) and `scripts/e2e.ts` (numbered phases + `txOk` explorer links + a deliberately-rejected transaction) modelled on counsel's.

---

## Open questions

1. **Drawdown.** No drawdown transaction type exists on either devnet's `server_definitions`, and no `drawdown`/`LoanDraw` string exists in xrpl.js 5.2.0-beta.0. What exactly satisfies Track 1's "execute a drawdown"? Pyramid has nothing for it.
2. **`tfVaultDonation`.** Absent from every xrpl.js 5.2.x artifact; `VaultDeposit` has no `Flags` field or flags enum in the SDK. Is the flag real on-chain (rippled-side only)? If so the SDK model is incomplete and `validateVaultDeposit` will need bypassing.
3. **Share price formula.** Event brief says `PPS = AssetsTotal / SharesTotal`; Pyramid's `useVault.js` and `docs/xrpl-reference.md` use `(AssetsTotal - LossUnrealized) / OutstandingAmount`. Which does V1 / V1.1 actually use?
4. **Track 1 = V1, but its `server_definitions` already carries `VaultKind`, `SubscriptionDate`, `RedemptionDate`.** Are closed-ended vaults merely unusable on Track 1, or actively rejected at apply time? Field presence in definitions is not proof of behaviour.
5. **Wallet extensions and XLS-66.** Do GemWallet / Crossmark / Xaman pass `LoanSet` and `VaultDeposit` through today? If yes, counsel's connector layer becomes directly reusable for a much better demo; if no, the operator-signed path is mandatory.
6. **`CounterpartySponsor`** (AccountID, `isSigningField: true`) exists on both devnets and is unused in both repos. It looks like the sponsored-fees seam for the Loaded flavour — needs spec confirmation.
7. **xrpl.org doc links** in `Pyramid/docs/xrpl-reference.md` were valid 2026-04-11; not re-checked for 404s today.
