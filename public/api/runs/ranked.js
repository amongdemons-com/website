const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { advanceDungeonFloor } = require('../lib/dungeon-progression');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { serializeRun } = require('../lib/run-serialization');

const router = express.Router();

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

    await advanceDungeonFloor(run, req.player, {
      queryable: connection,
      skipRankedEncounter: true
    });
    await saveRun(run, connection);
    await connection.commit();
    committed = true;

    res.json({ run: await serializeRun(run, { playerLevel: req.player.level }) });
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
