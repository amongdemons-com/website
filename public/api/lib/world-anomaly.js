const crypto = require('node:crypto');
const db = require('./db');
const { cleanPlayer } = require('./auth');
const { simulateFight } = require('./combat');
const { normalizeCombatBuffState, serializeCombatBuffState } = require('./combat-buffs');
const { addEcho } = require('./echo-bag');
const { getDemonTypes } = require('./game-data');
const { resolvePlayerCombatBuffState } = require('./player-combat-buffs');
const { createRng } = require('./rng');
const { mergeBattleTeamForRun } = require('./run-demons');
const { getActiveWorldTeam } = require('./world-combat');

const ANOMALY_EVENT_ID = 'altar-of-many-voices';
const ANOMALY_EVENT_NAME = 'Altar of Many Voices';
const ANOMALY_NAME = 'The Anomaly';
const ANOMALY_X = 4;
const ANOMALY_Y = 0;
const ANOMALY_SOUL_COST = 5_000;
const ANOMALY_MAX_FLOOR = 9;
const ANOMALY_ECHO_CHANCE_PERCENT = 25;
const ANOMALY_STATS = Object.freeze({ hp: 5_000, atk: 150, speed: 20 });
const ANOMALY_ABILITY_TYPE_IDS = Object.freeze(Array.from({ length: 11 }, (_, index) => index + 1));
const ANOMALY_FORMATION_SLOTS = Object.freeze([3, 0, 6, 4, 1, 7, 5, 2, 8]);
const ANOMALY_IMAGE_URL = '/app/images/demons/anomaly.webp?v=art-df103bc9b9a9';
const ANOMALY_ACCENT_COLOR = '#a74fe0';
const ANOMALY_RITUAL_ID_PATTERN = /^ritual:[0-9a-f-]{36}$/i;

function isAtAnomalyAltar(position = {}) {
  return Number(position.x) === ANOMALY_X && Number(position.y) === ANOMALY_Y;
}

function createAnomalyRitualId() {
  return `ritual:${crypto.randomUUID()}`;
}

function normalizeAnomalyRitualId(value) {
  const ritualId = String(value || '').trim();
  return ANOMALY_RITUAL_ID_PATTERN.test(ritualId) ? ritualId : '';
}

function createAnomalyEnemy(index = 0, count = 1) {
  const enemyCount = Math.max(1, Math.min(ANOMALY_MAX_FLOOR, Math.floor(Number(count) || 1)));
  const enemyIndex = Math.max(0, Math.min(enemyCount - 1, Math.floor(Number(index) || 0)));
  const formationSlot = ANOMALY_FORMATION_SLOTS[enemyIndex];

  return {
    instanceId: enemyCount === 1 ? 'the-anomaly' : `the-anomaly-${enemyIndex + 1}`,
    typeId: 12,
    abilityTypeIds: [...ANOMALY_ABILITY_TYPE_IDS],
    species: ANOMALY_NAME,
    role: 'anomaly',
    rarity: '',
    hideRarity: true,
    accentColor: ANOMALY_ACCENT_COLOR,
    imageUrl: ANOMALY_IMAGE_URL,
    portraitImageUrl: ANOMALY_IMAGE_URL,
    maxHp: ANOMALY_STATS.hp,
    hp: ANOMALY_STATS.hp,
    atk: ANOMALY_STATS.atk,
    speed: ANOMALY_STATS.speed,
    retaliationAbilityTypeId: 8,
    healMaxHpPercent: 5,
    position: formationSlot % 3 === 0 ? 'front' : 'back',
    formationSlot,
    formationRow: formationSlot,
    attackMeter: 0,
    shield: 0,
    statusEffects: { poison: [] }
  };
}

function createAnomalyFloorEnemies(floor = 1) {
  const enemyCount = Math.max(1, Math.min(ANOMALY_MAX_FLOOR, Math.floor(Number(floor) || 1)));
  return Array.from(
    { length: enemyCount },
    (item, index) => createAnomalyEnemy(index, enemyCount)
  );
}

