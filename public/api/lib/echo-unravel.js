const {
  MAX_ACCOUNT_LEVEL,
  getNextAccountLevel,
  getXpForAccountLevel,
  normalizeAccountLevel
} = require('./progression');
const { MYTHIC_ECHO_UNRAVEL_LEVELS } = require('./echo-config');

function getMythicEchoUnravelProgression(level, xp) {
  const storedXp = Math.max(0, Math.floor(Number(xp) || 0));
  const currentLevel = getNextAccountLevel(level, storedXp);
  const targetLevel = normalizeAccountLevel(currentLevel + MYTHIC_ECHO_UNRAVEL_LEVELS);
  const levelsGranted = Math.max(0, targetLevel - currentLevel);
  const xpGranted = levelsGranted > 0
    ? getXpForAccountLevel(targetLevel) - getXpForAccountLevel(currentLevel)
    : 0;
  const nextXp = storedXp + xpGranted;

  return {
    currentLevel,
    targetLevel,
    levelsGranted,
    xpGranted,
    nextXp,
    isMaxLevel: targetLevel >= MAX_ACCOUNT_LEVEL
  };
}

module.exports = {
  MYTHIC_ECHO_UNRAVEL_LEVELS,
  getMythicEchoUnravelProgression
};
