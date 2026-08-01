const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getMerchantBribeCost,
  getMerchantLevelLuckRerollChance,
  getMerchantStockId,
  rollMerchantRarity
} = require('../public/api/lib/world-merchant');

test('merchant bribe cost grows by five Souls per player level', () => {
  assert.equal(getMerchantBribeCost(1), 50);
  assert.equal(getMerchantBribeCost(2), 55);
  assert.equal(getMerchantBribeCost(10), 95);
  assert.equal(getMerchantBribeCost(51), 300);
});

test('merchant level luck grows steadily and caps at one bonus roll', () => {
  assert.equal(getMerchantLevelLuckRerollChance(1), 0);
  assert.equal(getMerchantLevelLuckRerollChance(26), 0.5);
  assert.equal(getMerchantLevelLuckRerollChance(51), 1);
  assert.equal(getMerchantLevelLuckRerollChance(500), 1);
});

test('merchant level luck keeps the better rarity roll', () => {
  const baseRng = () => 0.1;
  const levelRolls = [0, 0.999999];
  const levelRng = () => levelRolls.shift();

  assert.equal(rollMerchantRarity(baseRng), 'common');
  assert.equal(rollMerchantRarity(baseRng, 0, baseRng, 1, levelRng), 'mythic');
});

test('merchant stock identity changes with player level', () => {
  assert.equal(getMerchantStockId('spawn', 2, 7), 'spawn:2:level:7');
  assert.notEqual(getMerchantStockId('spawn', 2, 7), getMerchantStockId('spawn', 2, 8));
});
