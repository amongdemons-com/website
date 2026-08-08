const crypto = require('node:crypto');
const db = require('./db');
const { purgePlayerAccount } = require('./account-deletion');

const ACCOUNT_MERGE_TTL_MINUTES = 15;
const MAX_UNSIGNED_INT = 4294967295;

async function createPendingAccountMerge(options, queryable = db) {
  const targetPlayerId = String(options?.targetPlayerId || '');
  const sourcePlayerId = String(options?.sourcePlayerId || '');
  const provider = String(options?.provider || '').toLowerCase();
  const providerUserId = String(options?.providerUserId || '');
  if (!targetPlayerId || !sourcePlayerId || targetPlayerId === sourcePlayerId || !providerUserId) {
    throw createMergeError('These hunters cannot be merged.', 409);
  }

  const [rows] = await queryable.query(
    `SELECT target.id AS targetId,
            source.id AS sourceId,
            EXISTS(
              SELECT 1 FROM player_oauth_accounts source_steam
              WHERE source_steam.player_id = source.id
                AND source_steam.provider = 'steam'
            ) AS sourceHasSteam
     FROM players target
     INNER JOIN players source ON source.id = ?
     INNER JOIN player_oauth_accounts target_steam
       ON target_steam.player_id = target.id
      AND target_steam.provider = 'steam'
     INNER JOIN player_oauth_accounts source_provider
       ON source_provider.player_id = source.id
      AND source_provider.provider = ?
      AND source_provider.provider_user_id = ?
     WHERE target.id = ?
     LIMIT 1`,
    [sourcePlayerId, provider, providerUserId, targetPlayerId]
  );
  if (!rows.length) throw createMergeError('The account merge could not be verified.', 409);
  if (Boolean(Number(rows[0].sourceHasSteam))) {
    throw createMergeError('That hunter is already connected to a different Steam account.', 409);
  }

  const token = crypto.randomBytes(36).toString('base64url');
  await queryable.query(
    `DELETE FROM pending_account_merges
     WHERE target_player_id = ?
        OR source_player_id = ?
        OR expires_at <= CURRENT_TIMESTAMP`,
    [targetPlayerId, sourcePlayerId]
  );
  await queryable.query(
    `INSERT INTO pending_account_merges
       (token, target_player_id, source_player_id, provider, provider_user_id, expires_at)
     VALUES (?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL ${ACCOUNT_MERGE_TTL_MINUTES} MINUTE))`,
    [token, targetPlayerId, sourcePlayerId, provider, providerUserId]
  );
  return token;
}

async function getAccountMergePreview(token, targetPlayerId, queryable = db) {
  const intent = await loadPendingMerge(token, targetPlayerId, queryable);
  if (!intent) throw createMergeError('That account merge expired. Connect the account again.', 404);

  const accounts = await Promise.all([
    loadAccountSummary(intent.target_player_id, queryable),
    loadAccountSummary(intent.source_player_id, queryable)
  ]);
  if (accounts.some((account) => !account)) {
    throw createMergeError('One of the hunters no longer exists.', 404);
  }

  return {
    token: intent.token,
    expiresAt: intent.expires_at,
    provider: intent.provider,
    steamAccount: accounts[0],
    connectedAccount: accounts[1]
  };
}

async function cancelPendingAccountMerge(token, targetPlayerId, queryable = db) {
  const [result] = await queryable.query(
    `DELETE FROM pending_account_merges
     WHERE token = ?
       AND target_player_id = ?
       AND completed_at IS NULL`,
    [String(token || ''), targetPlayerId]
  );
  return result.affectedRows > 0;
}

