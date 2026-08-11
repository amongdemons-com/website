const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const db = require('../public/api/lib/db');
const worldRouter = require('../public/api/world');

const ROOT = path.join(__dirname, '..');

test('world duels apply the shared 32-K Elo result to the challenger', () => {
  const win = worldRouter._test.getWorldDuelRankedResult('player', 1000, 1000);
  const loss = worldRouter._test.getWorldDuelRankedResult('enemy', 1000, 1000);

  assert.deepEqual(win, {
    winner: 'player',
    delta: 16,
    previousRating: 1000,
    rating: 1016,
    opponentRating: 1000,
    ratingGap: 0,
    rewardBlocked: false,
    previousDivision: 'Bronze II',
    division: 'Bronze II'
  });
  assert.equal(loss.delta, -16);
  assert.equal(loss.rating, 984);
  assert.ok(worldRouter._test.getWorldDuelRankedResult('player', 1000, 1400).delta > 16);
  assert.ok(worldRouter._test.getWorldDuelRankedResult('enemy', 1000, 1400).delta > -16);
});

test('world duel wins award no RP against opponents 200 or more RP lower', () => {
  const justInsideCutoff = worldRouter._test.getWorldDuelRankedResult('player', 1199, 1000);
  const blocked = worldRouter._test.getWorldDuelRankedResult('player', 1200, 1000);
  const upsetLoss = worldRouter._test.getWorldDuelRankedResult('enemy', 1200, 1000);

  assert.equal(worldRouter._test.WORLD_DUEL_NO_REWARD_RATING_GAP, 200);
  assert.ok(justInsideCutoff.delta > 0);
  assert.equal(justInsideCutoff.rewardBlocked, false);
  assert.equal(blocked.delta, 0);
  assert.equal(blocked.rating, 1200);
  assert.equal(blocked.rewardBlocked, true);
  assert.ok(upsetLoss.delta < 0);
  assert.equal(upsetLoss.rewardBlocked, false);
});

test('world duels reuse the Dungeon ranked result modal', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'app', 'world.html'), 'utf8');
  const worldUi = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'world-ui.js'), 'utf8');
  const rankedUi = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'ranked.js'), 'utf8');

  assert.match(html, /id="dungeonRankedResultModal"/);
  assert.match(html, /rank-divisions\.css/);
  assert.match(worldUi, /dungeonRanked\.showRankedResultModal/);
  assert.match(rankedUi, /function showRankedResultModal/);
});

test('world duel Ranked results do not execute map-tile altar handling', () => {
  const worldUi = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'world-ui.js'), 'utf8');
  const tileHandler = worldUi.slice(
    worldUi.indexOf('async function handleMapTileClick(tile)'),
    worldUi.indexOf('async function travelSelectedPath()')
  );
  const rankedResultFlow = worldUi.slice(
    worldUi.indexOf('async function showWorldDuelRankedResult(result, targetPlayer = {})'),
    worldUi.indexOf('async function challengeBoss(')
  );

  assert.match(tileHandler, /if \(anomalyAltar && positionsEqual\(target, state\.position\)\)/);
  assert.match(tileHandler, /openWorldAnomaly\(\)/);
  assert.doesNotMatch(rankedResultFlow, /anomalyAltar/);
  assert.doesNotMatch(rankedResultFlow, /positionsEqual\(target/);
  assert.match(rankedResultFlow, /dungeonRanked\.showRankedResultModal/);
});

test('world duel records and challenger RP commit in one transaction', async () => {
  const calls = [];
  let committed = false;
  let rolledBack = false;
  let released = false;
  const connection = {
    async beginTransaction() {
      calls.push({ sql: 'BEGIN', params: [] });
    },
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (/SELECT \*\s+FROM ranked_ratings/.test(sql)) {
        return [[{
          player_id: params[0],
          season_id: params[1],
          rating: params[0] === 'attacker' ? 1000 : 1400,
          highest_floor: 0,
          victories: 0,
          runs_played: 0
        }]];
      }
      if (/SELECT p\.\*, pd\.image_url/.test(sql)) {
        return [[
          { id: 'attacker', username: 'Attacker', pvp_wins: 1, pvp_losses: 0, level: 1 },
          { id: 'defender', username: 'Defender', pvp_wins: 0, pvp_losses: 1, level: 1 }
        ]];
      }
      return [{ affectedRows: 1 }];
    },
    async commit() {
      committed = true;
    },
    async rollback() {
      rolledBack = true;
    },
    release() {
      released = true;
    }
  };
  const originalGetConnection = db.getConnection;
  db.getConnection = async () => connection;

  try {
    const result = await worldRouter._test.recordPvpChallengeResult('attacker', 'defender', 'player');
    const ratingUpdate = calls.find(({ sql }) => /UPDATE ranked_ratings/.test(sql));

    assert.equal(result.rankedResult.delta, 29);
    assert.equal(result.rankedResult.rating, 1029);
    assert.deepEqual(ratingUpdate.params.slice(1), ['attacker', result.rankedResult.seasonId]);
    assert.equal(committed, true);
    assert.equal(rolledBack, false);
    assert.equal(released, true);
  } finally {
    db.getConnection = originalGetConnection;
  }
});
