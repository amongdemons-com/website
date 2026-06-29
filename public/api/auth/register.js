const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { cleanPlayer, createSession, hashPassword } = require('../lib/auth');
const { saveDefaultBoundShrine } = require('../lib/world-shrines');

const router = express.Router();

router.post('/auth/register', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (username.length < 3 || password.length < 6) {
    return res.status(400).json({ error: 'Username must be at least 3 characters and password at least 6 characters.' });
  }

  const { salt, hash } = hashPassword(password);
  const playerId = crypto.randomUUID();
  const email = String(req.body.email || `${username}@amongdemons.local`).trim();

  try {
    await db.query(
      'INSERT INTO players (id, username, email, password_hash, password_salt, unlocks) VALUES (?, ?, ?, ?, ?, ?)',
      [playerId, username, email, hash, salt, JSON.stringify([])]
    );
    await saveDefaultBoundShrine(playerId);
    const token = await createSession(playerId);

    const [rows] = await db.query('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
    res.status(201).json({ token, player: cleanPlayer(rows[0]) });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    throw error;
  }
});

module.exports = router;
