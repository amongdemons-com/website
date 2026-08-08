const MAX_DUNGEON_TEAM_SIZE = 6;
const COLLECTION_REINFORCEMENT_FLOOR = 10;
const COLLECTION_REINFORCEMENT_FLOORS = Object.freeze([COLLECTION_REINFORCEMENT_FLOOR, 30, 50]);
const MIN_DUNGEON_EXTRACTION_FLOOR = 1;

function getDungeonTeamLimit(floor) {
  return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(2, (Number(floor) || 1) + 1));
}

function isDungeonExtractionUnlocked(floor) {
  return Number(floor) >= MIN_DUNGEON_EXTRACTION_FLOOR;
}

function getUsedCollectionReinforcementFloors(state = {}) {
  const hasExplicitHistory = Array.isArray(state.collectionReinforcementFloorsUsed);
  const usedFloors = new Set(
    (hasExplicitHistory ? state.collectionReinforcementFloorsUsed : [])
      .map((floor) => Number(floor))
      .filter((floor) => COLLECTION_REINFORCEMENT_FLOORS.includes(floor))
  );

  if (!hasExplicitHistory && state.collectionReinforcementUsed) {
    usedFloors.add(COLLECTION_REINFORCEMENT_FLOOR);
  }

  return usedFloors;
}

function canUseCollectionReinforcement(state = {}, floor) {
  const normalizedFloor = Number(floor);
  return COLLECTION_REINFORCEMENT_FLOORS.includes(normalizedFloor) &&
    !getUsedCollectionReinforcementFloors(state).has(normalizedFloor);
}

function markCollectionReinforcementUsed(state = {}, floor) {
  const normalizedFloor = Number(floor);
  if (!COLLECTION_REINFORCEMENT_FLOORS.includes(normalizedFloor)) return false;

  const usedFloors = getUsedCollectionReinforcementFloors(state);
  usedFloors.add(normalizedFloor);
  state.collectionReinforcementFloorsUsed = [...usedFloors].sort((left, right) => left - right);
  state.collectionReinforcementUsed = state.collectionReinforcementFloorsUsed.length > 0;
  return true;
}

module.exports = {
  COLLECTION_REINFORCEMENT_FLOOR,
  COLLECTION_REINFORCEMENT_FLOORS,
  MAX_DUNGEON_TEAM_SIZE,
  MIN_DUNGEON_EXTRACTION_FLOOR,
  canUseCollectionReinforcement,
  getUsedCollectionReinforcementFloors,
  getDungeonTeamLimit,
  isDungeonExtractionUnlocked,
  markCollectionReinforcementUsed
};
