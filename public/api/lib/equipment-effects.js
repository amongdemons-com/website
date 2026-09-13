const { SUPPORTED_EFFECT_TYPES } = require('./hunter-equipment');

const EFFECT_HANDLERS = Object.freeze({
  stat_modifier: {
    battleStart: applyStatModifierAtBattleStart,
    damage: applyStatModifierDamage,
    damageTaken: applyStatModifierDamageTaken,
    afterAction: applyStatModifierAfterAction
  },
  bonus_below_hp: {
    damage: applyBonusBelowHpDamage,
    onKill: applyBonusBelowHpOnKill
  },
  bonus_per_dead_ally: {
    damage: applyBonusPerDeadAllyDamage,
    damageTaken: applyBonusPerDeadAllyDamageTaken,
    onAllyDeath: applyBonusPerDeadAllyDeath
  },
  bonus_per_role: { damage: applyBonusPerRoleDamage },
  bonus_per_empty_team_slot: { damage: applyBonusPerEmptySlotDamage },
  resurrect_first_dead: { resurrect: resurrectFirstDead },
  on_kill_buff: { onKill: applyOnKillBuff },
  on_ally_death: { onAllyDeath: applyOnAllyDeath },
  battle_start_buff: { battleStart: applyBattleStartBuff, tick: applyBattleStartTick },
  modify_poison: { poison: applyPoisonEffect },
  modify_healing: { healing: applyHealingEffect, afterHealing: applyAfterHealingEffect },
  modify_targeting: { battleStart: applyTargetingEffect, damage: applyTargetingDamage }
});

for (const effectType of SUPPORTED_EFFECT_TYPES) {
  if (!EFFECT_HANDLERS[effectType]) throw new Error(`Missing equipment effect handler: ${effectType}`);
}

function createEquipmentCombatState(source, team = [], demonTypes = {}) {
  const items = normalizeEquipmentCombatItems(source);
  return {
    items,
    initialTeamSize: team.length,
    roleCount: countTeamRoles(team, demonTypes),
    resurrectionUsed: false
  };
}

function initializeEquipmentCombat(context) {
  context.equipment = {
    player: createEquipmentCombatState(context.playerEquipment, context.players, context.demonTypes),
    enemy: createEquipmentCombatState(context.enemyEquipment, context.enemies, context.demonTypes)
  };

  for (const ownerSide of ['player', 'enemy']) {
    forEachEquipmentEffect(context, ownerSide, 'battleStart', {
      tick: 0,
      ownerSide
    });
  }
  return context.equipment;
}

function normalizeEquipmentCombatItems(source) {
  const input = Array.isArray(source) ? source : (Array.isArray(source?.items) ? source.items : []);
  return input.map((item) => {
    const type = String(item?.effect?.type || '');
    if (!EFFECT_HANDLERS[type]) return null;
    const slotKey = Array.isArray(item.equippedSlots) ? String(item.equippedSlots[0] || '') : '';
    const itemKey = String(item.itemKey || '');
    return {
      id: String(item.id || item.itemKey || ''),
      itemKey,
      instanceKey: String(item.instanceKey || (slotKey ? `${itemKey}@${slotKey}` : itemKey)),
      name: String(item.name || 'Equipment'),
      rarity: String(item.rarity || 'common'),
      slot: String(item.slot || ''),
      effect: {
        type,
        values: cloneJson(item.effect.values || {}),
        targetRoles: Array.isArray(item.effect.targetRoles) ? item.effect.targetRoles.map(String) : [],
        targetTypeIds: Array.isArray(item.effect.targetTypeIds) ? item.effect.targetTypeIds.map(Number) : [],
        condition: cloneJson(item.effect.condition || {})
      }
    };
  }).filter(Boolean);
}

function getEquipmentTargeting(demon, fallback = 'front') {
  return demon?.battleBuffs?.equipmentTargeting || fallback;
}

