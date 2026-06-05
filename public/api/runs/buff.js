const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, requireAuth } = require('../lib/auth');
const { createRng } = require('../lib/rng');
const { getRunForPlayer, parseRun, saveRun } = require('../lib/runs');
const { ensureRunBuffState, generateBuffChoices, getBuffById, hasPendingBuffChoices, PACT_REROLL_SOUL_COST, selectRunBuff } = require('../lib/run-buffs');
const { serializeRun } = require('../lib/run-serialization');

const router = express.Router();

router.post('/runs/:id/buff/reroll', requireAuth, async (req, res) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [playerRows] = await connection.query(
      'SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
      [req.player.id]
    );

    if (!playerRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Player not found.' });
    }

    const [runRows] = await connection.query(
      'SELECT * FROM runs WHERE id = ? AND player_id = ? LIMIT 1 FOR UPDATE',
      [req.params.id, req.player.id]
    );

    if (!runRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Run not found.' });
    }

    const player = playerRows[0];
    const run = parseRun(runRows[0]);

    const validationError = validatePendingRunBuffChoice(run);
    if (validationError) {
      await connection.rollback();
      return res.status(validationError.status).json({ error: validationError.message });
    }

    const playerSouls = Number(player.souls) || 0;
    if (playerSouls < PACT_REROLL_SOUL_COST) {
      await connection.rollback();
      return res.status(400).json({ error: `Recast costs ${PACT_REROLL_SOUL_COST} Souls.` });
    }

    const state = ensureRunBuffState(run);
    const previousChoices = [...state.pendingChoices];
    state.rerolls += 1;
    const nextChoices = generateBuffChoices(run, createBuffChoiceRng(run, state.rerolls), 3, {
      excludeIds: previousChoices,
      preserveRerolls: true
    });

    if (!nextChoices.length) {
      state.pendingChoices = previousChoices;
      state.rerolls = Math.max(0, state.rerolls - 1);
      await connection.rollback();
      return res.status(409).json({ error: 'No alternate Demonic Pacts are available.' });
    }

    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [PACT_REROLL_SOUL_COST, req.player.id]
    );
    await saveRunWithConnection(connection, run);
    await connection.commit();

    player.souls = playerSouls - PACT_REROLL_SOUL_COST;

    res.json({
      run: await serializeRun(run),
      player: cleanPlayer(player)
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ error: 'Unable to recast Demonic Pacts.' });
  } finally {
    connection.release();
  }
});

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

function validatePendingRunBuffChoice(run) {
  if (run.status !== 'active') {
    return { status: 409, message: 'Run is not active.' };
  }

  if (!run.state.awaitingRecruit || !hasPendingBuffChoices(run)) {
    return { status: 409, message: 'No Demonic Pact choice is pending.' };
  }

  return null;
}

async function saveRunWithConnection(connection, run) {
  await connection.query(
    `UPDATE runs
     SET status = ?, floor = ?, state = ?, rewards = ?, ended_at = ?
     WHERE id = ? AND player_id = ?`,
    [
      run.status,
      run.floor,
      JSON.stringify(run.state),
      JSON.stringify(run.rewards),
      run.endedAt || null,
      run.id,
      run.playerId
    ]
  );
}

function createBuffChoiceRng(run, rerollIndex = 0) {
  return createRng((
    Number(run.seed) +
    Number(run.floor) * 2654435761 +
    724981 +
    Number(rerollIndex) * 1597334677
  ) >>> 0);
}

module.exports = router;
