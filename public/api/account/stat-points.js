const express = require('express');
const { requireAuth } = require('../lib/auth');
const {
  getPlayerStatPointSummary,
  resetPlayerStatAllocations,
  savePlayerStatAllocations
} = require('../lib/account-stat-points');

const router = express.Router();

router.get('/account/stat-points', requireAuth, async (req, res) => {
  res.json(await getPlayerStatPointSummary(req.player));
});

router.post('/account/stat-points', requireAuth, async (req, res) => {
  res.json(await savePlayerStatAllocations(req.player, req.body?.allocations));
});

router.post('/account/stat-points/reset', requireAuth, async (req, res) => {
  res.json(await resetPlayerStatAllocations(req.player));
});

module.exports = router;
