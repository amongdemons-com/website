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

test('demon card and detail modal can cap displayed attack speed without mutating it', () => {
  const { ui, modalBody } = loadDemonCardUi();
  const demon = { typeId: 1, atk: 20, speed: 147 };
  const statsOptions = { maxDisplayedSpeed: 100 };

  const cardHtml = ui.renderDemonCard(demon, { hideRarity: true, statsOptions });
  assert.match(cardHtml, /data-test-icon="speed"><\/i>100/);
  assert.doesNotMatch(cardHtml, /data-test-icon="speed"><\/i>147/);

  ui.openDemonDetailsModal(demon, { hideRarity: true, statsOptions });
  assert.match(
    modalBody.innerHTML,
    /data-detail-stat="speed"[\s\S]*?<span class="demon-detail-stat-value">100<\/span>/
  );
  assert.equal(demon.speed, 147);
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
