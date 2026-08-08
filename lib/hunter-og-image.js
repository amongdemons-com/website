const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');
const { getPublicHunterProfile } = require('../public/api/lib/hunter-profile');
const { normalizeUsername } = require('../public/api/lib/usernames');

const WIDTH = 1200;
const HEIGHT = 630;
const DEMON_CARD_CENTER_X = 933;
const STAT_FRAME_TOP = 340;
const STAT_TEXT_TOP = 348;
const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const FALLBACK_PORTRAIT_PATH = path.join(PUBLIC_DIR, 'app', 'images', 'amongdemons_logo_250x250.png');
const BODY_FONT_PATH = path.join(PUBLIC_DIR, 'app', 'fonts', 'Lora.ttf');
const DISPLAY_FONT_PATH = path.join(PUBLIC_DIR, 'app', 'fonts', 'Cinzel.ttf');
const BODY_FONT_FAMILY = 'Lora';
const DISPLAY_FONT_FAMILY = 'Cinzel';
const OG_FONT_PATH = BODY_FONT_PATH;
const OG_FONT_FAMILY = 'AmongDemonsOg';
const RARITY_COLORS = {
  common: '#b9c7c3',
  uncommon: '#8ee49f',
  rare: '#72b7ff',
  epic: '#bf8cff',
  legendary: '#f4c95f',
  mythic: '#ff6a4a'
};
const RANK_DIVISION_COLORS = Object.freeze({
  'iron-iii': '#66727a',
  'iron-ii': '#82919a',
  'iron-i': '#a4b0b7',
  'bronze-iii': '#bd7048',
  'bronze-ii': '#d18452',
  'bronze-i': '#e69b62',
  'silver-iii': '#9eafbd',
  'silver-ii': '#bdcad4',
  'silver-i': '#e0eaf1',
  'gold-iii': '#d79a20',
  'gold-ii': '#efb934',
  'gold-i': '#ffd866',
  'platinum-iii': '#4fb98e',
  'platinum-ii': '#62d0a4',
  'platinum-i': '#91f0c7',
  'diamond-iii': '#5aa7ed',
  'diamond-ii': '#76c5ff',
  'diamond-i': '#a9e5ff',
  demonic: '#e58aff',
  unranked: '#98a3ad'
});
let fontCssPromise;

async function renderHunterOgImage(rawUsername) {
  const profile = await getPublicHunterProfile(rawUsername);
  const png = await renderHunterOgPng(profile, rawUsername);
  return { png, found: Boolean(profile) };
}

async function renderHunterOgFallbackImage(rawUsername) {
  return renderHunterOgPng(null, rawUsername);
}

async function renderHunterOgPng(profile, rawUsername) {
  const view = await createHunterOgView(profile, rawUsername);
  const svg = renderHunterOgSvgFromView(view, { includeText: false });
  const overlays = await createTextOverlays(view);
  return sharp(Buffer.from(svg))
    .composite(overlays)
    .png()
    .toBuffer();
}

async function renderHunterOgSvg(profile, rawUsername) {
  const view = await createHunterOgView(profile, rawUsername);
  return renderHunterOgSvgFromView(view, { includeText: true });
}

