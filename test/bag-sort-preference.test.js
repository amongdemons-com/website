const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const bagSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'bag-ui.js'),
  'utf8'
);

test('Bag restores and persists each player sort preference', () => {
  assert.match(bagSource, /const BAG_SORT_STORAGE_PREFIX = 'amongdemons-bag-sort';/);
  assert.match(bagSource, /const BAG_SORT_OPTIONS = new Set\(\['type', 'ready', 'rarity', 'name', 'quantity'\]\);/);
  assert.match(bagSource, /await window\.AmongDemons\.ensurePlayableSession\(\)[\s\S]*?restoreSortPreference\(\);[\s\S]*?await refreshBag\(\);/);
  assert.match(bagSource, /localStorage\.getItem\(getSortStorageKey\(\)\)/);
  assert.match(bagSource, /localStorage\.setItem\(getSortStorageKey\(\), state\.sort\)/);
  assert.match(bagSource, /const playerKey = player\?\.id \|\| player\?\.username \|\| 'browser';/);
});
