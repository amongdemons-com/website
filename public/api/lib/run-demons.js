const { getDemonTypes } = require('./game-data');

function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
}

async function createRunDemonFromCollection(row, instanceId) {
  const preferredPosition = await getPreferredPosition(row.type_id || row.typeId);

  return {
    instanceId,
    collectionDemonId: row.id,
    sourceDemonId: row.source_demon_id || row.sourceDemonId,
    typeId: row.type_id || row.typeId,
    species: row.species,
    rarity: row.rarity,
    imageUrl: row.image_url || row.imageUrl,
    maxHp: Number(row.hp) || 1,
    hp: Number(row.hp) || 1,
    atk: Number(row.atk) || 1,
    speed: Number(row.speed) || 1,
    preferredPosition,
    position: 'front',
    attackMeter: 0
  };
}

function resetRunDemon(demon, instanceId) {
  const maxHp = Number(demon.maxHp) || Number(demon.hp) || 1;
  const preferredPosition = demon.preferredPosition === 'back' ? 'back' : 'front';

  return {
    ...demon,
    instanceId,
    maxHp,
    hp: maxHp,
    preferredPosition,
    position: preferredPosition,
    attackMeter: 0,
    statusEffects: {
      poison: []
    }
  };
}

async function enrichDemonPreferredPositions(demons) {
  const types = await getDemonTypes();
  return (demons || []).map((demon) => ({
    ...demon,
    preferredPosition: getPreferredPositionFromTypes(types, demon.type_id || demon.typeId || demon.type)
  }));
}

async function enrichRunPreferredPositions(run) {
  if (!run) return run;

  const types = await getDemonTypes();
  const enrichDemon = (demon) => demon ? ({
    ...demon,
    preferredPosition: getPreferredPositionFromTypes(types, demon.type_id || demon.typeId || demon.type)
  }) : demon;
  const enrichTeam = (team) => (team || []).map(enrichDemon);

  run.state = {
    ...run.state,
    team: enrichTeam(run.state?.team),
    enemies: enrichTeam(run.state?.enemies)
  };

  if (run.state.lastBattle) {
    run.state.lastBattle = {
      ...run.state.lastBattle,
      playerTeamBefore: enrichTeam(run.state.lastBattle.playerTeamBefore),
      enemyTeamBefore: enrichTeam(run.state.lastBattle.enemyTeamBefore),
      playerTeamAfter: enrichTeam(run.state.lastBattle.playerTeamAfter),
      enemyTeamAfter: enrichTeam(run.state.lastBattle.enemyTeamAfter)
    };
  }

  run.rewards = (run.rewards || []).map((reward) => ({
    ...reward,
    demon: enrichDemon(reward.demon)
  }));

  return run;
}

async function getPreferredPosition(typeId) {
  const types = await getDemonTypes();
  return getPreferredPositionFromTypes(types, typeId);
}

function getPreferredPositionFromTypes(types, typeId) {
  return types[String(typeId)]?.preferredPosition === 'back' ? 'back' : 'front';
}

module.exports = {
  createRunDemonFromCollection,
  enrichDemonPreferredPositions,
  enrichRunPreferredPositions,
  normalizePosition,
  resetRunDemon
};
