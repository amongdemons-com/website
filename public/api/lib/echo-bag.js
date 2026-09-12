const db = require('./db');
const {
  SUMMON_REQUIREMENTS,
  getEchoConfig,
  getEchoItemKey,
  normalizeEchoRarity
} = require('./echo-config');
const { getDemonAssets, getDemonTypes } = require('./game-data');

async function getEchoCatalog() {
  const [assets, types] = await Promise.all([getDemonAssets(), getDemonTypes()]);
  const byKey = new Map();

  assets.forEach((asset) => {
    const typeId = Number(asset.type);
    const rarity = normalizeEchoRarity(asset.rarity);
    const itemKey = getEchoItemKey(typeId, rarity);
    const type = types[String(typeId)];
    if (!itemKey || !type) return;

    byKey.set(itemKey, {
      itemKey,
      itemType: 'echo',
      typeId,
      rarity,
      species: type.name || `Type ${typeId} Demon`,
      role: type.role || '',
      preferredPosition: type.preferredPosition || asset.preferredPosition || '',
      sourceDemonId: Number(asset.id),
      imageUrl: asset.image_url || asset.imageUrl || '',
      summonRequirement: SUMMON_REQUIREMENTS[rarity]
    });
  });

  return byKey;
}

async function getEchoDefinition(typeId, rarity) {
  const itemKey = getEchoItemKey(typeId, rarity);
  const definition = itemKey ? (await getEchoCatalog()).get(itemKey) : null;
  if (!definition) throw createHttpError('Echo not found.', 404);
  return definition;
}

async function getPlayerBag(playerId, queryable = db) {
  const [items] = await queryable.query(
    `SELECT item_key AS itemKey, item_type AS itemType, quantity, updated_at AS updatedAt
     FROM player_bag WHERE player_id = ? AND item_type <> 'echo' AND quantity > 0
     ORDER BY updated_at DESC, item_key`,
    [playerId]
  );
  return { items };
}

// Existing Echo rows remain the backing store for Collection progress.
async function getCollectionEchoes(playerId, queryable = db) {
  const catalogPromise = getEchoCatalog();
  const [rows] = await queryable.query(
    `SELECT 'bag' AS rowType,
            item_key AS itemKey,
            item_type AS itemType,
            quantity,
            updated_at AS updatedAt,
            NULL AS typeId,
            NULL AS rarity,
            NULL AS discoveredAt,
            NULL AS demonId
     FROM player_bag
     WHERE player_id = ? AND item_type = 'echo' AND quantity > 0
     UNION ALL
     SELECT 'discovery', NULL, NULL, NULL, NULL,
            type_id,
            CONVERT(rarity USING utf8mb4) COLLATE utf8mb4_unicode_ci,
            discovered_at,
            NULL
     FROM player_echo_discoveries
     WHERE player_id = ?
     UNION ALL
     SELECT 'demon', NULL, NULL, NULL, NULL,
            type_id,
            CONVERT(rarity USING utf8mb4) COLLATE utf8mb4_unicode_ci,
            NULL,
            id
     FROM player_demons
     WHERE player_id = ?`,
    [playerId, playerId, playerId]
  );
  const bagRows = rows
    .filter((row) => row.rowType === 'bag')
    .sort((left, right) => (
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      || String(left.itemKey).localeCompare(String(right.itemKey))
    ));
  const discoveryRows = rows.filter((row) => row.rowType === 'discovery');
  const demonRows = rows.filter((row) => row.rowType === 'demon');
  const catalog = await catalogPromise;
  const discovered = new Map(discoveryRows.map((row) => [getEchoItemKey(row.typeId, row.rarity), row.discoveredAt]));
  const owned = new Map(demonRows.map((row) => [getEchoItemKey(row.typeId, row.rarity), Number(row.demonId)]));

  const items = bagRows
    .map((row) => serializeEchoItem(catalog.get(row.itemKey), {
      quantity: row.quantity,
      discoveredAt: discovered.get(row.itemKey),
      ownedDemonId: owned.get(row.itemKey)
    }))
    .filter(Boolean);

  return {
    config: getEchoConfig(),
    items,
    discoveries: discoveryRows.map((row) => ({
      typeId: Number(row.typeId),
      rarity: String(row.rarity),
      discoveredAt: row.discoveredAt
    }))
  };
}

