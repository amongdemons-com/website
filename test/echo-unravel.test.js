const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { MAX_ACCOUNT_LEVEL, getXpForAccountLevel } = require('../public/api/lib/progression');
const {
  MYTHIC_ECHO_UNRAVEL_LEVELS,
  getMythicEchoUnravelProgression
} = require('../public/api/lib/echo-unravel');

test('unraveling a Mythic Echo grants exactly five hunter levels and preserves XP progress', () => {
  const currentLevel = 40;
  const currentXp = getXpForAccountLevel(currentLevel) + 123;
  const result = getMythicEchoUnravelProgression(currentLevel, currentXp);

  assert.equal(MYTHIC_ECHO_UNRAVEL_LEVELS, 5);
  assert.equal(result.currentLevel, currentLevel);
  assert.equal(result.targetLevel, currentLevel + 5);
  assert.equal(result.levelsGranted, 5);
  assert.equal(result.nextXp - getXpForAccountLevel(result.targetLevel), 123);
});

test('Mythic Echo unraveling stops at the hunter level cap', () => {
  const result = getMythicEchoUnravelProgression(
    MAX_ACCOUNT_LEVEL - 2,
    getXpForAccountLevel(MAX_ACCOUNT_LEVEL - 2)
  );
  const capped = getMythicEchoUnravelProgression(
    MAX_ACCOUNT_LEVEL,
    getXpForAccountLevel(MAX_ACCOUNT_LEVEL)
  );
  const oneLevelRemaining = getMythicEchoUnravelProgression(
    MAX_ACCOUNT_LEVEL - 1,
    getXpForAccountLevel(MAX_ACCOUNT_LEVEL - 1)
  );

  assert.equal(result.targetLevel, MAX_ACCOUNT_LEVEL);
  assert.equal(result.levelsGranted, 2);
  assert.equal(oneLevelRemaining.targetLevel, MAX_ACCOUNT_LEVEL);
  assert.equal(oneLevelRemaining.levelsGranted, 1);
  assert.equal(oneLevelRemaining.nextXp, getXpForAccountLevel(MAX_ACCOUNT_LEVEL));
  assert.equal(capped.levelsGranted, 0);
  assert.equal(capped.nextXp, getXpForAccountLevel(MAX_ACCOUNT_LEVEL));
});

test('Collection keeps confirmed Mythic Unravel and removes Bag Echo actions', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'collection-ui.js'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'bag.js'), 'utf8');
  assert.match(source, /Confirm Unravel/);
  assert.match(source, /This permanently consumes one Mythic Echo/);
  assert.match(route, /rarity !== 'mythic'/);
  assert.match(route, /quantity = quantity - 1/);
  assert.ok(route.indexOf('if (!progression.levelsGranted)') < route.indexOf('quantity = quantity - 1'));
});
