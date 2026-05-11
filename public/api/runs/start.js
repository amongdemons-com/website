const crypto = require('crypto');
const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { createRng } = require('../lib/rng');
const { createTeam } = require('../lib/demon-factory');

const router = express.Router();

router.post('/runs/start', requireAuth, async (req, res) => {
  const runId = crypto.randomUUID();
  const seed = crypto.randomInt(1, 4294967295);
  const rng = createRng(seed);
  const startingTeam = await createTeam(rng, 1, { prefix: 'player' });
  const enemies = await createTeam(rng, 3, { prefix: 'enemy', rarity: 'common' });
  const state = {
    currentFloor: 1,
    hp: startingTeam.reduce((sum, demon) => sum + demon.hp, 0),
    team: startingTeam,
    enemies,
    mapProgress: [{ floor: 1, type: 'battle', status: 'available' }]
  };
  const rewards = [];

  await db.query(
    `INSERT INTO runs (id, player_id, seed, status, floor, state, rewards)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [runId, req.player.id, seed, 'active', 1, JSON.stringify(state), JSON.stringify(rewards)]
  );

  res.status(201).json({
    runId,
    seed,
    startingTeam
  });
});

module.exports = router;
