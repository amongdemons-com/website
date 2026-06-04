const { createDemon } = require('./demon-factory');
const { getDungeonTeamLimit } = require('./dungeon-rules');
const { assignFormationSlots } = require('./run-demons');

const STARTER_TYPE_IDS = [1, 2, 3];
const MAX_HUNT_TYPE_ID = 11;
const MAX_HUNT_ENEMY_TEAM_SIZE = 9;
const ENEMY_SIZE_INCREASE_START_FLOOR = 25;
const ENEMY_SIZE_INCREASE_INTERVAL = 5;
const DIFFICULTY_RAMP_FLOORS = 20;
const RARITY_RANK = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5
};

function getAllowedHuntTypeIds(floor) {
  if (floor <= 3) return STARTER_TYPE_IDS;

  return Array.from({ length: Math.min(floor + 1, MAX_HUNT_TYPE_ID) }, (item, index) => index + 1);
}

async function createHuntEnemies(rng, floor, size) {
  const allowedTypeIds = getAllowedHuntTypeIds(floor);
  const teamSize = getHuntEnemyTeamSize(floor, size);
  const positions = getEnemyPositions(teamSize);
  const eliteIndex = teamSize > 1 ? teamSize - 1 : 0;
  const enemies = [];

  for (let index = 0; index < teamSize; index += 1) {
    enemies.push(await createDemon(rng, {
      ...getEnemyGenerationOptions(floor, { elite: index === eliteIndex }),
      instanceId: `enemy-${floor}-${index + 1}`,
      position: positions[index],
      allowedTypeIds
    }));
  }

  return assignFormationSlots(applyEnemyPreferredPositions(enemies), 'enemy');
}

function getEnemyGenerationOptions(floor, options = {}) {
  const floorNumber = Number(floor) || 1;
  if (floorNumber === 1) {
    return {
      allowedRarities: ['common']
    };
  }

  if (floorNumber <= 3) {
    return {
      allowedRarities: ['common', 'uncommon', 'rare']
    };
  }

  const pressure = getFloorSpawnPressure(floor);
  const elitePressure = options.elite ? Math.min(1, pressure + 0.32) : pressure;

  return {
    allowedRarities: getAllowedEnemyRarities(floor),
    typeWeightMultiplier: (typeId, baseWeight) => getFloorTypeWeightMultiplier(typeId, baseWeight, elitePressure),
    rarityWeightMultiplier: (rarity, baseWeight) => getFloorRarityWeightMultiplier(rarity, baseWeight, elitePressure)
  };
}

function getAllowedEnemyRarities(floor) {
  const floorNumber = Number(floor) || 1;
  if (floorNumber === 1) return ['common'];
  if (floorNumber <= 3) return ['common', 'uncommon', 'rare'];
  if (floorNumber < 7) return ['common', 'uncommon', 'rare', 'epic'];
  if (floorNumber < 10) return ['uncommon', 'rare', 'epic'];
  if (floorNumber < 15) return ['rare', 'epic', 'legendary'];
  if (floorNumber < 20) return ['epic', 'legendary', 'mythic'];
  if (floorNumber < 30) return ['legendary', 'mythic'];
  return ['mythic'];
}

function getFloorSpawnPressure(floor) {
  return clamp((Number(floor) - 3) / (DIFFICULTY_RAMP_FLOORS - 3), 0, 1);
}

function getFloorTypeWeightMultiplier(typeId, baseWeight, pressure) {
  const rank = clamp((Number(typeId) - 1) / (MAX_HUNT_TYPE_ID - 1), 0, 1);
  const flattenBaseWeight = Math.pow(Math.max(1, Number(baseWeight) || 1), -pressure * 0.55);
  return flattenBaseWeight * (1 + pressure * rank * 3.2);
}

function getFloorRarityWeightMultiplier(rarity, baseWeight, pressure) {
  const rank = RARITY_RANK[rarity] ?? 0;
  const normalizedRank = rank / RARITY_RANK.mythic;
  const highTierBoost = 1 + pressure * Math.pow(normalizedRank, 1.5) * 18;
  const lowTierPenalty = Math.pow(Math.max(0.08, 1 - pressure * 0.72), RARITY_RANK.mythic - rank);

  return Math.max(0.04, highTierBoost * lowTierPenalty);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function getHuntEnemyTeamSize(floor, fallbackSize) {
  const floorNumber = Number(floor) || 1;
  if (floorNumber === 1) return 1;

  const baseSize = getDungeonTeamLimit(floor);
  const extraEnemies = floorNumber >= ENEMY_SIZE_INCREASE_START_FLOOR
    ? Math.floor((floorNumber - ENEMY_SIZE_INCREASE_START_FLOOR) / ENEMY_SIZE_INCREASE_INTERVAL) + 1
    : 0;

  return Math.min(MAX_HUNT_ENEMY_TEAM_SIZE, baseSize + extraEnemies);
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
  createHuntEnemies,
  getAllowedHuntTypeIds,
  getAllowedEnemyRarities,
  getEnemyGenerationOptions,
  getHuntEnemyTeamSize,
  MAX_HUNT_ENEMY_TEAM_SIZE
};
