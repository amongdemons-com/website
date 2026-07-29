const fs = require('fs');
const path = require('path');
const DEFAULT_DEMON_TYPES = require('../data/demon-types.json');

const BUFF_DATA_PATH = path.join(__dirname, '..', 'data', 'combat-buffs.json');
const TEMPORARY_TEAM_SIZE_EFFECT = 'next_battle_team_size_add';
const BUFF_CHOICE_FLOOR_INTERVAL = 3;
const BUFF_REROLL_SOUL_COST = 10;
const RARITY_WEIGHTS = {
  common: 70,
  uncommon: 24,
  rare: 6
};
const DEMON_RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);

let cachedBuffs = null;
let cachedBuffsById = null;

function loadCombatBuffs() {
  if (!cachedBuffs) {
    cachedBuffs = JSON.parse(fs.readFileSync(BUFF_DATA_PATH, 'utf8'));
    cachedBuffsById = new Map();

    cachedBuffs.forEach((buff) => {
      if (!buff?.id || cachedBuffsById.has(buff.id)) {
        throw new Error(`Invalid duplicate combat buff id: ${buff?.id || 'missing'}`);
      }
      cachedBuffsById.set(buff.id, buff);
    });
  }

  return cachedBuffs;
}

function getCombatBuffById(id) {
  if (!id) return null;
  loadCombatBuffs();
  return cachedBuffsById.get(String(id)) || null;
}

function normalizeCombatBuffState(source = {}) {
  const stateSource = Array.isArray(source) ? { activeBuffs: source } : (source || {});
  const activeEntries = Array.isArray(stateSource.active) ? stateSource.active : [];
  const activeBuffs = [
    ...activeEntries.filter((entry) => entry && typeof entry === 'object'),
    ...(Array.isArray(stateSource.activeBuffs) ? stateSource.activeBuffs : [])
  ].map(normalizeCombatBuffDefinition).filter(Boolean);

  return {
    active: currentBuffIds(activeEntries, { unique: false }),
    activeBuffs,
    pendingChoices: currentBuffIds(stateSource.pendingChoices, { unique: true }),
    temporary: normalizeTemporaryBuffs(stateSource.temporary),
    rerolls: Math.max(0, Math.floor(Number(stateSource.rerolls) || 0))
  };
}

function ensureCombatBuffState(run) {
  run.state = run.state || {};
  run.state.buffs = normalizeCombatBuffState(run.state.buffs || {});
  return run.state.buffs;
}

function serializeCombatBuffState(source = {}) {
  const state = normalizeCombatBuffState(source);
  const activeBuffs = getActiveCombatBuffs(state);

  return {
    active: state.active,
    activeBuffs,
    pendingChoices: state.pendingChoices.map(getCombatBuffById).filter(Boolean),
    temporary: state.temporary,
    rerolls: state.rerolls,
    rerollCost: BUFF_REROLL_SOUL_COST
  };
}

function getActiveCombatBuffs(source = {}) {
  const state = normalizeCombatBuffState(source);
  const activeBuffs = state.active
    .map(getCombatBuffById)
    .map(normalizeCombatBuffDefinition)
    .filter(Boolean);
  const mirroredActiveCounts = state.active.reduce((counts, id) => {
    counts.set(id, (counts.get(id) || 0) + 1);
    return counts;
  }, new Map());

  state.activeBuffs.forEach((buff) => {
    const normalized = normalizeCombatBuffDefinition(buff);
    if (!normalized) return;

    // Serialized states contain both the canonical active Pact IDs and expanded
    // definitions for display. Ignore only those mirrored definitions; repeated
    // IDs in the canonical list are separate selections and must all apply.
    const mirroredCount = mirroredActiveCounts.get(normalized.id) || 0;
    if (mirroredCount > 0) {
      mirroredActiveCounts.set(normalized.id, mirroredCount - 1);
      return;
    }

    activeBuffs.push(normalized);
  });

  return activeBuffs;
}

