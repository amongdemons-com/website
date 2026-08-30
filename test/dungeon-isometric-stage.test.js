const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'battle.css'), 'utf8');
const stageStyles = css.slice(css.indexOf('Framed-grid dungeon stage.'));
const renderSource = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'render.js'), 'utf8');

test('dungeon uses the wide environment artwork without a repeating rock texture', () => {
  for (const extension of ['png', 'webp', 'avif']) {
    const assetPath = path.join(ROOT, 'public', 'app', 'images', 'assets', 'background', `amongdemons_dungeon.${extension}`);
    assert.equal(fs.existsSync(assetPath), true, `missing ${path.basename(assetPath)}`);
    assert.match(stageStyles, new RegExp(`amongdemons_dungeon\\.${extension}`));
  }
  assert.match(stageStyles, /amongdemons_dungeon\.png[^;}]*center \/ cover no-repeat/);
  assert.doesNotMatch(stageStyles, /amongdemons_dungeon_isometric/);
  assert.doesNotMatch(stageStyles, /--dungeon-floor-texture-size/);
});

test('live dungeon demons do not use image drop shadows', () => {
  const imageRule = stageStyles.match(/\.battle-side \.dungeon-demon-card-image img\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(imageRule, /filter:\s*none;/);
  assert.doesNotMatch(stageStyles, /\.dungeon-demon-card[^{}]*\.dungeon-demon-card-image img\s*\{[^}]*drop-shadow/s);
});

test('dungeon restores the original framed formation grids and responsive spacing', () => {
  const gridRule = css.match(/\.battle-side \.battle-formation-grid\s*\{([^}]*)\}/)?.[1] || '';
  const slotRule = css.match(/\.battle-side \.formation-slot\s*\{([^}]*)\}/)?.[1] || '';
  const playerGridRule = css.match(/\.battle-side-player \.battle-formation-grid\s*\{([^}]*)\}/)?.[1] || '';
  const enemyGridRule = css.match(/\.battle-side-enemy \.battle-formation-grid\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(gridRule, /grid-template-columns:\s*repeat\(3,/);
  assert.match(gridRule, /grid-template-rows:\s*repeat\(3,/);
  assert.match(gridRule, /--dungeon-demon-card-width:\s*clamp\(6rem, min\(11\.5vw, 20vh\), 15\.5rem\);/);
  assert.doesNotMatch(gridRule, /min\(11\.5vw, 22vh\)/);
  assert.match(gridRule, /gap:\s*var\(--dungeon-formation-gap\);/);
  assert.match(gridRule, /border:\s*1px solid rgba\(161,212,201,0\.18\);/);
  assert.match(gridRule, /padding:\s*clamp\(0\.45rem, 0\.8vw, 0\.68rem\);/);
  assert.match(playerGridRule, /border-color:\s*rgba\(111,214,189,0\.32\);/);
  assert.match(enemyGridRule, /border-color:\s*rgba\(226,80,65,0\.34\);/);
  assert.match(slotRule, /border:\s*1px solid rgba\(161,212,201,0\.1\);/);
  assert.doesNotMatch(stageStyles, /\.battle-formation-grid\s*\{/);
});

test('occupied demons restore their type backdrops without rarity frames', () => {
  const occupiedSlotRule = stageStyles.match(/\.battle-side \.formation-slot\.has-demon\s*\{([^}]*)\}/)?.[1] || '';
  const cardRule = stageStyles.match(/\.battle-side \.dungeon-demon-card\s*\{([^}]*)\}/)?.[1] || '';
  const cardImageRule = stageStyles.match(/\.battle-side \.dungeon-demon-card-image\s*\{([^}]*)\}/)?.[1] || '';
  const cardBodyRule = stageStyles.match(/\.battle-side \.dungeon-demon-card-body\s*\{([^}]*)\}/)?.[1] || '';
  const healthBarRule = stageStyles.match(/\.battle-side \.combat-hp-bar\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(occupiedSlotRule, /border-color:\s*rgba\(161,212,201,0\.14\);/);
  assert.match(occupiedSlotRule, /background:\s*rgba\(3,9,11,0\.08\);/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-card\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-card-image\s*\{[\s\S]*?background:\s*var\(--demon-card-backdrop\) center \/ cover no-repeat !important;/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-rarity-gem\s*\{\s*display:\s*none;/);
  assert.match(cardRule, /border-radius:\s*7px;/);
  assert.match(cardImageRule, /border-radius:\s*7px;/);
  assert.match(cardBodyRule, /right:\s*0;/);
  assert.match(cardBodyRule, /left:\s*0;/);
  assert.match(cardBodyRule, /border-radius:\s*0 0 7px 7px;/);
  assert.match(cardBodyRule, /background:\s*linear-gradient\(to top, rgba\(3,8,10,0\.95\), rgba\(3,8,10,0\.62\) 58%, transparent\);/);
  assert.match(healthBarRule, /border:\s*0;/);
  assert.match(healthBarRule, /box-shadow:\s*none;/);
});

test('desktop demon sizes remain CSS-owned and every formation lane shares one row baseline', () => {
  assert.doesNotMatch(stageStyles, /\.formation-slot\.(?:backline|middleline|frontline)\s*\{[^}]*transform:/);
  assert.match(renderSource, /function usesDesktopFormationCss\(\)[\s\S]*?min-width: 992px/);
  assert.match(renderSource, /if \(usesDesktopFormationCss\(\)\) \{\s*clearFormationGridCardSize\(grid\);\s*return;/);
  assert.match(renderSource, /function getCurrentFormationGridInlineStyle\(container\) \{\s*if \(usesDesktopFormationCss\(\)\) return '';/);
});

test('the stage does not override the original arena dimensions', () => {
  assert.doesNotMatch(stageStyles, /\.dungeon-arena\s*\{/);
});
