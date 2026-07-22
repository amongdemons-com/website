const express = require('express');
const db = require('./lib/db');
const { blockGuests, cleanPlayer, requireAuth } = require('./lib/auth');
const {
  getAccountProgressionPayload,
  getAccountProgressionSummary,
  getNextAccountLevel
} = require('./lib/progression');
const { recordDailyQuestProgress } = require('./lib/daily-quests');
const {
  ANCHOR_SUCCESS_MESSAGE,
  getAmbushDefeatReturn,
  getBoundShrine,
  getShrineAt,
  getWorldShrines,
  saveBoundShrine
} = require('./lib/world-shrines');
const {
  calculateHuntRewards,
  createHuntSnapshot,
  getActiveWorldTeam,
  getActiveWorldTeamSummary,
  getBuffedHuntSoulCapacity,
  getWorldSoulReward,
  getWorldTerrorPreview,
  getWorldXpReward,
  saveActiveWorldTeam,
  simulateTryHunt,
  simulateWorldAmbush,
  simulateWorldBossChallenge,
  simulateWorldPvpChallenge
} = require('./lib/world-combat');
const {
  getActiveWorldBossById,
  getActiveWorldBosses,
  getActiveWorldBossRewardBuffs,
  getWorldBossAtFromList,
  grantWorldBossRewardBuff,
  serializeWorldBossForClient
} = require('./lib/world-bosses');
const { enrichCollectionDemonsWithTraining } = require('./lib/demon-training');
const { getPlayerStatPointSummary } = require('./lib/account-stat-points');
const achievements = require('./lib/achievements');
const worldMap = require('./data/map.json');

const router = express.Router();
const WORLD_MIN = worldMap.bounds?.min ?? -50;
const WORLD_MAX = worldMap.bounds?.max ?? 50;
const WORLD_SPAWN = worldMap.spawn || { x: 0, y: 0 };
const MAX_TRAVEL_STEPS = 256;
const CHALLENGE_COOLDOWN_MS = 30 * 1000;
const challengeCooldowns = new Map();
const DARKNESS_PORTAL_TYPE = 'darkness-portal';
const DEFAULT_DARKNESS_PORTAL_SUMMON_SOUL_COST_PER_DISTANCE = 2;

// World elements (events/objects, terrain blocks, passable signs, and demon-team
// encounters) live in data/map.json so the map can be regenerated without touching this route.
const WORLD_BLOCKS = Array.isArray(worldMap.blocks) ? worldMap.blocks : [];
const WORLD_ENCOUNTERS = Array.isArray(worldMap.encounters) ? worldMap.encounters : [];
const WORLD_EVENTS = Array.isArray(worldMap.events) ? worldMap.events : [];
const WORLD_ROADS = Array.isArray(worldMap.roads) ? worldMap.roads : [];
const ROAD_TILES = new Set(WORLD_ROADS.map((tile) => `${tile.x},${tile.y}`));
const BLOCKED_TILES = new Set(
  WORLD_BLOCKS
    .filter((tile) => !isSignBlock(tile))
    .map((tile) => `${tile.x},${tile.y}`)
);
const AMBUSH_CHANCE_OFF_ROAD = 7; // 1-in-N chance to be ambushed per eligible off-road step
const AMBUSH_CHANCE_ON_ROAD = 34; // roads are watched but far safer to travel

// The map layout never changes per player, so it is served once from
// /world/map with an immutable cache keyed by a content hash; /world/state
// only carries per-player data plus the current mapVersion so clients know
// which cached map to use (a new map.json produces a new hash → new URL).
const WORLD_MAP_PAYLOAD = {
  bounds: { min: WORLD_MIN, max: WORLD_MAX },
  events: WORLD_EVENTS,
  blockedTiles: WORLD_BLOCKS,
  roads: WORLD_ROADS,
  encounters: WORLD_ENCOUNTERS.map(serializeWorldEncounterForClient)
};
const WORLD_MAP_VERSION = require('crypto')
  .createHash('sha1')
  .update(JSON.stringify(WORLD_MAP_PAYLOAD))
  .digest('hex')
  .slice(0, 12);

router.get('/world/map', (req, res) => {
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.json({ ...WORLD_MAP_PAYLOAD, mapVersion: WORLD_MAP_VERSION });
});

router.get('/world/state', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);
  const activeBosses = getActiveWorldBosses();
  const [playersAt, activeWorldTeam, boundShrine, hunt] = await Promise.all([
    getPlayersAt(position.x, position.y, req.player.id),
    getActiveWorldTeam(req.player.id),
    getBoundShrine(req.player.id),
    getHuntState(req.player.id)
  ]);

  res.json({
    account: {
      player: req.player,
      progression: getAccountProgressionPayload(req.player)
    },
    progression: getAccountProgressionPayload(req.player),
    player: getWorldPlayer(req.player),
    position,
    mapVersion: WORLD_MAP_VERSION,
    shrines: getWorldShrines(),
    boundShrine,
    currentEvent: getEventAt(position.x, position.y),
    currentEncounter: serializeWorldEncounterForClient(getEncounterAt(position.x, position.y)),
    currentBoss: serializeWorldBossForClient(getWorldBossAtFromList(activeBosses, position.x, position.y)),
    bosses: activeBosses.map(serializeWorldBossForClient),
    playersAt,
    activeTeam: serializeTeamSummaryForClient(getActiveWorldTeamSummary(activeWorldTeam)),
    hunt
  });
});

