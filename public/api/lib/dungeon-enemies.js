const { createDemon } = require('./demon-factory');
const { getDungeonTeamLimit } = require('./dungeon-rules');
const { getAllowedEnemyTypeIds } = require('./enemy-team-rules');
const { assignFormationSlots } = require('./run-demons');
const { normalizeRunBuffState } = require('./run-buffs');

const STARTER_TYPE_IDS = [1, 2, 3];
const MAX_DUNGEON_TYPE_ID = 11;
const MAX_DUNGEON_ENEMY_TEAM_SIZE = 9;
const ENEMY_SIZE_INCREASE_START_FLOOR = 25;
const ENEMY_SIZE_INCREASE_INTERVAL = 5;
const EARLY_FLOOR_HANDICAP_END = 5;
const DIFFICULTY_RAMP_FLOORS = 20;
const ENEMY_PRESSURE_START_FLOOR = 18;
const ENEMY_PRESSURE_FLOOR_HP = 0.045;
const ENEMY_PRESSURE_FLOOR_ATK = 0.04;
const ENEMY_PRESSURE_FLOOR_SPEED = 0.012;
const ENEMY_PRESSURE_PACT_HP = 0.07;
const ENEMY_PRESSURE_PACT_ATK = 0.055;
const ENEMY_PRESSURE_PACT_SPEED = 0.02;
const ENEMY_PRESSURE_LINEAR_END_FLOOR = 30;
const ENEMY_PRESSURE_DEEP_ATK = 0.03;
const ENEMY_PRESSURE_MAX_SPEED_MULT = 1.85;
const RARITY_CONVERGENCE_START_FLOOR = 10;
const RARITY_CONVERGENCE_CHANCE = 0.25;
const RARITY_CONVERGENCE_WEIGHTS = Object.freeze({
  common: 26,
  uncommon: 26,
  rare: 28,
  epic: 15,
  legendary: 5
});
const RARITY_MULTIPLIER = Object.freeze({
  common: 1,
  uncommon: 1.1,
  rare: 1.22,
  epic: 1.36,
  legendary: 1.52,
  mythic: 1.7
});

function getAllowedDungeonTypeIds(floor) {
  if (floor <= 3) return STARTER_TYPE_IDS;

  return Array.from({ length: Math.min(floor + 1, MAX_DUNGEON_TYPE_ID) }, (item, index) => index + 1);
}

async function createDungeonEnemies(rng, floor, size, options = {}) {
  const allowedTypeIds = getAllowedDungeonTypeIds(floor);
  const teamSize = getDungeonEnemyTeamSize(floor, size);
  const positions = getEnemyPositions(teamSize);
  const eliteIndex = teamSize > 1 ? teamSize - 1 : 0;
  const encounterProfile = options.encounterProfile || getDungeonEncounterProfile(rng, floor);
  const pressure = getEnemyPressureMultipliers(floor, {
    ...options,
    rarityRebalanced: true,
    convergence: encounterProfile.convergence
  });
  const enemies = [];

  for (let index = 0; index < teamSize; index += 1) {
    const availableTypeIds = getAllowedEnemyTypeIds(allowedTypeIds, enemies);
    enemies.push(await createDemon(rng, {
      ...getEnemyGenerationOptions(floor, { elite: index === eliteIndex }),
      ...(encounterProfile.convergence ? { rarity: encounterProfile.convergence.rarity } : {}),
      instanceId: `enemy-${floor}-${index + 1}`,
      position: positions[index],
      allowedTypeIds: availableTypeIds
    }));
  }

  return assignFormationSlots(applyEnemyPreferredPositions(applyEnemyPressure(enemies, pressure)), 'enemy');
}

function getEnemyGenerationOptions(floor, options = {}) {
  const floorNumber = Number(floor) || 1;
  const pressure = getFloorSpawnPressure(floor);
  const elitePressure = options.elite ? Math.min(1, pressure + 0.32) : pressure;
  const rarityWeights = getDungeonRarityWeights(floorNumber);

  return {
    allowedRarities: Object.keys(rarityWeights),
    rarityWeights,
    typeWeightMultiplier: (typeId, baseWeight) => getFloorTypeWeightMultiplier(typeId, baseWeight, elitePressure),
  };
}

function getAllowedEnemyRarities(floor) {
  return Object.keys(getDungeonRarityWeights(floor));
}

function getDungeonRarityWeights(floor) {
  const floorNumber = Math.max(1, Number(floor) || 1);
  if (floorNumber === 1) return { common: 100 };
  if (floorNumber <= 3) return { common: 70, uncommon: 25, rare: 5 };
  if (floorNumber <= 6) return { common: 50, uncommon: 30, rare: 17, epic: 3 };
  if (floorNumber <= 9) return { common: 30, uncommon: 30, rare: 28, epic: 11, legendary: 1 };
  if (floorNumber <= 14) return { common: 20, uncommon: 25, rare: 30, epic: 20, legendary: 5 };
  if (floorNumber <= 19) return { common: 15, uncommon: 20, rare: 30, epic: 25, legendary: 9.8, mythic: 0.2 };
  return { common: 15, uncommon: 20, rare: 30, epic: 22, legendary: 12.5, mythic: 0.5 };
}

