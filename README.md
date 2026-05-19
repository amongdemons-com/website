# Among Demons

Among Demons is a Node.js/Express prototype for a server-authoritative demon collection and dungeon-run game. The frontend is static HTML/CSS/vanilla JavaScript served from `public/app`; the backend is an Express API backed by MySQL.

The current loop is:

1. Register or log in.
2. Start a Dungeon with two demons chosen from six tokenized draft starters and/or your permanent collection.
3. Arrange the active team into front/back positions.
4. Run automatic server-simulated battles.
5. Recruit defeated demons into the temporary Dungeon team, skip recruitment, cash out between fights, or clear floor 20.
6. Earn XP and Souls, then save eligible demons into the permanent collection.

Combat, RNG, reward generation, XP, Souls, run status, and collection writes are server-authoritative. The browser displays state and stages player choices, but it must not calculate gameplay outcomes.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Server | Express 4 |
| Database | MySQL via `mysql2/promise` |
| Config | `dotenv` |
| Frontend | Static HTML, vanilla JavaScript |
| Styling | Bootstrap 5, Bootstrap Icons, custom CSS |

## Project Structure

```txt
amongdemons.com/
|-- public/
|   |-- api/
|   |   |-- account/          # Player progression endpoints
|   |   |-- admin/            # Prototype admin placeholders
|   |   |-- auth/             # Register, login, session profile
|   |   |-- data/             # Source game data JSON
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
| `/` | Redirects to `/demons/type/1`, or to a type page when `?type=` is present |
| `/demons/type/:page` | Public static demon browser shell |
| `/dungeon` | Main Dungeon run UI |
| `/hunt` | Legacy redirect to `/dungeon` |
| `/login` | Login page |
| `/register` | Registration page |
| `/play` | Account dashboard and compact collection view |
| `/account` | Alias for `/play` |
| `/collection` | Full authenticated collection browser with filters, sorting, and pagination |
| `/summon` | Authenticated Souls/summon placeholder page |
| `/rank` | Redirects to `/rankings` |
| `/rankings` | Leaderboard sorted by level by default |
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
| `GET` | `/auth/me` | Return the authenticated player |

### Account And Collection

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/account/progression` | Return level, XP, Souls, and unlocks |
| `GET` | `/demons` | List owned permanent demons |
| `GET` | `/demons/:id` | Return one owned permanent demon |
| `POST` | `/demons/save` | Save one final-floor demon reward after completing floor 20 |

### Dungeon Runs

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/runs/start-options` | Return six draft starters, a short-lived signed draft token, and the player's collection |
| `POST` | `/runs/start` | Start a new Dungeon run from two draft or collection demons |
| `GET` | `/runs/current` | Return the player's current active/completed pending run |
| `GET` | `/runs/:id` | Return one run state owned by the player |
| `POST` | `/runs/:id/formation` | Update front/back positions before battle |
| `POST` | `/runs/:id/battle` | Simulate the next battle server-side |
| `POST` | `/runs/:id/reward` | Mark a reward as claimed |
| `POST` | `/runs/:id/recruit` | Stage or commit recruitment choices and advance to the next floor |
| `POST` | `/runs/:id/cashout` | Leave between fights, save one eligible demon, and claim earned XP/Souls |
| `POST` | `/runs/:id/end` | End a run and grant accumulated XP/Souls |

### Game Data, Rankings, Admin

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/game/demon-types` | Return demon type, role, stat, targeting, and ability data |
| `GET` | `/game/demons` | Return demon asset mappings |
| `GET` | `/leaderboard?sort=level\|xp\|souls` | Return up to 100 players sorted by level, XP, or Souls |
| `POST` | `/admin/demon-balance` | Prototype placeholder; returns `501` and does not mutate data |

## Dungeon Rules

