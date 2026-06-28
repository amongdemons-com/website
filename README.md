# Among Demons

Among Demons is a Node.js/Express prototype for a server-authoritative demon collection and dungeon-run game. The frontend is static HTML/CSS/vanilla JavaScript served from `public/app`; the backend is an Express API backed by MySQL.

The current loop is:

1. Register or log in.
2. Start a Dungeon with two demons chosen from six signed draft starters and/or your permanent collection.
3. Arrange the active team into front/back positions.
4. Run automatic server-simulated battles.
5. Recruit defeated demons into the temporary Dungeon team, skip recruitment, extract between fights, or continue to the next floor.
6. Seal Demonic Pacts after milestone wins, or recast the offered choices by spending Souls.
7. Keep pushing through unlimited floors while enemy Terror rises from dungeon depth and active pacts.
8. Extraction grants earned XP/Souls and optionally saves one eligible demon; losing grants 0 XP, 0 Souls, and 0 demons.
9. Spend Souls in `/collection` to train saved demons toward their type-specific stat caps.

Combat, RNG, reward generation, XP, Souls, run status, and collection writes are server-authoritative. The browser displays state and stages player choices, but it must not calculate gameplay outcomes.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Server | Express 4 |
| Database | MySQL via `mysql2/promise` |
| Config | `dotenv` |
| Frontend | Static HTML, vanilla JavaScript |
| Styling | Bootstrap 5, Lucide icons, custom CSS |

## Project Structure

```txt
amongdemons.com/
|-- public/
|   |-- api/
|   |   |-- account/          # Player progression endpoints
|   |   |-- auth/             # Register, login, session profile
|   |   |-- data/             # Source demon, asset, and Demonic Pact JSON
|   |   |-- demons/           # Permanent collection endpoints
|   |   |-- game/             # Public static game-data endpoints
|   |   |-- lib/              # Shared backend game/auth/db modules
|   |   `-- runs/             # Dungeon run endpoints
|   `-- app/
|       |-- css/
|       |-- images/
|       `-- js/
|-- api.md                   # Older planning notes
|-- idea.md                  # Original game design notes
|-- package.json
|-- README.md
`-- server.js
```

## Install And Run

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

Optional OAuth providers can be enabled by adding their credentials. The callback URLs configured with each provider should be:

```txt
https://your-domain.com/api/auth/oauth/google/callback
https://your-domain.com/api/auth/oauth/discord/callback
```

For local development, replace the domain with `http://localhost:3000`. Set `OAUTH_REDIRECT_ORIGIN` when the public callback origin differs from the request host.

Provider app review screens may also ask for policy URLs:

```txt
Privacy Policy URL: https://amongdemons.com/privacy
Terms URL: https://amongdemons.com/terms
```

```txt
OAUTH_REDIRECT_ORIGIN=https://amongdemons.com

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

Start the server:

```bash
npm run dev
```

Or run without nodemon:

```bash
npm start
```

Open `http://localhost:3000`.

## NPM Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `npm start` | `node server.js` | Start the Express server |
| `npm run dev` | `nodemon server.js` | Start with automatic restarts |

## Web Routes

| Route | Description |
| --- | --- |
| `/` | Public game landing page |
| `/demons` | Public demon collection catalog |
| `/demons/:slug` | Public demon detail guide |
| `/camp` | Authenticated player camp for progression, current run briefing, and quick actions |
| `/dungeon` | Main Dungeon run UI |
| `/login` | Login page |
| `/register` | Registration page |
| `/privacy` | Privacy policy for account, OAuth, and gameplay data |
| `/terms` | Terms of service for player accounts and gameplay |
| `/collection` | Full authenticated collection browser with filters, sorting, missing slots, and Soul-based demon training |
| `/summon` | Authenticated Souls/summon placeholder page |
| `/rank` | Redirects to `/rankings` |
| `/rankings` | Leaderboard sorted by highest conquered dungeon floor by default |
| `/rankings/souls` | Leaderboard page using the Souls sort |

## Authentication

Most gameplay API endpoints require an authenticated player. Send either:

```txt
Authorization: Bearer <token>
```

or:

```txt
x-player-token: <token>
```

`POST /api/auth/register` creates a new account. `POST /api/auth/login` logs in an existing account; for prototype convenience, it also creates an account when the username does not exist. Passwords use PBKDF2-SHA512 with per-user salts. Session tokens are stored in `player_sessions`.

Google and Discord sign-in use `/api/auth/oauth/:provider`. Provider identities are stored in `player_oauth_accounts`. If a provider returns a verified email matching an existing password account, the provider is linked to that account; otherwise a new player is created with a generated username.

