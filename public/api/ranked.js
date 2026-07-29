const crypto = require('crypto');
const express = require('express');
const db = require('./lib/db');
const { cleanPlayer, requireAuth } = require('./lib/auth');
const { simulateFight } = require('./lib/combat');
const {
  generateBuffChoices,
  getBuffById,
  selectRunBuff,
  serializeCombatBuffState
} = require('./lib/combat-buffs');
const { getDemonTypes } = require('./lib/game-data');
const { createRng } = require('./lib/rng');
const {
  RANKED_RULES_VERSION,
  RANKED_REROLL_RSOUL_COST,
  STARTING_LIVES,
  getEarlyRunRatingAdjustment,
  getFloorRatingGain,
  getRankedCardCost,
  getRosterValidation,
  resolveDefeat,
  shouldOfferPact
} = require('./lib/ranked-rules');
const {
  applyRankedWorkspace,
  awardRankedSoulInterest,
  createInitialRankedState,
  createLockedRankedBonuses,
  dealOffers,
  getCurrentRankedRun,
  getOrCreateCurrentSeason,
  getOrCreateRankedRating,
  getPlayerBattleBuffs,
  getRankedRun,
  prepareForFight,
  prepareNextSelection,
  resetTeamForBattle,
  saveRankedRun,
  saveReadySnapshot,
  selectOpponent,
  serializeRankedRun
} = require('./lib/ranked-runs');

const router = express.Router();

router.get('/ranked/bootstrap', requireAuth, async (req, res) => {
  const current = await getCurrentRankedRun(req.player.id);
  const season = current
    ? await getSeasonById(current.seasonId)
    : await getOrCreateCurrentSeason();
  const rating = await getOrCreateRankedRating(req.player.id, season.id);

  res.json({
    player: req.player,
    season,
    rating,
    run: current ? await serializeRankedRun(current, rating, season) : null
  });
});

router.get('/ranked/current', requireAuth, async (req, res) => {
  const run = await getCurrentRankedRun(req.player.id);
  if (!run) return res.status(404).json({ error: 'No active Ranked run.' });
  const [season, rating] = await Promise.all([
    getSeasonById(run.seasonId),
    getOrCreateRankedRating(req.player.id, run.seasonId)
  ]);
  res.json(await serializeRankedRun(run, rating, season));
});

router.get('/ranked/runs/:id', requireAuth, async (req, res) => {
  const run = await getRankedRun(req.params.id, req.player.id);
  if (!run) return res.status(404).json({ error: 'Ranked run not found.' });
  const [season, rating] = await Promise.all([
    getSeasonById(run.seasonId),
    getOrCreateRankedRating(req.player.id, run.seasonId)
  ]);
  res.json(await serializeRankedRun(run, rating, season));
});

router.get('/ranked/runs/:id/offers', requireAuth, async (req, res) => {
  const run = await getRankedRun(req.params.id, req.player.id);
  if (!run) return res.status(404).json({ error: 'Ranked run not found.' });
  res.json({
    offers: (run.state.offers || []).map((offer) => ({
      ...offer,
      cost: getRankedCardCost(offer.demon)
    })),
    rerolls: run.state.rerolls || {},
    picksRemaining: Math.max(0, Number(run.state.picksRemaining) || 0)
  });
});

