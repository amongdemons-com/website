const db = require('./db');
const worldMap = require('../data/map.json');

const SHRINE_TYPE = 'forsaken_shrine';
const ANCHOR_SUCCESS_MESSAGE = 'Soul anchored. You will return to this Forsaken Shrine if defeated.';
const AMBUSH_DEFEAT_ANCHORED_MESSAGE = 'You were defeated and dragged back to your Anchored Shrine.';
const AMBUSH_DEFEAT_SPAWN_MESSAGE = 'You were defeated and dragged back to camp.';
const WORLD_SPAWN = worldMap.spawn || { x: 0, y: 0 };
const WORLD_EVENTS = Array.isArray(worldMap.events) ? worldMap.events : [];
const WORLD_SHRINES = WORLD_EVENTS.filter((event) => event?.type === SHRINE_TYPE);

function getWorldShrines() {
  return WORLD_SHRINES.map(serializeShrine);
}

function getShrineAt(x, y) {
  const shrine = WORLD_SHRINES.find((event) => Number(event.x) === Number(x) && Number(event.y) === Number(y));
  return serializeShrine(shrine);
}

async function getBoundShrine(playerId) {
  const [rows] = await db.query(
    'SELECT x, y FROM player_bound_world_shrines WHERE player_id = ? LIMIT 1',
    [playerId]
  );

  if (!rows.length) return getDefaultBoundShrine();
  return getShrineAt(rows[0].x, rows[0].y);
}

function getDefaultBoundShrine() {
  return getShrineAt(WORLD_SPAWN.x, WORLD_SPAWN.y);
}

async function saveBoundShrine(playerId, shrine, client = db) {
  const normalized = serializeShrine(shrine);
  if (!normalized) {
    const error = new Error('Choose a valid Forsaken Shrine.');
    error.status = 400;
    throw error;
  }

  await client.query(
    `INSERT INTO player_bound_world_shrines (player_id, x, y)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE x = VALUES(x), y = VALUES(y), updated_at = CURRENT_TIMESTAMP`,
    [playerId, normalized.x, normalized.y]
  );

  return normalized;
}

async function saveDefaultBoundShrine(playerId, client = db) {
  const defaultShrine = getDefaultBoundShrine();
  if (!defaultShrine) return null;
  return saveBoundShrine(playerId, defaultShrine, client);
}

function getAmbushDefeatReturn(boundShrine) {
  const shrine = serializeShrine(boundShrine);

  if (shrine) {
    return {
      position: { x: shrine.x, y: shrine.y },
      boundShrine: shrine,
      returnPoint: 'anchored_shrine',
      message: AMBUSH_DEFEAT_ANCHORED_MESSAGE
    };
  }

  return {
    position: { x: Number(WORLD_SPAWN.x) || 0, y: Number(WORLD_SPAWN.y) || 0 },
    boundShrine: null,
    returnPoint: 'spawn',
    message: AMBUSH_DEFEAT_SPAWN_MESSAGE
  };
}

function serializeShrine(shrine) {
  if (!shrine || shrine.type !== SHRINE_TYPE) return null;

  const x = Number(shrine.x);
  const y = Number(shrine.y);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;

  return {
    x,
    y,
    type: SHRINE_TYPE,
    title: shrine.title || 'Forsaken Shrine',
    description: shrine.description || ''
  };
}

module.exports = {
  SHRINE_TYPE,
  ANCHOR_SUCCESS_MESSAGE,
  AMBUSH_DEFEAT_ANCHORED_MESSAGE,
  AMBUSH_DEFEAT_SPAWN_MESSAGE,
  getAmbushDefeatReturn,
  getBoundShrine,
  getDefaultBoundShrine,
  getShrineAt,
  getWorldShrines,
  saveDefaultBoundShrine,
  saveBoundShrine,
  serializeShrine
};
