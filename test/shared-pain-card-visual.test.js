const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

let combatPreviewModulePromise = null;

function getCombatPreviewModule() {
  if (!combatPreviewModulePromise) {
    combatPreviewModulePromise = esbuild.build({
      stdin: {
        contents: `
          import { applySharedPainStatPreview } from './public/app/js/dungeon/combat.js';
          export { applySharedPainStatPreview };
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
            api: async () => ({}),
            audio: null,
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
  return combatPreviewModulePromise;
}

test('Shared Pain stacks the visible attack value for surviving single-target demons', async () => {
  const { applySharedPainStatPreview } = await getCombatPreviewModule();
  const singleTarget = { instanceId: 'single', typeId: 1, atk: 22 };
  const areaAttacker = { instanceId: 'area', typeId: 4, atk: 20 };
  const demons = new Map([
    [singleTarget.instanceId, singleTarget],
    [areaAttacker.instanceId, areaAttacker]
  ]);
  const entry = {
    effect: 'shared_pain',
    affectedAllies: ['single', 'area'],
    directDamageMult: 1.25
  };

  applySharedPainStatPreview(demons, entry);
  assert.equal(singleTarget.effectiveAtk, 28);
  assert.equal(areaAttacker.effectiveAtk, undefined);
  assert.equal(singleTarget.battleBuffs.directDamageMult, 1.25);

  applySharedPainStatPreview(demons, entry);
  assert.equal(singleTarget.effectiveAtk, 34);
  assert.equal(singleTarget.battleBuffs.directDamageMult, 1.5625);
});
