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
- [ ] **The hashes belong to the network we claim.** All of them are on network_id 2. None from the
      custom hackathon devnet. Mixing the two contradicts the brief and the report header.
- [ ] **Every finding in `DEVELOPER-REPORT.md` is reproducible from what is written.** Pick three at
      random, including finding 1 and finding 3, and reproduce them from the report alone. If a
      finding needs knowledge that is not in the text, the text is wrong.
- [ ] **Finding 1, the SDK signature bug.** Install `xrpl@5.2.0-beta.0` and `xrpl@5.2.0` side by side
      and diff `src/Wallet/counterpartySigner.ts` and `src/Wallet/utils.ts`. The claim is that stable
      passes `'counterparty'` to `computeSignature` and the beta has no such parameter. Confirm, and
      confirm `ripple-binary-codec@2.11.0` exports `encodeForSigningCounterparty` in both.
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
      Every phase comparison must read `ledger.close_time`. This already cost us one full run.
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

- [ ] **Price per share.** `AssetsTotal / OutstandingAmount`, where the denominator comes from the
      share `MPTokenIssuance`, not from the vault. Compare the figure on `/vault/<id>` against
      `node scripts/read-vault.mjs t2 <id>`. They must agree to the last digit shown.
- [ ] **Absent means zero.** The ledger omits `AssetsTotal`, `AssetsAvailable`, `LossUnrealized` and
      `Scale` when they sit at their default. Every read is `?? 0`. Load a freshly created vault with
      no deposit: the page must show `0`, never `NaN` and never a crash.
- [ ] **Utilisation** is `(AssetsTotal - AssetsAvailable) / AssetsTotal` and is never negative, never
      above 100%, and reads `—` rather than `NaN` on an empty vault.
- [ ] **The phase shown matches the ledger.** Open the page seconds before and after a boundary: the
      badge, the countdown and the refused list must all flip together.
- [ ] **The refused list is true.** For the phase shown, submit one of the transactions it lists as
      refused and confirm the ledger returns the code the page promised.
- [ ] **The page holds at 400px wide** and in both colour schemes.

## 4. Security

- [ ] **No seed, secret or private key anywhere in the repository or its history.**
      `git log -p --all | grep -nE "\bs[Ee]d[A-Za-z0-9]{27,}|\"secret\"|PRIVATE_KEY"` must return nothing.
      The faucet hands out seeds on every run: none of them may be committed, including inside
      `docs/evidence/*.json` and `docs/research/*.md`.
      Every account we create is a throwaway Devnet account holding test XRP only. If the grep
      surfaces anything, say where and decide whether it is worth rewriting history mid-event.
- [ ] **`.xrpl-devex/` is gitignored** and no identity file, buffer or report is tracked.
- [ ] **No credential or address of a real third party** in the research notes or the report.
- [ ] **The signed LoanSet blob cannot be replayed** to create a second loan. Submit the same blob
      twice and confirm the second is rejected.
- [ ] **The protocol-level finding has been reported privately to a mentor before any presentation**,
      as the brief requires. That is the permissioned domain gating depositors but not borrowers.

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
      It is currently around 1760 words across four tables, which is close to the limit. If it runs
      over, cut the "Smaller things, one line each" table first: it is the only section whose items
      are also filed through the event hook, so nothing is lost.
- [ ] The slide deck is ten slides or fewer.
- [ ] The DevEx form is submitted with both members and both GitHub handles.
- [ ] The demo runs from a clean state in under four minutes.
