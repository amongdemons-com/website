# Among Demons Ranked Mode - TODO

## 1. Route and page shell

- [x] Add authenticated `/ranked` page and navigation entry.
- [x] Reuse the existing Dungeon/World battle UI, combat replay, animations, drag-and-drop behavior, responsive layout, combat log, and speed controls.
- [x] Keep the standard site navbar.
- [x] Do not create a separate battle header.
- [x] In Ranked only, replace the existing `YOUR TEAM 4/6` row content with:
  - Desktop: `BRONZE II · FLOOR 7 · ♥ ♥ ♡`
  - Mobile: a compact equivalent such as `F7 · ♥ 2/3`
- [x] During combat, preserve the existing battle layout without additional panels or overlays.

## 2. Ranked run rules

- [x] Create a separate server-authoritative Ranked run state.
- [x] Do not use demons from the permanent collection.
- [x] Do not apply permanent demon training.
- [x] Generate standardized Ranked demons from the normal demon type and rarity data.
- [x] Limit the number of active demons to the current floor plus one, capped at 6 from floor 5 onward.
- [x] Give each run 3 lives.
- [x] On defeat, consume one life, grant floor interest, and continue to the next floor while lives remain.
- [x] End the run when no lives remain.
- [x] Treat clearing floor 20 as a completed Ranked victory.
- [x] Show the new rank, gained Rank Points, and rank emblem after floor 20, then let the player choose Endless or New Run.
- [x] Allow the player to continue beyond floor 20 until all lives are lost.
- [x] Preserve the normal automatic combat rules and deterministic server simulation.

## 3. Connection to the main game

- [x] Apply the player’s Skill Tree bonuses in Ranked.
- [x] Cap or ignore uncapped `Endless` Skill Tree scaling if balance testing shows it dominates Ranked.
- [x] Apply active combat-related world-boss reward buffs in Ranked.
- [x] Ignore noncombat world buffs such as Soul Vessel capacity.
- [x] Lock the Skill Tree and active world-boss buff snapshot when a Ranked run begins.
- [x] Do not let Skill Tree changes or expiring buffs alter an active run midway.
- [x] Store the locked bonuses in player opponent snapshots.
- [x] Display Ranked rank and results on the hunter profile and rankings.

## 4. Active team and Reserve

- [x] Show the player’s normal 9-slot formation on the left during preparation while limiting the active team to 6 demon cards.
- [x] Replace the enemy formation on the right with a limited **Reserve** during preparation.
- [x] Start with 6 Reserve slots, displayed as the first two rows of the standard formation UI.
- [x] Keep Reserve demons across floors.
- [x] Prevent Reserve demons from participating in combat.
- [x] Allow demons to move freely between the active formation and Reserve before fighting.
- [x] Replace the Reserve with the selected enemy formation when combat starts.
- [x] Restore the Reserve when returning to preparation.
- [x] Show `Reserve · [rSoul icon] amount` within the existing right-side panel, without adding a global header or capacity counter.
- [x] Show locked Demonic Pacts, Skill Tree bonuses, and combat buffs below Reserve using the Dungeon buff-chip UI.
- [x] Require the player to combine, move, or banish something when both the formation and Reserve are full.

## 5. Demon drafting

- [x] Begin the run with a five-card Hand.
- [x] After each resolved floor, present five demon cards or carry the exact Hand forward when it is locked.
- [x] Allow the player to buy any number of offered demons that fit in Team and Reserve.
- [x] Start each Ranked run with 2 run-only Ranked Souls (`rSouls`).
- [x] Start with 2 deterministic-random Common or Uncommon demons, placing both on the Floor 1 team.
- [x] Never spend the player's general Soul balance on Ranked cards or rerolls.
- [x] Price Hand cards in rSouls by rarity: 1 Common, 2 Uncommon, 3 Rare, 4 Epic, 5 Legendary, and 7 Mythic.
- [x] Treat moving a Hand card to Team or Reserve as its purchase point.
- [x] Keep formation space, Reserve space, rSoul prices, and upgrade commitments as the Ranked economy.
- [x] Let the player freely arrange Team, Reserve, and Hand before committing.
- [x] Let the player lock the current Hand when fighting; otherwise pressing Fight with cards left in Hand discards them.
- [x] Define floor-based rarity odds so higher rarities gradually enter offers.
- [x] Keep lower rarities available at deep floors so completing combinations remains possible.
- [x] Keep rarity chances server-defined without adding Hand metadata or a rarity-odds header to the compact bottom strip.
- [x] Use signed/server-generated offers so the browser cannot manipulate cards or rarity rolls.

