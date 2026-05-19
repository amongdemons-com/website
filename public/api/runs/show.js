const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getCurrentRunForPlayer, getRunForPlayer } = require('../lib/runs');

const router = express.Router();

router.get('/runs/current', requireAuth, async (req, res) => {
  const run = await getCurrentRunForPlayer(req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  res.json(serializeRun(run));
});

router.get('/runs/:id', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  res.json(serializeRun(run));
});

function serializeRun(run) {
  return {
    runId: run.id,
    seed: run.seed,
    status: run.status,
    currentFloor: run.state.currentFloor,
    hp: run.state.hp,
    team: run.state.team,
    enemies: run.state.enemies,
    rewards: run.rewards,
    awaitingRecruit: Boolean(run.state.awaitingRecruit),
    collectionReinforcementAvailable: Boolean(run.state.awaitingCollectionReinforcement),
    awaitingFinalPick: Boolean(run.state.awaitingFinalPick),
    lastBattle: run.state.lastBattle || null,
    earned: run.state.earned || { xp: 0, souls: 0 },
    mapProgress: run.state.mapProgress
  };
}

module.exports = router;
