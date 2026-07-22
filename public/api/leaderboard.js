const express = require('express');
const db = require('./lib/db');

const router = express.Router();
const STATS_CACHE_MS = 15000;
let statsCache = null;
let statsPromise = null;

router.get('/leaderboard', async (req, res) => {
  const allowedSorts = new Set(['floor', 'level', 'xp', 'souls', 'pvp']);
  const sort = allowedSorts.has(req.query.sort) ? req.query.sort : 'floor';
  const orderBy = {
    floor: 'highest_floor DESC, level DESC, xp DESC, souls DESC',
    level: 'level DESC, xp DESC, souls DESC',
    xp: 'xp DESC, level DESC, souls DESC',
    souls: 'souls DESC, level DESC, xp DESC',
    pvp: 'pvp_wins DESC, pvp_losses ASC, level DESC, xp DESC, highest_floor DESC, souls DESC'
  }[sort];

  const [rowsResult, stats] = await Promise.all([db.query(
    `SELECT username,
            level,
            xp,
            souls,
            highest_floor AS highestFloor,
            pvp_wins AS pvpWins,
            pvp_losses AS pvpLosses
     FROM players
     ORDER BY ${orderBy}
     LIMIT 100`
  ), getLeaderboardStats()]);
  const rows = rowsResult[0];

  res.json({
    players: rows,
    sort,
    limit: 100,
    stats: {
      players: Math.max(0, Number(stats?.players) || 0),
      souls: Math.max(0, Number(stats?.souls) || 0),
      pvpBattles: Math.max(0, Number(stats?.pvpBattles) || 0)
    }
  });
});

async function getLeaderboardStats() {
  if (statsCache && Date.now() - statsCache.cachedAt < STATS_CACHE_MS) {
    return statsCache.value;
  }
  if (!statsPromise) {
    statsPromise = db.query(
      `SELECT COUNT(*) AS players,
              COALESCE(SUM(souls), 0) AS souls,
              COALESCE(SUM(pvp_wins), 0) AS pvpBattles
       FROM players`
    ).then(([rows]) => {
      const value = rows[0] || {};
      statsCache = { cachedAt: Date.now(), value };
      return value;
    }).finally(() => {
      statsPromise = null;
    });
  }
  return statsPromise;
}

module.exports = router;