## 6. Combining demons

- [x] Combine 3 identical demons of the same type and rarity into 1 demon of the next rarity.
- [x] Detect combinations across both the active formation and Reserve.
- [x] Support the full rarity chain:
  - Common → Uncommon
  - Uncommon → Rare
  - Rare → Epic
  - Epic → Legendary
  - Legendary → Mythic
- [x] Preserve a sensible formation/Reserve destination for the upgraded demon.
- [x] Clearly animate and explain automatic combinations.
- [x] Highlight every card in a ready three-card combination.
- [x] Preview combinations immediately in the browser, then validate and commit their source recipes on Fight or Reroll.
- [x] Let a Hand purchase dropped onto a matching roster demon combine immediately when both roster pieces are part of the upgrade.
- [x] Prevent temporary Ranked upgrades from affecting the permanent collection.

## 7. Rerolls and banishing

- [x] Charge 2 rSouls for every full-hand reroll.
- [x] Discard the entire Hand and deal five new offers when rerolling.
- [x] Treat owned demons discarded from Hand by Reroll as permanent banishes.
- [x] Keep Team/Reserve/Hand changes local until Fight or Reroll is pressed.
- [x] Stage Hand purchases, animations, and sounds immediately in the browser, then validate and charge them atomically on Fight or Reroll.
- [x] Display the 2-rSoul price directly on the Reroll button.

## 8. Demonic Pacts

- [x] Reuse the existing Demonic Pact definitions and effect pipeline.
- [x] Offer a Pact choice as part of Ranked progression.
- [x] Store all selected Pacts in the Ranked run and opponent snapshots.
- [x] Ensure duplicate/stacking behavior follows the existing Pact rules unless Ranked balance requires a cap.
- [x] Award a Pact after every cleared floor.
- [x] Reuse Dungeon's View Team / Show Pacts toggle while choosing a Pact.

## 9. Preparation layout

- [x] Reuse the existing bottom recruitment/extraction area.
- [x] Lay it out as: `Reroll` → five demon cards → `Fight`.
- [x] Keep the bottom strip free of card-area labels, pick counters, and rarity-odds controls.
- [x] Always show Reroll outside combat, with Reroll and Fight as square full-height controls.
- [x] Center an empty-state message when the Hand has no cards.
- [x] Keep the active formation visible on the left and Reserve visible on the right.
- [x] Let the player rearrange Team, Reserve, and Hand before pressing Fight.
- [x] Enable Fight as soon as at least one active demon is placed and no Pact choice is pending.
- [x] When Fight is pressed:
  - [x] Hide the preparation card controls.
  - [x] Replace Reserve with the opponent.
  - [x] Show the existing combat and speed controls.
  - [x] Run the normal battle replay without Ranked-specific visual restructuring.

## 10. Asynchronous opponent snapshots

- [x] Save a player snapshot whenever the player becomes ready to enter a floor.
- [x] Include:
  - [x] Floor and season
  - [x] Rank/rating bracket
  - [x] Active formation and demon stats
  - [x] Demon rarities and combinations
  - [x] Demonic Pacts
  - [x] Locked Skill Tree effects
  - [x] Locked combat-related world-boss buffs
  - [x] Deterministic combat data/version
- [x] Select an older player snapshot from the same floor and approximately the same rank.
- [x] Exclude the player’s own snapshots.
- [x] Avoid repeatedly serving the same opponent to one player.
- [x] Freeze snapshots so later account or run changes cannot mutate historical opponents.
- [x] Version snapshots when combat rules or game data change.

## 11. Generated fallback opponents

- [x] If no real player snapshot exists for a floor, create a legal generated opponent.
- [x] Generate opponents through the same drafting, rarity, combining, Pact, formation, and buff constraints available to players.
- [x] Give generated opponents the exact active-team limit for their floor and simulated Pact selections.
- [x] Do not use unexplained artificial stat multipliers.
- [x] Seed generated opponents deterministically using the season and floor.
- [x] Generate and cache approximately 3–5 variants per empty floor.
- [x] Give generated opponents plausible Skill Tree/world-buff profiles for their floor and rank bracket.
- [x] Save generated builds so they can be reused.
- [x] Never display generated opponents as real hunters or include them in rankings.
- [x] Gradually prioritize real snapshots once players reach that floor.

