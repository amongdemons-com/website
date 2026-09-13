const db = require('./db');
const equipmentData = require('../data/equipment-items.json');
const { RARITIES } = require('./echo-config');

const EQUIPMENT_RARITIES = RARITIES;
const EQUIPMENT_SLOT_KEYS = Object.freeze(['weapon', 'armor', 'helm', 'ring1', 'ring2', 'offhand']);
const EQUIPMENT_SLOT_LIMITS = Object.freeze({ weapon: 1, armor: 1, helm: 1, ring: 2, offhand: 1 });
const SUPPORTED_EFFECT_TYPES = new Set([
  'stat_modifier',
  'bonus_below_hp',
  'bonus_per_dead_ally',
  'bonus_per_role',
  'bonus_per_empty_team_slot',
  'resurrect_first_dead',
  'on_kill_buff',
  'on_ally_death',
  'battle_start_buff',
  'modify_poison',
  'modify_healing',
  'modify_targeting'
]);
const SLOT_LABELS = Object.freeze({
  weapon: 'Weapon',
  armor: 'Armor',
  helm: 'Helm',
  ring1: 'Ring I',
  ring2: 'Ring II',
  offhand: 'Offhand'
});
const VALUE_LABELS = Object.freeze({
  allyDamageMaxHpPercent: 'Allied scorch per attack',
  damageBuffPercent: 'Temporary damage',
  damagePercent: 'Damage',
  damagePercentPerDeadAlly: 'Damage per fallen ally',
  damagePercentPerRole: 'Damage per role',
  damagePercentPerSlot: 'Damage per empty slot',
  damageTakenPercent: 'Damage taken',
  damageTakenPercentPerDeadAlly: 'Damage taken per fallen ally',
  durationPercent: 'Poison duration',
  durationTicks: 'Duration',
  healMaxHpPercent: 'Heal to surviving allies',
  healingPercent: 'Healing',
  healingReductionPercent: 'Enemy healing reduction',
  initialHpPercent: 'Weakest demon starting HP',
  intervalTicks: 'Trigger interval',
  invulnerableTicks: 'Invulnerability',
  maxHpPercent: 'Max HP',
  onKillDamagePercent: 'Damage gained on kill',
  otherAlliesDamagePercent: 'Other allies damage',
  reflectDamagePercent: 'Damage reflected',
  reflectionCritChancePercent: 'Reflection critical chance',
  reflectionCritDamagePercent: 'Reflection critical damage',
  regenBelowHpBonusPercent: 'Regeneration below 50% HP',
  regenMaxHpPercent: 'Max HP regenerated',
  resurrectHpPercent: 'Resurrection HP',
  sacrificeShieldPercent: 'Sacrificed demon shield',
  sharePercent: 'Stats shared',
  shieldMaxHpPercent: 'Shield',
  speedPercent: 'Attack speed',
  speedPercentPerDeadAlly: 'Attack speed per fallen ally',
  teamCapacity: 'Formation capacity',
  thresholdPercent: 'Enemy HP threshold',
  tickDamagePercent: 'Poison tick damage'
});

let catalogById;

function loadEquipmentCatalog() {
  if (catalogById) return [...catalogById.values()];

  catalogById = new Map();
  for (const raw of equipmentData) {
    const definition = validateEquipmentDefinition(raw);
    if (catalogById.has(definition.id)) {
      throw new Error(`Duplicate equipment item id: ${definition.id}`);
    }
    catalogById.set(definition.id, definition);
  }
  return [...catalogById.values()];
}

