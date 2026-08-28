# Artwork integration

Branch: `art/approved-demons-and-world`. Based on the approved demon progression v9.

## Status

**All 66 approved demon masters imported.** The latest approved swirl palettes and six yellow Vi'Zel edits are integrated on this branch. Sixty other demon masters are unchanged. This branch has not been merged or deployed.

Seven environments have been regenerated, and the eighth home/social background combines the new home scene with the unchanged original brand logo. Crowley, the Whispering Well and Anomaly have also been regenerated. Anomaly has actual transparent alpha; Crowley and the Well are illustrated square event portraits. Map event markers and Echo art were not in this replacement scope.

The collection's ten bottles contain recognizable two-eyed souls matching the game icon. Tor Tza common's pupil connects to its upper eyelid. Cards now use eleven distinct type-specific swirl backgrounds, replacing jade stone. All display sprites remain centered on both axes, including small early evolutions and low poison puddles. Boss guide crests and formation cards now share the six rarity shapes, with dark outlines on all card rarity badges. Goh Loomb and Baobaw swap attack/number palettes only: amber for Goh Loomb, violet for Baobaw; existing attack motions and timings remain intact.

## Direction and provenance

- [Art direction and recovery instructions](ART-DIRECTION.md)
- [Approved swirl assignments and asset hashes](card-backdrops.json)
- [Swirl generation prompts and source history](card-backdrop-generation-prompts.json)
- [Yellow Vi'Zel edits, exact prompts and cleanup](vizel-yellow-revision.json)
- [Integration source checks](swirl-integration-checks.json)
- [Swirl integration browser checks](swirl-browser-verification.json)
- [Card layout and world circle browser checks](card-map-verification.json)
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

Sixty demon drawings retain their earlier extraction. Vi'Zel's six approved palette revisions were edited with built-in imagegen, then received authorized pixel cleanup because the generator painted a checkerboard instead of alpha. The extraction preserves colored interiors; two Legendary catchlights were repaired in small recorded rectangles (98 pixels). These generative edits preserve the approved anatomy but are not pixel-identical recolors. All previous drawings remain in Git history and the original preview collections are unchanged.

World artwork was made with **built-in imagegen**. The selected Anomaly was generated against a gray matte and then extracted with the same deterministic process after the tool returned painted checkerboards in earlier attempts. Earlier attempts are recorded, not used as production assets.

## Asset locations

| Asset | Master | Website variants |
| --- | --- | --- |
| Demons | `public/app/images/demons/{id}.png` | `portrait/{id}.webp` at 512px; `map/{id}.webp` at 256px; `map-atlas.webp` with 128px frames |
| Environments | `public/app/images/assets/background/*.png` | matching WebP and AVIF, same dimensions |
| Type card backdrops | `public/app/images/assets/background/demon-card-type-{1..11}.png` | matching 1254px WebP and AVIF; exact approved copies |
| Historical backdrops | `demon-card.*` and `docs/art/backdrop-studies/` | Retained for reference; not selected by the website |
| Crowley | `public/app/images/assets/world/crowley.png` | `crowley.webp` at 512px |
| Whispering Well | `public/app/images/assets/world/soul-font.png` | `soul-font.webp` at 768px |
| Anomaly | `public/app/images/demons/anomaly.png` | `anomaly.webp` at 1024px, alpha preserved |

## Rebuild and verify

```sh
npm run build
npm test
npm run assets:verify
```

The strict asset check validates all 66 masters and all eleven background sets against their approved hashes. No sources remain pending. The build refreshes centered portrait/map variants, world portraits, background formats, generated backdrop CSS, atlas, content stamps and browser bundles. Approved background variants are preserved by content hash, independent of Git checkout timestamps. Image files are replaced atomically so Windows thumbnail readers do not prevent overwriting an open asset.

The one-time Vi'Zel repair script accepts the original extracted cutout directory and an output directory. It checks the three input hashes before editing and records the patch coordinates and output hashes. Do not run it on already repaired masters or other drawings. The repaired production PNGs are the normal build inputs.

## Card fitting

Shared demon cards use a contained, unscaled image across the full card height, with compact stats overlaid at the bottom. The temporary separate stats row was removed following user feedback because it shortened the artwork. The old 30% desktop and 48% portrait-phone zooms remain removed. Collection cards fill their grid cells. Detail, reward/cashout, public guide, summon and boss portraits also contain the full artwork; the Anomaly event portrait no longer oversizes its frame.

The swirl backdrops retain broad, quiet colored shapes and restrained texture. They have no implied floor to conflict with centered puddles. Generated CSS selects the palette from the actual sprite's numeric source ID, including versioned PNG, portrait/map WebP and legacy thumbnail paths. Parent art frames and image-based portraits are covered, so dynamic avatar changes and server-rendered guides stay synchronized without a JavaScript timing dependency. Portrait/map WebPs keep centered visible bounds; detached hands/flames remain included. Public boss formations also use centered portrait WebPs.

## Current card and map presentation verification

- Card frames now use opaque rarity colors with a restrained colored glow; the emblems retain their dark outlines. Image corner radius is zero and body top padding is `1em` on desktop and phones.
- Attack and speed sit on the left below the HP bar, with HP value/icon on the right. The overlay still occupies the full-height art area. Overflow shields, role-specific icons and the compact phone-hand separator remain supported.
- World encounter spots and boss circles share the approved type backdrops. The 300.9 KB atlas holds 66 portraits plus 11 background tiles, about 14 KB more than the previous portrait-only atlas and no extra normal image request. Individual approved WebPs are the fallback if the atlas fails.
- `npm run build`, all 277 tests and the 265-image asset check pass. The checker also inspects every atlas background tile for opacity, source palette agreement and correct demon-type mapping.
- In-app browser previews at 1280×720 and 390×844 use the production card CSS/renderer and actual World marker functions with static local data. All six rarity colors, normal/compact cards and eleven pairs of encounter/boss circles were visually inspected. Stats remain below HP, aligned left/right without overlap; artwork remains full height. No account creation, database writes or authenticated gameplay were performed.
- Current content stamp: `art-59b6cb9757bc`. No merge, push or deployment performed.

## Initial swirl and yellow Vi'Zel verification (before card/map presentation changes)

- `npm run build` succeeds; all 273 tests pass. Combat tests exercise actual attack and floating-number rendering, preserving each attack's geometry and timing while swapping its palette.
- The strict asset check decodes 265 image files, validates all 66 approved masters and verifies the exact approved hashes of all 33 backdrop files. The other 60 demon masters are unchanged.
- Browser checks cover `/bosses` and `/bosses/warden` at 1280×720 and 390×844, plus all 66 `/demons` catalog portraits at desktop size. Palettes match the sprite IDs; boss emblems use the correct rarity shapes and dark borders. Warden's formation art fills the card's inner height and uses contained, centered WebPs. No horizontal overflow was found.
- Desktop and phone screenshots were visually inspected. These checks used public website pages without authenticated gameplay, database migrations or account changes. Combat behavior was verified with tests, not a live battle replay.
- Content stamp: `art-c510cd391357`. No merge, push or deployment was performed for this revision.

## Original integration verification (before the swirl/yellow revision)

- All 66 imported cutouts reviewed; full extremities, poison puddles and interior gaps preserved.
- Vi'Zel edits change 205, 132 and 156 pixels respectively. A full pixel comparison confirms zero alpha changes and zero RGB changes outside the three patch rectangles.
- Tor Tza common's repair changes 473 pixels, with zero alpha changes and no changes outside the recorded patch.
- All 232 production image files decoded; expected sizes, required alpha, centered visible bounds and approved master hashes checked. The strict check passes with no pending IDs.
- `npm run build` succeeds and all 267 tests pass, including full-height cards, detached-feature bounds, preserved RGBA/proportions, centered silhouettes and clipping guards.
- In-app browser fixtures use the production CSS and shared card renderer with local sample data. The full-height image checks and viewport sizes are recorded in `card-verification.json`. These checks do not perform authenticated gameplay or database actions.
- The local website's Ma'Zga mythic and repaired Vi'Zel rare pages were checked in the in-app browser with transparent sprites against the regenerated home scene, without horizontal overflow.
- No database migration, gameplay change, main-branch merge or deployment performed.

Image URLs now carry content stamps, including the rebuilt map atlas, so existing immutable browser caches request the changed art. After merging, deployment should use the normal build and publish process.
