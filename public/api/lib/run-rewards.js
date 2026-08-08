const DISCARD_SOUL_VALUE = 1;

function ensureNextRewardId(run) {
  run.state = run.state || {};
  run.rewards = Array.isArray(run.rewards) ? run.rewards : [];

  const highestExistingId = run.rewards.reduce((highest, reward) => {
    const rewardId = Math.floor(Number(reward?.rewardId));
    return Number.isFinite(rewardId) ? Math.max(highest, rewardId) : highest;
  }, 0);
  const storedNextId = Math.floor(Number(run.state.nextRewardId));
  const nextRewardId = Math.max(
    1,
    highestExistingId + 1,
    Number.isFinite(storedNextId) ? storedNextId : 1
  );

  run.state.nextRewardId = nextRewardId;
  return nextRewardId;
}

function allocateRunRewardIds(run, count) {
  const rewardCount = Math.max(0, Math.floor(Number(count) || 0));
  const firstRewardId = ensureNextRewardId(run);
  run.state.nextRewardId = firstRewardId + rewardCount;
  return Array.from({ length: rewardCount }, (_, index) => firstRewardId + index);
}

function getCurrentRunRewards(run) {
  if (!run || run.status === 'ended') return [];
  const currentFloor = Number(run.floor);
  return (Array.isArray(run.rewards) ? run.rewards : []).filter((reward) => (
    Number(reward?.floor) === currentFloor
  ));
}

function compactRunRewards(run, options = {}) {
  if (!run) return run;
  ensureNextRewardId(run);
  run.rewards = options.clear === true || run.status === 'ended'
    ? []
    : getCurrentRunRewards(run);
  return run;
}

function getBattleXpReward(floor, winner = 'player') {
  const normalizedFloor = Math.max(1, Math.floor(Number(floor) || 1));
  const victoryXp = 10 + normalizedFloor * 5;

  if (winner === 'player') return victoryXp;
  return Math.max(1, Math.floor(victoryXp / 2));
}

function ensureRunEarned(run) {
  run.state = run.state || {};
  run.state.earned = {
    xp: Number(run.state.earned?.xp) || 0,
    souls: Number(run.state.earned?.souls) || 0
  };
  return run.state.earned;
}

function createDiscardSoulRewardFields(souls = DISCARD_SOUL_VALUE) {
  return {
    souls: Math.max(0, Number(souls) || 0),
    soulPending: true
  };
}

function settleDiscardedSoulRewards(run, options = {}) {
  const earned = ensureRunEarned(run);
  let souls = 0;

  (run.rewards || []).forEach((reward) => {
    if (!isPendingDiscardSoulReward(run, reward, options)) return;

    const value = getRewardSoulValue(reward);
    reward.claimed = true;
    reward.discarded = true;
    reward.soulPending = false;
    reward.soulAwarded = true;
    reward.souls = value;
    souls += value;
  });

  earned.souls += souls;
  return souls;
}

function getEarnedWithPendingDiscardedSouls(run, options = {}) {
  const earned = ensureRunEarned(run);
  return {
    xp: earned.xp,
    souls: earned.souls + getPendingDiscardSoulValue(run, options)
  };
}

function getDefeatPayout(run) {
  const earned = ensureRunEarned(run);
  return {
    xp: Math.max(0, Math.floor(Number(earned.xp) || 0)),
    souls: 0
  };
}

function getPendingDiscardSoulValue(run, options = {}) {
  return (run.rewards || []).reduce((total, reward) => (
    total + (isPendingDiscardSoulReward(run, reward, options) ? getRewardSoulValue(reward) : 0)
  ), 0);
}

function clearPendingRewardSoul(reward) {
  if (!reward) return;
  reward.soulPending = false;
}

function isPendingDiscardSoulReward(run, reward, options = {}) {
  if (!reward || reward.type !== 'recruit') return false;
  if (Number(reward.floor) !== Number(run.floor)) return false;
  if (Number(reward.floor) <= 0) return false;
  if (!hasPendingSoulValue(reward)) return false;
  if (isRewardUnavailableForDiscard(reward)) return false;

  const excludedRewardIds = normalizeRewardIdSet(options.excludeRewardIds);
  return !excludedRewardIds.has(Number(reward.rewardId));
}

function hasPendingSoulValue(reward) {
  return reward.soulPending === true || (Number(reward.souls) > 0 && !reward.soulAwarded);
}

function isRewardUnavailableForDiscard(reward) {
  return Boolean(
    reward.claimed ||
    reward.recruited ||
    reward.saved ||
    reward.extracted ||
    reward.discarded ||
    reward.soulAwarded
  );
}

function normalizeRewardIdSet(rewardIds) {
  return new Set(
    [...(rewardIds || [])]
      .map((rewardId) => Number(rewardId))
      .filter((rewardId) => Number.isFinite(rewardId))
  );
}

function getRewardSoulValue(reward) {
  const souls = Number(reward?.souls);
  return Number.isFinite(souls) && souls > 0 ? souls : DISCARD_SOUL_VALUE;
}

module.exports = {
  allocateRunRewardIds,
  compactRunRewards,
  createDiscardSoulRewardFields,
  clearPendingRewardSoul,
  ensureRunEarned,
  ensureNextRewardId,
  getBattleXpReward,
  getCurrentRunRewards,
  getDefeatPayout,
  getEarnedWithPendingDiscardedSouls,
  getPendingDiscardSoulValue,
  settleDiscardedSoulRewards
};
