const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, requireAuth } = require('../lib/auth');

const router = express.Router();

router.patch('/account/profile', requireAuth, async (req, res) => {
  const profileDemonId = Number(req.body.profileDemonId);

  if (!Number.isInteger(profileDemonId) || profileDemonId <= 0) {
    return res.status(400).json({ error: 'Choose a valid collection demon.' });
  }

  const [demonRows] = await db.query(
    `SELECT id, source_demon_id AS sourceDemonId, type_id AS typeId, species, rarity,
            image_url AS imageUrl, hp, atk, speed, created_at AS createdAt
     FROM player_demons
     WHERE id = ? AND player_id = ?
     LIMIT 1`,
    [profileDemonId, req.player.id]
  );

  if (!demonRows.length) {
    return res.status(404).json({ error: 'That demon is not in your collection.' });
  }

  await db.query(
    'UPDATE players SET profile_demon_id = ? WHERE id = ?',
    [profileDemonId, req.player.id]
  );

  const [playerRows] = await db.query('SELECT * FROM players WHERE id = ? LIMIT 1', [req.player.id]);

  res.json({
    player: cleanPlayer(playerRows[0]),
    profileDemon: demonRows[0]
  });
});

module.exports = router;
