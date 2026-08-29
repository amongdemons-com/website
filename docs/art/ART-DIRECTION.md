# Among Demons art direction

Demon direction approved 2026-08-27. This is the production direction for the website artwork branch. Type-specific swirl backgrounds and yellow Vi'Zel revisions approved for website integration on 2026-08-28.
The accepted roster culminates in progression v9. Earlier concepts and anatomy experiments are historical, not instructions to roll back approved designs.

## Rendering

Inspired by the expressive cartoon readability of *How Many Dudes?*, interpreted for our own characters.
Use confident near-black organic contours, sparse interior lines, broad matte color blocks and at most one simple hard shadow per material. Enlarge faces and signature features. Keep silhouettes readable at 128px. Reduce fur, feathers, bark, slime, stone and armor to a few broad shapes.

No photographic rendering, glossy 3D, fine surface texture, realistic muscles, cinematic bloom, particle clouds or white eye catchlights. Magic is a small number of clear outlined color shapes. Preserve species palettes; do not make every subject a blue horned imp.

## Approved demons

The 66 production masters are `public/app/images/demons/1.png` through `66.png`. Sixty retain their original approved drawings and extraction; Vi'Zel's six masters now use the approved yellow palette edits from swirl study v4. Preserve every accepted pose, face, marking, limb, horn and rarity signature. Preserve Ma'Zga's actual purple puddle material; only the surrounding presentation background and gray contact shadow become transparent.

- **Boof Nitza (1–6):** light imps become lean trained fighters. Athletic, never bulky bodybuilders or stick figures.
- **Gon G'ah (7–12):** thin bug demon, large staring amber eyes, segmented antenna crown and increasing secondary eyes.
- **Ma'Zga (13–18):** continuous poison puddle/blob, never a humanoid under slime. Epic has a low crawling body and one rear-rooted overhead scorpion tail made of the same goo. Legendary is one asymmetrical rearing wave. Mythic has four horn tips and two airborne goo hands attached above but clear of the bottom puddle; no closed side loops. Gold eyes through legendary, pink at mythic.
- **Tor Tza (19–24):** ember imp grows into a fire beast. Common has a black pupil in each eye, connected to the upper eyelid. The authorized common eye pixel repair is recorded in `tor-tza-eye-repair.json`.
- **Vi'Zel (25–30):** quadrupedal horned bull, four legs and a tail. Golden-yellow eyes, solid black pupils and no white catchlights. Existing colored accents are gold/yellow with ochre shadows; the main body remains navy/blue with near-black outlines. Mythic extends gold into the existing mane, split beard, tail tuft and horn accents. Preserve approved anatomy and horn progression. `vizel-yellow-revision.json` records all six imagegen edits, checkerboard extraction and Legendary's two localized pupil repairs. This supersedes the historical red/pink palette and the older eye-repair inputs.
- **Goh Loomb (31–36):** avian stalker grows into a great winged demon; mythic's second wing pair starts from the back, never the hands.
- **Baobaw (37–42):** common is a small cute toddler with visible claws, uncommon is a juvenile bridge. Skull face and long claws develop into a nightmare; do not jump directly from baby to adult.
- **Ko Pak (43–48):** sapling becomes a hollow tree guardian. Branch crown, woody ribs and root feet, not fur.
- **Chu Perk (49–54):** mushroom imp grows gradually in torso width, arms, hands, feet and cap crown. Epic through mythic are huge and strong; no abrupt unrelated body plan or anatomical muscle rendering.
- **Ba Be'aga (55–60):** hooded skeletal healer; legendary/mythic flames are healing pale cyan `#8DE7FF`, never pink.
- **Vee Scol (61–66):** hooded caster becomes armored tyrant; rare has no flame above the hat. Mythic crest is armor, not actual fire.

Per-stage details and the exact original generation prompts are saved in `demon-provenance.json`; `species-directions.json` contains the family briefs. A prompt's old gray-background instructions describe the historical concept generation, not production transparency requirements.

## Bag Echoes

The eleven vessel designs from `echo-studies-v1` were approved for integration on 2026-08-28. Preserve their distinctive silhouettes and large ivory role symbols. Use the same near-black ink, broad matte colors and sparse hard shadows as the demon roster; do not restore scratched metal, shiny bevels or miniature ornaments.

The transparent full-size PNG masters are `public/app/images/items/echo/*.png` (excluding `*-mask.png`). `echo-art.json` records their hashes and the selected preview sources; `echo-generation-prompts.json` preserves the prompts and refinements. The original neutral preview matte and empty upper windows become transparent; painted essence, frames, symbols and outlines stay intact. Boof Nitza and Chu Perk retain their gray liquid, not a transparent hole in its place.

