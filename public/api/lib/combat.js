const { pick } = require('./rng');

function alive(team) {
  return team.filter((demon) => demon.hp > 0);
}

function chooseTarget(rng, attacker, enemies) {
  const living = alive(enemies);

  if (attacker.targeting === 'lowest_hp') {
    return living.sort((a, b) => a.hp - b.hp)[0];
  }

  if (attacker.targeting === 'random') {
    return pick(rng, living);
  }

  return living[0];
}

function cloneTeam(team) {
  return team.map((demon) => ({ ...demon, attackMeter: demon.attackMeter || 0 }));
}

function simulateFight(rng, playerTeam, enemyTeam) {
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
      const target = chooseTarget(rng, actor, targets);
      const damage = actor.atk;
      target.hp = Math.max(0, target.hp - damage);

      combatLog.push({
        tick,
        attacker: actor.instanceId,
        target: target.instanceId,
        dmg: damage,
        targetHp: target.hp
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
