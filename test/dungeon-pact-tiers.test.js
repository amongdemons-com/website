const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

let pactUiModulePromise = null;

function getPactUiModule() {
  if (!pactUiModulePromise) {
    pactUiModulePromise = esbuild.build({
      stdin: {
        contents: `
          import {
            renderDemonicPactCard,
            renderActivePactIcon,
            getPactTier,
            getDemonicPactTargetRarities
          } from './public/app/js/dungeon/pacts.js';
          export {
            renderDemonicPactCard,
            renderActivePactIcon,
            getPactTier,
            getDemonicPactTargetRarities
          };
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
            audio: null,
            getSession: () => ({}),
            ui: {
              renderIcon: (name) => `<svg data-icon="${name}"></svg>`,
              renderSoulAmount: (value) => String(value)
            }
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
  return pactUiModulePromise;
}

test('Pact offer rarity is presented as a distinct three-level Pact tier', async () => {
  const { renderDemonicPactCard, getPactTier } = await getPactUiModule();
  const card = renderDemonicPactCard({
    id: 'dire_focus',
    name: 'Dire Focus',
    description: 'Damage and speed are increased.',
    rarity: 'rare',
    icon: 'eye',
    tags: ['damage', 'speed'],
    effects: [{ type: 'direct_damage_mult', value: 1.18 }]
  });

  assert.equal(getPactTier('common').label, 'Pact Tier I');
  assert.equal(getPactTier('uncommon').label, 'Pact Tier II');
  assert.equal(getPactTier('rare').label, 'Pact Tier III');
  assert.match(card, /is-tier-3/);
  assert.match(card, /Pact Tier/);
  assert.match(card, />III</);
  assert.match(card, /demonic-pact-card-main[\s\S]*demonic-pact-card-emblem[\s\S]*demonic-pact-card-copy[\s\S]*demonic-pact-description[\s\S]*<\/span>\s*<\/span>\s*<span class="demonic-pact-tags">/);
  assert.doesNotMatch(card, /demonic-pact-tier-marks/);
  assert.doesNotMatch(card, /is-rare/);
  assert.doesNotMatch(card, />Rare</);
});

test('rarity-targeted Pacts show exactly which demon rarities are affected', async () => {
  const { renderDemonicPactCard, getDemonicPactTargetRarities } = await getPactUiModule();
  const pact = {
    id: 'many_below',
    name: 'The Many Below',
    description: 'Affected demons gain damage and max HP.',
    rarity: 'uncommon',
    tags: ['rarity', 'damage', 'health'],
    effects: [
      { type: 'direct_damage_mult', value: 1.3, targetRarities: ['common', 'uncommon'] },
      { type: 'max_hp_mult', value: 1.25, targetRarities: ['common', 'uncommon'] }
    ]
  };
  const targets = Array.from(getDemonicPactTargetRarities(pact));
  const card = renderDemonicPactCard(pact);

  assert.deepEqual(targets, ['common', 'uncommon']);
  assert.match(card, />Affects</);
  assert.match(card, /demonic-pact-target rarity-common">Common</);
  assert.match(card, /demonic-pact-target rarity-uncommon">Uncommon</);
  assert.doesNotMatch(card, />rarity</i);
});

test('active Pact chips no longer reuse demon rarity stripes', async () => {
  const { renderActivePactIcon } = await getPactUiModule();
  const html = renderActivePactIcon({
    id: 'dire_focus',
    name: 'Dire Focus',
    description: 'Damage and speed are increased.',
    rarity: 'rare',
    icon: 'eye'
  });
  const styles = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'), 'utf8');

  assert.doesNotMatch(html, /is-rare/);
  assert.doesNotMatch(styles, /\.active-pact-chip\.is-(?:common|uncommon|rare)/);
  assert.match(styles, /\.demonic-pact-card\.is-tier-3/);
  assert.match(styles, /\.demonic-pact-icon\s*{[^}]*display:\s*flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;[^}]*color:\s*#f5d56d;/s);
  const pactIconStyles = styles.match(/\.demonic-pact-icon\s*{([^}]*)}/s)?.[1] || '';
  assert.doesNotMatch(pactIconStyles, /var\(--pact-tier-/);

  const targetedHtml = renderActivePactIcon({
    id: 'crimson_standard',
    name: 'Crimson Standard',
    description: '[Rare] demons gain damage and speed.',
    rarity: 'rare',
    icon: 'flag',
    effects: [{ type: 'speed_mult', value: 1.2, targetRarities: ['rare'] }]
  });
  assert.match(targetedHtml, /Affects: Rare demons\./);
});
