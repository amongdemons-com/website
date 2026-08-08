const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const battleCss = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'battle.css'),
  'utf8'
);

test('mobile portrait dungeon cards zoom their demon artwork', () => {
  assert.match(
    battleCss,
    /@media \(max-width: 600px\) and \(orientation: portrait\)[\s\S]*?body\.dungeon-page:not\(\.ranked-page\) \.dungeon-demon-card \.dungeon-demon-card-image img\s*\{[\s\S]*?transform: scale\(1\.48\)/
  );
});

test('mobile portrait hand replaces HP bars with a one-pixel separator', () => {
  assert.match(
    battleCss,
    /body\.dungeon-page:not\(\.ranked-page\) \.dungeon-hand-cards \.combat-hp-bar\s*\{\s*display: none;/
  );
  assert.match(
    battleCss,
    /body\.dungeon-page:not\(\.ranked-page\) \.dungeon-hand-cards \.combat-hp-meta\s*\{[\s\S]*?border-top: 1px solid/
  );
});
