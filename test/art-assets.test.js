const test = require('node:test');
const assert = require('node:assert/strict');
const { getDemonSourceId, getDemonImageUrl } = require('../public/api/lib/demon-images');
const { renderBackdropCss, spriteSelectors } = require('../scripts/generate-demon-card-backdrops');
const backdrops = require('../docs/art/card-backdrops.json');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
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

test('every master, portrait and map sprite selects exactly its assigned type backdrop', () => {
  const expectedBackgroundTypes = { 4: 2, 5: 1, 6: 2, 7: 1, 9: 1, 11: 2 };
  for (const variant of backdrops.variants) {
    assert.equal(variant.backgroundTypeId || variant.typeId, expectedBackgroundTypes[variant.typeId] || variant.typeId);
  }
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
  for (const [typeId, backgroundTypeId] of Object.entries(expectedBackgroundTypes)) {
    assert.match(css, new RegExp(`--demon-backdrop-type-${typeId}: var\\(--demon-backdrop-type-${backgroundTypeId}\\);`));
  }
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

test('Dungeon ornament masters retain their production geometry and real transparency', async () => {
  const assets = [
    ['grid-heading-chain-rig.png', 1664, 353],
    ['grid-heading-status-rig.png', 640, 353],
    ['center-pole-rig.png', 793, 1983],
    ['floor-backdrop.png', 1122, 1402]
  ];

  for (const [name, width, height] of assets) {
    const file = path.join(__dirname, '../public/app/images/assets/dungeon', name);
    const metadata = await sharp(file).metadata();
    assert.equal(metadata.width, width, name);
    assert.equal(metadata.height, height, name);
    assert.equal(metadata.hasAlpha, true, `${name}: actual alpha is required`);

    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0;
    let opaque = 0;
    let partial = 0;
    for (let p = 3; p < data.length; p += 4) {
      if (data[p] === 0) transparent++;
      if (data[p] >= 250) opaque++;
      if (data[p] > 0 && data[p] < 250) partial++;
    }
    assert.ok(transparent > info.width * info.height * 0.1, `${name}: transparent field is missing`);
    assert.ok(opaque > info.width * info.height * 0.03, `${name}: ornament is missing`);
    assert.ok(opaque > partial * 12, `${name}: painted surfaces must remain solid rather than ghosted`);
    assert.equal(data[3], 0, `${name}: top-left matte remains`);
    assert.equal(data[data.length - 1], 0, `${name}: bottom-right matte remains`);
  }
});

test('Dungeon ornament treatment yields visual focus to the battle', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/app/css/battle.css'), 'utf8');
  const render = fs.readFileSync(path.join(__dirname, '../public/app/js/dungeon/render.js'), 'utf8');

  const nameplateBlock = css.match(/body\.dungeon-page \.battle-side-nameplate\s*{([^}]*)}/)?.[1] || '';
  const statusBlock = css.match(/body\.dungeon-page \.battle-side-status\s*{([^}]*)}/)?.[1] || '';
  const centerArtworkBlock = css.match(/body\.dungeon-page \.dungeon-center-panel::before\s*{([^}]*)}/)?.[1] || '';

  assert.match(nameplateBlock, /grid-heading-chain-rig\.png\?v=art-dungeon-grid-chain-v6/);
  assert.match(nameplateBlock, /aspect-ratio:\s*1664\s*\/\s*353/);
  assert.doesNotMatch(nameplateBlock, /(?:^|;)\s*(?:opacity|filter):/);
  assert.match(statusBlock, /grid-heading-status-rig\.png\?v=art-dungeon-grid-status-v1/);
  assert.match(statusBlock, /aspect-ratio:\s*640\s*\/\s*353/);
  assert.doesNotMatch(statusBlock, /(?:^|;)\s*(?:opacity|filter):/);
  assert.match(css, /body\.dungeon-page \.dungeon-center-panel\s*{[\s\S]*?transform: scale\(0\.84\);/);
  assert.match(centerArtworkBlock, /center-pole-rig\.png\?v=art-dungeon-center-pole-v4/);
  assert.doesNotMatch(centerArtworkBlock, /(?:^|;)\s*(?:opacity|filter):/);
  assert.match(css, /\.dungeon-center-action-stack \.dungeon-fight-btn:not\(:disabled\):active\s*{[\s\S]*?background: #563a22;/);
  assert.match(render, /class="battle-side-nameplate"/);
  assert.match(render, /class="battle-side-status" aria-label="Team modifiers"/);
  assert.match(render, /class="battle-side-status" aria-label="Enemy modifiers"/);
  assert.match(render, /arena\?\.classList\.toggle\('is-battle-focused', isBattleLayoutActive\);/);
});
