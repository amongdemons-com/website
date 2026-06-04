const crypto = require('crypto');
const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { createRng } = require('../lib/rng');
const { createTeam } = require('../lib/demon-factory');
const { STARTER_TYPE_IDS } = require('../lib/hunt-enemies');
const { closeOpenRunsForPlayer } = require('../lib/runs');
const { enrichDemonPreferredPositions, resetRunDemon } = require('../lib/run-demons');

const router = express.Router();
const draftTokenSecret = crypto.randomBytes(32);
const DRAFT_STARTER_COUNT = 2;

router.get('/runs/start-options', requireAuth, async (req, res) => {
  const draftSeed = crypto.randomInt(1, 4294967295);
  const draft = await createTeam(createRng(draftSeed), DRAFT_STARTER_COUNT, {
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
  const draft = await getStartingDraft(req);
  const startingHand = draft.map((demon, index) => resetRunDemon(demon, `recruit-0-${index + 1}`));
  const state = {
    currentFloor: 0,
    hp: 0,
    team: [],
    enemies: [],
    awaitingRecruit: true,
    awaitingCollectionReinforcement: true,
    collectionReinforcementLimit: 2,
    buffs: {
      active: [],
      pendingChoices: [],
      temporary: []
    }
  };
  const rewards = startingHand.map((demon, index) => ({
    rewardId: index + 1,
    floor: 0,
    type: 'recruit',
    demon,
    claimed: false,
    recruited: false
  }));

  await closeOpenRunsForPlayer(req.player.id);

  await db.query(
    `INSERT INTO runs (id, player_id, seed, status, floor, state, rewards)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [runId, req.player.id, seed, 'active', 0, JSON.stringify(state), JSON.stringify(rewards)]
  );

  res.status(201).json({
    runId,
    seed,
    startingHand
  });
});

async function getStartingDraft(req) {
  const draftToken = req.body?.draftToken;
  const draftSeed = draftToken
    ? verifyDraftToken(String(draftToken), req.player.id).draftSeed
    : crypto.randomInt(1, 4294967295);

  return createTeam(createRng(draftSeed), DRAFT_STARTER_COUNT, {
    prefix: 'draft',
    allowedTypeIds: STARTER_TYPE_IDS,
    allowedRarities: ['common', 'uncommon', 'rare']
  });
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
  const error = new Error('Starting hand options have expired. Refresh and try again.');
  error.status = 400;
  throw error;
}

module.exports = router;
