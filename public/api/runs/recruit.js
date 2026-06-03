const express = require('express');
const db = require('../lib/db');
const { requireAuth } = require('../lib/auth');
const { createRng } = require('../lib/rng');
const { createHuntEnemies } = require('../lib/hunt-enemies');
const { getRunForPlayer, saveRun } = require('../lib/runs');
const {
  assignFormationSlots,
  createRunDemonFromCollection,
  getFormationSlotPosition,
  normalizeFormationSlot,
  normalizePosition,
  resetRunDemon
} = require('../lib/run-demons');
const { COLLECTION_REINFORCEMENT_FLOOR, getDungeonTeamLimit } = require('../lib/dungeon-rules');
const { clearPendingRewardSoul, settleDiscardedSoulRewards } = require('../lib/run-rewards');

const router = express.Router();

router.post('/runs/:id/recruit', requireAuth, async (req, res) => {
  const run = await getRunForPlayer(req.params.id, req.player.id);
  const stagedTeam = Array.isArray(req.body.team) ? req.body.team : null;
  const rewardId = req.body.rewardId ? Number(req.body.rewardId) : null;
  const replaceInstanceId = req.body.replaceInstanceId ? String(req.body.replaceInstanceId) : null;
  const requestedPosition = req.body.position ? normalizePosition(req.body.position) : null;
  const skipRecruit = Boolean(req.body.skipRecruit);
  const hasExtractChoice = Object.prototype.hasOwnProperty.call(req.body || {}, 'extractChoice');
  const extractChoice = hasExtractChoice ? req.body.extractChoice : undefined;

  if (!run) {
    return res.status(404).json({ error: 'Run not found.' });
  }

  if (!run.state.awaitingRecruit) {
    return res.status(409).json({ error: 'No recruit choice is pending.' });
  }

  if (skipRecruit) {
    if (Number(run.floor) === 0) {
      return res.status(400).json({ error: 'Add at least one demon to your team before starting the dungeon.' });
    }
    if (hasExtractChoice) {
      stageExtractChoice(run, extractChoice);
    }
    run.state.awaitingCollectionReinforcement = false;
    settleDiscardedSoulRewards(run);
    await advanceFloor(run);
    await saveRun(run);
    return res.json({ team: run.state.team, skipped: true });
  }

  if (stagedTeam) {
    const team = await buildStagedTeam(run, stagedTeam);
    if (hasExtractChoice) {
      stageExtractChoice(run, extractChoice);
    }
    run.state.team = team;

    const recruitedRewardIds = new Set(
      stagedTeam
        .filter((item) => item && item.source === 'reward')
        .map((item) => Number(item.rewardId))
    );
    run.rewards.forEach((reward) => {
      if (reward.type === 'recruit' && reward.floor === run.floor && recruitedRewardIds.has(Number(reward.rewardId))) {
        reward.recruited = true;
        reward.claimed = true;
        clearPendingRewardSoul(reward);
      }
    });
    if (stagedTeam.some((item) => item && item.source === 'collection')) {
      run.state.collectionReinforcementUsed = Number(run.floor) !== 0;
    }
    run.state.awaitingCollectionReinforcement = false;
    settleDiscardedSoulRewards(run);

    if (run.status === 'active') {
      await advanceFloor(run);
    }

    await saveRun(run);
    return res.json({ team: run.state.team });
  }

  const reward = rewardId
    ? run.rewards.find((item) => item.rewardId === rewardId)
    : [...run.rewards].reverse().find((item) => item.type === 'recruit' && !item.recruited);

  if (!reward || !reward.demon) {
    return res.status(404).json({ error: 'Recruit reward not found.' });
  }

  if (reward.type !== 'recruit') {
    return res.status(409).json({ error: 'Only defeated floor demons can join the dungeon.' });
  }

  if (reward.recruited) {
    return res.status(409).json({ error: 'Demon already recruited.' });
  }

  if (run.state.team.length >= getDungeonTeamLimit(run.floor + 1) && !replaceInstanceId) {
    return res.status(400).json({ error: 'Choose one of your demons to swap out.' });
  }

  reward.recruited = true;
  reward.claimed = true;
  clearPendingRewardSoul(reward);
  const recruit = resetRunDemon(reward.demon, `player-${Date.now()}`);

  if (replaceInstanceId) {
    const replaceIndex = run.state.team.findIndex((demon) => demon.instanceId === replaceInstanceId);
    if (replaceIndex === -1) {
      return res.status(404).json({ error: 'Swap target not found.' });
    }
    recruit.position = requestedPosition || normalizePosition(run.state.team[replaceIndex].position);
    run.state.team.splice(replaceIndex, 1, recruit);
  } else {
    recruit.position = requestedPosition || normalizePosition(recruit.position || (run.state.team.length === 0 ? 'front' : 'back'));
    run.state.team.push(recruit);
  }

  if (run.status === 'active') {
    run.state.awaitingCollectionReinforcement = false;
    settleDiscardedSoulRewards(run);
    await advanceFloor(run);
  }

  await saveRun(run);
  res.json({ team: run.state.team, reward });
});

