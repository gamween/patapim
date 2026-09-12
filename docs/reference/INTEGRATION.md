# Ghost frontend with live Patapim data

The UI from `STOOOKEEE/frontend-ripple-` (source commit `3bc1753`) is the application, not an entry
page linking to another dashboard. Its original ghost sequence, particles, warped grid, list,
search, dialogs, glass dock, About, optional sound, pause and replay are retained.

The grid's project-image atlases and 85-item reference dataset have been removed. Each grid tile
is now a canvas texture containing actual ledger data from the local API. Changed tiles update
without restarting the animation. Clicking a tile opens its current details, including phase
boundaries, the loan book, rejection codes and raw read provenance. Vault, Loans, Rules and About
are views inside the same React application. `/vault/<id>` uses this same interface.

`web/lib/vault-presentation.ts` adapts the existing protocol reader into a serializable presentation
contract. `web/lib/ledger.ts` and `web/lib/config.ts` remain unchanged relative to main. The browser
only polls `/api/vault/<id>`; it never sends XRPL RPCs directly. Phase/countdown and loan status
come from the protocol reader, using ledger close time. Failed refreshes are labelled stale and
retain the last successful values. Initial failures produce no fake balances.

The ghost assets keep their original attribution. `PHANTOM.md` and `FRONTEND-SOURCE.md` preserve
the source study's provenance; descriptions of the old project gallery in those files refer to
the source study, not the current Patapim app. Runtime assets now include only the original ghost
frames, model, particle image, logo and sounds.

Validation and current captures are documented in `web/README.md` and `docs/design/live/`.