One drawing serves all six rarities. Rarity remains in the Bag badge, aura and ornament, never baked into the drawing or used to desaturate its colors. The approved essence colors are silver gray, ink blue, venom green, ember red, golden yellow, claw amber, spectral violet, olive green, slate gray, soul cyan and arcane blue in type order. In particular, this Echo approval updates Vi'Zel to yellow, Goh Loomb to amber and Baobaw to violet; the earlier exclusion of Bag palettes from the combat-only color swap is superseded for these approved assets.

`npm run assets:echoes` produces the existing 512px WebP paths plus new liquid-only PNG masks. The approved color blocks remain in the image; a restrained animated overlay is clipped above them, excluding ivory glyphs, metal and empty glass. Do not restore the old opaque gradient fill behind the vessel. Keep reduced-motion support and version both the WebP and mask URLs together. Verify every type on light/dark backgrounds and in Bag slots and detail views.

## Environments and world subjects

Carry the same strong ink, broad simple forms and flat shadows into scenery. Preserve each existing asset's purpose, scene identity, framing and color mood. Use chunky stone, simplified trees and a few large readable props. Lower contrast through the center where UI and game characters sit. Full-page environments are opaque landscape images, with safe center crops for mobile.

- Home: haunted forest ruins and a winding stone path, teal depth with small warm/violet lights.
- Bag: vaulted storage crypt, shelves and bottles at the edges, open central floor.
- Collection: spectral creature-vessel archive with teal-lit niches, open central chamber. Each of the ten glass bottles contains one recognizable cyan soul based on `soul.svg`: rounded head, two separate dark oval eyes and a tapered wavy tail. No mouth, labels or random scribbles.
- Campfire: campsite in dark forest ruins, small warm fire low in frame, quiet central space.
- Dungeon: full-screen repeating blue cobblestone floor using the user-selected square texture. Keep the tile at a controlled scale so it fills every aspect ratio without stretching and remains unobstructed playable ground. Preserve the project's *How Many Dudes* inspiration at the principle level through chunky readable stones, confident dark contours, sparse interior marks and broad matte color planes. No arena border, raised walls, ledges, props, entrances, portals, mushrooms or empty void around the floor; demons are the only large focal shapes.
- Rankings: ceremonial stone hall, distant gold-lit throne/podium, purple banners and side braziers.
- Summon: ritual crypt and engraved circular floor dais, cyan spectral fire in side bowls.
- Crowley: recognizable mysterious traveling merchant with horned brimmed hat, dark layered coat, sly face, staff lantern and a small cyan soul. Exaggerated cartoon proportions; no photorealistic person.
- Whispering Well: squat dark stone well with a gold eye/sun sigil, ivory-cyan spectral flame and a few small skull spirits. Chunky carved blocks, not intricate stone texture.
- Anomaly: recognizable asymmetrical chimera with blue/violet body, mismatched antlers, extra eyes, woody/root features on one side and shaggy feather-like masses on the other. Menacing expressive cartoon face and clear claw silhouette; no realistic horror painting.

Crowley and the Well remain square illustrated event portraits. Anomaly is a full-body transparent battle sprite. Preserve the existing brand logo exactly when producing the home social image; do not regenerate its lettering.

## Files and workflow

1. Read this file and the relevant per-species brief before any new art work.
2. Inspect the approved production references, not superseded drafts. Reference the character for style only when generating scenery.
3. Save exact new prompts in the relevant provenance file: `world-generation-prompts.json` for environments, `card-backdrop-generation-prompts.json` for card backgrounds, or a recorded demon revision such as `vizel-yellow-revision.json`. Use built-in imagegen, one call per new asset; do not switch to API/CLI generation without user approval.
4. Inspect every result for identity, simple rendering, composition, full extremities and actual alpha when required.
5. Keep full PNG masters and regenerate matching WebP/AVIF/atlas variants with the asset scripts. Never leave a project asset pointing at an external generation directory.
6. Review on light and dark backdrops and at small icon size. Keep IDs and paths stable, refresh cache stamps, then run the asset checks, build and tests.

## Card presentation

