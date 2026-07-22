const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getAccountProgressionPayload } = require('../lib/progression');

const router = express.Router();

router.get('/account/progression', requireAuth, async (req, res) => {
  res.json(getAccountProgressionPayload(req.player));
});

module.exports = router;