function validateEquipmentDefinition(raw) {
  const id = String(raw?.id || '').trim().toLowerCase();
  const slot = String(raw?.slot || '').trim().toLowerCase();
  const effect = raw?.effect;
  const effectType = String(effect?.type || '').trim();

  if (!/^[a-z0-9_]+$/.test(id)) throw new Error(`Invalid equipment item id: ${id || 'missing'}`);
  if (!Object.prototype.hasOwnProperty.call(EQUIPMENT_SLOT_LIMITS, slot)) {
    throw new Error(`Invalid equipment slot for ${id}: ${slot || 'missing'}`);
  }
  if (!SUPPORTED_EFFECT_TYPES.has(effectType)) {
    throw new Error(`Unsupported equipment effect for ${id}: ${effectType || 'missing'}`);
  }
  for (const rarity of EQUIPMENT_RARITIES) {
    if (!effect.values?.[rarity] || typeof effect.values[rarity] !== 'object') {
      throw new Error(`Missing ${rarity} equipment values for ${id}`);
    }
  }

  return Object.freeze({
    ...raw,
    id,
    slot,
    tags: Object.freeze((Array.isArray(raw.tags) ? raw.tags : []).map(String)),
    effect: Object.freeze({ ...effect, type: effectType })
  });
}

function getEquipmentDefinition(id) {
  loadEquipmentCatalog();
  return catalogById.get(String(id || '').trim().toLowerCase()) || null;
}

function getEquipmentItemKey(id, rarity) {
  const normalizedRarity = normalizeEquipmentRarity(rarity);
  const definition = getEquipmentDefinition(id);
  return definition && normalizedRarity ? `equipment:${definition.id}:${normalizedRarity}` : null;
}

function parseEquipmentItemKey(itemKey) {
  const match = /^equipment:([a-z0-9_]+):(common|uncommon|rare|epic|legendary|mythic)$/i.exec(String(itemKey || ''));
  if (!match) return null;
  const definition = getEquipmentDefinition(match[1]);
  const rarity = normalizeEquipmentRarity(match[2]);
  return definition && rarity ? { definition, rarity } : null;
}

function normalizeEquipmentRarity(value) {
  const rarity = String(value || '').trim().toLowerCase();
  return EQUIPMENT_RARITIES.includes(rarity) ? rarity : null;
}

function serializeEquipmentItem(itemKey, state = {}) {
  const parsed = parseEquipmentItemKey(itemKey);
  if (!parsed) return null;

  const { definition, rarity } = parsed;
  const values = cloneJson(definition.effect.values[rarity]);
  return {
    itemKey: getEquipmentItemKey(definition.id, rarity),
    itemType: 'equipment',
    id: definition.id,
    name: definition.name,
    slot: definition.slot,
    slotLabel: definition.slot === 'ring' ? 'Ring' : SLOT_LABELS[definition.slot],
    rarity,
    tags: [...definition.tags],
    icon: definition.icon || definition.slot,
    imageUrl: definition.imageUrl || '',
    description: definition.description || '',
    effect: {
      type: definition.effect.type,
      values,
      ...(Array.isArray(definition.targetRoles) ? { targetRoles: [...definition.targetRoles] } : {}),
      ...(Array.isArray(definition.targetTypeIds) ? { targetTypeIds: definition.targetTypeIds.map(Number) } : {}),
      ...(definition.condition ? { condition: cloneJson(definition.condition) } : {})
    },
    scaledValues: formatEquipmentEffectValues(values),
    quantity: Math.max(0, Number(state.quantity) || 0),
    equippedSlots: Array.isArray(state.equippedSlots) ? [...state.equippedSlots] : [],
    equippedCount: Array.isArray(state.equippedSlots) ? state.equippedSlots.length : 0,
    updatedAt: state.updatedAt || null
  };
}

function formatEquipmentEffectValues(values = {}) {
  return Object.entries(values)
    .filter(([key]) => !['selector', 'target', 'targeting'].includes(key))
    .map(([key, value]) => ({
      key,
      label: VALUE_LABELS[key] || humanizeKey(key),
      value: formatEquipmentValue(key, value)
    }));
}

function formatEquipmentValue(key, value) {
  if (key === 'teamCapacity') return `${Number(value) || 0} slots`;
  if (/Ticks$/.test(key) || key === 'intervalTicks') return `${Number(value) || 0} ticks`;
  if (/Percent/.test(key)) {
    const number = Number(value) || 0;
    return `${number > 0 ? '+' : ''}${number}%`;
  }
  return String(value);
}

