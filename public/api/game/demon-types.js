const express = require('express');
const { getDemonTypes } = require('../lib/game-data');

const router = express.Router();

router.get('/game/demon-types', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
  res.json(await getDemonTypes());
});

module.exports = router;
