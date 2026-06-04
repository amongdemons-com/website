const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { getBuffById, hasPendingBuffChoices, selectRunBuff } = require('../lib/run-buffs');
const { serializeRun } = require('../lib/run-serialization');

const router = express.Router();

router.post('/runs/:id/buff', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);
  const buffId = String(req.body?.buffId || '');

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active') {
    return res.status(409).json({ error: 'Run is not active.' });
  }

  if (!run.state.awaitingRecruit || !hasPendingBuffChoices(run)) {
    return res.status(409).json({ error: 'No Demonic Pact choice is pending.' });
  }

  const buff = getBuffById(buffId);
  if (!buff) {
    return res.status(404).json({ error: 'Demonic Pact not found.' });
  }

  if (!run.state.buffs.pendingChoices.includes(buffId)) {
    return res.status(409).json({ error: 'Choose one of the offered Demonic Pacts.' });
  }

  selectRunBuff(run, buffId);
  await saveRun(run);

  res.json(await serializeRun(run));
});

module.exports = router;
