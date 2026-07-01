const express = require('express');
const db = require('./lib/db');

const router = express.Router();

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

  const [rows] = await db.query(
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
  );

  const [[stats]] = await db.query(
    `SELECT COUNT(*) AS players,
            COALESCE(SUM(souls), 0) AS souls,
            COALESCE(SUM(pvp_wins), 0) AS pvpBattles
     FROM players`
  );

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

module.exports = router;
