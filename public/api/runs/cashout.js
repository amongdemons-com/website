const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { getRunForPlayer, saveRun } = require('../lib/runs');

const router = express.Router();

router.post('/runs/:id/cashout', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active' || !run.state.awaitingRecruit) {
    return res.status(409).json({ error: 'Rewards can only be claimed between dungeon fights.' });
  }

  const demon = getCashoutDemon(run, req.body || {});
  const [result] = await db.query(
    `INSERT INTO player_demons
       (player_id, source_demon_id, type_id, species, rarity, image_url, hp, atk, speed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.player.id,
      demon.sourceDemonId,
      demon.typeId,
      demon.species,
      demon.rarity,
      demon.imageUrl,
      demon.maxHp || demon.hp,
      demon.atk,
      demon.speed
    ]
  );

  const earned = run.state.earned || { xp: 0, souls: 0 };
  const [playerRows] = await db.query('SELECT xp, level FROM players WHERE id = ? LIMIT 1', [req.player.id]);
  const nextXp = playerRows[0].xp + (earned.xp || 0);
  const nextLevel = Math.max(playerRows[0].level, Math.floor(nextXp / 100) + 1);

  await db.query(
    'UPDATE players SET xp = xp + ?, souls = souls + ?, level = ? WHERE id = ?',
    [earned.xp || 0, earned.souls || 0, nextLevel, req.player.id]
  );

  run.status = 'ended';
  run.endedAt = new Date();
  run.state.awaitingRecruit = false;
  run.state.cashout = {
    savedDemonId: result.insertId,
    xp: earned.xp || 0,
    souls: earned.souls || 0
  };
  await saveRun(run);

  res.status(201).json({
    demon: {
      id: result.insertId,
      sourceDemonId: demon.sourceDemonId,
      typeId: demon.typeId,
      species: demon.species,
      rarity: demon.rarity,
      imageUrl: demon.imageUrl,
      hp: demon.maxHp || demon.hp,
      atk: demon.atk,
      speed: demon.speed
    },
    xp: earned.xp || 0,
    souls: earned.souls || 0,
    level: nextLevel
  });
});

function getCashoutDemon(run, body) {
  if (body.source === 'team') {
    const instanceId = String(body.instanceId || '');
    const demon = (run.state.team || []).find((item) => item.instanceId === instanceId);
    if (!demon) {
      const error = new Error('Team demon not found.');
      error.status = 404;
      throw error;
    }
    if (demon.collectionDemonId) {
      const error = new Error('Choose a demon that is not already in your collection.');
      error.status = 409;
      throw error;
    }
    return demon;
  }

  if (body.source === 'reward') {
    const rewardId = Number(body.rewardId);
    const reward = run.rewards.find((item) => (
      Number(item.rewardId) === rewardId &&
      item.type === 'recruit' &&
      item.floor === run.floor &&
      item.demon
    ));
    if (!reward) {
      const error = new Error('Reward demon not found.');
      error.status = 404;
      throw error;
    }
    reward.claimed = true;
    reward.saved = true;
    return reward.demon;
  }

  const error = new Error('Choose a demon reward.');
  error.status = 400;
  throw error;
}

module.exports = router;
