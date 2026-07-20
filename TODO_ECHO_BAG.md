# Echo Bag, Summoning, Rarity Pacts, and Encounter Scaling

This file is the authoritative implementation checklist for the Echo bag and
related dungeon-progression redesign.

## File lifecycle

- Keep this file in the repository while any required checkbox is incomplete.
- Do not delete it after partial implementation, a prototype, or backend-only work.
- Delete it only after implementation, migrations, automated tests, desktop/mobile
  QA, documentation, and the final completion audit are all finished.
- If a design decision changes, update the decision and its affected checklist items
  here rather than silently diverging from this plan.

## Goals

- Slow permanent collection completion without relying on extremely low drop rates.
- Replace one-fight whole-demon extraction with visible, deterministic progress.
- Make every extracted rarity useful, including duplicates of already-summoned demons.
- Give Echo refinement and future item types a natural home in a reusable bag.
- Keep Common, Uncommon, and Rare demons relevant on deep dungeon floors.
- Allow simple rarity-targeted Demonic Pacts to remain useful throughout a run.
- Make dungeon difficulty scale through enemy count and Terror rather than filling
  every late encounter with Mythics.
- Preserve server authority, deterministic previews, and transactional collection
  writes.

## Explicit non-goals

- Do not create unique skills or passives for all 66 demon variants.
- Do not add a Dominion/team-power budget.
- Do not build a general enemy squad-archetype system.
- Do not award bonus Echoes for carrying a demon deeper or using it in more fights.
- Do not add bag capacity, paid bag slots, item weight, or bag pressure.
  Empty grid cells are decorative layout slots, not a finite capacity system.
- Do not invent placeholder consumables, keys, or materials merely to fill the page.
- Do not make normal late-floor difficulty depend on all-Mythic enemy teams.
- Do not combine Echo refinement with the previously suggested free-training duplicate
  reward unless this file is explicitly revised first.

## Locked first-release decisions

- Summoning requirements: `1 / 2 / 3 / 5 / 8 / 12` from Common through Mythic.
- Adjacent refinement costs: `3 / 3 / 4 / 5 / 6` from Common through Legendary.
- Deep normal rarity distribution: Common 15%, Uncommon 20%, Rare 30%, Epic 22%,
  Legendary 12.5%, and Mythic 0.5%.
- Rarity Convergence begins on floor 10 with a seeded 25% chance. Common, Uncommon,
  Rare, Epic, and Legendary are eligible; Mythic is excluded.
- Floor pressure is calibrated to the former Mythic-heavy power budget, while Host
  compensation is computed from the selected Convergence rarity.
- The first rarity Pacts target Common/Uncommon, Rare, and Epic/Legendary.
- The onboarding starter remains a direct permanent collection grant.

## Recommended implementation order

1. Add shared Echo/refinement configuration, generic bag storage, natural
   discovery storage, and transactional server helpers.
2. Add bag read/refine/summon APIs with automated tests while leaving live
   cashout behavior unchanged.
3. Build `/bag`, the Echo grid/detail actions, summoning presentation, navigation,
   and lightweight Collection integration.
4. Switch dungeon cashout from whole-demon saving to Echo extraction and update quests,
   achievements, alerts, compatibility behavior, and tests in the same deployable unit.
5. Replace late rarity exclusion, then implement deterministic Convergence encounters
   and their separate presentation.
6. Add the initial contained rarity-targeted stat Pacts.
7. Run combat simulations, tune the rarity/Terror curves, complete regression/manual
   QA, update documentation, and perform the final checklist audit.

## Agreed product model

### Collection versus Bag

- `/collection` contains permanently summoned demons.
- `/bag` contains stackable items, beginning with Demon Echoes.
- Dungeon extraction adds an item to Bag; it does not immediately add that demon
  to Collection.
- Collection may show lightweight missing-slot Echo progress and a link to Bag,
  but refinement and summoning actions live in Bag.

### Echo identity and extraction

- Use the name **Echo** rather than a generic shard for the exact demon imprint.
- One Echo stack represents one exact `type + rarity` combination, for example
  `Rare Gon G'ah Echo x2`.
- A successful demon extraction grants exactly one Echo.
- Carrying the demon deeper never increases the Echo reward.
- Extraction remains available when that exact demon is already summoned.
- Echoes extracted after summoning remain banked as surplus; extraction is not blocked.
- Existing XP and Soul cashout rules remain unless explicitly changed below.
- Skipping the demon/Echo during cashout remains supported.

