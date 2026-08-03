const test = require('node:test');
const assert = require('node:assert/strict');
const map = require('../public/api/data/map.json');
const { renderEventsPage } = require('../lib/seo-pages');
const {
  SOUL_FONT_BUFFS,
  SOUL_FONT_DURATION_HOURS,
  SOUL_FONT_DURATION_SECONDS,
  SOUL_FONT_X,
  SOUL_FONT_Y,
  getActiveSoulFontBuffs,
  getSoulFontCost,
  getWorldSoulFontForPlayer,
  isAtSoulFont,
  purchaseSoulFontBuff,
  selectRandomSoulFontBuff
} = require('../public/api/lib/world-soul-font');

test('the Whispering Well occupies Area 14, -8 on the world map', () => {
  const event = map.events.find((candidate) => candidate.type === 'soul-font');
  assert.deepEqual([SOUL_FONT_X, SOUL_FONT_Y], [14, -8]);
  assert.equal(event?.x, SOUL_FONT_X);
  assert.equal(event?.y, SOUL_FONT_Y);
  assert.equal(event?.title, 'The Whispering Well');
  assert.equal(isAtSoulFont(event), true);
  assert.equal(isAtSoulFont({ x: 14, y: -7 }), false);
});

test('the world events guide includes the Whispering Well', () => {
  const page = renderEventsPage();
  assert.match(page, /The Whispering Well/);
  assert.match(page, /Area 14, -8/);
  assert.match(page, /Random 4h buff/);
  assert.match(page, /8 kinds of world events/);
  assert.match(page, /\/app\/images\/events\/marker-whispering-well\.webp/);
});

test('Whispering Well offerings scale into a meaningful Soul sink', () => {
  assert.equal(getSoulFontCost(1), 100);
  assert.equal(getSoulFontCost(10), 190);
  assert.equal(getSoulFontCost(51), 600);
});

test('Whispering Well selects the blessing server-side from the complete buff pool', () => {
  const first = selectRandomSoulFontBuff((maximum) => {
    assert.equal(maximum, SOUL_FONT_BUFFS.length);
    return 0;
  });
  const last = selectRandomSoulFontBuff(() => SOUL_FONT_BUFFS.length - 1);

  assert.equal(first.id, SOUL_FONT_BUFFS[0].id);
  assert.equal(last.id, SOUL_FONT_BUFFS.at(-1).id);
  assert.equal(first.effects.length, 1);
});

test('Whispering Well replacement rolls exclude the active blessing', () => {
  const activeBuff = SOUL_FONT_BUFFS[0];
  const selected = selectRandomSoulFontBuff((maximum) => {
    assert.equal(maximum, SOUL_FONT_BUFFS.length - 1);
    return 0;
  }, activeBuff.id);

  assert.equal(selected.id, SOUL_FONT_BUFFS[1].id);
  assert.notEqual(selected.id, activeBuff.id);
});

test('paid Whispering Well replacements cannot award the active blessing again', async () => {
  const now = new Date('2026-08-03T08:00:00.000Z');
  const activeBuff = SOUL_FONT_BUFFS.at(-1);
  let storedBuffId = '';
  const connection = {
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    async query(sql, params) {
      if (/SELECT p\.\*/.test(sql)) {
        return [[{ id: 'hunter-one', username: 'HunterOne', level: 10, souls: 1_000 }]];
      }
      if (/FROM player_world_positions/.test(sql)) {
        return [[{ x: SOUL_FONT_X, y: SOUL_FONT_Y }]];
      }
      if (/FROM player_world_soul_font_buffs/.test(sql)) {
        return [[{
          buffId: activeBuff.id,
          ritualId: 'ritual:previous-offering',
          expiresAtSeconds: (now.getTime() / 1000) + 3_600
        }]];
      }
      if (/INSERT INTO player_world_soul_font_buffs/.test(sql)) {
        storedBuffId = params[1];
        return [{ affectedRows: 2 }];
      }
      if (/UPDATE players SET souls/.test(sql)) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const result = await purchaseSoulFontBuff(
    'hunter-one',
    'ritual:new-paid-offering',
    {
      connection,
      now,
      randomInt(maximum) {
        assert.equal(maximum, SOUL_FONT_BUFFS.length - 1);
        return maximum - 1;
      }
    }
  );

  assert.notEqual(result.buff.id, activeBuff.id);
  assert.equal(storedBuffId, result.buff.id);
  assert.equal(result.charged, true);
});

test('Whispering Well state hides every possible outcome before sacrifice', async () => {
  const soulFont = await getWorldSoulFontForPlayer('hunter-one', {
    playerLevel: 10,
    position: { x: SOUL_FONT_X, y: SOUL_FONT_Y },
    queryable: { query: async () => [[]] }
  });

  assert.equal(soulFont.price, 190);
  assert.equal(soulFont.canOffer, true);
  assert.equal(soulFont.name, 'The Whispering Well');
  assert.match(soulFont.ritualId, /^ritual:[a-z0-9-]{36}$/i);
  assert.equal('offers' in soulFont, false);
  assert.equal('offerSetId' in soulFont, false);
});

test('every Whispering Well blessing lasts exactly four hours', () => {
  assert.equal(SOUL_FONT_DURATION_HOURS, 4);
  assert.equal(SOUL_FONT_DURATION_SECONDS, 14_400);
  SOUL_FONT_BUFFS.forEach((buff) => {
    assert.equal(buff.durationHours, 4);
    assert.equal(buff.durationSeconds, 14_400);
  });
});

test('every Whispering Well blessing has a unique Whisper name', () => {
  const names = SOUL_FONT_BUFFS.map((buff) => buff.name);
  assert.equal(new Set(names).size, names.length);
  names.forEach((name) => assert.match(name, /\bWhisper\b/i));
});

test('Whispering Well expiry reads are timezone-safe and preserve four hours', async () => {
  const awardedAtSeconds = Date.parse('2026-08-02T12:00:00.000Z') / 1000;
  const expiresAtSeconds = awardedAtSeconds + SOUL_FONT_DURATION_SECONDS;
  let queryText = '';
  const buffs = await getActiveSoulFontBuffs('hunter-one', {
    query: async (sql) => {
      queryText = sql;
      return [[{ buffId: SOUL_FONT_BUFFS[0].id, expiresAtSeconds }]];
    }
  });

  assert.match(queryText, /UNIX_TIMESTAMP\(expires_at\) AS expiresAtSeconds/);
  assert.equal(buffs[0].expiresAt, '2026-08-02T16:00:00.000Z');
});
