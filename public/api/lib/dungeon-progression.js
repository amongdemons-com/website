const { applyRunBuffStatModifiers } = require('./run-buffs');
const { createRng } = require('./rng');
const { createDungeonEnemies } = require('./dungeon-enemies');
const { assignFormationSlots, resetRunDemon } = require('./run-demons');
const { prepareDungeonRankedEncounter } = require('./dungeon-ranked');

async function advanceDungeonFloor(run, player, options = {}) {
  run.state.team = assignFormationSlots(
    (run.state.team || []).map((demon) => resetRunDemon(demon, demon.instanceId)),
    'player'
  );
  run.state.playerLevel = Math.max(1, Math.floor(Number(player?.level ?? run.state.playerLevel) || 1));
  run.state.awaitingRecruit = false;
  run.state.awaitingCollectionReinforcement = false;
  delete run.state.collectionReinforcementLimit;

  if (!options.skipRankedEncounter) {
    applyRunBuffStatModifiers(run);
    const encounter = await prepareDungeonRankedEncounter(run, player, options.queryable, options);
    if (encounter) return { run, rankedEncounter: encounter };
  }

  delete run.state.rankedEncounter;
  run.floor += 1;
  run.state.currentFloor = run.floor;
  applyRunBuffStatModifiers(run);
  run.state.enemies = await createDungeonEnemies(
    createRng(run.seed + run.floor),
    run.floor,
    run.state.team.length,
    { buffs: run.state.buffs }
  );

  return { run, rankedEncounter: null };
}

module.exports = {
  advanceDungeonFloor
};
