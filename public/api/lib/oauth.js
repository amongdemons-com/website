const crypto = require('crypto');
const db = require('./db');
const { hashPassword } = require('./auth');
const { saveDefaultBoundShrine } = require('./world-shrines');
const {
  USERNAME_MAX_LENGTH,
  createUsernameCandidate
} = require('./usernames');

const PROVIDERS = {
  google: {
    id: 'google',
    label: 'Google',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://openidconnect.googleapis.com/v1/userinfo',
    scopes: ['openid', 'email', 'profile']
  },
  discord: {
    id: 'discord',
    label: 'Discord',
    authUrl: 'https://discord.com/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email']
  }
};

function getProviderStatuses() {
  return Object.values(PROVIDERS).map((provider) => ({
    id: provider.id,
    label: provider.label,
    enabled: isProviderConfigured(provider.id)
  }));
}

function isSupportedProvider(provider) {
  return Boolean(PROVIDERS[provider]);
}

function isProviderConfigured(provider) {
  const config = getProviderConfig(provider);
  return Boolean(config && config.enabled);
}

function buildAuthorizationUrl(provider, options) {
  const definition = getProviderDefinition(provider);
  const config = requireProviderConfig(provider);
  const url = new URL(definition.authUrl);

  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', definition.scopes.join(' '));
  url.searchParams.set('state', options.state);

  if (provider === 'google') {
    url.searchParams.set('prompt', 'select_account');
  }

  return url.toString();
}

async function fetchOAuthProfile(provider, options) {
  if (provider === 'google') return fetchGoogleProfile(options);
  if (provider === 'discord') return fetchDiscordProfile(options);
  throw createOAuthError(`Unsupported OAuth provider: ${provider}`, 404);
}

async function findOrCreateOAuthPlayer(provider, profile) {
  if (!profile || !profile.id) {
    throw createOAuthError('Provider profile did not include a stable user id.', 502);
  }

  const providerUserId = String(profile.id);
  const email = normalizeEmail(profile.email);
  const verifiedEmail = profile.emailVerified && email ? email : null;
  const displayName = cleanText(profile.displayName || profile.username || email || '');
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [linkedRows] = await connection.query(
      `SELECT p.*
       FROM player_oauth_accounts a
       INNER JOIN players p ON p.id = a.player_id
       WHERE a.provider = ?
         AND a.provider_user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [provider, providerUserId]
    );

    if (linkedRows.length) {
      await updateOAuthAccount(connection, {
        provider,
        providerUserId,
        email,
        displayName
      });
      await connection.commit();
      return linkedRows[0];
    }

    let player = null;
    if (verifiedEmail) {
      const [emailRows] = await connection.query('SELECT * FROM players WHERE email = ? LIMIT 1 FOR UPDATE', [verifiedEmail]);
      player = emailRows[0] || null;
    }

    if (!player) {
      player = await createOAuthPlayer(connection, {
        provider,
        providerUserId,
        email: verifiedEmail,
        displayName
      });
    }

    await connection.query(
      `INSERT INTO player_oauth_accounts
        (player_id, provider, provider_user_id, email, display_name)
       VALUES (?, ?, ?, ?, ?)`,
      [player.id, provider, providerUserId, email, displayName || null]
    );

    await connection.commit();
    return player;
  } catch (error) {
    await connection.rollback();

    if (error.code === 'ER_DUP_ENTRY') {
      return loadLinkedOAuthPlayer(provider, providerUserId);
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function fetchGoogleProfile(options) {
  const config = requireProviderConfig('google');
  const token = await requestJson(PROVIDERS.google.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: options.code,
      grant_type: 'authorization_code',
      redirect_uri: options.redirectUri
    })
  });

  const user = await requestJson(PROVIDERS.google.userInfoUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token.access_token}`
    }
  });

  return {
    id: user.sub,
    email: user.email,
    emailVerified: parseBoolean(user.email_verified),
    displayName: user.name,
    username: user.given_name || user.email
  };
}

