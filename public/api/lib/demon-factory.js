const { getDemonAssets, getDemonTypes } = require('./game-data');
const { randomInt } = require('./rng');

const rarityWeights = [
  ['common', 58],
  ['uncommon', 24],
  ['rare', 11],
  ['epic', 5],
  ['legendary', 1.5],
  ['mythic', 0.5]
];

function pickWeighted(rng, items, getWeight) {
  const weighted = items
    .map((item) => [item, Number(getWeight(item)) || 0])
    .filter(([, weight]) => weight > 0);
  const pool = weighted.length ? weighted : items.map((item) => [item, 1]);
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;

  for (const [item, weight] of pool) {
    roll -= weight;
    if (roll <= 0) return item;
  }

  return pool[0]?.[0];
}

function pickRarity(rng, allowedRarities, getWeight = (rarity, weight) => weight) {
  const weights = allowedRarities && allowedRarities.length
    ? rarityWeights.filter(([rarity]) => allowedRarities.includes(rarity))
    : rarityWeights;
  const weighted = weights
    .map(([rarity, weight]) => [rarity, Number(getWeight(rarity, weight)) || 0])
    .filter(([, weight]) => weight > 0);
  const pool = weighted.length ? weighted : weights;
  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * total;

  for (const [rarity, weight] of pool) {
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
  const typeId = options.typeId || Number(pickWeighted(rng, typeIds, (typeId) => {
    const baseWeight = Number(types[String(typeId)]?.spawnWeight) || 1;
    return typeof options.typeWeightMultiplier === 'function'
      ? baseWeight * options.typeWeightMultiplier(typeId, baseWeight)
      : baseWeight;
  }));
  const typeData = types[String(typeId)];
  const rarity = options.rarity || pickRarity(rng, options.allowedRarities, (rarity, baseWeight) => (
    typeof options.rarityWeightMultiplier === 'function'
      ? baseWeight * options.rarityWeightMultiplier(rarity, baseWeight)
      : baseWeight
  ));
  const asset = assets.find((item) => item.type === typeId && item.rarity === rarity) ||
    assets.find((item) => item.type === typeId) ||
    assets[0];
  const stats = rollStats(rng, typeData, asset.rarity);
  const preferredPosition = typeData.preferredPosition === 'back' ? 'back' : 'front';

  return {
    instanceId: options.instanceId || `${typeId}-${asset.rarity}-${Math.floor(rng() * 1000000)}`,
    sourceDemonId: asset.id,
    typeId,
    species: typeData.name,
    role: typeData.role,
    targeting: typeData.targeting,
    preferredPosition,
    rarity: asset.rarity,
    imageUrl: asset.image_url,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    speed: stats.speed,
    position: options.position ? (options.position === 'back' ? 'back' : 'front') : preferredPosition,
    attackMeter: 0
  };
}

async function createTeam(rng, size, options = {}) {
  const team = [];

  for (let index = 0; index < size; index += 1) {
    team.push(await createDemon(rng, {
      ...options,
      position: options.positions?.[index],
      instanceId: `${options.prefix || 'demon'}-${index + 1}`
    }));
  }

  return team;
}

module.exports = {
  createDemon,
  createTeam
};
