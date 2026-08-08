const express = require('express');
const compression = require('compression');
const path = require('path');
require('./public/api/lib/async-errors');
const apiRoutes = require('./public/api');
const { getFullBossCatalog, getFullDemonCatalog } = require('./public/api/lib/game-data');
const {
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  findBossBySlug,
  findDemonBySlug,
  getBossPagePath,
  getDemonImageFilePath,
  getRelatedBosses,
  getRelatedDemons,
  renderBossPage,
  renderBossesPage,
  renderDemonPage,
  renderDemonsPage,
  renderEventsPage,
  renderHomePage,
  renderRobotsTxt,
  renderSitemap
} = require('./lib/seo-pages');
const { renderHunterPage } = require('./lib/hunter-page');
const { ensureSchemaReady } = require('./public/api/lib/schema');
const { purgeDueAccounts } = require('./public/api/lib/account-deletion');

const app = express();
const PORT = process.env.PORT || 3000;
const appDir = path.join(__dirname, 'public', 'app');
const browserManifest = require('./public/app/dist/manifest.json');
const BROWSER_CLIENT_VERSION = browserManifest.clientVersion || getAssetVersion(browserManifest.runtime);
let catalogPromise;
let bossCatalogPromise;
const noindexPaths = new Set([
  '/login',
  '/register',
  '/settings',
  '/skill-tree',
  '/world',
  '/camp',
  '/bag',
  '/app/login.html',
  '/app/register.html',
  '/app/settings.html',
  '/app/skill-tree.html',
  '/app/world.html',
  '/app/camp.html',
  '/app/collection.html',
  '/app/bag.html',
  '/app/privacy.html',
  '/app/terms.html'
]);

app.set('trust proxy', true);
app.use(compression());
app.use(enforceCanonicalHost);
app.use(applyRobotsHeaders);
app.use('/api', advertiseBrowserRuntimeVersion);
app.use(express.json());
app.use(handleJsonParseError);
app.use('/api', apiRoutes);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Long-lived immutable caching is safe because JS/CSS references carry ?v=
// stamps and image art is content-stable; HTML must always revalidate.
// Disabled outside production so local iteration never fights the cache.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const staticOptions = {
  maxAge: IS_PRODUCTION ? '365d' : 0,
  immutable: IS_PRODUCTION,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache');
    }
  }
};

function sendAppPage(res, fileName) {
  res.sendFile(path.join(appDir, fileName), { headers: { 'Cache-Control': 'no-cache' } });
}

app.use('/images/assets', express.static(path.join(appDir, 'images', 'assets'), staticOptions));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(renderRobotsTxt());
});

app.get('/sitemap.xml', async (req, res) => {
  const [catalog, bosses] = await Promise.all([loadDemonCatalog(), loadBossCatalog()]);
  res.type('application/xml').send(renderSitemap(catalog, bosses));
});

app.get('/app/images/demons/:imageName', async (req, res, next) => {
  const imageName = String(req.params.imageName || '');
  if (!imageName.endsWith('.png')) return next();

  const slug = imageName.replace(/\.png$/i, '');
  const catalog = await loadDemonCatalog();
  const demon = findDemonBySlug(catalog, slug);
  if (!demon) return next();

  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(getDemonImageFilePath(demon));
});

// Serve only deployable browser assets. Wrapper build directories and API
// source files live under public for historical reasons but are not web roots.
app.use('/app', express.static(appDir, staticOptions));
app.use('/vendor/lucide', express.static(path.join(__dirname, 'node_modules', 'lucide', 'dist', 'umd'), staticOptions));
app.use('/vendor/pixi', express.static(path.join(__dirname, 'node_modules', 'pixi.js', 'dist'), staticOptions));
app.use('/vendor/bootstrap/css', express.static(path.join(__dirname, 'node_modules', 'bootstrap', 'dist', 'css'), staticOptions));

