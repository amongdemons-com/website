const db = require('../public/api/lib/db');
const { saveCollectionDemon } = require('../public/api/lib/collection-demons');
const { createDemon } = require('../public/api/lib/demon-factory');
const { createRng } = require('../public/api/lib/rng');
const { STARTER_RARITY, STARTER_TYPE_IDS } = require('../public/api/lib/starter-demon');

const FLOOR_DELETE_THRESHOLD = 2;
const APPLY_FLAG = '--apply';

const AUTH_TABLES = [
  'player_oauth_accounts',
  'player_sessions'
];

const PROGRESS_TABLES = [
  'player_achievements',
  'player_active_hunts',
  'player_bound_world_shrines',
  'player_daily_quests',
  'player_demons',
  'player_echo_discoveries',
  'player_hunt_unlocks',
  'player_bag',
  'player_stat_points',
  'player_world_boss_buffs',
  'player_world_merchant_purchases',
  'player_world_merchant_stock',
  'player_world_positions',
  'player_world_teams'
];

const GLOBAL_CLEANUP_TABLES = [
  'oauth_states',
  'runs'
];

const EXPECTED_PLAYER_ID_TABLES = new Set([
  ...AUTH_TABLES,
  ...PROGRESS_TABLES,
  'runs'
]);

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const connection = await db.getConnection();

  try {
    await assertSchemaMatchesResetPlan(connection);
    const summary = await getResetSummary(connection);
    printSummary(summary, apply);

    if (!apply) return;

    await applyReset(connection, summary);
    const verification = await verifyReset(connection, summary.retainedPlayers);
    printVerification(verification);
  } finally {
    connection.release();
    await db.end();
  }
}

async function assertSchemaMatchesResetPlan(connection) {
  const [rows] = await connection.query(
    `SELECT DISTINCT TABLE_NAME AS tableName
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND COLUMN_NAME = 'player_id'
     ORDER BY TABLE_NAME`
  );
  const actual = new Set(rows.map((row) => row.tableName));
  const unknown = [...actual].filter((tableName) => !EXPECTED_PLAYER_ID_TABLES.has(tableName));
  const missing = [...EXPECTED_PLAYER_ID_TABLES].filter((tableName) => !actual.has(tableName));

  if (unknown.length || missing.length) {
    throw new Error(
      `Live schema does not match the reviewed reset plan. ` +
      `Unknown player tables: ${unknown.join(', ') || 'none'}. ` +
      `Missing player tables: ${missing.join(', ') || 'none'}.`
    );
  }
}

async function getResetSummary(connection) {
  const [[target]] = await connection.query(
    'SELECT DATABASE() AS databaseName, @@hostname AS serverName'
  );
  const [[playerCounts]] = await connection.query(
    `SELECT COUNT(*) AS totalPlayers,
            SUM(highest_floor <= ?) AS deletedPlayers,
            SUM(highest_floor > ?) AS retainedPlayers
     FROM players`,
    [FLOOR_DELETE_THRESHOLD, FLOOR_DELETE_THRESHOLD]
  );
  const tableRows = {};

  for (const tableName of [...PROGRESS_TABLES, ...GLOBAL_CLEANUP_TABLES]) {
    const [[row]] = await connection.query(`SELECT COUNT(*) AS rowCount FROM \`${tableName}\``);
    tableRows[tableName] = Number(row.rowCount) || 0;
  }

  const authRowsDeleted = {};
  const authRowsRetained = {};
  for (const tableName of AUTH_TABLES) {
    const [[row]] = await connection.query(
      `SELECT SUM(p.id IS NULL OR p.highest_floor <= ?) AS deletedRows,
              SUM(p.id IS NOT NULL AND p.highest_floor > ?) AS retainedRows
       FROM \`${tableName}\` linked
       LEFT JOIN players p ON p.id = linked.player_id`,
      [FLOOR_DELETE_THRESHOLD, FLOOR_DELETE_THRESHOLD]
    );
    authRowsDeleted[tableName] = Number(row.deletedRows) || 0;
    authRowsRetained[tableName] = Number(row.retainedRows) || 0;
  }

  const starters = [];
  for (const typeId of STARTER_TYPE_IDS) {
    starters.push(await createDemon(createRng(0x51a7e2 ^ typeId), {
      typeId,
      rarity: STARTER_RARITY
    }));
  }

  return {
    databaseName: target.databaseName,
    serverName: target.serverName,
    totalPlayers: Number(playerCounts.totalPlayers) || 0,
    deletedPlayers: Number(playerCounts.deletedPlayers) || 0,
    retainedPlayers: Number(playerCounts.retainedPlayers) || 0,
    tableRows,
    authRowsDeleted,
    authRowsRetained,
    starters
  };
}

