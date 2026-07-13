const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getPlayerAchievements } = require('../lib/achievements');

const router = express.Router();

router.get('/account/achievements', requireAuth, async (req, res) => {
  res.json({ achievements: await getPlayerAchievements(req.player.id) });
});

module.exports = router;