app.get(['/demons/type', '/demons/type/', '/demons/type/:page'], (req, res) => {
  return res.redirect(301, '/demons');
});

app.get('/', async (req, res) => {
  const catalog = await loadDemonCatalog();
  res.send(renderHomePage(catalog));
});

app.get(['/demons', '/demons/'], async (req, res) => {
  const catalog = await loadDemonCatalog();
  res.send(renderDemonsPage(catalog));
});

app.get(['/demons/:slug', '/demons/:slug/'], async (req, res, next) => {
  const catalog = await loadDemonCatalog();
  const demon = findDemonBySlug(catalog, req.params.slug);
  if (!demon) return next();

  res.send(renderDemonPage(demon, getRelatedDemons(catalog, demon)));
});

app.get(['/bosses', '/bosses/'], async (req, res) => {
  const bosses = await loadBossCatalog();
  res.send(renderBossesPage(bosses));
});

app.get(['/events', '/events/'], (req, res) => {
  res.send(renderEventsPage());
});

app.get(['/bosses/:slug', '/bosses/:slug/'], async (req, res, next) => {
  const bosses = await loadBossCatalog();
  const boss = findBossBySlug(bosses, req.params.slug);
  if (!boss) return next();

  const canonicalPath = getBossPagePath(boss);
  if (req.path.replace(/\/+$/, '') !== canonicalPath) {
    return res.redirect(301, canonicalPath);
  }

  res.send(renderBossPage(boss, getRelatedBosses(bosses, boss)));
});

app.get(['/camp', '/camp/'], (req, res) => {
  sendAppPage(res, 'camp.html');
});

app.get(['/world', '/world/'], (req, res) => {
  sendAppPage(res, 'world.html');
});

// === Dungeon Route: GET /dungeon/
app.get(['/dungeon', '/dungeon/'], (req, res) => {
  sendAppPage(res, 'dungeon.html');
});

app.get(['/ranked', '/ranked/'], (req, res) => {
  res.redirect(301, '/dungeon');
});

app.get(['/register', '/register/'], (req, res) => {
  sendAppPage(res, 'register.html');
});

app.get(['/login', '/login/'], (req, res) => {
  sendAppPage(res, 'login.html');
});

app.get(['/settings', '/settings/'], (req, res) => {
  sendAppPage(res, 'settings.html');
});

app.get(['/skill-tree', '/skill-tree/'], (req, res) => {
  sendAppPage(res, 'skill-tree.html');
});

app.get(['/privacy', '/privacy/'], (req, res) => {
  sendAppPage(res, 'privacy.html');
});

app.get(['/terms', '/terms/'], (req, res) => {
  sendAppPage(res, 'terms.html');
});

app.get(['/collection', '/collection/'], (req, res) => {
  sendAppPage(res, 'collection.html');
});

app.get(['/bag', '/bag/'], (req, res) => {
  sendAppPage(res, 'bag.html');
});

app.get(['/inventory', '/inventory/', '/app/inventory.html'], (req, res) => {
  res.redirect(301, '/bag');
});

app.get(['/hunter', '/hunter/'], (req, res) => {
  res.redirect(302, '/leaderboard');
});

app.get(['/hunter/:username', '/hunter/:username/'], async (req, res) => {
  const html = await renderHunterPage(req.params.username);
  res.set('Cache-Control', 'no-cache').type('html').send(html);
});

app.get(['/rank', '/rank/'], (req, res) => {
  res.redirect(302, '/leaderboard');
});

app.get(['/leaderboard', '/leaderboard/'], (req, res) => {
  sendAppPage(res, 'rankings.html');
});

app.get(['/leaderboard/:sort', '/leaderboard/:sort/'], (req, res) => {
  if (req.params.sort === 'pvp') {
    return res.redirect(301, '/leaderboard/duels');
  }

  if (!['floor', 'level', 'souls', 'duels', 'ranked'].includes(req.params.sort)) {
    return res.redirect(302, '/leaderboard');
  }

  sendAppPage(res, 'rankings.html');
});

