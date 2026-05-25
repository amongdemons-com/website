const { getDemonTypes } = require('./game-data');

const FORMATION_GRID_COLUMNS = 3;
const FORMATION_GRID_SIZE = 9;

function normalizePosition(position) {
  return position === 'back' ? 'back' : 'front';
}

function normalizeFormationSlot(slot) {
  const number = Number(slot);
  if (!Number.isInteger(number)) return null;
  return Math.max(0, Math.min(FORMATION_GRID_SIZE - 1, number));
}

function getFormationSlotPosition(slot, side = 'player') {
  const normalizedSlot = normalizeFormationSlot(slot);
  const column = (normalizedSlot === null ? 0 : normalizedSlot) % FORMATION_GRID_COLUMNS;
  const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
  return column === frontColumn ? 'front' : 'back';
}

function getFormationSlotOrder(position, side = 'player') {
  const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
  const middleColumn = 1;
  const outerColumn = side === 'enemy' ? FORMATION_GRID_COLUMNS - 1 : 0;
  const columns = position === 'front'
    ? [frontColumn]
    : position === 'back'
      ? [middleColumn, outerColumn]
      : [frontColumn, middleColumn, outerColumn];

  return columns.flatMap((column) => (
    Array.from({ length: FORMATION_GRID_COLUMNS }, (item, rowIndex) => rowIndex * FORMATION_GRID_COLUMNS + column)
  ));
}

function chooseFormationSlot(takenSlots, position, side = 'player') {
  const preferredSlot = getFormationSlotOrder(position, side).find((slot) => !takenSlots.has(slot));
  if (preferredSlot !== undefined) return preferredSlot;
  return Array.from({ length: FORMATION_GRID_SIZE }, (item, index) => index)
    .find((slot) => !takenSlots.has(slot));
}

function assignFormationSlots(team, side = 'player') {
  const takenSlots = new Set();

  return (team || []).slice(0, FORMATION_GRID_SIZE).map((demon, index) => {
    const explicitSlot = normalizeFormationSlot(demon.formationSlot ?? demon.formationRow);
    const requestedPosition = explicitSlot !== null
      ? getFormationSlotPosition(explicitSlot, side)
      : normalizePosition(demon.position || (index === 0 ? 'front' : 'back'));
    const slot = explicitSlot !== null && !takenSlots.has(explicitSlot)
      ? explicitSlot
      : chooseFormationSlot(takenSlots, requestedPosition, side);
    const normalizedSlot = normalizeFormationSlot(slot) ?? 0;

    takenSlots.add(normalizedSlot);

    return {
      ...demon,
      position: getFormationSlotPosition(normalizedSlot, side),
      formationSlot: normalizedSlot
    };
  });
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
  const formationSlot = normalizeFormationSlot(demon.formationSlot ?? demon.formationRow);

  return {
    ...demon,
    instanceId,
    maxHp,
    hp: maxHp,
    preferredPosition,
    position: normalizePosition(demon.position || preferredPosition),
    ...(formationSlot !== null ? { formationSlot } : {}),
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
  assignFormationSlots,
  createRunDemonFromCollection,
  enrichDemonPreferredPositions,
  enrichRunPreferredPositions,
  getFormationSlotPosition,
  normalizeFormationSlot,
  normalizePosition,
  resetRunDemon
};
