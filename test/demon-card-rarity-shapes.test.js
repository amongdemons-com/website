const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const cardSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'demon-cards.js'),
  'utf8'
);
const rewardSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'dungeon', 'rewards.js'),
  'utf8'
);
const battleCss = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'battle.css'),
  'utf8'
);

test('shared demon cards label all six rarity marker shapes', () => {
  const context = {
    window: {
      AmongDemons: {
        ui: {
          renderIcon: () => '',
          toDemonImageUrl: () => '/demon.png'
        }
      }
    }
  };
  vm.runInNewContext(cardSource, context);
  const renderCard = context.window.AmongDemons.ui.renderDemonCard;

  ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].forEach((rarity) => {
    assert.match(
      renderCard({ rarity, atk: 10 }),
      new RegExp(`dungeon-demon-rarity-gem--${rarity}`)
    );
    assert.match(battleCss, new RegExp(`\\.dungeon-demon-rarity-gem--${rarity}\\s*\\{`));
  });
});

test('cashout demon previews use the matching rarity marker shape', () => {
  assert.match(rewardSource, /dungeon-demon-rarity-gem--\$\{escapeHtml\(rarityKey\)\}/);
});

test('the Rare diamond is optically enlarged to match the other shapes', () => {
  assert.match(
    battleCss,
    /\.dungeon-demon-rarity-gem--rare\s*\{[^}]*width: 1rem;[^}]*height: 1rem;/s
  );
});
