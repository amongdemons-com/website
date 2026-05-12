const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { normalizePosition } = require('../lib/run-demons');

const router = express.Router();

router.post('/runs/:id/formation', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active') {
    return res.status(409).json({ error: 'Run is not active.' });
  }

  if (run.state.awaitingRecruit || run.state.awaitingFinalPick) {
    return res.status(409).json({ error: 'Resolve the pending hunt choice before changing formation.' });
  }

  const formation = Array.isArray(req.body.formation) ? req.body.formation : [];
  if (!formation.length) {
    return res.status(400).json({ error: 'formation is required.' });
  }

  const positionsById = new Map(
    formation
      .filter((item) => item && item.instanceId)
      .map((item) => [String(item.instanceId), normalizePosition(item.position)])
  );

  run.state.team = (run.state.team || []).map((demon, index) => ({
    ...demon,
    position: positionsById.get(demon.instanceId) || normalizePosition(demon.position || (index === 0 ? 'front' : 'back'))
  }));

  await saveRun(run);
  res.json({ team: run.state.team });
});

module.exports = router;
