# Research: the official Lending Protocol demo app + every other Ripple/XRPLF lending reference

Slug: `lending-demo` · researched 2026-09-12 · all claims verified against source, npm tarballs, rippled C++, or live devnet RPC.

---

## 0. TL;DR for the builder

1. **`https://github.com/ripple/lending-demo` does not exist (HTTP 404).** The real repo is
   **`https://github.com/ripple/xrpl-reference-app-lending-sav`** — "Reference App for the XLS-66 Lending
   Protocol and XLS-65 Single Asset Vault amendments". Live at <https://lending.xls-demo.com/>.
2. It is a **Next.js 16 / React 19 / TypeScript / Tailwind v4 / shadcn** app with **MongoDB (Mongoose)** and
   **Auth0**, pinning **`xrpl@4.6.0`**, targeting **public XRPL Devnet**.
3. **The reference app cannot complete its own happy path on public devnet today.** Two independent
   blockers, both reproduced live (§5, §6):
   - it creates **open-ended** vaults, and under `LendingProtocolV1_1` **`LoanBrokerSet` on an open-ended
     vault returns `tecNO_PERMISSION`**;
   - `xrpl@4.6.0`'s `signLoanSetByCounterparty` signs with the **pre-`fixCleanup3_4_0` prefix**, so `LoanSet`
     is rejected with `fails local checks: Counterparty: Invalid signature.`
4. **The same two bugs hit the official `_code-samples` JS scripts, and the Python ones are worse** —
   `xrpl-py` has **no counterparty signing prefix at all** on `main` (§7).
5. **Only `xrpl@5.2.0-beta.1` has both** the V1.1 closed-ended vault fields *and* the correct
   counterparty signing prefix. `5.2.0-beta.0` (the version the event brief mandates) has the V1.1 fields
   but the **old, rejected** signing prefix. `5.2.0` *stable* has correct signing but **no V1.1 fields at all**. (§4)
6. Reusable as-is in a fresh Next.js app: `lib/xrpl/{vault,broker,loan}.ts` builders, `lib/loan-math.ts`,
   `lib/constants.ts` rate conversions, `lib/xrpl/helpers.ts` MPT scaling. Do **not** reuse its PNL math
   (single-depositor assumption) or its `signAndSubmitLoanSet` (wrong xrpl version). (§8)

---

## 1. Locating the repo

```
$ git clone https://github.com/ripple/lending-demo.git
remote: Repository not found.
$ curl -s -o /dev/null -w "%{http_code}" https://github.com/ripple/lending-demo   → 404
$ curl -s -o /dev/null -w "%{http_code}" https://github.com/XRPLF/lending-demo    → 404
```

Found via GitHub search:

```
$ gh api -X GET search/repositories -f q='org:ripple lending'
ripple/xrpl-reference-app-lending-sav | 2026-07-16T14:06:29Z |
  Reference App for the XLS-66 Lending Protocol and XLS-65 Single Asset Vault amendments on the XRP Ledger.
```

Metadata (`gh api repos/ripple/xrpl-reference-app-lending-sav`):

| field | value |
|---|---|
| created_at | 2026-07-13T20:50:56Z |
| pushed_at | **2026-07-16T14:06:29Z** (last commit ~2 months before the hackathon) |
| homepage | https://lending.xls-demo.com/ |
| license | Apache-2.0 |
| stars / forks | 1 / 0 |
| commits | 4 (`b92c990`, `a4eee7c`, `f6eb495`, `5643be5`) |

Note: <https://opensource.ripple.com/docs/xls-66-lending-protocol> links "Try the Demo App" →
`https://lending.xls-demo.com/` and carries a "GitHub" link, but the only `github.com` URL in the served
HTML is the XLS-0066 spec. The repo URL is not discoverable from that page without JS.

---

## 2. Stack

From `package.json` and `README.md`:

| layer | choice |
|---|---|
| framework | **Next.js `^16.2.6`** (App Router, Turbopack), **React `19.2.3`** |
| language | TypeScript `^5` |
| UI | Tailwind CSS v4, shadcn/ui, Aceternity UI, Magic UI, `motion` `^12.38.0`, `lucide-react` |
| auth | **`@auth0/nextjs-auth0` `^4.21.0`** (Universal Login), gate in `src/proxy.ts` |
| DB | **MongoDB via `mongoose` `^9.3.1`** |
| XRPL | **`xrpl` `^4.6.0`** — lockfile resolves exactly `4.6.0` (`ripple-binary-codec@2.7.0`, `ripple-keypairs@2.0.0`) |
| docs | OpenAPI 3.1 at `docs/openapi.yaml`, served at `/api/openapi` + Swagger UI at `/api/docs` |

Not a library — a full 3-role product (Broker / Depositor / Borrower), 123 files, server-custodial wallets.

### Network targeting

`src/lib/constants.ts:3-8`:

```ts
export const XRPL_NETWORK_URL =
  process.env.XRPL_NETWORK_URL || "wss://s.devnet.rippletest.net:51233/";
export const XRPL_FAUCET_URL =
  process.env.XRPL_FAUCET_URL ||
  "https://faucet.devnet.rippletest.net/accounts";
```

`src/lib/explorer.ts:1` hardcodes `const EXPLORER_BASE = "https://devnet.xrpl.org";` — **not** env-driven, so
pointing `XRPL_NETWORK_URL` at the hackathon devnet silently leaves every explorer link pointing at the
wrong chain.

`.env.example` comment: *"XRPL Network — Devnet is the only network where XLS-66/65 are enabled at the time of writing."*

---

## 3. Every transaction builder, verbatim

All XRPL code lives under `src/lib/xrpl/`. Builders are pure (return plain objects); one shared
`submitTransaction` autofills → signs → `submitAndWait` → asserts `tesSUCCESS`.

### 3.1 `VaultCreate` — `src/lib/xrpl/vault.ts:41-88`

```ts
export function buildVaultCreate(
  ownerAddress: string,
  options: VaultCreateOptions = {}
) {
  let asset: Record<string, string>;
  const assetConfig = options.asset;
  if (assetConfig?.type === "IOU" && assetConfig.currency && assetConfig.issuer) {
    asset = { currency: assetConfig.currency, issuer: assetConfig.issuer };
  } else if (assetConfig?.type === "MPT" && assetConfig.mptIssuanceId) {
    asset = { mpt_issuance_id: assetConfig.mptIssuanceId };
  } else {
    asset = { currency: "XRP" };
  }

  const tx: Record<string, unknown> = {
    TransactionType: "VaultCreate",
    Account: ownerAddress,
    Asset: asset,
    Flags: options.nonTransferableShares ? VaultCreateFlags.tfVaultShareNonTransferable : 0,
    WithdrawalPolicy: 1, // vaultStrategyFirstComeFirstServe
  };

  if (options.name || options.website) {
    const data: Record<string, string> = {};
    if (options.name) data.n = options.name;
    if (options.website) data.w = options.website;
    tx.Data = Buffer.from(JSON.stringify(data)).toString("hex").toUpperCase();
  }

  if (options.assetsMaximum) {
    tx.AssetsMaximum = options.assetsMaximum;
  }

  if (options.shareMetadata) {
    const meta = options.shareMetadata;
    const mptMeta: Record<string, unknown> = {};
    if (meta.ticker) mptMeta.t = meta.ticker.toUpperCase();
    if (meta.name) mptMeta.n = meta.name;
    if (meta.description) mptMeta.d = meta.description;
    mptMeta.i = meta.icon || DEFAULT_TOKEN_ICON;
    mptMeta.ac = meta.assetClass || "defi";
    if (meta.assetSubclass) mptMeta.as = meta.assetSubclass;
    mptMeta.in = meta.issuerName || DEFAULT_ISSUER_NAME;
    tx.MPTokenMetadata = Buffer.from(JSON.stringify(mptMeta)).toString("hex").toUpperCase();
  }

  return tx;
}
```

