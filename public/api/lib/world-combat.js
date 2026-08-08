const crypto = require('node:crypto');
const db = require('./db');
const { simulateFight } = require('./combat');
const { getDemonTypes } = require('./game-data');
const { createRng } = require('./rng');
const {
  assignFormationSlots,
  createRunDemonFromCollection,
  resetRunDemon
} = require('./run-demons');
const {
  applyPreBattleBuffs,
  normalizeCombatBuffState,
  serializeCombatBuffState
} = require('./combat-buffs');
const { getEnemyPressureMultipliers } = require('./dungeon-enemies');
const { createPlayerCombatBuffState, resolvePlayerCombatBuffState } = require('./player-combat-buffs');
const { getHuntSoulCapacity, getPlayerStatPointSummary } = require('./account-stat-points');
const {
  createWorldBossEnemyBuffs,
  getWorldBossRewardBuff,
  serializeWorldBossForClient
} = require('./world-bosses');
const { getActiveWorldRewardBuffs } = require('./world-buffs');

const DEFAULT_ENEMY_RESPAWN_SECONDS = 300;
// Keep this in sync with WORLD_BATTLE_REPLAY_STEP_MS in public/app/js/world-ui.js.
const WORLD_BATTLE_REPLAY_STEP_MS = 520;
const WORLD_TERROR_XP_MULTIPLIER_BONUS = 2;
const WORLD_TERROR_START_DISTANCE = 10;
// Passive (AFK) hunting pays a fraction of the per-kill XP that an active
// fight is worth. xpPerCycle keeps its Terror scaling, so
// far encounters stay strictly better - they just accrue at a reduced rate.
// Keep this in sync with PASSIVE_HUNT_XP_MULTIPLIER in public/app/js/world-ui.js.
const PASSIVE_HUNT_XP_MULTIPLIER = 0.20;
const WORLD_TERROR_MAX_LEVEL = 40;
const DUNGEON_TERROR_START_FLOOR = 18;
const WORLD_TEAM_LIMIT = 6;
const WORLD_FORMATION_SLOT_COUNT = 9;

async function getActiveWorldTeam(playerId) {
  const savedRows = await getSavedWorldTeamRows(playerId);

  return materializeWorldTeamRows(savedRows);
}

async function getWorldTeamStatPreviews(player, collection = []) {
  const playerBuffs = await resolvePlayerCombatBuffState(player);
  return createWorldTeamStatPreviews(collection, playerBuffs);
}

function createWorldTeamStatPreviews(collection = [], playerBuffs = {}) {
  const previewTeam = (Array.isArray(collection) ? collection : []).map((demon) => {
    const maxHp = Math.max(1, Number(demon?.maxHp) || Number(demon?.hp) || 1);
    return {
      ...demon,
      maxHp,
      hp: maxHp
    };
  });

  return applyPreBattleBuffs(previewTeam, playerBuffs).reduce((previews, demon) => {
    const demonId = Number(demon?.collectionDemonId ?? demon?.id);
    if (!Number.isInteger(demonId) || demonId <= 0) return previews;

    const effectiveAtk = Number(demon.effectiveAtk);
    previews[demonId] = {
      maxHp: Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1),
      atk: Math.max(1, Number(demon.atk) || 1),
      speed: Math.max(1, Number(demon.speed) || 1),
      ...(Number.isFinite(effectiveAtk) && effectiveAtk > 0
        ? { effectiveAtk: Math.max(1, effectiveAtk) }
        : {})
    };
    return previews;
  }, {});
}

async function getSavedWorldTeamRows(playerId) {
  const [rows] = await db.query(
    `SELECT pd.id,
            pd.source_demon_id AS sourceDemonId,
            pd.type_id AS typeId,
            pd.species,
            pd.rarity,
            pd.image_url AS imageUrl,
            pd.hp,
            pd.atk,
            pd.speed,
            pwt.formation_slot AS formationSlot
     FROM player_world_teams pwt
     INNER JOIN player_demons pd
       ON pd.id = pwt.demon_id
      AND pd.player_id = pwt.player_id
     WHERE pwt.player_id = ?
     ORDER BY pwt.formation_slot ASC, pd.created_at DESC, pd.id DESC
     LIMIT ?`,
    [playerId, WORLD_TEAM_LIMIT]
  );

  return rows;
}

