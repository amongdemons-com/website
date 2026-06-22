const db = require('./db');
const { getNextAccountLevel } = require('./progression');

const STAT_KEYS = Object.freeze([
  'vitality',
  'power',
  'haste',
  'fortitude',
  'recovery'
]);

const ZERO_ALLOCATIONS = Object.freeze({
  vitality: 0,
  power: 0,
  haste: 0,
  fortitude: 0,
  recovery: 0
});

function getAccountLevel(player = {}) {
  return getNextAccountLevel(player.level, player.xp);
}

function getTotalStatPoints(level) {
  return Math.max(0, Math.floor(Number(level) || 1) - 1);
}

function normalizeStoredAllocations(source = {}) {
  return STAT_KEYS.reduce((allocations, key) => {
    allocations[key] = Math.max(0, Math.floor(Number(source[key]) || 0));
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
    if (!Number.isSafeInteger(value) || value < 0) {
      throwStatPointError(`${capitalize(key)} points must be a non-negative integer.`);
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

  return {
    maxHpPercent: roundPercent(allocations.vitality * 3),
    attackPercent: roundPercent(allocations.power * 3),
    speedPercent: roundPercent(allocations.haste * 1.5),
    damageReductionPercent: roundPercent(Math.min(30, allocations.fortitude * 2)),
    healingReceivedPercent: roundPercent(allocations.recovery * 3)
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
    bonuses: calculateStatBonuses(allocations)
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
  ZERO_ALLOCATIONS,
  calculateStatBonuses,
  createStatPointSummary,
  getPlayerStatPointSummary,
  getTotalStatPoints,
  normalizeStoredAllocations,
  resetPlayerStatAllocations,
  savePlayerStatAllocations,
  validateAllocationInput
};
