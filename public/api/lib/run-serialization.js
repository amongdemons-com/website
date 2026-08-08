const { createDungeonEnemies, getDungeonEncounterProfile, getEnemyPressureMultipliers } = require('./dungeon-enemies');
const { createRng } = require('./rng');
const {
  canUseCollectionReinforcement,
  getDungeonTeamLimit,
  isDungeonExtractionUnlocked
} = require('./dungeon-rules');
const { applyRunBuffStatModifiers, getTemporaryTeamSizeBonus, normalizeRunBuffState, serializeRunBuffState } = require('./run-buffs');
const { applyPreBattleBuffs, serializeCombatBuffState } = require('./combat-buffs');
const {
  getDungeonRankedEnemyBuffs,
  getDungeonRankedLiveOpponentRank,
  serializeDungeonRankedEncounter
} = require('./dungeon-ranked');
const { getActiveWorldRewardBuffs } = require('./world-buffs');
const { getCurrentRunRewards } = require('./run-rewards');

async function serializeRun(run, options = {}) {
  applyRunBuffStatModifiers(run);
  const playerLevel = getRunPlayerLevel(run, options);
  const collectionReinforcementLimit = getCollectionReinforcementLimit(run);
  const collectionReinforcementAvailable = collectionReinforcementLimit > 0;
  const [worldBuffs, liveOpponentRank] = await Promise.all([
    getSerializedWorldBuffs(run, options),
    getDungeonRankedLiveOpponentRank(run.state.rankedEncounter)
  ]);
  const encounterProfile = getEncounterProfile(run, run.floor);
  const nextEncounterProfile = getEncounterProfile(run, Number(run.floor) + 1);
  const rankedEncounter = serializeDungeonRankedEncounter(run.state.rankedEncounter, { liveOpponentRank });
  const rankedPlanning = rankedEncounter?.status === 'choice';
  const rankedEnemyBuffs = rankedEncounter ? getDungeonRankedEnemyBuffs(run) : null;
  const enemies = rankedPlanning
    ? applyPreBattleBuffs(cloneJson(run.state.enemies || []), rankedEnemyBuffs)
    : run.state.enemies;

  return {
    runId: run.id,
    seed: run.seed,
    status: run.status,
    currentFloor: run.state.currentFloor,
    hp: run.state.hp,
    team: run.state.team,
    enemies,
    nextEnemies: await getNextEnemiesPreview(run),
    enemyPressure: rankedEncounter ? null : getEnemyPressurePreview(run, run.floor),
    nextEnemyPressure: getEnemyPressurePreview(run, Number(run.floor) + 1),
    enemyBuffs: rankedEncounter ? [] : serializeEncounterBuffs(encounterProfile),
    nextEnemyBuffs: serializeEncounterBuffs(nextEncounterProfile),
    enemyTeamBuffs: rankedEnemyBuffs
      ? serializeCombatBuffState(rankedEnemyBuffs).activeBuffs
      : [],
    rewards: getCurrentRunRewards(run),
    awaitingRecruit: Boolean(run.state.awaitingRecruit),
    extractionUnlocked: isDungeonExtractionUnlocked(run.floor),
    collectionReinforcementAvailable,
    collectionReinforcementLimit,
    teamLimit: getSerializedTeamLimit(run),
    buffs: serializeRunBuffState(run.state.buffs || {}, { playerLevel }),
    worldBuffs,
    extractChoice: run.state.extractChoice || null,
    rankedEncounter,
    lastBattle: run.state.lastBattle || null,
    earned: run.state.earned || { xp: 0, souls: 0 }
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function getSerializedWorldBuffs(run, options = {}) {
  const activeBuffs = Array.isArray(options.worldBuffs)
    ? options.worldBuffs
    : await getActiveWorldRewardBuffs(run?.playerId);

  return normalizeRunBuffState({ activeBuffs }).activeBuffs;
}

function getEnemyPressurePreview(run, floor) {
  const floorNumber = Math.max(1, Number(floor) || 1);
  const pressure = getEnemyPressureMultipliers(floorNumber, {
    buffs: run.state.buffs,
    rarityRebalanced: true
  });
  const activePactCount = normalizeRunBuffState(run.state.buffs || {}).active.length;
  const level = getEnemyPressureLevel(pressure);

  return {
    floor: floorNumber,
    activePactCount,
    level,
    hpMult: roundMultiplier(pressure.hp),
    atkMult: roundMultiplier(pressure.atk),
    speedMult: roundMultiplier(pressure.speed),
    hpBonusPct: getBonusPercent(pressure.hp),
    atkBonusPct: getBonusPercent(pressure.atk),
    speedBonusPct: getBonusPercent(pressure.speed),
    active: level > 0,
    description: 'Floor depth, rarity balance, and sealed Pacts strengthen this formation.'
  };
}

function getEncounterProfile(run, floor) {
  return getDungeonEncounterProfile(createRng(Number(run.seed) + Number(floor)), floor);
}

function serializeEncounterBuffs(profile) {
  return profile?.convergence ? [{ ...profile.convergence }] : [];
}

function roundMultiplier(value) {
  return Math.round((Number(value) || 1) * 1000) / 1000;
}

function getBonusPercent(value) {
  return Math.max(0, Math.round(((Number(value) || 1) - 1) * 100));
}

function getEnemyPressureLevel(pressure = {}) {
  return Math.max(0, Math.round(((Number(pressure.hp) || 1) - 1) / 0.045));
}

async function getNextEnemiesPreview(run) {
  if (!run.state.awaitingRecruit || run.status !== 'active') return [];

  const nextFloor = Number(run.floor) + 1;
  return createDungeonEnemies(createRng(run.seed + nextFloor), nextFloor, (run.state.team || []).length, {
    buffs: run.state.buffs
  });
}

function getRunPlayerLevel(run, options = {}) {
  return Math.max(1, Math.floor(Number(options.playerLevel ?? run?.state?.playerLevel) || 1));
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
      run.state.awaitingRecruit &&
      canUseCollectionReinforcement(run.state, run.floor)
    )
  ) ? 1 : 0;
}

module.exports = {
  serializeRun
};