async function mergePlayerAccounts(token, targetPlayerId, queryable = db) {
  const ownsConnection = queryable === db;
  const connection = ownsConnection ? await db.getConnection() : queryable;
  try {
    if (ownsConnection) await connection.beginTransaction();

    const intent = await loadPendingMerge(token, targetPlayerId, connection, true);
    if (!intent) throw createMergeError('That account merge expired. Connect the account again.', 404);

    const [playerRows] = await connection.query(
      'SELECT * FROM players WHERE id IN (?, ?) ORDER BY id FOR UPDATE',
      [intent.target_player_id, intent.source_player_id]
    );
    const target = playerRows.find((row) => row.id === intent.target_player_id);
    const source = playerRows.find((row) => row.id === intent.source_player_id);
    if (!target || !source) throw createMergeError('One of the hunters no longer exists.', 404);

    await assertMergeIdentities(intent, connection);
    const preferred = choosePreferredAccount(target, source);
    const teamRows = await loadWorldTeams([target.id, source.id], connection);
    const demonMerge = await mergeDemons(target.id, source.id, connection);

    await mergeBag(target.id, source.id, connection);
    await mergeWorldBuffs(target.id, source.id, connection);
    await mergeAchievements(target.id, source.id, connection);
    await mergeSimpleCollections(target.id, source.id, connection);
    await mergeDailyQuests(target.id, source.id, connection);
    await mergeRankedRatings(target.id, source.id, connection);

    // Dungeon state never crosses the merge boundary. Historical completed
    // runs remain available under the surviving Steam hunter.
    await connection.query(
      "DELETE FROM runs WHERE player_id IN (?, ?) AND status = 'active'",
      [target.id, source.id]
    );
    await connection.query('UPDATE runs SET player_id = ? WHERE player_id = ?', [target.id, source.id]);

    await mergeWorldTeam({
      targetPlayerId: target.id,
      preferredPlayerId: preferred.id,
      sourcePlayerId: source.id,
      teamRows,
      sourceDemonIdMap: demonMerge.sourceDemonIdMap,
      connection
    });

    const targetProfileId = normalizeProfileDemonId(target.profile_demon_id, demonMerge.targetDemonIds);
    const preferredProfileId = preferred.id === source.id
      ? demonMerge.sourceDemonIdMap.get(Number(source.profile_demon_id)) || targetProfileId
      : targetProfileId;

    // Clearing allocations refunds every level-derived point automatically.
    await connection.query('DELETE FROM player_stat_points WHERE player_id IN (?, ?)', [target.id, source.id]);
    await connection.query(
      `INSERT INTO player_world_positions (player_id, x, y)
       VALUES (?, 0, 0)
       ON DUPLICATE KEY UPDATE x = 0, y = 0`,
      [target.id]
    );

    // Preserve every sign-in identity on the surviving row. The provider used
    // to approve this merge is included, so the browser account signs into the
    // same hunter immediately after completion.
    await connection.query(
      'UPDATE player_oauth_accounts SET player_id = ? WHERE player_id = ?',
      [target.id, source.id]
    );

    const mergedPlayer = buildMergedPlayer(target, source, preferred, preferredProfileId);
    if (preferred.id === source.id) {
      await connection.query(
        'UPDATE players SET username = ?, email = NULL WHERE id = ?',
        [`merged-${crypto.randomBytes(12).toString('hex')}`.slice(0, 64), source.id]
      );
    }
    await connection.query(
      `UPDATE players
       SET username = ?, email = ?, password_hash = ?, password_salt = ?,
           password_login_enabled = ?, level = ?, xp = ?, souls = ?,
           highest_floor = ?, pvp_wins = ?, pvp_losses = ?, profile_demon_id = ?,
           unlocks = ?, is_guest = 0, deletion_requested_at = NULL,
           deletion_scheduled_for = NULL
       WHERE id = ?`,
      [
        mergedPlayer.username,
        mergedPlayer.email,
        mergedPlayer.password_hash,
        mergedPlayer.password_salt,
        mergedPlayer.password_login_enabled,
        mergedPlayer.level,
        mergedPlayer.xp,
        mergedPlayer.souls,
        mergedPlayer.highest_floor,
        mergedPlayer.pvp_wins,
        mergedPlayer.pvp_losses,
        mergedPlayer.profile_demon_id,
        mergedPlayer.unlocks,
        target.id
      ]
    );

    await purgePlayerAccount(source.id, connection);
    await connection.query(
      'UPDATE pending_account_merges SET completed_at = CURRENT_TIMESTAMP WHERE token = ?',
      [intent.token]
    );
    await connection.query(
      'DELETE FROM pending_account_merges WHERE token = ? OR source_player_id = ? OR target_player_id = ?',
      [intent.token, source.id, source.id]
    );

    if (ownsConnection) await connection.commit();
    return { targetPlayerId: target.id, sourcePlayerId: source.id };
  } catch (error) {
    if (ownsConnection) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function loadPendingMerge(token, targetPlayerId, queryable, forUpdate = false) {
  const [rows] = await queryable.query(
    `SELECT *
     FROM pending_account_merges
     WHERE token = ?
       AND target_player_id = ?
       AND completed_at IS NULL
       AND expires_at > CURRENT_TIMESTAMP
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [String(token || ''), targetPlayerId]
  );
  return rows[0] || null;
}

async function loadAccountSummary(playerId, queryable) {
  const [rows] = await queryable.query(
    `SELECT p.id, p.username, p.level, p.xp, p.souls,
            p.highest_floor AS highestFloor,
            (SELECT COUNT(*) FROM player_demons d WHERE d.player_id = p.id) AS demonCount,
            (SELECT COALESCE(SUM(quantity), 0) FROM player_bag b WHERE b.player_id = p.id) AS bagItems,
            (SELECT COUNT(*) FROM player_achievements a WHERE a.player_id = p.id) AS achievementCount
     FROM players p
     WHERE p.id = ?
     LIMIT 1`,
    [playerId]
  );
  if (!rows.length) return null;
  const [providerRows] = await queryable.query(
    `SELECT provider, email, display_name AS displayName
     FROM player_oauth_accounts
     WHERE player_id = ?
     ORDER BY provider`,
    [playerId]
  );
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    level: Math.max(1, Number(row.level) || 1),
    xp: Math.max(0, Number(row.xp) || 0),
    souls: Math.max(0, Number(row.souls) || 0),
    highestFloor: Math.max(0, Number(row.highestFloor) || 0),
    demonCount: Math.max(0, Number(row.demonCount) || 0),
    bagItems: Math.max(0, Number(row.bagItems) || 0),
    achievementCount: Math.max(0, Number(row.achievementCount) || 0),
    providers: providerRows.map((provider) => ({
      id: provider.provider,
      email: provider.email || null,
      displayName: provider.displayName || null
    }))
  };
}

async function assertMergeIdentities(intent, connection) {
  const [steamRows] = await connection.query(
    "SELECT 1 FROM player_oauth_accounts WHERE player_id = ? AND provider = 'steam' LIMIT 1 FOR UPDATE",
    [intent.target_player_id]
  );
  const [providerRows] = await connection.query(
    `SELECT 1 FROM player_oauth_accounts
     WHERE player_id = ? AND provider = ? AND provider_user_id = ?
     LIMIT 1 FOR UPDATE`,
    [intent.source_player_id, intent.provider, intent.provider_user_id]
  );
  const [sourceSteamRows] = await connection.query(
    "SELECT 1 FROM player_oauth_accounts WHERE player_id = ? AND provider = 'steam' LIMIT 1 FOR UPDATE",
    [intent.source_player_id]
  );
  if (!steamRows.length || !providerRows.length || sourceSteamRows.length) {
    throw createMergeError('The account links changed. Connect the account again.', 409);
  }
}

async function mergeDemons(targetPlayerId, sourcePlayerId, connection) {
  const [rows] = await connection.query(
    'SELECT * FROM player_demons WHERE player_id IN (?, ?) ORDER BY id FOR UPDATE',
    [targetPlayerId, sourcePlayerId]
  );
  const targetBySlot = new Map();
  const targetDemonIds = new Set();
  const sourceDemonIdMap = new Map();
  for (const demon of rows.filter((row) => row.player_id === targetPlayerId)) {
    targetBySlot.set(demonSlot(demon), demon);
    targetDemonIds.add(Number(demon.id));
  }

  for (const source of rows.filter((row) => row.player_id === sourcePlayerId)) {
    const existing = targetBySlot.get(demonSlot(source));
    if (!existing) {
      await connection.query('UPDATE player_demons SET player_id = ? WHERE id = ?', [targetPlayerId, source.id]);
      targetBySlot.set(demonSlot(source), { ...source, player_id: targetPlayerId });
      targetDemonIds.add(Number(source.id));
      sourceDemonIdMap.set(Number(source.id), Number(source.id));
      continue;
    }

    const sourceIsStronger = demonPower(source) > demonPower(existing);
    await connection.query(
      `UPDATE player_demons
       SET source_demon_id = ?, species = ?, image_url = ?,
           hp = ?, atk = ?, speed = ?, times_trained = ?
       WHERE id = ?`,
      [
        sourceIsStronger ? source.source_demon_id : existing.source_demon_id,
        sourceIsStronger ? source.species : existing.species,
        sourceIsStronger ? source.image_url : existing.image_url,
        Math.max(Number(existing.hp) || 0, Number(source.hp) || 0),
        Math.max(Number(existing.atk) || 0, Number(source.atk) || 0),
        Math.max(Number(existing.speed) || 0, Number(source.speed) || 0),
        Math.max(Number(existing.times_trained) || 0, Number(source.times_trained) || 0),
        existing.id
      ]
    );
    await connection.query('DELETE FROM player_demons WHERE id = ?', [source.id]);
    sourceDemonIdMap.set(Number(source.id), Number(existing.id));
  }

  return { sourceDemonIdMap, targetDemonIds };
}

async function mergeBag(targetPlayerId, sourcePlayerId, connection) {
  const [rows] = await connection.query(
    `SELECT item_key, item_type, quantity, created_at, updated_at
     FROM player_bag
     WHERE player_id = ?
     FOR UPDATE`,
    [sourcePlayerId]
  );
  for (const row of rows) {
    await connection.query(
      `INSERT INTO player_bag
         (player_id, item_key, item_type, quantity, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         quantity = LEAST(${MAX_UNSIGNED_INT}, quantity + VALUES(quantity)),
         updated_at = GREATEST(updated_at, VALUES(updated_at))`,
      [
        targetPlayerId,
        row.item_key,
        row.item_type,
        row.quantity,
        row.created_at,
        row.updated_at
      ]
    );
  }
}

async function mergeWorldBuffs(targetPlayerId, sourcePlayerId, connection) {
  const [bossRows] = await connection.query(
    `SELECT boss_id, awarded_at, expires_at
     FROM player_world_boss_buffs
     WHERE player_id = ?
     FOR UPDATE`,
    [sourcePlayerId]
  );
  for (const row of bossRows) {
    await connection.query(
      `INSERT INTO player_world_boss_buffs
         (player_id, boss_id, awarded_at, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         awarded_at = IF(VALUES(expires_at) > expires_at, VALUES(awarded_at), awarded_at),
         expires_at = GREATEST(expires_at, VALUES(expires_at))`,
      [targetPlayerId, row.boss_id, row.awarded_at, row.expires_at]
    );
  }

  const [soulFontRows] = await connection.query(
    `SELECT buff_id, offer_set_id, price, awarded_at, expires_at
     FROM player_world_soul_font_buffs
     WHERE player_id = ?
     FOR UPDATE`,
    [sourcePlayerId]
  );
  for (const row of soulFontRows) {
    await connection.query(
      `INSERT INTO player_world_soul_font_buffs
         (player_id, buff_id, offer_set_id, price, awarded_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         offer_set_id = IF(VALUES(expires_at) > expires_at, VALUES(offer_set_id), offer_set_id),
         price = IF(VALUES(expires_at) > expires_at, VALUES(price), price),
         awarded_at = IF(VALUES(expires_at) > expires_at, VALUES(awarded_at), awarded_at),
         expires_at = GREATEST(expires_at, VALUES(expires_at))`,
      [
        targetPlayerId,
        row.buff_id,
        row.offer_set_id,
        row.price,
        row.awarded_at,
        row.expires_at
      ]
    );
  }
}

async function mergeAchievements(targetPlayerId, sourcePlayerId, connection) {
  await connection.query(
    `INSERT IGNORE INTO player_achievements
       (player_id, achievement_id, unlocked_at, steam_synced_at)
     SELECT ?, achievement_id, unlocked_at, NULL
     FROM player_achievements WHERE player_id = ?`,
    [targetPlayerId, sourcePlayerId]
  );
}

async function mergeSimpleCollections(targetPlayerId, sourcePlayerId, connection) {
  const statements = [
    `INSERT IGNORE INTO player_badges (player_id, badge_key, awarded_at)
     SELECT ?, badge_key, awarded_at FROM player_badges WHERE player_id = ?`,
    `INSERT IGNORE INTO player_hunt_unlocks (player_id, encounter_id, unlocked_at)
     SELECT ?, encounter_id, unlocked_at FROM player_hunt_unlocks WHERE player_id = ?`,
    `INSERT IGNORE INTO player_echo_discoveries (player_id, type_id, rarity, discovered_at)
     SELECT ?, type_id, rarity, discovered_at FROM player_echo_discoveries WHERE player_id = ?`,
    `INSERT IGNORE INTO player_world_merchant_purchases
       (player_id, spawn_id, slot, item_key, price, purchased_at)
     SELECT ?, spawn_id, slot, item_key, price, purchased_at
     FROM player_world_merchant_purchases WHERE player_id = ?`,
    `INSERT IGNORE INTO ranked_action_receipts
       (player_id, action_id, run_id, action_type, created_at)
     SELECT ?, action_id, run_id, action_type, created_at
     FROM ranked_action_receipts WHERE player_id = ?`
  ];
  for (const sql of statements) {
    await connection.query(sql, [targetPlayerId, sourcePlayerId]);
  }

  for (const table of ['ranked_opponent_history', 'ranked_opponent_snapshots']) {
    await connection.query(`UPDATE ${table} SET player_id = ? WHERE player_id = ?`, [targetPlayerId, sourcePlayerId]);
  }
  await connection.query(
    "UPDATE ranked_runs SET player_id = ? WHERE player_id = ? AND status <> 'active'",
    [targetPlayerId, sourcePlayerId]
  );
}

async function mergeDailyQuests(targetPlayerId, sourcePlayerId, connection) {
  const [sourceRows] = await connection.query(
    'SELECT * FROM player_daily_quests WHERE player_id = ? FOR UPDATE',
    [sourcePlayerId]
  );
  for (const source of sourceRows) {
    const [targetRows] = await connection.query(
      'SELECT * FROM player_daily_quests WHERE player_id = ? AND quest_date = ? LIMIT 1 FOR UPDATE',
      [targetPlayerId, source.quest_date]
    );
    if (!targetRows.length) {
      await connection.query(
        'UPDATE player_daily_quests SET player_id = ? WHERE player_id = ? AND quest_date = ?',
        [targetPlayerId, sourcePlayerId, source.quest_date]
      );
      continue;
    }
    const target = targetRows[0];
    await connection.query(
      `UPDATE player_daily_quests
       SET dungeon_wins = ?, demons_extracted = ?, undermanned_wins = ?,
           pvp_wins = ?, hunts_started = ?, highest_floor = ?,
           claimed_quests = ?, daily_reward_claimed = ?
       WHERE player_id = ? AND quest_date = ?`,
      [
        sumUnsigned(target.dungeon_wins, source.dungeon_wins),
        sumUnsigned(target.demons_extracted, source.demons_extracted),
        sumUnsigned(target.undermanned_wins, source.undermanned_wins),
        sumUnsigned(target.pvp_wins, source.pvp_wins),
        sumUnsigned(target.hunts_started, source.hunts_started),
        Math.max(Number(target.highest_floor) || 0, Number(source.highest_floor) || 0),
        JSON.stringify(unionJsonArrays(target.claimed_quests, source.claimed_quests)),
        Number(Boolean(Number(target.daily_reward_claimed) || Number(source.daily_reward_claimed))),
        targetPlayerId,
        target.quest_date
      ]
    );
  }
}

async function mergeRankedRatings(targetPlayerId, sourcePlayerId, connection) {
  const [rows] = await connection.query(
    `SELECT season_id, rating, highest_floor, victories, runs_played, updated_at
     FROM ranked_ratings
     WHERE player_id = ?
     FOR UPDATE`,
    [sourcePlayerId]
  );
  for (const row of rows) {
    await connection.query(
      `INSERT INTO ranked_ratings
         (player_id, season_id, rating, highest_floor, victories, runs_played, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rating = GREATEST(rating, VALUES(rating)),
         highest_floor = GREATEST(highest_floor, VALUES(highest_floor)),
         victories = LEAST(${MAX_UNSIGNED_INT}, victories + VALUES(victories)),
         runs_played = LEAST(${MAX_UNSIGNED_INT}, runs_played + VALUES(runs_played)),
         updated_at = GREATEST(updated_at, VALUES(updated_at))`,
      [
        targetPlayerId,
        row.season_id,
        row.rating,
        row.highest_floor,
        row.victories,
        row.runs_played,
        row.updated_at
      ]
    );
  }
}

async function loadWorldTeams(playerIds, connection) {
  const [rows] = await connection.query(
    'SELECT player_id, demon_id, formation_slot FROM player_world_teams WHERE player_id IN (?, ?) FOR UPDATE',
    playerIds
  );
  return rows;
}

async function mergeWorldTeam(options) {
  const { targetPlayerId, sourcePlayerId, preferredPlayerId, teamRows, sourceDemonIdMap, connection } = options;
  const preferredRows = teamRows.filter((row) => row.player_id === preferredPlayerId);
  const selectedRows = preferredRows.length
    ? preferredRows
    : teamRows.filter((row) => row.player_id === targetPlayerId);
  await connection.query('DELETE FROM player_world_teams WHERE player_id IN (?, ?)', [targetPlayerId, sourcePlayerId]);
  for (const row of selectedRows) {
    const demonId = row.player_id === sourcePlayerId
      ? sourceDemonIdMap.get(Number(row.demon_id))
      : Number(row.demon_id);
    if (!demonId) continue;
    await connection.query(
      `INSERT INTO player_world_teams (player_id, demon_id, formation_slot)
       VALUES (?, ?, ?)`,
      [targetPlayerId, demonId, row.formation_slot]
    );
  }
}

function buildMergedPlayer(target, source, preferred, preferredProfileId) {
  return {
    username: preferred.username,
    email: preferred.email || null,
    password_hash: preferred.password_hash,
    password_salt: preferred.password_salt,
    password_login_enabled: Number(preferred.password_login_enabled) ? 1 : 0,
    level: Math.max(Number(target.level) || 1, Number(source.level) || 1),
    xp: Math.max(Number(target.xp) || 0, Number(source.xp) || 0),
    souls: sumUnsigned(target.souls, source.souls),
    highest_floor: Math.max(Number(target.highest_floor) || 0, Number(source.highest_floor) || 0),
    pvp_wins: sumUnsigned(target.pvp_wins, source.pvp_wins),
    pvp_losses: sumUnsigned(target.pvp_losses, source.pvp_losses),
    profile_demon_id: preferredProfileId,
    unlocks: JSON.stringify(unionJsonArrays(target.unlocks, source.unlocks))
  };
}

function choosePreferredAccount(target, source) {
  const targetLevel = Math.max(1, Number(target?.level) || 1);
  const sourceLevel = Math.max(1, Number(source?.level) || 1);
  if (sourceLevel !== targetLevel) return sourceLevel > targetLevel ? source : target;
  const targetXp = Math.max(0, Number(target?.xp) || 0);
  const sourceXp = Math.max(0, Number(source?.xp) || 0);
  return sourceXp > targetXp ? source : target;
}

function normalizeProfileDemonId(value, validIds) {
  const id = Number(value);
  return Number.isInteger(id) && validIds.has(id) ? id : null;
}

function demonSlot(demon) {
  return `${Number(demon.type_id)}:${String(demon.rarity || '').toLowerCase()}`;
}

function demonPower(demon) {
  return (Number(demon.hp) || 0) + (Number(demon.atk) || 0) + (Number(demon.speed) || 0);
}

function sumUnsigned(first, second) {
  return Math.min(MAX_UNSIGNED_INT, Math.max(0, Number(first) || 0) + Math.max(0, Number(second) || 0));
}

function unionJsonArrays(...values) {
  const merged = new Set();
  for (const value of values) {
    let entries = value;
    if (!Array.isArray(entries)) {
      try {
        entries = JSON.parse(entries || '[]');
      } catch (error) {
        entries = [];
      }
    }
    if (Array.isArray(entries)) entries.forEach((entry) => merged.add(entry));
  }
  return [...merged];
}

function createMergeError(message, status = 500) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  ACCOUNT_MERGE_TTL_MINUTES,
  buildMergedPlayer,
  cancelPendingAccountMerge,
  choosePreferredAccount,
  createPendingAccountMerge,
  getAccountMergePreview,
  mergePlayerAccounts,
  sumUnsigned,
  unionJsonArrays
};