async function materializeWorldTeamRows(rows = []) {
  const team = [];
  for (const [index, row] of rows.entries()) {
    // The same collection demon may fill several slots, so the instance id has
    // to be unique per slot for battle results to map back correctly.
    const slotKey = normalizeWorldTeamSlot(row.formationSlot) ?? `i${index}`;
    const demon = await createRunDemonFromCollection(row, `world-collection-${row.id}-s${slotKey}`);
    const formationSlot = normalizeWorldTeamSlot(row.formationSlot);
    if (formationSlot !== null) {
      demon.formationSlot = formationSlot;
      demon.formationRow = formationSlot;
    }
    team.push(demon);
  }

  return assignFormationSlots(team.map((demon) => resetRunDemon(demon, demon.instanceId)), 'player');
}

async function saveActiveWorldTeam(playerId, requestedTeam = [], options = {}) {
  const team = normalizeWorldTeamRequest(requestedTeam);
  await assertWorldTeamDemonsBelongToPlayer(playerId, team);

  const connection = await db.getConnection();
  let committed = false;
  let changed = false;

  try {
    await connection.beginTransaction();

    const [currentRows] = await connection.query(
      `SELECT demon_id AS demonId, formation_slot AS formationSlot
       FROM player_world_teams
       WHERE player_id = ?
       ORDER BY formation_slot ASC, demon_id ASC
       FOR UPDATE`,
      [playerId]
    );
    changed = !areWorldTeamEntriesEqual(currentRows, team);

    if (changed) {
      await connection.query('DELETE FROM player_world_teams WHERE player_id = ?', [playerId]);

      for (const entry of team) {
        await connection.query(
          `INSERT INTO player_world_teams (player_id, demon_id, formation_slot)
           VALUES (?, ?, ?)`,
          [playerId, entry.demonId, entry.formationSlot]
        );
      }
    }

    await connection.commit();
    committed = true;
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }

  const savedTeam = await getActiveWorldTeam(playerId);
  return options.includeChanged
    ? { team: savedTeam, changed }
    : savedTeam;
}

function areWorldTeamEntriesEqual(currentRows = [], requestedTeam = []) {
  const current = normalizeComparableWorldTeamEntries(
    currentRows.map((entry) => ({
      demonId: entry.demonId,
      formationSlot: entry.formationSlot
    }))
  );
  const requested = normalizeComparableWorldTeamEntries(requestedTeam);

  if (current.length !== requested.length) return false;

  return current.every((entry, index) => (
    entry.demonId === requested[index].demonId &&
    entry.formationSlot === requested[index].formationSlot
  ));
}

function normalizeComparableWorldTeamEntries(entries = []) {
  return entries
    .map((entry) => ({
      demonId: Number(entry.demonId),
      formationSlot: Number(entry.formationSlot)
    }))
    .filter((entry) => (
      Number.isInteger(entry.demonId) &&
      Number.isInteger(entry.formationSlot)
    ))
    .sort((a, b) => (
      a.formationSlot - b.formationSlot ||
      a.demonId - b.demonId
    ));
}

function normalizeWorldTeamRequest(requestedTeam = []) {
  if (!Array.isArray(requestedTeam)) {
    const error = new Error('World team must be an array.');
    error.status = 400;
    throw error;
  }

  if (requestedTeam.length > WORLD_TEAM_LIMIT) {
    const error = new Error(`World team cannot exceed ${WORLD_TEAM_LIMIT} demons.`);
    error.status = 400;
    throw error;
  }

  const seenSlots = new Set();

  return requestedTeam.map((entry) => {
    const demonId = Number(entry?.demonId ?? entry?.collectionDemonId ?? entry?.id);
    const formationSlot = normalizeWorldTeamSlot(entry?.formationSlot ?? entry?.slot);

    if (!Number.isInteger(demonId) || demonId <= 0) {
      const error = new Error('Choose a valid collection demon.');
      error.status = 400;
      throw error;
    }

    if (formationSlot === null) {
      const error = new Error('Choose a valid formation slot.');
      error.status = 400;
      throw error;
    }

    if (seenSlots.has(formationSlot)) {
      const error = new Error('Each world team slot can only hold one demon.');
      error.status = 400;
      throw error;
    }

    seenSlots.add(formationSlot);

    return { demonId, formationSlot };
  });
}

