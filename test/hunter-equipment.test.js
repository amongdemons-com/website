const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EQUIPMENT_SLOT_KEYS,
  chooseEquipmentSlot,
  createEquipmentPayload,
  equipPlayerItem,
  loadEquipmentCatalog,
  serializeEquipmentItem
} = require('../public/api/lib/hunter-equipment');
const {
  EFFECT_HANDLERS,
  applyEquipmentDamageModifiers,
  applyEquipmentHealingModifiers,
  applyEquipmentPoisonModifiers,
  handleEquipmentFinalDeath,
  handleEquipmentAfterHealing,
  handleEquipmentTick,
  initializeEquipmentCombat,
  tryEquipmentResurrection
} = require('../public/api/lib/equipment-effects');
const { simulateFight } = require('../public/api/lib/combat');

const ROOT = path.join(__dirname, '..');
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

function item(id, rarity = 'common') {
  return serializeEquipmentItem(`equipment:${id}:${rarity}`);
}

function demon(instanceId, stats = {}) {
  return {
    instanceId,
    typeId: stats.typeId || 1,
    role: stats.role || 'melee',
    rarity: 'common',
    maxHp: stats.maxHp || 100,
    hp: stats.hp ?? stats.maxHp ?? 100,
    atk: stats.atk || 10,
    speed: stats.speed || 10,
    position: 'front'
  };
}

function equipmentContext(playerEquipment, players = [demon('player')], enemies = [demon('enemy')]) {
  const context = {
    players,
    enemies,
    demonTypes: {},
    playerEquipment,
    enemyEquipment: [],
    combatLog: [],
    battleState: {},
    rng: () => 0.5
  };
  initializeEquipmentCombat(context);
  return context;
}

test('equipment catalog defines every starting item and every rarity through reusable handlers', () => {
  const catalog = loadEquipmentCatalog();
  const startingItemIds = new Set([
    'hunters_blade', 'executioner', 'glass_fang', 'hunger',
    'boneplate', 'living_carapace', 'spite_armor', 'martyr_skin',
    'hunters_eye', 'crown_of_rage', 'blindfold', 'shepherds_skull',
    'ring_of_the_pack', 'last_one', 'blood_circle', 'rot_ring', 'empty_ring', 'mirror_ring', 'ring_of_nine',
    'black_shield', 'soul_jar', 'demon_bell', 'ash_idol', 'thorn_totem', 'rotten_heart', 'broken_hourglass', 'sacrificial_idol'
  ]);
  const startingItems = catalog.filter((entry) => startingItemIds.has(entry.id));
  assert.equal(startingItems.length, startingItemIds.size);
  assert.deepEqual(
    startingItems.reduce((counts, entry) => ({ ...counts, [entry.slot]: (counts[entry.slot] || 0) + 1 }), {}),
    { weapon: 4, armor: 4, helm: 4, ring: 7, offhand: 8 }
  );
  catalog.forEach((definition) => {
    assert.ok(EFFECT_HANDLERS[definition.effect.type], `${definition.id} should use a registered effect handler`);
    RARITIES.forEach((rarity) => assert.ok(definition.effect.values[rarity], `${definition.id} ${rarity}`));
  });
});

test('rarity serialization resolves actual values without exposing other rarity tiers', () => {
  const glassFang = item('glass_fang', 'epic');
  assert.equal(glassFang.effect.type, 'stat_modifier');
  assert.deepEqual(glassFang.effect.values, { damagePercent: 23, maxHpPercent: -11 });
  assert.deepEqual(glassFang.scaledValues.map(({ value }) => value), ['+23%', '-11%']);
});

test('equipment payload always presents the six fixed slots and rejects mismatched stored items', () => {
  const payload = createEquipmentPayload([
    { slotKey: 'weapon', itemKey: 'equipment:hunters_blade:common' },
    { slotKey: 'armor', itemKey: 'equipment:soul_jar:mythic' },
    { slotKey: 'ring1', itemKey: 'equipment:rot_ring:rare' }
  ]);
  assert.deepEqual(payload.slots.map(({ slotKey }) => slotKey), EQUIPMENT_SLOT_KEYS);
  assert.equal(payload.slots.find(({ slotKey }) => slotKey === 'weapon').item.id, 'hunters_blade');
  assert.equal(payload.slots.find(({ slotKey }) => slotKey === 'armor').item, null);
  assert.equal(payload.slots.find(({ slotKey }) => slotKey === 'ring1').item.id, 'rot_ring');
});

test('equipment starts unowned until a future reward grants it', () => {
  const authSources = ['guest.js', 'login.js', 'register.js']
    .map((name) => fs.readFileSync(path.join(ROOT, 'public', 'api', 'auth', name), 'utf8'))
    .join('\n');
  const schema = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'schema.js'), 'utf8');
  const reset = fs.readFileSync(path.join(ROOT, 'scripts', 'reset-player-database.js'), 'utf8');
  assert.doesNotMatch(authSources, /grantStarterEquipment/);
  assert.doesNotMatch(reset, /grantStarterEquipment|wrongStarterEquipment/);
  assert.match(schema, /DELETE FROM player_equipment/);
  assert.match(schema, /DELETE FROM player_bag WHERE item_type = 'equipment'/);
});

