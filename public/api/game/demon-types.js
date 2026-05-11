const express = require('express');
const { getDemonTypes } = require('../lib/game-data');

const router = express.Router();

router.get('/game/demon-types', async (req, res) => {
  res.json(await getDemonTypes());
});

module.exports = router;
