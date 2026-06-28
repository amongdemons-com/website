const { getPlayerStatPointSummary } = require('./account-stat-points');
const { normalizeCombatBuffState, serializeCombatBuffState } = require('./combat-buffs');

async function resolvePlayerCombatBuffState(player) {
  const summary = await getPlayerStatPointSummary(player);
  return createPlayerCombatBuffState(summary);
}

async function resolveActivePlayerCombatBuffs(player) {
  return serializeCombatBuffState(await resolvePlayerCombatBuffState(player)).activeBuffs;
}

function createPlayerCombatBuffState(summary = {}) {
  return normalizeCombatBuffState({
    activeBuffs: createPlayerCombatBuffs(summary)
  });
}

function createPlayerCombatBuffs(summary = {}) {
  const bonuses = summary.bonuses || {};
  const buffs = [];

  addBuff(buffs, {
    id: 'skill_vitality',
    name: 'Soulbound Vitality',
    description: 'Skill-tree health bonuses.',
    icon: 'heart',
    tags: ['skill', 'health'],
    effects: [
      flatEffect('max_hp_flat', bonuses.maxHpFlat),
      percentEffect('max_hp_mult', bonuses.maxHpPercent)
    ]
  });

  addBuff(buffs, {
    id: 'skill_restoration',
    name: 'Soulbound Restoration',
    description: 'Skill-tree healing bonuses.',
    icon: 'heart-pulse',
    tags: ['skill', 'healing'],
    effects: [
      flatEffect('healing_flat', bonuses.healingFlat),
      percentEffect('healing_mult', bonuses.healingPercent)
    ]
  });

  addBuff(buffs, {
    id: 'skill_thorns',
    name: 'Soulbound Thorns',
    description: 'Skill-tree thorns bonuses.',
    icon: 'shield',
    tags: ['skill', 'retaliation'],
    effects: [
      flatEffect('thorns_flat', bonuses.thornsFlat),
      flatEffect('thorns_percent', bonuses.thornsPercent)
    ]
  });

  addBuff(buffs, {
    id: 'skill_momentum',
    name: 'Soulbound Momentum',
    description: 'Skill-tree speed bonuses.',
    icon: 'zap',
    tags: ['skill', 'speed'],
    effects: [
      flatEffect('speed_flat', bonuses.speedFlat),
      percentEffect('speed_mult', bonuses.speedPercent)
    ]
  });

  addBuff(buffs, {
    id: 'skill_force',
    name: 'Soulbound Force',
    description: 'Skill-tree attack bonuses.',
    icon: 'swords',
    tags: ['skill', 'damage'],
    effects: [
      flatEffect('attack_flat', bonuses.attackFlat),
      percentEffect('attack_mult', bonuses.attackPercent)
    ]
  });

  addBuff(buffs, {
    id: 'skill_ruin',
    name: 'Soulbound Ruin',
    description: 'Skill-tree area damage bonuses.',
    icon: 'flame',
    tags: ['skill', 'aoe'],
    effects: [
      flatEffect('aoe_damage_flat', bonuses.aoeDamageFlat),
      percentEffect('aoe_damage_mult', bonuses.aoeDamagePercent)
    ]
  });

  addBuff(buffs, {
    id: 'skill_toxins',
    name: 'Soulbound Toxins',
    description: 'Skill-tree poison damage bonuses.',
    icon: 'flask-conical',
    tags: ['skill', 'poison'],
    effects: [
      flatEffect('poison_damage_flat', bonuses.poisonDamageFlat),
      percentEffect('poison_tick_damage_mult', bonuses.poisonDamagePercent)
    ]
  });

  return buffs;
}

function addBuff(buffs, buff) {
  const effects = (buff.effects || []).filter(Boolean);
  if (!effects.length) return;

  buffs.push({
    ...buff,
    source: 'skill_tree',
    rarity: 'account',
    effects
  });
}

function flatEffect(type, value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return {
    type,
    value: Math.round(number * 10) / 10
  };
}

function percentEffect(type, percent) {
  const number = Number(percent);
  if (!Number.isFinite(number) || number <= 0) return null;
  return {
    type,
    value: Math.round((1 + number / 100) * 1000) / 1000
  };
}

module.exports = {
  createPlayerCombatBuffs,
  createPlayerCombatBuffState,
  resolveActivePlayerCombatBuffs,
  resolvePlayerCombatBuffState
};
