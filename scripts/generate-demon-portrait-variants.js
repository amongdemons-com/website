// Generates medium WebP variants of the demon art for dialog portraits
// (e.g. the world boss intro overlay). Sits between the tiny map tokens and
// the multi-megabyte battle-card PNGs, which stay untouched.
//
// Usage: node scripts/generate-demon-portrait-variants.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_DIR = path.join(__dirname, '..', 'public', 'app', 'images', 'demons');
const OUTPUT_DIR = path.join(SOURCE_DIR, 'portrait');
const MAX_EDGE = 512;
const QUALITY = 82;

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const sources = fs.readdirSync(SOURCE_DIR)
    .filter((name) => /^\d+\.png$/.test(name));

  let generated = 0;
  let skipped = 0;

  for (const name of sources) {
    const sourcePath = path.join(SOURCE_DIR, name);
    const outputPath = path.join(OUTPUT_DIR, name.replace(/\.png$/, '.webp'));

    if (fs.existsSync(outputPath) && fs.statSync(outputPath).mtimeMs >= fs.statSync(sourcePath).mtimeMs) {
      skipped += 1;
      continue;
    }

    await sharp(sourcePath)
      .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(outputPath);
    generated += 1;
  }

  console.log(`Portrait variants: ${generated} generated, ${skipped} up to date, output ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