Show the complete transparent demon using `object-fit: contain`, centered with no image zoom. In card contexts, the image layer fills the entire card, with compact text and combat stats overlaid at the bottom. Do not reserve space outside the art for a separate stats panel: the user rejected that presentation because it shortened the artwork. Within the overlay, put the HP bar above one footer row: attack and speed on the left, HP value and icon on the right. The card body has `1em` top padding at all viewport sizes, and `.dungeon-demon-card-image` has `border-radius: 0`. Preserve the existing compact phone-hand separator in place of its hidden HP bar. Horns, wings, tails, claws and the actual poison puddle must remain within the image frame. Apply the card treatment on hands, collection, rewards and detail views. Collection cards fill their available grid cells. Do not restore the historical 1.3× desktop / 1.48× phone scaling or `cover` crop rules.

Live Dungeon formations are the deliberate exception: place transparent demon cutouts directly on the isometric arena with no card frame, rarity strip, card backdrop or rectangular slot treatment. Keep compact combat stats as a lightweight overlay, use only a soft contact shadow/glow to ground each sprite, and retain the 3×3 slots invisibly for targeting, drag/drop and keyboard behavior. Empty slots remain invisible except for the contextual Collection add control and an active drag target.

Card backdrops now use the approved colorful cartoon swirl, with a different palette for each type. Keep broad matte planes, confident color boundaries, the existing restrained texture and roughly 70% quiet center. Do not return to faded pastel washes or add extra curls, black background ink, glow or scenery. The demon's near-black outline remains the strongest edge. No horizon, floor, platform, puddle, cast shadow, particles, symbols or props. Keep detailed environments on the page, not inside every card. Backdrops remain separate CSS layers, never baked into transparent sprites.

The earlier forest was too busy; muted teal was too empty. Jade stone established the accepted contrast and texture amount, then swirls replaced its rocks/puddles. `card-backdrops.json` is now the authoritative assignment: Boof Nitza Storm blue; Gon G'ah Steel blue; Ma'Zga Arcane teal; Tor Tza Ember coral; Vi'Zel Brick red; Goh Loomb Claw amber; Baobaw Spectral violet; Ko Pak Root olive; Chu Perk Garnet red; Ba Be'aga Soul cyan; Vee Scol Charcoal slate. Every evolution of a type uses that same background. Rarity remains in the badge/frame, not the background. Use charcoal as the fallback for an unknown portrait. Historical studies remain for reference, not as the active direction.

Rarity emblems use common triangle, uncommon square, rare diamond, epic pentagon, legendary hexagon and mythic star. All have a dark outer contour around the rarity-colored fill for contrast on the bright backgrounds. Boss guide crests and formation cards use these same shapes. Card frame borders use the full opaque rarity color, not a blend with translucent white; keep a small colored glow around the frame. Goh Loomb's attack effects and floating amounts are amber `#FFB23F`; Baobaw's are violet `#C084FC`. Their existing attack geometry, timing and behavior stay unchanged. World terrain colors and Bag item essence palettes are not part of this combat-color swap.

World-map encounter spots and boss circles use the same type backgrounds behind their transparent portraits. Clip both layers inside the circular art area, keeping selection rings, boss crowns and defeated badges unobscured. Append the eleven background tiles to the existing 128px demon map atlas so normal loading requires no extra image request; use the approved WebPs as the atlas-failure fallback. Never bake the background into a demon master or change terrain colors to implement these portraits.

Center the complete visible silhouette on BOTH axes, not the original canvas or a shared ground line. This supersedes the earlier 95% baseline: the user prefers the smaller early evolutions in the center too. `scripts/demon-placement.js` applies integer canvas translation before generating portrait/map WebPs. Preserve the approved scale and proportions: a puddle stays low and wide; never stretch it into a standing body or enlarge it to fill the height. Include detached hands, flames and tail tips when measuring bounds. Ignore isolated extraction specks smaller than 16 alpha pixels and retain a 2px antialiasing margin. Fail the build rather than clip a silhouette that cannot fit. Exact per-demon translations are saved in `demon-placement.json`. Keep all full-size PNG masters unchanged and use the centered display variants for cards and detail portraits.

Demons use `scripts/extract-demon-backgrounds.js` only for deterministic extraction from the approved matte concepts. It changes transparency and antialiased edge color, preserving interior RGB. Do not use it on arbitrary painted images or future assets with different backgrounds without visual review. The original integration included three localized Vi'Zel repairs in `scripts/touch-up-vizel-eyes.js` and Tor Tza's common pupil-to-eyelid bridge in `scripts/touch-up-tor-tza-eye.js`; those repairs preserve every alpha value and every pixel outside their recorded patch rectangles. The six current Vi'Zel masters supersede the earlier Vi'Zel edits: their yellow palette revisions, painted-checkerboard extraction and localized Legendary eye cleanup are recorded in `vizel-yellow-revision.json`. Do not apply the old repair script to these new masters. Display centering changes placement only, not anatomy or painted details.
