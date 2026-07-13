const db = require('./db');
const { isSteamConfigured, setUserAchievements } = require('./steam');
const ACHIEVEMENTS = require('../data/achievements.json');

const ACHIEVEMENTS_BY_ID = new Map(ACHIEVEMENTS.map((achievement) => [achievement.id, achievement]));
const LEVEL_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.trigger === 'account-level');
const FLOOR_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.trigger === 'dungeon-floor');
const PVP_ACHIEVEMENTS = ACHIEVEMENTS.filter((achievement) => achievement.trigger === 'pvp-wins');
const BOSS_ACHIEVEMENT_BY_BOSS_ID = new Map(
  ACHIEVEMENTS
    .filter((achievement) => achievement.trigger === 'world-boss')
    .map((achievement) => [achievement.boss, achievement.id])
);

const DEMON_RARITY_COUNT = 6;
const DEMON_TYPE_COUNT = 11;
const COLLECTION_SLOT_COUNT = DEMON_RARITY_COUNT * DEMON_TYPE_COUNT;

// Unlocks achievements for a player. Idempotent (already unlocked ids are
// skipped) and intentionally swallow-all: achievement bookkeeping must never
// break the gameplay request that triggered it. Returns the newly unlocked
// achievement definitions.
async function grantAchievements(playerId, achievementIds) {
  try {
    const ids = [...new Set((achievementIds || []).filter((id) => ACHIEVEMENTS_BY_ID.has(id)))];
    if (!playerId || !ids.length) return [];

    const newlyUnlocked = [];
    for (const id of ids) {
      const [result] = await db.query(
        'INSERT IGNORE INTO player_achievements (player_id, achievement_id) VALUES (?, ?)',
        [playerId, id]
      );
      if (result.affectedRows) {
        newlyUnlocked.push(ACHIEVEMENTS_BY_ID.get(id));
      }
    }

    if (newlyUnlocked.length) {
      await pushUnsyncedToSteam(playerId);
    }

    return newlyUnlocked;
  } catch (error) {
    console.error('Failed to grant achievements:', error);
    return [];
  }
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

// Re-evaluates everything derivable from persistent state. Used when a Steam
// account first links so long-time players get their history credited.
async function checkRetroactive(player) {
  if (!player?.id) return [];

  const unlocked = [];
  unlocked.push(...await checkAccountLevel(player.id, player.level));
  unlocked.push(...await checkDungeonFloor(player.id, player.highest_floor ?? player.highestFloor));
  unlocked.push(...await checkPvpWins(player.id, player.pvp_wins ?? player.pvpWins));
  unlocked.push(...await checkCollection(player.id));
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
    title: achievement.title,
    description: achievement.description,
    unlocked: unlockedById.has(achievement.id),
    unlockedAt: unlockedById.get(achievement.id) || null
  }));
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
       WHERE player_id = ? AND steam_synced_at IS NULL`,
      [playerId]
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
  checkPvpWins,
  checkRetroactive,
  getPlayerAchievements,
  grantAchievements,
  grantBossDefeat,
  pushUnsyncedToSteam
};
