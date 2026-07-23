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
const MERCHANT_TEST_POSITION = Object.freeze({ x: 3, y: -1 });

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

function resolveMerchantPosition() {
  // TODO: Remove this fixed test position and restore the road itinerary.
  return { ...MERCHANT_TEST_POSITION };
}

async function getWorldMerchantForPlayer(playerId, options = {}) {
  const merchant = getActiveWorldMerchant(options.now);
  const queryable = options.queryable || db;
  const [catalog, purchasedSlots, rerollCount] = await Promise.all([
    getEchoCatalog(),
    getPurchasedMerchantSlots(playerId, merchant.spawnId, queryable),
    getMerchantRerollCount(playerId, merchant.spawnId, queryable)
  ]);

  return {
    ...merchant,
    stockId: getMerchantStockId(merchant.spawnId, rerollCount),
    rerollCount,
    bribeCost: MERCHANT_BRIBE_COST,
    itemSlots: buildMerchantStock(playerId, merchant.spawnId, catalog, purchasedSlots, rerollCount)
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

function buildMerchantStock(playerId, spawnId, catalog, purchasedSlots = new Set(), rerollCount = 0) {
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
  const rng = seededRng(hashSeed(
    `merchant-stock:v${MERCHANT_STOCK_VERSION}:${spawnId}:${String(playerId || '')}${rerollSeed}`
  ));
  const usedKeys = new Set();
  const usedTypeIds = new Set();

  return Array.from({ length: MERCHANT_STOCK_SIZE }, (unused, slot) => {
    const rarity = rollMerchantRarity(rng);
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

function rollMerchantRarity(rng = Math.random) {
  const entries = Object.entries(MERCHANT_RARITY_WEIGHTS);
  const totalWeight = entries.reduce((total, entry) => total + entry[1], 0);
  let roll = rng() * totalWeight;

  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }

  return 'common';
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
    const stockId = getMerchantStockId(merchant.spawnId, rerollCount);
    if (String(requestedStockId || '') !== stockId) {
      throw createHttpError('Crowley has already replaced these offers.', 409);
    }
    const stock = buildMerchantStock(playerId, merchant.spawnId, catalog, new Set(), rerollCount);
    const item = stock[slot];

    const [positionRows] = await connection.query(
      'SELECT x, y FROM player_world_positions WHERE player_id = ? LIMIT 1 FOR UPDATE',
      [playerId]
    );
    const position = positionRows[0];
    if (!position || Number(position.x) !== merchant.x || Number(position.y) !== merchant.y) {
      throw createHttpError('Stand beside the merchant before buying from his shop.', 409);
    }

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
    const stockId = getMerchantStockId(merchant.spawnId, rerollCount);
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

    const availableSouls = Math.max(0, Math.floor(Number(playerRows[0].souls) || 0));
    if (availableSouls < MERCHANT_BRIBE_COST) {
      throw createHttpError(`You need ${formatSoulCount(MERCHANT_BRIBE_COST)} to bribe Crowley.`, 409);
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
      [MERCHANT_BRIBE_COST, playerId]
    );

    await connection.commit();
    committed = true;

    return {
      rerollCount: nextRerollCount,
      stockId: getMerchantStockId(merchant.spawnId, nextRerollCount),
      player: cleanPlayer({
        ...playerRows[0],
        souls: availableSouls - MERCHANT_BRIBE_COST
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

function getMerchantStockId(spawnId, rerollCount = 0) {
  return `${String(spawnId || '')}:${Math.max(0, Math.floor(Number(rerollCount) || 0))}`;
}

function toWorldMapImageUrl(url) {
  const match = /^\/app\/images\/demons\/(?:thumbnails\/)?(\d+)\.png$/.exec(String(url || ''));
  return match ? `/app/images/demons/map/${match[1]}.webp` : url;
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
  MERCHANT_ID,
  MERCHANT_MOVE_INTERVAL_SECONDS,
  MERCHANT_RARITY_PRICES,
  MERCHANT_RARITY_WEIGHTS,
  MERCHANT_STOCK_SIZE,
  bribeWorldMerchant,
  buildMerchantStock,
  getActiveWorldMerchant,
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
