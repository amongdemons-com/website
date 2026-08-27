const fs = require('fs');
const path = require('path');
const db = require('./db');
const { normalizeCombatBuffState } = require('./combat-buffs');

const BOSS_DATA_PATH = path.join(__dirname, '..', 'data', 'world-bosses.json');
const worldMap = require('../data/map.json');
const demonTypes = require('../data/demon-types.json');
const demonAssets = require('../data/demons.json');

const TYPE_COUNT = 11;
const ZONE_START_RADIUS = 24;
const ZONE_ROTATION = 0.045;
const ZONE_TYPE_REMAP = { 4: 5, 5: 4 };
const DEFAULT_MOVE_INTERVAL_SECONDS = 3600;
const DEFAULT_REWARD_DURATION_HOURS = 24;
const WORLD_SPAWN = worldMap.spawn || { x: 0, y: 0 };
const WORLD_MIN = worldMap.bounds?.min ?? -50;
const WORLD_MAX = worldMap.bounds?.max ?? 50;
const STATIC_OCCUPIED_TILES = new Set([
  ...(Array.isArray(worldMap.blocks) ? worldMap.blocks : []),
  ...(Array.isArray(worldMap.events) ? worldMap.events : []),
  ...(Array.isArray(worldMap.encounters) ? worldMap.encounters : [])
].map((tile) => tileKey(tile.x, tile.y)));
const candidateCache = new Map();

function loadWorldBosses() {
  const config = readBossConfig();
  const defaults = {
    moveIntervalSeconds: getPositiveInteger(config.moveIntervalSeconds, DEFAULT_MOVE_INTERVAL_SECONDS),
    rewardDurationHours: getPositiveNumber(config.rewardDurationHours, DEFAULT_REWARD_DURATION_HOURS)
  };
  const seen = new Set();

  return (Array.isArray(config.bosses) ? config.bosses : [])
    .map((boss, index) => normalizeBossDefinition(boss, index, defaults))
    .filter(Boolean)
    .map((boss) => {
      if (seen.has(boss.id)) {
        throw new Error(`Duplicate world boss id: ${boss.id}`);
      }
      seen.add(boss.id);
      return boss;
    });
}

function readBossConfig() {
  return JSON.parse(fs.readFileSync(BOSS_DATA_PATH, 'utf8'));
}

function getActiveWorldBosses(now = new Date()) {
  return loadWorldBosses().map((boss) => {
    const bucket = getBossMoveBucket(boss, now);
    const position = resolveBossPosition(boss, bucket);
    return {
      ...boss,
      ...position,
      moveBucket: bucket,
      movesAt: getBossMoveEnd(boss, bucket).toISOString()
    };
  });
}

function getActiveWorldBossById(bossId, now = new Date()) {
  const id = String(bossId || '').trim();
  if (!id) return null;
  return getActiveWorldBosses(now).find((boss) => boss.id === id) || null;
}

function getActiveWorldBossAt(x, y, now = new Date()) {
  return getWorldBossAtFromList(getActiveWorldBosses(now), x, y);
}

function getWorldBossAtFromList(bosses = [], x, y) {
  return (Array.isArray(bosses) ? bosses : [])
    .find((boss) => Number(boss.x) === Number(x) && Number(boss.y) === Number(y)) || null;
}

function serializeWorldBossForClient(boss) {
  if (!boss) return null;
  return {
    id: boss.id,
    title: boss.title,
    taunts: Array.isArray(boss.taunts) ? boss.taunts : [],
    zoneTypeId: boss.zoneTypeId,
    x: Number(boss.x) || 0,
    y: Number(boss.y) || 0,
    difficulty: boss.difficulty,
    movesAt: boss.movesAt || null,
    keyDemon: boss.keyDemon
      ? { ...boss.keyDemon, imageUrl: toWorldMapImageUrl(boss.keyDemon.imageUrl) }
      : null,
    team: Array.isArray(boss.team)
      ? boss.team.map((member) => ({ ...member, imageUrl: toWorldMapImageUrl(member.imageUrl) }))
      : [],
    enemyBuffs: createWorldBossEnemyBuffs(boss),
    rewardBuff: getWorldBossRewardBuff(boss)
  };
}

function createWorldBossEnemyBuffs(boss = {}) {
  return normalizeCombatBuffState({
    activeBuffs: Array.isArray(boss.enemyBuffs) ? boss.enemyBuffs : []
  }).activeBuffs;
}