function normalizeCombatBuffDefinition(buff) {
  if (!buff || typeof buff !== 'object') return null;
  const effects = (Array.isArray(buff.effects) ? buff.effects : [])
    .map((effect) => {
      const type = String(effect?.type || '').trim();
      if (!type) return null;
      const normalized = { type };
      if (Object.prototype.hasOwnProperty.call(effect, 'value')) {
        const value = Number(effect.value);
        normalized.value = Number.isFinite(value) ? value : 0;
      }
      if (Object.prototype.hasOwnProperty.call(effect, 'uses')) {
        normalized.uses = Math.max(1, Math.floor(Number(effect.uses) || 1));
      }
      if (effect?.singleTargetOnly === true) {
        normalized.singleTargetOnly = true;
      }
      const targetRarities = (Array.isArray(effect?.targetRarities) ? effect.targetRarities : [])
        .map((rarity) => String(rarity || '').trim().toLowerCase())
        .filter((rarity, index, values) => DEMON_RARITIES.has(rarity) && values.indexOf(rarity) === index);
      if (targetRarities.length) {
        normalized.targetRarities = targetRarities;
      }
      return normalized;
    })
    .filter(Boolean);

  if (!effects.length) return null;

  const normalized = {
    id: String(buff.id || '').trim(),
    name: String(buff.name || buff.label || 'Combat Buff'),
    description: String(buff.description || ''),
    rarity: String(buff.rarity || 'common').toLowerCase(),
    icon: String(buff.icon || 'sparkles'),
    source: String(buff.source || 'combat'),
    tags: (Array.isArray(buff.tags) ? buff.tags : []).map((tag) => String(tag)).filter(Boolean),
    effects
  };

  // Preserve the expiry timestamp for temporary buffs (e.g. world boss rewards)
  // so the client can surface when they wear off.
  const expiresAt = normalizeExpiresAt(buff.expiresAt);
  if (expiresAt) normalized.expiresAt = expiresAt;

  return normalized;
}

