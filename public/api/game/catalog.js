const express = require('express');
const { getGameCatalog } = require('../lib/game-data');

const router = express.Router();

router.get('/game/catalog', async (req, res) => {
  const catalog = await getGameCatalog();
  const cacheControl = req.query.v
    ? 'public, max-age=31536000, immutable'
    : 'public, max-age=3600, stale-while-revalidate=86400';

  res.set('Cache-Control', cacheControl);
  res.json(catalog);
});

module.exports = router;
