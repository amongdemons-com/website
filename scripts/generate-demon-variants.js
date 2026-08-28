// Rebuild deployable variants from the transparent full-size PNG masters.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const writeAsset = require('./write-asset');
const { centerImage } = require('./demon-placement');
const root = path.join(__dirname, '..', 'public', 'app', 'images', 'demons');
const provenanceFile = path.join(__dirname, '..', 'docs/art/demon-provenance.json');

async function main() {
  const ids = fs.readdirSync(root).filter(name => /^\d+\.png$/.test(name)).sort((a, b) => parseInt(a) - parseInt(b));
  const pending = new Set(fs.existsSync(provenanceFile)
    ? JSON.parse(fs.readFileSync(provenanceFile, 'utf8')).filter(row => row.status !== 'imported').map(row => row.id)
    : []);
  const approved = ids.filter(name => !pending.has(parseInt(name)));
  const records = [];
  for (const variant of ['portrait', 'map']) fs.mkdirSync(path.join(root, variant), { recursive: true });
  for (const name of approved) {
    const { data, info } = await sharp(path.join(root, name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const centered = centerImage(data, info.width, info.height);
    records.push({ id: parseInt(name), sourceSize: [info.width, info.height], bounds: centered.bounds, translation: centered.translation });
    for (const [variant, size] of [['portrait', 512], ['map', 256]]) {
      const image = await sharp(centered.data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .resize(size, size, { fit: 'contain', background: '#00000000' })
        .webp({ quality: 90, alphaQuality: 100, effort: 5 }).toBuffer();
      writeAsset(path.join(root, variant, name.replace('.png', '.webp')), image);
    }
  }
  fs.writeFileSync(path.join(__dirname, '../docs/art/demon-placement.json'), JSON.stringify({
    alignment: 'visible-bounds-center',
    targetCenter: [0.5, 0.5],
    method: 'Center the complete visible silhouette on both axes with integer canvas translation before downsampling. Do not bottom-align small evolutions. Master drawings and relative scale unchanged. Bounds include detached features and ignore components smaller than 16 alpha pixels; a 2px edge margin preserves antialiasing.',
    records
  }, null, 2) + '\n');
  console.log(`Demon variants: ${approved.length} approved masters, ${approved.length * 2} transparent WebPs; ${pending.size} pending masters retained.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