function normalizeExpiresAt(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

function generateBuffChoices(run, rng, count = 3, options = {}) {
  const state = ensureCombatBuffState(run);
  const choices = [];
  const excluded = new Set((options.excludeIds || []).map((id) => String(id)));
  const available = loadCombatBuffs()
    .filter((buff) => !excluded.has(buff.id));

  while (choices.length < count && available.length) {
    const index = pickWeightedBuffIndex(available, rng);
    const [buff] = available.splice(index, 1);
    choices.push(buff.id);
  }

  state.pendingChoices = choices;
  if (!options.preserveRerolls) {
    state.rerolls = 0;
  }
  return choices;
}

function selectRunBuff(run, buffId) {
  const state = ensureCombatBuffState(run);
  const id = String(buffId || '');
  const buff = getCombatBuffById(id);
  if (!buff) return null;

  state.active.push(id);
  addTemporaryEntriesForBuff(state, buff);
  state.pendingChoices = [];
  state.rerolls = 0;
  run.state.buffs = normalizeCombatBuffState(state);
  applyRunBuffStatModifiers(run);
  return buff;
}

function hasPendingBuffChoices(run) {
  return ensureCombatBuffState(run).pendingChoices.length > 0;
}

function shouldOfferRunBuffChoices(runOrFloor) {
  const floor = typeof runOrFloor === 'object'
    ? Number(runOrFloor?.floor ?? runOrFloor?.state?.currentFloor)
    : Number(runOrFloor);
  return floor > 0 && floor % BUFF_CHOICE_FLOOR_INTERVAL === 0;
}

function applyPreBattleBuffs(team, buffs, accountBonuses = {}) {
  const state = normalizeCombatBuffState(buffs);
  const persistedState = normalizeCombatBuffState({ active: state.active, temporary: state.temporary });
  const transientState = normalizeCombatBuffState({ activeBuffs: state.activeBuffs });
  const statsAlreadyApplied = (team || []).some((demon) => demon.runBuffStatsApplied);
  const accountMaxHpMult = 1 + getBonusFraction(accountBonuses.maxHpPercent);
  const accountAttackMult = 1 + getBonusFraction(accountBonuses.attackPercent);
  const accountSpeedMult = 1 + getBonusFraction(accountBonuses.speedPercent);
  const accountMaxHpFlat = Math.max(0, Number(accountBonuses.maxHpFlat) || 0);
  const accountAttackFlat = Math.max(0, Number(accountBonuses.attackFlat) || 0);
  const accountSpeedFlat = Math.max(0, Number(accountBonuses.speedFlat) || 0);
  const accountHealingMult = 1 + getBonusFraction(accountBonuses.healingPercent);
  const accountHealingFlat = Math.max(0, Number(accountBonuses.healingFlat) || 0);
  const accountThornsPercent = Math.max(0, Number(accountBonuses.thornsPercent) || 0);
  const accountThornsFlat = Math.max(0, Number(accountBonuses.thornsFlat) || 0);
  const accountAoeDamageMult = 1 + getBonusFraction(accountBonuses.aoeDamagePercent);
  const accountAoeDamageFlat = Math.max(0, Number(accountBonuses.aoeDamageFlat) || 0);
  const accountPoisonDamageMult = 1 + getBonusFraction(accountBonuses.poisonDamagePercent);
  const accountPoisonDamageFlat = Math.max(0, Number(accountBonuses.poisonDamageFlat) || 0);

  return (team || []).map((demon) => {
    const receivesSkillTreeAttack = isSingleTargetAttackDemon(demon);
    const maxHpMult = (statsAlreadyApplied ? 1 : getEffectMultiplier(persistedState, 'max_hp_mult', demon)) * getEffectMultiplier(transientState, 'max_hp_mult', demon);
    const speedMult = (statsAlreadyApplied ? 1 : getEffectMultiplier(persistedState, 'speed_mult', demon)) * getEffectMultiplier(transientState, 'speed_mult', demon);
    const attackMult = getEffectMultiplier(state, 'attack_mult', demon);
    const directDamagePreviewMult = getEffectMultiplier(state, 'direct_damage_mult', demon);
    const aoeDamagePreviewMult = getEffectMultiplier(state, 'aoe_damage_mult', demon);
    const healingPreviewMult = getEffectMultiplier(state, 'healing_mult', demon);
    const poisonDamagePreviewMult = getEffectMultiplier(state, 'poison_tick_damage_mult', demon);
    const maxHpFlat = getEffectSum(state, 'max_hp_flat', demon);
    const attackFlat = getEffectSum(state, 'attack_flat', demon);
    const speedFlat = getEffectSum(state, 'speed_flat', demon);
    const next = {
      ...demon,
      accountStatsApplied: true,
      battleBuffs: {
        ...(demon.battleBuffs || {}),
        directDamageMult: positiveNumber(demon.battleBuffs?.directDamageMult, 1),
        healingMult: accountHealingMult,
        healingFlat: accountHealingFlat + getEffectSum(state, 'healing_flat', demon),
        thornsPercent: accountThornsPercent + getEffectSum(state, 'thorns_percent', demon),
        thornsFlat: accountThornsFlat + getEffectSum(state, 'thorns_flat', demon),
        aoeDamageMult: accountAoeDamageMult,
        aoeDamageFlat: accountAoeDamageFlat + getEffectSum(state, 'aoe_damage_flat', demon),
        poisonDamageMult: accountPoisonDamageMult,
        poisonDamageFlat: accountPoisonDamageFlat + getEffectSum(state, 'poison_damage_flat', demon)
      }
    };

    if (maxHpFlat > 0) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = clamp((Number(next.hp) || baseMaxHp) / baseMaxHp, 0, 1);
      next.maxHp = Math.max(1, Math.round(baseMaxHp + maxHpFlat));
      next.hp = Math.max(next.hp > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (maxHpMult !== 1) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = clamp((Number(next.hp) || baseMaxHp) / baseMaxHp, 0, 1);
      next.maxHp = Math.max(1, Math.round(baseMaxHp * maxHpMult));
      next.hp = Math.max(next.hp > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (attackFlat > 0) {
      applyAttackStatPreviewChange(next, (atk) => Math.max(1, Math.round(atk + attackFlat)));
    }

    if (speedFlat > 0) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) + speedFlat));
    }

    if (speedMult !== 1) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) * speedMult));
    }

    if (attackMult !== 1) {
      applyAttackStatPreviewChange(next, (atk) => Math.max(1, Math.round(atk * attackMult)));
    }

    if (accountMaxHpFlat > 0) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = clamp((Number(next.hp) || baseMaxHp) / baseMaxHp, 0, 1);
      next.maxHp = Math.max(1, Math.round(baseMaxHp + accountMaxHpFlat));
      next.hp = Math.max(next.hp > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (receivesSkillTreeAttack && accountAttackFlat > 0) {
      applyAttackStatPreviewChange(next, (atk) => Math.max(1, Math.round(atk + accountAttackFlat)));
    }

    if (accountSpeedFlat > 0) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) + accountSpeedFlat));
    }

    if (accountMaxHpMult !== 1) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = clamp((Number(next.hp) || baseMaxHp) / baseMaxHp, 0, 1);
      next.maxHp = Math.max(1, Math.round(baseMaxHp * accountMaxHpMult));
      next.hp = Math.max(next.hp > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (receivesSkillTreeAttack && accountAttackMult !== 1) {
      applyAttackStatPreviewChange(next, (atk) => Math.max(1, Math.round(atk * accountAttackMult)));
    }

    if (accountSpeedMult !== 1) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) * accountSpeedMult));
    }

    applyDamageOutputStatPreview(next, {
      directDamageMult: directDamagePreviewMult,
      aoeDamageMult: aoeDamagePreviewMult * accountAoeDamageMult,
      aoeDamageFlat: accountAoeDamageFlat + getEffectSum(state, 'aoe_damage_flat', demon),
      healingMult: healingPreviewMult * accountHealingMult,
      healingFlat: accountHealingFlat + getEffectSum(state, 'healing_flat', demon),
      poisonDamageMult: poisonDamagePreviewMult * accountPoisonDamageMult,
      poisonDamageFlat: accountPoisonDamageFlat + getEffectSum(state, 'poison_damage_flat', demon),
      retaliationDamageMult: getEffectMultiplier(state, 'retaliation_damage_mult', demon)
    });

    return next;
  });
}

