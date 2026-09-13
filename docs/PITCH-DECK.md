# Patapim — Track 2 / Loaded / Developer feedback

10 slides in English, 16:9, with the existing black / white / #1eff66 ghost art direction. Four-minute script: 3 slides on the product, Loaded and KPI evidence; 7 on developer feedback and the contribution.

Presentation: https://ways-stake-equations-suitable.trycloudflare.com/deck/index.html
PDF: https://ways-stake-equations-suitable.trycloudflare.com/deck/PATAPIM-DECK.pdf (also docs/PATAPIM-DECK.pdf).

Source revision: `59964c8d7da07eb42bd3d35d9a32048f76ca7613`. PR and ledger checks: `docs/deck/verification.json`, 2026-09-13.

## Evidence and scope

Read against README.md, DEVELOPER-REPORT.md, the friction log through F-022, the contribution report, current audit resolutions, Track 2 requirements, fund/default/lifecycle evidence, web/lib/config.ts, finance.ts, wallet-manager.ts, the signing panel and transaction relay. Historical reviews are used for requirement wording, not as the current implementation status.

The redemption-plus-yield KPI is PARTIAL: the compressed lifecycle redeems capital with zero realised interest. Day-based funds show scheduled interest, not an already demonstrated redemption with yield. Wallet connection is integrated; the demo-key flow is proven on chain, Xaman is configured on the canonical Vercel deployment with Devnet payload acceptance documented; Otsu support was inspected in code. Neither is claimed as a completed wallet-signed ledger test here. The Explorer PR remains open, not merged. Financial comparisons are historical evidence, not live quotes.

Full amendment sets differ even though the two lending amendments match. Beta.1 already fixes signing and closed-ended typing. Borrower eligibility and donation have existing upstream proposals; tfLoanCall is our proposal, not implemented. The corrected net NAV and cover payouts are recomputed from raw evidence during generation.

## Regenerate and present

`python3 scripts/build-deck.py --app-url https://patapim-gamma.vercel.app --deck-url https://ways-stake-equations-suitable.trycloudflare.com`

`node scripts/export-deck.mjs` exports the PDF and screenshots. Requires `npm ci --prefix web` and Chromium (`cd web && npx playwright install chromium`), or set `CHROMIUM_PATH`.

Arrow keys / Page Up / Page Down / Space navigate; Home / End jump; N opens notes with a short timed script and optional Q&A detail; O opens overview. Printing includes all ten slides without notes or controls. No transaction is triggered by the presentation or export.

## 1. Good assets. Put to  work. — 0:00–0:15

We chose Track 2: a closed-ended vault on public XRPL Devnet, Lending Protocol V1.1, with the mandated beta. patapim lends tokenised securities through an agent. A fixed term fits the fund; we chose Loaded because eligibility and collateral need more than a vault and a loan.

If asked: The securities and cash tokens are fictitious Devnet assets. There is no mainnet, partnership or production-fund claim.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/README.md" target="_blank" rel="noreferrer">README · Track, environment & trade</a>

## 2. Why  Loaded. — 0:15–0:40

Loaded means the Vanilla baseline plus a useful ledger primitive. We use five: MPTs for securities and cash; Credentials and a Permissioned Domain for lender eligibility; Token Escrow for cash collateral; and a Price Oracle for its value. Each has an on-chain proof. Fund I lends at 25 basis points, with 102 percent collateral and a 90/10 lender-agent fee split.

If asked: XLS-65 and XLS-66 are the baseline. Cover belongs to that baseline; do not count it as an additional primitive. The standing fund uses USDX token escrow; the older compressed lifecycle used XRP escrow. Escrow settlement and loan default are separate, not atomic.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/evidence/fund-term.json" target="_blank" rel="noreferrer">Standing-fund evidence</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/review/kpi-track2.md" target="_blank" rel="noreferrer">Loaded definition</a>

## 3. Track 2.  Proven on the ledger. — 0:40–1:15

Here is the Track 2 checklist: dated vault, subscription deposit, a funded loan within the term, all three wrong-phase rejections, and redemption. Each link is a validated transaction. The yield KPI remains partial: the compressed run returned capital, but interest rounded to zero. Our standing funds use real dates instead. Fund I shows the loan; Fund II lets a judge try an eligible or refused deposit, signed in the browser.

