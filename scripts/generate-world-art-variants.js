// Preserve square event portrait sizes, Anomaly alpha, and the existing brand logo.
const path = require('node:path');
const writeAsset = require('./write-asset');
const sharp = require('sharp');
const root = path.join(__dirname, '..', 'public/app/images');
async function main() {
  for (const [asset, size] of [['assets/world/crowley', 512], ['assets/world/soul-font', 768], ['demons/anomaly', 1024]]) {
    const image = await sharp(path.join(root, `${asset}.png`)).resize(size, size, { fit: 'contain', background: '#00000000' })
      .webp({ quality: 90, alphaQuality: 100, effort: 5 }).toBuffer();
    writeAsset(path.join(root, `${asset}.webp`), image);
  }
  const home = path.join(root, 'assets/background/amongdemons_home.png');
  const metadata = await sharp(home).metadata();
  const logo = await sharp(path.join(root, 'amongdemons_logo_white_text_left_1700x700.png'))
    .resize(Math.round(metadata.width * 0.68)).png().toBuffer();
  const social = await sharp(home).composite([{ input: logo, gravity: 'centre' }]).png().toBuffer();
  writeAsset(path.join(root, 'assets/background/amongdemons_home_logo.png'), social);
  console.log('World art: three WebPs and the unchanged brand logo on the new home background.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
