const crypto = require('crypto');
const db = require('./db');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function createToken() {
  return crypto.randomBytes(36).toString('base64url');
}

async function createSession(playerId) {
  const token = createToken();
  await db.query('INSERT INTO player_sessions (token, player_id) VALUES (?, ?)', [token, playerId]);
  return token;
}

function cleanPlayer(row) {
  return {
    id: row.id,
    username: row.username,
    level: row.level,
    xp: row.xp,
    souls: row.souls,
    highestFloor: row.highest_floor || 0,
    profileDemonId: row.profile_demon_id ? Number(row.profile_demon_id) : null,
    unlocks: JSON.parse(row.unlocks || '[]')
  };
}

async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-player-token');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const [rows] = await db.query(
    `SELECT p.*
     FROM player_sessions s
     INNER JOIN players p ON p.id = s.player_id
     WHERE s.token = ?
       AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [token]
  );

  if (!rows.length) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  req.player = cleanPlayer(rows[0]);
  req.token = token;
  next();
}

module.exports = {
  cleanPlayer,
  createSession,
  createToken,
  hashPassword,
  requireAuth,
  verifyPassword
};
