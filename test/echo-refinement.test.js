const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getEchoRefinementBatch } = require('../public/api/lib/echo-config');
const { MAX_ACCOUNT_LEVEL, getXpForAccountLevel } = require('../public/api/lib/progression');
const {
  MYTHIC_ECHO_UNRAVEL_LEVELS,
  getMythicEchoUnravelProgression
} = require('../public/api/lib/echo-unravel');

test('Echo refinement consumes every complete recipe batch', () => {
  assert.deepEqual(getEchoRefinementBatch(10, 'common'), {
    recipeCost: 3,
    refinedQuantity: 3,
    consumedQuantity: 9,
    remainingQuantity: 1
  });
});

test('Echo refinement leaves an incomplete recipe untouched', () => {
  assert.deepEqual(getEchoRefinementBatch(4, 'epic'), {
    recipeCost: 5,
    refinedQuantity: 0,
    consumedQuantity: 0,
    remainingQuantity: 4
  });
});

test('Echo refinement result confirms completion and shows only multi-Echo quantities', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'bag-ui.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'bag.css'), 'utf8');

  assert.match(source, /refinedQuantity > 1 \? `<span class="bag-item-count">x\$\{escapeHtml\(formatNumber\(refinedQuantity\)\)\}<\/span>` : ''/);
  assert.match(source, /class="btn btn-primary" data-bs-dismiss="modal">Confirm<\/button>/);
  assert.match(styles, /\.bag-action-echo-result > \.bag-item-count\s*{[^}]*min-width:\s*3rem;[^}]*font-size:\s*1rem;/s);
});

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

test('Bag exposes a confirmed Mythic-only Unravel Echo action', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'bag-ui.js'), 'utf8');
  const route = fs.readFileSync(path.join(__dirname, '..', 'public', 'api', 'bag.js'), 'utf8');

  assert.match(source, /<span>Unravel Echo<\/span>/);
  assert.match(source, /This permanently consumes one Mythic/);
  assert.match(source, /data-bag-action="unravel"/);
  assert.match(route, /rarity !== 'mythic'/);
  assert.match(route, /quantity = quantity - 1/);
  assert.match(route, /FOR UPDATE/);
  assert.match(source, /Level 666 is the maximum hunter level, so Mythic Echoes can no longer be unraveled/);
  assert.ok(route.indexOf('if (!progression.levelsGranted)') < route.indexOf('quantity = quantity - 1'));
});

test('Echo unraveled result keeps only the styled level text and confirmation action', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'bag-ui.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'bag.css'), 'utf8');
  const resultModal = source.match(/function showUnravelResult[\s\S]+?\n  function getRefinementTargetItem/)?.[0] || '';

  assert.match(resultModal, /bag-unravel-description/);
  assert.match(resultModal, /hunter \$\{levelsGranted === 1 \? 'level' : 'levels'\} gained/);
  assert.match(resultModal, />Confirm<\/button>/);
  assert.doesNotMatch(resultModal, /renderItemVisual|bag-unravel-levels|bag-action-echo-result/);
  assert.match(styles, /\.bag-unravel-description strong\s*\{[^}]*font-size:\s*1\.1rem;[^}]*font-weight:\s*900;/s);
});
