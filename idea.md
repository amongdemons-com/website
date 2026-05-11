# Demon Roguelike Prototype

## Core Concept

Fast roguelike auto-battler runs.

A player enters a run and:

* encounters demons
* recruits demons
* fights enemies automatically
* builds a temporary team
* earns rewards

After the run:

* gain XP
* gain Souls currency
* unlock permanent progression

Runs are temporary.
Account progression is permanent.

---

# Existing Structure

Current assets:

* 11 demon species/types
* 6 rarities:

  * common
  * uncommon
  * rare
  * epic
  * legendary
  * mythic

Each demon currently has:

* type
* rarity
* image

This is already enough for a prototype.

---

# Recommended Gameplay Loop

## 1. Start Run

Player:

* presses Play
* receives starter demon

Optional later:

* choose blessing
* choose starting relic
* choose difficulty

---

## 2. Travel Through Nodes

Simple map structure.

Example node types:

* normal battle
* elite battle
* demon encounter
* merchant
* shrine
* boss

Prototype can start with:

* only battles

---

# Team System

Small team size:

* 3 active demons

Reason:

* easier balancing
* easier UI
* meaningful choices

---

# Demon Structure

Each demon instance should have randomized stats.

Example:

```js
{
  id: 1,
  species: "Boof Nitza",
  rarity: "rare",

  hp: 120,
  atk: 18,
  speed: 7
}
```

---

# Prototype Stats

Only use:

* HP
* ATK
* SPEED

Avoid:

* mana
* armor
* crit
* skills
* status effects

Keep prototype extremely simple.

---

# Rarity Scaling

Example:

| Rarity    | Bonus |
| --------- | ----- |
| Common    | base  |
| Uncommon  | +10%  |
| Rare      | +25%  |
| Epic      | +45%  |
| Legendary | +70%  |
| Mythic    | +100% |

---

# Randomized Stat Rolls

Every demon gets slightly different stats.

Example:

```txt
Boof Nitza Rare
HP: 100-130
ATK: 12-18
SPEED: 4-7
```

This creates replayability.

---

# Species Identity

Each demon type should eventually have a role.

Example:

| Demon      | Role        |
| ---------- | ----------- |
| Boof Nitza | Tank        |
| Gon G'ah   | Poison      |
| Ma'Zga     | Burst       |
| Tor Tza    | Summoner    |
| Vi'Zel     | Lifesteal   |
| Goh Loomb  | Freeze      |
| Baobaw     | Reflect     |
| Ko Pak     | Speed       |
| Chu Perk   | Crit        |
| Ba Be'aga  | Chaos       |
| Vee Scol   | Necromancer |

Prototype does NOT need abilities yet.

Only stat tendencies.

Example:

* tanks = high HP
* assassins = high speed
* bruisers = balanced

---

# Combat Style

Combat is:

* automatic
* server simulated
* tick based

No manual control.

---

# Combat Loop

Every tick:

```js
attackMeter += speed
```

When:

```js
attackMeter >= 100
```

Demon attacks.

Then:

```js
attackMeter = 0
```

---

# Prototype Combat

Attack formula:

```js
target.hp -= attacker.atk
```

Very simple initially.

---

# Targeting Rules

Keep targeting basic.

Examples:

## Tanks

Attack nearest/front enemy.

## Assassins

Attack lowest HP enemy.

## Chaos Demons

Attack random enemy.

Prototype can even start with:

```txt
always attack first alive enemy
```

---

# Recommended Battlefield

Simple static grid.

Example:

```txt
[Tank] [DPS] [Support]
```

No movement.
No pathfinding.
No physics.

This massively simplifies development.

---

# Combat Result

Fight ends when:

* all enemies dead
  OR
* all player demons dead

---

# Server Authoritative System

IMPORTANT:
Server controls all combat.

Client only:

* displays battle
* displays combat log
* sends menu choices

Client NEVER decides:

* damage
* rewards
* battle outcomes

This prevents cheating.

---

# Deterministic Seed System

Server generates random seed:

```js
seed = 12345
```

Randomness still exists,
but becomes reproducible.

Meaning:

* same seed
* same teams
* same outcome

Useful for:

* anti cheat
* debugging
* replays

---

# Example

Server:

```js
simulateFight(seed, teamA, teamB)
```

Returns:

```js
{
  winner,
  rewards,
  combatLog
}
```

---

# Combat Log Example

```js
[
  {tick: 1, attacker: 2, target: 7, dmg: 12},
  {tick: 2, attacker: 7, target: 2, dmg: 9}
]
```

Client can replay this visually later.

---

# Recommended Backend

## Backend

Node.js

## Database

SQLite initially

Can upgrade later:

* PostgreSQL

---

# Prototype Goals

Prototype should ONLY prove:

* combat feels good
* collecting demons feels fun
* progression feels rewarding

Do NOT overbuild early.

---

# Recommended First Features

## Must Have

* login/account
* start run
* random enemy generation
* auto combat
* rewards
* souls currency
* account XP
* randomized demon stats

## Skip For Now

* skills
* animations
* multiplayer
* realtime PvP
* clans
* crafting
* equipment
* movement
* status effects

---

# Long Term Ideas

Possible future systems:

## Skills

Each demon:

* passive
* active
* ultimate

## Fusion

Merge demons for mutations.

## Corruption

Powerful buffs with downsides.

## Relics

Run modifiers.

## Ascension

Harder difficulties.

## Demon Collection

Permanent codex.

---

# Recommended Development Order

## Phase 1

* backend combat simulator
* basic demon generation
* battle results

## Phase 2

* frontend combat viewer
* hp bars
* combat logs

## Phase 3

* rewards
* progression
* meta systems

## Phase 4

* visual polish
* animations
* advanced mechanics

---

# Important Design Rule

Gameplay first.
Visuals later.

If combat and progression feel addictive,
everything else can be improved later.
