# Audit checklist, patapim

To be run by a second reviewer (Fable) after the build, against the submitted commit.
Each item states what to check and what the correct answer looks like.

## 1 · Protocol correctness, XLS-65 vault
- [ ] Share maths: every `VaultDeposit` mints shares at the price implied by `AssetsTotal / SharesTotal`
      at submission time, and the app never recomputes it from a cached value.
- [ ] Rounding: confirm the direction of rounding on deposit and on withdraw, and that it cannot be
      farmed by repeated dust deposits and withdrawals.
- [ ] `AssetsAvailable` versus `AssetsTotal`: the UI never offers to withdraw more than
      `AssetsAvailable`, and the difference is explained to the user.
- [ ] `LossUnrealized` is surfaced, not silently absorbed into the displayed yield.
- [ ] Vault `Scale` and the asset's own scale are applied consistently in every display and every amount.
- [ ] Withdrawal policy (`vaultStrategyFirstComeFirstServe`) is reflected in the UI copy.

## 2 · Protocol correctness, XLS-66 loans
- [ ] `PrincipalRequested` versus the principal actually drawn down: the two are displayed separately.
- [ ] Interest, management fee, origination fee, late fee and overpayment fee each map to the right
      field, with the rate scale verified against the spec, not assumed.
- [ ] `PaymentInterval` >= 60 and `GracePeriod` <= `PaymentInterval` enforced client side before submit.
- [ ] First-loss cover: `CoverRateMinimum` and `CoverRateLiquidation` are both zero or both non-zero,
      and the app explains what happens to the cover on default.
- [ ] Impairment, default and unimpair (`tfLoanImpair`, `tfLoanDefault`, `tfLoanUnimpair`) reachable
      and their ledger effect verified on chain, not just in the UI.

## 3 · Multi-party signing
- [ ] The counterparty signature is produced with `encodeForSigningCounterparty`, never with the
      plain transaction encoder (F-001).
- [ ] The borrower signs the exact autofilled transaction the broker signed, byte for byte.
- [ ] No seed ever leaves the server process; nothing secret is logged or sent to the browser.
- [ ] Replay: the same signed LoanSet blob cannot be submitted twice to create two loans.

## 4 · Phase gates, if Track 2
- [ ] Every phase transition is derived from `SubscriptionDate` and `RedemptionDate` read from the
      ledger entry, never from a local clock or a cached value.
- [ ] The three rejection demos produce the documented error codes, and the UI shows the raw code.
- [ ] The final-payment-before-`RedemptionDate` constraint is validated before submitting, with a
      message better than the ledger's.

## 5 · Security
- [ ] No seed, secret or private key in the repository, in `.env.example`, in the README, in the
      slides or in any committed log.
- [ ] Every rejected transaction path is handled: no code treats a non-`tesSUCCESS` result as success.
- [ ] `submitAndWait` results are checked for `meta.TransactionResult`, not just for absence of throw.
- [ ] Amounts are handled as integers or BigNumber end to end, never as JS floats.
- [ ] Any potential protocol-level security issue is reported privately to a mentor before the
      presentation, per the brief.

## 6 · Submission requirements
- [ ] Public GitHub repository, buildable from a clean clone with the documented steps.
- [ ] README states what the project does, setup, track, flavour, environment, exact library version
      and every XLS-65/66 transaction used.
- [ ] Links to verified on-chain transactions, one per minimum-bar step, all resolving on the right explorer.
- [ ] Manual developer-feedback report at the repository root, three pages maximum, stating track,
      flavour, environment and library version at the top.
- [ ] Slide deck, ten slides maximum.
- [ ] DevEx hook installed and reporting, team members and GitHub handles submitted.
