// Bind approved type palettes to the actual sprite, including static guides and
// portraits whose image changes after rendering. Never infer type from rarity.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const writeAsset = require('./write-asset');

const ROOT = path.join(__dirname, '..');
const START = '/* BEGIN GENERATED DEMON TYPE BACKDROPS */';
const END = '/* END GENERATED DEMON TYPE BACKDROPS */';
const FRAMES = [
  '.dungeon-demon-card-image', '.demon-detail-art', '.seo-demon-card-art',
  '.seo-demon-detail-art', '.seo-boss-detail-art', '.seo-boss-summary-art',
  '.profile-demon-option-art', '.world-boss-dialog-portrait-frame'
];

function spriteSelectors(ids) {
  return ids.flatMap(id => ['', 'portrait/', 'map/', 'thumbnails/'].map(
    variant => `img[src*="/demons/${variant}${id}."]`
  ));
}

function getBackdropSource(variants, variant) {
  const sourceTypeId = variant.backgroundTypeId ?? variant.typeId;
  assert(Number.isInteger(sourceTypeId), `Invalid backdrop source type ${sourceTypeId} for type ${variant.typeId}`);
  const source = variants.find(candidate => candidate.typeId === sourceTypeId);
  assert(source, `Unknown backdrop source type ${sourceTypeId} for type ${variant.typeId}`);
  return source;
}

function renderBackdropCss(variants, version) {
  const coveredIds = new Set();
  const types = new Set();
  const definitions = [], rules = [];
  assert.equal(new Set(variants.map(variant => variant.typeId)).size, 11, 'Every type needs a backdrop');
  for (const variant of variants) {
    assert(Number.isInteger(variant.typeId) && variant.typeId >= 1 && variant.typeId <= 11);
    assert(!types.has(variant.typeId), 'Duplicate backdrop type');
    types.add(variant.typeId);
    for (const id of variant.demonIds) {
      assert(Number.isInteger(id) && id >= 1 && id <= 66 && !coveredIds.has(id), 'Invalid/duplicate sprite ID');
      coveredIds.add(id);
    }
    const source = getBackdropSource(variants, variant);
    const variable = `--demon-backdrop-type-${variant.typeId}`;
    if (source.typeId === variant.typeId) {
      const images = ['avif', 'webp', 'png'].map(format => {
        const file = source.files[format];
        assert(/^assets\/background\/demon-card-type-\d+\.(?:png|webp|avif)$/.test(file));
        return `url("/app/images/${file}?v=${version}") type("image/${format}")`;
      });
      definitions.push(`    ${variable}: image-set(${images.join(', ')});`);
    } else {
      definitions.push(`    ${variable}: var(--demon-backdrop-type-${source.typeId});`);
    }
    const selectors = spriteSelectors(variant.demonIds).join(', ');
    const sourceLabel = source.typeId === variant.typeId
      ? `${variant.name}`
      : `${source.name} (type ${source.typeId})`;
    rules.push([
      `/* ${variant.species}: ${sourceLabel}; shared by all six evolutions. */`,
      `:is(${selectors}),`,
      `:where(${FRAMES.join(', ')}):has(> :is(${selectors})) {`,
      `    --demon-card-backdrop: var(${variable});`,
      '}'
    ].join('\n'));
  }
  assert.equal(types.size, 11, 'Every type needs a backdrop');
  assert.equal(coveredIds.size, 66, 'Every approved sprite needs a backdrop');
  return [START, ':root {', ...definitions, '}', '', ...rules, END].join('\n');
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/art/card-backdrops.json'), 'utf8'));
  const { version } = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/art/asset-version.json'), 'utf8'));
  const file = path.join(ROOT, 'public/app/css/base.css');
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf(START), end = source.indexOf(END);
  assert((start < 0 && end < 0) || (start >= 0 && end > start), 'Broken backdrop markers');
  const generated = renderBackdropCss(manifest.variants, version);
  const next = start < 0
    ? source.trimEnd() + '\n\n' + generated + '\n'
    : source.slice(0, start) + generated + source.slice(end + END.length);
  writeAsset(file, Buffer.from(next));
  console.log('Card backdrops: 11 type palettes, all 66 sprites, PNG/WebP/AVIF sources.');
}

if (require.main === module) main();
module.exports = { getBackdropSource, renderBackdropCss, spriteSelectors };
