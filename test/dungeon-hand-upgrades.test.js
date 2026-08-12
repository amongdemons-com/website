const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const handSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'dungeon', 'hand.js'),
  'utf8'
);

function loadFunction(name) {
  const start = handSource.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);

  const bodyStart = handSource.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < handSource.length; index += 1) {
    if (handSource[index] === '{') depth += 1;
    if (handSource[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) {
      return Function(`return (${handSource.slice(start, index + 1)});`)();
    }
  }

  throw new Error(`Could not parse ${name}`);
}

const isBetterDemon = loadFunction('isBetterDemon');

test('dungeon hand upgrade comparison ignores rarity', () => {
  const current = { typeId: 1, rarity: 'common', maxHp: 100, atk: 20, speed: 10 };

  assert.equal(isBetterDemon({ ...current, rarity: 'mythic' }, current), false);
  assert.equal(isBetterDemon({ ...current, rarity: 'mythic', maxHp: 99 }, current), false);
});

test('dungeon hand highlights only when at least two visible stats are strictly greater', () => {
  const current = { typeId: 1, maxHp: 100, atk: 20, effectiveAtk: 30, speed: 10 };

  assert.equal(isBetterDemon({ typeId: 1, maxHp: 101, atk: 21, effectiveAtk: 31, speed: 10 }, current), true);
  assert.equal(isBetterDemon({ typeId: 1, maxHp: 101, atk: 21, effectiveAtk: null, speed: 10 }, current), false);
  assert.equal(isBetterDemon({ typeId: 1, maxHp: 120, atk: 19, effectiveAtk: 29, speed: 11 }, current), true);
  assert.equal(isBetterDemon({ typeId: 1, maxHp: 99, atk: 21, effectiveAtk: 31, speed: 10 }, current), false);
  assert.equal(isBetterDemon({ typeId: 1, maxHp: 99, atk: 40, effectiveAtk: 29, speed: 9 }, current), false);
  assert.equal(isBetterDemon({ ...current }, current), false);
  assert.equal(isBetterDemon({ ...current, maxHp: 101 }, current), false);
});

test('dungeon hand ignores hidden speed for Thorns upgrade comparisons', () => {
  const current = { typeId: 8, maxHp: 100, atk: 20, effectiveAtk: 40, speed: 20 };
  const candidate = { typeId: 8, maxHp: 110, atk: 21, effectiveAtk: 41, speed: 1 };

  assert.equal(isBetterDemon(candidate, current), true);
});
