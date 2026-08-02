const { getPlayerStatPointSummary } = require('./account-stat-points');
const { normalizeCombatBuffState, serializeCombatBuffState } = require('./combat-buffs');
const { getActiveWorldRewardBuffs } = require('./world-buffs');

async function resolvePlayerCombatBuffState(player) {
  const [summary, activeBossBuffs] = await Promise.all([
    getPlayerStatPointSummary(player),
    getActiveWorldRewardBuffs(player)
  ]);
  return createPlayerCombatBuffState(summary, { activeBuffs: activeBossBuffs });
}

async function resolveActivePlayerCombatBuffs(player) {
  return serializeCombatBuffState(await resolvePlayerCombatBuffState(player)).activeBuffs;
}

function getActivePlayerWorldRewardBuffs(source = {}) {
  return serializeCombatBuffState(source).activeBuffs.filter((buff) => (
    buff?.source === 'world_boss_reward' || buff?.source === 'soul_font'
  ));
}

function createPlayerCombatBuffState(summary = {}, options = {}) {
  return normalizeCombatBuffState({
    activeBuffs: [
      ...createPlayerCombatBuffs(summary),
      ...(Array.isArray(options.activeBuffs) ? options.activeBuffs : [])
    ]
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
    description: 'Skill-tree single-target attack bonuses.',
    icon: 'swords',
    tags: ['skill', 'damage'],
    effects: [
      flatEffect('attack_flat', bonuses.attackFlat, { singleTargetOnly: true }),
      percentEffect('attack_mult', bonuses.attackPercent, { singleTargetOnly: true })
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

function flatEffect(type, value, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return {
    type,
    value: Math.round(number * 10) / 10,
    ...options
  };
}

function percentEffect(type, percent, options = {}) {
  const number = Number(percent);
  if (!Number.isFinite(number) || number <= 0) return null;
  return {
    type,
    value: Math.round((1 + number / 100) * 1000) / 1000,
    ...options
  };
}

module.exports = {
  createPlayerCombatBuffs,
  createPlayerCombatBuffState,
  getActivePlayerWorldRewardBuffs,
  resolveActivePlayerCombatBuffs,
  resolvePlayerCombatBuffState
};
