const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NODE_DEFINITIONS,
  calculatePathProgress,
  calculateStatBonuses,
  createStatPointSummary,
  normalizeStoredAllocations
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
