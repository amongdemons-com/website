const express = require('express');
const { requireAuth } = require('../lib/auth');
const {
  claimDailyQuest,
  claimDailyReward,
  getDailyQuestStateForPlayer
} = require('../lib/daily-quests');

const router = express.Router();

router.get('/account/quests', requireAuth, async (req, res) => {
  res.json(await getDailyQuestStateForPlayer(req.player));
});

router.post('/account/quests/:questId/claim', requireAuth, async (req, res) => {
  res.json(await claimDailyQuest(req.player.id, String(req.params.questId || '')));
});

router.post('/account/daily-reward/claim', requireAuth, async (req, res) => {
  res.json(await claimDailyReward(req.player.id));
});

module.exports = router;
