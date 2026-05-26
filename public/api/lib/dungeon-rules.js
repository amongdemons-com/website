const MAX_DUNGEON_TEAM_SIZE = 6;

function getDungeonTeamLimit(floor) {
  return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(2, (Number(floor) || 1) + 1));
}

module.exports = {
  MAX_DUNGEON_TEAM_SIZE,
  getDungeonTeamLimit
};