async function assertWorldTeamDemonsBelongToPlayer(playerId, team = []) {
  if (!team.length) return;

  const ids = team.map((entry) => entry.demonId);
  const placeholders = ids.map(() => '?').join(', ');
  const [rows] = await db.query(
    `SELECT id
     FROM player_demons
     WHERE player_id = ?
       AND id IN (${placeholders})`,
    [playerId, ...ids]
  );
  const ownedIds = new Set(rows.map((row) => Number(row.id)));
  const missingId = ids.find((id) => !ownedIds.has(id));

  if (missingId) {
    const error = new Error('That demon is not in your collection.');
    error.status = 404;
    throw error;
  }
}

function normalizeWorldTeamSlot(slot) {
  const number = Number(slot);
  if (!Number.isInteger(number) || number < 0 || number >= WORLD_FORMATION_SLOT_COUNT) return null;
  return number;
}

function getActiveWorldTeamSummary(team = []) {
  return {
    source: team.length ? 'active-world-team' : 'none',
    count: team.length,
    members: team.map((demon) => ({
      instanceId: demon.instanceId || demon.id || null,
      species: demon.species || 'Demon',
      rarity: demon.rarity || 'common',
      hp: Number(demon.hp) || 0,
      atk: Number(demon.atk) || 0,
      speed: Number(demon.speed) || 0,
      imageUrl: demon.imageUrl || demon.image_url || ''
    }))
  };
}

async function simulateWorldAmbush(player, position, encounters = [], options = {}) {
  const targetEncounter = pickAmbushEncounter(position, encounters);
  if (!targetEncounter) return null;
  const ambushEncounter = createAmbushEncounter(targetEncounter, position);

  return simulateWorldCombat({
    player,
    encounter: ambushEncounter,
    combatType: 'ambush',
    seed: getEngagementSeed(options.seed),
    context: options.context
  });
}

async function simulateTryHunt(player, encounter, options = {}) {
  return simulateWorldCombat({
    player,
    encounter,
    combatType: 'hunt_test',
    seed: getEngagementSeed(options.seed),
    context: options.context
  });
}

async function simulateWorldPvpChallenge(player, targetPlayer, options = {}) {
  const [playerTeam, targetTeam, playerBuffs, targetBuffs, demonTypes] = await Promise.all([
    getActiveWorldTeam(player.id),
    getActiveWorldTeam(targetPlayer.id),
    resolvePlayerCombatBuffState(player),
    resolvePlayerCombatBuffState(targetPlayer),
    getDemonTypes()
  ]);

  if (!playerTeam.length) {
    const error = new Error('Choose a world team before challenging another hunter.');
    error.status = 409;
    throw error;
  }

  if (!targetTeam.length) {
    const error = new Error('That hunter has no assigned world team.');
    error.status = 409;
    throw error;
  }

  const seed = getEngagementSeed(options.seed);
  const enemyTeam = mirrorWorldTeamForEnemySide(targetTeam);
  const result = simulateFight(createRng(seed), playerTeam, enemyTeam, {
    demonTypes,
    combatType: 'pvp_challenge',
    playerBuffs,
    enemyBuffs: targetBuffs
  });

  return {
    combatType: 'pvp_challenge',
    targetPlayer: serializeWorldPvpTarget(targetPlayer, targetTeam),
    ...serializeWorldCombatResult(result, playerBuffs, targetBuffs)
  };
}

async function simulateWorldBossChallenge(player, boss, options = {}) {
  const [playerTeam, playerBuffs, demonTypes] = await Promise.all([
    getActiveWorldTeam(player.id),
    resolvePlayerCombatBuffState(player),
    getDemonTypes()
  ]);

  if (!playerTeam.length) {
    const error = new Error('Choose a world team before challenging a boss.');
    error.status = 409;
    throw error;
  }

  if (!boss || !Array.isArray(boss.team) || !boss.team.length) {
    const error = new Error('World boss is not configured with an enemy team.');
    error.status = 500;
    throw error;
  }

  const seed = getEngagementSeed(options.seed);
  const enemyTeam = materializeEncounterTeam(boss, demonTypes);
  const enemyBuffs = normalizeCombatBuffState({
    activeBuffs: [
      ...createWorldTerrorBuffs(boss),
      ...createWorldBossEnemyBuffs(boss)
    ]
  });
  const result = simulateFight(createRng(seed), playerTeam, enemyTeam, {
    demonTypes,
    combatType: 'world_boss',
    playerBuffs,
    enemyBuffs
  });

  return {
    combatType: 'world_boss',
    boss: serializeWorldBossForClient(boss),
    rewardBuff: getWorldBossRewardBuff(boss),
    encounter: serializeEncounter(boss),
    ...serializeWorldCombatResult(result, playerBuffs, enemyBuffs)
  };
}