async function getPlayerEquipment(playerId, queryable = db) {
  const [rows] = await queryable.query(
    `SELECT slot_key AS slotKey, item_key AS itemKey, updated_at AS updatedAt
     FROM player_equipment
     WHERE player_id = ?
     ORDER BY FIELD(slot_key, 'weapon', 'armor', 'helm', 'ring1', 'ring2', 'offhand')`,
    [playerId]
  );
  return createEquipmentPayload(rows);
}

function createEquipmentPayload(rows = []) {
  const bySlot = new Map();
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const slotKey = normalizeEquipmentSlotKey(row.slotKey);
    const item = serializeEquipmentItem(row.itemKey, {
      equippedSlots: slotKey ? [slotKey] : [],
      updatedAt: row.updatedAt
    });
    if (!slotKey || !item || getBaseSlot(slotKey) !== item.slot || bySlot.has(slotKey)) continue;
    bySlot.set(slotKey, item);
  }

  const slots = EQUIPMENT_SLOT_KEYS.map((slotKey) => ({
    slotKey,
    slot: getBaseSlot(slotKey),
    label: SLOT_LABELS[slotKey],
    item: bySlot.get(slotKey) || null
  }));

  return {
    limits: { ...EQUIPMENT_SLOT_LIMITS },
    slots,
    items: slots.filter((entry) => entry.item).map((entry) => ({
      ...entry.item,
      equippedSlots: [entry.slotKey],
      equippedCount: 1
    }))
  };
}

function enrichEquipmentBagItems(items = [], equipment = createEquipmentPayload()) {
  const equippedByKey = new Map();
  for (const slot of equipment.slots || []) {
    if (!slot.item) continue;
    const slots = equippedByKey.get(slot.item.itemKey) || [];
    slots.push(slot.slotKey);
    equippedByKey.set(slot.item.itemKey, slots);
  }

  return (Array.isArray(items) ? items : []).map((row) => {
    if (row.itemType !== 'equipment') return row;
    return serializeEquipmentItem(row.itemKey, {
      quantity: row.quantity,
      updatedAt: row.updatedAt,
      equippedSlots: equippedByKey.get(row.itemKey) || []
    }) || row;
  });
}

