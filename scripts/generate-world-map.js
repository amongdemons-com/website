'use strict';

/**
 * Generates public/api/data/map.json: a 101x101 world (-50..50 on each axis)
 * built from roads, unpassable blocks/structures, and demon-team encounters.
 *
 * Layout rules:
 *  - Distance from the center (0, 0) controls team size and rarity bands.
 *    Displayed difficulty is computed from final team size, rarity, and type
 *    weights.
 *  - Demon TYPE is zone-based — the map is split into angular wedges and each
 *    of the 11 types predominates in its own wedge, so areas feel themed.
 *  - Roads connect camps, lairs, shrines, and portals through meandering
 *    orthogonal trails. Travel along a road is much less likely to be ambushed
 *    (see world.js).
 *
 * Deterministic via a fixed seed so the map is stable across runs.
 * Usage: node scripts/generate-world-map.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'public', 'api', 'data');
const OUTPUT_PATH = path.join(DATA_DIR, 'map.json');

const BOUNDS = { min: -50, max: 50 };
const SPAWN = { x: 0, y: 0 };
const SAFE_RADIUS = 3; // no blocks/encounters this close to spawn
const MAX_DISTANCE = Math.hypot(50, 50); // farthest corner from center

const RARITY_RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_DIFFICULTY_SCORE = {
  common: 1,
  uncommon: 1.25,
  rare: 1.6,
  epic: 2.1,
  legendary: 2.8,
  mythic: 3.7
};
const FRONT_TYPE_IDS = [1, 5, 7, 8, 9];
const BLOCK_TYPES = ['basalt', 'bone-spur', 'chasm', 'ruin'];
const TYPE_COUNT = 11;
const ZONE_START_RADIUS = 24;
const ZONE_ROTATION = 0.045; // nudge wedge boundaries off the cardinal axes
const DARKNESS_PORTAL_COUNT = 3;
const DARKNESS_PORTAL_MIN_SPACING = 28;
const DARKNESS_PORTAL_SUMMON_SOUL_COST_PER_DISTANCE = 2;
// Swap adjacent signatures so type 4 owns the visual northeast corner.
const ZONE_TYPE_REMAP = { 4: 5, 5: 4 };
const PRIMARY_TYPE_CHANCE = 0.68; // odds a team member is the zone's signature type
const SUPPORT_ONLY_ROLES = new Set(['healer', 'counter_tank']);

const demonTypes = require(path.join(DATA_DIR, 'demon-types.json'));
const demonAssets = require(path.join(DATA_DIR, 'demons.json'));
const TYPE_WEIGHTS = demonAssets.map((asset) => Number(asset.typeWeight)).filter(Number.isFinite);
const MIN_TYPE_WEIGHT = Math.min(...TYPE_WEIGHTS);
const MAX_TYPE_WEIGHT = Math.max(...TYPE_WEIGHTS);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(0x4144454d); // "ADEM"

function randInt(min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(list) {
  return list[Math.floor(rng() * list.length)];
}

function tileKey(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= BOUNDS.min && x <= BOUNDS.max && y >= BOUNDS.min && y <= BOUNDS.max;
}

function distanceFromCenter(x, y) {
  return Math.hypot(x - SPAWN.x, y - SPAWN.y);
}

// 0 at center, 1 at the outer edge.
function difficultyFactor(x, y) {
  return Math.min(1, distanceFromCenter(x, y) / (MAX_DISTANCE * 0.92));
}

function difficultyMeter(t) {
  return Math.max(1, Math.min(10, 1 + Math.floor(t * 10)));
}

function allowedRaritiesForMeter(meter) {
  const table = {
    1: ['common'],
    2: ['common', 'uncommon'],
    3: ['common', 'uncommon', 'rare'],
    4: ['uncommon', 'rare'],
    5: ['rare', 'epic'],
    6: ['rare', 'epic', 'legendary'],
    7: ['epic', 'legendary'],
    8: ['epic', 'legendary', 'mythic'],
    9: ['legendary', 'mythic'],
    10: ['mythic']
  };
  return table[meter] || ['common'];
}

// Organic zone boundaries. The neutral border radius breathes with the angle
// and the wedge borders meander with distance from spawn, so zones read as
// natural regions instead of a circle sliced by straight rays. All theta
// harmonics use integer frequencies so the field stays continuous across the
// -PI/PI wrap. Keep in sync with zoneTypeIdForTile in public/app/js/world-ui.js.
function neutralZoneRadius(theta) {
  return ZONE_START_RADIUS +
    Math.sin(theta * 3 + 1.7) * 3.4 +
    Math.sin(theta * 5 + 0.6) * 2.1 +
    Math.sin(theta * 9 + 4.1) * 1.2;
}

// Angular offset (in 0..1 turns) applied to wedge borders; ~0.02 turns peak,
// which bends a border by roughly 3 tiles at the neutral rim and 6 at the map edge.
function zoneBoundaryJitter(radius, theta) {
  return (
    Math.sin(radius * 0.31 + theta * 2) * 0.5 +
    Math.sin(radius * 0.17 - theta * 3 + 2.3) * 0.35 +
    Math.sin(radius * 0.53 + theta * 5 + 4.6) * 0.15
  ) * 0.02;
}

// Outer map bands are themed by angular demon wedges. The center stays neutral
// so zones do not visibly start at spawn.
function zoneTypeId(x, y) {
  const radius = distanceFromCenter(x, y);
  const angle = Math.atan2(y - SPAWN.y, x - SPAWN.x); // -PI..PI
  if (radius < neutralZoneRadius(angle)) return null;
  const normalized = (angle + Math.PI) / (2 * Math.PI); // 0..1
  const jittered = normalized + ZONE_ROTATION + zoneBoundaryJitter(radius, angle);
  const sector = Math.floor((((jittered % 1) + 1) % 1) * TYPE_COUNT) % TYPE_COUNT;
  return remapZoneTypeId(sector + 1);
}

function remapZoneTypeId(typeId) {
  return ZONE_TYPE_REMAP[typeId] || typeId;
}

function mixedTypeId(x, y) {
  const noise = ((x * 73856093) ^ (y * 19349663) ^ 0xadefaced) >>> 0;
  return (noise % TYPE_COUNT) + 1;
}

function teamSizeForFactor(t) {
  return Math.max(1, Math.min(6, 1 + Math.floor(t * 5 + rng() * 0.9)));
}

function assetFor(typeId, rarity) {
  return (
    demonAssets.find((asset) => asset.type === typeId && asset.rarity === rarity) ||
    demonAssets.find((asset) => asset.type === typeId) ||
    demonAssets[0]
  );
}

function preferredPosition(typeId) {
  return FRONT_TYPE_IDS.includes(typeId) ? 'front' : 'back';
}

function roleForType(typeId) {
  return demonTypes[String(typeId)]?.role || 'melee';
}

function typeWeight(typeId) {
  const asset = demonAssets.find((entry) => entry.type === typeId);
  return Number(asset?.typeWeight) || MAX_TYPE_WEIGHT;
}

function typeDifficultyMultiplier(typeId) {
  const range = Math.max(1, MAX_TYPE_WEIGHT - MIN_TYPE_WEIGHT);
  const rarityBySpawnWeight = (MAX_TYPE_WEIGHT - typeWeight(typeId)) / range;
  return 1 + rarityBySpawnWeight * 1.25;
}

function weightedTypeId(options = {}) {
  const excludedRoles = options.excludedRoles || new Set();
  const excludedTypes = options.excludedTypes || new Set();
  const candidates = Array.from({ length: TYPE_COUNT }, (item, index) => index + 1)
    .filter((typeId) => !excludedTypes.has(typeId) && !excludedRoles.has(roleForType(typeId)));
  const fallback = candidates.length ? candidates : Array.from({ length: TYPE_COUNT }, (item, index) => index + 1);
  const total = fallback.reduce((sum, typeId) => sum + typeWeight(typeId), 0);
  let roll = rng() * total;

  for (const typeId of fallback) {
    roll -= typeWeight(typeId);
    if (roll <= 0) return typeId;
  }

  return fallback[fallback.length - 1];
}

function buildMember(typeId, rarity, instanceId, position) {
  const asset = assetFor(typeId, rarity);
  const type = demonTypes[String(typeId)] || {};
  return {
    instanceId,
    typeId,
    species: type.name || `Demon ${typeId}`,
    role: type.role || 'melee',
    rarity: asset.rarity,
    position,
    imageUrl: asset.image_url
  };
}

function rarityRank(rarity) {
  return RARITY_RANK.indexOf(rarity);
}

function memberDifficultyScore(member) {
  const rarityScore = RARITY_DIFFICULTY_SCORE[member.rarity] || RARITY_DIFFICULTY_SCORE.common;
  return rarityScore * typeDifficultyMultiplier(member.typeId);
}

function teamDifficulty(members) {
  const minScore = RARITY_DIFFICULTY_SCORE.common * typeDifficultyMultiplier(1);
  const maxScore = 6 * RARITY_DIFFICULTY_SCORE.mythic * typeDifficultyMultiplier(11);
  const score = members.reduce((sum, member) => sum + memberDifficultyScore(member), 0);
  const normalized = Math.max(0, Math.min(1, (score - minScore) / (maxScore - minScore)));
  return Math.max(1, Math.min(10, Math.round(1 + normalized * 9)));
}

function teamKey(members) {
  return members
    .map((member) => `${member.typeId}:${member.rarity}`)
    .sort()
    .join('|');
}

function ensureFrontLine(members) {
  if (!members.some((member) => member.position === 'front')) {
    members[0].position = 'front';
  }
}

function diversifySupportOnlyTeam(members, id, rarities) {
  if (!members.length) return;
  if (!members.every((member) => SUPPORT_ONLY_ROLES.has(member.role))) return;

  const typeId = weightedTypeId({ excludedRoles: SUPPORT_ONLY_ROLES });
  const rarity = pick(rarities);
  const replacement = buildMember(typeId, rarity, `${id}-m${Math.max(2, members.length)}`, preferredPosition(typeId));

  if (members.length === 1) {
    members.push(replacement);
  } else {
    members[members.length - 1] = {
      ...replacement,
      instanceId: `${id}-m${members.length}`
    };
  }
}

function normalizeTeam(members, id, rarities) {
  diversifySupportOnlyTeam(members, id, rarities);
  ensureFrontLine(members);
}

function buildTeamMembers(id, size, primaryType, primaryTypeChance, rarities, rarestAllowed) {
  const members = [
    buildMember(primaryType, rarestAllowed, `${id}-m1`, preferredPosition(primaryType))
  ];

  for (let index = 1; index < size; index += 1) {
    const typeId = rng() < primaryTypeChance ? primaryType : weightedTypeId();
    const rarity = pick(rarities);
    members.push(buildMember(typeId, rarity, `${id}-m${index + 1}`, preferredPosition(typeId)));
  }

  return members;
}

function makeUniqueTeam(members, id, idNumber, rarities, usedTeamKeys) {
  for (let attempt = 0; attempt < 700; attempt += 1) {
    normalizeTeam(members, id, rarities);
    const key = teamKey(members);
    if (!usedTeamKeys.has(key)) {
      usedTeamKeys.add(key);
      return members;
    }

    const nextType = ((idNumber + attempt) % TYPE_COUNT) + 1;
    const nextRarity = rarities[Math.floor(attempt / TYPE_COUNT) % rarities.length];
    if (members.length < 6 && attempt % 5 === 0) {
      members.push(buildMember(nextType, nextRarity, `${id}-m${members.length + 1}`, preferredPosition(nextType)));
    } else {
      const index = attempt % members.length;
      members[index] = buildMember(nextType, nextRarity, `${id}-m${index + 1}`, preferredPosition(nextType));
    }
  }

  throw new Error(`Could not create a unique enemy team for ${id}.`);
}

function buildEncounter(id, x, y, usedTeamKeys) {
  const t = difficultyFactor(x, y);
  const distanceMeter = difficultyMeter(t);
  const rarities = allowedRaritiesForMeter(distanceMeter);
  const rarestAllowed = rarities[rarities.length - 1];
  const size = teamSizeForFactor(t);
  const zoneType = zoneTypeId(x, y);
  const primaryType = zoneType || mixedTypeId(x, y);
  const primaryTypeChance = zoneType ? PRIMARY_TYPE_CHANCE : 0.34;
  const idNumber = Number(id.match(/\d+/)?.[0]) || 1;

  let members = buildTeamMembers(id, size, primaryType, primaryTypeChance, rarities, rarestAllowed);
  members = makeUniqueTeam(members, id, idNumber, rarities, usedTeamKeys);

  // Key demon: highest rarity, prefer the zone's signature type, then type id.
  const keyDemon = members
    .slice()
    .sort((a, b) =>
      rarityRank(b.rarity) - rarityRank(a.rarity) ||
      Number(b.typeId === primaryType) - Number(a.typeId === primaryType) ||
      b.typeId - a.typeId
    )[0];
  keyDemon.elite = true;

  return {
    id,
    x,
    y,
    difficulty: teamDifficulty(members),
    zoneType: zoneType || 0,
    keyDemon: {
      typeId: keyDemon.typeId,
      species: keyDemon.species,
      rarity: keyDemon.rarity,
      imageUrl: keyDemon.imageUrl
    },
    team: members
  };
}

// Named landmarks give the road network and travel view anchors. Forsaken
// Shrines are active world objects; Darkness Portals are added after roads
// exist so they can sit on the remote ends of the road network.
const BASE_LANDMARKS = [
  {
    x: 0,
    y: 0,
    type: 'forsaken_shrine',
    title: 'Forsaken Shrine',
    description: 'A guarded shrine at the center of the wilds.'
  },
  {
    x: 27,
    y: 16,
    type: 'forsaken_shrine',
    title: 'Forsaken Shrine',
    description: 'A splintered altar where hunters can anchor their souls.'
  },
  {
    x: -15,
    y: -17,
    type: 'forsaken_shrine',
    title: 'Forsaken Shrine',
    description: 'A blackened roadside shrine half-swallowed by old ash.'
  },
  {
    x: -38,
    y: -28,
    type: 'landmark',
    title: 'Witch Road Ruins',
    description: 'Collapsed stones from an older road system.'
  },
  {
    x: 4,
    y: 39,
    type: 'landmark',
    title: 'Old Watch',
    description: 'A broken lookout over the southern reaches.'
  }
];

const BASE_ROAD_ANCHORS = [
  { x: 0, y: 0 },
  { x: 10, y: -5 },
  { x: -12, y: 9 },
  { x: 27, y: 16 },
  { x: -15, y: -17 },
  { x: -31, y: 22 },
  { x: 35, y: -31 },
  { x: -38, y: -28 },
  { x: 43, y: 5 },
  { x: -18, y: -41 },
  { x: 4, y: 39 }
];

// Every demon zone must hold a Forsaken Shrine so hunters can anchor their
// souls deep in the wilds. Zones already covered by a hand-placed shrine keep
// it; the rest get one generated near the middle of their wedge.
function buildZoneShrines(existingLandmarks) {
  const covered = new Set(
    existingLandmarks
      .filter((event) => event.type === 'forsaken_shrine')
      .map((event) => zoneTypeId(event.x, event.y) || 0)
  );
  const shrines = [];

  for (let sector = 0; sector < TYPE_COUNT; sector += 1) {
    const typeId = remapZoneTypeId(sector + 1);
    if (covered.has(typeId)) continue;
    const spot = findZoneShrineSpot(sector, typeId, existingLandmarks.concat(shrines));
    shrines.push({
      x: spot.x,
      y: spot.y,
      type: 'forsaken_shrine',
      title: 'Forsaken Shrine',
      description: 'A weathered altar where hunters can anchor their souls.'
    });
  }

  return shrines;
}

// Aim for the wedge's central angle at mid-depth, then widen the search until
// the tile actually lands inside the zone (borders meander with the jitter).
function findZoneShrineSpot(sector, typeId, taken) {
  const centerTheta = (((sector + 0.5) / TYPE_COUNT) - ZONE_ROTATION) * 2 * Math.PI - Math.PI;
  const angleOffsets = [0, 0.01, -0.01, 0.02, -0.02, 0.03, -0.03];

  for (let radius = 34; radius <= 48; radius += 1) {
    for (const offsetTurns of angleOffsets) {
      const theta = centerTheta + offsetTurns * 2 * Math.PI;
      const x = Math.round(Math.cos(theta) * radius);
      const y = Math.round(Math.sin(theta) * radius);
      if (!inBounds(x, y)) continue;
      if (zoneTypeId(x, y) !== typeId) continue;
      if (taken.some((event) => Math.abs(event.x - x) <= 2 && Math.abs(event.y - y) <= 2)) continue;
      return { x, y };
    }
  }

  throw new Error(`Could not place a Forsaken Shrine inside zone ${typeId}.`);
}

const ZONE_SHRINES = buildZoneShrines(BASE_LANDMARKS);
const LANDMARKS = [...BASE_LANDMARKS, ...ZONE_SHRINES];
const ROAD_LANDMARKS = [...BASE_ROAD_ANCHORS, ...ZONE_SHRINES];

const ROAD_ROUTES = [
  [SPAWN, { x: 7, y: -4 }, { x: 10, y: -5 }, { x: 20, y: -15 }, { x: 35, y: -31 }],
  [SPAWN, { x: -7, y: -2 }, { x: -15, y: -17 }, { x: -18, y: -41 }],
  [SPAWN, { x: -8, y: 6 }, { x: -12, y: 9 }, { x: -24, y: 18 }, { x: -31, y: 22 }],
  [SPAWN, { x: 9, y: 5 }, { x: 21, y: 9 }, { x: 27, y: 16 }, { x: 43, y: 5 }],
  [SPAWN, { x: 0, y: 12 }, { x: 4, y: 24 }, { x: 4, y: 39 }],
  [{ x: -15, y: -17 }, { x: -28, y: -21 }, { x: -38, y: -28 }],
  [{ x: -24, y: 18 }, { x: -12, y: 28 }, { x: 4, y: 39 }],
  [{ x: 21, y: 9 }, { x: 29, y: -6 }, { x: 35, y: -31 }],
  [{ x: -8, y: 6 }, { x: -19, y: -5 }, { x: -28, y: -21 }],
  [{ x: 7, y: -4 }, { x: 20, y: 1 }, { x: 29, y: -6 }, { x: 43, y: 5 }]
];

const SIDE_TRAIL_COUNT = 36;

function generateRoads(roadSet) {
  const tiles = new Set();

  // Meandering routes connect the named landmarks into a single road graph.
  ROAD_ROUTES.forEach((route) => {
    for (let index = 1; index < route.length; index += 1) {
      carveRoadPath(tiles, route[index - 1], route[index]);
    }
  });

  connectZoneShrines(tiles);

  // Short branches make the network feel explored rather than purely optimal.
  addSideTrails(tiles);

  ROAD_LANDMARKS.forEach((event) => addRoadTile(tiles, event.x, event.y));
  stripRoadSquares(tiles, new Set(ROAD_LANDMARKS.map((event) => tileKey(event.x, event.y))));
  keepConnectedRoads(tiles, tileKey(SPAWN.x, SPAWN.y));

  tiles.forEach((key) => roadSet.add(key));
}

function addRoadTile(tiles, x, y) {
  if (inBounds(x, y)) tiles.add(tileKey(x, y));
}

function carveRoadPath(tiles, from, to) {
  let current = { x: from.x, y: from.y };
  const maxSteps = Math.abs(to.x - from.x) + Math.abs(to.y - from.y) + 90;
  let driftDirection = pick([-1, 1]);
  let driftBudget = 0;

  addRoadTile(tiles, current.x, current.y);

  for (let step = 0; step < maxSteps && !positionsEqual(current, to); step += 1) {
    const dx = to.x - current.x;
    const dy = to.y - current.y;
    const horizontalBias = Math.abs(dx) / Math.max(1, Math.abs(dx) + Math.abs(dy));
    let move;

    if (driftBudget <= 0 && rng() < 0.16 && distanceBetween(current, to) > 8) {
      driftBudget = randInt(2, 5);
      driftDirection = pick([-1, 1]);
    }

    if (driftBudget > 0) {
      const preferHorizontalDrift = Math.abs(dx) < Math.abs(dy);
      move = preferHorizontalDrift
        ? { x: driftDirection, y: 0 }
        : { x: 0, y: driftDirection };
      driftBudget -= 1;
    } else if (rng() < horizontalBias) {
      move = { x: Math.sign(dx), y: 0 };
    } else {
      move = { x: 0, y: Math.sign(dy) };
    }

    if (move.x === 0 && move.y === 0) {
      move = Math.abs(dx) > Math.abs(dy)
        ? { x: Math.sign(dx), y: 0 }
        : { x: 0, y: Math.sign(dy) };
    }

    current = clampRoadStep({ x: current.x + move.x, y: current.y + move.y }, to);
    addRoadTile(tiles, current.x, current.y);
  }

  while (!positionsEqual(current, to)) {
    const dx = to.x - current.x;
    const dy = to.y - current.y;
    current = Math.abs(dx) >= Math.abs(dy)
      ? { x: current.x + Math.sign(dx), y: current.y }
      : { x: current.x, y: current.y + Math.sign(dy) };
    addRoadTile(tiles, current.x, current.y);
  }
}

function clampRoadStep(position, target) {
  const margin = 2;
  const x = Math.max(BOUNDS.min + margin, Math.min(BOUNDS.max - margin, position.x));
  const y = Math.max(BOUNDS.min + margin, Math.min(BOUNDS.max - margin, position.y));

  if (x === position.x && y === position.y) return position;

  return Math.abs(target.x - x) >= Math.abs(target.y - y)
    ? { x, y: position.y }
    : { x: position.x, y };
}

// Anchor every generated zone shrine to the road network via the nearest
// already-connected landmark, so each respawn point has a road leading to it.
function connectZoneShrines(tiles) {
  const anchors = [SPAWN, ...BASE_ROAD_ANCHORS.map((event) => ({ x: event.x, y: event.y }))];

  ZONE_SHRINES.forEach((shrine) => {
    const target = { x: shrine.x, y: shrine.y };
    const nearest = anchors.reduce((best, anchor) => (
      distanceBetween(anchor, target) < distanceBetween(best, target) ? anchor : best
    ));
    carveRoadPath(tiles, nearest, target);
    anchors.push(target);
  });
}

function addSideTrails(tiles) {
  for (let trail = 0; trail < SIDE_TRAIL_COUNT; trail += 1) {
    const roadTiles = Array.from(tiles);
    const startKey = pick(roadTiles);
    const [startX, startY] = startKey.split(',').map(Number);
    let x = startX;
    let y = startY;
    let dir = pick([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 }
    ]);
    const length = randInt(5, 16);

    for (let step = 0; step < length; step += 1) {
      if (rng() < 0.24) {
        dir = rng() < 0.5
          ? { x: -dir.y, y: dir.x }
          : { x: dir.y, y: -dir.x };
      }

      x += dir.x;
      y += dir.y;
      if (!inBounds(x, y) || distanceFromCenter(x, y) > MAX_DISTANCE * 0.94) break;
      addRoadTile(tiles, x, y);
    }
  }
}

function positionsEqual(a, b) {
  return Number(a?.x) === Number(b?.x) && Number(a?.y) === Number(b?.y);
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Remove paved 2x2 clumps where doing so does not break the road graph.
function stripRoadSquares(tiles, protectedKeys = new Set()) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of Array.from(tiles)) {
      const [x, y] = key.split(',').map(Number);
      const square = [tileKey(x, y), tileKey(x + 1, y), tileKey(x, y + 1), tileKey(x + 1, y + 1)];
      if (square.every((k) => tiles.has(k))) {
        const removable = square
          .slice()
          .reverse()
          .find((candidate) => !protectedKeys.has(candidate) && canRemoveRoadTile(tiles, candidate));
        if (!removable) continue;
        tiles.delete(removable);
        changed = true;
        break;
      }
    }
  }
}

function canRemoveRoadTile(tiles, key) {
  const startKey = tileKey(SPAWN.x, SPAWN.y);
  if (key === startKey || !tiles.has(startKey)) return false;

  tiles.delete(key);
  const seen = getConnectedRoadKeys(tiles, startKey);
  const connected = seen.size === tiles.size;
  tiles.add(key);

  return connected;
}

function getConnectedRoadKeys(tiles, startKey) {
  const seen = new Set([startKey]);
  const queue = [startKey];

  while (queue.length) {
    const [x, y] = queue.shift().split(',').map(Number);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const next = tileKey(x + dx, y + dy);
      if (tiles.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }

  return seen;
}

// Keep only the 4-connected road component reachable from the start tile, so
// every road links to the rest (no orphaned or diagonally-attached fragments).
function keepConnectedRoads(tiles, startKey) {
  if (!tiles.has(startKey)) return;

  const seen = getConnectedRoadKeys(tiles, startKey);

  for (const key of tiles) {
    if (!seen.has(key)) tiles.delete(key);
  }
}

function validateConnectedRoads(roadSet) {
  const startKey = tileKey(SPAWN.x, SPAWN.y);
  if (!roadSet.has(startKey)) {
    throw new Error('Road network must include the spawn tile.');
  }

  const connected = getConnectedRoadKeys(roadSet, startKey);
  if (connected.size !== roadSet.size) {
    throw new Error(`Road network has ${roadSet.size - connected.size} disconnected road tiles.`);
  }
}

function generateStructures(occupied, roadSet) {
  const blocks = [];
  const structureCount = 60;

  // Rectangular ruins/fortresses give the map deliberate landmarks.
  for (let index = 0; index < structureCount; index += 1) {
    const w = randInt(2, 5);
    const h = randInt(2, 4);
    const left = randInt(BOUNDS.min, BOUNDS.max - w);
    const top = randInt(BOUNDS.min, BOUNDS.max - h);
    const type = rng() < 0.6 ? 'ruin' : pick(BLOCK_TYPES);

    for (let y = top; y < top + h; y += 1) {
      for (let x = left; x < left + w; x += 1) {
        // Leave the perimeter mostly intact but punch a doorway or two so the
        // structures read as walls rather than solid blobs.
        const isEdge = x === left || x === left + w - 1 || y === top || y === top + h - 1;
        if (!isEdge) continue;
        if (rng() < 0.18) continue; // doorway gap

        if (placeBlock(blocks, occupied, roadSet, x, y, type)) {
          // placed
        }
      }
    }
  }

  return blocks;
}

function generateBlockClusters(blocks, occupied, roadSet) {
  const clusterCount = 260;

  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const type = pick(BLOCK_TYPES);
    let x = randInt(BOUNDS.min, BOUNDS.max);
    let y = randInt(BOUNDS.min, BOUNDS.max);
    const length = randInt(3, 8);

    for (let step = 0; step < length; step += 1) {
      placeBlock(blocks, occupied, roadSet, x, y, type);

      // Random-walk the cluster into an organic shape.
      const dir = randInt(0, 3);
      if (dir === 0) x += 1;
      else if (dir === 1) x -= 1;
      else if (dir === 2) y += 1;
      else y -= 1;
    }
  }
}

function placeBlock(blocks, occupied, roadSet, x, y, type) {
  if (!inBounds(x, y)) return false;
  if (distanceFromCenter(x, y) <= SAFE_RADIUS) return false;
  if (occupied.has(tileKey(x, y)) || roadSet.has(tileKey(x, y))) return false;

  occupied.add(tileKey(x, y));
  blocks.push({ x, y, type });
  return true;
}

function generateEncounters(occupied, roadSet) {
  const encounters = [];
  const encounterTiles = new Set();
  const usedTeamKeys = new Set();
  let id = 1;

  for (let y = BOUNDS.min; y <= BOUNDS.max; y += 1) {
    for (let x = BOUNDS.min; x <= BOUNDS.max; x += 1) {
      if (distanceFromCenter(x, y) <= SAFE_RADIUS) continue;
      if (occupied.has(tileKey(x, y))) continue;
      if (roadSet.has(tileKey(x, y))) continue; // keep roads walkable

      // Denser overall, and denser still toward the dangerous outer rings.
      const t = difficultyFactor(x, y);
      const chance = 0.03 + t * 0.045;
      if (rng() > chance) continue;

      // Keep encounters from clumping onto adjacent tiles.
      if (hasNearbyEncounter(encounterTiles, x, y)) continue;

      occupied.add(tileKey(x, y));
      encounterTiles.add(tileKey(x, y));
      encounters.push(buildEncounter(`enc-${id}`, x, y, usedTeamKeys));
      id += 1;
    }
  }

  validateEncounterTeams(encounters);
  return encounters;
}

function validateEncounterTeams(encounters) {
  const keys = new Map();

  encounters.forEach((encounter) => {
    const key = teamKey(encounter.team);
    if (keys.has(key)) {
      throw new Error(`Duplicate enemy team composition: ${keys.get(key)} and ${encounter.id}`);
    }
    keys.set(key, encounter.id);

    if (encounter.team.every((member) => SUPPORT_ONLY_ROLES.has(member.role))) {
      throw new Error(`Support-only enemy team generated: ${encounter.id}`);
    }
  });
}

function hasNearbyEncounter(encounterTiles, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      if (encounterTiles.has(tileKey(x + dx, y + dy))) return true;
    }
  }
  return false;
}

function generateEvents(occupied, roadSet) {
  const events = LANDMARKS.concat(buildDarknessPortals(roadSet, LANDMARKS));
  ROAD_LANDMARKS.concat(events).forEach((event) => occupied.add(tileKey(event.x, event.y)));
  return events.map((event) => ({ ...event }));
}

function buildDarknessPortals(roadSet, taken) {
  const occupied = new Set(taken.map((event) => tileKey(event.x, event.y)));
  const candidates = Array.from(roadSet)
    .map((key) => {
      const [x, y] = key.split(',').map(Number);
      return { x, y, distance: distanceBetween({ x, y }, SPAWN) };
    })
    .filter((tile) => !occupied.has(tileKey(tile.x, tile.y)) && tile.distance > 0)
    .sort((a, b) => (
      b.distance - a.distance ||
      Math.abs(b.x) + Math.abs(b.y) - (Math.abs(a.x) + Math.abs(a.y)) ||
      a.x - b.x ||
      a.y - b.y
    ));

  const selected = [];
  for (const candidate of candidates) {
    if (selected.some((portal) => distanceBetween(portal, candidate) < DARKNESS_PORTAL_MIN_SPACING)) continue;
    selected.push(candidate);
    if (selected.length === DARKNESS_PORTAL_COUNT) break;
  }

  if (selected.length !== DARKNESS_PORTAL_COUNT) {
    throw new Error(`Could not place ${DARKNESS_PORTAL_COUNT} Darkness Portals on remote road tiles.`);
  }

  return selected.map((portal) => ({
    x: portal.x,
    y: portal.y,
    type: 'darkness-portal',
    title: 'Darkness Portal',
    description: `Spend ${DARKNESS_PORTAL_SUMMON_SOUL_COST_PER_DISTANCE} Souls per map step to teleport here instantly.`,
    summonCostPerDistance: DARKNESS_PORTAL_SUMMON_SOUL_COST_PER_DISTANCE
  }));
}

// The neutral center and all 11 demon zones must each contain a Forsaken
// Shrine, and every shrine tile must sit on the road network.
function validateZoneShrines(events, roadSet) {
  const shrines = events.filter((event) => event.type === 'forsaken_shrine');
  const shrineZones = new Set(shrines.map((shrine) => zoneTypeId(shrine.x, shrine.y) || 0));

  for (let typeId = 0; typeId <= TYPE_COUNT; typeId += 1) {
    if (!shrineZones.has(typeId)) {
      throw new Error(`Zone ${typeId} has no Forsaken Shrine.`);
    }
  }

  shrines.forEach((shrine) => {
    if (!roadSet.has(tileKey(shrine.x, shrine.y))) {
      throw new Error(`Forsaken Shrine at ${shrine.x},${shrine.y} is not on the road network.`);
    }
  });
}

function main() {
  const occupied = new Set();
  // Reserve the spawn tile and its neighbors.
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      occupied.add(tileKey(SPAWN.x + dx, SPAWN.y + dy));
    }
  }

  const roadSet = new Set();
  generateRoads(roadSet);
  validateConnectedRoads(roadSet);
  const events = generateEvents(occupied, roadSet);
  validateZoneShrines(events, roadSet);

  const blocks = generateStructures(occupied, roadSet);
  generateBlockClusters(blocks, occupied, roadSet);

  const encounters = generateEncounters(occupied, roadSet);
  const roads = Array.from(roadSet).map((key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });

  const map = {
    bounds: BOUNDS,
    spawn: SPAWN,
    roads,
    events,
    blocks,
    encounters
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(map, null, 2)}\n`);

  const difficultyCounts = encounters.reduce((counts, encounter) => {
    counts[encounter.difficulty] = (counts[encounter.difficulty] || 0) + 1;
    return counts;
  }, {});
  const zoneCounts = encounters.reduce((counts, encounter) => {
    counts[encounter.zoneType] = (counts[encounter.zoneType] || 0) + 1;
    return counts;
  }, {});

  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`  roads: ${roads.length}`);
  console.log(`  events: ${events.length}`);
  console.log(`  blocks: ${blocks.length}`);
  console.log(`  encounters: ${encounters.length}`);
  console.log('  difficulty distribution:', difficultyCounts);
  console.log('  encounters per zone type:', zoneCounts);
}

main();