function applyAttackStatPreviewChange(demon, updateAtk) {
  const previousAtk = Math.max(1, Number(demon.atk) || 1);
  const previousEffectiveAtk = Number(demon.effectiveAtk);
  const nextAtk = Math.max(1, Math.round(Number(updateAtk(previousAtk)) || previousAtk));
  demon.atk = nextAtk;

  if (Number.isFinite(previousEffectiveAtk) && previousEffectiveAtk > 0) {
    demon.effectiveAtk = Math.max(1, Math.round(previousEffectiveAtk * (nextAtk / previousAtk)));
  }
}

function applyDamageOutputStatPreview(demon, options = {}) {
  const directDamageMult = positiveNumber(options.directDamageMult, 1);
  const aoeDamageMult = positiveNumber(options.aoeDamageMult, 1);
  const aoeDamageFlat = Math.max(0, Number(options.aoeDamageFlat) || 0);
  const healingMult = positiveNumber(options.healingMult, 1);
  const healingFlat = Math.max(0, Number(options.healingFlat) || 0);
  const poisonDamageMult = positiveNumber(options.poisonDamageMult, 1);
  const poisonDamageFlat = Math.max(0, Number(options.poisonDamageFlat) || 0);
  const retaliationDamageMult = positiveNumber(options.retaliationDamageMult, 1);
  const ability = getDemonAbility(demon);
  const abilityKind = String(ability.kind || '').toLowerCase();
  const isAoe = isAoeDemon(demon);
  const isSingleTarget = isSingleTargetAttackDemon(demon);
  const damageMult = (isSingleTarget ? directDamageMult : 1) * (isAoe ? aoeDamageMult : 1);
  const damageFlat = isAoe ? aoeDamageFlat : 0;
  const baseAtk = Math.max(1, Number(options.baseAtk) || Number(demon.atk) || 1);

  if (abilityKind === 'poison' && (poisonDamageMult !== 1 || poisonDamageFlat > 0)) {
    const basePoisonDamage = Math.max(1, Math.round(
      baseAtk * positiveNumber(ability.damagePerTickScale || ability.damagePerTurnScale, 1)
    ));
    demon.effectiveAtk = Math.max(1, Math.round((basePoisonDamage + poisonDamageFlat) * poisonDamageMult));
    return;
  }

  if (abilityKind === 'heal' && (healingMult !== 1 || healingFlat > 0)) {
    demon.effectiveAtk = Math.max(1, Math.round((baseAtk + healingFlat) * healingMult));
    return;
  }

  if (abilityKind === 'retaliate' && retaliationDamageMult !== 1) {
    const configuredDamage = Number(ability.damage);
    const baseRetaliationDamage = Number.isFinite(configuredDamage) && configuredDamage > 0
      ? configuredDamage
      : baseAtk;
    demon.effectiveAtk = Math.max(1, Math.round(baseRetaliationDamage * retaliationDamageMult));
    return;
  }

  if (damageMult === 1 && damageFlat <= 0) return;
  demon.effectiveAtk = Math.max(1, Math.round((baseAtk + damageFlat) * damageMult));
}

function getDemonAbility(demon = {}) {
  const typeId = Number(demon.typeId || demon.type_id || demon.type);
  const type = DEFAULT_DEMON_TYPES[String(typeId)] || {};
  return demon.ability || type.ability || {};
}