### Summoning requirements

These values must live in one server-side configuration source and are balance values,
not hard-coded independently in routes and UI.

| Rarity | Echoes required |
| --- | ---: |
| Common | 1 |
| Uncommon | 2 |
| Rare | 3 |
| Epic | 5 |
| Legendary | 8 |
| Mythic | 12 |

- [x] Confirm or revise these thresholds before implementing production summoning.
- [x] Return requirements through the API so the client does not duplicate them.

### Echo refinement

- Refinement converts Echoes only within the same demon species.
- Refinement advances exactly one rarity tier at a time.
- 2026-07-20 revision: refinement is not gated on prior discovery or summoning of the
  target rarity. Having enough source Echoes is the only requirement; the player freely
  chooses between banking toward a summon and refining upward. (The original
  discovery-gate design blocked refinement for players who had not summoned or
  extracted the target — including the free type 1 starter line — and was removed.)
- Natural discovery remains recorded after an Echo stack is spent or a demon is
  summoned.
- Refined Echoes do not count as natural discovery.
- Refinement is manually initiated in Bag and never silently consumes items.
- Directly extracting the desired rarity must remain much faster than refining upward.
- Refinement is allowed even if the source or target demon has already been summoned;
  the result is simply added to the target surplus stack.
- Mythic Echoes have no higher refinement target and remain safely banked in the first
  version. Do not add a second Mythic-surplus mechanic merely to avoid a stored stack.

Conversion rates:

| Refinement | Source Echoes for one target Echo |
| --- | ---: |
| Common -> Uncommon | 3 |
| Uncommon -> Rare | 3 |
| Rare -> Epic | 4 |
| Epic -> Legendary | 5 |
| Legendary -> Mythic | 6 |

- [x] Confirm or revise conversion rates before implementing production refinement.
- [x] Confirm that Mythic surplus should only remain banked for the first release.

### Summoning

- Summoning consumes only the configured number of exact Echoes; any surplus remains.
- Summoning creates the normal minimum-stat collection version of that exact type and
  rarity, compatible with the existing Soul-training system.
- A permanent collection slot cannot be summoned twice.
- Summoning is atomic: consuming Echoes and creating the demon either both succeed or
  both fail.
- Successful summoning gets a deliberate reveal/celebration and a `View in Collection`
  action.
- Collection achievements are checked after summoning, not after Echo extraction.

## Bag page

### Route and navigation

- [x] Add authenticated `/bag` and `/bag/` routes.
- [x] Add `bag.html` using the shared authenticated app shell.
- [x] Add Bag navigation near Collection on desktop and mobile without breaking
  existing navigation widths or active-route highlighting.
- [x] Group World/Dungeon under Explore and Collection/Bag under Hunter; order
  the primary navigation as Camp, Explore, Hunter, Rankings, then Guides.
- [x] Add global `I` and `B` shortcuts that open Bag while ignoring editable fields.
- [x] Add appropriate metadata and prevent an authenticated bag surface from
  being treated as a public catalog page.
- [x] Add a dedicated bag UI module and page-specific CSS if appropriate.
- [x] Apply normal asset cache-version updates to changed HTML/script/style references.

### Grid behavior

- [x] Render a dense, responsive grid of owned item stacks.
- [x] Fill the available panel with decorative empty slots without imposing a bag limit.
- [x] Keep the slot panel fixed until owned items fill it; only then allow grid scrolling.
- [x] Reuse the demon thumbnail/art for Echo items with a clear spectral treatment.
- [x] Show the rarity border/color, Echo identity, and stack count on every tile.
- [x] Show a rarity diamond in the top-left corner of every owned Echo slot.
- [x] Make Bag slots at least twice their original visual size on desktop and mobile.
- [x] Hide item rarity, name, and status in a World-style tooltip until hover, keyboard
  focus, or touch inspection.
- [x] Keep the item tooltip anchored to its actual slot, including when the vault card
  creates a CSS containing block or the tooltip is clamped at a viewport edge.
- [x] Add a clear `View details` tooltip action that opens the item modal while preserving
  direct click and second-tap modal triggers.
- [x] Use the canonical rarity palette for slot diamonds, tooltip and modal rarity labels,
  and both sides of the refinement recipe; keep quantity at bottom-right.
