const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { cleanPlayer, createSession, hashPassword, verifyPassword } = require('../lib/auth');
const { saveDefaultBoundShrine } = require('../lib/world-shrines');

const router = express.Router();

router.post('/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const [rows] = await db.query('SELECT * FROM players WHERE username = ? LIMIT 1', [username]);
  let player = rows[0];

  if (!player) {
    const { salt, hash } = hashPassword(password);
    const playerId = crypto.randomUUID();
    const email = String(req.body.email || `${username}@amongdemons.local`).trim();
    await db.query(
      'INSERT INTO players (id, username, email, password_hash, password_salt, unlocks) VALUES (?, ?, ?, ?, ?, ?)',
      [playerId, username, email, hash, salt, JSON.stringify([])]
    );
    await saveDefaultBoundShrine(playerId);
    const [createdRows] = await db.query('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
    player = createdRows[0];
  } else if (!player.password_salt) {
    return res.status(401).json({ error: 'This account needs a password reset before API login.' });
  } else if (!verifyPassword(password, player.password_salt, player.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = await createSession(player.id);
  res.json({ token, player: cleanPlayer(player) });
});

module.exports = router;
