const test = require('node:test');
const assert = require('node:assert/strict');

const { simulateFight } = require('../public/api/lib/combat');
const { simulateTryHunt } = require('../public/api/lib/world-combat');
const demonTypes = require('../public/api/data/demon-types.json');

function createDemon(instanceId, typeId, stats = {}) {
  return {
    instanceId,
    typeId,
    rarity: 'common',
    hp: stats.hp || 1_000,
    maxHp: stats.hp || 1_000,
    atk: stats.atk || 10,
    speed: stats.speed || 100,
    position: stats.position || 'front'
  };
}

function getChaoticDamage(combatLog, attacker = 'player-chaotic') {
  return combatLog
    .filter((entry) => entry.attacker === attacker && !entry.effect)
    .map((entry) => entry.dmg);
}

test('type 11 chaotic damage includes both 1 and its maximum attack value', () => {
  const fightAt = (roll) => simulateFight(
    () => roll,
    [createDemon('player-chaotic', 11, { atk: 10 })],
    [createDemon('enemy', 1, { hp: 100, speed: 1 })],
    { demonTypes }
  );

  assert.equal(getChaoticDamage(fightAt(0).combatLog)[0], 1);
  assert.equal(getChaoticDamage(fightAt(0.999999).combatLog)[0], 10);
});

test('new engagements can produce different type 11 hit sequences', async () => {
  const player = { id: 42 };
  const encounter = {
    id: 'same-enemy',
    x: 1,
    y: 1,
    team: [{ typeId: 1, rarity: 'common', position: 'front' }]
  };
  const context = {
    playerTeam: [createDemon('player-chaotic', 11, { atk: 10 })],
    playerBuffs: {},
    demonTypes
  };

  const first = await simulateTryHunt(player, encounter, { context, seed: 1 });
  const repeatedSeed = await simulateTryHunt(player, encounter, { context, seed: 1 });
  const newEngagement = await simulateTryHunt(player, encounter, { context, seed: 2 });

  assert.deepEqual(repeatedSeed.combatLog, first.combatLog);
  assert.notDeepEqual(
    getChaoticDamage(newEngagement.combatLog),
    getChaoticDamage(first.combatLog)
  );
});
