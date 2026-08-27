// Deterministic matte removal for the approved gray-teal concept sheets.
// Never generates or redraws a character. Requires the source collection manifest.
// node scripts/extract-demon-backgrounds.js <collection> <output> [comma-separated IDs]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');

const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

async function extract(source, output) {
  const { data, info } = await sharp(source).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const size = w * h;
  const samples = [];
  for (let y = 0; y < h; y += 8) {
    for (const x of [0, 8, w - 9, w - 1]) samples.push((y * w + x) * 3);
  }
  for (let x = 0; x < w; x += 8) {
    for (const y of [0, 8, h - 9, h - 1]) samples.push((y * w + x) * 3);
  }
  const bg = [0, 1, 2].map(c => median(samples.map(i => data[i + c])));
  const rg = median(samples.map(i => data[i + 1] - data[i]));
  const gb = median(samples.map(i => data[i + 2] - data[i + 1]));
  const rgMad = median(samples.map(i => Math.abs(data[i + 1] - data[i] - rg)));
  const gbMad = median(samples.map(i => Math.abs(data[i + 2] - data[i + 1] - gb)));
  const candidates = new Uint8Array(size);
  const removed = new Uint8Array(size);
  const seen = new Uint8Array(size);
  const queue = new Int32Array(size);
  for (let p = 0; p < size; p++) {
    const i = p * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    // Broad enough for the flat contact shadow; black ink remains a barrier.
    const shade = Math.min(1, g / bg[1]);
    if (g > 55 && g - r >= Math.max(0, rg * shade - 8) && g - r <= rg + Math.max(8, rgMad * 5) && Math.abs(b - g - gb * shade) <= Math.max(9, gbMad * 5)) candidates[p] = 1;
  }
  let components = 0;
  for (let seed = 0; seed < size; seed++) {
    if (!candidates[seed] || seen[seed]) continue;
    let head = 0, tail = 1, border = false, brightness = 0;
    queue[0] = seed; seen[seed] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % w, y = Math.floor(p / w);
      brightness += data[p * 3 + 1];
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) border = true;
      if (x > 0 && candidates[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; queue[tail++] = p - 1; }
      if (x < w - 1 && candidates[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; queue[tail++] = p + 1; }
      if (y > 0 && candidates[p - w] && !seen[p - w]) { seen[p - w] = 1; queue[tail++] = p - w; }
      if (y < h - 1 && candidates[p + w] && !seen[p + w]) { seen[p + w] = 1; queue[tail++] = p + w; }
    }
    // Enclosed background gaps use the same matte; do not fill wing/arm gaps.
    if (border || (tail >= 12 && Math.abs(brightness / tail - bg[1]) < 27)) {
      components++;
      for (let j = 0; j < tail; j++) removed[queue[j]] = 1;
    }
  }
  const rgba = Buffer.alloc(size * 4);
  let transparent = 0, partial = 0, unchanged = 0;
  for (let p = 0; p < size; p++) {
    const i = p * 3, o = p * 4;
    if (removed[p]) { transparent++; continue; }
    rgba[o] = data[i]; rgba[o + 1] = data[i + 1]; rgba[o + 2] = data[i + 2]; rgba[o + 3] = 255;
    const x = p % w, y = Math.floor(p / w);
    let touching = false, darkest = p, darkValue = data[i] + data[i + 1] + data[i + 2];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 0 || x + dx >= w || y + dy < 0 || y + dy >= h) continue;
      const q = p + dy * w + dx;
      if (removed[q]) touching = true;
      const v = data[q * 3] + data[q * 3 + 1] + data[q * 3 + 2];
      if (!removed[q] && v < darkValue) { darkValue = v; darkest = q; }
    }
    if (touching && darkValue < 130 && darkest !== p) {
      const f = [0, 1, 2].map(c => data[darkest * 3 + c]);
      const delta = bg.map((v, c) => v - f[c]);
      const alpha = Math.max(0, Math.min(1, delta.reduce((sum, v, c) => sum + v * (bg[c] - data[i + c]), 0) / delta.reduce((sum, v) => sum + v * v, 0)));
      if (alpha < 0.98) {
        for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(Math.max(0, Math.min(255, (data[i + c] - bg[c] * (1 - alpha)) / Math.max(alpha, 0.01))));
        rgba[o + 3] = Math.round(alpha * 255); partial++;
      } else unchanged++;
    } else unchanged++;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toFile(output);
  return { width: w, height: h, matte: bg, chroma: [rg, gb], removedComponents: components, transparentPixels: transparent, partialPixels: partial, unchangedOpaquePixels: unchanged, sourceSha256: digest(source), outputSha256: digest(output) };
}

async function main() {
  const [collection, output, selection] = process.argv.slice(2);
  if (!collection || !output) throw new Error('Usage: <collection directory> <output directory> [IDs]');
  const selected = selection ? new Set(selection.split(',').map(Number)) : null;
  const rows = JSON.parse(fs.readFileSync(path.join(collection, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
  const report = [];
  for (const row of rows) {
    if (selected && !selected.has(row.id)) continue;
    const target = path.join(output, `${row.id}.png`);
    report.push({ id: row.id, species: row.species, rarity: row.rarity, source: row.output, output: `${row.id}.png`, ...await extract(path.join(collection, row.output), target) });
  }
  fs.writeFileSync(path.join(output, 'extraction-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Extracted ${report.length} existing images without regeneration.`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { extract };