async function createHuntSnapshot(player, encounter, options = {}) {
  const [playerTeam, statSummary, demonTypes, activeBossBuffs] = await Promise.all([
    Array.isArray(options.playerTeam) ? options.playerTeam : getActiveWorldTeam(player.id),
    options.statSummary || getPlayerStatPointSummary(player),
    options.demonTypes || getDemonTypes(),
    Array.isArray(options.activeBossBuffs)
      ? options.activeBossBuffs
      : getActiveWorldRewardBuffs(player)
  ]);
  const playerBuffs = createPlayerCombatBuffState(statSummary, { activeBuffs: activeBossBuffs });
  const soulCapacity = getBuffedHuntSoulCapacity(statSummary, activeBossBuffs);
  const enemyTeam = materializeEncounterTeam(encounter, demonTypes);
  const enemyBuffs = normalizeCombatBuffState({
    activeBuffs: createWorldTerrorBuffs(encounter)
  });
  const now = new Date();

  if (!playerTeam.length) {
    const error = new Error('Choose a hunting team before starting a hunt.');
    error.status = 409;
    throw error;
  }

  // Keep this seed with the snapshot so its sample battle remains reproducible,
  // while a newly started hunt gets a fresh set of chaotic damage rolls.
  const seed = getEngagementSeed(options.seed);
  const result = simulateFight(
    createRng(seed),
    playerTeam,
    enemyTeam,
    {
      demonTypes,
      combatType: 'hunt_test',
      playerBuffs,
      enemyBuffs
    }
  );

  if (result.winner !== 'player') {
    const error = new Error('Win a fight before starting passive hunting.');
    error.status = 409;
    throw error;
  }

  const battleMetrics = createHuntBattleMetrics(result, enemyTeam);
  const xpReward = getWorldXpReward(encounter);
  const soulReward = getWorldSoulReward(encounter, battleMetrics.defeatedDemons);
  const terror = getWorldTerrorPreview(encounter);

  return {
    combatType: 'passive_hunt',
    encounterId: encounter.id,
    encounter: serializeEncounter(encounter),
    activeTeam: playerTeam,
    targetEnemyTeam: enemyTeam,
    activeSkillTreeBuffs: serializeCombatBuffState(playerBuffs).activeBuffs,
    activeWorldTerrorBuffs: serializeCombatBuffState(enemyBuffs).activeBuffs,
    startedAt: now.toISOString(),
    killSeconds: battleMetrics.killSeconds,
    enemyRespawnSeconds: battleMetrics.killSeconds,
    xpPerCycle: xpReward.xpPerCycle,
    soulsPerCycle: soulReward.soulsPerCycle,
    defeatedDemonsPerCycle: battleMetrics.defeatedDemons,
    soulCapacity,
    xpReward,
    soulReward,
    terror,
    battleMetrics,
    seed
  };
}

// World-boss rewards can temporarily expand the Soul Vessel. Multipliers
// stack multiplicatively, matching the rest of the combat-buff system.
function getBuffedHuntSoulCapacity(statSummary = {}, buffs = []) {
  const baseCapacity = getHuntSoulCapacity(statSummary);
  const state = normalizeCombatBuffState(Array.isArray(buffs)
    ? { activeBuffs: buffs }
    : buffs);
  const multiplier = state.activeBuffs
    .flatMap((buff) => buff.effects || [])
    .filter((effect) => effect.type === 'soul_capacity_mult')
    .reduce((product, effect) => product * positiveNumber(effect.value, 1), 1);

  return Math.max(1, Math.floor(baseCapacity * multiplier));
}

