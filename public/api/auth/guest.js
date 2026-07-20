const express = require('express');
const crypto = require('crypto');
const db = require('../lib/db');
const { cleanPlayer, createSession, hashPassword } = require('../lib/auth');
const { saveDefaultBoundShrine } = require('../lib/world-shrines');
const { generateGuestUsername } = require('../lib/guest');
const { grantStarterDemons } = require('../lib/starter-demon');

const router = express.Router();
const MAX_USERNAME_ATTEMPTS = 12;

// Create a playable guest hunter with no email/username/password prompt. The row
// is a normal player flagged `is_guest = 1`, so every existing gameplay endpoint
// works unchanged and the account can later be claimed (see auth/claim.js).
router.post('/auth/guest', async (req, res) => {
  const playerId = crypto.randomUUID();
  // A random password keeps the NOT NULL credential columns valid; it is never
  // shown to anyone and is overwritten when the hunter is saved.
  const { salt, hash } = hashPassword(crypto.randomBytes(24).toString('hex'));

  let lastError = null;

  for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt += 1) {
    const username = generateGuestUsername(attempt);

    try {
      await db.query(
        'INSERT INTO players (id, username, email, password_hash, password_salt, unlocks, is_guest) VALUES (?, ?, NULL, ?, ?, ?, 1)',
        [playerId, username, hash, salt, JSON.stringify([])]
      );
      await saveDefaultBoundShrine(playerId);
      await grantStarterDemonsSafely(playerId);
      const token = await createSession(playerId);

      const [rows] = await db.query('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
      return res.status(201).json({ token, player: cleanPlayer(rows[0]) });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  console.error('Failed to allocate a guest username after retries', lastError);
  return res.status(503).json({ error: 'Could not open a guest hunter. Try again in a moment.' });
});

// Missing starter demons must never fail account creation — the player can
// still recruit demons in the dungeon.
async function grantStarterDemonsSafely(playerId) {
  try {
    await grantStarterDemons(playerId);
  } catch (error) {
    console.error('Failed to grant starter demons to guest', playerId, error);
  }
}

module.exports = router;
