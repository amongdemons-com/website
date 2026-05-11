const db = require('./db');

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

  return rows.length ? parseRun(rows[0]) : null;
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
  getRunForPlayer,
  parseRun,
  saveRun
};
