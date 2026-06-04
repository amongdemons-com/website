const express = require('express');
const { requireAuth } = require('../lib/auth');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { hasPendingBuffChoices } = require('../lib/run-buffs');
const { getFormationSlotPosition, normalizeFormationSlot, normalizePosition } = require('../lib/run-demons');

const router = express.Router();

router.post('/runs/:id/formation', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active') {
    return res.status(409).json({ error: 'Run is not active.' });
  }

  if (run.state.awaitingRecruit) {
    return res.status(409).json({ error: 'Resolve the pending dungeon choice before changing formation.' });
  }

  if (hasPendingBuffChoices(run)) {
    return res.status(409).json({ error: 'Choose a Demonic Pact before changing formation.' });
  }

  const formation = Array.isArray(req.body.formation) ? req.body.formation : [];
  if (!formation.length) {
    return res.status(400).json({ error: 'formation is required.' });
  }

  const formationById = new Map(
    formation
      .filter((item) => item && item.instanceId)
      .map((item) => {
        const formationSlot = normalizeFormationSlot(item.formationSlot ?? item.formationRow);
        return [String(item.instanceId), {
          position: normalizePosition(item.position),
          formationSlot
        }];
      })
  );

  run.state.team = (run.state.team || []).map((demon, index) => {
    const formation = formationById.get(demon.instanceId);
    const fallbackSlot = normalizeFormationSlot(demon.formationSlot ?? demon.formationRow);
    const formationSlot = formation?.formationSlot ?? fallbackSlot;

    return {
      ...demon,
      position: formationSlot !== null
        ? getFormationSlotPosition(formationSlot, 'player')
        : (formation?.position || normalizePosition(demon.position || (index === 0 ? 'front' : 'back'))),
      ...(formationSlot !== null ? { formationSlot } : {})
    };
  });

  await saveRun(run);
  res.json({ team: run.state.team });
});

module.exports = router;
