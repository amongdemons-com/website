const test = require('node:test');
const assert = require('node:assert/strict');
const { getDemonSourceId, getDemonImageUrl } = require('../public/api/lib/demon-images');
const { renderBackdropCss, spriteSelectors } = require('../scripts/generate-demon-card-backdrops');
const backdrops = require('../docs/art/card-backdrops.json');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createEssenceMask } = require('../scripts/generate-echo-variants');

test('versioned demon image URLs retain source IDs and round-trip between variants', () => {
  for (const source of ['/app/images/demons/16.png?v=old', '/app/images/demons/map/16.webp?v=old#preview', '/app/images/demons/portrait/16.webp']) {
    assert.equal(getDemonSourceId(source), 16);
    const portrait = getDemonImageUrl(source, 'portrait');
    const map = getDemonImageUrl(portrait, 'map');
    assert.equal(new URL(portrait, 'http://localhost').pathname, '/app/images/demons/portrait/16.webp');
    assert.equal(new URL(map, 'http://localhost').pathname, '/app/images/demons/map/16.webp');
    assert.equal(getDemonSourceId(map), 16);
  }
  assert.equal(getDemonSourceId('/app/images/demons/anomaly.webp?v=old'), null);
  assert.equal(getDemonImageUrl('/external/sprite.webp?v=old'), '/external/sprite.webp?v=old');
});

test('every master, portrait and map sprite selects exactly its own type backdrop', () => {
  for (let id = 1; id <= 66; id++) {
    for (const variant of ['', 'portrait/', 'map/', 'thumbnails/']) {
      const url = `/app/images/demons/${variant}${id}.webp?v=art-test`;
      const matches = backdrops.variants.filter(row => spriteSelectors(row.demonIds)
        .some(selector => url.includes(selector.match(/src\*="([^"]+)"/)[1])));
      assert.equal(matches.length, 1, url);
      assert.equal(matches[0].typeId, Math.ceil(id / 6), url);
    }
  }
  const css = renderBackdropCss(backdrops.variants, 'art-test');
  assert.doesNotMatch(css, /file:\/\/|C:\\|\.codex/);
  assert.match(css, /:has\(> :is\(img\[src\*=/);
});

test('backdrop generation rejects incomplete or overlapping source assignments', () => {
  assert.throws(() => renderBackdropCss(backdrops.variants.slice(1), 'test'), /Every type needs/);
  const duplicate = structuredClone(backdrops.variants);
  duplicate[1].demonIds[0] = duplicate[0].demonIds[0];
  assert.throws(() => renderBackdropCss(duplicate, 'test'), /Invalid\/duplicate sprite ID/);
});

test('Echo renderer versions artwork and motion masks together for every type and rarity', () => {
  const echoes = require('../docs/art/echo-art.json');
  const context = { window: { AmongDemons: {} }, console };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/app/js/bag-item-visuals.js'), 'utf8'), context);
  const render = context.window.AmongDemons.bagVisuals.renderItemVisual;
  for (const item of echoes.items) {
    assert.equal(context.window.AmongDemons.bagVisuals.ECHO_TYPES[item.typeId].essence, item.essence);
    for (const rarity of ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']) {
      const html = render({ itemType: 'echo', typeId: item.typeId, rarity });
      assert.ok(html.includes(`/app/images/items/echo/${item.asset}.webp?v=${echoes.version}`));
      assert.ok(html.includes(`/app/images/items/echo/${item.asset}-mask.png?v=${echoes.version}`));
      assert.ok(html.includes(`data-rarity="${rarity}"`));
      assert.match(html, /echo-rarity-ornament[\s\S]*echo-rarity-aura[\s\S]*echo-fill-surface/);
      assert.doesNotMatch(html, /file:\/\/|\.codex|undefined/);
    }
  }
  const fallback = render({ itemType: 'echo', typeId: -1, rarity: 'invalid' }, { context: 'detail', title: '<test>"' });
  assert.match(fallback, /01-melee\.webp\?v=echo-/);
  assert.match(fallback, /data-rarity="common"/);
  assert.match(fallback, /loading="eager"/);
  assert.match(fallback, /title="&lt;test&gt;&quot;"/);
});

test('Echo motion mask keeps broad essence but excludes transparency, glyphs and small trim', () => {
  const size = 24, data = Buffer.alloc(size * size * 4);
  const paint = (x, y, rgba) => data.set(rgba, (y * size + x) * 4);
  for (let y = 5; y < 20; y++) for (let x = 5; x < 20; x++) paint(x, y, [240, 165, 50, 255]);
  for (let y = 1; y < 3; y++) for (let x = 1; x < 3; x++) paint(x, y, [240, 165, 50, 255]);
  paint(12, 12, [225, 220, 190, 255]);
  paint(16, 16, [240, 165, 50, 0]);
  const mask = createEssenceMask(data, size, size, 5, 10);
  const alpha = (x, y) => mask[(y * size + x) * 4 + 3];
  assert.equal(alpha(8, 8), 255);
  assert.equal(alpha(1, 1), 0);
  assert.equal(alpha(12, 12), 0);
  assert.equal(alpha(16, 16), 0);
  assert.equal(alpha(5, 5), 0, 'motion stays inset from the liquid edge');
});
