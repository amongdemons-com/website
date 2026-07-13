const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, requireAuth } = require('../lib/auth');
const {
  applyTrainingIncreases,
  enrichCollectionDemonsWithTraining,
  getDemonTrainingInfo,
  rollTrainingAttempt
} = require('../lib/demon-training');
const { getDemonTypes } = require('../lib/game-data');
const achievements = require('../lib/achievements');

const router = express.Router();
const RELENTLESS_TRAINING_COUNT = 25;
const TRAIN_MAX_MODE = 'max';
const TRAINING_ATTEMPT_LIMIT = 1000;

router.post('/demons/:id/train', requireAuth, async (req, res) => {
  const demonId = Number(req.params.id);
  if (!demonId) {
    return res.status(400).json({ error: 'Demon not found.' });
  }

  const types = await getDemonTypes();
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();

    const [playerRows] = await connection.query(
      'SELECT * FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
      [req.player.id]
    );
    if (!playerRows.length) {
      const error = new Error('Player not found.');
      error.status = 404;
      throw error;
    }

    const [demonRows] = await connection.query(
      `SELECT id, source_demon_id AS sourceDemonId, type_id AS typeId, species, rarity,
              image_url AS imageUrl, hp, atk, speed, created_at AS createdAt
       FROM player_demons
       WHERE id = ? AND player_id = ?
       LIMIT 1
       FOR UPDATE`,
      [demonId, req.player.id]
    );
    if (!demonRows.length) {
      const error = new Error('Demon not found.');
      error.status = 404;
      throw error;
    }

    const demon = demonRows[0];
    const trainMode = req.body?.mode === TRAIN_MAX_MODE || req.body?.max === true
      ? TRAIN_MAX_MODE
      : 'once';
    const playerSouls = Math.max(0, Math.floor(Number(playerRows[0].souls) || 0));
    const soulBudget = trainMode === TRAIN_MAX_MODE
      ? normalizeSoulBudget(req.body?.maxSouls, playerSouls)
      : playerSouls;
    const trainingResult = runTrainingSeries(demon, types, playerSouls, {
      max: trainMode === TRAIN_MAX_MODE,
      soulBudget
    });
    const nextStats = trainingResult.stats;

    if (trainingResult.statsChanged) {
      await connection.query(
        'UPDATE player_demons SET hp = ?, atk = ?, speed = ? WHERE id = ? AND player_id = ?',
        [nextStats.hp, nextStats.atk, nextStats.speed, demon.id, req.player.id]
      );
    }

    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [trainingResult.spent, req.player.id]
    );
    await connection.query(
      'UPDATE player_demons SET times_trained = times_trained + ? WHERE id = ? AND player_id = ?',
      [trainingResult.attempts.length, demon.id, req.player.id]
    );
    const [trainedRows] = await connection.query(
      'SELECT times_trained AS timesTrained FROM player_demons WHERE id = ? AND player_id = ? LIMIT 1',
      [demon.id, req.player.id]
    );

    const [updatedPlayerRows] = await connection.query(
      'SELECT * FROM players WHERE id = ? LIMIT 1',
      [req.player.id]
    );
    await connection.commit();
    committed = true;

    const [updatedDemon] = await enrichCollectionDemonsWithTraining([{
      ...demon,
      hp: nextStats.hp,
      atk: nextStats.atk,
      speed: nextStats.speed
    }]);
    const player = cleanPlayer(updatedPlayerRows[0]);

    await achievements.grantAchievements(req.player.id, [
      'soulforged',
      ...(Number(trainedRows[0]?.timesTrained) >= RELENTLESS_TRAINING_COUNT ? ['relentless'] : []),
      ...(updatedDemon.training.maxed ? ['perfect-vessel'] : [])
    ]);

    res.json({
      demon: updatedDemon,
      player,
      training: {
        mode: trainMode,
        attempts: trainingResult.attempts.length,
        succeeded: trainingResult.succeededCount > 0,
        succeededCount: trainingResult.succeededCount,
        spent: trainingResult.spent,
        successChance: trainingResult.lastSuccessChance,
        increases: trainingResult.increases,
        maxed: updatedDemon.training.maxed,
        nextCost: updatedDemon.training.cost,
        stoppedReason: trainingResult.stoppedReason,
        attemptLog: trainingResult.attempts
      }
    });
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
});

