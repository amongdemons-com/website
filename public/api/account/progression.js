const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getNextAccountLevel, getXpForAccountLevel } = require('../lib/progression');

const router = express.Router();

router.get('/account/progression', requireAuth, async (req, res) => {
  const level = getNextAccountLevel(req.player.level, req.player.xp);
  const xp = Math.max(0, Math.floor(Number(req.player.xp) || 0));
  const currentLevelXp = getXpForAccountLevel(level);
  const nextLevelXp = getXpForAccountLevel(level + 1);
  const xpForNextLevel = Math.max(1, nextLevelXp - currentLevelXp);
  const xpIntoLevel = Math.min(xpForNextLevel, Math.max(0, xp - currentLevelXp));

  res.json({
    level,
    xp,
    levelProgress: {
      currentLevelXp,
      nextLevelXp,
      xpIntoLevel,
      xpForNextLevel,
      xpToNextLevel: Math.max(0, nextLevelXp - xp),
      percent: xpIntoLevel / xpForNextLevel
    },
    souls: req.player.souls,
    highestFloor: req.player.highestFloor || 0,
    unlocks: req.player.unlocks
  });
});

module.exports = router;
