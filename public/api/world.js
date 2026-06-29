const express = require('express');
const db = require('./lib/db');
const { cleanPlayer, requireAuth } = require('./lib/auth');
const { getNextAccountLevel } = require('./lib/progression');
const {
  ANCHOR_SUCCESS_MESSAGE,
  getAmbushDefeatReturn,
  getBoundShrine,
  getShrineAt,
  getWorldShrines,
  saveBoundShrine
} = require('./lib/world-shrines');
const {
  calculateHuntRewards,
  createHuntSnapshot,
  getActiveWorldTeam,
  getActiveWorldTeamSummary,
  saveActiveWorldTeam,
  simulateTryHunt,
  simulateWorldAmbush
} = require('./lib/world-combat');
const { enrichCollectionDemonsWithTraining } = require('./lib/demon-training');
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
const AMBUSH_CHANCE_ON_ROAD = 34; // roads are watched but far safer to travel

const MOCK_PLAYERS = [
  { id: 'mock-ember-duelist', username: 'Ember Duelist', level: 6, x: 2, y: -1 },
  { id: 'mock-veil-hunter', username: 'Veil Hunter', level: 9, x: -4, y: 3 }
];

router.get('/world/state', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);
  const [playersAt, activeWorldTeam, boundShrine, hunt] = await Promise.all([
    getPlayersAt(position.x, position.y, req.player.id),
    getActiveWorldTeam(req.player.id),
    getBoundShrine(req.player.id),
    getHuntState(req.player.id)
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
    activeTeam: getActiveWorldTeamSummary(activeWorldTeam),
    hunt
  });
});

router.get('/world/team', requireAuth, async (req, res) => {
  const [team, collection] = await Promise.all([
    getActiveWorldTeam(req.player.id),
    getWorldTeamCollection(req.player.id)
  ]);

  res.json({
    team,
    activeTeam: getActiveWorldTeamSummary(team),
    collection
  });
});

router.post('/world/team', requireAuth, async (req, res) => {
  const saveResult = await saveActiveWorldTeam(req.player.id, req.body?.team || [], {
    includeChanged: true
  });
  const reset = saveResult.changed
    ? await settleActiveHunt(req.player, { clearUnlocks: true })
    : null;

  res.json({
    ok: true,
    team: saveResult.team,
    teamChanged: saveResult.changed,
    activeTeam: getActiveWorldTeamSummary(saveResult.team),
    ...(reset ? {
      player: reset.player,
      rewards: reset.rewards,
      huntingReset: {
        stoppedHunt: reset.stoppedHunt,
        clearedUnlocks: reset.clearedUnlocks
      },
      hunt: reset.hunt
    } : {})
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
    travelEvents: await resolveTravelEvents(req.player, travelEvents)
  });
});

router.post('/world/hunt/try', requireAuth, async (req, res) => {
  const encounter = getEncounterById(req.body?.encounterId);
  if (!encounter) {
    return res.status(404).json({ error: 'Demon spot not found.' });
  }

  const battle = await simulateTryHunt(req.player, encounter);
  const unlocked = battle.winner === 'player';

  if (unlocked) {
    await unlockHunt(req.player.id, encounter.id);
  }

  res.json({
    unlocked,
    battle,
    hunt: await getHuntState(req.player.id)
  });
});

router.post('/world/hunting/start', requireAuth, async (req, res) => {
  const encounter = getEncounterById(req.body?.encounterId);
  if (!encounter) {
    return res.status(404).json({ error: 'Demon spot not found.' });
  }

  if (!(await isHuntUnlocked(req.player.id, encounter.id))) {
    return res.status(409).json({ error: 'Win a fight before starting passive hunting.' });
  }

  const active = await getActiveHunt(req.player.id);
  if (active) {
    return res.status(409).json({ error: 'Stop your current hunt before starting another.' });
  }

  const snapshot = await createHuntSnapshot(req.player, encounter);
  await db.query(
    `INSERT INTO player_active_hunts
       (player_id, encounter_id, snapshot, started_at, enemy_respawn_seconds)
     VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)`,
    [
      req.player.id,
      encounter.id,
      JSON.stringify(snapshot),
      Math.floor(Date.parse(snapshot.startedAt) / 1000),
      snapshot.enemyRespawnSeconds
    ]
  );

  res.json({
    ok: true,
    hunt: await getHuntState(req.player.id)
  });
});

router.post('/world/hunting/stop', requireAuth, async (req, res) => {
  res.json(await settleActiveHunt(req.player));
});

