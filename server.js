const express = require('express');
const path = require('path');
require('./public/api/lib/async-errors');
const apiRoutes = require('./public/api');

const app = express();
const PORT = process.env.PORT || 3000;
const appDir = path.join(__dirname, 'public', 'app');
app.use(express.json());
app.use('/api', apiRoutes);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/lucide', express.static(path.join(__dirname, 'node_modules', 'lucide', 'dist', 'umd')));

// ============================================================================
// MAIN ROUTE: GET /demons/type/:page
// Serves the static collection shell. Client-side JS reads the page number.
// ============================================================================

app.get('/demons/type/:page', (req, res) => {
  const pageNumber = parseInt(req.params.page, 10);

  // Validate page number
  if (isNaN(pageNumber) || pageNumber < 1) {
    return res.status(400).send('Invalid page number.');
  }

  res.sendFile(path.join(appDir, 'index.html'));
});

// Redirect to first page when accessing /demons/type/ without a number
app.get('/demons/type/', (req, res) => {
  return res.redirect(302, '/demons/type/1');
});

app.get('/', (req, res) => {
  res.sendFile(path.join(appDir, 'play.html'));
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

module.exports = app;
