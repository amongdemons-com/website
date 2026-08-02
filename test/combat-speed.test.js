const test = require('node:test');
const assert = require('node:assert/strict');

const { simulateFight } = require('../public/api/lib/combat');

function createDemon(instanceId, stats = {}) {
  return {
    instanceId,
    typeId: 1,
    hp: stats.hp || 1000,
    maxHp: stats.hp || 1000,
    atk: stats.atk || 1,
    speed: stats.speed || 1,
    position: 'front'
  };
}

test('attack meter overflow carries into the next attack', () => {
  const fight = simulateFight(
    () => 0.5,
    [createDemon('player', { speed: 60 })],
    [createDemon('enemy')]
  );

  const attackTicks = fight.combatLog
    .filter((entry) => entry.attacker === 'player')
    .map((entry) => entry.tick);

  assert.deepEqual(attackTicks.slice(0, 3), [2, 4, 5]);
});
