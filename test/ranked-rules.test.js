const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getRunEndRatingDelta,
  resolveDefeat
} = require('../public/api/lib/ranked-rules');
const { empowerEndlessGhostTeam } = require('../public/api/lib/ranked-runs')._test;

test('losing all three Ranked lives early always costs rating', () => {
  let lives = 3;
  for (let loss = 0; loss < 3; loss += 1) {
    const defeat = resolveDefeat(lives);
    lives = defeat.lives;
    assert.equal(defeat.ended, loss === 2);
  }

  assert.equal(lives, 0);
  assert.equal(getRunEndRatingDelta(1, 0), -20);
  assert.equal(getRunEndRatingDelta(9, 100), -20);
  assert.equal(getRunEndRatingDelta(10, 0), -5);
  assert.equal(getRunEndRatingDelta(11, 3), -2);
  assert.equal(getRunEndRatingDelta(20, 30), 30);
});

test('endless ghosts become substantially stronger after floor 20', () => {
  const ghost = [{ instanceId: 'ghost-1', maxHp: 100, hp: 100, atk: 20, speed: 10 }];

  assert.equal(empowerEndlessGhostTeam(ghost, 20), ghost);
  assert.deepEqual(
    empowerEndlessGhostTeam(ghost, 21).map(({ maxHp, hp, atk, speed }) => ({ maxHp, hp, atk, speed })),
    [{ maxHp: 125, hp: 125, atk: 24, speed: 11 }]
  );
  assert.deepEqual(
    empowerEndlessGhostTeam(ghost, 25).map(({ maxHp, hp, atk, speed }) => ({ maxHp, hp, atk, speed })),
    [{ maxHp: 225, hp: 225, atk: 38, speed: 13 }]
  );
});