## 12. Rank progression

- [x] Add seasonal Ranked rating and named divisions.
- [x] Make floor 20 the primary victory milestone.
- [x] Award a meaningful rating increase for clearing floor 20.
- [x] Keep Endless as a highest-floor challenge without additional rating after floor 20.
- [x] Initially test:
  - [x] Floors 1–9: no positive Rank Points
  - [x] Floors 10–19: +3 pending Rank Points per cleared floor
  - [x] Floor 20: +75 Rank Points plus pending progress
  - [x] Floor 21+: highest-floor prestige without additional Rank Points
- [x] Award no rating after floor 20; Endless progression is tracked by highest floor only.
- [x] Decide how much rating is lost for runs ending before floor 10 or floor 20.
- [x] Prevent unlimited playtime alone from overpowering actual performance in seasonal rankings.

## 13. Rewards

- [x] Award Souls after a full floor-20 victory.
- [x] Decide whether deeper floors increase the Soul reward or only Rank Points.
- [x] Keep the reward below a level that turns Ranked into the dominant Soul farm.
- [x] Decide whether Echoes or other main-game rewards are included.
- [x] Do not charge a Ranked entry fee.
- [x] Solve excess world Souls through a separate future system rather than weakening Ranked gameplay.

## 14. Database and API

- [x] Add tables/state for active Ranked runs, seasons, rating, opponent snapshots, generated opponents, and opponent history.
- [x] Add a Ranked bootstrap endpoint.
- [x] Add endpoints for:
  - [x] Start run
  - [x] Read current run
  - [x] Read server-generated offers
  - [x] Commit Team/Reserve and reroll the discarded Hand
  - [x] Choose Pact
  - [x] Commit Team/Reserve, discard Hand, and resolve battle
  - [x] Continue to the next floor
  - [x] End/finalize run
- [x] Keep preparation edits local and make Fight/Reroll commits transactional and server-authoritative.
- [x] Prevent replayed requests, duplicated recruits, duplicated combinations, reroll abuse, and duplicate reward claims.
- [x] Store enough state to resume safely after refresh, logout, or interrupted combat replay.

## 15. Testing and balancing

- [x] Unit-test lives, floor progression, Hand locking, drafting, Reserve limits, banishing, rerolls, combining, Pact stacking, snapshots, and rewards.
- [x] Test that newly recruited demons cannot generate infinite same-phase rerolls.
- [x] Test combinations spanning active formation and Reserve.
- [x] Test generated opponents at floors no player has reached.
- [x] Test expired world buffs and changed Skill Trees do not alter an active run or saved snapshot.
- [x] Test combat determinism between initial server result and browser replay.
- [x] Simulate rarity progression to ensure Rare/Epic/Legendary/Mythic combinations occur at satisfying depths.
- [x] Simulate Rank Point inflation and repeated-play advantages.
- [x] Test desktop and mobile preparation layouts without altering the existing combat presentation.
- [x] Bump all production JS/CSS version stamps for modified assets.

## Open balance decisions

- [x] Allow any number of affordable demons from each five-card Hand, while permitting Fight as soon as one active demon is placed.
- [x] Keep the Reserve at 6 slots.
- [x] Use the implemented seven floor bands, gradually shifting weight upward while preserving Common and Uncommon offers at every depth.
- [x] Award Pacts after victories only.
- [x] Award one Pact after every cleared floor with no floor-frequency cap.
- [x] After each cleared floor, award the cleared floor number in rSouls plus 1 rSoul interest for every 10 unspent rSouls.
- [x] Use no positive RP on floors 1-9, +3 pending RP on floors 10-19, +75 protected RP at floor 20, no Endless RP, and bounded early-exit penalties of -20/-5.
- [x] Award 25 Souls once for clearing floor 20.
- [x] Do not award additional Souls on deeper floors.
- [x] Apply combat Skill Tree effects, ignore noncombat effects, and cap `Endless` masteries at 10 per node.