If asked: For the demo, use Fund II’s Sign tab with accounts listed in docs/DEMO-ACCOUNTS.md; their keys are provided by the team on request, not published in the repository. The browser-key path is proven on chain. Xaman is enabled on the canonical Vercel deployment and its backend accepts a VaultDeposit payload on Devnet; this is not evidence of a completed Xaman-signed ledger transaction. Otsu was inspected in code only. Never call expected interest already paid. Fund I loan return is 15 September 2026; redemption 16 September. Fund II subscription ends 16 September and redemption opens 16 December. Use existing transaction proofs if the live demo would exceed the pitch time.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/evidence/recall-t2.json" target="_blank" rel="noreferrer">Compressed lifecycle</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/evidence/fund-offering.json" target="_blank" rel="noreferrer">Browser-signing proofs</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/web/lib/finance.ts" target="_blank" rel="noreferrer">Cash-basis metrics</a>

## 4. The right code.  The wrong release. — 1:15–1:40

The brief’s beta types the vault but signs LoanSet with the wrong prefix. Stable signs correctly but lacks the closed-ended types. Beta one already fixes both: our recommendation is to update the brief, not request a fix that shipped. We used the codec directly. Wallet connection has the same trap: Crossmark and GemWallet connect, but cannot encode these vault transactions. Publish one capability matrix.

If asked: Report findings 1–2; F-001/F-002/F-019/F-020. The offline counterparty-signature reproduction verifies the helper and workaround against the counterparty prefix without submitting a transaction. xrpl-connect 1.0.0-rc.2 is pinned with an xrpl override and a narrow Turbopack ignore for a dead crypto-js AMD branch. Xaman is configured on the canonical Vercel deployment and its backend accepted a Devnet VaultDeposit payload; a completed wallet-signed ledger transaction has not been evidenced here. Otsu support is source-inspected only. API keys and wallet availability condition the options shown.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/DEVELOPER-REPORT.md" target="_blank" rel="noreferrer">Developer Report §§1–2</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/scripts/experiments/counterparty-signature.mjs" target="_blank" rel="noreferrer">Offline reproduction</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/web/lib/wallet-manager.ts" target="_blank" rel="noreferrer">Wallet capabilities</a>

## 5. Same lending flags.  Different rules. — 1:40–2:00

One LoanBrokerSet against an open-ended vault: success on the custom network, rejection on public Devnet. Both advertise the same two lending amendments, although their complete amendment sets differ. We corrected our first conclusion after testing both. Expose the effective lending version and publish the network-to-rules mapping. The application stays on public Devnet.

If asked: Report finding 3; F-011 supersedes F-004. Custom network 4001 / rippled 3.4.0-rc1, public network 2 / 3.4.0-rc5. Historical observed results, not a new transaction replay. The custom-network proof has no public-Devnet explorer link; use the report and research evidence. Full amendment counts: 48 versus 89, not identical sets.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/DEVELOPER-REPORT.md" target="_blank" rel="noreferrer">Developer Report §3 · custom-network proofs marked †</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/feedback/FRICTION-LOG.md" target="_blank" rel="noreferrer">F-011 corrects F-004</a>

## 6. The fields were there.  The meaning was not. — 2:00–2:30

The most expensive friction was accounting. Impairment leaves AssetsTotal unchanged: we initially displayed one instead of a net share value of point six. We fixed it. At default, ten-percent cover pays two hundred thousand; one-hundred-percent cover pays two million. The rate and available cover both cap recovery. Origination fees go to the broker, not lenders. These formulas need links from the fields where developers actually look.

If asked: F-013/F-014/F-016; web/lib/finance.ts now computes exit NAV as (AssetsTotal − LossUnrealized) / shares. Entry price remains AssetsTotal / shares by design. Historical default runs: 10% cover had 1,000,000 posted and settled at NAV 0.64; 100% cover had 2,500,000 posted and settled at 1.00. Both impaired at 0.60. They differ in posted cover as well as configured rate. The formulas exist in concepts: this is discoverability friction, not missing mathematics. Interest enters assets when paid under cash-basis accounting.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/evidence/default-arc-cover10000.json" target="_blank" rel="noreferrer">10% cover run</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/evidence/default-arc-cover100000.json" target="_blank" rel="noreferrer">100% cover run</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/web/lib/finance.ts" target="_blank" rel="noreferrer">Net NAV + cover formulas</a>

## 7. Permissioned.  But for whom? — 2:30–2:55

A domain refused a non-member’s deposit, then allowed a loan to that same account. It gates lenders, not borrowers. We did not discover an unknown vulnerability: the borrower-domain fix is already in two open proposals behind an unshipped amendment. Name that dependency on the reference pages. Separately, none of the fifteen lending transaction types is delegable. An agent needs a scoped operations key, starting with LoanManage.

