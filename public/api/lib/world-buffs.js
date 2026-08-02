const { getActiveWorldBossRewardBuffs } = require('./world-bosses');
const { getActiveSoulFontBuffs } = require('./world-soul-font');

async function getActiveWorldRewardBuffs(playerOrId) {
  const [bossBuffs, soulFontBuffs] = await Promise.all([
    getActiveWorldBossRewardBuffs(playerOrId),
    getActiveSoulFontBuffs(playerOrId)
  ]);

  return [...bossBuffs, ...soulFontBuffs];
}

module.exports = { getActiveWorldRewardBuffs };
