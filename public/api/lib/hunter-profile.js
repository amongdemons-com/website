const db = require('./db');
const { applyPreBattleBuffs } = require('./combat-buffs');
const { resolveActivePlayerCombatBuffs } = require('./player-combat-buffs');
const { isValidUsername, normalizeUsername } = require('./usernames');
const { getActiveWorldTeam } = require('./world-combat');
const worldMap = require('../data/map.json');
const { getDemonImageUrl } = require('./demon-images');
const { getOrCreateCurrentSeason } = require('./ranked-runs');
const { getDivision } = require('./ranked-rules');
const { getPlayerBadges } = require('./player-badges');
const { RANKED_BOT_ID_PATTERN } = require('./system-players');

const WORLD_SPAWN = worldMap.spawn || { x: 0, y: 0 };

async function getPublicHunterProfile(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) return null;

  const [rows] = await db.query(
    `SELECT p.id,
            p.username,
            p.level,
            p.xp,
            p.souls,
            p.highest_floor AS highestFloor,
            p.pvp_wins AS pvpWins,
            p.pvp_losses AS pvpLosses,
            pd.species AS profileDemonSpecies,
            pd.rarity AS profileDemonRarity,
            pd.image_url AS profileDemonImageUrl,
            wp.x,
            wp.y,
            wp.updated_at AS positionUpdatedAt
     FROM players p
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     LEFT JOIN player_world_positions wp
       ON wp.player_id = p.id
     WHERE p.username = ?
     LIMIT 1`,
    [username]
  );

  if (!rows.length) return null;

  const row = rows[0];
  const player = {
    id: row.id,
    username: row.username,
    level: Math.max(1, Number(row.level) || 1),
    xp: Math.max(0, Number(row.xp) || 0)
  };
  const [worldTeam, buffs, ranked, badges] = await Promise.all([
    getActiveWorldTeam(row.id),
    resolveActivePlayerCombatBuffs(player),
    getHunterRankedRecord(row.id),
    getPlayerBadges(row.id)
  ]);
  const visualWorldTeam = applyPreBattleBuffs(worldTeam, { activeBuffs: buffs });

  return {
    hunter: {
      username: row.username,
      level: player.level,
      xp: player.xp,
      souls: Math.max(0, Number(row.souls) || 0),
      highestFloor: Math.max(0, Number(row.highestFloor) || 0),
      pvpWins: Math.max(0, Number(row.pvpWins) || 0),
      pvpLosses: Math.max(0, Number(row.pvpLosses) || 0),
      profileDemonSpecies: row.profileDemonSpecies || null,
      profileDemonRarity: row.profileDemonRarity || null,
      profileDemonImageUrl: row.profileDemonImageUrl
        ? getDemonImageUrl(row.profileDemonImageUrl, 'portrait')
        : null
    },
    coordinates: serializeCoordinates(row),
    worldTeam: visualWorldTeam.map(serializeTeamMember),
    buffs,
    ranked,
    badges
  };
}

async function getHunterRankedRecord(playerId) {
  const season = await getOrCreateCurrentSeason();
  const [rows] = await db.query(
    `SELECT rr.rating,
            rr.highest_floor AS highestFloor,
            rr.victories,
            rr.runs_played AS runsPlayed,
            p.level,
            p.username
     FROM ranked_ratings rr
     INNER JOIN players p ON p.id = rr.player_id
     WHERE rr.player_id = ? AND rr.season_id = ?
     LIMIT 1`,
    [playerId, season.id]
  );
  if (!rows.length) return null;
  const row = rows[0];
  const rating = Math.max(0, Number(row.rating) || 0);
  const [rankRows] = await db.query(
    `SELECT COUNT(*) + 1 AS rankPosition
     FROM ranked_ratings other
     INNER JOIN players other_player ON other_player.id = other.player_id
     WHERE other.season_id = ?
       AND other_player.id NOT LIKE ?
       AND (
         other.rating > ?
         OR (other.rating = ? AND other.highest_floor > ?)
         OR (
           other.rating = ?
           AND other.highest_floor = ?
           AND other.victories > ?
         )
         OR (
           other.rating = ?
           AND other.highest_floor = ?
           AND other.victories = ?
           AND other_player.level > ?
         )
         OR (
           other.rating = ?
           AND other.highest_floor = ?
           AND other.victories = ?
           AND other_player.level = ?
           AND other_player.username < ?
         )
       )`,
    [
      season.id,
      RANKED_BOT_ID_PATTERN,
      rating,
      rating,
      Number(row.highestFloor) || 0,
      rating,
      Number(row.highestFloor) || 0,
      Number(row.victories) || 0,
      rating,
      Number(row.highestFloor) || 0,
      Number(row.victories) || 0,
      Number(row.level) || 1,
      rating,
      Number(row.highestFloor) || 0,
      Number(row.victories) || 0,
      Number(row.level) || 1,
      row.username
    ]
  );
  return {
    season,
    rating,
    division: getDivision(rating).name,
    highestFloor: Math.max(0, Number(row.highestFloor) || 0),
    victories: Math.max(0, Number(row.victories) || 0),
    runsPlayed: Math.max(0, Number(row.runsPlayed) || 0),
    rank: Math.max(1, Number(rankRows[0]?.rankPosition) || 1)
  };
}

function serializeCoordinates(row = {}) {
  const hasKnownPosition = row.x !== null && row.x !== undefined && row.y !== null && row.y !== undefined;

  return {
    x: hasKnownPosition ? Number(row.x) || 0 : Number(WORLD_SPAWN.x) || 0,
    y: hasKnownPosition ? Number(row.y) || 0 : Number(WORLD_SPAWN.y) || 0,
    known: hasKnownPosition,
    updatedAt: row.positionUpdatedAt || null
  };
}

function serializeTeamMember(demon = {}) {
  const effectiveAtk = Number(demon.effectiveAtk);

  return {
    instanceId: demon.instanceId || null,
    collectionDemonId: demon.collectionDemonId || null,
    sourceDemonId: demon.sourceDemonId || null,
    typeId: Number(demon.typeId) || null,
    species: demon.species || 'Demon',
    rarity: demon.rarity || 'common',
    imageUrl: getDemonImageUrl(demon, 'portrait'),
    hp: Math.max(0, Number(demon.hp) || 0),
    maxHp: Math.max(0, Number(demon.maxHp) || Number(demon.hp) || 0),
    atk: Math.max(0, Number(demon.atk) || 0),
    ...(Number.isFinite(effectiveAtk) && effectiveAtk >= 0
      ? { effectiveAtk: Math.max(0, effectiveAtk) }
      : {}),
    speed: Math.max(0, Number(demon.speed) || 0),
    position: demon.position || demon.preferredPosition || 'front',
    formationSlot: Number.isInteger(Number(demon.formationSlot)) ? Number(demon.formationSlot) : null
  };
}

module.exports = {
  getPublicHunterProfile,
  serializeCoordinates,
  serializeTeamMember
};
