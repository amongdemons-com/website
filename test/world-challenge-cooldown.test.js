const test = require('node:test');
const assert = require('node:assert/strict');

const worldRouter = require('../public/api/world');

test('world duel rematches wait five minutes', () => {
  assert.equal(worldRouter._test.CHALLENGE_COOLDOWN_MS, 5 * 60 * 1000);
});
