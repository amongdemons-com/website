const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getRunForPlayer } = require('../lib/runs');

const router = express.Router();

router.get('/runs/:id', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  res.json({
    runId: run.id,
    seed: run.seed,
    status: run.status,
    currentFloor: run.state.currentFloor,
    hp: run.state.hp,
    team: run.state.team,
    enemies: run.state.enemies,
    rewards: run.rewards,
    mapProgress: run.state.mapProgress
  });
});

module.exports = router;