router.get('/world/team', requireAuth, async (req, res) => {
  const [team, collection] = await Promise.all([
    getActiveWorldTeam(req.player.id),
    getWorldTeamCollection(req.player.id)
  ]);

  res.json({
    team,
    activeTeam: serializeTeamSummaryForClient(getActiveWorldTeamSummary(team)),
    collection
  });
});

router.post('/world/team', requireAuth, async (req, res) => {
  const saveResult = await saveActiveWorldTeam(req.player.id, req.body?.team || [], {
    includeChanged: true
  });
  const reset = saveResult.changed
    ? await settleActiveHunt(req.player, { clearUnlocks: true })
    : null;

  res.json({
    ok: true,
    team: saveResult.team,
    teamChanged: saveResult.changed,
    activeTeam: serializeTeamSummaryForClient(getActiveWorldTeamSummary(saveResult.team)),
    ...(reset ? {
      player: reset.player,
      progression: reset.progression,
      rewards: reset.rewards,
      huntingReset: {
        stoppedHunt: reset.stoppedHunt,
        clearedUnlocks: reset.clearedUnlocks
      },
      hunt: reset.hunt
    } : {})
  });
});

router.get('/world/shrine', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);

  res.json({
    position,
    currentShrine: getShrineAt(position.x, position.y),
    boundShrine: await getBoundShrine(req.player.id)
  });
});

router.post('/world/shrine/bind', requireAuth, async (req, res) => {
  const position = await getOrCreatePosition(req.player.id);
  const shrine = getShrineAt(position.x, position.y);

  if (!shrine) {
    return res.status(409).json({ error: 'Stand on a Forsaken Shrine to anchor your soul.' });
  }

  const boundShrine = await saveBoundShrine(req.player.id, shrine);
  await achievements.grantAchievements(req.player.id, ['anchored']);

  res.json({
    ok: true,
    position,
    currentShrine: shrine,
    boundShrine,
    message: ANCHOR_SUCCESS_MESSAGE
  });
});

router.post('/world/portal/summon', requireAuth, async (req, res) => {
  const requestedPosition = normalizePosition(req.body?.position || req.body);
  const portal = getDarknessPortalAt(requestedPosition.x, requestedPosition.y);

  if (!portal) {
    return res.status(404).json({ error: 'Choose a valid Darkness Portal.' });
  }

  const result = await summonToDarknessPortal(req.player.id, portal);
  await achievements.grantAchievements(req.player.id, ['through-darkness']);
  const position = result.position;
  const activeBosses = getActiveWorldBosses();

  res.json({
    ok: true,
    position,
    player: getWorldPlayer(result.player),
    currentEvent: getEventAt(position.x, position.y),
    currentEncounter: serializeWorldEncounterForClient(getEncounterAt(position.x, position.y)),
    currentBoss: serializeWorldBossForClient(getWorldBossAtFromList(activeBosses, position.x, position.y)),
    bosses: activeBosses.map(serializeWorldBossForClient),
    playersAt: await getPlayersAt(position.x, position.y, req.player.id),
    summonCost: result.summonCost,
    summonDistance: result.summonDistance,
    message: `Summoned to Area ${position.x}, ${position.y} for ${formatSoulCount(result.summonCost)}.`
  });
});

router.post('/world/move', requireAuth, async (req, res) => {
  const currentPosition = await getOrCreatePosition(req.player.id);
  const position = normalizePosition(req.body?.position || req.body);
  const path = normalizeTravelPath(req.body?.path);
  const activeBosses = getActiveWorldBosses();
  const travelEvents = path.length
    ? validateTravelPath(currentPosition, position, path, activeBosses)
    : [];
  const activeWorldTeam = await getActiveWorldTeam(req.player.id);

  if (!activeWorldTeam.length) {
    return res.status(409).json({
      error: "It's dangerous to travel alone. Assign a team before traveling."
    });
  }

  await savePosition(req.player.id, position);
  if ([WORLD_MIN, WORLD_MAX].includes(position.x) || [WORLD_MIN, WORLD_MAX].includes(position.y)) {
    await achievements.grantAchievements(req.player.id, ['edgewalker']);
  }

  const playersAt = await getPlayersAt(position.x, position.y, req.player.id);
  res.json({
    position,
    currentEvent: getEventAt(position.x, position.y),
    currentEncounter: serializeWorldEncounterForClient(getEncounterAt(position.x, position.y)),
    currentBoss: serializeWorldBossForClient(getWorldBossAtFromList(activeBosses, position.x, position.y)),
    bosses: activeBosses.map(serializeWorldBossForClient),
    playersAt,
    travelEvents: await resolveTravelEvents(req.player, travelEvents)
  });
});

router.post('/world/hunt/try', requireAuth, async (req, res) => {
  const encounter = getEncounterById(req.body?.encounterId);
  if (!encounter) {
    return res.status(404).json({ error: 'Demon spot not found.' });
  }

  const battle = await simulateTryHunt(req.player, encounter);
  const unlocked = battle.winner === 'player';

  if (unlocked) {
    await unlockHunt(req.player.id, encounter.id);
    await achievements.grantAchievements(req.player.id, [
      'hunters-ground',
      ...(getWorldTerrorPreview(encounter).level >= 20 ? ['far-from-the-fire'] : [])
    ]);
  }

  res.json({
    unlocked,
    battle,
    hunt: await getHuntState(req.player.id)
  });
});