async function fetchDiscordProfile(options) {
  const config = requireProviderConfig('discord');
  const token = await requestJson(PROVIDERS.discord.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code: options.code,
      grant_type: 'authorization_code',
      redirect_uri: options.redirectUri
    })
  });

  const user = await requestJson(PROVIDERS.discord.userInfoUrl, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token.access_token}`
    }
  });

  return {
    id: user.id,
    email: user.email,
    emailVerified: parseBoolean(user.verified),
    displayName: user.global_name || user.username,
    username: user.username
  };
}

async function createOAuthPlayer(connection, options) {
  const baseUsername = buildUsernameCandidate(options.displayName || options.email, options.provider);
  const unusablePassword = crypto.randomBytes(32).toString('base64url');
  const { salt, hash } = hashPassword(unusablePassword);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const playerId = crypto.randomUUID();
    const username = await buildUniqueUsername(connection, baseUsername, attempt);

    try {
      await connection.query(
        'INSERT INTO players (id, username, email, password_hash, password_salt, unlocks) VALUES (?, ?, ?, ?, ?, ?)',
        [playerId, username, options.email || null, hash, salt, JSON.stringify([])]
      );
      await saveDefaultBoundShrine(playerId, connection);

      const [rows] = await connection.query('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
      return rows[0];
    } catch (error) {
      if (error.code !== 'ER_DUP_ENTRY') throw error;

      if (options.email) {
        const [emailRows] = await connection.query('SELECT * FROM players WHERE email = ? LIMIT 1 FOR UPDATE', [options.email]);
        if (emailRows.length) return emailRows[0];
      }
    }
  }

  throw createOAuthError('Could not create a unique player account.', 409);
}

async function buildUniqueUsername(connection, baseUsername, attempt) {
  const suffix = attempt === 0 ? '' : `-${crypto.randomBytes(2).toString('hex')}`;
  const username = `${baseUsername.slice(0, USERNAME_MAX_LENGTH - suffix.length)}${suffix}`;
  const [rows] = await connection.query('SELECT id FROM players WHERE username = ? LIMIT 1', [username]);
  if (!rows.length) return username;
  return buildUniqueUsername(connection, baseUsername, attempt + 1);
}

async function updateOAuthAccount(connection, options) {
  await connection.query(
    `UPDATE player_oauth_accounts
     SET email = ?,
         display_name = ?
     WHERE provider = ?
       AND provider_user_id = ?`,
    [options.email || null, options.displayName || null, options.provider, options.providerUserId]
  );
}

async function loadLinkedOAuthPlayer(provider, providerUserId) {
  const [rows] = await db.query(
    `SELECT p.*
     FROM player_oauth_accounts a
     INNER JOIN players p ON p.id = a.player_id
     WHERE a.provider = ?
       AND a.provider_user_id = ?
     LIMIT 1`,
    [provider, providerUserId]
  );

  if (!rows.length) {
    throw createOAuthError('OAuth account link could not be loaded.', 409);
  }

  return rows[0];
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const payload = text ? parseJson(text) : {};

  if (!response.ok) {
    const message = payload.error_description || payload.error || `OAuth request failed with ${response.status}.`;
    throw createOAuthError(message, response.status);
  }

  return payload;
}

function getProviderDefinition(provider) {
  const definition = PROVIDERS[provider];
  if (!definition) throw createOAuthError(`Unsupported OAuth provider: ${provider}`, 404);
  return definition;
}

function requireProviderConfig(provider) {
  const config = getProviderConfig(provider);
  if (!config || !config.enabled) {
    throw createOAuthError(`${PROVIDERS[provider]?.label || provider} sign-in is not configured.`, 503);
  }

  return config;
}

function getProviderConfig(provider) {
  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    return {
      clientId,
      clientSecret,
      enabled: Boolean(clientId && clientSecret)
    };
  }

  if (provider === 'discord') {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const clientSecret = process.env.DISCORD_CLIENT_SECRET;
    return {
      clientId,
      clientSecret,
      enabled: Boolean(clientId && clientSecret)
    };
  }

  return null;
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    return {};
  }
}

function buildUsernameCandidate(value, provider) {
  return createUsernameCandidate(value, `${provider}-hunter`);
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email && email.includes('@') ? email.slice(0, 255) : null;
}

function cleanText(value) {
  const text = String(value || '').trim();
  return text ? text.slice(0, 255) : '';
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function createOAuthError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  buildAuthorizationUrl,
  fetchOAuthProfile,
  findOrCreateOAuthPlayer,
  getProviderStatuses,
  isProviderConfigured,
  isSupportedProvider
};
