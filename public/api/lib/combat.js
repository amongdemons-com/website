const { pick, randomInt } = require('./rng');
const {
  applyDamageModifiers,
  applyHealingModifiers,
  applyPoisonModifiers,
  applyPreBattleBuffs,
  handleDeathBuffTriggers,
  normalizeRunBuffState
} = require('./run-buffs');

const MAX_COMBAT_TICKS = 1000;
const STALEMATE_STATE_REPEAT_LIMIT = 6;
const FORMATION_GRID_COLUMNS = 3;
const FORMATION_GRID_SIZE = 9;
const CHU_PERK_TYPE_ID = 9;
const CHU_KNOCKBACK_CHANCE = 0.01;

function alive(team) {
  return team.filter((demon) => demon.hp > 0);
}

function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
}

function normalizeFormationSlot(slot) {
  const number = Number(slot);
  if (!Number.isInteger(number) || number < 0 || number >= FORMATION_GRID_SIZE) return null;
  return number;
}

function getFormationSlotPosition(slot, side = 'enemy') {
  const normalizedSlot = normalizeFormationSlot(slot);
  const column = (normalizedSlot === null ? 0 : normalizedSlot) % FORMATION_GRID_COLUMNS;
  const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
  return column === frontColumn ? 'front' : 'back';
}

function getTypeData(demon, demonTypes = {}) {
  return demonTypes[String(demon.typeId)] || {};
}

function getTargeting(demon, demonTypes = {}) {
  const typeTargeting = getTypeData(demon, demonTypes).targeting;
  return typeTargeting || demon.targeting || 'front';
}

function getAbility(demon, demonTypes = {}) {
  return getTypeData(demon, demonTypes).ability || { kind: 'basic_attack', hits: 1 };
}

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getPoisonStackLimit(ability = {}) {
  const maxStacks = Number(ability.maxStacksPerTarget);
  return Number.isFinite(maxStacks) && maxStacks > 0 ? maxStacks : Infinity;
}

function getRetaliationDamage(target, ability = {}) {
  const configuredDamage = Number(ability.damage);
  if (Number.isFinite(configuredDamage) && configuredDamage > 0) {
    return Math.max(1, Math.round(configuredDamage));
  }

  const damageSource = ability.damageSource || 'atk';
  if (damageSource === 'atk') {
    return Math.max(1, Number(target.atk) || 1);
  }

  return Math.max(1, Number(target.atk) || 1);
}

function getSyncedPoisonNextTick(poisonStacks, fallback) {
  const activeTimers = poisonStacks
    .map((poison) => Number(poison.nextTickIn))
    .filter((nextTickIn) => Number.isFinite(nextTickIn) && nextTickIn > 0);

  return activeTimers.length ? Math.min(...activeTimers) : fallback;
}

function isMeleeDemon(demon) {
  return [1, 5, 7, 9].includes(Number(demon.typeId));
}

function isBlockedBehindFrontline(demon, allies) {
  if (!isMeleeDemon(demon) || normalizePosition(demon.position) !== 'back') return false;
  return alive(allies).some((ally) => normalizePosition(ally.position) === 'front');
}

function getFormationDepth(demon, side = 'enemy') {
  const slot = normalizeFormationSlot(demon.formationSlot ?? demon.formationRow);
  if (slot === null) {
    return normalizePosition(demon.position) === 'front' ? 0 : 1;
  }

  const column = slot % FORMATION_GRID_COLUMNS;
  return side === 'enemy' ? column : FORMATION_GRID_COLUMNS - 1 - column;
}

function frontToBack(targets, side = 'enemy') {
  return [...targets].sort((a, b) => (
    getFormationDepth(a, side) - getFormationDepth(b, side)
  ));
}

function chooseTarget(rng, attacker, enemies, demonTypes, targetSide = 'enemy') {
  const targeting = getTargeting(attacker, demonTypes);
  const living = alive(enemies);
  const frontRow = frontToBack(living.filter((demon) => normalizePosition(demon.position) === 'front'), targetSide);
  const available = targeting === 'front'
    ? (frontRow.length ? frontRow : frontToBack(living, targetSide))
    : living;

  if (!available.length || targeting === 'none') return null;

  if (targeting === 'lowest_hp') {
    return [...available].sort((a, b) => a.hp - b.hp)[0];
  }

  if (targeting === 'lowest_max_hp') {
    return [...available].sort((a, b) => (a.maxHp - b.maxHp) || (a.hp - b.hp))[0];
  }

  if (targeting === 'highest_hp') {
    return [...available].sort((a, b) => b.hp - a.hp)[0];
  }

  if (targeting === 'random') {
    return pick(rng, available);
  }

  return available[0];
}

