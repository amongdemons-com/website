const crypto = require('crypto');
const db = require('./db');
const { hashPassword } = require('./auth');
const { saveDefaultBoundShrine } = require('./world-shrines');
const { grantStarterDemons } = require('./starter-demon');
const { grantStarterEcho } = require('./starter-echo');
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

async function findOrCreateOAuthPlayer(provider, profile, options = {}) {
  if (!profile || !profile.id) {
    throw createOAuthError('Provider profile did not include a stable user id.', 502);
  }

  const providerUserId = String(profile.id);
  const email = normalizeEmail(profile.email);
  const verifiedEmail = profile.emailVerified && email ? email : null;
  const displayName = cleanText(profile.displayName || profile.username || email || '');
  const claimPlayerId = options.claimPlayerId ? String(options.claimPlayerId) : null;
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
      await upgradeFallbackUsername(connection, linkedRows[0], provider, displayName);
      await connection.commit();
      return linkedRows[0];
    }

    let player = null;
    if (verifiedEmail) {
      const [emailRows] = await connection.query('SELECT * FROM players WHERE email = ? LIMIT 1 FOR UPDATE', [verifiedEmail]);
      player = emailRows[0] || null;
    }

    // The OAuth identity is brand-new and its email is not already an account,
    // so a guest signing up here keeps their hunter: adopt the guest row in
    // place instead of creating a fresh, empty account.
    if (!player && claimPlayerId) {
      const adopted = await adoptGuestForOAuth(connection, {
        claimPlayerId,
        provider,
        providerUserId,
        email: verifiedEmail,
        displayName
      });

      if (adopted) {
        await connection.commit();
        return adopted;
      }
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

async function linkOAuthPlayer(playerId, provider, profile) {
  if (!profile || !profile.id) {
    throw createOAuthError('Provider profile did not include a stable user id.', 502);
  }

  const providerUserId = String(profile.id);
  const email = normalizeEmail(profile.email);
  const displayName = cleanText(profile.displayName || profile.username || email || '');
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [playerRows] = await connection.query(
      'SELECT * FROM players WHERE id = ? AND is_guest = 0 LIMIT 1 FOR UPDATE',
      [playerId]
    );
    if (!playerRows.length) {
      throw createOAuthError('The account to connect could not be found.', 404);
    }

    const [identityRows] = await connection.query(
      `SELECT player_id
       FROM player_oauth_accounts
       WHERE provider = ?
         AND provider_user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [provider, providerUserId]
    );
    if (identityRows.length && identityRows[0].player_id !== playerId) {
      const error = createOAuthError(
        `This ${PROVIDERS[provider].label} account is already connected to another hunter.`,
        409
      );
      error.conflictingPlayerId = identityRows[0].player_id;
      error.providerUserId = providerUserId;
      throw error;
    }

    const [providerRows] = await connection.query(
      `SELECT provider_user_id
       FROM player_oauth_accounts
       WHERE player_id = ?
         AND provider = ?
       LIMIT 1
       FOR UPDATE`,
      [playerId, provider]
    );
    if (providerRows.length && providerRows[0].provider_user_id !== providerUserId) {
      throw createOAuthError(`${PROVIDERS[provider].label} is already connected to this hunter. Disconnect it first.`, 409);
    }

    if (identityRows.length) {
      await updateOAuthAccount(connection, {
        provider,
        providerUserId,
        email,
        displayName
      });
    } else {
      await connection.query(
        `INSERT INTO player_oauth_accounts
          (player_id, provider, provider_user_id, email, display_name)
         VALUES (?, ?, ?, ?, ?)`,
        [playerId, provider, providerUserId, email, displayName || null]
      );
    }

    await connection.commit();
    return playerRows[0];
  } catch (error) {
    await connection.rollback();
    if (error.code === 'ER_DUP_ENTRY') {
      error.status = 409;
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
        `INSERT INTO players
          (id, username, email, password_hash, password_salt, password_login_enabled, unlocks)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [playerId, username, options.email || null, hash, salt, JSON.stringify([])]
      );
      await saveDefaultBoundShrine(playerId, connection);
      try {
        await Promise.all([
          grantStarterDemons(playerId, connection),
          grantStarterEcho(playerId, connection)
        ]);
      } catch (starterError) {
        console.error('Failed to grant starter loadout on OAuth signup', playerId, starterError);
      }

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

// Claim a guest hunter through an OAuth provider: keep the same player id (and
// all its demons/progress), attach the provider link + email, swap the
// temporary name for a provider-derived one, and clear the guest flag.
async function adoptGuestForOAuth(connection, options) {
  const [guestRows] = await connection.query(
    'SELECT * FROM players WHERE id = ? AND is_guest = 1 LIMIT 1 FOR UPDATE',
    [options.claimPlayerId]
  );

  if (!guestRows.length) return null;

  const guest = guestRows[0];
  const baseUsername = buildUsernameCandidate(options.displayName || options.email, options.provider);
  const username = await buildUniqueUsername(connection, baseUsername, 0);

  await connection.query(
    'UPDATE players SET username = ?, email = ?, is_guest = 0 WHERE id = ?',
    [username, options.email || null, guest.id]
  );

  await connection.query(
    `INSERT INTO player_oauth_accounts
      (player_id, provider, provider_user_id, email, display_name)
     VALUES (?, ?, ?, ?, ?)`,
    [guest.id, options.provider, options.providerUserId, options.email, options.displayName || null]
  );

  const [rows] = await connection.query('SELECT * FROM players WHERE id = ? LIMIT 1', [guest.id]);
  return rows[0] || null;
}

// Accounts created while the provider had no usable display name (e.g. Steam
// sign-ins from before the persona lookup existed) carry the generic
// '<provider>-hunter' fallback; swap in a name derived from the real display
// name once one shows up. Player-chosen usernames never match the fallback
// pattern, so they are never touched.
async function upgradeFallbackUsername(connection, player, provider, displayName) {
  const fallback = `${provider}-hunter`;
  const fallbackPattern = new RegExp(`^${fallback}(-[0-9a-f]{4})?$`);
  if (!displayName || !fallbackPattern.test(player.username)) return;

  const candidate = buildUsernameCandidate(displayName, provider);
  if (candidate === fallback) return;

  player.username = await buildUniqueUsername(connection, candidate, 0);
  await connection.query('UPDATE players SET username = ? WHERE id = ?', [player.username, player.id]);
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
  isSupportedProvider,
  linkOAuthPlayer
};
