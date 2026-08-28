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
  const renderType = (typeId) => renderCard({ typeId, atk: 10 }, { hideRarity: true });

  assert.match(renderType(1), /data-test-icon="attack"/);
  assert.match(renderType(2), /data-test-icon="ranged"/);
  assert.match(renderType(6), /data-test-icon="ranged"/);
  assert.match(renderType(11), /data-test-icon="ranged"/);
  assert.match(renderType(3), /data-test-icon="poison"/);
  assert.match(renderType(4), /data-test-icon="aoe"/);
  assert.match(renderType(7), /data-test-icon="attack"/);
});

test('card stats follow the health bar with attack and speed before the right-hand HP value', () => {
  const ui = loadCardUi();
  const demon = { typeId: 3, atk: 9, speed: 23, hp: 164, maxHp: 200 };
  const html = ui.renderCombatStats(demon);
  const bar = html.indexOf('class="combat-hp-bar');
  const footer = html.indexOf('class="combat-stat-footer');
  const attack = html.indexOf('class="combat-stat-strip');
  const hp = html.indexOf('class="combat-hp-meta');
  assert.ok(bar >= 0 && bar < footer && footer < attack && attack < hp);
  assert.match(html.slice(attack, hp), /data-test-icon="poison"/);
  assert.match(html.slice(attack, hp), />23<\/span>/);
  assert.match(html.slice(hp), /js-demon-hp">164<\/span>/);

  const withoutBar = ui.renderCombatStats(demon, { hideHpBar: true });
  assert.doesNotMatch(withoutBar, /class="combat-hp-bar/);
  assert.match(withoutBar, /class="combat-stat-footer is-separated"/);
  const attackOnly = ui.renderCombatStats({ atk: 9 });
  assert.match(attackOnly, /combat-stat-footer/);
  assert.doesNotMatch(attackOnly, /combat-hp-meta|is-separated/);
  assert.equal(ui.renderCombatStats({}), '');
});
