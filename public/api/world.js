const express = require('express');
const db = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { getCurrentRunForPlayer } = require('./lib/runs');
const {
  ANCHOR_SUCCESS_MESSAGE,
  getAmbushDefeatReturn,
  getBoundShrine,
  getShrineAt,
  getWorldShrines,
  saveBoundShrine
} = require('./lib/world-shrines');
const worldMap = require('./data/map.json');

const router = express.Router();
const WORLD_MIN = worldMap.bounds?.min ?? -50;
const WORLD_MAX = worldMap.bounds?.max ?? 50;
const WORLD_SPAWN = worldMap.spawn || { x: 0, y: 0 };
const MAX_TRAVEL_STEPS = 256;
const CHALLENGE_COOLDOWN_MS = 30 * 1000;
const challengeCooldowns = new Map();

// World elements (events/objects, unpassable blocks, and demon-team encounters) live in
// data/map.json so the map can be regenerated without touching this route.
const WORLD_BLOCKS = Array.isArray(worldMap.blocks) ? worldMap.blocks : [];
const WORLD_ENCOUNTERS = Array.isArray(worldMap.encounters) ? worldMap.encounters : [];
const WORLD_EVENTS = Array.isArray(worldMap.events) ? worldMap.events : [];
const WORLD_ROADS = Array.isArray(worldMap.roads) ? worldMap.roads : [];
const ROAD_TILES = new Set(WORLD_ROADS.map((tile) => `${tile.x},${tile.y}`));
const BLOCKED_TILES = new Set(WORLD_BLOCKS.map((tile) => `${tile.x},${tile.y}`));
const AMBUSH_CHANCE_OFF_ROAD = 7; // 1-in-N chance to be ambushed per step
const AMBUSH_CHANCE_ON_ROAD = 34; // roads are patrolled — far safer to travel

const MOCK_PLAYERS = [
  { id: 'mock-ember-duelist', username: 'Ember Duelist', level: 6, x: 2, y: -1 },
  { id: 'mock-veil-hunter', username: 'Veil Hunter', level: 9, x: -4, y: 3 }
];

router.get('/world/state', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);
  const [playersAt, activeTeam, boundShrine] = await Promise.all([
    getPlayersAt(position.x, position.y, req.player.id),
    getActiveTeamSummary(req.player.id),
    getBoundShrine(req.player.id)
  ]);

  res.json({
    player: getWorldPlayer(req.player),
    position,
    bounds: { min: WORLD_MIN, max: WORLD_MAX },
    events: WORLD_EVENTS,
    blockedTiles: WORLD_BLOCKS,
    roads: WORLD_ROADS,
    encounters: WORLD_ENCOUNTERS,
    shrines: getWorldShrines(),
    boundShrine,
    currentEvent: getEventAt(position.x, position.y),
    currentEncounter: getEncounterAt(position.x, position.y),
    playersAt,
    activeTeam
  });
});

router.get('/world/shrine', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);

  res.json({
    position,
    currentShrine: getShrineAt(position.x, position.y),
    boundShrine: await getBoundShrine(req.player.id)
  });
});

router.post('/world/shrine/bind', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);
  const shrine = getShrineAt(position.x, position.y);

  if (!shrine) {
    return res.status(409).json({ error: 'Stand on a Forsaken Shrine to anchor your soul.' });
  }

  const boundShrine = await saveBoundShrine(req.player.id, shrine);

  res.json({
    ok: true,
    position,
    currentShrine: shrine,
    boundShrine,
    message: ANCHOR_SUCCESS_MESSAGE
  });
});

router.post('/world/move', requireAuth, async (req, res) => {
  const currentPosition = await getOrCreatePosition(req.player.id);
  const position = normalizePosition(req.body?.position || req.body);
  const path = normalizeTravelPath(req.body?.path);
  const travelEvents = path.length
    ? validateTravelPath(currentPosition, position, path)
    : [];

  await savePosition(req.player.id, position);

  const playersAt = await getPlayersAt(position.x, position.y, req.player.id);
  res.json({
    position,
    currentEvent: getEventAt(position.x, position.y),
    currentEncounter: getEncounterAt(position.x, position.y),
    playersAt,
    travelEvents
  });
});

