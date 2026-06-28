const fs = require('fs');
const path = require('path');

const BUFF_DATA_PATH = path.join(__dirname, '..', 'data', 'combat-buffs.json');
const TEMPORARY_TEAM_SIZE_EFFECT = 'next_battle_team_size_add';
const BUFF_CHOICE_FLOOR_INTERVAL = 3;
const BUFF_REROLL_SOUL_COST = 10;
const RARITY_WEIGHTS = {
  common: 70,
  uncommon: 24,
  rare: 6
};

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
  const activeBuffs = [];
  const seen = new Set();
  const addBuff = (buff) => {
    const normalized = normalizeCombatBuffDefinition(buff);
    if (!normalized) return;
    const key = normalized.id || JSON.stringify(normalized.effects);
    if (seen.has(key)) return;
    seen.add(key);
    activeBuffs.push(normalized);
  };

  state.active.map(getCombatBuffById).forEach(addBuff);
  state.activeBuffs.forEach(addBuff);
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
      return normalized;
    })
    .filter(Boolean);

  if (!effects.length) return null;

  return {
    id: String(buff.id || '').trim(),
    name: String(buff.name || buff.label || 'Combat Buff'),
    description: String(buff.description || ''),
    rarity: String(buff.rarity || 'common').toLowerCase(),
    icon: String(buff.icon || 'sparkles'),
    source: String(buff.source || 'combat'),
    tags: (Array.isArray(buff.tags) ? buff.tags : []).map((tag) => String(tag)).filter(Boolean),
    effects
  };
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
  const maxHpMult = (statsAlreadyApplied ? 1 : getEffectMultiplier(persistedState, 'max_hp_mult')) * getEffectMultiplier(transientState, 'max_hp_mult');
  const speedMult = (statsAlreadyApplied ? 1 : getEffectMultiplier(persistedState, 'speed_mult')) * getEffectMultiplier(transientState, 'speed_mult');
  const attackMult = getEffectMultiplier(state, 'attack_mult');
  const maxHpFlat = getEffectSum(state, 'max_hp_flat');
  const attackFlat = getEffectSum(state, 'attack_flat');
  const speedFlat = getEffectSum(state, 'speed_flat');
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
    const next = {
      ...demon,
      accountStatsApplied: true,
      battleBuffs: {
        ...(demon.battleBuffs || {}),
        directDamageMult: positiveNumber(demon.battleBuffs?.directDamageMult, 1),
        healingMult: accountHealingMult,
        healingFlat: accountHealingFlat + getEffectSum(state, 'healing_flat'),
        thornsPercent: accountThornsPercent + getEffectSum(state, 'thorns_percent'),
        thornsFlat: accountThornsFlat + getEffectSum(state, 'thorns_flat'),
        aoeDamageMult: accountAoeDamageMult,
        aoeDamageFlat: accountAoeDamageFlat + getEffectSum(state, 'aoe_damage_flat'),
        poisonDamageMult: accountPoisonDamageMult,
        poisonDamageFlat: accountPoisonDamageFlat + getEffectSum(state, 'poison_damage_flat')
      }
    };

    if (maxHpMult !== 1) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = clamp((Number(next.hp) || baseMaxHp) / baseMaxHp, 0, 1);
      next.maxHp = Math.max(1, Math.round(baseMaxHp * maxHpMult));
      next.hp = Math.max(next.hp > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (speedMult !== 1) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) * speedMult));
    }

    if (maxHpFlat > 0) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = clamp((Number(next.hp) || baseMaxHp) / baseMaxHp, 0, 1);
      next.maxHp = Math.max(1, Math.round(baseMaxHp + maxHpFlat));
      next.hp = Math.max(next.hp > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (attackFlat > 0) {
      next.atk = Math.max(1, Math.round((Number(next.atk) || 1) + attackFlat));
    }

    if (speedFlat > 0) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) + speedFlat));
    }

    if (attackMult !== 1) {
      next.atk = Math.max(1, Math.round((Number(next.atk) || 1) * attackMult));
    }

    if (accountMaxHpFlat > 0) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = clamp((Number(next.hp) || baseMaxHp) / baseMaxHp, 0, 1);
      next.maxHp = Math.max(1, Math.round(baseMaxHp + accountMaxHpFlat));
      next.hp = Math.max(next.hp > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (accountAttackFlat > 0) {
      next.atk = Math.max(1, Math.round((Number(next.atk) || 1) + accountAttackFlat));
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

    if (accountAttackMult !== 1) {
      next.atk = Math.max(1, Math.round((Number(next.atk) || 1) * accountAttackMult));
    }

    if (accountSpeedMult !== 1) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) * accountSpeedMult));
    }

    return next;
  });
}

