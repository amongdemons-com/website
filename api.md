# Auth

## Register

```txt
POST /auth/register
```

## Login

```txt
POST /auth/login
```

## Get Profile

```txt
GET /auth/me
```

---

# Account

## Account Progression

```txt
GET /account/progression
```

Returns:

* level
* xp
* souls
* unlocks

---

# Demon Collection

## Owned Demons

```txt
GET /demons
```

## Single Demon

```txt
GET /demons/:id
```

## Save Demon

(after extraction)

```txt
POST /demons/save
```

---

# Runs

## Start Run

```txt
POST /runs/start
```

Server:

* generates seed
* generates enemies
* creates run state

Returns:

```json id="o0x3v4"
{
  "runId": "abc123",
  "seed": 12345,
  "startingTeam": []
}
```

---

## Current Run State

```txt
GET /runs/:id
```

Returns:

* current floor
* hp
* team
* rewards
* map progress

---

## Enter Battle

```txt
POST /runs/:id/battle
```

Server:

* simulates fight
* updates run

Returns:

```json id="9m4e0r"
{
  "winner": "player",
  "combatLog": [],
  "rewards": {}
}
```

---

## Choose Reward

```txt
POST /runs/:id/reward
```

Example:

```json id="l7c4ml"
{
  "rewardId": 2
}
```

---

## Recruit Demon

```txt
POST /runs/:id/recruit
```

---

## End Run

```txt
POST /runs/:id/end
```

Server:

* grants XP
* grants souls
* saves progress

---

# Static Game Data

## Demon Types

```txt
GET /game/demon-types
```

Returns:

* names
* roles
* stat ranges

---

## Demon Assets

```txt
GET /game/demons
```

Returns:

* image mappings
* rarity variants

---

# Leaderboards (Later)

## Top Players

```txt
GET /leaderboard
```

---

# Admin / Balance (Later)

## Update Balance

```txt
POST /admin/demon-balance
```

---

# VERY IMPORTANT

Keep:

* battle simulation
* reward generation
* RNG

100% server side.

Client should never calculate:

* damage
* XP
* currency
* rewards

---

# Recommended Prototype API Order

Build in this order:

## Phase 1

```txt
POST /auth/login
POST /runs/start
POST /runs/:id/battle
POST /runs/:id/end
```

## Phase 2

```txt
GET /demons
GET /account/progression
```

## Phase 3

```txt
POST /runs/:id/recruit
POST /runs/:id/reward
```

That’s enough for a playable prototype.
