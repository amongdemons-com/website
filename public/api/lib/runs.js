const db = require('./db');
const { enrichRunPreferredPositions } = require('./run-demons');

function parseRun(row) {
  return {
    id: row.id,
    playerId: row.player_id,
    seed: row.seed,
    status: row.status,
    floor: row.floor,
    state: JSON.parse(row.state),
    rewards: JSON.parse(row.rewards)
  };
}

async function getRunForPlayer(runId, playerId) {
  const [rows] = await db.query(
    'SELECT * FROM runs WHERE id = ? AND player_id = ? LIMIT 1',
    [runId, playerId]
  );

  return rows.length ? enrichRunPreferredPositions(parseRun(rows[0])) : null;
}

async function getCurrentRunForPlayer(playerId) {
  const [rows] = await db.query(
    `SELECT * FROM runs
     WHERE player_id = ?
       AND status IN ('active', 'defeated')
     ORDER BY
       CASE status
         WHEN 'active' THEN 1
         WHEN 'defeated' THEN 2
         ELSE 4
       END,
       updated_at DESC,
       created_at DESC
     LIMIT 1`,
    [playerId]
  );

  return rows.length ? enrichRunPreferredPositions(parseRun(rows[0])) : null;
}

async function closeOpenRunsForPlayer(playerId, exceptRunId = null) {
  const params = [playerId];
  let exceptClause = '';

  if (exceptRunId) {
    exceptClause = 'AND id <> ?';
    params.push(exceptRunId);
  }

  await db.query(
    `UPDATE runs
     SET status = 'ended',
         ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
     WHERE player_id = ?
       AND status <> 'ended'
       ${exceptClause}`,
    params
  );
}

async function saveRun(run) {
  await db.query(
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

module.exports = {
  closeOpenRunsForPlayer,
  getCurrentRunForPlayer,
  getRunForPlayer,
  parseRun,
  saveRun
};
