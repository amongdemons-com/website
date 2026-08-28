const test = require('node:test');
const assert = require('node:assert/strict');
const { getDemonSourceId, getDemonImageUrl } = require('../public/api/lib/demon-images');
const { renderBackdropCss, spriteSelectors } = require('../scripts/generate-demon-card-backdrops');
const backdrops = require('../docs/art/card-backdrops.json');

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
