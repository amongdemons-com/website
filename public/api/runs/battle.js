const express = require('express');
const { requireAuth } = require('../lib/auth');
const { simulateFight } = require('../lib/combat');
const { createRng } = require('../lib/rng');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { resetRunDemon } = require('../lib/run-demons');

const router = express.Router();

router.post('/runs/:id/battle', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active') {
    return res.status(409).json({ error: 'Run is not active.' });
  }

  if (run.state.awaitingRecruit) {
    return res.status(409).json({ error: 'Choose a defeated demon before the next battle.' });
  }

  const rng = createRng(run.seed + run.floor);
  const result = simulateFight(rng, run.state.team, run.state.enemies);
  run.state.team = result.playerTeam;
  run.state.enemies = result.enemyTeam;
  run.state.hp = result.playerTeam.reduce((sum, demon) => sum + Math.max(0, demon.hp), 0);

  let rewards = {};
  if (result.winner === 'player') {
    const isFinalFloor = run.floor >= 10;
    const floorRewards = isFinalFloor ? createFinalTeamRewards(run) : createDefeatedDemonRewards(run);
    rewards = floorRewards;
    run.rewards.push(...floorRewards);
    run.state.earned = run.state.earned || { xp: 0, souls: 0 };
    run.state.earned.xp += 10 + run.floor * 5;
    run.state.earned.souls += 5 + run.floor * 2;
    run.state.mapProgress[run.floor - 1].status = 'cleared';

    if (isFinalFloor) {
      run.status = 'completed';
      run.endedAt = new Date();
      run.state.awaitingFinalPick = true;
    } else {
      run.state.awaitingRecruit = true;
    }
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

function createDefeatedDemonRewards(run) {
  const enemies = run.state.enemies || [];

  return enemies.map((enemy, index) => ({
    rewardId: run.rewards.length + index + 1,
    type: 'recruit',
    floor: run.floor,
    demon: resetRunDemon(enemy, `recruit-${run.floor}-${index + 1}`),
    souls: 0,
    xp: 0,
    claimed: false
  }));
}

function createFinalTeamRewards(run) {
  const team = run.state.team || [];

  return team.map((demon, index) => ({
    rewardId: run.rewards.length + index + 1,
    type: 'final',
    floor: run.floor,
    demon: resetRunDemon(demon, `final-${run.floor}-${index + 1}`),
    souls: 0,
    xp: 0,
    claimed: false
  }));
}

module.exports = router;