function choosePoisonTarget(attacker, enemies, demonTypes) {
  const living = alive(enemies);
  const ability = getAbility(attacker, demonTypes);
  const maxStacks = getPoisonStackLimit(ability);
  const stackable = living.filter((target) => getPoisonStacks(target, attacker.instanceId) < maxStacks);

  return [...stackable].sort((a, b) => b.hp - a.hp)[0] || null;
}

function chooseHealTarget(allies) {
  return alive(allies)
    .filter((demon) => demon.hp < demon.maxHp)
    .sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp))[0] || null;
}

function chooseTargets(rng, attacker, enemies, demonTypes, targetSide = 'enemy') {
  const targeting = getTargeting(attacker, demonTypes);
  const ability = getAbility(attacker, demonTypes);
  const living = alive(enemies);

  if (ability.kind === 'cleave_attack') {
    const frontRow = frontToBack(living.filter((demon) => normalizePosition(demon.position) === 'front'), targetSide);
    return frontRow.length ? frontRow : frontToBack(living, targetSide);
  }

  if (targeting === 'all') {
    return living;
  }

  if (targeting === 'none') {
    return [];
  }

  const target = chooseTarget(rng, attacker, enemies, demonTypes, targetSide);
  return target ? [target] : [];
}

function chooseChaoticTargets(rng, actor, players, enemies, ability = {}) {
  const actorIsPlayer = players.some((demon) => demon.instanceId === actor.instanceId);
  const enemyTargets = actorIsPlayer ? enemies : players;
  const targetPool = ability.targetPool || 'any_unit';
  const living = targetPool === 'enemy' || targetPool === 'enemies' || targetPool === 'random_enemy'
    ? alive(enemyTargets)
    : alive(players)
      .concat(alive(enemies))
      .filter((target) => target.instanceId !== actor.instanceId);

  return living.length ? [pick(rng, living)] : [];
}

function cloneTeam(team) {
  return team.map((demon, index) => ({
    ...demon,
    position: normalizePosition(demon.position || (index === 0 ? 'front' : 'back')),
    attackMeter: demon.attackMeter || 0,
    shield: Math.max(0, Number(demon.shield) || 0),
    statusEffects: {
      poison: (demon.statusEffects?.poison || []).map((poison) => ({ ...poison }))
    }
  }));
}

function isChuPerkHit(attacker, demonTypes = {}) {
  return Number(attacker.typeId) === CHU_PERK_TYPE_ID ||
    getAbility(attacker, demonTypes).kind === 'slow_crushing_attack';
}

function getKnockbackDestinationSlot(target, side) {
  const currentSlot = normalizeFormationSlot(target.formationSlot ?? target.formationRow);
  if (currentSlot === null) return null;

  const row = Math.floor(currentSlot / FORMATION_GRID_COLUMNS);
  const column = currentSlot % FORMATION_GRID_COLUMNS;
  const nextColumn = column + (side === 'enemy' ? 1 : -1);
  if (nextColumn < 0 || nextColumn >= FORMATION_GRID_COLUMNS) return null;

  return row * FORMATION_GRID_COLUMNS + nextColumn;
}

function moveDemonToFormationSlot(demon, slot, side) {
  demon.formationSlot = slot;
  demon.position = getFormationSlotPosition(slot, side);
}

function findDemonInFormationSlot(team, slot, excludeInstanceId) {
  return (team || []).find((demon) => (
    demon.instanceId !== excludeInstanceId &&
    normalizeFormationSlot(demon.formationSlot ?? demon.formationRow) === slot
  )) || null;
}

