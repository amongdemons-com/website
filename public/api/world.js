const express = require('express');
const db = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { getCurrentRunForPlayer } = require('./lib/runs');

const router = express.Router();
const WORLD_MIN = -16;
const WORLD_MAX = 16;
const CHALLENGE_COOLDOWN_MS = 30 * 1000;
const challengeCooldowns = new Map();

const WORLD_EVENTS = [
  {
    id: 'boss-ashen-gate',
    type: 'boss',
    title: 'Ashen Gate Warden',
    description: 'A boss fight placeholder waits in the burned road.',
    x: 3,
    y: 2
  },
  {
    id: 'cache-soulglass',
    type: 'soul-cache',
    title: 'Soul Cache',
    description: 'A cracked cache hums with loose souls.',
    x: -2,
    y: 1
  },
  {
    id: 'portal-low-crypt',
    type: 'dungeon-portal',
    title: 'Dungeon Portal',
    description: 'A portal placeholder links back to the dungeon.',
    x: 4,
    y: -3
  }
];

const WORLD_BLOCKS = [
  { x: 1, y: 1, type: 'basalt' },
  { x: 1, y: 2, type: 'basalt' },
  { x: 1, y: 3, type: 'basalt' },
  { x: 2, y: 3, type: 'basalt' },
  { x: 3, y: 3, type: 'basalt' },
  { x: -1, y: -2, type: 'bone-spur' },
  { x: -2, y: -2, type: 'bone-spur' },
  { x: -3, y: -2, type: 'bone-spur' },
  { x: -5, y: 0, type: 'chasm' },
  { x: -5, y: 1, type: 'chasm' },
  { x: -5, y: 2, type: 'chasm' },
  { x: 5, y: 1, type: 'ruin' },
  { x: 6, y: 1, type: 'ruin' },
  { x: 6, y: 0, type: 'ruin' }
];

const MOCK_PLAYERS = [
  { id: 'mock-ember-duelist', username: 'Ember Duelist', level: 6, x: 2, y: -1 },
  { id: 'mock-veil-hunter', username: 'Veil Hunter', level: 9, x: -4, y: 3 }
];

router.get('/world/state', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);
  const [playersAt, activeTeam] = await Promise.all([
    getPlayersAt(position.x, position.y, req.player.id),
    getActiveTeamSummary(req.player.id)
  ]);

  res.json({
    position,
    bounds: { min: WORLD_MIN, max: WORLD_MAX },
    events: WORLD_EVENTS,
    blockedTiles: WORLD_BLOCKS,
    currentEvent: getEventAt(position.x, position.y),
    playersAt,
    activeTeam
  });
});

router.post('/world/move', requireAuth, async (req, res) => {
  const position = normalizePosition(req.body);
  await savePosition(req.player.id, position);

  const playersAt = await getPlayersAt(position.x, position.y, req.player.id);
  res.json({
    position,
    currentEvent: getEventAt(position.x, position.y),
    playersAt
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

    const fallbackPosition = { x: 0, y: 0 };
    await savePosition(playerId, fallbackPosition);
    return fallbackPosition;
  }

  const position = { x: 0, y: 0 };
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

function getEventAt(x, y) {
  return WORLD_EVENTS.find((event) => event.x === x && event.y === y) || null;
}

function normalizePosition(value = {}, options = {}) {
  const x = normalizeCoordinate(value.x);
  const y = normalizeCoordinate(value.y);

  if (x < WORLD_MIN || x > WORLD_MAX || y < WORLD_MIN || y > WORLD_MAX) {
    const error = new Error(`World coordinates must be between ${WORLD_MIN} and ${WORLD_MAX}.`);
    error.status = 400;
    throw error;
  }

  if (!options.allowBlocked && isBlocked(x, y)) {
    const error = new Error('That world tile is blocked.');
    error.status = 400;
    throw error;
  }

  return { x, y };
}

function isBlocked(x, y) {
  return WORLD_BLOCKS.some((tile) => tile.x === x && tile.y === y);
}

function normalizeCoordinate(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    const error = new Error('World coordinates must be integers.');
    error.status = 400;
    throw error;
  }

  return number;
}

module.exports = router;
