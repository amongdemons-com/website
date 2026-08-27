// Generates modern formats for full-page backgrounds while retaining the PNG
// originals as universal fallbacks.
//
// Usage: node scripts/generate-background-variants.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const writeAsset = require('./write-asset');

const SOURCE_DIR = path.join(__dirname, '..', 'public', 'app', 'images', 'assets', 'background');
const FORMATS = [
  { extension: '.webp', options: { quality: 82 } },
  { extension: '.avif', options: { quality: 50, effort: 5 } }
];

async function main() {
  const sources = fs.readdirSync(SOURCE_DIR).filter((name) => name.endsWith('.png'));
  let generated = 0;
  let skipped = 0;

  for (const name of sources) {
    const sourcePath = path.join(SOURCE_DIR, name);
    const sourceModifiedAt = fs.statSync(sourcePath).mtimeMs;

    for (const format of FORMATS) {
      const outputPath = path.join(SOURCE_DIR, name.replace(/\.png$/, format.extension));
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).mtimeMs >= sourceModifiedAt) {
        skipped += 1;
        continue;
      }

      const image = sharp(sourcePath);
      if (format.extension === '.avif') {
        writeAsset(outputPath, await image.avif(format.options).toBuffer());
      } else {
        writeAsset(outputPath, await image.webp(format.options).toBuffer());
      }
      generated += 1;
    }
  }

  console.log(`Background variants: ${generated} generated, ${skipped} up to date.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
