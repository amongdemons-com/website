const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('World battle replays register Dungeon Ranked helpers', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'world-ui.js'),
    'utf8'
  );

  assert.match(source, /import \* as dungeonRanked from '\.\/dungeon\/ranked\.js/);
  assert.match(source, /registerDungeonActions\(\{[\s\S]*?\.\.\.dungeonRanked,/);
});
