# Developer report, team patapim

| | |
|---|---|
| **Track** | 2, closed-ended vault, Lending Protocol V1.1 |
| **Flavour** | Loaded: XLS-65, XLS-66, MPT, Credentials, Permissioned Domains, Token Escrow, Price Oracle |
| **Environment** | Public XRPL Devnet, network_id 2, rippled `3.4.0-rc5`. Hashes marked † are on the custom hackathon devnet, network_id 4001, rippled `3.4.0-rc1` |
| **Library** | `xrpl.js@5.2.0-beta.0`, `ripple-binary-codec@2.11.0` |

patapim is agency securities lending: eligible holders lend a tokenised T-bill from a fixed-term vault
through an agent that indemnifies them. Every claim below carries a hash, a file and line, or a pull request.

## 1. The library the brief mandates cannot originate a loan

*client libraries · high.* `signLoanSetByCounterparty` in `xrpl.js@5.2.0-beta.0` produces a
`CounterpartySignature` the ledger refuses: `fails local checks: Counterparty: Invalid signature.` The
same `LoanSet` succeeds with stable `5.2.0`, `42BDEBF8…A530`†. rippled #8162, merged 2026-09-03 behind
`fixCleanup3_4_0`, gave the counterparty signature its own hash prefix. Stable passes
`computeSignature(tx, key, undefined, 'counterparty')` to `encodeForSigningCounterparty`; the beta has no
`role` and calls `encodeForSigning`, although `ripple-binary-codec@2.11.0` already exports the right
function. **What we did.** Called the codec ourselves, `scripts/lib/lending.mjs → signCounterparty()`.
**Proposed fix.** `xrpl@5.2.0-beta.1`, published on 2026-09-11, fixes it: point the brief at it.

## 2. Each release line carries half the feature

*client libraries · high.* Only the `5.2.0-beta` line types `VaultKind`, `SubscriptionDate` and
`RedemptionDate`; stable `5.2.0`, what `npm install xrpl` returns, cannot model a closed-ended vault and
says so nowhere. `xrpl-py` main has no counterparty encoder (`binarycodec/main.py`): no origination from Python.
**Proposed fix.** A version-to-feature matrix on the lending docs landing page.

## 3. Two networks, the same lending amendments, different lending rules

*other · high.* One `LoanBrokerSet` against an open-ended vault: `tesSUCCESS` on the custom devnet
(`59496BAE…6F85`†), `tecNO_PERMISSION` on the public one (`DD751B83…95D5`). Both enable
`LendingProtocol` and `LendingProtocolV1_1`; the sets differ, 48 against 89, only by retired amendments
and `TicketBatch`. `build_version` names no tag: the only way to learn the rules is to send a transaction.
**Proposed fix.** Expose the effective lending version and put the amendment diff in the brief.

## Specification, implementation, documentation

| Subject | Specification or docs | The ledger |
|---|---|---|
| `LoanPay` type | XLS-66: 83 | 84 |
| `VaultClawback` | XLS-65 l.702: needs `lsfMPTCanLock` | checks `lsfMPTCanClawback` only, `553C31E8…818A`† |
| `VaultWithdraw` | XLS-65 A.2: ignores the domain | since `fixCleanup3_4_0` a third-party destination is checked |
| `VaultCreate` cost | XLS-65 §3.2.4, xrpl.org: destroys one owner reserve | 12 drops accepted, `8D50A1D9…F93D`; xrpl.js autofill charges the reserve |
| Vault numbers | always present | omitted at default, `VaultKind` absent rather than `0` |
| Closed-ended vaults | on no xrpl.org page; spec PR XRPL-Standards #587 open | shipped on both networks |
| Yield injection | workshop deck: `VaultDeposit` with `tfVaultDonation` | no such flag; `tfVaultDonate` is open rippled PR #6383, behind `LendingProtocolV1_2` |
| Reference app | `ripple/lending-demo` | 404; it is `ripple/xrpl-reference-app-lending-sav` |

## What the protocol made hard

