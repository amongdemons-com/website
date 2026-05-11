const fs = require('fs/promises');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

async function readJson(fileName) {
  const raw = await fs.readFile(path.join(dataDir, fileName), 'utf8');
  return JSON.parse(raw);
}

async function getDemonTypes() {
  return readJson('demon-types.json');
}

async function getDemonAssets() {
  return readJson('demons.json');
}

async function getFullDemonCatalog() {
  const [assets, types] = await Promise.all([getDemonAssets(), getDemonTypes()]);
  return assets.map((asset) => ({
    ...asset,
    typeData: types[String(asset.type)] || null
  }));
}

module.exports = {
  getDemonAssets,
  getDemonTypes,
  getFullDemonCatalog
};
