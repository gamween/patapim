"""Build the 10-slide, evidence-led Track 2 / Loaded jury deck."""

from pathlib import Path
from decimal import Decimal
import argparse
import html
import json
import re
import shutil

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--app-url", default="https://patapim-gamma.vercel.app")
parser.add_argument(
    "--deck-url", default="https://ways-stake-equations-suitable.trycloudflare.com"
)
args = parser.parse_args()
app_url = args.app_url.rstrip("/")
deck_url = args.deck_url.rstrip("/")
out = root / "web/public/deck"
out.mkdir(parents=True, exist_ok=True)
read = lambda name: json.loads((root / name).read_text())
notes = read("docs/deck/slide-notes.json")
verification = read("docs/deck/verification.json")
revision = verification["sourceCommit"]
review_date = verification["checkedAt"][:10]
repo = f"https://github.com/gamween/patapim/blob/{revision}/"
report_url = repo + "DEVELOPER-REPORT.md"
term = read("docs/evidence/fund-term.json")
offering = read("docs/evidence/fund-offering.json")
cycle = read("docs/evidence/recall-t2.json")
config = (root / "web/lib/config.ts").read_text()
assert term["vaultID"] == re.search(r"DEMO_VAULT = '([^']+)'", config)[1]
assert offering["vaultID"] in config
assert len(notes) == 10
arcs = [read(f"docs/evidence/default-arc-cover{r}.json") for r in (10000, 100000)]
nav = lambda s: (
    (Decimal(s["AssetsTotal"]) - Decimal(s["LossUnrealized"])) / Decimal(s["shares"])
)
assert [nav(a["states"][2]) for a in arcs] == [Decimal(".60"), Decimal(".60")]
assert [nav(a["states"][-1]) for a in arcs] == [Decimal(".64"), Decimal("1")]
payouts = [
    Decimal(a["states"][2]["CoverAvailable"])
    - Decimal(a["states"][-1]["CoverAvailable"])
    for a in arcs
]
assert payouts == [Decimal("200000"), Decimal("2000000")]
pr = verification["pullRequests"]["ripple/explorer#1342"]
assert pr["state"] == "OPEN" and pr["mergedAt"] is None, (
    "Update the PR slide to match the new review state."
)


def link(url, label, cls=""):
    return f'<a class="{cls}" href="{html.escape(url, quote=True)}" target="_blank" rel="noreferrer">{label}</a>'


def doc(path, label):
    return link(repo + path, label)


def tx(data, step, label=None):
    e = next(e for e in data["events"] if e["step"] == step)
    return link(
        "https://devnet.xrpl.org/transactions/" + e["hash"], label or e["hash"][:8]
    )


svg = "../reference/site/ghost.svg"
frames = {
    "green": "set51/15.webp",
    "metal": "set19/11.webp",
    "glass": "set52/17.webp",
    "white": "set30/20.webp",
}


def ghost(material, cls="report-ghost"):
    return f'<img class="ghost-art {cls}" src="../reference/frames/{frames[material]}" alt="" aria-hidden="true">'


def action(text):
    return f'<p class="report-action"><span>PROPOSED FIX</span>{text}</p>'


def row(*cells):
    return "<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"


