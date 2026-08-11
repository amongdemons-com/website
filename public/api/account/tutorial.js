const express = require('express');
const { requireAuth } = require('../lib/auth');
const {
  getTutorialProgress,
  mutateTutorialProgress
} = require('../lib/tutorial');

const router = express.Router();

router.get('/account/tutorial', requireAuth, async (req, res) => {
  res.json({ tutorial: await getTutorialProgress(req.player.id) });
});

router.patch('/account/tutorial', requireAuth, async (req, res) => {
  const action = String(req.body?.action || '').trim().toLowerCase();
  if (!['start', 'advance', 'complete', 'skip', 'complete-guide', 'trigger-guide'].includes(action)) {
    return res.status(400).json({ error: 'Choose a valid tutorial action.' });
  }

  const tutorial = await mutateTutorialProgress(req.player.id, {
    action,
    checkpoint: req.body?.checkpoint,
    guide: req.body?.guide
  });
  res.json({ tutorial });
});

router.post('/account/tutorial/restart', requireAuth, async (req, res) => {
  const tutorial = await mutateTutorialProgress(req.player.id, { action: 'restart' });
  res.json({ tutorial });
});

module.exports = router;
