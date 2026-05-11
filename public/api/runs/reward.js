const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getRunForPlayer, saveRun } = require('../lib/runs');

const router = express.Router();

router.post('/runs/:id/reward', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);
  const rewardId = Number(req.body.rewardId);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  const reward = run.rewards.find((item) => item.rewardId === rewardId);
  if (!reward) {
    return res.status(404).json({ error: 'Reward not found.' });
  }

  if (reward.claimed) {
    return res.status(409).json({ error: 'Reward already claimed.' });
  }

  reward.claimed = true;
  reward.claimedAt = new Date().toISOString();
  await saveRun(run);

  res.json({ reward, rewards: run.rewards });
});

module.exports = router;
