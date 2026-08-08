const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('Ranked divisions remain visible on Camp, leaderboards, and Hunter profiles', () => {
  const camp = read('public/app/js/camp-ui.js');
  const rankings = read('public/app/js/rankings-ui.js');
  const hunter = read('public/app/js/hunter-ui.js');
  const baseStyles = read('public/app/css/base.css');

  assert.doesNotMatch(camp, /if \(!division \|\| true\)/);
  assert.match(camp, /ranked-rank-image/);
  assert.doesNotMatch(baseStyles, /rank-sort-link\[data-sort="ranked"\][\s\S]*?display:\s*none/);
  assert.doesNotMatch(rankings, /function renderRankDivisionText[\s\S]*?return ``/);
  assert.match(rankings, /rank-division-text--/);
  assert.doesNotMatch(hunter, /function renderRankDivisionText[\s\S]*?return ``/);
  assert.match(hunter, /rank-division-text--/);
});

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}
