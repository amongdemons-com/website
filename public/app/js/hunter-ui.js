(function() {
  'use strict';

  const elements = {};
  const FALLBACK_AVATAR = '/app/images/amongdemons_logo_250x250.png';
  const effectLabels = {
    aoe_damage_flat: 'AOE Damage',
    aoe_damage_mult: 'AOE Damage',
    attack_flat: 'Attack',
    attack_mult: 'Attack',
    healing_flat: 'Healing',
    healing_mult: 'Healing',
    max_hp_flat: 'Max HP',
    max_hp_mult: 'Max HP',
    poison_damage_flat: 'Poison Damage',
    poison_tick_damage_mult: 'Poison Damage',
    soul_capacity_mult: 'Soul Vessel',
    speed_flat: 'Speed',
    speed_mult: 'Speed',
    thorns_flat: 'Thorns',
    thorns_percent: 'Thorns'
  };

  onReady(init);

  async function init() {
    cacheElements();
    const username = getUsernameFromLocation();

    if (!username) {
      showNotFound();
      return;
    }

    const initialData = readInitialHunterData();
    if (initialData) {
      if (initialData.profile) {
        renderHunter(initialData.profile);
      } else if (initialData.notFound) {
        showNotFound(username);
      }
      return;
    }

    setLoading(username);

    try {
      const payload = await window.AmongDemons.api(`/api/hunters/${encodeURIComponent(username)}`);
      renderHunter(payload);
    } catch (error) {
      console.error(error);
      showMessage(error.status === 404 ? 'Hunter not found.' : error, error.status === 404 ? 'warning' : 'danger');
      showNotFound(username);
    }
  }

  function readInitialHunterData() {
    const element = document.getElementById('hunterInitialData');
    if (!element) return null;
    try {
      return JSON.parse(element.textContent || 'null');
    } catch (error) {
      console.warn('Unable to read the server-rendered hunter profile.', error);
      return null;
    } finally {
      element.remove();
    }
  }

  function cacheElements() {
    elements.message = document.getElementById('hunterMessage');
    elements.name = document.getElementById('hunterName');
    elements.subline = document.getElementById('hunterSubline');
    elements.avatar = document.getElementById('hunterAvatar');
    elements.team = document.getElementById('hunterWorldTeam');
    elements.teamSummary = document.getElementById('hunterTeamSummary');
    elements.buffs = document.getElementById('hunterBuffs');
    elements.share = document.querySelector('[data-hunter-share]');
    elements.cta = document.querySelector('[data-hunter-cta]');
    elements.stats = {
      floor: document.querySelector('[data-hunter-stat="floor"]'),
      coordinates: document.querySelector('[data-hunter-stat="coordinates"]')
    };
  }

  function renderHunter(payload = {}) {
    const hunter = payload.hunter || {};
    const coordinates = payload.coordinates || {};
    const worldTeam = Array.isArray(payload.worldTeam) ? payload.worldTeam : [];
    const buffs = Array.isArray(payload.buffs) ? payload.buffs : [];
    const username = hunter.username || 'Hunter';
    const level = Math.max(1, Number(hunter.level) || 1);
    const pvpWins = Math.max(0, Number(hunter.pvpWins) || 0);
    const pvpLosses = Math.max(0, Number(hunter.pvpLosses) || 0);
    const profileImage = hunter.profileDemonImageUrl || getFirstTeamImage(worldTeam) || FALLBACK_AVATAR;

    document.title = `${username} | Hunter Profile | Among Demons`;
    updateCanonical(username);
    setHunterName(username);
    setText(elements.subline, `Level ${formatNumber(level)} \u00b7 ${formatNumber(pvpWins)}-${formatNumber(pvpLosses)}`);
    setText(elements.stats.floor, formatNumber(hunter.highestFloor || 0));
    setText(elements.stats.coordinates, formatCoordinates(coordinates));

    if (elements.avatar) {
      elements.avatar.src = profileImage;
      elements.avatar.alt = '';
    }

    renderWorldTeam(worldTeam);
    renderBuffs(buffs);
    renderShare(hunter, worldTeam);
    renderCta(hunter);
  }

  // Icon-only share controls that live in the hero's right column: quick links
  // to X and Facebook, plus a copy button that opens a small dropdown offering
  // the profile link or the pre-written share text.
  function renderShare(hunter, worldTeam) {
    const container = elements.share;
    if (!container) return;

    const username = hunter.username || 'Hunter';
    const url = getProfileUrl(username);
    const shareText = buildShareText(hunter, worldTeam);

    container.innerHTML = `
      <a class="hunter-share-btn" data-share-link href="${escapeAttribute(buildXIntent(shareText, url))}" target="_blank" rel="noopener noreferrer" aria-label="Share on X (opens in a new tab)" title="Share on X">${renderXIcon()}</a>
      <a class="hunter-share-btn" data-share-link href="${escapeAttribute(buildFacebookShare(url))}" target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook (opens in a new tab)" title="Share on Facebook">${renderFacebookIcon()}</a>
      <div class="hunter-copy-menu" data-copy-menu>
        <button type="button" class="hunter-share-btn" data-copy-toggle aria-haspopup="true" aria-expanded="false" aria-label="Copy" title="Copy">${renderIcon('copy')}</button>
        <div class="hunter-copy-dropdown" data-copy-dropdown role="menu" hidden>
          <button type="button" role="menuitem" data-copy-link>${renderIcon('link')}<span>Copy Profile Link</span></button>
          <button type="button" role="menuitem" data-copy-text>${renderIcon('copy')}<span>Copy Share Text</span></button>
        </div>
      </div>
    `;

    bindShare(container, { url, shareText });
  }

  function renderCta(hunter) {
    const container = elements.cta;
    if (!container) return;

    const viewer = getViewerContext(hunter.username || 'Hunter');

    if (viewer.isOwnGuest) {
      container.innerHTML = `
        <div class="hunter-cta-card">
          <p>This is your guest hunter. Save it to keep your demons and progress forever.</p>
          <a class="btn btn-primary btn-lg" href="/register?claim=1">${renderIcon('save')}<span>Save Progress</span></a>
        </div>
      `;
      return;
    }

    if (viewer.isLoggedOut) {
      container.innerHTML = `
        <div class="hunter-cta-card">
          <p>Start your own hunter, no sign-up needed.</p>
          <a class="btn btn-primary btn-lg" href="/camp" data-play-instantly data-play-destination="/camp">${renderIcon('play')}<span>Play Instantly</span></a>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
  }

  function bindShare(container, { url, shareText }) {
    const menu = container.querySelector('[data-copy-menu]');
    const toggle = container.querySelector('[data-copy-toggle]');
    const dropdown = container.querySelector('[data-copy-dropdown]');
    const copyLinkButton = container.querySelector('[data-copy-link]');
    const copyTextButton = container.querySelector('[data-copy-text]');

    if (toggle && dropdown) {
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        setCopyMenuOpen(menu, toggle, dropdown, dropdown.hidden);
      });

      document.addEventListener('click', (event) => {
        if (!menu.contains(event.target)) setCopyMenuOpen(menu, toggle, dropdown, false);
      });

      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') setCopyMenuOpen(menu, toggle, dropdown, false);
      });
    }

    if (copyLinkButton) {
      copyLinkButton.addEventListener('click', () => {
        handleCopy(copyLinkButton, url, 'Profile link copied.');
        setCopyMenuOpen(menu, toggle, dropdown, false);
      });
    }

    if (copyTextButton) {
      copyTextButton.addEventListener('click', () => {
        handleCopy(copyTextButton, `${shareText} ${url}`, 'Share text copied.');
        setCopyMenuOpen(menu, toggle, dropdown, false);
      });
    }
  }

  function setCopyMenuOpen(menu, toggle, dropdown, open) {
    if (!menu || !toggle || !dropdown) return;
    dropdown.hidden = !open;
    menu.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  async function handleCopy(button, text, successTitle) {
    const copied = await copyToClipboard(text);

    if (copied) {
      window.AmongDemons.showGameAlert?.({
        type: 'success',
        title: successTitle,
        message: 'Share it anywhere to invite other hunters.',
        action: 'Paste it into Discord, X, or a message.'
      });
    } else {
      window.AmongDemons.showGameAlert?.({
        type: 'warning',
        title: 'Copy blocked.',
        message: 'Your browser blocked the clipboard.',
        action: 'Select the link and copy it manually.'
      });
    }
  }

  function renderXIcon() {
    return '<svg class="hunter-brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';
  }

  function renderFacebookIcon() {
    return '<svg class="hunter-brand-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.49 0-1.955.925-1.955 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>';
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the legacy path below.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      const succeeded = document.execCommand('copy');
      document.body.removeChild(textarea);
      return succeeded;
    } catch (error) {
      return false;
    }
  }

  function buildShareText(hunter, worldTeam = []) {
    const floor = Math.max(0, Number(hunter.highestFloor) || 0);
    const hasMythic = worldTeam.some((demon) => String(demon.rarity || '').toLowerCase() === 'mythic');

    if (floor > 0) {
      return `My hunter survived Floor ${floor} in Among Demons. Can your team go deeper?`;
    }

    if (hasMythic) {
      return 'I found a Mythic demon in Among Demons.';
    }

    return 'My demon team is waiting in Among Demons.';
  }

  function getViewerContext(profileUsername) {
    const auth = window.AmongDemons || {};
    const token = typeof auth.getToken === 'function' ? auth.getToken() : '';
    const player = typeof auth.getPlayer === 'function' ? auth.getPlayer() : null;
    const isOwn = Boolean(player && normalizeName(player.username) === normalizeName(profileUsername));

    return {
      isLoggedOut: !token,
      isOwn,
      isOwnGuest: isOwn && Boolean(player && player.isGuest)
    };
  }

  function normalizeName(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getProfileUrl(username) {
    const origin = window.location.origin && window.location.origin !== 'null'
      ? window.location.origin
      : 'https://amongdemons.com';
    return `${origin}/hunter/${encodeURIComponent(username)}`;
  }

  function buildXIntent(text, url) {
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  }

  function buildFacebookShare(url) {
    return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  }

  function renderWorldTeam(team = []) {
    const sortedTeam = [...team].sort((a, b) => (
      normalizeSlot(a.formationSlot) - normalizeSlot(b.formationSlot) ||
      String(a.species || '').localeCompare(String(b.species || ''))
    ));
    setText(elements.teamSummary, sortedTeam.length
      ? `${formatNumber(sortedTeam.length)} assigned demon${sortedTeam.length === 1 ? '' : 's'}`
      : 'No active team assigned.');

    if (!elements.team) return;

    elements.team.innerHTML = renderFormationGrid(sortedTeam);
  }

  function renderFormationGrid(team = []) {
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
          ${demon ? renderTeamMember(demon) : renderEmptyFormationSlot(position, slot + 1)}
        </div>
      </div>
    `;
  }

  function renderTeamMember(demon) {
    const renderDemonCard = window.AmongDemons?.ui?.renderDemonCard;
    const href = getDemonPageHref(demon);
    const attributes = href
      ? { href }
      : {};

    if (typeof renderDemonCard === 'function') {
      return renderDemonCard(demon, {
        tag: href ? 'a' : 'div',
        className: 'hunter-team-card',
        imageLoading: 'lazy',
        title: demon.species || 'Demon',
        attributes
      });
    }

    return `
      <${href ? 'a' : 'article'} class="hunter-fallback-demon" ${href ? `href="${escapeAttribute(href)}"` : ''}>
        <img src="${escapeAttribute(demon.imageUrl || FALLBACK_AVATAR)}" alt="" width="96" height="96" loading="lazy">
        <strong>${escapeHtml(demon.species || 'Demon')}</strong>
      </${href ? 'a' : 'article'}>
    `;
  }

  function renderEmptyFormationSlot(position, slotNumber) {
    return `
      <div class="formation-empty formation-empty-${position}" aria-hidden="true" data-slot-number="${slotNumber}">
        <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </div>
    `;
  }

  function getFormationAssignments(team = []) {
    const cells = Array.from({ length: 9 }, () => null);
    const overflow = [];

    team.slice(0, 9).forEach((demon) => {
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

  function renderBuffs(buffs = []) {
    if (!elements.buffs) return;

    elements.buffs.innerHTML = buffs.length
      ? buffs.map(renderBuff).join('')
      : renderEmpty('No active level buffs yet.');
  }

  function renderBuff(buff = {}) {
    const icon = renderIcon(buff.icon || 'sparkles');
    const effects = Array.isArray(buff.effects) ? buff.effects : [];
    const expiry = renderBuffExpiry(buff);

    return `
      <article class="hunter-buff${expiry ? ' is-temporary' : ''}">
        <span class="hunter-buff-icon" aria-hidden="true">${icon}</span>
        <span class="hunter-buff-copy">
          <strong>${escapeHtml(buff.name || formatLabel(buff.id) || 'Buff')}</strong>
          ${buff.description ? `<small>${escapeHtml(buff.description)}</small>` : ''}
          ${effects.length ? `<span class="hunter-buff-effects">${effects.map(renderEffect).join('')}</span>` : ''}
          ${expiry}
        </span>
      </article>
    `;
  }

  function renderBuffExpiry(buff = {}) {
    const expiresAt = Date.parse(buff.expiresAt || '');
    if (!Number.isFinite(expiresAt)) return '';

    const timestamp = formatBuffExpiryTimestamp(expiresAt);
    const remainingSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
    const label = remainingSeconds <= 0
      ? 'Expired'
      : `Expires in ${formatBuffExpiryDuration(remainingSeconds)}`;
    const title = timestamp ? `${label} (${timestamp})` : label;

    return `
      <span class="hunter-buff-expiry" title="${escapeHtml(title)}">
        ${renderIcon('timer')}
        <span>${escapeHtml(label)}</span>
      </span>
    `;
  }

  function formatBuffExpiryDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }

  function formatBuffExpiryTimestamp(expiresAt) {
    try {
      return new Date(expiresAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return '';
    }
  }

  function renderEffect(effect = {}) {
    return `<span>${escapeHtml(formatEffect(effect))}</span>`;
  }

  function formatEffect(effect = {}) {
    const type = String(effect.type || '');
    const label = effectLabels[type] || formatLabel(type);
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

  function setLoading(username) {
    setHunterName(username);
    setText(elements.subline, 'Loading public record...');
    if (elements.team) elements.team.innerHTML = renderFormationGrid([]);
    if (elements.buffs) elements.buffs.innerHTML = renderEmpty('Loading buffs...');
  }

  function showNotFound(username = '') {
    setHunterName(username || 'Hunter');
    setText(elements.subline, 'No public record found.');
    Object.values(elements.stats).forEach((element) => setText(element, '-'));
    if (elements.avatar) elements.avatar.src = FALLBACK_AVATAR;
    if (elements.team) elements.team.innerHTML = renderFormationGrid([]);
    if (elements.buffs) elements.buffs.innerHTML = renderEmpty('No active level buffs yet.');
    if (elements.share) elements.share.innerHTML = '';
    if (elements.cta) elements.cta.innerHTML = '';
  }

  function showMessage(text, type) {
    if (!elements.message) return;
    window.AmongDemons.setGameAlert(elements.message, text, { type });
  }

  function updateCanonical(username) {
    const canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) return;
    canonical.href = `https://amongdemons.com/hunter/${encodeURIComponent(username)}`;
  }

  function getUsernameFromLocation() {
    const queryUsername = new URLSearchParams(window.location.search).get('username');
    if (queryUsername) return queryUsername.trim();

    const parts = window.location.pathname.split('/').filter(Boolean);
    const hunterIndex = parts.findIndex((part) => part.toLowerCase() === 'hunter');
    if (hunterIndex < 0 || !parts[hunterIndex + 1]) return '';

    try {
      return decodeURIComponent(parts[hunterIndex + 1]).trim();
    } catch (error) {
      return '';
    }
  }

  function formatCoordinates(coordinates = {}) {
    const x = Number(coordinates.x) || 0;
    const y = Number(coordinates.y) || 0;
    return `Area ${formatNumber(x)}, ${formatNumber(y)}`;
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

  function getFirstTeamImage(team = []) {
    const demon = team.find((member) => member && member.imageUrl);
    return demon ? demon.imageUrl : '';
  }

  function normalizeSlot(slot) {
    const number = Number(slot);
    return Number.isInteger(number) && number >= 0 ? number : -1;
  }

  function getFormationSlotPosition(slot) {
    return normalizeSlot(slot) % 3 === 2 ? 'front' : 'back';
  }

  function renderEmpty(text) {
    return `<p class="hunter-empty">${escapeHtml(text)}</p>`;
  }

  function renderIcon(name) {
    const renderer = window.AmongDemons?.ui?.renderIcon;
    return typeof renderer === 'function' ? renderer(name, { size: 18 }) : '';
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
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

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function setHunterName(value) {
    if (!elements.name) return;

    const username = String(value || 'Hunter').trim() || 'Hunter';
    const length = Array.from(username).length;
    const isCompact = length > 18;
    const isClamped = length > 34;

    elements.name.textContent = username;
    elements.name.title = isCompact ? username : '';
    elements.name.setAttribute('aria-label', username);
    elements.name.classList.toggle('is-compact-name', isCompact);
    elements.name.classList.toggle('is-clamped-name', isClamped);
  }

  function escapeHtml(value) {
    const escape = window.AmongDemons?.ui?.escapeHtml;
    if (typeof escape === 'function') return escape(value);

    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }
})();
