# patapim, front end

An immersive ghost homepage, product story and live dashboard for a fixed-term securities lending
vault on XRPL. Next.js serves the product and ledger pages; a browser-only Three.js experience
powers the homepage. Ledger figures are read by the server at request time, without a wallet or
client-side XRPL library. The visual reference gallery is independent of ledger data.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Routes:

| route              | what it shows                                                                     |
| ------------------ | --------------------------------------------------------------------------------- |
| `/`                | the full ghost intro and interactive visual reference gallery                     |
| `/product`         | the product story, five steps of the trade and XRPL mapping                       |
| `/vault/<VaultID>` | the live dashboard for one vault, with `?holder=<address>` to add a position card |

A vault to point at is in `lib/config.ts` as `DEMO_VAULT`, and a fresh one is provisioned by
`node scripts/recall-spine.mjs` from the repository root.

## Who owns what

**Yours, restyle freely:**

- `app/globals.css`. Every colour, radius, shadow, font and spacing step in the app is a variable
  declared at the top of this file. Change the variables and the whole app follows. Change the
  class bodies underneath and nothing breaks either.
- any `*.module.css` you want to add.
- copy, spacing, layout inside the sections.

**Mine, tell me before changing:**

- `lib/ledger.ts`, the read path and the phase and status logic.
- `lib/config.ts`, the network. Never point this at the custom hackathon devnet: the two networks
  enforce different lending rules and the submission states which one we are on.
- the props and data shapes the pages read.

If you need different markup to make a design work, change it and tell me, I will rebase the data
around it. Do not fight the structure.

## The class vocabulary

Everything on both pages is built from these, all defined in `globals.css`:

| group     | classes                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------- |
| layout    | `page`, `nav`, `brand`, `nav-links`, `section`, `row`, `grid` with `grid-2`, `grid-3`, `grid-4`   |
| type      | `eyebrow`, `lede`, `muted`, `mono`, `hash`                                                        |
| surfaces  | `card`, `tile` with `label`, `value`, `sub`                                                       |
| pieces    | `btn`, `btn-primary`, `badge` with `badge-accent`, `badge-positive`, `badge-warn`, `badge-danger` |
| sequences | `steps`, `step`, `step-n` (auto numbered)                                                         |
| data      | `table`, `table-wrap`, `td.num` for figures, `details.provenance`                                 |

Figures use `font-variant-numeric: tabular-nums` so columns line up. Keep that if you replace the
type scale.

## Conventions

- Light and dark both work: the dark palette is a token override under `prefers-color-scheme`.
  If you add a colour, add it as a variable in both blocks, never inline.
- The page must hold at 400px wide. The grids already collapse.
- No emoji, no decorative icons.
- Copy is English, the audience is the jury.

## What the dashboard means

- **Price per share** is `(AssetsTotal - LossUnrealized) / OutstandingAmount`, computed client side
  because the ledger exposes no such field, and the shares live on a separate token issuance.
  Subtracting the unrealised loss matters: an impaired loan stays inside `AssetsTotal` and only
  appears in `LossUnrealized`, so the naive ratio overstates what a lender owns. The ledger itself
  withdraws against the same difference.
- **Phase** is derived from the two immutable dates on the vault, compared against the ledger close
  time, never the browser clock.
- **Refused in this phase** lists what the ledger will reject right now, with the real result code.
  That block is the demo: it changes on its own when the vault crosses a phase boundary.
- **Loan status** is `paid off`, `defaulted`, `impaired`, `overdue` or `current`. The first three
  match what the XRPL Explorer shows; `overdue` is ours, and it is the moment the lending agent is
  supposed to act.

## September design handoff