function applyChuKnockback({ rng, attacker, target, targetSide, targetTeam, demonTypes, logEntry }) {
  if (typeof rng !== 'function') return;
  if (!isChuPerkHit(attacker, demonTypes)) return;
  if (!target || target.hp <= 0) return;
  if (rng() >= CHU_KNOCKBACK_CHANCE) return;

  const fromSlot = normalizeFormationSlot(target.formationSlot ?? target.formationRow);
  const toSlot = getKnockbackDestinationSlot(target, targetSide);
  if (fromSlot === null || toSlot === null) return;

  const swappedDemon = findDemonInFormationSlot(targetTeam, toSlot, target.instanceId);
  moveDemonToFormationSlot(target, toSlot, targetSide);
  if (swappedDemon) {
    moveDemonToFormationSlot(swappedDemon, fromSlot, targetSide);
  }

  logEntry.knockback = {
    target: target.instanceId,
    side: targetSide,
    fromSlot,
    toSlot,
    targetPositionAfter: normalizePosition(target.position),
    swappedWith: swappedDemon?.instanceId || null,
    swappedFromSlot: swappedDemon ? toSlot : null,
    swappedToSlot: swappedDemon ? fromSlot : null,
    swappedPositionAfter: swappedDemon ? normalizePosition(swappedDemon.position) : null
  };
}

function getPoisonStacks(target, source) {
  return (target.statusEffects?.poison || [])
    .filter((poison) => poison.source === source)
    .length;
}

function applyPoisonTick(team, tick, context, targetSide) {
  alive(team).forEach((target) => {
    const poisonStacks = target.statusEffects?.poison || [];
    if (!poisonStacks.length) return;

    poisonStacks.forEach((poison) => {
      if (target.hp <= 0) return;

      poison.remainingTicks = Number.isFinite(Number(poison.remainingTicks))
        ? Number(poison.remainingTicks) - 1
        : Number(poison.remainingTurns || 1) - 1;
      poison.nextTickIn = Number.isFinite(Number(poison.nextTickIn))
        ? Number(poison.nextTickIn) - 1
        : 0;

      if (poison.nextTickIn > 0) return;

      const damage = Math.max(1, Number(poison.damage) || 1);
      poison.nextTickIn = Math.max(1, Number(poison.tickInterval) || 1);
      const damageResult = dealDamage(target, damage);

      context.combatLog.push({
        tick,
        attacker: poison.source,
        target: target.instanceId,
        targetPosition: normalizePosition(target.position),
        targeting: 'poison',
        effect: 'poison',
        dmg: damageResult.damage,
        shieldDamage: damageResult.shieldDamage,
        targetShield: target.shield || 0,
        targetHp: target.hp,
        poisonStacks: poisonStacks.length
      });

      handleDeathBuffTriggers({
        ...context,
        tick,
        target,
        targetSide,
        cause: 'poison'
      });
    });

    target.statusEffects.poison = poisonStacks.filter((poison) => poison.remainingTicks > 0);
  });
}