router.post('/ranked/start', requireAuth, async (req, res) => {
  const actionId = requireActionId(req);
  const lockedBonuses = await createLockedRankedBonuses(req.player);
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const duplicate = await claimAction(connection, req.player.id, actionId, null, 'start');
    if (duplicate) {
      await connection.rollback();
      const replayed = await getCurrentRankedRun(req.player.id);
      if (!replayed) return res.status(409).json({ error: 'This start request was already used.' });
      const [replayedSeason, replayedRating] = await Promise.all([
        getSeasonById(replayed.seasonId),
        getOrCreateRankedRating(req.player.id, replayed.seasonId)
      ]);
      return res.json({ run: await serializeRankedRun(replayed, replayedRating, replayedSeason), replayed: true });
    }

    const existing = await getCurrentRankedRun(req.player.id, connection, { forUpdate: true });
    if (existing) {
      await connection.commit();
      committed = true;
      const [existingSeason, existingRating] = await Promise.all([
        getSeasonById(existing.seasonId),
        getOrCreateRankedRating(req.player.id, existing.seasonId)
      ]);
      return res.json({ run: await serializeRankedRun(existing, existingRating, existingSeason), resumed: true });
    }

    const season = await getOrCreateCurrentSeason(connection);
    const rating = await getOrCreateRankedRating(req.player.id, season.id, connection, { forUpdate: true });
    const runId = crypto.randomUUID();
    const seed = crypto.randomInt(1, 4294967295);
    const state = await createInitialRankedState(seed);
    const run = {
      id: runId,
      playerId: req.player.id,
      seasonId: season.id,
      seed,
      status: 'active',
      floor: 1,
      lives: STARTING_LIVES,
      ratingStart: rating.rating,
      ratingDelta: 0,
      state,
      lockedBonuses,
      rulesVersion: RANKED_RULES_VERSION,
      endedAt: null
    };

    await connection.query(
      `INSERT INTO ranked_runs
         (id, player_id, season_id, seed, status, floor, lives, rating_start, rating_delta, state, locked_bonuses, rules_version)
       VALUES (?, ?, ?, ?, 'active', 1, ?, ?, 0, ?, ?, ?)`,
      [
        run.id,
        run.playerId,
        run.seasonId,
        run.seed,
        run.lives,
        run.ratingStart,
        JSON.stringify(run.state),
        JSON.stringify(run.lockedBonuses),
        run.rulesVersion
      ]
    );
    await connection.query(
      `UPDATE ranked_action_receipts
       SET run_id = ?
       WHERE player_id = ? AND action_id = ?`,
      [run.id, req.player.id, actionId]
    );
    await connection.commit();
    committed = true;

    res.status(201).json({
      run: await serializeRankedRun(run, rating, season)
    });
  } catch (error) {
    if (!committed) await connection.rollback();
    sendRankedError(res, error);
  } finally {
    connection.release();
  }
});

router.post('/ranked/runs/:id/reroll', requireAuth, (req, res) => (
  withRankedAction(req, res, 'reroll', async ({ run, result }) => {
    requireSelectionPhase(run);
    const committed = await applyRankedWorkspace(run, req.body?.lineup, {
      requireActive: false,
      additionalRSoulCost: RANKED_REROLL_RSOUL_COST
    });
    run.state.handLocked = Boolean(req.body?.lockHand);
    run.state.lockedHand = [];
    result.purchaseCost = committed.purchaseCost;
    result.rSoulBalance = committed.rSoulBalance;
    result.rerollCost = RANKED_REROLL_RSOUL_COST;
    await dealOffers(run);
  })
));

router.post('/ranked/runs/:id/pact', requireAuth, (req, res) => (
  withRankedAction(req, res, 'pact', async ({ run }) => {
    const buffId = String(req.body?.buffId || '');
    const pendingIds = serializeCombatBuffState(run.state.buffs).pendingChoices.map((buff) => buff.id);
    if (!pendingIds.includes(buffId) || !getBuffById(buffId)) {
      throwRankedError('Choose one of the offered Demonic Pacts.', 409);
    }
    selectRunBuff(run, buffId);
  })
));

router.post('/ranked/runs/:id/battle', requireAuth, (req, res) => (
  withRankedAction(req, res, 'battle', async ({ run, rating, connection, result }) => {
    if (!['draft', 'selection', 'preparation'].includes(run.state.phase)) {
      throwRankedError('The Ranked lineup cannot fight right now.', 409);
    }
    const committed = await applyRankedWorkspace(run, req.body?.lineup, {
      preserveHand: Boolean(req.body?.lockHand)
    });
    result.purchaseCost = committed.purchaseCost;
    prepareForFight(run);
    const validation = getRosterValidation(run.state);
    if (!validation.valid) throwRankedError(validation.errors[0], 409);
    if (serializeCombatBuffState(run.state.buffs).pendingChoices.length) {
      throwRankedError('Choose a Demonic Pact before fighting.', 409);
    }

    await saveReadySnapshot(run, rating, req.player.username, connection);
    resetTeamForBattle(run.state.active);
    const opponent = await selectOpponent(run, rating, connection);
    resetTeamForBattle(opponent.team);
    const playerTeamBefore = cloneJson(run.state.active);
    const enemyTeamBefore = cloneJson(opponent.team);
    const demonTypes = await getDemonTypes();
    const fight = simulateFight(
      createRng((Number(run.seed) + Number(run.floor) * 2654435761) >>> 0),
      playerTeamBefore,
      enemyTeamBefore,
      {
        combatType: 'ranked',
        demonTypes,
        playerBuffs: getPlayerBattleBuffs(run),
        enemyBuffs: opponent.buffs
      }
    );
    // Ranked demons carry standardized base stats between floors. The battle
    // result contains temporary Pact/Skill/World-buff stats, so keep the base
    // roster here and store the buffed result only in the immutable replay.
    run.state.active = cloneJson(playerTeamBefore);
    run.state.phase = 'result';
    run.state.lastBattle = {
      floor: run.floor,
      winner: fight.winner,
      endReason: fight.endReason,
      ticks: fight.ticks,
      combatLog: fight.combatLog,
      playerTeamBefore,
      enemyTeamBefore,
      playerTeamAfter: cloneJson(fight.playerTeam),
      enemyTeamAfter: cloneJson(fight.enemyTeam),
      playerBuffs: serializeCombatBuffState(getPlayerBattleBuffs(run)).activeBuffs,
      enemyBuffs: serializeCombatBuffState(opponent.buffs).activeBuffs
    };
    result.winner = fight.winner;
    result.endReason = fight.endReason;

    if (fight.winner === 'player') {
      await applyRankedVictory(run, rating, connection, req.player.id, result);
      return;
    }

    const defeat = resolveDefeat(run.lives);
    run.lives = defeat.lives;
    if (defeat.ended) {
      await finalizeRankedRun(run, rating, connection, { defeated: true });
      return;
    }
    result.rSoulInterest = awardRankedSoulInterest(run);
  })
));