function applyRunBuffStatModifiers(run) {
  if (!run?.state) return [];

  const state = ensureCombatBuffState(run);
  run.state.team = (run.state.team || []).map((demon) => {
    const maxHpMult = getEffectMultiplier(state, 'max_hp_mult', demon);
    const speedMult = getEffectMultiplier(state, 'speed_mult', demon);
    const directDamageMult = getEffectMultiplier(state, 'direct_damage_mult', demon);
    const aoeDamageMult = getEffectMultiplier(state, 'aoe_damage_mult', demon);
    const baseAtk = Math.max(0, Number(demon.runBaseAtk) || Number(demon.atk) || 0);
    const baseMaxHp = Math.max(1, Number(demon.runBaseMaxHp) || Number(demon.maxHp) || Number(demon.hp) || 1);
    const baseSpeed = Math.max(1, Number(demon.runBaseSpeed) || Number(demon.speed) || 1);
    const currentMaxHp = Math.max(1, Number(demon.maxHp) || baseMaxHp);
    const hpRatio = currentMaxHp > 0
      ? clamp((Number(demon.hp) || currentMaxHp) / currentMaxHp, 0, 1)
      : 1;
    const nextMaxHp = Math.max(1, Math.round(baseMaxHp * maxHpMult));
    const nextSpeed = Math.max(1, Math.round(baseSpeed * speedMult));
    const next = {
      ...demon,
      runBaseAtk: baseAtk,
      runBaseMaxHp: baseMaxHp,
      runBaseSpeed: baseSpeed,
      runBuffStatsApplied: true,
      maxHp: nextMaxHp,
      hp: Math.max(demon.hp > 0 ? 1 : 0, Math.min(nextMaxHp, Math.round(nextMaxHp * hpRatio))),
      speed: nextSpeed
    };

    delete next.effectiveAtk;
    applyDamageOutputStatPreview(next, {
      baseAtk,
      directDamageMult,
      aoeDamageMult,
      aoeDamageFlat: getEffectSum(state, 'aoe_damage_flat', demon),
      healingMult: getEffectMultiplier(state, 'healing_mult', demon),
      healingFlat: getEffectSum(state, 'healing_flat', demon),
      poisonDamageMult: getEffectMultiplier(state, 'poison_tick_damage_mult', demon),
      poisonDamageFlat: getEffectSum(state, 'poison_damage_flat', demon),
      retaliationDamageMult: getEffectMultiplier(state, 'retaliation_damage_mult', demon)
    });
    if (!Number.isFinite(Number(next.effectiveAtk)) && baseAtk > 0) {
      next.effectiveAtk = baseAtk;
    }

    return next;
  });

  run.state.hp = run.state.team.reduce((sum, demon) => sum + Math.max(0, Number(demon.hp) || 0), 0);
  return run.state.team;
}

function applyDamageModifiers(context) {
  const damage = Math.max(0, Number(context.damage) || 0);
  const state = getContextBuffState(context, context.attackerSide);
  if (damage <= 0) return damage;

  if (context.damageKind === 'retaliation') {
    return roundDamage(damage * getEffectMultiplier(state, 'retaliation_damage_mult', context.attacker));
  }

  if (context.damageKind !== 'direct') return damage;

  let multiplier = 1;
  let flatDamage = 0;
  if (context.isAoe) {
    multiplier *= getEffectMultiplier(state, 'aoe_damage_mult', context.attacker);
    multiplier *= positiveNumber(context.attacker?.battleBuffs?.aoeDamageMult, 1);
    flatDamage = Math.max(0, Number(context.attacker?.battleBuffs?.aoeDamageFlat) || 0);
  } else if (isSingleTargetAttackDemon(context.attacker)) {
    multiplier *= getEffectMultiplier(state, 'direct_damage_mult', context.attacker);
    multiplier *= positiveNumber(context.attacker?.battleBuffs?.directDamageMult, 1);

    if (isTargetBelowHalfHp(context.target)) {
      multiplier *= getEffectMultiplier(state, 'damage_vs_low_hp_mult', context.attacker);
    }

    if (hasHigherMaxHp(context.target, context.attacker)) {
      multiplier *= getEffectMultiplier(state, 'damage_vs_higher_max_hp_mult', context.attacker);
    }

    if (hasPoison(context.target)) {
      multiplier *= getEffectMultiplier(state, 'direct_damage_vs_poisoned_mult', context.attacker);
    }
  }

  return roundDamage((damage + flatDamage) * multiplier);
}

