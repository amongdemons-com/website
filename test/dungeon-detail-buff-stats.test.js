const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

let previewModulePromise = null;

function getPreviewModule() {
  if (!previewModulePromise) {
    previewModulePromise = esbuild.build({
      stdin: {
        contents: `
          import { getDungeonBaseStatPreviewDemon } from './public/app/js/dungeon/recruit.js';
          export { getDungeonBaseStatPreviewDemon };
        `,
        resolveDir: path.join(__dirname, '..')
      },
      bundle: true,
      format: 'cjs',
      platform: 'browser',
      write: false
    }).then((result) => {
      const module = { exports: {} };
      const context = {
        module,
        exports: module.exports,
        window: {
          AmongDemons: {
            getSession: () => ({}),
            ui: {}
          }
        },
        localStorage: { getItem: () => null },
        console,
        setTimeout,
        clearTimeout
      };
      vm.runInNewContext(result.outputFiles[0].text, context);
      return module.exports;
    });
  }
  return previewModulePromise;
}

test('Dungeon detail base stats remove applied effects without changing the demon state', async () => {
  const { getDungeonBaseStatPreviewDemon } = await getPreviewModule();
  const demon = {
    instanceId: 'player-1',
    hp: 69,
    maxHp: 138,
    atk: 30,
    effectiveAtk: 44,
    speed: 14,
    runBaseAtk: 25,
    runBaseMaxHp: 120,
    runBaseSpeed: 10
  };

  const base = getDungeonBaseStatPreviewDemon(demon);

  assert.deepEqual(JSON.parse(JSON.stringify({
    hp: base.hp,
    maxHp: base.maxHp,
    atk: base.atk,
    speed: base.speed,
    hasEffectiveAtk: Object.hasOwn(base, 'effectiveAtk')
  })), {
    hp: 60,
    maxHp: 120,
    atk: 25,
    speed: 10,
    hasEffectiveAtk: false
  });
  assert.equal(demon.maxHp, 138);
  assert.equal(demon.effectiveAtk, 44);
});

test('only player-team detail cards offer a remembered in-card buff-stat checkbox', () => {
  const root = path.join(__dirname, '..');
  const modalSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'modals.js'), 'utf8');
  const cardSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'demon-cards.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public', 'app', 'css', 'base.css'), 'utf8');

  assert.match(modalSource, /isPlayerTeamCard = Boolean\(card\?\.closest\('#teamGrid'\)\)/);
  assert.match(modalSource, /DUNGEON_DETAIL_BUFF_STATS_KEY/);
  assert.match(modalSource, /stored === null \? true : stored !== '0'/);
  assert.match(modalSource, /localStorage\.setItem\(DUNGEON_DETAIL_BUFF_STATS_KEY/);
  assert.match(modalSource, /hasDungeonBuffedStatDifference\(baseDemon, buffedDemon\)/);
  assert.match(modalSource, /label: 'Show with buffs applied'/);
  assert.match(cardSource, /data-demon-detail-stat-toggle/);
  assert.match(cardSource, /\$\{renderDetailMeta\(demon\)\}[\s\S]*\$\{renderDetailStatToggle\(options\.statToggle\)\}/);
  assert.match(css, /\.demon-detail-stat-toggle/);
  assert.match(css, /\.demon-detail-stat-toggle-row\s*{[^}]*margin-top:\s*auto;/s);
  assert.doesNotMatch(cardSource, /demon-detail-stat-bonus/);
  assert.doesNotMatch(css, /demon-detail-buff-track/);
});
