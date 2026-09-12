'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
}

test('collection training actions retain the outline class after refreshing', () => {
  const source = read('public', 'app', 'js', 'collection-ui.js');
  const classBuilder = source.match(/function getTrainingButtonClass[\s\S]*?\n  \}/u)?.[0] || '';

  assert.match(classBuilder, /['"]outline['"]/u);
});

test('active-hunt Terror is centered in the World sidebar', () => {
  const css = read('public', 'app', 'css', 'world.css');

  assert.match(
    css,
    /\.world-active-hunt-card \.world-card-meta-inline\s*\{[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/u
  );
});

test('the empty merchant stock message fills and centers within the stock box', () => {
  const source = read('public', 'app', 'js', 'world-ui.js');
  const css = read('public', 'app', 'css', 'world.css');

  assert.match(source, /class="world-empty-text world-merchant-empty">No wares survived this road\.<\/p>/u);
  assert.match(css, /\.world-merchant-stock:has\(\.world-merchant-empty\)\s*\{[^}]*grid-template-rows:\s*minmax\(0, 1fr\);[^}]*align-content:\s*stretch;/u);
  assert.match(css, /\.world-merchant-empty\s*\{[^}]*place-items:\s*center;[^}]*font-size:\s*1\.1rem;[^}]*text-align:\s*center;/u);
});

test('Camp hero stat cards use outline styling with normal-weight descendants', () => {
  const html = read('public', 'app', 'camp.html');
  const css = read('public', 'app', 'css', 'camp.css');
  const outlinedStats = html.match(/class="camp-hero-stat outline"/gu) || [];

  assert.equal(outlinedStats.length, 2);
  assert.match(html, /class="camp-hero-stat-label outline">Souls<\/dt>/u);
  assert.match(html, /class="camp-hero-stat-label outline">Best Floor<\/dt>/u);
  assert.match(css, /\.camp-page \.camp-hero-stat \*\s*\{[^}]*font-weight:\s*normal;/u);
  assert.match(css, /\.camp-page \.camp-stat-grid \.camp-hero-stat-label\.outline\s*\{[^}]*font-family:\s*"Lilita One", sans-serif;/u);
});
