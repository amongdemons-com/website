const express = require('express');
const { requireAuth } = require('../lib/auth');
const {
  getPlayerStatPointSummary,
  resetPlayerStatAllocations,
  savePlayerStatAllocations
} = require('../lib/account-stat-points');
const achievements = require('../lib/achievements');

const router = express.Router();

router.get('/account/stat-points', requireAuth, async (req, res) => {
  res.json(await getPlayerStatPointSummary(req.player));
});

router.post('/account/stat-points', requireAuth, async (req, res) => {
  const summary = await savePlayerStatAllocations(req.player, req.body?.allocations);

  // "Endless" nodes are the uncapped *_mastery allocations in the skill tree.
  const investedInMastery = Object.entries(summary.allocations || {})
    .some(([key, value]) => key.endsWith('_mastery') && Number(value) > 0);
  if (investedInMastery) {
    await achievements.grantAchievements(req.player.id, ['endless-hunger']);
  }

  res.json(summary);
});

router.post('/account/stat-points/reset', requireAuth, async (req, res) => {
  res.json(await resetPlayerStatAllocations(req.player));
});

module.exports = router;
