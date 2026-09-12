# Ghost frontend integration

Source: `STOOOKEEE/frontend-ripple-` at commit `3bc1753`.

The complete active ghost experience is integrated into the Next.js homepage. Source mapping:

| Frontend source | Patapim destination |
| --- | --- |
| `src/App.tsx` | `web/app/components/ghost/ghost-app.tsx` |
| `src/style.css` | `web/app/components/ghost/ghost.css`, scoped under `.ghost-root` |
| `src/animation/Experience.ts` | `web/app/components/ghost/animation/Experience.ts` |
| `src/animation/*.{glsl,vert,frag}` | `web/app/components/ghost/animation/shaders.ts`, identical shader strings |
| `src/projects.json` | `web/app/components/ghost/projects.json`, all 85 references |
| `public/reference/` | `web/public/reference/`, complete active asset set |
| `public/fonts/` | `web/public/fonts/`, local DM Mono and OFL licence |
| `tests/experience.spec.ts` | `web/tests/ghost.spec.ts`, translated and extended for Patapim navigation |

The integration keeps the loader, 25-frame ghost sequence, particle transition, warped draggable
WebGL gallery, atlas video, list/search, dialogs, About, optional sound, replay, pause, reduced-motion
handling, mobile variants and asset-failure fallback. The interface is English and branded Patapim.
The gallery explicitly identifies Phantom's projects as visual references, not Patapim partners.
Original asset provenance is preserved in `PHANTOM.md` and `FRONTEND-SOURCE.md` in this folder.

Product, live-vault and deck links are available during loading and after reveal. The original
product landing now lives at `/product`; the ledger dashboard remains `/vault/[id]`. Their shared
navigation is in `web/app/components/site-shell.tsx`. No XRPL reader, network or phase logic is
changed by this integration. The latest upstream default-status correction and demo vault are
included through the merge from main.

Validation: production build and TypeScript pass. Eight browser scenarios passed, including desktop
intro/replay, click vs drag, search/dialogs/About, mobile at 400px, reduced motion, asset failure,
product/vault/deck navigation, direct navigation during loading, and product/ledger light and dark
layouts. `docs/design/ghost/` contains captures from the integrated Next.js app. The live server was
also checked through its Tailscale address, reaching the `ready` animation phase.
