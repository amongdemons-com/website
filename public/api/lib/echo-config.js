const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);

const SUMMON_REQUIREMENTS = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 5,
  legendary: 8,
  mythic: 12
});

const REFINEMENT_COSTS = Object.freeze({
  common: 3,
  uncommon: 3,
  rare: 4,
  epic: 5,
  legendary: 6
});

const MYTHIC_ECHO_UNRAVEL_LEVELS = 5;

function normalizeEchoRarity(value) {
  const rarity = String(value || '').trim().toLowerCase();
  return RARITIES.includes(rarity) ? rarity : null;
}

function getNextEchoRarity(value) {
  const rarity = normalizeEchoRarity(value);
  const index = RARITIES.indexOf(rarity);
  return index >= 0 && index < RARITIES.length - 1 ? RARITIES[index + 1] : null;
}

function getEchoItemKey(typeId, rarity) {
  const normalizedTypeId = Math.max(0, Math.floor(Number(typeId) || 0));
  const normalizedRarity = normalizeEchoRarity(rarity);
  if (!normalizedTypeId || !normalizedRarity) return null;
  return `echo:${normalizedTypeId}:${normalizedRarity}`;
}

function getEchoRefinementBatch(quantity, rarity) {
  const sourceQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  const recipeCost = REFINEMENT_COSTS[normalizeEchoRarity(rarity)] || 0;
  const refinedQuantity = recipeCost ? Math.floor(sourceQuantity / recipeCost) : 0;
  const consumedQuantity = refinedQuantity * recipeCost;

  return {
    recipeCost,
    refinedQuantity,
    consumedQuantity,
    remainingQuantity: sourceQuantity - consumedQuantity
  };
}

function parseEchoItemKey(value) {
  const match = /^echo:(\d+):(common|uncommon|rare|epic|legendary|mythic)$/.exec(String(value || ''));
  if (!match) return null;
  return { typeId: Number(match[1]), rarity: match[2] };
}

function getEchoConfig() {
  return {
    rarities: [...RARITIES],
    summonRequirements: { ...SUMMON_REQUIREMENTS },
    refinementCosts: { ...REFINEMENT_COSTS },
    mythicUnravelLevels: MYTHIC_ECHO_UNRAVEL_LEVELS
  };
}

module.exports = {
  RARITIES,
  REFINEMENT_COSTS,
  SUMMON_REQUIREMENTS,
  MYTHIC_ECHO_UNRAVEL_LEVELS,
  getEchoConfig,
  getEchoItemKey,
  getEchoRefinementBatch,
  getNextEchoRarity,
  normalizeEchoRarity,
  parseEchoItemKey
};
