const express = require('express');
const db = require('./lib/db');
const { getOrCreateCurrentSeason } = require('./lib/ranked-runs');
const { getDivision } = require('./lib/ranked-rules');
const { getPlayerBadgesByPlayerIds } = require('./lib/player-badges');
const { RANKED_BOT_ID_PATTERN } = require('./lib/system-players');
const { normalizeAccountLevel } = require('./lib/progression');

const router = express.Router();
const STATS_CACHE_MS = 15000;
let statsCache = null;
let statsPromise = null;

router.get('/leaderboard', async (req, res) => {
  const allowedSorts = new Set(['floor', 'level', 'xp', 'souls', 'pvp', 'ranked']);
  const sort = allowedSorts.has(req.query.sort) ? req.query.sort : 'floor';
  const orderBy = {
    floor: 'p.highest_floor DESC, p.level DESC, p.xp DESC, p.souls DESC',
    level: 'p.level DESC, p.xp DESC, p.souls DESC',
    xp: 'p.xp DESC, p.level DESC, p.souls DESC',
    souls: 'p.souls DESC, p.level DESC, p.xp DESC',
    pvp: 'p.pvp_wins DESC, p.pvp_losses ASC, p.level DESC, p.xp DESC, p.highest_floor DESC, p.souls DESC',
    ranked: 'has_ranked_rating DESC, ranked_rating DESC, ranked_highest_floor DESC, ranked_victories DESC, p.level DESC, p.username ASC'
  }[sort];
  const season = await getOrCreateCurrentSeason();

  const [rowsResult, stats] = await Promise.all([db.query(
    `SELECT p.id AS playerId,
            p.username,
            p.level,
            p.xp,
            p.souls,
            p.highest_floor AS highestFloor,
            p.pvp_wins AS pvpWins,
            p.pvp_losses AS pvpLosses,
            CASE WHEN rr.player_id IS NULL THEN 0 ELSE 1 END AS hasRankedRating,
            CASE WHEN rr.player_id IS NULL THEN 0 ELSE 1 END AS has_ranked_rating,
            COALESCE(rr.rating, 1000) AS rankedRating,
            COALESCE(rr.rating, 1000) AS ranked_rating,
            COALESCE(rr.highest_floor, 0) AS rankedHighestFloor,
            COALESCE(rr.highest_floor, 0) AS ranked_highest_floor,
            COALESCE(rr.victories, 0) AS rankedVictories,
            COALESCE(rr.victories, 0) AS ranked_victories,
            COALESCE(rr.runs_played, 0) AS rankedRuns
     FROM players p
     LEFT JOIN ranked_ratings rr
       ON rr.player_id = p.id
      AND rr.season_id = ?
     WHERE p.id NOT LIKE ?
     ORDER BY ${orderBy}
     LIMIT 100`,
    [season.id, RANKED_BOT_ID_PATTERN]
  ), getLeaderboardStats()]);
  const badgesByPlayer = await getPlayerBadgesByPlayerIds(
    rowsResult[0].map((row) => row.playerId)
  );
  const rows = rowsResult[0].map(({ playerId, ...row }) => ({
    ...row,
    level: normalizeAccountLevel(row.level),
    rankedDivision: getDivision(row.rankedRating).name,
    badges: badgesByPlayer.get(String(playerId)) || []
  }));

  res.json({
    players: rows,
    sort,
    season,
    limit: 100,
    stats: {
      players: Math.max(0, Number(stats?.players) || 0),
      souls: Math.max(0, Number(stats?.souls) || 0),
      pvpBattles: Math.max(0, Number(stats?.pvpBattles) || 0)
    }
  });
});

async function getLeaderboardStats() {
  if (statsCache && Date.now() - statsCache.cachedAt < STATS_CACHE_MS) {
    return statsCache.value;
  }
  if (!statsPromise) {
    statsPromise = db.query(
      `SELECT COUNT(*) AS players,
              COALESCE(SUM(p.souls), 0) AS souls,
              COALESCE(SUM(p.pvp_wins), 0) AS pvpBattles
       FROM players p
       WHERE p.id NOT LIKE ?`,
      [RANKED_BOT_ID_PATTERN]
    ).then(([rows]) => {
      const value = rows[0] || {};
      statsCache = { cachedAt: Date.now(), value };
      return value;
    }).finally(() => {
      statsPromise = null;
    });
  }
  return statsPromise;
}

module.exports = router;
module.exports._test = { RANKED_BOT_ID_PATTERN };
