const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  MAX_ACCOUNT_LEVEL,
  getAccountLevelForXp,
  getAccountProgressionSummary,
  getNextAccountLevel,
  getXpForAccountLevel,
  normalizeAccountLevel
} = require('../public/api/lib/progression');

const ROOT = path.join(__dirname, '..');

test('account progression never exceeds level 666', () => {
  const maxLevelXp = getXpForAccountLevel(MAX_ACCOUNT_LEVEL);
  const levelAfterMaxXp = getXpForAccountLevel(MAX_ACCOUNT_LEVEL + 1);

  assert.equal(MAX_ACCOUNT_LEVEL, 666);
  assert.equal(getAccountLevelForXp(maxLevelXp), MAX_ACCOUNT_LEVEL);
  assert.equal(getAccountLevelForXp(levelAfterMaxXp), MAX_ACCOUNT_LEVEL);
  assert.equal(getNextAccountLevel(MAX_ACCOUNT_LEVEL + 20, levelAfterMaxXp), MAX_ACCOUNT_LEVEL);
  assert.equal(normalizeAccountLevel(MAX_ACCOUNT_LEVEL + 1), MAX_ACCOUNT_LEVEL);
});

test('max-level progression is always complete and has no next-level XP', () => {
  const summary = getAccountProgressionSummary(
    MAX_ACCOUNT_LEVEL,
    getXpForAccountLevel(MAX_ACCOUNT_LEVEL)
  );

  assert.equal(summary.level, MAX_ACCOUNT_LEVEL);
  assert.equal(summary.isMaxLevel, true);
  assert.deepEqual(summary.levelProgress, {
    currentLevelXp: getXpForAccountLevel(MAX_ACCOUNT_LEVEL),
    nextLevelXp: getXpForAccountLevel(MAX_ACCOUNT_LEVEL),
    xpIntoLevel: 0,
    xpForNextLevel: 0,
    xpToNextLevel: 0,
    percent: 1,
    isMaxLevel: true
  });
});

test('max-level XP bars stay full yellow and identify the cap', () => {
  const iconsSource = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'icons.js'), 'utf8');
  const campSource = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'camp-ui.js'), 'utf8');
  const baseCss = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'base.css'), 'utf8');
  const campCss = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'camp.css'), 'utf8');

  assert.match(iconsSource, /<strong>Max level<\/strong>/);
  assert.match(iconsSource, /progress\.classList\.toggle\('is-max-level', nextState\.isMaxLevel\)/);
  assert.match(campSource, /progress\.isMaxLevel\s*\? 'Max level'/);
  assert.match(baseCss, /\.nav-xp-progress\.is-max-level[\s\S]*?width: 100% !important;[\s\S]*?#f3d45d/);
  assert.match(campCss, /\.camp-xp-progress\.is-max-level[\s\S]*?width: 100% !important;[\s\S]*?#f3d45d/);
});
