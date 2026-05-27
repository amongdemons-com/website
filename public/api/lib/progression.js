const ACCOUNT_LEVEL_BASE_XP = 250;
const ACCOUNT_LEVEL_EXPONENT = 1.65;

function getAccountLevelForXp(xp) {
  const totalXp = Math.max(0, Math.floor(Number(xp) || 0));
  let level = Math.floor(Math.pow(totalXp / ACCOUNT_LEVEL_BASE_XP, 1 / ACCOUNT_LEVEL_EXPONENT)) + 1;

  while (getXpForAccountLevel(level + 1) <= totalXp) level += 1;
  while (level > 1 && getXpForAccountLevel(level) > totalXp) level -= 1;

  return level;
}

function getNextAccountLevel(currentLevel, xp) {
  return Math.max(Number(currentLevel) || 1, getAccountLevelForXp(xp));
}

function getXpForAccountLevel(level) {
  const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
  if (targetLevel <= 1) return 0;

  return Math.ceil(ACCOUNT_LEVEL_BASE_XP * Math.pow(targetLevel - 1, ACCOUNT_LEVEL_EXPONENT));
}

module.exports = {
  ACCOUNT_LEVEL_BASE_XP,
  ACCOUNT_LEVEL_EXPONENT,
  getAccountLevelForXp,
  getNextAccountLevel,
  getXpForAccountLevel
};
