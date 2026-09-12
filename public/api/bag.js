const express = require('express');
const db = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { saveCollectionDemon } = require('./lib/collection-demons');
const {
  SUMMON_REQUIREMENTS,
  normalizeEchoRarity
} = require('./lib/echo-config');
const {
  createHttpError,
  getEchoDefinition,
  getPlayerBag,
  getCollectionEchoes,
  lockEchoPlayer
} = require('./lib/echo-bag');
const achievements = require('./lib/achievements');
const {
  getAccountProgressionPayload,
  getAccountProgressionSummary
} = require('./lib/progression');
const { getMythicEchoUnravelProgression } = require('./lib/echo-unravel');

const router = express.Router();

router.get('/bag', requireAuth, async (req, res) => {
  res.json({
    ...(await getPlayerBag(req.player.id)),
    player: req.player,
    progression: getAccountProgressionPayload(req.player)
  });
});

router.post('/collection/echoes/unravel', requireAuth, async (req, res) => {
  const typeId = Math.max(0, Math.floor(Number(req.body?.typeId) || 0));
  const rarity = normalizeEchoRarity(req.body?.rarity);
  if (!typeId || rarity !== 'mythic') {
    throw createHttpError('Only a Mythic Echo can be unraveled.', 400);
  }

  const definition = await getEchoDefinition(typeId, rarity);
  const connection = await db.getConnection();
  let progression;
  let updatedPlayer;

  try {
    await connection.beginTransaction();
    const [playerRows] = await connection.query(
      'SELECT xp, level, souls, highest_floor AS highestFloor FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
      [req.player.id]
    );
    if (!playerRows.length) throw createHttpError('Hunter not found.', 404);

    progression = getMythicEchoUnravelProgression(playerRows[0].level, playerRows[0].xp);
    if (!progression.levelsGranted) {
      throw createHttpError('You are already at the maximum hunter level.', 409);
    }

    const [result] = await connection.query(
      `UPDATE player_bag
       SET quantity = quantity - 1, updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ? AND item_key = ? AND quantity >= 1`,
      [req.player.id, definition.itemKey]
    );
    if (!result.affectedRows) throw createHttpError('That Mythic Echo is no longer in your Collection.', 409);

    await connection.query(
      'UPDATE players SET xp = ?, level = ? WHERE id = ?',
      [progression.nextXp, progression.targetLevel, req.player.id]
    );
    await connection.commit();

    updatedPlayer = {
      ...req.player,
      xp: progression.nextXp,
      level: progression.targetLevel,
      souls: Number(playerRows[0].souls) || 0,
      highestFloor: Number(playerRows[0].highestFloor) || 0
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await achievements.checkAccountLevel(req.player.id, progression.targetLevel);
  res.json({
    unravel: {
      typeId,
      rarity,
      levelsGranted: progression.levelsGranted,
      xpGranted: progression.xpGranted,
      targetLevel: progression.targetLevel
    },
    player: updatedPlayer,
    progression: {
      ...getAccountProgressionSummary(updatedPlayer.level, updatedPlayer.xp, {
        previousLevel: progression.currentLevel
      }),
      souls: updatedPlayer.souls,
      highestFloor: updatedPlayer.highestFloor
    },
    echoes: await getCollectionEchoes(req.player.id)
  });
});

router.post('/collection/echoes/summon', requireAuth, async (req, res) => {
  const typeId = Math.max(0, Math.floor(Number(req.body?.typeId) || 0));
  const rarity = normalizeEchoRarity(req.body?.rarity);
  if (!typeId || !rarity) throw createHttpError('Choose an Echo to summon.', 400);

  const definition = await getEchoDefinition(typeId, rarity);
  const requirement = SUMMON_REQUIREMENTS[rarity];
  const connection = await db.getConnection();
  let saved;

  try {
    await connection.beginTransaction();
    await lockEchoPlayer(req.player.id, connection);
    const [ownedRows] = await connection.query(
      `SELECT id
       FROM player_demons
       WHERE player_id = ? AND type_id = ? AND rarity = ?
       LIMIT 1
       FOR UPDATE`,
      [req.player.id, typeId, rarity]
    );
    if (ownedRows.length) throw createHttpError('This demon has already been summoned.', 409);

    const [result] = await connection.query(
      `UPDATE player_bag
       SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ? AND item_key = ? AND quantity >= ?`,
      [requirement, req.player.id, definition.itemKey, requirement]
    );
    if (!result.affectedRows) throw createHttpError(`You need ${requirement} Echoes to summon this demon.`, 409);

    saved = await saveCollectionDemon(req.player.id, {
      sourceDemonId: definition.sourceDemonId,
      typeId: definition.typeId,
      species: definition.species,
      rarity: definition.rarity,
      imageUrl: definition.imageUrl,
      maxHp: 1,
      hp: 1,
      atk: 1,
      speed: 1
    }, connection);
    if (saved.replaced) {
      throw createHttpError('This demon has already been summoned.', 409);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await achievements.checkCollection(req.player.id);
  res.status(201).json({
    demon: saved.demon,
    echoes: await getCollectionEchoes(req.player.id)
  });
});

module.exports = router;