Notes:
- **No `VaultKind` / `SubscriptionDate` / `RedemptionDate`** — open-ended only (see §5, this is now fatal on public devnet).
- **No `DomainID`** — the app never creates a private vault, despite XLS-80 being listed under "Out of scope (TBD)".
- **No `Scale`** — the IOU share-scale knob is not exposed.
- Hand-rolls the XLS-89 compressed metadata keys (`t`,`n`,`d`,`i`,`ac`,`as`,`in`) instead of using
  `xrpl.encodeMPTokenMetadata()`, which *is* present in `xrpl@4.5.0`+ and *is* what the official
  code samples use. Two official Ripple artifacts, two different ways. The hand-rolled version also omits
  `us` (URIs) and `ai` (additional_info).

### 3.2 `VaultDeposit` / `VaultWithdraw` / `VaultDelete` — `vault.ts:91-130`

```ts
export function buildVaultDeposit(
  depositorAddress: string, vaultId: string, amount: string | Record<string, string>
) {
  return { TransactionType: "VaultDeposit", Account: depositorAddress, VaultID: vaultId, Amount: amount };
}

export function buildVaultWithdraw(
  address: string, vaultId: string, amount: string | Record<string, string>
) {
  return { TransactionType: "VaultWithdraw", Account: address, VaultID: vaultId, Amount: amount };
}

export function buildVaultDelete(ownerAddress: string, vaultId: string) {
  return { TransactionType: "VaultDelete", Account: ownerAddress, VaultID: vaultId };
}
```

`VaultSet` and `VaultClawback` are **never built** anywhere in the app.

### 3.3 Shared submit — `vault.ts:136-158`

```ts
export async function submitTransaction(wallet: Wallet, tx: Record<string, unknown>) {
  const client = await getXrplClient();
  const prepared = await client.autofill(withSourceTag(tx) as any);
  const signed = wallet.sign(prepared);
  const result = await client.submitAndWait(signed.tx_blob);
  assertTxSuccess(result, String(tx.TransactionType || "Transaction"));
  return result;
}

export async function getVaultInfo(vaultId: string) {
  const client = await getXrplClient();
  const result = await (client as any).request({ command: "vault_info", vault_id: vaultId });
  return result;
}
```

`(client as any).request({command:"vault_info"})` — `vault_info` is **not** in xrpl.js's typed request union
in v4.6.0, hence the cast. Same cast for the `ledger` command in `helpers.ts:155`.

### 3.4 `LoanBrokerSet` + cover — `src/lib/xrpl/broker.ts:32-91`

```ts
export function buildLoanBrokerSet(
  brokerAddress: string, vaultId: string, options: BrokerOptions = {}
) {
  const tx: Record<string, unknown> = {
    TransactionType: "LoanBrokerSet",
    Account: brokerAddress,
    VaultID: vaultId,
  };
  if (options.managementFeeRate !== undefined) tx.ManagementFeeRate = options.managementFeeRate;
  if (options.debtMaximum !== undefined) tx.DebtMaximum = options.debtMaximum;
  if (options.coverRateMinimum !== undefined) tx.CoverRateMinimum = options.coverRateMinimum;
  if (options.coverRateLiquidation !== undefined) tx.CoverRateLiquidation = options.coverRateLiquidation;
  return tx;
}

export function buildLoanBrokerCoverDeposit(brokerAddress, loanBrokerId, amount) {
  return { TransactionType: "LoanBrokerCoverDeposit", Account: brokerAddress,
           LoanBrokerID: loanBrokerId, Amount: amount };
}
export function buildLoanBrokerCoverWithdraw(brokerAddress, loanBrokerId, amount) {
  return { TransactionType: "LoanBrokerCoverWithdraw", Account: brokerAddress,
           LoanBrokerID: loanBrokerId, Amount: amount };
}
export function buildLoanBrokerDelete(brokerAddress, loanBrokerId) {
  return { TransactionType: "LoanBrokerDelete", Account: brokerAddress, LoanBrokerID: loanBrokerId };
}
```

Documented units (broker.ts:5-7): `ManagementFeeRate` UINT16 range **0–10_000** (0–10 %);
`CoverRateMinimum` / `CoverRateLiquidation` UINT32 range **0–100_000** (0–100 %); all in **1/10 bps**.
`LoanBrokerCoverClawback` exists in xrpl.js but is **never built** by this app.

Route-level guardrail (`src/app/api/broker/route.ts:63-72`), citing the spec:

```ts
// XLS-66 §3.3.3.1 #7: CoverRateMinimum and CoverRateLiquidation must be
// both zero or both non-zero (out-of-range values already 400'd above).
const coverMin = Number(brokerOptions.coverRateMinimum || 0);
const coverLiq = Number(brokerOptions.coverRateLiquidation || 0);
if (coverMin > 0 !== coverLiq > 0) { /* 400 */ }
```

### 3.5 `LoanSet` — `src/lib/xrpl/loan.ts:51-77`

```ts
export function buildLoanSet(params: LoanSetParams) {
  const tx: Record<string, unknown> = {
    TransactionType: "LoanSet",
    Account: params.brokerAddress,
    Counterparty: params.borrowerAddress,
    LoanBrokerID: params.loanBrokerId,
    PrincipalRequested: params.principalRequested,
    InterestRate: bpsToTenthBps(params.interestRate),
    PaymentTotal: params.paymentTotal,
    PaymentInterval: params.paymentInterval,
    GracePeriod: params.gracePeriod,
    LoanOriginationFee: params.originationFee,
    LoanServiceFee: params.serviceFee,
    SigningPubKey: "",
  };

  if (params.latePaymentFee) tx.LatePaymentFee = params.latePaymentFee;
  if (params.closePaymentFee) tx.ClosePaymentFee = params.closePaymentFee;
  if (params.overpaymentFee !== undefined) tx.OverpaymentFee = params.overpaymentFee;
  if (params.lateInterestRate !== undefined) tx.LateInterestRate = params.lateInterestRate;
  if (params.closeInterestRate !== undefined) tx.CloseInterestRate = params.closeInterestRate;
  if (params.overpaymentInterestRate !== undefined) tx.OverpaymentInterestRate = params.overpaymentInterestRate;
  if (params.data) tx.Data = params.data;
  if (params.allowOverpayment) tx.Flags = LoanSetFlags.tfLoanOverpayment;

  return tx;
}
```

`SigningPubKey: ""` is set explicitly and then **overwritten** by `wallet.sign()`. The official
`_code-samples` version omits it entirely. Harmless but confusing — it reads like a multisign marker.

### 3.6 The multi-party `LoanSet` signature — `loan.ts:90-109`

```ts
export async function signAndSubmitLoanSet(
  brokerWallet: Wallet,
  borrowerWallet: Wallet,
  loanSetTx: Record<string, unknown>
) {
  const client = await getXrplClient();
  const prepared = await client.autofill(withSourceTag(loanSetTx) as any);

  const brokerSigned = brokerWallet.sign(prepared);
  const fullySigned = (
    xrpl as unknown as {
      signLoanSetByCounterparty: (wallet: Wallet, blob: string) => { tx_blob: string };
    }
  ).signLoanSetByCounterparty(borrowerWallet, brokerSigned.tx_blob);

  const result = await client.submitAndWait(fullySigned.tx_blob);
  assertTxSuccess(result, "LoanSet");
  return result;
}
```

Shape: **`Account` (broker) signs first → `Counterparty` (borrower) counter-signs** over the first
party's blob, producing `CounterpartySignature: { SigningPubKey, TxnSignature }`. Both signatures
travel in one transaction; there is no second submit. Because both wallets are server-custodial, the
"multi-party" flow is entirely server-side — there is no real two-device handoff to copy.

