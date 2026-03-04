const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// EJS template engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================================
// SERVER-SIDE CONSTANTS (moved from client-side CONFIG)
// ============================================================================

const CONFIG = {
  imagesPerPage: 6,
  totalImages: 66,
  // Using relative path from public/ root to access demo images
  imagesDir: '/data/images/demons/',
  thumbnailsDir: '/data/images/demons/thumbnails/',
  rarityTypes: ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'],
  demonNames: [
    "Boof Nitza", "Gon G'ah", "Ma'Zga", "Tor Tza", "Vi'Zel", 
    "Goh Loomb", "Baobaw", "Ko Pak", "Chu Perk", "Ba Be'aga", 
    "Vee Scol"
  ]
};

// ============================================================================
// HELPER FUNCTIONS (moved from client-side JavaScript)
// ============================================================================

/**
 * Calculate rarity based on image index
 * Mod 0 = mythic, others use the array position
 */
function getRarity(index) {
  const mod = (index - 1) % CONFIG.imagesPerPage; // Adjust for 1-based indexing
  if (mod === 0) return 'mythic';
  return CONFIG.rarityTypes[mod - 1];
}

/**
 * Get demon name for a given page number
 * Returns "Unknown" for indices beyond demon names array
 */
function getDemonName(pageNumber) {
  const index = pageNumber - 1; // Convert to 0-based indexing
  if (index >= CONFIG.demonNames.length) {
    return 'Unknown';
  }
  return CONFIG.demonNames[index];
}

/**
 * Capitalize first letter of a string
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// MAIN ROUTE: GET /demons/type/:page
// Handles all pagination logic, rarity calculations, and demon name mapping
// ============================================================================

app.get('/demons/type/:page', (req, res) => {
  const pageNumber = parseInt(req.params.page, 10);

  // Validate page number
  if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > Math.ceil(CONFIG.totalImages / CONFIG.imagesPerPage)) {
    return res.status(400).send('Invalid page number. Must be between 1 and ' + Math.ceil(CONFIG.totalImages / CONFIG.imagesPerPage));
  }

  // Calculate pagination boundaries
  const startImage = (pageNumber - 1) * CONFIG.imagesPerPage + 1;
  const endImage = Math.min(startImage + CONFIG.imagesPerPage - 1, CONFIG.totalImages);

  // Generate demon grid data for EJS template
  const demons = [];
  for (let i = startImage; i <= endImage; i++) {
    const rarity = getRarity(i);
    const title = `${capitalize(rarity)} ${getDemonName(pageNumber)}`;
    demons.push({
      id: i,
      imageSrc: CONFIG.imagesDir + i + '.png',
      alt: rarity,
      title: title,
      rarityClass: rarity,
      displayName: capitalize(rarity)
    });
  }

  // Calculate total pages for pagination
  const totalPages = Math.ceil(CONFIG.totalImages / CONFIG.imagesPerPage);

  // Render EJS template with all computed data
  res.render('index', {
    currentPage: pageNumber,
    totalPages: totalPages,
    startImage: startImage,
    endImage: endImage,
    demons: demons,
    CONFIG: CONFIG,
    getRarity: getRarity,
    getDemonName: getDemonName,
    capitalize: capitalize
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

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});