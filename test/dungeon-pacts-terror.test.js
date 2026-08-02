const test = require('node:test');
const assert = require('node:assert/strict');

const {
  canSelectRunBuff,
  getCombatBuffById,
  getNonRepeatableBuffChoiceExclusions,
  getPactRerollCost,
  loadCombatBuffs,
  serializeCombatBuffState
} = require('../public/api/lib/combat-buffs');
const { getEnemyPressureMultipliers } = require('../public/api/lib/dungeon-enemies');

test('rarity-targeted Pacts can each be selected only once per run', () => {
  const rarityPactIds = loadCombatBuffs()
    .filter((buff) => buff.tags.includes('rarity'))
    .map((buff) => buff.id);
  const run = { state: { buffs: { active: rarityPactIds } } };

  assert.ok(rarityPactIds.length >= 4);
  const options = { uniqueRarityPacts: true };
  assert.deepEqual(getNonRepeatableBuffChoiceExclusions(run, options), rarityPactIds);
  rarityPactIds.forEach((id) => assert.equal(canSelectRunBuff(run, id, options), false));
});

test('different rarity-targeted Pacts remain compatible in the same run', () => {
  const run = { state: { buffs: { active: ['many_below'] } } };

  const options = { uniqueRarityPacts: true };
  assert.equal(canSelectRunBuff(run, 'many_below', options), false);
  assert.equal(canSelectRunBuff(run, 'crimson_standard', options), true);
  assert.equal(canSelectRunBuff(run, 'many_below'), true, 'the Dungeon-only rule must not alter Ranked');
});

test('Mythic Ascendancy targets only Mythic demons', () => {
  const pact = getCombatBuffById('mythic_ascendancy');

  assert.equal(pact.name, 'Mythic Ascendancy');
  assert.ok(pact.tags.includes('rarity'));
  pact.effects.forEach((effect) => assert.deepEqual(effect.targetRarities, ['mythic']));
});

test('Demonic Pact recast cost increases by player level', () => {
  assert.equal(getPactRerollCost(1), 10);
  assert.equal(getPactRerollCost(10), 28);
  assert.equal(getPactRerollCost(51), 110);
  assert.equal(serializeCombatBuffState({}, { playerLevel: 10 }).rerollCost, 28);
});

test('Dungeon Terror preserves the linear curve through floor 30 and compounds afterward', () => {
  const floor20 = getEnemyPressureMultipliers(20);
  const floor30 = getEnemyPressureMultipliers(30);
  const floor40 = getEnemyPressureMultipliers(40);

  assert.equal(floor20.hp, 1.09);
  assert.equal(floor30.hp, 1.54);
  assert.equal(floor30.atk, 1.48);
  assert.equal(floor30.speed, 1 + 12 * 0.012);
  assert.ok(floor40.hp - floor30.hp > floor30.hp - floor20.hp);
  assert.ok(floor40.atk - floor30.atk > floor30.atk - floor20.atk);
  assert.equal(floor40.hp, 1.54 * Math.pow(1.045, 10));
  assert.equal(floor40.atk, 1.48 * Math.pow(1.03, 10));
  assert.equal(floor40.speed, 1 + 22 * 0.012);
});

test('Dungeon Terror pressure is independent of player level', () => {
  const newHunter = getEnemyPressureMultipliers(18, { playerLevel: 1 });
  const experiencedHunter = getEnemyPressureMultipliers(18, { playerLevel: 26 });

  assert.deepEqual(experiencedHunter, newHunter);
});

test('Dungeon Pact pressure stays additive before the deep-floor tail compounds it', () => {
  const buffs = { active: ['blood_pact', 'thick_hide'] };
  const floor30 = getEnemyPressureMultipliers(30, { buffs });
  const floor31 = getEnemyPressureMultipliers(31, { buffs });

  assert.equal(floor30.hp, 1 + 12 * 0.045 + 2 * 0.07);
  assert.equal(floor30.atk, 1 + 12 * 0.04 + 2 * 0.055);
  assert.equal(floor31.hp, floor30.hp * 1.045);
  assert.equal(floor31.atk, floor30.atk * 1.03);
});

test('World Terror can retain its existing linear pressure curve', () => {
  const pressure = getEnemyPressureMultipliers(38, { terrorScaling: 'linear' });

  assert.equal(pressure.hp, 1.9);
  assert.equal(pressure.atk, 1.8);
  assert.equal(pressure.speed, 1.24);
});
