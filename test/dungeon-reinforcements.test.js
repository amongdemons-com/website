const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COLLECTION_REINFORCEMENT_FLOORS,
  canUseCollectionReinforcement,
  getUsedCollectionReinforcementFloors,
  markCollectionReinforcementUsed
} = require('../public/api/lib/dungeon-rules');

test('collection reinforcements are offered after floors 10, 30, and 50', () => {
  assert.deepEqual(COLLECTION_REINFORCEMENT_FLOORS, [10, 30, 50]);

  const state = {};
  assert.equal(canUseCollectionReinforcement(state, 10), true);
  assert.equal(canUseCollectionReinforcement(state, 30), true);
  assert.equal(canUseCollectionReinforcement(state, 50), true);
  assert.equal(canUseCollectionReinforcement(state, 40), false);
});

test('each collection reinforcement milestone can be used once', () => {
  const state = {};

  assert.equal(markCollectionReinforcementUsed(state, 10), true);
  assert.equal(canUseCollectionReinforcement(state, 10), false);
  assert.equal(canUseCollectionReinforcement(state, 30), true);

  assert.equal(markCollectionReinforcementUsed(state, 30), true);
  assert.equal(canUseCollectionReinforcement(state, 30), false);
  assert.equal(canUseCollectionReinforcement(state, 50), true);
  assert.deepEqual([...getUsedCollectionReinforcementFloors(state)], [10, 30]);
});

test('legacy used flag consumes only the original floor 10 reinforcement', () => {
  const state = { collectionReinforcementUsed: true };

  assert.equal(canUseCollectionReinforcement(state, 10), false);
  assert.equal(canUseCollectionReinforcement(state, 30), true);
  assert.equal(canUseCollectionReinforcement(state, 50), true);
});
