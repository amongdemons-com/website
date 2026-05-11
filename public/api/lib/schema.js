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
      unlocks LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await addColumnIfMissing('players', 'password_salt', '`password_salt` VARCHAR(64) NOT NULL DEFAULT ""');
  await addColumnIfMissing('players', 'unlocks', '`unlocks` LONGTEXT NULL');

  await db.query(`
    CREATE TABLE IF NOT EXISTS player_sessions (
      token VARCHAR(96) NOT NULL PRIMARY KEY,
      player_id VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NULL,
      INDEX idx_player_sessions_player_id (player_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

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
}

module.exports = { initializeSchema };
