const db = require('./db');
const { enrichCollectionDemonsWithTraining } = require('./demon-training');

function getCollectionDemonRow(demon = {}) {
  return {
    sourceDemonId: Number(demon.sourceDemonId || demon.source_demon_id || demon.id),
    typeId: Number(demon.typeId || demon.type_id || demon.type),
    species: String(demon.species || demon.name || ''),
    rarity: String(demon.rarity || '').toLowerCase(),
    imageUrl: String(demon.imageUrl || demon.image_url || ''),
    hp: Math.max(1, Number(demon.maxHp || demon.hp) || 1),
    atk: Math.max(1, Number(demon.atk) || 1),
    speed: Math.max(1, Number(demon.speed) || 1)
  };
}

async function saveCollectionDemon(playerId, demon) {
  const row = getCollectionDemonRow(demon);

  if (!playerId || !row.sourceDemonId || !row.typeId || !row.rarity || !row.species || !row.imageUrl) {
    const error = new Error('Demon is missing required collection data.');
    error.status = 400;
    throw error;
  }

  const [result] = await db.query(
    `INSERT INTO player_demons
       (player_id, source_demon_id, type_id, species, rarity, image_url, hp, atk, speed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       id = LAST_INSERT_ID(id),
       source_demon_id = VALUES(source_demon_id),
       species = VALUES(species),
       image_url = VALUES(image_url),
       hp = VALUES(hp),
       atk = VALUES(atk),
       speed = VALUES(speed),
       created_at = CURRENT_TIMESTAMP`,
    [
      playerId,
      row.sourceDemonId,
      row.typeId,
      row.species,
      row.rarity,
      row.imageUrl,
      row.hp,
      row.atk,
      row.speed
    ]
  );

  const [savedDemon] = await enrichCollectionDemonsWithTraining([{
    id: result.insertId,
    sourceDemonId: row.sourceDemonId,
    typeId: row.typeId,
    species: row.species,
    rarity: row.rarity,
    imageUrl: row.imageUrl,
    hp: row.hp,
    atk: row.atk,
    speed: row.speed
  }]);

  return {
    demon: savedDemon,
    replaced: result.affectedRows > 1
  };
}

module.exports = {
  getCollectionDemonRow,
  saveCollectionDemon
};
