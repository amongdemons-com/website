const db = require('./db');

const ACCOUNT_DELETION_GRACE_DAYS = 7;
const PLAYER_DATA_TABLES = [
  'dungeon_ranked_history',
  'dungeon_ranked_snapshots',
  'ranked_action_receipts',
  'ranked_opponent_history',
  'ranked_opponent_snapshots',
  'ranked_runs',
  'ranked_ratings',
  'player_badges',
  'player_world_merchant_stock',
  'player_world_merchant_purchases',
  'player_achievements',
  'player_play_games_credentials',
  'player_daily_quests',
  'player_tutorials',
  'runs',
  'player_world_teams',
  'player_echo_discoveries',
  'player_bag',
  'player_demons',
  'player_world_boss_buffs',
  'player_world_soul_font_buffs',
  'player_anomaly_rituals',
  'player_active_hunts',
  'player_hunt_unlocks',
  'player_bound_world_shrines',
  'player_world_positions',
  'player_stat_points',
  'player_oauth_accounts',
  'player_sessions'
];

async function scheduleAccountDeletion(playerId, connection = db) {
  await connection.query(
    `UPDATE players
     SET deletion_requested_at = CURRENT_TIMESTAMP,
         deletion_scheduled_for = DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${ACCOUNT_DELETION_GRACE_DAYS} DAY)
     WHERE id = ?`,
    [playerId]
  );

  const [rows] = await connection.query(
    'SELECT deletion_requested_at, deletion_scheduled_for FROM players WHERE id = ? LIMIT 1',
    [playerId]
  );
  return rows[0] || null;
}

async function cancelAccountDeletion(playerId, connection = db) {
  const [result] = await connection.query(
    `UPDATE players
     SET deletion_requested_at = NULL,
         deletion_scheduled_for = NULL
     WHERE id = ?
       AND deletion_scheduled_for > CURRENT_TIMESTAMP`,
    [playerId]
  );
  return result.affectedRows > 0;
}

async function purgePlayerAccount(playerId, connection = db) {
  const ownsConnection = connection === db;
  const activeConnection = ownsConnection ? await db.getConnection() : connection;

  try {
    if (ownsConnection) await activeConnection.beginTransaction();

    await activeConnection.query(
      'DELETE FROM oauth_states WHERE claim_player_id = ? OR link_player_id = ?',
      [playerId, playerId]
    );
    await activeConnection.query(
      'DELETE FROM pending_account_merges WHERE target_player_id = ? OR source_player_id = ?',
      [playerId, playerId]
    );

    for (const tableName of PLAYER_DATA_TABLES) {
      await activeConnection.query(`DELETE FROM \`${tableName}\` WHERE player_id = ?`, [playerId]);
    }

    await activeConnection.query('DELETE FROM players WHERE id = ?', [playerId]);
    if (ownsConnection) await activeConnection.commit();
  } catch (error) {
    if (ownsConnection) await activeConnection.rollback();
    throw error;
  } finally {
    if (ownsConnection) activeConnection.release();
  }
}

async function purgeDueAccounts() {
  const [rows] = await db.query(
    `SELECT id
     FROM players
     WHERE deletion_scheduled_for IS NOT NULL
       AND deletion_scheduled_for <= CURRENT_TIMESTAMP`
  );

  for (const row of rows) {
    await purgePlayerAccount(row.id);
  }

  return rows.length;
}

function isDeletionDue(value, now = Date.now()) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= now;
}

module.exports = {
  ACCOUNT_DELETION_GRACE_DAYS,
  cancelAccountDeletion,
  isDeletionDue,
  purgeDueAccounts,
  purgePlayerAccount,
  scheduleAccountDeletion
};