Two problems:
1. **The `as unknown as {...}` cast is unnecessary.** `signLoanSetByCounterparty` is exported and fully
   typed from the package root in 4.6.0 — `dist/npm/Wallet/index.d.ts` ends with
   `export { signLoanSetByCounterparty, combineLoanSetCounterpartySigners, } from './counterpartySigner';`
   and `src/index.ts:12` does `export * from './Wallet'`. `counterpartySigner.d.ts` declares
   `(wallet: Wallet, transaction: LoanSet | string, opts?) => { tx; tx_blob; hash }`, and a `string` blob is
   accepted. The cast also *narrows* the return to `{tx_blob}`, hiding `tx` and `hash`. Easy PR.
2. **The signature it produces is rejected by both devnets.** See §6.

### 3.7 `LoanPay` / `LoanManage` / `LoanDelete` — `loan.ts:122-166`

```ts
export function buildLoanPay(
  borrowerAddress: string, loanId: string,
  amount: string | Record<string, string>, flags?: number
) {
  const tx: Record<string, unknown> = {
    TransactionType: "LoanPay", Account: borrowerAddress, LoanID: loanId, Amount: amount,
  };
  if (flags) tx.Flags = flags;
  return tx;
}

export function buildLoanDelete(accountAddress: string, loanId: string) {
  return { TransactionType: "LoanDelete", Account: accountAddress, LoanID: loanId };
}

export function buildLoanManage(brokerAddress: string, loanId: string, flag: number) {
  return { TransactionType: "LoanManage", Account: brokerAddress, LoanID: loanId, Flags: flag };
}
```

Mode → flag mapping (`src/app/api/loan/repay/route.ts:60-67`):

```ts
const flag =
  mode === "full"        ? LoanPayFlags.tfLoanFullPayment
  : mode === "late"      ? LoanPayFlags.tfLoanLatePayment
  : mode === "overpayment" ? LoanPayFlags.tfLoanOverpayment
  : undefined;
```

`README.md` flag table (this is the single most useful paragraph in the repo):

| Flag | Value | When set |
|---|---|---|
| `tfLoanLatePayment` | `0x040000` | auto when `now > Loan.NextPaymentDueDate` |
| `tfLoanFullPayment` | `0x020000` | UI "Pay in full" |
| `tfLoanOverpayment` | `0x010000` | UI "Overpayment"; loan must have been created with `tfLoanOverpayment` on `LoanSet` |

> "Without the appropriate flag the ledger either rejects the tx or falls through to the
> regular-installment path, which is why the close fees / late fees configured at origination don't appear
> to be enforced unless the flag is present."

### 3.8 Transaction-flag vs ledger-object-flag trap — `src/lib/constants.ts:49-58`

```ts
/**
 * `Loan` ledger-OBJECT flags (XLS-66 §3.2.3). These differ from the LoanSet /
 * LoanManage *transaction*-flag enums — e.g. the tx flag tfLoanOverpayment is
 * 0x00010000, but on the Loan object lsfLoanOverpayment is 0x00040000
 * (0x00010000 on the object is lsfLoanDefault). ...
 */
export const LSF_LOAN_DEFAULT    = 0x00010000;
export const LSF_LOAN_IMPAIRED   = 0x00020000;
export const LSF_LOAN_OVERPAYMENT = 0x00040000;
```

**The tx-flag and object-flag namespaces collide numerically with inverted meanings.** xrpl.js ships the
`tf*` enums but **no `lsf*` enum for the `Loan` object**, so every consumer must hand-roll these three
constants. Used at `src/app/api/loan/route.ts:201`:

```ts
// A defaulted loan also reports PaymentRemaining == 0; the
// lsfLoanDefault flag distinguishes it from a genuine full repayment.
if ((Number(node.Flags) & LSF_LOAN_DEFAULT) !== 0) { doc.status = "defaulted"; }
```

### 3.9 Rate units and MPT scaling

`src/lib/constants.ts:60-64` — all XLS-66 rate fields are **1/10 bps, 1 unit = 0.001 %**:

```ts
export const percentToTenthBps = (percent: number) => Math.round(percent * 1000);
export const bpsToTenthBps = (bps: number) => bps * 10;
export const tenthBpsToPercent = (tenthBps: number) => tenthBps / 1000;
```

Applies to `InterestRate`, `LateInterestRate`, `CloseInterestRate`, `OverpaymentInterestRate`,
`OverpaymentFee`, `ManagementFeeRate`, `CoverRateMinimum`, `CoverRateLiquidation`.

MPT amounts are integers scaled by `AssetScale` (demo uses 2). `helpers.ts:61-77` is the single tx boundary:

```ts
export function buildAmountField(issuedToken, humanAmount): string | Record<string, string> {
  if (!hasIssuedToken(issuedToken)) return humanAmount;              // XRP drops
  if (issuedToken!.type === "IOU") {
    return { currency: issuedToken!.currency!, issuer: issuedToken!.issuer!, value: humanAmount };
  }
  return { mpt_issuance_id: issuedToken!.mptIssuanceId!, value: humanToMptUnits(humanAmount) };
}
```

Read-back unscaling is `unscaleVaultNodeForMPT` (fields `AssetsTotal`, `AssetsAvailable`, `AssetsMaximum`,
`LossUnrealized`) and `unscaleLoanNodeForMPT` (`PrincipalRequested`, `PrincipalOutstanding`,
`TotalValueOutstanding`, `PeriodicPayment`, `LoanServiceFee`, `LoanOriginationFee`, `LatePaymentFee`,
`ClosePaymentFee`, `ManagementFeeOutstanding`, `CoverAvailable`, `DebtTotal`, `DebtMaximum`).
That list is a good checklist of every amount-typed XLS-66 field.

Comment at `src/app/api/loan/route.ts:56-57` is worth stealing:

> "MPT ledger convention: integer units scaled by AssetScale (else `tecPRECISION_LOSS` fires because the
> on-chain amortization rounds a sub-scale value to zero)."

### 3.10 Loan math — `src/lib/loan-math.ts`

Three spec-cited pure functions, no network/UI deps. Amortization (§A-2.1 formulas 5–7):

```ts
const annualRate = interestRateBps / 10_000;
const periodicRate = (annualRate * paymentInterval) / SECONDS_PER_YEAR;   // SECONDS_PER_YEAR = 365*86400
const raised = Math.pow(1 + periodicRate, paymentTotal);
const factor = (periodicRate * raised) / (raised - 1);
periodicPayment = principal * factor;
totalOutstanding = periodicPayment * paymentTotal;
```

Early full payment (§A-3.2.4):

```ts
const annualRate = interestRateTenthBps / 100_000;   // 1/10 bps → decimal
const closeRate  = closeInterestRateTenthBps / 100_000;
const periodicRate = (annualRate * paymentInterval) / SECONDS_PER_YEAR;
accruedInterest   = principalOutstanding * periodicRate * (secondsSinceLastPayment / paymentInterval);
prepaymentPenalty = principalOutstanding * closeRate;
totalDue = principalOutstanding + accruedInterest + prepaymentPenalty + closePaymentFee;
```

Late payment (§A-3.2.2, formula 15):

```ts
latePeriodicRate = (lateInterestRateTenthBps / 100_000) * secondsOverdue / SECONDS_PER_YEAR;
lateInterest = principalOutstanding * latePeriodicRate;
totalDue = periodicPayment + serviceFee + latePaymentFee + lateInterest;
```

Both time-sensitive totals are recomputed **server-side against the latest validated ledger close time**
(`helpers.ts:152-160`, `command: "ledger", ledger_index: "validated"` → `close_time`), then a residual
buffer is added (`100` drops for XRP, `0.001` for tokens) and rounded **up**, because client clock drift
would otherwise land below the ledger's threshold. Good pattern; copy it.

---

## 4. xrpl.js version landscape (this is the decision that matters)

`npm view xrpl dist-tags` (2026-09-12):

```json
{ "latest": "5.2.0", "beta-experimental": "5.2.0-beta.1",
  "smart-contract-experimental": "4.7.0-smartcontract.0",
  "batch-experimental": "5.1.0-batch.1", "smart-escrow-experimental": "5.1.0-smartescrow.1" }
```

