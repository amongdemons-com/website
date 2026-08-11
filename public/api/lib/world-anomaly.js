const crypto = require('node:crypto');
const db = require('./db');
const { cleanPlayer } = require('./auth');
const { simulateFight } = require('./combat');
const { normalizeCombatBuffState, serializeCombatBuffState } = require('./combat-buffs');
const { addEcho } = require('./echo-bag');
const { getDemonTypes } = require('./game-data');
const { resolvePlayerCombatBuffState } = require('./player-combat-buffs');
const { createRng } = require('./rng');
const { getActiveWorldTeam } = require('./world-combat');

const ANOMALY_EVENT_ID = 'altar-of-many-voices';
const ANOMALY_EVENT_NAME = 'Altar of Many Voices';
const ANOMALY_NAME = 'The Anomaly';
const ANOMALY_X = 4;
const ANOMALY_Y = 0;
const ANOMALY_SOUL_COST = 10_000;
const ANOMALY_ECHO_CHANCE_PERCENT = 25;
const ANOMALY_PITY_SHARDS = 4;
const ANOMALY_STATS = Object.freeze({ hp: 10_000, atk: 250, speed: 35 });
const ANOMALY_ABILITY_TYPE_IDS = Object.freeze(Array.from({ length: 11 }, (_, index) => index + 1));
const ANOMALY_IMAGE_URL = '/app/images/demons/anomaly.webp';
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