async function calculateHuntRewards(snapshot, stoppedAt = new Date(), options = {}) {
  const startedAt = Date.parse(snapshot?.startedAt || '');
  const stoppedTime = stoppedAt instanceof Date ? stoppedAt.getTime() : Date.parse(stoppedAt || '');
  const killSeconds = getHuntKillSeconds(snapshot);
  const elapsedSeconds = Math.max(0, Math.floor(((Number(stoppedTime) || Date.now()) - (startedAt || Date.now())) / 1000));
  // Cycles are uncapped: XP accrues for the whole hunt, while soul income is
  // bounded by the Soul Vessel capacity below.
  const cycles = Math.floor(elapsedSeconds / killSeconds);
  const xpPerCycle = getSnapshotXpPerCycle(snapshot);
  const fallbackSoulsPerCycle = getSnapshotSoulsPerCycle(snapshot);
  const soulCapacity = getSnapshotSoulCapacity(snapshot, options.soulCapacity);

  if (!cycles || !Array.isArray(snapshot?.activeTeam) || !Array.isArray(snapshot?.targetEnemyTeam)) {
    return {
      elapsedSeconds,
      killSeconds,
      cycles: 0,
      wins: 0,
      xpPerCycle,
      soulsPerCycle: fallbackSoulsPerCycle,
      defeatedDemonsPerCycle: fallbackSoulsPerCycle,
      xp: 0,
      souls: 0,
      soulCapacity: Number.isFinite(soulCapacity) ? soulCapacity : null,
      soulsLost: 0
    };
  }

  const demonTypes = await getDemonTypes();
  const playerBuffs = normalizeCombatBuffState({
    activeBuffs: snapshot.activeSkillTreeBuffs || []
  });
  const enemyBuffs = normalizeCombatBuffState({
    activeBuffs: snapshot.activeWorldTerrorBuffs || []
  });
  const result = simulateFight(
    createRng(Number(snapshot.seed) || 1),
    snapshot.activeTeam,
    snapshot.targetEnemyTeam,
    {
      demonTypes,
      combatType: 'passive_hunt',
      playerBuffs,
      enemyBuffs
    }
  );
  const wins = result.winner === 'player' ? cycles : 0;
  const defeatedDemonsPerCycle = result.winner === 'player'
    ? getDefeatedEnemyCount(result, snapshot.targetEnemyTeam)
    : 0;
  const soulsPerCycle = result.winner === 'player'
    ? getWorldSoulReward(snapshot.encounter, defeatedDemonsPerCycle, snapshot.soulReward).soulsPerCycle
    : fallbackSoulsPerCycle;

  const uncappedSouls = wins * soulsPerCycle;
  const souls = Math.min(uncappedSouls, soulCapacity);

  return {
    elapsedSeconds,
    killSeconds,
    cycles,
    wins,
    xpPerCycle,
    soulsPerCycle,
    defeatedDemonsPerCycle,
    xp: wins > 0 ? Math.max(1, Math.floor(wins * xpPerCycle * PASSIVE_HUNT_XP_MULTIPLIER)) : 0,
    souls,
    soulCapacity: Number.isFinite(soulCapacity) ? soulCapacity : null,
    soulsLost: Math.max(0, uncappedSouls - souls),
    sampleBattle: serializeWorldCombatResult(result, playerBuffs, enemyBuffs)
  };
}

async function resolveWorldCombatContext(player, options = {}) {
  const [playerTeam, playerBuffs, demonTypes] = await Promise.all([
    Array.isArray(options.playerTeam) ? options.playerTeam : getActiveWorldTeam(player.id),
    options.playerBuffs || resolvePlayerCombatBuffState(player),
    options.demonTypes || getDemonTypes()
  ]);

  return { playerTeam, playerBuffs, demonTypes };
}

async function simulateWorldCombat({ player, encounter, combatType, seed, context = null }) {
  const { playerTeam, playerBuffs, demonTypes } = context || await resolveWorldCombatContext(player);

  if (!playerTeam.length) {
    const error = new Error('Choose a hunting team before entering combat.');
    error.status = 409;
    throw error;
  }

  const enemyTeam = materializeEncounterTeam(encounter, demonTypes);
  const enemyBuffs = normalizeCombatBuffState({
    activeBuffs: createWorldTerrorBuffs(encounter)
  });
  const result = simulateFight(createRng(seed || 1), playerTeam, enemyTeam, {
    demonTypes,
    combatType,
    playerBuffs,
    enemyBuffs
  });

  return {
    encounter: serializeEncounter(encounter),
    ...serializeWorldCombatResult(result, playerBuffs, enemyBuffs)
  };
}

function serializeWorldCombatResult(result, playerBuffs, enemyBuffs) {
  return {
    winner: result.winner,
    endReason: result.endReason,
    ticks: result.ticks,
    combatLog: result.combatLog,
    playerTeamBefore: result.playerTeamBefore,
    enemyTeamBefore: result.enemyTeamBefore,
    playerTeamAfter: result.playerTeam,
    enemyTeamAfter: result.enemyTeam,
    playerBuffs: serializeCombatBuffState(playerBuffs).activeBuffs,
    enemyBuffs: serializeCombatBuffState(enemyBuffs).activeBuffs
  };
}

