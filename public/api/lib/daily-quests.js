const db = require('./db');
const { getNextAccountLevel } = require('./progression');

const QUEST_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'dungeon-wins',
    icon: 'swords',
    title: 'Win 3 dungeon fights',
    meta: 'Defeat dungeon formations before the daily reset.',
    progressKey: 'dungeonWins',
    target: 3,
    reward: Object.freeze({ type: 'souls', value: 15 }),
    href: '/dungeon'
  }),
  Object.freeze({
    id: 'demon-extractions',
    icon: 'skull',
    title: 'Extract a demon',
    meta: 'Bring one defeated demon safely back to camp.',
    progressKey: 'demonsExtracted',
    target: 1,
    reward: Object.freeze({ type: 'xp', value: 20 }),
    href: '/dungeon'
  }),
  Object.freeze({
    id: 'trial-of-the-few',
    icon: 'shield',
    title: 'Trial of the Few',
    meta: 'Win at floor 3+ with at least one open team slot.',
    progressKey: 'undermannedWins',
    target: 1,
    requirements: Object.freeze([
      Object.freeze({ icon: 'layers', label: 'Floor 3+' }),
      Object.freeze({ icon: 'user-minus', label: 'Open slot' })
    ]),
    reward: Object.freeze({ type: 'souls', value: 25 }),
    href: '/dungeon'
  })
]);

const DAILY_REWARD = Object.freeze({
  id: 'campfire-cache',
  title: 'Lost Souls',
  reward: Object.freeze({ type: 'souls', value: 10 })
});

async function getDailyQuestState(playerId, queryable = db, now = new Date()) {
  const questDate = getUtcQuestDate(now);
  await ensureDailyQuestRow(queryable, playerId, questDate);

  const [rows] = await queryable.query(
    `SELECT dungeon_wins AS dungeonWins,
            demons_extracted AS demonsExtracted,
            undermanned_wins AS undermannedWins,
            claimed_quests AS claimedQuests,
            daily_reward_claimed AS dailyRewardClaimed
     FROM player_daily_quests
     WHERE player_id = ? AND quest_date = ?
     LIMIT 1`,
    [playerId, questDate]
  );

  return serializeDailyQuestState(rows[0] || {}, now);
}

async function recordDailyQuestProgress(playerId, progress = {}, queryable = db, now = new Date()) {
  const questDate = getUtcQuestDate(now);
  const dungeonWins = toPositiveInteger(progress.dungeonWins);
  const demonsExtracted = toPositiveInteger(progress.demonsExtracted);
  const undermannedWins = toPositiveInteger(progress.undermannedWins);

  await queryable.query(
    `INSERT INTO player_daily_quests
       (player_id, quest_date, dungeon_wins, demons_extracted, undermanned_wins, claimed_quests)
     VALUES (?, ?, ?, ?, ?, '[]')
     ON DUPLICATE KEY UPDATE
       dungeon_wins = dungeon_wins + VALUES(dungeon_wins),
       demons_extracted = demons_extracted + VALUES(demons_extracted),
       undermanned_wins = undermanned_wins + VALUES(undermanned_wins)`,
    [playerId, questDate, dungeonWins, demonsExtracted, undermannedWins]
  );
}

async function claimDailyQuest(playerId, questId, now = new Date()) {
  const definition = QUEST_DEFINITIONS.find((quest) => quest.id === questId);
  if (!definition) {
    throw createHttpError('Quest not found.', 404);
  }

  const connection = await db.getConnection();
  let progression;
  try {
    await connection.beginTransaction();
    const questDate = getUtcQuestDate(now);
    const row = await lockDailyQuestRow(connection, playerId, questDate);
    const current = getQuestProgress(row, definition);
    const claimedQuestIds = parseClaimedQuestIds(row.claimedQuests);

    if (claimedQuestIds.has(definition.id)) {
      throw createHttpError('Quest reward already claimed.', 409);
    }
    if (current < definition.target) {
      throw createHttpError('Complete the quest before claiming its reward.', 409);
    }

    const player = await lockPlayer(connection, playerId);
    claimedQuestIds.add(definition.id);
    await connection.query(
      `UPDATE player_daily_quests
       SET claimed_quests = ?
       WHERE player_id = ? AND quest_date = ?`,
      [JSON.stringify([...claimedQuestIds]), playerId, questDate]
    );
    progression = await grantReward(connection, player, definition.reward);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    ...(await getDailyQuestState(playerId, db, now)),
    progression
  };
}

