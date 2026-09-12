# patapim, front end

A dashboard for a fixed-term securities lending vault on XRPL. Next.js, server rendered, no wallet
and no client-side XRPL library: every figure on the page is read from the ledger by the server at
request time.

## Run it

```bash
cd web
npm install
npm run dev          # http://localhost:3000
```

Two routes:

| route | what it shows |
|---|---|
| `/` | the landing: the problem, the five steps of the trade, the mapping to XRPL objects |
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

| group | classes |
|---|---|
| layout | `page`, `nav`, `brand`, `nav-links`, `section`, `row`, `grid` with `grid-2`, `grid-3`, `grid-4` |
| type | `eyebrow`, `lede`, `muted`, `mono`, `hash` |
| surfaces | `card`, `tile` with `label`, `value`, `sub` |
| pieces | `btn`, `btn-primary`, `badge` with `badge-accent`, `badge-positive`, `badge-warn`, `badge-danger` |
| sequences | `steps`, `step`, `step-n` (auto numbered) |
| data | `table`, `table-wrap`, `td.num` for figures, `details.provenance` |

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
