const { pick, randomInt } = require('./rng');

function alive(team) {
  return team.filter((demon) => demon.hp > 0);
}

function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
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

function chooseTarget(rng, attacker, enemies, demonTypes) {
  const targeting = getTargeting(attacker, demonTypes);
  const living = alive(enemies);
  const frontRow = living.filter((demon) => normalizePosition(demon.position) === 'front');
  const available = targeting === 'front' && frontRow.length ? frontRow : living;

  if (!available.length || targeting === 'none') return null;

  if (targeting === 'lowest_hp') {
    return [...available].sort((a, b) => a.hp - b.hp)[0];
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
  const maxStacks = Number(ability.maxStacksPerTarget) || 1;
  const stackable = living.filter((target) => getPoisonStacks(target, attacker.instanceId) < maxStacks);
  const available = stackable.length ? stackable : living;

  return [...available].sort((a, b) => b.hp - a.hp)[0] || null;
}

function chooseHealTarget(allies) {
  return alive(allies)
    .filter((demon) => demon.hp < demon.maxHp)
    .sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp))[0] || null;
}

function chooseTargets(rng, attacker, enemies, demonTypes) {
  const targeting = getTargeting(attacker, demonTypes);

  if (targeting === 'all') {
    return alive(enemies);
  }

  if (targeting === 'none') {
    return [];
  }

  const target = chooseTarget(rng, attacker, enemies, demonTypes);
  return target ? [target] : [];
}

function cloneTeam(team) {
  return team.map((demon, index) => ({
    ...demon,
    position: normalizePosition(demon.position || (index === 0 ? 'front' : 'back')),
    attackMeter: demon.attackMeter || 0,
    statusEffects: {
      poison: [...(demon.statusEffects?.poison || [])]
    }
  }));
}

function getPoisonStacks(target, source) {
  return (target.statusEffects?.poison || [])
    .filter((poison) => poison.source === source)
    .length;
}

function applyPoisonTick(team, tick, combatLog) {
  alive(team).forEach((target) => {
    const poisonStacks = target.statusEffects?.poison || [];
    if (!poisonStacks.length) return;

    poisonStacks.forEach((poison) => {
      if (target.hp <= 0) return;

      const damage = Math.max(1, Number(poison.damage) || 1);
      target.hp = Math.max(0, target.hp - damage);
      poison.remainingTurns -= 1;

      combatLog.push({
        tick,
        attacker: poison.source,
        target: target.instanceId,
        targetPosition: normalizePosition(target.position),
        targeting: 'poison',
        effect: 'poison',
        dmg: damage,
        targetHp: target.hp
      });
    });

    target.statusEffects.poison = poisonStacks.filter((poison) => poison.remainingTurns > 0);
  });
}

function applyDamage({ tick, attacker, target, damage, targeting, hitIndex, hitCount, demonTypes, combatLog }) {
  target.hp = Math.max(0, target.hp - damage);

  combatLog.push({
    tick,
    attacker: attacker.instanceId,
    attackerPosition: normalizePosition(attacker.position),
    target: target.instanceId,
    targetPosition: normalizePosition(target.position),
    targeting,
    hitIndex,
    hitCount,
    dmg: damage,
    targetHp: target.hp
  });

  const targetAbility = getAbility(target, demonTypes);
  if (target.hp > 0 && targetAbility.kind === 'retaliate' && attacker.hp > 0) {
    const scaledDamage = Math.max(1, Math.round(damage * (Number(targetAbility.retaliationScale) || 0.5)));
    const retaliationDamage = targetAbility.usesOwnAttackAsCap
      ? Math.min(scaledDamage, Math.max(1, Number(target.atk) || 1))
      : scaledDamage;

    attacker.hp = Math.max(0, attacker.hp - retaliationDamage);
    combatLog.push({
      tick,
      attacker: target.instanceId,
      attackerPosition: normalizePosition(target.position),
      target: attacker.instanceId,
      targetPosition: normalizePosition(attacker.position),
      targeting: 'retaliate',
      effect: 'retaliate',
      dmg: retaliationDamage,
      targetHp: attacker.hp
    });
  }
}