router.post('/world/ambush-defeat', requireAuth, async (req, res) => {
  const result = getAmbushDefeatReturn(await getBoundShrine(req.player.id));

  await savePosition(req.player.id, result.position);

  res.json({
    ...result,
    currentEvent: getEventAt(result.position.x, result.position.y),
    currentEncounter: getEncounterAt(result.position.x, result.position.y),
    playersAt: await getPlayersAt(result.position.x, result.position.y, req.player.id)
  });
});

router.get('/world/players-at', requireAuth, async (req, res) => {
  const position = normalizePosition(req.query);
  res.json({
    position,
    playersAt: await getPlayersAt(position.x, position.y, req.player.id)
  });
});

router.post('/world/challenge', requireAuth, async (req, res) => {
  const targetPlayerId = String(req.body?.targetPlayerId || '').trim();

  if (!targetPlayerId) {
    return res.status(400).json({ error: 'Choose a player to challenge.' });
  }

  const cooldownKey = `${req.player.id}:${targetPlayerId}`;
  const cooldownUntil = challengeCooldowns.get(cooldownKey) || 0;

  if (cooldownUntil > Date.now()) {
    return res.status(429).json({
      error: 'Challenge cooldown is active.',
      cooldownUntil: new Date(cooldownUntil).toISOString()
    });
  }

  // TODO: Replace this placeholder with a real PvP challenge queue or match invite.
  const nextCooldownUntil = Date.now() + CHALLENGE_COOLDOWN_MS;
  challengeCooldowns.set(cooldownKey, nextCooldownUntil);

  res.json({
    ok: true,
    status: 'placeholder',
    message: 'Challenge placeholder accepted.',
    cooldownUntil: new Date(nextCooldownUntil).toISOString()
  });
});

async function getOrCreatePosition(playerId) {
  const [rows] = await db.query(
    'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1',
    [playerId]
  );

  if (rows.length) {
    const position = normalizePosition(rows[0], { allowBlocked: true });
    if (!isBlocked(position.x, position.y)) return position;

    const fallbackPosition = { ...WORLD_SPAWN };
    await savePosition(playerId, fallbackPosition);
    return fallbackPosition;
  }

  const position = { ...WORLD_SPAWN };
  await savePosition(playerId, position);
  return position;
}

async function savePosition(playerId, position) {
  // TODO: Move persistence into a world service once exploration has server-side rules.
  await db.query(
    `INSERT INTO player_world_positions (player_id, x, y)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE x = VALUES(x), y = VALUES(y), updated_at = CURRENT_TIMESTAMP`,
    [playerId, position.x, position.y]
  );
}

async function getPlayersAt(x, y, currentPlayerId) {
  // TODO: Replace mock players with live online-presence rows when PvP is implemented.
  const [rows] = await db.query(
    `SELECT p.id, p.username, p.level, wp.x, wp.y
     FROM player_world_positions wp
     INNER JOIN players p ON p.id = wp.player_id
     WHERE wp.x = ?
       AND wp.y = ?
       AND wp.player_id <> ?
     ORDER BY wp.updated_at DESC
     LIMIT 8`,
    [x, y, currentPlayerId]
  );

  const mockRows = MOCK_PLAYERS.filter((player) => player.x === x && player.y === y);
  return [...rows, ...mockRows].map((player) => ({
    id: player.id,
    username: player.username || 'Unknown Hunter',
    level: Math.max(1, Number(player.level) || 1),
    x: Number(player.x) || 0,
    y: Number(player.y) || 0
  }));
}