app.get(['/rankings', '/rankings/'], (req, res) => {
  res.redirect(301, '/leaderboard');
});

app.get(['/rankings/:sort', '/rankings/:sort/'], (req, res) => {
  const sort = req.params.sort === 'pvp' ? 'duels' : req.params.sort;
  if (!['floor', 'level', 'souls', 'duels', 'ranked'].includes(sort)) {
    return res.redirect(301, '/leaderboard');
  }

  res.redirect(301, `/leaderboard/${sort}`);
});

// ============================================================================
// START SERVER
// ============================================================================

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Unable to start server:', error);
    process.exitCode = 1;
  });
}

async function startServer() {
  await ensureSchemaReady();
  await purgeDueAccounts();
  const deletionCleanupTimer = setInterval(() => {
    purgeDueAccounts().catch((error) => {
      console.error('Unable to purge scheduled account deletions:', error);
    });
  }, 60 * 60 * 1000);
  deletionCleanupTimer.unref();

  return app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

function enforceCanonicalHost(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method)) return next();

  const host = String(req.headers.host || '').toLowerCase();
  const hostname = host.split(':')[0];
  const isSiteHost = hostname === CANONICAL_HOST || hostname === `www.${CANONICAL_HOST}`;
  if (!isSiteHost) return next();

  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  const needsHostRedirect = hostname !== CANONICAL_HOST;
  const needsHttpsRedirect = forwardedProto === 'http';

  if (needsHostRedirect || needsHttpsRedirect) {
    return res.redirect(301, `${CANONICAL_ORIGIN}${req.originalUrl}`);
  }

  return next();
}

function applyRobotsHeaders(req, res, next) {
  const normalizedPath = normalizePath(req.path);
  const isPublicOgImage = normalizedPath.startsWith('/api/og/');
  if ((normalizedPath === '/api' || normalizedPath.startsWith('/api/')) && !isPublicOgImage) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  } else if (noindexPaths.has(normalizedPath)) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }

  next();
}

function handleJsonParseError(error, req, res, next) {
  const isInvalidJson = error?.type === 'entity.parse.failed'
    || (error instanceof SyntaxError && error?.status === 400 && Object.hasOwn(error, 'body'));
  if (!isInvalidJson || !normalizePath(req.path).startsWith('/api/')) {
    return next(error);
  }

  console.warn('Rejected invalid API JSON body.', {
    method: req.method,
    path: req.originalUrl,
    contentType: req.get('content-type') || '',
    contentLength: req.get('content-length') || ''
  });
  return res.status(400).json({
    error: 'The request body was not valid JSON.',
    code: 'INVALID_JSON'
  });
}

function advertiseBrowserRuntimeVersion(req, res, next) {
  // Cached catalog/map responses can outlive a deployment, so they must not
  // participate in the live client/server version handshake.
  const cacheableApiPath = /^\/(?:game\/|world\/map(?:\/|$)|og\/)/.test(req.path);
  if (BROWSER_CLIENT_VERSION && !cacheableApiPath) {
    res.set('X-Among-Demons-Client', BROWSER_CLIENT_VERSION);
  }
  next();
}

function getAssetVersion(assetUrl) {
  try {
    return new URL(String(assetUrl || ''), 'https://amongdemons.com').searchParams.get('v') || '';
  } catch (error) {
    return '';
  }
}

function normalizePath(value) {
  const normalized = String(value || '').replace(/\/+$/, '');
  return normalized || '/';
}

function loadDemonCatalog() {
  if (!catalogPromise) {
    catalogPromise = getFullDemonCatalog();
  }

  return catalogPromise;
}

function loadBossCatalog() {
  if (!bossCatalogPromise) {
    bossCatalogPromise = getFullBossCatalog();
  }

  return bossCatalogPromise;
}

module.exports = app;