The frontend stores the token and cleaned player object in `localStorage` under:

```txt
amongdemons-session
```

## API Endpoints

All API routes are mounted under `/api`.

### Auth

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/auth/register` | Create a player account and session |
| `POST` | `/auth/login` | Log in, or create a prototype account if missing |
| `GET` | `/auth/oauth/providers` | Return OAuth provider availability for the login/register UI |
| `GET` | `/auth/oauth/:provider` | Start Google or Discord OAuth sign-in |
| `GET/POST` | `/auth/oauth/:provider/callback` | Complete OAuth sign-in and create a player session |
| `GET` | `/auth/me` | Return the authenticated player |

### Account And Collection

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/account/progression` | Return level, XP, Souls, and unlocks |
| `GET` | `/demons` | List owned permanent demons |
| `GET` | `/demons/:id` | Return one owned permanent demon |
| `POST` | `/demons/:id/train` | Spend Souls to train one owned permanent demon server-side |

### Dungeon Runs

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/runs/start-options` | Return six draft starters, a short-lived signed draft token, and the player's collection |
| `POST` | `/runs/start` | Start a new Dungeon run from two draft or collection demons |
| `GET` | `/runs/current` | Return the player's current active or defeated pending run |
| `GET` | `/runs/:id` | Return one run state owned by the player |
| `POST` | `/runs/:id/formation` | Update front/back positions before battle |
| `POST` | `/runs/:id/battle` | Simulate the next battle server-side |
| `POST` | `/runs/:id/buff` | Choose one pending Demonic Pact for the run |
| `POST` | `/runs/:id/buff/reroll` | Recast the current Demonic Pact choices for 10 Souls |
| `POST` | `/runs/:id/reward` | Mark a reward as claimed |
| `POST` | `/runs/:id/recruit` | Stage or commit recruitment choices and advance to the next floor |
| `POST` | `/runs/:id/cashout` | Extract between fights, save one eligible demon, and claim earned XP/Souls |
| `POST` | `/runs/:id/end` | Finalize a defeated run with zero payout |

### Game Data And Rankings

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/game/demon-types` | Return demon type, role, stat, targeting, and ability data |
| `GET` | `/game/demons` | Return demon asset mappings |
| `GET` | `/leaderboard?sort=floor\|level\|xp\|souls` | Return up to 100 players sorted by highest floor, level, XP, or Souls |

## Dungeon Rules

- Starting options are generated as six choices from starter type IDs `1`, `2`, and `3`, with `common`, `uncommon`, or `rare` rarity.
- Draft starter choices are protected by an HMAC-signed token and expire after 15 minutes.
- Starting a new run closes any open runs for that player.
- New Dungeon runs start with exactly 2 demons.
- The active Dungeon team can contain up to 6 demons.
- The player can use permanent collection demons as starting Dungeon demons.
- The player team starts at 2 demons, then can grow by 1 per floor until it caps at 6 on floor 5.
- Floor 1 is an easier opener with 1 common enemy. Enemy teams are 3 demons on floor 2, 4 on floor 3, 5 on floor 4, and 6 from floor 5 onward. Only enemies continue scaling deeper: 7 enemies on floor 35, 8 on floor 40, and 9 on floor 45 onward.
- Floors 1 through 3 use the starter type pool; later floors unlock more types based on floor.
- Dungeons have no final floor; after each win the run pauses for recruitment/extraction, then advances to the next floor.
- From floor 4 onward, enemy generation applies spawn pressure that biases later floors toward higher type IDs and higher rarities while keeping each type's base `spawnWeight`. Spawn pressure eventually caps, but floors continue indefinitely.
- Enemy rarity bands tighten as floors deepen: legendary enemies start appearing on floor 10, mythic enemies start appearing on floor 15, and floor 30 onward rolls mythic enemies only.
- After clearing floor 10, the player may call in one collection demon as a one-time reinforcement while editing the team for the next floor.
- After every win, defeated enemies become recruit rewards.
- After every third cleared floor, the run offers three Demonic Pact choices before the player can recruit, continue, or extract.
- Between fights, the player may stage a whole team, recruit one demon, swap demons, skip recruitment, or extract.
- Extracting between fights saves one eligible new demon and grants accumulated XP/Souls.
- Losing immediately ends the run and grants 0 XP, 0 Souls, and 0 demons, regardless of rewards staged before the loss.
- Account levels use total XP thresholds of `250 * (level - 1)^1.65`; payout updates never reduce an already stored level.
- The permanent collection has one slot per demon type and rarity, for 66 total slots. Saving another demon with the same type and rarity replaces that slot.

