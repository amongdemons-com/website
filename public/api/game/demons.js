const express = require('express');
const { getDemonAssets } = require('../lib/game-data');

const router = express.Router();

router.get('/game/demons', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json(await getDemonAssets());
});

module.exports = router;
