const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { simulateFight } = require('../lib/combat');
const { getDemonTypes } = require('../lib/game-data');
const { createRng } = require('../lib/rng');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const { serializeRun } = require('../lib/run-serialization');
const { applyRunBuffStatModifiers, consumeNextBattleTemporaryBuffs, generateBuffChoices, getTemporaryTeamSizeBonus, hasPendingBuffChoices, serializeRunBuffState, shouldOfferRunBuffChoices } = require('../lib/run-buffs');
const { serializeCombatBuffState } = require('../lib/combat-buffs');
const { getActivePlayerWorldRewardBuffs, resolvePlayerCombatBuffState } = require('../lib/player-combat-buffs');
const { assignFormationSlots, mergeBattleTeamForRun, resetRunDemon } = require('../lib/run-demons');
const { canUseCollectionReinforcement, getDungeonTeamLimit } = require('../lib/dungeon-rules');
const { getDungeonEncounterProfile } = require('../lib/dungeon-enemies');
const {
  applyDungeonRankedRatingResult,
  getDungeonPlayerCombatBuffs,
  getDungeonRankedEnemyBuffs
} = require('../lib/dungeon-ranked');
const { allocateRunRewardIds, createDiscardSoulRewardFields, ensureRunEarned, getBattleXpReward } = require('../lib/run-rewards');
const { qualifiesForTrialOfTheFew, recordDailyQuestProgress } = require('../lib/daily-quests');
const achievements = require('../lib/achievements');

const router = express.Router();

router.post('/runs/:id/battle', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (run.status !== 'active') {
    return res.status(409).json({ error: 'Run is not active.' });
  }

  if (run.state.rankedEncounter?.status === 'choice') {
    return resolveDungeonRankedBattle(req, res);
  }

  if (run.state.rankedEncounter) {
    return res.status(409).json({ error: 'Resolve the Ranked result before continuing.' });
  }

  if (run.state.awaitingRecruit) {
    return res.status(409).json({ error: 'Choose a defeated demon before the next battle.' });
  }

  if (hasPendingBuffChoices(run)) {
    return res.status(409).json({ error: 'Choose a Demonic Pact before the next battle.' });
  }

  const teamSizeAtBattleStart = (run.state.team || []).length;
  const teamLimitAtBattleStart = getDungeonTeamLimit(run.floor) + getTemporaryTeamSizeBonus(run);
  const isUndermannedAttempt = qualifiesForTrialOfTheFew({
    floor: run.floor,
    teamSize: teamSizeAtBattleStart,
    teamLimit: teamLimitAtBattleStart
  });
  const rng = createRng(run.seed + run.floor);
  const encounterProfile = getDungeonEncounterProfile(createRng(run.seed + run.floor), run.floor);
  const demonTypes = await getDemonTypes();
  const skillBuffs = await resolvePlayerCombatBuffState(req.player);
  const playerBuffs = getDungeonPlayerCombatBuffs(run.state.buffs, skillBuffs);
  applyRunBuffStatModifiers(run);
  run.state.team = assignFormationSlots(run.state.team || [], 'player');
  run.state.enemies = assignFormationSlots(run.state.enemies || [], 'enemy');
  const result = simulateFight(rng, run.state.team, run.state.enemies, {
    demonTypes,
    combatType: 'dungeon',
    playerBuffs
  });
  run.state.team = mergeBattleTeamForRun(run.state.team, result.playerTeam);
  run.state.enemies = result.enemyTeam;
  run.state.hp = result.playerTeam.reduce((sum, demon) => sum + Math.max(0, demon.hp), 0);
  consumeNextBattleTemporaryBuffs(run);
  run.state.lastBattle = {
    floor: run.floor,
    winner: result.winner,
    endReason: result.endReason,
    ticks: result.ticks,
    combatLog: result.combatLog,
    playerTeamBefore: cloneForBattleReplay(result.playerTeamBefore),
    enemyTeamBefore: cloneForBattleReplay(result.enemyTeamBefore),
    playerTeamAfter: cloneForBattleReplay(result.playerTeam),
    enemyTeamAfter: cloneForBattleReplay(result.enemyTeam),
    playerBuffs: serializeCombatBuffState(playerBuffs).activeBuffs,
    enemyBuffs: encounterProfile.convergence ? [{ ...encounterProfile.convergence }] : []
  };

  let rewards = {};
  if (result.winner === 'player') {
    const floorRewards = createDefeatedDemonRewards(run);
    rewards = floorRewards;
    run.rewards.push(...floorRewards);
    ensureRunEarned(run).xp += getBattleXpReward(run.floor, result.winner);

    clearPoisonEffects(run.state.team);
    clearPoisonEffects(run.state.enemies);
    if (shouldOfferRunBuffChoices(run)) {
      generateBuffChoices(run, createBuffChoiceRng(run), 3, { uniqueRarityPacts: true });
    }
    run.state.awaitingRecruit = true;
    if (canUseCollectionReinforcement(run.state, run.floor)) {
      run.state.awaitingCollectionReinforcement = true;
    }
    await db.query(
      'UPDATE players SET highest_floor = GREATEST(highest_floor, ?) WHERE id = ?',
      [run.floor, req.player.id]
    );
  } else {
    run.status = 'defeated';
    const earned = ensureRunEarned(run);
    earned.xp += getBattleXpReward(run.floor, result.winner);
    earned.souls = 0;
    delete run.state.extractChoice;
  }

  await saveRun(run);
  if (result.winner === 'player') {
    await recordDailyQuestProgress(req.player.id, {
      dungeonWins: 1,
      undermannedWins: isUndermannedAttempt ? 1 : 0
    });
  }

  await achievements.grantDungeonBattleAchievements(req.player.id, {
    floor: run.floor,
    winner: result.winner,
    teamSize: teamSizeAtBattleStart,
    undermanned: isUndermannedAttempt
  });

  // Reuse every world reward already resolved for combat. Dropping one here
  // makes the following preparation preview disagree with the battle that the
  // server will simulate (most visibly for type 10 healing rewards).
  const worldBuffs = getActivePlayerWorldRewardBuffs(skillBuffs);
  const serializedRun = await serializeRun(run, { worldBuffs, playerLevel: req.player.level });

  res.json({
    winner: result.winner,
    endReason: result.endReason,
    ticks: result.ticks,
    buffs: serializeRunBuffState(run.state.buffs, { playerLevel: req.player.level }),
    rewards,
    run: serializedRun
  });
});

