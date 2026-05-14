const { createDemon, createTeam } = require('./demon-factory');

const STARTER_TYPE_IDS = [1, 2, 3];

function getAllowedHuntTypeIds(floor) {
  if (floor <= 3) return STARTER_TYPE_IDS;

  return Array.from({ length: floor + 1 }, (item, index) => index + 1);
}

async function createHuntEnemies(rng, floor, size) {
  const allowedTypeIds = getAllowedHuntTypeIds(floor);
  const teamSize = getHuntEnemyTeamSize(floor, size);

  if (floor === 10 && teamSize > 0) {
    const enemies = [
      await createDemon(rng, {
        instanceId: `enemy-${floor}-1`,
        position: 'front',
        typeId: 11
      })
    ];

    for (let index = 1; index < teamSize; index += 1) {
      enemies.push(await createDemon(rng, {
        instanceId: `enemy-${floor}-${index + 1}`,
        position: index === 1 ? 'back' : 'front',
        allowedTypeIds
      }));
    }

    return applyEnemyPreferredPositions(enemies);
  }

  const enemies = await createTeam(rng, teamSize, {
    prefix: `enemy-${floor}`,
    positions: getEnemyPositions(teamSize),
    allowedTypeIds,
    allowedRarities: floor <= 3 ? ['common', 'uncommon', 'rare'] : undefined
  });

  return applyEnemyPreferredPositions(enemies);
}

function getHuntEnemyTeamSize(floor, fallbackSize) {
  if (floor <= 1) return Math.max(1, Number(fallbackSize) || 1);
  if (floor === 2) return 2;
  return 3;
}

function getEnemyPositions(size) {
  if (size <= 1) return ['front'];
  if (size === 2) return ['front', 'back'];
  return ['front', 'back', 'front'];
}

function getEnemyPreferredPosition(demon) {
  if ([1, 5, 7, 8, 9].includes(Number(demon.typeId))) return 'front';
  if ([2, 3, 4, 6, 10, 11].includes(Number(demon.typeId))) return 'back';
  return demon.position === 'back' ? 'back' : 'front';
}

function applyEnemyPreferredPositions(enemies) {
  return enemies.map((demon) => ({
    ...demon,
    position: getEnemyPreferredPosition(demon)
  }));
}

module.exports = {
  STARTER_TYPE_IDS,
  createHuntEnemies,
  getAllowedHuntTypeIds,
  getHuntEnemyTeamSize
};
