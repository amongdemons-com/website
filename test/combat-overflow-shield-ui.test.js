const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function read(...segments) {
  return fs.readFileSync(path.join(ROOT, ...segments), 'utf8');
}

function loadDemonCardUi() {
  const previousWindow = global.window;
  global.window = {
    AmongDemons: {
      ui: {
        renderIcon: () => '<svg></svg>'
      }
    }
  };

  const modulePath = require.resolve('../public/app/js/demon-cards.js');
  delete require.cache[modulePath];
  require(modulePath);

  return {
    ui: global.window.AmongDemons.ui,
    restore() {
      delete require.cache[modulePath];
      global.window = previousWindow;
    }
  };
}

test('overflow shields share the full health-bar width without a visual cap', () => {
  const harness = loadDemonCardUi();
  try {
    const balanced = harness.ui.getCombatHpBarLayout(100, 100, 50);
    const largeShield = harness.ui.getCombatHpBarLayout(100, 100, 900);
    const wounded = harness.ui.getCombatHpBarLayout(50, 100, 50);
    const woundedWithoutShield = harness.ui.getCombatHpBarLayout(50, 100, 0);

    assert.equal(Math.round(balanced.hpPercent * 1000) / 1000, 66.667);
    assert.equal(Math.round(balanced.shieldPercent * 1000) / 1000, 33.333);
    assert.equal(largeShield.hpPercent, 10);
    assert.equal(largeShield.shieldPercent, 90);
    assert.equal(wounded.hpPercent, 50);
    assert.equal(wounded.shieldPercent, 50);
    assert.equal(wounded.hpPercent + wounded.shieldPercent, 100);
    assert.equal(woundedWithoutShield.hpPercent, 50);
    assert.equal(woundedWithoutShield.shieldPercent, 0);
  } finally {
    harness.restore();
  }
});

test('combat cards render the overflow shield as a white right-hand segment', () => {
  const harness = loadDemonCardUi();
  try {
    const html = harness.ui.renderCombatStats({
      typeId: 1,
      atk: 20,
      hp: 100,
      maxHp: 100,
      shield: 50
    });

    assert.match(html, /combat-hp-bar has-overflow-shield/);
    assert.match(html, /aria-label="HP 100 of 100, overflow shield 50"/);
    assert.match(html, /combat-hp-fill js-demon-hp-fill[^>]*width: 66\.6667%/);
    assert.match(html, /combat-overflow-shield-fill js-demon-shield-fill[^>]*width: 33\.3333%/);
  } finally {
    harness.restore();
  }
});

test('Dungeon and World playback keep shield values synchronized with the shared bar', () => {
  const dungeonCombat = read('public', 'app', 'js', 'dungeon', 'combat.js');
  const worldCombat = read('public', 'app', 'js', 'world-ui.js');
  const styles = read('public', 'app', 'css', 'base.css');

  assert.match(dungeonCombat, /target\.shield = Math\.max\(0, Number\(entry\.targetShield\) \|\| 0\)/);
  assert.match(dungeonCombat, /shield: entry\.targetShield/);
  assert.match(dungeonCombat, /getCombatHpBarLayout\(hp, maxHp, shield\)/);
  assert.match(worldCombat, /target\.shield = Math\.max\(0, Number\(entry\.targetShield\) \|\| 0\)/);
  assert.match(styles, /\.combat-overflow-shield-fill \{[\s\S]*?right: 0;[\s\S]*?background: linear-gradient\(90deg, #dce9e8, #ffffff\);/);
});
