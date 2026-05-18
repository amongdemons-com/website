const crypto = require('crypto');
const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { createRng } = require('../lib/rng');
const { createTeam } = require('../lib/demon-factory');
const { STARTER_TYPE_IDS, createHuntEnemies } = require('../lib/hunt-enemies');
const { closeOpenRunsForPlayer } = require('../lib/runs');
const { createRunDemonFromCollection, enrichDemonPreferredPositions, resetRunDemon } = require('../lib/run-demons');

const router = express.Router();
const draftTokenSecret = crypto.randomBytes(32);

router.get('/runs/start-options', requireAuth, async (req, res) => {
  const draftSeed = crypto.randomInt(1, 4294967295);
  const draft = await createTeam(createRng(draftSeed), 3, {
    prefix: 'draft',
    allowedTypeIds: STARTER_TYPE_IDS,
    allowedRarities: ['common', 'uncommon', 'rare']
  });
  const [collection] = await db.query(
    `SELECT id, source_demon_id AS sourceDemonId, type_id AS typeId, species, rarity,
            image_url AS imageUrl, hp, atk, speed, created_at AS createdAt
     FROM player_demons
     WHERE player_id = ?
     ORDER BY created_at DESC, id DESC`,
    [req.player.id]
  );

  res.json({
    draft,
    draftToken: signDraftToken({
      playerId: req.player.id,
      draftSeed,
      expiresAt: Date.now() + 15 * 60 * 1000
    }),
    collection: await enrichDemonPreferredPositions(collection)
  });
});

router.post('/runs/start', requireAuth, async (req, res) => {
  const runId = crypto.randomUUID();
  const seed = crypto.randomInt(1, 4294967295);
  const starter = await getStarterDemon(req);
  const startingTeam = [resetRunDemon(starter, 'player-1')];
  const enemies = await createHuntEnemies(createRng(seed + 1), 1, startingTeam.length);
  const state = {
    currentFloor: 1,
    hp: startingTeam.reduce((sum, demon) => sum + demon.hp, 0),
    team: startingTeam,
    enemies,
    mapProgress: [{ floor: 1, type: 'battle', status: 'available' }]
  };
  const rewards = [];

  await closeOpenRunsForPlayer(req.player.id);

  await db.query(
    `INSERT INTO runs (id, player_id, seed, status, floor, state, rewards)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [runId, req.player.id, seed, 'active', 1, JSON.stringify(state), JSON.stringify(rewards)]
  );

  res.status(201).json({
    runId,
    seed,
    startingTeam
  });
});

async function getStarterDemon(req) {
  const source = String(req.body.source || 'draft');

  if (source === 'collection') {
    const demonId = Number(req.body.demonId);
    if (!demonId) {
      const error = new Error('demonId is required.');
      error.status = 400;
      throw error;
    }

    const [rows] = await db.query(
      `SELECT id, source_demon_id, type_id, species, rarity, image_url, hp, atk, speed
       FROM player_demons
       WHERE id = ? AND player_id = ?
       LIMIT 1`,
      [demonId, req.player.id]
    );

    if (!rows.length) {
      const error = new Error('Collection demon not found.');
      error.status = 404;
      throw error;
    }

    return createRunDemonFromCollection(rows[0], 'player-1');
  }

  const draftToken = String(req.body.draftToken || '');
  const draftIndex = Number(req.body.draftIndex);
  if (!draftToken || !Number.isInteger(draftIndex) || draftIndex < 0 || draftIndex > 2) {
    const error = new Error('draftToken and draftIndex are required.');
    error.status = 400;
    throw error;
  }

  const draftData = verifyDraftToken(draftToken, req.player.id);
  const draft = await createTeam(createRng(draftData.draftSeed), 3, {
    prefix: 'draft',
    allowedTypeIds: STARTER_TYPE_IDS,
    allowedRarities: ['common', 'uncommon', 'rare']
  });
  return draft[draftIndex];
}

function signDraftToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', draftTokenSecret)
    .update(body)
    .digest('base64url');

  return `${body}.${signature}`;
}

function verifyDraftToken(token, playerId) {
  const [body, signature] = token.split('.');
  if (!body || !signature) {
    throwDraftTokenError();
  }

  const expected = crypto
    .createHmac('sha256', draftTokenSecret)
    .update(body)
    .digest('base64url');

  if (!safeEqual(signature, expected)) {
    throwDraftTokenError();
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (error) {
    throwDraftTokenError();
  }

  if (payload.playerId !== playerId || !payload.draftSeed || Date.now() > Number(payload.expiresAt)) {
    throwDraftTokenError();
  }

  return payload;
}

function safeEqual(value, expected) {
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(valueBuffer, expectedBuffer);
}

function throwDraftTokenError() {
  const error = new Error('Draft starter choices have expired. Refresh and choose again.');
  error.status = 400;
  throw error;
}

module.exports = router;
