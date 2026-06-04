const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getCurrentRunForPlayer, getRunForPlayer } = require('../lib/runs');
const { serializeRun } = require('../lib/run-serialization');

const router = express.Router();

router.get('/runs/current', requireAuth, async (req, res) => {
  const run = await getCurrentRunForPlayer(req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  res.json(await serializeRun(run));
});

router.get('/runs/:id', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  res.json(await serializeRun(run));
});

module.exports = router;