function runTrainingSeries(demon, types, souls, options = {}) {
  const trainMax = Boolean(options.max);
  const totalSouls = Math.max(0, Math.floor(Number(souls) || 0));
  const configuredBudget = options.soulBudget === undefined
    ? totalSouls
    : Math.max(0, Math.floor(Number(options.soulBudget) || 0));
  const soulBudget = trainMax ? Math.min(totalSouls, configuredBudget) : totalSouls;
  const rollAttempt = typeof options.rollAttempt === 'function'
    ? options.rollAttempt
    : rollTrainingAttempt;
  const current = {
    ...demon,
    hp: Math.max(1, Number(demon.hp) || 1),
    atk: Math.max(1, Number(demon.atk) || 1),
    speed: Math.max(1, Number(demon.speed) || 1)
  };
  const originalStats = {
    hp: current.hp,
    atk: current.atk,
    speed: current.speed
  };
  const attempts = [];
  const increases = { hp: 0, atk: 0, speed: 0 };
  let availableSouls = soulBudget;
  let spent = 0;
  let succeededCount = 0;
  let stoppedReason = trainMax ? 'attempt_limit' : 'once';
  let lastSuccessChance = null;

  while (attempts.length < TRAINING_ATTEMPT_LIMIT) {
    const training = getDemonTrainingInfo(current, types);
    if (training.maxed) {
      if (!attempts.length) throwTrainingError('This demon is already maxed out.', 409);
      stoppedReason = 'maxed';
      break;
    }

    const cost = Number(training.cost) || 0;
    if (availableSouls < cost) {
      if (!attempts.length) {
        const message = trainMax && soulBudget < totalSouls
          ? `Choose at least ${cost} Souls for auto training.`
          : `Training costs ${cost} Souls.`;
        throwTrainingError(message, 400);
      }
      stoppedReason = soulBudget < totalSouls ? 'budget_exhausted' : 'out_of_souls';
      break;
    }

    const attempt = rollAttempt(training, attempts.length);
    lastSuccessChance = attempt.successChance;
    if (attempt.succeeded && !Object.keys(attempt.increases).length) {
      if (!attempts.length) throwTrainingError('This demon is already maxed out.', 409);
      stoppedReason = 'maxed';
      break;
    }

    availableSouls -= cost;
    spent += cost;

    if (attempt.succeeded) {
      const nextStats = applyTrainingIncreases(current, training, attempt.increases);
      Object.assign(current, nextStats);
      succeededCount += 1;
      Object.entries(attempt.increases).forEach(([key, value]) => {
        increases[key] = (Number(increases[key]) || 0) + Math.max(0, Number(value) || 0);
      });
    }

    attempts.push({
      number: attempts.length + 1,
      succeeded: attempt.succeeded,
      spent: cost,
      successChance: attempt.successChance,
      increases: attempt.increases,
      stats: {
        hp: current.hp,
        atk: current.atk,
        speed: current.speed
      }
    });

    if (!trainMax) {
      stoppedReason = 'once';
      break;
    }
  }

  if (!attempts.length) {
    throwTrainingError('Unable to train this demon.', 400);
  }

  return {
    attempts,
    increases: Object.fromEntries(Object.entries(increases).filter(([, value]) => Number(value) > 0)),
    spent,
    succeededCount,
    lastSuccessChance,
    stoppedReason,
    stats: {
      hp: current.hp,
      atk: current.atk,
      speed: current.speed
    },
    statsChanged: current.hp !== originalStats.hp || current.atk !== originalStats.atk || current.speed !== originalStats.speed
  };
}

function normalizeSoulBudget(value, playerSouls) {
  const availableSouls = Math.max(0, Math.floor(Number(playerSouls) || 0));
  if (value === undefined || value === null || value === '') return availableSouls;

  const requested = Number(value);
  if (!Number.isSafeInteger(requested) || requested < 0) {
    throwTrainingError('Auto training Souls must be a non-negative whole number.', 400);
  }

  return Math.min(requested, availableSouls);
}

function throwTrainingError(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

router._test = {
  normalizeSoulBudget,
  runTrainingSeries
};

module.exports = router;