router.post('/world/hunting/start', requireAuth, async (req, res) => {
  const encounter = getEncounterById(req.body?.encounterId);
  if (!encounter) {
    return res.status(404).json({ error: 'Demon spot not found.' });
  }

  if (!(await isHuntUnlocked(req.player.id, encounter.id))) {
    return res.status(409).json({ error: 'Win a fight before starting passive hunting.' });
  }

  const active = await getActiveHunt(req.player.id);
  if (active) {
    return res.status(409).json({ error: 'Stop your current hunt before starting another.' });
  }

  const snapshot = await createHuntSnapshot(req.player, encounter);
  await db.query(
    `INSERT INTO player_active_hunts
       (player_id, encounter_id, snapshot, started_at, enemy_respawn_seconds)
     VALUES (?, ?, ?, FROM_UNIXTIME(?), ?)`,
    [
      req.player.id,
      encounter.id,
      JSON.stringify(snapshot),
      Math.floor(Date.parse(snapshot.startedAt) / 1000),
      snapshot.killSeconds ?? snapshot.enemyRespawnSeconds
    ]
  );
  await recordDailyQuestProgress(req.player.id, { huntsStarted: 1 });
  await achievements.grantAchievements(req.player.id, ['the-long-hunt']);

  res.json({
    ok: true,
    hunt: await getHuntState(req.player.id)
  });
});

router.post('/world/hunting/stop', requireAuth, async (req, res) => {
  res.json(await settleActiveHunt(req.player));
});

router.get('/world/hunting/status', requireAuth, async (req, res) => {
  res.json(await getHuntState(req.player.id));
});

router.post('/world/ambush-defeat', requireAuth, async (req, res) => {
  const result = getAmbushDefeatReturn(await getBoundShrine(req.player.id));
  const activeBosses = getActiveWorldBosses();

  await savePosition(req.player.id, result.position);
  await achievements.grantAchievements(req.player.id, ['death-has-an-address']);

  res.json({
    ...result,
    currentEvent: getEventAt(result.position.x, result.position.y),
    currentEncounter: serializeWorldEncounterForClient(getEncounterAt(result.position.x, result.position.y)),
    currentBoss: serializeWorldBossForClient(getWorldBossAtFromList(activeBosses, result.position.x, result.position.y)),
    bosses: activeBosses.map(serializeWorldBossForClient),
    playersAt: await getPlayersAt(result.position.x, result.position.y, req.player.id)
  });
});

router.get('/world/players-at', requireAuth, async (req, res) => {
  const position = normalizePosition(req.query);
  res.json({
    position,
    playersAt: await getPlayersAt(position.x, position.y, req.player.id)
  });
});

router.post('/world/boss/challenge', requireAuth, async (req, res) => {
  const bossId = String(req.body?.bossId || '').trim();

  if (!bossId) {
    return res.status(400).json({ error: 'Choose a boss to challenge.' });
  }

  const [position, activeWorldTeam] = await Promise.all([
    getOrCreatePosition(req.player.id),
    getActiveWorldTeam(req.player.id)
  ]);
  const boss = getActiveWorldBossById(bossId);

  if (!boss) {
    return res.status(404).json({ error: 'World boss not found.' });
  }

  if (!positionsEqual(position, boss)) {
    return res.status(409).json({ error: 'That boss has moved to another area.' });
  }

  if (!activeWorldTeam.length) {
    return res.status(409).json({ error: 'Choose a world team before challenging a boss.' });
  }

  const battle = await simulateWorldBossChallenge(req.player, boss);
  const rewardBuff = battle.winner === 'player'
    ? await grantWorldBossRewardBuff(req.player.id, boss)
    : null;
  if (rewardBuff) battle.rewardBuff = rewardBuff;
  if (battle.winner === 'player') {
    await achievements.grantBossDefeat(req.player.id, boss.id);
  }

  const activeBosses = getActiveWorldBosses();
  const serializedBoss = serializeWorldBossForClient(boss);

  res.json({
    ok: true,
    status: 'resolved',
    boss: serializedBoss,
    currentBoss: serializeWorldBossForClient(getWorldBossAtFromList(activeBosses, position.x, position.y)),
    bosses: activeBosses.map(serializeWorldBossForClient),
    rewardBuff,
    battle,
    message: battle.winner === 'player'
      ? `You defeated ${boss.title}. ${rewardBuff ? `${rewardBuff.name} is active for ${formatDurationHours(rewardBuff.durationHours)}.` : ''}`.trim()
      : `${boss.title} endured the challenge.`
  });
});

