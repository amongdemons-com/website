const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'demon-cards.js'),
  'utf8'
);

function loadCardUi() {
  const context = {
    window: {
      AmongDemons: {
        ui: {
          renderIcon: (name) => `<i data-test-icon="${name}"></i>`,
          toDemonImageUrl: () => '/demon.png'
        }
      }
    }
  };
  vm.runInNewContext(source, context);
  return context.window.AmongDemons.ui;
}

test('demon cards select role-specific attack icons', () => {
  const renderCard = loadCardUi().renderDemonCard;
  const renderType = (typeId) => renderCard({ typeId, atk: 10, speed: 50 }, { hideRarity: true });

  assert.match(renderType(1), /data-test-icon="attack"/);
  assert.match(renderType(2), /data-test-icon="ranged"/);
  assert.match(renderType(6), /data-test-icon="ranged"/);
  assert.match(renderType(11), /data-test-icon="ranged"/);
  assert.match(renderType(3), /data-test-icon="poison"/);
  assert.match(renderType(4), /data-test-icon="aoe"/);
  assert.match(renderType(7), /data-test-icon="attack"/);
  assert.match(renderType(10), /data-test-icon="cross"/);
});

test('card numbers abbreviate thousands and millions with at most one decimal', () => {
  const ui = loadCardUi();
  for (const [value, expected] of [
    [0, '0'], [12.36, '12.4'], [1000, '1k'], [1200, '1.2k'],
    [142100, '142.1k'], [999949, '999.9k'], [999950, '1m'],
    [1000000, '1m'], [2400000, '2.4m']
  ]) {
    assert.equal(ui.formatDemonCardNumber(value), expected);
  }
  const html = ui.renderDemonCard({ typeId: 8, atk: 1200, hp: 2400000, maxHp: 3000000 });
  assert.match(html, /js-demon-hp">2\.4m<\/span>/);
  assert.match(html, /js-demon-atk">1\.2k<\/span>/);
  assert.match(html, /data-max-hp="3000000"/);
  assert.match(html, /aria-label="HP 2400000 of 3000000"/);
});

test('card stats follow the health bar with DPT before the right-hand HP value', () => {
  const ui = loadCardUi();
  const demon = { typeId: 3, atk: 9, speed: 23, hp: 164, maxHp: 200 };
  const html = ui.renderCombatStats(demon);
  const bar = html.indexOf('class="combat-hp-bar');
  const footer = html.indexOf('class="combat-stat-footer');
  const attack = html.indexOf('class="combat-stat-strip');
  const hp = html.indexOf('class="combat-hp-meta');
  assert.ok(bar >= 0 && bar < footer && footer < attack && attack < hp);
  assert.match(html.slice(attack, hp), /data-test-icon="poison"/);
  assert.match(html.slice(attack, hp), /js-demon-atk">2\.1<\/span>/);
  assert.doesNotMatch(html, /data-test-icon="speed"/);
  assert.match(html.slice(hp), /js-demon-hp">164<\/span>/);

  const legacy = ui.renderCombatStats(demon, { legacyLayout: true });
  const legacyBar = legacy.indexOf('class="combat-hp-bar');
  const legacyAttack = legacy.indexOf('class="combat-stat-strip');
  const legacyHp = legacy.indexOf('class="combat-hp-meta');
  assert.ok(legacyAttack >= 0 && legacyAttack < legacyBar && legacyBar < legacyHp);
  assert.doesNotMatch(legacy, /combat-stat-footer/);

  const withoutBar = ui.renderCombatStats(demon, { hideHpBar: true });
  assert.doesNotMatch(withoutBar, /class="combat-hp-bar/);
  assert.match(withoutBar, /class="combat-stat-footer is-separated"/);
  const attackOnly = ui.renderCombatStats({ atk: 9 });
  assert.match(attackOnly, /combat-stat-footer/);
  assert.doesNotMatch(attackOnly, /combat-hp-meta|is-separated/);
  assert.equal(ui.renderCombatStats({}), '');
});