function applyDamage({
  tick,
  attacker,
  attackerSide,
  target,
  targetSide,
  targetTeam,
  damage,
  targeting,
  hitIndex,
  hitCount,
  demonTypes,
  combatLog,
  context,
  damageKind = 'direct'
}) {
  const modifiedDamage = applyDamageModifiers({
    attacker,
    attackerSide,
    target,
    targetSide,
    damage,
    damageKind,
    targeting,
    isAoe: targeting === 'all' || targeting === 'cleave' || Number(hitCount) > 1,
    buffs: context.buffs
  });
  const damageResult = dealDamage(target, modifiedDamage);

  const logEntry = {
    tick,
    attacker: attacker.instanceId,
    attackerPosition: normalizePosition(attacker.position),
    target: target.instanceId,
    targetPosition: normalizePosition(target.position),
    targeting,
    hitIndex,
    hitCount,
    dmg: damageResult.damage,
    shieldDamage: damageResult.shieldDamage,
    targetShield: target.shield || 0,
    targetHp: target.hp
  };

  applyChuKnockback({
    rng: context.rng,
    attacker,
    target,
    targetSide,
    targetTeam,
    demonTypes,
    logEntry
  });

  combatLog.push(logEntry);

  handleDeathBuffTriggers({
    ...context,
    tick,
    target,
    targetSide,
    cause: damageKind
  });

  applyThornsDamage({
    tick,
    defender: target,
    attacker,
    attackerSide,
    receivedDamage: damageResult.damage,
    combatLog,
    context
  });

  const targetAbility = getAbility(target, demonTypes);
  if (target.hp > 0 && targetAbility.kind === 'retaliate' && attacker.hp > 0) {
    const retaliationDamage = applyDamageModifiers({
      attacker: target,
      attackerSide: targetSide,
      target: attacker,
      targetSide: attackerSide,
      damage: getRetaliationDamage(target, targetAbility),
      damageKind: 'retaliation',
      targeting: 'retaliate',
      isAoe: false,
      buffs: context.buffs
    });
    const retaliationResult = dealDamage(attacker, retaliationDamage);

    combatLog.push({
      tick,
      attacker: target.instanceId,
      attackerPosition: normalizePosition(target.position),
      target: attacker.instanceId,
      targetPosition: normalizePosition(attacker.position),
      targeting: 'retaliate',
      effect: 'retaliate',
      dmg: retaliationResult.damage,
      shieldDamage: retaliationResult.shieldDamage,
      targetShield: attacker.shield || 0,
      targetHp: attacker.hp
    });

    handleDeathBuffTriggers({
      ...context,
      tick,
      target: attacker,
      targetSide: attackerSide,
      cause: 'retaliation'
    });

    applyThornsDamage({
      tick,
      defender: attacker,
      attacker: target,
      attackerSide: targetSide,
      receivedDamage: retaliationResult.damage,
      combatLog,
      context
    });
  }
}

function applyThornsDamage({
  tick,
  defender,
  attacker,
  attackerSide,
  receivedDamage,
  combatLog,
  context
}) {
  if (!defender || !attacker || attacker.hp <= 0 || receivedDamage <= 0) return;

  const thornsPercent = Math.max(0, Number(defender.battleBuffs?.thornsPercent) || 0);
  const thornsFlat = Math.max(0, Number(defender.battleBuffs?.thornsFlat) || 0);
  const thornsDamage = Math.max(0, Math.round(receivedDamage * (thornsPercent / 100)) + thornsFlat);
  if (thornsDamage <= 0) return;

  const damageResult = dealDamage(attacker, thornsDamage);
  combatLog.push({
    tick,
    attacker: defender.instanceId,
    attackerPosition: normalizePosition(defender.position),
    target: attacker.instanceId,
    targetPosition: normalizePosition(attacker.position),
    targeting: 'thorns',
    effect: 'thorns',
    dmg: damageResult.damage,
    shieldDamage: damageResult.shieldDamage,
    targetShield: attacker.shield || 0,
    targetHp: attacker.hp
  });

  handleDeathBuffTriggers({
    ...context,
    tick,
    target: attacker,
    targetSide: attackerSide,
    cause: 'thorns'
  });
}

function applyHeal({ tick, healer, healerSide, allies, combatLog, context }) {
  const target = chooseHealTarget(allies);
  if (!target) return false;

  const healingResult = applyHealingModifiers({
    healer,
    healerSide,
    target,
    healing: Math.max(1, Number(healer.atk) || 1),
    buffs: context.buffs
  });
  const missingHp = Math.max(0, (Number(target.maxHp) || 1) - (Number(target.hp) || 0));
  const appliedHealing = Math.min(missingHp, healingResult.healing);
  const shieldGain = healingResult.overhealToShield
    ? Math.max(0, healingResult.healing - appliedHealing)
    : 0;

  target.hp = Math.min(target.maxHp, target.hp + appliedHealing);
  if (shieldGain > 0) {
    target.shield = Math.max(0, Number(target.shield) || 0) + shieldGain;
  }
  combatLog.push({
    tick,
    attacker: healer.instanceId,
    attackerPosition: normalizePosition(healer.position),
    target: target.instanceId,
    targetPosition: normalizePosition(target.position),
    targeting: 'highest_missing_hp',
    effect: 'heal',
    healing: appliedHealing,
    shield: shieldGain,
    targetShield: target.shield || 0,
    targetHp: target.hp
  });

  return true;
}

