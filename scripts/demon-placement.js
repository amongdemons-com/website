const assert = require('node:assert/strict');

const ALPHA_THRESHOLD = 8;
const MIN_COMPONENT_PIXELS = 16;
const EDGE_PADDING = 2;

// Keep real detached features (flames, hands, etc.), but do not let isolated
// extraction specks at a canvas corner determine the character's footprint.
function findContentBounds(data, width, height, options = {}) {
  const threshold = options.alphaThreshold ?? ALPHA_THRESHOLD;
  const minimum = options.minComponentPixels ?? MIN_COMPONENT_PIXELS;
  assert.equal(data.length, width * height * 4, 'Expected an RGBA image');
  const seen = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let left = width, top = height, right = -1, bottom = -1;
  let components = 0, ignoredPixels = 0;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] <= threshold) continue;
    seen[start] = 1;
    queue[0] = start;
    let head = 0, length = 1, x0 = width, y0 = height, x1 = -1, y1 = -1;
    while (head < length) {
      const pixel = queue[head++];
      const x = pixel % width, y = Math.floor(pixel / width);
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
          const neighbor = ny * width + nx;
          if (seen[neighbor] || data[neighbor * 4 + 3] <= threshold) continue;
          seen[neighbor] = 1;
          queue[length++] = neighbor;
        }
      }
    }
    if (length < minimum) { ignoredPixels += length; continue; }
    components++;
    left = Math.min(left, x0); top = Math.min(top, y0);
    right = Math.max(right, x1); bottom = Math.max(bottom, y1);
  }
  assert.ok(components, 'No substantive character silhouette found');
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, components, ignoredPixels };
}

function centerImage(data, width, height) {
  const bounds = findContentBounds(data, width, height);
  const dx = Math.round((width - bounds.width) / 2) - bounds.left;
  const dy = Math.round((height - bounds.height) / 2) - bounds.top;
  const crop = {
    left: Math.max(0, bounds.left - EDGE_PADDING),
    top: Math.max(0, bounds.top - EDGE_PADDING),
    right: Math.min(width - 1, bounds.right + EDGE_PADDING),
    bottom: Math.min(height - 1, bounds.bottom + EDGE_PADDING)
  };
  assert.ok(crop.left + dx >= 0 && crop.right + dx < width
    && crop.top + dy >= 0 && crop.bottom + dy < height, 'Centering would clip the character');
  const output = Buffer.alloc(data.length);
  const rowBytes = (crop.right - crop.left + 1) * 4;
  for (let y = crop.top; y <= crop.bottom; y++) {
    const source = (y * width + crop.left) * 4;
    const target = ((y + dy) * width + crop.left + dx) * 4;
    data.copy(output, target, source, source + rowBytes);
  }
  return { data: output, bounds, translation: { x: dx, y: dy } };
}

module.exports = { ALPHA_THRESHOLD, MIN_COMPONENT_PIXELS, findContentBounds, centerImage };
