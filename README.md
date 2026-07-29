# Among Demons

Among Demons is a server-authoritative demon-collection game built with Node.js/Express and MySQL. The frontend is static HTML/CSS/vanilla JavaScript served from `public/app` (the world map renders with Pixi.js); public marketing/catalog pages are server-rendered for SEO. All gameplay outcomes - combat, RNG, rewards, XP, Souls, movement, and collection writes - are calculated on the server. The browser only displays state and stages player choices.

## Game Overview

The game has two connected play spaces plus permanent progression:

- **Dungeon runs** (`/dungeon`) - roguelite runs through unlimited floors. Draft two starting demons, auto-battle server-simulated fights, recruit defeated enemies, seal run-long Demonic Pacts, and extract with XP/Souls and one exact Demon Echo - or lose everything on defeat.
- **World map** (`/world`) - a 101×101 tile overworld with roads, unpassable terrain, demon encounters, Forsaken Shrines, and Darkness Portals. Travel tile-by-tile (roads are far safer from ambushes), fight fixed encounter teams, leave a team passively hunting for Souls, and challenge other hunters standing on your tile to PvP.
- **Permanent progression** - an Echo bag and summoning flow (`/bag`), a permanent demon collection with Soul-based training (`/collection`), an account skill tree fed by level-up stat points (`/skill-tree`), daily quests and a daily reward (`/camp`), public hunter profiles (`/hunter/:username`), and leaderboards (`/rankings`).

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Server | Express 4, `compression` |
| Database | MySQL via `mysql2/promise` |
| Config | `dotenv` |
| Frontend | Static HTML, vanilla JavaScript |
| World rendering | Pixi.js 8 (served from `/vendor/pixi`) |
| Styling | Custom CSS (split per page), Lucide icon subset |
| Tests | Node built-in test runner (`node --test`) |
| Asset tooling | `sharp` (dev dependency, WebP generation) |

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env` in the project root:

```txt
DB_HOST=your_mysql_host
DB_PORT=3306
DB_NAME=your_database
DB_USER=your_user
DB_PASSWORD=your_password
PORT=3000
```

Optional OAuth sign-in (Google, Discord) is enabled by adding credentials:

```txt
OAUTH_REDIRECT_ORIGIN=https://amongdemons.com

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

The callback URLs registered with each provider should be `https://your-domain.com/api/auth/oauth/google/callback` and `https://your-domain.com/api/auth/oauth/discord/callback` (use `http://localhost:3000` for local development). Set `OAUTH_REDIRECT_ORIGIN` when the public callback origin differs from the request host. Provider review screens can use `https://amongdemons.com/privacy` and `https://amongdemons.com/terms` as policy URLs.

Start the server and open `http://localhost:3000`:

```bash
npm run dev   # with nodemon restarts
npm start     # plain node
```

The database schema is created automatically on first API use - `public/api/lib/schema.js` creates missing tables and performs additive schema checks against older local databases.

## NPM Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm start` | `node server.js` | Start the Express server |
| `npm run dev` | `nodemon server.js` | Start with automatic restarts |
| `npm test` | `node --test test/*.test.js` | Run the unit test suite |

## Project Structure

```txt
amongdemons.com/
|-- server.js                 # Express app: SEO pages, app pages, static serving, caching
|-- lib/
|   `-- seo-pages.js          # Server-rendered home, demon catalog, sitemap, robots.txt
|-- public/
|   |-- api/                  # Express API (mounted at /api)
|   |   |-- account/          # Profile, progression, skill-tree points, daily quests
|   |   |-- auth/             # Register, login, OAuth, session profile
|   |   |-- demons/           # Permanent collection list/show/train
|   |   |-- runs/             # Dungeon run lifecycle endpoints
|   |   |-- game/             # Public static game-data endpoints
|   |   |-- world.js          # World map, movement, shrines, portals, hunting, PvP
|   |   |-- hunters.js        # Public hunter profile endpoint
|   |   |-- leaderboard.js    # Rankings endpoint
|   |   |-- data/             # Source game data JSON (types, demons, pacts, world map)
|   |   `-- lib/              # Shared backend modules (combat, rules, db, schema, ...)
|   |-- app/                  # Static frontend (HTML pages, css/, js/, images/)
|   |-- android/              # Capacitor Android wrapper (separate git repo, ignored)
|   `-- steam/                # Electron Steam wrapper (separate git repo, ignored)
|-- scripts/                  # Asset/data generators (world map, icons, WebP, CSS split)
`-- test/                     # node:test unit tests
```