async function createHunterOgView(profile, rawUsername) {
  const fontCss = await getEmbeddedFontCss();
  const hunter = profile?.hunter || {};
  const username = hunter.username || normalizeUsername(rawUsername) || 'Hunter';
  const found = Boolean(profile);
  const rankDivision = found ? String(profile?.ranked?.division || '').trim() : '';
  const mainDemon = getMainDemon(profile);
  const portraitDataUri = await createImageDataUri(mainDemon?.imageUrl || hunter.profileDemonImageUrl);
  const subtitle = found
    ? [
        rankDivision,
        `Level ${formatNumber(hunter.level)}`,
        `${formatNumber(hunter.pvpWins)}-${formatNumber(hunter.pvpLosses)}`
      ].filter(Boolean).join(' · ')
    : 'A public hunter profile was not found.';
  const displayUsername = truncateText(username, 32);
  const usernameFontSize = getUsernameFontSize(displayUsername);
  const demonRarity = mainDemon ? capitalize(mainDemon.rarity) : '';
  const demonSpecies = mainDemon ? truncateText(mainDemon.species || 'Demon', 22) : 'Among Demons';
  const demonColor = RARITY_COLORS[String(mainDemon?.rarity || '').toLowerCase()] || '#f4c95f';
  const stats = found
    ? [
        { label: 'Top Floor', value: formatNumber(hunter.highestFloor) },
        { label: 'Coordinates', value: formatCoordinates(profile.coordinates) },
        { label: 'World Team', value: formatNumber(profile.worldTeam?.length || 0) },
        { label: 'Souls', value: formatNumber(hunter.souls) }
      ]
    : [
        { label: 'Top Floor', value: '-' },
        { label: 'Coordinates', value: '-' },
        { label: 'World Team', value: '-' },
        { label: 'Souls', value: '-' }
      ];

  return {
    demonColor,
    demonRarity,
    demonSpecies,
    displayUsername,
    fontCss,
    found,
    portraitDataUri,
    rankColor: getRankDivisionColor(rankDivision),
    rankDivision,
    stats,
    subtitle,
    usernameFontSize
  };
}