async function advanceFloor(run) {
  run.state.team = assignFormationSlots(
    run.state.team.map((demon) => resetRunDemon(demon, demon.instanceId)),
    'player'
  );
  run.floor += 1;
  run.state.currentFloor = run.floor;
  run.state.enemies = await createHuntEnemies(createRng(run.seed + run.floor), run.floor, run.state.team.length);
  run.state.awaitingRecruit = false;
  run.state.awaitingCollectionReinforcement = false;
  delete run.state.collectionReinforcementLimit;
}

async function buildStagedTeam(run, stagedTeam) {
  const teamLimit = getDungeonTeamLimit(run.floor + 1);
  if (!stagedTeam.length || stagedTeam.length > teamLimit) {
    const error = new Error(`Choose between 1 and ${teamLimit} demons for your team.`);
    error.status = 400;
    throw error;
  }

  const collectionItems = stagedTeam.filter((item) => item && item.source === 'collection');
  const collectionReinforcementLimit = getCollectionReinforcementLimit(run);
  if (collectionItems.length > collectionReinforcementLimit) {
    const error = new Error(`Choose up to ${collectionReinforcementLimit} collection reinforcement${collectionReinforcementLimit === 1 ? '' : 's'}.`);
    error.status = 400;
    throw error;
  }
  if (collectionItems.length && !isCollectionReinforcementAvailable(run)) {
    const error = new Error('Collection reinforcement is not available.');
    error.status = 409;
    throw error;
  }

  const selectedCollectionIds = new Set();
  const existingCollectionIds = new Set(
    (run.state.team || [])
      .map((demon) => Number(demon.collectionDemonId))
      .filter(Boolean)
  );
  const team = [];

  for (let index = 0; index < stagedTeam.length; index += 1) {
    const item = stagedTeam[index];
    if (!item || !item.source) {
      const error = new Error('Invalid staged team.');
      error.status = 400;
      throw error;
    }

    const formationSlot = normalizeFormationSlot(item.formationSlot ?? item.formationRow);
    const position = formationSlot !== null
      ? getFormationSlotPosition(formationSlot, 'player')
      : normalizePosition(item.position || (index === 0 ? 'front' : 'back'));

    if (item.source === 'team') {
      const instanceId = String(item.instanceId || item.originalInstanceId || '');
      const demon = (run.state.team || []).find((teamDemon) => teamDemon.instanceId === instanceId);
      if (!demon) {
        const error = new Error('Team demon not found.');
        error.status = 404;
        throw error;
      }

      team.push({
        ...resetRunDemon(demon, demon.instanceId),
        position,
        ...(formationSlot !== null ? { formationSlot } : {})
      });
      continue;
    }

    if (item.source === 'reward') {
      const rewardId = Number(item.rewardId);
      const reward = run.rewards.find((rewardItem) => (
        Number(rewardItem.rewardId) === rewardId &&
        rewardItem.type === 'recruit' &&
        rewardItem.floor === run.floor &&
        rewardItem.demon
      ));
      if (!reward) {
        const error = new Error('Recruit reward not found.');
        error.status = 404;
        throw error;
      }

      team.push({
        ...resetRunDemon(reward.demon, `player-${run.floor}-${reward.rewardId}`),
        position,
        ...(formationSlot !== null ? { formationSlot } : {})
      });
      continue;
    }

    if (item.source === 'collection') {
      const demonId = Number(item.demonId || item.collectionDemonId);
      if (!demonId || selectedCollectionIds.has(demonId) || existingCollectionIds.has(demonId)) {
        const error = new Error('Collection reinforcement not found.');
        error.status = 404;
        throw error;
      }

      const [rows] = await db.query(
        `SELECT id, source_demon_id, type_id, species, rarity, image_url, hp, atk, speed
         FROM player_demons
         WHERE id = ? AND player_id = ?
         LIMIT 1`,
        [demonId, run.playerId]
      );

      if (!rows.length) {
        const error = new Error('Collection reinforcement not found.');
        error.status = 404;
        throw error;
      }

      selectedCollectionIds.add(demonId);
      const demon = await createRunDemonFromCollection(rows[0], `player-collection-${demonId}`);
      team.push({
        ...resetRunDemon(demon, `player-collection-${demonId}`),
        position,
        ...(formationSlot !== null ? { formationSlot } : {})
      });
      continue;
    }

    if (item.source === 'reserved') {
      const choice = run.state.extractChoice;
      if (!choice?.demon) {
        const error = new Error('Reserved extract demon not found.');
        error.status = 404;
        throw error;
      }

      team.push({
        ...resetRunDemon(choice.demon, choice.instanceId || choice.demon.instanceId || `player-reserved-${index + 1}`),
        position,
        ...(formationSlot !== null ? { formationSlot } : {})
      });
      continue;
    }

    const error = new Error('Invalid staged team source.');
    error.status = 400;
    throw error;
  }

  return assignFormationSlots(team, 'player');
}