`public/android` and `public/steam` are separate wrapper repositories (Capacitor and Electron respectively) and are excluded from this repo via `.gitignore`; each has its own README.

## Web Routes

| Route | Description |
| --- | --- |
| `/` | Server-rendered public landing page |
| `/demons`, `/demons/:slug` | Server-rendered public demon catalog and per-demon guides |
| `/bosses`, `/bosses/:id` | Server-rendered world boss catalog and JSON-backed encounter guides |
| `/camp` | Authenticated hub: progression, current run briefing, daily quests, quick actions |
| `/world` | World map exploration (Pixi.js) |
| `/dungeon` | Dungeon run UI |
| `/bag` | Stackable item bag with Echo refinement and summoning |
| `/collection` | Collection browser with filters, sorting, missing slots, and Soul training |
| `/skill-tree` | Account stat-point skill tree |
| `/settings` | Audio, battle, username, sign-in, password, and account deletion settings |
| `/hunter/:username` | Public hunter profile |
| `/login`, `/register` | Auth pages |
| `/rankings`, `/rankings/:sort` | Leaderboards; sorts: `floor`, `level`, `souls`, `pvp` (`/rank` and `/hunter` redirect here) |
| `/privacy`, `/terms` | Policy pages |
| `/robots.txt`, `/sitemap.xml` | Generated SEO endpoints |

`server.js` also enforces the canonical host/HTTPS with 301 redirects and sets `X-Robots-Tag: noindex` on API routes and authenticated app pages.

## Authentication

Most gameplay endpoints require an authenticated player. Send either header:

```txt
Authorization: Bearer <token>
x-player-token: <token>
```

`POST /api/auth/register` creates an account; `POST /api/auth/login` logs in (and, for prototype convenience, creates the account when the username does not exist). Passwords use PBKDF2-SHA512 with per-user salts; session tokens live in `player_sessions`.

Google and Discord sign-in flow through `/api/auth/oauth/:provider`. Provider identities are stored in `player_oauth_accounts`; a verified provider email matching an existing password account links to it, otherwise a new player is created with a generated username.

The frontend stores the token and cleaned player object in `localStorage` under the key `amongdemons-session`.

## API Endpoints

All routes are mounted under `/api`.

### Auth

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a player account and session |
| `POST` | `/auth/login` | Log in, or create a prototype account if missing |
| `GET` | `/auth/oauth/providers` | OAuth provider availability for the login/register UI |
| `GET` | `/auth/oauth/:provider` | Start Google or Discord OAuth sign-in |
| `GET/POST` | `/auth/oauth/:provider/callback` | Complete OAuth sign-in and create a session |
| `GET` | `/auth/me` | Return the authenticated player and authoritative progression summary |

### Account

