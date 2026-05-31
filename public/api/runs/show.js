const express = require('express');
const { requireAuth } = require('../lib/auth');
const { createHuntEnemies } = require('../lib/hunt-enemies');
const { createRng } = require('../lib/rng');
const { getCurrentRunForPlayer, getRunForPlayer } = require('../lib/runs');
const { COLLECTION_REINFORCEMENT_FLOOR } = require('../lib/dungeon-rules');

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
  const collectionReinforcementLimit = getCollectionReinforcementLimit(run);
  const collectionReinforcementAvailable = collectionReinforcementLimit > 0;

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
    collectionReinforcementLimit,
    extractChoice: run.state.extractChoice || null,
    lastBattle: run.state.lastBattle || null,
    earned: run.state.earned || { xp: 0, souls: 0 }
  };
}

async function getNextEnemiesPreview(run) {
  if (!run.state.awaitingRecruit || run.status !== 'active') return [];

  const nextFloor = Number(run.floor) + 1;
  return createHuntEnemies(createRng(run.seed + nextFloor), nextFloor, (run.state.team || []).length);
}

function getCollectionReinforcementLimit(run) {
  const explicitLimit = Number(run.state.collectionReinforcementLimit);
  if (explicitLimit > 0 && run.state.awaitingRecruit) return explicitLimit;

  if (run.state.awaitingRecruit && Number(run.floor) === 0) return 2;

  return Boolean(
    run.state.awaitingCollectionReinforcement ||
    (
      !run.state.collectionReinforcementUsed &&
      run.state.awaitingRecruit &&
      Number(run.floor) === COLLECTION_REINFORCEMENT_FLOOR
    )
  ) ? 1 : 0;
}

module.exports = router;