function applyEquipmentDamageModifiers(context) {
  if (!Number.isFinite(Number(context.damage)) || Number(context.damage) <= 0) return 0;
  if (isInvulnerable(context.target, context.tick)) return 0;

  let damage = Number(context.damage);
  const attackerSide = normalizeSide(context.attackerSide);
  const targetSide = normalizeSide(context.targetSide);
  damage = forEachEquipmentEffect(context, attackerSide, 'damage', { ...context, damage });
  damage = forEachEquipmentEffect(context, targetSide, 'damageTaken', { ...context, damage });

  const temporaryPercent = getActiveTemporaryDamagePercent(context.attacker, context.tick);
  const permanentPercent = Number(context.attacker?.battleBuffs?.equipmentDamagePercent) || 0;
  return roundDamage(damage * percentMultiplier(temporaryPercent + permanentPercent));
}

function applyEquipmentPoisonModifiers(context) {
  const ownerSide = normalizeSide(context.attackerSide);
  let result = {
    damage: Math.max(1, Number(context.damage) || 1),
    durationTicks: Math.max(1, Number(context.durationTicks) || 1),
    healingReductionPercent: 0
  };

  for (const item of getEquipmentItems(context, ownerSide)) {
    const handler = EFFECT_HANDLERS[item.effect.type]?.poison;
    if (!handler || !effectAppliesToDemon(item, context.attacker, context, ownerSide)) continue;
    result = handler({ ...context, ownerSide, item, result }) || result;
  }

  return {
    ...result,
    damage: Math.max(1, Number(result.damage) || 1),
    durationTicks: Math.max(1, Math.round(Number(result.durationTicks) || 1)),
    healingReductionPercent: clamp(Number(result.healingReductionPercent) || 0, 0, 95)
  };
}

function applyEquipmentHealingModifiers(context) {
  const healerSide = normalizeSide(context.healerSide);
  let healing = Math.max(0, Number(context.healing) || 0);
  healing = forEachEquipmentEffect(context, healerSide, 'healing', { ...context, healing });

  const poisonReduction = (context.target?.statusEffects?.poison || [])
    .reduce((maximum, poison) => Math.max(maximum, Number(poison.healingReductionPercent) || 0), 0);
  return Math.max(0, Math.round(healing * percentMultiplier(-clamp(poisonReduction, 0, 95))));
}

function handleEquipmentAfterHealing(context) {
  const healerSide = normalizeSide(context.healerSide);
  forEachEquipmentEffect(context, healerSide, 'afterHealing', context);
}

function tryEquipmentResurrection(context) {
  const targetSide = normalizeSide(context.targetSide);
  for (const item of getEquipmentItems(context, targetSide)) {
    const handler = EFFECT_HANDLERS[item.effect.type]?.resurrect;
    if (!handler || !effectAppliesToDemon(item, context.target, context, targetSide)) continue;
    if (handler({ ...context, ownerSide: targetSide, item })) return true;
  }
  return false;
}

function handleEquipmentFinalDeath(context) {
  const targetSide = normalizeSide(context.targetSide);
  const attackerSide = normalizeSide(context.attackerSide || opposingSide(targetSide));
  forEachEquipmentEffect(context, targetSide, 'onAllyDeath', { ...context, ownerSide: targetSide });

  if (context.skipOnKill) return;
  const attacker = context.attacker || findDemonById(getTeam(context, attackerSide), context.attackerId);
  if (!attacker || attacker.hp <= 0) return;
  forEachEquipmentEffect(context, attackerSide, 'onKill', {
    ...context,
    attacker,
    ownerSide: attackerSide
  });
}

function handleEquipmentTick(context) {
  for (const side of ['player', 'enemy']) {
    expireTemporaryEquipmentEffects(getTeam(context, side), context.tick);
    forEachEquipmentEffect(context, side, 'tick', { ...context, ownerSide: side });
  }
}

function handleEquipmentAfterAction(context) {
  const ownerSide = normalizeSide(context.actorSide);
  const deaths = [];
  for (const item of getEquipmentItems(context, ownerSide)) {
    const handler = EFFECT_HANDLERS[item.effect.type]?.afterAction;
    if (!handler || !effectAppliesToDemon(item, context.actor, context, ownerSide)) continue;
    const result = handler({ ...context, ownerSide, item });
    if (Array.isArray(result)) deaths.push(...result);
  }
  return deaths;
}