async function claimDailyReward(playerId, now = new Date()) {
  const connection = await db.getConnection();
  let progression;
  try {
    await connection.beginTransaction();
    const questDate = getUtcQuestDate(now);
    const row = await lockDailyQuestRow(connection, playerId, questDate);

    if (Boolean(Number(row.dailyRewardClaimed))) {
      throw createHttpError('Daily reward already claimed.', 409);
    }

    const player = await lockPlayer(connection, playerId);
    await connection.query(
      `UPDATE player_daily_quests
       SET daily_reward_claimed = 1
       WHERE player_id = ? AND quest_date = ?`,
      [playerId, questDate]
    );
    progression = await grantReward(connection, player, DAILY_REWARD.reward);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    ...(await getDailyQuestState(playerId, db, now)),
    progression
  };
}

async function lockDailyQuestRow(connection, playerId, questDate) {
  await ensureDailyQuestRow(connection, playerId, questDate);
  const [rows] = await connection.query(
    `SELECT dungeon_wins AS dungeonWins,
            demons_extracted AS demonsExtracted,
            undermanned_wins AS undermannedWins,
            claimed_quests AS claimedQuests,
            daily_reward_claimed AS dailyRewardClaimed
     FROM player_daily_quests
     WHERE player_id = ? AND quest_date = ?
     LIMIT 1
     FOR UPDATE`,
    [playerId, questDate]
  );
  return rows[0];
}

async function lockPlayer(connection, playerId) {
  const [rows] = await connection.query(
    `SELECT id, level, xp, souls, highest_floor AS highestFloor
     FROM players
     WHERE id = ?
     LIMIT 1
     FOR UPDATE`,
    [playerId]
  );
  if (!rows.length) throw createHttpError('Player not found.', 404);
  return rows[0];
}

async function ensureDailyQuestRow(queryable, playerId, questDate) {
  await queryable.query(
    `INSERT INTO player_daily_quests (player_id, quest_date, claimed_quests)
     VALUES (?, ?, '[]')
     ON DUPLICATE KEY UPDATE player_id = VALUES(player_id)`,
    [playerId, questDate]
  );
}

async function grantReward(connection, player, reward) {
  const xpReward = reward.type === 'xp' ? toPositiveInteger(reward.value) : 0;
  const soulReward = reward.type === 'souls' ? toPositiveInteger(reward.value) : 0;
  const nextXp = toPositiveInteger(player.xp) + xpReward;
  const nextLevel = getNextAccountLevel(player.level, nextXp);
  const nextSouls = toPositiveInteger(player.souls) + soulReward;

  await connection.query(
    'UPDATE players SET xp = ?, souls = ?, level = ? WHERE id = ?',
    [nextXp, nextSouls, nextLevel, player.id]
  );

  return {
    level: nextLevel,
    xp: nextXp,
    souls: nextSouls,
    highestFloor: toPositiveInteger(player.highestFloor)
  };
}

function serializeDailyQuestState(row, now = new Date()) {
  const claimedQuestIds = parseClaimedQuestIds(row.claimedQuests);
  const dailyRewardClaimed = Boolean(Number(row.dailyRewardClaimed));

  return {
    period: {
      date: getUtcQuestDate(now),
      resetsAt: getNextUtcReset(now)
    },
    quests: QUEST_DEFINITIONS.map((definition) => {
      const current = Math.min(definition.target, getQuestProgress(row, definition));
      const claimed = claimedQuestIds.has(definition.id);
      const completed = current >= definition.target;

      return {
        id: definition.id,
        icon: definition.icon,
        title: definition.title,
        meta: definition.meta,
        current,
        target: definition.target,
        requirements: definition.requirements || [],
        reward: definition.reward,
        href: definition.href,
        completed,
        claimed,
        claimable: completed && !claimed
      };
    }),
    dailyReward: {
      ...DAILY_REWARD,
      claimed: dailyRewardClaimed,
      claimable: !dailyRewardClaimed
    }
  };
}

function getQuestProgress(row, definition) {
  return toPositiveInteger(row[definition.progressKey]);
}

function parseClaimedQuestIds(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch (error) {
    return new Set();
  }
}

function getUtcQuestDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getNextUtcReset(now = new Date()) {
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toISOString();
}

function qualifiesForTrialOfTheFew({ floor, teamSize, teamLimit } = {}) {
  const floorNumber = toPositiveInteger(floor);
  const size = toPositiveInteger(teamSize);
  const limit = toPositiveInteger(teamLimit);
  return floorNumber >= 3 && size > 0 && size < limit;
}

function toPositiveInteger(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function createHttpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  DAILY_REWARD,
  QUEST_DEFINITIONS,
  claimDailyQuest,
  claimDailyReward,
  getDailyQuestState,
  getNextUtcReset,
  getUtcQuestDate,
  qualifiesForTrialOfTheFew,
  recordDailyQuestProgress,
  serializeDailyQuestState
};