function applyHeal({ tick, healer, allies, combatLog }) {
  const target = chooseHealTarget(allies);
  if (!target) return false;

  const healing = Math.max(1, Number(healer.atk) || 1);
  target.hp = Math.min(target.maxHp, target.hp + healing);
  combatLog.push({
    tick,
    attacker: healer.instanceId,
    attackerPosition: normalizePosition(healer.position),
    target: target.instanceId,
    targetPosition: normalizePosition(target.position),
    targeting: 'highest_missing_hp',
    effect: 'heal',
    healing,
    targetHp: target.hp
  });

  return true;
}

function applyPoison({ tick, attacker, enemies, demonTypes, combatLog }) {
  const target = choosePoisonTarget(attacker, enemies, demonTypes);
  if (!target) return false;

  const ability = getAbility(attacker, demonTypes);
  const maxStacks = Math.max(1, Number(ability.maxStacksPerTarget) || 1);
  const poison = {
    source: attacker.instanceId,
    damage: Math.max(1, Math.round((Number(attacker.atk) || 1) * (Number(ability.damagePerTurnScale) || 1))),
    remainingTurns: Math.max(1, Number(ability.durationTurns) || 3)
  };

  target.statusEffects = target.statusEffects || {};
  target.statusEffects.poison = [...(target.statusEffects.poison || [])];
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
    targetHp: target.hp
  });

  return true;
}

function simulateFight(rng, playerTeam, enemyTeam, options = {}) {
  const demonTypes = options.demonTypes || {};
  const players = cloneTeam(playerTeam);
  const enemies = cloneTeam(enemyTeam);
  const combatLog = [];
  let tick = 0;

  while (alive(players).length && alive(enemies).length && tick < 1000) {
    tick += 1;
    applyPoisonTick(players, tick, combatLog);
    applyPoisonTick(enemies, tick, combatLog);

    const actors = [...alive(players), ...alive(enemies)].sort((a, b) => b.speed - a.speed);

    for (const actor of actors) {
      if (actor.hp <= 0) continue;

      const actorIsPlayer = players.some((demon) => demon.instanceId === actor.instanceId);
      const allies = actorIsPlayer ? players : enemies;
      const targets = actorIsPlayer ? enemies : players;
      if (!alive(targets).length) break;

      actor.attackMeter += actor.speed;
      if (actor.attackMeter < 100) continue;

      actor.attackMeter = 0;
      const ability = getAbility(actor, demonTypes);

      if (ability.kind === 'heal') {
        applyHeal({ tick, healer: actor, allies, combatLog });
        continue;
      }

      if (ability.kind === 'poison') {
        applyPoison({ tick, attacker: actor, enemies: targets, demonTypes, combatLog });
        continue;
      }

      if (ability.kind === 'retaliate') {
        continue;
      }

      const chosenTargets = ability.kind === 'chaotic_attack'
        ? [pick(rng, alive(players).concat(alive(enemies)))]
        : chooseTargets(rng, actor, targets, demonTypes);
      const targeting = getTargeting(actor, demonTypes);

      chosenTargets.forEach((target, targetIndex) => {
        const damage = ability.kind === 'chaotic_attack'
          ? randomInt(rng, 1, Math.max(1, Number(actor.atk) || 1))
          : Math.max(1, Number(actor.atk) || 1);

        applyDamage({
          tick,
          attacker: actor,
          target,
          damage,
          targeting,
          hitIndex: targetIndex + 1,
          hitCount: chosenTargets.length,
          demonTypes,
          combatLog
        });
      });
    }
  }

  const winner = alive(players).length ? 'player' : 'enemy';
  return {
    winner,
    combatLog,
    playerTeam: players,
    enemyTeam: enemies
  };
}

module.exports = {
  simulateFight
};
