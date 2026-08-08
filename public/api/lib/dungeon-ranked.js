const crypto = require('crypto');
const db = require('./db');
const {
  normalizeCombatBuffState,
  serializeCombatBuffState
} = require('./combat-buffs');
const { assignFormationSlots, getFormationSlotPosition } = require('./run-demons');
const { resolvePlayerCombatBuffState } = require('./player-combat-buffs');
const {
  getOrCreateCurrentSeason,
  getOrCreateRankedRating,
  getRankedRating
} = require('./ranked-runs');
const {
  COMBAT_DATA_VERSION,
  RANKED_DEFAULT_RATING,
  RANKED_ELO_K,
  getDivision,
  getRankedEloDelta
} = require('./ranked-rules');

const DUNGEON_RANKED_FIRST_FLOOR = 30;
const DUNGEON_RANKED_FLOOR_INTERVAL = 5;
const DUNGEON_RANKED_LEVEL_RANGE = 5;
const DUNGEON_RANKED_RATING_RANGE = 200;
const DUNGEON_RANKED_ELO_K = RANKED_ELO_K;
const DUNGEON_RANKED_SNAPSHOT_VERSION = 'dungeon-ranked-v2';
const DEFAULT_RATING = RANKED_DEFAULT_RATING;

function isDungeonRankedFloor(floor) {
  const value = Math.max(0, Math.floor(Number(floor) || 0));
  return value >= DUNGEON_RANKED_FIRST_FLOOR
    && value % DUNGEON_RANKED_FLOOR_INTERVAL === 0;
}

function getDungeonPlayerCombatBuffs(runBuffs, playerBuffs) {
  const normalizedRunBuffs = normalizeCombatBuffState(runBuffs || {});
  const normalizedPlayerBuffs = normalizeCombatBuffState(playerBuffs || {});

  return normalizeCombatBuffState({
    active: normalizedRunBuffs.active,
    temporary: normalizedRunBuffs.temporary,
    activeBuffs: normalizedPlayerBuffs.activeBuffs
  });
}

function createDungeonRankedSnapshotPayload(run, options = {}) {
  const rating = Number.isFinite(Number(options.rating))
    ? Math.max(0, Math.floor(Number(options.rating)))
    : null;

  return {
    snapshotVersion: DUNGEON_RANKED_SNAPSHOT_VERSION,
    combatVersion: COMBAT_DATA_VERSION,
    floor: Math.max(1, Math.floor(Number(run?.floor) || 1)),
    playerLevel: Math.max(1, Math.floor(Number(options.playerLevel) || 1)),
    rating,
    division: rating === null ? 'Unranked' : getDivision(rating).name,
    team: cloneJson(run?.state?.team || []),
    buffs: serializeCombatBuffState(options.buffs || {}),
    deterministic: {
      runSeed: Number(run?.seed) || 0,
      sourceRunId: run?.id || null
    }
  };
}

