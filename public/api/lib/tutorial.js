const db = require('./db');
const { getDemonTrainingInfo } = require('./demon-training');
const { getDemonTypes } = require('./game-data');

const TUTORIAL_KEY = 'core-onboarding';
const TUTORIAL_VERSION = 3;
const TUTORIAL_FIRST_CHECKPOINT = 'world-map';
const TUTORIAL_COMPLETE_CHECKPOINT = 'complete';
const TUTORIAL_CHECKPOINTS = Object.freeze([
  TUTORIAL_FIRST_CHECKPOINT,
  'world-team',
  'world-travel',
  'dungeon-prepare',
  'dungeon-extract',
  'bag-echo',
  'collection-training',
  'world-hunt-rewards',
  TUTORIAL_COMPLETE_CHECKPOINT
]);
const TUTORIAL_STATUSES = new Set(['not_started', 'in_progress', 'completed', 'skipped']);
const CONTEXTUAL_GUIDES = new Set(['summon', 'training', 'skill-tree']);

async function getTutorialProgress(playerId, queryable = db, options = {}) {
  if (!playerId) throw createTutorialError('Player is required.', 400);

  await queryable.query(
    `INSERT INTO player_tutorials
      (player_id, tutorial_key, version, status, checkpoint)
     VALUES (?, ?, ?, 'not_started', ?)
     ON DUPLICATE KEY UPDATE player_id = VALUES(player_id)`,
    [playerId, TUTORIAL_KEY, TUTORIAL_VERSION, TUTORIAL_FIRST_CHECKPOINT]
  );

  const [rows] = await queryable.query(
    `SELECT player_id, tutorial_key, version, status, checkpoint,
            summon_guide_completed, training_guide_completed,
            training_souls_granted,
            skill_tree_guide_pending, skill_tree_guide_completed,
            started_at, completed_at, skipped_at, created_at, updated_at
     FROM player_tutorials
     WHERE player_id = ? AND tutorial_key = ?
     LIMIT 1${options.forUpdate ? ' FOR UPDATE' : ''}`,
    [playerId, TUTORIAL_KEY]
  );

  return normalizeTutorialProgress(rows[0]);
}