function applyHealingModifiers(context) {
  const healing = Math.max(0, Number(context.healing) || 0);
  const state = getContextBuffState(context, context.healerSide);
  if (healing <= 0) {
    return {
      healing,
      overhealToShield: false
    };
  }

  return {
    healing: roundHealing(
      (healing + Math.max(0, Number(context.healer?.battleBuffs?.healingFlat) || 0)) *
      getEffectMultiplier(state, 'healing_mult', context.healer) *
      positiveNumber(context.healer?.battleBuffs?.healingMult, 1)
    ),
    overhealToShield: hasEffect(state, 'overheal_to_shield', context.healer)
  };
}

function applyPoisonModifiers(context) {
  const state = getContextBuffState(context, context.attackerSide);
  const damage = Math.max(0, Number(context.damage) || 0);
  const durationTicks = Math.max(1, Number(context.durationTicks) || 1);

  return {
    damage: roundDamage(
      (damage + Math.max(0, Number(context.attacker?.battleBuffs?.poisonDamageFlat) || 0)) *
      getEffectMultiplier(state, 'poison_tick_damage_mult', context.attacker) *
      positiveNumber(context.attacker?.battleBuffs?.poisonDamageMult, 1)
    ),
    durationTicks: Math.max(1, Math.round(durationTicks * getEffectMultiplier(state, 'poison_duration_mult', context.attacker)))
  };
}

function handleDeathBuffTriggers(context) {
  const target = context.target;
  if (!target || target.hp > 0) {
    return {
      preventedDeath: false
    };
  }

  const targetState = getContextBuffState(context, context.targetSide);
  const attackerState = getContextBuffState(context, context.attackerSide || getOpposingSide(context.targetSide));
  const battleState = context.battleState || {};

  const lastBreathKey = context.targetSide === 'enemy' ? 'enemyLastBreathUsed' : 'playerLastBreathUsed';
  if (hasEffect(targetState, 'first_ally_death_survive') && !battleState[lastBreathKey]) {
    battleState[lastBreathKey] = true;
    target.hp = 1;
    context.combatLog.push({
      tick: context.tick,
      attacker: target.instanceId,
      attackerPosition: normalizePosition(target.position),
      target: target.instanceId,
      targetPosition: normalizePosition(target.position),
      targeting: 'self',
      effect: 'last_breath',
      dmg: 0,
      targetHp: target.hp
    });

    return {
      preventedDeath: true
    };
  }

  if (target.deathBuffsHandled) {
    return {
      preventedDeath: false
    };
  }
  target.deathBuffsHandled = true;

  if (context.targetSide === 'player' || context.targetSide === 'enemy') {
    applySharedPain(context, targetState, context.targetSide);
  }

  if (context.cause !== 'chain_explosion') {
    applyChainExplosion(context, attackerState, context.targetSide);
  }

  return {
    preventedDeath: false
  };
}

function getTemporaryTeamSizeBonus(run) {
  const state = ensureCombatBuffState(run);
  return state.temporary
    .filter((entry) => isCurrentTemporaryTeamSizeEntry(entry) && entry.usesRemaining > 0)
    .reduce((sum, entry) => sum + Math.max(0, Number(entry.value) || 0), 0);
}

function consumeNextBattleTemporaryBuffs(run) {
  const state = ensureCombatBuffState(run);
  state.temporary = state.temporary
    .filter(isCurrentTemporaryTeamSizeEntry)
    .map((entry) => entry.type === TEMPORARY_TEAM_SIZE_EFFECT
      ? { ...entry, usesRemaining: Math.max(0, Number(entry.usesRemaining) - 1) }
      : entry)
    .filter((entry) => entry.usesRemaining > 0);
  run.state.buffs = state;
}

function isCurrentTemporaryTeamSizeEntry(entry) {
  if (entry?.type !== TEMPORARY_TEAM_SIZE_EFFECT) return false;
  const buff = getCombatBuffById(entry.buffId);
  return Boolean((buff?.effects || []).some((effect) => effect.type === TEMPORARY_TEAM_SIZE_EFFECT));
}

function getEffectMultiplier(state, type, demon = null) {
  return getActiveEffects(state, type, demon)
    .reduce((product, effect) => product * positiveNumber(effect.value, 1), 1);
}

function getEffectSum(state, type, demon = null) {
  return getActiveEffects(state, type, demon)
    .reduce((sum, effect) => sum + (Number(effect.value) || 0), 0);
}

function hasEffect(state, type, demon = null) {
  return getActiveEffects(state, type, demon).length > 0;
}

function getActiveEffects(source, type, demon = null) {
  return getActiveCombatBuffs(source)
    .flatMap((buff) => buff.effects || [])
    .filter((effect) => effect.type === type && effectAppliesToDemon(effect, demon));
}