The visual direction adapts the dark green palette, large sans-serif type and DM Mono labels from
[`STOOOKEEE/frontend-ripple-`](https://github.com/STOOOKEEE/frontend-ripple-). The full frontend experience is now ported into `app/components/ghost/`, including the original
ghost sequence, particle transition, WebGL gallery, grid/list views, search, reference dialogs,
About screen, sound, pause, replay, reduced motion and failure fallback. All active assets are local
in `public/reference/`; DM Mono and its OFL licence are in `public/fonts/`. The abandoned fly
experiment and Vite runtime are not part of the active experience.

The product page at `/product` has a trade diagram, audience cards, the five-step lifecycle, historical default
evidence and the native object mapping. Historical figures are explicitly labelled; they are not
read from the demo vault. The dashboard adds a phase timeline, five overview tiles, phase rule
panels and a collapsible provenance panel. These are markup changes; props and data shapes are
unchanged. `lib/ledger.ts` and `lib/config.ts` are unchanged.

`app/components/live-refresh.tsx` refreshes the Server Component view every ten seconds while the
tab is visible, and on manual request. It waits for the current refresh before scheduling another.
The countdown is a ledger snapshot: it updates when the server reads the ledger, not once per
browser-clock second. It never changes phase optimistically. The error view offers the same retry
control. There are no client-side XRPL calls, wallet connections or transaction submissions.

The existing demo vault has completed its lifecycle and may show zero assets and no share price.
This is valid ledger data. For the presentation, the protocol operator provisions a fresh vault
using the existing scripts and supplies its `/vault/<VaultID>` URL. The design pass does not change
`DEMO_VAULT` or provision ledger objects.

### Pitch deck

- `/deck/index.html`: nine slides with keyboard navigation, speaker notes and print styles.
- `../docs/PATAPIM-DECK.pdf`: ready-to-submit 16:9 PDF.
- `../docs/PITCH-DECK.md`: four-minute speaker runbook and evidence caveats.
- `../scripts/build-deck.py`: editable slide source. Run `python3 scripts/build-deck.py` from the
  repository root to regenerate the HTML and runbook, then export a new PDF with Print / PDF.

The deck's live-vault link is copied from `DEMO_VAULT` when generated. If using another vault for
the pitch, open its URL directly or update that link in the slide source. Both complete arcs do not
fit live into four minutes; show one from verified hashes, as specified in `docs/PLAN.md`.

The slide on default uses **net** share price: 1.00 → 0.60 during impairment → 1.00 after covered
default. The raw evidence's old `pricePerShare` field uses the gross ratio and incorrectly remains
1.00 at impairment. The deck recomputes 0.60 from the recorded assets, unrealised loss and shares,
consistent with the existing dashboard and developer report. The evidence files remain unchanged.

### Visual review

Desktop and 400px captures, plus browser verification results, are in `../docs/design/`.
Run `npm run build` from `web/` for the production compilation and TypeScript check.
Use `npm run start` to review the production app. The ledger must be reachable for live dashboard
checks; landing and deck do not require a ledger request.

### Full ghost frontend integration

`/` runs the complete active frontend from `STOOOKEEE/frontend-ripple-`, branded for Patapim and
translated into English. Its 85 projects remain labelled as **Phantom visual references**, with
source attribution in the gallery and dialogs. They are not Patapim partners or protocol data.
Product, live-vault and deck links are available even while the intro loads. `/product` preserves
the full editorial landing, and `/vault/[id]` keeps its existing server-side ledger reads.

`ghost/entry.tsx` loads the browser-only React app without server rendering. Only that app loads
Three.js and GSAP. Shader strings replace the source Vite `?raw` imports without changing shader
behaviour. The original CSS is scoped under `.ghost-root`; the dashboard and product use
`components/site-shell.tsx`. Animation assets and source notes retain their original attribution
in `docs/reference/`. No image-generation or replacement ghost was used.

For browser verification, from `web/`:

```sh
npm ci
npx playwright install chromium
npm run build
npm test
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an existing Chromium. The integration tests cover
intro and replay, drag versus click, search/dialogs, mobile, reduced motion, failed WebGL assets,
direct access during loading, product/vault/deck navigation and the two ledger themes at 400px.
The test server uses port 3010; captures are written to `docs/design/ghost/`.
