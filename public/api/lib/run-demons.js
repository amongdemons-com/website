function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
}

function createRunDemonFromCollection(row, instanceId) {
  return {
    instanceId,
    collectionDemonId: row.id,
    sourceDemonId: row.source_demon_id || row.sourceDemonId,
    typeId: row.type_id || row.typeId,
    species: row.species,
    rarity: row.rarity,
    imageUrl: row.image_url || row.imageUrl,
    maxHp: Number(row.hp) || 1,
    hp: Number(row.hp) || 1,
    atk: Number(row.atk) || 1,
    speed: Number(row.speed) || 1,
    position: 'front',
    attackMeter: 0
  };
}

function resetRunDemon(demon, instanceId) {
  const maxHp = Number(demon.maxHp) || Number(demon.hp) || 1;

  return {
    ...demon,
    instanceId,
    maxHp,
    hp: maxHp,
    position: normalizePosition(demon.position),
    attackMeter: 0,
    statusEffects: {
      poison: []
    }
  };
}

module.exports = {
  createRunDemonFromCollection,
  normalizePosition,
  resetRunDemon
};
