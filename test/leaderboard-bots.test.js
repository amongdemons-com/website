const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../public/api/lib/db');
const leaderboard = require('../public/api/leaderboard');

test('leaderboards and public totals exclude RankedBot players', async () => {
  const originalQuery = db.query;
  const queries = [];
  db.query = async (sql, params = []) => {
    queries.push({ sql, params });
    if (sql.includes('INSERT INTO ranked_seasons')) return [{ affectedRows: 1 }];
    if (sql.includes('COUNT(*) AS players')) {
      return [[{ players: 0, souls: 0, pvpBattles: 0 }]];
    }
    if (sql.includes('FROM players p')) return [[]];
    throw new Error(`Unexpected leaderboard query: ${sql}`);
  };

  try {
    const layer = leaderboard.stack.find((candidate) => candidate.route?.path === '/leaderboard');
    const handler = layer.route.stack[0].handle;
    await new Promise((resolve, reject) => {
      const response = {
        json(payload) {
          try {
            assert.deepEqual(payload.players, []);
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      };
      Promise.resolve(handler({ query: { sort: 'ranked' } }, response)).catch(reject);
    });
  } finally {
    db.query = originalQuery;
  }

  const playerQuery = queries.find(({ sql }) => sql.includes('COALESCE(rr.rating'));
  const totalsQuery = queries.find(({ sql }) => sql.includes('COUNT(*) AS players'));
  assert.match(playerQuery.sql, /WHERE p\.id NOT LIKE \?/);
  assert.equal(playerQuery.params.at(-1), leaderboard._test.RANKED_BOT_ID_PATTERN);
  assert.match(totalsQuery.sql, /WHERE p\.id NOT LIKE \?/);
  assert.deepEqual(totalsQuery.params, [leaderboard._test.RANKED_BOT_ID_PATTERN]);
});
