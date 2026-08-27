// Approved one-time pixel edit: connect common Tor Tza's left-on-screen
// pupil to its upper eyelid. No generation; all other pixels/alpha stay intact.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const writeAsset = require('./write-asset');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const approvedSource = '3c7dcecee26ec38206edb38186d44a4a0690387020f6b1c3162e4ba52c598757';
const patch = { x: 546, y: 504, width: 30, height: 38 };
const polygon = '549,506 574,523 573,539 547.5,525';

async function repair(sourcePath, outputPath) {
  const original = fs.readFileSync(sourcePath);
  assert.equal(hash(original), approvedSource, 'Refusing to patch a different Tor Tza source');
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const source = Buffer.from(data);
  const mask = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="152" viewBox="546 504 30 38"><polygon points="${polygon}" fill="white"/></svg>`))
    .resize(patch.width, patch.height).ensureAlpha().raw().toBuffer();
  const sampleIndex = (548 * info.width + 558) * 4;
  const pupilRgb = Array.from(source.subarray(sampleIndex, sampleIndex + 3));
  let changedPixels = 0;
  for (let y = 0; y < patch.height; y++) for (let x = 0; x < patch.width; x++) {
    const i = ((y + patch.y) * info.width + x + patch.x) * 4;
    const coverage = mask[(y * patch.width + x) * 4 + 3] / 255;
    // Bridge the gap and its antialiased fringe with the sampled pupil ink.
    if (!coverage) continue;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(source[i + c] * (1 - coverage) + pupilRgb[c] * coverage);
  }
  for (let i = 0; i < data.length; i += 4) {
    assert.equal(data[i + 3], source[i + 3]);
    if (data[i] === source[i] && data[i + 1] === source[i + 1] && data[i + 2] === source[i + 2]) continue;
    const x = (i / 4) % info.width, y = Math.floor(i / 4 / info.width);
    assert.ok(x >= patch.x && x < patch.x + patch.width && y >= patch.y && y < patch.y + patch.height);
    changedPixels++;
  }
  const output = await sharp(data, { raw: info }).png().toBuffer();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  writeAsset(outputPath, output);
  return { id: 19, operation: 'Connect the pupil to its upper eyelid, viewer-left eye', patch, polygon, pupilRgb, changedPixels, alphaUnchanged: true, pixelsOutsidePatchUnchanged: true, inputSha256: hash(original), outputSha256: hash(output) };
}
if (require.main === module) {
  const [, , source, output] = process.argv;
  if (!source || !output) throw new Error('Usage: node scripts/touch-up-tor-tza-eye.js <approved-19.png> <output.png>');
  repair(source, output).then(report => console.log(JSON.stringify(report, null, 2))).catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { repair };
