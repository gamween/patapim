# Patapim — four-minute jury deck

Nine slides in English, 16:9. The deck uses the exact black, white, DM Mono and #1eff66 palette of the deployed ghost frontend, with original intro frames and the original ghost silhouette throughout.

Presentation: https://ways-stake-equations-suitable.trycloudflare.com/deck/index.html
PDF: docs/PATAPIM-DECK.pdf (also served at /deck/PATAPIM-DECK.pdf).

Arrow keys / Page Up / Page Down / Space navigate. Home and End jump. N toggles speaker notes; O toggles the overview. Fullscreen and a PDF download are available. Print exports every slide without controls or notes. Reduced-motion preferences disable slide transitions.

Content sources: README.md, DEVELOPER-REPORT.md, docs/PLAN.md and docs/evidence/. The developer report takes precedence over old gross share-price fields. Slide 6 recomputes net prices from the raw ledger evidence during generation: 1.00 → 0.60 → 1.00. This is a verified historical run, not live data.

Choose either the phase walk or default arc live. The other uses verified hashes: both cannot fit live into four minutes. The dashboard is read-only. No provisioning or transaction is triggered by viewing the slides.

The Explorer contribution is a pull request, not described as merged. It was verified OPEN on 12 September 2026.

## Regenerate

`python3 scripts/build-deck.py --app-url https://ways-stake-equations-suitable.trycloudflare.com`

Styles and controls: scripts/deck/. Speaker notes: docs/deck/slide-notes.json. Run `node scripts/export-deck.mjs` to export the PDF and slide PNGs. First install the web dependencies with `npm ci --prefix web` and a browser with `cd web && npx playwright install chromium`. Alternatively, set `CHROMIUM_PATH` to an existing Chromium executable. The export checks image and font loading, navigation, speaker notes, overview selection and mobile framing.

## 1. Good assets. Put to  work. — 0:00–0:15

Tokenised treasuries and money market funds need more than issuance. We built agency securities lending: holders lend securities through an agent, for a fee. This is a Devnet prototype with a fictitious security, not a production fund.

Evidence: README.md · Why / The trade

## 2. A market with an agent  on the hook. — 0:15–0:30

The asset in the vault is the security itself. The agent owns the vault and loan broker, checks borrower eligibility and posts cover. Loan interest accrues to the vault; origination fees go to the broker. The compressed demo does not demonstrate meaningful lender yield. XRP collateral is a separate bilateral escrow; do not describe escrow and default settlement as one atomic transaction.

Evidence: README.md · The trade / The other primitives

## 3. Eligibility,  enforced. — 0:30–1:30

Switch to the live vault provisioned by the protocol operator. The link uses DEMO_VAULT from lib/config.ts at deck-generation time; use the fresh vault URL when rehearsing. Trigger deposits from the existing operator script. The dashboard is read-only and does not submit transactions. If the phase walk is not the live arc, open verified transaction links.

Evidence: <a href="https://devnet.xrpl.org/transactions/CE5C7E595B0D9761B10BE9114AEF38597A03A9620A1590EE7DEC56528B47D06C" target="_blank" rel="noreferrer">Eligible · CE5C7E59</a> · <a href="https://devnet.xrpl.org/transactions/D4C938639DD005D8B4AD6ADB06425AC6E15047C15C02B80386AAA2E07C3DBC88" target="_blank" rel="noreferrer">Refused · D4C93863</a>

## 4. Time is part  of the protocol. — 1:30–2:00

The phase comes from immutable vault dates compared with the ledger close time. The page refreshes every ten seconds and never advances the phase from the browser clock. Show the deposit rejection at the phase boundary. The complete phase walk and default arc cannot both run live in four minutes: the minimum investment period is 180 seconds. Choose one and use verified evidence for the other.

Evidence: <a href="https://devnet.xrpl.org/transactions/7B9D16FA25DA3F54B7B3A13A63C21AB06775346264A4D1EC12228EBCFD709291" target="_blank" rel="noreferrer">Closed subscription · 7B9D16FA</a> · docs/PLAN.md

## 5. Two signatures.  One loan. — 2:00–2:30

Show the co-signed origination transaction and the resulting loan book row. The browser reads the ledger server-side; the protocol operator submits the transaction. The required beta SDK needs our counterparty-signing workaround, described later.

Evidence: <a href="https://devnet.xrpl.org/transactions/EDF107402242DB11C46B0DB87CDD97704CBB851840A3A49CC0BD31DD14B61C41" target="_blank" rel="noreferrer">Origination · EDF10740</a> · README.md / The trade

## 6. The borrower defaults.  The agent pays. — 2:30–3:15

Use the fully covered default arc. During impairment, the correct net price is 0.60: (5,000,000 − 2,000,000) / 5,000,000. The historical evidence file records the old gross-ratio price of 1.00 at that step; the net figure here is recomputed from its raw fields, consistent with lib/ledger.ts and the developer report. After default, cover restores net price to 1.00. Do not say that the price never moves. At a 10% cover rate, the same default ends at 0.64; the configured rate, not merely the posted balance, decides absorption.

Evidence: <a href="https://devnet.xrpl.org/transactions/95AD6692375BFD184155472FA105571BA9C9A836B221BB36F11CAA4F699C81D4" target="_blank" rel="noreferrer">Covered default · 95AD6692</a> · docs/evidence/default-arc-cover100000.json

## 7. We built the product.  Found the friction. — 3:15–3:35

Keep this to twenty seconds. The mandated beta has closed-ended types but uses the wrong signing prefix. Stable signs correctly but lacks the V1.1 types. Both hackathon networks enable the same lending amendments while enforcing different lending rules; their full amendment sets differ. These are observed development findings in the report; do not change networks in the demo.

Evidence: <a href="https://github.com/gamween/patapim/blob/main/DEVELOPER-REPORT.md" target="_blank" rel="noreferrer">DEVELOPER-REPORT.md · Findings 1–3</a>

## 8. A fixed end date.  A missing recall. — 3:35–3:45

This is a proposal for LendingProtocolV1_2, not a transaction the prototype can execute. Close the findings with a specific protocol ask: an early recall path so an agent can manage the vault’s maturity.

Evidence: DEVELOPER-REPORT.md · What the protocol made hard

## 9. patapim — 3:45–4:00

The Explorer PR was verified open when this deck was prepared; do not call it merged. Close on the actual contribution and invite the jury to inspect the live vault, transaction evidence and developer report. Submission: Sunday 13 September 2026 at 13:00 CEST; code freeze 12:30. Rehearse with a fresh vault and retain a recorded run for network failure.

Evidence: ripple/explorer#1342 · README.md · DEVELOPER-REPORT.md
