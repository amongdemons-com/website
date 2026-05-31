const MAX_DUNGEON_TEAM_SIZE = 6;
const COLLECTION_REINFORCEMENT_FLOOR = 10;

function getDungeonTeamLimit(floor) {
  return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(2, (Number(floor) || 1) + 1));
}

module.exports = {
  COLLECTION_REINFORCEMENT_FLOOR,
  MAX_DUNGEON_TEAM_SIZE,
  getDungeonTeamLimit
};