function mirrorWorldTeamForEnemySide(team = []) {
  return assignFormationSlots(team.map((demon, index) => ({
    ...demon,
    instanceId: demon.instanceId || `pvp-enemy-${demon.collectionDemonId || demon.id || index + 1}`,
    formationSlot: mirrorFormationSlot(demon.formationSlot ?? demon.formationRow),
    formationRow: mirrorFormationSlot(demon.formationSlot ?? demon.formationRow)
  })), 'enemy');
}

function mirrorFormationSlot(slot) {
  const normalizedSlot = normalizeWorldTeamSlot(slot);
  if (normalizedSlot === null) return null;

  const row = Math.floor(normalizedSlot / 3);
  const column = normalizedSlot % 3;
  return row * 3 + (2 - column);
}

function serializeWorldPvpTarget(player = {}, team = []) {
  return {
    id: player.id,
    username: player.username || 'Unknown Hunter',
    level: Math.max(1, Number(player.level) || 1),
    pvpWins: Math.max(0, Number(player.pvpWins ?? player.pvp_wins) || 0),
    pvpLosses: Math.max(0, Number(player.pvpLosses ?? player.pvp_losses) || 0),
    teamCount: Array.isArray(team) ? team.length : 0,
    profileDemonImageUrl: player.profileDemonImageUrl || null
  };
}

function materializeEncounterTeam(encounter, demonTypes = {}) {
  const team = (Array.isArray(encounter?.team) ? encounter.team : []).map((member, index) => {
    const typeId = Number(member.typeId || member.type_id || member.type) || 1;
    const type = demonTypes[String(typeId)] || {};
    const rarity = String(member.rarity || 'common').toLowerCase();
    const rarityMult = positiveNumber(type.rarityMultiplier?.[rarity], 1);
    const eliteMult = member.elite ? 1.14 : 1;
    const hp = scaleStat(getBaseStat(type, 'hp', 80), rarityMult * eliteMult);
    const atk = scaleStat(getBaseStat(type, 'atk', 10), rarityMult * eliteMult);
    const speed = scaleStat(getBaseStat(type, 'speed', 8), rarityMult);

    return {
      instanceId: member.instanceId || `${encounter.id || 'encounter'}-enemy-${index + 1}`,
      typeId,
      species: member.species || type.name || 'Demon',
      role: member.role || type.role || '',
      rarity,
      imageUrl: member.imageUrl || member.image_url || '',
      maxHp: hp,
      hp,
      atk,
      speed,
      position: member.position || type.preferredPosition || (index === 0 ? 'front' : 'back'),
      ...(normalizeWorldTeamSlot(member.formationSlot ?? member.formationRow) !== null
        ? {
          formationSlot: normalizeWorldTeamSlot(member.formationSlot ?? member.formationRow),
          formationRow: normalizeWorldTeamSlot(member.formationSlot ?? member.formationRow)
        }
        : {}),
      attackMeter: 0,
      statusEffects: {
        poison: []
      }
    };
  });

  return assignFormationSlots(team, 'enemy');
}

function pickAmbushEncounter(position, encounters = []) {
  const available = (encounters || []).filter((encounter) => Array.isArray(encounter.team) && encounter.team.length);
  if (!available.length) return null;

  return [...available].sort((a, b) => (
    getDistance(position, a) - getDistance(position, b) ||
    String(a.id).localeCompare(String(b.id))
  ))[0];
}

function createAmbushEncounter(encounter = {}, position = {}) {
  return {
    ...encounter,
    sourceEncounterId: encounter.id || null,
    x: Number(position.x) || 0,
    y: Number(position.y) || 0
  };
}

function serializeEncounter(encounter = {}) {
  return {
    id: encounter.id,
    x: Number(encounter.x) || 0,
    y: Number(encounter.y) || 0,
    keyDemon: encounter.keyDemon || null,
    terror: getWorldTerrorPreview(encounter),
    xpReward: getWorldXpReward(encounter),
    soulReward: getWorldSoulReward(encounter, Array.isArray(encounter.team) ? encounter.team.length : 0),
    enemyRespawnSeconds: getEnemyRespawnSeconds(encounter)
  };
}

function getEnemyRespawnSeconds(encounter = {}) {
  const explicit = Number(encounter.enemyRespawnSeconds || encounter.respawnSeconds);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  return DEFAULT_ENEMY_RESPAWN_SECONDS;
}

