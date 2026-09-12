# Ghost frontend with live Patapim data

The UI from `STOOOKEEE/frontend-ripple-` (source commit `3bc1753`) provides the landing's original
ghost sequence, particles and warped draggable grid. The grid previews real ledger data. The
landing has a short product explanation and a single Open app link to `/vault/<id>`.

The project-image atlases and 85-item reference dataset have been removed. Grid tiles contain
actual data from the local API, updated without restarting the intro. Clicking a tile also enters
the app. The glass dock, Replay, grid/list switch and deck/pause block have been removed.

The vault app opens directly without loading WebGL. It retains the original black/green style,
list, search and dialogs, with plain Vault, Loans and Rules navigation. It includes phase
boundaries, loan statuses, rejection codes, holder position and raw read provenance.

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
