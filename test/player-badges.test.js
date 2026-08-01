const test = require('node:test');
const assert = require('node:assert/strict');

const { _test: hunterPage } = require('../lib/hunter-page');
const {
  getPlayerBadgeDefinition,
  getPlayerBadgesByPlayerIds
} = require('../public/api/lib/player-badges');
const { parseOptions } = require('../scripts/award-player-badge');

test('Chosen Before Dawn has the requested title and description', () => {
  const badge = getPlayerBadgeDefinition('chosen_before_dawn');
  assert.equal(badge.name, 'Chosen Before Dawn');
  assert.equal(badge.description, 'Helped test and shape Among Demons during pre-alpha.');
  assert.equal(badge.icon, 'shield');
  assert.doesNotMatch(`${badge.name}${badge.description}`, /—/);
});

test('player badges resolve in stable award order', async () => {
  const queryable = {
    async query(sql, params) {
      assert.match(sql, /FROM player_badges/);
      assert.deepEqual(params, ['player-1', 'player-2']);
      return [[{
        player_id: 'player-1',
        badge_key: 'chosen_before_dawn',
        awarded_at: new Date('2026-08-01T00:00:00.000Z')
      }]];
    }
  };
  const result = await getPlayerBadgesByPlayerIds(['player-1', 'player-2'], queryable);
  assert.deepEqual(result.get('player-2'), []);
  assert.equal(result.get('player-1')[0].name, 'Chosen Before Dawn');
});

test('badge tooltip renders its description on a row below the title', () => {
  const html = hunterPage.renderServerPlayerBadges([
    getPlayerBadgeDefinition('chosen_before_dawn')
  ]);
  assert.match(html, /<strong>Chosen Before Dawn<\/strong>\s*<span>Helped test and shape Among Demons during pre-alpha\.<\/span>/);
  assert.match(html, /data-lucide="shield"/);
  assert.doesNotMatch(html, /—/);
});

test('badge awards require explicit apply', () => {
  const preview = parseOptions(['chosen_before_dawn', 'albanezu']);
  const applied = parseOptions(['chosen_before_dawn', 'albanezu', '--apply']);
  assert.equal(preview.apply, false);
  assert.equal(applied.apply, true);
});