- [x] Keep the first-row slot border fully visible during hover and keyboard focus.
- [x] Mark items that are ready to summon without relying on color alone.
- [x] Support useful sorting: summon-ready, rarity, name, and quantity.
- [x] Support an `All` and `Echoes` filter initially.
- [x] Prepare item-type filtering for future real item categories, but hide empty
  categories rather than showing placeholder items.
- [x] Provide accessible names, keyboard focus, readable contrast, and touch targets.
- [x] Verify useful layouts on narrow mobile, tablet, desktop, and wide desktop.

### Item detail and actions

- [x] Selecting an Echo opens a detail panel or modal with exact type, rarity, owned
  quantity, summon requirement, summon state, and natural-discovery state.
- [x] Show a clear refinement recipe preview: source count, arrow, and target Echo.
- [x] 2026-07-20 revision: the natural-discovery refinement lock and its explanation
  were removed; insufficient quantity is the only locked refinement state.
- [x] Disable actions with an explicit reason when quantity is insufficient.
- [x] Confirm destructive item consumption before refinement or summoning.
- [x] Update the tile, detail view, navigation progression, and relevant collection
  state immediately after a successful action.
- [x] Prevent duplicate requests while an action is pending.
- [x] Surface server errors through the existing game-alert system.
- [x] Remove the Bag hero section and `No slot limit` pill; label the card simply
  `Bag`.
- [x] Make `Refine Echo` primary and keep Close/Summon as secondary actions using the
  shared game button styles.
- [x] Center `Refine Echo` at a content-sized width instead of stretching it across the
  refinement panel.
- [x] Generate and apply an Bag-specific Echo-vault background using the established
  dark-fantasy environment style and page-overlay treatment.

### Collection integration

- [x] Continue showing all owned permanent demons normally.
- [x] For a missing collection slot, show lightweight exact Echo progress such as
  `2/3 Echoes` when progress exists.
- [x] Add `View in Bag` for a missing slot with Echo progress.
- [x] Do not duplicate refinement controls on Collection.
- [x] Refresh Collection correctly after a summon without requiring stale cache data.

## Data model and server APIs

### Generic bag storage

- [x] Add a durable player bag table with a unique player/item key and a
  non-negative quantity.
- [x] Use stable item keys such as `echo:<typeId>:<rarity>` or equivalently structured
  columns; do not use localized display names as identifiers.
- [x] Derive Echo display metadata from authoritative demon types/assets rather than
  storing duplicate mutable names and image URLs in every player row.
- [x] Add indexes needed for player bag reads and transactional item updates.
- [x] Add schema initialization/migration support consistent with the existing project.
- [x] Preserve all existing `player_demons` rows; current players keep their collection.
- [x] Decide and document whether the automatically granted starter demon remains a
  direct collection grant. Recommended: keep it as the onboarding exception.
- [x] Verify existing/open dungeon runs can cash out safely after deployment.

### Natural discovery

- [x] Persist natural discovery separately from current quantity so spending a stack
  cannot relock refinement.
- [x] Mark discovery only from a legitimate dungeon extraction of that exact Echo.
- [x] Do not mark discovery when an Echo is created by refinement, administrative
  repair, or migration unless explicitly intended.
- [x] Return discovery state through Bag API responses where needed.

### Bag API

- [x] Add an authenticated bag read endpoint returning normalized item stacks,
  Echo metadata, requirements, available actions, and discovery state.
- [x] Add a transactional refinement endpoint.
- [x] Validate player ownership, source/target adjacency, same-species conversion,
  recipe cost, and available quantity server-side. (2026-07-20: the natural target
  discovery requirement was removed.)
- [x] Atomically decrement the source stack and increment the target stack.
- [x] Add a transactional summoning endpoint.
- [x] Validate the exact slot, summon requirement, available quantity, authoritative
  asset/type data, and absence of an already-owned collection slot server-side.
- [x] Atomically consume the requirement and create the minimum-stat permanent demon.
- [x] Return normalized updated source/target items and summoned demon data so the UI
  can update without a full reload.
- [x] Make concurrent refine/summon requests safe against negative quantities, duplicate
  summons, and double consumption.

### Dungeon cashout changes

- [x] Replace whole-demon collection saving in normal dungeon cashout with one exact
  Echo bag increment.
- [x] Continue accepting the current valid team/reward/reserved extraction choices.
- [x] Record natural discovery during successful extraction.
- [x] Preserve skip-Echo cashout behavior.
- [x] Update the response contract to describe the extracted Echo and resulting stack.
- [x] Update cashout UI copy from permanent demon ownership to Bag progress.
- [x] Decide how the existing daily `extract a demon` quest is worded and counted.
  Recommended: one successfully extracted Echo still completes extraction progress.
