# Among Demons

A Node.js and Express website for browsing the Among Demons collection, now with a prototype server-authoritative roguelike API for account progression, demon collection, runs, battles, rewards, and static game data.

## Features

- 11 demon types and 6 rarity tiers.
- 66 demon assets served from `public/data`.
- EJS collection pages and hunt preview pages.
- MySQL-backed player accounts, sessions, run state, and owned demons.
- Server-side deterministic RNG, demon stat rolls, battle simulation, reward generation, XP, and Souls.
- Static game data API endpoints that read directly from `public/data/demons.json` and `public/data/demon-types.json`.

Important: do not edit or rewrite the JSON files in `public/data` from API code. They are source game data and are read directly at runtime.

## Tech Stack

| Component | Technology |
| --- | --- |
| Runtime | Node.js |
| Web framework | Express.js |
| Templates | EJS |
| Database | MySQL via `mysql2` |
| Styling | Bootstrap 5, custom CSS |

## Project Structure

```txt
amongdemons.com/
├── public/
│   ├── api/
│   │   ├── account/
│   │   ├── admin/
│   │   ├── auth/
│   │   ├── demons/
│   │   ├── game/
│   │   ├── lib/
│   │   └── runs/
│   ├── app/
│   └── data/
│       ├── demons.json
│       ├── demon-types.json
│       ├── images/
│       └── js/
├── views/
├── api.md
├── idea.md
├── server.js
└── package.json
```

Each API endpoint lives in its own file under `public/api`. Shared database, auth, RNG, combat, and game-data helpers live under `public/api/lib`.

## Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create or update `.env` with MySQL connection details:

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

The API initializes the required MySQL tables on startup using `CREATE TABLE IF NOT EXISTS` and additive column checks for the existing `players` table.

## Web Routes

| Route | Description |
| --- | --- |
| `/` | Redirects to the first demon collection page |
| `/demons/type/:page` | Paginated demon collection view, pages 1-11 |
| `/hunt` | Hunt preview page |

## API Auth

`POST /api/auth/login` creates a player if the username does not exist, or validates the password if it does. It returns a bearer token.

Send authenticated requests with:

```txt
Authorization: Bearer <token>
```

## API Endpoints

| Method | Route | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a player account |
| `POST` | `/api/auth/login` | Log in, or create a prototype account if missing |
| `GET` | `/api/auth/me` | Get the current authenticated player |
| `GET` | `/api/account/progression` | Get level, XP, Souls, and unlocks |
| `GET` | `/api/demons` | List owned demons |
| `GET` | `/api/demons/:id` | Get one owned demon |
| `POST` | `/api/demons/save` | Save a demon reward from a run to the permanent collection |
| `POST` | `/api/runs/start` | Start a new run with a seed, starter demon, and enemies |
| `GET` | `/api/runs/:id` | Get current run state |
| `POST` | `/api/runs/:id/battle` | Simulate the next server-side battle |
| `POST` | `/api/runs/:id/reward` | Mark a reward selected |
| `POST` | `/api/runs/:id/recruit` | Recruit a reward demon into the temporary run team |
| `POST` | `/api/runs/:id/end` | End a run and grant XP and Souls |
| `GET` | `/api/game/demon-types` | Read demon type data from `public/data/demon-types.json` |
| `GET` | `/api/game/demons` | Read demon asset mappings from `public/data/demons.json` |
| `GET` | `/api/leaderboard` | List top players |
| `POST` | `/api/admin/demon-balance` | Placeholder; intentionally does not mutate JSON data |

## Database Tables

The API uses these tables:

| Table | Purpose |
| --- | --- |
| `players` | Account progression and credentials |
| `player_sessions` | Bearer token sessions |
| `player_demons` | Permanent owned demon collection |
| `runs` | Temporary run state, rewards, and battle progress |

If a compatible `players` table already exists, the schema initializer adds only the missing API columns it needs.

## Game Rules

The prototype follows the rules in `idea.md`:

- Teams can have up to 3 active demons.
- Demon instances roll HP, ATK, and SPEED from type ranges and rarity multipliers.
- Combat is automatic and tick based.
- Attack meters increase by SPEED.
- A demon attacks when its meter reaches 100.
- Damage is `target.hp -= attacker.atk`.
- Battles end when all demons on one side are defeated.

Clients should only display server results. They should not calculate damage, XP, currency, battle outcomes, RNG, or rewards.

## Development

Useful checks:

```bash
node --check server.js
```

```powershell
Get-ChildItem -Recurse -Filter *.js public\api | ForEach-Object { node --check $_.FullName }
```

## License

All rights reserved. Copyright 2026 Among Demons.
