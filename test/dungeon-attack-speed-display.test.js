const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const cardSource = fs.readFileSync(
  path.join(root, 'public', 'app', 'js', 'demon-cards.js'),
  'utf8'
);

function loadDemonCardUi() {
  const modalBody = { innerHTML: '' };
  const modalContent = { style: { setProperty: () => {} } };
  const modalElement = {
    querySelector: (selector) => {
      if (selector === '.modal-content') return modalContent;
      if (selector === '.modal-body') return modalBody;
      return null;
    },
    querySelectorAll: () => []
  };
  const context = {
    window: {
      AmongDemons: {
        ui: {
          renderIcon: (name) => `<i data-test-icon="${name}"></i>`,
          toDemonImageUrl: () => '/demon.png'
        }
      }
    },
    document: {
      body: { insertAdjacentHTML: () => {} },
      getElementById: () => modalElement
    },
    bootstrap: {
      Modal: {
        getOrCreateInstance: () => ({ show: () => {} })
      }
    }
  };

  vm.runInNewContext(cardSource, context);
  return { ui: context.window.AmongDemons.ui, modalBody };
}

test('card DPT caps attack speed while details retain separate uncropped stats', () => {
  const { ui, modalBody } = loadDemonCardUi();
  const demon = { typeId: 1, atk: 142100, speed: 147, hp: 2400000, maxHp: 3000000 };
  const statsOptions = { maxDisplayedSpeed: 100 };

  const cardHtml = ui.renderDemonCard(demon, { hideRarity: true, statsOptions });
  assert.match(cardHtml, /js-demon-atk">142\.1k<\/span>/);
  assert.doesNotMatch(cardHtml, /data-test-icon="speed"/);

  ui.openDemonDetailsModal(demon, { hideRarity: true, statsOptions });
  assert.match(
    modalBody.innerHTML,
    /data-detail-stat="speed"[\s\S]*?<span class="demon-detail-stat-value">100<\/span>/
  );
  assert.match(modalBody.innerHTML, /data-detail-stat="atk"[\s\S]*?demon-detail-stat-value">142100<\/span>/);
  assert.match(modalBody.innerHTML, /demon-detail-stat-value">2400000 \/ 3000000<\/span>/);
  assert.doesNotMatch(modalBody.innerHTML, /per tick|DPT|142\.1k|2\.4m/);
  assert.equal(demon.speed, 147);
});

test('per-tick card stats use effective attack and preserve Kopak retaliation', () => {
  const { ui } = loadDemonCardUi();
  for (const typeId of [1, 3, 4, 10]) {
    const html = ui.renderDemonCard({ typeId, atk: 20, effectiveAtk: 31, speed: 25 });
    assert.match(html, /js-demon-atk">7\.8<\/span>/);
    assert.match(html, typeId === 10 ? /Healing per tick/ : /Damage per tick/);
    assert.doesNotMatch(html, /data-test-icon="speed"/);
  }
  for (const identity of [{ typeId: 8 }, { type_id: 8 }, { type: 8 }]) {
    const html = ui.renderDemonCard({ ...identity, atk: 1200, speed: 25 });
    assert.match(html, /title="Retaliation: 1200"/);
    assert.match(html, /js-demon-atk">1\.2k<\/span>/);
    assert.doesNotMatch(html, /per tick|data-test-icon="speed"/);
  }
  assert.match(ui.renderDemonCard({ atk: 20, speed: 0 }), /js-demon-atk">0<\/span>/);
});

test('dungeon cards and detail modal use the 100 attack-speed display cap', () => {
  const configSource = fs.readFileSync(
    path.join(root, 'public', 'app', 'js', 'dungeon', 'config.js'),
    'utf8'
  );
  const dungeonCardSource = fs.readFileSync(
    path.join(root, 'public', 'app', 'js', 'dungeon', 'cards.js'),
    'utf8'
  );
  const dungeonModalSource = fs.readFileSync(
    path.join(root, 'public', 'app', 'js', 'dungeon', 'modals.js'),
    'utf8'
  );

  assert.match(configSource, /MAX_DUNGEON_DISPLAYED_ATTACK_SPEED = 100/);
  assert.match(dungeonCardSource, /maxDisplayedSpeed: MAX_DUNGEON_DISPLAYED_ATTACK_SPEED/);
  assert.match(dungeonModalSource, /maxDisplayedSpeed: MAX_DUNGEON_DISPLAYED_ATTACK_SPEED/);
});