- [x] Keep account XP, Souls, level changes, run ending, pending reward settlement, and
  defeat rules correct.
- [x] Ensure collection achievements are not accidentally granted by unsummoned Echoes.
- [x] Keep extracted Echo artwork constrained to its square card on the post-extraction
  screen so the summary, rewards, and actions remain visible.
- [x] Review other code paths that call `saveCollectionDemon` (including starter grants)
  and change only those intended by this feature.

## Deep-floor rarity availability

### Normal encounters

- [x] Stop permanently removing Common, Uncommon, and Rare from late-floor generation.
- [x] Define explicit, testable rarity distributions by floor band.
- [x] Keep lower rarities non-zero at depth so rarity-targeted Pacts and Echo hunting
  remain possible.
- [x] Do not allow ordinary deep generation to become guaranteed Mythic.
- [x] Decide whether Mythic remains an extremely rare normal roll or is reserved for a
  later special-encounter design. Do not accidentally make it common through team size.

Locked deep normal distribution:

| Rarity | Share |
| --- | ---: |
| Common | 15% |
| Uncommon | 20% |
| Rare | 30% |
| Epic | 22% |
| Legendary | 12.5% |
| Mythic | 0.5% |

- [x] Confirm or revise the normal deep distribution through simulations/playtesting.

### Single-rarity Convergence encounters

- [x] Add one generic, seeded Rarity Convergence modifier rather than separate encounter
  implementations for every rarity.
- [x] Keep most floors as normal mixed encounters.
- [x] Allow Convergence on 25% of floors starting at floor 10; keep the value
  configurable for later balance tuning.
- [x] Let Common, Uncommon, Rare, Epic, and Legendary be eligible Convergence rarities.
- [x] Keep Mythic out of ordinary Convergence unless this plan is explicitly revised.
- [x] Force every enemy generated for that encounter to the selected rarity.
- [x] Ensure next-enemy previews and actual enemy generation produce the same seeded
  Convergence result.
- [x] Attach explicit encounter metadata instead of inferring Convergence from an
  accidentally homogeneous random team.

### Convergence Terror compensation

- [x] Treat bonus power as a hostile encounter aura, not a permanent property of the
  collectible demon.
- [x] Compute bonus Terror from floor target power and selected rarity rather than using
  one fixed bonus at every depth.
- [x] Give Common the largest compensation, then progressively less for Uncommon, Rare,
  Epic, and Legendary.
- [x] Keep enough natural variation that higher-rarity encounters can still feel more
  threatening; do not normalize every encounter into perfect sameness without testing.
- [x] Remove the temporary compensation when an enemy becomes a player recruit/reward.
- [x] Show normal permanent/base stats in extraction and Bag contexts.
- [x] If a Convergence is intentionally harder than the ordinary floor target, add an
  explicit reward bonus; do not silently increase risk without compensation.

## Dungeon difficulty without all-Mythic teams

- [x] Make floor depth and Terror the primary endless difficulty axes.
- [x] Preserve the existing enemy-team-size ramp to nine unless simulations show it
  needs adjustment.
- [x] Recalibrate base Terror after changing the deep rarity mixture.
- [x] Preserve or intentionally revise the existing additional enemy pressure from
  active Pacts.
- [x] Verify HP, Attack, and Speed curves independently; Speed must retain a safe cap.
- [x] Avoid hidden per-card stat forgery: communicate temporary encounter pressure as
  Terror/Surge.
- [x] Add deterministic balance simulations across representative floors and player
  teams before accepting the final curve.
- [x] Verify expected encounter power increases over time and that endless runs
  eventually overwhelm plausible player teams.
- [x] Test milestone floors at minimum: 1, 3, 5, 10, 15, 18, 20, 25, 30, 35, and 40+.
- [x] Compare the redesigned floor-30+ power budget against the current Mythic-heavy
  baseline rather than assuming rarity diversity is automatically balanced.

Historical calibration notes from the brainstorm:

- The tentative mixed deep pool averages about a `1.23x` rarity stat multiplier.
- Mythic currently uses about `1.70x`.
- Matching the old raw Mythic-heavy budget would therefore begin near
  `1.70 / 1.23 = 1.38x` additional compensation before combat simulation adjustments.
- An all-Common Convergence matching the tentative mixed pool begins near `1.23x`
  temporary encounter power, again subject to nonlinear combat testing.

