const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, requireAuth } = require('../lib/auth');

const router = express.Router();

router.patch('/account/profile', requireAuth, async (req, res) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const hasUsername = Object.prototype.hasOwnProperty.call(body, 'username');
  const hasProfileDemonId = Object.prototype.hasOwnProperty.call(body, 'profileDemonId');

  if (!hasUsername && !hasProfileDemonId) {
    return res.status(400).json({ error: 'Choose a profile setting to update.' });
  }

  const username = hasUsername ? String(body.username || '').trim() : '';
  if (hasUsername && (username.length < 3 || username.length > 64)) {
    return res.status(400).json({ error: 'Username must be between 3 and 64 characters.' });
  }

  let profileDemon = null;

  if (hasProfileDemonId) {
    const profileDemonId = Number(body.profileDemonId);

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

    profileDemon = demonRows[0];
  }

  if (hasUsername && username !== req.player.username) {
    try {
      await db.query('UPDATE players SET username = ? WHERE id = ?', [username, req.player.id]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Username is already taken.' });
      }

      throw error;
    }
  }

  if (hasProfileDemonId) {
    await db.query(
      'UPDATE players SET profile_demon_id = ? WHERE id = ?',
      [profileDemon.id, req.player.id]
    );
  }

  const [playerRows] = await db.query(
    `SELECT p.*, pd.image_url AS profile_demon_image_url
     FROM players p
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [req.player.id]
  );

  res.json({
    player: cleanPlayer(playerRows[0]),
    ...(profileDemon ? { profileDemon } : {})
  });
});

module.exports = router;
