const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const sharp = require('sharp');
const { findContentBounds } = require('./demon-placement');
const root = path.join(__dirname, '..');
const imageRoot = path.join(root, 'public/app/images');
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

async function inspect(relative, size, alpha) {
  const file = path.join(imageRoot, relative);
  const metadata = await sharp(file).metadata();
  if (size) { assert.equal(metadata.width, size[0], relative); assert.equal(metadata.height, size[1], relative); }
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let zero = 0, opaque = 0;
  for (let p = 3; p < data.length; p += 4) { if (data[p] === 0) zero++; if (data[p] === 255) opaque++; }
  if (alpha) {
    assert.ok(metadata.hasAlpha && zero > info.width * info.height * 0.1, `${relative}: actual transparency required`);
    assert.ok(opaque > info.width * info.height * 0.03, `${relative}: character is missing`);
    assert.equal(data[3], 0, `${relative}: top-left matte remains`);
    assert.equal(data[data.length - 1], 0, `${relative}: bottom-right matte remains`);
  }
  let contentBounds;
  if (/^demons\/(portrait|map)\/\d+\.webp$/.test(relative) && alpha) {
    contentBounds = findContentBounds(data, info.width, info.height, { minComponentPixels: 1 });
    assert.ok(Math.abs((contentBounds.top + contentBounds.bottom + 1) / 2 - info.height / 2) <= 2, `${relative}: silhouette is vertically off-center`);
    assert.ok(Math.abs((contentBounds.left + contentBounds.right + 1) / 2 - info.width / 2) <= 2, `${relative}: silhouette is off-center`);
    assert.ok(contentBounds.top > 0 && contentBounds.bottom < info.height - 1 && contentBounds.left > 0 && contentBounds.right < info.width - 1, `${relative}: silhouette touches canvas edge`);
  }
  return { file: relative, width: metadata.width, height: metadata.height, alpha: metadata.hasAlpha, transparentPixels: zero, contentBounds, bytes: fs.statSync(file).size, sha256: hash(file) };
}

