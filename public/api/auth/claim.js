const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, hashPassword, requireAuth } = require('../lib/auth');
const { assertValidUsername } = require('../lib/usernames');

const router = express.Router();

// Save (claim) a guest hunter: keep the same player row - and therefore every
// demon, stat, quest, world position, soul, and XP - while swapping the
// temporary name for a chosen one and attaching real credentials. The session
// token is unchanged, so the player stays logged in. Existing register/login
// are untouched; this only ever upgrades an is_guest = 1 row in place.
router.post('/auth/claim', requireAuth, async (req, res) => {
  if (!req.player.isGuest) {
    return res.status(400).json({ error: 'This hunter is already saved.' });
  }

  const username = assertValidUsername(req.body.username);
  const password = String(req.body.password || '');

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }

  const email = String(req.body.email || `${username}@amongdemons.local`).trim();
  const { salt, hash } = hashPassword(password);

  try {
    // The is_guest = 1 predicate makes the claim idempotent-safe: a race that
    // already converted the row updates nothing and we report progress kept.
    const [result] = await db.query(
      `UPDATE players
       SET username = ?, email = ?, password_hash = ?, password_salt = ?, is_guest = 0
       WHERE id = ? AND is_guest = 1`,
      [username, email, hash, salt, req.player.id]
    );

    if (!result.affectedRows) {
      return res.status(409).json({ error: 'This hunter could not be saved. Refresh and try again.' });
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const takenField = /email/i.test(error.sqlMessage || error.message || '') ? 'email' : 'username';
      return res.status(409).json({
        error: takenField === 'email'
          ? 'That email is already linked to a hunter.'
          : 'Username is already taken.'
      });
    }

    throw error;
  }

  const [rows] = await db.query(
    `SELECT p.*, pd.image_url AS profile_demon_image_url
     FROM players p
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [req.player.id]
  );

  res.json({ token: req.token, player: cleanPlayer(rows[0]) });
});

module.exports = router;