**The origination fee is not the lender's.** *documentation · high.* `LoanOriginationFee: 100000` on a
2000000 loan, `784DA553…A72A`: the borrower received 1900000, the broker owner 100000, `AssetsTotal`
did not move. The lender earns interest only, which rounds away on a schedule compressed into minutes:
our `LoanPay` declared 2000001, settled 2000000. Our standing fund is dated in days instead.
*Proposal: say who pays and receives each fee on the `LoanSet` page.*

**Impairment does not move `AssetsTotal`.** *documentation · high.* Impaired, `LossUnrealized` read
2000000 and `AssetsTotal` 5000000, so `AssetsTotal / OutstandingAmount`, the formula the field names
suggest, read 1.00 for lenders carrying a 40% write-down. We shipped that bug. The net formula is on the
vault concepts page, but the `Vault` reference page never links it and `vault_info` returns no NAV.
*Proposal: link the fields to the exchange algorithm, return NAV per share from `vault_info`.*

**"First-loss capital" absorbs a rate of the debt.** *documentation · high.* Cover 1000000, loan
2000000, `CoverRateMinimum` 10%: on default the cover paid 200000, the lenders lost 1800000, NAV per
share fell to 0.64. At 100% the cover absorbs the whole loan. The concepts page states
`min(DebtTotal × CoverRateMinimum × CoverRateLiquidation, DefaultAmount)`, and `LoanManage.cpp` also caps
it by `CoverAvailable`, but `LoanBrokerSet` and `LoanBroker` never say that the posting floor caps the
payout. *Proposal: one sentence on both pages, linked to the worked example.*

**A closed-ended vault protects the calendar, not the cash.** *missing primitive · high.* `LoanSet` is
refused when the schedule ends within 60 seconds of `RedemptionDate`, but a loan left unpaid still leaves
the vault illiquid at maturity: `AssetsAvailable` 30000000 of 40000000, withdrawal
`tecINSUFFICIENT_FUNDS`, `D5879394…6E68`. There is no recall. The XLS-66 co-author wrote on
XRPL-Standards discussion #589 that loan funds "must be reserved". *Proposal: `tfLoanCall` on
`LoanManage`, the recall right every securities lender holds.*

**Grace protects the payment, not the standing.** *documentation · medium.* `tfLoanImpair` is
`tecTOO_SOON` before the due date and succeeds 11 seconds after it, grace still running
(`LoanManage.cpp`, `isPaymentLate`). *Proposal: one sentence on the `LoanManage` page.*

**A permissioned domain gates lenders, not borrowers.** *documentation · high.* Same vault, same minute:
a non-member `VaultDeposit` is `tecNO_AUTH` (`30C4B86F…B6F9`), a `LoanSet` to that account succeeds
(`DDD61141…2C12`). The fix exists: [XLS-Standards #484](https://github.com/XRPLF/XRPL-Standards/pull/484)
and [rippled #6517](https://github.com/XRPLF/rippled/pull/6517), open since March, behind
`LendingPermissionedDomain`, `Supported::No` and on neither network, while `feature` reports lending and
domains enabled and `LoanBrokerSet` says nothing about borrowers. *Proposal: pages whose behaviour awaits an amendment should name it.*

**No lending transaction is delegable.** *missing primitive · high.* No lending entry in
`transactions.macro` sets `.delegable`; fifteen `DelegateSet` attempts, fifteen `temMALFORMED`, against a
`Payment` control that succeeds. An agent cannot give an operations key `LoanManage`. *Proposal: make the
lending entries delegable, starting with `LoanManage` and `LoanBrokerCoverDeposit`.*

Smaller findings are in `docs/feedback/FRICTION-LOG.md`, filed through the event hook as they happened.

## What we contributed back

[ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342) makes `LoanBroker` and `Loan` ids
resolvable from the explorer search, which returned not-found although the vault page renders both: one
`ledger_entry` switched on `LedgerEntryType`, one extra hop for a loan. Tests, lint and typecheck pass.