fund1 = link(f"{app_url}/vault/{term['vaultID']}", "Fund I ↗", "pill-link")
fund2 = link(f"{app_url}/vault/{offering['vaultID']}", "Fund II / Sign ↗", "pill-link")
loaded_rows = [
    (
        "MPTs",
        "TBL securities + USDX cash. Actual fund assets.",
        tx(term, "MPTokenIssuanceCreate security", "Security")
        + " / "
        + tx(term, "MPTokenIssuanceCreate cash", "Cash"),
    ),
    (
        "Credentials",
        "An on-ledger eligibility attestation, accepted by its holder.",
        tx(term, "CredentialCreate lender", "Create")
        + " / "
        + tx(term, "CredentialAccept lender", "Accept"),
    ),
    (
        "Permissioned Domain",
        "Lender access: the fund shares carry the domain.",
        tx(offering, "app relay: ineligible investor is refused", "tecNO_AUTH"),
    ),
    (
        "Token Escrow",
        "USDX cash collateral at 102% of market value.",
        tx(term, "EscrowCreate collateral", "EscrowCreate"),
    ),
    (
        "Price Oracle",
        "An on-ledger TBL/USD price to value the collateral.",
        tx(term, "OracleSet", "OracleSet"),
    ),
]
loaded = "".join(
    f'<div class="loaded-row"><h3>{a}</h3><p>{b}</p><small>{c} ↗</small></div>'
    for a, b, c in loaded_rows
)
kpis = [
    (
        "Dated closed-ended vault",
        "PROVEN",
        tx(cycle, "VaultCreate", "VaultKind 1 · 5-minute investment window"),
    ),
    (
        "Deposit during Subscription",
        "PROVEN",
        tx(cycle, "VaultDeposit lender", "VaultDeposit · tesSUCCESS"),
    ),
    (
        "Loan funded before Redemption",
        "PROVEN",
        tx(cycle, "LoanSet", "LoanSet · tesSUCCESS"),
    ),
    (
        "Reject deposits + withdrawals in term",
        "PROVEN",
        tx(cycle, "VaultDeposit after close", "tecEXPIRED")
        + " / "
        + tx(cycle, "VaultWithdraw during Investment", "tecTOO_SOON"),
    ),
    (
        "Reject new loans during Redemption",
        "PROVEN",
        tx(cycle, "LoanSet in redemption", "LoanSet · tecEXPIRED"),
    ),
    (
        "Redeem capital + accrued yield",
        "PARTIAL",
        tx(
            cycle, "VaultWithdraw by shares", "Capital returned · yield rounded to zero"
        ),
    ),
]
kpi_table = (
    '<table class="kpi-table"><thead><tr><th>TRACK 2 REQUIREMENT</th><th>STATUS</th><th>VALIDATED EVIDENCE ↗</th></tr></thead><tbody>'
    + "".join(
        row(
            a,
            f'<span class="{("green" if b == "PROVEN" else "partial")}">{b}</span>',
            c,
        )
        for a, b, c in kpis
    )
    + "</tbody></table>"
)
sdk_table = (
    '<table class="sdk-table"><thead><tr><th>XRPL.JS</th><th>CLOSED-ENDED TYPES</th><th>COUNTERPARTY SIGNING</th></tr></thead><tbody>'
    + row("5.2.0-beta.0 / brief", "Yes", "Wrong prefix")
    + row("5.2.0 / stable", "Missing", "Correct")
    + row(
        '<span class="green">5.2.0-beta.1</span>',
        '<span class="green">Yes</span>',
        '<span class="green">Correct — already shipped</span>',
    )
    + "</tbody></table>"
)
network_cards = '<div class="network-pair"><div><small>CUSTOM HACKATHON DEVNET · 4001</small><h3>3.4.0-rc1</h3><strong class="green">tesSUCCESS</strong><p>Open-ended vault accepted.</p></div><div><small>PUBLIC XRPL DEVNET · 2</small><h3>3.4.0-rc5</h3><strong>tecNO_PERMISSION</strong><p>Closed-ended vault required.</p></div></div>'
accounting = (
    '<div class="accounting-pair"><div><small>IMPAIRMENT / WE SHIPPED THIS BUG</small><div class="nav-comparison"><span>1.00</span><b>→</b><strong>0.60</strong></div><p>Gross assets hide a 40% write-down.</p><code>NAV = (assets − unrealised loss) / shares</code></div><div><small>DEFAULT / RATE AND BALANCE CAP THE PAYOUT</small><table><thead><tr><th>COVER RATE</th><th>COVER PAYS</th><th>FINAL NAV</th></tr></thead><tbody>'
    + "".join(
        row(rate, f"{paid:,.0f}", f"{nav(a['states'][-1]):.2f}")
        for rate, paid, a in zip(["10%", "100%"], payouts, arcs)
    )
    + "</tbody></table><p>Posted cover: 1M / 2.5M respectively.</p></div></div>"
)
permissions = '<div class="permission-pair"><div><small>ELIGIBILITY / F-018</small><h3>Same non-member.</h3><p><span>VaultDeposit</span><code>tecNO_AUTH</code></p><p><span>LoanSet</span><code class="green">tesSUCCESS</code></p><small class="pending">BORROWER DOMAIN: #484 + #6517 OPEN<br>LendingPermissionedDomain NOT SHIPPED</small></div><div><small>OPERATIONS / DELEGATION</small><h3>15 attempts. 15 refusals.</h3><strong>temMALFORMED</strong><p>No Vault / Loan transaction is delegable.</p><small class="pending">ASK: START WITH LoanManage<br>AND LoanBrokerCoverDeposit</small></div></div>'
bodies = [
    ghost("green", "hero-art")
    + '<div class="summary">Agency securities lending on XRPL.<small>A fixed-term fund lends TBL through an agent.<br>The agent posts first-loss capital in the same security.</small></div><div class="tags"><span>TRACK 2 / CLOSED-ENDED</span><span>LOADED</span><span>LENDING V1.1</span></div><p class="cover-environment">PUBLIC DEVNET · NETWORK 2 · XRPL.JS 5.2.0-BETA.0</p>',
    ghost("metal")
    + '<p class="baseline"><span>VANILLA BASELINE</span> XLS-65 vault + XLS-66 lending <b>+</b> five useful primitives</p><div class="loaded-list">'
    + loaded
    + '</div><p class="loaded-conclusion">Each extra primitive serves the trade — and exposes integration feedback.</p>',
    ghost("white")
    + kpi_table
    + '<div class="kpi-bottom"><p><strong>Real-world dates:</strong> Fund I loan due 15 Sep; Fund II term 16 Sep–16 Dec.<br>Cash-basis yield is recognised on payment; expected interest is not yet earned.</p><div>'
    + fund1
    + fund2
    + "</div></div>",
    ghost("metal")
    + sdk_table
    + '<p class="sdk-workaround">OUR WORKAROUND <code>encodeForSigningCounterparty</code> · offline repro included</p><div class="wallet-note"><strong>Connected ≠ able to sign.</strong><p>Crossmark / GemWallet lack vault + MPT encoding.<br>Xaman: Devnet payload accepted. Otsu: code-inspected. Demo-key flow proven.</p></div>'
    + action("Point the brief at beta.1. Publish SDK + wallet capability matrices."),
    ghost("glass")
    + '<p class="network-trigger"><code>LoanBrokerSet</code> against an <strong>open-ended</strong> vault.</p>'
    + network_cards
    + '<p class="network-note">Both enable LendingProtocol + LendingProtocolV1_1.<br>Full amendment sets differ: 48 vs 89. The lending flags alone do not explain the result.</p>'
    + action(
        "Expose the effective lending version; publish the network-to-rules mapping."
    ),
    ghost("glass")
    + accounting
    + '<p class="fee-note"><span>LoanOriginationFee</span> goes to the broker. Lenders earn interest, net of the agent split.</p>'
    + action(
        "Link field tables to the existing formulas. Return net NAV from vault_info."
    ),
    ghost("white")
    + permissions
    + action(
        "Name pending amendments in the reference pages; enable scoped operations keys."
    ),
    ghost("metal", "recall-ghost")
    + '<div class="liquidity"><small>AT REDEMPTION / VERIFIED HISTORICAL RUN</small><strong><span>30M</span> / 40M</strong><p>Assets available / total assets</p><code>VaultWithdraw → tecINSUFFICIENT_FUNDS</code></div><div class="recall-proposal"><small>PROPOSED / NOT IMPLEMENTED</small><strong>tfLoanCall</strong><p>Early recall + grace period.<br>Expose expected liquidity at redemption.</p></div>',
    ghost("metal", "contribution-ghost")
    + '<div class="pr-number">#1342<small>RIPPLE / EXPLORER</small></div><div class="pr-detail"><p class="pr-before">BEFORE <span>Loan / broker ID → not found</span></p><div class="pr-route"><span>Loan</span><b>→</b><span>LoanBroker</span><b>→</b><strong>Vault</strong></div><p>One ledger_entry lookup by object type.<br>Same request count for a broker; one extra hop for a loan.</p><ul><li>Regression tests + malformed-object guards</li><li>Review feedback applied; local checks documented</li><li>No broker-tab deep link yet</li></ul></div><div class="pr-state">'
    + link(pr["url"], "OPEN · AWAITING REVIEW ↗")
    + f"<span>VERIFIED {review_date} · NOT MERGED</span></div>",
    ghost("green", "takeaway-ghost")
    + '<div class="takeaway-list"><div><b>01</b><h3>Make capability visible.</h3><p>SDK versions. Wallet encoders. Effective network rules.</p></div><div><b>02</b><h3>Make the docs actionable.</h3><p>Accounting formulas. Fee recipients. Pending amendments.</p></div><div><b>03</b><h3>Make the term manageable.</h3><p>Recall. Redemption liquidity. Scoped delegation.</p></div></div><div class="deliverables">'
    + link(report_url, "Developer Report ↗")
    + doc("docs/feedback/FRICTION-LOG.md", "Friction log ↗")
    + link(pr["url"], "Explorer PR ↗")
    + "</div>",
]
titles = [
    "Good assets.<br>Put to <em>work.</em>",
    "Why <em>Loaded.</em>",
    "Track 2.<br><em>Proven on the ledger.</em>",
    "The right code.<br><em>The wrong release.</em>",
    "Same lending flags.<br><em>Different rules.</em>",
    "The fields were there.<br><em>The meaning was not.</em>",
    "Permissioned.<br><em>But for whom?</em>",
    "A fixed end date.<br><em>A missing recall.</em>",
    "We fixed the<br><em>search dead end.</em>",
    "Built it.<br><em>Fed it back.</em>",
]
classes = [
    "cover",
    "loaded",
    "kpi",
    "sdk",
    "networks",
    "accounting",
    "permissions",
    "recall-report",
    "contribution",
    "takeaways",
]
labels = [
    "TRACK 2 / CLOSED-ENDED VAULT / LOADED",
    "WHY LOADED / USEFUL INTEGRATION",
    "TRACK 2 / KPI & DEMO EVIDENCE",
    "DEVELOPER REPORT / 1–2 + F-019–020",
    "DEVELOPER REPORT / 3 · F-011",
    "DEVELOPER REPORT / F-013 · F-014 · F-016",
    "DEVELOPER REPORT / F-018 + DELEGATION",
    "DEVELOPER REPORT / F-007",
    "CONTRIBUTION / RIPPLE EXPLORER",
    "DEVELOPER EXPERIENCE / THE ASKS",
]
sources = [
    doc("README.md", "README · Track, environment & trade"),
    doc("docs/evidence/fund-term.json", "Standing-fund evidence")
    + " · "
    + doc("docs/review/kpi-track2.md", "Loaded definition"),
    doc("docs/evidence/recall-t2.json", "Compressed lifecycle")
    + " · "
    + doc("docs/evidence/fund-offering.json", "Browser-signing proofs")
    + " · "
    + doc("web/lib/finance.ts", "Cash-basis metrics"),
    link(report_url, "Developer Report §§1–2")
    + " · "
    + doc("scripts/experiments/counterparty-signature.mjs", "Offline reproduction")
    + " · "
    + doc("web/lib/wallet-manager.ts", "Wallet capabilities"),
    link(report_url, "Developer Report §3 · custom-network proofs marked †")
    + " · "
    + doc("docs/feedback/FRICTION-LOG.md", "F-011 corrects F-004"),
    doc("docs/evidence/default-arc-cover10000.json", "10% cover run")
    + " · "
    + doc("docs/evidence/default-arc-cover100000.json", "100% cover run")
    + " · "
    + doc("web/lib/finance.ts", "Net NAV + cover formulas"),
    tx(cycle, "VaultDeposit mm (gated)", "Deposit refused")
    + " · "
    + tx(cycle, "LoanSet", "Loan allowed")
    + " · "
    + link("https://github.com/XRPLF/rippled/pull/6517", "#6517")
    + " · "
    + doc("docs/research/batch-delegation-escrow.md", "Delegation evidence"),
    link(report_url, "Developer Report · calendar, cash & recall")
    + " · "
    + doc("docs/feedback/FRICTION-LOG.md", "F-007 · D5879394…6E68"),
    link(pr["url"], "ripple/explorer#1342")
    + " · "
    + doc(
        "docs/CONTRIBUTION-explorer-search.md",
        "Contribution, tests, prior art & limitation",
    ),
    link(report_url, "3-page Developer Report")
    + " · "
    + doc("docs/ON-CHAIN.md", "On-chain inventory")
    + " · "
    + doc("docs/review/FABLE-AUDIT.md", "External audit & corrections"),
]
parts = []
for i, (title, body, cls, label, source, meta) in enumerate(
    zip(titles, bodies, classes, labels, sources, notes), 1
):
    meta.update(title=re.sub("<[^>]+>", " ", title).strip(), source=source)
    parts.append(f'''<section class="slide {cls}" id="slide-{i}" aria-label="Slide {i} of 10: {html.escape(meta["title"], quote=True)}" {"hidden" if i > 1 else ""}>
<a class="brand" href="{app_url}" target="_blank" rel="noreferrer"><img src="{svg}" alt="">patapim<sup>®</sup></a>
<div class="top-meta"><span>TRACK 2 / LOADED</span>PARIS, 13 SEPTEMBER 2026</div><span class="corner" aria-hidden="true">+</span>
<div class="slide-content">{body}<div class="slide-heading"><div class="eyebrow">{label}</div><h1>{title}</h1></div></div>
<div class="source">{source}</div><div class="folio"><span>PATAPIM / {"PRODUCT & KPI" if i <= 3 else "DEVELOPER FEEDBACK"}</span><span><b>{i:02d}</b> / 10</span></div></section>''')
notes_json = json.dumps(notes, ensure_ascii=False).replace("<", "\\u003c")
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Patapim — Track 2 / Loaded / Developer feedback</title><meta name="description" content="Ten slides: Track 2 and Loaded evidence, developer feedback, proposed improvements and Explorer PR 1342."><link rel="icon" href="{svg}" type="image/svg+xml"><link rel="stylesheet" href="deck.css"><link rel="stylesheet" href="feedback.css"></head><body>
<main class="viewport"><div class="deck">{"".join(parts)}</div></main><div class="progress" aria-hidden="true"></div>
<nav class="controls" aria-label="Presentation controls"><button id="prev" aria-label="Previous slide">←</button><span id="count" class="counter" role="status" aria-live="polite">01 / 10</span><button id="next" aria-label="Next slide">→</button><button id="overview" aria-pressed="false">Overview</button><button id="notes" aria-pressed="false">Notes</button><button id="fullscreen" class="optional">Fullscreen ↗</button><button id="print" class="optional">Print</button><a href="PATAPIM-DECK.pdf" download>PDF ↓</a><a class="optional" href="{app_url}" target="_blank" rel="noreferrer">Website ↗</a></nav>
<aside id="notes-panel" class="notes-panel" aria-label="Speaker notes" hidden><button id="close-notes" aria-label="Close notes">×</button><h2>SPEAKER NOTES</h2><p id="speaker-copy"></p><span id="speaker-time" class="timing"></span></aside><script id="notes-data" type="application/json">{notes_json}</script><script src="deck.js"></script></body></html>'''
(out / "index.html").write_text(page)
for name in ["deck.css", "feedback.css", "deck.js"]:
    shutil.copy2(root / "scripts/deck" / name, out / name)
md = [
    "# Patapim — Track 2 / Loaded / Developer feedback",
    "",
    "10 slides in English, 16:9, with the existing black / white / #1eff66 ghost art direction. Four-minute script: 3 slides on the product, Loaded and KPI evidence; 7 on developer feedback and the contribution.",
    "",
    f"Presentation: {deck_url}/deck/index.html",
    f"PDF: {deck_url}/deck/PATAPIM-DECK.pdf (also docs/PATAPIM-DECK.pdf).",
    "",
    f"Source revision: `{revision}`. PR and ledger checks: `docs/deck/verification.json`, {review_date}.",
    "",
    "## Evidence and scope",
    "",
    "Read against README.md, DEVELOPER-REPORT.md, the friction log through F-022, the contribution report, current audit resolutions, Track 2 requirements, fund/default/lifecycle evidence, web/lib/config.ts, finance.ts, wallet-manager.ts, the signing panel and transaction relay. Historical reviews are used for requirement wording, not as the current implementation status.",
    "",
    "The redemption-plus-yield KPI is PARTIAL: the compressed lifecycle redeems capital with zero realised interest. Day-based funds show scheduled interest, not an already demonstrated redemption with yield. Wallet connection is integrated; the demo-key flow is proven on chain, Xaman is configured on the canonical Vercel deployment with Devnet payload acceptance documented; Otsu support was inspected in code. Neither is claimed as a completed wallet-signed ledger test here. The Explorer PR remains open, not merged. Financial comparisons are historical evidence, not live quotes.",
    "",
    "Full amendment sets differ even though the two lending amendments match. Beta.1 already fixes signing and closed-ended typing. Borrower eligibility and donation have existing upstream proposals; tfLoanCall is our proposal, not implemented. The corrected net NAV and cover payouts are recomputed from raw evidence during generation.",
    "",
    "## Regenerate and present",
    "",
    f"`python3 scripts/build-deck.py --app-url {app_url} --deck-url {deck_url}`",
    "",
    "`node scripts/export-deck.mjs` exports the PDF and screenshots. Requires `npm ci --prefix web` and Chromium (`cd web && npx playwright install chromium`), or set `CHROMIUM_PATH`.",
    "",
    "Arrow keys / Page Up / Page Down / Space navigate; Home / End jump; N opens notes with a short timed script and optional Q&A detail; O opens overview. Printing includes all ten slides without notes or controls. No transaction is triggered by the presentation or export.",
    "",
]
for i, s in enumerate(notes, 1):
    md += [
        f"## {i}. {s['title']} — {s['time']}",
        "",
        s["note"],
        "",
        "If asked: " + s["detail"],
        "",
        "Evidence: " + s["source"],
        "",
    ]
(root / "docs/PITCH-DECK.md").write_text("\n".join(md).rstrip() + "\n")
print(
    "Built 10 slides: 3 product/KPI + 7 feedback. Net NAV 0.60; final NAV 0.64 / 1.00 verified."
)
