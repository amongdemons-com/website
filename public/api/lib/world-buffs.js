const { getActiveWorldBossRewardBuffs } = require('./world-bosses');
const { getActiveSoulFontBuffs } = require('./world-soul-font');

async function getActiveWorldRewardBuffs(playerOrId, queryable = undefined) {
  const [bossBuffs, soulFontBuffs] = await Promise.all([
    getActiveWorldBossRewardBuffs(playerOrId, queryable),
    getActiveSoulFontBuffs(playerOrId, queryable)
  ]);

  return [...bossBuffs, ...soulFontBuffs];
}

module.exports = { getActiveWorldRewardBuffs };
