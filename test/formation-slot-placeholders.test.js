const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getFullBossCatalog } = require('../public/api/lib/game-data');
const { getBossPagePath, renderBossPage } = require('../lib/seo-pages');

const root = path.join(__dirname, '..');
const sourceFiles = [
  'lib/hunter-page.js',
  'lib/seo-pages.js',
  'public/app/js/dungeon/cards.js',
  'public/app/js/hunter-ui.js',
  'public/app/js/world-ui.js'
];

test('every formation renderer maps front slots to shields and back slots to bow and arrow', () => {
  const sources = sourceFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
  const combined = sources.join('\n');

  assert.doesNotMatch(combined, /amongdemons_team_slot_[a-z_]+\.png/);
  assert.doesNotMatch(combined, /formation-slot-placeholder-img/);

  for (const source of sources.slice(2)) {
    assert.match(source, /position === 'front'[\s\S]{0,80}renderIcon\('shield'/);
    assert.match(source, /renderIcon\('ranged'/);
  }

  for (const source of sources.slice(0, 2)) {
    assert.match(source, /data-lucide="shield"/);
    assert.match(source, /data-lucide="bow-arrow"/);
  }

  const lucideSubset = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'lucide-subset.js'), 'utf8');
  assert.match(lucideSubset, /"Shield":/);
  assert.match(lucideSubset, /"BowArrow":/);
  assert.match(lucideSubset, /"shield":/);
  assert.match(lucideSubset, /"bow-arrow":/);
});

test('every boss guide renders ranged icons in each open ranged formation slot', async () => {
  const bosses = await getFullBossCatalog();
  const rangedSlots = new Set([1, 2, 4, 5, 7, 8]);

  for (const boss of bosses) {
    const occupiedSlots = getOccupiedFormationSlots(boss.team);
    const expectedRangedIcons = [...rangedSlots]
      .filter((slot) => !occupiedSlots.has(slot))
      .length;
    const html = renderBossPage(boss, []);
    const rangedIcons = (html.match(/data-lucide="bow-arrow"/g) || []).length;

    assert.equal(
      rangedIcons,
      expectedRangedIcons,
      `${getBossPagePath(boss)} should render one bow-and-arrow icon per open ranged slot`
    );
  }
});

function getOccupiedFormationSlots(team = []) {
  const assignments = Array.from({ length: 9 }, () => null);
  const overflow = [];

  team.slice(0, 9).forEach((member) => {
    const slot = Number(member.formationSlot);
    if (Number.isInteger(slot) && slot >= 0 && slot < assignments.length && !assignments[slot]) {
      assignments[slot] = member;
    } else {
      overflow.push(member);
    }
  });

  overflow.forEach((member) => {
    const slot = assignments.findIndex((candidate) => !candidate);
    if (slot >= 0) assignments[slot] = member;
  });

  return new Set(assignments.flatMap((member, slot) => member ? [slot] : []));
}
