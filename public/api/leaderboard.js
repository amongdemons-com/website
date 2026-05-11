const express = require('express');
const db = require('./lib/db');

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
  const allowedSorts = new Set(['level', 'xp', 'souls']);
  const sort = allowedSorts.has(req.query.sort) ? req.query.sort : 'level';
  const orderBy = {
    level: 'level DESC, xp DESC, souls DESC',
    xp: 'xp DESC, level DESC, souls DESC',
    souls: 'souls DESC, level DESC, xp DESC'
  }[sort];

  const [rows] = await db.query(
    `SELECT username, level, xp, souls
     FROM players
     ORDER BY ${orderBy}
     LIMIT 100`
  );

  res.json({ players: rows, sort, limit: 100 });
});

module.exports = router;
