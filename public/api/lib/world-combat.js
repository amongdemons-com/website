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
  normalizeCombatBuffState,
  serializeCombatBuffState
} = require('./combat-buffs');
const { resolvePlayerCombatBuffState } = require('./player-combat-buffs');

const HUNT_REWARD_CYCLE_CAP = 288;
const DEFAULT_ENEMY_RESPAWN_SECONDS = 300;
const WORLD_TEAM_LIMIT = 6;
const WORLD_FORMATION_SLOT_COUNT = 9;

async function getActiveWorldTeam(playerId) {
  const savedRows = await getSavedWorldTeamRows(playerId);

  return materializeWorldTeamRows(savedRows);
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
  for (const row of rows) {
    const demon = await createRunDemonFromCollection(row, `world-collection-${row.id}`);
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

  const seenDemons = new Set();
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

    if (seenDemons.has(demonId)) {
      const error = new Error('Each demon can only appear once in your world team.');
      error.status = 400;
      throw error;
    }

    if (seenSlots.has(formationSlot)) {
      const error = new Error('Each world team slot can only hold one demon.');
      error.status = 400;
      throw error;
    }

    seenDemons.add(demonId);
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
    members: team.slice(0, 4).map((demon) => ({
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

async function simulateWorldAmbush(player, position, encounters = []) {
  const targetEncounter = pickAmbushEncounter(position, encounters);
  if (!targetEncounter) return null;

  return simulateWorldCombat({
    player,
    encounter: targetEncounter,
    combatType: 'ambush',
    seed: hashSeed(`ambush:${player.id}:${position.x}:${position.y}:${targetEncounter.id}`)
  });
}

async function simulateTryHunt(player, encounter) {
  return simulateWorldCombat({
    player,
    encounter,
    combatType: 'hunt_test',
    seed: hashSeed(`hunt-test:${player.id}:${encounter.id}`)
  });
}

async function createHuntSnapshot(player, encounter) {
  const [playerTeam, playerBuffs, demonTypes] = await Promise.all([
    getActiveWorldTeam(player.id),
    resolvePlayerCombatBuffState(player),
    getDemonTypes()
  ]);
  const enemyTeam = materializeEncounterTeam(encounter, demonTypes);
  const now = new Date();

  if (!playerTeam.length) {
    const error = new Error('Choose a hunting team before starting a hunt.');
    error.status = 409;
    throw error;
  }

  return {
    combatType: 'passive_hunt',
    encounterId: encounter.id,
    encounter: serializeEncounter(encounter),
    activeTeam: playerTeam,
    targetEnemyTeam: enemyTeam,
    activeSkillTreeBuffs: serializeCombatBuffState(playerBuffs).activeBuffs,
    startedAt: now.toISOString(),
    enemyRespawnSeconds: getEnemyRespawnSeconds(encounter),
    seed: hashSeed(`passive-hunt:${player.id}:${encounter.id}:${now.toISOString()}`)
  };
}

async function calculateHuntRewards(snapshot, stoppedAt = new Date()) {
  const startedAt = Date.parse(snapshot?.startedAt || '');
  const stoppedTime = stoppedAt instanceof Date ? stoppedAt.getTime() : Date.parse(stoppedAt || '');
  const respawnSeconds = Math.max(1, Number(snapshot?.enemyRespawnSeconds) || DEFAULT_ENEMY_RESPAWN_SECONDS);
  const elapsedSeconds = Math.max(0, Math.floor(((Number(stoppedTime) || Date.now()) - (startedAt || Date.now())) / 1000));
  const cycles = Math.min(HUNT_REWARD_CYCLE_CAP, Math.floor(elapsedSeconds / respawnSeconds));

  if (!cycles || !Array.isArray(snapshot?.activeTeam) || !Array.isArray(snapshot?.targetEnemyTeam)) {
    return {
      elapsedSeconds,
      cycles: 0,
      wins: 0,
      xp: 0,
      souls: 0
    };
  }

  const demonTypes = await getDemonTypes();
  const playerBuffs = normalizeCombatBuffState({
    activeBuffs: snapshot.activeSkillTreeBuffs || []
  });
  const result = simulateFight(
    createRng(Number(snapshot.seed) || 1),
    snapshot.activeTeam,
    snapshot.targetEnemyTeam,
    {
      demonTypes,
      combatType: 'passive_hunt',
      playerBuffs
    }
  );
  const wins = result.winner === 'player' ? cycles : 0;
  const difficulty = Math.max(1, Number(snapshot.encounter?.difficulty) || 1);

  return {
    elapsedSeconds,
    cycles,
    wins,
    xp: wins * (5 + difficulty * 2),
    souls: wins * Math.max(1, Math.ceil(difficulty / 2)),
    sampleBattle: serializeWorldCombatResult(result, playerBuffs, normalizeCombatBuffState())
  };
}

async function simulateWorldCombat({ player, encounter, combatType, seed }) {
  const [playerTeam, playerBuffs, demonTypes] = await Promise.all([
    getActiveWorldTeam(player.id),
    resolvePlayerCombatBuffState(player),
    getDemonTypes()
  ]);

  if (!playerTeam.length) {
    const error = new Error('Choose a hunting team before entering combat.');
    error.status = 409;
    throw error;
  }

  const enemyTeam = materializeEncounterTeam(encounter, demonTypes);
  const enemyBuffs = normalizeCombatBuffState();
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

function materializeEncounterTeam(encounter, demonTypes = {}) {
  const difficulty = Math.max(1, Number(encounter?.difficulty) || 1);
  const team = (Array.isArray(encounter?.team) ? encounter.team : []).map((member, index) => {
    const typeId = Number(member.typeId || member.type_id || member.type) || 1;
    const type = demonTypes[String(typeId)] || {};
    const rarity = String(member.rarity || 'common').toLowerCase();
    const rarityMult = positiveNumber(type.rarityMultiplier?.[rarity], 1);
    const difficultyMult = 1 + Math.max(0, difficulty - 1) * 0.08 + (member.elite ? 0.14 : 0);
    const hp = scaleStat(getBaseStat(type, 'hp', 80), rarityMult * difficultyMult);
    const atk = scaleStat(getBaseStat(type, 'atk', 10), rarityMult * difficultyMult);
    const speed = scaleStat(getBaseStat(type, 'speed', 8), rarityMult * (1 + Math.max(0, difficulty - 1) * 0.025));

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

function serializeEncounter(encounter = {}) {
  return {
    id: encounter.id,
    x: Number(encounter.x) || 0,
    y: Number(encounter.y) || 0,
    difficulty: Math.max(1, Number(encounter.difficulty) || 1),
    keyDemon: encounter.keyDemon || null,
    enemyRespawnSeconds: getEnemyRespawnSeconds(encounter)
  };
}

function getEnemyRespawnSeconds(encounter = {}) {
  const explicit = Number(encounter.enemyRespawnSeconds || encounter.respawnSeconds);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
  const difficulty = Math.max(1, Number(encounter.difficulty) || 1);
  return DEFAULT_ENEMY_RESPAWN_SECONDS + Math.max(0, difficulty - 1) * 60;
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

module.exports = {
  calculateHuntRewards,
  createHuntSnapshot,
  getActiveWorldTeam,
  getActiveWorldTeamSummary,
  getEnemyRespawnSeconds,
  materializeEncounterTeam,
  saveActiveWorldTeam,
  simulateTryHunt,
  simulateWorldAmbush
};
