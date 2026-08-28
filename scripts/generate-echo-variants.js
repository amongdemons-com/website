// Approved filled PNGs remain the source of truth. Only resize/encode artwork;
// derive a separate liquid mask so animation never recolors the frame or glyph.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const writeAsset = require('./write-asset');
const root = path.join(__dirname, '..');
const imageRoot = path.join(root, 'public/app/images/items/echo');
const manifestPath = path.join(root, 'docs/art/echo-art.json');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function isEssence(type, r, g, b, x, y) {
  switch (type) {
    case 1: return x > .23 && x < .78 && y > .39 && y < .8 && g > 100 && g < 178 && b >= g && g > r;
    case 2: return g > 15 && g < 46 && b > g + 9 && r < 43;
    case 3: return g > r * 1.3 && g > b * 1.2;
    case 4: return r > 150 && r > g * 1.4 && r > b * 1.4;
    case 5: return r > 180 && g > 120 && g < 220 && b < 125;
    case 6: return r > 175 && g > 85 && g < 200 && b < 100;
    case 7: return r > 45 && b > r * 1.1 && b > g * 1.4;
    case 8: return r > 45 && r < 170 && g > r * .8 && g > b * 1.5;
    case 9: return x > .24 && x < .75 && y > .4 && y < .79 && g > 100 && g < 180 && b >= g && g > r;
    case 10: return g > 120 && b > g * 1.01 && r < g * .8;
    case 11: return b > 120 && b > g * 1.4 && b > r * 2;
    default: throw new Error(`Unknown Echo type ${type}`);
  }
}

function createEssenceMask(data, width, height, type, minimumArea = Math.round(width * height * .01)) {
  const size = width * height;
  const candidates = new Uint8Array(size), seen = new Uint8Array(size), mask = Buffer.alloc(size * 4);
  const queue = new Int32Array(size);
  for (let p = 0; p < size; p++) {
    const i = p * 4;
    if (data[i + 3] > 240 && isEssence(type, data[i], data[i + 1], data[i + 2], (p % width) / width, Math.floor(p / width) / height)) candidates[p] = 1;
  }
  // Ignore similarly colored tiny trim pieces. Ink and ivory glyphs separate
  // them from the broad liquid regions inside the vessel.
  for (let seed = 0; seed < size; seed++) {
    if (!candidates[seed] || seen[seed]) continue;
    let head = 0, tail = 1; queue[0] = seed; seen[seed] = 1;
    while (head < tail) {
      const p = queue[head++], x = p % width, y = Math.floor(p / width);
      for (const q of [x ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (q >= 0 && candidates[q] && !seen[q]) { seen[q] = 1; queue[tail++] = q; }
      }
    }
    if (tail < minimumArea) continue;
    for (let n = 0; n < tail; n++) {
      const p = queue[n], x = p % width, y = Math.floor(p / width);
      // Inset by one source pixel to keep the animated overlay off ink edges.
      if (!x || !y || x === width - 1 || y === height - 1 || !candidates[p - 1] || !candidates[p + 1] || !candidates[p - width] || !candidates[p + width]) continue;
      mask.fill(255, p * 4, p * 4 + 4);
    }
  }
  return mask;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const content = crypto.createHash('sha256');
  for (const item of manifest.items) {
    const master = path.join(imageRoot, `${item.asset}.png`);
    if (hash(fs.readFileSync(master)) !== item.masterSha256) throw new Error(`Unrecorded change to approved Echo ${item.asset}`);
    const { data, info } = await sharp(master).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = createEssenceMask(data, info.width, info.height, item.typeId);
    const maskPixels = mask.reduce((sum, value, i) => sum + (i % 4 === 3 && value ? 1 : 0), 0);
    if (maskPixels < info.width * info.height * .01) throw new Error(`Missing liquid mask: ${item.asset}`);
    const webp = await sharp(master).resize(512, 512).webp({ quality: 94, alphaQuality: 100, effort: 5 }).toBuffer();
    const pngMask = await sharp(mask, { raw: { width: info.width, height: info.height, channels: 4 } }).resize(512, 512).png().toBuffer();
    writeAsset(path.join(imageRoot, `${item.asset}.webp`), webp);
    writeAsset(path.join(imageRoot, `${item.asset}-mask.png`), pngMask);
    content.update(item.asset).update(webp).update(pngMask);
    item.webpSha256 = hash(webp);
    item.maskSha256 = hash(pngMask);
    item.essenceMaskPixels = maskPixels;
  }
  manifest.version = `echo-${content.digest('hex').slice(0, 12)}`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  const rendererPath = path.join(root, 'public/app/js/bag-item-visuals.js');
  const source = fs.readFileSync(rendererPath, 'utf8');
  const next = source.replace(/const ECHO_ART_VERSION = '[^']+';/, `const ECHO_ART_VERSION = '${manifest.version}';`);
  if (next === source && !source.includes(manifest.version)) throw new Error('Echo renderer version marker is missing');
  if (next !== source) fs.writeFileSync(rendererPath, next);
  console.log(`${manifest.items.length} approved Echoes: transparent 512px WebPs and liquid masks (${manifest.version}).`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { createEssenceMask };
