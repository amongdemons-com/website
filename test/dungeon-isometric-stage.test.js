const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'battle.css'), 'utf8');
const stageStyles = css.slice(css.indexOf('Framed-grid dungeon stage.'));
const renderSource = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'render.js'), 'utf8');
const dragSource = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'drag-drop.js'), 'utf8');

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

test('dungeon retains the original framed formation structure and responsive spacing', () => {
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
});

test('dungeon formation grids use flat opaque cartoon surfaces', () => {
  const playerGridRule = stageStyles.match(/\.battle-side-player \.battle-formation-grid\s*\{([^}]*)\}/)?.[1] || '';
  const enemyGridRule = stageStyles.match(/\.battle-side-enemy \.battle-formation-grid\s*\{([^}]*)\}/)?.[1] || '';
  const playerSlotsRule = stageStyles.match(/\.battle-side-player \.formation-slot,[\s\S]*?\.battle-side-player \.formation-slot\.is-empty\s*\{([^}]*)\}/)?.[1] || '';
  const enemySlotsRule = stageStyles.match(/\.battle-side-enemy \.formation-slot,[\s\S]*?\.battle-side-enemy \.formation-slot\.is-empty\s*\{([^}]*)\}/)?.[1] || '';
  const placeholderRule = stageStyles.match(/\.battle-side \.formation-slot-placeholder-icon\s*\{([^}]*)\}/)?.[1] || '';
  const dragRule = stageStyles.match(/\.battle-side \.formation-slot-cards\.is-drag-over\s*\{([^}]*)\}/)?.[1] || '';
  const commonDragRule = stageStyles.match(/body\.dungeon-page \.dungeon-demon-card\.is-drag-over,[\s\S]*?\{([^}]*)\}/)?.[1] || '';
  const commonDragOverlay = stageStyles.match(/body\.dungeon-page \.dungeon-demon-card\.is-drag-over::after,[\s\S]*?\{([^}]*)\}/)?.[1] || '';

  assert.match(playerGridRule, /border-color:\s*#3e7168;/);
  assert.match(playerGridRule, /background:\s*#132c2d;/);
  assert.match(enemyGridRule, /border-color:\s*#75423e;/);
  assert.match(enemyGridRule, /background:\s*#2c1a1d;/);
  assert.match(playerSlotsRule, /background:\s*#0d2022;/);
  assert.match(enemySlotsRule, /background:\s*#211316;/);

  for (const rule of [playerGridRule, enemyGridRule, playerSlotsRule, enemySlotsRule]) {
    assert.match(rule, /box-shadow:\s*none;/);
    assert.doesNotMatch(rule, /rgba\(|gradient\(|transparent/);
  }

  assert.match(placeholderRule, /opacity:\s*1;/);
  assert.match(placeholderRule, /filter:\s*none;/);
  assert.match(dragRule, /outline:\s*3px solid #f3c55c;/);
  assert.match(dragRule, /box-shadow:\s*none;/);
  assert.match(commonDragRule, /outline:\s*0\s*!important;/);
  assert.match(commonDragRule, /isolation:\s*auto\s*!important;/);
  assert.match(commonDragRule, /box-shadow:\s*none\s*!important;/);
  assert.match(commonDragOverlay, /border:\s*3px solid #f3c55c;/);
  assert.match(commonDragOverlay, /z-index:\s*3700;/);
  assert.match(commonDragOverlay, /pointer-events:\s*none;/);
  assert.match(stageStyles, /\.formation-lane-cards\.is-drag-over:has\(\.dungeon-demon-card\.is-drag-over\)[\s\S]*?outline:\s*0\s*!important;/);
  assert.match(stageStyles, /\.dungeon-hand-cards\.is-drag-over:has\(\.dungeon-demon-card\.is-drag-over\)::after[\s\S]*?display:\s*none;/);
  assert.match(stageStyles, /is-ranked-encounter-planning #enemyGrid \.battle-formation-grid::before\s*\{\s*display:\s*none;/);
});

test('dungeon replay and upgrade cues use large flat icon and fixed border treatments', () => {
  const replayIconRule = css.match(/\.dungeon-replaylog-box \.dungeon-replaylog-btn \.game-icon\s*\{([^}]*)\}/)?.[1] || '';
  const upgradeRule = css.match(/\.dungeon-hand-cards \.dungeon-demon-card\.is-team-upgrade\s*\{([^}]*)\}/)?.[1] || '';
  const upgradeBorder = css.match(/\.dungeon-hand-cards \.dungeon-demon-card\.is-team-upgrade::after\s*\{([^}]*)\}/)?.[1] || '';
  const arrowRule = css.match(/\.dungeon-hand-cards \.dungeon-demon-card\.is-team-upgrade > \.dungeon-team-upgrade-indicator\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(replayIconRule, /width:\s*1\.8rem;/);
  assert.match(replayIconRule, /height:\s*1\.8rem;/);
  assert.match(css, /dungeonMobileReplayBtn \.game-icon,[\s\S]*?dungeonMobileLogBtn \.game-icon\s*\{[^}]*width:\s*2rem;[^}]*height:\s*2rem;/);
  assert.match(upgradeBorder, /border:\s*2px solid #FEC550;/);
  assert.match(upgradeRule, /box-shadow:\s*none;/);
  assert.doesNotMatch(css, /@keyframes team-upgrade-gold-pulse/);
  assert.doesNotMatch(upgradeBorder, /animation:/);
  assert.doesNotMatch(upgradeRule, /transform:\s*translateY/);
  assert.doesNotMatch(upgradeBorder, /box-shadow:/);
  assert.doesNotMatch(arrowRule, /border:/);
  assert.match(css, /\.dungeon-team-upgrade-arrow\s*\{[^}]*stroke-width:\s*4\.5;/s);
  assert.match(css, /\.dungeon-team-upgrade-arrow-outline\s*\{[^}]*color:\s*#070b0c;/s);
  assert.match(css, /\.dungeon-team-upgrade-arrow-wrap\s*> \.dungeon-team-upgrade-arrow-outline\s*\{[^}]*stroke-width:\s*7\.5;/s);
  assert.match(css, /\.dungeon-team-upgrade-arrow-foreground\s*\{[^}]*color:\s*inherit;[^}]*stroke-width:\s*4\.5;/s);
  assert.match(arrowRule, /filter:\s*none;/);
  assert.match(css, /\.battle-side-player \.dungeon-demon-card\.is-team-upgrade-target\s*\{[^}]*box-shadow:\s*none;/s);
  assert.doesNotMatch(css, /\.battle-side-player \.dungeon-demon-card\.is-team-upgrade-target::after\s*\{[^}]*animation:/s);
  assert.match(css, /\.battle-side-player \.dungeon-demon-card\.is-team-upgrade-target > \.dungeon-team-downgrade-indicator\s*\{[^}]*color:\s*#FEC550;/s);
});

test('native drag highlights survive transitions across nested target content', () => {
  assert.match(dragSource, /dragleave', \(event\) => \{[\s\S]*?relatedTarget\?\.nodeType && target\.contains\(relatedTarget\)/);
});

test('occupied demons retain type backdrops and show rarity badges without rarity frames', () => {
  const occupiedSlotRule = stageStyles.match(/\.battle-side-player \.formation-slot,[\s\S]*?\.battle-side-player \.formation-slot\.is-empty\s*\{([^}]*)\}/)?.[1] || '';
  const cardRule = stageStyles.match(/\.battle-side \.dungeon-demon-card\s*\{([^}]*)\}/)?.[1] || '';
  const cardImageRule = stageStyles.match(/\.battle-side \.dungeon-demon-card-image\s*\{([^}]*)\}/)?.[1] || '';
  const cardBodyRule = stageStyles.match(/\.battle-side \.dungeon-demon-card-body\s*\{([^}]*)\}/)?.[1] || '';
  const healthBarRule = stageStyles.match(/\.battle-side \.combat-hp-bar\s*\{([^}]*)\}/)?.[1] || '';

  assert.match(occupiedSlotRule, /border-color:\s*#2c534d;/);
  assert.match(occupiedSlotRule, /background:\s*#0d2022;/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-card\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-card-image\s*\{[\s\S]*?background:\s*var\(--demon-card-backdrop\) center \/ cover no-repeat !important;/);
  assert.match(stageStyles, /\.battle-side \.dungeon-demon-rarity-gem\s*\{\s*display:\s*block;/);
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