| Method | Route | Description |
| --- | --- | --- |
| `PATCH` | `/account/profile` | Update username and/or profile demon |
| `GET` | `/account/security` | Password, provider connection, and pending deletion state |
| `POST` | `/account/oauth/:provider/connect` | Start authenticated Google or Discord account linking |
| `DELETE` | `/account/oauth/:provider` | Disconnect Google or Discord when another sign-in method remains |
| `PUT` | `/account/password` | Set or change the account password and revoke other sessions |
| `POST` | `/account/deletion` | Schedule permanent account deletion after a seven-day grace period |
| `DELETE` | `/account/deletion` | Cancel a pending account deletion |
| `GET` | `/account/progression` | Level, XP, Souls, and unlocks |
| `GET` | `/account/stat-points` | Skill-tree summary: points earned, allocations, node states |
| `POST` | `/account/stat-points` | Allocate a stat point to a skill-tree node |
| `POST` | `/account/stat-points/reset` | Refund all allocations for Souls (10 per spent point) |
| `GET` | `/account/quests` | Daily quest and daily reward state |
| `POST` | `/account/quests/:questId/claim` | Claim a completed daily quest |
| `POST` | `/account/daily-reward/claim` | Claim the daily Souls reward |
| `GET` | `/camp/bootstrap` | Consolidated camp player, progression, quests, skill points, and collection state |

### Collection

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/demons` | List owned permanent demons |
| `GET` | `/demons/:id` | Return one owned permanent demon |
| `POST` | `/demons/:id/train` | Spend Souls to train one demon server-side |
| `GET` | `/collection/bootstrap` | Consolidated player, collection, and Echo bag state |

### Bag

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/bag` | Read owned item stacks, Echo recipes, discovery state, and action availability |
| `POST` | `/bag/echoes/refine` | Convert same-species Echoes into one Echo of the adjacent rarity |
| `POST` | `/bag/echoes/summon` | Consume exact Echoes and summon the permanent minimum-stat demon |

### Dungeon Runs

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/runs/bootstrap` | Consolidated player, skill points, collection, current run, and start options |
| `GET` | `/runs/start-options` | Six draft starters, a signed short-lived draft token, and the collection |
| `POST` | `/runs/start` | Start a run from two draft or collection demons |
| `GET` | `/runs/current` | The player's active or defeated-pending run |
| `GET` | `/runs/:id` | One run owned by the player |
| `POST` | `/runs/:id/formation` | Update front/back positions before battle |
| `POST` | `/runs/:id/battle` | Simulate the next battle server-side and return the canonical updated run |
| `POST` | `/runs/:id/buff` | Choose one pending Demonic Pact |
| `POST` | `/runs/:id/buff/reroll` | Recast the pact choices for 10 Souls |
| `POST` | `/runs/:id/reward` | Mark a reward as claimed |
| `POST` | `/runs/:id/recruit` | Stage or commit recruitment, advance, and return the canonical updated run |
| `POST` | `/runs/:id/cashout` | Extract one eligible demon as an exact Echo and claim earned XP/Souls |
| `POST` | `/runs/:id/end` | Finalize a defeated run with zero payout |

### World

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/world/map` | Static map layout (immutable-cached, keyed by content hash) |
| `GET` | `/world/state` | Per-player world state: position, team, shrine, hunt, players nearby |
| `POST` | `/world/move` | Move along a validated path; resolves ambushes and banks victory XP/Souls |
| `GET/POST` | `/world/team` | Read or save the active world team |
| `GET` | `/world/shrine` | Current bound Forsaken Shrine and whether standing on one |
| `POST` | `/world/shrine/bind` | Bind to the Forsaken Shrine at the current position |
| `POST` | `/world/portal/summon` | Spend Souls to teleport to a Darkness Portal (cost scales with distance) |
| `POST` | `/world/hunt/try` | Fight the encounter on the current tile; a loss respawns at the bound shrine |
| `POST` | `/world/hunting/start` | Start passive hunting on a defeated encounter |
| `POST` | `/world/hunting/claim` | Bank hunt rewards and atomically restart the same hunt |
| `POST` | `/world/hunting/stop` | Stop hunting and bank the accumulated Souls |
| `GET` | `/world/hunting/status` | Current passive hunt progress |
| `POST` | `/world/ambush-defeat` | Return to the Anchored Shrine (or spawn) after a separately resolved defeat |
| `GET` | `/world/players-at` | Other hunters standing on a tile |
| `POST` | `/world/challenge` | Challenge another hunter on your tile to PvP (30 s cooldown) |

