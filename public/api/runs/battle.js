const express = require('express');
const { requireAuth } = require('../lib/auth');
const { simulateFight } = require('../lib/combat');
const { getDemonTypes } = require('../lib/game-data');
const { createRng } = require('../lib/rng');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { resetRunDemon } = require('../lib/run-demons');
const { MAX_DUNGEON_FLOOR } = require('../lib/dungeon-rules');

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

  const rng = createRng(run.seed + run.floor);
  const demonTypes = await getDemonTypes();
  const playerTeamBefore = cloneForBattleReplay(run.state.team || []);
  const enemyTeamBefore = cloneForBattleReplay(run.state.enemies || []);
  const result = simulateFight(rng, run.state.team, run.state.enemies, { demonTypes });
  run.state.team = result.playerTeam;
  run.state.enemies = result.enemyTeam;
  run.state.hp = result.playerTeam.reduce((sum, demon) => sum + Math.max(0, demon.hp), 0);
  run.state.lastBattle = {
    floor: run.floor,
    winner: result.winner,
    combatLog: result.combatLog,
    playerTeamBefore,
    enemyTeamBefore,
    playerTeamAfter: cloneForBattleReplay(result.playerTeam),
    enemyTeamAfter: cloneForBattleReplay(result.enemyTeam)
  };

  let rewards = {};
  if (result.winner === 'player') {
    const isFinalFloor = run.floor >= MAX_DUNGEON_FLOOR;
    const floorRewards = isFinalFloor ? createFinalTeamRewards(run) : createDefeatedDemonRewards(run);
    rewards = floorRewards;
    run.rewards.push(...floorRewards);
    run.state.earned = run.state.earned || { xp: 0, souls: 0 };
    run.state.earned.xp += 10 + run.floor * 5;
    run.state.earned.souls += countDefeatedDemons(result.enemyTeam);
    run.state.mapProgress[run.floor - 1].status = 'cleared';

    if (isFinalFloor) {
      run.status = 'completed';
      run.state.awaitingFinalPick = true;
    } else {
      clearPoisonEffects(run.state.team);
      clearPoisonEffects(run.state.enemies);
      run.state.awaitingRecruit = true;
      if (run.floor === 3 && !run.state.collectionReinforcementUsed) {
        run.state.awaitingCollectionReinforcement = true;
      }
    }
  } else {
    run.status = 'defeated';
    run.state.earned = {
      ...(run.state.earned || { xp: 0, souls: 0 }),
      souls: 0
    };
  }

  await saveRun(run);

  res.json({
    winner: result.winner,
    combatLog: result.combatLog,
    lastBattle: run.state.lastBattle,
    rewards
  });
});

function cloneForBattleReplay(team) {
  return (team || []).map((demon) => ({ ...demon }));
}

function clearPoisonEffects(team) {
  (team || []).forEach((demon) => {
    demon.statusEffects = {
      ...(demon.statusEffects || {}),
      poison: []
    };
  });
}

function countDefeatedDemons(team) {
  return (team || []).filter((demon) => Number(demon.hp) <= 0).length;
}

function createDefeatedDemonRewards(run) {
  const enemies = run.state.enemies || [];

  return enemies.map((enemy, index) => ({
    rewardId: run.rewards.length + index + 1,
    type: 'recruit',
    floor: run.floor,
    demon: resetRunDemon(enemy, `recruit-${run.floor}-${index + 1}`),
    souls: 0,
    xp: 0,
    claimed: false
  }));
}

function createFinalTeamRewards(run) {
  const teamRewards = (run.state.team || []).map((demon) => ({
    source: 'team',
    demon
  }));
  const finalFightRewards = (run.state.enemies || [])
    .map((demon) => ({
      source: 'final_enemy',
      demon
    }));

  return [...teamRewards, ...finalFightRewards].map((choice, index) => ({
    rewardId: run.rewards.length + index + 1,
    type: 'final',
    floor: run.floor,
    source: choice.source,
    demon: resetRunDemon(choice.demon, `final-${run.floor}-${index + 1}`),
    souls: 0,
    xp: 0,
    claimed: false
  }));
}

module.exports = router;