async function resolveDungeonRankedBattle(req, res) {
  const skillBuffs = await resolvePlayerCombatBuffState(req.player);
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const run = await getRunForPlayer(req.params.id, req.player.id, connection, { forUpdate: true });
    if (!run) throw createBattleError('Run not found.', 404);
    if (run.status !== 'active') throw createBattleError('Run is not active.', 409);
    if (run.state.rankedEncounter?.status !== 'choice') {
      throw createBattleError('No Ranked dungeon encounter is waiting.', 409);
    }

    const demonTypes = await getDemonTypes();
    const playerBuffs = getDungeonPlayerCombatBuffs(run.state.buffs, skillBuffs);
    const enemyBuffs = getDungeonRankedEnemyBuffs(run);
    applyRunBuffStatModifiers(run);
    run.state.team = assignFormationSlots(run.state.team || [], 'player');
    run.state.enemies = assignFormationSlots(run.state.enemies || [], 'enemy');

    const result = simulateFight(
      createRng((Number(run.seed) + Number(run.floor) * 2654435761 + 17041) >>> 0),
      run.state.team,
      run.state.enemies,
      {
        demonTypes,
        combatType: 'ranked',
        playerBuffs,
        enemyBuffs
      }
    );

    run.state.team = mergeBattleTeamForRun(run.state.team, result.playerTeam);
    run.state.enemies = result.enemyTeam;
    run.state.hp = result.playerTeam.reduce((sum, demon) => sum + Math.max(0, demon.hp), 0);
    consumeNextBattleTemporaryBuffs(run);
    const opponent = run.state.rankedEncounter.opponent;
    run.state.lastBattle = {
      floor: run.floor,
      ranked: true,
      opponent: { ...opponent },
      winner: result.winner,
      endReason: result.endReason,
      ticks: result.ticks,
      combatLog: result.combatLog,
      playerTeamBefore: cloneForBattleReplay(result.playerTeamBefore),
      enemyTeamBefore: cloneForBattleReplay(result.enemyTeamBefore),
      playerTeamAfter: cloneForBattleReplay(result.playerTeam),
      enemyTeamAfter: cloneForBattleReplay(result.enemyTeam),
      playerBuffs: serializeCombatBuffState(playerBuffs).activeBuffs,
      enemyBuffs: serializeCombatBuffState(enemyBuffs).activeBuffs
    };

    const rankedResult = await applyDungeonRankedRatingResult(run, result.winner, connection);
    if (result.winner !== 'player') {
      run.status = 'defeated';
      delete run.state.extractChoice;
    }

    await saveRun(run, connection);
    await connection.commit();
    committed = true;

    const worldBuffs = getActivePlayerWorldRewardBuffs(skillBuffs);
    res.json({
      winner: result.winner,
      endReason: result.endReason,
      ticks: result.ticks,
      rankedResult,
      run: await serializeRun(run, { worldBuffs, playerLevel: req.player.level })
    });
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function createBattleError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cloneForBattleReplay(team) {
  return (team || []).map((demon) => ({ ...demon }));
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
  const rewardIds = allocateRunRewardIds(run, enemies.length);

  return enemies.map((enemy, index) => ({
    rewardId: rewardIds[index],
    type: 'recruit',
    floor: run.floor,
    demon: resetRunDemon(enemy, `recruit-${run.floor}-${index + 1}`),
    ...createDiscardSoulRewardFields(1),
    xp: 0,
    claimed: false
  }));
}

module.exports = router;
