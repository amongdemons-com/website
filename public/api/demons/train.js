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

const router = express.Router();

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
    const training = getDemonTrainingInfo(demon, types);
    if (training.maxed) {
      const error = new Error('This demon is already maxed out.');
      error.status = 409;
      throw error;
    }

    const cost = Number(training.cost) || 0;
    if ((Number(playerRows[0].souls) || 0) < cost) {
      const error = new Error(`Training costs ${cost} Souls.`);
      error.status = 400;
      throw error;
    }

    const attempt = rollTrainingAttempt(training);
    if (attempt.succeeded && !Object.keys(attempt.increases).length) {
      const error = new Error('This demon is already maxed out.');
      error.status = 409;
      throw error;
    }

    const nextStats = attempt.succeeded
      ? applyTrainingIncreases(demon, training, attempt.increases)
      : {
          hp: demon.hp,
          atk: demon.atk,
          speed: demon.speed
        };

    if (attempt.succeeded) {
      await connection.query(
        'UPDATE player_demons SET hp = ?, atk = ?, speed = ? WHERE id = ? AND player_id = ?',
        [nextStats.hp, nextStats.atk, nextStats.speed, demon.id, req.player.id]
      );
    }

    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [cost, req.player.id]
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

    res.json({
      demon: updatedDemon,
      player,
      training: {
        succeeded: attempt.succeeded,
        spent: cost,
        successChance: attempt.successChance,
        increases: attempt.increases,
        maxed: updatedDemon.training.maxed,
        nextCost: updatedDemon.training.cost
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

module.exports = router;
