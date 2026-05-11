const express = require('express');
const { getDemonAssets } = require('../lib/game-data');

const router = express.Router();

router.get('/game/demons', async (req, res) => {
  res.json(await getDemonAssets());
});

module.exports = router;
