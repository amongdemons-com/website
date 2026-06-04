const { createHuntEnemies } = require('./hunt-enemies');
const { createRng } = require('./rng');
const { COLLECTION_REINFORCEMENT_FLOOR, getDungeonTeamLimit } = require('./dungeon-rules');
const { applyRunBuffStatModifiers, getTemporaryTeamSizeBonus, serializeRunBuffState } = require('./run-buffs');

async function serializeRun(run) {
  applyRunBuffStatModifiers(run);
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
    teamLimit: getSerializedTeamLimit(run),
    buffs: serializeRunBuffState(run.state.buffs || {}),
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

function getSerializedTeamLimit(run) {
  const floorForLimit = run.state.awaitingRecruit ? Number(run.floor) + 1 : Number(run.floor);
  return getDungeonTeamLimit(floorForLimit) + getTemporaryTeamSizeBonus(run);
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

module.exports = {
  serializeRun
};
