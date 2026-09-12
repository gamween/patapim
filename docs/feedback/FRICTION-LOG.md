# Friction log, patapim

Running log. Every entry is written the moment it happens, with the exact command, the exact
output and a concrete proposed fix. The three-page manual report required at the repository
root is written from it by hand, by us.

Environment under test:
- rippled `3.4.0-rc1` on the custom hackathon devnet (network_id 4001)
- rippled `3.4.0-rc5` on the public XRPL devnet (network_id 2)
- `xrpl.js@5.2.0-beta.0` and `xrpl.js@5.2.0` (stable), `ripple-binary-codec@2.11.0` in both

Severity: high = blocks a minimum-bar step, medium = costs real time or forces a workaround,
low = friction without a blocker.

---

## F-001 · xrpl.js 5.2.0-beta.0 signs LoanSet counterparty signatures with the wrong encoder
**Category** client libraries · **Severity** high · **Library** xrpl.js@5.2.0-beta.0

`signLoanSetByCounterparty()` builds a `CounterpartySignature` that rippled rejects. The
identical transaction, on the identical network, succeeds with stable `xrpl.js@5.2.0`.

Repro, custom hackathon devnet, `scripts/probe.mjs t1 open`:

| library | result |
|---|---|
| `xrpl.js@5.2.0-beta.0` | `fails local checks: Counterparty: Invalid signature.` |
| `xrpl.js@5.2.0` | `tesSUCCESS`, tx `42BDEBF81958D716070F1852CB5560A2DFBE05B017357838ACF35A9A3004A530` |

Every preceding step (`VaultCreate`, `VaultDeposit`, `LoanBrokerSet`, `LoanBrokerCoverDeposit`)
returns `tesSUCCESS` on both versions, so the divergence is isolated to the counterparty signature.

Cause, from the published sources of both packages:

```diff
# src/Wallet/counterpartySigner.ts   (< 5.2.0 stable, > 5.2.0-beta.0)
-      TxnSignature: computeSignature(tx, wallet.privateKey, undefined, 'counterparty'),
+      TxnSignature: computeSignature(tx, wallet.privateKey),

# src/Wallet/utils.ts
-  role: SignatureRole = 'transaction'   // SIGNING_ENCODERS[role] -> encodeForSigningCounterparty
-  ...                                   // beta.0 has no role parameter and always calls encodeForSigning
```

`ripple-binary-codec@2.11.0`, which **both** versions depend on, already exports
`encodeForSigningCounterparty`. The beta simply never calls it.

**Impact** Track 2 mandates `xrpl.js@5.2.0-beta.0`. On that version the library's own helper
cannot originate a loan, so minimum-bar step 3 is unreachable for any team that follows the
brief and trusts the SDK.

**Proposed fix** Backport the `role` argument to the beta line: two call sites in
`counterpartySigner.ts` (single-signer and multisign branches). Better, publish one release that
carries both the V1.1 vault types and the counterparty fix, and retire the beta requirement from
the brief.

**Workaround shipped here** `scripts/lib/lending.mjs → signCounterparty()` calls
`encodeForSigningCounterparty` from the codec directly, so the mandated beta can be used.

---

## F-002 · No published xrpl.js version carries both halves of the lending feature
**Category** client libraries · **Severity** high · **Library** xrpl.js 5.2.0 / 5.2.0-beta.0

The two releases diverge in opposite directions, verified by diffing the published tarballs:

| | 5.2.0 (npm `latest`) | 5.2.0-beta.0 |
|---|---|---|
| `VaultKind`, `SubscriptionDate`, `RedemptionDate` on `VaultCreate` | absent | present |
| same fields on the `Vault` ledger entry, plus `LEVersion` | absent | present |
| `CredentialIDs` on `VaultWithdraw`, `LoanBrokerCoverWithdraw` | absent | present |
| `MemoData` on `VaultDelete` | absent | present |
| counterparty signing role (F-001) | correct | broken |

