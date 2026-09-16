# Front-end provenance

The landing page's ghost intro, particles and warped grid come from `STOOOKEEE/frontend-ripple-`
(source commit `3bc1753`), a study Armand Séchon built during the event. That study reproduces the
introduction of [phantom.land](https://www.phantom.land/), the public site of the Phantom studio,
as observed on 12 September 2026: its HTML, public bundles and network requests were read, nothing
authenticated, no tracking script or integration key.

## What patapim keeps

| Asset | Origin | In this repository |
|---|---|---|
| Ghost frames, desktop | 55 series of 25 WebP on the source site | 25 frames of one observed visit, `web/public/reference/frames/set*/` |
| Ghost frames, mobile | 3 series of 25 WebP | all 75, one series picked at random per frame, `frames/mobile/` |
| 3D model | `/assets/models/dude.glb`, 166,932 bytes | yes, turned into a point cloud |
| Particle texture | `/assets/images/particle.jpg` | yes |
| Ghost logo | Phantom's public SVG | `web/public/reference/site/ghost.svg`, as a marker of the reference |
| Shaders | Phantom's public intro shader | the noise, sequence and particle shaders in `web/app/components/ghost/animation/shaders.ts`, adapted |
| Timings | Phantom's public page bundle | the intro timeline in `Experience.ts`: depixelisation over 800 ms, 25 frames in 1.8 s, particles, a 240° turn and the camera crossing |
| Typography | Helvetica Now on the source site | not used: DM Mono, bundled with its OFL licence in `web/public/fonts/` |

Not kept: the project gallery and its 85 entries, the image and video atlases, the sounds, the
about panel, the replay and sound controls, the list view. The grid tiles show live ledger data
rendered to canvas textures (`ledger-texture.ts`) instead of project imagery.

The renderer, the grid, the resource lifecycle and the interface are a new implementation; the
intro is the same visual material with the same parameters, without a guarantee of pixel equality
across GPUs and browsers.

## Rights

Phantom's assets and shader excerpts keep their provenance. Their public availability does not
establish a licence to redistribute them, and this repository claims no ownership of Phantom's work.
The reference is a visual quotation for a hackathon prototype; anything built on patapim beyond
that should replace it.

## How it is wired

`web/lib/vault-presentation.ts` adapts the ledger reader in `web/lib/ledger.ts` into the
serialisable contract of `web/lib/vault-ui.ts`, served by `/api/vault/<id>`. The browser only polls
that route; it never sends an XRPL request itself. Phase, countdown and loan status come from the
ledger close time. A failed refresh keeps the last snapshot, labelled stale; a first failure shows
an error and a retry, never an invented balance. The vault app opens without WebGL; if the ghost
assets fail, the landing headline and the Open app link remain usable. Details in `web/README.md`.
