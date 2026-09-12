const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../public/api/lib/db');
const { addEcho, getPlayerBag, getCollectionEchoes } = require('../public/api/lib/echo-bag');
const { SUMMON_REQUIREMENTS } = require('../public/api/lib/echo-config');
const {
  MERCHANT_RARITY_PRICES,
  getActiveWorldMerchant,
  getMerchantStockId,
  buildMerchantStock,
  getWorldMerchantForPlayer,
  purchaseWorldMerchantItem
} = require('../public/api/lib/world-merchant');
const { getEchoCatalog } = require('../public/api/lib/echo-bag');
const { planEchoConversion, convertLegacyEchoes } = require('../public/api/lib/echo-conversion');
const achievements = require('../public/api/lib/achievements');
const router = require('../public/api/bag');
const cashoutRouter = require('../public/api/runs/cashout');

test('conversion preserves each unowned requirement and pays merchant prices for every excess Echo', () => {
  const rows = Object.entries(SUMMON_REQUIREMENTS).map(([rarity, quantity]) => ({ itemKey: `echo:1:${rarity}`, quantity: quantity + 3 }));
  const plan = planEchoConversion(rows, [{ typeId: 1, rarity: 'rare' }]);
  for (const row of plan) {
    const rarity = row.itemKey.split(':')[2];
    assert.equal(row.retained, rarity === 'rare' ? 0 : SUMMON_REQUIREMENTS[rarity]);
    assert.equal(row.souls, row.removed * MERCHANT_RARITY_PRICES[rarity]);
  }
  assert.deepEqual(planEchoConversion([{ itemKey: 'echo:2:rare', quantity: 2 }], [{ typeId: 1, rarity: 'rare' }])[0], {
    itemKey: 'echo:2:rare', quantity: 2, retained: 2, removed: 0, souls: 0
  });
  assert.throws(() => planEchoConversion([{ itemKey: 'echo:bad', quantity: 1 }], []), /Invalid Echo key/);
});

test('conversion deletes owned echoes, preserves other items, and cannot pay twice', async t => {
  const memory = installMemoryDb(t, { bag: { 'echo:1:rare': 9, 'echo:2:common': 4, potion: 3 }, owned: [{ id: 1, typeId: 2, rarity: 'common' }] });
  const first = await convertLegacyEchoes();
  assert.deepEqual(first, { players: 1, echoesRemoved: 10, souls: 640 });
  assert.deepEqual(memory.data.bag, { 'echo:1:rare': 3, potion: 3 });
  assert.equal(memory.data.souls, 640);
  assert.deepEqual(await convertLegacyEchoes(), { players: 0, echoesRemoved: 0, souls: 0 });
  assert.equal(memory.data.souls, 640);
});

test('a failed Soul credit rolls back Echo removal and a retry grants the full compensation', async t => {
  const memory = installMemoryDb(t, { bag: { 'echo:1:mythic': 15 } });
  memory.failCredit = true;
  await assert.rejects(convertLegacyEchoes(), /credit failed/);
  assert.equal(memory.data.bag['echo:1:mythic'], 15);
  assert.equal(memory.data.souls, 0);
  memory.failCredit = false;
  await convertLegacyEchoes();
  assert.equal(memory.data.bag['echo:1:mythic'], 12);
  assert.equal(memory.data.souls, 15000);
});

test('legacy conversion skips a missing hunter and continues paying existing hunters exactly once', async t => {
  const memory = installMemoryDb(t, { bag: { 'echo:1:rare': 5 }, conversionPlayers: ['deleted-hunter', 'p'] });
  assert.deepEqual(await convertLegacyEchoes(), { players: 1, echoesRemoved: 2, souls: 200 });
  assert.equal(memory.data.souls, 200);
  assert.equal(memory.data.bag['echo:1:rare'], 3);
  assert.deepEqual(await convertLegacyEchoes(), { players: 0, echoesRemoved: 0, souls: 0 });
  assert.equal(memory.data.souls, 200);
  // Gameplay must still reject missing hunters; only the legacy migration skips them.
  await assert.rejects(addEcho('deleted-hunter', { typeId: 1, rarity: 'common' }), { status: 404 });
});

