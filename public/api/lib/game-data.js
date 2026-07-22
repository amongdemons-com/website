const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
const jsonCache = new Map();
let gameCatalogPromise = null;

async function readJson(fileName) {
  if (!jsonCache.has(fileName)) {
    const pending = fs.readFile(path.join(dataDir, fileName), 'utf8')
      .then((raw) => JSON.parse(raw))
      .catch((error) => {
        jsonCache.delete(fileName);
        throw error;
      });
    jsonCache.set(fileName, pending);
  }

  return jsonCache.get(fileName);
}

async function getDemonTypes() {
  return readJson('demon-types.json');
}

async function getDemonAssets() {
  return readJson('demons.json');
}

async function getWorldBossConfig() {
  return readJson('world-bosses.json');
}

async function getGameCatalog() {
  if (!gameCatalogPromise) {
    gameCatalogPromise = Promise.all([getDemonAssets(), getDemonTypes()])
      .then(([demons, types]) => ({
        demons,
        types,
        version: crypto
          .createHash('sha256')
          .update(JSON.stringify({ demons, types }))
          .digest('hex')
          .slice(0, 12)
      }))
      .catch((error) => {
        gameCatalogPromise = null;
        throw error;
      });
  }

  return gameCatalogPromise;
}

async function getFullDemonCatalog() {
  const [assets, types] = await Promise.all([getDemonAssets(), getDemonTypes()]);
  return assets.map((asset) => ({
    ...asset,
    typeData: types[String(asset.type)] || null
  }));
}

async function getFullBossCatalog() {
  const [config, assets, types] = await Promise.all([
    getWorldBossConfig(),
    getDemonAssets(),
    getDemonTypes()
  ]);
  const defaults = {
    moveIntervalSeconds: Number(config.moveIntervalSeconds) || 3600,
    rewardDurationHours: Number(config.rewardDurationHours) || 24
  };

  return (Array.isArray(config.bosses) ? config.bosses : []).map((boss) => ({
    ...boss,
    moveIntervalSeconds: Number(boss.moveIntervalSeconds) || defaults.moveIntervalSeconds,
    rewardDurationHours: Number(boss.rewardDurationHours) || defaults.rewardDurationHours,
    zoneName: Number(boss.zoneTypeId) === 0
      ? 'Neutral Ash'
      : types[String(boss.zoneTypeId)]?.name || `Zone ${boss.zoneTypeId}`,
    keyDemon: enrichBossMember(boss.keyDemon, assets, types),
    team: (Array.isArray(boss.team) ? boss.team : [])
      .map((member) => enrichBossMember(member, assets, types))
      .filter(Boolean)
  }));
}

function enrichBossMember(member, assets, types) {
  if (!member || typeof member !== 'object') return null;

  const typeId = Number(member.typeId ?? member.type);
  const rarity = String(member.rarity || 'rare').toLowerCase();
  const typeData = types[String(typeId)] || null;
  const asset = assets.find((candidate) => (
    Number(candidate.type) === typeId && candidate.rarity === rarity
  )) || assets.find((candidate) => Number(candidate.type) === typeId) || null;

  return {
    ...member,
    typeId,
    rarity,
    species: member.species || typeData?.name || `Type ${typeId} Demon`,
    role: member.role || typeData?.role || '',
    preferredPosition: member.position || typeData?.preferredPosition || asset?.preferredPosition || '',
    imageUrl: member.imageUrl || member.image_url || asset?.image_url || '',
    demon: asset ? { ...asset, typeData } : null
  };
}

module.exports = {
  getDemonAssets,
  getDemonTypes,
  getGameCatalog,
  getFullBossCatalog,
  getFullDemonCatalog,
  getWorldBossConfig
};