function getFloorSpawnPressure(floor) {
  return clamp((Number(floor) - 3) / (DIFFICULTY_RAMP_FLOORS - 3), 0, 1);
}

function getFloorTypeWeightMultiplier(typeId, baseWeight, pressure) {
  const rank = clamp((Number(typeId) - 1) / (MAX_DUNGEON_TYPE_ID - 1), 0, 1);
  const flattenBaseWeight = Math.pow(Math.max(1, Number(baseWeight) || 1), -pressure * 0.55);
  return flattenBaseWeight * (1 + pressure * rank * 3.2);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function getDungeonEnemyTeamSize(floor, fallbackSize) {
  const floorNumber = Number(floor) || 1;
  if (floorNumber === 1) return 1;

  // Early floors field one fewer enemy than the player's team limit so new
  // hunters aren't facing full-parity teams before they can build a roster.
  const earlyHandicap = floorNumber <= EARLY_FLOOR_HANDICAP_END ? 1 : 0;
  const baseSize = Math.max(2, getDungeonTeamLimit(floor) - earlyHandicap);
  const extraEnemies = floorNumber >= ENEMY_SIZE_INCREASE_START_FLOOR
    ? Math.floor((floorNumber - ENEMY_SIZE_INCREASE_START_FLOOR) / ENEMY_SIZE_INCREASE_INTERVAL) + 1
    : 0;

  return Math.min(MAX_DUNGEON_ENEMY_TEAM_SIZE, baseSize + extraEnemies);
}

function getEnemyPressureMultipliers(floor, options = {}) {
  const floorNumber = Math.max(1, Number(floor) || 1);
  const activePactCount = normalizeRunBuffState(options.buffs || options.runBuffs || {}).active.length;
  const endlessFloors = Math.max(0, floorNumber - ENEMY_PRESSURE_START_FLOOR);
  const linearFloors = Math.min(
    endlessFloors,
    ENEMY_PRESSURE_LINEAR_END_FLOOR - ENEMY_PRESSURE_START_FLOOR
  );
  const deepFloors = Math.max(0, floorNumber - ENEMY_PRESSURE_LINEAR_END_FLOOR);

  const rarityCompensation = options.rarityRebalanced ? getDungeonRarityCompensation(floorNumber) : 1;
  const convergenceCompensation = Number(options.convergence?.powerMultiplier) || 1;
  const useLinearTerror = options.terrorScaling === 'linear';
  const hpPressure = useLinearTerror
    ? 1 + endlessFloors * ENEMY_PRESSURE_FLOOR_HP + activePactCount * ENEMY_PRESSURE_PACT_HP
    : (1 + linearFloors * ENEMY_PRESSURE_FLOOR_HP + activePactCount * ENEMY_PRESSURE_PACT_HP)
      * Math.pow(1 + ENEMY_PRESSURE_FLOOR_HP, deepFloors);
  const attackPressure = useLinearTerror
    ? 1 + endlessFloors * ENEMY_PRESSURE_FLOOR_ATK + activePactCount * ENEMY_PRESSURE_PACT_ATK
    : (1 + linearFloors * ENEMY_PRESSURE_FLOOR_ATK + activePactCount * ENEMY_PRESSURE_PACT_ATK)
      * Math.pow(1 + ENEMY_PRESSURE_DEEP_ATK, deepFloors);
  const speedPressure = 1 + endlessFloors * ENEMY_PRESSURE_FLOOR_SPEED
    + activePactCount * ENEMY_PRESSURE_PACT_SPEED;

  return {
    hp: hpPressure * rarityCompensation * convergenceCompensation,
    atk: attackPressure * rarityCompensation * convergenceCompensation,
    speed: Math.min(
      ENEMY_PRESSURE_MAX_SPEED_MULT,
      speedPressure * rarityCompensation * convergenceCompensation
    )
  };
}

function getDungeonEncounterProfile(rng, floor) {
  const floorNumber = Math.max(1, Number(floor) || 1);
  if (floorNumber < RARITY_CONVERGENCE_START_FLOOR || rng() >= RARITY_CONVERGENCE_CHANCE) {
    return { convergence: null };
  }

  const rarity = pickWeightedRarity(rng, RARITY_CONVERGENCE_WEIGHTS);
  return { convergence: getDungeonConvergence(floorNumber, rarity) };
}

function getDungeonConvergence(floor, rarity) {
  const floorNumber = Math.max(1, Number(floor) || 1);
  const normalizedRarity = String(rarity || '').toLowerCase();
  if (floorNumber < RARITY_CONVERGENCE_START_FLOOR || !RARITY_CONVERGENCE_WEIGHTS[normalizedRarity]) {
    return null;
  }

  const normalRarityPower = getExpectedRarityMultiplier(getDungeonRarityWeights(floorNumber));
  const rarityPower = RARITY_MULTIPLIER[normalizedRarity] || 1;
  const powerMultiplier = Math.max(1, Math.pow(normalRarityPower / rarityPower, 0.85));
  const hostPowerMultiplier = roundMultiplier(rarityPower * powerMultiplier);
  const bonusTerror = Math.max(0, Math.round((powerMultiplier - 1) / ENEMY_PRESSURE_FLOOR_HP));

  return {
    id: 'rarity-convergence',
    name: `${capitalize(normalizedRarity)} Host${bonusTerror ? ` +${bonusTerror}` : ''}`,
    description: `Every enemy is ${capitalize(normalizedRarity)}. Host power combines their shared rarity with temporary encounter pressure; only the temporary pressure disappears when recruited.`,
    icon: 'sparkles',
    rarity: normalizedRarity,
    bonusTerror,
    powerMultiplier: roundMultiplier(powerMultiplier),
    hostPowerMultiplier,
    hpBonusPct: getBonusPercent(hostPowerMultiplier),
    atkBonusPct: getBonusPercent(hostPowerMultiplier),
    speedBonusPct: getBonusPercent(hostPowerMultiplier)
  };
}

function getDungeonRarityCompensation(floor) {
  const floorNumber = Math.max(1, Number(floor) || 1);
  const current = getExpectedRarityMultiplier(getDungeonRarityWeights(floorNumber));
  const legacyTarget = interpolateAnchors(floorNumber, [
    [1, 1],
    [3, 1.05],
    [6, 1.12],
    [9, 1.25],
    [14, 1.4],
    [19, 1.58],
    [29, 1.68],
    [30, 1.7]
  ]);
  return roundMultiplier(Math.max(1, legacyTarget / current));
}

function getExpectedRarityMultiplier(weights) {
  const entries = Object.entries(weights || {}).filter(([, weight]) => Number(weight) > 0);
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  if (!total) return 1;
  return entries.reduce((sum, [rarity, weight]) => sum + Number(weight) * (RARITY_MULTIPLIER[rarity] || 1), 0) / total;
}

function interpolateAnchors(value, anchors) {
  if (value <= anchors[0][0]) return anchors[0][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [floor, power] = anchors[index];
    const [previousFloor, previousPower] = anchors[index - 1];
    if (value <= floor) {
      const progress = (value - previousFloor) / Math.max(1, floor - previousFloor);
      return previousPower + (power - previousPower) * progress;
    }
  }
  return anchors[anchors.length - 1][1];
}

function pickWeightedRarity(rng, weights) {
  const entries = Object.entries(weights || {}).filter(([, weight]) => Number(weight) > 0);
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  let roll = rng() * total;
  for (const [rarity, weight] of entries) {
    roll -= Number(weight);
    if (roll <= 0) return rarity;
  }
  return entries[0]?.[0] || 'common';
}

function roundMultiplier(value) {
  return Math.round((Number(value) || 1) * 1000) / 1000;
}

function getBonusPercent(value) {
  return Math.max(0, Math.round(((Number(value) || 1) - 1) * 100));
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function applyEnemyPressure(enemies, pressure) {
  if (!enemies.length || !pressure || (pressure.hp === 1 && pressure.atk === 1 && pressure.speed === 1)) {
    return enemies;
  }

  return enemies.map((enemy) => {
    const baseMaxHp = Math.max(1, Number(enemy.maxHp) || Number(enemy.hp) || 1);
    const baseAtk = Math.max(1, Number(enemy.atk) || 1);
    const baseSpeed = Math.max(1, Number(enemy.speed) || 1);
    const maxHp = Math.max(1, Math.round(baseMaxHp * pressure.hp));

    return {
      ...enemy,
      runBaseMaxHp: baseMaxHp,
      runBaseAtk: baseAtk,
      runBaseSpeed: baseSpeed,
      maxHp,
      hp: maxHp,
      atk: Math.max(1, Math.round(baseAtk * pressure.atk)),
      speed: Math.max(1, Math.round(baseSpeed * pressure.speed))
    };
  });
}

function getEnemyPositions(size) {
  if (size <= 1) return ['front'];
  if (size === 2) return ['front', 'back'];
  return Array.from({ length: size }, (item, index) => (index % 2 === 0 ? 'front' : 'back'));
}

function getEnemyPreferredPosition(demon) {
  if ([1, 5, 7, 8, 9].includes(Number(demon.typeId))) return 'front';
  if ([2, 3, 4, 6, 10, 11].includes(Number(demon.typeId))) return 'back';
  return demon.position === 'back' ? 'back' : 'front';
}

function applyEnemyPreferredPositions(enemies) {
  return enemies.map((demon) => ({
    ...demon,
    position: getEnemyPreferredPosition(demon)
  }));
}

module.exports = {
  STARTER_TYPE_IDS,
  createDungeonEnemies,
  getAllowedDungeonTypeIds,
  getAllowedEnemyRarities,
  getDungeonConvergence,
  getDungeonEncounterProfile,
  getDungeonRarityCompensation,
  getDungeonRarityWeights,
  getEnemyGenerationOptions,
  getExpectedRarityMultiplier,
  getEnemyPressureMultipliers,
  getDungeonEnemyTeamSize,
  MAX_DUNGEON_ENEMY_TEAM_SIZE
};
