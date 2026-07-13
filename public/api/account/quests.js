const express = require('express');
const { requireAuth } = require('../lib/auth');
const {
  claimDailyQuest,
  claimDailyReward,
  getDailyQuestStateForPlayer
} = require('../lib/daily-quests');
const achievements = require('../lib/achievements');

const router = express.Router();

router.get('/account/quests', requireAuth, async (req, res) => {
  res.json(await getDailyQuestStateForPlayer(req.player));
});

router.post('/account/quests/:questId/claim', requireAuth, async (req, res) => {
  const payload = await claimDailyQuest(req.player.id, String(req.params.questId || ''));
  await achievements.checkAccountLevel(req.player.id, payload.progression?.level);
  res.json(payload);
});

router.post('/account/daily-reward/claim', requireAuth, async (req, res) => {
  const payload = await claimDailyReward(req.player.id);
  await achievements.checkAccountLevel(req.player.id, payload.progression?.level);
  res.json(payload);
});

module.exports = router;
