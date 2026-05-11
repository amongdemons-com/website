const express = require('express');
const { requireAuth } = require('../lib/auth');
const { simulateFight } = require('../lib/combat');
const { createTeam } = require('../lib/demon-factory');
const { createRng } = require('../lib/rng');
const { getRunForPlayer, saveRun } = require('../lib/runs');

const router = express.Router();

router.post('/runs/:id/battle', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active') {
    return res.status(409).json({ error: 'Run is not active.' });
  }

  const rng = createRng(run.seed + run.floor);
  const result = simulateFight(rng, run.state.team, run.state.enemies);
  run.state.team = result.playerTeam;
  run.state.enemies = result.enemyTeam;
  run.state.hp = result.playerTeam.reduce((sum, demon) => sum + Math.max(0, demon.hp), 0);

  let rewards = {};
  if (result.winner === 'player') {
    const recruit = await createTeam(rng, 1, { prefix: `reward-${run.floor}` });
    rewards = {
      rewardId: run.rewards.length + 1,
      type: 'recruit',
      demon: recruit[0],
      souls: 5 + run.floor * 2,
      xp: 10 + run.floor * 5,
      claimed: false
    };
    run.rewards.push(rewards);
    run.state.mapProgress[run.floor - 1].status = 'cleared';
  } else {
    run.status = 'defeated';
    run.endedAt = new Date();
  }

  await saveRun(run);

  res.json({
    winner: result.winner,
    combatLog: result.combatLog,
    rewards
  });
});

module.exports = router;
