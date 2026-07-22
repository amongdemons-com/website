const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getAccountProgressionPayload } = require('../lib/progression');

const router = express.Router();

router.get('/auth/me', requireAuth, async (req, res) => {
  res.json({
    player: req.player,
    progression: getAccountProgressionPayload(req.player)
  });
});

module.exports = router;
