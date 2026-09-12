const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (...segments) => fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
const baseCss = read('public', 'app', 'css', 'base.css');
const campCss = read('public', 'app', 'css', 'camp.css');
const campHtml = read('public', 'app', 'camp.html');

test('Bag is temporarily hidden from the navbar while its route remains available', () => {
  assert.match(
    baseCss,
    /\.game-shell-nav \[data-game-route="bag"\]\s*\{[^}]*display:\s*none !important;/s
  );
  assert.match(campHtml, /class="camp-bag-link" href="\/bag"/);
});

test('Camp hides the Bag shortcut and lets the remaining shortcut fill the row', () => {
  assert.match(
    campCss,
    /\.camp-profile-shortcuts\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s
  );
  assert.match(
    campCss,
    /\.camp-profile-shortcuts \.camp-bag-link\s*\{[^}]*display:\s*none;/s
  );
});
