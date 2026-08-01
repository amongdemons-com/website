const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generateRankedPopulation,
  parseOptions,
  stableUuid
} = require('../scripts/generate-ranked-population');

test('Ranked population options are dry-run by default and require explicit apply', () => {
  const defaults = parseOptions([]);
  assert.equal(defaults.apply, false);

  const applied = parseOptions(['--apply', '--players', '3', '--max-floor', '21']);
  assert.equal(applied.apply, true);
  assert.equal(applied.players, 3);
  assert.equal(applied.maxFloor, 21);
});

test('Ranked population identifiers are stable UUIDs', () => {
  assert.equal(stableUuid('same-input'), stableUuid('same-input'));
  assert.match(stableUuid('same-input'), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
});

test('Ranked population creates optimized floor snapshots without Endless RP', async () => {
  const population = await generateRankedPopulation({
    players: 1,
    maxFloor: 21,
    candidateLimit: 3,
    lineupVariants: 2,
    combatSeeds: 1,
    seed: 424242,
    usernamePrefix: 'TestRankedBot'
  });
  const [bot] = population.bots;

  assert.equal(bot.snapshots.length, 21);
  assert.equal(bot.rating.highestFloor, 21);
  assert.equal(bot.rating.rating, 1105);
  assert.equal(bot.run.ratingDelta, 105);
  assert.equal(bot.run.status, 'ended');
  assert.equal(bot.run.state.highestClearedFloor, 21);
  assert.ok(bot.snapshots.every((snapshot) => snapshot.snapshot.team.length >= 1));
  assert.ok(bot.floorResults.every((result) => result.winRate >= 0 && result.winRate <= 1));
});