router.get('/world/hunting/status', requireAuth, async (req, res) => {
  res.json(await getHuntState(req.player.id));
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
  return getActiveWorldTeamSummary(await getActiveWorldTeam(playerId));
}

async function getWorldTeamCollection(playerId) {
  const [rows] = await db.query(
    `SELECT id,
            source_demon_id AS sourceDemonId,
            type_id AS typeId,
            species,
            rarity,
            image_url AS imageUrl,
            hp,
            atk,
            speed,
            created_at AS createdAt
     FROM player_demons
     WHERE player_id = ?
     ORDER BY created_at DESC, id DESC`,
    [playerId]
  );

  return enrichCollectionDemonsWithTraining(rows);
}

async function resolveTravelEvents(player, travelEvents = []) {
  const resolved = [];

  for (const event of travelEvents) {
    if (event.type !== 'ambush') {
      resolved.push(event);
      continue;
    }

    let battle = null;
    try {
      battle = await simulateWorldAmbush(player, event.position, WORLD_ENCOUNTERS);
    } catch (error) {
      if (!error.status || error.status >= 500) throw error;
      battle = {
        error: error.message
      };
    }
    resolved.push({
      ...event,
      battle
    });
  }

  return resolved;
}

async function settleActiveHunt(player, options = {}) {
  const clearUnlocks = Boolean(options.clearUnlocks);
  const connection = await db.getConnection();
  let committed = false;
  let rewards = createEmptyHuntRewards();
  let stoppedHunt = false;
  let clearedUnlocks = 0;
  // `player` is req.player, which requireAuth already passed through cleanPlayer.
  // The DB row fetched below is the raw shape that still needs cleaning.
  let playerPayload = player;

  try {
    await connection.beginTransaction();

    const [huntRows] = await connection.query(
      'SELECT * FROM player_active_hunts WHERE player_id = ? LIMIT 1 FOR UPDATE',
      [player.id]
    );

    if (huntRows.length) {
      const snapshot = parseHuntSnapshot(huntRows[0].snapshot);
      rewards = await calculateHuntRewards(snapshot, new Date());

      const [lockedRows] = await connection.query(
        'SELECT level, xp FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
        [player.id]
      );
      const currentLevel = Number(lockedRows[0]?.level) || 1;
      const currentXp = Number(lockedRows[0]?.xp) || 0;
      const nextXp = currentXp + (Number(rewards.xp) || 0);
      const nextLevel = getNextAccountLevel(currentLevel, nextXp);

      await connection.query(
        'UPDATE players SET xp = ?, souls = souls + ?, level = ? WHERE id = ?',
        [nextXp, rewards.souls, nextLevel, player.id]
      );
      await connection.query(
        'DELETE FROM player_active_hunts WHERE player_id = ?',
        [player.id]
      );

      stoppedHunt = true;
    }

    if (clearUnlocks) {
      const [result] = await connection.query(
        'DELETE FROM player_hunt_unlocks WHERE player_id = ?',
        [player.id]
      );
      clearedUnlocks = Number(result?.affectedRows) || 0;
    }

    const [playerRows] = await connection.query(
      'SELECT * FROM players WHERE id = ? LIMIT 1',
      [player.id]
    );
    playerPayload = playerRows[0] ? cleanPlayer(playerRows[0]) : playerPayload;

    await connection.commit();
    committed = true;
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }

  return {
    ok: true,
    alreadyStopped: !stoppedHunt,
    stoppedHunt,
    rewards,
    player: playerPayload,
    clearedUnlocks,
    hunt: await getHuntState(player.id)
  };
}

async function getHuntState(playerId) {
  const [unlockRows, activeRows] = await Promise.all([
    db.query('SELECT encounter_id AS encounterId, unlocked_at AS unlockedAt FROM player_hunt_unlocks WHERE player_id = ?', [playerId]),
    db.query('SELECT encounter_id AS encounterId, snapshot, started_at AS startedAt, enemy_respawn_seconds AS enemyRespawnSeconds FROM player_active_hunts WHERE player_id = ? LIMIT 1', [playerId])
  ]);
  const active = activeRows[0][0] || null;

  return {
    unlockedEncounterIds: unlockRows[0].map((row) => row.encounterId),
    active: active ? serializeActiveHunt(active) : null
  };
}

async function isHuntUnlocked(playerId, encounterId) {
  const [rows] = await db.query(
    'SELECT 1 FROM player_hunt_unlocks WHERE player_id = ? AND encounter_id = ? LIMIT 1',
    [playerId, encounterId]
  );
  return rows.length > 0;
}

async function unlockHunt(playerId, encounterId) {
  await db.query(
    `INSERT INTO player_hunt_unlocks (player_id, encounter_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE unlocked_at = unlocked_at`,
    [playerId, encounterId]
  );
}

async function getActiveHunt(playerId) {
  const [rows] = await db.query(
    'SELECT encounter_id AS encounterId, snapshot, started_at AS startedAt, enemy_respawn_seconds AS enemyRespawnSeconds FROM player_active_hunts WHERE player_id = ? LIMIT 1',
    [playerId]
  );
  return rows[0] || null;
}

function serializeActiveHunt(row) {
  const snapshot = parseHuntSnapshot(row.snapshot);
  return {
    encounterId: row.encounterId,
    startedAt: snapshot.startedAt || row.startedAt,
    enemyRespawnSeconds: Number(snapshot.enemyRespawnSeconds || row.enemyRespawnSeconds) || 0,
    activeTeamCount: Array.isArray(snapshot.activeTeam) ? snapshot.activeTeam.length : 0,
    activeBuffs: Array.isArray(snapshot.activeSkillTreeBuffs) ? snapshot.activeSkillTreeBuffs : []
  };
}

function parseHuntSnapshot(value) {
  try {
    return JSON.parse(value || '{}');
  } catch (error) {
    return {};
  }
}

function createEmptyHuntRewards() {
  return {
    elapsedSeconds: 0,
    cycles: 0,
    wins: 0,
    xp: 0,
    souls: 0
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

function getEncounterById(encounterId) {
  const id = String(encounterId || '').trim();
  if (!id) return null;
  return WORLD_ENCOUNTERS.find((encounter) => String(encounter.id) === id) || null;
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
  if (!isAmbushEligibleTile(position.x, position.y)) {
    return { type: 'none', title: 'No Event' };
  }

  const ambushChance = isRoad(position.x, position.y) ? AMBUSH_CHANCE_ON_ROAD : AMBUSH_CHANCE_OFF_ROAD;
  const roll = (getTileNoise(position.x, position.y) + stepIndex * 17) % ambushChance;
  return roll === 0
    ? { type: 'ambush', title: 'Ambush' }
    : { type: 'none', title: 'No Event' };
}

function isAmbushEligibleTile(x, y) {
  return !getEventAt(x, y) && !getEncounterAt(x, y);
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

router._test = {
  isAmbushEligibleTile,
  resolveTravelStepEvent
};

module.exports = router;
