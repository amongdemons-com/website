const express = require('express');
const { requireAuth } = require('./lib/auth');
const { getPlayerStatPointSummary } = require('./lib/account-stat-points');
const { getPlayerCollection } = require('./lib/collection-demons');
const { getDailyQuestStateForPlayer } = require('./lib/daily-quests');
const { getCollectionEchoes } = require('./lib/echo-bag');
const { getAccountProgressionPayload } = require('./lib/progression');
const { getOrCreateCurrentSeason, getRankedRating } = require('./lib/ranked-runs');
const { getActiveWorldBossRewardBuffs } = require('./lib/world-bosses');
const { getActiveSoulFontBuffs } = require('./lib/world-soul-font');
const { isLeaderboardReviewPlayer } = require('./lib/leaderboard-review');

const router = express.Router();

router.get('/camp/bootstrap', requireAuth, async (req, res) => {
  const season = await getOrCreateCurrentSeason();
  const [questData, statPoints, demons, ranked, bossBuffs, soulFontBuffs] = await Promise.all([
    getDailyQuestStateForPlayer(req.player),
    getPlayerStatPointSummary(req.player),
    getPlayerCollection(req.player.id),
    getRankedRating(req.player.id, season.id),
    getActiveWorldBossRewardBuffs(req.player.id),
    getActiveSoulFontBuffs(req.player.id)
  ]);
  const worldBuffs = [...bossBuffs, ...soulFontBuffs];

  res.json({
    player: {
      ...req.player,
      leaderboardReview: isLeaderboardReviewPlayer(req.player)
    },
    progression: getAccountProgressionPayload(req.player),
    ranked,
    questData,
    statPoints,
    demons,
    worldBuffs
  });
});

router.get('/collection/bootstrap', requireAuth, async (req, res) => {
  const [demons, echoes] = await Promise.all([
    getPlayerCollection(req.player.id),
    getCollectionEchoes(req.player.id)
  ]);

  res.json({
    player: req.player,
    progression: getAccountProgressionPayload(req.player),
    demons,
    echoes
  });
});

module.exports = router;
