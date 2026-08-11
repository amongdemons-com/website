const db = require('./db');
const { getMinimumStats } = require('./demon-factory');
const { getDemonTypes } = require('./game-data');
const { backfillPlayerBadgeForOAuthProvider } = require('./player-badges');
const { MAX_ACCOUNT_LEVEL } = require('./progression');

const MINIMUM_PLAYER_DEMON_STATS_MIGRATION = '20260711_minimum_player_demon_stats_v1';
const BASELINE_SCHEMA_MIGRATION = '20260722_baseline_schema_v1';
const PERFORMANCE_INDEXES_MIGRATION = '20260722_performance_indexes_v3';
const WORLD_MERCHANT_SCHEMA_MIGRATION = '20260723_world_merchant_schema_v1';
const WORLD_MERCHANT_BRIBE_SCHEMA_MIGRATION = '20260723_world_merchant_bribe_schema_v1';
const WORLD_SOUL_FONT_SCHEMA_MIGRATION = '20260802_world_soul_font_schema_v1';
const WORLD_ANOMALY_SCHEMA_MIGRATION = '20260810_world_anomaly_schema_v1';
const RANKED_SCHEMA_MIGRATION = '20260728_ranked_schema_v2';
const DUNGEON_RANKED_SCHEMA_MIGRATION = '20260808_dungeon_ranked_schema_v1';
const RANKED_FRESH_START_MIGRATION = '20260808_ranked_fresh_start_v1';
const ACCOUNT_SECURITY_SCHEMA_MIGRATION = '20260728_account_security_schema_v1';
const ACCOUNT_PASSWORD_BACKFILL_MIGRATION = '20260728_account_password_backfill_v1';
const PLAYER_BADGES_SCHEMA_MIGRATION = '20260801_player_badges_schema_v1';
const STEAM_PURCHASE_BADGE_BACKFILL_MIGRATION = '20260803_the_night_remembers_steam_backfill_v1';
const ENDED_RUN_REWARDS_CLEANUP_MIGRATION = '20260808_ended_run_rewards_cleanup_v1';
const ACCOUNT_MERGE_SCHEMA_MIGRATION = '20260808_account_merge_schema_v1';
const PLAYER_LEVEL_CAP_MIGRATION = '20260811_player_level_cap_666_v1';
let schemaReadyPromise;

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

async function dropColumnIfPresent(tableName, columnName) {
  const columns = await getColumns(tableName);
  if (columns.has(columnName)) {
    await db.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
  }
}

async function normalizeUtf8Column(tableName, columnName, definition) {
  const columns = await getColumns(tableName);
  if (!columns.has(columnName)) return;

  await db.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${columnName}\` ${definition}`);
}

async function tableExists(tableName) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1',
    [tableName]
  );
  return rows.length > 0;
}

async function renameTableIfPresent(fromTable, toTable) {
  if (await tableExists(fromTable) && !(await tableExists(toTable))) {
    await db.query(`RENAME TABLE \`${fromTable}\` TO \`${toTable}\``);
  }
}

async function addIndexIfMissing(tableName, indexName, definition) {
  const [rows] = await db.query(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`, [indexName]);
  if (!rows.length) {
    await db.query(`ALTER TABLE \`${tableName}\` ADD ${definition}`);
  }
}

