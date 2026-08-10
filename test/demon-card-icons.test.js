const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'demon-cards.js'),
  'utf8'
);

test('demon cards select role-specific attack icons', () => {
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
  const renderCard = context.window.AmongDemons.ui.renderDemonCard;
  const renderType = (typeId) => renderCard({ typeId, atk: 10 }, { hideRarity: true });

  assert.match(renderType(1), /data-test-icon="attack"/);
  assert.match(renderType(2), /data-test-icon="ranged"/);
  assert.match(renderType(6), /data-test-icon="ranged"/);
  assert.match(renderType(11), /data-test-icon="ranged"/);
  assert.match(renderType(3), /data-test-icon="poison"/);
  assert.match(renderType(4), /data-test-icon="aoe"/);
  assert.match(renderType(7), /data-test-icon="attack"/);
});
