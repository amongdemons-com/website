const express = require('express');
const { getPublicHunterProfile } = require('./lib/hunter-profile');

const router = express.Router();

router.get('/hunters/:username', async (req, res) => {
  const payload = await getPublicHunterProfile(req.params.username);
  if (!payload) {
    return res.status(404).json({ error: 'Hunter not found.' });
  }

  res.json(payload);
});

module.exports = router;