function renderHunterOgSvgFromView(view, options = {}) {
  const includeText = options.includeText !== false;
  const {
    demonColor,
    demonRarity,
    demonSpecies,
    displayUsername,
    fontCss,
    found,
    portraitDataUri,
    stats,
    subtitle,
    usernameFontSize
  } = view;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <style><![CDATA[
      ${fontCss}
      text { font-family: '${OG_FONT_FAMILY}'; }
    ]]></style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#071013"/>
      <stop offset="0.44" stop-color="#121014"/>
      <stop offset="1" stop-color="#2a0d0c"/>
    </linearGradient>
    <radialGradient id="ember" cx="78%" cy="18%" r="58%">
      <stop offset="0" stop-color="#c83b24" stop-opacity="0.72"/>
      <stop offset="0.42" stop-color="#6b1613" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#05090c" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="goldGlow" cx="30%" cy="72%" r="52%">
      <stop offset="0" stop-color="#f4c95f" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#05090c" stop-opacity="0"/>
    </radialGradient>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="portraitClip">
      <rect x="754" y="102" width="358" height="358" rx="26" ry="26"/>
    </clipPath>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#ember)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#goldGlow)"/>
  <g opacity="0.16">
    <path d="M0 112 H1200 M0 226 H1200 M0 340 H1200 M0 454 H1200 M0 568 H1200" stroke="#e8c76a" stroke-width="1"/>
    <path d="M118 0 V630 M252 0 V630 M386 0 V630 M520 0 V630 M654 0 V630 M788 0 V630 M922 0 V630 M1056 0 V630" stroke="#a1d4c9" stroke-width="1"/>
  </g>
  <path d="M44 52 H664 L708 92 V578 H44 Z" fill="#071013" fill-opacity="0.78" stroke="#a1d4c9" stroke-opacity="0.20" stroke-width="2"/>
  <path d="M392 72 H642 L684 108" fill="none" stroke="#e8c76a" stroke-opacity="0.42" stroke-width="2"/>
  <path d="M61 578 H708 L668 542" fill="none" stroke="#b23424" stroke-opacity="0.52" stroke-width="3"/>

  ${includeText ? `
  <g transform="translate(72 92)">
    <text x="0" y="0" fill="#e8c76a" font-size="25" font-weight="900" letter-spacing="5">AMONG DEMONS</text>
    <text x="0" y="104" fill="#fff8dc" font-size="${usernameFontSize}" font-weight="900"${getTextFitAttributes(displayUsername, 618)}>${escapeXml(displayUsername)}</text>
    <text x="2" y="160" fill="#edf5f2" fill-opacity="0.78" font-size="27" font-weight="800">${renderSubtitleSvg(view)}</text>
  </g>
  ` : ''}
  ${stats.map((stat, index) => (includeText ? renderStatCard(stat, index) : renderStatCardFrame(index))).join('\n  ')}

  <g filter="url(#softGlow)">
    <path d="M858 54 C906 20 978 18 1030 56 C1054 74 1068 98 1076 126 C1048 104 1018 92 984 91 C1010 113 1028 140 1035 172 C996 148 956 138 914 142 C878 146 844 160 812 184 C818 130 832 86 858 54 Z" fill="#6e1712" fill-opacity="0.58"/>
  </g>
  <rect x="734" y="82" width="398" height="472" rx="34" fill="#06090b" fill-opacity="0.82" stroke="#e8c76a" stroke-opacity="0.38" stroke-width="2"/>
  <rect x="754" y="102" width="358" height="358" rx="26" fill="#11191b" stroke="${demonColor}" stroke-opacity="0.58" stroke-width="3"/>
  <image href="${portraitDataUri}" x="754" y="102" width="358" height="358" preserveAspectRatio="xMidYMid slice" clip-path="url(#portraitClip)"/>
  <rect x="754" y="102" width="358" height="358" rx="26" fill="none" stroke="#000000" stroke-opacity="0.42" stroke-width="8"/>
  ${includeText ? `
  <text x="933" y="510" text-anchor="middle" fill="#fff8dc" font-size="34" font-weight="900">
    ${demonRarity ? `<tspan fill="${demonColor}">${escapeXml(demonRarity)}</tspan><tspan dx="8">${escapeXml(demonSpecies)}</tspan>` : `<tspan>${escapeXml(demonSpecies)}</tspan>`}
  </text>

  <g transform="translate(72 560)">
    <text x="0" y="0" fill="#edf5f2" fill-opacity="0.82" font-size="24" font-weight="800">amongdemons.com</text>
  </g>
  ` : ''}
</svg>`;
}

function renderStatCard(stat, index) {
  const x = 72 + (index % 2) * 306;
  const y = 348 + Math.floor(index / 2) * 100;
  return `<g transform="translate(${x} ${y})">
    <rect width="278" height="78" rx="12" fill="#020506" fill-opacity="0.58" stroke="#a1d4c9" stroke-opacity="0.18"/>
    <text x="20" y="34" fill="#f4d675" font-size="30" font-weight="900">${escapeXml(truncateText(stat.value, 15))}</text>
    <text x="20" y="59" fill="#edf5f2" fill-opacity="0.58" font-size="15" font-weight="900" letter-spacing="2">${escapeXml(stat.label.toUpperCase())}</text>
  </g>`;
}

function renderStatCardFrame(index) {
  const x = 72 + (index % 2) * 306;
  const y = STAT_FRAME_TOP + Math.floor(index / 2) * 100;
  return `<rect x="${x}" y="${y}" width="278" height="78" rx="12" fill="#020506" fill-opacity="0.58" stroke="#a1d4c9" stroke-opacity="0.18"/>`;
}

async function createTextOverlays(view) {
  const overlays = [
    textOverlay(spacedBrandText('AMONG DEMONS'), 72, 68, {
      color: '#e8c76a',
      fontFamily: DISPLAY_FONT_FAMILY,
      fontfile: DISPLAY_FONT_PATH,
      size: 25,
      weight: '900'
    }),
    textOverlay(view.displayUsername, 72, 125, {
      color: '#fff8dc',
      size: view.usernameFontSize,
      weight: '900',
      width: 618
    }),
    textOverlay(renderSubtitleMarkup(view), 74, 233, {
      markup: true,
      size: 27,
      weight: '800'
    }),
    textOverlay('amongdemons.com', 72, 541, {
      color: '#c2cbc9',
      size: 24,
      weight: '800'
    }),
    await centeredTextOverlay(renderDemonNameMarkup(view), DEMON_CARD_CENTER_X, 483, {
      markup: true,
      size: getDemonNameFontSize(view),
      weight: '900'
    })
  ];

  view.stats.forEach((stat, index) => {
    const x = 72 + (index % 2) * 306;
    const y = STAT_TEXT_TOP + Math.floor(index / 2) * 100;
    overlays.push(
      textOverlay(truncateText(stat.value, 15), x + 20, y + 8, {
        color: '#f4d675',
        size: 30,
        weight: '900'
      }),
      textOverlay(spacedBrandText(stat.label.toUpperCase()), x + 20, y + 48, {
        color: '#9ca6a4',
        fontFamily: DISPLAY_FONT_FAMILY,
        fontfile: DISPLAY_FONT_PATH,
        size: 15,
        weight: '900'
      })
    );
  });

  return overlays;
}

async function centeredTextOverlay(text, centerX, top, options = {}) {
  const input = await renderTextInput(text, options);
  const metadata = await sharp(input).metadata();

  return {
    input,
    left: Math.round((Number(centerX) || 0) - (Number(metadata.width) || 0) / 2),
    top: Math.round(Number(top) || 0)
  };
}

function textOverlay(text, left, top, options = {}) {
  return {
    input: {
      text: createSharpTextOptions(text, options)
    },
    left: Math.round(Number(left) || 0),
    top: Math.round(Number(top) || 0)
  };
}

async function renderTextInput(text, options = {}) {
  return sharp({
    text: createSharpTextOptions(text, options)
  }).png().toBuffer();
}

function createSharpTextOptions(text, options = {}) {
  const size = Math.max(1, Number(options.size) || 24);
  const inputText = options.markup
    ? text
    : renderTextMarkup(text, {
        color: options.color || '#ffffff',
        weight: options.weight || '400'
      });
  const textOptions = {
    text: inputText,
    font: `${options.fontFamily || BODY_FONT_FAMILY} ${size}`,
    fontfile: options.fontfile || BODY_FONT_PATH,
    rgba: true,
    align: options.align || 'left'
  };
  const width = Math.max(0, Number(options.width) || 0);
  if (width > 0) {
    textOptions.width = width;
  }

  return textOptions;
}

function renderDemonNameMarkup(view) {
  const species = escapePango(view.demonSpecies);
  if (!view.demonRarity) {
    return renderTextMarkup(view.demonSpecies, {
      color: '#fff8dc',
      weight: '900'
    });
  }

  return [
    `<span foreground="${view.demonColor}" weight="900">${escapePango(view.demonRarity)}</span>`,
    `<span foreground="#fff8dc" weight="900">&#160;${species}</span>`
  ].join('');
}

