const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { getFullBossCatalog } = require('../public/api/lib/game-data');
const { renderBossPage, renderBossesPage } = require('../lib/seo-pages');

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
const baseCss = fs.readFileSync(path.join(__dirname, '../public/app/css/base.css'), 'utf8');

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
    assert.match(baseCss, new RegExp(`\\.dungeon-demon-rarity-gem--${rarity}\\s*\\{`));
  });
});

test('cashout demon previews use the matching rarity marker shape', () => {
  assert.match(rewardSource, /dungeon-demon-rarity-gem--\$\{escapeHtml\(rarityKey\)\}/);
});

test('the Rare diamond is optically enlarged to match the other shapes', () => {
  assert.match(
    baseCss,
    /\.dungeon-demon-rarity-gem--rare\s*\{[^}]*width: 1rem;[^}]*height: 1rem;/s
  );
});

test('mobile portrait uses thinner outlines and larger Collection and Hunter markers', () => {
  const mobilePortrait = battleCss.match(
    /@media \(max-width: 575\.98px\) and \(orientation: portrait\) \{[\s\S]*?\.dungeon-demon-rarity-gem::after[\s\S]*?\.hunter-team-board \.dungeon-demon-rarity-gem--mythic[\s\S]*?\n\}/
  )?.[0] || '';

  assert.match(mobilePortrait, /\.dungeon-demon-rarity-gem::after\s*\{\s*inset: 1px;/);
  assert.match(mobilePortrait, /\.collection-card-grid \.dungeon-demon-rarity-gem,[\s\S]*?width: 0\.9rem;/);
  assert.match(mobilePortrait, /#teamChoiceModal\.is-collection-reinforcement-modal \.dungeon-demon-rarity-gem/);
  assert.match(mobilePortrait, /\.hunter-team-board \.dungeon-demon-rarity-gem\s*\{[\s\S]*?width: 0\.78rem;/);
});

test('boss listing and key portraits render every rarity shape instead of a fixed diamond', async () => {
  const [boss] = await getFullBossCatalog();
  for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
    const variant = { ...boss, keyDemon: { ...boss.keyDemon, rarity } };
    for (const html of [renderBossesPage([variant]), renderBossPage(variant, [])]) {
      assert.match(html, new RegExp(`dungeon-demon-rarity-gem--${rarity} boss-key-demon-gem`));
      assert.match(html, new RegExp(`aria-label="${rarity[0].toUpperCase() + rarity.slice(1)} rarity"`));
    }
  }
  assert.doesNotMatch(baseCss, /\.boss-key-demon-art::after/);
});

test('every boss formation member has its own rarity-specific emblem', async () => {
  for (const boss of await getFullBossCatalog()) {
    const html = renderBossPage(boss, []);
    const formations = [...html.matchAll(/class="dungeon-demon-card hunter-team-card"[\s\S]*?<span class="dungeon-demon-rarity-gem dungeon-demon-rarity-gem--([a-z]+)"/g)];
    assert.equal(formations.length, boss.team.length);
    assert.deepEqual(formations.map(m => m[1]).sort(), boss.team.map(m => m.rarity).sort());
  }
});

test('shared rarity shapes have a dark outer contour and preserve their rarity-colored fill', () => {
  assert.match(baseCss, /\.dungeon-demon-rarity-gem\s*\{[^}]*background: #101820;[^}]*clip-path: var\(--rarity-shape\);/s);
  assert.match(baseCss, /\.dungeon-demon-rarity-gem::after\s*\{[^}]*inset: 2px;[^}]*background: var\(--rarity-color, #D1D5D8\);/s);
  assert.match(baseCss, /\.boss-key-demon-art \.boss-key-demon-gem\s*\{[^}]*top: auto;[^}]*left: 50%;/s);
});
