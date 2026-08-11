const crypto = require('crypto');
const db = require('./db');
const { isDeletionDue, purgePlayerAccount } = require('./account-deletion');
const { normalizeAccountLevel } = require('./progression');

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

async function createSession(playerId, options = {}) {
  const token = createToken();
  const authProvider = normalizeSessionAuthProvider(options.authProvider);
  await db.query(
    'INSERT INTO player_sessions (token, player_id, auth_provider) VALUES (?, ?, ?)',
    [token, playerId, authProvider]
  );
  return token;
}

function normalizeSessionAuthProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return ['steam', 'google', 'discord'].includes(provider) ? provider : 'web';
}

function cleanPlayer(row) {
  return {
    id: row.id,
    username: row.username,
    level: normalizeAccountLevel(row.level),
    xp: row.xp,
    souls: row.souls,
    highestFloor: row.highest_floor || 0,
    pvpWins: Math.max(0, Number(row.pvp_wins) || 0),
    pvpLosses: Math.max(0, Number(row.pvp_losses) || 0),
    profileDemonId: row.profile_demon_id ? Number(row.profile_demon_id) : null,
    profileDemonImageUrl: row.profile_demon_image_url || null,
    isGuest: Boolean(Number(row.is_guest) || 0),
    hasPassword: Boolean(Number(row.password_login_enabled) || 0),
    deletionRequestedAt: row.deletion_requested_at || null,
    deletionScheduledFor: row.deletion_scheduled_for || null,
    unlocks: JSON.parse(row.unlocks || '[]')
  };
}

// Guest accounts are real player rows flagged with `is_guest = 1`. They may play
// the core game but not touch abuse-sensitive features until they save (claim)
// their hunter. This guard is the security boundary; the UI hint is cosmetic.
function blockGuests(req, res, next) {
  if (req.player && req.player.isGuest) {
    return res.status(403).json({
      error: 'Save your hunter to unlock this. Guest hunters cannot use this feature yet.',
      guestBlocked: true
    });
  }

  next();
}

async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-player-token');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const [rows] = await db.query(
    `SELECT p.*, pd.image_url AS profile_demon_image_url,
            s.auth_provider AS session_auth_provider
     FROM player_sessions s
     INNER JOIN players p ON p.id = s.player_id
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     WHERE s.token = ?
       AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [token]
  );

  if (!rows.length) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  if (isDeletionDue(rows[0].deletion_scheduled_for)) {
    await purgePlayerAccount(rows[0].id);
    return res.status(410).json({ error: 'This account has been deleted.' });
  }

  req.player = cleanPlayer(rows[0]);
  req.token = token;
  req.authProvider = normalizeSessionAuthProvider(rows[0].session_auth_provider);
  next();
}

module.exports = {
  blockGuests,
  cleanPlayer,
  createSession,
  createToken,
  hashPassword,
  normalizeSessionAuthProvider,
  requireAuth,
  verifyPassword
};