function getEquipmentReflection(context) {
  const targetSide = normalizeSide(context.targetSide);
  if (context.damageKind !== 'direct' || Number(context.hpDamage) <= 0) return null;

  let reflectPercent = 0;
  let critChance = 0;
  let critDamagePercent = 150;
  for (const item of getEquipmentItems(context, targetSide)) {
    if (!effectAppliesToDemon(item, context.target, context, targetSide)) continue;
    const values = item.effect.values;
    reflectPercent += Math.max(0, Number(values.reflectDamagePercent) || 0);
    critChance += Math.max(0, Number(values.reflectionCritChancePercent) || 0);
    critDamagePercent = Math.max(critDamagePercent, Number(values.reflectionCritDamagePercent) || 0);
  }
  if (reflectPercent <= 0) return null;

  const critical = typeof context.rng === 'function' && context.rng() < clamp(critChance, 0, 100) / 100;
  const baseDamage = Math.max(1, Math.round(Number(context.hpDamage) * reflectPercent / 100));
  return {
    damage: critical ? Math.max(1, Math.round(baseDamage * critDamagePercent / 100)) : baseDamage,
    critical,
    reflectPercent
  };
}

function modifyEquipmentReflectionDamage(context) {
  const ownerSide = normalizeSide(context.ownerSide);
  let damage = Math.max(1, Number(context.damage) || 1);
  let critical = false;
  for (const item of getEquipmentItems(context, ownerSide)) {
    if (!effectAppliesToDemon(item, context.reflector, context, ownerSide)) continue;
    const chance = Math.max(0, Number(item.effect.values.reflectionCritChancePercent) || 0);
    const criticalPercent = Math.max(100, Number(item.effect.values.reflectionCritDamagePercent) || 150);
    if (!critical && typeof context.rng === 'function' && context.rng() < clamp(chance, 0, 100) / 100) {
      damage = Math.max(1, Math.round(damage * criticalPercent / 100));
      critical = true;
    }
  }
  return { damage, critical };
}

function recordEquipmentShieldDamage(target, shieldDamage) {
  let remaining = Math.max(0, Number(shieldDamage) || 0);
  const entries = target?.battleBuffs?.equipmentShields || [];
  for (const entry of entries) {
    if (remaining <= 0) break;
    const absorbed = Math.min(remaining, Math.max(0, Number(entry.remaining) || 0));
    entry.remaining -= absorbed;
    remaining -= absorbed;
  }
}

function applyStatModifierAtBattleStart(args) {
  const team = getTeam(args, args.ownerSide);
  team.forEach((demon) => {
    if (effectAppliesToDemon(args.item, demon, args, args.ownerSide)) {
      applyBaseStats(demon, args.item.effect.values);
    }
  });
}

function applyStatModifierDamage(args) {
  if (!effectAppliesToDemon(args.item, args.attacker, args, args.ownerSide)) return args.damage;
  return Number(args.damage) * percentMultiplier(args.item.effect.values.damagePercent);
}

function applyStatModifierDamageTaken(args) {
  if (!effectAppliesToDemon(args.item, args.target, args, args.ownerSide)) return args.damage;
  return Number(args.damage) * percentMultiplier(args.item.effect.values.damageTakenPercent);
}

function applyStatModifierAfterAction(args) {
  const percent = Math.max(0, Number(args.item.effect.values.allyDamageMaxHpPercent) || 0);
  if (percent <= 0 || args.actionKind === 'heal' || args.actionKind === 'poison') return [];

  const casualties = [];
  getTeam(args, args.ownerSide)
    .filter((ally) => ally.hp > 0 && ally.instanceId !== args.actor.instanceId)
    .forEach((ally) => {
      const damage = Math.max(1, Math.round((Number(ally.maxHp) || 1) * percent / 100));
      const result = args.dealDamage(ally, damage);
      recordEquipmentShieldDamage(ally, result.shieldDamage);
      args.combatLog.push(createEffectLog(args, {
        attacker: args.actor.instanceId,
        target: ally.instanceId,
        targeting: 'allies',
        effect: 'equipment_scorch',
        dmg: result.damage,
        shieldDamage: result.shieldDamage,
        targetShield: ally.shield || 0,
        targetHp: ally.hp
      }));
      if (ally.hp <= 0) casualties.push(ally);
    });
  return casualties;
}

function applyBonusBelowHpDamage(args) {
  const threshold = clamp(Number(args.item.effect.values.thresholdPercent) || 0, 0, 100);
  const maxHp = Math.max(1, Number(args.target?.maxHp) || 1);
  if (!args.target || Number(args.target.hp) / maxHp > threshold / 100) return args.damage;
  return Number(args.damage) * percentMultiplier(args.item.effect.values.damagePercent);
}