async function prepareDungeonRankedEncounter(run, player, queryable = db, options = {}) {
  if (!run || run.status !== 'active' || !isDungeonRankedFloor(run.floor)) return null;
  if (!Array.isArray(run.state?.team) || !run.state.team.length) return null;

  const season = await getOrCreateCurrentSeason(queryable);
  const currentRating = await getRankedRating(run.playerId, season.id, queryable);
  const playerLevel = Math.max(1, Math.floor(Number(player?.level ?? run.state.playerLevel) || 1));
  const playerBuffs = await resolvePlayerCombatBuffState(player);
  const combatBuffs = getDungeonPlayerCombatBuffs(run.state.buffs, playerBuffs);
  const snapshotId = crypto.randomUUID();
  const snapshot = createDungeonRankedSnapshotPayload(run, {
    playerLevel,
    rating: currentRating?.rating,
    buffs: combatBuffs
  });

  await queryable.query(
    `INSERT INTO dungeon_ranked_snapshots
       (id, player_id, season_id, source_run_id, floor, player_level, rating, hunter_name, snapshot, combat_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshotId,
      run.playerId,
      season.id,
      run.id,
      run.floor,
      playerLevel,
      currentRating?.rating ?? DEFAULT_RATING,
      player?.username || 'Hunter',
      JSON.stringify(snapshot),
      COMBAT_DATA_VERSION
    ]
  );

  const opponent = await selectDungeonRankedOpponent({
    playerId: run.playerId,
    seasonId: season.id,
    floor: run.floor,
    playerLevel,
    playerRating: currentRating?.rating ?? DEFAULT_RATING,
    lastOpponentPlayerId: run.state.lastRankedOpponentPlayerId || null
  }, queryable, options);

  if (!opponent) return null;

  await queryable.query(
    `INSERT INTO dungeon_ranked_history
       (player_id, season_id, snapshot_id, opponent_player_id, floor)
     VALUES (?, ?, ?, ?, ?)`,
    [run.playerId, season.id, opponent.snapshotId, opponent.playerId, run.floor]
  );

  run.state.lastRankedOpponentPlayerId = opponent.playerId;
  run.state.enemies = namespaceDungeonRankedOpponentTeam(opponent.team, opponent.snapshotId);
  run.state.rankedEncounter = {
    status: 'choice',
    floor: run.floor,
    seasonId: season.id,
    snapshotId: opponent.snapshotId,
    opponent: {
      playerId: opponent.playerId,
      hunterName: opponent.hunterName,
      rating: opponent.rating,
      division: opponent.division,
      playerLevel: opponent.playerLevel
    },
    enemyBuffs: opponent.buffs
  };

  return run.state.rankedEncounter;
}

async function selectDungeonRankedOpponent(criteria, queryable = db, options = {}) {
  const minLevel = Math.max(1, criteria.playerLevel - DUNGEON_RANKED_LEVEL_RANGE);
  const maxLevel = criteria.playerLevel + DUNGEON_RANKED_LEVEL_RANGE;
  const playerRating = Math.max(0, Math.floor(Number(criteria.playerRating) || DEFAULT_RATING));
  const minRating = Math.max(0, playerRating - DUNGEON_RANKED_RATING_RANGE);
  const maxRating = playerRating + DUNGEON_RANKED_RATING_RANGE;
  const [rows] = await queryable.query(
    `SELECT snapshots.*,
            history.snapshot_id AS previously_served
     FROM dungeon_ranked_snapshots snapshots
     LEFT JOIN (
       SELECT DISTINCT snapshot_id
       FROM dungeon_ranked_history
       WHERE player_id = ? AND season_id = ? AND floor = ?
     ) history ON history.snapshot_id = snapshots.id
     WHERE snapshots.season_id = ?
       AND snapshots.floor = ?
       AND snapshots.player_id <> ?
       AND snapshots.player_level BETWEEN ? AND ?
       AND snapshots.rating BETWEEN ? AND ?
       AND snapshots.combat_version = ?
       AND NOT EXISTS (
         SELECT 1
         FROM dungeon_ranked_snapshots newer
         WHERE newer.season_id = snapshots.season_id
           AND newer.floor = snapshots.floor
           AND newer.player_id = snapshots.player_id
           AND newer.combat_version = snapshots.combat_version
           AND (
             newer.created_at > snapshots.created_at
             OR (newer.created_at = snapshots.created_at AND newer.id > snapshots.id)
           )
       )
     ORDER BY snapshots.created_at DESC
     LIMIT 100`,
    [
      criteria.playerId,
      criteria.seasonId,
      criteria.floor,
      criteria.seasonId,
      criteria.floor,
      criteria.playerId,
      minLevel,
      maxLevel,
      minRating,
      maxRating,
      COMBAT_DATA_VERSION
    ]
  );

  const eligible = rows
    .map((row) => ({ row, snapshot: parseJson(row.snapshot, {}) }))
    .filter(({ row, snapshot }) => (
      snapshot.snapshotVersion === DUNGEON_RANKED_SNAPSHOT_VERSION
      && Array.isArray(snapshot.team)
      && snapshot.team.length > 0
      && snapshot.team.length <= 9
      && (!criteria.lastOpponentPlayerId || String(row.player_id) !== String(criteria.lastOpponentPlayerId))
    ));
  const repeatFallback = eligible.length
    ? eligible
    : rows
      .map((row) => ({ row, snapshot: parseJson(row.snapshot, {}) }))
      .filter(({ snapshot }) => (
        snapshot.snapshotVersion === DUNGEON_RANKED_SNAPSHOT_VERSION
        && Array.isArray(snapshot.team)
        && snapshot.team.length > 0
        && snapshot.team.length <= 9
      ));

  if (!repeatFallback.length) return null;

  const unseen = repeatFallback.filter(({ row }) => !row.previously_served);
  const pool = unseen.length ? unseen : repeatFallback;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)));
  const { row, snapshot } = pool[index];
  const rawSnapshotRating = Number(row.rating);
  const rating = Number.isFinite(rawSnapshotRating)
    ? Math.max(0, Math.floor(rawSnapshotRating))
    : DEFAULT_RATING;

  return {
    snapshotId: row.id,
    playerId: row.player_id,
    hunterName: row.hunter_name,
    playerLevel: Math.max(1, Number(row.player_level) || 1),
    rating,
    division: getDivision(rating).name,
    team: snapshot.team,
    buffs: normalizeCombatBuffState(snapshot.buffs || {})
  };
}

function namespaceDungeonRankedOpponentTeam(team, opponentKey = 'opponent') {
  const namespace = crypto.createHash('sha1').update(String(opponentKey)).digest('hex').slice(0, 8);
  const mirrored = (Array.isArray(team) ? team : []).map((demon, index) => {
    const sourceSlot = normalizeFormationSlot(demon.formationSlot ?? demon.formationRow);
    const formationSlot = sourceSlot === null ? null : mirrorFormationSlot(sourceSlot);
    return {
      ...cloneJson(demon),
      instanceId: `ranked-enemy-${namespace}-${index + 1}`,
      ...(formationSlot === null ? {} : {
        formationSlot,
        position: getFormationSlotPosition(formationSlot, 'enemy')
      })
    };
  });

  return assignFormationSlots(mirrored, 'enemy');
}

function mirrorFormationSlot(slot) {
  const row = Math.floor(slot / 3);
  const column = slot % 3;
  return row * 3 + (2 - column);
}

function normalizeFormationSlot(value) {
  const slot = Number(value);
  return Number.isInteger(slot) && slot >= 0 && slot < 9 ? slot : null;
}

function getDungeonRankedRatingDelta(winner, playerRating, opponentRating) {
  return getRankedEloDelta(winner === 'player', playerRating, opponentRating);
}

async function applyDungeonRankedRatingResult(run, winner, connection) {
  const encounter = run?.state?.rankedEncounter;
  if (!encounter || encounter.status !== 'choice') {
    throw createRankedEncounterError('No Ranked dungeon encounter is waiting.', 409);
  }

  const rating = await getOrCreateRankedRating(
    run.playerId,
    encounter.seasonId,
    connection,
    { forUpdate: true }
  );
  const previousRating = rating.rating;
  const opponentRating = Number.isFinite(Number(encounter.opponent?.rating))
    ? Math.max(0, Number(encounter.opponent.rating))
    : DEFAULT_RATING;
  const requestedDelta = getDungeonRankedRatingDelta(winner, previousRating, opponentRating);
  const delta = Math.max(-previousRating, requestedDelta);
  const nextRating = Math.max(0, previousRating + delta);
  const won = winner === 'player';

  await connection.query(
    `UPDATE ranked_ratings
     SET rating = ?,
         highest_floor = GREATEST(highest_floor, ?),
         victories = victories + ?,
         runs_played = runs_played + 1
     WHERE player_id = ? AND season_id = ?`,
    [nextRating, encounter.floor, won ? 1 : 0, run.playerId, encounter.seasonId]
  );

  const result = {
    winner,
    delta,
    previousRating,
    rating: nextRating,
    previousDivision: getDivision(previousRating).name,
    division: getDivision(nextRating).name
  };
  encounter.status = 'result';
  encounter.result = result;
  return result;
}

function getDungeonRankedEnemyBuffs(run) {
  return normalizeCombatBuffState(run?.state?.rankedEncounter?.enemyBuffs || {});
}

async function getDungeonRankedLiveOpponentRank(encounter, queryable = db) {
  const playerId = encounter?.opponent?.playerId;
  const seasonId = encounter?.seasonId;
  if (!playerId || !seasonId) return null;

  const rating = await getRankedRating(playerId, seasonId, queryable);
  return rating
    ? { rating: rating.rating, division: rating.division }
    : { rating: null, division: 'Unranked' };
}

function serializeDungeonRankedEncounter(encounter, options = {}) {
  if (!encounter || !['choice', 'result'].includes(encounter.status)) return null;
  const liveOpponentRank = options.liveOpponentRank || null;
  return {
    status: encounter.status,
    floor: encounter.floor,
    opponent: encounter.opponent ? {
      ...encounter.opponent,
      liveRating: liveOpponentRank?.rating ?? null,
      liveDivision: liveOpponentRank?.division || encounter.opponent.division || 'Unranked'
    } : null,
    result: encounter.result ? { ...encounter.result } : null
  };
}

function parseJson(value, fallback) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createRankedEncounterError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  DEFAULT_RATING,
  DUNGEON_RANKED_ELO_K,
  DUNGEON_RANKED_FIRST_FLOOR,
  DUNGEON_RANKED_FLOOR_INTERVAL,
  DUNGEON_RANKED_LEVEL_RANGE,
  DUNGEON_RANKED_RATING_RANGE,
  DUNGEON_RANKED_SNAPSHOT_VERSION,
  applyDungeonRankedRatingResult,
  createDungeonRankedSnapshotPayload,
  getDungeonPlayerCombatBuffs,
  getDungeonRankedEnemyBuffs,
  getDungeonRankedLiveOpponentRank,
  getDungeonRankedRatingDelta,
  isDungeonRankedFloor,
  namespaceDungeonRankedOpponentTeam,
  prepareDungeonRankedEncounter,
  selectDungeonRankedOpponent,
  serializeDungeonRankedEncounter
};
