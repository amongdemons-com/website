const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);

const SUMMON_REQUIREMENTS = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 5,
  legendary: 8,
  mythic: 12
});

const ECHO_SOUL_PRICES = Object.freeze({
  common: 10,
  uncommon: 30,
  rare: 100,
  epic: 300,
  legendary: 1000,
  mythic: 5000
});

const MYTHIC_ECHO_UNRAVEL_LEVELS = 5;

function normalizeEchoRarity(value) {
  const rarity = String(value || '').trim().toLowerCase();
  return RARITIES.includes(rarity) ? rarity : null;
}

function getEchoItemKey(typeId, rarity) {
  const normalizedTypeId = Math.max(0, Math.floor(Number(typeId) || 0));
  const normalizedRarity = normalizeEchoRarity(rarity);
  if (!normalizedTypeId || !normalizedRarity) return null;
  return `echo:${normalizedTypeId}:${normalizedRarity}`;
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
    mythicUnravelLevels: MYTHIC_ECHO_UNRAVEL_LEVELS
  };
}

module.exports = {
  RARITIES,
  ECHO_SOUL_PRICES,
  SUMMON_REQUIREMENTS,
  MYTHIC_ECHO_UNRAVEL_LEVELS,
  getEchoConfig,
  getEchoItemKey,
  normalizeEchoRarity,
  parseEchoItemKey
};
