// One-time, explicitly approved pixel repair of the saved Vi'Zel cutouts.
// No generation or global color adjustment. Each tiny patch reconstructs the
// black pupil/red iris edge beneath a white catchlight; alpha is untouched.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const writeAsset = require('./write-asset');

const patches = [
  { id: 25, x: 891, y: 550, width: 16, height: 13, edge: [900.8, 902.7, 902.1], pupil: [888, 565], irisX: 909 },
  { id: 26, x: 879, y: 598, width: 11, height: 12, edge: [887.2, 888.1, 887.5], pupil: [876, 610], irisX: 894 },
  { id: 27, x: 883, y: 635, width: 12, height: 13, edge: [890.4, 891.4, 890.2], pupil: [879, 647], irisX: 897 }
];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const approvedCutoutHashes = {
  25: 'bb2a41a4e5c85d413cfff4d4529bc58f846e4b1109517655ce8ad5e152c47319',
  26: 'bfed96c65c9999b5e8ae3f17868c881c5228241910efc260c422ec705f251ce3',
  27: '6b4033ae574caa9ae58a110a60280b8b1f23cb54f0cd7ffc31fb6485344acb46'
};

async function repair(sourceDirectory, outputDirectory) {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const report = [];
  for (const patch of patches) {
    const original = fs.readFileSync(path.join(sourceDirectory, `${patch.id}.png`));
    if (hash(original) !== approvedCutoutHashes[patch.id]) throw new Error(`Vi'Zel ${patch.id}: refusing to patch a different source image`);
    const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 1254 || info.height !== 1254) throw new Error('Expected the approved 1254px cutouts');
    const source = Buffer.from(data);
    const pupilIndex = (patch.pupil[1] * info.width + patch.pupil[0]) * 4;
    const pupil = Array.from(source.subarray(pupilIndex, pupilIndex + 3));
    let changedPixels = 0;
    for (let y = patch.y; y < patch.y + patch.height; y++) {
      const t = (y - patch.y) / (patch.height - 1);
      const edge = (1 - t) ** 2 * patch.edge[0] + 2 * t * (1 - t) * patch.edge[1] + t ** 2 * patch.edge[2];
      const irisIndex = (y * info.width + patch.irisX) * 4;
      for (let x = patch.x; x < patch.x + patch.width; x++) {
        const i = (y * info.width + x) * 4;
        const irisWeight = Math.max(0, Math.min(1, x - edge + 0.5));
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(pupil[c] * (1 - irisWeight) + source[irisIndex + c] * irisWeight);
        if (data[i] !== source[i] || data[i + 1] !== source[i + 1] || data[i + 2] !== source[i + 2]) changedPixels++;
      }
    }
    const output = await sharp(data, { raw: info }).png().toBuffer();
    writeAsset(path.join(outputDirectory, `${patch.id}.png`), output);
    report.push({ ...patch, pupilRgb: pupil, changedPixels, alphaUnchanged: true, pixelsOutsidePatchUnchanged: true, inputSha256: hash(original), outputSha256: hash(output) });
  }
  return report;
}

if (require.main === module) {
  const [, , source, output] = process.argv;
  if (!source || !output) throw new Error('Usage: node scripts/touch-up-vizel-eyes.js <approved-cutouts> <output-directory>');
  repair(source, output).then(report => {
    writeAsset(path.join(output, 'vizel-eye-repairs.json'), Buffer.from(JSON.stringify(report, null, 2) + '\n'));
    console.log(JSON.stringify(report, null, 2));
  }).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { repair, patches };
