const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

let modulePromise = null;

function getRecruitModule() {
  if (!modulePromise) {
    modulePromise = esbuild.build({
      stdin: {
        contents: `
          import { state } from './public/app/js/dungeon/state.js';
          import { shouldShowCollectionMissingTag } from './public/app/js/dungeon/recruit.js';
          export { state, shouldShowCollectionMissingTag };
        `,
        resolveDir: path.join(__dirname, '..')
      },
      bundle: true,
      format: 'cjs',
      platform: 'browser',
      write: false
    }).then((result) => {
      const module = { exports: {} };
      vm.runInNewContext(result.outputFiles[0].text, {
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
      });
      return module.exports;
    });
  }
  return modulePromise;
}

test('complete unsummoned Echo stacks do not mark dungeon demons as new', async () => {
  const { state, shouldShowCollectionMissingTag } = await getRecruitModule();
  state.collectionDemons = [];
  state.collectionEchoes = [{
    itemKey: 'echo:7:rare',
    summonReady: false,
    summonProgress: 2,
    summonRequirement: 2
  }];

  assert.equal(
    shouldShowCollectionMissingTag({ typeId: 7, rarity: 'rare' }),
    false
  );
  assert.equal(
    shouldShowCollectionMissingTag({ typeId: 7, rarity: 'common' }),
    true
  );
});
