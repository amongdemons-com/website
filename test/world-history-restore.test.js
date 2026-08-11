const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'world-ui.js'),
  'utf8'
);

test('World preserves and refreshes its map across browser history restores', () => {
  assert.match(source, /addListener\(window, 'pagehide', onWorldPageHide\)/);
  assert.match(source, /addListener\(window, 'pageshow', onWorldPageShow\)/);
  assert.match(source, /function onWorldPageHide\(event\)\s*{[\s\S]*?if \(event\.persisted\) return;[\s\S]*?destroyWorld\(\);/);
  assert.match(source, /function onWorldPageShow\(event\)\s*{[\s\S]*?if \(!state\.app\)[\s\S]*?window\.location\.reload\(\);[\s\S]*?resizeCanvas\(\);/);
});
