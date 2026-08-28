# Artwork integration

Branch: `art/approved-demons-and-world`. Based on the approved demon progression v9.

## Status

**All 66 approved demon masters imported.** For IDs **25, 26 and 27** (Vi'Zel common, uncommon and rare), the user authorized using our saved versions and pixel editing after discovering their own edits were in the wrong place. Their small white eye highlights were removed without regeneration. This is an artwork review branch; it has not been merged or deployed.

Seven environments have been regenerated, and the eighth home/social background combines the new home scene with the unchanged original brand logo. Crowley, the Whispering Well and Anomaly have also been regenerated. Anomaly has actual transparent alpha; Crowley and the Well are illustrated square event portraits. Map event markers and Echo art were not in this replacement scope.

The collection's ten bottles now contain recognizable two-eyed souls matching the game icon. Tor Tza common's pupil connects to the top eyelid through a localized pixel repair. The shared demon-card backdrop now uses bright jade stone and restrained moss/lichen texture. All display sprites center their complete visible silhouette on both axes, including the small early evolutions and low poison puddles. This replaces the previous bottom alignment and overly muted backdrop.

## Direction and provenance

- [Art direction and recovery instructions](ART-DIRECTION.md)
- [Per-species progression](species-directions.json)
- [66 demon records and exact original prompts](demon-provenance.json)
- [Deterministic extraction measurements](demon-extraction-report.json)
- [Vi'Zel pixel repairs and exact patch bounds](vizel-eye-repairs.json)
- [Tor Tza common pixel repair](tor-tza-eye-repair.json)
- [Visible-silhouette centering measurements](demon-placement.json)
- [Card backdrop research and selection](CARD-BACKDROP-RESEARCH.md)
- [Exact jade and amber texture prompts](card-backdrop-texture-prompts.json)
- [Earlier minimal backdrop prompt (superseded)](minimal-card-backdrop-prompt.txt)
- [World generation prompts and review history](world-generation-prompts.json)
- [Asset verification](asset-verification.json)
- [Browser card layout checks](card-verification.json)

The demon drawings were not regenerated. Gray-teal presentation backgrounds and neutral contact shadows were removed by the extraction script. Character interiors retain the source RGB except for the authorized Vi'Zel and Tor Tza eye patches; the antialiased silhouette edge is unmatted. Actual body material, especially the purple Ma'Zga puddles, stays intact. Original concept collections remain unchanged outside the repo; the previous website assets remain in Git history.

World artwork was made with **built-in imagegen**. The selected Anomaly was generated against a gray matte and then extracted with the same deterministic process after the tool returned painted checkerboards in earlier attempts. Earlier attempts are recorded, not used as production assets.

## Asset locations

| Asset | Master | Website variants |
| --- | --- | --- |
| Demons | `public/app/images/demons/{id}.png` | `portrait/{id}.webp` at 512px; `map/{id}.webp` at 256px; `map-atlas.webp` with 128px frames |
| Environments | `public/app/images/assets/background/*.png` | matching WebP and AVIF, same dimensions |
| Shared card backdrop | `public/app/images/assets/background/demon-card.png` | matching 1254px WebP and AVIF |
| Backdrop studies | `docs/art/backdrop-studies/jade-stone.png` and `amber-limestone.png` | Jade selected; amber retained for comparison, not loaded by the website |
| Crowley | `public/app/images/assets/world/crowley.png` | `crowley.webp` at 512px |
| Whispering Well | `public/app/images/assets/world/soul-font.png` | `soul-font.webp` at 768px |
| Anomaly | `public/app/images/demons/anomaly.png` | `anomaly.webp` at 1024px, alpha preserved |

## Rebuild and verify

```sh
npm run build
npm test
npm run assets:verify
```

The strict asset check validates all 66 masters, including SHA-256 matches against the approved extraction/repair records. No sources remain pending. The build refreshes portrait/map variants, world portraits, the logo composite, background formats, atlas, content stamps and browser bundles. Image files are replaced atomically so Windows thumbnail readers do not prevent overwriting an open asset.

The one-time Vi'Zel repair script accepts the original extracted cutout directory and an output directory. It checks the three input hashes before editing and records the patch coordinates and output hashes. Do not run it on already repaired masters or other drawings. The repaired production PNGs are the normal build inputs.

## Card fitting

Shared demon cards use a contained, unscaled image across the full card height, with compact stats overlaid at the bottom. The temporary separate stats row was removed following user feedback because it shortened the artwork. The old 30% desktop and 48% portrait-phone zooms remain removed. Collection cards fill their grid cells. Detail, reward/cashout, public guide, summon and boss portraits also contain the full artwork; the Anomaly event portrait no longer oversizes its frame.

The shared backdrop uses brighter jade stone and pale green lichen with broad, quiet material shapes. Its edges have lower local contrast than the demons' black contours. There is no scenery horizon or implied ground to conflict with centered puddles. Portrait/map WebPs center the actual visible silhouette on both axes, preserving the original drawing scale. Detached hands/flames remain included. The PNG masters are not rewritten; public guide artwork and in-game detail/cashout portraits use the centered WebP variant. Original PNG URLs and public image metadata remain available.

## Verification completed

- All 66 imported cutouts reviewed; full extremities, poison puddles and interior gaps preserved.
- Vi'Zel edits change 205, 132 and 156 pixels respectively. A full pixel comparison confirms zero alpha changes and zero RGB changes outside the three patch rectangles.
- Tor Tza common's repair changes 473 pixels, with zero alpha changes and no changes outside the recorded patch.
- All 232 production image files decoded; expected sizes, required alpha, centered visible bounds and approved master hashes checked. The strict check passes with no pending IDs.
- `npm run build` succeeds and all 267 tests pass, including full-height cards, detached-feature bounds, preserved RGBA/proportions, centered silhouettes and clipping guards.
- In-app browser fixtures use the production CSS and shared card renderer with local sample data. The full-height image checks and viewport sizes are recorded in `card-verification.json`. These checks do not perform authenticated gameplay or database actions.
- The local website's Ma'Zga mythic and repaired Vi'Zel rare pages were checked in the in-app browser with transparent sprites against the regenerated home scene, without horizontal overflow.
- No database migration, gameplay change, main-branch merge or deployment performed.

Image URLs now carry content stamps, including the rebuilt map atlas, so existing immutable browser caches request the changed art. After merging, deployment should use the normal build and publish process.
