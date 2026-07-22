// Packs all compact world-map demon portraits into one WebP request.
//
// Usage: node scripts/generate-demon-map-atlas.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const APP_DIR = path.join(__dirname, '..', 'public', 'app');
const SOURCE_DIR = path.join(APP_DIR, 'images', 'demons', 'map');
const OUTPUT_PATH = path.join(APP_DIR, 'images', 'demons', 'map-atlas.webp');
const MODULE_DIR = path.join(APP_DIR, 'js', 'generated');
const MODULE_PATH = path.join(MODULE_DIR, 'demon-map-atlas.js');
const FRAME_SIZE = 128;

async function main() {
  const entries = fs.readdirSync(SOURCE_DIR)
    .filter((name) => /^\d+\.webp$/.test(name))
    .map((name) => ({ id: Number(name.replace(/\.webp$/, '')), name }))
    .sort((left, right) => left.id - right.id);
  const columns = Math.ceil(Math.sqrt(entries.length));
  const rows = Math.ceil(entries.length / columns);
  const composites = await Promise.all(entries.map(async (entry, index) => ({
    input: await sharp(path.join(SOURCE_DIR, entry.name))
      .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain' })
      .webp({ quality: 80 })
      .toBuffer(),
    left: (index % columns) * FRAME_SIZE,
    top: Math.floor(index / columns) * FRAME_SIZE
  })));

  await sharp({
    create: {
      width: columns * FRAME_SIZE,
      height: rows * FRAME_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite(composites).webp({ quality: 82 }).toFile(OUTPUT_PATH);

  const atlas = fs.readFileSync(OUTPUT_PATH);
  const hash = crypto.createHash('sha256').update(atlas).digest('hex').slice(0, 12);
  fs.mkdirSync(MODULE_DIR, { recursive: true });
  fs.writeFileSync(MODULE_PATH, [
    `export const DEMON_MAP_ATLAS_URL = '/app/images/demons/map-atlas.webp?v=${hash}';`,
    `export const DEMON_MAP_ATLAS_FRAME_SIZE = ${FRAME_SIZE};`,
    `export const DEMON_MAP_ATLAS_COLUMNS = ${columns};`,
    `export const DEMON_MAP_ATLAS_IDS = ${JSON.stringify(entries.map((entry) => entry.id))};`,
    ''
  ].join('\n'));

  console.log(`Demon map atlas: ${entries.length} frames, ${(atlas.length / 1024).toFixed(1)} KB.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
