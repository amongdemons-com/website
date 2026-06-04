const db = require('./db');
const { enrichCollectionDemonsWithTraining } = require('./demon-training');

function getCollectionDemonRow(demon = {}) {
  const normalizedDemon = normalizeCollectionDemonStats(demon);

  return {
    sourceDemonId: Number(normalizedDemon.sourceDemonId || normalizedDemon.source_demon_id || normalizedDemon.id),
    typeId: Number(normalizedDemon.typeId || normalizedDemon.type_id || normalizedDemon.type),
    species: String(normalizedDemon.species || normalizedDemon.name || ''),
    rarity: String(normalizedDemon.rarity || '').toLowerCase(),
    imageUrl: String(normalizedDemon.imageUrl || normalizedDemon.image_url || ''),
    hp: Math.max(1, Number(normalizedDemon.maxHp || normalizedDemon.hp) || 1),
    atk: Math.max(1, Number(normalizedDemon.atk) || 1),
    speed: Math.max(1, Number(normalizedDemon.speed) || 1)
  };
}

function normalizeCollectionDemonStats(demon = {}) {
  const maxHp = Number(demon.runBaseMaxHp);
  const atk = Number(demon.runBaseAtk);
  const speed = Number(demon.runBaseSpeed);
  const normalized = { ...demon };

  if (Number.isFinite(maxHp) && maxHp > 0) {
    normalized.maxHp = Math.max(1, Math.round(maxHp));
    normalized.hp = normalized.maxHp;
  }

  if (Number.isFinite(atk) && atk > 0) {
    normalized.atk = Math.max(1, Math.round(atk));
  }

  if (Number.isFinite(speed) && speed > 0) {
    normalized.speed = Math.max(1, Math.round(speed));
  }

  delete normalized.effectiveAtk;
  delete normalized.runBaseAtk;
  delete normalized.runBaseMaxHp;
  delete normalized.runBaseSpeed;
  delete normalized.runBuffStatsApplied;
  delete normalized.runBuffStatsPreviewed;

  return normalized;
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
  normalizeCollectionDemonStats,
  saveCollectionDemon
};
