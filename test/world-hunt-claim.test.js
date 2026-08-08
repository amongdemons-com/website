const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const worldRouter = require('../public/api/world');

const { attemptHuntRestart } = worldRouter._test;

test('an ineligible automatic hunt restart does not fail reward settlement', async () => {
  const restart = await attemptHuntRestart(async () => {
    const error = new Error('Win a fight before starting passive hunting.');
    error.status = 409;
    throw error;
  });

  assert.equal(restart.snapshot, null);
  assert.equal(
    restart.failureReason,
    'Your current team and active buffs could not win another fight.'
  );
});

test('unexpected automatic hunt restart errors still reach the API error handler', async () => {
  const error = new Error('Database unavailable.');

  await assert.rejects(
    attemptHuntRestart(async () => {
      throw error;
    }),
    error
  );
});

test('the world client reports claimed rewards when an automatic restart is unavailable', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'world-ui.js'),
    'utf8'
  );

  assert.match(source, /payload\.restartFailureReason/);
  assert.match(source, /Hunting stopped:/);
  assert.match(source, /payload\.restartFailureReason \? 'warning' : 'success'/);
});

test('claiming hunt XP forces confirmed level-up celebrations to play', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'world-ui.js'),
    'utf8'
  );

  assert.match(source, /forceLevelUpAnimation:\s*leveledUp/);
  assert.match(source, /if \(!leveledUp\) playQuestCompleteSound\(\)/);
});