function createHuntBattleMetrics(result = {}, enemyTeam = []) {
  return {
    winner: result.winner || 'enemy',
    endReason: result.endReason || null,
    ticks: Math.max(0, Number(result.ticks) || 0),
    combatLogSteps: Array.isArray(result.combatLog) ? result.combatLog.length : 0,
    killSeconds: getBattlePlaybackSeconds(result),
    defeatedDemons: getDefeatedEnemyCount(result, enemyTeam)
  };
}

function getBattlePlaybackSeconds(result = {}) {
  const combatLogSteps = Array.isArray(result.combatLog) ? result.combatLog.length : 0;
  const fallbackTicks = Math.max(1, Math.ceil(Number(result.ticks) || 1));
  const playbackSteps = combatLogSteps > 0 ? combatLogSteps : fallbackTicks;
  return Math.max(1, Math.ceil((playbackSteps * WORLD_BATTLE_REPLAY_STEP_MS) / 1000));
}

function getDefeatedEnemyCount(result = {}, fallbackEnemyTeam = []) {
  const enemyTeam = Array.isArray(result.enemyTeam) ? result.enemyTeam : [];
  const defeated = enemyTeam.filter((demon) => Number(demon.hp) <= 0).length;
  if (defeated > 0) return defeated;
  if (result.winner === 'player' && Array.isArray(fallbackEnemyTeam)) return fallbackEnemyTeam.length;
  return 0;
}

// Vessel points spent (or reset) mid-hunt apply immediately: the player's
// live capacity wins over the value snapshotted at hunt start, which only
// covers callers that don't pass a live capacity.
function getSnapshotSoulCapacity(snapshot = {}, liveCapacity) {
  const live = Number(liveCapacity);
  if (Number.isFinite(live) && live > 0) return Math.floor(live);
  const snapshotted = Number(snapshot.soulCapacity);
  if (Number.isFinite(snapshotted) && snapshotted > 0) return Math.floor(snapshotted);
  return Infinity;
}

function getHuntKillSeconds(snapshot = {}) {
  const explicit = Number(snapshot.killSeconds ?? snapshot.enemyRespawnSeconds);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  return DEFAULT_ENEMY_RESPAWN_SECONDS;
}

function getSnapshotXpPerCycle(snapshot = {}) {
  if (snapshot?.encounter) {
    return getWorldXpReward(snapshot.encounter, snapshot.xpReward).xpPerCycle;
  }

  const explicit = Number(snapshot.xpPerCycle ?? snapshot.xpPerKill);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.round(explicit);
  return getWorldXpReward(snapshot.encounter, snapshot.xpReward).xpPerCycle;
}

function getSnapshotSoulsPerCycle(snapshot = {}) {
  const defeated = Number(snapshot.defeatedDemonsPerCycle ?? snapshot.soulReward?.baseSouls);
  if (Number.isFinite(defeated) && defeated >= 0) return Math.floor(defeated);

  const explicit = Number(snapshot.soulsPerCycle ?? snapshot.soulsPerKill ?? snapshot.defeatedDemonsPerCycle);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
  if (snapshot.soulReward) {
    const soulReward = getWorldSoulReward(snapshot.encounter, snapshot.defeatedDemonsPerCycle, snapshot.soulReward);
    if (Number.isFinite(Number(soulReward.soulsPerCycle))) return soulReward.soulsPerCycle;
  }
  if (Array.isArray(snapshot.targetEnemyTeam)) return snapshot.targetEnemyTeam.length;
  return Math.max(1, Array.isArray(snapshot?.encounter?.team) ? snapshot.encounter.team.length : 1);
}

function createWorldTerrorBuffs(encounter = {}) {
  const terror = getWorldTerrorPreview(encounter);
  if (!terror.active) return [];

  return [{
    id: `world_terror_${terror.level}`,
    name: `Terror ${terror.level}`,
    description: [
      'Demons grow stronger farther from the center.',
      `Enemy HP +${terror.hpBonusPct}%`,
      `Enemy Attack +${terror.atkBonusPct}%`,
      `Enemy Speed +${terror.speedBonusPct}%`
    ].join(' '),
    rarity: terror.level >= 10 ? 'rare' : 'uncommon',
    icon: 'flame',
    source: 'world',
    tags: ['World', 'Terror'],
    effects: [
      { type: 'max_hp_mult', value: terror.hpMult },
      { type: 'attack_mult', value: terror.atkMult },
      { type: 'speed_mult', value: terror.speedMult }
    ]
  }];
}