A developer who installs `xrpl` from npm gets 5.2.0 and cannot model a closed-ended vault at all,
with no deprecation notice and no error pointing at the beta. Semver reads the wrong way round:
`5.2.0-beta.0` is *newer* in protocol coverage than the `5.2.0` that supersedes it.

**Proposed fix** One release with both, plus a feature/version matrix in the lending docs stating
which xrpl.js version supports V1 and which supports V1.1.

---

## F-003 · The two event faucets return incompatible payloads
**Category** UX · **Severity** low

```
custom devnet : {"account":{"address":"r...","secret":"sEd..."},"balance":1000}
public devnet : {"account":{"xAddress":"X...","address":"r...","classicAddress":"r..."},
                 "amount":100,"seed":"sEd...","transactionHash":"..."}
```

The secret is `account.secret` on one and `seed` on the other, and the funded amount differs by
10x. Any helper written for one track silently breaks when pointed at the other, which is exactly
what the brief's "do not mix tracks" warning is trying to prevent.

**Proposed fix** Serve the same shape from both faucets, or document the difference in the brief's
environment table next to the faucet URLs.

---

## F-004 · The brief's Track 1 amendment warning does not match the ledger
**Category** documentation · **Severity** medium

The brief's appendix states that Track 1 "must remain a V1 environment for new open-ended-vault
loans" and that enabling Lending Protocol V1.1 on the same ledger "would restrict new loans to
closed-ended vaults".

Reading the Amendments ledger entry
(`ledger_entry` index `7DB0788C020F02780A673DC74757F23823FA3014C1866E72CC4CD8B226CD6EF4`) and
mapping every enabled ID against `features.macro`, **both** hackathon networks have
`LendingProtocol` *and* `LendingProtocolV1_1` enabled. Despite that, an open-ended vault loan
originated successfully on the Track 1 network (tx `42BDEBF8…A530`).

So either the warning is stale, or the restriction is narrower than stated. Teams may pick a track
on a false premise.

**Proposed fix** State the enabled amendment set per network in the environment table, and correct
or delete the appendix note.

---

## F-005 · Brief and challenge deck disagree on the presentation format and on Track 2's bar
**Category** documentation · **Severity** medium

| | Notion brief | Ripple challenge deck |
|---|---|---|
| Pitch | 4-minute demo + 2-minute Q&A | 5-minute presentation + 3-minute Q&A |
| Track 2 rejections | "rejected `VaultDeposit`, `VaultWithdraw` and `LoanSet` at the wrong phase" | rejected `VaultDeposit` and `VaultWithdraw` **during Investment**, rejected `LoanSet` **during Redemption** |

Teams rehearse to the wrong clock and may demo the wrong rejection.

**Proposed fix** Make the Notion page the single source and regenerate the deck from it.

---

<!-- next items appended as they are hit -->

## F-006 · Phase-gate rejections reuse two generic codes for four different gates
**Category** UX · **Severity** medium · **Track 2, public devnet, rippled 3.4.0-rc5**

Full closed-ended lifecycle walked in real wall-clock time, `scripts/probe-t2.mjs`. Every phase gate
fires, which is good, but the code alone never says which gate fired:

| phase | transaction | result | tx |
|---|---|---|---|
| Subscription | `VaultDeposit` | `tesSUCCESS` | `C15C80B7…F87F` |
| Subscription | `LoanSet` | `tecTOO_SOON` | `50B7887C…E11E` |
| Investment | `VaultDeposit` | `tecEXPIRED` | `6F288748…7EA0` |
| Investment | `VaultWithdraw` | `tecTOO_SOON` | `B1AC2EE1…9402` |
| Investment | `LoanSet` ending after `RedemptionDate` | `tecNO_PERMISSION` | `60E499EA…B2BC` |
| Investment | `LoanSet` within the window | `tesSUCCESS` | `C717D339…9F00` |
| Redemption | `LoanSet` | `tecEXPIRED` | `1A80A637…ADC0` |