function renderSubtitleSvg(view) {
  if (!view.found || !view.rankDivision) return escapeXml(view.subtitle);

  const suffix = view.subtitle.slice(view.rankDivision.length);
  return [
    `<tspan fill="${view.rankColor}" fill-opacity="1">${escapeXml(view.rankDivision)}</tspan>`,
    `<tspan fill="#edf5f2" fill-opacity="0.78">${escapeXml(suffix)}</tspan>`
  ].join('');
}

function renderSubtitleMarkup(view) {
  if (!view.found || !view.rankDivision) {
    return renderTextMarkup(view.subtitle, {
      color: '#c2cbc9',
      weight: '800'
    });
  }

  const suffix = view.subtitle.slice(view.rankDivision.length);
  return [
    `<span foreground="${view.rankColor}" weight="800">${escapePango(view.rankDivision)}</span>`,
    `<span foreground="#c2cbc9" weight="800">${escapePango(suffix)}</span>`
  ].join('');
}

function renderTextMarkup(text, options = {}) {
  return `<span foreground="${options.color || '#ffffff'}" weight="${options.weight || '400'}">${escapePango(text)}</span>`;
}

function getDemonNameFontSize(view) {
  const length = Array.from(`${view.demonRarity || ''} ${view.demonSpecies || ''}`.trim()).length;
  if (length > 24) return 28;
  if (length > 19) return 31;
  return 34;
}

