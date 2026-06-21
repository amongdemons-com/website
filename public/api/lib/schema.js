const db = require('./db');

async function getColumns(tableName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(rows.map((row) => row.Field));
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const columns = await getColumns(tableName);
  if (!columns.has(columnName)) {
    await db.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${definition}`);
  }
}

async function normalizeUtf8Column(tableName, columnName, definition) {
  const columns = await getColumns(tableName);
  if (!columns.has(columnName)) return;

  await db.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${definition}`);
}

async function addIndexIfMissing(tableName, indexName, definition) {
  const [rows] = await db.query(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`, [indexName]);
  if (!rows.length) {
    await db.query(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
  }
}

function getConqueredFloorFromRun(row) {
  const floor = Math.max(0, Number(row.floor) || 0);
  let state = {};

  try {
    state = JSON.parse(row.state || '{}');
  } catch (error) {
    state = {};
  }

  const lastBattleFloor = Math.max(0, Number(state.lastBattle?.floor) || 0);

  if (state.lastBattle?.winner === 'player') return lastBattleFloor || floor;
  if (state.awaitingRecruit) return floor;
  if (state.lastBattle?.winner === 'enemy' || row.status === 'defeated') {
    return Math.max(0, floor - 1);
  }

  return 0;
}

async function backfillHighestFloors() {
  const [rows] = await db.query('SELECT player_id, status, floor, state FROM runs WHERE player_id IS NOT NULL');
  const highestByPlayer = new Map();

  rows.forEach((row) => {
    const conqueredFloor = getConqueredFloorFromRun(row);
    const currentHighest = highestByPlayer.get(row.player_id) || 0;
    if (conqueredFloor > currentHighest) {
      highestByPlayer.set(row.player_id, conqueredFloor);
    }
  });

  for (const [playerId, highestFloor] of highestByPlayer) {
    await db.query(
      'UPDATE players SET highest_floor = GREATEST(highest_floor, ?) WHERE id = ?',
      [highestFloor, playerId]
    );
  }
}

async function dedupePlayerDemonSlots() {
  await db.query(`
    DELETE old_demon FROM player_demons old_demon
    INNER JOIN player_demons newer_demon
      ON newer_demon.player_id = old_demon.player_id
      AND newer_demon.type_id = old_demon.type_id
      AND newer_demon.rarity = old_demon.rarity
      AND (
        newer_demon.created_at > old_demon.created_at
        OR (
          newer_demon.created_at = old_demon.created_at
          AND newer_demon.id > old_demon.id
        )
      )
  `);
}

async function initializeSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS players (
      id VARCHAR(255) NOT NULL PRIMARY KEY,
      username VARCHAR(64) NOT NULL UNIQUE,
      email VARCHAR(100) NULL UNIQUE,
      password_hash VARCHAR(128) NOT NULL,
      password_salt VARCHAR(64) NOT NULL,
      level INT UNSIGNED NOT NULL DEFAULT 1,
      xp INT UNSIGNED NOT NULL DEFAULT 0,
      souls INT UNSIGNED NOT NULL DEFAULT 0,
      highest_floor INT UNSIGNED NOT NULL DEFAULT 0,
      profile_demon_id INT UNSIGNED NULL,
      unlocks LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await addColumnIfMissing('players', 'password_salt', '`password_salt` VARCHAR(64) NOT NULL DEFAULT ""');
  await addColumnIfMissing('players', 'email', '`email` VARCHAR(255) NULL');
  await addColumnIfMissing('players', 'unlocks', '`unlocks` LONGTEXT NULL');
  await addColumnIfMissing('players', 'highest_floor', '`highest_floor` INT UNSIGNED NOT NULL DEFAULT 0');
  await addColumnIfMissing('players', 'profile_demon_id', '`profile_demon_id` INT UNSIGNED NULL');
  await normalizeUtf8Column('players', 'id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('players', 'email', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
  await addIndexIfMissing('players', 'email', 'UNIQUE INDEX email (email)');
  await addIndexIfMissing('players', 'idx_players_rank_floor', 'INDEX idx_players_rank_floor (highest_floor, level, xp, souls)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_oauth_accounts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      provider_user_id VARCHAR(255) NOT NULL,
      email VARCHAR(255) NULL,
      display_name VARCHAR(255) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE INDEX uniq_player_oauth_provider_user (provider, provider_user_id),
      INDEX idx_player_oauth_player_id (player_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('player_oauth_accounts', 'email', '`email` VARCHAR(255) NULL');
  await addColumnIfMissing('player_oauth_accounts', 'display_name', '`display_name` VARCHAR(255) NULL');
  await addColumnIfMissing('player_oauth_accounts', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('player_oauth_accounts', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await normalizeUtf8Column('player_oauth_accounts', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_oauth_accounts', 'provider', 'VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_oauth_accounts', 'provider_user_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_oauth_accounts', 'email', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
  await normalizeUtf8Column('player_oauth_accounts', 'display_name', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
  await addIndexIfMissing(
    'player_oauth_accounts',
    'uniq_player_oauth_provider_user',
    'UNIQUE INDEX uniq_player_oauth_provider_user (provider, provider_user_id)'
  );
  await addIndexIfMissing('player_oauth_accounts', 'idx_player_oauth_player_id', 'INDEX idx_player_oauth_player_id (player_id)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS oauth_states (
      state VARCHAR(96) NOT NULL PRIMARY KEY,
      provider VARCHAR(32) NOT NULL,
      mode VARCHAR(16) NOT NULL,
      redirect_path VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      INDEX idx_oauth_states_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('oauth_states', 'mode', '`mode` VARCHAR(16) NOT NULL DEFAULT "login"');
  await addColumnIfMissing('oauth_states', 'redirect_path', '`redirect_path` VARCHAR(255) NOT NULL DEFAULT "/camp"');
  await addColumnIfMissing('oauth_states', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('oauth_states', 'expires_at', '`expires_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('oauth_states', 'used_at', '`used_at` TIMESTAMP NULL');
  await normalizeUtf8Column('oauth_states', 'state', 'VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('oauth_states', 'provider', 'VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('oauth_states', 'mode', 'VARCHAR(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('oauth_states', 'redirect_path', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addIndexIfMissing('oauth_states', 'idx_oauth_states_expires_at', 'INDEX idx_oauth_states_expires_at (expires_at)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_sessions (
      token VARCHAR(96) NOT NULL PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL,
      INDEX idx_player_sessions_player_id (player_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('player_sessions', 'expires_at', '`expires_at` TIMESTAMP NULL');
  await normalizeUtf8Column('player_sessions', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_demons (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      source_demon_id INT UNSIGNED NOT NULL,
      type_id INT UNSIGNED NOT NULL,
      species VARCHAR(80) NOT NULL,
      rarity VARCHAR(24) NOT NULL,
      image_url VARCHAR(255) NOT NULL,
      hp INT UNSIGNED NOT NULL,
      atk INT UNSIGNED NOT NULL,
      speed INT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_player_demons_player_id (player_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column('player_demons', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await dedupePlayerDemonSlots();
  await addIndexIfMissing(
    'player_demons',
    'uniq_player_demons_slot',
    'UNIQUE INDEX uniq_player_demons_slot (player_id, type_id, rarity)'
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS runs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      seed INT UNSIGNED NOT NULL,
      status VARCHAR(24) NOT NULL,
      floor INT UNSIGNED NOT NULL DEFAULT 1,
      state LONGTEXT NOT NULL,
      rewards LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ended_at TIMESTAMP NULL,
      INDEX idx_runs_player_id (player_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('runs', 'player_id', '`player_id` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
  const runColumns = await getColumns('runs');
  if (runColumns.has('playerId')) {
    await db.query('UPDATE `runs` SET `player_id` = `playerId` WHERE `player_id` IS NULL AND `playerId` IS NOT NULL');
  }
  await addColumnIfMissing('runs', 'status', '`status` VARCHAR(24) NOT NULL DEFAULT "active"');
  await addColumnIfMissing('runs', 'state', '`state` LONGTEXT NULL');
  await addColumnIfMissing('runs', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('runs', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addColumnIfMissing('runs', 'ended_at', '`ended_at` TIMESTAMP NULL');
  await normalizeUtf8Column('runs', 'playerId', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
  await normalizeUtf8Column('runs', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addIndexIfMissing('runs', 'idx_runs_player_id', 'INDEX idx_runs_player_id (player_id)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_daily_quests (
      player_id VARCHAR(255) NOT NULL,
      quest_date DATE NOT NULL,
      dungeon_wins INT UNSIGNED NOT NULL DEFAULT 0,
      demons_extracted INT UNSIGNED NOT NULL DEFAULT 0,
      undermanned_wins INT UNSIGNED NOT NULL DEFAULT 0,
      highest_floor INT UNSIGNED NOT NULL DEFAULT 0,
      claimed_quests LONGTEXT NOT NULL,
      daily_reward_claimed TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, quest_date),
      INDEX idx_player_daily_quests_date (quest_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column('player_daily_quests', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addColumnIfMissing('player_daily_quests', 'undermanned_wins', '`undermanned_wins` INT UNSIGNED NOT NULL DEFAULT 0');
  await backfillHighestFloors();
}

module.exports = { initializeSchema };