test('Bag excludes Echoes while Collection exposes their progress', async t => {
  installMemoryDb(t, { bag: { 'echo:1:rare': 2, potion: 3 } });
  assert.deepEqual((await getPlayerBag('p')).items.map(item => item.itemKey), ['potion']);
  const echo = (await getCollectionEchoes('p')).items[0];
  assert.equal(echo.summonProgress, 2);
  assert.equal(echo.summonReady, false);
  assert.equal(echo.canRefine, undefined);
});

test('Echo grants reject owned variants, but allow other species and rarities', async t => {
  const memory = installMemoryDb(t, { owned: [{ id: 1, typeId: 1, rarity: 'common' }] });
  await assert.rejects(addEcho('p', { typeId: 1, rarity: 'common' }), { status: 409 });
  assert.equal((await addEcho('p', { typeId: 2, rarity: 'common' })).quantity, 1);
  assert.equal((await addEcho('p', { typeId: 1, rarity: 'rare' })).quantity, 1);
  assert.equal(memory.data.bag['echo:1:common'], undefined);
});

test('concurrent grants cannot exceed the summon requirement', async t => {
  const memory = installMemoryDb(t, { bag: { 'echo:1:rare': 2 } });
  const results = await Promise.allSettled([
    addEcho('p', { typeId: 1, rarity: 'rare' }),
    addEcho('p', { typeId: 1, rarity: 'rare' })
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal(memory.data.bag['echo:1:rare'], 3);
  assert.equal(await addEcho('p', { typeId: 1, rarity: 'rare' }, { skipComplete: true }), null);
});

test('Collection summon consumes the exact requirement once and prevents subsequent extraction', async t => {
  const memory = installMemoryDb(t, { bag: { 'echo:1:rare': 3 } });
  const summon = router.stack.find(layer => layer.route?.path === '/collection/echoes/summon').route.stack.at(-1).handle;
  const response = () => ({ status() { return this; }, json(value) { this.body = value; } });
  const results = await Promise.allSettled([
    summon({ player: { id: 'p' }, body: { typeId: 1, rarity: 'rare' } }, response()),
    summon({ player: { id: 'p' }, body: { typeId: 1, rarity: 'rare' } }, response())
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(memory.data.owned.length, 1);
  assert.equal(memory.data.bag['echo:1:rare'], 0);
  await assert.rejects(addEcho('p', { typeId: 1, rarity: 'rare' }), { status: 409 });
  assert.equal(router.stack.some(layer => layer.route?.path.includes('/refine')), false);
  assert.equal(router.stack.some(layer => layer.route?.path.startsWith('/bag/echoes')), false);
});

test('completed merchant Echoes cannot consume Souls or mark an offer purchased', async t => {
  const now = new Date('2026-09-12T12:00:00Z');
  const merchant = getActiveWorldMerchant(now);
  const item = buildMerchantStock('p', merchant.spawnId, await getEchoCatalog())[0];
  const memory = installMemoryDb(t, {
    bag: { [item.itemKey]: SUMMON_REQUIREMENTS[item.rarity] },
    souls: 10000, merchant, purchases: 0
  });
  await assert.rejects(
    purchaseWorldMerchantItem(
      'p',
      merchant.spawnId,
      getMerchantStockId(merchant.spawnId),
      0,
      { now, itemKey: item.itemKey }
    ),
    { status: 409 }
  );
  assert.equal(memory.data.souls, 10000);
  assert.equal(memory.data.purchases, 0);
  assert.equal(memory.data.bag[item.itemKey], SUMMON_REQUIREMENTS[item.rarity]);
});

test('merchant fills four offers with other Echo variants when some stock is completed', async t => {
  const now = new Date('2026-09-12T12:00:00Z');
  const merchant = getActiveWorldMerchant(now);
  const catalog = await getEchoCatalog();
  const initialStock = buildMerchantStock('p', merchant.spawnId, catalog);
  const completedItem = initialStock[0];
  installMemoryDb(t, {
    merchant,
    bag: { [completedItem.itemKey]: SUMMON_REQUIREMENTS[completedItem.rarity] }
  });

  const refreshed = await getWorldMerchantForPlayer('p', { now, playerLevel: 1 });

  assert.equal(refreshed.itemSlots.length, 4);
  assert.equal(refreshed.itemSlots.some((item) => item.itemKey === completedItem.itemKey), false);
  assert.equal(new Set(refreshed.itemSlots.map((item) => item.itemKey)).size, 4);
});

test('merchant keeps a purchased offer in its slot until the next refresh', async t => {
  const now = new Date('2026-09-12T12:00:00Z');
  const merchant = getActiveWorldMerchant(now);
  const catalog = await getEchoCatalog();
  const purchasedItem = buildMerchantStock('p', merchant.spawnId, catalog)[0];
  installMemoryDb(t, {
    merchant,
    merchantPurchases: [{ slot: purchasedItem.slot, itemKey: purchasedItem.itemKey }],
    bag: { [purchasedItem.itemKey]: SUMMON_REQUIREMENTS[purchasedItem.rarity] }
  });

  const current = await getWorldMerchantForPlayer('p', { now, playerLevel: 1 });
  const purchasedSlot = current.itemSlots.find((item) => item.slot === purchasedItem.slot);

  assert.equal(current.itemSlots.length, 4);
  assert.equal(purchasedSlot?.itemKey, purchasedItem.itemKey);
  assert.equal(purchasedSlot?.purchased, true);
});

test('cashout rejects owned variants from team, reward, and saved extraction choices without ending the run', async t => {
  const demon = { instanceId: 'd1', typeId: 1, rarity: 'common', maxHp: 100, hp: 100, atk: 10, speed: 10 };
  const run = {
    id: 'r', player_id: 'p', status: 'active', floor: 1, seed: 1,
    state: JSON.stringify({ team: [demon], awaitingRecruit: true, currentFloor: 1, extractChoice: { source: 'team', instanceId: 'd1', demon } }),
    rewards: JSON.stringify([{ rewardId: 1, type: 'recruit', floor: 1, demon }])
  };
  const memory = installMemoryDb(t, { owned: [{ id: 1, typeId: 1, rarity: 'common' }], run });
  const cashout = cashoutRouter.stack.find(layer => layer.route?.path === '/runs/:id/cashout').route.stack.at(-1).handle;
  for (const body of [{ source: 'team', instanceId: 'd1' }, { source: 'reward', rewardId: 1 }, { source: 'reserved' }]) {
    await assert.rejects(cashout({ params: { id: 'r' }, player: { id: 'p' }, body }, {}), { status: 409 });
    assert.equal(memory.data.run.status, 'active');
    assert.equal(memory.data.souls, 0);
    assert.deepEqual(memory.data.bag, {});
  }
});

function installMemoryDb(t, initial = {}) {
  const memory = {
    data: { bag: {}, owned: [], souls: 0, merchantPurchases: [], ...initial },
    tail: Promise.resolve(),
    failCredit: false
  };
  function connection() {
    let unlock;
    let snapshot;
    return {
      async beginTransaction() {},
      async commit() { snapshot = null; unlock?.(); unlock = null; },
      async rollback() { if (snapshot) memory.data = snapshot; snapshot = null; unlock?.(); unlock = null; },
      release() {},
      async query(raw, params = []) {
        const sql = raw.replace(/\s+/g, ' ').trim();
        if (sql === 'SELECT id FROM players WHERE id = ? LIMIT 1 FOR UPDATE') {
          if (!unlock) {
            const previous = memory.tail;
            memory.tail = new Promise(resolve => { unlock = resolve; });
            await previous;
            snapshot = structuredClone(memory.data);
          }
          return [params[0] === 'p' ? [{ id: 'p' }] : []];
        }
        const data = memory.data;
        if (sql.startsWith('SELECT * FROM runs')) return [[data.run]];
        if (sql.startsWith('INSERT IGNORE INTO player_world_merchant_stock')) return [{ affectedRows: 0 }];
        if (sql.startsWith('SELECT reroll_count')) return [[]];
        if (sql.startsWith('SELECT spawn_id, reroll_count')) return [[{ spawn_id: data.merchant.spawnId, reroll_count: 0 }]];
        if (sql.startsWith('SELECT slot, item_key AS itemKey')) return [data.merchantPurchases];
        if (sql.startsWith('SELECT p.*, pd.image_url')) {
          await this.query('SELECT id FROM players WHERE id = ? LIMIT 1 FOR UPDATE', ['p']);
          return [[{ id: 'p', souls: data.souls, level: 1 }]];
        }
        if (sql.startsWith('SELECT x, y FROM player_world_positions')) return [[data.merchant]];
        if (sql.startsWith('INSERT IGNORE INTO player_world_merchant_purchases')) { data.purchases++; return [{ affectedRows: 1 }]; }
        if (sql.startsWith('UPDATE players SET souls = souls - ?')) { data.souls -= params[0]; return [{ affectedRows: 1 }]; }
        if (sql.startsWith('SELECT DISTINCT')) return [(data.conversionPlayers || ['p']).map(playerId => ({ playerId }))];
        if (sql.startsWith('SELECT id FROM player_demons')) {
          return [data.owned.filter(row => row.typeId === params[1] && row.rarity === params[2])];
        }
        if (sql.startsWith('SELECT type_id AS typeId')) return [data.owned];
        if (sql.startsWith('SELECT quantity FROM player_bag')) return [[{ quantity: data.bag[params[1]] || 0 }]];
        const bagRows = Object.entries(data.bag).map(([itemKey, quantity]) => ({ itemKey, itemType: itemKey.startsWith('echo:') ? 'echo' : 'potion', quantity }));
        if (sql.startsWith('SELECT item_key AS itemKey, quantity')) return [bagRows.filter(row => row.itemType === 'echo')];
        if (sql.startsWith('SELECT item_key AS itemKey, item_type')) return [bagRows.filter(row => row.itemType !== 'echo')];
        if (sql.startsWith("SELECT 'bag' AS rowType")) return [[
          ...bagRows.filter(row => row.itemType === 'echo' && row.quantity > 0).map(row => ({ ...row, rowType: 'bag' })),
          ...data.owned.map(row => ({ ...row, rowType: 'demon', demonId: row.id }))
        ]];
        if (sql.startsWith('INSERT INTO player_bag')) { data.bag[params[1]] = (data.bag[params[1]] || 0) + 1; return [{ affectedRows: 1 }]; }
        if (sql.startsWith('INSERT IGNORE INTO player_echo_discoveries')) return [{ affectedRows: 1 }];
        if (sql.startsWith('INSERT INTO player_demons')) {
          data.owned.push({ id: 1, typeId: params[2], rarity: params[4] });
          return [{ insertId: 1, affectedRows: 1 }];
        }
        if (sql.startsWith('DELETE FROM player_bag')) { delete data.bag[params[1]]; return [{ affectedRows: 1 }]; }
        if (sql.startsWith('UPDATE player_bag SET quantity = quantity - ?')) {
          const quantity = data.bag[params[2]] || 0;
          if (quantity < params[3]) return [{ affectedRows: 0 }];
          data.bag[params[2]] -= params[0]; return [{ affectedRows: 1 }];
        }
        if (sql.startsWith('UPDATE player_bag SET quantity = ?')) { data.bag[params[2]] = params[0]; return [{ affectedRows: 1 }]; }
        if (sql.startsWith('UPDATE players SET souls = souls + ?')) {
          if (memory.failCredit) throw new Error('credit failed');
          data.souls += params[0]; return [{ affectedRows: 1 }];
        }
        throw new Error(`Unexpected test query: ${sql}`);
      }
    };
  }
  t.mock.method(db, 'getConnection', async () => connection());
  t.mock.method(db, 'query', (...args) => connection().query(...args));
  t.mock.method(achievements, 'checkCollection', async () => {});
  return memory;
}
