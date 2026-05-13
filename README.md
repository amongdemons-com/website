# Among Demons

Among Demons is a Node.js and Express prototype for browsing demon assets and playing a server-authoritative roguelike dungeon run. The app uses static HTML/CSS/JS for the frontend and a MySQL-backed API for accounts, sessions, permanent demon collections, dungeon runs, automatic battles, rewards, XP, and Souls.

The current playable loop is:

1. Log in or register.
2. Start a Dungeon with either one of 3 generated starter demons or one demon from your collection.
3. Fight automatic server-simulated battles.
4. Recruit defeated demons into the temporary Dungeon team, or leave with rewards.
5. Earn XP and Souls, and optionally add demons to the permanent collection.

Important: combat, RNG, rewards, XP, Souls, and run state are server-authoritative. The client displays server results and stages menu choices, but it must not calculate gameplay outcomes.

## Tech Stack

| Area | Technology |
| --- | --- |
| Runtime | Node.js |
| Server | Express.js |
| Database | MySQL via `mysql2` |
| Frontend | Static HTML, vanilla JS |
| Styling | Bootstrap 5, Bootstrap Icons, custom CSS |

## Project Structure

```txt
amongdemons.com/
|-- public/
|   |-- api/
|   |   |-- account/
|   |   |-- admin/
|   |   |-- auth/
|   |   |-- data/
|   |   |-- demons/
|   |   |-- game/
|   |   |-- lib/
|   |   `-- runs/
|   `-- app/
|       |-- css/
|       |-- images/
|       `-- js/
|-- api.md
|-- idea.md
|-- package.json
|-- README.md
`-- server.js
```

## Static Data And Assets

- Demon type data lives in `public/api/data/demon-types.json`.
- Demon asset mappings live in `public/api/data/demons.json`.
- Full demon images live in `public/app/images/demons`.
- Demon images are currently `768x1024`.
- There are 11 demon types and 6 rarity tiers: `common`, `uncommon`, `rare`, `epic`, `legendary`, `mythic`.

Do not mutate the JSON files in `public/api/data` from API code. They are source game data and are read directly at runtime.

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env` with MySQL connection details:

   ```txt
   DB_HOST=your_mysql_host
   DB_PORT=3306
   DB_NAME=your_database
   DB_USER=your_user
   DB_PASSWORD=your_password
   PORT=3000
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

   Or:

   ```bash
   npm start
   ```

The API initializes required MySQL tables on first use with `CREATE TABLE IF NOT EXISTS` and additive schema checks.

## Web Routes

| Route | Description |
| --- | --- |
| `/` | Redirects to `/demons/type/1` |
| `/demons/type/:page` | Static demon collection browser |
| `/dungeon` | Dungeon run page |
| `/hunt` | Redirects to `/dungeon` |
| `/login` | Login page |
| `/register` | Register page |
| `/play` | Account and collection page |
| `/account` | Alias for `/play` |
| `/rankings` | Leaderboard page |
| `/rankings/souls` | Leaderboard sorted by Souls |

## Authentication

Most API endpoints require a bearer token:

```txt
Authorization: Bearer <token>
```

`POST /api/auth/login` logs in an existing player or creates a prototype account if the username does not exist. `POST /api/auth/register` explicitly creates a new account.

The frontend stores the token and player object in `localStorage` under `amongdemons-session`.

## API Endpoints

### Auth

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a player account |
| `POST` | `/api/auth/login` | Log in, or create a prototype account if missing |
| `GET` | `/api/auth/me` | Get the authenticated player |

### Account And Collection

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/account/progression` | Get level, XP, Souls, and unlocks |
| `GET` | `/api/demons` | List owned permanent demons |
| `GET` | `/api/demons/:id` | Get one owned permanent demon |
| `POST` | `/api/demons/save` | Save a final floor demon reward to the permanent collection |

### Dungeon Runs

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/runs/start-options` | Get 3 generated starter demons, a draft token, and the player's collection |
| `POST` | `/api/runs/start` | Start a new Dungeon run |
| `GET` | `/api/runs/current` | Get the current non-ended run for the player |
| `GET` | `/api/runs/:id` | Get one run state |
| `POST` | `/api/runs/:id/formation` | Update team front/back positions before battle |
| `POST` | `/api/runs/:id/battle` | Simulate the next battle server-side |
| `POST` | `/api/runs/:id/reward` | Mark a reward selected |
| `POST` | `/api/runs/:id/recruit` | Commit recruitment choices and advance to the next floor |
| `POST` | `/api/runs/:id/cashout` | Leave between fights, save one eligible demon, and claim XP/Souls |
| `POST` | `/api/runs/:id/end` | End a run and grant accumulated XP/Souls |

