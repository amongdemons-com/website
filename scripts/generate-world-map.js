'use strict';

/**
 * Generates public/api/data/map.json: a 101x101 world (-50..50 on each axis)
 * built from roads, unpassable blocks/structures, and demon-team encounters.
 *
 * Layout rules:
 *  - Difficulty scales with distance from the center (0, 0): teams get larger
 *    and rarer the further out they sit.
 *  - Demon TYPE is zone-based — the map is split into angular wedges and each
 *    of the 11 types predominates in its own wedge, so areas feel themed.
 *  - Roads radiate from the center (spokes) and loop around it (rings). Travel
 *    along a road is much less likely to be ambushed (see world.js).
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
const FRONT_TYPE_IDS = [1, 5, 7, 8, 9];
const BLOCK_TYPES = ['basalt', 'bone-spur', 'chasm', 'ruin'];
const TYPE_COUNT = 11;
const ZONE_ROTATION = 0.045; // nudge wedge boundaries off the cardinal axes
const PRIMARY_TYPE_CHANCE = 0.68; // odds a team member is the zone's signature type

const demonTypes = require(path.join(DATA_DIR, 'demon-types.json'));
const demonAssets = require(path.join(DATA_DIR, 'demons.json'));

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

// Each demon type owns an angular wedge around the center, so a region reads
// as "the juggernaut lands", "the poison marsh", etc.
function zoneTypeId(x, y) {
  const angle = Math.atan2(y - SPAWN.y, x - SPAWN.x); // -PI..PI
  const normalized = (angle + Math.PI) / (2 * Math.PI); // 0..1
  const sector = Math.floor(((normalized + ZONE_ROTATION) % 1) * TYPE_COUNT) % TYPE_COUNT;
  return sector + 1;
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

function buildEncounter(id, x, y) {
  const t = difficultyFactor(x, y);
  const meter = difficultyMeter(t);
  const rarities = allowedRaritiesForMeter(meter);
  const rarestAllowed = rarities[rarities.length - 1];
  const size = teamSizeForFactor(t);
  const primaryType = zoneTypeId(x, y);

  const members = [];

  // The signature demon: zone type at the area's top rarity. It drives the map
  // portrait so the wedge's identity is readable at a glance.
  members.push(buildMember(primaryType, rarestAllowed, `${id}-m1`, preferredPosition(primaryType)));

  for (let index = 1; index < size; index += 1) {
    const typeId = rng() < PRIMARY_TYPE_CHANCE ? primaryType : randInt(1, TYPE_COUNT);
    const rarity = pick(rarities);
    members.push(buildMember(typeId, rarity, `${id}-m${index + 1}`, preferredPosition(typeId)));
  }

  // Guarantee at least one front-line demon so formations read sensibly.
  if (!members.some((member) => member.position === 'front')) {
    members[0].position = 'front';
  }

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
    difficulty: meter,
    zoneType: primaryType,
    keyDemon: {
      typeId: keyDemon.typeId,
      species: keyDemon.species,
      rarity: keyDemon.rarity,
      imageUrl: keyDemon.imageUrl
    },
    team: members
  };
}

// Roads: an orthogonal network of straight avenues (a central cross plus two
// offset spokes per axis) tied together by concentric square rings. Building it
// only from axis-aligned segments guarantees roads never run diagonally; the
// spacing keeps parallel roads apart, and a safety pass strips any 2x2 cluster
// and drops anything not connected to the rest of the network.
const ROAD_REACH = 47;
const ROAD_SPOKES = [0, 18, -18]; // x/y offsets for the straight avenues
const ROAD_RINGS = [12, 26, 40]; // square (Chebyshev) ring radii

function generateRoads(roadSet) {
  const tiles = new Set();

  // Straight avenues — full-length vertical and horizontal lines.
  ROAD_SPOKES.forEach((offset) => {
    for (let i = -ROAD_REACH; i <= ROAD_REACH; i += 1) {
      addRoadTile(tiles, offset, i); // vertical line x = offset
      addRoadTile(tiles, i, offset); // horizontal line y = offset
    }
  });

  // Square rings loop the avenues together.
  ROAD_RINGS.forEach((r) => {
    for (let i = -r; i <= r; i += 1) {
      addRoadTile(tiles, i, -r);
      addRoadTile(tiles, i, r);
      addRoadTile(tiles, -r, i);
      addRoadTile(tiles, r, i);
    }
  });

  stripRoadSquares(tiles); // never allow a 2x2 block of road
  keepConnectedRoads(tiles, tileKey(SPAWN.x, SPAWN.y));

  tiles.forEach((key) => roadSet.add(key));
}

function addRoadTile(tiles, x, y) {
  if (inBounds(x, y)) tiles.add(tileKey(x, y));
}

// Remove tiles until no 2x2 square is fully paved. Deterministic scan order.
function stripRoadSquares(tiles) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const key of tiles) {
      const [x, y] = key.split(',').map(Number);
      const square = [tileKey(x, y), tileKey(x + 1, y), tileKey(x, y + 1), tileKey(x + 1, y + 1)];
      if (square.every((k) => tiles.has(k))) {
        tiles.delete(square[3]);
        changed = true;
      }
    }
  }
}

// Keep only the 4-connected road component reachable from the start tile, so
// every road links to the rest (no orphaned or diagonally-attached fragments).
function keepConnectedRoads(tiles, startKey) {
  if (!tiles.has(startKey)) return;

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

  for (const key of tiles) {
    if (!seen.has(key)) tiles.delete(key);
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
      if (hasNeighborEncounter(occupied, x, y)) continue;

      occupied.add(tileKey(x, y));
      encounters.push(buildEncounter(`enc-${id}`, x, y));
      id += 1;
    }
  }

  return encounters;
}

function hasNeighborEncounter(occupied, x, y) {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      if (occupied.has(`enc:${x + dx},${y + dy}`)) return true;
    }
  }
  occupied.add(`enc:${x},${y}`);
  return false;
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
  console.log(`  blocks: ${blocks.length}`);
  console.log(`  encounters: ${encounters.length}`);
  console.log('  difficulty distribution:', difficultyCounts);
  console.log('  encounters per zone type:', zoneCounts);
}

main();