function spacedBrandText(text) {
  return String(text || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.split('').join(' '))
    .join('   ');
}

function getEmbeddedFontCss() {
  if (!fontCssPromise) {
    fontCssPromise = fs.readFile(OG_FONT_PATH)
      .then((font) => `@font-face { font-family: '${OG_FONT_FAMILY}'; src: url(data:font/ttf;base64,${font.toString('base64')}) format('truetype'); font-weight: 400 900; font-style: normal; }`)
      .catch((error) => {
        fontCssPromise = null;
        throw error;
      });
  }

  return fontCssPromise;
}

async function createImageDataUri(imageUrl) {
  const imagePath = await resolveLocalImagePath(imageUrl);
  const sourcePath = imagePath || FALLBACK_PORTRAIT_PATH;
  const png = await sharp(sourcePath)
    .resize(430, 430, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer();

  return `data:image/png;base64,${png.toString('base64')}`;
}

async function resolveLocalImagePath(imageUrl) {
  const resolved = resolvePublicPath(imageUrl);
  if (!resolved) return null;

  try {
    const stat = await fs.stat(resolved);
    return stat.isFile() ? resolved : null;
  } catch (error) {
    return null;
  }
}

function resolvePublicPath(imageUrl) {
  const value = String(imageUrl || '').trim();
  if (!value || /^(?:https?:)?\/\//i.test(value) || value.startsWith('data:')) return null;

  const pathname = decodeSafe(value.split(/[?#]/)[0]);
  if (!pathname) return null;

  let resolved;
  if (pathname.startsWith('/images/assets/')) {
    resolved = path.resolve(PUBLIC_DIR, 'app', pathname.slice(1));
  } else if (pathname.startsWith('/')) {
    resolved = path.resolve(PUBLIC_DIR, pathname.slice(1));
  } else {
    resolved = path.resolve(PUBLIC_DIR, pathname);
  }

  return isPathInside(resolved, PUBLIC_DIR) ? resolved : null;
}

function getMainDemon(profile) {
  const hunter = profile?.hunter || {};
  if (hunter.profileDemonImageUrl) {
    return {
      species: hunter.profileDemonSpecies || 'Demon',
      rarity: hunter.profileDemonRarity || 'common',
      imageUrl: hunter.profileDemonImageUrl
    };
  }

  const worldTeam = Array.isArray(profile?.worldTeam) ? profile.worldTeam : [];
  return worldTeam.find((demon) => demon && demon.imageUrl) || null;
}

function formatCoordinates(coordinates = {}) {
  const x = Number(coordinates.x) || 0;
  const y = Number(coordinates.y) || 0;
  return `Area ${formatSignedNumber(x)}, ${formatSignedNumber(y)}`;
}

function getRankDivisionColor(division) {
  const key = String(division || 'unranked')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return RANK_DIVISION_COLORS[key] || RANK_DIVISION_COLORS.unranked;
}

function getUsernameFontSize(username) {
  const length = Array.from(String(username || '')).length;
  if (length > 30) return 48;
  if (length > 23) return 58;
  if (length > 17) return 68;
  return 84;
}

function getTextFitAttributes(value, maxWidth) {
  const length = Array.from(String(value || '')).length;
  if (length <= 17) return '';
  return ` textLength="${maxWidth}" lengthAdjust="spacingAndGlyphs"`;
}

function truncateText(value, maxLength) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString('en-US');
}

function formatSignedNumber(value) {
  return (Number(value) || 0).toLocaleString('en-US');
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapePango(value) {
  return escapeXml(value);
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(String(value || ''));
  } catch (error) {
    return '';
  }
}

function isPathInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

module.exports = {
  HEIGHT,
  WIDTH,
  renderHunterOgFallbackImage,
  renderHunterOgImage,
  renderHunterOgSvg,
  _test: {
    getRankDivisionColor,
    renderHunterOgPng,
    renderSubtitleMarkup
  }
};
