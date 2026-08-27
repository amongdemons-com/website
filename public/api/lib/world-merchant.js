const db = require('./db');
const { cleanPlayer } = require('./auth');
const { getEchoCatalog } = require('./echo-bag');
const worldMap = require('../data/map.json');

const MERCHANT_ID = 'wandering-echo-merchant';
const MERCHANT_NAME = 'Crowley';
const MERCHANT_DESCRIPTION = 'Offers rare wares in exchange for Souls';
const MERCHANT_MOVE_INTERVAL_SECONDS = 30 * 60;
const MERCHANT_STOCK_SIZE = 4;
const MERCHANT_STOCK_VERSION = 1;
const MERCHANT_BRIBE_COST = 50;
const MERCHANT_BRIBE_COST_PER_LEVEL = 5;
const MERCHANT_LEVELS_PER_LUCK_REROLL = 50;
const MERCHANT_MAX_LEVEL_LUCK_REROLL_CHANCE = 1;
// At the outer edge, every slot gets a second baseline rarity roll. Keeping the
// better result makes distant shops meaningfully stronger while the Echo count,
// exact demon type, and Soul price still gate completed high-rarity summons.
const MERCHANT_MAX_DISTANCE_LUCK_REROLL_CHANCE = 1;

// A shop contains mostly attainable Echoes. The final two bands are
// intentionally tiny: a Mythic averages one appearance per 20,000 slots.
const MERCHANT_RARITY_WEIGHTS = Object.freeze({
  common: 700000,
  uncommon: 220000,
  rare: 70000,
  epic: 9000,
  legendary: 950,
  mythic: 50
});

// Prices remain strongly rarity-scaled without requiring an inflated economy.
const MERCHANT_RARITY_PRICES = Object.freeze({
  common: 10,
  uncommon: 30,
  rare: 100,
  epic: 300,
  legendary: 1000,
  mythic: 5000
});

const STATIC_OCCUPIED_TILES = new Set([
  ...(Array.isArray(worldMap.blocks) ? worldMap.blocks : []),
  ...(Array.isArray(worldMap.events) ? worldMap.events : []),
  ...(Array.isArray(worldMap.encounters) ? worldMap.encounters : [])
].map(tileKey));

const MERCHANT_ROAD_ITINERARY = shuffleDeterministically(
  (Array.isArray(worldMap.roads) ? worldMap.roads : [])
    .filter((tile) => !STATIC_OCCUPIED_TILES.has(tileKey(tile)))
    .map((tile) => ({ x: Number(tile.x) || 0, y: Number(tile.y) || 0 })),
  hashSeed('among-demons:wandering-echo-merchant:road-itinerary:v1')
);

function getActiveWorldMerchant(now = new Date()) {
  const spawnId = getMerchantSpawnId(now);
  const position = resolveMerchantPosition(spawnId);
  const intervalMs = MERCHANT_MOVE_INTERVAL_SECONDS * 1000;
  const numericSpawnId = Number(spawnId);

  return {
    id: MERCHANT_ID,
    name: MERCHANT_NAME,
    description: MERCHANT_DESCRIPTION,
    spawnId,
    ...position,
    spawnedAt: new Date(numericSpawnId * intervalMs).toISOString(),
    movesAt: new Date((numericSpawnId + 1) * intervalMs).toISOString()
  };
}

function getMerchantSpawnId(now = new Date()) {
  const parsed = now instanceof Date ? now.getTime() : Date.parse(now);
  const time = Number.isFinite(parsed) ? parsed : Date.now();
  return String(Math.floor(time / (MERCHANT_MOVE_INTERVAL_SECONDS * 1000)));
}

function resolveMerchantPosition(spawnId) {
  if (!MERCHANT_ROAD_ITINERARY.length) {
    return {
      x: Number(worldMap.spawn?.x) || 0,
      y: Number(worldMap.spawn?.y) || 0
    };
  }

  const numericSpawnId = Number(spawnId);
  const waypoint = Number.isSafeInteger(numericSpawnId)
    ? ((numericSpawnId % MERCHANT_ROAD_ITINERARY.length) + MERCHANT_ROAD_ITINERARY.length)
      % MERCHANT_ROAD_ITINERARY.length
    : 0;
  return { ...MERCHANT_ROAD_ITINERARY[waypoint] };
}

