const { getDemonAssets, getDemonTypes } = require('./game-data');
const { pick, randomInt } = require('./rng');

const rarityWeights = [
  ['common', 58],
  ['uncommon', 24],
  ['rare', 11],
  ['epic', 5],
  ['legendary', 1.5],
  ['mythic', 0.5]
];

function pickRarity(rng, allowedRarities) {
  const weights = allowedRarities && allowedRarities.length
    ? rarityWeights.filter(([rarity]) => allowedRarities.includes(rarity))
    : rarityWeights;
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;

  for (const [rarity, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }

  return 'common';
}

function rollStats(rng, typeData, rarity) {
  const multiplier = typeData.rarityMultiplier[rarity] || 1;

  return {
    hp: Math.round(randomInt(rng, typeData.baseStats.hp[0], typeData.baseStats.hp[1]) * multiplier),
    atk: Math.round(randomInt(rng, typeData.baseStats.atk[0], typeData.baseStats.atk[1]) * multiplier),
    speed: Math.round(randomInt(rng, typeData.baseStats.speed[0], typeData.baseStats.speed[1]) * multiplier)
  };
}

async function createDemon(rng, options = {}) {
  const [assets, types] = await Promise.all([getDemonAssets(), getDemonTypes()]);
  const typeIds = options.allowedTypeIds && options.allowedTypeIds.length
    ? options.allowedTypeIds.map(Number).filter((typeId) => types[String(typeId)])
    : Object.keys(types).map(Number);
  const typeId = options.typeId || Number(pick(rng, typeIds));
  const typeData = types[String(typeId)];
  const rarity = options.rarity || pickRarity(rng, options.allowedRarities);
  const asset = assets.find((item) => item.type === typeId && item.rarity === rarity) ||
    assets.find((item) => item.type === typeId) ||
    assets[0];
  const stats = rollStats(rng, typeData, asset.rarity);

  return {
    instanceId: options.instanceId || `${typeId}-${asset.rarity}-${Math.floor(rng() * 1000000)}`,
    sourceDemonId: asset.id,
    typeId,
    species: typeData.name,
    role: typeData.role,
    targeting: typeData.targeting,
    rarity: asset.rarity,
    imageUrl: asset.image_url,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    speed: stats.speed,
    position: options.position === 'back' ? 'back' : 'front',
    attackMeter: 0
  };
}

async function createTeam(rng, size, options = {}) {
  const team = [];

  for (let index = 0; index < size; index += 1) {
    team.push(await createDemon(rng, {
      ...options,
      position: options.positions?.[index] || (index === 0 ? 'front' : 'back'),
      instanceId: `${options.prefix || 'demon'}-${index + 1}`
    }));
  }

  return team;
}

module.exports = {
  createDemon,
  createTeam
};
