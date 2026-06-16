const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, createSession, createToken } = require('../lib/auth');
const {
  buildAuthorizationUrl,
  fetchOAuthProfile,
  findOrCreateOAuthPlayer,
  getProviderStatuses,
  isProviderConfigured,
  isSupportedProvider
} = require('../lib/oauth');

const router = express.Router();
const OAUTH_STATE_TTL_MINUTES = 10;

router.get('/auth/oauth/providers', async (req, res) => {
  res.json({ providers: getProviderStatuses() });
});

router.get('/auth/oauth/:provider', async (req, res) => {
  const provider = normalizeProvider(req.params.provider);
  const mode = normalizeMode(req.query.mode);

  if (!provider || !isProviderConfigured(provider)) {
    return redirectAuthError(res, mode, 'provider_unavailable');
  }

  const state = createToken();
  const redirectPath = normalizeRedirectPath(req.query.returnTo || req.query.redirect || '/camp');
  const redirectUri = getCallbackUrl(req, provider);

  await cleanupOAuthStates();
  await db.query(
    `INSERT INTO oauth_states (state, provider, mode, redirect_path, expires_at)
     VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${OAUTH_STATE_TTL_MINUTES} MINUTE))`,
    [state, provider, mode, redirectPath]
  );

  const authUrl = buildAuthorizationUrl(provider, {
    redirectUri,
    state
  });

  res.redirect(302, authUrl);
});

router.get('/auth/oauth/:provider/callback', handleOAuthCallback);
router.post('/auth/oauth/:provider/callback', express.urlencoded({ extended: false }), handleOAuthCallback);

async function handleOAuthCallback(req, res) {
  const provider = normalizeProvider(req.params.provider);
  if (!provider) return redirectAuthError(res, 'login', 'provider_unavailable');

  const stateToken = String(req.body?.state || req.query.state || '');
  const oauthState = await consumeOAuthState(stateToken, provider);
  const mode = oauthState?.mode || 'login';

  if (!oauthState) {
    return redirectAuthError(res, mode, 'invalid_state');
  }

  const providerError = String(req.body?.error || req.query.error || '');
  if (providerError) {
    return redirectAuthError(res, mode, providerError === 'access_denied' ? 'access_denied' : 'oauth_failed');
  }

  const code = String(req.body?.code || req.query.code || '');
  if (!code) {
    return redirectAuthError(res, mode, 'oauth_failed');
  }

  try {
    const redirectUri = getCallbackUrl(req, provider);
    const profile = await fetchOAuthProfile(provider, {
      code,
      redirectUri,
      user: req.body?.user
    });
    const player = await findOrCreateOAuthPlayer(provider, profile);
    const token = await createSession(player.id);

    res.set('Cache-Control', 'no-store');
    return res.type('html').send(renderOAuthCompletePage({
      player: cleanPlayer(player),
      redirectPath: oauthState.redirect_path,
      token
    }));
  } catch (error) {
    console.error('OAuth callback failed:', error);
    return redirectAuthError(res, mode, 'oauth_failed');
  }
}

async function consumeOAuthState(state, provider) {
  if (!state) return null;

  const [result] = await db.query(
    `UPDATE oauth_states
     SET used_at = CURRENT_TIMESTAMP
     WHERE state = ?
       AND provider = ?
       AND used_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP`,
    [state, provider]
  );

  if (!result.affectedRows) return null;

  const [rows] = await db.query(
    'SELECT mode, redirect_path FROM oauth_states WHERE state = ? AND provider = ? LIMIT 1',
    [state, provider]
  );

  return rows[0] || null;
}

async function cleanupOAuthStates() {
  await db.query(
    `DELETE FROM oauth_states
     WHERE expires_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)
        OR used_at <= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 HOUR)`
  );
}

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return isSupportedProvider(provider) ? provider : '';
}

function normalizeMode(value) {
  return String(value || '').toLowerCase() === 'register' ? 'register' : 'login';
}

function normalizeRedirectPath(value) {
  const path = String(value || '').trim();
  if (!path || !path.startsWith('/') || path.startsWith('//')) return '/camp';
  return path.slice(0, 255);
}

function getCallbackUrl(req, provider) {
  const configuredOrigin = String(process.env.OAUTH_REDIRECT_ORIGIN || process.env.APP_ORIGIN || '').replace(/\/+$/, '');
  const origin = configuredOrigin || `${req.protocol}://${req.get('host')}`;
  return `${origin}/api/auth/oauth/${provider}/callback`;
}

function redirectAuthError(res, mode, code) {
  const target = normalizeMode(mode) === 'register' ? '/register' : '/login';
  return res.redirect(302, `${target}?oauth=${encodeURIComponent(code)}`);
}

function renderOAuthCompletePage(options) {
  const session = JSON.stringify({
    token: options.token,
    player: options.player
  });
  const sessionLiteral = safeScriptJson(session);
  const redirectLiteral = safeScriptJson(normalizeRedirectPath(options.redirectPath));
  const redirectHref = escapeAttribute(normalizeRedirectPath(options.redirectPath));

  return `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Signing In | Among Demons</title>
    <link rel="icon" href="/app/images/amongdemons.ico" type="image/x-icon">
    <link href="/app/css/main.css" rel="stylesheet">
  </head>
  <body>
    <main class="container my-4 auth-shell d-flex align-items-center justify-content-center text-center">
      <section>
        <img class="auth-complete-mark" src="/app/images/amongdemons_logo_250x250.png" alt="Among Demons logo" width="96" height="96">
        <h1 class="h4 mt-3">Signing you in...</h1>
        <p><a href="${redirectHref}">Continue</a></p>
      </section>
    </main>
    <script>
      localStorage.setItem('amongdemons-session', ${sessionLiteral});
      window.location.replace(${redirectLiteral});
    </script>
  </body>
</html>`;
}

function safeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = router;