function applyBonusBelowHpOnKill(args) {
  const percent = Number(args.item.effect.values.onKillDamagePercent) || 0;
  if (percent) addPermanentDamage(args.attacker, percent);
}

function applyBonusPerDeadAllyDamage(args) {
  if (!effectConditionApplies(args.item, args, args.ownerSide)) return args.damage;
  const dead = countDead(getTeam(args, args.ownerSide));
  return Number(args.damage) * percentMultiplier(dead * (Number(args.item.effect.values.damagePercentPerDeadAlly) || 0));
}

function applyBonusPerDeadAllyDamageTaken(args) {
  if (!effectConditionApplies(args.item, args, args.ownerSide)) return args.damage;
  const dead = countDead(getTeam(args, args.ownerSide));
  const percent = dead * (Number(args.item.effect.values.damageTakenPercentPerDeadAlly) || 0);
  return Number(args.damage) * percentMultiplier(percent);
}

function applyBonusPerDeadAllyDeath(args) {
  if (!effectConditionApplies(args.item, args, args.ownerSide)) return;
  const survivors = living(getTeam(args, args.ownerSide));
  const dead = countDead(getTeam(args, args.ownerSide));
  const speedPercent = dead * (Number(args.item.effect.values.speedPercentPerDeadAlly) || 0);
  survivors.forEach((demon) => applyOnceSpeedBonus(demon, `${getEquipmentSource(args.item)}:last`, speedPercent));
}

function applyBonusPerRoleDamage(args) {
  const state = getEquipmentState(args, args.ownerSide);
  const percent = state.roleCount * (Number(args.item.effect.values.damagePercentPerRole) || 0);
  return Number(args.damage) * percentMultiplier(percent);
}

function applyBonusPerEmptySlotDamage(args) {
  const capacity = Math.max(1, Number(args.item.effect.values.teamCapacity) || 9);
  const empty = Math.max(0, capacity - getEquipmentState(args, args.ownerSide).initialTeamSize);
  const percent = empty * (Number(args.item.effect.values.damagePercentPerSlot) || 0);
  return Number(args.damage) * percentMultiplier(percent);
}

function resurrectFirstDead(args) {
  const state = getEquipmentState(args, args.ownerSide);
  if (state.resurrectionUsed || !args.target || args.target.hp > 0) return false;
  state.resurrectionUsed = true;
  if (args.battleState) {
    args.battleState[args.ownerSide === 'enemy'
      ? 'enemyEquipmentResurrectionUsed'
      : 'playerEquipmentResurrectionUsed'] = true;
  }

  const values = args.item.effect.values;
  args.target.hp = Math.max(1, Math.round((Number(args.target.maxHp) || 1) * Math.max(1, Number(values.resurrectHpPercent) || 1) / 100));
  args.target.deathBuffsHandled = false;
  applySpeedPercent(args.target, values.speedPercent);
  if (Number(values.invulnerableTicks) > 0) {
    ensureBattleBuffs(args.target).equipmentInvulnerableUntil = args.tick + Number(values.invulnerableTicks);
  }
  args.combatLog.push(createEffectLog(args, {
    attacker: args.target.instanceId,
    target: args.target.instanceId,
    targeting: 'self',
    effect: 'equipment_resurrect',
    dmg: 0,
    healing: args.target.hp,
    targetHp: args.target.hp,
    itemId: args.item.id
  }));
  return true;
}

function applyOnKillBuff(args) {
  const values = args.item.effect.values;
  addPermanentDamage(args.attacker, values.damagePercent);
  applySpeedPercent(args.attacker, values.speedPercent);
  healDemon(args.attacker, values.healMaxHpPercent);
}

function applyOnAllyDeath(args) {
  const survivors = living(getTeam(args, args.ownerSide));
  const values = args.item.effect.values;
  survivors.forEach((demon) => {
    const healing = healDemon(demon, values.healMaxHpPercent);
    const shield = addShield(demon, values.shieldMaxHpPercent);
    applySpeedPercent(demon, values.speedPercent);
    addPermanentDamage(demon, values.damagePercent);
    if (!healing && !shield && !values.speedPercent && !values.damagePercent) return;
  });
  if (!survivors.length) return;
  args.combatLog.push(createEffectLog(args, {
    attacker: args.target.instanceId,
    target: args.target.instanceId,
    targeting: 'allies',
    effect: 'equipment_ally_death',
    dmg: 0,
    targetHp: 0,
    affectedAllies: survivors.map((demon) => demon.instanceId),
    itemId: args.item.id
  }));
}

