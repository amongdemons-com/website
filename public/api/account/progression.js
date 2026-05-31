const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getNextAccountLevel } = require('../lib/progression');

const router = express.Router();

router.get('/account/progression', requireAuth, async (req, res) => {
  const level = getNextAccountLevel(req.player.level, req.player.xp);

  res.json({
    level,
    xp: req.player.xp,
    souls: req.player.souls,
    highestFloor: req.player.highestFloor || 0,
    unlocks: req.player.unlocks
  });
});

module.exports = router;