The scheme is internally consistent, `tecTOO_SOON` before a window and `tecEXPIRED` after it, but
`tecTOO_SOON` on a `VaultWithdraw` means "wait for RedemptionDate" while the same code on a
`LoanSet` means "wait for SubscriptionDate", and `tecNO_PERMISSION` on a `LoanSet` means something
else entirely: the amortisation schedule would outlive the vault.

**Proposed fix** Either a dedicated code per gate (`tecVAULT_PHASE`), or a table in the closed-ended
vault documentation mapping every (phase, transaction) pair to its code. We had to build that table
by firing transactions.

---

## F-007 · A closed-ended vault guarantees the loan schedule ends before redemption, not that the loan is repaid
**Category** missing primitive · **Severity** high · **Track 2**

`LoanSet` is refused with `tecNO_PERMISSION` when the amortisation schedule would end after
`RedemptionDate` (tx `60E499EA…B2BC`), so the ledger does enforce something. But a loan created
inside the window and simply not repaid leaves the vault illiquid at redemption: `AssetsTotal`
40000000 against `AssetsAvailable` 30000000, and the lender withdrawal returns
`tecINSUFFICIENT_FUNDS` (tx `D5879394…6E68`, vault `33EAD348…DB6B`).

So the closed-ended design protects the *calendar* and not the *cash*. A lender reading the
documentation reasonably expects that reaching the redemption window means the money is back.
Nothing states otherwise, and no redemption-phase recovery path exists: the broker cannot call the
loan early, and `LoanManage` default only writes down the position.

**Proposed fix** Say it explicitly in the closed-ended documentation, expose an "expected liquidity
at redemption" view on the vault, and consider a lender-protective primitive: a loan call or
mandatory prepayment before `RedemptionDate`. This is the single most important product gap we found.

---

## F-008 · `tecINSUFFICIENT_PAYMENT` does not carry the amount due, and the amount due is not representable
**Category** UX · **Severity** medium

Two `LoanPay` attempts rejected with `tecINSUFFICIENT_PAYMENT` (tx `C1BC35CC…1C3C`, `F32A68AC…3F89`).
The code is correct, our amounts were below the periodic payment, but the ledger knows the exact
figure and does not return it.

Worse, when you fetch it from the `Loan` entry it reads
`"PeriodicPayment": "5000003.567356568362"`. XRP has no fraction below one drop, so no payment can
equal that value. The client must round, and no documentation says in which direction, nor whether
rounding up overpays into `tfLoanOverpayment` territory with its own fee.

**Proposed fix** Return the required amount in the error, or document the rounding rule and expose a
ready-to-submit `AmountDue` on the `Loan` entry.

---

## F-009 · The number that matters most, price per share, is not readable from the vault
**Category** documentation · **Severity** medium

The organizers ask whether position value, utilisation, available liquidity and accrued yield can be
read without guessing from ledger objects. Measured answer, `scripts/read-vault.mjs`:

- `AssetsTotal` and `AssetsAvailable` are on the `Vault` entry, so available liquidity is direct.
- Shares outstanding are **not**. Price per share needs a second call,
  `ledger_entry` with `mpt_issuance` equal to `ShareMPTID`, then `OutstandingAmount`, then a
  client-side division. Nothing on the vault or in the docs points there.
- Utilisation is a client-side computation from two fields.
- Accrued yield is only visible as a drift in that computed price per share.
- Zero-valued fields are omitted from the entry entirely, and `VaultKind` is **absent** rather than
  `0` on an open-ended vault, so a reader cannot distinguish open-ended from an older entry version
  without also reading `LEVersion`.

**Proposed fix** Put `SharesTotal` and a computed `SharePrice` on the `Vault` entry, or ship a
`vault_info` RPC that returns the dashboard view in one call. Document that absent means zero.

---

## F-010 · Loans are not discoverable from the vault or from the broker owner
**Category** documentation · **Severity** medium

