# Audit brief

For a second reviewer, run against the submitted commit before Sunday 12:30 CEST. The point is not
to admire the build: it is to find the claim that does not hold. Every item below says what to check,
how, and what the correct answer looks like. Work top down, the first section is the one that can
lose us the most.

Product: patapim, securities lending on XRPL. Track 2, closed-ended vault, Lending Protocol V1.1,
public XRPL Devnet (network_id 2, rippled 3.4.0-rc5), `xrpl.js@5.2.0-beta.0`.

---

## 1. Every claim we publish must hold

The submission is judged 40% on the developer report and 30% on verifiable transactions. A single
overstated claim costs more than a missing feature.

- [ ] **Every transaction hash in `README.md` resolves on Devnet and carries the stated result.**
      For each row: `curl -s -X POST https://s.devnet.rippletest.net:51234/ -H 'Content-Type: application/json' -d '{"method":"tx","params":[{"transaction":"<HASH>"}]}' | python3 -c "import sys,json;d=json.load(sys.stdin)['result'];print(d['tx_json']['TransactionType'], d['meta']['TransactionResult'])"`
      Expected: the transaction type and result code match the table exactly. A `tecNO_AUTH` row must
      really be `tecNO_AUTH`, not a success we relabelled.
- [ ] **The hashes belong to the network we claim.** Every hash in `README.md`, `docs/ON-CHAIN.md`, the
      deck and the one-pagers is on network_id 2. The developer report cites three custom-devnet hashes
      for findings that need both networks, and marks each with †, as its header says. An unmarked
      custom-devnet hash is a contradiction.
- [ ] **Every finding in `DEVELOPER-REPORT.md` is reproducible from what is written.** Pick three at
      random, including finding 1 and finding 3, and reproduce them from the report alone. If a
      finding needs knowledge that is not in the text, the text is wrong.
- [ ] **Finding 1, the SDK signature bug.** Install `xrpl@5.2.0-beta.0` and `xrpl@5.2.0` side by side
      and diff `src/Wallet/counterpartySigner.ts` and `src/Wallet/utils.ts`. The claim is that stable
      passes `'counterparty'` to `computeSignature` and the beta has no such parameter. Confirm, and
      confirm `ripple-binary-codec@2.11.0` exports `encodeForSigningCounterparty` in both. Then run
      `node scripts/experiments/counterparty-signature.mjs`: on beta.0 the library's signature verifies
      only under the transaction prefix, ours under the counterparty prefix.
- [ ] **Finding 3, the two networks.** Send the same `LoanBrokerSet` against an open-ended vault on
      both networks with `node scripts/experiments/open-vault-both-nets.mjs`. Expected: `tesSUCCESS`
      on the custom devnet, `tecNO_PERMISSION` on the public one. If both now agree, the finding is
      stale and must be corrected before we present it.
- [ ] **No claim of a mainnet date, a partnership, or an endorsement.** The landing page names funds
      and institutions as market context only, and says so in the footer.

## 2. The ledger code

`scripts/lib/lending.mjs` is the shared client, the rest of `scripts/` drives it.

- [ ] **`signCounterparty()` uses `encodeForSigningCounterparty`, never `encodeForSigning`.** If this
      regresses, loans silently stop originating.
- [ ] **The counterparty signs the exact bytes the first party signed.** The helper decodes the
      signed blob rather than re-serialising the prepared transaction. Check that `decode(signed.tx_blob)`
      is what is passed to `signCounterparty`, not `prepared`.
- [ ] **No phase decision uses `Date.now()`.** `grep -rn "Date.now\|new Date()" scripts/ web/lib/`
      may only return elapsed-time logging (`t0`, `el()`) and the unused `nowRipple` export. Every phase
      comparison must read `ledger.close_time`. This already cost us one full run.
- [ ] **Amounts are integers end to end.** The demo security has `AssetScale: 0`. Any `Number()`
      arithmetic on an amount that could exceed 2^53, or any float formatting of a drops value, is a
      bug. Check `read-vault.mjs` and `web/lib/ledger.ts`.
- [ ] **Withdrawals are denominated in shares, not assets.** An asset-denominated `VaultWithdraw`
      under-delivers one unit on an integral asset. `grep -n "VaultWithdraw" scripts/*.mjs` and check
      the `Amount` carries the share `mpt_issuance_id`.
