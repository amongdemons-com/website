const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  createWorldTeamStatPreviews
} = require('../public/api/lib/world-combat');

test('World team stat previews include combat buffs without duplicating demon data', () => {
  const previews = createWorldTeamStatPreviews([
    {
      id: 42,
      typeId: 1,
      species: 'Preview Demon',
      rarity: 'rare',
      hp: 100,
      atk: 20,
      speed: 10
    }
  ], {
    activeBuffs: [{
      id: 'preview-buff',
      name: 'Preview Buff',
      effects: [
        { type: 'max_hp_mult', value: 1.25 },
        { type: 'direct_damage_mult', value: 1.2 },
        { type: 'speed_flat', value: 3 }
      ]
    }]
  });

  assert.deepEqual(previews, {
    42: {
      maxHp: 125,
      atk: 20,
      speed: 13,
      effectiveAtk: 24
    }
  });
  assert.equal(Object.hasOwn(previews[42], 'species'), false);
  assert.equal(Object.hasOwn(previews[42], 'imageUrl'), false);
});

test('World team editor offers a remembered buff-stat checkbox', () => {
  const root = path.join(__dirname, '..');
  const source = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'world-ui.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public', 'app', 'world.html'), 'utf8');

  assert.match(html, /id="worldTeamShowBuffStats"/);
  assert.match(html, /Show buff stats on cards/);
  assert.match(html, /id="worldTeamEditorGrid"><\/div>\s*<div class="world-team-editor-options">/);
  assert.match(source, /WORLD_TEAM_BUFF_STATS_KEY/);
  assert.match(source, /localStorage\.setItem\(WORLD_TEAM_BUFF_STATS_KEY/);
  assert.match(source, /normalizeWorldTeamEditorStatPreviews\(payload\.statPreviews\)/);
  assert.match(source, /getWorldTeamEditorDisplayDemon/);
});