function createAnomalyEnemy() {
  return {
    instanceId: 'the-anomaly',
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
    position: 'front',
    formationSlot: 3,
    formationRow: 3,
    attackMeter: 0,
    shield: 0,
    statusEffects: { poison: [] }
  };
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
    `SELECT voice_shards AS voiceShards,
            attempts,
            victories
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
  const revealed = attempts > 0;
  const state = {
    id: ANOMALY_EVENT_ID,
    eventName: ANOMALY_EVENT_NAME,
    x: ANOMALY_X,
    y: ANOMALY_Y,
    price: ANOMALY_SOUL_COST,
    canSummon: Boolean(options.canSummon),
    ritualId: options.ritualId || createAnomalyRitualId(),
    revealed,
    attempts,
    victories: Math.max(0, Number(row?.victories) || 0),
    voiceShards: Math.min(ANOMALY_PITY_SHARDS - 1, Math.max(0, Number(row?.voiceShards) || 0)),
    pityRequired: ANOMALY_PITY_SHARDS
  };

  if (revealed) {
    state.bossName = ANOMALY_NAME;
    state.echoChancePercent = ANOMALY_ECHO_CHANCE_PERCENT;
  }

  return state;
}

function resolveAnomalyReward(voiceShards = 0, options = {}) {
  const randomInt = options.randomInt || crypto.randomInt;
  const candidateTypeIds = normalizeAnomalyRewardTypeIds(options.candidateTypeIds);
  const currentShards = Math.min(ANOMALY_PITY_SHARDS - 1, Math.max(0, Number(voiceShards) || 0));
  const randomDrop = randomInt(100) < ANOMALY_ECHO_CHANCE_PERCENT;
  const earnedShardCount = currentShards + 1;
  const pityDrop = !randomDrop && earnedShardCount >= ANOMALY_PITY_SHARDS;
  const echoAwarded = randomDrop || pityDrop;

  return {
    echoAwarded,
    source: randomDrop ? 'chance' : pityDrop ? 'pity' : 'shard',
    typeId: echoAwarded ? candidateTypeIds[randomInt(candidateTypeIds.length)] : null,
    voiceShards: echoAwarded ? 0 : earnedShardCount,
    pityRequired: ANOMALY_PITY_SHARDS
  };
}

function normalizeAnomalyRewardTypeIds(typeIds) {
  const validTypeIds = new Set(ANOMALY_ABILITY_TYPE_IDS);
  const candidates = [...new Set(
    (Array.isArray(typeIds) ? typeIds : [])
      .map(Number)
      .filter((typeId) => validTypeIds.has(typeId))
  )];

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
    const [playerRows] = await connection.query(
      `SELECT p.*, pd.image_url AS profile_demon_image_url
       FROM players p
       LEFT JOIN player_demons pd
         ON pd.id = p.profile_demon_id
        AND pd.player_id = p.id
       WHERE p.id = ?
       LIMIT 1
       FOR UPDATE`,
      [player.id]
    );
    if (!playerRows.length) throw createHttpError('Hunter not found.', 404);

    const [positionRows] = await connection.query(
      'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1 FOR UPDATE',
      [player.id]
    );
    if (!isAtAnomalyAltar(positionRows[0])) {
      throw createHttpError(`Stand before the ${ANOMALY_EVENT_NAME} to make the offering.`, 409);
    }

    await connection.query(
      'INSERT IGNORE INTO player_anomaly_rituals (player_id) VALUES (?)',
      [player.id]
    );
    const [ritualRows] = await connection.query(
      `SELECT voice_shards AS voiceShards,
              attempts,
              victories,
              last_ritual_id AS lastRitualId
       FROM player_anomaly_rituals
       WHERE player_id = ?
       LIMIT 1
       FOR UPDATE`,
      [player.id]
    );
    const ritual = ritualRows[0] || {};
    if (ritual.lastRitualId === ritualId) {
      throw createHttpError('That offering has already been consumed.', 409);
    }

    const storedPlayer = playerRows[0];
    if (Number(storedPlayer.souls) < ANOMALY_SOUL_COST) {
      const soulLabel = ANOMALY_SOUL_COST === 1 ? 'Soul' : 'Souls';
      throw createHttpError(`You need ${ANOMALY_SOUL_COST.toLocaleString('en-US')} ${soulLabel} for this offering.`, 409);
    }
    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [ANOMALY_SOUL_COST, player.id]
    );

    const enemyBuffs = normalizeCombatBuffState({});
    const seed = options.seed ?? crypto.randomInt(1, 0x100000000);
    const fight = (options.simulateFight || simulateFight)(
      createRng(seed),
      playerTeam,
      [createAnomalyEnemy()],
      {
        demonTypes,
        combatType: 'world_anomaly',
        playerBuffs,
        enemyBuffs
      }
    );

    let reward = null;
    let nextVoiceShards = Math.max(0, Number(ritual.voiceShards) || 0);
    const won = fight.winner === 'player';
    if (won) {
      const uncollectedMythicTypeIds = await getUncollectedMythicTypeIds(player.id, connection);
      const rewardRoll = resolveAnomalyReward(nextVoiceShards, {
        randomInt: options.randomInt || crypto.randomInt,
        candidateTypeIds: uncollectedMythicTypeIds
      });
      nextVoiceShards = rewardRoll.voiceShards;
      if (rewardRoll.echoAwarded) {
        const echo = await (options.addEcho || addEcho)(player.id, {
          typeId: rewardRoll.typeId,
          rarity: 'mythic'
        }, {
          queryable: connection,
          natural: true
        });
        reward = { ...rewardRoll, echo };
      } else {
        reward = rewardRoll;
      }
    }

    await connection.query(
      `UPDATE player_anomaly_rituals
       SET voice_shards = ?,
           attempts = attempts + 1,
           victories = victories + ?,
           last_ritual_id = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ?`,
      [nextVoiceShards, won ? 1 : 0, ritualId, player.id]
    );

    await connection.commit();
    committed = true;
    const attempts = Math.max(0, Number(ritual.attempts) || 0) + 1;
    const victories = Math.max(0, Number(ritual.victories) || 0) + (won ? 1 : 0);
    const updatedPlayer = cleanPlayer({
      ...storedPlayer,
      souls: Number(storedPlayer.souls) - ANOMALY_SOUL_COST
    });
    const anomaly = serializeAnomalyState({ attempts, victories, voiceShards: nextVoiceShards }, {
      canSummon: true,
      ritualId: createAnomalyRitualId()
    });
    const battle = {
      combatType: 'world_anomaly',
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
    };

    return {
      player: updatedPlayer,
      anomaly,
      battle,
      reward,
      chargedSouls: ANOMALY_SOUL_COST
    };
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
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
  ANOMALY_NAME,
  ANOMALY_PITY_SHARDS,
  ANOMALY_SOUL_COST,
  ANOMALY_STATS,
  ANOMALY_X,
  ANOMALY_Y,
  createAnomalyEnemy,
  createAnomalyRitualId,
  getUncollectedMythicTypeIds,
  getWorldAnomalyForPlayer,
  isAtAnomalyAltar,
  normalizeAnomalyRitualId,
  resolveAnomalyReward,
  serializeAnomalyBoss,
  serializeAnomalyState,
  summonWorldAnomaly
};
