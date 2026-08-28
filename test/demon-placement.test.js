const test = require('node:test');
const assert = require('node:assert/strict');
const { findContentBounds, centerImage } = require('../scripts/demon-placement');

function rectangle(data, width, x, y, w, h, rgba = [20, 70, 90, 255]) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) data.set(rgba, (row * width + col) * 4);
  }
}

test('content bounds ignore a corner speck but include detached hands and magic', () => {
  const data = Buffer.alloc(100 * 100 * 4);
  rectangle(data, 100, 30, 40, 40, 30);
  rectangle(data, 100, 10, 10, 4, 4);
  rectangle(data, 100, 80, 15, 4, 4);
  rectangle(data, 100, 0, 99, 1, 1);
  const bounds = findContentBounds(data, 100, 100);
  assert.deepEqual([bounds.left, bounds.top, bounds.right, bounds.bottom], [10, 10, 83, 69]);
  assert.equal(bounds.components, 3);
  assert.equal(bounds.ignoredPixels, 1);
});

test('low wide poison bodies and tall demons center their visible bounds without changing proportions', () => {
  for (const [w, h, y] of [[180, 50, 60], [60, 240, 5]]) {
    const data = Buffer.alloc(300 * 300 * 4);
    rectangle(data, 300, 21, y, w, h);
    const result = centerImage(data, 300, 300);
    const after = findContentBounds(result.data, 300, 300);
    assert.equal(after.width, w);
    assert.equal(after.height, h);
    assert.equal((after.top + after.bottom + 1) / 2, 150);
    assert.equal((after.left + after.right + 1) / 2, 150);
  }
});

test('centering preserves RGBA values and antialiased edges within the retained footprint', () => {
  const data = Buffer.alloc(100 * 100 * 4);
  rectangle(data, 100, 30, 30, 30, 30, [3, 22, 81, 255]);
  rectangle(data, 100, 29, 30, 1, 30, [6, 14, 93, 5]);
  const original = Buffer.from(data);
  const result = centerImage(data, 100, 100);
  assert.deepEqual(data, original, 'input must not be mutated');
  for (let y = 28; y <= 61; y++) {
    for (let x = 28; x <= 61; x++) {
      const from = (y * 100 + x) * 4;
      const to = ((y + result.translation.y) * 100 + x + result.translation.x) * 4;
      assert.deepEqual(result.data.subarray(to, to + 4), data.subarray(from, from + 4));
    }
  }
});

test('empty artwork and moves that would clip antialiasing fail explicitly', () => {
  assert.throws(() => centerImage(Buffer.alloc(100 * 100 * 4), 100, 100), /No substantive/);
  const data = Buffer.alloc(100 * 100 * 4);
  rectangle(data, 100, 0, 20, 99, 40);
  assert.throws(() => centerImage(data, 100, 100), /clip/);
});