function applyBattleStartBuff(args) {
  const owningTeam = getTeam(args, args.ownerSide);
  if (!effectConditionApplies(args.item, args, args.ownerSide, owningTeam)) return;
  const values = args.item.effect.values;
  const targetSide = values.target === 'enemies' ? opposingSide(args.ownerSide) : args.ownerSide;
  const targetTeam = getTeam(args, targetSide);

  if (values.selector === 'share_strongest_with_weakest') {
    shareStrongestWithWeakest(targetTeam, values.sharePercent);
    return;
  }
  if (values.selector === 'highest_damage') {
    const target = [...living(targetTeam)].sort((a, b) => getDemonDamage(b) - getDemonDamage(a))[0];
    if (target) applyBattleStartValues(target, values, args.item);
    return;
  }
  if (values.selector === 'share_strongest_with_weakest') return;
  if (values.selector === 'weakest' || values.selector === 'share_weakest') {
    const target = getWeakestDemon(targetTeam);
    if (target) applyBattleStartValues(target, values, args.item);
    return;
  }
  if (values.selector === 'share_strongest') return;
  if (values.selector === 'sacrifice_weakest') {
    const weakest = getWeakestDemon(targetTeam);
    if (!weakest) return;
    weakest.hp = Math.max(1, Math.round(weakest.maxHp * clamp(values.initialHpPercent, 1, 100) / 100));
    addShield(weakest, values.sacrificeShieldPercent);
    targetTeam.filter((demon) => demon.instanceId !== weakest.instanceId)
      .forEach((demon) => addPermanentDamage(demon, values.otherAlliesDamagePercent));
    return;
  }

  targetTeam.forEach((demon) => applyBattleStartValues(demon, values, args.item));
}

function applyBattleStartValues(demon, values, item) {
  applyBaseStats(demon, values);
  addPermanentDamage(demon, values.damagePercent);
  if (Number(values.shieldMaxHpPercent) > 0) {
    addTemporaryShield(demon, values.shieldMaxHpPercent, values.durationTicks, item.itemKey);
  }
  if (Number(values.regenMaxHpPercent) > 0) {
    const buffs = ensureBattleBuffs(demon);
    buffs.equipmentRegeneration = buffs.equipmentRegeneration || [];
    buffs.equipmentRegeneration.push({
      source: getEquipmentSource(item),
      percent: Number(values.regenMaxHpPercent),
      belowHalfBonusPercent: Number(values.regenBelowHpBonusPercent) || 0,
      intervalTicks: Math.max(1, Math.round(Number(values.intervalTicks) || 10))
    });
  }
  if (Number(values.durationTicks) > 0 && Number(values.speedPercent)) {
    addTemporarySpeed(demon, values.speedPercent, values.durationTicks, getEquipmentSource(item));
  }
}

function applyBattleStartTick(args) {
  const team = getTeam(args, args.ownerSide);
  team.filter((demon) => demon.hp > 0).forEach((demon) => {
    for (const regen of demon.battleBuffs?.equipmentRegeneration || []) {
      if (args.tick % regen.intervalTicks !== 0) continue;
      const belowHalf = demon.hp < demon.maxHp * 0.5;
      const multiplier = belowHalf ? percentMultiplier(regen.belowHalfBonusPercent) : 1;
      const healing = Math.max(1, Math.round(demon.maxHp * regen.percent / 100 * multiplier));
      const applied = Math.min(healing, demon.maxHp - demon.hp);
      if (applied <= 0) continue;
      demon.hp += applied;
      args.combatLog.push(createEffectLog(args, {
        attacker: demon.instanceId,
        target: demon.instanceId,
        targeting: 'self',
        effect: 'equipment_regeneration',
        dmg: 0,
        healing: applied,
        targetHp: demon.hp
      }));
    }
  });
}

