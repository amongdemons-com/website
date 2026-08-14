const db = require('./db');
const {
  REFINEMENT_COSTS,
  SUMMON_REQUIREMENTS,
  getEchoConfig,
  getEchoItemKey,
  getNextEchoRarity,
  normalizeEchoRarity,
  parseEchoItemKey
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
      summonRequirement: SUMMON_REQUIREMENTS[rarity],
      nextRarity: getNextEchoRarity(rarity),
      refinementCost: REFINEMENT_COSTS[rarity] || null
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
     WHERE player_id = ? AND quantity > 0
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
  const quantities = new Map(bagRows.map((row) => [row.itemKey, Math.max(0, Number(row.quantity) || 0)]));

  const items = bagRows
    .map((row) => serializeEchoItem(catalog.get(row.itemKey), {
      quantity: row.quantity,
      discoveredAt: discovered.get(row.itemKey),
      ownedDemonId: owned.get(row.itemKey),
      targetQuantity: getTargetQuantity(catalog.get(row.itemKey), quantities)
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
  const queryable = options.queryable || db;
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

  const bag = await getPlayerBag(playerId, queryable);
  return bag.items.find((item) => item.itemKey === definition.itemKey) || null;
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
    targetQuantity: Math.max(0, Number(state.targetQuantity) || 0),
    canRefine: Boolean(
      definition.nextRarity &&
      definition.refinementCost &&
      quantity >= definition.refinementCost
    ),
    canUnravel: definition.rarity === 'mythic' && quantity > 0
  };
}

function getTargetQuantity(definition, quantities) {
  if (!definition?.nextRarity) return 0;
  return quantities.get(getEchoItemKey(definition.typeId, definition.nextRarity)) || 0;
}

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  addEcho,
  createHttpError,
  getEchoCatalog,
  getEchoDefinition,
  getPlayerBag,
  serializeEchoItem
};