function serializeAnomalyBoss() {
  return {
    id: ANOMALY_EVENT_ID,
    title: ANOMALY_NAME,
    imageUrl: ANOMALY_IMAGE_URL,
    accentColor: ANOMALY_ACCENT_COLOR,
    stats: { ...ANOMALY_STATS }
  };
}

async function getWorldAnomalyForPlayer(playerId, options = {}) {
  const queryable = options.queryable || db;
  const position = options.position || null;
  const [rows] = await queryable.query(
    `SELECT attempts,
            victories,
            losses,
            active_run_id AS activeRunId,
            active_floor AS activeFloor
     FROM player_anomaly_rituals
     WHERE player_id = ?
     LIMIT 1`,
    [playerId]
  );

  return serializeAnomalyState(rows[0], {
    canSummon: isAtAnomalyAltar(position),
    ritualId: createAnomalyRitualId()
  });
}

function serializeAnomalyState(row = {}, options = {}) {
  const attempts = Math.max(0, Number(row?.attempts) || 0);
  const activeRunId = normalizeAnomalyRitualId(row?.activeRunId);
  const activeFloor = activeRunId
    ? Math.max(1, Math.min(ANOMALY_MAX_FLOOR - 1, Number(row?.activeFloor) || 1))
    : 0;
  const state = {
    id: ANOMALY_EVENT_ID,
    eventName: ANOMALY_EVENT_NAME,
    x: ANOMALY_X,
    y: ANOMALY_Y,
    price: ANOMALY_SOUL_COST,
    canSummon: Boolean(options.canSummon) && !activeRunId,
    ritualId: options.ritualId || createAnomalyRitualId(),
    revealed: attempts > 0,
    attempts,
    victories: Math.max(0, Number(row?.victories) || 0),
    losses: Math.max(0, Number(row?.losses) || 0),
    maxFloor: ANOMALY_MAX_FLOOR,
    echoChancePercent: ANOMALY_ECHO_CHANCE_PERCENT
  };

  if (activeRunId) {
    state.activeRun = {
      id: activeRunId,
      floor: activeFloor,
      maxFloor: ANOMALY_MAX_FLOOR
    };
  }
  if (state.revealed) state.bossName = ANOMALY_NAME;
  return state;
}

function resolveAnomalyReward(options = {}) {
  const randomInt = options.randomInt || crypto.randomInt;
  const candidateTypeIds = normalizeAnomalyRewardTypeIds(options.candidateTypeIds);
  const echoAwarded = randomInt(100) < ANOMALY_ECHO_CHANCE_PERCENT;

  return {
    echoAwarded,
    source: 'chance',
    typeId: echoAwarded ? candidateTypeIds[randomInt(candidateTypeIds.length)] : null,
    chancePercent: ANOMALY_ECHO_CHANCE_PERCENT
  };
}

function resolveAnomalyRewardRolls(anomalyCount = 1, options = {}) {
  const rollCount = Math.max(1, Math.min(
    ANOMALY_MAX_FLOOR,
    Math.floor(Number(anomalyCount) || 1)
  ));
  const preferredTypeIds = normalizePreferredAnomalyRewardTypeIds(options.candidateTypeIds);
  let candidateTypeIds = preferredTypeIds.length
    ? [...preferredTypeIds]
    : [...ANOMALY_ABILITY_TYPE_IDS];
  let prioritizingMissingSpecies = preferredTypeIds.length > 0;

  return Array.from({ length: rollCount }, (item, index) => {
    const reward = resolveAnomalyReward({
      randomInt: options.randomInt,
      candidateTypeIds
    });

    if (reward.echoAwarded && prioritizingMissingSpecies) {
      candidateTypeIds = candidateTypeIds.filter((typeId) => typeId !== reward.typeId);
      if (!candidateTypeIds.length) {
        candidateTypeIds = [...ANOMALY_ABILITY_TYPE_IDS];
        prioritizingMissingSpecies = false;
      }
    }

    return { roll: index + 1, ...reward };
  });
}