function applyPoisonEffect(args) {
  const values = args.item.effect.values;
  return {
    damage: Number(args.result.damage) * percentMultiplier(values.tickDamagePercent),
    durationTicks: Number(args.result.durationTicks) * percentMultiplier(values.durationPercent),
    healingReductionPercent: Math.max(
      Number(args.result.healingReductionPercent) || 0,
      Number(values.healingReductionPercent) || 0
    )
  };
}

function applyHealingEffect(args) {
  return Number(args.healing) * percentMultiplier(args.item.effect.values.healingPercent);
}

function applyAfterHealingEffect(args) {
  const percent = Number(args.item.effect.values.damageBuffPercent) || 0;
  const duration = Math.max(1, Number(args.item.effect.values.durationTicks) || 1);
  if (percent <= 0 || !args.target || Number(args.appliedHealing) <= 0) return;
  const buffs = ensureBattleBuffs(args.target);
  buffs.equipmentTemporaryDamage = (buffs.equipmentTemporaryDamage || [])
    .filter((entry) => entry.source !== getEquipmentSource(args.item));
  buffs.equipmentTemporaryDamage.push({
    source: getEquipmentSource(args.item),
    percent,
    expiresAt: args.tick + duration
  });
}

function applyTargetingEffect(args) {
  const targeting = String(args.item.effect.values.targeting || '');
  if (!targeting) return;
  getTeam(args, args.ownerSide).forEach((demon) => {
    if (effectAppliesToDemon(args.item, demon, args, args.ownerSide)) {
      ensureBattleBuffs(demon).equipmentTargeting = targeting;
    }
  });
}

function applyTargetingDamage(args) {
  const values = args.item.effect.values;
  if (values.targeting === 'lowest_hp') {
    const opponents = living(getTeam(args, opposingSide(args.ownerSide)));
    const lowestHp = Math.min(...opponents.map((demon) => Number(demon.hp) || 0));
    if (!args.target || Number(args.target.hp) !== lowestHp) return args.damage;
  }
  return Number(args.damage) * percentMultiplier(values.damagePercent);
}

function forEachEquipmentEffect(context, ownerSide, hook, args) {
  let current = args.damage ?? args.healing;
  const valueHook = hook === 'damage' || hook === 'damageTaken' || hook === 'healing';

  for (const item of getEquipmentItems(context, ownerSide)) {
    const handler = EFFECT_HANDLERS[item.effect.type]?.[hook];
    if (!handler) continue;
    const nextArgs = {
      ...context,
      ...args,
      ownerSide,
      item,
      ...(hook === 'healing' ? { healing: current } : { damage: current })
    };
    const result = handler(nextArgs);
    if (valueHook && Number.isFinite(Number(result))) current = Number(result);
  }
  return valueHook ? current : undefined;
}

function effectAppliesToDemon(item, demon, context, ownerSide) {
  if (!demon) return false;
  const roles = item.effect.targetRoles || [];
  const typeIds = item.effect.targetTypeIds || [];
  if (roles.length && !roles.includes(getDemonRole(demon, context.demonTypes))) return false;
  if (typeIds.length && !typeIds.includes(Number(demon.typeId || demon.type_id || demon.type))) return false;
  return effectConditionApplies(item, context, ownerSide);
}

function effectConditionApplies(item, context, ownerSide, team = getTeam(context, ownerSide)) {
  const condition = item.effect.condition || {};
  const livingCount = living(team).length;
  if (Number.isFinite(Number(condition.teamSize)) && team.length !== Number(condition.teamSize)) return false;
  if (Number.isFinite(Number(condition.livingTeamCount)) && livingCount !== Number(condition.livingTeamCount)) return false;
  if (Number.isFinite(Number(condition.livingAlliesAtLeast))) {
    const subject = ownerSide === context.targetSide ? context.target : context.attacker;
    const livingAllies = living(team).filter((demon) => demon.instanceId !== subject?.instanceId).length;
    if (livingAllies < Number(condition.livingAlliesAtLeast)) return false;
  }
  return true;
}

