const express = require('express');
const { requireAuth } = require('../lib/auth');
const { createRng } = require('../lib/rng');
const { createHuntEnemies } = require('../lib/hunt-enemies');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { normalizePosition, resetRunDemon } = require('../lib/run-demons');

const router = express.Router();

router.post('/runs/:id/recruit', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);
  const stagedTeam = Array.isArray(req.body.team) ? req.body.team : null;
  const rewardId = req.body.rewardId ? Number(req.body.rewardId) : null;
  const replaceInstanceId = req.body.replaceInstanceId ? String(req.body.replaceInstanceId) : null;
  const requestedPosition = req.body.position ? normalizePosition(req.body.position) : null;
  const skipRecruit = Boolean(req.body.skipRecruit);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (!run.state.awaitingRecruit) {
    return res.status(409).json({ error: 'No recruit choice is pending.' });
  }

  if (skipRecruit) {
    await advanceFloor(run);
    await saveRun(run);
    return res.json({ team: run.state.team, skipped: true });
  }

  if (stagedTeam) {
    const team = buildStagedTeam(run, stagedTeam);
    run.state.team = team;

    const recruitedRewardIds = new Set(
      stagedTeam
        .filter((item) => item && item.source === 'reward')
        .map((item) => Number(item.rewardId))
    );
    run.rewards.forEach((reward) => {
      if (reward.type === 'recruit' && reward.floor === run.floor && recruitedRewardIds.has(Number(reward.rewardId))) {
        reward.recruited = true;
        reward.claimed = true;
      }
    });

    if (run.status === 'active') {
      await advanceFloor(run);
    }

    await saveRun(run);
    return res.json({ team: run.state.team });
  }

  const reward = rewardId
    ? run.rewards.find((item) => item.rewardId === rewardId)
    : [...run.rewards].reverse().find((item) => item.type === 'recruit' && !item.recruited);

  if (!reward || !reward.demon) {
    return res.status(404).json({ error: 'Recruit reward not found.' });
  }

  if (reward.type !== 'recruit') {
    return res.status(409).json({ error: 'Only defeated floor demons can join the dungeon.' });
  }

  if (reward.recruited) {
    return res.status(409).json({ error: 'Demon already recruited.' });
  }

  if (run.state.team.length >= 3 && !replaceInstanceId) {
    return res.status(400).json({ error: 'Choose one of your demons to swap out.' });
  }

  reward.recruited = true;
  reward.claimed = true;
  const recruit = resetRunDemon(reward.demon, `player-${Date.now()}`);

  if (replaceInstanceId) {
    const replaceIndex = run.state.team.findIndex((demon) => demon.instanceId === replaceInstanceId);
    if (replaceIndex === -1) {
      return res.status(404).json({ error: 'Swap target not found.' });
    }
    recruit.position = requestedPosition || normalizePosition(run.state.team[replaceIndex].position);
    run.state.team.splice(replaceIndex, 1, recruit);
  } else {
    recruit.position = requestedPosition || normalizePosition(recruit.position || (run.state.team.length === 0 ? 'front' : 'back'));
    run.state.team.push(recruit);
  }

  if (run.status === 'active') {
    await advanceFloor(run);
  }

  await saveRun(run);
  res.json({ team: run.state.team, reward });
});

async function advanceFloor(run) {
  run.state.team = run.state.team.map((demon) => resetRunDemon(demon, demon.instanceId));
  run.floor += 1;
  run.state.currentFloor = run.floor;
  run.state.enemies = await createHuntEnemies(createRng(run.seed + run.floor), run.floor, run.state.team.length);
  run.state.awaitingRecruit = false;
  run.state.mapProgress.push({ floor: run.floor, type: 'battle', status: 'available' });
}

function buildStagedTeam(run, stagedTeam) {
  if (!stagedTeam.length || stagedTeam.length > 3) {
    const error = new Error('Choose between 1 and 3 demons for your team.');
    error.status = 400;
    throw error;
  }

  return stagedTeam.map((item, index) => {
    if (!item || !item.source) {
      const error = new Error('Invalid staged team.');
      error.status = 400;
      throw error;
    }

    const position = normalizePosition(item.position || (index === 0 ? 'front' : 'back'));

    if (item.source === 'team') {
      const instanceId = String(item.instanceId || item.originalInstanceId || '');
      const demon = (run.state.team || []).find((teamDemon) => teamDemon.instanceId === instanceId);
      if (!demon) {
        const error = new Error('Team demon not found.');
        error.status = 404;
        throw error;
      }

      return {
        ...resetRunDemon(demon, demon.instanceId),
        position
      };
    }

    if (item.source === 'reward') {
      const rewardId = Number(item.rewardId);
      const reward = run.rewards.find((rewardItem) => (
        Number(rewardItem.rewardId) === rewardId &&
        rewardItem.type === 'recruit' &&
        rewardItem.floor === run.floor &&
        rewardItem.demon
      ));
      if (!reward) {
        const error = new Error('Recruit reward not found.');
        error.status = 404;
        throw error;
      }

      return {
        ...resetRunDemon(reward.demon, `player-${run.floor}-${reward.rewardId}`),
        position
      };
    }

    const error = new Error('Invalid staged team source.');
    error.status = 400;
    throw error;
  });
}

module.exports = router;