test('ring slot selection caps rings at two and supports explicit replacement', () => {
  const rows = [
    { slotKey: 'ring1', itemKey: 'equipment:rot_ring:rare' },
    { slotKey: 'ring2', itemKey: 'equipment:last_one:rare' }
  ];
  assert.throws(() => chooseEquipmentSlot('ring', null, rows), /occupied/i);
  assert.equal(chooseEquipmentSlot('ring', 'ring2', rows), 'ring2');
  assert.throws(() => chooseEquipmentSlot('weapon', 'helm', rows), /valid equipment slot|valid equipment|Weapon|weapon/i);
});

test('equip endpoint logic verifies Bag ownership and duplicate-ring quantity on the server', async () => {
  let inserted = null;
  const queryable = {
    async query(sql, params) {
      if (sql.startsWith('SELECT id FROM players')) return [[{ id: 'p' }]];
      if (sql.includes('FROM player_bag')) return [[{ quantity: 1 }]];
      if (sql.includes('FROM player_equipment') && sql.includes('FOR UPDATE')) {
        return [[{ slotKey: 'ring1', itemKey: 'equipment:rot_ring:rare' }]];
      }
      if (sql.startsWith('INSERT INTO player_equipment')) {
        inserted = { slotKey: params[1], itemKey: params[2] };
        return [{ affectedRows: 1 }];
      }
      if (sql.includes('FROM player_equipment')) {
        return [[inserted].filter(Boolean)];
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  await assert.rejects(
    equipPlayerItem('p', 'equipment:rot_ring:rare', 'ring2', queryable),
    /need 2 copies/i
  );
  const result = await equipPlayerItem('p', 'equipment:last_one:rare', 'ring2', queryable);
  assert.equal(result.slots.find(({ slotKey }) => slotKey === 'ring2').item.id, 'last_one');
});

test('stat, threshold, team-role, empty-slot, and targeting handlers alter authoritative damage', () => {
  const attacker = demon('player', { atk: 10 });
  const lowTarget = demon('enemy', { maxHp: 100, hp: 20 });
  const context = equipmentContext([
    item('hunters_blade'),
    item('executioner'),
    item('ring_of_the_pack'),
    item('empty_ring'),
    item('hunters_eye')
  ], [attacker], [lowTarget]);
  const damage = applyEquipmentDamageModifiers({
    ...context,
    tick: 1,
    attacker,
    attackerSide: 'player',
    target: lowTarget,
    targetSide: 'enemy',
    damage: 100,
    damageKind: 'direct'
  });
  assert.ok(damage > 140, `expected stacked data-driven bonuses, got ${damage}`);
  assert.equal(attacker.battleBuffs.equipmentTargeting, 'lowest_hp');
});

test('poison and healing handlers carry duration, tick, anti-heal, and temporary damage state', () => {
  const poisoner = demon('poisoner', { typeId: 3, role: 'poisoner' });
  const target = demon('target');
  const context = equipmentContext([item('rot_ring'), item('rotten_heart')], [poisoner], [target]);
  const poison = applyEquipmentPoisonModifiers({
    ...context,
    attacker: poisoner,
    attackerSide: 'player',
    target,
    targetSide: 'enemy',
    damage: 10,
    durationTicks: 100
  });
  assert.equal(poison.damage, 8.8);
  assert.equal(poison.durationTicks, 125);
  assert.equal(poison.healingReductionPercent, 10);

  target.statusEffects = { poison: [{ healingReductionPercent: 10 }] };
  assert.equal(applyEquipmentHealingModifiers({ ...context, healerSide: 'enemy', target, healing: 100 }), 90);

  const healingContext = equipmentContext([item('blood_circle')], [poisoner], [target]);
  handleEquipmentAfterHealing({
    ...healingContext,
    tick: 10,
    healer: poisoner,
    healerSide: 'player',
    target: poisoner,
    appliedHealing: 5
  });
  assert.deepEqual(poisoner.battleBuffs.equipmentTemporaryDamage[0], {
    source: 'equipment:blood_circle:common',
    percent: 5,
    expiresAt: 55
  });
});

test('duplicate equipped rings retain separate effect instances and stack', () => {
  const healer = demon('healer');
  const target = demon('target', { hp: 50 });
  const rings = [
    serializeEquipmentItem('equipment:blood_circle:common', { equippedSlots: ['ring1'] }),
    serializeEquipmentItem('equipment:blood_circle:common', { equippedSlots: ['ring2'] })
  ];
  const context = equipmentContext(rings, [healer, target], [demon('enemy')]);
  handleEquipmentAfterHealing({
    ...context,
    tick: 10,
    healer,
    healerSide: 'player',
    target,
    appliedHealing: 5
  });
  assert.deepEqual(
    target.battleBuffs.equipmentTemporaryDamage.map(({ source }) => source),
    ['equipment:blood_circle:common@ring1', 'equipment:blood_circle:common@ring2']
  );
  assert.equal(applyEquipmentDamageModifiers({
    ...context,
    tick: 11,
    attacker: target,
    attackerSide: 'player',
    target: context.enemies[0],
    targetSide: 'enemy',
    damage: 100,
    damageKind: 'direct'
  }), 110);
});

test('regeneration and ally-death effects use shared battle hooks', () => {
  const fallen = demon('fallen', { hp: 0, speed: 100 });
  const survivor = demon('survivor', { hp: 50, speed: 100 });
  const context = equipmentContext(
    [item('living_carapace'), item('martyr_skin'), item('hunger'), item('last_one')],
    [fallen, survivor],
    [demon('enemy')]
  );
  handleEquipmentTick({ ...context, tick: 10 });
  assert.equal(survivor.hp, 51);
  handleEquipmentFinalDeath({
    ...context,
    tick: 10,
    target: fallen,
    targetSide: 'player',
    attackerSide: 'enemy'
  });
  assert.equal(survivor.hp, 55);
  assert.equal(survivor.speed, 106);
});

test('battle-start shields and first-death resurrection are reflected in combat output', () => {
  const shielded = simulateFight(
    () => 0.5,
    [demon('player', { speed: 1 })],
    [demon('enemy', { atk: 10, speed: 100 })],
    { playerEquipment: [item('black_shield')] }
  );
  assert.equal(shielded.playerTeamBefore[0].shield, 5);
  assert.equal(shielded.combatLog[0].shieldDamage, 5);

  const resurrected = simulateFight(
    () => 0.5,
    [demon('player', { maxHp: 20, hp: 20, atk: 1, speed: 1 })],
    [demon('enemy', { maxHp: 500, hp: 500, atk: 20, speed: 100 })],
    { playerEquipment: [item('soul_jar', 'mythic')] }
  );
  const resurrection = resurrected.combatLog.find(({ effect }) => effect === 'equipment_resurrect');
  assert.equal(resurrection.healing, 14);
  assert.equal(resurrected.combatLog.filter(({ effect }) => effect === 'equipment_resurrect').length, 1);

  const revived = demon('revived', { hp: 0, speed: 10 });
  const context = equipmentContext([item('soul_jar', 'mythic')], [revived], [demon('enemy')]);
  assert.equal(tryEquipmentResurrection({ ...context, tick: 5, target: revived, targetSide: 'player' }), true);
  assert.equal(revived.hp, 70);
  assert.equal(revived.speed, 13);
  assert.equal(revived.battleBuffs.equipmentInvulnerableUntil, 23);
  assert.equal(applyEquipmentDamageModifiers({
    ...context,
    tick: 6,
    attacker: context.enemies[0],
    attackerSide: 'enemy',
    target: revived,
    targetSide: 'player',
    damage: 100,
    damageKind: 'direct'
  }), 0);
});

test('Spite Armor reflection uses Thorn Totem critical modifiers', () => {
  const result = simulateFight(
    () => 0,
    [demon('player', { maxHp: 200, speed: 1 })],
    [demon('enemy', { maxHp: 200, atk: 20, speed: 100 })],
    { playerEquipment: [item('spite_armor', 'mythic'), item('thorn_totem', 'mythic')] }
  );
  const reflected = result.combatLog.find(({ effect }) => effect === 'equipment_reflect');
  assert.equal(reflected.critical, true);
  assert.equal(reflected.dmg, 16);
});

test('Bag UI exposes six slots, equip actions, and rarity-scaled tooltip values', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'app', 'bag.html'), 'utf8');
  const source = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'bag-ui.js'), 'utf8');
  assert.match(html, /id="bagEquipmentGrid"/);
  assert.match(source, /\['weapon', 'Weapon'\], \['armor', 'Armor'\], \['helm', 'Helm'\]/);
  assert.match(source, /\/api\/equipment\/equip/);
  assert.match(source, /\/api\/equipment\/unequip/);
  assert.match(source, /item\.scaledValues/);
});

test('all battle entry points resolve equipment server-side, including Ranked and PvP', () => {
  const dungeon = fs.readFileSync(path.join(ROOT, 'public', 'api', 'runs', 'battle.js'), 'utf8');
  const world = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'world-combat.js'), 'utf8');
  const anomaly = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'world-anomaly.js'), 'utf8');
  const ranked = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'dungeon-ranked.js'), 'utf8');
  assert.match(dungeon, /getPlayerEquipment\(req\.player\.id\)/);
  assert.match(dungeon, /combatType: 'ranked'[\s\S]*?playerEquipment:[\s\S]*?enemyEquipment:/);
  assert.match(world, /simulateWorldPvpChallenge[\s\S]*?getPlayerEquipment\(player\.id\)[\s\S]*?getPlayerEquipment\(targetPlayer\.id\)/);
  assert.match(world, /combatType: 'world_boss'[\s\S]*?playerEquipment:/);
  assert.match(world, /activeEquipment:/);
  assert.match(anomaly, /getPlayerEquipment\(playerId, queryable\)/);
  assert.match(anomaly, /combatType: 'world_anomaly'[\s\S]*?playerEquipment,/);
  assert.match(ranked, /equipment: normalizeEquipmentCombatItems/);
});