- Starting options are generated as six choices from starter type IDs `1`, `2`, and `3`, with `common`, `uncommon`, or `rare` rarity.
- Draft starter choices are protected by an HMAC-signed token and expire after 15 minutes.
- Starting a new run closes any open runs for that player.
- New Dungeon runs start with exactly 2 demons.
- The active Dungeon team can contain up to 6 demons.
- The player can use permanent collection demons as starting Dungeon demons.
- Floors 1 and 2 have enemy and team size 2.
- Enemy teams are 2 demons on floors 1 and 2, grow from 3 to 6 demons across floors 3 through 6, then stay at 6 enemies.
- Floors 1 through 3 use the starter type pool; later floors unlock more types based on floor.
- From floor 4 onward, enemy generation applies floor pressure that biases later floors toward higher type IDs and higher rarities while keeping each type's base `spawnWeight`.
- Legendary and mythic enemy rarities can only appear from floor 10 onward.
- Floor 20 always includes type `11` as the first enemy.
- After a win before floor 20, defeated enemies become recruit rewards.
- Between fights, the player may stage a whole team, recruit one demon, swap demons, skip recruitment, or cash out.
- Cashing out between fights saves one eligible new demon and grants accumulated XP/Souls.
- Clearing floor 20 marks the run `completed` and offers final rewards from the surviving team plus final enemies.
- Only one final-floor demon can be saved through `/api/demons/save`.

## Combat Rules

Combat is automatic and simulated in `public/api/lib/combat.js`.

- Living demons gain `attackMeter += speed` each tick.
- When `attackMeter >= 100`, the demon acts and the meter resets.
- Battles stop when one side has no living demons, or after the 1000 tick safety limit.
- Front-row targeting prefers living front-row enemies and falls back to any living enemy.
- Team state is cloned for battle, then persisted from the simulator result.
- The API returns both a combat log and before/after snapshots for UI replay.
- Poison effects tick slowly over time, can stack without a per-target cap, and are cleared from teams between winning floors.

Implemented ability kinds include:

| Ability | Behavior |
| --- | --- |
| `basic_attack`, `heavy_attack`, `slow_crushing_attack`, `ranged_execute`, `fast_execute`, `aoe_attack` | Damage using configured targeting rules |
| `poison` | Applies stacking poison to high-HP targets |
| `heal` | Heals the living ally with the most missing HP |
| `retaliate` | Does not proactively attack; returns configured thorns damage when hit |
| `chaotic_attack` | Hits a random target from its configured pool for random damage |

## Static Data And Assets

- Demon type definitions live in `public/api/data/demon-types.json`.
- Demon image mappings live in `public/api/data/demons.json`.
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
| `public/app/js/index.js` | Static demon type browser |
| `public/app/js/auth-ui.js` | Login and register forms |
| `public/app/js/play-ui.js` | Account dashboard, progression, compact collection, admin check |
| `public/app/js/collection-ui.js` | Full collection filters, sorting, pagination |
| `public/app/js/summon-ui.js` | Authenticated Souls/summon placeholder state |
| `public/app/js/rankings-ui.js` | Leaderboard UI |
| `public/app/js/hunt-ui.js` | Dungeon UI, battle replay, drag/drop, recruitment, cashout, final save |
| `public/app/js/demon-cards.js` | Shared demon card rendering |
| `public/app/js/api-test.js` | Manual API test page helper |

## Backend Modules

| File | Purpose |
| --- | --- |
| `public/api/lib/auth.js` | Password hashing, token creation, auth middleware |
| `public/api/lib/async-errors.js` | Express async error forwarding |
| `public/api/lib/combat.js` | Server-side combat simulator |
| `public/api/lib/db.js` | MySQL connection pool and `.env` loading |
| `public/api/lib/demon-factory.js` | Demon generation, rarity selection, stat rolls |
| `public/api/lib/game-data.js` | JSON game-data readers |
| `public/api/lib/hunt-enemies.js` | Dungeon enemy pool and floor sizing |
| `public/api/lib/rng.js` | Deterministic seeded RNG helpers |
| `public/api/lib/run-demons.js` | Run demon normalization and reset helpers |
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

## Notes For Future Work

- `api.md` is older planning documentation and does not fully reflect the current implementation.
- `idea.md` contains original gameplay notes, not a strict implementation contract.
- Some internal code still uses `hunt` naming while the user-facing experience is now `Dungeon`.
- `/summon` exists as an authenticated page, but summon spending/creation is not implemented yet.
- `/admin/demon-balance` is intentionally a non-mutating placeholder.

## License

All rights reserved. Copyright 2026 Among Demons.
