const { createDemon, createTeam } = require('./demon-factory');

const STARTER_TYPE_IDS = [1, 2, 3];

function getAllowedHuntTypeIds(floor) {
  if (floor <= 3) return STARTER_TYPE_IDS;

  return Array.from({ length: floor + 1 }, (item, index) => index + 1);
}

async function createHuntEnemies(rng, floor, size) {
  const allowedTypeIds = getAllowedHuntTypeIds(floor);

  if (floor === 10 && size > 0) {
    const enemies = [
      await createDemon(rng, {
        instanceId: `enemy-${floor}-1`,
        typeId: 11
      })
    ];

    for (let index = 1; index < size; index += 1) {
      enemies.push(await createDemon(rng, {
        instanceId: `enemy-${floor}-${index + 1}`,
        allowedTypeIds
      }));
    }

    return enemies;
  }

  return createTeam(rng, size, {
    prefix: `enemy-${floor}`,
    allowedTypeIds,
    allowedRarities: floor <= 3 ? ['common', 'uncommon', 'rare'] : undefined
  });
}

module.exports = {
  STARTER_TYPE_IDS,
  createHuntEnemies,
  getAllowedHuntTypeIds
};