router.post('/ranked/runs/:id/continue', requireAuth, (req, res) => (
  withRankedAction(req, res, 'continue', async ({ run }) => {
    if (run.state.phase !== 'result' || !run.state.lastBattle) {
      throwRankedError('No Ranked battle result is waiting.', 409);
    }
    if (run.lives <= 0) throwRankedError('The Ranked run has ended.', 409);

    run.floor += 1;
    const reusedLockedHand = prepareNextSelection(run);
    if (!reusedLockedHand) {
      await dealOffers(run);
    }
    if (shouldOfferPact(run.floor - 1, run.state.buffs?.active?.length)) {
      generateBuffChoices(
        run,
        createRng((Number(run.seed) + Number(run.floor) * 1597334677 + 991) >>> 0)
      );
    }
  })
));

router.post('/ranked/runs/:id/end', requireAuth, (req, res) => (
  withRankedAction(req, res, 'end', async ({ run, rating, connection }) => {
    if (run.status !== 'active') throwRankedError('The Ranked run has already ended.', 409);
    await finalizeRankedRun(run, rating, connection, { abandoned: true });
  })
));

async function withRankedAction(req, res, actionType, handler) {
  let actionId;
  try {
    actionId = requireActionId(req);
  } catch (error) {
    return sendRankedError(res, error);
  }
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const duplicate = await claimAction(
      connection,
      req.player.id,
      actionId,
      req.params.id,
      actionType
    );
    if (duplicate) {
      await connection.rollback();
      return respondWithRun(res, req.params.id, req.player.id, { replayed: true });
    }

    const run = await getRankedRun(req.params.id, req.player.id, connection, { forUpdate: true });
    if (!run) throwRankedError('Ranked run not found.', 404);
    if (run.status !== 'active' && actionType !== 'end') throwRankedError('Ranked run is not active.', 409);
    const season = await getSeasonById(run.seasonId, connection);
    const rating = await getOrCreateRankedRating(
      req.player.id,
      run.seasonId,
      connection,
      { forUpdate: true }
    );
    const result = {};

    await handler({ run, season, rating, connection, result });
    if (run.status === 'active' && run.state.phase === 'preparation') {
      await saveReadySnapshot(run, rating, req.player.username, connection);
    }
    await saveRankedRun(run, connection);
    await connection.commit();
    committed = true;

    const refreshedRating = await getOrCreateRankedRating(req.player.id, run.seasonId);
    const payload = await serializeRankedRun(run, refreshedRating, season);
    res.json({
      ...result,
      run: payload
    });
  } catch (error) {
    if (!committed) await connection.rollback();
    sendRankedError(res, error);
  } finally {
    connection.release();
  }
}

