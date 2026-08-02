const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getActiveWorldBossRewardBuffs,
  loadWorldBosses
} = require('../public/api/lib/world-bosses');

test('world boss reward expiry reads are timezone-safe', async () => {
  const boss = loadWorldBosses().find((candidate) => candidate.rewardBuff);
  const expiresAtSeconds = Date.parse('2026-08-03T12:00:00.000Z') / 1000;
  let queryText = '';
  const buffs = await getActiveWorldBossRewardBuffs('hunter-one', {
    query: async (sql) => {
      queryText = sql;
      return [[{ bossId: boss.id, expiresAtSeconds }]];
    }
  });

  assert.match(queryText, /UNIX_TIMESTAMP\(expires_at\) AS expiresAtSeconds/);
  assert.equal(buffs[0].expiresAt, '2026-08-03T12:00:00.000Z');
});