async function getWorldMerchantForPlayer(playerId, options = {}) {
  const merchant = getActiveWorldMerchant(options.now);
  const queryable = options.queryable || db;
  const playerLevel = normalizePlayerLevel(options.playerLevel);
  const [catalog, purchasedSlots, rerollCount] = await Promise.all([
    getEchoCatalog(),
    getPurchasedMerchantSlots(playerId, merchant.spawnId, queryable),
    getMerchantRerollCount(playerId, merchant.spawnId, queryable)
  ]);

  return {
    ...merchant,
    stockId: getMerchantStockId(merchant.spawnId, rerollCount, playerLevel),
    rerollCount,
    bribeCost: getMerchantBribeCost(playerLevel),
    itemSlots: buildMerchantStock(playerId, merchant.spawnId, catalog, purchasedSlots, rerollCount, playerLevel)
  };
}

async function getMerchantRerollCount(playerId, spawnId, queryable = db) {
  const [rows] = await queryable.query(
    `SELECT reroll_count
     FROM player_world_merchant_stock
     WHERE player_id = ? AND spawn_id = ?
     LIMIT 1`,
    [playerId, spawnId]
  );
  return Math.max(0, Math.floor(Number(rows[0]?.reroll_count) || 0));
}

async function getPurchasedMerchantSlots(playerId, spawnId, queryable = db) {
  const [rows] = await queryable.query(
    `SELECT slot
     FROM player_world_merchant_purchases
     WHERE player_id = ? AND spawn_id = ?`,
    [playerId, spawnId]
  );
  return new Set(rows.map((row) => Math.max(0, Math.floor(Number(row.slot) || 0))));
}

function buildMerchantStock(
  playerId,
  spawnId,
  catalog,
  purchasedSlots = new Set(),
  rerollCount = 0,
  playerLevel = 1
) {
  const definitions = [...(catalog instanceof Map ? catalog.values() : [])]
    .filter((definition) => definition?.itemKey && MERCHANT_RARITY_PRICES[definition.rarity])
    .sort((left, right) => String(left.itemKey).localeCompare(String(right.itemKey)));
  const byRarity = new Map();

  definitions.forEach((definition) => {
    if (!byRarity.has(definition.rarity)) byRarity.set(definition.rarity, []);
    byRarity.get(definition.rarity).push(definition);
  });

  const normalizedRerollCount = Math.max(0, Math.floor(Number(rerollCount) || 0));
  const rerollSeed = normalizedRerollCount > 0 ? `:reroll:${normalizedRerollCount}` : '';
  const stockSeed = `merchant-stock:v${MERCHANT_STOCK_VERSION}:${spawnId}:${String(playerId || '')}${rerollSeed}`;
  const rng = seededRng(hashSeed(stockSeed));
  // Separate streams keep the original stock roll sequence stable unless a
  // slot actually benefits from distance or player-level luck.
  const luckRng = seededRng(hashSeed(`${stockSeed}:distance-luck:v1`));
  const levelLuckRng = seededRng(hashSeed(`${stockSeed}:level-luck:v1`));
  const luckRerollChance = getMerchantLuckRerollChance(resolveMerchantPosition(spawnId));
  const levelLuckRerollChance = getMerchantLevelLuckRerollChance(playerLevel);
  const usedKeys = new Set();
  const usedTypeIds = new Set();

  return Array.from({ length: MERCHANT_STOCK_SIZE }, (unused, slot) => {
    const rarity = rollMerchantRarity(
      rng,
      luckRerollChance,
      luckRng,
      levelLuckRerollChance,
      levelLuckRng
    );
    const rarityPool = byRarity.get(rarity) || definitions;
    let candidates = rarityPool.filter((definition) => (
      !usedKeys.has(definition.itemKey) && !usedTypeIds.has(Number(definition.typeId))
    ));
    if (!candidates.length) {
      candidates = rarityPool.filter((definition) => !usedKeys.has(definition.itemKey));
    }
    if (!candidates.length) {
      throw new Error(`The wandering merchant cannot fill stock slot ${slot + 1}.`);
    }

    const definition = candidates[Math.floor(rng() * candidates.length)];
    usedKeys.add(definition.itemKey);
    usedTypeIds.add(Number(definition.typeId));

    return {
      slot,
      itemKey: definition.itemKey,
      itemType: 'echo',
      typeId: Number(definition.typeId),
      rarity: definition.rarity,
      species: definition.species,
      role: definition.role,
      preferredPosition: definition.preferredPosition,
      imageUrl: toWorldMapImageUrl(definition.imageUrl),
      price: MERCHANT_RARITY_PRICES[definition.rarity],
      purchased: purchasedSlots.has(slot)
    };
  });
}

