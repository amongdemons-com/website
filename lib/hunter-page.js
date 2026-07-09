const fs = require('fs');
const path = require('path');
const { getPublicHunterProfile } = require('../public/api/lib/hunter-profile');
const { normalizeUsername } = require('../public/api/lib/usernames');

const HUNTER_HTML_PATH = path.join(__dirname, '..', 'public', 'app', 'hunter.html');
const META_START = '<!--HUNTER_META_START-->';
const META_END = '<!--HUNTER_META_END-->';
const CANONICAL_ORIGIN = 'https://amongdemons.com';
const DEFAULT_AVATAR = '/app/images/amongdemons_logo_250x250.png';
const EMPTY_SLOT_IMAGE = '/app/images/assets/amongdemons_team_slot_placeholder.png';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

let cachedTemplate = null;

function loadTemplate() {
  if (IS_PRODUCTION && cachedTemplate) return cachedTemplate;
  cachedTemplate = fs.readFileSync(HUNTER_HTML_PATH, 'utf8');
  return cachedTemplate;
}

// Crawlers and no-JS clients do not run the browser renderer, so the profile
// route bakes in metadata and the initial public hero/team content server-side.
async function renderHunterPage(rawUsername) {
  const template = loadTemplate();

  try {
    const profile = await getPublicHunterProfile(rawUsername);
    const withMeta = injectMeta(template, buildHunterMeta(profile, rawUsername));
    return profile
      ? injectHunterContent(withMeta, profile)
      : injectMissingHunterContent(withMeta, rawUsername);
  } catch (error) {
    console.error('Failed to render hunter profile:', error);
    return injectMissingHunterContent(
      injectMeta(template, buildHunterMeta(null, rawUsername)),
      rawUsername
    );
  }
}

function buildHunterMeta(profile, rawUsername) {
  const hunter = profile?.hunter || {};
  const username = hunter.username || normalizeUsername(rawUsername) || 'hunter';
  const found = Boolean(profile);
  const title = found
    ? `${username} | Hunter Profile | Among Demons`
    : 'Hunter Profile | Among Demons';
  const description = found
    ? buildDescription(profile)
    : 'View a public Among Demons hunter profile with level, PvP record, world team, coordinates, and active buffs.';
  const canonical = `${CANONICAL_ORIGIN}/hunter/${encodeURIComponent(username)}`;
  const image = `${CANONICAL_ORIGIN}/api/og/hunter/${encodeURIComponent(username)}.png`;
  const imageAlt = found
    ? `${username} Among Demons hunter profile`
    : 'Among Demons hunter profile image';

  return { title, description, canonical, image, imageAlt };
}

function buildDescription(profile) {
  const hunter = profile.hunter || {};
  const parts = [
    `Level ${formatNumber(hunter.level)} hunter`,
    `Top Floor ${formatNumber(hunter.highestFloor)}`,
    `${formatNumber(hunter.pvpWins)} PvP win${Number(hunter.pvpWins) === 1 ? '' : 's'}`,
    `${formatNumber(hunter.pvpLosses)} loss${Number(hunter.pvpLosses) === 1 ? '' : 'es'}`
  ];
  const mainDemon = getMainDemon(profile);

  if (mainDemon && mainDemon.species) {
    const rarity = capitalize(mainDemon.rarity);
    parts.push(`profile demon ${mainDemon.species}${rarity ? ` (${rarity})` : ''}`);
  }

  return `${parts.join(', ')}. See this hunter's world team on Among Demons.`;
}

function injectMeta(template, meta) {
  const startIndex = template.indexOf(META_START);
  const endIndex = template.indexOf(META_END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) return template;

  const head = `${META_START}
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeAttribute(meta.description)}">
    <link rel="canonical" href="${escapeAttribute(meta.canonical)}">
    <meta property="og:site_name" content="Among Demons">
    <meta property="og:type" content="profile">
    <meta property="og:title" content="${escapeAttribute(meta.title)}">
    <meta property="og:description" content="${escapeAttribute(meta.description)}">
    <meta property="og:url" content="${escapeAttribute(meta.canonical)}">
    <meta property="og:image" content="${escapeAttribute(meta.image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="${escapeAttribute(meta.imageAlt)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttribute(meta.title)}">
    <meta name="twitter:description" content="${escapeAttribute(meta.description)}">
    <meta name="twitter:image" content="${escapeAttribute(meta.image)}">
    <meta name="twitter:image:alt" content="${escapeAttribute(meta.imageAlt)}">
    ${META_END}`;

  return template.slice(0, startIndex) + head + template.slice(endIndex + META_END.length);
}

