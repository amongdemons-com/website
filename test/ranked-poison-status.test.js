const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rankedSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'ranked.js'),
  'utf8'
);
const combatSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'dungeon', 'combat.js'),
  'utf8'
);

test('Ranked uses the shared live poison-stack badge renderer', () => {
  assert.match(rankedSource, /import \{[\s\S]*?renderDemonStatus,[\s\S]*?\} from '\.\/dungeon\/cards\.js';/);
  assert.doesNotMatch(rankedSource, /function renderDemonStatus\(\) \{\s*return '';\s*\}/);
  assert.match(combatSource, /entry\.effect === 'poison_apply'[\s\S]*?syncPoisonStatus\(entry\.target, entry\.poisonStacks \|\| 1\)/);
});
