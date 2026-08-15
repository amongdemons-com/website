const db = require('./db');
const { isSteamConfigured, setUserAchievements } = require('./steam');
const {
  getPlayGamesAchievementId,
  getPlayerAccessToken,
  isPlayGamesConfigured,
  unlockAchievements
} = require('./play-games');
const ACHIEVEMENTS = require('../data/achievements.json');

const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));
const LEVEL_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.trigger === 'account-level');
const FLOOR_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.trigger === 'dungeon-floor');
const PVP_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.trigger === 'pvp-wins');
const RANKED_RATING_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.trigger === 'ranked-rating');
const BOSS_ACHIEVEMENT_BY_BOSS_ID = new Map(
  ACHIEVEMENTS
    .filter((achievement) => achievement.trigger === 'world-boss')
    .map((achievement) => [achievement.boss, achievement.id])
);

const DEMON_RARITY_COUNT = 6;
const DEMON_TYPE_COUNT = 11;
const COLLECTION_SLOT_COUNT = DEMON_RARITY_COUNT * DEMON_TYPE_COUNT;
const queuedSteamSyncs = new Set();
const queuedPlayGamesSyncs = new Set();

// Unlocks achievements for a player. Idempotent (already unlocked ids are
// skipped) and intentionally swallow-all: achievement bookkeeping must never
// break the gameplay request that triggered it. Returns the newly unlocked
// achievement definitions.
async function grantAchievements(playerId, achievementIds, queryable = db) {
  try {
    const ids = [...new Set((achievementIds || []).filter((id) => ACHIEVEMENTS_BY_ID.has(id)))];
    if (!playerId || !ids.length) return [];

    const [existingRows] = await queryable.query(
      'SELECT achievement_id AS achievementId FROM player_achievements WHERE player_id = ? AND achievement_id IN (?)',
      [playerId, ids]
    );
    const existingIds = new Set(existingRows.map((row) => row.achievementId));
    const newIds = ids.filter((id) => !existingIds.has(id));
    if (!newIds.length) return [];

    const placeholders = newIds.map(() => '(?, ?)').join(', ');
    const values = newIds.flatMap((id) => [playerId, id]);
    await queryable.query(
      `INSERT IGNORE INTO player_achievements (player_id, achievement_id) VALUES ${placeholders}`,
      values
    );
    const newlyUnlocked = newIds.map((id) => ACHIEVEMENTS_BY_ID.get(id));

    if (newlyUnlocked.length) {
      queueSteamSync(playerId);
      queuePlayGamesSync(playerId);
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('Failed to grant achievements:', error);
    return [];
  }
}

function grantDungeonBattleAchievements(playerId, battle = {}) {
  const ids = [];
  if (Math.max(0, Number(battle.teamSize) || 0) >= 6) ids.push('six-deep');
  if (battle.winner === 'player') {
    ids.push('first-blood');
    if (battle.undermanned) ids.push('trial-of-the-few');
    const cleared = Math.max(0, Number(battle.floor) || 0);
    ids.push(...FLOOR_ACHIEVEMENTS
      .filter((achievement) => cleared >= achievement.threshold)
      .map((achievement) => achievement.id));
  }
  return grantAchievements(playerId, ids);
}

function queueSteamSync(playerId) {
  // Unsynced database rows are the durable outbox. Steam is an external
  // cosmetic mirror, so never hold a gameplay response open for that call.
  if (queuedSteamSyncs.has(playerId)) return;
  queuedSteamSyncs.add(playerId);
  setImmediate(async () => {
    try {
      await pushUnsyncedToSteam(playerId);
    } finally {
      queuedSteamSyncs.delete(playerId);
    }
  });
}

async function checkAccountLevel(playerId, level) {
  const reached = Math.max(1, Number(level) || 1);
  return grantAchievements(
    playerId,
    LEVEL_ACHIEVEMENTS.filter((achievement) => reached >= achievement.threshold).map((achievement) => achievement.id)
  );
}

async function checkDungeonFloor(playerId, floor) {
  const cleared = Math.max(0, Number(floor) || 0);
  return grantAchievements(
    playerId,
    FLOOR_ACHIEVEMENTS.filter((achievement) => cleared >= achievement.threshold).map((achievement) => achievement.id)
  );
}

async function checkPvpWins(playerId, wins) {
  const total = Math.max(0, Number(wins) || 0);
  return grantAchievements(
    playerId,
    PVP_ACHIEVEMENTS.filter((achievement) => total >= achievement.threshold).map((achievement) => achievement.id)
  );
}

function queuePlayGamesSync(playerId) {
  // As with Steam, unsynced rows are a durable outbox. When a refresh token is
  // available this also mirrors unlocks earned from an ordinary web browser.
  if (queuedPlayGamesSyncs.has(playerId)) return;
  queuedPlayGamesSyncs.add(playerId);
  setImmediate(async () => {
    try {
      await pushUnsyncedToPlayGames(playerId);
    } finally {
      queuedPlayGamesSyncs.delete(playerId);
    }
  });
}

async function checkRankedRating(playerId, rating, queryable = db) {
  const reached = Math.max(0, Number(rating) || 0);
  return grantAchievements(
    playerId,
    RANKED_RATING_ACHIEVEMENTS
      .filter((achievement) => reached >= achievement.threshold)
      .map((achievement) => achievement.id),
    queryable
  );
}

// Evaluates every collection-shaped achievement from the player_demons table.
// Called after a demon reaches the collection (dungeon extraction).
async function checkCollection(playerId) {
  try {
    const [[summaryRows], [bloodlineRows]] = await Promise.all([
      db.query(
        `SELECT COUNT(*) AS total,
                COUNT(DISTINCT type_id) AS types,
                COUNT(DISTINCT rarity) AS rarities,
                SUM(LOWER(rarity) = 'mythic') AS mythics
         FROM player_demons
         WHERE player_id = ?`,
        [playerId]
      ),
      db.query(
        `SELECT COUNT(DISTINCT rarity) AS rarities
         FROM player_demons
         WHERE player_id = ?
         GROUP BY type_id
         ORDER BY rarities DESC
         LIMIT 1`,
        [playerId]
      )
    ]);

    const summary = summaryRows[0] || {};
    const total = Number(summary.total) || 0;
    const bestBloodline = Number(bloodlineRows[0]?.rarities) || 0;
    const ids = [];

    if (Number(summary.mythics) > 0) ids.push('myth-made-flesh');
    if (Number(summary.rarities) >= DEMON_RARITY_COUNT) ids.push('every-shade-of-sin');
    if (Number(summary.types) >= DEMON_TYPE_COUNT) ids.push('elevenfold');
    if (bestBloodline >= DEMON_RARITY_COUNT) ids.push('complete-bloodline');
    if (total >= 33) ids.push('half-the-menagerie');
    if (total >= COLLECTION_SLOT_COUNT) ids.push('among-demons');

    return grantAchievements(playerId, ids);
  } catch (error) {
    console.error('Failed to check collection achievements:', error);
    return [];
  }
}

// Grants the boss-specific achievement, then Crown of Ruin once every boss
// achievement is unlocked (the player_achievements rows are the persistent
// record of which bosses were ever defeated).
async function grantBossDefeat(playerId, bossId) {
  const achievementId = BOSS_ACHIEVEMENT_BY_BOSS_ID.get(String(bossId || ''));
  if (!achievementId) return [];

  const unlocked = await grantAchievements(playerId, [achievementId]);

  try {
    const bossAchievementIds = [...BOSS_ACHIEVEMENT_BY_BOSS_ID.values()];
    const [rows] = await db.query(
      `SELECT COUNT(*) AS defeated
       FROM player_achievements
       WHERE player_id = ? AND achievement_id IN (?)`,
      [playerId, bossAchievementIds]
    );

    if (Number(rows[0]?.defeated) >= bossAchievementIds.length) {
      unlocked.push(...await grantAchievements(playerId, ['crown-of-ruin']));
    }
  } catch (error) {
    console.error('Failed to check all-bosses achievement:', error);
  }

  return unlocked;
}

// The Anomaly, Whispering Well, and prior-season ratings all leave durable
// records, so players who completed them before these achievements existed can
// still receive credit when Steam next links or signs in.
async function checkPersistentAchievementHistory(playerId) {
  try {
    const [[anomalyRows], [soulFontRows], [rankedRows]] = await Promise.all([
      db.query(
        'SELECT victories FROM player_anomaly_rituals WHERE player_id = ? LIMIT 1',
        [playerId]
      ),
      db.query(
        'SELECT 1 AS received FROM player_world_soul_font_buffs WHERE player_id = ? LIMIT 1',
        [playerId]
      ),
      db.query(
        'SELECT MAX(rating) AS highestRating FROM ranked_ratings WHERE player_id = ?',
        [playerId]
      )
    ]);
    const ids = [];
    if (Number(anomalyRows[0]?.victories) > 0) ids.push('one-voice-remains');
    if (soulFontRows.length) ids.push('the-well-whispers-back');

    const unlocked = await grantAchievements(playerId, ids);
    unlocked.push(...await checkRankedRating(playerId, rankedRows[0]?.highestRating));
    return unlocked;
  } catch (error) {
    console.error('Failed to check persistent achievement history:', error);
    return [];
  }
}

// Re-evaluates everything derivable from persistent state. Used when a Steam
// account first links so long-time players get their history credited.
async function checkRetroactive(player) {
  if (!player?.id) return [];

  const unlocked = [];
  unlocked.push(...await checkAccountLevel(player.id, player.level));
  unlocked.push(...await checkDungeonFloor(player.id, player.highest_floor ?? player.highestFloor));
  unlocked.push(...await checkPvpWins(player.id, player.pvp_wins ?? player.pvpWins));
  unlocked.push(...await checkCollection(player.id));
  unlocked.push(...await checkPersistentAchievementHistory(player.id));
  return unlocked;
}

async function getPlayerAchievements(playerId) {
  const [rows] = await db.query(
    'SELECT achievement_id AS achievementId, unlocked_at AS unlockedAt FROM player_achievements WHERE player_id = ?',
    [playerId]
  );
  const unlockedById = new Map(rows.map((row) => [row.achievementId, row.unlockedAt]));

  return ACHIEVEMENTS.map((achievement) => ({
    id: achievement.id,
    steamName: achievement.steamName,
    playGamesId: getPlayGamesAchievementId(achievement.id),
    title: achievement.title,
    description: achievement.description,
    unlocked: unlockedById.has(achievement.id),
    unlockedAt: unlockedById.get(achievement.id) || null
  }));
}

// Mirrors the same authoritative unlock rows to Play Games. A fresh access
// token is supplied during Android login; later browser-earned unlocks use the
// encrypted refresh token stored for that player.
async function pushUnsyncedToPlayGames(playerId, options = {}) {
  try {
    if (!isPlayGamesConfigured()) return;

    const [rows] = await db.query(
      'SELECT achievement_id AS achievementId FROM player_achievements WHERE player_id = ? AND play_games_synced_at IS NULL',
      [playerId]
    );
    const mappedRows = rows
      .map((row) => ({ ...row, playGamesId: getPlayGamesAchievementId(row.achievementId) }))
      .filter((row) => row.playGamesId);
    if (!mappedRows.length) return;

    const accessToken = options.accessToken || await getPlayerAccessToken(playerId);
    if (!accessToken) return;

    await unlockAchievements(accessToken, mappedRows.map((row) => row.playGamesId));
    await db.query(
      `UPDATE player_achievements
       SET play_games_synced_at = CURRENT_TIMESTAMP
       WHERE player_id = ?
         AND achievement_id IN (?)
         AND play_games_synced_at IS NULL`,
      [playerId, mappedRows.map((row) => row.achievementId)]
    );
  } catch (error) {
    console.error('Failed to sync achievements to Play Games:', error);
  }
}

// Pushes every unlocked-but-unsynced achievement to Steam for players with a
// linked Steam account. Called after each grant and on Steam sign-in, so
// unlocks earned before linking (or during a Steam outage) catch up.
async function pushUnsyncedToSteam(playerId) {
  try {
    if (!isSteamConfigured()) return;

    const steamId = await getLinkedSteamId(playerId);
    if (!steamId) return;

    const [rows] = await db.query(
      'SELECT achievement_id AS achievementId FROM player_achievements WHERE player_id = ? AND steam_synced_at IS NULL',
      [playerId]
    );
    const steamNames = rows
      .map((row) => ACHIEVEMENTS_BY_ID.get(row.achievementId)?.steamName)
      .filter(Boolean);
    if (!steamNames.length) return;

    await setUserAchievements(steamId, steamNames);
    await db.query(
      `UPDATE player_achievements
       SET steam_synced_at = CURRENT_TIMESTAMP
       WHERE player_id = ?
         AND achievement_id IN (?)
         AND steam_synced_at IS NULL`,
      [playerId, rows.map((row) => row.achievementId)]
    );
  } catch (error) {
    console.error('Failed to sync achievements to Steam:', error);
  }
}

async function getLinkedSteamId(playerId) {
  const [rows] = await db.query(
    `SELECT provider_user_id AS steamId
     FROM player_oauth_accounts
     WHERE provider = 'steam' AND player_id = ?
     LIMIT 1`,
    [playerId]
  );
  return rows[0]?.steamId || null;
}

module.exports = {
  ACHIEVEMENTS,
  checkAccountLevel,
  checkCollection,
  checkDungeonFloor,
  checkPersistentAchievementHistory,
  checkPvpWins,
  checkRankedRating,
  checkRetroactive,
  getPlayerAchievements,
  grantAchievements,
  grantBossDefeat,
  grantDungeonBattleAchievements,
  pushUnsyncedToPlayGames,
  pushUnsyncedToSteam
};
