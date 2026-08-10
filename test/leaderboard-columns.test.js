const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('leaderboard columns match Ranked and Duels sorting', () => {
  const html = read('public/app/rankings.html');
  const client = read('public/app/js/rankings-ui.js');

  assert.match(html, /id="rankHeader"/);
  assert.match(client, /\? \['#', 'Hunter', 'Rank'\]/);
  assert.match(client, /\? \['#', 'Hunter', 'Wins', 'Losses'\]/);
  assert.doesNotMatch(client, /Ranked Floor/);
  assert.match(client, /rank-wins-cell/);
  assert.match(client, /rank-losses-cell/);
  assert.match(client, /currentSort === 'ranked' \? 3 : 4/);
});

test('Patch 4 announces World narration and leaderboard column changes', () => {
  const notes = read('patch-notes.md');

  assert.match(notes, /## Patch 5 \(Current\)\s+## Patch 4/);
  assert.match(notes, /World setting[\s\S]*boss narration/);
  assert.match(notes, /Ranked standings[\s\S]*without a Ranked Floor column/);
  assert.match(notes, /Duel standings[\s\S]*Wins and Losses columns/);
});

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