function rollMerchantRarity(
  rng = Math.random,
  luckRerollChance = 0,
  luckRng = rng,
  levelLuckRerollChance = 0,
  levelLuckRng = luckRng
) {
  let rarity = rollBaseMerchantRarity(rng);
  rarity = maybeUpgradeMerchantRarity(rarity, luckRerollChance, luckRng);
  return maybeUpgradeMerchantRarity(rarity, levelLuckRerollChance, levelLuckRng);
}

function maybeUpgradeMerchantRarity(currentRarity, rerollChance, rng = Math.random) {
  const normalizedLuck = Math.min(
    MERCHANT_MAX_DISTANCE_LUCK_REROLL_CHANCE,
    Math.max(0, Number(rerollChance) || 0)
  );
  if (normalizedLuck <= 0 || rng() >= normalizedLuck) return currentRarity;

  const secondRarity = rollBaseMerchantRarity(rng);
  const rarityOrder = Object.keys(MERCHANT_RARITY_WEIGHTS);
  return rarityOrder.indexOf(secondRarity) > rarityOrder.indexOf(currentRarity)
    ? secondRarity
    : currentRarity;
}

function rollBaseMerchantRarity(rng = Math.random) {
  const entries = Object.entries(MERCHANT_RARITY_WEIGHTS);
  const totalWeight = entries.reduce((total, entry) => total + entry[1], 0);
  let roll = rng() * totalWeight;

  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }

  return 'common';
}

function getMerchantLuckRerollChance(position = {}) {
  const centerX = Number(worldMap.spawn?.x) || 0;
  const centerY = Number(worldMap.spawn?.y) || 0;
  const boundsMin = Number(worldMap.bounds?.min);
  const boundsMax = Number(worldMap.bounds?.max);
  const edgeDistance = Math.max(
    1,
    Number.isFinite(boundsMin) ? Math.abs(boundsMin - centerX) : 0,
    Number.isFinite(boundsMax) ? Math.abs(boundsMax - centerX) : 0,
    Number.isFinite(boundsMin) ? Math.abs(boundsMin - centerY) : 0,
    Number.isFinite(boundsMax) ? Math.abs(boundsMax - centerY) : 0
  );
  // Match the square distance rings used by World Terror.
  const distance = Math.max(
    Math.abs((Number(position.x) || 0) - centerX),
    Math.abs((Number(position.y) || 0) - centerY)
  );
  const distanceProgress = Math.min(1, distance / edgeDistance);

  return distanceProgress * MERCHANT_MAX_DISTANCE_LUCK_REROLL_CHANCE;
}

function getMerchantLevelLuckRerollChance(playerLevel = 1) {
  return Math.min(
    MERCHANT_MAX_LEVEL_LUCK_REROLL_CHANCE,
    (normalizePlayerLevel(playerLevel) - 1) / MERCHANT_LEVELS_PER_LUCK_REROLL
  );
}

function getMerchantBribeCost(playerLevel = 1) {
  return MERCHANT_BRIBE_COST + ((normalizePlayerLevel(playerLevel) - 1) * MERCHANT_BRIBE_COST_PER_LEVEL);
}