function effectAppliesToDemon(effect, demon = null) {
  const targets = Array.isArray(effect?.targetRarities) ? effect.targetRarities : [];
  if (targets.length && (!demon || !targets.includes(String(demon.rarity || '').toLowerCase()))) {
    return false;
  }
  if (effect?.singleTargetOnly && !isSingleTargetAttackDemon(demon)) {
    return false;
  }
  return true;
}

function getContextBuffState(context = {}, side = 'player') {
  if (side === 'enemy') {
    return normalizeCombatBuffState(context.enemyBuffs || {});
  }

  return normalizeCombatBuffState(context.playerBuffs || context.buffs || {});
}

function getOpposingSide(side) {
  return side === 'enemy' ? 'player' : 'enemy';
}

function applySharedPain(context, state, side = 'player') {
  const multiplier = getEffectMultiplier(state, 'ally_death_direct_damage_mult');
  if (multiplier === 1) return;

  const team = side === 'enemy' ? context.enemies : context.players;
  const survivors = (team || [])
    .filter((demon) => demon.hp > 0 && demon.instanceId !== context.target.instanceId);
  if (!survivors.length) return;

  survivors.forEach((demon) => {
    demon.battleBuffs = demon.battleBuffs || {};
    demon.battleBuffs.directDamageMult = positiveNumber(demon.battleBuffs.directDamageMult, 1) * multiplier;
  });

  context.combatLog.push({
    tick: context.tick,
    attacker: context.target.instanceId,
    attackerPosition: normalizePosition(context.target.position),
    target: context.target.instanceId,
    targetPosition: normalizePosition(context.target.position),
    targeting: 'allies',
    effect: 'shared_pain',
    dmg: 0,
    targetHp: 0,
    affectedAllies: survivors.map((demon) => demon.instanceId),
    directDamageMult: multiplier
  });
}

function applyChainExplosion(context, state, targetSide = 'enemy') {
  const damagePct = getEffectSum(state, 'enemy_death_splash_max_hp_pct');
  if (damagePct <= 0) return;

  const targetTeam = targetSide === 'enemy' ? context.enemies : context.players;
  const splashDamage = roundDamage((Number(context.target.maxHp) || 1) * damagePct);
  const splashTargets = (targetTeam || [])
    .filter((target) => target.hp > 0 && target.instanceId !== context.target.instanceId);

  splashTargets.forEach((target) => {
    const damageResult = context.dealDamage(target, splashDamage);
    context.combatLog.push({
      tick: context.tick,
      attacker: context.target.instanceId,
      attackerPosition: normalizePosition(context.target.position),
      target: target.instanceId,
      targetPosition: normalizePosition(target.position),
      targeting: 'death_splash',
      effect: 'chain_explosion',
      dmg: damageResult.damage,
      shieldDamage: damageResult.shieldDamage,
      targetShield: target.shield || 0,
      targetHp: target.hp
    });

    handleDeathBuffTriggers({
      ...context,
      target,
      targetSide,
      cause: 'chain_explosion'
    });
  });
}

function addTemporaryEntriesForBuff(state, buff) {
  (buff.effects || [])
    .filter((effect) => effect.type === TEMPORARY_TEAM_SIZE_EFFECT)
    .forEach((effect) => {
      state.temporary.push({
        buffId: buff.id,
        type: effect.type,
        value: Number(effect.value) || 0,
        usesRemaining: Math.max(1, Number(effect.uses) || 1)
      });
    });
}

function normalizeTemporaryBuffs(source = []) {
  return (Array.isArray(source) ? source : [])
    .map((entry) => {
      if (typeof entry === 'string') {
        const buff = getCombatBuffById(entry);
        const effect = (buff?.effects || []).find((item) => item.type === TEMPORARY_TEAM_SIZE_EFFECT);
        if (!effect) return null;
        return {
          buffId: buff.id,
          type: effect.type,
          value: Number(effect.value) || 0,
          usesRemaining: Math.max(1, Number(effect.uses) || 1)
        };
      }

      return {
        buffId: String(entry?.buffId || entry?.id || ''),
        type: String(entry?.type || ''),
        value: Number(entry?.value) || 0,
        usesRemaining: Math.max(0, Number(entry?.usesRemaining ?? entry?.uses ?? 1) || 0)
      };
    })
    .filter((entry) => (
      entry?.buffId &&
      entry.type &&
      entry.usesRemaining > 0 &&
      (entry.type !== TEMPORARY_TEAM_SIZE_EFFECT || isCurrentTemporaryTeamSizeEntry(entry))
    ));
}

