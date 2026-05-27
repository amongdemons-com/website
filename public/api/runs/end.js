const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { getNextAccountLevel } = require('../lib/progression');
const { getRunForPlayer, saveRun } = require('../lib/runs');

const router = express.Router();

router.post('/runs/:id/end', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status === 'ended') {
    return res.status(409).json({ error: 'Run has already ended.' });
  }

  if (run.status !== 'defeated') {
    return res.status(409).json({ error: 'Extract between fights to end a live dungeon.' });
  }

  const earned = { xp: 0, souls: 0 };

  const [playerRows] = await db.query('SELECT xp, level FROM players WHERE id = ? LIMIT 1', [req.player.id]);
  const nextXp = playerRows[0].xp + earned.xp;
  const nextLevel = getNextAccountLevel(playerRows[0].level, nextXp);

  await db.query(
    'UPDATE players SET xp = xp + ?, souls = souls + ?, level = ? WHERE id = ?',
    [earned.xp, earned.souls, nextLevel, req.player.id]
  );

  run.status = 'ended';
  run.endedAt = new Date();
  await saveRun(run);

  res.json({
    xp: earned.xp,
    souls: earned.souls,
    level: nextLevel,
    runId: run.id
  });
});

module.exports = router;