async function mutateTutorialProgress(playerId, mutation = {}, queryable = db) {
  const ownsConnection = queryable === db;
  const connection = ownsConnection ? await db.getConnection() : queryable;

  try {
    if (ownsConnection) await connection.beginTransaction();
    const current = await getTutorialProgress(playerId, connection, { forUpdate: true });
    let next = applyTutorialMutation(current, mutation);
    if (
      String(mutation.action || '').trim().toLowerCase() === 'advance'
      && next.checkpoint === 'collection-training'
      && current.checkpoint !== 'collection-training'
      && !current.trainingSoulsGranted
    ) {
      await grantTutorialTrainingSouls(playerId, connection);
      next = { ...next, trainingSoulsGranted: true };
    }

    await connection.query(
      `UPDATE player_tutorials
       SET version = ?, status = ?, checkpoint = ?, started_at = ?,
           completed_at = ?, skipped_at = ?, summon_guide_completed = ?,
           training_guide_completed = ?, training_souls_granted = ?,
           skill_tree_guide_pending = ?, skill_tree_guide_completed = ?
       WHERE player_id = ? AND tutorial_key = ?`,
      [
        next.version,
        next.status,
        next.checkpoint,
        next.startedAt,
        next.completedAt,
        next.skippedAt,
        Number(next.guides.summon.completed),
        Number(next.guides.training.completed),
        Number(next.trainingSoulsGranted),
        Number(next.guides.skillTree.pending),
        Number(next.guides.skillTree.completed),
        playerId,
        TUTORIAL_KEY
      ]
    );

    if (ownsConnection) await connection.commit();
    return next;
  } catch (error) {
    if (ownsConnection) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

function applyTutorialMutation(currentProgress = {}, mutation = {}, now = new Date()) {
  const current = normalizeTutorialProgress(currentProgress);
  const action = String(mutation.action || '').trim().toLowerCase();

  if (action === 'complete-guide') {
    const guide = normalizeContextualGuide(mutation.guide);
    return completeContextualGuide(current, guide);
  }

  if (action === 'trigger-guide') {
    const guide = normalizeContextualGuide(mutation.guide);
    if (guide !== 'skill-tree' || current.guides.skillTree.completed) return current;
    return {
      ...current,
      guides: {
        ...current.guides,
        skillTree: { ...current.guides.skillTree, pending: true }
      }
    };
  }

  if (action === 'restart') {
    return {
      ...current,
      version: TUTORIAL_VERSION,
      status: 'in_progress',
      checkpoint: TUTORIAL_FIRST_CHECKPOINT,
      startedAt: now,
      completedAt: null,
      skippedAt: null
    };
  }

  if (current.status === 'completed' || current.status === 'skipped') {
    return current;
  }

  if (action === 'start') {
    if (current.status === 'in_progress') return current;
    return {
      ...current,
      version: TUTORIAL_VERSION,
      status: 'in_progress',
      checkpoint: TUTORIAL_FIRST_CHECKPOINT,
      startedAt: current.startedAt || now,
      completedAt: null,
      skippedAt: null
    };
  }

  if (action === 'skip') {
    return {
      ...current,
      version: TUTORIAL_VERSION,
      status: 'skipped',
      skippedAt: now,
      completedAt: null
    };
  }

  if (current.status !== 'in_progress') {
    throw createTutorialError('Start the tutorial before updating it.', 409);
  }

  if (action === 'advance') {
    const checkpoint = normalizeCheckpoint(mutation.checkpoint);
    if (checkpoint === TUTORIAL_COMPLETE_CHECKPOINT) {
      throw createTutorialError('Use the complete action to finish the tutorial.', 400);
    }
    if (getCheckpointIndex(checkpoint) <= getCheckpointIndex(current.checkpoint)) return current;
    return {
      ...current,
      version: TUTORIAL_VERSION,
      checkpoint
    };
  }

  if (action === 'complete') {
    return {
      ...current,
      version: TUTORIAL_VERSION,
      status: 'completed',
      checkpoint: TUTORIAL_COMPLETE_CHECKPOINT,
      guides: {
        ...current.guides,
        training: { completed: true }
      },
      completedAt: now,
      skippedAt: null
    };
  }

  throw createTutorialError('Choose a valid tutorial action.', 400);
}

async function mergePlayerTutorialProgress(targetPlayerId, sourcePlayerId, queryable) {
  const [rows] = await queryable.query(
    `SELECT player_id, tutorial_key, version, status, checkpoint,
            summon_guide_completed, training_guide_completed,
            training_souls_granted,
            skill_tree_guide_pending, skill_tree_guide_completed,
            started_at, completed_at, skipped_at, created_at, updated_at
     FROM player_tutorials
     WHERE player_id IN (?, ?) AND tutorial_key = ?
     ORDER BY player_id
     FOR UPDATE`,
    [targetPlayerId, sourcePlayerId, TUTORIAL_KEY]
  );
  if (!rows.length) return null;

  const merged = chooseMergedTutorialProgress(rows);
  await queryable.query(
    `INSERT INTO player_tutorials
      (player_id, tutorial_key, version, status, checkpoint,
       started_at, completed_at, skipped_at, summon_guide_completed,
       training_guide_completed, training_souls_granted,
       skill_tree_guide_pending, skill_tree_guide_completed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       version = VALUES(version), status = VALUES(status),
       checkpoint = VALUES(checkpoint), started_at = VALUES(started_at),
       completed_at = VALUES(completed_at), skipped_at = VALUES(skipped_at),
       summon_guide_completed = VALUES(summon_guide_completed),
       training_guide_completed = VALUES(training_guide_completed),
       training_souls_granted = VALUES(training_souls_granted),
       skill_tree_guide_pending = VALUES(skill_tree_guide_pending),
       skill_tree_guide_completed = VALUES(skill_tree_guide_completed)`,
    [
      targetPlayerId,
      TUTORIAL_KEY,
      merged.version,
      merged.status,
      merged.checkpoint,
      merged.startedAt,
      merged.completedAt,
      merged.skippedAt,
      Number(merged.guides.summon.completed),
      Number(merged.guides.training.completed),
      Number(merged.trainingSoulsGranted),
      Number(merged.guides.skillTree.pending),
      Number(merged.guides.skillTree.completed)
    ]
  );
  return merged;
}

function chooseMergedTutorialProgress(progressRows = []) {
  const progress = progressRows.map(normalizeTutorialProgress);
  if (!progress.length) return normalizeTutorialProgress();

  const winner = [...progress].sort((left, right) => (
    getStatusRank(right.status) - getStatusRank(left.status)
    || getCheckpointIndex(right.checkpoint) - getCheckpointIndex(left.checkpoint)
    || getTimestamp(right.updatedAt) - getTimestamp(left.updatedAt)
  ))[0];
  const startedAt = progress
    .map((entry) => entry.startedAt)
    .filter(Boolean)
    .sort((left, right) => getTimestamp(left) - getTimestamp(right))[0] || winner.startedAt;

  return {
    ...winner,
    playerId: null,
    startedAt,
    trainingSoulsGranted: progress.some((entry) => entry.trainingSoulsGranted),
    guides: {
      summon: { completed: progress.some((entry) => entry.guides.summon.completed) },
      training: { completed: progress.some((entry) => entry.guides.training.completed) },
      skillTree: {
        pending: progress.some((entry) => entry.guides.skillTree.pending),
        completed: progress.some((entry) => entry.guides.skillTree.completed)
      }
    }
  };
}

function normalizeTutorialProgress(row = {}) {
  const status = TUTORIAL_STATUSES.has(row.status) ? row.status : 'not_started';
  const checkpoint = status === 'completed'
    ? TUTORIAL_COMPLETE_CHECKPOINT
    : isCheckpoint(row.checkpoint)
      ? row.checkpoint
      : TUTORIAL_FIRST_CHECKPOINT;

  return {
    playerId: row.playerId || row.player_id || null,
    tutorialKey: row.tutorialKey || row.tutorial_key || TUTORIAL_KEY,
    version: Math.max(1, Number(row.version) || TUTORIAL_VERSION),
    status,
    checkpoint,
    trainingSoulsGranted: toBoolean(row.trainingSoulsGranted ?? row.training_souls_granted),
    guides: {
      summon: { completed: toBoolean(row.guides?.summon?.completed ?? row.summon_guide_completed) },
      training: { completed: toBoolean(row.guides?.training?.completed ?? row.training_guide_completed) },
      skillTree: {
        pending: toBoolean(row.guides?.skillTree?.pending ?? row.skill_tree_guide_pending),
        completed: toBoolean(row.guides?.skillTree?.completed ?? row.skill_tree_guide_completed)
      }
    },
    startedAt: row.startedAt || row.started_at || null,
    completedAt: row.completedAt || row.completed_at || null,
    skippedAt: row.skippedAt || row.skipped_at || null,
    createdAt: row.createdAt || row.created_at || null,
    updatedAt: row.updatedAt || row.updated_at || null
  };
}

async function grantTutorialTrainingSouls(playerId, connection) {
  const types = await getDemonTypes();
  const [playerRows] = await connection.query(
    'SELECT souls FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
    [playerId]
  );
  if (!playerRows.length) return { demonId: null, cost: 0, amount: 0 };

  const [demonRows] = await connection.query(
    `SELECT id, type_id AS typeId, rarity, hp, atk, speed
     FROM player_demons
     WHERE player_id = ?
     ORDER BY created_at DESC, id DESC
     FOR UPDATE`,
    [playerId]
  );
  const visibleOwnedDemons = getVisibleOwnedDemons(demonRows).map((demon) => ({
    ...demon,
    training: getDemonTrainingInfo(demon, types)
  }));
  const grant = calculateTutorialTrainingTopUp(visibleOwnedDemons, playerRows[0].souls);
  if (grant.amount > 0) {
    await connection.query(
      'UPDATE players SET souls = souls + ? WHERE id = ?',
      [grant.amount, playerId]
    );
  }
  return grant;
}

function getVisibleOwnedDemons(demons = []) {
  const bySlot = new Map();
  demons.forEach((demon) => {
    const typeId = Number(demon.typeId ?? demon.type_id ?? demon.type);
    const rarity = String(demon.rarity || '').toLowerCase();
    const key = typeId && rarity ? `${typeId}:${rarity}` : '';
    if (key && !bySlot.has(key)) bySlot.set(key, demon);
  });
  return [...bySlot.values()];
}

function calculateTutorialTrainingTopUp(demons = [], currentSouls = 0) {
  const availableSouls = Math.max(0, Math.floor(Number(currentSouls) || 0));
  const demon = demons.find((candidate) => {
    const cost = Number(candidate.training?.cost);
    return !candidate.training?.maxed && Number.isFinite(cost) && cost > 0;
  });
  const cost = demon ? Math.max(1, Math.ceil(Number(demon.training.cost) || 0)) : 0;
  return {
    demonId: demon?.id || null,
    cost,
    amount: Math.max(0, cost - availableSouls)
  };
}

function toBoolean(value) {
  return value === true || Number(value) === 1;
}

function normalizeContextualGuide(value) {
  const guide = String(value || '').trim().toLowerCase();
  if (!CONTEXTUAL_GUIDES.has(guide)) {
    throw createTutorialError('Choose a valid contextual tutorial.', 400);
  }
  return guide;
}

function completeContextualGuide(current, guide) {
  if (guide === 'summon') {
    return { ...current, guides: { ...current.guides, summon: { completed: true } } };
  }
  if (guide === 'training') {
    return { ...current, guides: { ...current.guides, training: { completed: true } } };
  }
  return {
    ...current,
    guides: {
      ...current.guides,
      skillTree: { pending: false, completed: true }
    }
  };
}

function normalizeCheckpoint(value) {
  const checkpoint = String(value || '').trim().toLowerCase();
  if (!isCheckpoint(checkpoint)) {
    throw createTutorialError('Choose a valid tutorial checkpoint.', 400);
  }
  return checkpoint;
}

function isCheckpoint(value) {
  return TUTORIAL_CHECKPOINTS.includes(String(value || ''));
}

function getCheckpointIndex(value) {
  const index = TUTORIAL_CHECKPOINTS.indexOf(String(value || ''));
  return index < 0 ? -1 : index;
}

function getStatusRank(status) {
  return {
    completed: 4,
    skipped: 3,
    in_progress: 2,
    not_started: 1
  }[status] || 0;
}

function getTimestamp(value) {
  const timestamp = value ? new Date(value).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function createTutorialError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  TUTORIAL_CHECKPOINTS,
  TUTORIAL_COMPLETE_CHECKPOINT,
  TUTORIAL_FIRST_CHECKPOINT,
  TUTORIAL_KEY,
  TUTORIAL_VERSION,
  applyTutorialMutation,
  calculateTutorialTrainingTopUp,
  chooseMergedTutorialProgress,
  getTutorialProgress,
  mergePlayerTutorialProgress,
  mutateTutorialProgress,
  normalizeTutorialProgress
};