- [ ] **Every submission checks `meta.TransactionResult`.** No code path treats "did not throw" as
      success. `submit()` and `submitLoanSet()` both return `ok` from the result code: confirm no
      caller ignores it in a way that would print a success we did not get.
- [ ] **Loan status bits.** `LSF_LOAN_DEFAULT = 0x00010000` and `LSF_LOAN_IMPAIRED = 0x00020000` in
      `web/lib/ledger.ts` match the XRPL Explorer's `src/containers/Vault/VaultLoans/utils.ts`. If the
      explorer and we disagree on a loan's status in front of the jury, we lose the room.

## 3. The dashboard arithmetic

- [ ] **NAV per share.** `(AssetsTotal - LossUnrealized) / OutstandingAmount`, where the denominator
      comes from the share `MPTokenIssuance`, not from the vault. Compare the figure on `/vault/<id>`
      against `node scripts/read-vault.mjs t2 <id>`. They must agree to the last digit shown.
- [ ] **Every lending metric has a source.** `web/lib/finance.ts` defines each one; check each formula
      against `docs/research/lending-conventions.md` and against the ledger fields it reads: fund return
      = fee × utilisation × (1 − `ManagementFeeRate`), cover paid at default =
      `min(DebtTotal × CoverRateMinimum × CoverRateLiquidation, principal, CoverAvailable)`, collateral
      margin = escrowed cash / (principal × oracle price).
- [ ] **Absent means zero.** The ledger omits `AssetsTotal`, `AssetsAvailable`, `LossUnrealized` and
      `Scale` when they sit at their default. Every read is `?? 0`. Load a freshly created vault with
      no deposit: the page must show `0`, never `NaN` and never a crash.
- [ ] **Utilisation** is `(AssetsTotal - AssetsAvailable) / AssetsTotal` and is never negative, never
      above 100%, and reads `—` rather than `NaN` on an empty vault.
- [ ] **The phase shown matches the ledger.** Open the page seconds before and after a boundary: the
      badge, the countdown and the refused list must all flip together.
- [ ] **The refused list is true.** For the phase shown, submit one of the transactions it lists as
      refused and confirm the ledger returns the code the page promised.
- [ ] **The page holds at 400px wide.** The app commits to one dark palette (`color-scheme: dark` in
      `web/app/globals.css`), so there is no light scheme to test: say so rather than tick it.

## 3b. The interface, every control and every link

Armand's art direction is merged. The landing page and the dashboard are one client app
(`web/app/components/ghost/`); `/` renders it with `DEMO_VAULT` from `web/lib/config.ts`. Run
`cd web && npm run build && npm run start` and drive the real thing, not the source.

- [ ] **`DEMO_VAULT` points at a vault that holds something.** It is Fund I, provisioned by
      `scripts/standing.mjs`. Open `/` and read the figures: assets 5,000,000, NAV per share 1.000000,
      utilisation 40.0%, one loan `current` until 15 September 12:00 CEST. Zeros or `—` are blocking.
- [ ] **Every control does what it says.** Click each one: every button, tab, card, toggle,
      disclosure and copy affordance in the app. Name any that is decorative, dead, or whose label
      does not match its effect.
- [ ] **Every link resolves.** Extract every `href` in the rendered pages and in `README.md`,
      `DEVELOPER-REPORT.md`, `SUBMISSION.md` and `docs/ON-CHAIN.md`, then check each one: explorer
      links land on the object they name and show the state we claim; GitHub links resolve, including
      the two profiles and the explorer PR; no `localhost`, no `example.com`, no 404.
- [ ] **The explorer agrees with us.** Open the vault, the broker and the loan in
      `devnet.xrpl.org` beside our dashboard. Any figure that differs is either their bug, ours, or
      a deliberate divergence: `loanStatus()` in `web/lib/ledger.ts` treats default as terminal over
      a zero balance, and says so in a comment. Confirm that is the only one.
- [ ] **The Sign tab signs in the browser, never on the server.** Load a key from
      `docs/DEMO-ACCOUNTS.md` on Fund II and sign a `VaultDeposit`: the eligible key gets `tesSUCCESS`,
      the other `tecNO_AUTH`, each with an explorer link. In the network panel, no request carries the
      seed; `/api/submit` receives a signed blob only. No browser wallet is offered, and the page says
      why (F-019).