async function purchaseWorldMerchantItem(
  playerId,
  requestedSpawnId,
  requestedStockId,
  requestedSlot,
  options = {}
) {
  const now = options.now || new Date();
  const merchant = getActiveWorldMerchant(now);
  const spawnId = String(requestedSpawnId || '');
  const slot = Number(requestedSlot);

  if (spawnId !== merchant.spawnId) {
    throw createHttpError('The merchant has moved and laid out new stock.', 409);
  }
  if (!Number.isInteger(slot) || slot < 0 || slot >= MERCHANT_STOCK_SIZE) {
    throw createHttpError('Choose an available merchant item.', 400);
  }

  const catalog = await getEchoCatalog();
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const rerollCount = await lockMerchantRerollCount(connection, playerId, merchant.spawnId);
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
    if (!playerRows.length) throw createHttpError('Hunter not found.', 404);
    const playerLevel = normalizePlayerLevel(playerRows[0].level);
    const stockId = getMerchantStockId(merchant.spawnId, rerollCount, playerLevel);
    if (String(requestedStockId || '') !== stockId) {
      throw createHttpError('Crowley has already replaced these offers.', 409);
    }
    const stock = buildMerchantStock(playerId, merchant.spawnId, catalog, new Set(), rerollCount, playerLevel);
    const item = stock[slot];

    const [positionRows] = await connection.query(
      'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1 FOR UPDATE',
      [playerId]
    );
    const position = positionRows[0];
    if (!position || Number(position.x) !== merchant.x || Number(position.y) !== merchant.y) {
      throw createHttpError('Stand beside the merchant before buying from his shop.', 409);
    }

    const [purchaseResult] = await connection.query(
      `INSERT IGNORE INTO player_world_merchant_purchases
         (player_id, spawn_id, slot, item_key, price)
       VALUES (?, ?, ?, ?, ?)`,
      [playerId, merchant.spawnId, item.slot, item.itemKey, item.price]
    );
    if (!purchaseResult.affectedRows) {
      throw createHttpError('That item has already been bought from this stock.', 409);
    }

    const availableSouls = Math.max(0, Math.floor(Number(playerRows[0].souls) || 0));
    if (availableSouls < item.price) {
      throw createHttpError(`You need ${formatSoulCount(item.price)} for that Echo.`, 409);
    }

    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [item.price, playerId]
    );
    await connection.query(
      `INSERT INTO player_bag (player_id, item_key, item_type, quantity)
       VALUES (?, ?, 'echo', 1)
       ON DUPLICATE KEY UPDATE
         quantity = quantity + 1,
         updated_at = CURRENT_TIMESTAMP`,
      [playerId, item.itemKey]
    );
    await connection.query(
      `INSERT IGNORE INTO player_echo_discoveries (player_id, type_id, rarity)
       VALUES (?, ?, ?)`,
      [playerId, item.typeId, item.rarity]
    );

    await connection.commit();
    committed = true;

    return {
      item: { ...item, purchased: true },
      player: cleanPlayer({
        ...playerRows[0],
        souls: availableSouls - item.price
      })
    };
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function bribeWorldMerchant(playerId, requestedSpawnId, requestedStockId, options = {}) {
  const now = options.now || new Date();
  const merchant = getActiveWorldMerchant(now);
  const spawnId = String(requestedSpawnId || '');

  if (spawnId !== merchant.spawnId) {
    throw createHttpError('The merchant has refreshed his stock.', 409);
  }

  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const rerollCount = await lockMerchantRerollCount(connection, playerId, merchant.spawnId);
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
    if (!playerRows.length) throw createHttpError('Hunter not found.', 404);
    const playerLevel = normalizePlayerLevel(playerRows[0].level);
    const stockId = getMerchantStockId(merchant.spawnId, rerollCount, playerLevel);
    if (String(requestedStockId || '') !== stockId) {
      throw createHttpError('Crowley has already replaced these offers.', 409);
    }

    const [positionRows] = await connection.query(
      'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1 FOR UPDATE',
      [playerId]
    );
    const position = positionRows[0];
    if (!position || Number(position.x) !== merchant.x || Number(position.y) !== merchant.y) {
      throw createHttpError('Stand beside Crowley before bribing him.', 409);
    }

    const availableSouls = Math.max(0, Math.floor(Number(playerRows[0].souls) || 0));
    const bribeCost = getMerchantBribeCost(playerLevel);
    if (availableSouls < bribeCost) {
      throw createHttpError(`You need ${formatSoulCount(bribeCost)} to bribe Crowley.`, 409);
    }

    const nextRerollCount = rerollCount + 1;
    await connection.query(
      `UPDATE player_world_merchant_stock
       SET reroll_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ?`,
      [nextRerollCount, playerId]
    );
    await connection.query(
      'DELETE FROM player_world_merchant_purchases WHERE player_id = ? AND spawn_id = ?',
      [playerId, merchant.spawnId]
    );
    await connection.query(
      'UPDATE players SET souls = souls - ? WHERE id = ?',
      [bribeCost, playerId]
    );

    await connection.commit();
    committed = true;

    return {
      rerollCount: nextRerollCount,
      stockId: getMerchantStockId(merchant.spawnId, nextRerollCount, playerLevel),
      player: cleanPlayer({
        ...playerRows[0],
        souls: availableSouls - bribeCost
      })
    };
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function lockMerchantRerollCount(connection, playerId, spawnId) {
  await connection.query(
    `INSERT IGNORE INTO player_world_merchant_stock (player_id, spawn_id, reroll_count)
     VALUES (?, ?, 0)`,
    [playerId, spawnId]
  );
  const [rows] = await connection.query(
    `SELECT spawn_id, reroll_count
     FROM player_world_merchant_stock
     WHERE player_id = ?
     LIMIT 1
     FOR UPDATE`,
    [playerId]
  );
  const currentSpawnId = String(rows[0]?.spawn_id || '');
  if (currentSpawnId !== String(spawnId)) {
    await connection.query(
      `UPDATE player_world_merchant_stock
       SET spawn_id = ?, reroll_count = 0, updated_at = CURRENT_TIMESTAMP
       WHERE player_id = ?`,
      [spawnId, playerId]
    );
    return 0;
  }
  return Math.max(0, Math.floor(Number(rows[0]?.reroll_count) || 0));
}

function getMerchantStockId(spawnId, rerollCount = 0, playerLevel = 1) {
  return `${String(spawnId || '')}:${Math.max(0, Math.floor(Number(rerollCount) || 0))}:level:${normalizePlayerLevel(playerLevel)}`;
}

function normalizePlayerLevel(playerLevel) {
  return Math.max(1, Math.floor(Number(playerLevel) || 1));
}

function toWorldMapImageUrl(url) {
  const match = /^\/app\/images\/demons\/(?:thumbnails\/)?(\d+)\.png(?:[?#].*)?$/.exec(String(url || ''));
  return match ? `/app/images/demons/map/${match[1]}.webp?v=art-d07fa45af2e7` : url;
}

function shuffleDeterministically(values, seed) {
  const shuffled = [...values];
  const rng = seededRng(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function seededRng(seed) {
  let value = Number(seed) >>> 0 || 1;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
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

function tileKey(tile = {}) {
  return `${Number(tile.x) || 0},${Number(tile.y) || 0}`;
}

function formatSoulCount(value) {
  const count = Math.max(0, Math.floor(Number(value) || 0));
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'Soul' : 'Souls'}`;
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  MERCHANT_BRIBE_COST,
  MERCHANT_BRIBE_COST_PER_LEVEL,
  MERCHANT_ID,
  MERCHANT_LEVELS_PER_LUCK_REROLL,
  MERCHANT_MAX_LEVEL_LUCK_REROLL_CHANCE,
  MERCHANT_MOVE_INTERVAL_SECONDS,
  MERCHANT_MAX_DISTANCE_LUCK_REROLL_CHANCE,
  MERCHANT_RARITY_PRICES,
  MERCHANT_RARITY_WEIGHTS,
  MERCHANT_STOCK_SIZE,
  bribeWorldMerchant,
  buildMerchantStock,
  getActiveWorldMerchant,
  getMerchantLuckRerollChance,
  getMerchantLevelLuckRerollChance,
  getMerchantBribeCost,
  getMerchantSpawnId,
  getMerchantStockId,
  getWorldMerchantForPlayer,
  purchaseWorldMerchantItem,
  rollMerchantRarity,
  _test: {
    MERCHANT_ROAD_ITINERARY,
    resolveMerchantPosition
  }
};
