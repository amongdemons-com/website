const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { simulateFight } = require('../lib/combat');
const { getDemonTypes } = require('../lib/game-data');
const { createRng } = require('../lib/rng');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { consumeNextBattleTemporaryBuffs, generateBuffChoices, hasPendingBuffChoices, serializeRunBuffState } = require('../lib/run-buffs');
const { assignFormationSlots, resetRunDemon } = require('../lib/run-demons');
const { COLLECTION_REINFORCEMENT_FLOOR } = require('../lib/dungeon-rules');
const { createDiscardSoulRewardFields, ensureRunEarned } = require('../lib/run-rewards');

const router = express.Router();

router.post('/runs/:id/battle', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active') {
    return res.status(409).json({ error: 'Run is not active.' });
  }

  if (run.state.awaitingRecruit) {
    return res.status(409).json({ error: 'Choose a defeated demon before the next battle.' });
  }

  if (hasPendingBuffChoices(run)) {
    return res.status(409).json({ error: 'Choose a Demonic Pact before the next battle.' });
  }

  const rng = createRng(run.seed + run.floor);
  const demonTypes = await getDemonTypes();
  run.state.team = assignFormationSlots(run.state.team || [], 'player');
  run.state.enemies = assignFormationSlots(run.state.enemies || [], 'enemy');
  const result = simulateFight(rng, run.state.team, run.state.enemies, {
    demonTypes,
    buffs: run.state.buffs
  });
  run.state.team = mergeBattleTeamForRun(run.state.team, result.playerTeam);
  run.state.enemies = result.enemyTeam;
  run.state.hp = result.playerTeam.reduce((sum, demon) => sum + Math.max(0, demon.hp), 0);
  consumeNextBattleTemporaryBuffs(run);
  run.state.lastBattle = {
    floor: run.floor,
    winner: result.winner,
    combatLog: result.combatLog,
    playerTeamBefore: cloneForBattleReplay(result.playerTeamBefore),
    enemyTeamBefore: cloneForBattleReplay(result.enemyTeamBefore),
    playerTeamAfter: cloneForBattleReplay(result.playerTeam),
    enemyTeamAfter: cloneForBattleReplay(result.enemyTeam)
  };

  let rewards = {};
  if (result.winner === 'player') {
    const floorRewards = createDefeatedDemonRewards(run);
    rewards = floorRewards;
    run.rewards.push(...floorRewards);
    ensureRunEarned(run).xp += 10 + run.floor * 5;

    clearPoisonEffects(run.state.team);
    clearPoisonEffects(run.state.enemies);
    generateBuffChoices(run, createBuffChoiceRng(run));
    run.state.awaitingRecruit = true;
    if (run.floor === COLLECTION_REINFORCEMENT_FLOOR && !run.state.collectionReinforcementUsed) {
      run.state.awaitingCollectionReinforcement = true;
    }
    await db.query(
      'UPDATE players SET highest_floor = GREATEST(highest_floor, ?) WHERE id = ?',
      [run.floor, req.player.id]
    );
  } else {
    run.status = 'defeated';
    run.state.earned = { xp: 0, souls: 0 };
    delete run.state.extractChoice;
  }

  await saveRun(run);

  res.json({
    winner: result.winner,
    combatLog: result.combatLog,
    lastBattle: run.state.lastBattle,
    buffs: serializeRunBuffState(run.state.buffs),
    rewards
  });
});

function cloneForBattleReplay(team) {
  return (team || []).map((demon) => ({ ...demon }));
}

function mergeBattleTeamForRun(sourceTeam, battleTeam) {
  const battleById = new Map((battleTeam || []).map((demon) => [demon.instanceId, demon]));

  return (sourceTeam || []).map((demon) => {
    const battleDemon = battleById.get(demon.instanceId);
    if (!battleDemon) return { ...demon };

    const maxHp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
    return {
      ...demon,
      maxHp,
      hp: Math.max(0, Math.min(maxHp, Number(battleDemon.hp) || 0)),
      attackMeter: Number(battleDemon.attackMeter) || 0,
      statusEffects: {
        poison: (battleDemon.statusEffects?.poison || []).map((poison) => ({ ...poison }))
      }
    };
  });
}

function createBuffChoiceRng(run) {
  return createRng((Number(run.seed) + Number(run.floor) * 2654435761 + 724981) >>> 0);
}

function clearPoisonEffects(team) {
  (team || []).forEach((demon) => {
    demon.statusEffects = {
      ...(demon.statusEffects || {}),
      poison: []
    };
  });
}

function createDefeatedDemonRewards(run) {
  const enemies = run.state.enemies || [];

  return enemies.map((enemy, index) => ({
    rewardId: run.rewards.length + index + 1,
    type: 'recruit',
    floor: run.floor,
    demon: resetRunDemon(enemy, `recruit-${run.floor}-${index + 1}`),
    ...createDiscardSoulRewardFields(1),
    xp: 0,
    claimed: false
  }));
}

module.exports = router;
