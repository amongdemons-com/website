const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getPlayerCollection } = require('../lib/collection-demons');

const router = express.Router();

router.get('/demons', requireAuth, async (req, res) => {
  res.json({ demons: await getPlayerCollection(req.player.id) });
});

module.exports = router;
