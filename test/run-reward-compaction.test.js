const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  allocateRunRewardIds,
  carryPendingRecruitRewardsToFloor,
  compactRunRewards,
  getCurrentRunRewards,
  settleDiscardedSoulRewards
} = require('../public/api/lib/run-rewards');
const { parseRun } = require('../public/api/lib/runs');

function createReward(rewardId, floor, extra = {}) {
  return {
    rewardId,
    floor,
    type: 'recruit',
    demon: { instanceId: `reward-${rewardId}`, typeId: 1, maxHp: 10, hp: 10, atk: 2, speed: 3 },
    ...extra
  };
}

test('legacy runs keep only current-floor choices and preserve monotonic reward ids', () => {
  const run = {
    status: 'active',
    floor: 4,
    state: { earned: { xp: 100, souls: 12 } },
    rewards: [
      createReward(1, 0, { recruited: true }),
      createReward(8, 3, { discarded: true }),
      createReward(9, 4),
      createReward(10, 4)
    ]
  };

  compactRunRewards(run);

  assert.deepEqual(run.rewards.map((reward) => reward.rewardId), [9, 10]);
  assert.equal(run.state.nextRewardId, 11);
  assert.deepEqual(run.state.earned, { xp: 100, souls: 12 });
  assert.deepEqual(allocateRunRewardIds(run, 3), [11, 12, 13]);
  assert.equal(run.state.nextRewardId, 14);
});

test('ended runs drop reward history without changing replay or payout state', () => {
  const lastBattle = { floor: 9, winner: 'player', combatLog: [{ tick: 1, dmg: 2 }] };
  const extractChoice = { source: 'reward', rewardId: 42, demon: { typeId: 4, atk: 20 } };
  const run = {
    status: 'ended',
    floor: 9,
    state: {
      earned: { xp: 500, souls: 40 },
      lastBattle,
      extractChoice
    },
    rewards: [createReward(42, 9)]
  };

  compactRunRewards(run);

  assert.deepEqual(run.rewards, []);
  assert.deepEqual(run.state.lastBattle, lastBattle);
  assert.deepEqual(run.state.extractChoice, extractChoice);
  assert.deepEqual(run.state.earned, { xp: 500, souls: 40 });
});

test('available hand cards carry through a prepared Ranked checkpoint', () => {
  const run = {
    status: 'active',
    floor: 30,
    state: { earned: { xp: 0, souls: 0 } },
    rewards: [
      createReward(1, 29, { soulPending: true }),
      createReward(2, 29, { soulPending: true, claimed: true, recruited: true }),
      createReward(3, 28, { soulPending: true })
    ]
  };

  assert.equal(carryPendingRecruitRewardsToFloor(run, 29, 30), 1);
  assert.equal(run.rewards[0].floor, 30);
  assert.equal(run.rewards[1].floor, 29);
  assert.equal(run.rewards[2].floor, 28);
  assert.deepEqual(getCurrentRunRewards(run).map((reward) => reward.rewardId), [1]);
});

test('discard souls can settle a preparation hand after its floor advances', () => {
  const run = {
    status: 'active',
    floor: 30,
    state: { earned: { xp: 0, souls: 0 } },
    rewards: [createReward(1, 29, { soulPending: true, souls: 1 })]
  };

  assert.equal(settleDiscardedSoulRewards(run, { floor: 29 }), 1);
  assert.equal(run.state.earned.souls, 1);
  assert.equal(run.rewards[0].discarded, true);
});

test('run parsing compacts old JSON before it reaches the client', () => {
  const run = parseRun({
    id: 'run-1',
    player_id: 'player-1',
    seed: 123,
    status: 'active',
    floor: 2,
    state: JSON.stringify({ buffs: {}, earned: { xp: 25, souls: 3 } }),
    rewards: JSON.stringify([
      createReward(1, 1, { discarded: true }),
      createReward(2, 2)
    ])
  });

  assert.deepEqual(getCurrentRunRewards(run).map((reward) => reward.rewardId), [2]);
  assert.deepEqual(run.rewards.map((reward) => reward.rewardId), [2]);
  assert.equal(run.state.nextRewardId, 3);
});

test('completed-run cleanup migration removes reward JSON only from ended runs', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'api', 'lib', 'schema.js'),
    'utf8'
  );

  assert.match(source, /20260808_ended_run_rewards_cleanup_v1/);
  assert.match(source, /UPDATE runs SET rewards = '\[\]' WHERE status = 'ended'/);
});
