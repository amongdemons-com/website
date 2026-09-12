const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { MAX_ACCOUNT_LEVEL, getXpForAccountLevel } = require('../public/api/lib/progression');
const {
  ANOMALY_COMPLETE_REWARD_LEVELS,
  getAnomalyLevelRewardProgression
} = require('../public/api/lib/world-anomaly');

test('complete Mythic Anomaly rolls grant five hunter levels per successful roll', () => {
  const currentLevel = 40;
  const currentXp = getXpForAccountLevel(currentLevel) + 123;
  const result = getAnomalyLevelRewardProgression(currentLevel, currentXp, 2);

  assert.equal(ANOMALY_COMPLETE_REWARD_LEVELS, 5);
  assert.equal(result.currentLevel, currentLevel);
  assert.equal(result.targetLevel, currentLevel + 10);
  assert.equal(result.levelsGranted, 10);
  assert.equal(result.nextXp - getXpForAccountLevel(result.targetLevel), 123);
  assert.equal(result.leveledUp, true);
});

test('complete Mythic Anomaly rolls stop at the hunter level cap', () => {
  const result = getAnomalyLevelRewardProgression(
    MAX_ACCOUNT_LEVEL - 2,
    getXpForAccountLevel(MAX_ACCOUNT_LEVEL - 2),
    2
  );
  const capped = getAnomalyLevelRewardProgression(
    MAX_ACCOUNT_LEVEL,
    getXpForAccountLevel(MAX_ACCOUNT_LEVEL),
    3
  );

  assert.equal(result.targetLevel, MAX_ACCOUNT_LEVEL);
  assert.equal(result.levelsGranted, 2);
  assert.equal(capped.levelsGranted, 0);
  assert.equal(capped.nextXp, getXpForAccountLevel(MAX_ACCOUNT_LEVEL));
  assert.equal(capped.isMaxLevel, true);
});

test('Mythic Echo Unravel is removed from the Collection and API', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'collection-ui.js'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'bag.js'), 'utf8');
  const bag = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'lib', 'echo-bag.js'), 'utf8');

  assert.doesNotMatch(source, /Unravel|unravel/);
  assert.doesNotMatch(route, /Unravel|unravel/);
  assert.doesNotMatch(bag, /canUnravel/);
});
