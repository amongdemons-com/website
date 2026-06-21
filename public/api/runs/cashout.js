const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { normalizeCollectionDemonStats, saveCollectionDemon } = require('../lib/collection-demons');
const { getNextAccountLevel } = require('../lib/progression');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { hasPendingBuffChoices } = require('../lib/run-buffs');
const { clearPendingRewardSoul, getEarnedWithPendingDiscardedSouls, settleDiscardedSoulRewards } = require('../lib/run-rewards');
const { recordDailyQuestProgress } = require('../lib/daily-quests');

const router = express.Router();

router.post('/runs/:id/cashout', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  const canCashOut = run.status === 'active' && run.state.awaitingRecruit;
  if (!canCashOut) {
    return res.status(409).json({ error: 'Rewards can only be claimed between dungeon fights.' });
  }

  if (hasPendingBuffChoices(run)) {
    return res.status(409).json({ error: 'Choose a Demonic Pact before extracting rewards.' });
  }

  if (req.body?.skipDemon) {
    return endRunWithoutDemon(run, req.player.id, res);
  }

  const demon = getCashoutDemon(run, req.body || {});
  const saved = await saveCollectionDemon(req.player.id, demon);

  settleDiscardedSoulRewards(run);
  const earned = getEarnedForPayout(run);
  const [playerRows] = await db.query('SELECT xp, level FROM players WHERE id = ? LIMIT 1', [req.player.id]);
  const nextXp = playerRows[0].xp + (earned.xp || 0);
  const nextLevel = getNextAccountLevel(playerRows[0].level, nextXp);

  await db.query(
    'UPDATE players SET xp = xp + ?, souls = souls + ?, level = ? WHERE id = ?',
    [earned.xp || 0, earned.souls || 0, nextLevel, req.player.id]
  );

  run.status = 'ended';
  run.endedAt = new Date();
  run.state.awaitingRecruit = false;
  run.state.cashout = {
    savedDemonId: saved.demon.id,
    replacedDemon: saved.replaced,
    xp: earned.xp || 0,
    souls: earned.souls || 0
  };
  await saveRun(run);
  await recordDailyQuestProgress(req.player.id, { demonsExtracted: 1 });

  res.status(saved.replaced ? 200 : 201).json({
    demon: saved.demon,
    replaced: saved.replaced,
    xp: earned.xp || 0,
    souls: earned.souls || 0,
    level: nextLevel
  });
});

async function endRunWithoutDemon(run, playerId, res) {
  settleDiscardedSoulRewards(run);
  const earned = getEarnedForPayout(run);
  const [playerRows] = await db.query('SELECT xp, level FROM players WHERE id = ? LIMIT 1', [playerId]);
  const nextXp = playerRows[0].xp + (earned.xp || 0);
  const nextLevel = getNextAccountLevel(playerRows[0].level, nextXp);

  await db.query(
    'UPDATE players SET xp = xp + ?, souls = souls + ?, level = ? WHERE id = ?',
    [earned.xp || 0, earned.souls || 0, nextLevel, playerId]
  );

  run.status = 'ended';
  run.endedAt = new Date();
  run.state.awaitingRecruit = false;
  run.state.cashout = {
    savedDemonId: null,
    skippedDemon: true,
    xp: earned.xp || 0,
    souls: earned.souls || 0
  };
  await saveRun(run);

  return res.json({
    demon: null,
    xp: earned.xp || 0,
    souls: earned.souls || 0,
    level: nextLevel
  });
}

function getCashoutDemon(run, body) {
  const reservedDemon = getReservedCashoutDemon(run, body);
  if (reservedDemon) return reservedDemon;

  if (body.source === 'team') {
    const instanceId = String(body.instanceId || '');
    const demon = (run.state.team || []).find((item) => item.instanceId === instanceId);
    if (!demon) {
      const error = new Error('Team demon not found.');
      error.status = 404;
      throw error;
    }
    return normalizeCollectionDemonStats(demon);
  }

  if (body.source === 'reward') {
    const rewardId = Number(body.rewardId);
    const reward = run.rewards.find((item) => (
      Number(item.rewardId) === rewardId &&
      item.type === 'recruit' &&
      item.floor === run.floor &&
      item.demon
    ));
    if (!reward) {
      const error = new Error('Reward demon not found.');
      error.status = 404;
      throw error;
    }
    reward.claimed = true;
    reward.saved = true;
    clearPendingRewardSoul(reward);
    return normalizeCollectionDemonStats(reward.demon);
  }

  const error = new Error('Choose a demon reward.');
  error.status = 400;
  throw error;
}

function getReservedCashoutDemon(run, body) {
  const choice = run.state.extractChoice;
  if (!choice?.demon) return null;

  const matchesExplicitReserved = body.source === 'reserved';
  const matchesTeam = body.source === 'team' &&
    choice.source === 'team' &&
    String(body.instanceId || '') === String(choice.instanceId || '');
  const matchesReward = body.source === 'reward' &&
    choice.source === 'reward' &&
    Number(body.rewardId) === Number(choice.rewardId);
  if (!matchesExplicitReserved && !matchesTeam && !matchesReward) return null;

  if (choice.source === 'reward') {
    const reward = run.rewards.find((item) => Number(item.rewardId) === Number(choice.rewardId));
    if (reward) {
      reward.claimed = true;
      reward.saved = true;
      reward.extracted = true;
      clearPendingRewardSoul(reward);
    }
  }

  run.state.extractChoice = {
    ...choice,
    saved: true
  };
  return normalizeCollectionDemonStats(choice.demon);
}

function getEarnedForPayout(run) {
  if (run.status === 'defeated') {
    return { xp: 0, souls: 0 };
  }

  return getEarnedWithPendingDiscardedSouls(run);
}

module.exports = router;
