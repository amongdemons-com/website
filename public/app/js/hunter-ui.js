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

    setLoading(username);

    try {
      const payload = await window.AmongDemons.api(`/api/hunters/${encodeURIComponent(username)}`);
      renderHunter(payload);
    } catch (error) {
      showMessage(error.status === 404 ? 'Hunter not found.' : (error.message || 'Unable to load hunter.'), 'danger');
      showNotFound(username);
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
    setText(elements.name, username);
    setText(elements.subline, `Level ${formatNumber(level)} \u00b7 ${formatNumber(pvpWins)}-${formatNumber(pvpLosses)}`);
    setText(elements.stats.floor, formatNumber(hunter.highestFloor || 0));
    setText(elements.stats.coordinates, formatCoordinates(coordinates));

    if (elements.avatar) {
      elements.avatar.src = profileImage;
      elements.avatar.alt = '';
    }

    renderWorldTeam(worldTeam);
    renderBuffs(buffs);
  }

  function renderWorldTeam(team = []) {
    const sortedTeam = [...team].sort((a, b) => (
      normalizeSlot(a.formationSlot) - normalizeSlot(b.formationSlot) ||
      String(a.species || '').localeCompare(String(b.species || ''))
    ));
    setText(elements.teamSummary, sortedTeam.length
      ? `${formatNumber(sortedTeam.length)} assigned demon${sortedTeam.length === 1 ? '' : 's'}`
      : 'No assigned world team.');

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
      ? {
          href,
          target: '_blank',
          rel: 'noopener'
        }
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
      <${href ? 'a' : 'article'} class="hunter-fallback-demon" ${href ? `href="${escapeAttribute(href)}" target="_blank" rel="noopener"` : ''}>
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
      : renderEmpty('No active level buffs.');
  }

  function renderBuff(buff = {}) {
    const icon = renderIcon(buff.icon || 'sparkles');
    const effects = Array.isArray(buff.effects) ? buff.effects : [];

    return `
      <article class="hunter-buff">
        <span class="hunter-buff-icon" aria-hidden="true">${icon}</span>
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
    setText(elements.name, username);
    setText(elements.subline, 'Loading public record...');
    if (elements.team) elements.team.innerHTML = renderFormationGrid([]);
    if (elements.buffs) elements.buffs.innerHTML = renderEmpty('Loading buffs...');
  }

  function showNotFound(username = '') {
    setText(elements.name, username || 'Hunter');
    setText(elements.subline, 'No public record found.');
    Object.values(elements.stats).forEach((element) => setText(element, '-'));
    if (elements.avatar) elements.avatar.src = FALLBACK_AVATAR;
    if (elements.team) elements.team.innerHTML = renderFormationGrid([]);
    if (elements.buffs) elements.buffs.innerHTML = renderEmpty('No buffs found.');
  }

  function showMessage(text, type) {
    if (!elements.message) return;
    elements.message.textContent = text;
    elements.message.className = text ? `alert alert-${type}` : 'alert d-none';
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