## Rarity-targeted Demonic Pacts

- [x] Extend Pact effect normalization to preserve a server-validated rarity target or
  target list.
- [x] Apply initial rarity targeting only to contained, straightforward stat effects
  such as HP, Attack, and Speed.
- [x] Calculate targeted stat effects per demon rather than once globally per team.
- [x] Ensure existing untargeted Pacts retain identical behavior.
- [x] Ensure player rarity Pacts do not unintentionally buff enemies.
- [x] Add two or three initial rarity Pacts for playtesting rather than attempting a
  complete Pact rewrite.
- [x] Make low-rarity bonuses strong enough to create a real recruitment decision while
  respecting stat and Speed safety limits.
- [x] Write descriptions that name every affected rarity and exact bonus.
- [x] Show eligibility/effect previews correctly on current team and recruitment UI.
- [x] Verify accepting a rarity Pact remains useful because normal deep pools and
  Convergences continue producing eligible recruits.
- [x] Do not add complex effects such as double-triggering unique card traits in this
  implementation.

## Encounter presentation

- [x] Render Convergence as a separate pill immediately to the right of the existing
  Terror pill, for example `[Terror 22] [Rare Host +4]`.
- [x] Distinguish the Convergence pill with its rarity color and an icon; do not rely on
  color alone.
- [x] Keep base Terror and temporary Convergence bonus separate rather than displaying
  one unexplained combined number.
- [x] Add a brief non-modal entrance announcement when a Convergence floor loads.
- [x] Use only a short initial pulse/animation; do not leave a continuously distracting
  animation running.
- [x] Add a mouse, keyboard, and touch-accessible tooltip explaining selected rarity,
  temporary bonus, affected stats, and expiration after the fight.
- [x] Ensure the enemy heading and pills fit or compact gracefully on narrow mobile.
- [x] Reuse the existing enemy-buff-chip rendering path where possible.

## Compatibility and migration audit

- [x] Existing players retain all currently summoned collection demons.
- [x] Existing collection training progress and profile demon references remain intact.
- [x] Starter/onboarding collection behavior remains functional.
- [x] Public hunter profiles, world teams, PvP, world hunts, and collection sorting keep
  reading permanent demons only.
- [x] Existing active runs can be serialized, previewed, fought, recruited from, and
  cashed out after deployment.
- [x] Guest/auth behavior remains unchanged and every mutation requires authentication.
- [x] Daily quests and achievements use deliberate Echo-versus-summon semantics.
- [x] Leaderboards and account progression remain unaffected except for intended
  cashout payouts.
- [x] No route or UI assumes every extraction response contains a newly owned demon.

## Automated tests

### Bag and Echoes

- [ ] Bag read returns only the authenticated player's item stacks.
- [ ] Extraction increments exactly one correct type/rarity Echo.
- [ ] Carry depth never changes the awarded Echo count.
- [ ] Duplicate extraction remains allowed after summoning.
- [ ] Skip-Echo cashout grants no Echo and still settles allowed run rewards.
- [ ] Natural extraction records discovery; refinement does not.
- [ ] Refinement rejects insufficient quantity, wrong species, skipped tiers, invalid
  rarity, and Mythic-as-source upgrades. (2026-07-20: an undiscovered target rarity is
  no longer rejected.)
- [ ] Successful refinement consumes and creates exact configured quantities atomically.
- [ ] Summoning rejects insufficient Echoes and an already-owned slot.
- [ ] Successful summoning consumes only the requirement, preserves surplus, creates
  minimum stats, and triggers collection checks.
- [ ] Concurrent requests cannot create negative stacks or duplicate demons.
- [ ] Existing player collections and starter grants remain valid.

### Dungeon generation and difficulty

- [x] Low rarities remain possible at deep floors.
- [x] Normal deep floors are not guaranteed Mythic.
- [x] Convergence selection is deterministic for a run seed and floor.
- [x] Convergence generates only the selected rarity.
- [x] Previewed and actual encounters match in a serialization regression test.
- [x] Convergence compensation is temporary and absent from recruited/base reward stats.
- [x] Terror and active-Pact pressure remain monotonic and capped where required.
- [x] Simulations cover normal mixed and every eligible Convergence rarity.

### Pacts and UI regressions

- [x] Targeted Pact stats apply only to eligible player demons.
- [x] Untargeted Pact tests remain unchanged.
- [x] Multiple targeted and untargeted Pacts stack according to existing rules.
- [ ] Bag sorting/filtering/action state has focused client tests where practical.
- [ ] Cashout, collection, navigation, alerts, and responsive UI tests are updated.
- [x] The complete existing test suite passes.

