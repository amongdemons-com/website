const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const battleCss = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'battle.css'),
  'utf8'
);

test('demon card artwork stays contained without desktop or portrait zoom overrides', () => {
  assert.match(
    battleCss,
    /\.dungeon-demon-card \.dungeon-demon-card-image img\s*\{[^}]*object-fit: contain;[^}]*transform: none;/
  );
  const imageRules = [...battleCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => /dungeon-demon-card-image img|cashout-demon-preview-img/.test(selectors));
  for (const [, selectors, declarations] of imageRules) {
    assert.doesNotMatch(declarations, /object-fit:\s*cover|transform:\s*scale\(/, selectors.trim());
  }
});

test('card artwork fills the entire card with stats overlaid at the bottom', () => {
  assert.match(battleCss, /\.dungeon-demon-card\s*\{[^}]*display: block;/);
  for (const [, selectors, declarations] of battleCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/dungeon-demon-card-image\s*$/.test(selectors.trim()) || !/position:/.test(declarations)) continue;
    assert.match(declarations, /position:\s*absolute;\s*inset:\s*0;/, selectors.trim());
  }
  assert.match(battleCss, /\.dungeon-demon-card-body\s*\{[^}]*position: absolute;[^}]*bottom: 0;/);
});

test('mobile portrait hand replaces HP bars with a one-pixel separator', () => {
  assert.match(
    battleCss,
    /body\.dungeon-page:not\(\.ranked-page\) \.dungeon-hand-cards \.combat-hp-bar\s*\{\s*display: none;/
  );
  assert.match(
    battleCss,
    /body\.dungeon-page:not\(\.ranked-page\) \.dungeon-hand-cards \.combat-stat-footer\s*\{[\s\S]*?border-top: 1px solid/
  );
});