async function dropIndexIfPresent(tableName, indexName) {
  const [rows] = await db.query(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`, [indexName]);
  if (rows.length) {
    await db.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
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

async function runMigrationOnce(migrationId, migrate) {
  const [existing] = await db.query('SELECT id FROM schema_migrations WHERE id = ? LIMIT 1', [migrationId]);
  if (existing.length) return false;

  await migrate();
  await db.query('INSERT INTO schema_migrations (id) VALUES (?)', [migrationId]);
  return true;
}

async function normalizePlayerDemonMinimumStats() {
  const types = await getDemonTypes();
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

  for (const [typeId, typeData] of Object.entries(types)) {
    for (const rarity of rarities) {
      const stats = getMinimumStats(typeData, rarity);
      await db.query(
        `UPDATE player_demons
         SET hp = ?, atk = ?, speed = ?
         WHERE type_id = ? AND LOWER(rarity) = ?`,
        [stats.hp, stats.atk, stats.speed, Number(typeId), rarity]
      );
    }
  }
}

async function applyBaselineSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(128) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

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
      pvp_wins INT UNSIGNED NOT NULL DEFAULT 0,
      pvp_losses INT UNSIGNED NOT NULL DEFAULT 0,
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
  await addColumnIfMissing('players', 'pvp_wins', '`pvp_wins` INT UNSIGNED NOT NULL DEFAULT 0');
  await addColumnIfMissing('players', 'pvp_losses', '`pvp_losses` INT UNSIGNED NOT NULL DEFAULT 0');
  await addColumnIfMissing('players', 'profile_demon_id', '`profile_demon_id` INT UNSIGNED NULL');
  await addColumnIfMissing('players', 'is_guest', '`is_guest` TINYINT(1) NOT NULL DEFAULT 0');
  await normalizeUtf8Column('players', 'id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('players', 'email', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
  await addIndexIfMissing('players', 'email', 'UNIQUE INDEX email (email)');
  await addIndexIfMissing('players', 'idx_players_rank_floor', 'INDEX idx_players_rank_floor (highest_floor, level, xp, souls)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_stat_points (
      player_id VARCHAR(255) NOT NULL PRIMARY KEY,
      health_flat INT UNSIGNED NOT NULL DEFAULT 0,
      health_percent INT UNSIGNED NOT NULL DEFAULT 0,
      health_mastery INT UNSIGNED NOT NULL DEFAULT 0,
      healing_percent INT UNSIGNED NOT NULL DEFAULT 0,
      healing_mastery INT UNSIGNED NOT NULL DEFAULT 0,
      thorns_percent INT UNSIGNED NOT NULL DEFAULT 0,
      thorns_mastery INT UNSIGNED NOT NULL DEFAULT 0,
      speed_flat INT UNSIGNED NOT NULL DEFAULT 0,
      speed_percent INT UNSIGNED NOT NULL DEFAULT 0,
      attack_percent INT UNSIGNED NOT NULL DEFAULT 0,
      attack_mastery INT UNSIGNED NOT NULL DEFAULT 0,
      aoe_percent INT UNSIGNED NOT NULL DEFAULT 0,
      aoe_mastery INT UNSIGNED NOT NULL DEFAULT 0,
      poison_flat INT UNSIGNED NOT NULL DEFAULT 0,
      poison_percent INT UNSIGNED NOT NULL DEFAULT 0,
      poison_mastery INT UNSIGNED NOT NULL DEFAULT 0,
      soul_capacity INT UNSIGNED NOT NULL DEFAULT 0,
      soul_capacity_percent INT UNSIGNED NOT NULL DEFAULT 0,
      soul_capacity_mastery INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  const skillTreeColumns = [
    'health_flat',
    'health_percent',
    'health_mastery',
    'healing_percent',
    'healing_mastery',
    'thorns_percent',
    'thorns_mastery',
    'speed_flat',
    'speed_percent',
    'attack_percent',
    'attack_mastery',
    'aoe_percent',
    'aoe_mastery',
    'poison_flat',
    'poison_percent',
    'poison_mastery',
    'soul_capacity',
    'soul_capacity_percent',
    'soul_capacity_mastery'
  ];
  for (const column of skillTreeColumns) {
    await addColumnIfMissing('player_stat_points', column, `\`${column}\` INT UNSIGNED NOT NULL DEFAULT 0`);
  }
  for (const legacyColumn of ['vitality', 'power', 'haste', 'fortitude', 'recovery', 'speed_mastery']) {
    await dropColumnIfPresent('player_stat_points', legacyColumn);
  }
  await normalizeUtf8Column('player_stat_points', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

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
  await addColumnIfMissing('oauth_states', 'claim_player_id', '`claim_player_id` VARCHAR(255) NULL');
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
    CREATE TABLE IF NOT EXISTS player_world_positions (
      player_id VARCHAR(255) NOT NULL PRIMARY KEY,
      x INT NOT NULL DEFAULT 0,
      y INT NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_player_world_positions_xy (x, y)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('player_world_positions', 'x', '`x` INT NOT NULL DEFAULT 0');
  await addColumnIfMissing('player_world_positions', 'y', '`y` INT NOT NULL DEFAULT 0');
  await addColumnIfMissing('player_world_positions', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await normalizeUtf8Column('player_world_positions', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addIndexIfMissing('player_world_positions', 'idx_player_world_positions_xy', 'INDEX idx_player_world_positions_xy (x, y)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_bound_world_shrines (
      player_id VARCHAR(255) NOT NULL PRIMARY KEY,
      x INT NOT NULL,
      y INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_player_bound_world_shrines_xy (x, y)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('player_bound_world_shrines', 'x', '`x` INT NOT NULL DEFAULT 0');
  await addColumnIfMissing('player_bound_world_shrines', 'y', '`y` INT NOT NULL DEFAULT 0');
  await addColumnIfMissing('player_bound_world_shrines', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('player_bound_world_shrines', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await normalizeUtf8Column('player_bound_world_shrines', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addIndexIfMissing('player_bound_world_shrines', 'idx_player_bound_world_shrines_xy', 'INDEX idx_player_bound_world_shrines_xy (x, y)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_hunt_unlocks (
      player_id VARCHAR(255) NOT NULL,
      encounter_id VARCHAR(64) NOT NULL,
      unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, encounter_id),
      INDEX idx_player_hunt_unlocks_encounter (encounter_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column('player_hunt_unlocks', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_hunt_unlocks', 'encounter_id', 'VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_active_hunts (
      player_id VARCHAR(255) NOT NULL PRIMARY KEY,
      encounter_id VARCHAR(64) NOT NULL,
      snapshot LONGTEXT NOT NULL,
      started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      enemy_respawn_seconds INT UNSIGNED NOT NULL DEFAULT 300,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_player_active_hunts_encounter (encounter_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('player_active_hunts', 'snapshot', '`snapshot` LONGTEXT NULL');
  await addColumnIfMissing('player_active_hunts', 'started_at', '`started_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('player_active_hunts', 'enemy_respawn_seconds', '`enemy_respawn_seconds` INT UNSIGNED NOT NULL DEFAULT 300');
  await addColumnIfMissing('player_active_hunts', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await normalizeUtf8Column('player_active_hunts', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_active_hunts', 'encounter_id', 'VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_world_boss_buffs (
      player_id VARCHAR(255) NOT NULL,
      boss_id VARCHAR(96) NOT NULL,
      awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      PRIMARY KEY (player_id, boss_id),
      INDEX idx_player_world_boss_buffs_expires (expires_at),
      INDEX idx_player_world_boss_buffs_boss (boss_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await addColumnIfMissing('player_world_boss_buffs', 'awarded_at', '`awarded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('player_world_boss_buffs', 'expires_at', '`expires_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await normalizeUtf8Column('player_world_boss_buffs', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_world_boss_buffs', 'boss_id', 'VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addIndexIfMissing('player_world_boss_buffs', 'idx_player_world_boss_buffs_expires', 'INDEX idx_player_world_boss_buffs_expires (expires_at)');
  await addIndexIfMissing('player_world_boss_buffs', 'idx_player_world_boss_buffs_boss', 'INDEX idx_player_world_boss_buffs_boss (boss_id)');

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
  await runMigrationOnce(MINIMUM_PLAYER_DEMON_STATS_MIGRATION, normalizePlayerDemonMinimumStats);

  await renameTableIfPresent('player_inventory', 'player_bag');
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_bag (
      player_id VARCHAR(255) NOT NULL,
      item_key VARCHAR(96) NOT NULL,
      item_type VARCHAR(24) NOT NULL,
      quantity INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, item_key),
      INDEX idx_player_bag_type (player_id, item_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column('player_bag', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_bag', 'item_key', 'VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_bag', 'item_type', 'VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await dropIndexIfPresent('player_bag', 'idx_player_inventory_type');
  await addIndexIfMissing('player_bag', 'idx_player_bag_type', 'INDEX idx_player_bag_type (player_id, item_type)');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_echo_discoveries (
      player_id VARCHAR(255) NOT NULL,
      type_id INT UNSIGNED NOT NULL,
      rarity VARCHAR(24) NOT NULL,
      discovered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, type_id, rarity),
      INDEX idx_player_echo_discoveries_player (player_id, discovered_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column('player_echo_discoveries', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_echo_discoveries', 'rarity', 'VARCHAR(24) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addIndexIfMissing('player_echo_discoveries', 'idx_player_echo_discoveries_player', 'INDEX idx_player_echo_discoveries_player (player_id, discovered_at)');
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_world_teams (
      player_id VARCHAR(255) NOT NULL,
      demon_id INT UNSIGNED NOT NULL,
      formation_slot TINYINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, formation_slot),
      INDEX idx_player_world_teams_demon_id (demon_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  // The world team allows the same collection demon in multiple slots, so the
  // primary key is per-slot rather than per-demon. Migrate tables created with
  // the old (player_id, demon_id) key; the legacy unique slot index becomes
  // redundant once the slot is the primary key.
  const [worldTeamDemonPkRows] = await db.query(
    "SHOW INDEX FROM player_world_teams WHERE Key_name = 'PRIMARY' AND Column_name = 'demon_id'"
  );
  if (worldTeamDemonPkRows.length) {
    await db.query(
      'ALTER TABLE player_world_teams DROP PRIMARY KEY, ADD PRIMARY KEY (player_id, formation_slot)'
    );
  }
  await dropIndexIfPresent('player_world_teams', 'uniq_player_world_teams_slot');
  await addColumnIfMissing('player_world_teams', 'demon_id', '`demon_id` INT UNSIGNED NOT NULL');
  await addColumnIfMissing('player_world_teams', 'formation_slot', '`formation_slot` TINYINT UNSIGNED NOT NULL DEFAULT 0');
  await addColumnIfMissing('player_world_teams', 'created_at', '`created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await addColumnIfMissing('player_world_teams', 'updated_at', '`updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await normalizeUtf8Column('player_world_teams', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await addIndexIfMissing('player_world_teams', 'idx_player_world_teams_demon_id', 'INDEX idx_player_world_teams_demon_id (demon_id)');

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
      pvp_wins INT UNSIGNED NOT NULL DEFAULT 0,
      hunts_started INT UNSIGNED NOT NULL DEFAULT 0,
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
  await addColumnIfMissing('player_daily_quests', 'pvp_wins', '`pvp_wins` INT UNSIGNED NOT NULL DEFAULT 0');
  await addColumnIfMissing('player_daily_quests', 'hunts_started', '`hunts_started` INT UNSIGNED NOT NULL DEFAULT 0');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_achievements (
      player_id VARCHAR(255) NOT NULL,
      achievement_id VARCHAR(64) NOT NULL,
      unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      steam_synced_at TIMESTAMP NULL,
      PRIMARY KEY (player_id, achievement_id),
      INDEX idx_player_achievements_unsynced (player_id, steam_synced_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column('player_achievements', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_achievements', 'achievement_id', 'VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');

  // Lifetime training attempt counter per collection demon (Relentless achievement).
  await addColumnIfMissing('player_demons', 'times_trained', '`times_trained` INT UNSIGNED NOT NULL DEFAULT 0');

  await backfillHighestFloors();
}

async function addPerformanceIndexes() {
  // The composite index covers every player_id-only lookup too, so the old
  // single-column index only duplicates writes and can mislead the optimizer.
  await dropIndexIfPresent('runs', 'idx_runs_player_id');
  await addIndexIfMissing(
    'runs',
    'idx_runs_player_status_updated',
    'INDEX idx_runs_player_status_updated (player_id, status, updated_at DESC, created_at DESC)'
  );
  await dropIndexIfPresent('players', 'idx_players_rank_level');
  await addIndexIfMissing(
    'players',
    'idx_players_rank_level',
    'INDEX idx_players_rank_level (level, xp, highest_floor, souls)'
  );
  await dropIndexIfPresent('players', 'idx_players_rank_pvp');
  await addIndexIfMissing(
    'players',
    'idx_players_rank_pvp',
    'INDEX idx_players_rank_pvp (pvp_wins DESC, pvp_losses ASC, level DESC, xp DESC, highest_floor DESC, souls DESC)'
  );
  await addIndexIfMissing(
    'players',
    'idx_players_rank_xp',
    'INDEX idx_players_rank_xp (xp, level, highest_floor, souls)'
  );
  await addIndexIfMissing(
    'players',
    'idx_players_rank_souls',
    'INDEX idx_players_rank_souls (souls, highest_floor, level, xp)'
  );
}

async function addWorldMerchantSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_world_merchant_purchases (
      player_id VARCHAR(255) NOT NULL,
      spawn_id BIGINT UNSIGNED NOT NULL,
      slot TINYINT UNSIGNED NOT NULL,
      item_key VARCHAR(96) NOT NULL,
      price INT UNSIGNED NOT NULL,
      purchased_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, spawn_id, slot),
      INDEX idx_world_merchant_purchases_spawn (spawn_id, purchased_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column(
    'player_world_merchant_purchases',
    'player_id',
    'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
  await normalizeUtf8Column(
    'player_world_merchant_purchases',
    'item_key',
    'VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
  await addIndexIfMissing(
    'player_world_merchant_purchases',
    'idx_world_merchant_purchases_spawn',
    'INDEX idx_world_merchant_purchases_spawn (spawn_id, purchased_at)'
  );
}

async function addWorldMerchantBribeSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_world_merchant_stock (
      player_id VARCHAR(255) NOT NULL,
      spawn_id BIGINT UNSIGNED NOT NULL,
      reroll_count INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id),
      INDEX idx_world_merchant_stock_spawn (spawn_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column(
    'player_world_merchant_stock',
    'player_id',
    'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
  await addIndexIfMissing(
    'player_world_merchant_stock',
    'idx_world_merchant_stock_spawn',
    'INDEX idx_world_merchant_stock_spawn (spawn_id, updated_at)'
  );
}

async function addRankedSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ranked_seasons (
      id VARCHAR(48) NOT NULL PRIMARY KEY,
      name VARCHAR(96) NOT NULL,
      starts_at TIMESTAMP NOT NULL,
      ends_at TIMESTAMP NOT NULL,
      rules_version VARCHAR(48) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ranked_seasons_window (starts_at, ends_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ranked_ratings (
      player_id VARCHAR(255) NOT NULL,
      season_id VARCHAR(48) NOT NULL,
      rating INT NOT NULL DEFAULT 1000,
      highest_floor INT UNSIGNED NOT NULL DEFAULT 0,
      victories INT UNSIGNED NOT NULL DEFAULT 0,
      runs_played INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, season_id),
      INDEX idx_ranked_ratings_season_rating (season_id, rating DESC, highest_floor DESC)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ranked_runs (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      season_id VARCHAR(48) NOT NULL,
      seed INT UNSIGNED NOT NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      floor INT UNSIGNED NOT NULL DEFAULT 1,
      lives TINYINT UNSIGNED NOT NULL DEFAULT 3,
      rating_start INT NOT NULL DEFAULT 1000,
      rating_delta INT NOT NULL DEFAULT 0,
      state LONGTEXT NOT NULL,
      locked_bonuses LONGTEXT NOT NULL,
      rules_version VARCHAR(48) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      ended_at TIMESTAMP NULL,
      INDEX idx_ranked_runs_player_status (player_id, status, updated_at DESC),
      INDEX idx_ranked_runs_season_floor (season_id, floor, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ranked_opponent_snapshots (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      season_id VARCHAR(48) NOT NULL,
      floor INT UNSIGNED NOT NULL,
      rating INT NOT NULL,
      hunter_name VARCHAR(64) NOT NULL,
      snapshot LONGTEXT NOT NULL,
      combat_version VARCHAR(48) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ranked_snapshots_match (season_id, floor, rating, created_at),
      INDEX idx_ranked_snapshots_player (player_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ranked_generated_opponents (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      season_id VARCHAR(48) NOT NULL,
      floor INT UNSIGNED NOT NULL,
      rating_bracket INT NOT NULL,
      variant TINYINT UNSIGNED NOT NULL,
      snapshot LONGTEXT NOT NULL,
      combat_version VARCHAR(48) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE INDEX uniq_ranked_generated_variant (season_id, floor, rating_bracket, variant),
      INDEX idx_ranked_generated_floor (season_id, floor, rating_bracket)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ranked_opponent_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      season_id VARCHAR(48) NOT NULL,
      opponent_key VARCHAR(48) NOT NULL,
      floor INT UNSIGNED NOT NULL,
      served_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_ranked_history_player_floor (player_id, season_id, floor, served_at),
      INDEX idx_ranked_history_opponent (opponent_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ranked_action_receipts (
      player_id VARCHAR(255) NOT NULL,
      action_id VARCHAR(64) NOT NULL,
      run_id VARCHAR(36) NULL,
      action_type VARCHAR(32) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, action_id),
      INDEX idx_ranked_action_run (run_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  for (const [table, columns] of Object.entries({
    ranked_seasons: ['id'],
    ranked_ratings: ['player_id', 'season_id'],
    ranked_runs: ['player_id', 'season_id'],
    ranked_opponent_snapshots: ['player_id', 'season_id'],
    ranked_generated_opponents: ['season_id'],
    ranked_opponent_history: ['player_id', 'season_id'],
    ranked_action_receipts: ['player_id']
  })) {
    for (const column of columns) {
      const length = column === 'player_id' ? 255 : 48;
      await normalizeUtf8Column(
        table,
        column,
        `VARCHAR(${length}) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL`
      );
    }
  }
}

async function addDungeonRankedSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS dungeon_ranked_snapshots (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      season_id VARCHAR(48) NOT NULL,
      source_run_id VARCHAR(48) NOT NULL,
      floor INT UNSIGNED NOT NULL,
      player_level INT UNSIGNED NOT NULL,
      rating INT NOT NULL DEFAULT 1000,
      hunter_name VARCHAR(64) NOT NULL,
      snapshot LONGTEXT NOT NULL,
      combat_version VARCHAR(48) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dungeon_ranked_match (season_id, floor, player_level, created_at),
      INDEX idx_dungeon_ranked_player (player_id, floor, created_at),
      INDEX idx_dungeon_ranked_run (source_run_id, floor)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dungeon_ranked_history (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      season_id VARCHAR(48) NOT NULL,
      snapshot_id VARCHAR(36) NOT NULL,
      opponent_player_id VARCHAR(255) NOT NULL,
      floor INT UNSIGNED NOT NULL,
      served_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_dungeon_ranked_history_player (player_id, season_id, floor, served_at),
      INDEX idx_dungeon_ranked_history_snapshot (snapshot_id),
      INDEX idx_dungeon_ranked_history_opponent (opponent_player_id, served_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  for (const [table, columns] of Object.entries({
    dungeon_ranked_snapshots: ['player_id', 'season_id', 'source_run_id'],
    dungeon_ranked_history: ['player_id', 'season_id', 'opponent_player_id']
  })) {
    for (const column of columns) {
      const length = column === 'player_id' || column === 'opponent_player_id' ? 255 : 48;
      await normalizeUtf8Column(
        table,
        column,
        `VARCHAR(${length}) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL`
      );
    }
  }
}

async function resetRankedForDungeonFreshStart() {
  for (const table of [
    'dungeon_ranked_history',
    'dungeon_ranked_snapshots',
    'ranked_action_receipts',
    'ranked_opponent_history',
    'ranked_opponent_snapshots',
    'ranked_generated_opponents',
    'ranked_runs',
    'ranked_ratings'
  ]) {
    await db.query(`DELETE FROM ${table}`);
  }
}

async function addWorldSoulFontSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_world_soul_font_buffs (
      player_id VARCHAR(255) NOT NULL,
      buff_id VARCHAR(96) NOT NULL,
      offer_set_id VARCHAR(96) NOT NULL,
      price INT UNSIGNED NOT NULL,
      awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      PRIMARY KEY (player_id),
      INDEX idx_world_soul_font_buffs_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column(
    'player_world_soul_font_buffs',
    'player_id',
    'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
  await normalizeUtf8Column(
    'player_world_soul_font_buffs',
    'buff_id',
    'VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
  await normalizeUtf8Column(
    'player_world_soul_font_buffs',
    'offer_set_id',
    'VARCHAR(96) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
  await addIndexIfMissing(
    'player_world_soul_font_buffs',
    'idx_world_soul_font_buffs_expires',
    'INDEX idx_world_soul_font_buffs_expires (expires_at)'
  );
}

async function addWorldAnomalySchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_anomaly_rituals (
      player_id VARCHAR(255) NOT NULL PRIMARY KEY,
      voice_shards TINYINT UNSIGNED NOT NULL DEFAULT 0,
      attempts INT UNSIGNED NOT NULL DEFAULT 0,
      victories INT UNSIGNED NOT NULL DEFAULT 0,
      last_ritual_id VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column('player_anomaly_rituals', 'player_id', 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL');
  await normalizeUtf8Column('player_anomaly_rituals', 'last_ritual_id', 'VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL');
}

async function addPlayerBadgesSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS player_badges (
      player_id VARCHAR(255) NOT NULL,
      badge_key VARCHAR(48) NOT NULL,
      awarded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (player_id, badge_key),
      INDEX idx_player_badges_key (badge_key, awarded_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  await normalizeUtf8Column(
    'player_badges',
    'player_id',
    'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
  await normalizeUtf8Column(
    'player_badges',
    'badge_key',
    'VARCHAR(48) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );
}

async function addAccountMergeSchema() {
  await addColumnIfMissing(
    'player_sessions',
    'auth_provider',
    '`auth_provider` VARCHAR(32) NOT NULL DEFAULT "web"'
  );
  await normalizeUtf8Column(
    'player_sessions',
    'auth_provider',
    'VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT "web"'
  );
  await addColumnIfMissing(
    'oauth_states',
    'auth_provider',
    '`auth_provider` VARCHAR(32) NOT NULL DEFAULT "web"'
  );
  await normalizeUtf8Column(
    'oauth_states',
    'auth_provider',
    'VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT "web"'
  );

  await db.query(`
    CREATE TABLE IF NOT EXISTS pending_account_merges (
      token VARCHAR(96) NOT NULL PRIMARY KEY,
      target_player_id VARCHAR(255) NOT NULL,
      source_player_id VARCHAR(255) NOT NULL,
      provider VARCHAR(32) NOT NULL,
      provider_user_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      completed_at TIMESTAMP NULL,
      INDEX idx_pending_account_merges_target (target_player_id, expires_at),
      INDEX idx_pending_account_merges_source (source_player_id, expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
  for (const column of ['target_player_id', 'source_player_id', 'provider_user_id']) {
    await normalizeUtf8Column(
      'pending_account_merges',
      column,
      'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
    );
  }
  await normalizeUtf8Column(
    'pending_account_merges',
    'provider',
    'VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL'
  );

  // A merge can temporarily carry different active Whispering Well buffs.
  // Store them independently so distinct buffs survive and duplicate buffs
  // can be resolved by their later expiry time.
  const [primaryRows] = await db.query(
    "SHOW INDEX FROM player_world_soul_font_buffs WHERE Key_name = 'PRIMARY'"
  );
  const primaryColumns = primaryRows
    .sort((left, right) => Number(left.Seq_in_index) - Number(right.Seq_in_index))
    .map((row) => row.Column_name);
  if (primaryColumns.length === 1 && primaryColumns[0] === 'player_id') {
    await db.query(
      'ALTER TABLE player_world_soul_font_buffs DROP PRIMARY KEY, ADD PRIMARY KEY (player_id, buff_id)'
    );
  }
}

async function clearEndedRunRewardHistory() {
  await db.query("UPDATE runs SET rewards = '[]' WHERE status = 'ended' AND rewards <> '[]'");
}

async function backfillSteamPurchaseBadge() {
  await backfillPlayerBadgeForOAuthProvider('the_night_remembers', 'steam');
}

async function addAccountSecuritySchema() {
  await addColumnIfMissing(
    'players',
    'password_login_enabled',
    '`password_login_enabled` TINYINT(1) NOT NULL DEFAULT 1'
  );
  await addColumnIfMissing(
    'players',
    'deletion_requested_at',
    '`deletion_requested_at` TIMESTAMP NULL'
  );
  await addColumnIfMissing(
    'players',
    'deletion_scheduled_for',
    '`deletion_scheduled_for` TIMESTAMP NULL'
  );
  await addColumnIfMissing(
    'oauth_states',
    'link_player_id',
    '`link_player_id` VARCHAR(255) NULL'
  );
  await normalizeUtf8Column(
    'oauth_states',
    'link_player_id',
    'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL'
  );
  await addIndexIfMissing(
    'players',
    'idx_players_deletion_scheduled',
    'INDEX idx_players_deletion_scheduled (deletion_scheduled_for)'
  );

  // Guest credentials and future OAuth-only credentials are deliberately
  // unusable. Existing password accounts retain the default enabled value.
  await db.query('UPDATE players SET password_login_enabled = 0 WHERE is_guest = 1');
}

async function backfillOAuthOnlyPasswordState() {
  // OAuth-created players receive an unusable random password before their
  // provider identity is inserted in the same transaction. The matching
  // creation timestamp distinguishes those rows from accounts that connected
  // a provider later and already have a working password.
  await db.query(`
    UPDATE players p
    INNER JOIN (
      SELECT player_id, MIN(created_at) AS first_link_at
      FROM player_oauth_accounts
      GROUP BY player_id
    ) first_oauth
      ON first_oauth.player_id = p.id
    SET p.password_login_enabled = 0
    WHERE first_oauth.first_link_at = p.created_at
  `);
}

async function enforcePlayerLevelCap() {
  await db.query(
    'UPDATE players SET level = ? WHERE level > ?',
    [MAX_ACCOUNT_LEVEL, MAX_ACCOUNT_LEVEL]
  );
}

async function initializeSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(128) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await runMigrationOnce(BASELINE_SCHEMA_MIGRATION, applyBaselineSchema);
  await runMigrationOnce(PERFORMANCE_INDEXES_MIGRATION, addPerformanceIndexes);
  await runMigrationOnce(WORLD_MERCHANT_SCHEMA_MIGRATION, addWorldMerchantSchema);
  await runMigrationOnce(WORLD_MERCHANT_BRIBE_SCHEMA_MIGRATION, addWorldMerchantBribeSchema);
  await runMigrationOnce(WORLD_SOUL_FONT_SCHEMA_MIGRATION, addWorldSoulFontSchema);
  await runMigrationOnce(WORLD_ANOMALY_SCHEMA_MIGRATION, addWorldAnomalySchema);
  await runMigrationOnce(RANKED_SCHEMA_MIGRATION, addRankedSchema);
  await runMigrationOnce(DUNGEON_RANKED_SCHEMA_MIGRATION, addDungeonRankedSchema);
  await runMigrationOnce(RANKED_FRESH_START_MIGRATION, resetRankedForDungeonFreshStart);
  await runMigrationOnce(ACCOUNT_SECURITY_SCHEMA_MIGRATION, addAccountSecuritySchema);
  await runMigrationOnce(ACCOUNT_PASSWORD_BACKFILL_MIGRATION, backfillOAuthOnlyPasswordState);
  await runMigrationOnce(PLAYER_BADGES_SCHEMA_MIGRATION, addPlayerBadgesSchema);
  await runMigrationOnce(STEAM_PURCHASE_BADGE_BACKFILL_MIGRATION, backfillSteamPurchaseBadge);
  await runMigrationOnce(ENDED_RUN_REWARDS_CLEANUP_MIGRATION, clearEndedRunRewardHistory);
  await runMigrationOnce(ACCOUNT_MERGE_SCHEMA_MIGRATION, addAccountMergeSchema);
  await runMigrationOnce(PLAYER_LEVEL_CAP_MIGRATION, enforcePlayerLevelCap);
}

function ensureSchemaReady() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = initializeSchema().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  return schemaReadyPromise;
}

module.exports = { ensureSchemaReady, initializeSchema };
