# Audio sources

All downloaded audio added during this sound pass is available under the [Creative Commons Zero 1.0](https://creativecommons.org/publicdomain/zero/1.0/) public-domain dedication. Attribution is not legally required, but the creators and source pages are recorded here for provenance. Six ability effects were instead derived from audio that already existed in this repository; their earlier provenance is noted separately below.

The downloaded source audio was renamed and converted to OGG Vorbis. All playable assets were normalized for consistent browser playback: files at least 400 ms long target -18 LUFS integrated loudness with mono compensation, while shorter transients target -2 dBTP because they are shorter than the EBU R128 measurement window. True peaks retain encoding headroom, and crest reduction is applied only where required to reach the loudness target without clipping.

## Kenney

- [RPG Audio](https://kenney.nl/assets/rpg-audio) — leather interaction sounds.
- [Impact Sounds](https://kenney.nl/assets/impact-sounds) — light/heavy impacts and ambush sounds.
- [Music Jingles](https://kenney.nl/assets/music-jingles) — encounter, hunt, challenge, battle-start, reinforcement, and boss stingers.

## OpenGameArt

- [Dark Forest Theme](https://opengameart.org/content/dark-forest-theme) by cynicmusic — `music/default/1.ogg`.
- [Whispers in the Fog](https://opengameart.org/content/whispers-in-the-fog) by Ruhinre — `music/dungeon/1.ogg`.
- [Battle Theme A](https://opengameart.org/content/battle-theme-a) by cynicmusic — `music/world_boss.ogg`.
- [7 Assorted Sound Effects](https://opengameart.org/content/7-assorted-sound-effects-menu-level-up) by Joth — movement, pickup, level-up, and skill effects.
- [Magic Spell SFX](https://opengameart.org/content/magic-spell-sfx) by JaggedStone — shrine, portal, teleport, pact, poison, heal, chaos, and reset effects.
- [Battle Sound Effects](https://opengameart.org/content/battle-sound-effects) by artisticdude/Ogrebane — ranged projectile effects.
- [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx) by rubberduck — demon, roar, scream, and boss creature effects.
- [Game Over Theme](https://opengameart.org/content/game-over-theme) by Cleyton Kauffman — defeat and lost-run cues.
- [Victory Fanfare](https://opengameart.org/content/victory-fanfare) by ARoachIFoundOnMyPillow — battle victory cue.

## Pre-existing repository audio

These configured ability effects now use the six pre-existing `type_*` assets. The WAV sources were converted to OGG Vorbis; the existing OGG sources were renamed into the semantic catalog. Their license and original source predate this sound pass and are not established by the download links above.

- `type_1.wav` → `sfx/battle/abilities/melee_swing.ogg`
- `type_4.ogg` → `sfx/battle/abilities/fire_aoe.ogg`
- `type_5.wav` → `sfx/battle/abilities/bruiser_strike.ogg`
- `type_6.wav` → `sfx/battle/abilities/assassin_strike.ogg`
- `type_7.ogg` → `sfx/battle/abilities/cleave.ogg`
- `type_9.ogg` → `sfx/battle/abilities/juggernaut_slam.ogg`

## User-provided audio

The ten `sfx/world/footstep_dirt_*.ogg` movement variants were converted from the user-provided `Fantasy Sound Library/Mp3/Footsteps/Footstep_Dirt_00.mp3` through `Footstep_Dirt_09.mp3` files. Their source-library license is separate from the CC0 assets listed above.