async function getActiveTeamSummary(playerId) {
  // TODO: Swap this for the future camp team API once teams exist outside dungeon runs.
  const run = await getCurrentRunForPlayer(playerId);
  const team = Array.isArray(run?.state?.team) ? run.state.team : [];

  return {
    source: team.length ? 'current-run' : 'none',
    count: team.length,
    members: team.slice(0, 4).map((demon) => ({
      instanceId: demon.instanceId || demon.id || null,
      species: demon.species || 'Demon',
      rarity: demon.rarity || 'common',
      hp: Number(demon.hp) || 0,
      atk: Number(demon.atk) || 0,
      speed: Number(demon.speed) || 0,
      imageUrl: demon.imageUrl || demon.image_url || ''
    }))
  };
}

function getWorldPlayer(player) {
  return {
    id: player.id,
    username: player.username || 'Hunter',
    level: Math.max(1, Number(player.level) || 1),
    profileDemonImageUrl: player.profileDemonImageUrl || null
  };
}

function getEventAt(x, y) {
  return WORLD_EVENTS.find((event) => event.x === x && event.y === y) || null;
}

function getEncounterAt(x, y) {
  return WORLD_ENCOUNTERS.find((encounter) => encounter.x === x && encounter.y === y) || null;
}

function normalizeTravelPath(value) {
  if (value === undefined) return [];

  if (!Array.isArray(value)) {
    throwWorldError('Travel path must be an array of coordinates.');
  }

  if (value.length > MAX_TRAVEL_STEPS + 1) {
    throwWorldError(`Travel path cannot exceed ${MAX_TRAVEL_STEPS} steps.`);
  }

  return value.map((position, index) => normalizePosition(position, { allowBlocked: index === 0 }));
}

function validateTravelPath(currentPosition, requestedPosition, path) {
  if (path.length < 2) {
    throwWorldError('Travel path must include a start and destination.');
  }

  if (!positionsEqual(path[0], currentPosition)) {
    throwWorldError('World position changed. Refresh the map and try again.', 409);
  }

  if (!positionsEqual(path[path.length - 1], requestedPosition)) {
    throwWorldError('Travel path destination does not match requested position.');
  }

  path.slice(1).forEach((position, index) => {
    const previous = path[index];
    if (!areAdjacent(previous, position)) {
      throwWorldError('Travel path must move one tile at a time.');
    }
  });

  // TODO: Replace deterministic placeholder rolls with persisted world-event results.
  return path.slice(1).map((position, index) => ({
    ...resolveTravelStepEvent(position, index + 1),
    position
  }));
}

function resolveTravelStepEvent(position, stepIndex) {
  const ambushChance = isRoad(position.x, position.y) ? AMBUSH_CHANCE_ON_ROAD : AMBUSH_CHANCE_OFF_ROAD;
  const roll = (getTileNoise(position.x, position.y) + stepIndex * 17) % ambushChance;
  return roll === 0
    ? { type: 'ambush', title: 'Ambush' }
    : { type: 'none', title: 'No Event' };
}

function normalizePosition(value = {}, options = {}) {
  const x = normalizeCoordinate(value.x);
  const y = normalizeCoordinate(value.y);

  if (x < WORLD_MIN || x > WORLD_MAX || y < WORLD_MIN || y > WORLD_MAX) {
    throwWorldError(`World coordinates must be between ${WORLD_MIN} and ${WORLD_MAX}.`);
  }

  if (!options.allowBlocked && isBlocked(x, y)) {
    throwWorldError('That world tile is blocked.');
  }

  return { x, y };
}

function positionsEqual(a, b) {
  return Number(a?.x) === Number(b?.x) && Number(a?.y) === Number(b?.y);
}

function areAdjacent(a, b) {
  return Math.abs(Number(a.x) - Number(b.x)) + Math.abs(Number(a.y) - Number(b.y)) === 1;
}

function isBlocked(x, y) {
  return BLOCKED_TILES.has(`${x},${y}`);
}

function isRoad(x, y) {
  return ROAD_TILES.has(`${x},${y}`);
}

function getTileNoise(x, y) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function normalizeCoordinate(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throwWorldError('World coordinates must be integers.');
  }

  return number;
}

function throwWorldError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

module.exports = router;
