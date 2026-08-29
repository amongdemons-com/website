const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'battle.css'), 'utf8');
const stageStyles = css.slice(css.indexOf('Repeating dungeon floor stage.'));
const renderSource = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'render.js'), 'utf8');

test('dungeon uses the selected repeating floor texture in every modern background format', () => {
  for (const extension of ['png', 'webp', 'avif']) {
    const assetPath = path.join(
      ROOT,
      'public',
      'app',
      'images',
      'assets',
      'background',
      `amongdemons_dungeon_isometric.${extension}`
    );

    assert.equal(fs.existsSync(assetPath), true, `missing ${path.basename(assetPath)}`);
    assert.match(stageStyles, new RegExp(`amongdemons_dungeon_isometric\\.${extension}`));
  }

  assert.match(stageStyles, /--dungeon-floor-texture-size:\s*clamp\(/);
  assert.match(stageStyles, /var\(--dungeon-floor-texture-size\) var\(--dungeon-floor-texture-size\) repeat/);
  assert.doesNotMatch(stageStyles, /amongdemons_dungeon_isometric[^;}]*cover no-repeat/);
});

test('dungeon battle formations are visually cardless while slots remain interactive', () => {
  assert.match(stageStyles, /\.battle-side \.battle-formation-grid[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(stageStyles, /\.battle-side \.formation-slot[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-card\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-card-image\s*\{[\s\S]*?background:\s*none !important;/);
  assert.match(stageStyles, /\.formation-slot-cards\.is-drag-over::after/);
  assert.match(stageStyles, /\.collection-reinforcement-team-slot::after/);
});

test('desktop demon sizes remain CSS-owned and every formation lane shares one row baseline', () => {
  assert.doesNotMatch(stageStyles, /\.formation-slot\.(?:backline|middleline|frontline)\s*\{[^}]*transform:/);
  assert.match(renderSource, /function usesDesktopFormationCss\(\)[\s\S]*?min-width: 992px/);
  assert.match(renderSource, /if \(usesDesktopFormationCss\(\)\) \{\s*clearFormationGridCardSize\(grid\);\s*return;/);
  assert.match(renderSource, /function getCurrentFormationGridInlineStyle\(container\) \{\s*if \(usesDesktopFormationCss\(\)\) return '';/);
});

test('desktop arena reserves a bottom safety gutter for combat stats', () => {
  assert.match(stageStyles, /@media \(min-width: 992px\)[\s\S]*?\.dungeon-arena\s*\{[\s\S]*?padding-bottom:\s*clamp\(1rem, 2\.8vh, 1\.5rem\);/);
});