router.post('/world/challenge', requireAuth, blockGuests, async (req, res) => {
  const targetPlayerId = String(req.body?.targetPlayerId || '').trim();

  if (!targetPlayerId) {
    return res.status(400).json({ error: 'Choose a player to challenge.' });
  }

  if (targetPlayerId === String(req.player.id)) {
    return res.status(400).json({ error: 'Choose another hunter to challenge.' });
  }

  const [currentPosition, targetPosition, targetPlayer] = await Promise.all([
    getOrCreatePosition(req.player.id),
    getExistingPosition(targetPlayerId),
    getPlayerById(targetPlayerId)
  ]);

  if (!targetPlayer || !targetPosition) {
    return res.status(404).json({ error: 'That hunter is no longer here.' });
  }

  if (!positionsEqual(currentPosition, targetPosition)) {
    return res.status(409).json({ error: 'That hunter moved away.' });
  }

  const cooldownKey = `${req.player.id}:${targetPlayerId}`;
  const cooldownUntil = challengeCooldowns.get(cooldownKey) || 0;

  if (cooldownUntil > Date.now()) {
    return res.status(429).json({
      error: 'Challenge cooldown is active.',
      cooldownUntil: new Date(cooldownUntil).toISOString()
    });
  }

  const battle = await simulateWorldPvpChallenge(req.player, targetPlayer);
  const pvpResult = await recordPvpChallengeResult(req.player.id, targetPlayer.id, battle.winner);
  if (battle.winner === 'player') {
    await recordDailyQuestProgress(req.player.id, { pvpWins: 1 });
  }
  const nextCooldownUntil = Date.now() + CHALLENGE_COOLDOWN_MS;
  challengeCooldowns.set(cooldownKey, nextCooldownUntil);
  const updatedPlayer = pvpResult.players.get(String(req.player.id)) || req.player;
  const updatedTargetPlayer = pvpResult.players.get(String(targetPlayer.id)) || targetPlayer;
  if (battle.winner === 'player') {
    await achievements.checkPvpWins(req.player.id, updatedPlayer.pvpWins);
    const flawless = Array.isArray(battle.playerTeamAfter)
      && battle.playerTeamAfter.every((demon) => Number(demon.hp) > 0);
    if (flawless) {
      await achievements.grantAchievements(req.player.id, ['untouchable']);
    }
  } else {
    // The defender's win counter also moved; their threshold achievements
    // unlock the next time either side is checked.
    await achievements.checkPvpWins(targetPlayer.id, updatedTargetPlayer.pvpWins);
  }
  battle.targetPlayer = {
    ...battle.targetPlayer,
    ...getWorldPvpPlayerRecord(updatedTargetPlayer)
  };

  res.json({
    ok: true,
    status: 'resolved',
    player: getWorldPlayer(updatedPlayer),
    targetPlayer: battle.targetPlayer,
    battle,
    message: battle.winner === 'player'
      ? `You defeated ${targetPlayer.username || 'that hunter'}.`
      : `${targetPlayer.username || 'That hunter'} won the challenge.`,
    cooldownUntil: new Date(nextCooldownUntil).toISOString()
  });
});

