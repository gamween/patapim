# Patapim web app

The lender's view of a securities-lending fund on the XRP Ledger. It reads a closed-ended vault
(XLS-65), its loan broker and loans (XLS-66), the collateral escrows and the reference price straight
from the validated ledger on XRPL Devnet, presents them as fund metrics, a loan book and the phase
rules the ledger enforces, and lets a holder sign a `VaultDeposit` or `VaultWithdraw` against the fund
with a wallet or a Devnet demo key. Nothing is invented: every figure is a ledger field or a formula
in `lib/finance.ts` over ledger fields, and the transactions are the ledger's own answer.

## Run

```sh
cd web
npm ci
npm run dev
```

For production: `npm run build && npm run start`. The app listens on port 3000 by default. On Vercel
the project's root directory is `web/`.

## Routes

| Route | What it does |
| --- | --- |
| `/` | Landing: the ghost intro, a draggable grid of live vault tiles, and the Open app link. Falls back to the headline and the link when WebGL or an intro asset fails. |
| `/vault/[id]` | The app for one vault: Vault, Loans, Rules and Sign tabs, a vault and holder selector. Loads no WebGL. `?holder=<address>` adds that holder's shares and position value. |
| `/api/vault/[id]` | The vault snapshot the pages render, read server-side from the validated ledger. Validates the vault id and the optional `holder` address, returns 400 otherwise, 502 when the ledger cannot be read. Never cached. |
| `/api/account/[address]` | What a browser needs to sign itself: the account's next sequence, a last ledger sequence, the current fee, and what it holds in the fund's asset and shares (`?asset=`, `?shares=` MPT issuance ids). 404 for an account that does not exist. |
| `/api/submit` | Relays a signed transaction blob to XRPL Devnet with `submit` and returns the preliminary result and the hash. It refuses anything that is not hex, that does not decode, that is not a `VaultDeposit` or `VaultWithdraw`, that carries no signature, or that is signed for another network. It receives no key and cannot sign. |
| `/api/tx/[hash]` | The validated outcome of a transaction: 200 with type, account, result and ledger once it is in a validated ledger, 202 while it is not. |

## Environment

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_XAMAN_API_KEY` | Offers Xaman in the wallet modal. Without it Xaman is not listed. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Offers WalletConnect in the wallet modal. Without it WalletConnect is not listed. |
| `DEMO_INELIGIBLE_SEED`, `DEMO_OFFERING_VAULT` | Test only: the seed of the demo investor without a credential and the vault open for subscription. The signing test runs only when both are set. |

Both public keys are read at build time. The network is fixed in `lib/config.ts`: the public XRPL
Devnet, never the custom hackathon network.

## Live data

All phase decisions and countdown values use the ledger close time, not the visitor's wall clock.
The browser fetches only the local application API, every ten seconds after a completed read while
the tab is visible; it does not access XRPL directly or compute a phase itself. Manual refresh uses
the same path. A failed refresh retains the last successful snapshot with a visible stale-data label.
An initial failure shows an error and retry controls, with no invented balances. Unavailable values
remain `—`.

The two funds listed in the vault selector were provisioned by `node scripts/standing.mjs` for the
event. A closed-ended vault's dates are immutable, so each has moved on through its phases since; the
app shows whatever phase the ledger is in. Any other vault id can be typed into the selector.

## Wallets and signing

Wallet connection goes through XRPL Commons' `xrpl-connect` and its `<xrpl-wallet-connector>`,
themed in `ghost.css`. Xaman signs vault transactions with MPT amounts on XRPL Devnet and was tested
live with this app; `lib/wallet-manager.ts` wraps its adapter with `fixXamanSingleSign`, because
`xrpl-connect` 1.0.0-rc.2 refuses every single-signature payload Xaman returns. Otsu's signing library
knows these transactions but was not tested live. Crossmark and GemWallet cannot encode them, and the
Sign tab says so when they are connected.

With no such wallet, a Devnet demo key signs in the browser with `xrpl.js@5.2.0-beta.0`: the key
lives in a ref for the life of the tab and is never sent anywhere. Either way only the signed
transaction reaches the server, which relays it and reads the validated result. The Sign tab explains
each result code in the words of the rule that fired.

## Structure

- `app/layout.tsx`: root layout and metadata.
- `app/page.tsx`: the landing route.
- `app/vault/[id]/page.tsx`: the vault route.
- `app/globals.css`: local font, base colours and tabular-number defaults.
- `app/icon.svg`: the favicon.
- `app/api/vault/[id]/route.ts`: the vault snapshot API.
- `app/api/account/[address]/route.ts`: the signing-account API.
- `app/api/submit/route.ts`: the transaction relay.
- `app/api/tx/[hash]/route.ts`: the validated-result API.
- `app/components/ghost/entry.tsx`: client-only entry that loads the app without server rendering.
- `app/components/ghost/ghost-app.tsx`: landing, Open app, vault navigation, loan book, rules, detail dialogs and the vault selector.
- `app/components/ghost/sign-panel.tsx`: the Sign tab: wallet or demo key, deposit or withdraw, result and explanation.
- `app/components/ghost/wallet.tsx`: the wallet context over `xrpl-connect`, the header button and the connected holder.
- `app/components/ghost/use-vault.ts`: polling, retry, visibility handling and stale snapshots.
- `app/components/ghost/ghost.css`: the black and green style, scoped to `.ghost-root`, and the wallet modal palette.
- `app/components/ghost/animation/Experience.ts`: the ghost intro and the warped grid of ledger tiles, in three.js.
- `app/components/ghost/animation/ledger-texture.ts`: ledger cards rendered to canvas textures; updates replace only changed tiles.
- `app/components/ghost/animation/shaders.ts`: the intro's shader sources.
- `lib/config.ts`: network, the demo funds and the signing library name.
- `lib/ledger.ts`: JSON-RPC reads of the vault, shares, broker, loans, collateral, oracle, positions and transactions; phase and loan status.
- `lib/finance.ts`: the lending metrics, each defined the way its market defines it, as pure functions over ledger fields.
- `lib/vault-presentation.ts`: turns a ledger read into the cards, rows and signing fields the app renders.
- `lib/vault-ui.ts`: the serialisable snapshot contract between the API and the pages.
- `lib/wallet-manager.ts`: the `xrpl-connect` WalletManager, the wallets' signing capabilities and the Xaman fix.

The ghost's frames, model, particle texture and logo are in `public/reference/`, with their
provenance in `docs/reference/`.

## Verify

```sh
npx tsc --noEmit
npm run build
npm test
```

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an installed Chromium, for example
`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`. The suite starts a production
server on port 3010 and reads the live Devnet vault named in `lib/config.ts`, so it needs the
network. Its 13 tests cover the ghost intro and landing-to-app navigation, the loan book, rules and
detail dialogs, search, automatic refresh updating an open dialog, outage and retry with the stale
label, the WebGL fallback, the 400px viewport, vault and holder selection, result-code casing, the
wallet modal palette at every width, the demo-key signing path against the ledger (skipped unless
`DEMO_INELIGIBLE_SEED` and `DEMO_OFFERING_VAULT` are set), and the Xaman single-signature fix in
isolation. Phase changes and outages are explicit test-only response fixtures; production has no
mock data. Screenshots land in `test-results/captures/`, which is not tracked.

## See also

The jury deck is `docs/PATAPIM-DECK.pdf` at the repository root; the ledger scripts and the
evidence of every transaction are described in the root `README.md`.
