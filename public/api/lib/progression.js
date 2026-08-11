const ACCOUNT_LEVEL_BASE_XP = 250;
const ACCOUNT_LEVEL_EXPONENT = 1.65;
const MAX_ACCOUNT_LEVEL = 666;

function normalizeAccountLevel(level) {
  return Math.min(
    MAX_ACCOUNT_LEVEL,
    Math.max(1, Math.floor(Number(level) || 1))
  );
}

function getAccountLevelForXp(xp) {
  const totalXp = Math.max(0, Math.floor(Number(xp) || 0));
  let level = normalizeAccountLevel(
    Math.floor(Math.pow(totalXp / ACCOUNT_LEVEL_BASE_XP, 1 / ACCOUNT_LEVEL_EXPONENT)) + 1
  );

  while (level < MAX_ACCOUNT_LEVEL && getXpForAccountLevel(level + 1) <= totalXp) level += 1;
  while (level > 1 && getXpForAccountLevel(level) > totalXp) level -= 1;

  return level;
}

function getNextAccountLevel(currentLevel, xp) {
  return normalizeAccountLevel(Math.max(
    normalizeAccountLevel(currentLevel),
    getAccountLevelForXp(xp)
  ));
}

function getXpForAccountLevel(level) {
  const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (targetLevel <= 1) return 0;

  return Math.ceil(ACCOUNT_LEVEL_BASE_XP * Math.pow(targetLevel - 1, ACCOUNT_LEVEL_EXPONENT));
}

// Response shape consumed by the client's nav XP progress bar. XP-granting
// endpoints pass `previousLevel` so the client gets an authoritative, one-shot
// level-up event instead of inferring one from potentially stale nav state.
function getAccountProgressionSummary(level, xp, options = {}) {
  const resolvedLevel = getNextAccountLevel(level, xp);
  const totalXp = Math.max(0, Math.floor(Number(xp) || 0));
  const isMaxLevel = resolvedLevel >= MAX_ACCOUNT_LEVEL;
  const currentLevelXp = getXpForAccountLevel(resolvedLevel);
  const nextLevelXp = isMaxLevel ? currentLevelXp : getXpForAccountLevel(resolvedLevel + 1);
  const xpForNextLevel = isMaxLevel ? 0 : Math.max(1, nextLevelXp - currentLevelXp);
  const xpIntoLevel = isMaxLevel
    ? 0
    : Math.min(xpForNextLevel, Math.max(0, totalXp - currentLevelXp));
  const hasPreviousLevel = Object.prototype.hasOwnProperty.call(options, 'previousLevel');
  const previousLevel = hasPreviousLevel
    ? normalizeAccountLevel(options.previousLevel)
    : null;

  return {
    level: resolvedLevel,
    xp: totalXp,
    isMaxLevel,
    ...(hasPreviousLevel ? {
      previousLevel,
      leveledUp: resolvedLevel > previousLevel
    } : {}),
    levelProgress: {
      currentLevelXp,
      nextLevelXp,
      xpIntoLevel,
      xpForNextLevel,
      xpToNextLevel: isMaxLevel ? 0 : Math.max(0, nextLevelXp - totalXp),
      percent: isMaxLevel ? 1 : xpIntoLevel / xpForNextLevel,
      isMaxLevel
    }
  };
}

function getAccountProgressionPayload(player = {}, options = {}) {
  return {
    ...getAccountProgressionSummary(player.level, player.xp, options),
    souls: Math.max(0, Number(player.souls) || 0),
    highestFloor: Math.max(0, Number(player.highestFloor ?? player.highest_floor) || 0),
    unlocks: Array.isArray(player.unlocks) ? player.unlocks : []
  };
}

// Collapses XP down to the floor of the level it already reached: the level
// derived from the result always equals the level derived from the input, so
// normalizing can trim progress toward the next level but never demote.
function getNormalizedAccountXp(xp) {
  return getXpForAccountLevel(getAccountLevelForXp(xp));
}

module.exports = {
  ACCOUNT_LEVEL_BASE_XP,
  ACCOUNT_LEVEL_EXPONENT,
  MAX_ACCOUNT_LEVEL,
  getAccountLevelForXp,
  getAccountProgressionPayload,
  getAccountProgressionSummary,
  getNextAccountLevel,
  getNormalizedAccountXp,
  getXpForAccountLevel,
  normalizeAccountLevel
};
