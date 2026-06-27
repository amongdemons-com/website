const db = require('./db');
const { getNextAccountLevel } = require('./progression');

const NODE_DEFINITIONS = Object.freeze({
  health_flat: Object.freeze({ label: 'Max Health', cap: 5, requires: [] }),
  health_percent: Object.freeze({ label: 'Max Health %', cap: 5, requires: [['health_flat', 5]] }),
  health_mastery: Object.freeze({ label: 'Endless Health', cap: Infinity, requires: [['health_percent', 5]] }),
  healing_percent: Object.freeze({ label: 'Healing %', cap: 5, requires: [['health_flat', 5]] }),
  healing_mastery: Object.freeze({ label: 'Endless Healing', cap: Infinity, requires: [['healing_percent', 5]] }),
  thorns_percent: Object.freeze({ label: 'Thorns %', cap: 5, requires: [['health_flat', 5]] }),
  thorns_mastery: Object.freeze({ label: 'Endless Thorns', cap: Infinity, requires: [['thorns_percent', 5]] }),
  speed_flat: Object.freeze({ label: 'Speed', cap: 5, requires: [] }),
  speed_percent: Object.freeze({ label: 'Speed %', cap: 5, requires: [['speed_flat', 5]] }),
  speed_mastery: Object.freeze({ label: 'Endless Speed', cap: Infinity, requires: [['speed_percent', 5]] }),
  attack_percent: Object.freeze({ label: 'Attack Damage %', cap: 5, requires: [['speed_flat', 5]] }),
  attack_mastery: Object.freeze({ label: 'Endless Attack', cap: Infinity, requires: [['attack_percent', 5]] }),
  aoe_percent: Object.freeze({ label: 'AOE Damage %', cap: 5, requires: [['speed_flat', 5]] }),
  aoe_mastery: Object.freeze({ label: 'Endless AOE', cap: Infinity, requires: [['aoe_percent', 5]] }),
  poison_flat: Object.freeze({ label: 'Poison Damage', cap: 5, requires: [] }),
  poison_percent: Object.freeze({ label: 'Poison Damage %', cap: 5, requires: [['poison_flat', 5]] }),
  poison_mastery: Object.freeze({ label: 'Endless Poison', cap: Infinity, requires: [['poison_percent', 5]] })
});

const STAT_KEYS = Object.freeze(Object.keys(NODE_DEFINITIONS));
const ZERO_ALLOCATIONS = Object.freeze(STAT_KEYS.reduce((allocations, key) => {
  allocations[key] = 0;
  return allocations;
}, {}));

function getAccountLevel(player = {}) {
  return getNextAccountLevel(player.level, player.xp);
}

function getTotalStatPoints(level) {
  return Math.max(0, Math.floor(Number(level) || 1) - 1);
}

function normalizeStoredAllocations(source = {}) {
  const allocations = STAT_KEYS.reduce((normalized, key) => {
    const definition = NODE_DEFINITIONS[key];
    const value = Math.max(0, Math.floor(Number(source[key]) || 0));
    normalized[key] = Number.isFinite(definition.cap) ? Math.min(value, definition.cap) : value;
    return normalized;
  }, {});

  STAT_KEYS.forEach((key) => {
    if (!requirementsMet(allocations, NODE_DEFINITIONS[key].requires)) {
      allocations[key] = 0;
    }
  });

  return allocations;
}

function validateAllocationInput(source, totalPoints) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throwStatPointError('Allocations must be an object.');
  }

  const unknownKeys = Object.keys(source).filter((key) => !STAT_KEYS.includes(key));
  if (unknownKeys.length) {
    throwStatPointError(`Unknown stat allocation: ${unknownKeys[0]}.`);
  }

  const allocations = { ...ZERO_ALLOCATIONS };

  STAT_KEYS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return;

    const value = Number(source[key]);
    const definition = NODE_DEFINITIONS[key];
    if (!Number.isSafeInteger(value) || value < 0) {
      throwStatPointError(`${definition.label} points must be a non-negative integer.`);
    }
    if (Number.isFinite(definition.cap) && value > definition.cap) {
      throwStatPointError(`${definition.label} can have at most ${definition.cap} points.`);
    }
    allocations[key] = value;
  });

  STAT_KEYS.forEach((key) => {
    const definition = NODE_DEFINITIONS[key];
    if (allocations[key] > 0 && !requirementsMet(allocations, definition.requires)) {
      const [requiredKey, requiredRank] = definition.requires[0];
      throwStatPointError(`${definition.label} requires ${NODE_DEFINITIONS[requiredKey].label} ${requiredRank}/${requiredRank}.`);
    }
  });

  const spentPoints = getSpentPoints(allocations);
  if (spentPoints > totalPoints) {
    throwStatPointError(`You can spend at most ${totalPoints} level point${totalPoints === 1 ? '' : 's'}.`);
  }

  return allocations;
}

