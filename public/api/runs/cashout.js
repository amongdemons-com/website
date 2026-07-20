const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { normalizeCollectionDemonStats } = require('../lib/collection-demons');
const { isDungeonExtractionUnlocked } = require('../lib/dungeon-rules');
const { addEcho } = require('../lib/echo-bag');
const { getNextAccountLevel } = require('../lib/progression');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { hasPendingBuffChoices } = require('../lib/run-buffs');
const { clearPendingRewardSoul, getEarnedWithPendingDiscardedSouls, settleDiscardedSoulRewards } = require('../lib/run-rewards');
const { recordDailyQuestProgress } = require('../lib/daily-quests');
const achievements = require('../lib/achievements');

const router = express.Router();

router.post('/runs/:id/cashout', requireAuth, async (req, res) => {
  const connection = await db.getConnection();
  let payout;

  try {
    await connection.beginTransaction();
    const run = await getRunForPlayer(req.params.id, req.player.id, connection, { forUpdate: true });
    if (!run) throw createHttpError('Run not found.', 404);

    const canCashOut = run.status === 'active' && run.state.awaitingRecruit;
    if (!canCashOut) throw createHttpError('Rewards can only be claimed between dungeon fights.', 409);
    if (!isDungeonExtractionUnlocked(run.floor)) {
      throw createHttpError('Extraction unlocks after winning your first fight.', 409);
    }
    if (hasPendingBuffChoices(run)) throw createHttpError('Choose a Demonic Pact before extracting rewards.', 409);

    payout = req.body?.skipDemon
      ? await endRunWithoutEcho(run, req.player.id, connection)
      : await endRunWithEcho(run, req.player.id, req.body || {}, connection);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  if (payout.echo) {
    await achievements.grantAchievements(req.player.id, ['a-way-out']);
  }
  await achievements.checkAccountLevel(req.player.id, payout.level);
  res.status(payout.echo ? 201 : 200).json(payout);
});

async function endRunWithEcho(run, playerId, body, connection) {
  const demon = getCashoutDemon(run, body);
  const echo = await addEcho(playerId, demon, { queryable: connection, natural: true });
  const payout = await settleRunPayout(run, playerId, connection);

  run.state.cashout = {
    echoItemKey: echo.itemKey,
    echoQuantity: echo.quantity,
    xp: payout.xp,
    souls: payout.souls
  };
  await saveRun(run, connection);
  await recordDailyQuestProgress(playerId, { demonsExtracted: 1 }, connection);

  return { echo, ...payout };
}

async function endRunWithoutEcho(run, playerId, connection) {
  const payout = await settleRunPayout(run, playerId, connection);
  run.state.cashout = {
    echoItemKey: null,
    skippedEcho: true,
    xp: payout.xp,
    souls: payout.souls
  };
  await saveRun(run, connection);
  return { echo: null, ...payout };
}

async function settleRunPayout(run, playerId, connection) {
  settleDiscardedSoulRewards(run);
  const earned = getEarnedForPayout(run);
  const [playerRows] = await connection.query('SELECT xp, level FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [playerId]);
  if (!playerRows.length) throw createHttpError('Player not found.', 404);
  const nextXp = playerRows[0].xp + (earned.xp || 0);
  const nextLevel = getNextAccountLevel(playerRows[0].level, nextXp);

  await connection.query(
    'UPDATE players SET xp = xp + ?, souls = souls + ?, level = ? WHERE id = ?',
    [earned.xp || 0, earned.souls || 0, nextLevel, playerId]
  );

  run.status = 'ended';
  run.endedAt = new Date();
  run.state.awaitingRecruit = false;
  return {
    xp: earned.xp || 0,
    souls: earned.souls || 0,
    level: nextLevel
  };
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

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = router;