`account_objects` on the broker owner returns `Vault`, `LoanBroker` and `MPToken`, with no `Loan`.
The loans live under the **LoanBroker pseudo-account**, the `Account` field of the `LoanBroker` entry
(`rUJd54Kxaw82p9BoxUNxBuhNkNC7ADhvmV` in our run), and are also directory-linked to the borrower.
The vault pseudo-account holds the `MPTokenIssuance` and the `LoanBroker`.

Three pseudo-accounts, no documentation of which one owns what. Building a broker dashboard means
discovering that layout by enumerating objects on every address in sight.

**Proposed fix** Document the pseudo-account topology in the Lending Protocol concepts page with a
diagram, and note that listing a broker book means calling `account_objects` on `LoanBroker.Account`.

## F-011 · The two hackathon networks enforce different lending rules behind the same lending amendments
**Category** other / protocol · **Severity** high · **CORRECTS F-004**

Same transaction, same library, same amendment set, opposite outcome:

| network | build | `LoanBrokerSet` on an **open-ended** vault |
|---|---|---|
| custom hackathon devnet (network_id 4001) | 3.4.0-rc1 | `tesSUCCESS` (tx `59496BAE…6F85`) |
| public XRPL devnet (network_id 2) | 3.4.0-rc5 | `tecNO_PERMISSION` (tx `DD751B83…95D5`) |

Both networks report `LendingProtocol` **and** `LendingProtocolV1_1` as enabled, read from the
Amendments ledger entry and mapped against `features.macro`. So the brief's appendix warning was
right about the mechanism, V1.1 does restrict new loans to closed-ended vaults, and the custom
devnet has been configured to keep V1 behaviour. **This corrects our earlier report F-004**, which
concluded from the Track 1 network alone that the warning had not materialised.

The developer-facing problem is that nothing exposes the difference. `server_info` gives a
build_version that is not a published tag, the lending amendments read the same on both, and the only way to
discover which semantics a network enforces is to send a transaction and read the rejection. Two
ledgers gating different behaviour behind the same amendment ID is also a release-engineering
hazard worth a second look from the protocol team.

**Proposed fix** Expose the effective lending protocol version, for instance in `server_info` or via
`feature`, publish the source for whatever build each hackathon network runs, and state the
network-to-semantics mapping in the brief's environment table. Right now the table's
"Lending Protocol V1 / V1.1" row is the only hint and it is not verifiable from the ledger.

---

## F-012 · `VaultCreate` costs 10x more on one hackathon network than the other, silently
**Category** UX · **Severity** medium

Identical `VaultCreate`, autofilled by the same xrpl.js version:

- custom hackathon devnet: `Fee` **2000000 drops**, 2 XRP (tx `44B98E6A…59AA`)
- public XRPL devnet: `Fee` **200000 drops**, 0.2 XRP (tx `13F8E75B…9C6D`)

The fee is derived from the network's owner reserve, which differs between the two, and xrpl.js
autofill applies it without a word. A team that sizes its account budget on one network, where the
faucet also hands out 1000 XRP instead of 100, gets a nasty surprise on the other. Nothing in the
brief mentions that creating a vault costs a reserve-scaled fee at all.

**Proposed fix** Document the vault creation cost as "one incremental owner reserve, network
dependent" in the `VaultCreate` reference, and have the environment table state the reserve and the
faucet amount per network.

## F-013 · Impairment leaves `AssetsTotal` untouched, so the obvious share price overstates the position
**Category** documentation / protocol · **Severity** high · **Track 2**

Walking a loan to default and snapshotting the vault at each step, `scripts/default-arc.mjs`:

| state | AssetsTotal | LossUnrealized | naive `AssetsTotal / shares` | cover | debt |
|---|---|---|---|---|---|
| after funding | 5000000 | 0 | 1.00000000 | 1000000 | 0 |
| loan drawn | 5000000 | 0 | 1.00000000 | 1000000 | 2000000 |
| **impaired** | **5000000** | **2000000** | **1.00000000** | 1000000 | 2000000 |
| defaulted | 3200000 | 0 | 0.64000000 | 800000 | 0 |