async function addEcho(playerId, demon, options = {}) {
  const ownsConnection = !options.queryable;
  const queryable = options.queryable || await db.getConnection();
  try {
    if (ownsConnection) await queryable.beginTransaction();
    const echo = await addEchoInTransaction(playerId, demon, { ...options, queryable });
    if (ownsConnection) await queryable.commit();
    return echo;
  } catch (error) {
    if (ownsConnection) await queryable.rollback();
    throw error;
  } finally {
    if (ownsConnection) queryable.release();
  }
}

async function lockEchoPlayer(playerId, queryable) {
  const [rows] = await queryable.query('SELECT id FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [playerId]);
  if (!rows.length) throw createHttpError('Hunter not found.', 404);
}

async function assertEchoNeeded(playerId, demon, queryable = db, options = {}) {
  const definition = await getEchoDefinition(demon?.typeId ?? demon?.type_id ?? demon?.type, demon?.rarity);
  const lock = options.forUpdate ? ' FOR UPDATE' : '';
  const [owned] = await queryable.query(
    `SELECT id FROM player_demons WHERE player_id = ? AND type_id = ? AND rarity = ? LIMIT 1${lock}`,
    [playerId, definition.typeId, definition.rarity]
  );
  const [rows] = await queryable.query(
    `SELECT quantity FROM player_bag WHERE player_id = ? AND item_key = ? LIMIT 1${lock}`,
    [playerId, definition.itemKey]
  );
  if (owned.length || Number(rows[0]?.quantity) >= definition.summonRequirement) {
    if (options.skipComplete) return false;
    throw createHttpError(owned.length
      ? 'This demon has already been summoned. Choose another species or rarity.'
      : 'You already have enough Echoes to summon this demon in Collection.', 409);
  }
  return true;
}

async function addEchoInTransaction(playerId, demon, options) {
  const queryable = options.queryable;
  // All Echo grants and spends share this lock, including merchant purchases.
  await lockEchoPlayer(playerId, queryable);
  if (!await assertEchoNeeded(playerId, demon, queryable, { ...options, forUpdate: true })) return null;
  const definition = await getEchoDefinition(
    demon?.typeId ?? demon?.type_id ?? demon?.type,
    demon?.rarity
  );

  await queryable.query(
    `INSERT INTO player_bag (player_id, item_key, item_type, quantity)
     VALUES (?, ?, 'echo', 1)
     ON DUPLICATE KEY UPDATE
       quantity = quantity + 1,
       updated_at = CURRENT_TIMESTAMP`,
    [playerId, definition.itemKey]
  );

  if (options.natural !== false) {
    await queryable.query(
      `INSERT IGNORE INTO player_echo_discoveries (player_id, type_id, rarity)
       VALUES (?, ?, ?)`,
      [playerId, definition.typeId, definition.rarity]
    );
  }

  const echoes = await getCollectionEchoes(playerId, queryable);
  return echoes.items.find((item) => item.itemKey === definition.itemKey) || null;
}

function serializeEchoItem(definition, state = {}) {
  if (!definition) return null;
  const quantity = Math.max(0, Number(state.quantity) || 0);
  const summonRequirement = Math.max(1, Number(definition.summonRequirement) || 1);
  const ownedDemonId = Number(state.ownedDemonId) || null;

  return {
    ...definition,
    quantity,
    naturallyDiscovered: Boolean(state.discoveredAt),
    discovered: Boolean(state.discoveredAt || ownedDemonId),
    discoveredAt: state.discoveredAt || null,
    owned: Boolean(ownedDemonId),
    ownedDemonId,
    summonReady: !ownedDemonId && quantity >= summonRequirement,
    summonProgress: Math.min(quantity, summonRequirement),
    canUnravel: definition.rarity === 'mythic' && quantity > 0
  };
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  addEcho,
  assertEchoNeeded,
  createHttpError,
  getEchoCatalog,
  getEchoDefinition,
  getCollectionEchoes,
  getPlayerBag,
  lockEchoPlayer,
  serializeEchoItem
};