async function equipPlayerItem(playerId, itemKey, requestedSlot, queryable = db) {
  const parsed = parseEquipmentItemKey(itemKey);
  if (!parsed) throw createEquipmentError('Choose a valid equipment item.', 400);

  const ownsConnection = queryable === db;
  const connection = ownsConnection ? await db.getConnection() : queryable;
  let committed = false;
  try {
    if (ownsConnection) await connection.beginTransaction();
    await lockEquipmentPlayer(playerId, connection);

    const [bagRows] = await connection.query(
      `SELECT quantity
       FROM player_bag
       WHERE player_id = ? AND item_key = ? AND item_type = 'equipment'
       LIMIT 1
       FOR UPDATE`,
      [playerId, itemKey]
    );
    const quantity = Math.max(0, Number(bagRows[0]?.quantity) || 0);
    if (!quantity) throw createEquipmentError('That item is not in your Bag.', 404);

    const [equippedRows] = await connection.query(
      `SELECT slot_key AS slotKey, item_key AS itemKey
       FROM player_equipment
       WHERE player_id = ?
       FOR UPDATE`,
      [playerId]
    );
    const slotKey = chooseEquipmentSlot(parsed.definition.slot, requestedSlot, equippedRows);
    const nextRows = equippedRows.filter((row) => row.slotKey !== slotKey).concat({ slotKey, itemKey });
    const nextEquippedCount = nextRows.filter((row) => row.itemKey === itemKey).length;
    if (nextEquippedCount > quantity) {
      throw createEquipmentError(`You need ${nextEquippedCount} copies of that item to equip it twice.`, 409);
    }

    await connection.query(
      `INSERT INTO player_equipment (player_id, slot_key, item_key)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE item_key = VALUES(item_key), updated_at = CURRENT_TIMESTAMP`,
      [playerId, slotKey, itemKey]
    );
    if (ownsConnection) {
      await connection.commit();
      committed = true;
    }
    return getPlayerEquipment(playerId, connection);
  } catch (error) {
    if (ownsConnection && !committed) await connection.rollback();
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function unequipPlayerItem(playerId, requestedSlot, queryable = db) {
  const slotKey = normalizeEquipmentSlotKey(requestedSlot);
  if (!slotKey) throw createEquipmentError('Choose a valid equipment slot.', 400);

  await queryable.query(
    'DELETE FROM player_equipment WHERE player_id = ? AND slot_key = ?',
    [playerId, slotKey]
  );
  return getPlayerEquipment(playerId, queryable);
}

async function grantEquipmentItem(playerId, id, rarity = 'common', quantity = 1, queryable = db) {
  const itemKey = getEquipmentItemKey(id, rarity);
  const amount = Math.max(1, Math.floor(Number(quantity) || 1));
  if (!itemKey) throw createEquipmentError('Equipment definition not found.', 404);

  await queryable.query(
    `INSERT INTO player_bag (player_id, item_key, item_type, quantity)
     VALUES (?, ?, 'equipment', ?)
     ON DUPLICATE KEY UPDATE
       quantity = LEAST(4294967295, quantity + VALUES(quantity)),
       updated_at = CURRENT_TIMESTAMP`,
    [playerId, itemKey, amount]
  );
  return serializeEquipmentItem(itemKey, { quantity: amount });
}

function chooseEquipmentSlot(baseSlot, requestedSlot, rows = []) {
  const normalizedRequested = normalizeEquipmentSlotKey(requestedSlot);
  if (baseSlot !== 'ring') {
    if (normalizedRequested && normalizedRequested !== baseSlot) {
      throw createEquipmentError(`That item can only be equipped in the ${SLOT_LABELS[baseSlot]} slot.`, 400);
    }
    return baseSlot;
  }

  if (normalizedRequested && !['ring1', 'ring2'].includes(normalizedRequested)) {
    throw createEquipmentError('Rings can only be equipped in a Ring slot.', 400);
  }
  if (normalizedRequested) return normalizedRequested;

  const occupied = new Set(rows.map((row) => row.slotKey));
  const openSlot = ['ring1', 'ring2'].find((slotKey) => !occupied.has(slotKey));
  if (!openSlot) throw createEquipmentError('Both Ring slots are occupied. Choose which Ring to replace.', 409);
  return openSlot;
}

function normalizeEquipmentSlotKey(value) {
  const slotKey = String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '');
  const aliases = { ring: 'ring1', ringi: 'ring1', ringii: 'ring2' };
  const normalized = aliases[slotKey] || slotKey;
  return EQUIPMENT_SLOT_KEYS.includes(normalized) ? normalized : null;
}

function getBaseSlot(slotKey) {
  return String(slotKey || '').startsWith('ring') ? 'ring' : slotKey;
}

async function lockEquipmentPlayer(playerId, queryable) {
  const [rows] = await queryable.query('SELECT id FROM players WHERE id = ? LIMIT 1 FOR UPDATE', [playerId]);
  if (!rows.length) throw createEquipmentError('Hunter not found.', 404);
}

function humanizeKey(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/^./, (character) => character.toUpperCase());
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function createEquipmentError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  EQUIPMENT_RARITIES,
  EQUIPMENT_SLOT_KEYS,
  EQUIPMENT_SLOT_LIMITS,
  SUPPORTED_EFFECT_TYPES,
  chooseEquipmentSlot,
  createEquipmentPayload,
  enrichEquipmentBagItems,
  equipPlayerItem,
  formatEquipmentEffectValues,
  getEquipmentDefinition,
  getEquipmentItemKey,
  getPlayerEquipment,
  grantEquipmentItem,
  loadEquipmentCatalog,
  normalizeEquipmentRarity,
  normalizeEquipmentSlotKey,
  parseEquipmentItemKey,
  serializeEquipmentItem,
  unequipPlayerItem
};
