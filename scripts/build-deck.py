"""Build the ghost-branded jury deck from local evidence and speaker notes."""

from pathlib import Path
from decimal import Decimal
import argparse
import html
import json
import re
import shutil

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument(
    "--app-url",
    default="https://ways-stake-equations-suitable.trycloudflare.com",
    help="Public app URL used by the presentation and PDF links.",
)
args = parser.parse_args()
app_url = args.app_url.rstrip("/")
out = root / "web/public/deck"
out.mkdir(parents=True, exist_ok=True)
vault = re.search(r"DEMO_VAULT = '([^']+)'", (root / "web/lib/config.ts").read_text())[
    1
]
notes = json.loads((root / "docs/deck/slide-notes.json").read_text())
evidence = json.loads((root / "docs/evidence/default-arc-cover100000.json").read_text())
states = evidence["states"][1:]
prices = [
    (Decimal(s["AssetsTotal"]) - Decimal(s["LossUnrealized"])) / Decimal(s["shares"])
    for s in states
]
assert prices == [Decimal("1"), Decimal(".6"), Decimal("1")]
covered = Decimal(states[-2]["CoverAvailable"]) - Decimal(states[-1]["CoverAvailable"])
assert covered == Decimal("2000000")

# Original ghost frames: the same material variants used by the site's intro.
frame = {
    "green": "set51/15.webp",
    "metal": "set19/11.webp",
    "glass": "set52/17.webp",
    "white": "set30/20.webp",
}
ghost_svg = "../reference/site/ghost.svg"


def ghost(material, classes="ghost-right"):
    return f'<img class="ghost-art {classes}" src="../reference/frames/{frame[material]}" alt="" aria-hidden="true" draggable="false">'


def heading(title, label):
    return f'<div class="slide-heading"><div class="eyebrow">{label}</div><h1>{title}</h1></div>'


def external(url, label, cls=""):
    return f'<a class="{cls}" href="{html.escape(url, quote=True)}" target="_blank" rel="noreferrer">{label}</a>'


app_link = external(
    f"{app_url}/vault/{vault}", "Open live vault <span>↗</span>", "pill-link"
)

chart_points = [(40, 58), (263, 168), (486, 58)]
chart = '<div class="price-chart"><small>NET SHARE PRICE / VERIFIED DEFAULT ARC</small><svg viewBox="0 0 542 222" role="img" aria-label="Net share price: 1.00 when drawn, 0.60 when impaired, 1.00 after covered default">'
chart += '<path d="M40 178H486" stroke="#343934"/><path d="M40 58H486" stroke="#303630" stroke-dasharray="3 7"/><path d="M40 58L263 168L486 58" fill="none" stroke="#1eff66" stroke-width="2"/>'
for (x, y), price, label in zip(
    chart_points, prices, ["LOAN DRAWN", "IMPAIRED", "DEFAULT SETTLED"]
):
    chart += f'<circle cx="{x}" cy="{y}" r="4" fill="#1eff66"/><image href="{ghost_svg}" x="{x - 9}" y="{y - 37}" width="18" height="29"/><text x="{x}" y="{y - 47}" text-anchor="middle" font-size="27" fill="#f5f5f2">{price:.2f}</text><text x="{x}" y="211" text-anchor="middle" font-size="10" fill="#92928d">{label}</text>'
chart += "</svg></div>"