function normalizePreferredAnomalyRewardTypeIds(typeIds) {
  const validTypeIds = new Set(ANOMALY_ABILITY_TYPE_IDS);
  return [...new Set(
    (Array.isArray(typeIds) ? typeIds : [])
      .map(Number)
      .filter((typeId) => validTypeIds.has(typeId))
  )];
}

function normalizeAnomalyRewardTypeIds(typeIds) {
  const candidates = normalizePreferredAnomalyRewardTypeIds(typeIds);

  return candidates.length ? candidates : [...ANOMALY_ABILITY_TYPE_IDS];
}

async function getUncollectedMythicTypeIds(playerId, queryable = db) {
  const [rows] = await queryable.query(
    `SELECT DISTINCT type_id AS typeId
     FROM player_demons
     WHERE player_id = ? AND LOWER(rarity) = 'mythic'`,
    [playerId]
  );
  const collectedTypeIds = new Set(rows.map((row) => Number(row.typeId)));

  return ANOMALY_ABILITY_TYPE_IDS.filter((typeId) => !collectedTypeIds.has(typeId));
}

async function summonWorldAnomaly(player, requestedRitualId, options = {}) {
  const ritualId = normalizeAnomalyRitualId(requestedRitualId);
  if (!ritualId) throw createHttpError('Begin a new ritual before making the offering.', 400);

  const [playerTeam, playerBuffs, demonTypes] = await Promise.all([
    options.playerTeam || getActiveWorldTeam(player.id),
    options.playerBuffs || resolvePlayerCombatBuffState(player),
    options.demonTypes || getDemonTypes()
  ]);
  if (!Array.isArray(playerTeam) || !playerTeam.length) {
    throw createHttpError('Choose a world team before making the offering.', 409);
  }

  const connection = options.connection || await db.getConnection();
  const ownsConnection = !options.connection;
  let committed = false;

  try {
    await connection.beginTransaction();
    const storedPlayer = await getStoredAnomalyPlayer(connection, player.id);
    await assertPlayerAtAnomalyAltar(connection, player.id);
    const ritual = await getLockedAnomalyRitual(connection, player.id);

    if (ritual.activeRunId) {
      throw createHttpError('Finish or leave your active Anomaly run before making another offering.', 409);
    }
    if (ritual.lastRitualId === ritualId) {
      throw createHttpError('That offering has already been consumed.', 409);
    }
    if (Number(storedPlayer.souls) < ANOMALY_SOUL_COST) {
      throw createHttpError(`You need ${ANOMALY_SOUL_COST.toLocaleString('en-US')} Souls for this offering.`, 409);
    }

    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [ANOMALY_SOUL_COST, player.id]
    );

    const floorResult = await resolveAnomalyFloor({
      playerId: player.id,
      floor: 1,
      playerTeam,
      playerBuffs,
      demonTypes,
      connection,
      options
    });
    const active = floorResult.won && floorResult.floor < ANOMALY_MAX_FLOOR;

    await connection.query(
      `UPDATE player_anomaly_rituals
       SET attempts = attempts + 1,
           victories = victories + ?,
           losses = losses + ?,
           last_ritual_id = ?,
           active_run_id = ?,
           active_floor = ?,
           active_team = ?,
           active_started_at = ?,
           updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?`,
      [
        floorResult.won ? 1 : 0,
        floorResult.won ? 0 : 1,
        ritualId,
        active ? ritualId : null,
        active ? floorResult.floor : 0,
        active ? JSON.stringify(floorResult.nextTeam) : null,
        active ? new Date() : null,
        player.id
      ]
    );

    await connection.commit();
    committed = true;
    const attempts = Math.max(0, Number(ritual.attempts) || 0) + 1;
    const victories = Math.max(0, Number(ritual.victories) || 0) + (floorResult.won ? 1 : 0);
    const losses = Math.max(0, Number(ritual.losses) || 0) + (floorResult.won ? 0 : 1);
    const updatedPlayer = cleanPlayer({
      ...storedPlayer,
      souls: Number(storedPlayer.souls) - ANOMALY_SOUL_COST
    });

    return createAnomalyFloorResponse({
      player: updatedPlayer,
      floorResult,
      runId: ritualId,
      active,
      attempts,
      victories,
      losses,
      canSummon: !active,
      chargedSouls: ANOMALY_SOUL_COST
    });
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function continueWorldAnomaly(player, requestedRunId, options = {}) {
  const runId = normalizeAnomalyRitualId(requestedRunId);
  if (!runId) throw createHttpError('That Anomaly run is no longer active.', 400);

  const [playerBuffs, demonTypes] = await Promise.all([
    options.playerBuffs || resolvePlayerCombatBuffState(player),
    options.demonTypes || getDemonTypes()
  ]);
  const connection = options.connection || await db.getConnection();
  const ownsConnection = !options.connection;
  let committed = false;

  try {
    await connection.beginTransaction();
    const storedPlayer = await getStoredAnomalyPlayer(connection, player.id);
    await assertPlayerAtAnomalyAltar(connection, player.id);
    const ritual = await getLockedAnomalyRitual(connection, player.id);
    if (ritual.activeRunId !== runId) {
      throw createHttpError('That Anomaly run is no longer active.', 409);
    }

    const clearedFloor = Math.max(1, Number(ritual.activeFloor) || 1);
    if (clearedFloor >= ANOMALY_MAX_FLOOR) {
      throw createHttpError('The ninth floor has already been cleared.', 409);
    }
    const playerTeam = parseAnomalyTeam(ritual.activeTeam);
    if (!playerTeam.length || !playerTeam.some((demon) => Number(demon.hp) > 0)) {
      throw createHttpError('Your locked Anomaly team can no longer continue.', 409);
    }

    const floorResult = await resolveAnomalyFloor({
      playerId: player.id,
      floor: clearedFloor + 1,
      playerTeam,
      playerBuffs,
      demonTypes,
      connection,
      options
    });
    const active = floorResult.won && floorResult.floor < ANOMALY_MAX_FLOOR;

    await connection.query(
      `UPDATE player_anomaly_rituals
       SET victories = victories + ?,
           losses = losses + ?,
           active_run_id = ?,
           active_floor = ?,
           active_team = ?,
           active_started_at = CASE WHEN ? IS NULL THEN NULL ELSE active_started_at END,
           updated_at = CURRENT_TIMESTAMP
      WHERE player_id = ?`,
      [
        floorResult.won ? 1 : 0,
        floorResult.won ? 0 : 1,
        active ? runId : null,
        active ? floorResult.floor : 0,
        active ? JSON.stringify(floorResult.nextTeam) : null,
        active ? runId : null,
        player.id
      ]
    );

    await connection.commit();
    committed = true;
    const attempts = Math.max(0, Number(ritual.attempts) || 0);
    const victories = Math.max(0, Number(ritual.victories) || 0) + (floorResult.won ? 1 : 0);
    const losses = Math.max(0, Number(ritual.losses) || 0) + (floorResult.won ? 0 : 1);

    return createAnomalyFloorResponse({
      player: cleanPlayer(storedPlayer),
      floorResult,
      runId,
      active,
      attempts,
      victories,
      losses,
      canSummon: !active,
      chargedSouls: 0
    });
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function leaveWorldAnomaly(playerId, requestedRunId, options = {}) {
  return endActiveAnomalyRun(playerId, requestedRunId, {
    ...options,
    countAsLoss: false
  });
}

async function abandonWorldAnomaly(playerId, requestedRunId = '', options = {}) {
  return endActiveAnomalyRun(playerId, requestedRunId, {
    ...options,
    countAsLoss: true,
    allowAnyActiveRun: !requestedRunId
  });
}

async function endActiveAnomalyRun(playerId, requestedRunId, options = {}) {
  const runId = requestedRunId ? normalizeAnomalyRitualId(requestedRunId) : '';
  if (requestedRunId && !runId) throw createHttpError('That Anomaly run is no longer active.', 400);
  const connection = options.connection || await db.getConnection();
  const ownsConnection = !options.connection;
  let committed = false;

  try {
    await connection.beginTransaction();
    const ritual = await getLockedAnomalyRitual(connection, playerId);
    const matches = Boolean(ritual.activeRunId) && (
      options.allowAnyActiveRun || ritual.activeRunId === runId
    );
    if (!matches) {
      if (runId && ritual.activeRunId && ritual.activeRunId !== runId) {
        throw createHttpError('That Anomaly run is no longer active.', 409);
      }
      await connection.commit();
      committed = true;
      return {
        ended: false,
        lost: false,
        anomaly: serializeAnomalyState(ritual, { canSummon: true })
      };
    }

    await connection.query(
      `UPDATE player_anomaly_rituals
       SET losses = losses + ?,
           active_run_id = NULL,
           active_floor = 0,
           active_team = NULL,
           active_started_at = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ?`,
      [options.countAsLoss ? 1 : 0, playerId]
    );
    await connection.commit();
    committed = true;

    return {
      ended: true,
      lost: Boolean(options.countAsLoss),
      runId: ritual.activeRunId,
      floor: Math.max(1, Number(ritual.activeFloor) || 1),
      anomaly: serializeAnomalyState({
        ...ritual,
        activeRunId: null,
        activeFloor: 0,
        losses: Math.max(0, Number(ritual.losses) || 0) + (options.countAsLoss ? 1 : 0)
      }, {
        canSummon: !options.countAsLoss,
        ritualId: createAnomalyRitualId()
      })
    };
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function resolveAnomalyFloor({
  playerId,
  floor,
  playerTeam,
  playerBuffs,
  demonTypes,
  connection,
  options
}) {
  const enemyBuffs = normalizeCombatBuffState({});
  const seed = options.seed ?? crypto.randomInt(1, 0x100000000);
  const floorTeam = resetAnomalyTeamForFloor(playerTeam);
  const fight = (options.simulateFight || simulateFight)(
    createRng((Number(seed) + Number(floor) * 2654435761) >>> 0),
    floorTeam,
    createAnomalyFloorEnemies(floor),
    {
      demonTypes,
      combatType: 'world_anomaly',
      playerBuffs,
      enemyBuffs
    }
  );
  const won = fight.winner === 'player';
  let reward = null;

  if (won) {
    const uncollectedMythicTypeIds = await getUncollectedMythicTypeIds(playerId, connection);
    const rewardRolls = resolveAnomalyRewardRolls(floor, {
      randomInt: options.randomInt || crypto.randomInt,
      candidateTypeIds: uncollectedMythicTypeIds
    });
    const echoes = [];
    for (const rewardRoll of rewardRolls) {
      if (!rewardRoll.echoAwarded) continue;
      const echo = await (options.addEcho || addEcho)(playerId, {
        typeId: rewardRoll.typeId,
        rarity: 'mythic'
      }, {
        queryable: connection,
        natural: true
      });
      echoes.push(echo);
    }
    reward = {
      floor,
      chancePercent: ANOMALY_ECHO_CHANCE_PERCENT,
      rolls: rewardRolls.length,
      successfulRolls: echoes.length,
      echoes,
      results: rewardRolls
    };
  }

  return {
    floor,
    won,
    reward,
    nextTeam: carryAnomalyTeamForward(floorTeam, fight.playerTeam),
    battle: {
      combatType: 'world_anomaly',
      floor,
      maxFloor: ANOMALY_MAX_FLOOR,
      boss: serializeAnomalyBoss(),
      winner: fight.winner,
      endReason: fight.endReason,
      ticks: fight.ticks,
      combatLog: fight.combatLog,
      playerTeamBefore: fight.playerTeamBefore,
      enemyTeamBefore: fight.enemyTeamBefore,
      playerTeamAfter: fight.playerTeam,
      enemyTeamAfter: fight.enemyTeam,
      playerBuffs: serializeCombatBuffState(playerBuffs).activeBuffs,
      enemyBuffs: serializeCombatBuffState(enemyBuffs).activeBuffs,
      anomalyReward: reward
    }
  };
}

function carryAnomalyTeamForward(sourceTeam, battleTeam) {
  return resetAnomalyTeamForFloor(mergeBattleTeamForRun(sourceTeam, battleTeam));
}

function resetAnomalyTeamForFloor(team) {
  return (Array.isArray(team) ? team : []).map((demon) => ({
    ...demon,
    hp: Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1),
    attackMeter: 0,
    shield: 0,
    statusEffects: {
      ...(demon.statusEffects || {}),
      poison: []
    }
  }));
}

function createAnomalyFloorResponse({
  player,
  floorResult,
  runId,
  active,
  attempts,
  victories,
  losses,
  canSummon,
  chargedSouls
}) {
  const status = floorResult.won
    ? active ? 'awaiting_choice' : 'completed'
    : 'defeated';
  const anomalyRun = {
    id: runId,
    floor: floorResult.floor,
    maxFloor: ANOMALY_MAX_FLOOR,
    status,
    canContinue: active,
    canLeave: active
  };
  const battle = {
    ...floorResult.battle,
    anomalyRun
  };

  return {
    player,
    anomaly: serializeAnomalyState({
      attempts,
      victories,
      losses,
      activeRunId: active ? runId : null,
      activeFloor: active ? floorResult.floor : 0
    }, {
      canSummon,
      ritualId: createAnomalyRitualId()
    }),
    anomalyRun,
    battle,
    reward: floorResult.reward,
    chargedSouls
  };
}

async function getStoredAnomalyPlayer(connection, playerId) {
  const [rows] = await connection.query(
    `SELECT p.*, pd.image_url AS profile_demon_image_url
     FROM players p
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     WHERE p.id = ?
     LIMIT 1
     FOR UPDATE`,
    [playerId]
  );
  if (!rows.length) throw createHttpError('Hunter not found.', 404);
  return rows[0];
}

async function assertPlayerAtAnomalyAltar(connection, playerId) {
  const [rows] = await connection.query(
    'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1 FOR UPDATE',
    [playerId]
  );
  if (!isAtAnomalyAltar(rows[0])) {
    throw createHttpError(`Stand before the ${ANOMALY_EVENT_NAME} to face The Anomaly.`, 409);
  }
}

async function getLockedAnomalyRitual(connection, playerId) {
  await connection.query(
    'INSERT IGNORE INTO player_anomaly_rituals (player_id) VALUES (?)',
    [playerId]
  );
  const [rows] = await connection.query(
    `SELECT attempts,
            victories,
            losses,
            last_ritual_id AS lastRitualId,
            active_run_id AS activeRunId,
            active_floor AS activeFloor,
            active_team AS activeTeam
     FROM player_anomaly_rituals
     WHERE player_id = ?
     LIMIT 1
     FOR UPDATE`,
    [playerId]
  );
  return rows[0] || {};
}

function parseAnomalyTeam(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  ANOMALY_ABILITY_TYPE_IDS,
  ANOMALY_ECHO_CHANCE_PERCENT,
  ANOMALY_EVENT_ID,
  ANOMALY_EVENT_NAME,
  ANOMALY_MAX_FLOOR,
  ANOMALY_NAME,
  ANOMALY_SOUL_COST,
  ANOMALY_STATS,
  ANOMALY_X,
  ANOMALY_Y,
  abandonWorldAnomaly,
  continueWorldAnomaly,
  createAnomalyEnemy,
  createAnomalyFloorEnemies,
  createAnomalyRitualId,
  getUncollectedMythicTypeIds,
  getWorldAnomalyForPlayer,
  isAtAnomalyAltar,
  leaveWorldAnomaly,
  normalizeAnomalyRitualId,
  resetAnomalyTeamForFloor,
  resolveAnomalyReward,
  resolveAnomalyRewardRolls,
  serializeAnomalyBoss,
  serializeAnomalyState,
  summonWorldAnomaly
};
