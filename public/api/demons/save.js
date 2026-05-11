const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { getRunForPlayer, saveRun } = require('../lib/runs');

const router = express.Router();

router.post('/demons/save', requireAuth, async (req, res) => {
  const runId = String(req.body.runId || '');
  const rewardId = Number(req.body.rewardId);

  if (!runId || !rewardId) {
    return res.status(400).json({ error: 'runId and rewardId are required.' });
  }

  const run = await getRunForPlayer(runId, req.player.id);
  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  const reward = run.rewards.find((item) => item.rewardId === rewardId);
  if (!reward || !reward.demon) {
    return res.status(404).json({ error: 'Demon reward not found.' });
  }

  if (reward.saved) {
    return res.status(409).json({ error: 'Demon reward already saved.' });
  }

  const demon = reward.demon;

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

  reward.saved = true;
  reward.savedDemonId = result.insertId;
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
    }
  });
});

module.exports = router;
