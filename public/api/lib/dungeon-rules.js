const MAX_DUNGEON_FLOOR = 20;
const MAX_DUNGEON_TEAM_SIZE = 6;

function getDungeonTeamLimit(floor) {
  return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(1, Number(floor) || 1));
}

module.exports = {
  MAX_DUNGEON_FLOOR,
  MAX_DUNGEON_TEAM_SIZE,
  getDungeonTeamLimit
};
