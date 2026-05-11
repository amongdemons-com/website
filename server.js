const express = require('express');
const path = require('path');
require('./public/api/lib/async-errors');
const apiRoutes = require('./public/api');

const app = express();
const PORT = process.env.PORT || 3000;

// EJS template engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(apiRoutes);
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// MAIN ROUTE: GET /demons/type/:page
// Handles all pagination logic, rarity calculations, and demon name mapping
// ============================================================================

app.get('/demons/type/:page', (req, res) => {
  const pageNumber = parseInt(req.params.page, 10);

  // Validate page number
  if (isNaN(pageNumber) || pageNumber < 1) {
    return res.status(400).send('Invalid page number.');
  }

  res.render('index', {
    currentPage: pageNumber
  });
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
});

// === Hunt Route: GET /hunt/
app.get('/hunt', (req, res) => {
  const pageNumber = 1;
  res.render('hunt', {
    currentPage: pageNumber
  });
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
