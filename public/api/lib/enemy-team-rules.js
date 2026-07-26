const DEFAULT_DEMON_TYPES = require('../data/demon-types.json');

const MAX_ENEMY_MELEE_DEMONS = 3;

function isThornsDemon(demon = {}, demonTypes = DEFAULT_DEMON_TYPES) {
  const typeId = getDemonTypeId(demon);
  const type = demonTypes[String(typeId)] || {};
  const role = String(demon.role || type.role || '').toLowerCase();
  const abilityKind = String(demon.abilityKind || demon.ability?.kind || type.ability?.kind || '').toLowerCase();

  return typeId === 8 || role === 'counter_tank' || abilityKind === 'retaliate';
}

function isMeleeEnemyDemon(demon = {}, demonTypes = DEFAULT_DEMON_TYPES) {
  if (isThornsDemon(demon, demonTypes)) return false;

  const typeId = getDemonTypeId(demon);
  const type = demonTypes[String(typeId)] || {};
  const preferredPosition = String(
    demon.preferredPosition ||
    type.preferredPosition ||
    demon.position ||
    ''
  ).toLowerCase();

  return preferredPosition === 'front' || preferredPosition === 'melee';
}

function countEnemyMeleeDemons(team = [], demonTypes = DEFAULT_DEMON_TYPES) {
  return (Array.isArray(team) ? team : [])
    .filter((demon) => isMeleeEnemyDemon(demon, demonTypes))
    .length;
}

function getAllowedEnemyTypeIds(allowedTypeIds = [], team = [], demonTypes = DEFAULT_DEMON_TYPES) {
  const normalizedTypeIds = (Array.isArray(allowedTypeIds) ? allowedTypeIds : [])
    .map(Number)
    .filter((typeId) => demonTypes[String(typeId)]);

  if (countEnemyMeleeDemons(team, demonTypes) < MAX_ENEMY_MELEE_DEMONS) {
    return normalizedTypeIds;
  }

  return normalizedTypeIds.filter((typeId) => (
    !isMeleeEnemyDemon({ typeId }, demonTypes)
  ));
}

function getDemonTypeId(demon = {}) {
  return Number(demon.typeId || demon.type_id || demon.type) || 0;
}

module.exports = {
  MAX_ENEMY_MELEE_DEMONS,
  countEnemyMeleeDemons,
  getAllowedEnemyTypeIds,
  isMeleeEnemyDemon,
  isThornsDemon
};