function injectHunterContent(template, profile) {
  const hunter = profile.hunter || {};
  const username = hunter.username || 'Hunter';
  const avatar = getMainDemon(profile)?.imageUrl || DEFAULT_AVATAR;
  const team = Array.isArray(profile.worldTeam) ? profile.worldTeam : [];
  const buffs = Array.isArray(profile.buffs) ? profile.buffs : [];
  let html = template;

  html = replaceFirst(
    html,
    /<img id="hunterAvatar" src="[^"]*" alt="" width="96" height="96" loading="eager" decoding="async">/,
    `<img id="hunterAvatar" src="${escapeAttribute(avatar)}" alt="" width="96" height="96" loading="eager" decoding="async">`
  );
  html = replaceFirst(
    html,
    '<h1 id="hunterName">Hunter</h1>',
    renderHunterName(username)
  );
  html = replaceFirst(
    html,
    '<p id="hunterSubline">Loading public record...</p>',
    `<p id="hunterSubline">Level ${formatNumber(hunter.level)} &middot; ${formatNumber(hunter.pvpWins)}-${formatNumber(hunter.pvpLosses)}</p>`
  );
  html = replaceFirst(
    html,
    '<span class="hunter-stat-value" data-hunter-stat="floor">-</span>',
    `<span class="hunter-stat-value" data-hunter-stat="floor">${formatNumber(hunter.highestFloor)}</span>`
  );
  html = replaceFirst(
    html,
    '<span class="hunter-stat-value" data-hunter-stat="coordinates">-</span>',
    `<span class="hunter-stat-value" data-hunter-stat="coordinates">${escapeHtml(formatCoordinates(profile.coordinates))}</span>`
  );
  html = replaceFirst(
    html,
    '<p id="hunterTeamSummary">Assigned demons appear here.</p>',
    `<p id="hunterTeamSummary">${team.length ? `${formatNumber(team.length)} assigned demon${team.length === 1 ? '' : 's'}` : 'No active team assigned.'}</p>`
  );
  html = replaceFirst(
    html,
    '<div class="hunter-team-board battle-side battle-side-player" id="hunterWorldTeam" aria-live="polite"></div>',
    `<div class="hunter-team-board battle-side battle-side-player" id="hunterWorldTeam" aria-live="polite">${renderServerTeam(team)}</div>`
  );
  html = replaceFirst(
    html,
    '<div class="hunter-buff-list" id="hunterBuffs" aria-live="polite"></div>',
    `<div class="hunter-buff-list" id="hunterBuffs" aria-live="polite">${renderServerBuffs(buffs)}</div>`
  );

  return html;
}

function injectMissingHunterContent(template, rawUsername) {
  const username = normalizeUsername(rawUsername) || 'Hunter';
  let html = template;

  html = replaceFirst(
    html,
    '<h1 id="hunterName">Hunter</h1>',
    renderHunterName(username)
  );
  html = replaceFirst(
    html,
    '<p id="hunterSubline">Loading public record...</p>',
    '<p id="hunterSubline">No public record found.</p>'
  );
  html = replaceFirst(
    html,
    '<p id="hunterTeamSummary">Assigned demons appear here.</p>',
    '<p id="hunterTeamSummary">No active team assigned.</p>'
  );
  html = replaceFirst(
    html,
    '<div class="hunter-team-board battle-side battle-side-player" id="hunterWorldTeam" aria-live="polite"></div>',
    `<div class="hunter-team-board battle-side battle-side-player" id="hunterWorldTeam" aria-live="polite">${renderServerTeam([])}</div>`
  );
  html = replaceFirst(
    html,
    '<div class="hunter-buff-list" id="hunterBuffs" aria-live="polite"></div>',
    `<div class="hunter-buff-list" id="hunterBuffs" aria-live="polite">${renderEmpty('No active level buffs yet.')}</div>`
  );

  return html;
}

function renderHunterName(username) {
  const classes = getHunterNameClasses(username);
  const classAttr = classes ? ` class="${escapeAttribute(classes)}"` : '';
  const titleAttr = classes ? ` title="${escapeAttribute(username)}"` : '';
  return `<h1 id="hunterName"${classAttr}${titleAttr} aria-label="${escapeAttribute(username)}">${escapeHtml(username)}</h1>`;
}

function getHunterNameClasses(username) {
  const length = Array.from(String(username || '')).length;
  return [
    length > 18 ? 'is-compact-name' : '',
    length > 34 ? 'is-clamped-name' : ''
  ].filter(Boolean).join(' ');
}

function renderServerTeam(team = []) {
  const assignments = getFormationAssignments(team);

  return `
      <div class="battle-formation battle-formation-grid battle-formation-player" role="list" aria-label="World team formation">
        ${assignments.map((demon, slot) => renderFormationSlot(demon, slot)).join('')}
      </div>
    `;
}

function renderFormationSlot(demon, slot) {
  const position = getFormationSlotPosition(slot);
  const classes = [
    'formation-slot',
    `formation-slot-${position}`,
    demon ? 'has-demon' : 'is-empty'
  ].join(' ');

  return `
      <div class="${classes}" data-formation-slot="${slot}" role="listitem" aria-label="${escapeAttribute(`World team slot ${slot + 1}`)}">
        <div class="formation-slot-cards">
          ${demon ? renderServerTeamMember(demon) : renderEmptyFormationSlot(position, slot + 1)}
        </div>
      </div>
    `;
}