## Demonic Pacts And Enemy Terror

Demonic Pacts are run-long modifiers loaded from `public/api/data/run-buffs.json` and managed by `public/api/lib/run-buffs.js`.

- Pact choices are generated with rarity weights of `common: 70`, `uncommon: 24`, and `rare: 6`.
- Each offer contains unique choices, but active pacts are intentionally not de-duplicated. The same pact can appear again in a later offer, and duplicate active pacts stack through the same effect pipeline as different pacts.
- Recasting a pending offer costs 10 Souls through `POST /api/runs/:id/buff/reroll`. The recast excludes the choices from the current offer and returns `409` if no alternate choices exist.
- Pending pacts block battle, recruitment, and extraction until one offered pact is chosen.
- Pact effects can modify run stats, direct damage, retaliation, AOE damage, poison, healing, shields, ally death triggers, enemy death splash, and temporary team size.
- Run stat buffs keep original run base stats in `runBaseMaxHp`, `runBaseAtk`, and `runBaseSpeed` so recruited enemies and saved demons do not accidentally keep temporary enemy or run scaling.

Enemy Terror is the permanent enemy scaling layer shown in the Dungeon UI near the enemy formation title as `Terror <level>`. Its tooltip uses the line `Demons grow stronger in darkness.` and lists each enemy stat bonus on its own line.

- Terror level is `max(0, floor - 18) + activePactCount`.
- Enemy HP multiplier is `1 + max(0, floor - 18) * 0.045 + activePactCount * 0.07`.
- Enemy Attack multiplier is `1 + max(0, floor - 18) * 0.04 + activePactCount * 0.055`.
- Enemy Speed multiplier is `min(1.85, 1 + max(0, floor - 18) * 0.012 + activePactCount * 0.02)`.
- Serialized runs include `enemyPressure` for the current floor and `nextEnemyPressure` for the next enemy preview.
- Enemy Terror is applied only to generated enemy teams; if an enemy is recruited, `resetRunDemon` strips the enemy scaling fields before the demon joins the player team.

## Collection Training Rules

- Training is available from `/collection` for owned permanent demons only.
- Training is server-authoritative through `POST /api/demons/:id/train`; the route locks the player row and demon row in one transaction before checking cost, spending Souls, and updating stats.
- Each training action can increase one trainable stat by `+1`. The stat is picked with weighted randomness from stats that are not capped, weighted by remaining room to grow.
- Stat caps come from the matching type's `baseStats` maximum in `public/api/data/demon-types.json`. For example, if a type has `"hp": [58, 74]`, a saved demon of that type can train HP only up to `74`.
- Training cost starts at 2 Souls and increases as the demon approaches its caps. The cost curve uses overall progress toward all stat caps plus a rarity multiplier.
- The train button is hidden when all stats are maxed. The modal shows current/max stat progress, the next training cost, and a delayed particle/result animation when training completes.

## Combat Rules

Combat is automatic and simulated in `public/api/lib/combat.js`.

- Living demons gain `attackMeter += speed` each tick.
- When `attackMeter >= 100`, the demon acts and the meter resets.
- Battles stop when one side has no living demons, or after the 1000 tick safety limit.
- Front-row targeting prefers living front-row enemies and falls back to any living enemy.
- Chu Perk's `slow_crushing_attack` has a 1% chance on hit to shove the target one row behind. If that row is occupied, the two demons swap formation slots; if the target is already in the last row, nothing moves.
- Team state is cloned for battle, then persisted from the simulator result.
- The API returns both a combat log and before/after snapshots for UI replay.
- Poison effects tick slowly over time, can stack without a per-target cap, and are cleared from teams between cleared floors.
- Active Demonic Pacts are applied server-side during battle simulation; the browser only renders the serialized run state and combat replay.

Implemented ability kinds include:

| Ability | Behavior |
| --- | --- |
| `basic_attack`, `heavy_attack`, `ranged_execute`, `fast_execute`, `aoe_attack` | Damage using configured targeting rules |
| `slow_crushing_attack` | Damage using configured targeting rules, with Chu Perk's rare one-row knockback and occupied-slot swap |
| `poison` | Applies stacking poison to high-HP targets |
| `heal` | Heals the living ally with the most missing HP |
| `retaliate` | Does not proactively attack; returns configured thorns damage when hit |
| `chaotic_attack` | Hits a random target from its configured pool for random damage |

## Static Data And Assets

