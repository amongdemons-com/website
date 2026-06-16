const express = require('express');
const path = require('path');
require('./public/api/lib/async-errors');
const apiRoutes = require('./public/api');
const { getFullDemonCatalog } = require('./public/api/lib/game-data');
const {
  CANONICAL_HOST,
  CANONICAL_ORIGIN,
  findDemonBySlug,
  getDemonImageFilePath,
  getRelatedDemons,
  renderDemonPage,
  renderDemonsPage,
  renderHomePage,
  renderRobotsTxt,
  renderSitemap
} = require('./lib/seo-pages');

const app = express();
const PORT = process.env.PORT || 3000;
const appDir = path.join(__dirname, 'public', 'app');
let catalogPromise;
const noindexPaths = new Set([
  '/login',
  '/register',
  '/camp',
  '/app/login.html',
  '/app/register.html',
  '/app/camp.html',
  '/app/collection.html',
  '/app/api-test.html',
  '/app/privacy.html',
  '/app/terms.html'
]);

app.set('trust proxy', true);
app.use(enforceCanonicalHost);
app.use(applyRobotsHeaders);
app.use(express.json());
app.use('/api', apiRoutes);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(renderRobotsTxt());
});

app.get('/sitemap.xml', async (req, res) => {
  const catalog = await loadDemonCatalog();
  res.type('application/xml').send(renderSitemap(catalog));
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

app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/lucide', express.static(path.join(__dirname, 'node_modules', 'lucide', 'dist', 'umd')));

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

app.get(['/camp', '/camp/'], (req, res) => {
  res.sendFile(path.join(appDir, 'camp.html'));
});

// === Dungeon Route: GET /dungeon/
app.get(['/dungeon', '/dungeon/'], (req, res) => {
  res.sendFile(path.join(appDir, 'dungeon.html'));
});

app.get(['/register', '/register/'], (req, res) => {
  res.sendFile(path.join(appDir, 'register.html'));
});

app.get(['/login', '/login/'], (req, res) => {
  res.sendFile(path.join(appDir, 'login.html'));
});

app.get(['/privacy', '/privacy/'], (req, res) => {
  res.sendFile(path.join(appDir, 'privacy.html'));
});

app.get(['/terms', '/terms/'], (req, res) => {
  res.sendFile(path.join(appDir, 'terms.html'));
});

app.get(['/collection', '/collection/'], (req, res) => {
  res.sendFile(path.join(appDir, 'collection.html'));
});

app.get(['/rank', '/rank/'], (req, res) => {
  res.redirect(302, '/rankings');
});

app.get(['/rankings', '/rankings/'], (req, res) => {
  res.sendFile(path.join(appDir, 'rankings.html'));
});

app.get(['/rankings/:sort', '/rankings/:sort/'], (req, res) => {
  if (!['floor', 'level', 'souls'].includes(req.params.sort)) {
    return res.redirect(302, '/rankings');
  }

  res.sendFile(path.join(appDir, 'rankings.html'));
});

// ============================================================================
// START SERVER
// ============================================================================

if (require.main === module) {
  app.listen(PORT, () => {
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
  if (normalizedPath === '/api' || normalizedPath.startsWith('/api/') || noindexPaths.has(normalizedPath)) {
    res.set('X-Robots-Tag', 'noindex, nofollow');
  }

  next();
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

module.exports = app;