function applyBaseStats(demon, values = {}) {
  if (Number(values.maxHpPercent)) {
    const oldMax = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
    const ratio = clamp(Number(demon.hp) / oldMax, 0, 1);
    demon.maxHp = Math.max(1, Math.round(oldMax * percentMultiplier(values.maxHpPercent)));
    demon.hp = Math.max(demon.hp > 0 ? 1 : 0, Math.min(demon.maxHp, Math.round(demon.maxHp * ratio)));
  }
  if (Number(values.attackPercent)) {
    demon.atk = Math.max(1, Math.round((Number(demon.atk) || 1) * percentMultiplier(values.attackPercent)));
  }
  if (Number(values.speedPercent) && !Number(values.durationTicks)) applySpeedPercent(demon, values.speedPercent);
}

function applySpeedPercent(demon, percent) {
  if (!Number(percent)) return 0;
  const previous = Math.max(1, Number(demon.speed) || 1);
  const next = Math.max(1, Math.round(previous * percentMultiplier(percent)));
  demon.speed = next;
  return next - previous;
}

function applyOnceSpeedBonus(demon, source, percent) {
  if (!Number(percent)) return;
  const buffs = ensureBattleBuffs(demon);
  buffs.equipmentAppliedSpeedSources = buffs.equipmentAppliedSpeedSources || [];
  if (buffs.equipmentAppliedSpeedSources.includes(source)) return;
  buffs.equipmentAppliedSpeedSources.push(source);
  applySpeedPercent(demon, percent);
}

function addPermanentDamage(demon, percent) {
  if (!Number(percent)) return;
  const buffs = ensureBattleBuffs(demon);
  buffs.equipmentDamagePercent = (Number(buffs.equipmentDamagePercent) || 0) + Number(percent);
}

function addTemporarySpeed(demon, percent, durationTicks, source) {
  const amount = applySpeedPercent(demon, percent);
  const buffs = ensureBattleBuffs(demon);
  buffs.equipmentTemporarySpeed = buffs.equipmentTemporarySpeed || [];
  buffs.equipmentTemporarySpeed.push({ source, amount, expiresAt: Math.max(1, Number(durationTicks) || 1) });
}

function addTemporaryShield(demon, percent, durationTicks, source) {
  const amount = addShield(demon, percent);
  if (!amount) return;
  const buffs = ensureBattleBuffs(demon);
  buffs.equipmentShields = buffs.equipmentShields || [];
  buffs.equipmentShields.push({ source, remaining: amount, expiresAt: Math.max(1, Number(durationTicks) || 1) });
}

function addShield(demon, percent) {
  const normalizedPercent = Number(percent);
  if (!Number.isFinite(normalizedPercent) || normalizedPercent <= 0) return 0;
  const amount = Math.max(1, Math.round((Number(demon.maxHp) || 1) * normalizedPercent / 100));
  demon.shield = Math.max(0, Number(demon.shield) || 0) + amount;
  return amount;
}

function healDemon(demon, percent) {
  const normalizedPercent = Number(percent);
  if (!Number.isFinite(normalizedPercent) || normalizedPercent <= 0 || demon.hp <= 0) return 0;
  const amount = Math.max(1, Math.round((Number(demon.maxHp) || 1) * normalizedPercent / 100));
  const applied = Math.min(amount, Math.max(0, demon.maxHp - demon.hp));
  demon.hp += applied;
  return applied;
}

function shareStrongestWithWeakest(team, percent) {
  const survivors = living(team);
  if (survivors.length < 2 || Number(percent) <= 0) return;
  const sorted = [...survivors].sort((a, b) => getDemonPower(b) - getDemonPower(a));
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];
  const share = clamp(Number(percent), 0, 100) / 100;

  for (const stat of ['maxHp', 'atk', 'speed']) {
    const difference = Math.max(0, (Number(strongest[stat]) || 1) - (Number(weakest[stat]) || 1));
    const gain = Math.round(difference * share);
    if (gain <= 0) continue;
    weakest[stat] = Math.max(1, Number(weakest[stat]) + gain);
    if (stat === 'maxHp') weakest.hp = Math.min(weakest.maxHp, Number(weakest.hp) + gain);
  }
}

