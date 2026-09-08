const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const battleCss = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'battle.css'),
  'utf8'
);

test('formation card artwork stays contained without desktop or portrait zoom overrides', () => {
  assert.match(
    battleCss,
    /body\.dungeon-page \.battle-side \.dungeon-demon-card-image img\s*\{[^}]*object-fit: contain;[^}]*transform: none;/
  );
  const imageRules = [...battleCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selectors]) => /body\.dungeon-page \.battle-side \.dungeon-demon-card-image img|formation-lane-cards\.is-compressed \.dungeon-demon-card-image img/.test(selectors));
  for (const [, selectors, declarations] of imageRules) {
    assert.doesNotMatch(declarations, /object-fit:\s*cover|transform:\s*scale\(/, selectors.trim());
  }
});

test('dungeon hand cards use type backdrops without card frames', () => {
  assert.match(
    battleCss,
    /:where\(body\.dungeon-page #dungeonHandBar\) \.dungeon-demon-card\s*\{[\s\S]*?border: 0;/
  );
  assert.match(
    battleCss,
    /:where\(body\.dungeon-page #dungeonHandBar\) \.dungeon-demon-card-image\s*\{[\s\S]*?background: var\(--demon-card-backdrop\) center \/ cover no-repeat;/
  );
  assert.match(
    battleCss,
    /:where\(body\.dungeon-page #dungeonHandBar\) \.dungeon-demon-card \.dungeon-demon-card-image img\s*\{[\s\S]*?object-fit: cover;[\s\S]*?object-position: center 22%;[\s\S]*?transform: none;/
  );
});

test('dungeon hand rarity badges keep the shared dark outer contour', () => {
  assert.match(
    battleCss,
    /:where\(body\.dungeon-page #dungeonHandBar\) \.dungeon-demon-rarity-gem\s*\{[\s\S]*?background:\s*#101820;[\s\S]*?filter:\s*none;/
  );
  assert.match(
    battleCss,
    /:where\(body\.dungeon-page #dungeonHandBar\) \.dungeon-demon-rarity-gem::after\s*\{[\s\S]*?inset:\s*2px;[\s\S]*?background:\s*var\(--rarity-color, #D1D5D8\);/
  );
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
    /body\.dungeon-page:not\(\.ranked-page\) #dungeonHandBar \.dungeon-hand-cards \.combat-hp-meta\s*\{[\s\S]*?border-top: 1px solid/
  );
});