function applyPoison({ tick, attacker, attackerSide, enemies, demonTypes, combatLog, context }) {
  const target = choosePoisonTarget(attacker, enemies, demonTypes);
  if (!target) return false;

  const ability = getAbility(attacker, demonTypes);
  const maxStacks = getPoisonStackLimit(ability);
  const tickInterval = Math.max(1, Math.round(positiveNumber(ability.tickInterval, 1)));
  const poisonModifiers = applyPoisonModifiers({
    attacker,
    attackerSide,
    damage: Math.max(1, Math.round((Number(attacker.atk) || 1) * positiveNumber(ability.damagePerTickScale || ability.damagePerTurnScale, 1))),
    durationTicks: Math.max(1, Math.round(positiveNumber(ability.durationTicks || ability.durationTurns, 1))),
    buffs: context.buffs
  });
  target.statusEffects = target.statusEffects || {};
  target.statusEffects.poison = [...(target.statusEffects.poison || [])];

  const poison = {
    source: attacker.instanceId,
    sourceSide: attackerSide,
    damage: poisonModifiers.damage,
    remainingTicks: poisonModifiers.durationTicks,
    tickInterval,
    nextTickIn: getSyncedPoisonNextTick(target.statusEffects.poison, tickInterval)
  };

  const sourceStackIndexes = target.statusEffects.poison
    .map((stack, index) => stack.source === attacker.instanceId ? index : -1)
    .filter((index) => index >= 0);

  if (sourceStackIndexes.length >= maxStacks) {
    target.statusEffects.poison[sourceStackIndexes[0]] = poison;
  } else {
    target.statusEffects.poison.push(poison);
  }

  combatLog.push({
    tick,
    attacker: attacker.instanceId,
    attackerPosition: normalizePosition(attacker.position),
    target: target.instanceId,
    targetPosition: normalizePosition(target.position),
    targeting: 'highest_hp',
    effect: 'poison_apply',
    dmg: 0,
    poisonStacks: target.statusEffects.poison.length,
    targetHp: target.hp
  });

  return true;
}

function simulateFight(rng, playerTeam, enemyTeam, options = {}) {
  const demonTypes = options.demonTypes || {};
  const buffs = normalizeRunBuffState(options.buffs || options.runBuffs || {});
  const players = applyPreBattleBuffs(cloneTeam(playerTeam), buffs, options.accountBonuses);
  const enemies = cloneTeam(enemyTeam);
  const battleState = {
    lastBreathUsed: false
  };
  const combatLog = [];
  const context = {
    players,
    enemies,
    buffs,
    battleState,
    combatLog,
    dealDamage,
    rng
  };
  const playerTeamBefore = cloneBattleTeamForReplay(players);
  const enemyTeamBefore = cloneBattleTeamForReplay(enemies);
  const seenBattleStates = new Map([[getBattleStateKey(players, enemies, battleState), 1]]);
  let endReason = null;
  let tick = 0;

  while (alive(players).length && alive(enemies).length && tick < MAX_COMBAT_TICKS) {
    tick += 1;
    applyPoisonTick(players, tick, context, 'player');
    applyPoisonTick(enemies, tick, context, 'enemy');

    const actors = [...alive(players), ...alive(enemies)].sort((a, b) => b.speed - a.speed);

    for (const actor of actors) {
      if (actor.hp <= 0) continue;

      const actorIsPlayer = players.some((demon) => demon.instanceId === actor.instanceId);
      const allies = actorIsPlayer ? players : enemies;
      const targets = actorIsPlayer ? enemies : players;
      const targetSide = actorIsPlayer ? 'enemy' : 'player';
      if (!alive(targets).length) break;
      if (isBlockedBehindFrontline(actor, allies)) continue;

      actor.attackMeter += actor.speed;
      if (actor.attackMeter < 100) continue;

      actor.attackMeter = 0;
      const ability = getAbility(actor, demonTypes);

      if (ability.kind === 'heal') {
        applyHeal({ tick, healer: actor, healerSide: actorIsPlayer ? 'player' : 'enemy', allies, combatLog, context });
        continue;
      }

      if (ability.kind === 'poison') {
        applyPoison({ tick, attacker: actor, attackerSide: actorIsPlayer ? 'player' : 'enemy', enemies: targets, demonTypes, combatLog, context });
        continue;
      }

      if (ability.kind === 'retaliate') {
        continue;
      }

      const chosenTargets = ability.kind === 'chaotic_attack'
        ? chooseChaoticTargets(rng, actor, players, enemies, ability)
        : chooseTargets(rng, actor, targets, demonTypes, targetSide);
      const targeting = ability.kind === 'cleave_attack' ? 'cleave' : getTargeting(actor, demonTypes);

      chosenTargets.forEach((target, targetIndex) => {
        const damage = ability.kind === 'chaotic_attack'
          ? randomInt(rng, 1, Math.max(1, Number(actor.atk) || 1))
          : Math.max(1, Number(actor.atk) || 1);

        applyDamage({
          tick,
          attacker: actor,
          attackerSide: actorIsPlayer ? 'player' : 'enemy',
          target,
          targetSide: actorIsPlayer ? 'enemy' : 'player',
          targetTeam: targets,
          damage,
          targeting,
          hitIndex: targetIndex + 1,
          hitCount: chosenTargets.length,
          demonTypes,
          combatLog,
          context
        });
      });
    }

    if (alive(players).length && alive(enemies).length) {
      const battleStateKey = getBattleStateKey(players, enemies, battleState);
      const seenCount = (seenBattleStates.get(battleStateKey) || 0) + 1;
      seenBattleStates.set(battleStateKey, seenCount);
      if (seenCount >= STALEMATE_STATE_REPEAT_LIMIT) {
        endReason = 'stalemate';
        break;
      }
    }
  }

  const playerAlive = alive(players).length > 0;
  const enemyAlive = alive(enemies).length > 0;
  const winner = playerAlive && !enemyAlive ? 'player' : 'enemy';
  if (!endReason) {
    endReason = !playerAlive
      ? 'defeat'
      : !enemyAlive
        ? 'victory'
        : 'timeout';
  }

  return {
    winner,
    endReason,
    ticks: tick,
    combatLog,
    playerTeamBefore,
    enemyTeamBefore,
    playerTeam: cloneBattleTeamForReplay(players),
    enemyTeam: cloneBattleTeamForReplay(enemies)
  };
}

