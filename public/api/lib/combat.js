const { pick } = require('./rng');

function alive(team) {
  return team.filter((demon) => demon.hp > 0);
}

function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
}

function getTargeting(demon, demonTypes = {}) {
  const typeTargeting = demonTypes[String(demon.typeId)]?.targeting;
  return typeTargeting || demon.targeting || 'front';
}

function chooseTarget(rng, attacker, enemies, demonTypes) {
  const targeting = getTargeting(attacker, demonTypes);
  const living = alive(enemies);
  const frontRow = living.filter((demon) => normalizePosition(demon.position) === 'front');
  const available = targeting === 'front' && frontRow.length ? frontRow : living;

  if (targeting === 'lowest_hp') {
    return [...available].sort((a, b) => a.hp - b.hp)[0];
  }

  if (targeting === 'random') {
    return pick(rng, available);
  }

  return available[0];
}

function chooseTargets(rng, attacker, enemies, demonTypes) {
  if (getTargeting(attacker, demonTypes) === 'all') {
    return alive(enemies);
  }

  const target = chooseTarget(rng, attacker, enemies, demonTypes);
  return target ? [target] : [];
}

function cloneTeam(team) {
  return team.map((demon, index) => ({
    ...demon,
    position: normalizePosition(demon.position || (index === 0 ? 'front' : 'back')),
    attackMeter: demon.attackMeter || 0
  }));
}

function simulateFight(rng, playerTeam, enemyTeam, options = {}) {
  const demonTypes = options.demonTypes || {};
  const players = cloneTeam(playerTeam);
  const enemies = cloneTeam(enemyTeam);
  const combatLog = [];
  let tick = 0;

  while (alive(players).length && alive(enemies).length && tick < 1000) {
    tick += 1;
    const actors = [...alive(players), ...alive(enemies)].sort((a, b) => b.speed - a.speed);

    for (const actor of actors) {
      if (actor.hp <= 0) continue;

      const actorIsPlayer = players.some((demon) => demon.instanceId === actor.instanceId);
      const targets = actorIsPlayer ? enemies : players;
      if (!alive(targets).length) break;

      actor.attackMeter += actor.speed;
      if (actor.attackMeter < 100) continue;

      actor.attackMeter = 0;
      const chosenTargets = chooseTargets(rng, actor, targets, demonTypes);
      const damage = actor.atk;

      chosenTargets.forEach((target, targetIndex) => {
        target.hp = Math.max(0, target.hp - damage);

        combatLog.push({
          tick,
          attacker: actor.instanceId,
          attackerPosition: normalizePosition(actor.position),
          target: target.instanceId,
          targetPosition: normalizePosition(target.position),
          targeting: getTargeting(actor, demonTypes),
          hitIndex: targetIndex + 1,
          hitCount: chosenTargets.length,
          dmg: damage,
          targetHp: target.hp
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
