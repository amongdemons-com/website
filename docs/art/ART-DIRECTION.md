# Among Demons art direction

Approved 2026-08-27. This is the production direction for the website artwork branch.
The accepted roster culminates in progression v9. Earlier concepts and anatomy experiments are historical, not instructions to roll back approved designs.

## Rendering

Inspired by the expressive cartoon readability of *How Many Dudes?*, interpreted for our own characters.
Use confident near-black organic contours, sparse interior lines, broad matte color blocks and at most one simple hard shadow per material. Enlarge faces and signature features. Keep silhouettes readable at 128px. Reduce fur, feathers, bark, slime, stone and armor to a few broad shapes.

No photographic rendering, glossy 3D, fine surface texture, realistic muscles, cinematic bloom, particle clouds or white eye catchlights. Magic is a small number of clear outlined color shapes. Preserve species palettes; do not make every subject a blue horned imp.

## Approved demons

The 66 production masters are `public/app/images/demons/1.png` through `66.png`. These are existing approved drawings with their gray-teal presentation matte removed, not regenerated characters. Preserve every accepted pose, face, marking, limb, horn and rarity signature. Preserve Ma'Zga's actual purple puddle material; only the surrounding presentation background and gray contact shadow become transparent.

- **Boof Nitza (1–6):** light imps become lean trained fighters. Athletic, never bulky bodybuilders or stick figures.
- **Gon G'ah (7–12):** thin bug demon, large staring amber eyes, segmented antenna crown and increasing secondary eyes.
- **Ma'Zga (13–18):** continuous poison puddle/blob, never a humanoid under slime. Epic has a low crawling body and one rear-rooted overhead scorpion tail made of the same goo. Legendary is one asymmetrical rearing wave. Mythic has four horn tips and two airborne goo hands attached above but clear of the bottom puddle; no closed side loops. Gold eyes through legendary, pink at mythic.
- **Tor Tza (19–24):** ember imp grows into a fire beast. Common has a black pupil in each eye.
- **Vi'Zel (25–30):** quadrupedal horned bull, four legs and a tail. Red/pink eyes with black pupils and no white catchlights. Preserve the user's manually corrected eyes.
- **Goh Loomb (31–36):** avian stalker grows into a great winged demon; mythic's second wing pair starts from the back, never the hands.
- **Baobaw (37–42):** common is a small cute toddler with visible claws, uncommon is a juvenile bridge. Skull face and long claws develop into a nightmare; do not jump directly from baby to adult.
- **Ko Pak (43–48):** sapling becomes a hollow tree guardian. Branch crown, woody ribs and root feet, not fur.
- **Chu Perk (49–54):** mushroom imp grows gradually in torso width, arms, hands, feet and cap crown. Epic through mythic are huge and strong; no abrupt unrelated body plan or anatomical muscle rendering.
- **Ba Be'aga (55–60):** hooded skeletal healer; legendary/mythic flames are healing pale cyan `#8DE7FF`, never pink.
- **Vee Scol (61–66):** hooded caster becomes armored tyrant; rare has no flame above the hat. Mythic crest is armor, not actual fire.

Per-stage details and the exact original generation prompts are saved in `demon-provenance.json`; `species-directions.json` contains the family briefs. A prompt's old gray-background instructions describe the historical concept generation, not production transparency requirements.

## Environments and world subjects

Carry the same strong ink, broad simple forms and flat shadows into scenery. Preserve each existing asset's purpose, scene identity, framing and color mood. Use chunky stone, simplified trees and a few large readable props. Lower contrast through the center where UI and game characters sit. Full-page environments are opaque landscape images, with safe center crops for mobile.

- Home: haunted forest ruins and a winding stone path, teal depth with small warm/violet lights.
- Bag: vaulted storage crypt, shelves and bottles at the edges, open central floor.
- Collection: spectral creature-vessel archive with teal-lit niches, open central chamber.
- Campfire: campsite in dark forest ruins, small warm fire low in frame, quiet central space.
- Dungeon: broad ruined battle arena, side stairways and teal/violet portals, empty combat floor.
- Rankings: ceremonial stone hall, distant gold-lit throne/podium, purple banners and side braziers.
- Summon: ritual crypt and engraved circular floor dais, cyan spectral fire in side bowls.
- Crowley: recognizable mysterious traveling merchant with horned brimmed hat, dark layered coat, sly face, staff lantern and a small cyan soul. Exaggerated cartoon proportions; no photorealistic person.
- Whispering Well: squat dark stone well with a gold eye/sun sigil, ivory-cyan spectral flame and a few small skull spirits. Chunky carved blocks, not intricate stone texture.
- Anomaly: recognizable asymmetrical chimera with blue/violet body, mismatched antlers, extra eyes, woody/root features on one side and shaggy feather-like masses on the other. Menacing expressive cartoon face and clear claw silhouette; no realistic horror painting.

Crowley and the Well remain square illustrated event portraits. Anomaly is a full-body transparent battle sprite. Preserve the existing brand logo exactly when producing the home social image; do not regenerate its lettering.

## Files and workflow

1. Read this file and the relevant per-species brief before any new art work.
2. Inspect the approved production references, not superseded drafts. Reference the character for style only when generating scenery.
3. Save exact new prompts in `world-generation-prompts.json`. Use built-in imagegen, one call per new asset; do not switch to API/CLI generation without user approval.
4. Inspect every result for identity, simple rendering, composition, full extremities and actual alpha when required.
5. Keep full PNG masters and regenerate matching WebP/AVIF/atlas variants with the asset scripts. Never leave a project asset pointing at an external generation directory.
6. Review on light and dark backdrops and at small icon size. Keep IDs and paths stable, refresh cache stamps, then run the asset checks, build and tests.

Demons use `scripts/extract-demon-backgrounds.js` only for deterministic extraction from the approved matte concepts. It changes transparency and antialiased edge color, preserving interior RGB. Do not use it on arbitrary painted images or future assets with different backgrounds without visual review.
