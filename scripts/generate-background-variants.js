// Generates modern formats for full-page backgrounds while retaining the PNG
// originals as universal fallbacks.
//
// Usage: node scripts/generate-background-variants.js
const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const writeAsset = require('./write-asset');

const SOURCE_DIR = path.join(__dirname, '..', 'public', 'app', 'images', 'assets', 'background');
const FORMATS = [
  { extension: '.webp', options: { quality: 82 } },
  { extension: '.avif', options: { quality: 50, effort: 5 } }
];

async function main() {
  const sources = fs.readdirSync(SOURCE_DIR).filter((name) => name.endsWith('.png'));
  const approvedBackdrops = JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/art/card-backdrops.json'), 'utf8')).variants;
  const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  let generated = 0;
  let skipped = 0;

  for (const name of sources) {
    const sourcePath = path.join(SOURCE_DIR, name);
    const sourceModifiedAt = fs.statSync(sourcePath).mtimeMs;
    const approved = approvedBackdrops.find(item => path.basename(item.files.png) === name);
    const matchesApprovedMaster = approved && hashFile(sourcePath) === approved.sha256.png;

    for (const format of FORMATS) {
      const outputPath = path.join(SOURCE_DIR, name.replace(/\.png$/, format.extension));
      // Git checkout times do not mean an approved palette needs recompression.
      if (matchesApprovedMaster && fs.existsSync(outputPath)
          && hashFile(outputPath) === approved.sha256[format.extension.slice(1)]) {
        skipped += 1;
        continue;
      }
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
