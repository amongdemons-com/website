const test = require('node:test');
const assert = require('node:assert/strict');

const {
  applyDamageModifiers,
  applyPoisonModifiers,
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

test('every rarity-targeted Pact boosts each damage archetype for its rarities', () => {
  const cases = [
    { id: 'many_below', rarity: 'common', multiplier: 1.3 },
    { id: 'many_below', rarity: 'uncommon', multiplier: 1.3 },
    { id: 'crimson_standard', rarity: 'rare', multiplier: 1.35 },
    { id: 'fallen_nobility', rarity: 'epic', multiplier: 1.2 },
    { id: 'fallen_nobility', rarity: 'legendary', multiplier: 1.2 },
    { id: 'mythic_ascendancy', rarity: 'mythic', multiplier: 1.25 }
  ];
  const expectedDamageEffectTypes = [
    'aoe_damage_mult',
    'direct_damage_mult',
    'poison_tick_damage_mult',
    'retaliation_damage_mult'
  ];

  cases.forEach(({ id, rarity, multiplier }) => {
    const pact = getCombatBuffById(id);
    const damageEffectTypes = pact.effects
      .filter((effect) => expectedDamageEffectTypes.includes(effect.type))
      .map((effect) => effect.type)
      .sort();
    const playerBuffs = { active: [id] };

    assert.deepEqual(damageEffectTypes, expectedDamageEffectTypes, `${id} should cover every damage archetype`);
    assert.equal(applyDamageModifiers({
      damage: 100,
      damageKind: 'direct',
      isAoe: false,
      attacker: { typeId: 1, rarity },
      target: { hp: 100, maxHp: 100 },
      attackerSide: 'player',
      playerBuffs
    }), Math.round(100 * multiplier), `${id} should boost single-target damage`);
    assert.equal(applyDamageModifiers({
      damage: 100,
      damageKind: 'direct',
      isAoe: true,
      attacker: { typeId: 4, rarity },
      target: { hp: 100, maxHp: 100 },
      attackerSide: 'player',
      playerBuffs
    }), Math.round(100 * multiplier), `${id} should boost AOE damage`);
    assert.equal(applyPoisonModifiers({
      damage: 100,
      durationTicks: 10,
      attacker: { typeId: 3, rarity },
      attackerSide: 'player',
      playerBuffs
    }).damage, Math.round(100 * multiplier), `${id} should boost poison damage`);
    assert.equal(applyDamageModifiers({
      damage: 100,
      damageKind: 'retaliation',
      attacker: { typeId: 8, rarity },
      target: { hp: 100, maxHp: 100 },
      attackerSide: 'player',
      playerBuffs
    }), Math.round(100 * multiplier), `${id} should boost retaliation damage`);
  });
});

test('rarity-targeted damage bonuses do not affect other rarities', () => {
  const playerBuffs = { active: ['mythic_ascendancy'] };

  assert.equal(applyDamageModifiers({
    damage: 100,
    damageKind: 'direct',
    isAoe: true,
    attacker: { typeId: 4, rarity: 'legendary' },
    target: { hp: 100, maxHp: 100 },
    attackerSide: 'player',
    playerBuffs
  }), 100);
  assert.equal(applyPoisonModifiers({
    damage: 100,
    durationTicks: 10,
    attacker: { typeId: 3, rarity: 'legendary' },
    attackerSide: 'player',
    playerBuffs
  }).damage, 100);
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
