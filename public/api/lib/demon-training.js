const crypto = require('crypto');
const { getDemonTypes } = require('./game-data');
const { enrichDemonPreferredPositions } = require('./run-demons');

const STAT_KEYS = ['hp', 'atk', 'speed'];
const TRAINING_BASE_COST = 2;
const TRAINING_MAX_PROGRESS_BONUS = 12;
const TRAINING_PROGRESS_EXPONENT = 2.2;
const RARITY_COST_MULTIPLIER = {
  common: 1,
  uncommon: 1.15,
  rare: 1.35,
  epic: 1.65,
  legendary: 2.1,
  mythic: 2.8
};

function getDemonTrainingInfo(demon = {}, types = {}) {
  const typeData = types[String(demon.type_id || demon.typeId || demon.type)] || {};
  const stats = {};
  let totalRange = 0;
  let totalProgress = 0;
  let totalRemaining = 0;

  STAT_KEYS.forEach((key) => {
    const statRange = Array.isArray(typeData.baseStats?.[key]) ? typeData.baseStats[key] : [];
    const min = positiveInteger(statRange[0], 1);
    const max = Math.max(min, positiveInteger(statRange[1], min));
    const current = Math.max(0, Math.floor(Number(demon[key]) || 0));
    const range = Math.max(1, max - min);
    const progress = Math.max(0, Math.min(range, current - min));
    const remaining = Math.max(0, max - current);

    totalRange += range;
    totalProgress += progress;
    totalRemaining += remaining;
    stats[key] = {
      current,
      min,
      max,
      remaining,
      maxed: remaining <= 0
    };
  });

  const maxed = totalRemaining <= 0;
  const progress = totalRange > 0 ? Math.max(0, Math.min(1, totalProgress / totalRange)) : 1;

  return {
    cost: maxed ? null : calculateTrainingCost(progress, demon.rarity),
    maxed,
    progress: Math.round(progress * 100),
    stats,
    trainableStats: STAT_KEYS.filter((key) => stats[key].remaining > 0)
  };
}

async function enrichCollectionDemonsWithTraining(demons = []) {
  const [withPositions, types] = await Promise.all([
    enrichDemonPreferredPositions(demons),
    getDemonTypes()
  ]);

  return withPositions.map((demon) => ({
    ...demon,
    training: getDemonTrainingInfo(demon, types)
  }));
}

function rollTrainingIncreases(training = {}) {
  const candidates = (training.trainableStats || [])
    .map((key) => ({
      key,
      weight: Math.max(1, Number(training.stats?.[key]?.remaining) || 0)
    }))
    .filter((candidate) => candidate.weight > 0);

  if (!candidates.length) return {};

  const picked = pickWeighted(candidates);
  return picked ? { [picked.key]: 1 } : {};
}

function applyTrainingIncreases(demon = {}, training = {}, increases = {}) {
  const next = {};

  STAT_KEYS.forEach((key) => {
    const current = Math.max(0, Math.floor(Number(demon[key]) || 0));
    const max = Math.max(current, Number(training.stats?.[key]?.max) || current);
    const increase = Math.max(0, Math.floor(Number(increases[key]) || 0));
    next[key] = Math.min(max, current + increase);
  });

  return next;
}

function calculateTrainingCost(progress, rarity) {
  const normalizedProgress = Math.max(0, Math.min(1, Number(progress) || 0));
  const rarityMultiplier = RARITY_COST_MULTIPLIER[String(rarity || '').toLowerCase()] || 1;
  const curvedCost = TRAINING_BASE_COST + TRAINING_MAX_PROGRESS_BONUS * Math.pow(normalizedProgress, TRAINING_PROGRESS_EXPONENT);
  return Math.max(1, Math.ceil(curvedCost * rarityMultiplier));
}

function pickWeighted(candidates) {
  const totalWeight = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  let roll = crypto.randomInt(1, totalWeight + 1);

  for (const candidate of candidates) {
    roll -= candidate.weight;
    if (roll <= 0) return candidate;
  }

  return candidates[0] || null;
}

function positiveInteger(value, fallback) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

module.exports = {
  STAT_KEYS,
  applyTrainingIncreases,
  enrichCollectionDemonsWithTraining,
  getDemonTrainingInfo,
  rollTrainingIncreases
};
