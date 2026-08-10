const test = require('node:test');
const assert = require('node:assert/strict');

const { serializeTeamMember } = require('../public/api/lib/hunter-profile');
const { applyPreBattleBuffs } = require('../public/api/lib/combat-buffs');

test('hunter team serialization preserves role-specific buffed attack output', () => {
  const serialized = serializeTeamMember({
    typeId: 4,
    species: 'AOE Demon',
    hp: 100,
    maxHp: 120,
    atk: 20,
    effectiveAtk: 31,
    speed: 8
  });

  assert.equal(serialized.atk, 20);
  assert.equal(serialized.effectiveAtk, 31);
});

test('hunter team serialization omits an invalid effective attack value', () => {
  const serialized = serializeTeamMember({ atk: 20, effectiveAtk: 'unknown' });

  assert.equal(Object.hasOwn(serialized, 'effectiveAtk'), false);
});

test('hunter cards preserve every role-specific skill-tree output preview', () => {
  const team = [
    { instanceId: 'aoe', typeId: 4, hp: 100, maxHp: 100, atk: 20, speed: 8 },
    { instanceId: 'poison', typeId: 3, hp: 100, maxHp: 100, atk: 20, speed: 8 },
    { instanceId: 'healing', typeId: 10, hp: 100, maxHp: 100, atk: 20, speed: 8 },
    { instanceId: 'thorns', typeId: 8, hp: 100, maxHp: 100, atk: 20, speed: 8 }
  ];
  const buffed = applyPreBattleBuffs(team, {
    activeBuffs: [{
      id: 'skill-previews',
      effects: [
        { type: 'aoe_damage_flat', value: 5 },
        { type: 'aoe_damage_mult', value: 1.5 },
        { type: 'poison_damage_flat', value: 3 },
        { type: 'poison_tick_damage_mult', value: 1.2 },
        { type: 'healing_flat', value: 4 },
        { type: 'healing_mult', value: 1.25 },
        { type: 'thorns_flat', value: 7 },
        { type: 'thorns_percent', value: 25 }
      ]
    }]
  }).map(serializeTeamMember);

  assert.deepEqual(
    Object.fromEntries(buffed.map((demon) => [demon.instanceId, demon.effectiveAtk])),
    { aoe: 38, poison: 31, healing: 30, thorns: 34 }
  );
});
