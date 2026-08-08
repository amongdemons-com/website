const { randomInt, randomUUID } = require('node:crypto');
const db = require('./db');
const { cleanPlayer } = require('./auth');
const { normalizeCombatBuffState } = require('./combat-buffs');

const SOUL_FONT_ID = 'hollow-soul-font';
const SOUL_FONT_NAME = 'The Whispering Well';
const SOUL_FONT_DESCRIPTION = 'Sacrifice Souls and accept whichever blessing whispers back.';
const SOUL_FONT_X = 14;
const SOUL_FONT_Y = -8;
const SOUL_FONT_DURATION_HOURS = 4;
const SOUL_FONT_DURATION_SECONDS = SOUL_FONT_DURATION_HOURS * 60 * 60;
const SOUL_FONT_BASE_COST = 100;
const SOUL_FONT_COST_PER_LEVEL = 10;

const SOUL_FONT_BUFFS = Object.freeze([
  createBuff({
    id: 'soul_font_vigor',
    name: 'Whisper of Iron Vigor',
    description: '+25% Health · All demons',
    icon: 'heart',
    effects: [{ type: 'max_hp_mult', value: 1.25 }]
  }),
  createBuff({
    id: 'soul_font_severing',
    name: 'Whisper of the Severed Thread',
    description: '+18% Single-target Damage · All demons',
    icon: 'swords',
    effects: [{ type: 'direct_damage_mult', value: 1.18 }]
  }),
  createBuff({
    id: 'soul_font_chorus',
    name: 'Whisper of the Funeral Pyre',
    description: '+20% AOE Damage · All demons',
    icon: 'flame',
    effects: [{ type: 'aoe_damage_mult', value: 1.2 }]
  }),
  createBuff({
    id: 'soul_font_quickness',
    name: 'Whisper of Stolen Time',
    description: '+15% Attack Speed · All demons',
    icon: 'zap',
    effects: [{ type: 'speed_mult', value: 1.15 }]
  }),
  createBuff({
    id: 'soul_font_renewal',
    name: 'Whisper of Pale Mercy',
    description: '+25% Healing · All demons',
    icon: 'heart-pulse',
    effects: [{ type: 'healing_mult', value: 1.25 }]
  }),
  createBuff({
    id: 'soul_font_venom',
    name: 'Whisper of the Viper',
    description: '+25% Poison Damage · All demons',
    icon: 'flask-conical',
    effects: [{ type: 'poison_tick_damage_mult', value: 1.25 }]
  }),
  createBuff({
    id: 'soul_font_bone_mirror',
    name: 'Whisper of the Bone Mirror',
    description: '+100% Thorns · All demons',
    icon: 'shield',
    effects: [{ type: 'thorns_percent', value: 100 }]
  })
]);

const SOUL_FONT_BUFFS_BY_ID = new Map(SOUL_FONT_BUFFS.map((buff) => [buff.id, buff]));

function createBuff(source) {
  const buff = normalizeCombatBuffState({
    activeBuffs: [{
      ...source,
      source: 'soul_font',
      rarity: 'rare',
      tags: ['World', 'Whispering Well']
    }]
  }).activeBuffs[0];

  return Object.freeze({
    ...buff,
    durationHours: SOUL_FONT_DURATION_HOURS,
    durationSeconds: SOUL_FONT_DURATION_SECONDS
  });
}

function getSoulFontCost(playerLevel = 1) {
  const level = Math.max(1, Math.floor(Number(playerLevel) || 1));
  return SOUL_FONT_BASE_COST + ((level - 1) * SOUL_FONT_COST_PER_LEVEL);
}

async function getWorldSoulFontForPlayer(playerId, options = {}) {
  const playerLevel = options.playerLevel || 1;
  const position = options.position || null;
  const activeBuffs = await getActiveSoulFontBuffs(playerId, options.queryable || db);

  return {
    id: SOUL_FONT_ID,
    name: SOUL_FONT_NAME,
    description: SOUL_FONT_DESCRIPTION,
    x: SOUL_FONT_X,
    y: SOUL_FONT_Y,
    durationHours: SOUL_FONT_DURATION_HOURS,
    price: getSoulFontCost(playerLevel),
    ritualId: createSoulFontRitualId(),
    activeBuff: activeBuffs[0] || null,
    canOffer: isAtSoulFont(position)
  };
}