- Demon type definitions live in `public/api/data/demon-types.json`.
- Demon training caps use the upper value of each type's `baseStats.hp`, `baseStats.atk`, and `baseStats.speed` ranges.
- Demon image mappings live in `public/api/data/demons.json`.
- Demonic Pact definitions live in `public/api/data/run-buffs.json`.
- Full demon images live in `public/app/images/demons`.
- Thumbnail images live in `public/app/images/demons/thumbnails`.
- Page/background/logo assets live in `public/app/images`.
- There are 11 demon types and 6 rarity tiers: `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`.

Treat files in `public/api/data` as source game data. API code reads them at runtime but should not mutate them.

## Database

The API initializes required tables on first API use. `public/api/lib/schema.js` creates missing tables and performs additive schema checks for older local databases.

| Table | Purpose |
| --- | --- |
| `players` | Account credentials, level, XP, Souls, unlocks |
| `player_sessions` | Bearer/session tokens and expiration support |
| `player_demons` | Permanent owned demon collection |
| `runs` | Dungeon state, rewards, combat history, and status |

Run state and rewards are stored as JSON text in the `runs` table.

## Frontend Modules

| File | Purpose |
| --- | --- |
| `public/app/js/session.js` | Shared session storage and authenticated API helper |
| `public/app/js/navigation.js` | Public demon browser navigation |
| `public/app/js/auth-ui.js` | Login and register forms |
| `public/app/js/camp-ui.js` | Authenticated player camp, progression, current run briefing, objectives, and quick actions |
| `public/app/js/collection-ui.js` | Full collection filters, sorting, missing-slot display, and training modal UI |
| `public/app/js/summon-ui.js` | Authenticated Souls/summon placeholder state |
| `public/app/js/rankings-ui.js` | Leaderboard UI |
| `public/app/js/dungeon.js` and `public/app/js/dungeon/` | Dungeon UI modules: battle replay, drag/drop, recruitment, extraction, Demonic Pacts, active pact tooltips, enemy Terror display, and responsive hand/reward controls |
| `public/app/js/demon-cards.js` | Shared demon card rendering |

## Backend Modules

| File | Purpose |
| --- | --- |
| `public/api/lib/auth.js` | Password hashing, token creation, auth middleware |
| `public/api/lib/async-errors.js` | Express async error forwarding |
| `public/api/lib/collection-demons.js` | Permanent collection save helpers and stat normalization for extracted demons |
| `public/api/lib/combat.js` | Server-side combat simulator |
| `public/api/lib/db.js` | MySQL connection pool and `.env` loading |
| `public/api/lib/demon-factory.js` | Demon generation, rarity selection, stat rolls |
| `public/api/lib/demon-training.js` | Collection training caps, costs, stat rolls, and training metadata enrichment |
| `public/api/lib/dungeon-rules.js` | Shared Dungeon team-size and collection-reinforcement constants |
| `public/api/lib/game-data.js` | JSON game-data readers |
| `public/api/lib/dungeon-enemies.js` | Dungeon enemy pool, floor sizing, spawn pressure, and enemy Terror multipliers |
| `public/api/lib/rng.js` | Deterministic seeded RNG helpers |
| `public/api/lib/run-buffs.js` | Demonic Pact loading, serialization, stacking, rerolls, and combat/stat modifiers |
| `public/api/lib/run-demons.js` | Run demon normalization and reset helpers |
| `public/api/lib/run-rewards.js` | Reward Soul staging, discarded reward settlement, and earned payout helpers |
| `public/api/lib/run-serialization.js` | Serialized run response shape, previews, pacts, team limits, and enemy Terror previews |
| `public/api/lib/runs.js` | Run loading, serialization, and persistence helpers |
| `public/api/lib/schema.js` | Database initialization and additive schema checks |

## Development Checks

Check the server entrypoint:

```bash
node --check server.js
```

Check backend API files in PowerShell:

```powershell
Get-ChildItem -Recurse -Filter *.js public\api | ForEach-Object { node --check $_.FullName }
```

Check frontend scripts in PowerShell:

```powershell
Get-ChildItem -Recurse -Filter *.js public\app\js | ForEach-Object { node --check $_.FullName }
```

Initialize or verify the database schema from the command line:

```bash
node -e "require('./public/api/lib/schema').initializeSchema().then(() => { console.log('schema ready'); process.exit(0); }).catch((error) => { console.error(error); process.exit(1); })"
```

## License

MIT. See [LICENSE](LICENSE).

This license allows anyone to use, copy, modify, merge, publish, distribute, sublicense, and sell copies of the code, as long as the copyright and license notice are included.
