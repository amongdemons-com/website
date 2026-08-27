const test = require('node:test');
const assert = require('node:assert/strict');
const { getDemonSourceId, getDemonImageUrl } = require('../public/api/lib/demon-images');

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
