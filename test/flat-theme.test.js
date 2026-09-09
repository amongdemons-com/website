const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const cssDir = path.join(__dirname, '../public/app/css');
const sheets = fs.readdirSync(cssDir).filter(name => name.endsWith('.css'));

test('all site styles parse and keep blur and non-training image glow effects disabled outside Skill Tree', () => {
  for (const name of sheets) {
    const source = fs.readFileSync(path.join(cssDir, name), 'utf8');
    const parsed = esbuild.transformSync(source, { loader: 'css' });
    assert.deepEqual(parsed.warnings, [], name);
    const sourceWithoutIntentionalAnimationGlow = source
      .replace(
      /@keyframes collection-training-fed-card\s*\{[\s\S]*?\r?\n\}\r?\n\r?\n(?=@keyframes dungeon-loading-spin)/,
      ''
      )
      .replace(/\.bag-summon-portrait\s*\{[\s\S]*?\r?\n\}/, '')
      .replace(/\.bag-action-echo-result\s*\{[\s\S]*?\r?\n\}/, '')
      .replace(
        /@keyframes bag-summon-vessel-feed\s*\{[\s\S]*?\r?\n\}\r?\n\r?\n(?=@media \(max-width: 767\.98px\))/,
        ''
      );
    if (name !== 'skill-tree.css') {
      assert.doesNotMatch(sourceWithoutIntentionalAnimationGlow, /drop-shadow\(|blur\(/, name);
    }
    for (const match of source.matchAll(/backdrop-filter\s*:\s*([^;]+);/g)) {
      assert.match(match[1], /^none(?:\s*!important)?$/, `${name}: ${match[0]}`);
    }
  }
});

test('modal depth and background dimming coexist with flat controls', () => {
  const base = fs.readFileSync(path.join(cssDir, 'base.css'), 'utf8');
  const battle = fs.readFileSync(path.join(cssDir, 'battle.css'), 'utf8');
  assert.match(base, /\.modal-backdrop\s*\{\s*--bs-backdrop-opacity: 0\.5;/);
  assert.match(base, /\.demon-detail-modal \.modal-content\s*\{[^}]*box-shadow: 0 24px 70px rgba\(0,0,0,0\.66\);/);
  assert.match(base, /body\.seo-page\s*\{[^}]*var\(--page-bg-fade\),[\s\S]*?image-set\(/);
  assert.match(battle, /\.dungeon-demon-card-body\s*\{[^}]*background: linear-gradient\([^;]+transparent\);/);
  assert.doesNotMatch(base, /\*::after\s*\{[^}]*box-shadow: none !important/);
  for (const token of ['primary-gradient', 'primary-hover-gradient', 'primary-active-gradient']) {
    assert.match(base, new RegExp(`--${token}:\\s*#[a-f0-9]+;`));
  }
  assert.match(base, /--primary-shadow:\s*none;/);
});

test('Skill Tree keeps its main-branch transparency and glow effects', () => {
  const skillTree = fs.readFileSync(path.join(cssDir, 'skill-tree.css'), 'utf8');
  assert.match(skillTree, /--ascension-panel:\s*rgba\(/);
  assert.match(skillTree, /\.ascension-map\s*\{[\s\S]*?radial-gradient\([^;]+transparent/s);
  assert.match(skillTree, /\.ascension-connection\.is-active\s*\{[\s\S]*?filter:\s*drop-shadow\(/s);
  assert.match(skillTree, /\.ascension-core\s*\{[\s\S]*?box-shadow:\s*0 0 0/s);
  assert.match(skillTree, /\.ascension-node\.is-locked \.ascension-node-label,[\s\S]*?opacity:\s*0\.42;/s);
  assert.match(skillTree, /\.ascension-actions button:not\(\.game-primary-action, :disabled\):hover,[\s\S]*?box-shadow:\s*0 0 18px/s);
});

test('page backgrounds share the dungeon fade level', () => {
  for (const name of ['base.css', 'bag.css', 'battle.css', 'camp.css', 'collection.css', 'skill-tree.css', 'world.css']) {
    const source = fs.readFileSync(path.join(cssDir, name), 'utf8');
    assert.match(source, /var\(--page-bg-fade\)/, name);
  }
});

test('the original brand and rarity palette is preserved exactly', () => {
  const base = fs.readFileSync(path.join(cssDir, 'base.css'), 'utf8');
  const palette = {
    'ad-bg': '#071013', 'ad-bg-soft': '#0d191d', 'ad-text': '#eef8f5',
    'ad-muted': '#9fb6b2', 'ad-faint': '#6f8582', 'ad-teal': '#6fd6bd',
    'ad-green': '#80d697', 'ad-violet': '#9c7ac8', 'ad-ember': '#e78a55',
    'ad-gold': '#e8c76a', 'ad-soul': '#55FFFF', 'primary': '#ff6e2f',
    'primary-frame': '#a98549', 'primary-label': '#cdbe91'
  };
  for (const [token, color] of Object.entries(palette)) {
    assert.match(base, new RegExp(`--${token}: ${color};`), token);
  }
  for (const [rarity, color] of Object.entries({ common: '#D1D5D8', uncommon: '#41A85F', rare: '#2C82C9', epic: '#9365B8', legendary: '#FAC51C', mythic: '#E25041' })) {
    assert.match(base, new RegExp(`\\.rarity-${rarity} \\{\\s*color: ${color};`), rarity);
  }
});