function applyRunBuffStatModifiers(run) {
  if (!run?.state) return [];

  const state = ensureCombatBuffState(run);
  const maxHpMult = getEffectMultiplier(state, 'max_hp_mult');
  const speedMult = getEffectMultiplier(state, 'speed_mult');
  const directDamageMult = getEffectMultiplier(state, 'direct_damage_mult');
  const aoeDamageMult = getEffectMultiplier(state, 'aoe_damage_mult');

  run.state.team = (run.state.team || []).map((demon) => {
    const baseAtk = Math.max(0, Number(demon.runBaseAtk) || Number(demon.atk) || 0);
    const baseMaxHp = Math.max(1, Number(demon.runBaseMaxHp) || Number(demon.maxHp) || Number(demon.hp) || 1);
    const baseSpeed = Math.max(1, Number(demon.runBaseSpeed) || Number(demon.speed) || 1);
    const currentMaxHp = Math.max(1, Number(demon.maxHp) || baseMaxHp);
    const hpRatio = currentMaxHp > 0
      ? clamp((Number(demon.hp) || currentMaxHp) / currentMaxHp, 0, 1)
      : 1;
    const damagePreviewMult = directDamageMult * (isAoeDemon(demon) ? aoeDamageMult : 1);
    const nextEffectiveAtk = baseAtk > 0 ? Math.max(1, Math.round(baseAtk * damagePreviewMult)) : baseAtk;
    const nextMaxHp = Math.max(1, Math.round(baseMaxHp * maxHpMult));
    const nextSpeed = Math.max(1, Math.round(baseSpeed * speedMult));

    return {
      ...demon,
      runBaseAtk: baseAtk,
      runBaseMaxHp: baseMaxHp,
      runBaseSpeed: baseSpeed,
      runBuffStatsApplied: true,
      effectiveAtk: nextEffectiveAtk,
      maxHp: nextMaxHp,
      hp: Math.max(demon.hp > 0 ? 1 : 0, Math.min(nextMaxHp, Math.round(nextMaxHp * hpRatio))),
      speed: nextSpeed
    };
  });

  run.state.hp = run.state.team.reduce((sum, demon) => sum + Math.max(0, Number(demon.hp) || 0), 0);
  return run.state.team;
}

function applyDamageModifiers(context) {
  const damage = Math.max(0, Number(context.damage) || 0);
  const state = getContextBuffState(context, context.attackerSide);
  if (damage <= 0) return damage;

  if (context.damageKind === 'retaliation') {
    return roundDamage(damage * getEffectMultiplier(state, 'retaliation_damage_mult'));
  }

  if (context.damageKind !== 'direct') return damage;

  let multiplier = getEffectMultiplier(state, 'direct_damage_mult');
  multiplier *= positiveNumber(context.attacker?.battleBuffs?.directDamageMult, 1);

  if (isTargetBelowHalfHp(context.target)) {
    multiplier *= getEffectMultiplier(state, 'damage_vs_low_hp_mult');
  }

  if (hasHigherMaxHp(context.target, context.attacker)) {
    multiplier *= getEffectMultiplier(state, 'damage_vs_higher_max_hp_mult');
  }

  if (hasPoison(context.target)) {
    multiplier *= getEffectMultiplier(state, 'direct_damage_vs_poisoned_mult');
  }

  let flatDamage = 0;
  if (context.isAoe) {
    multiplier *= getEffectMultiplier(state, 'aoe_damage_mult');
    multiplier *= positiveNumber(context.attacker?.battleBuffs?.aoeDamageMult, 1);
    flatDamage = Math.max(0, Number(context.attacker?.battleBuffs?.aoeDamageFlat) || 0);
  }

  return roundDamage((damage * multiplier) + flatDamage);
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
      healing *
      getEffectMultiplier(state, 'healing_mult') *
      positiveNumber(context.healer?.battleBuffs?.healingMult, 1) +
      Math.max(0, Number(context.healer?.battleBuffs?.healingFlat) || 0)
    ),
    overhealToShield: hasEffect(state, 'overheal_to_shield')
  };
}

function applyPoisonModifiers(context) {
  const state = getContextBuffState(context, context.attackerSide);
  const damage = Math.max(0, Number(context.damage) || 0);
  const durationTicks = Math.max(1, Number(context.durationTicks) || 1);

  return {
    damage: roundDamage(
      damage *
      getEffectMultiplier(state, 'poison_tick_damage_mult') *
      positiveNumber(context.attacker?.battleBuffs?.poisonDamageMult, 1) +
      Math.max(0, Number(context.attacker?.battleBuffs?.poisonDamageFlat) || 0)
    ),
    durationTicks: Math.max(1, Math.round(durationTicks * getEffectMultiplier(state, 'poison_duration_mult')))
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

function getEffectMultiplier(state, type) {
  return getActiveEffects(state, type)
    .reduce((product, effect) => product * positiveNumber(effect.value, 1), 1);
}

function getEffectSum(state, type) {
  return getActiveEffects(state, type)
    .reduce((sum, effect) => sum + (Number(effect.value) || 0), 0);
}

function hasEffect(state, type) {
  return getActiveEffects(state, type).length > 0;
}

function getActiveEffects(source, type) {
  return getActiveCombatBuffs(source)
    .flatMap((buff) => buff.effects || [])
    .filter((effect) => effect.type === type);
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
  const role = String(demon?.role || '').toLowerCase();
  const targeting = String(demon?.targeting || '').toLowerCase();
  return typeId === 4 || role === 'aoe' || targeting === 'all';
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