Publish times (`npm view xrpl time`):
`5.2.0-beta.0` → **2026-09-10T13:42:46Z**, `5.2.0-beta.1` → **2026-09-11T16:59:54Z**,
`5.2.0` (stable) → **2026-09-11T22:20:39Z**.

### 4.1 The two axes

Unpacked every tarball and diffed `src/`:

| version | V1.1 closed-ended fields (`VaultKind`/`SubscriptionDate`/`RedemptionDate`) | counterparty signing prefix |
|---|---|---|
| `4.6.0` | ❌ absent | ❌ old (`STX`) |
| `5.2.0-beta.0` | ✅ present | ❌ old (`STX`) |
| **`5.2.0-beta.1`** | ✅ present | ✅ new (`CPT`) |
| `5.2.0` **stable** | ❌ **absent** | ✅ new (`CPT`) |

```
$ diff -u v5.2.0/package/src/models/transactions/vaultCreate.ts \
         v5.2.0-beta.0/package/src/models/transactions/vaultCreate.ts
+export enum VaultKind { vaultKindOpen = 0, vaultKindClosed = 1 }
+  VaultKind?: number
+  SubscriptionDate?: number
+  RedemptionDate?: number
+const MIN_INVESTMENT_PERIOD = 180
+const MAX_INVESTMENT_PERIOD = 946708560
...
$ grep -rn "VaultKind" v5.2.0/package/src        # (no output — absent from stable)
```

`diff -u 4.6.0/.../vaultCreate.ts 5.2.0/.../vaultCreate.ts` → **empty**. Stable 5.2.0's vault/loan models
are byte-identical to 4.6.0's. **`5.2.0` stable is not a superset of `5.2.0-beta.0`.** Semver says
`5.2.0-beta.0 < 5.2.0`, so `npm install xrpl@latest` looks like an upgrade and is a silent feature
*removal*. This is the single most dangerous packaging trap in the ecosystem right now.

Validator constants from `5.2.0-beta.1` `vaultCreate.ts`:

```ts
/** 180s is the smallest window that can still fit a minimum-interval loan plus
 *  the 60s redemption buffer enforced by LoanSet (see rippled `kMinInvestmentPeriod`). */
const MIN_INVESTMENT_PERIOD = 180
const MAX_INVESTMENT_PERIOD = 946708560   // 30 Gregorian years, exclusive
```

and the rules: closed-ended **requires both** dates; open-ended must carry **neither**;
`RedemptionDate - SubscriptionDate ∈ [180, 946708560)`.

### 4.2 The signing-prefix split

`diff -u v5.2.0-beta.0/.../Wallet/counterpartySigner.ts v5.2.0-beta.1/...`:

```diff
-      TxnSignature: computeSignature(tx, wallet.privateKey),
+      TxnSignature: computeSignature(tx, wallet.privateKey, undefined, 'counterparty'),
```

and in `Wallet/utils.ts` beta.1 adds:

```ts
export type SignatureRole = 'transaction' | 'counterparty' | 'sponsor'
const SIGNING_ENCODERS = {
  transaction:  { single: encodeForSigning,             multi: encodeForMultisigning },
  counterparty: { single: encodeForSigningCounterparty, multi: encodeForMultisigningCounterparty },
  sponsor:      { single: encodeForSigningSponsor,      multi: encodeForMultisigningSponsor },
}
```

Offline proof — same broker-signed blob, four libraries:

```
4.6.0          CounterpartySignature.TxnSignature = 03B0DE39DEA28C98BDF4DBC4F850B618D7443050B306E556...
5.2.0-beta.0   CounterpartySignature.TxnSignature = 03B0DE39DEA28C98BDF4DBC4F850B618D7443050B306E556...
5.2.0-beta.1   CounterpartySignature.TxnSignature = 5A8F8B07397456E14FF8C7CD4F2C90A7BF67D78BF1F4B23A...
5.2.0          CounterpartySignature.TxnSignature = 5A8F8B07397456E14FF8C7CD4F2C90A7BF67D78BF1F4B23A...
```

Prefix constants (`ripple-binary-codec@2.11.0/dist/hash-prefixes.js:33-36`):

```js
// inner transaction to sign as the counterparty (fixCleanup3_4_0)
counterpartyTransactionSig: bytes(0x43505400),       // 'C','P','T'
// inner transaction to multi-sign as the counterparty (fixCleanup3_4_0)
counterpartyTransactionMultiSig: bytes(0x43504d00),  // 'C','P','M'
```

Dependency note: `xrpl@5.2.0-beta.0` declares `"ripple-binary-codec": "^2.11.0-beta.0"`, which resolves to
`2.11.0` stable — a codec that *does* export `encodeForSigningCounterparty`. beta.0 simply never calls it.

---

## 5. `LendingProtocolV1_1` makes open-ended vaults unusable for lending

`rippled` `src/libxrpl/tx/transactors/lending/LoanBrokerSet.cpp:148-160` (master, commit `9403736`):

```cpp
// LP V1.1: only closed-ended vaults may host a loan broker. The
// lending protocol relies on the closed-ended Subscription /
// Investment / Redemption phase structure; attaching a broker to
// an open-ended vault has no well-defined lifecycle. VaultCreate
// stays unrestricted so existing open-ended flows keep working;
// the constraint is enforced here, at the point where the vault
// is first bound to the lending protocol.
if (ctx.view.rules().enabled(featureLendingProtocolV1_1) &&
    getVaultKind(sleVault) != VaultKind::ClosedEnded)
{
    JLOG(ctx.j.warn()) << "LoanBroker requires a closed-ended Vault.";
    return tecNO_PERMISSION;
}
```

### Live network state (measured 2026-09-12)

`server_info`:

| | public devnet | hackathon devnet |
|---|---|---|
| endpoint | `https://s.devnet.rippletest.net:51234/` | `https://lending-hackathon.dev.ripplex.io:51234` |
| `build_version` | **3.4.0-rc5** | **3.4.0-rc1** |
| `network_id` | 2 | 4001 |
| `complete_ledgers` | 4593077-5251704 | 5-64294 |

Enabled amendments (read `ledger_entry` `amendments` object `7DB0788C…CD6EF4`, matched against
`sha512half(name)`): **both** networks have `SingleAssetVault`, `LendingProtocol`,
**`LendingProtocolV1_1`**, **`fixCleanup3_4_0`**, `PermissionedDomains`, `Credentials`, `TokenEscrow`,
`MPTokensV1` enabled. Neither has `MPTokensV2`, `Batch`, or `SponsoredFees`.

### Live repro — the two networks behave differently

```
[PUBLIC] VaultCreate(open)   -> tesSUCCESS vault=09152D5C9368444956B881EEE06FAABD6799C6AFE7E89CC3028C8CCC41CD6087
[PUBLIC] LoanBrokerSet on OPEN-ended vault   -> tecNO_PERMISSION
[PUBLIC] VaultCreate(closed) -> tesSUCCESS vault=0178E6085E12C04D889B1D73A2C3661B19584BF744F3C590ABC1B60025763460
[PUBLIC] LoanBrokerSet on CLOSED-ended vault -> tesSUCCESS
           loanBrokerID=D6B79E4E590D0D7FB0BC0FEA54F52CC136074B83F58D6613CDC9B3FCFD6FA89E

[HACK]   VaultCreate(open)   -> tesSUCCESS vault=6DBE63ED38DDDB8552FF440A97AA2EA3C4369AE378341AB57C6D96A4CFB6122D
[HACK]   LoanBrokerSet on OPEN-ended   -> tesSUCCESS
[HACK]   VaultCreate(closed) -> tesSUCCESS vault=B3630B3C00F71B032EE33C73EF021F4C8B556715553665E6FECB05B4D30D651D
[HACK]   LoanBrokerSet on CLOSED-ended -> tesSUCCESS
```

