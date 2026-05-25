const express = require('express');
const { requireAuth } = require('../lib/auth');
const { createHuntEnemies } = require('../lib/hunt-enemies');
const { createRng } = require('../lib/rng');
const { getCurrentRunForPlayer, getRunForPlayer } = require('../lib/runs');
const { MAX_DUNGEON_FLOOR } = require('../lib/dungeon-rules');

const router = express.Router();

router.get('/runs/current', requireAuth, async (req, res) => {
  const run = await getCurrentRunForPlayer(req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  res.json(await serializeRun(run));
});

router.get('/runs/:id', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  res.json(await serializeRun(run));
});

async function serializeRun(run) {
  const collectionReinforcementAvailable = Boolean(
    run.state.awaitingCollectionReinforcement ||
    (
      !run.state.collectionReinforcementUsed &&
      run.state.awaitingRecruit &&
      Number(run.floor) === 3
    )
  );

  return {
    runId: run.id,
    seed: run.seed,
    status: run.status,
    currentFloor: run.state.currentFloor,
    hp: run.state.hp,
    team: run.state.team,
    enemies: run.state.enemies,
    nextEnemies: await getNextEnemiesPreview(run),
    rewards: run.rewards,
    awaitingRecruit: Boolean(run.state.awaitingRecruit),
    collectionReinforcementAvailable,
    awaitingFinalPick: Boolean(run.state.awaitingFinalPick),
    lastBattle: run.state.lastBattle || null,
    earned: run.state.earned || { xp: 0, souls: 0 },
    mapProgress: run.state.mapProgress
  };
}

async function getNextEnemiesPreview(run) {
  if (!run.state.awaitingRecruit || run.status !== 'active') return [];

  const nextFloor = Number(run.floor) + 1;
  if (nextFloor > MAX_DUNGEON_FLOOR) return [];

  return createHuntEnemies(createRng(run.seed + nextFloor), nextFloor, (run.state.team || []).length);
}

module.exports = router;