- [ ] **The server holds no key and relays only a lender's own transactions.** `Wallet.fromSeed`
      appears only in `web/app/components/ghost/sign-panel.tsx`, a client component.
      `web/app/api/submit/route.ts` decodes the blob, refuses anything but a signed `VaultDeposit` or
      `VaultWithdraw` for network_id 2, and forwards it with `submit`. `grep -rn "sEd" web/app web/lib`
      returns nothing.
- [ ] **The app degrades honestly.** Stop the network mid-session: the page must say the ledger
      could not be read, not show stale figures as live. Pass a malformed vault id: the API returns
      400 with a readable message and the page does not crash.
- [ ] **The tab icon is ours**, not the Next.js triangle (`web/app/icon.svg`), and the title names
      patapim.
- [ ] **No dead route.** `find web/app -name 'page.tsx'` against what the build prints. Every route
      is reachable from the app or is deliberate.

## 4. Security

- [ ] **No seed, secret or private key in the working tree, except the two published on purpose.**
      `git grep -nE "\bs[Ee]d[A-Za-z0-9]{27,}" -- . ':!docs/DEMO-ACCOUNTS.md'` must return nothing, and
      the two seeds in `docs/DEMO-ACCOUNTS.md` must derive the two addresses that page names and hold
      nothing but test XRP and TBL. `git log -p --all -- . ':!docs/DEMO-ACCOUNTS.md'` greps the history.
      The faucet hands out seeds on every run: none of them may be committed, including inside
      `docs/evidence/*.json` (`standing-demo.json` is written from `.demo/state.json` with the seeds
      stripped: confirm the stripping actually happened) and `docs/research/*.md`.
      Every account we create is a throwaway Devnet account holding test XRP only. If the grep
      surfaces anything, say where and decide whether it is worth rewriting history mid-event.
- [ ] **`.xrpl-devex/` is gitignored** and no identity file, buffer or report is tracked.
- [ ] **No credential or address of a real third party** in the research notes or the report.
- [ ] **The signed LoanSet blob cannot be replayed** to create a second loan. Submit the same blob
      twice and confirm the second is rejected.
- [ ] **The borrower-eligibility finding is nothing to disclose privately.** It is publicly tracked
      in [XLS-Standards #484](https://github.com/XRPLF/XRPL-Standards/pull/484) and
      [rippled #6517](https://github.com/XRPLF/rippled/pull/6517), both open since March 2026 behind
      an unshipped `LendingPermissionedDomain` amendment. Confirm both are still open and still
      unmerged at audit time, and that F-018 and `DEVELOPER-REPORT.md` describe them accurately: if
      either merged this week, both documents are wrong.

## 5. The contribution

- [ ] [ripple/explorer#1342](https://github.com/ripple/explorer/pull/1342) still applies cleanly on
      `main` and its tests pass: `npx jest --env=jsdom --ci src/containers/Header/test/Search.test.js`,
      4 passed. `eslint --max-warnings 0`, `prettier --check`, `tsc --build` clean.
- [ ] The PR diff contains three files and no `package-lock.json` churn.
- [ ] The PR claims nothing the diff does not do.

## 6. Submission completeness

Check `SUBMISSION.md` against the brief itself, not against our summary of it:

- [ ] Public repository, buildable from a clean clone: `git clone`, `npm install`, `cd web && npm install && npm run build`.
- [ ] README states what it does, setup, track, environment, library version and every XLS-65/66
      transaction used. Count the transactions in the table against the transactions in `scripts/`:
      anything we use and do not list is a gap.
- [ ] The developer report is at the repository root and is **three pages or fewer when rendered**.
      Render it and count. Measured on 13 September at three pages in each of three renderings,
      Markdown to HTML with `marked` then Chrome headless `--print-to-pdf`: A4 at 11 pt with 20 mm
      margins, US Letter at 12 pt with one-inch margins, and GitHub's 16 px style. Say how you measured.
- [ ] The slide deck is ten slides or fewer: nine, `docs/PATAPIM-DECK.pdf`, and every hash in
      `web/public/deck/index.html` resolves on network_id 2.
- [ ] The DevEx form is submitted with both members and both GitHub handles.
- [ ] The demo runs from a clean state in under four minutes.