**Conclusion:** the two-track split in the event brief is enforced by the ledger builds themselves.
`3.4.0-rc1` (hackathon devnet) does **not** carry the `getVaultKind` gate, so Track 1's open-ended flow
works there. `3.4.0-rc5` (public devnet) does, so Track 2 **must** be closed-ended. Also: the hackathon
devnet accepts `VaultKind=1` closed-ended vaults too.

Consequence for the reference app and the official samples: **both build open-ended vaults and then call
`LoanBrokerSet`, so both are dead on public devnet.**

---

## 6. `fixCleanup3_4_0` breaks the counterparty signature in the pinned SDKs

`rippled` `src/libxrpl/protocol/Sign.cpp:46-73`:

```cpp
// Signature validity depends on fixCleanup3_4_0: a role signature covers
// different bytes before and after the amendment activates. ...
HashPrefix signingPrefix(SignatureRole role, bool multiSigning, Rules const& rules)
{
    // Before fixCleanup3_4_0 every signature on a transaction covered the same
    // bytes, so a signature could be moved from one role to another.
    if (!rules.enabled(fixCleanup3_4_0))
        return multiSigning ? HashPrefix::TxMultiSign : HashPrefix::TxSign;

    switch (role) {
        case SignatureRole::Transaction:  return multiSigning ? HashPrefix::TxMultiSign : HashPrefix::TxSign;
        case SignatureRole::Counterparty: return multiSigning ? HashPrefix::CounterpartyTxMultiSign
                                                             : HashPrefix::CounterpartyTxSign;
        case SignatureRole::Sponsor:      return multiSigning ? HashPrefix::SponsorTxMultiSign
                                                             : HashPrefix::SponsorTxSign;
    }
}
```

`include/xrpl/protocol/HashPrefix.h:99-114`:

```cpp
CounterpartyTxSign      = detail::makeHashPrefix('C', 'P', 'T'),   // 0x43505400
CounterpartyTxMultiSign = detail::makeHashPrefix('C', 'P', 'M'),   // 0x43504D00
SponsorTxSign           = detail::makeHashPrefix('S', 'P', 'N'),
SponsorTxMultiSign      = detail::makeHashPrefix('S', 'P', 'M'),
```

`rippled/API-CHANGELOG.md:36` (verbatim):

> `sign`, `sign_for`, `submit`, `submit_multisigned`: With `fixCleanup3_4_0` enabled, a signature in
> `CounterpartySignature` or `SponsorSignature` covers a different prefix than the transaction's own
> signature, so a signature can no longer be moved from one of those roles into another. Clients that
> build these signatures themselves must use the new prefixes: `CPT` and `CPM` (single- and
> multi-signing) for `CounterpartySignature`, and `SPN` and `SPM` for `SponsorSignature`.

### Live end-to-end repro on public devnet

Closed-ended XRP vault (`SubscriptionDate=842528752`, `RedemptionDate=842529352`), 60 XRP deposited during
Subscription, `LoanBrokerSet` OK, then in the Investment phase the **same** `LoanSet` body signed by four
libraries (broker `rXkCMCW9PaodPNNcw5CrFZ4q3qKrybeAU`, borrower `rBq4Z2VZ7pLY8xHEC5L7zXJjkzPtCxuxst`,
vault `88C858DC8E3F519ADD7E43D55CACD4C5119F4A4A3CEFB42CDD05A9FC75AFF305`,
broker `78DBB36F533DB2045E859D8F193CA25DB22F0DD00D2331115B669C7DF342B7F1`):

```
xrpl@4.6.0        (reference app + official samples) : SUBMIT ERROR ->
    fails local checks: Counterparty: Invalid signature.
xrpl@5.2.0-beta.0 (Track 2 mandated)                 : SUBMIT ERROR ->
    fails local checks: Transaction has bad signature.
xrpl@5.2.0-beta.1                                    : tesSUCCESS  hash=5F7F7DE1BC8709C82DAECFF8F2EA597D3C82710FCF255C0FD56781CD2CCF19CD
xrpl@5.2.0 stable                                    : tesSUCCESS  hash=D7B8EDB75858E1F0CA7B2D62E9D4C38842B1B9F2B58756BAA38833AE028E4C43
```

Side observation: the identical bad blob produced two *different* error strings on consecutive submits
("Counterparty: Invalid signature." then "Transaction has bad signature."), consistent with the
two-slot `checkValidity` cache described in the `Sign.cpp` block comment. Only the first message names
the actual field.

---

## 7. The other reference implementations

### 7.1 `XRPLF/xrpl-dev-portal/_code-samples/` — the "JavaScript and Python sample scripts"

Three language trees, all targeting **public devnet** `wss://s.devnet.rippletest.net:51233`:

```
_code-samples/lending-protocol/js/   lendingSetup.js createLoanBroker.js createLoan.js loanPay.js
                                     loanManage.js coverDepositAndWithdraw.js coverClawback.js
_code-samples/lending-protocol/py/   lending_setup.py create_loan_broker.py create_loan.py loan_pay.py
                                     loan_manage.py cover_deposit_and_withdraw.py cover_clawback.py
_code-samples/lending-protocol/go/   lending-setup/ create-loan-broker/ create-loan/ loan-pay/
                                     loan-manage/ cover-deposit-and-withdraw/ cover-clawback/
_code-samples/vaults/js/             vaultSetup.js createVault.js deposit.js withdraw.js
_code-samples/vaults/py/             vault_setup.py create_vault.py deposit.py withdraw.py
```

Pins: JS lending `"xrpl": "^4.6.0"`; JS vaults `"xrpl": "^4.5.0"`; Python `xrpl-py>=4.5.0`;
Go `github.com/Peersyst/xrpl-go v0.1.17`.

**`js/createLoan.js:57-78` — the canonical multi-party signature:**

```js
// Loan broker signs first
const loanBrokerSigned = loanBroker.sign(loanSetTx)
const loanBrokerSignedTx = xrpl.decode(loanBrokerSigned.tx_blob)
// Borrower signs second
const fullySigned = xrpl.signLoanSetByCounterparty(borrower, loanBrokerSignedTx)
xrpl.validate(fullySigned.tx)
const submitResponse = await client.submitAndWait(fullySigned.tx)
```

Differences vs the reference app: passes a **decoded object** (not the blob string), calls
`xrpl.validate()` before submit, submits `fullySigned.tx` rather than `fullySigned.tx_blob`, and does
**not** set `SigningPubKey: ""`. Same end result; two official styles for one operation.

`js/createLoan.js:32-33` documents the ordering rule cleanly — steal this sentence:

> "Account and Counterparty accounts can be swapped, but determines signing order. Account signs first,
> Counterparty signs second."

Both JS and Python scripts **suppress warnings** to hide an SDK complaint:
`js/lendingSetup.js:267` → `console.warn = () => {}  // Suppress unnecessary console warning from autofilling LoanSet.`
An official sample silencing its own SDK is a smell worth reporting.

**`js/lendingSetup.js` is the best "Loaded flavour" template in existence** — it wires
`PermissionedDomainSet` + `CredentialCreate`/`CredentialAccept` + MPT issuance + a **private** vault in
one file:

```js
const credentialType = xrpl.convertStringToHex('KYC-Verified')
// ... PermissionedDomainSet with AcceptedCredentials: [{ Credential: { Issuer, CredentialType } }]
// ... CredentialCreate for loanBroker, borrower, depositor; then CredentialAccept by each
client.submitAndWait({
  TransactionType: 'VaultCreate',
  Account: loanBroker.address,
  Asset: { mpt_issuance_id: mptID },
  Flags: xrpl.VaultCreateFlags.tfVaultPrivate,
  DomainID: domainID
}, { wallet: loanBroker, autofill: true })
```

It also uses `TicketCreate` + `TicketSequence` to fan out independent transactions from one account in
parallel — a genuinely useful trick for a demo that must run fast on stage.

`vaults/js/createVault.js:45-67` uses the SDK helper instead of hand-rolled hex:

