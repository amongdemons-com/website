const fs = require('fs');
const path = require('path');
const db = require('../public/api/lib/db');
const { isValidUsername, normalizeUsername } = require('../public/api/lib/usernames');

const HUNTER_HTML_PATH = path.join(__dirname, '..', 'public', 'app', 'hunter.html');
const META_START = '<!--HUNTER_META_START-->';
const META_END = '<!--HUNTER_META_END-->';
const CANONICAL_ORIGIN = 'https://amongdemons.com';
const DEFAULT_IMAGE = `${CANONICAL_ORIGIN}/app/images/amongdemons_logo_white_text_bottom_1000x1000.png`;
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let cachedTemplate = null;

function loadTemplate() {
  if (IS_PRODUCTION && cachedTemplate) return cachedTemplate;
  cachedTemplate = fs.readFileSync(HUNTER_HTML_PATH, 'utf8');
  return cachedTemplate;
}

// Crawlers (Discord, Twitter/X, Facebook) do not run the client JS that updates
// the document head, so per-hunter OpenGraph/Twitter tags must be baked in
// server-side. On any miss (unknown hunter, DB hiccup) we serve the untouched
// template, whose default meta between the sentinels stays valid.
async function renderHunterPage(rawUsername) {
  const template = loadTemplate();

  try {
    const summary = await getHunterSummary(rawUsername);
    if (!summary) return template;
    return injectMeta(template, buildHunterMeta(summary));
  } catch (error) {
    console.error('Failed to render hunter profile meta:', error);
    return template;
  }
}

async function getHunterSummary(rawUsername) {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) return null;

  const [rows] = await db.query(
    `SELECT p.id,
            p.username,
            p.level,
            p.highest_floor AS highestFloor,
            p.pvp_wins AS pvpWins,
            pd.image_url AS profileDemonImageUrl
     FROM players p
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     WHERE p.username = ?
     LIMIT 1`,
    [username]
  );

  if (!rows.length) return null;

  const row = rows[0];
  const rarest = await getRarestDemon(row.id);

  return {
    username: row.username,
    level: Math.max(1, Number(row.level) || 1),
    highestFloor: Math.max(0, Number(row.highestFloor) || 0),
    pvpWins: Math.max(0, Number(row.pvpWins) || 0),
    profileDemonImageUrl: row.profileDemonImageUrl || null,
    rarest
  };
}

async function getRarestDemon(playerId) {
  const [rows] = await db.query(
    `SELECT species, rarity, image_url AS imageUrl
     FROM player_demons
     WHERE player_id = ?
     ORDER BY FIELD(rarity, 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic') DESC, id ASC
     LIMIT 1`,
    [playerId]
  );

  return rows.length ? rows[0] : null;
}

function buildHunterMeta(summary) {
  const title = `${summary.username}'s Hunter Profile - Among Demons`;
  const description = buildDescription(summary);
  const canonical = `${CANONICAL_ORIGIN}/hunter/${encodeURIComponent(summary.username)}`;
  const image = resolveImage(summary);

  return { title, description, canonical, image };
}

function buildDescription(summary) {
  const parts = [`Level ${summary.level.toLocaleString()} hunter`];

  if (summary.highestFloor > 0) {
    parts.push(`Floor ${summary.highestFloor.toLocaleString()} cleared`);
  }

  if (summary.rarest && summary.rarest.species) {
    const rarity = capitalize(summary.rarest.rarity);
    parts.push(`rarest demon: ${summary.rarest.species}${rarity ? ` (${rarity})` : ''}`);
  }

  if (summary.pvpWins > 0) {
    parts.push(`${summary.pvpWins.toLocaleString()} PvP win${summary.pvpWins === 1 ? '' : 's'}`);
  }

  return `${parts.join(' · ')}. See this hunter's demon team on Among Demons.`;
}

function resolveImage(summary) {
  const relative = summary.profileDemonImageUrl
    || (summary.rarest && summary.rarest.imageUrl)
    || '';

  if (!relative) return DEFAULT_IMAGE;
  if (/^https?:\/\//i.test(relative)) return relative;
  return `${CANONICAL_ORIGIN}${relative.startsWith('/') ? '' : '/'}${relative}`;
}

function injectMeta(template, meta) {
  const startIndex = template.indexOf(META_START);
  const endIndex = template.indexOf(META_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return template;

  const usingDefaultImage = meta.image === DEFAULT_IMAGE;
  const imageDimensions = usingDefaultImage
    ? `
    <meta property="og:image:width" content="1000">
    <meta property="og:image:height" content="1000">`
    : '';
  const imageAlt = usingDefaultImage
    ? 'Among Demons logo'
    : `${stripPossessive(meta.title)} artwork`;

  const head = `${META_START}
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeAttribute(meta.description)}">
    <link rel="canonical" href="${escapeAttribute(meta.canonical)}">
    <meta property="og:site_name" content="Among Demons">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="${escapeAttribute(meta.title)}">
    <meta property="og:description" content="${escapeAttribute(meta.description)}">
    <meta property="og:url" content="${escapeAttribute(meta.canonical)}">
    <meta property="og:image" content="${escapeAttribute(meta.image)}">${imageDimensions}
    <meta property="og:image:alt" content="${escapeAttribute(imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttribute(meta.title)}">
    <meta name="twitter:description" content="${escapeAttribute(meta.description)}">
    <meta name="twitter:image" content="${escapeAttribute(meta.image)}">
    <meta name="twitter:image:alt" content="${escapeAttribute(imageAlt)}">
    ${META_END}`;

  return template.slice(0, startIndex) + head + template.slice(endIndex + META_END.length);
}

function stripPossessive(title) {
  return title.replace(/'s Hunter Profile.*$/i, '');
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

module.exports = { renderHunterPage };