function getWorldTerrorPreview(encounter = {}) {
  const level = getWorldTerrorLevel(encounter);
  const pressure = getEnemyPressureMultipliers(DUNGEON_TERROR_START_FLOOR + level, { terrorScaling: 'linear' });

  return {
    level,
    distance: roundNumber(getWorldTerrorDistance(encounter), 1),
    hpMult: roundMultiplier(pressure.hp),
    atkMult: roundMultiplier(pressure.atk),
    speedMult: roundMultiplier(pressure.speed),
    hpBonusPct: getBonusPercent(pressure.hp),
    atkBonusPct: getBonusPercent(pressure.atk),
    speedBonusPct: getBonusPercent(pressure.speed),
    active: level > 0
  };
}

function getWorldTerrorLevel(encounter = {}) {
  return clamp(Math.floor(getWorldTerrorDistance(encounter) - WORLD_TERROR_START_DISTANCE), 0, WORLD_TERROR_MAX_LEVEL);
}

function getWorldSoulReward(encounter = {}, defeatedDemons = 0, fallback = {}) {
  const baseSouls = Math.max(0, Math.floor(Number(defeatedDemons) || Number(fallback.baseSouls) || 0));
  const soulsPerCycle = baseSouls > 0
    ? baseSouls
    : Math.max(0, Math.floor(Number(fallback.soulsPerCycle) || 0));

  return {
    baseSouls,
    soulsPerCycle
  };
}

function getWorldXpReward(encounter = {}, fallback = {}) {
  const teamSize = Array.isArray(encounter?.team)
    ? encounter.team.length
    : Math.max(1, Number(fallback.teamSize) || 1);
  const baseXp = Math.max(0, Math.round(Number(fallback.baseXp) || (5 + teamSize * 2)));
  const terrorLevel = getWorldTerrorLevel(encounter);
  const terrorFactor = clamp(terrorLevel / WORLD_TERROR_MAX_LEVEL, 0, 1);
  const terrorMultiplier = 1 + Math.pow(terrorFactor, 1.4) * WORLD_TERROR_XP_MULTIPLIER_BONUS;

  return {
    baseXp,
    teamSize,
    xpPerCycle: Math.ceil(baseXp * terrorMultiplier),
    terrorLevel,
    terrorFactor: roundNumber(terrorFactor, 3),
    terrorMultiplier: roundMultiplier(terrorMultiplier)
  };
}

function getWorldTerrorDistance(encounter = {}) {
  return Math.max(Math.abs(Number(encounter?.x) || 0), Math.abs(Number(encounter?.y) || 0));
}

function roundMultiplier(value) {
  return Math.round((Number(value) || 1) * 1000) / 1000;
}

function getBonusPercent(value) {
  return Math.max(0, Math.round(((Number(value) || 1) - 1) * 100));
}

function roundNumber(value, precision = 0) {
  const factor = 10 ** Math.max(0, Number(precision) || 0);
  return Math.round((Number(value) || 0) * factor) / factor;
}

function getBaseStat(type, key, fallback) {
  const range = type?.baseStats?.[key];
  if (!Array.isArray(range) || !range.length) return fallback;
  const min = Number(range[0]) || fallback;
  const max = Number(range[1]) || min;
  return (min + max) / 2;
}

function scaleStat(value, multiplier) {
  return Math.max(1, Math.round((Number(value) || 1) * positiveNumber(multiplier, 1)));
}

function positiveNumber(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function getDistance(a = {}, b = {}) {
  return Math.abs(Number(a.x) - Number(b.x)) + Math.abs(Number(a.y) - Number(b.y));
}

function hashSeed(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

function getEngagementSeed(seed) {
  if (seed !== undefined && seed !== null) {
    return (Number(seed) >>> 0) || 1;
  }

  return crypto.randomInt(1, 0x100000000);
}

module.exports = {
  PASSIVE_HUNT_XP_MULTIPLIER,
  calculateHuntRewards,
  createWorldTeamStatPreviews,
  createHuntSnapshot,
  getActiveWorldTeam,
  getActiveWorldTeamSummary,
  getBuffedHuntSoulCapacity,
  getEnemyRespawnSeconds,
  getWorldTeamStatPreviews,
  getWorldSoulReward,
  getWorldTerrorPreview,
  getWorldXpReward,
  materializeEncounterTeam,
  resolveWorldCombatContext,
  saveActiveWorldTeam,
  simulateTryHunt,
  simulateWorldAmbush,
  simulateWorldBossChallenge,
  simulateWorldPvpChallenge
};