function getBattleStateKey(players, enemies, battleState = {}) {
  return JSON.stringify({
    lastBreathUsed: Boolean(battleState.lastBreathUsed),
    players: getTeamStateKey(players),
    enemies: getTeamStateKey(enemies)
  });
}

function getTeamStateKey(team) {
  return (team || []).map((demon) => ({
    id: demon.instanceId,
    position: normalizePosition(demon.position),
    formationSlot: normalizeFormationSlot(demon.formationSlot ?? demon.formationRow),
    hp: Math.max(0, Number(demon.hp) || 0),
    shield: Math.max(0, Number(demon.shield) || 0),
    attackMeter: Number(demon.attackMeter) || 0,
    poison: (demon.statusEffects?.poison || []).map((poison) => ({
      source: poison.source,
      damage: Number(poison.damage) || 0,
      remainingTicks: Number(poison.remainingTicks) || 0,
      nextTickIn: Number(poison.nextTickIn) || 0,
      tickInterval: Number(poison.tickInterval) || 0
    }))
  }));
}

function dealDamage(target, damage) {
  const incomingAmount = Math.max(0, Number(damage) || 0);
  const amount = incomingAmount > 0 ? Math.max(1, Math.round(incomingAmount)) : 0;
  const shield = Math.max(0, Number(target.shield) || 0);
  const shieldDamage = Math.min(shield, amount);
  const hpDamage = amount - shieldDamage;

  if (shieldDamage > 0) {
    target.shield = Math.max(0, shield - shieldDamage);
  }
  if (hpDamage > 0) {
    target.hp = Math.max(0, target.hp - hpDamage);
  }

  return {
    damage: amount,
    shieldDamage,
    hpDamage
  };
}

function cloneBattleTeamForReplay(team) {
  return (team || []).map((demon) => {
    const clone = {
      ...demon,
      statusEffects: {
        poison: (demon.statusEffects?.poison || []).map((poison) => ({ ...poison }))
      }
    };
    delete clone.battleBuffs;
    delete clone.deathBuffsHandled;
    return clone;
  });
}

module.exports = {
  simulateFight
};