```js
MPTokenMetadata: xrpl.encodeMPTokenMetadata({
  ticker: "SHARE1", name: "Vault shares", desc: "...", icon: "example.com/asset-icon.png",
  asset_class: "defi", issuer_name: "Asset Issuer Name",
  uris: [{ uri: "example.com/asset", category: "website", title: "Asset Website" }, ...],
  additional_info: { example_info: "test" },
}),
AssetsMaximum: "0", // No cap
WithdrawalPolicy: xrpl.VaultWithdrawalPolicy.vaultStrategyFirstComeFirstServe,
```

**Status: every one of these lending scripts is broken on public devnet today** — open-ended vault
(§5) *and* `xrpl@4.6.0` counterparty prefix (§6).

### 7.2 `xrpl-py` — worse

`xrpl/transaction/counterparty_signer.py` on `main`:

```python
from xrpl.core.binarycodec import encode, encode_for_multisigning, encode_for_signing
...
    return keypairs_sign(bytes.fromhex(encode_for_signing(tx_json)), private_key)
```

and `xrpl/core/binarycodec/main.py` on `main` defines only:

```python
_TRANSACTION_SIGNATURE_PREFIX  = _num_to_bytes(0x53545800)   # STX
_PAYMENT_CHANNEL_CLAIM_PREFIX  = _num_to_bytes(0x434C4D00)
_TRANSACTION_MULTISIG_PREFIX   = _num_to_bytes(0x534D5400)
_BATCH_PREFIX                  = _num_to_bytes(0x42434800)
```

There is **no `CPT`/`CPM` prefix anywhere in xrpl-py**, and no `encode_for_signing_counterparty`.
Latest PyPI release is `5.1.0` (plus a `5.2.0b0` pre-release). **`sign_loan_set_by_counterparty` cannot
produce a valid signature on any network with `fixCleanup3_4_0` enabled** — which is both hackathon
networks. Python is not a viable path for `LoanSet` right now.

### 7.3 Other

- **`ripple/xrpl-reference-app-lending-sav`** — this doc's subject.
- **<https://tests.xrpl-commons.org/lending>** — an XRPL Commons web tool: "Create loans, make payments,
  and manage loan lifecycle". Footer says "A tool developed by XRPL Commons" with a GitHub link, but no
  matching public repo is findable under the `XRPL-Commons` org (only `xrpl-test` and `xrpl-confluence`);
  the page states neither the target network nor an SDK version.
- **`XRPLF/rippled` `src/test/app/lending/`** — the real executable spec: `LoanLifecycle_test.cpp`,
  `LoanPay_test.cpp`, `LoanCashBasis_test.cpp` (V1.1 cash-basis accounting), `LoanRounding_test.cpp`,
  `LoanInvariants_test.cpp`, `LoanCoverFreezeAuth_test.cpp`, `LoanSecurity_test.cpp`, `LoanBroker_test.cpp`.
  When docs and SDK disagree, these files win.
- No lending sample exists in `xrpl4j` beyond the `VaultCreate` model class.

---

## 8. What the app reads for position value / utilisation / yield

### Reads, per README + verified in code

| data | method |
|---|---|
| XRP balance | `account_info` → `Balance` |
| IOU balance | `account_lines` filtered by issuer |
| MPT balance | `account_objects` type `mptoken` |
| vault state | **`vault_info`** → returns `result.vault` (full entry **plus** a nested `shares` MPTokenIssuance) |
| Loan / LoanBroker | `ledger_entry` with `index: <id>`, `ledger_index: "validated"` |
| "now" for accrual | `ledger` `ledger_index: "validated"` → `close_time` (Ripple epoch) |

`vault_info` returns a very convenient composite — confirmed live:

```json
{ "Account": "r5yu3...", "Asset": {"currency":"XRP"}, "Flags": 0, "Owner": "rL52x...",
  "ShareMPTID": "0000000107F08D162F49C3329D047D483FB1767FED5EA9BB", "WithdrawalPolicy": 1,
  "shares": { "LedgerEntryType": "MPTokenIssuance", "OutstandingAmount": "0",
              "Flags": 56, "mpt_issuance_id": "0000000107F08D162F49C3329D047D483FB1767FED5EA9BB" } }
```

### Displayed

Depositor (`dashboard/depositor/page.tsx:196-250`): **Total Assets** (`AssetsTotal`), **Available**
(`AssetsAvailable`), **Shares** (`shares.OutstandingAmount / 10^(shares.AssetScale ?? 6)`), **Deposit Cap**
(`AssetsMaximum`, `"0"` → "Unlimited"), plus Public/Private, share transferability
(`shares.Flags & MPTokenIssuanceCreateFlags.tfMPTCanTransfer`), and `WithdrawalPolicy`.

Broker (`dashboard/broker/vault-details.tsx`): same vault stats plus **`CoverAvailable`** and **`DebtTotal`**
off the LoanBroker node.

### The gaps that matter for a fresh build

- **No price-per-share.** `grep -rni "sharePrice\|pricePerShare\|PPS\|exchangeRate\|APY\|apr"` over `src/`
  returns **nothing**. PPS = `AssetsTotal / shares.OutstandingAmount` is never computed.
- **No utilisation.** `grep -rni "utilis\|utiliz"` → nothing. `(AssetsTotal − AssetsAvailable) / AssetsTotal`
  is never shown even though both inputs are on screen.
- **PNL assumes a single depositor.** `dashboard/depositor/history.tsx:66-74`:
  ```ts
  // Calculate PNL: total withdrawn + current position - total deposited
  const currentPosition = parse(vaultAssetsTotal || "0");
  const pnl = totalWithdrawn + currentPosition - totalDeposited;
  const pnlPercent = totalDeposited > 0 ? ((pnl / totalDeposited) * 100).toFixed(2) : "0.00";
  ```
  `currentPosition` is the **whole vault's** `AssetsTotal`. Correct form for >1 lender:
  `position = sharesHeld × AssetsTotal / shares.OutstandingAmount`.
  The repo admits it at `api/vault/withdraw/route.ts:48-50`:
  > "The demo uses a single depositor per session so AssetsAvailable maps 1:1 to their share; for a
  > multi-depositor fork this helper should instead compute `shares × (AssetsAvailable / OutstandingAmount)`."
- **`LossUnrealized` is unscaled but never rendered** (`helpers.ts:209` lists it; no UI reads it).
- Deposit/withdraw history is **MongoDB-only** — an audit trail of tx hashes, not reconstructable from chain.

---

## 9. Mocked, missing, or deliberately out of scope

- **No drawdown step.** There is no `LoanDraw` transaction — not in the app, and not in xrpl.js 4.6.0,
  5.2.0-beta.0/beta.1 or 5.2.0 (`ls src/models/transactions/ | grep -i loan` → set is identical across all
  four: `loanSet, loanPay, loanManage, loanDelete, loanBrokerSet, loanBrokerDelete,
  loanBrokerCoverDeposit, loanBrokerCoverWithdraw, loanBrokerCoverClawback`). Principal moves at
  `LoanSet`; "drawdown" is the origination disbursement.
- **Never built:** `VaultSet`, `VaultClawback`, `LoanBrokerCoverClawback`.
- **README "Out of scope (TBD)":** private vaults with `PermissionedDomain` credentials (XLS-80),
  collateralised loans via `TokenEscrow` (XLS-85), batch issuance (XLS-56), secondary share market.
  So the whole Loaded-flavour surface is absent here — but present in `lendingSetup.js` (§7.1).
- **Wallets are server-custodial.** Four wallets per user (broker, depositor, borrower, issuer), seeds
  AES-256-GCM encrypted at rest (`v1:<iv>:<tag>:<ciphertext>`, `src/lib/crypto.ts`), decrypted server-side
  at signing. The README is blunt: *"a real lending product wouldn't give one server custody of the broker,
  depositor, and borrower keys at the same time."*
- **Impairment is not in the UI.** `LoanManageFlags.tfLoanImpair` / `tfLoanUnimpair` are exported but only
  `tfLoanDefault` is wired (`api/loan/default/route.ts:34`).
