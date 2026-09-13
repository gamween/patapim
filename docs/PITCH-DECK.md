# Patapim — four-minute jury deck

Nine slides in English, 16:9. The deck uses the exact black, white, DM Mono and #1eff66 palette of the deployed ghost frontend, with original intro frames and the original ghost silhouette throughout.

Presentation: https://patapim-gamma.vercel.app/deck/index.html
PDF: docs/PATAPIM-DECK.pdf (also served at /deck/PATAPIM-DECK.pdf).

Arrow keys / Page Up / Page Down / Space navigate. Home and End jump. N toggles speaker notes; O toggles the overview. Fullscreen and a PDF download are available. Print exports every slide without controls or notes. Reduced-motion preferences disable slide transitions.

Content sources: README.md, DEVELOPER-REPORT.md, docs/PLAN.md and docs/evidence/. The developer report takes precedence over old gross share-price fields. Slide 6 recomputes net prices from the raw ledger evidence during generation: 1.00 → 0.60 → 1.00. This is a verified historical run, not live data.

Choose either the phase walk or default arc live. The other uses verified hashes: both cannot fit live into four minutes. The dashboard reads the ledger; its Sign tab relays a transaction the visitor signs in their own browser with a published demo key. Viewing the slides triggers nothing.

The Explorer contribution is a pull request, not described as merged. It was verified OPEN on 12 September 2026.

## Regenerate

`python3 scripts/build-deck.py --app-url https://patapim-gamma.vercel.app`

Styles and controls: scripts/deck/. Speaker notes: docs/deck/slide-notes.json. Run `node scripts/export-deck.mjs` to export the PDF and slide PNGs. First install the web dependencies with `npm ci --prefix web` and a browser with `cd web && npx playwright install chromium`. Alternatively, set `CHROMIUM_PATH` to an existing Chromium executable. The export checks image and font loading, navigation, speaker notes, overview selection and mobile framing.

## 1. Good assets. Put to  work. — 0:00–0:15

Tokenised treasuries and money market funds need more than issuance. We built agency securities lending: holders lend securities through an agent, for a fee. This is a Devnet prototype with a fictitious security, not a production fund.

Evidence: README.md · Why / The trade

## 2. A market with an agent  on the hook. — 0:15–0:30

The asset in the vault is the security itself. The agent owns the vault and the loan broker, posts first-loss capital in the same security and keeps a tenth of the lending fee, a 90/10 split. The borrower posts cash collateral at 102% of market value in a separate token escrow, priced by an on-ledger oracle. The ledger gates lenders, not borrowers: say so if asked, it is finding F-018. Do not describe escrow and default settlement as one atomic transaction.

Evidence: README.md · The trade · docs/research/lending-conventions.md

## 3. Eligibility,  enforced. — 0:30–1:30

Open Fund II, which is open for subscription, and go to the Sign tab. Load the demo key without a credential and sign a VaultDeposit: the ledger refuses it, tecNO_AUTH. Load the key with a credential: tesSUCCESS, and the position appears. Both keys are published in docs/DEMO-ACCOUNTS.md; the page signs in the browser and the server only relays the signed blob.

Evidence: <a href="https://devnet.xrpl.org/transactions/F018B9251EDAC42FF724928A653DD4FC70107D49122D815797D62B856C1D33DB" target="_blank" rel="noreferrer">Eligible · F018B925</a> · <a href="https://devnet.xrpl.org/transactions/F8492DE06B84745498EE8A6DA34AF7C1119BBFBBD11C4F54A05895E45497AC0E" target="_blank" rel="noreferrer">Refused · F8492DE0</a> · docs/DEMO-ACCOUNTS.md

## 4. Time is part  of the protocol. — 1:30–2:00

The phase comes from immutable vault dates compared with the ledger close time. The page refreshes every ten seconds and never advances the phase from the browser clock. Show the deposit rejection at the phase boundary. The complete phase walk and default arc cannot both run live in four minutes: the minimum investment period is 180 seconds. Choose one and use verified evidence for the other.

Evidence: <a href="https://devnet.xrpl.org/transactions/7B9D16FA25DA3F54B7B3A13A63C21AB06775346264A4D1EC12228EBCFD709291" target="_blank" rel="noreferrer">Closed subscription · 7B9D16FA</a> · docs/PLAN.md

## 5. Two signatures.  One loan. — 2:00–2:30

Show Fund I's loan book: 2,000,000 TBL on loan at 25 bps a year, returning Tuesday 15 September, collateral margin 102%. The loan was originated with one LoanSet carrying two signatures; the mandated beta SDK needs our counterparty-signing workaround, described later.

Evidence: <a href="https://devnet.xrpl.org/transactions/1A37017921F7AEFC76A76933CF937716EBF090EF8078860B3192C08B726E5646" target="_blank" rel="noreferrer">Origination · 1A370179</a> · <a href="https://devnet.xrpl.org/transactions/DDF576E8ADF005B4D3EDE412ED9AF289DD47C9FF064A37C093A345F3E5258B51" target="_blank" rel="noreferrer">Collateral · DDF576E8</a>

## 6. The borrower defaults.  The agent pays. — 2:30–3:15

Use the fully covered default arc. During impairment, the correct net price is 0.60: (5,000,000 − 2,000,000) / 5,000,000. The evidence file records the net price at each step, computed from its raw fields, consistent with lib/ledger.ts and the developer report. After default, cover restores net price to 1.00. Do not say that the price never moves. At a 10% cover rate, the same default ends at 0.64; the configured rate, not merely the posted balance, decides absorption.

Evidence: <a href="https://devnet.xrpl.org/transactions/95AD6692375BFD184155472FA105571BA9C9A836B221BB36F11CAA4F699C81D4" target="_blank" rel="noreferrer">Covered default · 95AD6692</a> · docs/evidence/default-arc-cover100000.json

## 7. We built the product.  Found the friction. — 3:15–3:35

Keep this to twenty seconds. The mandated beta has the closed-ended types but the wrong signing prefix; stable signs correctly but lacks the types; beta.1, published during the event, has both and the brief does not point at it. Both hackathon networks enable the same lending amendments while enforcing different lending rules. Do not change networks in the demo.

Evidence: <a href="https://github.com/gamween/patapim/blob/main/DEVELOPER-REPORT.md" target="_blank" rel="noreferrer">DEVELOPER-REPORT.md · Findings 1–3</a>

## 8. A fixed end date.  A missing recall. — 3:35–3:45

This is a proposal for LendingProtocolV1_2, not a transaction the prototype can execute. Close the findings with a specific protocol ask: an early recall path so an agent can manage the vault’s maturity.

Evidence: DEVELOPER-REPORT.md · What the protocol made hard

## 9. patapim — 3:45–4:00

The Explorer PR was verified open when this deck was prepared; do not call it merged. Close on the actual contribution and invite the jury to inspect the live vault, transaction evidence and developer report. Submission: Sunday 13 September 2026 at 13:00 CEST; code freeze 12:30. Rehearse with a fresh vault and retain a recorded run for network failure.

Evidence: ripple/explorer#1342 · README.md · DEVELOPER-REPORT.md