function renderServerTeamMember(demon) {
  const href = getDemonPageHref(demon);
  const tag = href ? 'a' : 'article';
  const hrefAttr = href ? ` href="${escapeAttribute(href)}"` : '';
  const rarity = capitalize(demon.rarity || 'common');

  return `
      <${tag} class="hunter-fallback-demon"${hrefAttr}>
        <img src="${escapeAttribute(demon.imageUrl || DEFAULT_AVATAR)}" alt="" width="96" height="96" loading="lazy">
        <strong>${escapeHtml(demon.species || 'Demon')}</strong>
        <small>${escapeHtml(rarity)}</small>
      </${tag}>
    `;
}

function renderEmptyFormationSlot(position, slotNumber) {
  return `
      <div class="formation-empty formation-empty-${position}" aria-hidden="true" data-slot-number="${slotNumber}">
        <img class="formation-slot-placeholder-img" src="${EMPTY_SLOT_IMAGE}" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </div>
    `;
}

function renderServerBuffs(buffs = []) {
  return buffs.length
    ? buffs.map(renderServerBuff).join('')
    : renderEmpty('No active level buffs yet.');
}

function renderServerBuff(buff = {}) {
  const effects = Array.isArray(buff.effects) ? buff.effects : [];

  return `
      <article class="hunter-buff">
        <span class="hunter-buff-icon" aria-hidden="true">+</span>
        <span class="hunter-buff-copy">
          <strong>${escapeHtml(buff.name || formatLabel(buff.id) || 'Buff')}</strong>
          ${buff.description ? `<small>${escapeHtml(buff.description)}</small>` : ''}
          ${effects.length ? `<span class="hunter-buff-effects">${effects.map(renderEffect).join('')}</span>` : ''}
        </span>
      </article>
    `;
}

function renderEffect(effect = {}) {
  return `<span>${escapeHtml(formatEffect(effect))}</span>`;
}

function formatEffect(effect = {}) {
  const type = String(effect.type || '');
  const label = formatLabel(type);
  const value = Number(effect.value);
  if (!Number.isFinite(value)) return label;

  if (type.endsWith('_mult')) {
    const percent = Math.round((value - 1) * 1000) / 10;
    return `${label} +${formatTrimmed(percent)}%`;
  }

  if (type.endsWith('_percent')) {
    return `${label} +${formatTrimmed(value)}%`;
  }

  return `${label} +${formatTrimmed(value)}`;
}

function renderEmpty(text) {
  return `<p class="hunter-empty">${escapeHtml(text)}</p>`;
}

function getFormationAssignments(team = []) {
  const cells = Array.from({ length: 9 }, () => null);
  const overflow = [];

  team
    .slice()
    .sort((a, b) => (
      normalizeSlot(a.formationSlot) - normalizeSlot(b.formationSlot) ||
      String(a.species || '').localeCompare(String(b.species || ''))
    ))
    .slice(0, 9)
    .forEach((demon) => {
      const slot = normalizeSlot(demon.formationSlot);
      if (slot >= 0 && slot < cells.length && !cells[slot]) {
        cells[slot] = {
          ...demon,
          position: getFormationSlotPosition(slot)
        };
        return;
      }

      overflow.push(demon);
    });

  overflow.forEach((demon) => {
    const slot = cells.findIndex((cell) => !cell);
    if (slot >= 0) {
      cells[slot] = {
        ...demon,
        position: getFormationSlotPosition(slot)
      };
    }
  });

  return cells;
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

  const team = Array.isArray(profile?.worldTeam) ? profile.worldTeam : [];
  return team.find((member) => member && member.imageUrl) || null;
}

function formatCoordinates(coordinates = {}) {
  const x = Number(coordinates.x) || 0;
  const y = Number(coordinates.y) || 0;
  return `Area ${formatSignedNumber(x)}, ${formatSignedNumber(y)}`;
}

function getDemonPageHref(demon = {}) {
  const name = demon.species || demon.typeName || demon.name;
  const rarity = demon.rarity;
  if (!name || !rarity) return '';

  return `/demons/${slugify(`${name}-${rarity}`)}`;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/['\u2019]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSlot(slot) {
  const number = Number(slot);
  return Number.isInteger(number) && number >= 0 ? number : -1;
}

function getFormationSlotPosition(slot) {
  return normalizeSlot(slot) % 3 === 2 ? 'front' : 'back';
}

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString('en-US');
}

function formatSignedNumber(value) {
  return (Number(value) || 0).toLocaleString('en-US');
}

function formatTrimmed(value) {
  const number = Math.round((Number(value) || 0) * 10) / 10;
  return String(number).replace(/\.0$/, '');
}

function formatLabel(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function replaceFirst(template, search, replacement) {
  if (typeof search === 'string') {
    const index = template.indexOf(search);
    if (index === -1) return template;
    return template.slice(0, index) + replacement + template.slice(index + search.length);
  }

  return template.replace(search, () => replacement);
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
