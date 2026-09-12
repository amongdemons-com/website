const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const worldCss = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'world.css'), 'utf8');
const worldUi = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'world-ui.js'), 'utf8');

test('mobile portrait world battles remove the shared gap above name and buff plates', () => {
  const portraitStyles = worldCss.slice(
    worldCss.indexOf('@media (max-width: 600px) and (orientation: portrait)')
  );

  assert.match(
    portraitStyles,
    /body\.dungeon-page \.world-battle-modal \.battle-side-heading\s*\{[^}]*padding-top:\s*0;/s
  );
});

test('mobile portrait world battles center both player and enemy nameplate content', () => {
  const portraitStyles = worldCss.slice(
    worldCss.indexOf('@media (max-width: 600px) and (orientation: portrait)')
  );

  assert.match(
    portraitStyles,
    /body\.dungeon-page \.world-battle-modal \.battle-side-player \.battle-side-nameplate,\s*body\.dungeon-page \.world-battle-modal \.battle-side-enemy \.battle-side-nameplate\s*\{[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*padding-top:\s*clamp\(0\.7rem, 3vw, 0\.875rem\);[^}]*text-align:\s*center;/s
  );
  assert.match(
    portraitStyles,
    /\.battle-side-enemy \.battle-side-nameplate > \.outline,\s*body\.dungeon-page \.world-battle-modal \.battle-side-enemy \.battle-side-nameplate > \.dungeon-ranked-opponent-identity\s*\{[^}]*width:\s*100%;[^}]*justify-content:\s*center;[^}]*text-align:\s*center;/s
  );
});

test('mobile portrait world battles hide transient center controls and compact the result', () => {
  const portraitStyles = worldCss.slice(
    worldCss.indexOf('@media (max-width: 600px) and (orientation: portrait)')
  );

  assert.match(
    portraitStyles,
    /\.world-battle-modal \.dungeon-fight-btn\.is-fighting\s*\{[^}]*display:\s*none !important;/s
  );
  assert.match(
    portraitStyles,
    /\.world-battle-modal \.world-dungeon-center-result\s*\{[^}]*display:\s*none;/s
  );
  assert.match(
    portraitStyles,
    /\.world-battle-modal \.world-dungeon-result-layer:not\(\.is-anomaly-result\)\s*\{[^}]*padding:\s*0\.25rem 0\.35rem;/s
  );
});

test('mobile world battle effects render above the fullscreen modal', () => {
  const mobileStyles = worldCss.slice(
    worldCss.indexOf('@media (max-width: 575.98px)', worldCss.indexOf('@media (max-width: 600px) and (orientation: portrait)'))
  );

  for (const effect of [
    'attack-zap',
    'fireball-shot',
    'fire-nova',
    'dark-spike',
    'chaos-lightning',
    'sword-swing',
    'thorn-burst',
    'heal-effect',
    'floating-combat-number',
    'combat-impact-burst'
  ]) {
    assert.match(mobileStyles, new RegExp(`body\\.is-world-battle-open > \\.${effect}`));
  }

  assert.match(
    mobileStyles,
    /body\.is-world-battle-open > \.combat-impact-burst\s*\{[^}]*z-index:\s*5010;/s
  );
  assert.match(
    mobileStyles,
    /body\.is-world-battle-open > \.battle-result-burst\s*\{[^}]*z-index:\s*5020;/s
  );
});

test('mobile portrait world battle results start below the player nameplate', () => {
  const positioner = worldUi.slice(
    worldUi.indexOf('function positionWorldDungeonBattleResultLayer()'),
    worldUi.indexOf('function setWorldDungeonBattleResultAnimation(')
  );

  assert.match(positioner, /\(max-width: 600px\) and \(orientation: portrait\)/);
  assert.match(positioner, /modal\.querySelector\('#teamSideTitle'\)/);
  assert.match(positioner, /playerNameplate\?\.getBoundingClientRect\(\)\.bottom \|\| formationBottom/);
  assert.match(positioner, /contentBottom - hostRect\.top \+ 8/);
});
