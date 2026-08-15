const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../public/api/lib/db');

const {
  FEATURE_TEST_ACCOUNT_STAT_POINTS,
  NODE_DEFINITIONS,
  STAT_KEYS,
  calculatePathProgress,
  calculateStatBonuses,
  createStatPointSummary,
  normalizeStoredAllocations,
  resetPlayerStatAllocations
} = require('../public/api/lib/account-stat-points');

test('Endless Speed is no longer an allocatable skill-tree node', () => {
  assert.equal(Object.hasOwn(NODE_DEFINITIONS, 'speed_mastery'), false);
});

test('legacy Endless Speed ranks are ignored and refunded as unspent points', () => {
  const stored = {
    speed_flat: 5,
    speed_percent: 5,
    speed_mastery: 7
  };
  const allocations = normalizeStoredAllocations(stored);
  const bonuses = calculateStatBonuses(stored);
  const paths = calculatePathProgress(stored);
  const summary = createStatPointSummary({ level: 18, xp: 0 }, stored);

  assert.equal(Object.hasOwn(allocations, 'speed_mastery'), false);
  assert.equal(bonuses.speedFlat, 5);
  assert.deepEqual(paths.offense.branches.speed, { node: 5 });
  assert.equal(summary.spentPoints, 10);
  assert.equal(summary.unspentPoints, 7);
});

test('feature test accounts receive 666 isolated skill-tree points at level 1', () => {
  const summary = createStatPointSummary({
    id: 'ranked-bot:feature-test:anomaly',
    level: 1,
    xp: 0
  });

  assert.equal(FEATURE_TEST_ACCOUNT_STAT_POINTS, 666);
  assert.equal(summary.level, 1);
  assert.equal(summary.totalPoints, 666);
  assert.equal(summary.spentPoints, 0);
  assert.equal(summary.unspentPoints, 666);
});

test('resetting the Skill Tree settles and force-stops an active hunt in the reset transaction', async () => {
  const originalGetConnection = db.getConnection;
  const playerId = 'skill-reset-hunter';
  const player = { id: playerId, souls: 1000, level: 2, xp: 250 };
  const updatedPlayer = { ...player, souls: 1015, level: 3, xp: 850 };
  const allocations = Object.fromEntries(STAT_KEYS.map((key) => [key, key === 'health_flat' ? 1 : 0]));
  const queries = [];
  let deletedHunt = false;
  let committed = false;
  const connection = {
    async beginTransaction() {},
    async query(sql, params) {
      queries.push({ sql, params });
      if (/SELECT \* FROM players[\s\S]+FOR UPDATE/.test(sql)) return [[player]];
      if (/FROM player_stat_points/.test(sql)) return [[allocations]];
      if (/SELECT \* FROM player_active_hunts/.test(sql)) {
        return [[{ player_id: playerId, snapshot: JSON.stringify({ encounterId: 'camp-1' }) }]];
      }
      if (/INSERT INTO player_stat_points/.test(sql)) return [{ affectedRows: 1 }];
      if (/UPDATE players SET xp/.test(sql)) {
        assert.deepEqual(params, [850, 25, 10, 3, playerId]);
        return [{ affectedRows: 1 }];
      }
      if (/DELETE FROM player_active_hunts/.test(sql)) {
        deletedHunt = true;
        return [{ affectedRows: 1 }];
      }
      if (/SELECT \* FROM players/.test(sql)) return [[updatedPlayer]];
      throw new Error(`Unexpected query: ${sql}`);
    },
    async commit() {
      assert.equal(deletedHunt, true);
      committed = true;
    },
    async rollback() {},
    release() {}
  };
  db.getConnection = async () => connection;

  try {
    const stoppedAt = new Date('2026-08-15T00:00:00.000Z');
    const result = await resetPlayerStatAllocations(player, {
      stoppedAt,
      async getActiveWorldRewardBuffs(lockedPlayer, queryable) {
        assert.equal(lockedPlayer, player);
        assert.equal(queryable, connection);
        return [];
      },
      getBuffedHuntSoulCapacity(statSummary, buffs) {
        assert.equal(statSummary.allocations.health_flat, 1);
        assert.deepEqual(buffs, []);
        return 150;
      },
      async calculateHuntRewards(snapshot, settledAt, options) {
        assert.deepEqual(snapshot, { encounterId: 'camp-1' });
        assert.equal(settledAt, stoppedAt);
        assert.deepEqual(options, { soulCapacity: 150 });
        return {
          elapsedSeconds: 600,
          cycles: 2,
          wins: 2,
          xp: 600,
          souls: 25,
          soulCapacity: 150,
          soulsLost: 0
        };
      }
    });

    assert.equal(committed, true);
    assert.equal(result.reset.cost, 10);
    assert.equal(result.reset.stoppedHunt, true);
    assert.equal(result.hunt.stopped, true);
    assert.equal(result.hunt.rewards.xp, 600);
    assert.equal(result.player.souls, 1015);
    assert.equal(result.progression.level, 3);
    assert.equal(result.progression.leveledUp, true);
    assert.ok(queries.some(({ sql }) => /DELETE FROM player_active_hunts/.test(sql)));
  } finally {
    db.getConnection = originalGetConnection;
  }
});

test('a rejected Skill Tree reset leaves an active hunt untouched', async () => {
  const originalGetConnection = db.getConnection;
  const playerId = 'skill-reset-poor-hunter';
  const allocations = Object.fromEntries(STAT_KEYS.map((key) => [key, key === 'health_flat' ? 1 : 0]));
  let queriedActiveHunt = false;
  let rolledBack = false;
  const connection = {
    async beginTransaction() {},
    async query(sql) {
      if (/SELECT \* FROM players[\s\S]+FOR UPDATE/.test(sql)) {
        return [[{ id: playerId, souls: 0, level: 2, xp: 250 }]];
      }
      if (/FROM player_stat_points/.test(sql)) return [[allocations]];
      if (/player_active_hunts/.test(sql)) queriedActiveHunt = true;
      throw new Error(`Unexpected query: ${sql}`);
    },
    async commit() {},
    async rollback() {
      rolledBack = true;
    },
    release() {}
  };
  db.getConnection = async () => connection;

  try {
    await assert.rejects(
      resetPlayerStatAllocations({ id: playerId }),
      /Reset costs 10 Souls\./
    );
    assert.equal(rolledBack, true);
    assert.equal(queriedActiveHunt, false);
  } finally {
    db.getConnection = originalGetConnection;
  }
});