### Game Data And Rankings

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/game/demon-types` | Read demon type data from JSON |
| `GET` | `/api/game/demons` | Read demon asset mappings from JSON |
| `GET` | `/api/leaderboard` | List top players, sorted by `level`, `xp`, or `souls` |
| `POST` | `/api/admin/demon-balance` | Placeholder admin endpoint; does not mutate JSON data |

## Database Tables

| Table | Purpose |
| --- | --- |
| `players` | Account credentials, level, XP, Souls, unlocks |
| `player_sessions` | Bearer token sessions |
| `player_demons` | Permanent owned demon collection |
| `runs` | Temporary Dungeon state, rewards, combat history, and status |

Run state and rewards are stored as JSON text in the `runs` table.

## Dungeon Rules

- Dungeon teams currently support up to 3 active demons.
- Floor 1 enemy team size follows player team size.
- Floor 2 has 2 enemy demons.
- Floors 3-10 use 3 enemy demons.
- Floor 10 includes the boss demon type.
- The player can drag demons between front and back rows before battle.
- After a win, the player can recruit defeated enemies, swap demons, continue short-handed, or leave the Dungeon for rewards.
- Leaving during the recruitment phase can add one eligible demon to the permanent collection and awards accumulated XP/Souls.

## Combat Rules

Combat is automatic and server simulated:

- Each tick, living demons gain `attackMeter += speed`.
- When `attackMeter >= 100`, the demon attacks and its meter resets.
- Damage is currently `target.hp -= attacker.atk`.
- Battles end when all demons on one side are defeated, or when the simulator reaches the safety tick limit.

Targeting is simple:

- Type 1 targets front row.
- Type 2 targets lowest HP.
- Type 4 hits all living enemies.
- Other types use their configured `targeting` value or default to front row.

The server returns a combat log. The Dungeon UI replays that log visually.

## Frontend Modules

| File | Purpose |
| --- | --- |
| `public/app/js/session.js` | Shared session storage and authenticated API helper |
| `public/app/js/navigation.js` | Demon type dropdown |
| `public/app/js/index.js` | Static demon collection browser |
| `public/app/js/auth-ui.js` | Login and register forms |
| `public/app/js/play-ui.js` | Account progression and permanent collection |
| `public/app/js/rankings-ui.js` | Leaderboard page |
| `public/app/js/hunt-ui.js` | Dungeon run UI, battle replay, drag/drop, recruitment, cashout, rewards |

## Backend Modules

| File | Purpose |
| --- | --- |
| `public/api/lib/auth.js` | Password hashing, token creation, auth middleware |
| `public/api/lib/combat.js` | Server-side combat simulator |
| `public/api/lib/db.js` | MySQL connection pool |
| `public/api/lib/demon-factory.js` | Demon generation, rarity selection, stat rolls |
| `public/api/lib/game-data.js` | JSON data readers |
| `public/api/lib/hunt-enemies.js` | Dungeon enemy generation |
| `public/api/lib/rng.js` | Deterministic seeded RNG helpers |
| `public/api/lib/run-demons.js` | Run demon normalization and reset helpers |
| `public/api/lib/runs.js` | Run load/save helpers |
| `public/api/lib/schema.js` | Database initialization and additive schema checks |

## Development Checks

Check the server entrypoint:

```bash
node --check server.js
```

Check API JavaScript files in PowerShell:

```powershell
Get-ChildItem -Recurse -Filter *.js public\api | ForEach-Object { node --check $_.FullName }
```

Check the Dungeon UI script:

```bash
node --check public/app/js/hunt-ui.js
```

## Notes

- `api.md` is older planning documentation and may not include newer endpoints.
- `idea.md` contains the original gameplay design notes.
- Internal code and filenames still use some `hunt` naming, but the player-facing route and UI are `Dungeon`.

## License

All rights reserved. Copyright 2026 Among Demons.