function printSummary(summary, apply) {
  const mode = apply ? 'APPLY' : 'DRY RUN';
  console.log(`${mode}: ${summary.databaseName} on ${summary.serverName}`);
  console.log(
    `Players: delete ${summary.deletedPlayers} at floor <= ${FLOOR_DELETE_THRESHOLD}; ` +
    `reset and retain ${summary.retainedPlayers}; total ${summary.totalPlayers}.`
  );
  for (const starter of summary.starters) {
    console.log(
      `Starter: one ${starter.rarity} ${starter.species} ` +
      `(type ${starter.typeId}) per retained player.`
    );
  }
  console.log('Gameplay/global rows cleared:');
  for (const [tableName, rowCount] of Object.entries(summary.tableRows)) {
    console.log(`  ${tableName}: ${rowCount}`);
  }
  console.log('Authentication rows removed / retained:');
  for (const tableName of AUTH_TABLES) {
    console.log(
      `  ${tableName}: remove ${summary.authRowsDeleted[tableName]}, ` +
      `retain ${summary.authRowsRetained[tableName]}`
    );
  }
  if (!apply) console.log(`No changes made. Re-run with ${APPLY_FLAG} to commit this reset.`);
}

async function applyReset(connection, summary) {
  await connection.beginTransaction();

  try {
    const [lockedPlayers] = await connection.query(
      'SELECT id, highest_floor AS highestFloor FROM players ORDER BY id FOR UPDATE'
    );
    const survivorIds = lockedPlayers
      .filter((player) => Number(player.highestFloor) > FLOOR_DELETE_THRESHOLD)
      .map((player) => player.id);

    if (lockedPlayers.length !== summary.totalPlayers || survivorIds.length !== summary.retainedPlayers) {
      throw new Error('Player data changed after the dry-run summary; reset aborted without changes.');
    }

    for (const tableName of [...PROGRESS_TABLES, ...GLOBAL_CLEANUP_TABLES]) {
      await connection.query(`DELETE FROM \`${tableName}\``);
    }

    for (const tableName of AUTH_TABLES) {
      await connection.query(
        `DELETE linked
         FROM \`${tableName}\` linked
         LEFT JOIN players p ON p.id = linked.player_id
         WHERE p.id IS NULL OR p.highest_floor <= ?`,
        [FLOOR_DELETE_THRESHOLD]
      );
    }

    await connection.query(
      'DELETE FROM players WHERE highest_floor <= ?',
      [FLOOR_DELETE_THRESHOLD]
    );

    await connection.query(
      `UPDATE players
       SET level = 1,
           xp = 0,
           souls = 0,
           highest_floor = 0,
           pvp_wins = 0,
           pvp_losses = 0,
           profile_demon_id = NULL,
           unlocks = '[]'`
    );

    for (const playerId of survivorIds) {
      for (const starter of summary.starters) {
        await saveCollectionDemon(playerId, starter, connection);
      }
      await connection.query(
        'INSERT INTO player_world_positions (player_id, x, y) VALUES (?, 0, 0)',
        [playerId]
      );
      await connection.query(
        'INSERT INTO player_bound_world_shrines (player_id, x, y) VALUES (?, 0, 0)',
        [playerId]
      );
    }

    await assertResetInvariants(connection, summary.retainedPlayers);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function assertResetInvariants(connection, expectedPlayers) {
  const verification = await verifyReset(connection, expectedPlayers);
  const failures = Object.entries(verification)
    .filter(([, value]) => value !== 0)
    .map(([name, value]) => `${name}=${value}`);

  if (failures.length) {
    throw new Error(`Reset verification failed; transaction rolled back: ${failures.join(', ')}`);
  }
}

async function verifyReset(connection, expectedPlayers) {
  const checks = {
    wrongPlayerCount: ['SELECT ABS(COUNT(*) - ?) AS failures FROM players', [expectedPlayers]],
    wrongPlayerProgress: [
      `SELECT COUNT(*) AS failures
       FROM players
       WHERE level <> 1 OR xp <> 0 OR souls <> 0 OR highest_floor <> 0
          OR pvp_wins <> 0 OR pvp_losses <> 0 OR profile_demon_id IS NOT NULL
          OR unlocks <> '[]'`,
      []
    ],
    wrongStarterRoster: [
      `SELECT COUNT(*) AS failures
       FROM players p
       LEFT JOIN (
         SELECT player_id,
                COUNT(*) AS demonCount,
                SUM(rarity = ? AND times_trained = 0
                    AND type_id IN (${STARTER_TYPE_IDS.map(() => '?').join(', ')})) AS starterCount,
                COUNT(DISTINCT type_id) AS starterTypeCount
         FROM player_demons
         GROUP BY player_id
       ) roster ON roster.player_id = p.id
       WHERE COALESCE(roster.demonCount, 0) <> ${STARTER_TYPE_IDS.length}
          OR COALESCE(roster.starterCount, 0) <> ${STARTER_TYPE_IDS.length}
          OR COALESCE(roster.starterTypeCount, 0) <> ${STARTER_TYPE_IDS.length}`,
      [STARTER_RARITY, ...STARTER_TYPE_IDS]
    ],
    wrongWorldPosition: [
      `SELECT COUNT(*) AS failures
       FROM players p
       LEFT JOIN player_world_positions position ON position.player_id = p.id
       WHERE position.player_id IS NULL OR position.x <> 0 OR position.y <> 0`,
      []
    ],
    wrongBoundShrine: [
      `SELECT COUNT(*) AS failures
       FROM players p
       LEFT JOIN player_bound_world_shrines shrine ON shrine.player_id = p.id
       WHERE shrine.player_id IS NULL OR shrine.x <> 0 OR shrine.y <> 0`,
      []
    ],
    orphanOauthAccounts: [
      `SELECT COUNT(*) AS failures
       FROM player_oauth_accounts linked
       LEFT JOIN players p ON p.id = linked.player_id
       WHERE p.id IS NULL`,
      []
    ],
    orphanSessions: [
      `SELECT COUNT(*) AS failures
       FROM player_sessions linked
       LEFT JOIN players p ON p.id = linked.player_id
       WHERE p.id IS NULL`,
      []
    ]
  };

  for (const tableName of [
    'player_achievements',
    'player_active_hunts',
    'player_daily_quests',
    'player_echo_discoveries',
    'player_hunt_unlocks',
    'player_bag',
    'player_stat_points',
    'player_world_boss_buffs',
    'player_world_teams',
    'oauth_states',
    'runs'
  ]) {
    checks[`${tableName}Rows`] = [`SELECT COUNT(*) AS failures FROM \`${tableName}\``, []];
  }

  const results = {};
  for (const [name, [query, params]] of Object.entries(checks)) {
    const [[row]] = await connection.query(query, params);
    results[name] = Number(row.failures) || 0;
  }
  return results;
}

function printVerification(verification) {
  console.log('Reset committed. Verification:');
  for (const [name, failures] of Object.entries(verification)) {
    console.log(`  ${name}: ${failures}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