## Manual QA

- [ ] Extract the first natural Echo of an unowned Rare and a higher rarity. Common was
  verified end to end on a disposable guest.
- [x] Verify extraction copy clearly says Bag progress, not permanent ownership.
- [x] Refine an eligible Echo and verify both stacks update without reload.
- [ ] Attempt every locked/invalid refinement state and confirm useful explanations.
  Insufficient quantity was verified. (2026-07-20: the undiscovered-target lock was
  removed by design revision.)
- [ ] Summon with surplus quantity. Exact-quantity summoning was verified end to end.
- [x] Verify the summoning celebration and `View in Collection` action.
- [ ] Extract another Echo after summoning and confirm it is banked, not blocked.
- [x] Verify missing Collection slots show correct lightweight progress.
- [ ] Play normal deep floors and confirm Common/Uncommon/Rare recruits remain available.
- [ ] Play every Convergence rarity and verify the pill, tooltip, announcement, temporary
  stats, recruitment stats, and Echo identity.
- [ ] Verify rarity-targeted Pacts before and after recruiting matching demons.
- [ ] Verify dungeon difficulty at milestone floors with and without strong Pacts.
- [ ] Verify a complete desktop keyboard and mobile touch pass. Representative desktop
  clicks, mobile extraction, and responsive snapshots were verified.
- [x] Check narrow mobile layouts for navigation, pills, grid, detail panel, and actions.

## Documentation and final completion gate

- [x] Update README routes, API endpoints, database tables, Dungeon Runs, Demonic Pacts,
  Collection, and Bag documentation.
- [x] Document the authoritative summoning/refinement configurations.
- [x] Document migration/compatibility behavior for existing players and starter demons.
- [x] Remove stale documentation saying extraction saves one permanent demon.
- [ ] Review this file line by line and resolve every remaining release-verification checkbox.
- [x] Run the full automated test suite and record/fix all failures.
- [ ] Complete the remaining desktop and mobile manual QA listed above.
- [x] Inspect the final git diff for accidental unrelated changes or secrets.
- [x] Confirm the implemented behavior still matches the Goals and Explicit non-goals.
- [ ] Delete this file only after every required implementation and verification item
  above is complete.

## Decision log

- 2026-07-19: Replace whole-demon dungeon extraction with exact type/rarity Echoes.
- 2026-07-19: Award exactly one Echo per extraction; carrying deeper gives no bonus.
- 2026-07-19: Create a dedicated `/bag` item grid and keep `/collection` focused on
  permanently summoned demons.
- 2026-07-19: Never block extraction because a demon is already summoned; bank surplus.
- 2026-07-19: Use same-species, one-tier refinement gated by first natural discovery.
- 2026-07-19: Drop unique skills for all variants, Dominion, and a full squad-archetype
  system from this project.
- 2026-07-19: Keep lower rarities available at depth and add occasional generic
  single-rarity Convergence encounters.
- 2026-07-19: Use a separately presented temporary Terror bonus to keep lower-rarity
  Convergences dangerous.
- 2026-07-19: Recalibrate Terror/team-size difficulty instead of relying on all-Mythic
  late enemy teams.
- 2026-07-19: Lock the first-release thresholds, refinement costs, deep rarity pool,
  25% floor-10+ Convergence rate, rare normal Mythic roll, and three rarity Pacts after
  deterministic milestone simulation.
- 2026-07-19: Core desktop/mobile flow was verified on a disposable guest: extract a
  Common Echo, inspect Bag, summon it, see it in Collection, refine a seeded
  3-to-1 stack, and inspect both quantity and natural-discovery lock states.
- 2026-07-20: Remove the natural-discovery gate on refinement. Refining into the next
  rarity requires only enough source Echoes; the player chooses freely between banking
  for a summon and refining, and never has to summon or re-extract first. The gate
  felt arbitrary in practice — notably for the free type 1 starter line, whose owner
  had never "naturally extracted" anything. Discovery history is still recorded for
  extraction provenance display.
- 2026-07-19: Revise Bag presentation to a viewport-filling decorative slot grid.
  Empty slots do not create capacity; scrolling begins only after the visible grid is
  full. Slots use a larger artwork-forward footprint, item copy appears in a World-style
  interaction tooltip, and rarity is represented by a top-left diamond.