If asked: F-018 and Developer Report “No lending transaction is delegable”. Borrower-domain work: XRPL-Standards #484 and rippled #6517, LendingPermissionedDomain. The proposed broker DomainID is separate from the vault DomainID. Fifteen DelegateSet failures were compared with a successful Payment control. No sensitive new exploit is presented. Grace is separate: impairment can begin after the due date while GracePeriod is still running; a one-sentence LoanManage precondition would clarify it.

Evidence: <a class="" href="https://devnet.xrpl.org/transactions/30C4B86FF9456761892943E69E0C2EC338A1EFE9F7CCF4AE1160ED831AEDB6F9" target="_blank" rel="noreferrer">Deposit refused</a> · <a class="" href="https://devnet.xrpl.org/transactions/DDD611413B8354071CB27DD291652E01424C52D82901611CC6DE042036972C12" target="_blank" rel="noreferrer">Loan allowed</a> · <a class="" href="https://github.com/XRPLF/rippled/pull/6517" target="_blank" rel="noreferrer">#6517</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/research/batch-delegation-escrow.md" target="_blank" rel="noreferrer">Delegation evidence</a>

## 8. A fixed end date.  A missing recall. — 2:55–3:15

The ledger rejects a loan schedule that runs too close to redemption. But an unpaid loan can still strand liquidity: thirty million available against forty million in assets, and a refused withdrawal. The calendar is enforced; repayment is not guaranteed. Our proposal is an early recall path, tfLoanCall, with a grace period and visibility into liquidity expected at redemption.

If asked: F-007; the schedule buffer is 60 seconds. Historical withdrawal D5879394…6E68 returned tecINSUFFICIENT_FUNDS. tfLoanCall is a proposal, not a flag implemented by patapim or enabled on either network. Default recovery remains available under its own preconditions and cover bounds; do not say default can never restore liquidity.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/DEVELOPER-REPORT.md" target="_blank" rel="noreferrer">Developer Report · calendar, cash & recall</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/feedback/FRICTION-LOG.md" target="_blank" rel="noreferrer">F-007 · D5879394…6E68</a>

## 9. We fixed the  search dead end. — 3:15–3:45

We also fixed a problem outside our app. Searching a loan or broker ID returned not found, although the explorer already displayed both inside the vault. PR 1342 resolves the object type and follows the parent to that vault: no extra request for a broker, one for a loan. We added regression coverage, handled review feedback and guarded malformed objects. It is open, awaiting review, not merged.

If asked: PR head 6420ea0. Repository documentation records local tests, lint and typecheck passing. The live GitHub snapshot reports REVIEW_REQUIRED and a successful Semgrep check; do not describe all required CI as approved. The PermissionedDomain not-found regression from #1320 is preserved. Limitation: no selection of the searched broker’s tab in a multi-broker vault; offered as follow-up. Broader generic ledger-entry navigation already exists as draft #1146.

Evidence: <a class="" href="https://github.com/ripple/explorer/pull/1342" target="_blank" rel="noreferrer">ripple/explorer#1342</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/CONTRIBUTION-explorer-search.md" target="_blank" rel="noreferrer">Contribution, tests, prior art & limitation</a>

## 10. Built it.  Fed it back. — 3:45–4:00

Our contribution is a working Track 2 product, a three-page Developer Report and an Explorer pull request. The asks are concrete: publish SDK, wallet and network capabilities; link field documentation to the actual accounting and pending amendments; and add recall and scoped delegation. Every headline leads back to code, a transaction or a pull request.

If asked: Also in the report: LoanPay type 83 in the spec versus 84 in the ledger; VaultCreate accepted a 12-drop fee while autofill charged a reserve; tfVaultDonate is open rippled #6383, not the workshop’s available tfVaultDonation. F-021 tracks lending excluded from Batch (#6360); F-022 counts three missing result codes and a typo, not forty. The friction log has 22 numbered entries including superseded/corrected observations; do not advertise 22 independent bugs. Submission items such as the DevEx form and second-machine hook are not automatically certified by this deck.

Evidence: <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/DEVELOPER-REPORT.md" target="_blank" rel="noreferrer">3-page Developer Report</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/ON-CHAIN.md" target="_blank" rel="noreferrer">On-chain inventory</a> · <a class="" href="https://github.com/gamween/patapim/blob/59964c8d7da07eb42bd3d35d9a32048f76ca7613/docs/review/FABLE-AUDIT.md" target="_blank" rel="noreferrer">External audit & corrections</a>
