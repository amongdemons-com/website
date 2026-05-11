const express = require('express');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

router.get('/auth/me', requireAuth, async (req, res) => {
  res.json({ player: req.player });
});

module.exports = router;
