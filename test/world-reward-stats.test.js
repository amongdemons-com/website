const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');

const { getHuntSoulCapacity } = require('../public/api/lib/account-stat-points');
const {
  applyPreBattleBuffs
} = require('../public/api/lib/combat-buffs');
const { simulateFight } = require('../public/api/lib/combat');
const {
  createPlayerCombatBuffState,
  getActivePlayerWorldRewardBuffs
} = require('../public/api/lib/player-combat-buffs');
const {
  getBuffedHuntSoulCapacity
} = require('../public/api/lib/world-combat');
const {
  loadWorldBosses
} = require('../public/api/lib/world-bosses');
const { SOUL_FONT_BUFFS } = require('../public/api/lib/world-soul-font');
const demonTypes = require('../public/api/data/demon-types.json');

let dungeonPreviewModulePromise = null;

function getDungeonPreviewModule() {
  if (!dungeonPreviewModulePromise) {
    dungeonPreviewModulePromise = esbuild.build({
      stdin: {
        contents: `
          import { applyDungeonCombatStatPreviewToDemon } from './public/app/js/dungeon/recruit.js';
          import { state } from './public/app/js/dungeon/state.js';

          export function preview(demon, worldBuffs) {
            state.statPoints = { bonuses: {} };
            state.run = { buffs: { activeBuffs: [] }, worldBuffs };
            return applyDungeonCombatStatPreviewToDemon(demon);
          }
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
  return dungeonPreviewModulePromise;
}

function getBossRewardBuffs() {
  return loadWorldBosses()
    .map((boss) => boss.rewardBuff)
    .filter(Boolean);
}

test('Siegeborn grants 25% AOE damage and 25% health', () => {
  const siegeborn = getBossRewardBuffs().find((buff) => buff.name === 'Siegeborn');

  assert.ok(siegeborn);
  assert.equal(siegeborn.description, '+25% AOE Damage · +25% Health');
  assert.deepEqual(siegeborn.effects, [
    { type: 'aoe_damage_mult', value: 1.25 },
    { type: 'max_hp_mult', value: 1.25 }
  ]);
});

test('Harvester doubles the complete skill-tree Soul Vessel capacity', () => {
  const allocations = {
    soul_capacity: 5,
    soul_capacity_percent: 5,
    soul_capacity_mastery: 2
  };
  const summary = { allocations };
  const harvester = getBossRewardBuffs()
    .find((buff) => buff.name === 'Harvester');

  assert.ok(harvester);
  assert.equal(getHuntSoulCapacity(summary), 255);
  assert.equal(getBuffedHuntSoulCapacity(summary, [harvester]), 510);
});

test('type 10 all-boss preparation preview equals its battle healing', () => {
  const summary = {
    bonuses: {
      maxHpFlat: 35,
      maxHpPercent: 15,
      healingFlat: 10,
      healingPercent: 15,
      speedFlat: 5,
      speedPercent: 10
    }
  };
  const playerBuffs = createPlayerCombatBuffState(summary, {
    activeBuffs: getBossRewardBuffs()
  });
  const healer = {
    instanceId: 'player-healer',
    typeId: 10,
    rarity: 'mythic',
    hp: 1_000,
    maxHp: 1_000,
    atk: 20,
    speed: 100,
    position: 'back'
  };
  const enemy = {
    instanceId: 'enemy-attacker',
    typeId: 1,
    rarity: 'common',
    hp: 5_000,
    maxHp: 5_000,
    atk: 100,
    speed: 100,
    position: 'front'
  };

  const preview = applyPreBattleBuffs([healer], playerBuffs)[0];
  const fight = simulateFight(
    () => 0.5,
    [healer],
    [enemy],
    { demonTypes, combatType: 'dungeon', playerBuffs }
  );
  const firstHeal = fight.combatLog.find((entry) => entry.effect === 'heal');

  assert.equal(preview.effectiveAtk, 52);
  assert.equal(fight.playerTeamBefore[0].effectiveAtk, preview.effectiveAtk);
  assert.equal(firstHeal.healing, preview.effectiveAtk);
});

test('dungeon preparation retains every active world reward after battle', () => {
  const bossBuff = getBossRewardBuffs()[0];
  const soulFontBuff = SOUL_FONT_BUFFS.find((buff) => (
    buff.effects.some((effect) => effect.type === 'healing_mult')
  ));
  const playerBuffs = createPlayerCombatBuffState({}, {
    activeBuffs: [bossBuff, soulFontBuff]
  });
  const worldBuffs = getActivePlayerWorldRewardBuffs(playerBuffs);

  assert.deepEqual(
    worldBuffs.map((buff) => buff.id),
    [bossBuff.id, soulFontBuff.id]
  );
  assert.deepEqual(
    worldBuffs.map((buff) => buff.source),
    ['world_boss_reward', 'soul_font']
  );
});

test('every Whispering Well buff is reflected by preparation card stats', async () => {
  const { preview } = await getDungeonPreviewModule();
  const cases = [
    ['soul_font_vigor', 1, { maxHp: 125, attack: 20, speed: 10 }],
    ['soul_font_severing', 1, { maxHp: 100, attack: 24, speed: 10 }],
    ['soul_font_chorus', 4, { maxHp: 100, attack: 24, speed: 10 }],
    ['soul_font_quickness', 1, { maxHp: 100, attack: 20, speed: 12 }],
    ['soul_font_renewal', 10, { maxHp: 100, attack: 25, speed: 10 }],
    ['soul_font_venom', 3, { maxHp: 100, attack: 29, speed: 10 }],
    ['soul_font_bone_mirror', 8, { maxHp: 100, attack: 40, speed: 10 }]
  ];

  for (const [buffId, typeId, expected] of cases) {
    const buff = SOUL_FONT_BUFFS.find((candidate) => candidate.id === buffId);
    const demon = {
      instanceId: `preview-${typeId}`,
      typeId,
      rarity: 'rare',
      hp: 100,
      maxHp: 100,
      atk: 20,
      speed: 10,
      position: typeId === 10 ? 'back' : 'front'
    };
    const visual = JSON.parse(JSON.stringify(preview(demon, [buff])));
    const battle = applyPreBattleBuffs([demon], { activeBuffs: [buff] })[0];
    const visualAttack = Number(visual.effectiveAtk ?? visual.atk);
    const battleAttack = Number(battle.effectiveAtk ?? battle.atk);

    assert.ok(buff, buffId);
    assert.equal(visual.maxHp, expected.maxHp, `${buffId} HP`);
    assert.equal(visualAttack, expected.attack, `${buffId} output`);
    assert.equal(visual.speed, expected.speed, `${buffId} Speed`);
    assert.equal(visual.maxHp, battle.maxHp, `${buffId} battle HP`);
    assert.equal(visualAttack, battleAttack, `${buffId} battle output`);
    assert.equal(visual.speed, battle.speed, `${buffId} battle Speed`);
  }
});
