const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const {
  applyDungeonRankedRatingResult,
  didDungeonRankedEscape,
  resumeDungeonPreparationAfterRankedEncounter
} = require('../lib/dungeon-ranked');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { serializeRun } = require('../lib/run-serialization');

const router = express.Router();

router.post('/runs/:id/ranked/escape', requireAuth, async (req, res) => {
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const run = await getRunForPlayer(req.params.id, req.player.id, connection, { forUpdate: true });
    if (!run) throw createHttpError('Run not found.', 404);
    if (run.status !== 'active') throw createHttpError('Run is not active.', 409);

    const encounter = run.state.rankedEncounter;
    if (encounter?.status !== 'choice') {
      throw createHttpError('No Ranked dungeon encounter is waiting.', 409);
    }
    if (encounter.escapeAttempted) {
      throw createHttpError('The escape attempt is already over. The rival must be fought.', 409);
    }

    encounter.escapeAttempted = true;
    const escaped = didDungeonRankedEscape();
    let rankedResult = null;
    let nextFloor = null;
    if (escaped) {
      rankedResult = await applyDungeonRankedRatingResult(run, 'enemy', connection);
      nextFloor = resumeDungeonPreparationAfterRankedEncounter(run);
    }

    await saveRun(run, connection);
    await connection.commit();
    committed = true;

    res.json({
      escaped,
      rankedResult,
      nextFloor,
      run: await serializeRun(run, { playerLevel: req.player.level })
    });
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.post('/runs/:id/ranked/continue', requireAuth, async (req, res) => {
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const run = await getRunForPlayer(req.params.id, req.player.id, connection, { forUpdate: true });
    if (!run) throw createHttpError('Run not found.', 404);
    if (run.status !== 'active') throw createHttpError('Run is not active.', 409);

    const encounter = run.state.rankedEncounter;
    if (encounter?.status !== 'result' || encounter.result?.winner !== 'player') {
      throw createHttpError('No Ranked victory is waiting.', 409);
    }

    const nextFloor = resumeDungeonPreparationAfterRankedEncounter(run);
    await saveRun(run, connection);
    await connection.commit();
    committed = true;

    res.json({
      nextFloor,
      run: await serializeRun(run, { playerLevel: req.player.level })
    });
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = router;