- **Known rippled bug carried as a comment** — `api/vault/withdraw/route.ts:39-46`:
  > "Known rippled limitation (XRPLF/rippled#6955): on the pre-fix build running on devnet, the vault
  > invariant rounds IOU/MPT balance deltas inconsistently with the operation itself. Any `VaultWithdraw`
  > whose delta lands on a non-canonical IOU mantissa can fail with `tecINVARIANT_FAILED` — full redemption
  > is the most reliable trigger..."
- **Cleanup ordering** (README) — any out-of-order step gives `tecHAS_OBLIGATIONS`:
  ```
  for each active loan: LoanManage(tfLoanDefault) → LoanDelete
  LoanBrokerCoverWithdraw → LoanBrokerDelete → VaultDelete
  ```
- Heavy infra tax to run it at all: Auth0 tenant + MongoDB + `WALLET_ENCRYPTION_KEY` before first login.

---

## 10. Faucets differ — `client.fundWallet()` does not work on the hackathon devnet

```
$ curl -s -X POST https://lending-hackathon-faucet.dev.ripplex.io/accounts -d '{}'
{ "account": { "address": "rh8uEZ...", "secret": "sEdVj1GGD2wYiYrvPpTP3Q8ys8aoyrS" }, "balance": 1000 }

$ curl -s -X POST https://faucet.devnet.rippletest.net/accounts -d '{}'   # keys:
["account","amount","seed","transactionHash"]   account keys: ["address","classicAddress","xAddress"]
```

xrpl.js `Wallet/defaultFaucets.ts:4-12` requires:

```ts
export interface FaucetWallet {
  account: { xAddress: string; classicAddress?: string; secret: string }
  amount: number
  balance: number
}
```

The hackathon faucet returns `account.address` + `account.secret` and **no `xAddress`/`classicAddress`**,
so `fundWallet` dies at `Wallet/fundWallet.ts:192-196` with
`XRPLFaucetError: The faucet account is undefined`. Reproduced. Also note the balances differ:
**hackathon faucet = 1000 XRP, public devnet faucet = 100 XRP** (verified `account_info` → `Balance:
"99999999"`). Any amount tuned on one network will misbehave on the other.

Workaround to use in our app:

```js
async function fundOn(network, faucetUrl, client) {
  const r = await fetch(faucetUrl, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: '{}' })
  const j = await r.json()
  const secret = j.seed ?? j.account?.secret ?? j.secret   // covers both shapes
  const wallet = xrpl.Wallet.fromSeed(secret)
  for (let i = 0; i < 20; i++) {                            // poll until funded
    try { await client.request({ command: 'account_info', account: wallet.classicAddress,
                                 ledger_index: 'validated' }); break }
    catch { await new Promise(res => setTimeout(res, 1500)) }
  }
  return wallet
}
```

---

## 11. Safely reusable in a fresh Next.js app

**Copy nearly verbatim**

| file | why | caveat |
|---|---|---|
| `src/lib/loan-math.ts` | pure, spec-cited (§A-2.1, §A-3.2.2, §A-3.2.4), zero deps | V1 whole-life accounting; V1.1 is cash-basis, so re-check against `LoanCashBasis_test.cpp` |
| `src/lib/constants.ts` rate helpers | `percentToTenthBps` / `bpsToTenthBps` / `tenthBpsToPercent`, `RIPPLE_EPOCH_OFFSET = 946_684_800`, `SECONDS_PER_YEAR = 365*86400` | — |
| `LSF_LOAN_DEFAULT/IMPAIRED/OVERPAYMENT` | xrpl.js ships no `lsf*` enum for the `Loan` object | — |
| `helpers.ts`: `buildAmountField`, `humanToMptUnits`, `unscaleVaultNodeForMPT`, `unscaleLoanNodeForMPT`, `extractCreatedLedgerId`, `assertTxSuccess`, `isLedgerEntryNotFound`, `sanitizeLedgerError`, `getValidatedCloseTime` | the amount-field list is the best available checklist | — |
| `broker.ts` builders | plain objects, no version coupling | — |
| `vault.ts` builders | plain objects | **add `VaultKind`/`SubscriptionDate`/`RedemptionDate`** for Track 2 |
| `loan.ts` `buildLoanSet` / `buildLoanPay` / `buildLoanManage` / `buildLoanDelete` | plain objects | drop the `SigningPubKey: ""` |
| `client.ts` connection singleton | correct promise-dedup | — |
| the README's `LoanPay` flag table and cleanup-order block | the highest-density docs in the repo | — |

**Rewrite, do not copy**

- `signAndSubmitLoanSet` — remove the `as unknown as` cast and use **`xrpl@5.2.0-beta.1`**:
  ```ts
  import { signLoanSetByCounterparty } from "xrpl";
  const prepared = await client.autofill(loanSetTx);
  const brokerSigned = brokerWallet.sign(prepared);
  const fullySigned = signLoanSetByCounterparty(borrowerWallet, brokerSigned.tx_blob);
  const result = await client.submitAndWait(fullySigned.tx_blob);
  ```
- PNL / position — use `sharesHeld × AssetsTotal / shares.OutstandingAmount`; add PPS and utilisation.
- `explorer.ts` — make `EXPLORER_BASE` env-driven; the hackathon devnet needs
  `https://custom.xrpl.org/lending-hackathon.dev.ripplex.io:51233/`.
- `wallet.ts` `generateAndFundWallet` — `client.fundWallet` fails on the hackathon faucet (§10).
- Skip entirely: Auth0, MongoDB, `crypto.ts`, `rate-limit.ts`, `proxy.ts`, the whole `api/session/*` tree.
  For a 23-hour hackathon build, keep seeds in memory / a JSON file and go direct.

---

## 12. Friction log (with proposed fixes)

1. **`github.com/ripple/lending-demo` 404s.** → point every reference at
   `ripple/xrpl-reference-app-lending-sav`, or create `ripple/lending-demo` as a redirect repo. Add the
   repo URL to <https://opensource.ripple.com/docs/xls-66-lending-protocol> as a server-rendered link.
2. **`xrpl@5.2.0` stable silently drops the V1.1 closed-ended vault fields that `5.2.0-beta.0` has.**
   → either cut V1.1 as `5.3.0-beta.x` (a version semver orders *above* 5.2.0), or ship the fields in a
   stable release. At minimum, put a banner in the `5.2.0` release notes: "closed-ended vaults are only in
   the `beta-experimental` line".
3. **`xrpl@5.2.0-beta.0` cannot sign a `LoanSet` counterparty signature on any `fixCleanup3_4_0` network.**
   Both hackathon devnets have the amendment on. → deprecate `5.2.0-beta.0` on npm
   (`npm deprecate xrpl@5.2.0-beta.0 "counterparty signing is broken under fixCleanup3_4_0; use 5.2.0-beta.1"`)
   and update the hackathon brief to mandate `5.2.0-beta.1`.
4. **`xrpl-py` has no counterparty signing prefix at all.** `xrpl/core/binarycodec/main.py` defines only
   `STX`/`SMT`/`CLM`/`BCH`. → add `_COUNTERPARTY_TRANSACTION_SIGNATURE_PREFIX = 0x43505400` and
   `_COUNTERPARTY_TRANSACTION_MULTISIG_PREFIX = 0x43504D00`, expose
   `encode_for_signing_counterparty` / `encode_for_multisigning_counterparty`, and route
   `compute_signature` in `counterparty_signer.py` through them. Until then, mark
   `_code-samples/lending-protocol/py/` as non-functional.
5. **Official `_code-samples` lending scripts are broken twice over on public devnet** (open-ended vault
   → `tecNO_PERMISSION`; `xrpl@4.6.0` → `Counterparty: Invalid signature`). → bump to
   `xrpl@5.2.0-beta.1`, add `VaultKind: 1` + `SubscriptionDate`/`RedemptionDate` to
   `lendingSetup.js`/`lending_setup.py`, and add a CI job that runs them nightly against devnet.