async function recordPvpChallengeResult(attackerPlayerId, targetPlayerId, winner) {
  const attackerWon = winner === 'player';
  const winnerId = attackerWon ? attackerPlayerId : targetPlayerId;
  const loserId = attackerWon ? targetPlayerId : attackerPlayerId;
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    await connection.query(
      'UPDATE players SET pvp_wins = pvp_wins + 1 WHERE id = ?',
      [winnerId]
    );
    await connection.query(
      'UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id = ?',
      [loserId]
    );

    const [rows] = await connection.query(
      `SELECT p.*, pd.image_url AS profile_demon_image_url
       FROM players p
       LEFT JOIN player_demons pd
         ON pd.id = p.profile_demon_id
        AND pd.player_id = p.id
       WHERE p.id IN (?, ?)`,
      [attackerPlayerId, targetPlayerId]
    );

    await connection.commit();
    committed = true;

    return {
      players: new Map(rows.map((row) => [String(row.id), cleanPlayer(row)]))
    };
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function getOrCreatePosition(playerId) {
  const [rows] = await db.query(
    'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1',
    [playerId]
  );

  if (rows.length) {
    const position = normalizePosition(rows[0], { allowBlocked: true });
    if (!isBlocked(position.x, position.y)) return position;

    const fallbackPosition = { ...WORLD_SPAWN };
    await savePosition(playerId, fallbackPosition);
    return fallbackPosition;
  }

  const position = { ...WORLD_SPAWN };
  await savePosition(playerId, position);
  return position;
}

async function savePosition(playerId, position, client = db) {
  // TODO: Move persistence into a world service once exploration has server-side rules.
  await client.query(
    `INSERT INTO player_world_positions (player_id, x, y)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE x = VALUES(x), y = VALUES(y), updated_at = CURRENT_TIMESTAMP`,
    [playerId, position.x, position.y]
  );
}

async function getExistingPosition(playerId) {
  const [rows] = await db.query(
    'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1',
    [playerId]
  );
  if (!rows.length) return null;
  return normalizePosition(rows[0], { allowBlocked: true });
}

async function getPlayerById(playerId) {
  const [rows] = await db.query(
    `SELECT p.*, pd.image_url AS profile_demon_image_url
     FROM players p
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [playerId]
  );

  return rows[0] ? cleanPlayer(rows[0]) : null;
}

async function getPlayersAt(x, y, currentPlayerId) {
  const [rows] = await db.query(
    `SELECT p.id,
            p.username,
            p.level,
            p.pvp_wins AS pvpWins,
            p.pvp_losses AS pvpLosses,
            wp.x,
            wp.y,
            (
              SELECT COUNT(*)
              FROM player_world_teams pwt_count
              WHERE pwt_count.player_id = wp.player_id
            ) AS teamCount
     FROM player_world_positions wp
     INNER JOIN players p ON p.id = wp.player_id
     WHERE wp.x = ?
       AND wp.y = ?
       AND wp.player_id <> ?
       AND EXISTS (
         SELECT 1
         FROM player_world_teams pwt
         WHERE pwt.player_id = wp.player_id
       )
     ORDER BY wp.updated_at DESC
     LIMIT 8`,
    [x, y, currentPlayerId]
  );

  return rows.map((player) => ({
    id: player.id,
    username: player.username || 'Unknown Hunter',
    level: Math.max(1, Number(player.level) || 1),
    ...getWorldPvpPlayerRecord(player),
    teamCount: Math.max(0, Number(player.teamCount) || 0),
    x: Number(player.x) || 0,
    y: Number(player.y) || 0
  }));
}

async function summonToDarknessPortal(playerId, portal) {
  const position = normalizePosition(portal);
  const connection = await db.getConnection();
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
      [playerId]
    );

    if (!playerRows.length) {
      throwWorldError('Player not found.', 404);
    }

    const currentPosition = await getSummonCurrentPosition(playerId, connection);
    const summonDistance = getTileDistance(currentPosition, position);
    const summonCost = getDarknessPortalSummonCost(portal, currentPosition);
    const availableSouls = Math.max(0, Number(playerRows[0].souls) || 0);
    if (availableSouls < summonCost) {
      throwWorldError(`Not enough Souls. Summon costs ${formatSoulCount(summonCost)}.`, 409);
    }

    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [summonCost, playerId]
    );
    await savePosition(playerId, position, connection);

    const [updatedRows] = await connection.query(
      `SELECT p.*, pd.image_url AS profile_demon_image_url
       FROM players p
       LEFT JOIN player_demons pd
         ON pd.id = p.profile_demon_id
        AND pd.player_id = p.id
       WHERE p.id = ?
       LIMIT 1`,
      [playerId]
    );

    await connection.commit();
    committed = true;

    return {
      position,
      summonCost,
      summonDistance,
      player: cleanPlayer(updatedRows[0] || {
        ...playerRows[0],
        souls: Math.max(0, availableSouls - summonCost)
      })
    };
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function getActiveTeamSummary(playerId) {
  return serializeTeamSummaryForClient(getActiveWorldTeamSummary(await getActiveWorldTeam(playerId)));
}

async function getWorldTeamCollection(playerId) {
  const [rows] = await db.query(
    `SELECT id,
            source_demon_id AS sourceDemonId,
            type_id AS typeId,
            species,
            rarity,
            image_url AS imageUrl,
            hp,
            atk,
            speed,
            created_at AS createdAt
     FROM player_demons
     WHERE player_id = ?
     ORDER BY created_at DESC, id DESC`,
    [playerId]
  );

  return enrichCollectionDemonsWithTraining(rows);
}

async function resolveTravelEvents(player, travelEvents = []) {
  const resolved = [];

  for (const event of travelEvents) {
    if (event.type !== 'ambush') {
      resolved.push(event);
      continue;
    }

    let battle = null;
    try {
      battle = await simulateWorldAmbush(player, event.position, WORLD_ENCOUNTERS);
    } catch (error) {
      if (!error.status || error.status >= 500) throw error;
      battle = {
        error: error.message
      };
    }
    if (battle?.winner === 'player' && !isRoad(event.position.x, event.position.y)) {
      await achievements.grantAchievements(player.id, ['road-less-travelled']);
    }
    resolved.push({
      ...event,
      battle
    });
  }

  return resolved;
}

async function settleActiveHunt(player, options = {}) {
  const clearUnlocks = Boolean(options.clearUnlocks);
  const connection = await db.getConnection();
  let committed = false;
  let rewards = createEmptyHuntRewards();
  let stoppedHunt = false;
  let clearedUnlocks = 0;
  let settledLevel = null;
  let settledPreviousLevel = null;
  // `player` is req.player, which requireAuth already passed through cleanPlayer.
  // The DB row fetched below is the raw shape that still needs cleaning.
  let playerPayload = player;

  try {
    await connection.beginTransaction();

    const [huntRows] = await connection.query(
      'SELECT * FROM player_active_hunts WHERE player_id = ? LIMIT 1 FOR UPDATE',
      [player.id]
    );

    if (huntRows.length) {
      const snapshot = parseHuntSnapshot(huntRows[0].snapshot);
      // Live capacity so vessel points spent mid-hunt apply to the payout.
      const soulCapacity = await getLiveHuntSoulCapacity(player);
      rewards = await calculateHuntRewards(snapshot, new Date(), { soulCapacity });

      const [lockedRows] = await connection.query(
        'SELECT level, xp FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
        [player.id]
      );
      const currentLevel = Number(lockedRows[0]?.level) || 1;
      const currentXp = Number(lockedRows[0]?.xp) || 0;
      const nextXp = currentXp + (Number(rewards.xp) || 0);
      const nextLevel = getNextAccountLevel(currentLevel, nextXp);

      await connection.query(
        'UPDATE players SET xp = ?, souls = souls + ?, level = ? WHERE id = ?',
        [nextXp, rewards.souls, nextLevel, player.id]
      );
      await connection.query(
        'DELETE FROM player_active_hunts WHERE player_id = ?',
        [player.id]
      );

      stoppedHunt = true;
      settledLevel = nextLevel;
      settledPreviousLevel = currentLevel;
    }

    if (clearUnlocks) {
      const [result] = await connection.query(
        'DELETE FROM player_hunt_unlocks WHERE player_id = ?',
        [player.id]
      );
      clearedUnlocks = Number(result?.affectedRows) || 0;
    }

    const [playerRows] = await connection.query(
      'SELECT * FROM players WHERE id = ? LIMIT 1',
      [player.id]
    );
    playerPayload = playerRows[0] ? cleanPlayer(playerRows[0]) : playerPayload;

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

  if (stoppedHunt) {
    const soulCapacity = Number(rewards.soulCapacity) || 0;
    if (soulCapacity > 0 && Number(rewards.souls) >= soulCapacity) {
      await achievements.grantAchievements(player.id, ['vessel-brimming']);
    }
    await achievements.checkAccountLevel(player.id, settledLevel);
  }

  return {
    ok: true,
    alreadyStopped: !stoppedHunt,
    stoppedHunt,
    rewards,
    player: playerPayload,
    progression: stoppedHunt ? {
      ...getAccountProgressionSummary(settledLevel, playerPayload.xp, {
        previousLevel: settledPreviousLevel
      }),
      souls: playerPayload.souls
    } : undefined,
    clearedUnlocks,
    hunt: await getHuntState(player.id)
  };
}

async function getHuntState(playerId) {
  const [unlockRows, activeRows] = await Promise.all([
    db.query('SELECT encounter_id AS encounterId, unlocked_at AS unlockedAt FROM player_hunt_unlocks WHERE player_id = ?', [playerId]),
    db.query('SELECT encounter_id AS encounterId, snapshot, started_at AS startedAt, enemy_respawn_seconds AS enemyRespawnSeconds FROM player_active_hunts WHERE player_id = ? LIMIT 1', [playerId])
  ]);
  const active = activeRows[0][0] || null;
  const liveCapacityState = active
    ? await getLiveHuntCapacityState({ id: playerId })
    : null;

  return {
    unlockedEncounterIds: unlockRows[0].map((row) => row.encounterId),
    active: active ? serializeActiveHunt(
      active,
      liveCapacityState.soulCapacity,
      liveCapacityState.recheckAt
    ) : null
  };
}

async function getLiveHuntSoulCapacity(player) {
  return (await getLiveHuntCapacityState(player)).soulCapacity;
}

async function getLiveHuntCapacityState(player) {
  const [statSummary, activeBossBuffs] = await Promise.all([
    getPlayerStatPointSummary(player),
    getActiveWorldBossRewardBuffs(player)
  ]);
  const capacityBuffExpirations = activeBossBuffs
    .filter((buff) => (buff.effects || []).some((effect) => effect.type === 'soul_capacity_mult'))
    .map((buff) => Date.parse(buff.expiresAt || ''))
    .filter(Number.isFinite)
    .sort((left, right) => left - right);

  return {
    soulCapacity: getBuffedHuntSoulCapacity(statSummary, activeBossBuffs),
    recheckAt: capacityBuffExpirations.length
      ? new Date(capacityBuffExpirations[0]).toISOString()
      : null
  };
}

async function isHuntUnlocked(playerId, encounterId) {
  const [rows] = await db.query(
    'SELECT 1 FROM player_hunt_unlocks WHERE player_id = ? AND encounter_id = ? LIMIT 1',
    [playerId, encounterId]
  );
  return rows.length > 0;
}

async function unlockHunt(playerId, encounterId) {
  await db.query(
    `INSERT INTO player_hunt_unlocks (player_id, encounter_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE unlocked_at = unlocked_at`,
    [playerId, encounterId]
  );
}

async function getActiveHunt(playerId) {
  const [rows] = await db.query(
    'SELECT encounter_id AS encounterId, snapshot, started_at AS startedAt, enemy_respawn_seconds AS enemyRespawnSeconds FROM player_active_hunts WHERE player_id = ? LIMIT 1',
    [playerId]
  );
  return rows[0] || null;
}

function serializeActiveHunt(row, liveSoulCapacity = null, capacityRecheckAt = null) {
  const snapshot = parseHuntSnapshot(row.snapshot);
  const killSeconds = getSnapshotKillSeconds(snapshot, row.enemyRespawnSeconds);
  const difficulty = Math.max(1, Number(snapshot.encounter?.difficulty) || 1);
  const xpReward = snapshot.encounter
    ? getWorldXpReward(snapshot.encounter, difficulty, snapshot.xpReward)
    : snapshot.xpReward || null;
  const xpPerCycle = getSnapshotNonNegativeInteger(
    xpReward?.xpPerCycle,
    snapshot.xpPerCycle ?? snapshot.xpPerKill ?? 5 + difficulty * 2
  );
  const fallbackSoulCount = Array.isArray(snapshot.targetEnemyTeam)
    ? snapshot.targetEnemyTeam.length
    : Math.max(1, Math.ceil(difficulty / 2));
  const defeatedDemonsPerCycle = getSnapshotNonNegativeInteger(
    snapshot.defeatedDemonsPerCycle ?? snapshot.soulReward?.baseSouls,
    fallbackSoulCount
  );
  const soulsPerCycle = getSnapshotNonNegativeInteger(
    defeatedDemonsPerCycle,
    snapshot.soulsPerCycle ?? snapshot.soulsPerKill ?? fallbackSoulCount
  );
  const battleMetrics = snapshot.battleMetrics || {};

  // Live capacity wins so vessel points spent mid-hunt show up immediately;
  // the value snapshotted at hunt start only covers legacy snapshots.
  const soulCapacity = Number(liveSoulCapacity ?? snapshot.soulCapacity);

  return {
    encounterId: row.encounterId,
    startedAt: snapshot.startedAt || row.startedAt,
    killSeconds,
    enemyRespawnSeconds: killSeconds,
    xpPerCycle,
    soulsPerCycle,
    defeatedDemonsPerCycle,
    soulCapacity: Number.isFinite(soulCapacity) && soulCapacity > 0 ? Math.floor(soulCapacity) : null,
    capacityRecheckAt,
    xpReward,
    soulReward: snapshot.soulReward || null,
    terror: snapshot.terror || null,
    combatSecondsAt1x: killSeconds,
    combatTicks: Math.max(0, Number(battleMetrics.ticks) || 0),
    combatLogSteps: Math.max(0, Number(battleMetrics.combatLogSteps) || 0),
    activeTeamCount: Array.isArray(snapshot.activeTeam) ? snapshot.activeTeam.length : 0,
    activeBuffs: Array.isArray(snapshot.activeSkillTreeBuffs) ? snapshot.activeSkillTreeBuffs : [],
    enemyBuffs: Array.isArray(snapshot.activeWorldTerrorBuffs) ? snapshot.activeWorldTerrorBuffs : []
  };
}

function serializeWorldEncounterForClient(encounter) {
  if (!encounter) return null;
  const defeatedDemons = Array.isArray(encounter.team) ? encounter.team.length : 0;

  return {
    ...encounter,
    keyDemon: encounter.keyDemon
      ? { ...encounter.keyDemon, imageUrl: toWorldMapImageUrl(encounter.keyDemon.imageUrl) }
      : encounter.keyDemon,
    team: Array.isArray(encounter.team)
      ? encounter.team.map((member) => ({ ...member, imageUrl: toWorldMapImageUrl(member.imageUrl) }))
      : encounter.team,
    terror: getWorldTerrorPreview(encounter),
    xpReward: getWorldXpReward(encounter, Math.max(1, Number(encounter.difficulty) || 1)),
    soulReward: getWorldSoulReward(encounter, defeatedDemons)
  };
}

// The world map and side panels render demon art as small tokens/avatars, so
// they get lightweight WebP variants (scripts/generate-demon-map-variants.js)
// instead of the multi-megabyte battle-card PNGs. Unknown URLs pass through.
function toWorldMapImageUrl(url) {
  const match = /^\/app\/images\/demons\/(?:thumbnails\/)?(\d+)\.png$/.exec(String(url || ''));
  return match ? `/app/images/demons/map/${match[1]}.webp` : url;
}

function serializeTeamSummaryForClient(summary) {
  if (!summary || !Array.isArray(summary.members)) return summary;
  return {
    ...summary,
    members: summary.members.map((member) => ({ ...member, imageUrl: toWorldMapImageUrl(member.imageUrl) }))
  };
}

function getSnapshotKillSeconds(snapshot = {}, fallback) {
  const explicit = Number(snapshot.killSeconds ?? snapshot.enemyRespawnSeconds ?? fallback);
  return Number.isFinite(explicit) && explicit > 0 ? Math.floor(explicit) : 300;
}

function getSnapshotNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  if (Number.isFinite(number) && number >= 0) return Math.floor(number);
  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) && fallbackNumber >= 0 ? Math.floor(fallbackNumber) : 0;
}

function parseHuntSnapshot(value) {
  try {
    return JSON.parse(value || '{}');
  } catch (error) {
    return {};
  }
}

function createEmptyHuntRewards() {
  return {
    elapsedSeconds: 0,
    cycles: 0,
    wins: 0,
    xp: 0,
    souls: 0,
    soulCapacity: null,
    soulsLost: 0
  };
}

function getWorldPlayer(player) {
  return {
    id: player.id,
    username: player.username || 'Hunter',
    level: Math.max(1, Number(player.level) || 1),
    souls: Math.max(0, Number(player.souls) || 0),
    ...getWorldPvpPlayerRecord(player),
    profileDemonImageUrl: player.profileDemonImageUrl || null,
    isGuest: Boolean(player.isGuest)
  };
}

function getWorldPvpPlayerRecord(player = {}) {
  return {
    pvpWins: Math.max(0, Number(player.pvpWins ?? player.pvp_wins) || 0),
    pvpLosses: Math.max(0, Number(player.pvpLosses ?? player.pvp_losses) || 0)
  };
}

function getEventAt(x, y) {
  return WORLD_EVENTS.find((event) => event.x === x && event.y === y) || null;
}

function getSignAt(x, y) {
  return WORLD_BLOCKS.find((block) => (
    block.x === x && block.y === y && isSignBlock(block)
  )) || null;
}

function isSignBlock(block) {
  return String(block?.type || '').trim().toLowerCase() === 'sign';
}

function getDarknessPortalAt(x, y) {
  const event = getEventAt(x, y);
  return event?.type === DARKNESS_PORTAL_TYPE ? event : null;
}

async function getSummonCurrentPosition(playerId, client = db) {
  const [rows] = await client.query(
    'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1 FOR UPDATE',
    [playerId]
  );

  if (!rows.length) return { ...WORLD_SPAWN };

  const position = normalizePosition(rows[0], { allowBlocked: true });
  return isBlocked(position.x, position.y) ? { ...WORLD_SPAWN } : position;
}

function getDarknessPortalSummonCost(portal = {}, fromPosition = WORLD_SPAWN) {
  return getTileDistance(fromPosition, portal) * getDarknessPortalSummonCostPerDistance(portal);
}

function getDarknessPortalSummonCostPerDistance(portal = {}) {
  const cost = Number(portal.summonCostPerDistance);
  return Number.isFinite(cost) && cost >= 0
    ? Math.floor(cost)
    : DEFAULT_DARKNESS_PORTAL_SUMMON_SOUL_COST_PER_DISTANCE;
}

function getTileDistance(from = {}, to = {}) {
  return Math.abs(Number(to.x) - Number(from.x)) + Math.abs(Number(to.y) - Number(from.y));
}

function formatSoulCount(value) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return `${count} Soul${count === 1 ? '' : 's'}`;
}

function formatDurationHours(value) {
  const hours = Math.max(0, Number(value) || 0);
  if (!hours) return '24h';
  if (hours % 1 === 0) return `${hours}h`;
  return `${Math.round(hours * 10) / 10}h`;
}

function getEncounterAt(x, y) {
  return WORLD_ENCOUNTERS.find((encounter) => encounter.x === x && encounter.y === y) || null;
}

function getEncounterById(encounterId) {
  const id = String(encounterId || '').trim();
  if (!id) return null;
  return WORLD_ENCOUNTERS.find((encounter) => String(encounter.id) === id) || null;
}

function normalizeTravelPath(value) {
  if (value === undefined) return [];

  if (!Array.isArray(value)) {
    throwWorldError('Travel path must be an array of coordinates.');
  }

  if (value.length > MAX_TRAVEL_STEPS + 1) {
    throwWorldError(`Travel path cannot exceed ${MAX_TRAVEL_STEPS} steps.`);
  }

  return value.map((position, index) => normalizePosition(position, { allowBlocked: index === 0 }));
}

function validateTravelPath(currentPosition, requestedPosition, path, activeBosses = []) {
  if (path.length < 2) {
    throwWorldError('Travel path must include a start and destination.');
  }

  if (!positionsEqual(path[0], currentPosition)) {
    throwWorldError('World position changed. Refresh the map and try again.', 409);
  }

  if (!positionsEqual(path[path.length - 1], requestedPosition)) {
    throwWorldError('Travel path destination does not match requested position.');
  }

  path.slice(1).forEach((position, index) => {
    const previous = path[index];
    if (!areAdjacent(previous, position)) {
      throwWorldError('Travel path must move one tile at a time.');
    }
  });

  // TODO: Replace deterministic placeholder rolls with persisted world-event results.
  return path.slice(1).map((position, index) => ({
    ...resolveTravelStepEvent(position, index + 1, activeBosses),
    position
  }));
}

function resolveTravelStepEvent(position, stepIndex, activeBosses = []) {
  if (!isAmbushEligibleTile(position.x, position.y, activeBosses)) {
    return { type: 'none', title: 'No Event' };
  }

  const ambushChance = getAmbushChanceForTile(position.x, position.y);
  const roll = (getTileNoise(position.x, position.y) + stepIndex * 17) % ambushChance;
  return roll === 0
    ? { type: 'ambush', title: 'Ambush' }
    : { type: 'none', title: 'No Event' };
}

function getAmbushChanceForTile(x, y) {
  return isRoad(x, y) ? AMBUSH_CHANCE_ON_ROAD : AMBUSH_CHANCE_OFF_ROAD;
}

function isAmbushEligibleTile(x, y, activeBosses = []) {
  return !getEventAt(x, y) &&
    !getSignAt(x, y) &&
    !getEncounterAt(x, y) &&
    !getWorldBossAtFromList(activeBosses, x, y);
}

function normalizePosition(value = {}, options = {}) {
  const x = normalizeCoordinate(value.x);
  const y = normalizeCoordinate(value.y);

  if (x < WORLD_MIN || x > WORLD_MAX || y < WORLD_MIN || y > WORLD_MAX) {
    throwWorldError(`World coordinates must be between ${WORLD_MIN} and ${WORLD_MAX}.`);
  }

  if (!options.allowBlocked && isBlocked(x, y)) {
    throwWorldError('That world tile is blocked.');
  }

  return { x, y };
}

function positionsEqual(a, b) {
  return Number(a?.x) === Number(b?.x) && Number(a?.y) === Number(b?.y);
}

function areAdjacent(a, b) {
  return Math.abs(Number(a.x) - Number(b.x)) + Math.abs(Number(a.y) - Number(b.y)) === 1;
}

function isBlocked(x, y) {
  return BLOCKED_TILES.has(`${x},${y}`);
}

function isRoad(x, y) {
  return ROAD_TILES.has(`${x},${y}`);
}

function getTileNoise(x, y) {
  return ((x * 73856093) ^ (y * 19349663)) >>> 0;
}

function normalizeCoordinate(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throwWorldError('World coordinates must be integers.');
  }

  return number;
}

function throwWorldError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

router._test = {
  getDarknessPortalAt,
  getDarknessPortalSummonCost,
  getSignAt,
  getAmbushChanceForTile,
  isBlocked,
  isAmbushEligibleTile,
  resolveTravelStepEvent
};

module.exports = router;