async function purchaseSoulFontBuff(playerId, requestedRitualId, options = {}) {
  const now = options.now || new Date();
  const ritualId = normalizeSoulFontRitualId(requestedRitualId);
  if (!ritualId) throw createHttpError('Begin a new offering before approaching the Whispering Well.', 400);
  const connection = options.connection || await db.getConnection();
  const ownsConnection = !options.connection;
  let committed = false;

  try {
    await connection.beginTransaction();
    const [playerRows] = await connection.query(
      `SELECT p.*, pd.image_url AS profile_demon_image_url
       FROM players p
       LEFT JOIN player_demons pd
         ON pd.id = p.profile_demon_id
        AND pd.player_id = p.id
       WHERE p.id = ?
       LIMIT 1
       FOR UPDATE`,
      [playerId]
    );
    if (!playerRows.length) throw createHttpError('Hunter not found.', 404);

    const [positionRows] = await connection.query(
      'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1 FOR UPDATE',
      [playerId]
    );
    if (!isAtSoulFont(positionRows[0])) {
      throw createHttpError('Stand before the Whispering Well to make an offering.', 409);
    }

    const [existingRows] = await connection.query(
      `SELECT buff_id AS buffId,
              offer_set_id AS ritualId,
              UNIX_TIMESTAMP(expires_at) AS expiresAtSeconds
     FROM player_world_soul_font_buffs
     WHERE player_id = ?
       ORDER BY expires_at DESC
       FOR UPDATE`,
      [playerId]
    );
    const existing = existingRows.find((row) => String(row.ritualId || '') === ritualId)
      || existingRows[0];
    const existingExpiresAt = unixSecondsToIsoString(existing?.expiresAtSeconds);
    const existingBuff = SOUL_FONT_BUFFS_BY_ID.get(String(existing?.buffId || ''));
    const existingBuffIsActive = Boolean(
      existingBuff
      && Number(existing?.expiresAtSeconds) > Math.floor(now.getTime() / 1000)
    );
    if (String(existing?.ritualId || '') === ritualId && existingBuff) {
      await connection.commit();
      committed = true;
      return {
        buff: {
          ...existingBuff,
          expiresAt: existingExpiresAt
        },
        charged: false,
        price: 0,
        player: cleanPlayer(playerRows[0])
      };
    }

    const availableSouls = Math.max(0, Math.floor(Number(playerRows[0].souls) || 0));
    const price = getSoulFontCost(playerRows[0].level);
    if (availableSouls < price) {
      throw createHttpError(`You need ${formatSoulCount(price)} to make an offering at the Whispering Well.`, 409);
    }

    const offeredBuff = selectRandomSoulFontBuff(
      options.randomInt || randomInt,
      existingBuffIsActive ? existingBuff.id : null
    );
    const awardedAtSeconds = Math.floor(now.getTime() / 1000);
    const expiresAtSeconds = awardedAtSeconds + SOUL_FONT_DURATION_SECONDS;
    await connection.query('UPDATE players SET souls = souls - ? WHERE id = ?', [price, playerId]);
    // Normal offerings still replace the current blessing. Multiple distinct
    // rows only arise when account merging preserves both hunters' live buffs.
    await connection.query('DELETE FROM player_world_soul_font_buffs WHERE player_id = ?', [playerId]);
    await connection.query(
      `INSERT INTO player_world_soul_font_buffs
         (player_id, buff_id, offer_set_id, price, awarded_at, expires_at)
       VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))
       ON DUPLICATE KEY UPDATE
         buff_id = VALUES(buff_id),
         offer_set_id = VALUES(offer_set_id),
         price = VALUES(price),
         awarded_at = VALUES(awarded_at),
         expires_at = VALUES(expires_at)`,
      [playerId, offeredBuff.id, ritualId, price, awardedAtSeconds, expiresAtSeconds]
    );

    await connection.commit();
    committed = true;

    return {
      buff: {
        ...offeredBuff,
        expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
      },
      charged: true,
      price,
      player: cleanPlayer({
        ...playerRows[0],
        souls: availableSouls - price
      })
    };
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function getActiveSoulFontBuffs(playerOrId, queryable = db) {
  const playerId = typeof playerOrId === 'object' ? playerOrId?.id : playerOrId;
  if (!playerId) return [];

  const [rows] = await queryable.query(
    `SELECT buff_id AS buffId,
            UNIX_TIMESTAMP(expires_at) AS expiresAtSeconds
     FROM player_world_soul_font_buffs
     WHERE player_id = ?
       AND expires_at > CURRENT_TIMESTAMP
      ORDER BY expires_at DESC`,
    [playerId]
  );

  return rows.map((row) => {
    const buff = SOUL_FONT_BUFFS_BY_ID.get(String(row.buffId));
    if (!buff) return null;
    return {
      ...buff,
      expiresAt: unixSecondsToIsoString(row.expiresAtSeconds)
    };
  }).filter(Boolean);
}

function isAtSoulFont(position = {}) {
  return Number(position?.x) === SOUL_FONT_X && Number(position?.y) === SOUL_FONT_Y;
}

function createSoulFontRitualId() {
  return `ritual:${randomUUID()}`;
}

function normalizeSoulFontRitualId(value) {
  const ritualId = String(value || '').trim();
  return /^ritual:[a-z0-9_-]{16,64}$/i.test(ritualId) ? ritualId : '';
}

function selectRandomSoulFontBuff(randomSource = randomInt, excludedBuffId = null) {
  const normalizedExcludedBuffId = String(excludedBuffId || '');
  const availableBuffs = normalizedExcludedBuffId
    ? SOUL_FONT_BUFFS.filter((buff) => buff.id !== normalizedExcludedBuffId)
    : SOUL_FONT_BUFFS;
  const index = Math.floor(Number(randomSource(availableBuffs.length)));
  if (!Number.isInteger(index) || index < 0 || index >= availableBuffs.length) {
    throw new Error('Whispering Well random source returned an invalid blessing index.');
  }
  return availableBuffs[index];
}

function unixSecondsToIsoString(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return new Date(Math.floor(seconds) * 1000).toISOString();
}

function formatSoulCount(value) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'Soul' : 'Souls'}`;
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  SOUL_FONT_BASE_COST,
  SOUL_FONT_BUFFS,
  SOUL_FONT_COST_PER_LEVEL,
  SOUL_FONT_DURATION_HOURS,
  SOUL_FONT_DURATION_SECONDS,
  SOUL_FONT_ID,
  SOUL_FONT_X,
  SOUL_FONT_Y,
  getActiveSoulFontBuffs,
  getSoulFontCost,
  getWorldSoulFontForPlayer,
  isAtSoulFont,
  purchaseSoulFontBuff,
  selectRandomSoulFontBuff
};
