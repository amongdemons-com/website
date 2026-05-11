const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

router.get('/demons', requireAuth, async (req, res) => {
  const [rows] = await db.query(
    `SELECT id, source_demon_id AS sourceDemonId, type_id AS typeId, species, rarity,
            image_url AS imageUrl, hp, atk, speed, created_at AS createdAt
     FROM player_demons
     WHERE player_id = ?
     ORDER BY created_at DESC, id DESC`,
    [req.player.id]
  );

  res.json({ demons: rows });
});

module.exports = router;