6. **`VaultKind`, `SubscriptionDate`, `RedemptionDate` are undocumented on xrpl.org.**
   `docs/references/protocol/transactions/types/vaultcreate.md` lists `Data`, `Asset`, `AssetsMaximum`,
   `MPTokenMetadata`, `WithdrawalPolicy`, `DomainID`, `Scale` — and nothing else.
   `grep -rn "VaultKind\|SubscriptionDate\|RedemptionDate\|closed-ended" docs/` → no hits.
   → add the three fields with the `[180, 946708560)` investment-period rule, a `LendingProtocolV1_1`
   amendment disclaimer, and a Subscription/Investment/Redemption phase diagram.
7. **`LoanBrokerSet` → `tecNO_PERMISSION` is unhelpfully overloaded.** The same code covers "not the vault
   owner", "changing VaultID", "not the broker owner", and "vault is not closed-ended". → introduce a
   distinct code (e.g. `tecWRONG_VAULT_KIND`) or document the four cases on the `LoanBrokerSet` page.
   The `tecNO_PERMISSION` doc page should list them.
8. **The same bad blob yields two different error strings on consecutive submits** —
   `fails local checks: Counterparty: Invalid signature.` then `fails local checks: Transaction has bad
   signature.` → make the cached-verdict path re-emit the role-specific message.
9. **The hackathon faucet's JSON shape is incompatible with `client.fundWallet()`.**
   `{account:{address,secret},balance}` vs the expected `{account:{xAddress,classicAddress,secret},amount,balance}`.
   → either align the faucet, or relax `processSuccessfulResponse` to accept `account.address` and derive
   the classic address from the secret. Publish the workaround in the hackathon README either way.
10. **Two official Ripple artifacts encode XLS-89 MPT metadata two different ways.** The reference app
    hand-rolls `{t,n,d,i,ac,as,in}` hex; `_code-samples` uses `xrpl.encodeMPTokenMetadata({ticker,name,desc,
    icon,asset_class,issuer_name,uris,additional_info})`. → use the helper in both and document the
    long-key → short-key mapping on the XLS-89 page.
11. **`vault_info` is not in xrpl.js's typed request union**, forcing `(client as any).request(...)` in the
    reference app (`vault.ts:153`) and in every fork. → add `VaultInfoRequest`/`VaultInfoResponse` types.
12. **xrpl.js ships `tf*` enums for lending but no `lsf*` enum for the `Loan` ledger object**, and the two
    namespaces collide with inverted meanings (`tfLoanOverpayment = 0x00010000` vs
    `lsfLoanDefault = 0x00010000`). Every consumer hand-rolls three constants. → export
    `LoanFlags { lsfLoanDefault, lsfLoanImpaired, lsfLoanOverpayment }` and cross-link the two tables.
13. **The reference app's `signLoanSetByCounterparty` cast is unnecessary** (`loan.ts:100-104`) — the symbol
    is exported and typed from the package root in 4.6.0. It also hides `tx` and `hash` from the return.
    → one-line PR: `import { signLoanSetByCounterparty } from "xrpl"`.
14. **Official samples silence their own SDK**: `console.warn = () => {} // Suppress unnecessary console
    warning from autofilling LoanSet` in `lendingSetup.js:267` and `createLoan.js:37`. → fix the warning in
    `autofill` for `LoanSet` rather than teaching users to mute it.
15. **`explorer.ts` hardcodes `https://devnet.xrpl.org`** while the network is env-driven, so a
    re-pointed fork produces silently wrong explorer links. → derive from `XRPL_NETWORK_URL` or add
    `XRPL_EXPLORER_BASE`.
16. **The reference app's `README` claims a working end-to-end flow that no longer runs on its own default
    network.** → add a compatibility note ("requires rippled without the V1.1 broker gate, or a
    closed-ended vault") and pin `xrpl@5.2.0-beta.1`.
17. **Faucet grant sizes differ 10× between the two devnets** (1000 vs 100 XRP) with no documentation.
    A `VaultDeposit` of 500 XRP that works on the hackathon devnet returns `tecINSUFFICIENT_FUNDS` on
    public devnet — reproduced. → document both, or align them.
18. **`_code-samples/vaults/js/package.json` pins `xrpl@^4.5.0`** while every lending sample pins `^4.6.0`.
    Inconsistent, and both are now too old to sign a `LoanSet`. → unify.

---

## 13. Verified reference values

```
rippled master commit                9403736
CounterpartyTxSign  prefix           0x43505400  ('C','P','T')
CounterpartyTxMultiSign prefix       0x43504D00  ('C','P','M')
amendment id fixCleanup3_4_0         98433DD001A5737F773D74F8CA2A25A065089C73B2E611C760BAF369E4FECA76
amendment id LendingProtocol         565B90CA1AB2B9D42208ED10884188C64F9E19083DECB9634AAF06EB03299509
amendment id SingleAssetVault        81BD2619B6B3C8625AC5D0BC01DE17F06C3F0AB95C7C87C93715B87A4FD240D8
amendment id LendingProtocolV1_1     A360E2BFD775A5B0DCE1C36C16DF31B72735A57584FD163655D2F9564F8E7AC8
amendments ledger object index       7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4
MIN_INVESTMENT_PERIOD                180 s        MAX_INVESTMENT_PERIOD  946708560 s (exclusive)
RIPPLE_EPOCH_OFFSET                  946684800
LoanPay tfLoanOverpayment 0x010000 | tfLoanFullPayment 0x020000 | tfLoanLatePayment 0x040000
Loan obj lsfLoanDefault 0x010000 | lsfLoanImpaired 0x020000 | lsfLoanOverpayment 0x040000
LoanManage tfLoanDefault 65536 (0x10000) | tfLoanImpair 131072 (0x20000)
ManagementFeeRate 0..10_000 (1/10 bps) | CoverRate{Minimum,Liquidation} 0..100_000 (1/10 bps)
```

Successful Track-2-shaped `LoanSet` hashes on public devnet (proof the closed-ended path works):
`5F7F7DE1BC8709C82DAECFF8F2EA597D3C82710FCF255C0FD56781CD2CCF19CD` (xrpl@5.2.0-beta.1),
`D7B8EDB75858E1F0CA7B2D62E9D4C38842B1B9F2B58756BAA38833AE028E4C43` (xrpl@5.2.0).

## 14. Sources

- https://github.com/ripple/xrpl-reference-app-lending-sav (Apache-2.0, commit `b92c990`)
- https://lending.xls-demo.com/
- https://github.com/XRPLF/xrpl-dev-portal/tree/main/_code-samples/lending-protocol
- https://github.com/XRPLF/xrpl-dev-portal/tree/main/_code-samples/vaults
- https://github.com/XRPLF/xrpl-dev-portal/blob/main/docs/references/protocol/transactions/types/vaultcreate.md
- https://github.com/XRPLF/rippled — `src/libxrpl/protocol/Sign.cpp`,
  `include/xrpl/protocol/HashPrefix.h`, `src/libxrpl/tx/transactors/lending/LoanBrokerSet.cpp`,
  `include/xrpl/protocol/detail/features.macro`, `API-CHANGELOG.md`
- https://github.com/XRPLF/xrpl-py — `xrpl/transaction/counterparty_signer.py`,
  `xrpl/core/binarycodec/main.py`
- https://www.npmjs.com/package/xrpl (tarballs 4.5.0, 4.6.0, 5.2.0-beta.0, 5.2.0-beta.1, 5.2.0)
- https://www.npmjs.com/package/ripple-binary-codec (2.11.0)
- https://opensource.ripple.com/docs/xls-66-lending-protocol
- https://tests.xrpl-commons.org/lending
- live RPC: `https://s.devnet.rippletest.net:51234/`, `https://lending-hackathon.dev.ripplex.io:51234`
- live faucets: `https://faucet.devnet.rippletest.net/accounts`,
  `https://lending-hackathon-faucet.dev.ripplex.io/accounts`
