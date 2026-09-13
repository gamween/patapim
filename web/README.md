# Patapim frontend

The landing keeps the original ghost intro and draggable live-data gallery. A single **Open app**
link opens the vault application. Floating controls, Replay, display toggles and the deck/pause
block have been removed. The app uses the same black/green typography with plain Vault, Loans
and Rules navigation, searchable metrics and live detail dialogs.

## Run

```sh
cd web
npm ci
npm run dev
```

For production: `npm run build && npm run start`. The app listens on port 3000 by default.

| Route | Behaviour |
| --- | --- |
| `/` | Ghost landing, live-data gallery preview and Open app link |
| `/vault/<VaultID>` | Vault application; opens directly without loading the ghost or WebGL |
| `?holder=<address>` | Include that holder's vault shares and position value |
| `/product` | Compatibility redirect to `/` |
| `/api/vault/<VaultID>` | Uncached server-side presentation of the existing ledger reader |

The vault/holder selector is available in the app header, including on mobile. The app is read-only:
it does not connect a wallet or submit transactions. The configured network remains the public
XRPL Devnet; it is never replaced by the custom hackathon network.

## Live data

`lib/ledger.ts` and `lib/config.ts` remain owned by the protocol developer and are unchanged by this
integration. `lib/vault-presentation.ts` calls the existing `readVault`, `readPosition`, `loanStatus`,
`vaultData` and `PHASE_RULES`, then serializes a presentation contract defined in `lib/vault-ui.ts`.
The API validates the vault ID and optional holder address before invoking that adapter.

The live grid covers assets, available liquidity, net share price, unrealised loss, utilisation,
phase/countdown, modelled term, loans and statuses, agent cover and rate, debt and ceiling, permitted
and refused transactions, optional holder position, and the underlying JSON-RPC requests.

All phase decisions and countdown values use the ledger close time. The browser fetches only the
local application API, every ten seconds after a completed read while visible; it does not access
XRPL directly or compute a phase from its wall clock. Manual refresh uses the same path. A failed
refresh retains the last successful snapshot with a visible stale-data label. An initial failure
shows an error and retry controls, with no invented balances. Unavailable values remain `—`.

The configured demo vault may already have completed its lifecycle and legitimately return zero
assets and no price per share. The protocol operator can provision a fresh vault with the existing
scripts and paste its ID into the selector. No provisioning is triggered by viewing the page.

## Frontend structure

- `app/components/ghost/ghost-app.tsx`: landing, Open app entry, vault navigation and live detail dialogs.
- `app/components/ghost/use-vault.ts`: polling, retry, visibility handling and stale snapshots.
- `app/components/ghost/animation/Experience.ts`: original ghost and warped-grid renderer.
- `app/components/ghost/animation/ledger-texture.ts`: real ledger text and utilisation rendered to
  canvas textures. Updates replace only changed tile textures, without replaying the intro.
- `app/components/ghost/ghost.css`: the original black/green style, scoped to this frontend.
- `app/globals.css`: local font, base colours and tabular-number defaults.

The project dataset and image/video atlases have been removed. The ghost's original frames, model,
particle texture and sounds remain local in `public/reference/`, with provenance in
`docs/reference/`. Only the ghost animation is retained from the visual reference assets.
If WebGL or an intro asset fails, the landing headline and Open app link remain usable.
The vault application does not depend on the animation or WebGL.

## Verify

```sh
npx playwright install chromium
npm run build
npm test
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select an installed Chromium. Tests use a production
server on port 3010 and cover real ledger data, ghost intro, landing-to-app navigation, search, loan and
rule views, automatic refresh, open-dialog updates, outage/retry, WebGL fallback, mobile and
vault/holder selection. Phase changes and outages are explicit test-only response fixtures;
production has no mock data. Captures are in `docs/design/live/`.

## Deck

The jury deck is `docs/PATAPIM-DECK.pdf`, ten 16:9 slides.
