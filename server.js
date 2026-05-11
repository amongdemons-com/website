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

// Handle root redirect
app.get('/', (req, res) => {
  // If no type parameter is present, redirect to /demons/type/1
  if (!req.query.type) {
    return res.redirect(302, '/demons/type/1');
  }

  return res.redirect(302, `/demons/type/${req.query.type}`);
});

// === Hunt Route: GET /hunt/
app.get(['/hunt', '/hunt/'], (req, res) => {
  res.sendFile(path.join(appDir, 'hunt.html'));
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
