// Rebuild deployable variants from the transparent full-size PNG masters.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const writeAsset = require('./write-asset');
const root = path.join(__dirname, '..', 'public', 'app', 'images', 'demons');
const provenanceFile = path.join(__dirname, '..', 'docs/art/demon-provenance.json');

async function main() {
  const ids = fs.readdirSync(root).filter(name => /^\d+\.png$/.test(name)).sort((a, b) => parseInt(a) - parseInt(b));
  const pending = new Set(fs.existsSync(provenanceFile)
    ? JSON.parse(fs.readFileSync(provenanceFile, 'utf8')).filter(row => row.status !== 'imported').map(row => row.id)
    : []);
  const approved = ids.filter(name => !pending.has(parseInt(name)));
  for (const [variant, size] of [['portrait', 512], ['map', 256]]) {
    fs.mkdirSync(path.join(root, variant), { recursive: true });
    for (const name of approved) {
      const image = await sharp(path.join(root, name)).resize(size, size, { fit: 'contain', background: '#00000000' })
        .webp({ quality: 90, alphaQuality: 100, effort: 5 }).toBuffer();
      writeAsset(path.join(root, variant, name.replace('.png', '.webp')), image);
    }
  }
  console.log(`Demon variants: ${approved.length} approved masters, ${approved.length * 2} transparent WebPs; ${pending.size} pending masters retained.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
