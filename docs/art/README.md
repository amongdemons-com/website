# Artwork integration

Branch: `art/approved-demons-and-world`. Based on the approved demon progression v9.

## Status

**63 of 66 approved demon masters imported.** IDs **25, 26 and 27** (Vi'Zel common, uncommon and rare) are pending the user's manually corrected source files. Their PNG, portrait WebP and map WebP assets are preserved from the starting branch. Do not replace them with the older concept copies, which still contain the unwanted eye highlights. This branch is an artwork review branch, not a completed release or deployment.

Seven environments have been regenerated, and the eighth home/social background combines the new home scene with the unchanged original brand logo. Crowley, the Whispering Well and Anomaly have also been regenerated. Anomaly has actual transparent alpha; Crowley and the Well are illustrated square event portraits. Map event markers and Echo art were not in this replacement scope.

## Direction and provenance

- [Art direction and recovery instructions](ART-DIRECTION.md)
- [Per-species progression](species-directions.json)
- [66 demon records and exact original prompts](demon-provenance.json)
- [Deterministic extraction measurements](demon-extraction-report.json)
- [World generation prompts and review history](world-generation-prompts.json)
- [Asset verification](asset-verification.json)

The demon drawings were not regenerated. Gray-teal presentation backgrounds and neutral contact shadows were removed by the extraction script. Character interiors retain the source RGB; the antialiased silhouette edge is unmatted. Actual body material, especially the purple Ma'Zga puddles, stays intact. Original concept collections remain unchanged outside the repo; the previous website assets remain in Git history.

World artwork was made with **built-in imagegen**. The selected Anomaly was generated against a gray matte and then extracted with the same deterministic process after the tool returned painted checkerboards in earlier attempts. Earlier attempts are recorded, not used as production assets.

## Asset locations

| Asset | Master | Website variants |
| --- | --- | --- |
| Demons | `public/app/images/demons/{id}.png` | `portrait/{id}.webp` at 512px; `map/{id}.webp` at 256px; `map-atlas.webp` with 128px frames |
| Environments | `public/app/images/assets/background/*.png` | matching WebP and AVIF, same dimensions |
| Crowley | `public/app/images/assets/world/crowley.png` | `crowley.webp` at 512px |
| Whispering Well | `public/app/images/assets/world/soul-font.png` | `soul-font.webp` at 768px |
| Anomaly | `public/app/images/demons/anomaly.png` | `anomaly.webp` at 1024px, alpha preserved |

## Rebuild and verify

```sh
npm run build
npm test
npm run assets:verify
```

The strict asset check exits nonzero while manual source IDs remain pending. To inspect the completed portion without hiding that status:

```sh
npm run assets:verify -- --allow-pending
```

The build refreshes the portrait/map variants, world portraits, logo composite, background formats, atlas, content stamps and browser bundles. Pending demon variants are deliberately skipped. Image files are replaced atomically so Windows thumbnail readers do not prevent overwriting an open asset.

For the remaining three files: obtain the user's actual corrected PNGs, inspect them, extract only their backgrounds, import them under the matching numeric IDs and update their provenance/status. Then rebuild and run the strict check. Do not redraw the eyes or regenerate the accepted demons.

## Verification completed

- All 63 imported cutouts reviewed on checkerboard; full extremities, poison puddles and interior gaps preserved.
- All 229 production image files decoded; expected sizes and required alpha checked for the completed assets. Three pending IDs are explicitly reported.
- `npm run build` succeeds. All 262 tests pass, including versioned demon URL round-tripping.
- The local website's Ma'Zga mythic page was checked in the in-app browser with the transparent sprite against the regenerated home scene, without horizontal overflow.
- No database migration, gameplay change, main-branch merge or deployment performed.

Image URLs now carry content stamps, including the rebuilt map atlas, so existing immutable browser caches request the changed art. After merging, deployment should use the normal build and publish process.