Impairment writes the loss into `LossUnrealized` and does not touch `AssetsTotal`. A dashboard that
computes price per share as `AssetsTotal / OutstandingAmount`, which is the only formula anyone can
derive from the field names, shows 1.00 for a vault whose lenders are carrying a 40% write-down. We
shipped that bug ourselves and only found it by impairing a loan on chain and reading the snapshot.

The ledger knows better: `VaultWithdraw` settles against `AssetsTotal - LossUnrealized`. The correct
formula is therefore visible only in the source.

**Proposed fix** State the net asset value formula on the vault concepts page, and either expose it
as a field or name `AssetsTotal` in a way that does not read as "what the vault is worth".

---

## F-014 · "First-loss capital" absorbs a rate of the debt, not the first loss
**Category** terminology / protocol · **Severity** high

Same run. The broker posted 1000000 of cover against a 2000000 loan with
`CoverRateMinimum: 10000`, ten percent in parts per 100000. On default
(tx `D4F71EBF…F035`):

- vault assets fell 1800000, from 5000000 to 3200000
- cover fell **200000**, from 1000000 to 800000
- price per share fell from 1.00 to **0.64**

So the cover absorbed exactly ten percent of the loan, the configured rate, and the lenders took the
other ninety percent, even though the broker had posted enough cover to absorb half the loan.

The name says the capital takes the first loss. What it takes is `CoverRateMinimum` of the loan.
For a product whose entire promise to lenders is indemnification, that gap between the name and the
behaviour is the most expensive misunderstanding available in XLS-66, and nothing in the field
tables or the concepts page corrects it.

Re-running the identical arc with `CoverRateMinimum: 100000` and 2500000 of cover settles it:

| state | assets | loss | price per share | cover |
|---|---|---|---|---|
| loan drawn | 5000000 | 0 | 1.00 | 2500000 |
| impaired | 5000000 | 2000000 | 1.00 | 2500000 |
| defaulted | 5000000 | 0 | **1.00** | **500000** |

The cover now absorbs the whole loan and the lenders are untouched. So the parameter that reads as a
floor on how much cover a broker must post in fact decides how much of a default that cover absorbs,
and a broker can hold ten times the cover it will ever pay out. Two runs, `default-arc-cover10000`
and `default-arc-cover100000` in `docs/evidence/`, identical but for that one number.

**Correction after checking the documentation.** The arithmetic is published and correct:
`xrpl.org/docs/concepts/tokens/lending-protocol` gives
`DefaultCovered = min((DebtTotal × CoverRateMinimum) × CoverRateLiquidation, DefaultAmount)` with a
worked example, and 200000 is exactly what it predicts for our numbers. What we hit is a navigation
failure, not an absence: we were reading `LoanBrokerSet`'s field table and the `LoanBroker` ledger
entry page, which is where a developer building the transaction looks, and neither says that the
parameter named as a minimum to post also caps what is paid out, nor links to the worked example.

**Proposed fix** One sentence on the `LoanBrokerSet` and `LoanBroker` reference pages, and a link
from the field table to the worked example.

## F-015 · The grace period protects the borrower's payment, not their standing
**Category** protocol · **Severity** medium

Three runs pin the boundary exactly. `LoanManage` with `tfLoanImpair`:

| when | result | tx |
|---|---|---|
| before `NextPaymentDueDate` | `tecTOO_SOON` | `9DD4F5C8…F2F3` |
| 11 seconds after due, 49 seconds of grace left | `tesSUCCESS` | `A3734858…F55D`, reproduced `5227A096…5F48` |
| after the grace period, already impaired | `tecNO_PERMISSION` | `C9F00989…A649` |

So impairment unlocks at the payment due date and ignores the grace period entirely. A borrower who
is one second late can be marked down while still holding the full grace window the loan granted
them, and the mark-down is what moves `LossUnrealized` and therefore what a lender sees.

Both directions are defensible, and that is the point: nothing in the reference pages states which
one the ledger implements, so we established it by firing the transaction at three different moments.

