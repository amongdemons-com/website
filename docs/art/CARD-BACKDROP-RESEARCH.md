# Demon card background and placement

Updated 2026-08-28. Scope: preserve the approved 66 demons, center their visible silhouettes, and add color/material character without returning to busy miniature scenery.

## Reference research

These are visual observations from the developers' published images, followed by our interpretation. They are not claims that the developers prescribed our solution.

| Source | Observation | Application here |
| --- | --- | --- |
| [How Many Dudes? developer guide](https://blog.bscotch.net/post/how-many-dudes-guide/) | The Hacker collection example places compact black-outlined art on strong gold fields. The image stays legible without a separate illustrated scene in every tile. | Use a colored field lighter than the demon outlines; a backdrop need not be gray or desaturated to stay quiet. Keep our own palette and assets. |
| [Brotato developer screenshots on Steam](https://store.steampowered.com/app/1942280/Brotato/) | Small terrain marks and scattered surface details are much less assertive than the characters and pickups in the arena screenshot reviewed. | Retain broad material variation while keeping background edge contrast low. Its dark gray palette is not the palette selected for our cards. |
| [Riot Games: Clarity in League](https://www.leagueoflegends.com/en-gb/news/dev/clarity-in-league/) | The article describes visual hierarchy, recognizable silhouettes and reducing visual noise as parts of gameplay clarity. | The demon silhouette is the primary shape. Background marks must not compete with claws, horns, eyes or tiny early-stage bodies. This is a readability principle, not a rendering-style reference. |

Reference images inspected: the guide's Hacker collection and Daily Dude panels, and the first Brotato gameplay screenshot in the official Steam media set. Third-party screenshots are research references only; they are not shipped or used as generation inputs.

## Our site palette

The approved collection room provides cyan souls, jade light, olive moss and warm amber lanterns over dark stone. The summon scene repeats cyan/jade spectral light with warm candles. The dungeon adds violet portals and mushrooms. These accents can be lifted into lighter card materials, with the surrounding page retaining its darker atmosphere.

Two generated studies use our collection room as a material/palette reference and our approved Boof Nitza common as a rendering/contrast reference. Neither contains characters or scene props.

| Study | Proposed prompt palette, not measured site swatches | Result and tradeoff |
| --- | --- | --- |
| **Jade stone — selected** | Jade `#78C8A6`, pale mineral `#A2D5AD`, lichen `#ACC67A` | Fits the site's spectral greens. Broad stone planes and sparse lichen add life; light values separate the dark outlines, including on teal poison demons. A little less hue contrast with poison than amber. |
| Amber limestone — retained alternative | Ochre `#CFAC64`, pale amber `#E1C682`, lichen `#B3BD74` | Strong warm/cool separation from blue, teal and purple demons. It is more assertive in a whole collection grid and makes all cards feel more golden, so jade is the recommended shared default. |

The choice is an art judgment from card-size previews, not a controlled player study. Both were reviewed in the production card renderer. Jade is not described as user-approved until the user reviews it.

## Rules to keep

- Center the **visible alpha bounds on both axes**, including common and uncommon evolutions. Keep the full image layer and bottom stats overlay. Do not add zoom, stretch puddles or create a separate stats row.
- Include detached hands, fire and tail tips in the bounds. Preserve all approved anatomy, scale and eye repairs. Do not regenerate demons for placement.
- Use one shared material backdrop across rarities. Keep the warm alternative as a review option, not a new rarity color system.
- Two simple material textures are enough: broad worn stone plus a few flat moss/lichen patches. Aim for about 70% calm color, especially near the middle. This is a composition target, not a measured coverage assertion.
- Keep background boundaries in neighboring mid/light colors. Reserve near-black, high-contrast contours for the demons. No dark cracks or black texture outlines behind them.
- No horizon, platform, contact shadow, spotlight, tree silhouettes, little props, grain or repeated busy marks. Centered short puddles must not appear misplaced relative to an illustrated ground plane.
- Review at desktop collection size and small phone formation size. A detailed full-page environment is not a suitable card background unchanged.

## Files and generation

Built-in imagegen produced both studies. Exact prompts, reference roles, output files and selection notes are in [card-backdrop-texture-prompts.json](card-backdrop-texture-prompts.json). The selected prompt and earlier rejected directions are also recorded in [world-generation-prompts.json](world-generation-prompts.json).

- Selected production master: `public/app/images/assets/background/demon-card.png`, with generated WebP and AVIF siblings.
- Preserved studies: [jade-stone.png](backdrop-studies/jade-stone.png) and [amber-limestone.png](backdrop-studies/amber-limestone.png).
- Placement: `scripts/demon-placement.js`; measurements in [demon-placement.json](demon-placement.json).
- Verification: [asset-verification.json](asset-verification.json) and [card-verification.json](card-verification.json).

The full-size demon PNG masters remain unchanged. Centering uses integer translations before downsampling to the existing 512px portrait and 256px map WebPs; the atlas is rebuilt from those variants. Actual production output bounds are checked within two pixels of center after encoding, with no edge clipping.