function stageExtractChoice(run, choice) {
  if (!choice) {
    delete run.state.extractChoice;
    return;
  }

  if (choice.source === 'reserved') {
    if (!run.state.extractChoice?.demon) {
      const error = new Error('Reserved extract demon not found.');
      error.status = 404;
      throw error;
    }
    return;
  }

  if (choice.source === 'team') {
    const instanceId = String(choice.instanceId || '');
    const demon = (run.state.team || []).find((item) => item.instanceId === instanceId);
    if (!demon) {
      const error = new Error('Team demon not found.');
      error.status = 404;
      throw error;
    }

    run.state.extractChoice = {
      key: choice.key || `team:${instanceId}`,
      source: 'team',
      instanceId,
      rewardId: null,
      demon: { ...demon }
    };
    return;
  }

  if (choice.source === 'reward') {
    const rewardId = Number(choice.rewardId);
    const reward = run.rewards.find((item) => (
      Number(item.rewardId) === rewardId &&
      item.type === 'recruit' &&
      item.floor === run.floor &&
      item.demon
    ));
    if (!reward) {
      const error = new Error('Reward demon not found.');
      error.status = 404;
      throw error;
    }

    reward.claimed = true;
    reward.extracted = true;
    clearPendingRewardSoul(reward);
    run.state.extractChoice = {
      key: choice.key || `reward:${rewardId}`,
      source: 'reward',
      instanceId: choice.instanceId || reward.demon.instanceId,
      rewardId,
      demon: { ...reward.demon }
    };
    return;
  }

  const error = new Error('Invalid extract demon source.');
  error.status = 400;
  throw error;
}

function isCollectionReinforcementAvailable(run) {
  return getCollectionReinforcementLimit(run) > 0;
}

function getCollectionReinforcementLimit(run) {
  const explicitLimit = Number(run.state.collectionReinforcementLimit);
  if (explicitLimit > 0 && run.state.awaitingRecruit) return explicitLimit;

  if (run.state.awaitingRecruit && Number(run.floor) === 0) return 2;

  return Boolean(
    run.state.awaitingCollectionReinforcement ||
    (
      !run.state.collectionReinforcementUsed &&
      run.state.awaitingRecruit &&
      Number(run.floor) === COLLECTION_REINFORCEMENT_FLOOR
    )
  ) ? 1 : 0;
}

module.exports = router;