async function applyRankedVictory(run, rating, connection, playerId, result) {
  const clearedFloor = run.floor;
  run.state.highestClearedFloor = Math.max(
    Number(run.state.highestClearedFloor) || 0,
    clearedFloor
  );
  result.rSoulInterest = awardRankedSoulInterest(run);
  let gain = getFloorRatingGain(clearedFloor, run.state.endlessRatingEarned);
  if (clearedFloor <= 9) {
    run.state.pendingRating = Math.max(0, Number(run.state.pendingRating) || 0) + gain;
  } else {
    if (clearedFloor === 10) {
      gain += Math.max(0, Number(run.state.pendingRating) || 0);
      run.state.pendingRating = 0;
    } else {
      run.state.endlessRatingEarned = Math.max(0, Number(run.state.endlessRatingEarned) || 0) + gain;
    }
    await applyRatingDelta(run, rating, connection, gain);
  }

  const rewardSouls = clearedFloor === 10 && !run.state.floorTenRewardClaimed ? 25 : 0;
  if (rewardSouls) {
    await connection.query(
      'UPDATE players SET souls = souls + ? WHERE id = ?',
      [rewardSouls, playerId]
    );
    run.state.floorTenRewardClaimed = true;
    result.rewards = { souls: rewardSouls };
    const [players] = await connection.query('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
    result.player = cleanPlayer(players[0]);
  }

  await connection.query(
    `UPDATE ranked_ratings
     SET highest_floor = GREATEST(highest_floor, ?),
         victories = victories + ?
     WHERE player_id = ? AND season_id = ?`,
    [clearedFloor, clearedFloor === 10 ? 1 : 0, run.playerId, run.seasonId]
  );
}

async function finalizeRankedRun(run, rating, connection) {
  if (run.status === 'ended') return;
  const pending = Math.max(0, Number(run.state.pendingRating) || 0);
  const adjustment = getEarlyRunRatingAdjustment(run.state.highestClearedFloor);
  await applyRatingDelta(run, rating, connection, pending + adjustment);
  run.state.pendingRating = 0;
  run.state.phase = 'ended';
  run.status = 'ended';
  run.endedAt = new Date();
  await connection.query(
    `UPDATE ranked_ratings
     SET runs_played = runs_played + 1,
         highest_floor = GREATEST(highest_floor, ?)
     WHERE player_id = ? AND season_id = ?`,
    [run.state.highestClearedFloor || 0, run.playerId, run.seasonId]
  );
}

async function applyRatingDelta(run, rating, connection, delta) {
  const applied = Math.max(-rating.rating, Math.floor(Number(delta) || 0));
  if (!applied) return;
  await connection.query(
    `UPDATE ranked_ratings
     SET rating = GREATEST(0, rating + ?)
     WHERE player_id = ? AND season_id = ?`,
    [applied, run.playerId, run.seasonId]
  );
  rating.rating = Math.max(0, rating.rating + applied);
  run.ratingDelta += applied;
  run.state.protectedRating = Math.max(0, Number(run.state.protectedRating) || 0) + applied;
}

async function claimAction(connection, playerId, actionId, runId, actionType) {
  try {
    await connection.query(
      `INSERT INTO ranked_action_receipts
         (player_id, action_id, run_id, action_type)
       VALUES (?, ?, ?, ?)`,
      [playerId, actionId, runId, actionType]
    );
    return false;
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') return true;
    throw error;
  }
}

async function respondWithRun(res, runId, playerId, extra = {}) {
  const run = await getRankedRun(runId, playerId);
  if (!run) return res.status(404).json({ error: 'Ranked run not found.' });
  const [season, rating, players] = await Promise.all([
    getSeasonById(run.seasonId),
    getOrCreateRankedRating(playerId, run.seasonId),
    db.query('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId])
  ]);
  res.json({
    ...extra,
    player: cleanPlayer(players[0][0]),
    run: await serializeRankedRun(run, rating, season)
  });
}

async function getSeasonById(seasonId, queryable = db) {
  const [rows] = await queryable.query(
    `SELECT id, name, starts_at, ends_at, rules_version
     FROM ranked_seasons
     WHERE id = ?
     LIMIT 1`,
    [seasonId]
  );
  if (!rows.length) return getOrCreateCurrentSeason(queryable);
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    rulesVersion: row.rules_version
  };
}

function requireSelectionPhase(run) {
  if (!['draft', 'selection'].includes(run.state.phase) || !(run.state.offers || []).length) {
    throwRankedError('No Ranked demon selection is pending.', 409);
  }
}

function requireActionId(req) {
  const value = String(req.get('Idempotency-Key') || req.body?.actionId || '').trim();
  if (!/^[a-zA-Z0-9:_-]{8,64}$/.test(value)) {
    throwRankedError('A valid actionId is required.', 400);
  }
  return value;
}

function throwRankedError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function sendRankedError(res, error) {
  if (res.headersSent) return;
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? 'Unable to update the Ranked run.' : error.message
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = router;