### Public Data and Rankings

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/game/demon-types` | Demon type, role, stat, targeting, and ability data |
| `GET` | `/game/demons` | Demon asset mappings |
| `GET` | `/game/catalog` | Combined, versioned, immutable-cacheable demon types and asset mappings |
| `GET` | `/hunters/:username` | Public hunter profile (level, floor, PvP record, position) |
| `GET` | `/leaderboard?sort=floor\|level\|xp\|souls\|pvp\|ranked` | Up to 100 ranked players |

## Game Systems

### Dungeon Runs

- Runs start with exactly 2 demons chosen from six HMAC-signed draft starters (token expires after 15 minutes) and/or the permanent collection. Starting a new run closes any open run.
- The team limit is `min(6, floor + 1)`: 2 demons on floor 1, capped at 6 from floor 5 onward. Enemy teams keep scaling deeper.
- After clearing floor 10, the player may call in one collection demon as a one-time reinforcement.
- After every win, defeated enemies become recruit options; between fights the player can recruit, swap, skip, or stage one eligible demon for Echo extraction. Extraction unlocks after the first win.
- Enemy rarity uses explicit floor-band distributions. Deep normal floors keep Common, Uncommon, and Rare at non-zero rates, while Mythic remains an exceptional `0.5%` roll rather than becoming the whole late-game roster.
- From floor 10 onward, a seeded 25% roll may create a Rarity Convergence: every enemy is Common, Uncommon, Rare, Epic, or Legendary. Its temporary Host pressure is shown in a separate rarity-colored pill beside Terror and is removed from recruits.
- Floor depth, enemy-team growth (up to nine), rarity compensation, and active Pact count drive hostile Terror. The redesigned floor-30 HP budget is calibrated to the former Mythic-heavy curve without requiring nine Mythics.
- Extraction grants accumulated XP/Souls and exactly one Echo of the selected type and rarity. Carrying farther never increases that count; skipping the Echo remains valid. Losing grants 0 XP, 0 Souls, and no Echoes regardless of staged rewards.
- Account levels use total-XP thresholds of `250 * (level - 1)^1.65`; payouts never reduce a stored level.

### Demonic Pacts

Run-long modifiers defined in `public/api/data/combat-buffs.json` and managed by `public/api/lib/combat-buffs.js`:

- Every third cleared floor offers three rarity-weighted pact choices; a pending offer blocks battle, recruitment, and extraction until resolved.
- Recasting an offer costs 10 Souls and excludes the current choices (`409` if no alternates exist).
- The same pact can appear in later offers and duplicates stack through the same effect pipeline.
- Effects cover run stats, direct/AOE damage, retaliation, poison, healing, shields, death triggers, and temporary team size. Three contained Pacts target demon rarities: Common/Uncommon, Rare, and Epic/Legendary. Target checks happen per player demon and do not buff enemies.
- Original run base stats are preserved so recruits and extracted Echo identities never keep Pact, Terror, or Convergence scaling.

### World Exploration

The world is a generated 101×101 grid (coordinates −50..50) defined in `public/api/data/map.json`: roads, typed unpassable blocks (`rocks`, `poison`, `lava`, or `leaves`), fixed demon-team encounters, and event objects (shrines, portals). The layout is identical for every player, so `/world/map` is served immutable-cached and keyed by a content hash; `/world/state` carries only per-player data.

Each fixed monster spot has a unique demon composition. Demon rarity and type retain their inherent stats, while World Terror is the single explicit distance-based encounter multiplier.

Crowley, the traveling merchant, moves to a deterministic open road tile every 30 minutes and refreshes his stock when he moves.

- Movement is validated server-side step by step (up to 256 steps per request). Off-road steps on empty tiles risk ambushes (~1 in 7); roads are much safer (~1 in 34). Each ambush victory grants the encounter's XP and Soul payout, summarized when travel ends.
- World Terror rises one level per map ring beyond the safe center (starting ~10 tiles out, capped at level 40), scaling encounter stats and XP with distance.
- **Forsaken Shrines** - bind your soul at a shrine to respawn there after combat defeats instead of at world spawn.
- **Darkness Portals** - paid teleports; the Soul cost scales with distance.
- **Passive hunting** - after defeating a tile's encounter you may leave your world team hunting there. Souls accumulate while away but are capped by your Soul Vessel (base 50, expanded through skill-tree nodes), so AFK income is bounded by investment, not time.
- **PvP** - hunters on the same tile can challenge each other (server-simulated battle, 30-second cooldown); wins and losses feed the `pvp` leaderboard and hunter profiles.

### Skill Tree

Players earn one stat point per account level (level − 1 total). Nodes are defined in `public/api/lib/account-stat-points.js`:

- Branches for Health, Healing, Thorns, Speed, Attack, AOE, Poison, and Soul Vessel: a flat node (cap 5) unlocks a percent node (cap 5), which unlocks an uncapped "Endless" mastery node.
- Allocations translate into pre-battle combat buffs applied server-side (`player-combat-buffs.js`).
- A full reset refunds all points for 10 Souls per spent point.

### Daily Quests

Defined in `public/api/lib/daily-quests.js` with a UTC daily reset: win 3 dungeon fights, extract a Demon Echo, complete "Trial of the Few" (win at floor 3+ with an open team slot), win a PvP challenge, and start a world hunt, plus a claimable daily Souls reward. Rewards scale with account level.

### Echo Bag, Summoning, and Collection

- Dungeon extraction adds one exact `type + rarity` Echo stack to Bag; it never directly creates or replaces a permanent demon. Echoes may continue accumulating after that slot is summoned.
- Summoning requirements are Common `1`, Uncommon `2`, Rare `3`, Epic `5`, Legendary `8`, and Mythic `12`. Summoning atomically consumes only the requirement and creates the normal minimum-stat permanent demon; surplus remains banked.
- Refinement stays within one species and advances one adjacent tier: Common→Uncommon costs `3`, Uncommon→Rare `3`, Rare→Epic `4`, Epic→Legendary `5`, and Legendary→Mythic `6`. Refining requires only enough source Echoes - the player freely chooses to refine or bank, regardless of whether the target rarity was previously extracted or summoned. Mythic surplus remains banked.
- The permanent collection has one slot per demon type and rarity - 11 types × 6 rarities = 66 slots. Missing slots can show their exact Echo progress and link back to Bag.
- Training (`POST /api/demons/:id/train`) is transactional and server-authoritative: it locks the player and demon rows, checks cost, spends Souls, and raises one stat by +1, picked with weighted randomness from stats below their caps.
- Stat caps come from the matching type's `baseStats` maxima in `demon-types.json`. Cost starts at 2 Souls and grows with overall progress toward the caps, multiplied by rarity.

Existing permanent demons and their training remain untouched. The automatically granted onboarding starter is intentionally still a direct collection grant. Natural discovery is stored separately from stack quantity as extraction history (shown as the Echo's source in Bag) and remains recorded after a stack is spent.

### Combat

Combat is automatic and simulated in `public/api/lib/combat.js` (all battle types - dungeon, world encounter, ambush, PvP - share the same simulator):

- Living demons gain `attackMeter += speed` per tick and act when the meter reaches 100; battles end when one side is wiped or after a 1000-tick safety limit.
- Front-row targeting prefers living front-row enemies, falling back to any living enemy.
- Ability kinds include `basic_attack`, `heavy_attack`, `ranged_execute`, `fast_execute`, `aoe_attack`, `slow_crushing_attack` (with a rare knockback that shoves the target one row back or swaps slots), stacking `poison`, `heal` (most-missing-HP ally), `retaliate` (thorns), and `chaotic_attack`.
- Team state is cloned for simulation and persisted from the result; the API returns a combat log plus before/after snapshots for UI replay.

## Static Data and Assets

Files in `public/api/data` are source game data - API code reads them at runtime and must not mutate them.

| File | Contents |
| --- | --- |
| `demon-types.json` | 11 demon types: roles, base stat ranges, targeting, abilities, spawn weights |
| `demons.json` | 66 demon asset/species mappings |
| `world-bosses.json` | World boss identities, teams, taunts, battle buffs, and rewards |
| `combat-buffs.json` | 23 Demonic Pact definitions, including three rarity-targeted Pacts |
| `map.json` | Generated world map: bounds, spawn, roads, blocks, encounters, events |

Demon art lives in `public/app/images/demons` (full PNGs for battle cards, generated WebP variants for map tokens, thumbnails for lists). Rarity tiers are `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`.

## Database

Tables are created on first API use by `public/api/lib/schema.js`:

| Table | Purpose |
| --- | --- |
| `players` | Credentials, deletion schedule, level, XP, Souls, PvP record, profile demon, unlocks |
| `player_sessions` | Bearer/session tokens with expiration |
| `player_oauth_accounts` | Linked Google/Discord identities |
| `oauth_states` | Short-lived OAuth CSRF state |
| `player_stat_points` | Skill-tree allocations |
| `player_demons` | Permanent owned demon collection |
| `player_bag` | Generic per-player item stacks, initially exact Demon Echoes |
| `player_echo_discoveries` | Permanent natural type/rarity extraction history |
| `player_world_positions` | Server-side world coordinates |
| `player_bound_world_shrines` | Anchored Forsaken Shrine return points |
| `player_hunt_unlocks` | Encounters defeated at least once (hunting eligibility) |
| `player_active_hunts` | Active passive-hunt snapshots |
| `player_world_teams` | Saved world battle teams |
| `player_daily_quests` | Per-day quest progress and claims |
| `runs` | Dungeon state, rewards, combat history, status (state stored as JSON text) |

## Frontend Modules

| File | Purpose |
| --- | --- |
| `public/app/js/session.js` | Session storage and authenticated API helper |
| `public/app/js/api-config.js` | API base configuration |
| `public/app/js/auth-ui.js` | Login and register forms (password + OAuth) |
| `public/app/js/camp-ui.js` | Camp hub: progression, run briefing, daily quests, quick actions |
| `public/app/js/world-ui.js` | Pixi.js world map: movement, shrines, portals, hunting, PvP |
| `public/app/js/dungeon.js` + `public/app/js/dungeon/` | Dungeon UI modules: battle replay, drag/drop, recruitment, pacts, rewards |
| `public/app/js/bag-ui.js` | Bag grid, sorting, Echo details, refinement, and summoning |
| `public/app/js/collection-ui.js` | Collection filters, sorting, missing slots, training modal |
| `public/app/js/skill-tree-ui.js` | Skill-tree allocation UI |
| `public/app/js/settings-ui.js` | Audio, battle, username, sign-in, password, and deletion settings |
| `public/app/js/hunter-ui.js` | Public hunter profile page |
| `public/app/js/rankings-ui.js` | Leaderboard UI |
| `public/app/js/demon-cards.js` | Shared demon card rendering |
| `public/app/js/navigation.js` | Shared navigation |
| `public/app/js/lucide-subset.js` | Generated icon subset (see scripts) |

CSS is split per page - `base.css` loads everywhere; `battle.css`, `camp.css`, `collection.css`, `bag.css`, `skill-tree.css`, and `world.css` load only where needed.

## Backend Modules

| File | Purpose |
| --- | --- |
| `public/api/lib/auth.js` | Password hashing, tokens, auth middleware |
| `public/api/lib/oauth.js` | Google/Discord OAuth flows |
| `public/api/lib/usernames.js` | Username validation/normalization and OAuth-safe candidates |
| `public/api/lib/progression.js` | Account level/XP curve |
| `public/api/lib/account-stat-points.js` | Skill-tree nodes, caps, Soul Vessel capacity, resets |
| `public/api/lib/daily-quests.js` | Daily quest definitions, progress, rewards |
| `public/api/lib/combat.js` | Server-side combat simulator |
| `public/api/lib/combat-buffs.js` | Demonic Pact loading, stacking, rerolls, effect pipeline |
| `public/api/lib/player-combat-buffs.js` | Skill-tree allocations → pre-battle combat buffs |
| `public/api/lib/demon-factory.js` | Demon generation, rarity selection, stat rolls |
| `public/api/lib/echo-config.js` | Authoritative Echo keys, summoning thresholds, and refinement costs |
| `public/api/lib/echo-bag.js` | Echo catalog metadata, item serialization, discovery, and stack writes |
| `public/api/lib/demon-training.js` | Training caps, costs, stat rolls |
| `public/api/lib/dungeon-enemies.js` | Enemy pools, floor sizing, spawn pressure, scaling |
| `public/api/lib/dungeon-rules.js` | Team-size and reinforcement constants |
| `public/api/lib/world-combat.js` | World encounters, terror, hunts, ambushes, PvP simulation |
| `public/api/lib/world-shrines.js` | Forsaken Shrine lookup, binding, ambush returns |
| `public/api/lib/collection-demons.js` | Collection save helpers and stat normalization |
| `public/api/lib/run-demons.js` / `run-rewards.js` / `run-serialization.js` / `runs.js` | Run normalization, payouts, response shaping, persistence |
| `public/api/lib/game-data.js` | JSON game-data readers |
| `public/api/lib/rng.js` | Deterministic seeded RNG |
| `public/api/lib/db.js` | MySQL pool and `.env` loading |
| `public/api/lib/schema.js` | Table creation and additive schema checks |
| `public/api/lib/async-errors.js` | Express async error forwarding |
| `lib/seo-pages.js` | Server-rendered home/catalog pages, sitemap, robots.txt, canonical host |

## Maintenance Scripts

| Script | Purpose |
| --- | --- |
| `scripts/generate-world-map.js` | Regenerates `public/api/data/map.json` (roads, blocks, encounters, events) |
| `scripts/generate-lucide-subset.js` | Rebuilds `lucide-subset.js` from icons actually referenced in HTML/JS |
| `scripts/generate-demon-map-variants.js` | Generates small WebP demon variants for map tokens and avatars |
| `scripts/split-main-css.js` | Re-runnable splitter that produced the per-page CSS files |
| `scripts/simulate-dungeon-balance.js` | Checks milestone pressure, deep rarity availability, all Convergences, and the old floor-30 baseline |

## Caching

In production (`NODE_ENV=production`), static assets are served with one-year immutable caching; HTML always revalidates. Because of this, **every JS/CSS reference in HTML must carry a `?v=` stamp, and the stamp must be bumped whenever the file changes**. The world map payload and demon catalog images are also immutable-cached, keyed by content. Caching is disabled outside production so local iteration never fights the cache.

## Testing and Development Checks

Run the unit tests (combat knockback, run rewards, stat points, username validation, world ambush rules, nav UI):

```bash
npm test
```

Run the deterministic dungeon balance report (optional argument: samples per milestone):

```bash
npm run simulate:dungeon -- 30
```

Syntax-check the server and all backend/frontend scripts (PowerShell):

```powershell
node --check server.js
Get-ChildItem -Recurse -Filter *.js public\api | ForEach-Object { node --check $_.FullName }
Get-ChildItem -Recurse -Filter *.js public\app\js | ForEach-Object { node --check $_.FullName }
```

Initialize or verify the database schema from the command line:

```bash
node -e "require('./public/api/lib/schema').initializeSchema().then(() => { console.log('schema ready'); process.exit(0); }).catch((error) => { console.error(error); process.exit(1); })"
```

## License

MIT. See [LICENSE](LICENSE).