titles = [
    "Good assets.<br>Put to <em>work.</em>",
    "A market with an agent<br><em>on the hook.</em>",
    "Eligibility,<br><em>enforced.</em>",
    "Time is part<br><em>of the protocol.</em>",
    "Two signatures.<br><em>One loan.</em>",
    "The borrower defaults.<br><em>The agent pays.</em>",
    "We built the product.<br><em>Found the friction.</em>",
    "A fixed end date.<br><em>A missing recall.</em>",
    "patapim",
]
classes = [
    "cover",
    "product",
    "eligibility",
    "calendar",
    "origination",
    "default",
    "findings",
    "recall",
    "closing",
]
labels = [
    "01 / THE OPPORTUNITY",
    "02 / THE MARKET",
    "03 / ACCESS",
    "04 / THE CALENDAR",
    "05 / ORIGINATION",
    "06 / DEFAULT",
    "07 / DEVELOPER FINDINGS",
    "08 / THE PROPOSAL",
    "09 / BUILT ON XRPL",
]
bodies = [
    ghost("green", "hero-art")
    + '<div class="summary">Securities lending,<br>native on the XRP Ledger.<small>Eligible holders lend securities through an agent,<br>from a fixed-term vault.</small></div><div class="tags"><span>XLS-65 + XLS-66</span><span>TRACK 2 / CLOSED-ENDED</span><span>DEVNET PROTOTYPE</span></div><div class="crosshair"><span class="signal-line"></span>ASSETS IN MOTION</div>',
    ghost("metal")
    + '<div class="flow-rail"><div class="flow-node"><small>01 / SUPPLY</small><h3>Eligible holders</h3><p>Deposit securities.<br>Receive vault shares.</p></div><div class="flow-node focus"><small>02 / POOL</small><h3>Fixed-term vault</h3><p>The security is the asset.<br>The lending window is defined.</p></div><div class="flow-node"><small>03 / DEMAND</small><h3>Borrowers</h3><p>Borrow securities.<br>Repay principal and interest.</p></div></div><p class="under-flow">The agent posts <span>first-loss capital</span> in the same security.</p>',
    ghost("white")
    + '<div class="gate" aria-hidden="true"></div><div class="results"><div class="result"><span>Eligible holder / VaultDeposit</span><strong class="green">tesSUCCESS</strong></div><div class="result"><span>Non-member / VaultDeposit</span><strong class="blocked">tecNO_AUTH</strong></div></div><p class="eligible-note">Lender access is gated by Credentials<br>and a Permissioned Domain.</p>'
    + app_link,
    ghost("glass")
    + f'<div class="timeline"><div class="period"><img src="{ghost_svg}" alt=""><small>01 / SUBSCRIPTION</small><h3>Deposit.</h3><p>LoanSet refused<br><code>tecTOO_SOON</code></p></div><div class="period active"><img src="{ghost_svg}" alt=""><small>02 / INVESTMENT</small><h3>Lend.</h3><p>VaultDeposit refused<br><code>tecEXPIRED</code></p></div><div class="period"><img src="{ghost_svg}" alt=""><small>03 / REDEMPTION</small><h3>Withdraw.</h3><p>LoanSet refused<br><code>tecEXPIRED</code></p></div></div><p class="clock-note">IMMUTABLE VAULT DATES + LEDGER CLOSE TIME. THE BROWSER DOES NOT SET THE PHASE.</p>',
    ghost("metal")
    + '<div class="signature"><span>Lending agent</span><b>+</b><span>Borrower</span><b>=</b><strong>LoanSet</strong></div><div class="asset-rail"><div><small>THE ASSET</small><h3>MPT security</h3><p>Delivered to the borrower.</p></div><div><small>THE CAPITAL</small><h3>First-loss cover</h3><p>Agent-funded, in securities.</p></div><div><small>THE COLLATERAL</small><h3>XRP escrow</h3><p>Managed bilaterally; separate settlement.</p></div></div>',
    ghost("glass")
    + f'<div class="loss-total"><strong>{covered:,.0f}</strong><h3>Securities absorbed by agent cover.</h3><p>AGENT COVER &nbsp; 2,500,000 → 500,000<br>VAULT ASSETS AFTER DEFAULT &nbsp; 5,000,000</p></div>'
    + chart
    + '<p class="formula">NET SHARE PRICE = (ASSETSTOTAL − LOSSUNREALIZED) / OUTSTANDINGAMOUNT · 100% COVER RATE IN THIS VERIFIED RUN</p>',
    ghost("metal")
    + '<div class="findings-list"><div class="finding"><b>01</b><h3>The signature prefix.</h3><div><p>The mandated beta cannot co-sign.</p><small>BACKPORT COUNTERPARTY SIGNING.</small></div></div><div class="finding"><b>02</b><h3>Split SDK support.</h3><div><p>V1.1 types or working signatures.</p><small>SHIP BOTH IN ONE RELEASE.</small></div></div><div class="finding"><b>03</b><h3>The network mismatch.</h3><div><p>Same lending amendments. Different rules.</p><small>PUBLISH EFFECTIVE PROTOCOL VERSIONS.</small></div></div></div><p class="findings-caption">OBSERVED WHILE BUILDING ON PUBLIC XRPL DEVNET · XRPL.JS 5.2.0-BETA.0 · SEPTEMBER 2026</p>',
    ghost("metal")
    + '<div class="orbit" aria-hidden="true"></div><div class="proposal"><small>PROPOSED / NOT IMPLEMENTED</small><strong>tfLoanCall</strong><p>Call the loan before term.<br>Use the borrower’s grace period.</p></div>',
    ghost("green")
    + '<p class="closing-line">Native lending.<br>Real evidence.</p><div class="contributions"><div><small>01 / THE PRODUCT</small>'
    + external(f"{app_url}/vault/{vault}", "A working trade ↗")
    + "</div><div><small>02 / THE FINDINGS</small>"
    + external(
        "https://github.com/gamween/patapim/blob/feat/patapim-art-direction/DEVELOPER-REPORT.md",
        "Developer report ↗",
    )
    + "</div><div><small>03 / THE CONTRIBUTION</small>"
    + external("https://github.com/ripple/explorer/pull/1342", "Explorer PR #1342 ↗")
    + "</div></div>"
    + external(app_url, "ENTER PATAPIM ↗", "close-cta"),
]
parts = []
for i, (title, body, cls, label, meta) in enumerate(
    zip(titles, bodies, classes, labels, notes)
):
    meta["title"] = re.sub("<[^>]+>", " ", title).strip()
    parts.append(f'''<section class="slide {cls}" id="slide-{i + 1}" aria-label="Slide {i + 1} of 9: {html.escape(meta["title"], quote=True)}" {"hidden" if i else ""}>
    <a class="brand" href="{app_url}" target="_blank" rel="noreferrer"><img src="{ghost_svg}" alt="">patapim<sup>®</sup></a>
    <div class="top-meta"><span>XRPL DEVNET</span>PARIS, SEPTEMBER 2026</div><span class="corner" aria-hidden="true">+</span>
    <div class="slide-content">{body}{heading(title, label)}</div>
    <div class="source">{meta["source"]}</div><div class="folio"><span>PATAPIM / SECURITIES LENDING</span><span><b>{i + 1:02d}</b> / 09</span></div>
    </section>''')
