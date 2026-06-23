const db = require('./db');
const { getNextAccountLevel } = require('./progression');

const STAT_KEYS = Object.freeze([
  'vitality',
  'power',
  'haste',
  'fortitude',
  'recovery'
]);
const MAX_STAT_POINTS = 5;

const ZERO_ALLOCATIONS = Object.freeze({
  vitality: 0,
  power: 0,
  haste: 0,
  fortitude: 0,
  recovery: 0
});

const PATH_DEFINITIONS = Object.freeze({
  ravager: Object.freeze({ keys: Object.freeze(['power']), threshold: 5, bonusKey: 'attackPercent', bonus: 5 }),
  tempest: Object.freeze({ keys: Object.freeze(['haste']), threshold: 5, bonusKey: 'speedPercent', bonus: 3 }),
  colossus: Object.freeze({ keys: Object.freeze(['vitality']), threshold: 5, bonusKey: 'maxHpPercent', bonus: 5 }),
  aegis: Object.freeze({ keys: Object.freeze(['fortitude']), threshold: 5, bonusKey: 'damageReductionPercent', bonus: 5 }),
  soulbinder: Object.freeze({ keys: Object.freeze(['recovery']), threshold: 5, bonusKey: 'healingReceivedPercent', bonus: 8 })
});

function getAccountLevel(player = {}) {
  return getNextAccountLevel(player.level, player.xp);
}

function getTotalStatPoints(level) {
  return Math.min(STAT_KEYS.length * MAX_STAT_POINTS, Math.max(0, Math.floor(Number(level) || 1) - 1));
}

function normalizeStoredAllocations(source = {}) {
  return STAT_KEYS.reduce((allocations, key) => {
    allocations[key] = Math.min(MAX_STAT_POINTS, Math.max(0, Math.floor(Number(source[key]) || 0)));
    return allocations;
  }, {});
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
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_STAT_POINTS) {
      throwStatPointError(`${capitalize(key)} points must be an integer from 0 to ${MAX_STAT_POINTS}.`);
    }
    allocations[key] = value;
  });

  const spentPoints = getSpentPoints(allocations);
  if (spentPoints > totalPoints) {
    throwStatPointError(`You can spend at most ${totalPoints} level point${totalPoints === 1 ? '' : 's'}.`);
  }

  return allocations;
}

function calculateStatBonuses(source = {}) {
  const allocations = normalizeStoredAllocations(source);
  const paths = calculatePathBonuses(allocations);

  return {
    maxHpPercent: roundPercent(allocations.vitality * 3 + paths.colossus.bonus),
    attackPercent: roundPercent(allocations.power * 3 + paths.ravager.bonus),
    speedPercent: roundPercent(allocations.haste * 1.5 + paths.tempest.bonus),
    damageReductionPercent: roundPercent(Math.min(30, allocations.fortitude * 2 + paths.aegis.bonus)),
    healingReceivedPercent: roundPercent(allocations.recovery * 3 + paths.soulbinder.bonus)
  };
}

function calculatePathBonuses(source = {}) {
  const allocations = normalizeStoredAllocations(source);

  return Object.entries(PATH_DEFINITIONS).reduce((paths, [key, definition]) => {
    const points = definition.keys.reduce((sum, statKey) => sum + allocations[statKey], 0);
    const unlocked = points >= definition.threshold;
    paths[key] = {
      points,
      threshold: definition.threshold,
      unlocked,
      bonusKey: definition.bonusKey,
      bonus: unlocked ? definition.bonus : 0
    };
    return paths;
  }, {});
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
    paths: calculatePathBonuses(allocations)
  };
}

async function getPlayerStatPointSummary(player) {
  const [rows] = await db.query(
    `SELECT vitality, power, haste, fortitude, recovery
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

  await db.query(
    `INSERT INTO player_stat_points
       (player_id, vitality, power, haste, fortitude, recovery)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       vitality = VALUES(vitality),
       power = VALUES(power),
       haste = VALUES(haste),
       fortitude = VALUES(fortitude),
       recovery = VALUES(recovery)`,
    [
      player.id,
      allocations.vitality,
      allocations.power,
      allocations.haste,
      allocations.fortitude,
      allocations.recovery
    ]
  );

  return createStatPointSummary(player, allocations);
}

async function resetPlayerStatAllocations(player) {
  return savePlayerStatAllocations(player, ZERO_ALLOCATIONS);
}

function getSpentPoints(allocations) {
  return STAT_KEYS.reduce((sum, key) => sum + (Number(allocations[key]) || 0), 0);
}

function roundPercent(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function capitalize(value) {
  const text = String(value || '');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

function throwStatPointError(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

module.exports = {
  STAT_KEYS,
  MAX_STAT_POINTS,
  PATH_DEFINITIONS,
  ZERO_ALLOCATIONS,
  calculatePathBonuses,
  calculateStatBonuses,
  createStatPointSummary,
  getPlayerStatPointSummary,
  getTotalStatPoints,
  normalizeStoredAllocations,
  resetPlayerStatAllocations,
  savePlayerStatAllocations,
  validateAllocationInput
};
