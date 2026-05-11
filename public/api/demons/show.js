const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

router.get('/demons/:id', requireAuth, async (req, res) => {
  const [rows] = await db.query(
    `SELECT id, source_demon_id AS sourceDemonId, type_id AS typeId, species, rarity,
            image_url AS imageUrl, hp, atk, speed, created_at AS createdAt
     FROM player_demons
     WHERE id = ? AND player_id = ?
     LIMIT 1`,
    [req.params.id, req.player.id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: 'Demon not found.' });
  }

  res.json({ demon: rows[0] });
});

module.exports = router;
