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

test('Dungeon Terror pressure grows exponentially with floor depth', () => {
  const floor20 = getEnemyPressureMultipliers(20);
  const floor30 = getEnemyPressureMultipliers(30);
  const floor40 = getEnemyPressureMultipliers(40);

  assert.ok(floor30.hp - floor20.hp > 0);
  assert.ok(floor40.hp - floor30.hp > floor30.hp - floor20.hp);
  assert.ok(floor40.atk - floor30.atk > floor30.atk - floor20.atk);
});

test('Dungeon Terror pressure factors in player level', () => {
  const newHunter = getEnemyPressureMultipliers(18, { playerLevel: 1 });
  const experiencedHunter = getEnemyPressureMultipliers(18, { playerLevel: 26 });

  assert.ok(experiencedHunter.hp > newHunter.hp);
  assert.ok(experiencedHunter.atk > newHunter.atk);
  assert.ok(experiencedHunter.speed > newHunter.speed);
});

test('World Terror can retain its existing linear pressure curve', () => {
  const pressure = getEnemyPressureMultipliers(38, { terrorScaling: 'linear' });

  assert.equal(pressure.hp, 1.9);
  assert.equal(pressure.atk, 1.8);
  assert.equal(pressure.speed, 1.24);
});
