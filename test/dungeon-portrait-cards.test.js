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

test('card stats occupy their own row instead of covering sprite feet', () => {
  assert.match(battleCss, /\.dungeon-demon-card\s*\{[^}]*display: grid;[^}]*grid-template-rows: minmax\(0, 1fr\) auto;/);
  for (const [, selectors, declarations] of battleCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!/dungeon-demon-card-(image|body)\s*$/.test(selectors.trim())) continue;
    assert.doesNotMatch(declarations, /position:\s*absolute/, selectors.trim());
  }
  assert.match(battleCss, /\.dungeon-demon-card-body\s*\{[^}]*grid-area: 2 \/ 1;/);
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
