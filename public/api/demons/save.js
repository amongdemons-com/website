const express = require('express');
const { requireAuth } = require('../lib/auth');
const { saveCollectionDemon } = require('../lib/collection-demons');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { MAX_DUNGEON_FLOOR } = require('../lib/dungeon-rules');

const router = express.Router();

router.post('/demons/save', requireAuth, async (req, res) => {
  const runId = String(req.body.runId || '');
  const rewardId = Number(req.body.rewardId);

  if (!runId || !rewardId) {
    return res.status(400).json({ error: 'runId and rewardId are required.' });
  }

  const run = await getRunForPlayer(runId, req.player.id);
  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  const reward = run.rewards.find((item) => item.rewardId === rewardId);
  if (!reward || !reward.demon) {
    return res.status(404).json({ error: 'Demon reward not found.' });
  }

  if (reward.type !== 'final') {
    return res.status(409).json({ error: 'Only final dungeon demons can be saved to your collection.' });
  }

  if (run.status !== 'completed') {
    return res.status(409).json({ error: `Complete floor ${MAX_DUNGEON_FLOOR} before saving a final demon.` });
  }

  if (run.rewards.some((item) => item.type === 'final' && item.saved)) {
    return res.status(409).json({ error: 'Final dungeon demon already saved.' });
  }

  if (reward.saved) {
    return res.status(409).json({ error: 'Demon reward already saved.' });
  }

  const demon = reward.demon;
  const saved = await saveCollectionDemon(req.player.id, demon);

  reward.saved = true;
  reward.claimed = true;
  reward.savedDemonId = saved.demon.id;
  run.state.awaitingFinalPick = false;
  await saveRun(run);

  res.status(saved.replaced ? 200 : 201).json({
    demon: saved.demon,
    replaced: saved.replaced
  });
});

module.exports = router;