function expireTemporaryEquipmentEffects(team, tick) {
  team.forEach((demon) => {
    const buffs = ensureBattleBuffs(demon);
    const speedEntries = buffs.equipmentTemporarySpeed || [];
    speedEntries.filter((entry) => entry.expiresAt === tick).forEach((entry) => {
      demon.speed = Math.max(1, (Number(demon.speed) || 1) - (Number(entry.amount) || 0));
    });
    buffs.equipmentTemporarySpeed = speedEntries.filter((entry) => entry.expiresAt > tick);

    const shieldEntries = buffs.equipmentShields || [];
    shieldEntries.filter((entry) => entry.expiresAt === tick).forEach((entry) => {
      demon.shield = Math.max(0, (Number(demon.shield) || 0) - Math.max(0, Number(entry.remaining) || 0));
    });
    buffs.equipmentShields = shieldEntries.filter((entry) => entry.expiresAt > tick && entry.remaining > 0);
    buffs.equipmentTemporaryDamage = (buffs.equipmentTemporaryDamage || []).filter((entry) => entry.expiresAt > tick);
  });
}

function getActiveTemporaryDamagePercent(demon, tick) {
  return (demon?.battleBuffs?.equipmentTemporaryDamage || [])
    .filter((entry) => Number(entry.expiresAt) > Number(tick))
    .reduce((sum, entry) => sum + (Number(entry.percent) || 0), 0);
}

function isInvulnerable(demon, tick) {
  return Number(demon?.battleBuffs?.equipmentInvulnerableUntil) >= Number(tick);
}

function getEquipmentItems(context, side) {
  return getEquipmentState(context, side).items;
}

function getEquipmentSource(item) {
  return item?.instanceKey || item?.itemKey || item?.id || 'equipment';
}

function getEquipmentState(context, side) {
  return context.equipment?.[normalizeSide(side)] || { items: [], initialTeamSize: 0, roleCount: 0, resurrectionUsed: false };
}

function getTeam(context, side) {
  return normalizeSide(side) === 'enemy' ? (context.enemies || []) : (context.players || []);
}

function getDemonRole(demon, demonTypes = {}) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  return String(demon?.role || demonTypes[String(typeId)]?.role || '').toLowerCase();
}

function countTeamRoles(team, demonTypes) {
  return new Set(team.map((demon) => getDemonRole(demon, demonTypes)).filter(Boolean)).size;
}

function getWeakestDemon(team) {
  return [...living(team)].sort((a, b) => getDemonPower(a) - getDemonPower(b))[0] || null;
}

function getDemonPower(demon) {
  return (Number(demon.maxHp) || 0) + (Number(demon.atk) || 0) * 5 + (Number(demon.speed) || 0) * 3;
}

function getDemonDamage(demon) {
  return Number(demon.effectiveAtk ?? demon.atk) || 0;
}

function findDemonById(team, instanceId) {
  return team.find((demon) => demon.instanceId === instanceId) || null;
}

function living(team) {
  return (team || []).filter((demon) => Number(demon.hp) > 0);
}

function countDead(team) {
  return (team || []).filter((demon) => Number(demon.hp) <= 0).length;
}

function ensureBattleBuffs(demon) {
  demon.battleBuffs = demon.battleBuffs || {};
  return demon.battleBuffs;
}

function createEffectLog(args, fields) {
  return {
    tick: Number(args.tick) || 0,
    attackerPosition: normalizePosition(findDemonById([...(args.players || []), ...(args.enemies || [])], fields.attacker)?.position),
    targetPosition: normalizePosition(findDemonById([...(args.players || []), ...(args.enemies || [])], fields.target)?.position),
    ...fields
  };
}

function normalizeSide(side) {
  return side === 'enemy' ? 'enemy' : 'player';
}

function opposingSide(side) {
  return normalizeSide(side) === 'enemy' ? 'player' : 'enemy';
}

function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
}

function percentMultiplier(percent) {
  return Math.max(0, 1 + (Number(percent) || 0) / 100);
}

function roundDamage(value) {
  const number = Number(value) || 0;
  return number <= 0 ? 0 : Math.max(1, Math.round(number));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

module.exports = {
  EFFECT_HANDLERS,
  applyEquipmentDamageModifiers,
  applyEquipmentHealingModifiers,
  applyEquipmentPoisonModifiers,
  createEquipmentCombatState,
  getEquipmentReflection,
  getEquipmentTargeting,
  handleEquipmentAfterAction,
  handleEquipmentAfterHealing,
  handleEquipmentFinalDeath,
  handleEquipmentTick,
  initializeEquipmentCombat,
  modifyEquipmentReflectionDamage,
  normalizeEquipmentCombatItems,
  recordEquipmentShieldDamage,
  tryEquipmentResurrection
};
