const express = require('express');
const db = require('./lib/db');
const { requireAuth } = require('./lib/auth');
const { saveCollectionDemon } = require('./lib/collection-demons');
const {
  REFINEMENT_COSTS,
  SUMMON_REQUIREMENTS,
  getNextEchoRarity,
  normalizeEchoRarity
} = require('./lib/echo-config');
const {
  createHttpError,
  getEchoDefinition,
  getPlayerBag
} = require('./lib/echo-bag');
const achievements = require('./lib/achievements');
const { getAccountProgressionPayload } = require('./lib/progression');

const router = express.Router();

router.get('/bag', requireAuth, async (req, res) => {
  res.json({
    ...(await getPlayerBag(req.player.id)),
    player: req.player,
    progression: getAccountProgressionPayload(req.player)
  });
});

router.post('/bag/echoes/refine', requireAuth, async (req, res) => {
  const typeId = Math.max(0, Math.floor(Number(req.body?.typeId) || 0));
  const rarity = normalizeEchoRarity(req.body?.rarity);
  const targetRarity = getNextEchoRarity(rarity);
  const cost = REFINEMENT_COSTS[rarity];
  if (!typeId || !rarity || !targetRarity || !cost) {
    throw createHttpError('Choose an Echo that can be refined.', 400);
  }

  const [source, target] = await Promise.all([
    getEchoDefinition(typeId, rarity),
    getEchoDefinition(typeId, targetRarity)
  ]);
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [result] = await connection.query(
      `UPDATE player_bag
       SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ? AND item_key = ? AND quantity >= ?`,
      [cost, req.player.id, source.itemKey, cost]
    );
    if (!result.affectedRows) throw createHttpError(`You need ${cost} ${capitalize(rarity)} Echoes to refine.`, 409);

    await connection.query(
      `INSERT INTO player_bag (player_id, item_key, item_type, quantity)
       VALUES (?, ?, 'echo', 1)
       ON DUPLICATE KEY UPDATE
         quantity = quantity + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [req.player.id, target.itemKey]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  res.json({
    refinement: { typeId, sourceRarity: rarity, targetRarity, cost, quantity: 1 },
    ...(await getPlayerBag(req.player.id))
  });
});

router.post('/bag/echoes/summon', requireAuth, async (req, res) => {
  const typeId = Math.max(0, Math.floor(Number(req.body?.typeId) || 0));
  const rarity = normalizeEchoRarity(req.body?.rarity);
  if (!typeId || !rarity) throw createHttpError('Choose an Echo to summon.', 400);

  const definition = await getEchoDefinition(typeId, rarity);
  const requirement = SUMMON_REQUIREMENTS[rarity];
  const connection = await db.getConnection();
  let saved;

  try {
    await connection.beginTransaction();
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
    ...(await getPlayerBag(req.player.id))
  });
});

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

module.exports = router;
