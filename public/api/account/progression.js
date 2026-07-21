const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getAccountProgressionSummary } = require('../lib/progression');

const router = express.Router();

router.get('/account/progression', requireAuth, async (req, res) => {
  res.json({
    ...getAccountProgressionSummary(req.player.level, req.player.xp),
    souls: req.player.souls,
    highestFloor: req.player.highestFloor || 0,
    unlocks: req.player.unlocks
  });
});

module.exports = router;
