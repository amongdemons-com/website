const MAX_DUNGEON_TEAM_SIZE = 6;
const COLLECTION_REINFORCEMENT_FLOOR = 10;
const MIN_DUNGEON_EXTRACTION_FLOOR = 1;

function getDungeonTeamLimit(floor) {
  return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(2, (Number(floor) || 1) + 1));
}

function isDungeonExtractionUnlocked(floor) {
  return Number(floor) >= MIN_DUNGEON_EXTRACTION_FLOOR;
}

module.exports = {
  COLLECTION_REINFORCEMENT_FLOOR,
  MAX_DUNGEON_TEAM_SIZE,
  MIN_DUNGEON_EXTRACTION_FLOOR,
  getDungeonTeamLimit,
  isDungeonExtractionUnlocked
};
