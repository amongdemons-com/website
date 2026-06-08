const { createDungeonEnemies, getEnemyPressureMultipliers } = require('./dungeon-enemies');
const { createRng } = require('./rng');
const { COLLECTION_REINFORCEMENT_FLOOR, getDungeonTeamLimit } = require('./dungeon-rules');
const { applyRunBuffStatModifiers, getTemporaryTeamSizeBonus, normalizeRunBuffState, serializeRunBuffState } = require('./run-buffs');

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
    enemyPressure: getEnemyPressurePreview(run, run.floor),
    nextEnemyPressure: getEnemyPressurePreview(run, Number(run.floor) + 1),
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

function getEnemyPressurePreview(run, floor) {
  const floorNumber = Math.max(1, Number(floor) || 1);
  const pressure = getEnemyPressureMultipliers(floorNumber, { buffs: run.state.buffs });
  const activePactCount = normalizeRunBuffState(run.state.buffs || {}).active.length;

  return {
    floor: floorNumber,
    activePactCount,
    level: getEnemyPressureLevel(floorNumber, activePactCount),
    hpMult: roundMultiplier(pressure.hp),
    atkMult: roundMultiplier(pressure.atk),
    speedMult: roundMultiplier(pressure.speed),
    hpBonusPct: getBonusPercent(pressure.hp),
    atkBonusPct: getBonusPercent(pressure.atk),
    speedBonusPct: getBonusPercent(pressure.speed),
    active: pressure.hp > 1 || pressure.atk > 1 || pressure.speed > 1
  };
}

function roundMultiplier(value) {
  return Math.round((Number(value) || 1) * 1000) / 1000;
}

function getBonusPercent(value) {
  return Math.max(0, Math.round(((Number(value) || 1) - 1) * 100));
}

function getEnemyPressureLevel(floor, activePactCount) {
  return Math.max(0, Number(floor) - 18) + Math.max(0, Number(activePactCount) || 0);
}

async function getNextEnemiesPreview(run) {
  if (!run.state.awaitingRecruit || run.status !== 'active') return [];

  const nextFloor = Number(run.floor) + 1;
  return createDungeonEnemies(createRng(run.seed + nextFloor), nextFloor, (run.state.team || []).length, {
    buffs: run.state.buffs
  });
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
