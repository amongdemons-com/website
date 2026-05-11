const express = require('express');
const db = require('./lib/db');

const router = express.Router();

router.get('/leaderboard', async (req, res) => {
  const [rows] = await db.query(
    `SELECT username, level, xp, souls
     FROM players
     ORDER BY level DESC, xp DESC, souls DESC
     LIMIT 50`
  );

  res.json({ players: rows });
});

module.exports = router;
