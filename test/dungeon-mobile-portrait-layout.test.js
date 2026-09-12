const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'battle.css'), 'utf8');
const render = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'render.js'), 'utf8');
const portraitQuery = '@media (max-width: 600px) and (orientation: portrait)';
const portraitStyles = css.slice(css.lastIndexOf(portraitQuery));

test('mobile portrait dungeon ornaments stay inside their arena tracks', () => {
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.dungeon-arena\s*\{[^}]*row-gap:\s*0;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.dungeon-vs\s*\{[^}]*height:\s*auto;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.dungeon-center-panel\s*\{[^}]*container-type:\s*normal;[^}]*height:\s*auto;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-heading\s*\{[^}]*margin:\s*0 auto;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-enemy \.battle-side-heading\s*\{[^}]*padding-bottom:\s*5px;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-player \.battle-side-heading\s*\{[^}]*padding-bottom:\s*0;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side\s*\{[^}]*row-gap:\s*0;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-nameplate\s*\{[^}]*background:[^;}]*\/ 100% 106% no-repeat;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-status\s*\{[^}]*background:[^;}]*\/ 100% 106% no-repeat;/s
  );
});

test('only rarity-buffed enemies use the compact grouped summary in the narrow header', () => {
  assert.match(
    render,
    /const statusHtml = isBossBattle\(state\.run\) \|\| hasRarityConvergenceBuff\(buffs\)[\s\S]*?renderBossBuffSummaryChip\(pressure, buffs, teamBuffs\)/
  );
  assert.match(
    render,
    /renderEnemyPressureChip\(pressure\),[\s\S]*?renderEnemyBuffChips\(buffs\),[\s\S]*?renderBattleBuffSummaryChip\(teamBuffs, \{ side: 'enemy' \}\)/
  );
});