function buffIds(values = [], options = {}) {
  const ids = [];
  const seen = new Set();
  const unique = options.unique !== false;

  (Array.isArray(values) ? values : []).forEach((value) => {
    const id = typeof value === 'string' ? value : value?.id;
    if (!id) return;
    if (unique && seen.has(String(id))) return;
    seen.add(String(id));
    ids.push(String(id));
  });

  return ids;
}

function currentBuffIds(values = [], options = {}) {
  return buffIds(values, options).filter((id) => Boolean(getCombatBuffById(id)));
}

function pickWeightedBuffIndex(buffs, rng) {
  const totalWeight = buffs.reduce((sum, buff) => sum + getRarityWeight(buff.rarity), 0);
  let roll = rng() * totalWeight;

  for (let index = 0; index < buffs.length; index += 1) {
    roll -= getRarityWeight(buffs[index].rarity);
    if (roll <= 0) return index;
  }

  return buffs.length - 1;
}

function getRarityWeight(rarity) {
  return RARITY_WEIGHTS[String(rarity || '').toLowerCase()] || 1;
}

function roundDamage(value) {
  return Math.max(1, Math.round(Number(value) || 0));
}

function roundHealing(value) {
  return Math.max(1, Math.round(Number(value) || 0));
}

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getBonusFraction(value) {
  const percent = Number(value);
  return Number.isFinite(percent) && percent > 0 ? percent / 100 : 0;
}

function isTargetBelowHalfHp(target) {
  return Boolean(target && Number(target.hp) > 0 && Number(target.hp) < (Number(target.maxHp) || 1) * 0.5);
}

function hasHigherMaxHp(target, attacker) {
  return Boolean(target && attacker && (Number(target.maxHp) || 0) > (Number(attacker.maxHp) || 0));
}

function hasPoison(target) {
  return (target?.statusEffects?.poison || []).length > 0;
}

function isAoeDemon(demon) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  const type = DEFAULT_DEMON_TYPES[String(typeId)] || {};
  const role = String(demon?.role || type.role || '').toLowerCase();
  const targeting = String(demon?.targeting || type.targeting || '').toLowerCase();
  const abilityKind = String(demon?.abilityKind || demon?.ability?.kind || type.ability?.kind || '').toLowerCase();
  return typeId === 4 ||
    typeId === 7 ||
    role === 'aoe' ||
    targeting === 'all' ||
    targeting === 'cleave' ||
    abilityKind === 'aoe_attack' ||
    abilityKind === 'cleave_attack';
}

function isSingleTargetAttackDemon(demon) {
  if (!demon || isAoeDemon(demon)) return false;

  const typeId = Number(demon.typeId || demon.type_id || demon.type);
  const type = DEFAULT_DEMON_TYPES[String(typeId)] || {};
  const abilityKind = String(demon.abilityKind || demon.ability?.kind || type.ability?.kind || '').toLowerCase();
  return !['heal', 'poison', 'retaliate'].includes(abilityKind);
}

function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

const loadRunBuffs = loadCombatBuffs;
const getBuffById = getCombatBuffById;
const normalizeRunBuffState = normalizeCombatBuffState;
const ensureRunBuffState = ensureCombatBuffState;
const serializeRunBuffState = serializeCombatBuffState;
const PACT_CHOICE_FLOOR_INTERVAL = BUFF_CHOICE_FLOOR_INTERVAL;
const PACT_REROLL_SOUL_COST = BUFF_REROLL_SOUL_COST;

module.exports = {
  applyDamageModifiers,
  applyHealingModifiers,
  applyPoisonModifiers,
  applyPreBattleBuffs,
  applyRunBuffStatModifiers,
  consumeNextBattleTemporaryBuffs,
  ensureCombatBuffState,
  generateBuffChoices,
  getActiveCombatBuffs,
  getCombatBuffById,
  getBuffById,
  getTemporaryTeamSizeBonus,
  handleDeathBuffTriggers,
  hasPendingBuffChoices,
  loadCombatBuffs,
  loadRunBuffs,
  normalizeCombatBuffState,
  normalizeRunBuffState,
  serializeCombatBuffState,
  BUFF_CHOICE_FLOOR_INTERVAL,
  BUFF_REROLL_SOUL_COST,
  PACT_CHOICE_FLOOR_INTERVAL,
  PACT_REROLL_SOUL_COST,
  selectRunBuff,
  serializeRunBuffState,
  shouldOfferRunBuffChoices,
  ensureRunBuffState
};