function getWorldBossRewardBuff(boss = {}) {
  if (!boss.rewardBuff) return null;
  return {
    ...boss.rewardBuff,
    durationSeconds: Math.max(1, Math.round(Number(boss.rewardBuff.durationSeconds) || boss.rewardDurationSeconds || DEFAULT_REWARD_DURATION_HOURS * 3600)),
    durationHours: roundNumber(Number(boss.rewardBuff.durationHours) || boss.rewardDurationHours || DEFAULT_REWARD_DURATION_HOURS, 2)
  };
}

async function grantWorldBossRewardBuff(playerId, boss, now = new Date()) {
  const rewardBuff = getWorldBossRewardBuff(boss);
  if (!playerId || !boss?.id || !rewardBuff) return null;

  const awardedAtSeconds = Math.floor(now.getTime() / 1000);
  const expiresAtSeconds = awardedAtSeconds + Math.max(1, Math.floor(rewardBuff.durationSeconds));
  await db.query(
    `INSERT INTO player_world_boss_buffs
       (player_id, boss_id, awarded_at, expires_at)
     VALUES (?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))
     ON DUPLICATE KEY UPDATE
       awarded_at = VALUES(awarded_at),
       expires_at = VALUES(expires_at)`,
    [playerId, boss.id, awardedAtSeconds, expiresAtSeconds]
  );

  return {
    ...rewardBuff,
    bossId: boss.id,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString()
  };
}

async function getActiveWorldBossRewardBuffs(playerOrId, queryable = db) {
  const playerId = typeof playerOrId === 'object' ? playerOrId?.id : playerOrId;
  if (!playerId) return [];

  const [rows] = await queryable.query(
    `SELECT boss_id AS bossId,
            UNIX_TIMESTAMP(expires_at) AS expiresAtSeconds
     FROM player_world_boss_buffs
     WHERE player_id = ?
       AND expires_at > CURRENT_TIMESTAMP
     ORDER BY expires_at DESC`,
    [playerId]
  );
  if (!rows.length) return [];

  const bossesById = new Map(loadWorldBosses().map((boss) => [boss.id, boss]));
  return rows.map((row) => {
    const boss = bossesById.get(String(row.bossId));
    const rewardBuff = getWorldBossRewardBuff(boss);
    if (!rewardBuff) return null;

    return {
      ...rewardBuff,
      bossId: boss.id,
      expiresAt: unixSecondsToIsoString(row.expiresAtSeconds)
    };
  }).filter(Boolean);
}

function unixSecondsToIsoString(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return null;
  return new Date(Math.floor(seconds) * 1000).toISOString();
}

function normalizeBossDefinition(source = {}, index, defaults) {
  const id = String(source.id || `world-boss-${index + 1}`).trim();
  if (!id) return null;
  const zoneTypeId = normalizeBossZoneTypeId(source.zoneTypeId ?? source.zone);
  const moveIntervalSeconds = getPositiveInteger(source.moveIntervalSeconds, defaults.moveIntervalSeconds);
  const rewardDurationHours = getPositiveNumber(source.rewardDurationHours, defaults.rewardDurationHours);
  const rewardDurationSeconds = Math.max(1, Math.round(rewardDurationHours * 3600));
  const team = normalizeBossTeam(source.team, id);
  const rewardBuff = normalizeRewardBuff(source.rewardBuff, id, rewardDurationHours, rewardDurationSeconds);

  return {
    id,
    zoneTypeId,
    title: String(source.title || source.name || formatBossTitle(id)),
    // Intro taunts shown by the world boss dialog; personality notes for the
    // voice of each boss live alongside them in world-bosses.json.
    taunts: normalizeBossTaunts(source.taunts),
    difficulty: getPositiveInteger(source.difficulty, zoneTypeId === 0 ? 2 : 8),
    minDistance: getNonNegativeNumber(source.minDistance, zoneTypeId === 0 ? 4 : 0),
    maxDistance: getPositiveNumber(source.maxDistance, Number.POSITIVE_INFINITY),
    moveIntervalSeconds,
    rewardDurationHours,
    rewardDurationSeconds,
    keyDemon: normalizeBossMember(source.keyDemon || team[0], id, 'key'),
    team,
    enemyBuffs: normalizeBossBuffs(source.enemyBuffs, id, 'enemy'),
    rewardBuff
  };
}

