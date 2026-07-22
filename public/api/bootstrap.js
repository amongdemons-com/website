const express = require('express');
const { requireAuth } = require('./lib/auth');
const { getPlayerStatPointSummary } = require('./lib/account-stat-points');
const { getPlayerCollection } = require('./lib/collection-demons');
const { getDailyQuestStateForPlayer } = require('./lib/daily-quests');
const { getPlayerBag } = require('./lib/echo-bag');
const { getAccountProgressionPayload } = require('./lib/progression');

const router = express.Router();

router.get('/camp/bootstrap', requireAuth, async (req, res) => {
  const [questData, statPoints, demons] = await Promise.all([
    getDailyQuestStateForPlayer(req.player),
    getPlayerStatPointSummary(req.player),
    getPlayerCollection(req.player.id)
  ]);

  res.json({
    player: req.player,
    progression: getAccountProgressionPayload(req.player),
    questData,
    statPoints,
    demons
  });
});

router.get('/collection/bootstrap', requireAuth, async (req, res) => {
  const [demons, bag] = await Promise.all([
    getPlayerCollection(req.player.id),
    getPlayerBag(req.player.id)
  ]);

  res.json({
    player: req.player,
    progression: getAccountProgressionPayload(req.player),
    demons,
    bag
  });
});

module.exports = router;
