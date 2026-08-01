const db = require('./db');

const PLAYER_BADGES = Object.freeze({
  chosen_before_dawn: Object.freeze({
    key: 'chosen_before_dawn',
    name: 'Chosen Before Dawn',
    description: 'Helped test and shape Among Demons during pre-alpha.',
    icon: 'shield'
  })
});

function getPlayerBadgeDefinition(key) {
  return PLAYER_BADGES[String(key || '')] || null;
}

async function getPlayerBadges(playerId, queryable = db) {
  const badgesByPlayer = await getPlayerBadgesByPlayerIds([playerId], queryable);
  return badgesByPlayer.get(String(playerId || '')) || [];
}

async function getPlayerBadgesByPlayerIds(playerIds = [], queryable = db) {
  const ids = [...new Set((Array.isArray(playerIds) ? playerIds : [])
    .map((playerId) => String(playerId || '').trim())
    .filter(Boolean))];
  const badgesByPlayer = new Map(ids.map((playerId) => [playerId, []]));
  if (!ids.length) return badgesByPlayer;

  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await queryable.query(
    `SELECT player_id, badge_key, awarded_at
     FROM player_badges
     WHERE player_id IN (${placeholders})
     ORDER BY awarded_at ASC, badge_key ASC`,
    ids
  );
  rows.forEach((row) => {
    const definition = getPlayerBadgeDefinition(row.badge_key);
    const playerId = String(row.player_id || '');
    if (!definition || !badgesByPlayer.has(playerId)) return;
    badgesByPlayer.get(playerId).push({
      ...definition,
      awardedAt: row.awarded_at ? new Date(row.awarded_at).toISOString() : null
    });
  });
  return badgesByPlayer;
}

module.exports = {
  PLAYER_BADGES,
  getPlayerBadgeDefinition,
  getPlayerBadges,
  getPlayerBadgesByPlayerIds
};