async function main() {
  const provenance = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/demon-provenance.json'), 'utf8'));
  const extraction = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/demon-extraction-report.json'), 'utf8'));
  const pending = provenance.filter(row => row.status !== 'imported').map(row => row.id);
  const files = [];
  for (let id = 1; id <= 66; id++) {
    const ready = !pending.includes(id);
    const master = await inspect(`demons/${id}.png`, ready ? [1254, 1254] : null, ready);
    if (ready) assert.equal(master.sha256, extraction.find(row => row.id === id)?.outputSha256, `demon ${id}: differs from the approved extraction or recorded pixel repair`);
    files.push(master);
    files.push(await inspect(`demons/portrait/${id}.webp`, [512, 512], ready));
    files.push(await inspect(`demons/map/${id}.webp`, [256, 256], ready));
  }
  const atlasModule = fs.readFileSync(path.join(root, 'public/app/js/generated/demon-map-atlas.js'), 'utf8');
  const atlasValue = name => JSON.parse(atlasModule.match(new RegExp(`export const ${name} = ([^;]+);`))[1]);
  const atlasIds = atlasValue('DEMON_MAP_ATLAS_IDS');
  const atlasBackdropIds = atlasValue('DEMON_MAP_BACKDROP_IDS');
  const atlasSize = atlasValue('DEMON_MAP_ATLAS_FRAME_SIZE');
  const atlasColumns = atlasValue('DEMON_MAP_ATLAS_COLUMNS');
  const atlasRows = Math.ceil((atlasIds.length + atlasBackdropIds.length) / atlasColumns);
  files.push(await inspect('demons/map-atlas.webp', [atlasColumns * atlasSize, atlasRows * atlasSize], true));
  assert.ok(atlasModule.includes(hash(path.join(imageRoot, 'demons/map-atlas.webp')).slice(0, 12)), 'stale atlas stamp');
  for (const name of ['bag', 'campfire', 'collection', 'dungeon', 'home', 'home_logo', 'rankings', 'summon']) {
    const size = name === 'dungeon' ? [1717, 916] : [1672, 941];
    for (const ext of ['png', 'webp', 'avif']) files.push(await inspect(`assets/background/amongdemons_${name}.${ext}`, size, false));
  }
  for (const ext of ['png', 'webp', 'avif']) {
    const backdrop = await inspect(`assets/background/demon-card.${ext}`, [1254, 1254], false);
    assert.equal(backdrop.transparentPixels, 0, 'The shared card scenery must be opaque');
    files.push(backdrop);
  }
  const backdrops = JSON.parse(fs.readFileSync(path.join(root, 'docs/art/card-backdrops.json'), 'utf8'));
  assert.deepEqual(atlasBackdropIds, backdrops.variants.map(row => row.typeId).sort((a, b) => a - b));
  const atlasBackdropTypes = atlasValue('DEMON_MAP_BACKDROP_TYPES');
  assert.equal(backdrops.variants.length, 11, 'All demon types need a backdrop');
  assert.equal(new Set(backdrops.variants.flatMap(row => row.demonIds)).size, 66, 'Backdrop coverage must include all 66 demons');
  const backdropHashes = new Set();
  for (const variant of backdrops.variants) {
    for (const id of variant.demonIds) assert.equal(atlasBackdropTypes[id], variant.typeId, `Map backdrop mismatch for demon ${id}`);
    const frameIndex = atlasIds.length + atlasBackdropIds.indexOf(variant.typeId);
    const frame = sharp(path.join(imageRoot, 'demons/map-atlas.webp')).extract({
      left: (frameIndex % atlasColumns) * atlasSize,
      top: Math.floor(frameIndex / atlasColumns) * atlasSize,
      width: atlasSize, height: atlasSize
    });
    // stats() inspects its input, so materialize the extracted/resized image.
    const frameStats = await sharp(await frame.toBuffer()).stats();
    const sourceStats = await sharp(await sharp(path.join(imageRoot, variant.files.png)).resize(atlasSize, atlasSize).toBuffer()).stats();
    assert.equal(frameStats.isOpaque, true, `Type ${variant.typeId}: map backdrop must be opaque`);
    for (let channel = 0; channel < 3; channel++) {
      assert.ok(Math.abs(frameStats.channels[channel].mean - sourceStats.channels[channel].mean) < 5, `Type ${variant.typeId}: atlas backdrop palette differs from source`);
    }
    for (const ext of ['png', 'webp', 'avif']) {
      const backdrop = await inspect(variant.files[ext], [1254, 1254], false);
      assert.equal(backdrop.transparentPixels, 0, 'Type backdrop must be opaque');
      assert.equal(backdrop.sha256, variant.sha256[ext], `Type ${variant.typeId}: approved ${ext} backdrop changed`);
      if (ext === 'png') backdropHashes.add(backdrop.sha256);
      files.push(backdrop);
    }
  }
  assert.equal(backdropHashes.size, 11, 'Assigned type backdrops must remain distinct');
  for (const [asset, size, alpha] of [['assets/world/crowley', 512, false], ['assets/world/soul-font', 768, false], ['demons/anomaly', 1024, true]]) {
    files.push(await inspect(`${asset}.png`, null, alpha));
    files.push(await inspect(`${asset}.webp`, [size, size], alpha));
  }
  const report = { allRequestedDemonSourcesImported: pending.length === 0, importedDemons: 66 - pending.length, pendingManualSourceIds: pending, filesChecked: files.length, files };
  fs.writeFileSync(path.join(root, 'docs/art/asset-verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`${files.length} image files decoded; ${66 - pending.length}/66 approved demon masters imported. Pending manual sources: ${pending.join(', ') || 'none'}.`);
  if (pending.length && !process.argv.includes('--allow-pending')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