**Proposed fix** State the precondition for `tfLoanImpair` on the `LoanManage` reference page, one
sentence: impairment is available once a payment is past due, independently of `GracePeriod`. If the
intent is that grace protects standing as well as payment, the check belongs in the transactor.

## F-016 · `LoanOriginationFee` is charged to the borrower and kept by the broker, and the lender's only yield is interest
**Category** documentation / protocol · **Severity** high

We added `LoanOriginationFee: '100000'` to a 2000000 loan expecting the lender's position to rise,
because a securities lending fee is what the lender is paid. Reading the metadata of
tx `784DA553…A72A` shows where it actually goes:

| account | before | after | delta |
|---|---|---|---|
| borrower | 10000000 | 11900000 | **+1900000**, the principal minus the fee |
| broker owner | 9500000 | 9600000 | **+100000**, the entire fee |
| vault `AssetsTotal` | 5000000 | 5000000 | **unchanged** |

and the `Loan` still records `PrincipalOutstanding: 2000000`. So the fee is deducted from the
drawdown, credited to the broker's own account, and the borrower still owes the full principal. The
vault never sees it. None of that is stated anywhere: the field name says origination fee, the
concepts page says the broker "collects fees", and a reader building a lender-facing product will
assume, as we did, that the fee is yield.

The consequence is sharper than a naming complaint. **A lender's only source of return is
`InterestRate`**, and on a schedule compressed to fit a devnet that cannot be fast-forwarded,
interest rounds to nothing: our 2000000 loan over two minutes repaid 2000001, one unit.
`TotalValueOutstanding` confirms it. So on a closed-ended vault there is no way to demonstrate
"withdraw capital plus accrued yield", which the minimum bar asks for, in the time the event allows.

The mechanism that would solve it is the one the workshop deck teaches: "Interest injected via
`tfVaultDonation`. PPS rises without minting new shares." That flag does not exist, in the source or
in `server_definitions` (finding F-006). So the documented way to put yield into a closed-ended vault
is missing from the implementation, and that is why nobody can show yield on a compressed timeline.

**Proposed fix** Three things. State on the `LoanSet` reference page who pays each fee and who
receives it, with the drawdown arithmetic. State the time basis of `InterestRate`. And either ship
the donation flag the workshop teaches, or correct the deck and give closed-ended vaults another way
to recognise yield inside a demonstrable window.

## F-017 · A defaulted loan reads "Paid Off" in the explorer, and that is intended
**Category** UX · **Severity** low · **Not a defect, a product opinion**

Our loan `D94FF2EF…E2D4` on vault `CC9CB7BF…0C4D` carries `Flags: 196608`, defaulted and impaired,
with the two `LoanManage` transactions visible in the page's own history. The XRPL Explorer shows its
status as **Paid Off**.

We nearly filed that as a bug. It is not. The behaviour is deliberate and internally consistent:

- `src/containers/Vault/VaultLoans/test/utils.test.ts` documents the priority order in its header and
  asserts it directly: `it('paid_off takes priority over default flag')`, with the comment "Even if
  default flag is set, zero balance means paid off".
- `BrokerLoansTable.tsx` filters the Default and Impaired tabs on `TotalValueOutstanding > 0`.
- `BrokerDetails.tsx` computes `hasDefaultedLoan` with the same guard.

Three call sites and a test agree. From the vault's side the loan is settled: nothing is outstanding.

The observation we keep is a product one. After a default the borrower did not pay, the first-loss
cover did, and a lender reading a loan book that says "paid off" cannot tell a repayment from a
counterparty failure absorbed by someone else's capital. The distinction is the entire value of the
indemnity. Our own dashboard therefore diverges, and only here: default is terminal and wins over a
zero balance, while impairment, which `tfLoanUnimpair` can reverse, does not.

**Proposed fix** None to the code. If anything, a distinct label such as "settled by cover" would
tell a lender what actually happened without changing the accounting the explorer is right about.