function normalizeBossTaunts(taunts) {
  return (Array.isArray(taunts) ? taunts : [])
    .map((line) => String(line || '').trim())
    .filter(Boolean);
}

function normalizeBossZoneTypeId(value) {
  const zone = Number(value);
  if (!Number.isInteger(zone) || zone < 0 || zone > TYPE_COUNT) {
    throw new Error(`World boss zoneTypeId must be between 0 and ${TYPE_COUNT}.`);
  }
  return zone;
}

function normalizeBossTeam(team, bossId) {
  return (Array.isArray(team) ? team : [])
    .slice(0, 9)
    .map((member, index) => normalizeBossMember(member, bossId, index + 1))
    .filter(Boolean);
}

function normalizeBossMember(member = {}, bossId, index) {
  if (!member || typeof member !== 'object') return null;
  const typeId = Math.max(1, Math.min(TYPE_COUNT, Math.floor(Number(member.typeId || member.type_id || member.type) || 1)));
  const type = demonTypes[String(typeId)] || {};
  const rarity = String(member.rarity || 'rare').toLowerCase();
  const asset = getDemonAsset(typeId, rarity);
  const formationSlot = Number(member.formationSlot ?? member.formation_slot ?? member.slot);

  return {
    instanceId: String(member.instanceId || `${bossId}-enemy-${index}`),
    typeId,
    species: String(member.species || type.name || `Demon ${typeId}`),
    role: String(member.role || type.role || ''),
    rarity: asset?.rarity || rarity,
    position: member.position || type.preferredPosition || asset?.preferredPosition || 'front',
    imageUrl: member.imageUrl || member.image_url || asset?.image_url || '',
    ...(Number.isInteger(formationSlot) ? { formationSlot } : {})
  };
}

function getDemonAsset(typeId, rarity) {
  return demonAssets.find((asset) => Number(asset.type) === Number(typeId) && asset.rarity === rarity)
    || demonAssets.find((asset) => Number(asset.type) === Number(typeId))
    || demonAssets[0]
    || null;
}

function normalizeBossBuffs(source, bossId, kind) {
  return normalizeCombatBuffState({
    activeBuffs: (Array.isArray(source) ? source : []).map((buff, index) => ({
      ...buff,
      id: String(buff?.id || `world_boss_${bossId}_${kind}_${index + 1}`),
      source: buff?.source || 'world_boss',
      tags: normalizeBuffTags(buff?.tags, ['World', 'Boss'])
    }))
  }).activeBuffs;
}

function normalizeRewardBuff(source, bossId, durationHours, durationSeconds) {
  if (!source || typeof source !== 'object') return null;
  const normalized = normalizeCombatBuffState({
    activeBuffs: [{
      ...source,
      id: String(source.id || `world_boss_${bossId}_reward`),
      source: source.source || 'world_boss_reward',
      tags: normalizeBuffTags(source.tags, ['World', 'Boss Reward'])
    }]
  }).activeBuffs[0];

  if (!normalized) return null;
  const sourceDurationHours = getPositiveNumber(source.durationHours, durationHours);
  const sourceDurationSeconds = Math.max(1, Math.round(Number(source.durationSeconds) || sourceDurationHours * 3600 || durationSeconds));

  return {
    ...normalized,
    durationHours: roundNumber(sourceDurationSeconds / 3600, 2),
    durationSeconds: sourceDurationSeconds
  };
}