notes_json = json.dumps(notes, ensure_ascii=False).replace("<", "\\u003c")
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Patapim — Jury deck</title><meta name="description" content="A nine-slide ghost-branded pitch: native securities lending on XRPL, with verified evidence and speaker notes."><link rel="icon" href="{ghost_svg}" type="image/svg+xml"><link rel="stylesheet" href="deck.css"></head><body>
<main class="viewport"><div class="deck">{"".join(parts)}</div></main><div class="progress" aria-hidden="true"></div>
<nav class="controls" aria-label="Presentation controls"><button id="prev" aria-label="Previous slide">←</button><span id="count" class="counter" role="status" aria-live="polite">01 / 09</span><button id="next" aria-label="Next slide">→</button><button id="overview" aria-pressed="false">Overview</button><button id="notes" aria-pressed="false">Notes</button><button id="fullscreen" class="optional">Fullscreen ↗</button><button id="print" class="optional">Print</button><a href="PATAPIM-DECK.pdf" download>PDF ↓</a><a class="optional" href="{app_url}" target="_blank" rel="noreferrer">Website ↗</a></nav>
<aside id="notes-panel" class="notes-panel" aria-label="Speaker notes" hidden><button id="close-notes" aria-label="Close notes">×</button><h2>SPEAKER NOTES</h2><p id="speaker-copy"></p><span id="speaker-time" class="timing"></span></aside>
<script id="notes-data" type="application/json">{notes_json}</script><script src="deck.js"></script></body></html>'''
(out / "index.html").write_text(page)
for name in ["deck.css", "deck.js"]:
    shutil.copy2(root / "scripts/deck" / name, out / name)
md = [
    "# Patapim — four-minute jury deck",
    "",
    "Nine slides in English, 16:9. The deck uses the exact black, white, DM Mono and #1eff66 palette of the deployed ghost frontend, with original intro frames and the original ghost silhouette throughout.",
    "",
    f"Presentation: {app_url}/deck/index.html",
    "PDF: docs/PATAPIM-DECK.pdf (also served at /deck/PATAPIM-DECK.pdf).",
    "",
    "Arrow keys / Page Up / Page Down / Space navigate. Home and End jump. N toggles speaker notes; O toggles the overview. Fullscreen and a PDF download are available. Print exports every slide without controls or notes. Reduced-motion preferences disable slide transitions.",
    "",
    "Content sources: README.md, DEVELOPER-REPORT.md, docs/PLAN.md and docs/evidence/. The developer report takes precedence over old gross share-price fields. Slide 6 recomputes net prices from the raw ledger evidence during generation: 1.00 → 0.60 → 1.00. This is a verified historical run, not live data.",
    "",
    "Choose either the phase walk or default arc live. The other uses verified hashes: both cannot fit live into four minutes. The dashboard is read-only. No provisioning or transaction is triggered by viewing the slides.",
    "",
    "The Explorer contribution is a pull request, not described as merged. It was verified OPEN on 12 September 2026.",
    "",
    "## Regenerate",
    "",
    f"`python3 scripts/build-deck.py --app-url {app_url}`",
    "",
    "Styles and controls: scripts/deck/. Speaker notes: docs/deck/slide-notes.json. Run `node scripts/export-deck.mjs` to export the PDF and slide PNGs. First install the web dependencies with `npm ci --prefix web` and a browser with `cd web && npx playwright install chromium`. Alternatively, set `CHROMIUM_PATH` to an existing Chromium executable. The export checks image and font loading, navigation, speaker notes, overview selection and mobile framing.",
    "",
]
for i, s in enumerate(notes):
    md += [
        f"## {i + 1}. {s['title']} — {s['time']}",
        "",
        s["note"],
        "",
        "Evidence: " + s["source"],
        "",
    ]
(root / "docs/PITCH-DECK.md").write_text("\n".join(md).rstrip() + "\n")
print(
    f"Built {len(parts)} slides; validated net prices: "
    + ", ".join(f"{p:.2f}" for p in prices)
)
