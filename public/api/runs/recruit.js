const express = require('express');
const { requireAuth } = require('../lib/auth');
const { createTeam } = require('../lib/demon-factory');
const { createRng } = require('../lib/rng');
const { getRunForPlayer, saveRun } = require('../lib/runs');

const router = express.Router();

router.post('/runs/:id/recruit', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);
  const rewardId = req.body.rewardId ? Number(req.body.rewardId) : null;

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  const reward = rewardId
    ? run.rewards.find((item) => item.rewardId === rewardId)
    : [...run.rewards].reverse().find((item) => item.type === 'recruit' && !item.recruited);

  if (!reward || !reward.demon) {
    return res.status(404).json({ error: 'Recruit reward not found.' });
  }

  if (run.state.team.length >= 3) {
    return res.status(409).json({ error: 'Team is already full.' });
  }

  reward.recruited = true;
  reward.claimed = true;
  run.state.team.push(reward.demon);

  if (run.status === 'active') {
    run.floor += 1;
    run.state.currentFloor = run.floor;
    run.state.enemies = await createTeam(createRng(run.seed + run.floor), 3, {
      prefix: `enemy-${run.floor}`,
      rarity: run.floor >= 3 ? undefined : 'common'
    });
    run.state.mapProgress.push({ floor: run.floor, type: 'battle', status: 'available' });
  }

  await saveRun(run);
  res.json({ team: run.state.team, reward });
});

module.exports = router;
