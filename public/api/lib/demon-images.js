const DEMON_IMAGE_PATTERN = /^\/app\/images\/demons\/(?:(?:thumbnails|map|portrait)\/)?(\d+)\.(?:png|webp)(?:[?#].*)?$/i;
const VALID_VARIANTS = new Set(['map', 'portrait']);

function getDemonSourceId(demonOrUrl) {
  if (demonOrUrl && typeof demonOrUrl === 'object') {
    const explicit = Number(
      demonOrUrl.sourceDemonId
      ?? demonOrUrl.source_demon_id
      ?? demonOrUrl.assetId
    );
    if (Number.isInteger(explicit) && explicit > 0) return explicit;
    return getDemonSourceId(demonOrUrl.imageUrl || demonOrUrl.image_url || '');
  }

  const match = DEMON_IMAGE_PATTERN.exec(String(demonOrUrl || ''));
  return match ? Number(match[1]) : null;
}

function getDemonImageUrl(demonOrUrl, variant = 'portrait') {
  const fallback = typeof demonOrUrl === 'object'
    ? demonOrUrl?.imageUrl || demonOrUrl?.image_url || ''
    : String(demonOrUrl || '');
  const sourceId = getDemonSourceId(demonOrUrl);
  if (!sourceId || !VALID_VARIANTS.has(variant)) return fallback;
  return `/app/images/demons/${variant}/${sourceId}.webp?v=art-df103bc9b9a9`;
}

function withDemonImageVariants(demon = {}) {
  return {
    ...demon,
    portraitImageUrl: getDemonImageUrl(demon, 'portrait'),
    mapImageUrl: getDemonImageUrl(demon, 'map')
  };
}

module.exports = {
  getDemonImageUrl,
  getDemonSourceId,
  withDemonImageVariants
};
