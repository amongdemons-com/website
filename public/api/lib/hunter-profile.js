const db = require('./db');
const { applyPreBattleBuffs } = require('./combat-buffs');
const { resolveActivePlayerCombatBuffs } = require('./player-combat-buffs');
const { isValidUsername, normalizeUsername } = require('./usernames');
const { getActiveWorldTeam } = require('./world-combat');
const worldMap = require('../data/map.json');

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
  const [worldTeam, buffs] = await Promise.all([
    getActiveWorldTeam(row.id),
    resolveActivePlayerCombatBuffs(player)
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
      profileDemonImageUrl: row.profileDemonImageUrl || null
    },
    coordinates: serializeCoordinates(row),
    worldTeam: visualWorldTeam.map(serializeTeamMember),
    buffs
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
  return {
    instanceId: demon.instanceId || null,
    collectionDemonId: demon.collectionDemonId || null,
    sourceDemonId: demon.sourceDemonId || null,
    typeId: Number(demon.typeId) || null,
    species: demon.species || 'Demon',
    rarity: demon.rarity || 'common',
    imageUrl: demon.imageUrl || '',
    hp: Math.max(0, Number(demon.hp) || 0),
    maxHp: Math.max(0, Number(demon.maxHp) || Number(demon.hp) || 0),
    atk: Math.max(0, Number(demon.atk) || 0),
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