function calculateStatBonuses(source = {}) {
  const allocations = normalizeStoredAllocations(source);

  return {
    maxHpFlat: (allocations.health_flat * 5) + (allocations.health_mastery * 5),
    maxHpPercent: roundPercent(allocations.health_percent * 3),
    healingFlat: allocations.healing_mastery,
    healingPercent: roundPercent(allocations.healing_percent * 3),
    thornsFlat: allocations.thorns_mastery,
    thornsPercent: roundPercent(allocations.thorns_percent * 5),
    speedFlat: allocations.speed_flat + allocations.speed_mastery,
    speedPercent: roundPercent(allocations.speed_percent * 2),
    attackFlat: allocations.attack_mastery,
    attackPercent: roundPercent(allocations.attack_percent * 3),
    aoeDamageFlat: allocations.aoe_mastery,
    aoeDamagePercent: roundPercent(allocations.aoe_percent * 2),
    poisonDamageFlat: allocations.poison_flat + allocations.poison_mastery,
    poisonDamagePercent: roundPercent(allocations.poison_percent * 3)
  };
}

function calculatePathProgress(source = {}) {
  const allocations = normalizeStoredAllocations(source);

  return {
    health: {
      root: allocations.health_flat,
      branches: {
        maxHealth: { node: allocations.health_percent, mastery: allocations.health_mastery },
        healing: { node: allocations.healing_percent, mastery: allocations.healing_mastery },
        thorns: { node: allocations.thorns_percent, mastery: allocations.thorns_mastery }
      }
    },
    offense: {
      root: allocations.speed_flat,
      branches: {
        speed: { node: allocations.speed_percent, mastery: allocations.speed_mastery },
        attack: { node: allocations.attack_percent, mastery: allocations.attack_mastery },
        aoe: { node: allocations.aoe_percent, mastery: allocations.aoe_mastery }
      }
    },
    poison: {
      root: allocations.poison_flat,
      branches: {
        poison: { node: allocations.poison_percent, mastery: allocations.poison_mastery }
      }
    }
  };
}

function createStatPointSummary(player, source = {}) {
  const level = getAccountLevel(player);
  const totalPoints = getTotalStatPoints(level);
  const allocations = normalizeStoredAllocations(source);
  const spentPoints = getSpentPoints(allocations);

  return {
    level,
    totalPoints,
    spentPoints,
    unspentPoints: Math.max(0, totalPoints - spentPoints),
    allocations,
    bonuses: calculateStatBonuses(allocations),
    paths: calculatePathProgress(allocations)
  };
}

async function getPlayerStatPointSummary(player) {
  const [rows] = await db.query(
    `SELECT ${STAT_KEYS.join(', ')}
     FROM player_stat_points
     WHERE player_id = ?
     LIMIT 1`,
    [player.id]
  );

  return createStatPointSummary(player, rows[0] || ZERO_ALLOCATIONS);
}

async function savePlayerStatAllocations(player, source) {
  const level = getAccountLevel(player);
  const allocations = validateAllocationInput(source, getTotalStatPoints(level));
  const columns = STAT_KEYS.join(', ');
  const placeholders = STAT_KEYS.map(() => '?').join(', ');
  const updates = STAT_KEYS.map((key) => `${key} = VALUES(${key})`).join(',\n       ');

  await db.query(
    `INSERT INTO player_stat_points
       (player_id, ${columns})
     VALUES (?, ${placeholders})
     ON DUPLICATE KEY UPDATE
       ${updates}`,
    [player.id, ...STAT_KEYS.map((key) => allocations[key])]
  );

  return createStatPointSummary(player, allocations);
}

async function resetPlayerStatAllocations(player) {
  return savePlayerStatAllocations(player, ZERO_ALLOCATIONS);
}

function requirementsMet(allocations, requirements = []) {
  return requirements.every(([key, rank]) => Number(allocations[key]) >= rank);
}

function getSpentPoints(allocations) {
  return STAT_KEYS.reduce((sum, key) => sum + (Number(allocations[key]) || 0), 0);
}

function roundPercent(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function throwStatPointError(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

module.exports = {
  NODE_DEFINITIONS,
  STAT_KEYS,
  ZERO_ALLOCATIONS,
  calculatePathProgress,
  calculateStatBonuses,
  createStatPointSummary,
  getPlayerStatPointSummary,
  getTotalStatPoints,
  normalizeStoredAllocations,
  resetPlayerStatAllocations,
  savePlayerStatAllocations,
  validateAllocationInput
};