function normalizeBuffTags(tags, fallback) {
  const values = (Array.isArray(tags) ? tags : fallback)
    .map((tag) => String(tag || '').trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

function getBossMoveBucket(boss, now = new Date()) {
  const time = now instanceof Date ? now.getTime() : Date.parse(now);
  const intervalMs = Math.max(1, Number(boss.moveIntervalSeconds) || DEFAULT_MOVE_INTERVAL_SECONDS) * 1000;
  return Math.floor((Number.isFinite(time) ? time : Date.now()) / intervalMs);
}

function getBossMoveEnd(boss, bucket) {
  const intervalMs = Math.max(1, Number(boss.moveIntervalSeconds) || DEFAULT_MOVE_INTERVAL_SECONDS) * 1000;
  return new Date((Math.max(0, Number(bucket) || 0) + 1) * intervalMs);
}

function resolveBossPosition(boss, bucket) {
  const candidates = getBossPositionCandidates(boss);
  if (!candidates.length) return { ...WORLD_SPAWN };
  const index = hashSeed(`${boss.id}:${bucket}`) % candidates.length;
  return candidates[index];
}

function getBossPositionCandidates(boss) {
  const cacheKey = [
    boss.zoneTypeId,
    Number.isFinite(boss.minDistance) ? boss.minDistance : 0,
    Number.isFinite(boss.maxDistance) ? boss.maxDistance : 'max'
  ].join(':');
  if (candidateCache.has(cacheKey)) return candidateCache.get(cacheKey);

  const candidates = [];
  for (let x = WORLD_MIN; x <= WORLD_MAX; x += 1) {
    for (let y = WORLD_MIN; y <= WORLD_MAX; y += 1) {
      if (isBossCandidateTile(boss, x, y)) {
        candidates.push({ x, y });
      }
    }
  }

  candidateCache.set(cacheKey, candidates);
  return candidates;
}

function isBossCandidateTile(boss, x, y) {
  const distance = Math.hypot(x - WORLD_SPAWN.x, y - WORLD_SPAWN.y);
  if (distance < Math.max(0, Number(boss.minDistance) || 0)) return false;
  if (Number.isFinite(boss.maxDistance) && distance > boss.maxDistance) return false;
  if (STATIC_OCCUPIED_TILES.has(tileKey(x, y))) return false;
  return zoneTypeIdForTile(x, y) === boss.zoneTypeId;
}

function zoneTypeIdForTile(x, y) {
  const radius = Math.hypot(x - WORLD_SPAWN.x, y - WORLD_SPAWN.y);
  const angle = Math.atan2(y - WORLD_SPAWN.y, x - WORLD_SPAWN.x);
  if (radius < neutralZoneRadius(angle)) return 0;
  const normalized = (angle + Math.PI) / (2 * Math.PI);
  const jittered = normalized + ZONE_ROTATION + zoneBoundaryJitter(radius, angle);
  const sector = Math.floor((((jittered % 1) + 1) % 1) * TYPE_COUNT) % TYPE_COUNT;
  return remapZoneTypeId(sector + 1);
}

function neutralZoneRadius(theta) {
  return ZONE_START_RADIUS +
    Math.sin(theta * 3 + 1.7) * 3.4 +
    Math.sin(theta * 5 + 0.6) * 2.1 +
    Math.sin(theta * 9 + 4.1) * 1.2;
}

function zoneBoundaryJitter(radius, theta) {
  return (
    Math.sin(radius * 0.31 + theta * 2) * 0.5 +
    Math.sin(radius * 0.17 - theta * 3 + 2.3) * 0.35 +
    Math.sin(radius * 0.53 + theta * 5 + 4.6) * 0.15
  ) * 0.02;
}

function remapZoneTypeId(typeId) {
  return ZONE_TYPE_REMAP[typeId] || typeId;
}

function toWorldMapImageUrl(url) {
  const match = /^\/app\/images\/demons\/(?:thumbnails\/)?(\d+)\.png(?:[?#].*)?$/.exec(String(url || ''));
  return match ? `/app/images/demons/map/${match[1]}.webp?v=art-df103bc9b9a9` : url;
}

function tileKey(x, y) {
  return `${Number(x) || 0},${Number(y) || 0}`;
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

function getPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function getPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function getNonNegativeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function roundNumber(value, precision = 0) {
  const factor = 10 ** Math.max(0, Number(precision) || 0);
  return Math.round((Number(value) || 0) * factor) / factor;
}

function formatBossTitle(id) {
  return String(id || 'World Boss')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

module.exports = {
  DEFAULT_MOVE_INTERVAL_SECONDS,
  createWorldBossEnemyBuffs,
  getActiveWorldBossAt,
  getActiveWorldBossById,
  getActiveWorldBosses,
  getActiveWorldBossRewardBuffs,
  getWorldBossAtFromList,
  getWorldBossRewardBuff,
  grantWorldBossRewardBuff,
  loadWorldBosses,
  serializeWorldBossForClient,
  zoneTypeIdForTile,
  _test: {
    getBossPositionCandidates,
    isBossCandidateTile,
    resolveBossPosition
  }
};
