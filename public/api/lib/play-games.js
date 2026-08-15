const crypto = require('node:crypto');
const db = require('./db');
const achievementIds = require('../data/play-games-achievement-ids.json');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PLAYER_URL = 'https://games.googleapis.com/games/v1/players/me';
const GOOGLE_ACHIEVEMENT_BATCH_URL = 'https://games.googleapis.com/games/v1/achievements/updateMultiple';

function getConfig() {
  return {
    clientId: String(process.env.PLAY_GAMES_SERVER_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.PLAY_GAMES_SERVER_CLIENT_SECRET || '').trim()
  };
}

function isPlayGamesConfigured() {
  const config = getConfig();
  return Boolean(config.clientId && config.clientSecret);
}

function getPlayGamesAchievementId(localId) {
  const id = String(achievementIds[localId] || '').trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : null;
}

async function exchangeServerAuthCode(code) {
  const config = getConfig();
  if (!config.clientId || !config.clientSecret) {
    throw createPlayGamesError('Play Games sign-in is not configured.', 503);
  }
  if (!code || typeof code !== 'string' || code.length > 4096) {
    throw createPlayGamesError('A valid Play Games server auth code is required.', 400);
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'authorization_code'
    })
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.access_token) {
    throw createPlayGamesError(
      payload.error_description || 'Google rejected the Play Games authorization code.',
      401
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || null,
    expiresIn: Math.max(0, Number(payload.expires_in) || 0)
  };
}

async function getAuthenticatedPlayer(accessToken) {
  const response = await fetch(GOOGLE_PLAYER_URL, {
    headers: { authorization: `Bearer ${accessToken}` }
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.playerId) {
    throw createPlayGamesError('Google could not verify the Play Games player.', 401);
  }
  return {
    id: String(payload.playerId),
    displayName: String(payload.displayName || '').trim()
  };
}

async function storeRefreshToken(playerId, refreshToken, queryable = db) {
  if (!refreshToken) return false;
  const encrypted = encryptRefreshToken(refreshToken);
  if (!encrypted) return false;

  await queryable.query(
    `INSERT INTO player_play_games_credentials (player_id, refresh_token_encrypted)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       refresh_token_encrypted = VALUES(refresh_token_encrypted),
       updated_at = CURRENT_TIMESTAMP`,
    [playerId, encrypted]
  );
  return true;
}

async function getPlayerAccessToken(playerId, queryable = db) {
  const [rows] = await queryable.query(
    'SELECT refresh_token_encrypted AS refreshToken FROM player_play_games_credentials WHERE player_id = ? LIMIT 1',
    [playerId]
  );
  const refreshToken = decryptRefreshToken(rows[0]?.refreshToken);
  if (!refreshToken) return null;

  const config = getConfig();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: 'refresh_token'
    })
  });
  const payload = await readJson(response);
  if (!response.ok || !payload.access_token) return null;
  return payload.access_token;
}

async function unlockAchievements(accessToken, ids) {
  const uniqueIds = [...new Set((ids || []).filter(Boolean))];
  if (!uniqueIds.length) return;

  const response = await fetch(GOOGLE_ACHIEVEMENT_BATCH_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      kind: 'games#achievementUpdateMultipleRequest',
      updates: uniqueIds.map((achievementId) => ({
        kind: 'games#achievementUpdateRequest',
        achievementId,
        updateType: 'UNLOCK'
      }))
    })
  });
  if (!response.ok) {
    throw createPlayGamesError('Google Play Games achievement sync failed.', 502);
  }
}

function encryptRefreshToken(value) {
  const key = getEncryptionKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv, tag, encrypted].map((part) => (
    Buffer.isBuffer(part) ? part.toString('base64url') : part
  )).join(':');
}

function decryptRefreshToken(value) {
  const key = getEncryptionKey();
  if (!key || !value) return null;
  try {
    const [version, iv, tag, encrypted] = String(value).split(':');
    if (version !== 'v1' || !iv || !tag || !encrypted) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch (error) {
    return null;
  }
}

function getEncryptionKey() {
  const configured = String(process.env.PLAY_GAMES_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!configured) return null;
  const key = /^[0-9a-f]{64}$/i.test(configured)
    ? Buffer.from(configured, 'hex')
    : Buffer.from(configured, 'base64');
  return key.length === 32 ? key : null;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return {};
  }
}

function createPlayGamesError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  exchangeServerAuthCode,
  getAuthenticatedPlayer,
  getPlayGamesAchievementId,
  getPlayerAccessToken,
  isPlayGamesConfigured,
  storeRefreshToken,
  unlockAchievements,
  _test: { decryptRefreshToken, encryptRefreshToken, getEncryptionKey }
};
