const express = require('express');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

router.get('/account/progression', requireAuth, async (req, res) => {
  res.json({
    level: req.player.level,
    xp: req.player.xp,
    souls: req.player.souls,
    unlocks: req.player.unlocks
  });
});

module.exports = router;
