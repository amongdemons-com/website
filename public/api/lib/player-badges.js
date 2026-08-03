const db = require('./db');

const PLAYER_BADGES = Object.freeze({
  chosen_before_dawn: Object.freeze({
    key: 'chosen_before_dawn',
    name: 'Chosen Before Dawn',
    description: 'Helped test and shape Among Demons during pre-alpha.',
    icon: 'shield'
  }),
  the_night_remembers: Object.freeze({
    key: 'the_night_remembers',
    name: 'The Night Remembers',
    description: 'Supported Among Demons by purchasing the game.',
    icon: 'bookmark',
    color: '#6fd6a7'
  })
});

function getPlayerBadgeDefinition(key) {
  return PLAYER_BADGES[String(key || '')] || null;
}

async function awardPlayerBadge(playerId, badgeKey, queryable = db) {
  const normalizedPlayerId = String(playerId || '').trim();
  const badge = getPlayerBadgeDefinition(badgeKey);
  if (!normalizedPlayerId) throw new Error('A player ID is required to award a badge.');
  if (!badge) throw new Error(`Unknown player badge: ${badgeKey}`);

  await queryable.query(
    `INSERT INTO player_badges (player_id, badge_key)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE badge_key = VALUES(badge_key)`,
    [normalizedPlayerId, badge.key]
  );
  return badge;
}

async function backfillPlayerBadgeForOAuthProvider(badgeKey, provider, queryable = db) {
  const badge = getPlayerBadgeDefinition(badgeKey);
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!badge) throw new Error(`Unknown player badge: ${badgeKey}`);
  if (!normalizedProvider) throw new Error('An OAuth provider is required to backfill a badge.');

  await queryable.query(
    `INSERT INTO player_badges (player_id, badge_key)
     SELECT DISTINCT player_id, ?
     FROM player_oauth_accounts
     WHERE provider = ?
     ON DUPLICATE KEY UPDATE badge_key = VALUES(badge_key)`,
    [badge.key, normalizedProvider]
  );
  return badge;
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
  awardPlayerBadge,
  backfillPlayerBadgeForOAuthProvider,
  getPlayerBadgeDefinition,
  getPlayerBadges,
  getPlayerBadgesByPlayerIds
};
