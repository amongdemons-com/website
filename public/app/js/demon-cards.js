(function() {
  'use strict';

  const AmongDemons = window.AmongDemons = window.AmongDemons || {};
  const ui = AmongDemons.ui = AmongDemons.ui || {};
  let detailsModalElement = null;
  const TRAIT_LABELS_BY_TYPE = {
    1: 'Fighter',
    2: 'Sniper',
    3: 'Poison',
    4: 'AoE',
    5: 'Bruiser',
    6: 'Assassin',
    7: 'Striker',
    8: 'Thorns',
    9: 'Juggernaut',
    10: 'Healer',
    11: 'Chaotic'
  };

  function renderDemonCard(demon = {}, options = {}) {
    const tag = options.tag || 'div';
    const imageUrl = demon.imageUrl || demon.image_url || '';
    const title = options.title || demon.species || demon.name || capitalize(demon.rarity) || 'Demon';
    const classes = [
      'hunt-demon-card',
      options.className || '',
      options.active ? 'active' : '',
      shouldShowDefeated(demon, options) ? 'is-defeated' : ''
    ].filter(Boolean).join(' ');
    const attributes = {
      ...(tag === 'button' ? { type: 'button' } : {}),
      ...(options.attributes || {})
    };
    const style = [
      `--rarity-color: ${getRarityColor(demon.rarity)}`,
      options.style || ''
    ].filter(Boolean).join('; ');

    return `
      <${tag} class="${escapeHtml(classes)}" style="${escapeHtml(style)}" ${renderAttributes(attributes)}>
        <div class="hunt-demon-card-image" aria-label="${escapeHtml(capitalize(demon.rarity || 'common'))} rarity">
          <img src="${escapeHtml(imageUrl)}" alt="" draggable="false">
          <span class="hunt-demon-rarity-gem" aria-hidden="true"></span>
        </div>
        ${options.overlayHtml || ''}
        <div class="hunt-demon-card-body">
          <div class="hunt-demon-card-title">
            <span class="text-white">${escapeHtml(title)}</span>
          </div>
          ${options.showStats === false ? '' : renderCombatStats(demon, options.statsOptions || {})}
          ${options.footerHtml || ''}
        </div>
      </${tag}>
    `;
  }

  function renderCombatStats(demon = {}, options = {}) {
    const hasHp = hasNumber(demon.hp) || hasNumber(demon.maxHp);
    const hasAtk = hasNumber(demon.atk);
    const hasSpeed = hasNumber(demon.speed) && !options.hideSpeed && !isRetaliateDemon(demon);
    const currentHp = Math.max(0, Number(demon.hp) || 0);
    const maxHp = Math.max(currentHp, Number(demon.maxHp) || currentHp || 1);
    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));

    if (!hasHp && !hasAtk && !hasSpeed) return '';

    return `
      ${hasAtk || hasSpeed ? `
        <div class="combat-stat-strip" aria-label="Combat stats">
          ${hasAtk ? `<span>${renderAttackIcon()}${escapeHtml(demon.atk)}</span>` : ''}
          ${hasSpeed ? `<span>${renderSpeedIcon()}${escapeHtml(demon.speed)}</span>` : ''}
        </div>
      ` : ''}
      ${hasHp ? `
        <div class="combat-hp-bar" aria-label="HP ${currentHp} of ${maxHp}">
          <div class="combat-hp-fill js-demon-hp-fill" data-max-hp="${maxHp}" style="width: ${hpPercent}%"></div>
        </div>
        <div class="combat-hp-meta"><span class="js-demon-hp">${currentHp}</span> / ${maxHp}<i class="bi bi-droplet-fill"></i></div>
      ` : ''}
    `;
  }

  function openDemonDetailsModal(demon = {}, options = {}) {
    ensureDemonDetailsModal();

    const actions = options.actions || [];
    const title = options.title || demon.species || demon.name || capitalize(demon.rarity) || 'Demon';
    const imageUrl = demon.imageUrl || demon.image_url || '';
    const rarity = capitalize(demon.rarity || 'common');
    const currentHp = Math.max(0, Number(demon.hp) || 0);
    const maxHp = Math.max(currentHp, Number(demon.maxHp) || Number(demon.hp) || 1);
    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));

    detailsModalElement.querySelector('.modal-content').style.setProperty('--rarity-color', getRarityColor(demon.rarity));
    detailsModalElement.querySelector('.modal-body').innerHTML = `
      <div class="demon-detail-layout">
        <div class="demon-detail-art">
          <img src="${escapeHtml(imageUrl)}" alt="">
        </div>
        <div class="demon-detail-panel">
          <div class="demon-detail-heading">
            <div>
              <h2 class="demon-detail-title">${escapeHtml(title)}</h2>
              <p class="demon-detail-rarity">${escapeHtml(rarity)}</p>
            </div>
            <button type="button" class="btn-close demon-detail-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="demon-detail-stats" aria-label="Combat stats">
            ${hasNumber(demon.atk) ? renderDetailStat(renderAttackIcon(), 'Attack', demon.atk) : ''}
            ${hasNumber(demon.speed) && !isRetaliateDemon(demon) ? renderDetailStat('bi-lightning-charge-fill', 'Speed', demon.speed) : ''}
            ${hasNumber(demon.hp) || hasNumber(demon.maxHp) ? renderDetailStat('bi-droplet-fill', 'HP', `${currentHp} / ${maxHp}`) : ''}
          </div>

          ${hasNumber(demon.hp) || hasNumber(demon.maxHp) ? `
            <div class="demon-detail-hp" aria-label="HP ${currentHp} of ${maxHp}">
              <div class="demon-detail-hp-fill" style="width: ${hpPercent}%"></div>
            </div>
          ` : ''}

          ${renderDetailMeta(demon)}

          ${actions.length ? `
            <div class="demon-detail-actions">
              ${actions.map((action, index) => renderDetailAction(action, index)).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    detailsModalElement.querySelectorAll('[data-demon-detail-action]').forEach((button) => {
      const action = actions[Number(button.dataset.demonDetailAction)];
      if (!action || action.dismiss) return;
      button.addEventListener('click', () => action.onClick?.(demon, button));
    });

    bootstrap.Modal.getOrCreateInstance(detailsModalElement).show();
  }

  function ensureDemonDetailsModal() {
    if (detailsModalElement) return;

    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal fade demon-detail-modal" id="demonDetailModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
          <div class="modal-content">
            <div class="modal-body"></div>
          </div>
        </div>
      </div>
    `);
    detailsModalElement = document.getElementById('demonDetailModal');
  }

  function renderDetailStat(icon, label, value) {
    const iconHtml = String(icon).includes('<svg')
      ? icon
      : `<i class="bi ${escapeHtml(icon)}" aria-hidden="true"></i>`;

    return `
      <span class="demon-detail-stat" title="${escapeHtml(label)}">
        ${iconHtml}
        ${escapeHtml(value)}
      </span>
    `;
  }

  function renderDetailMeta(demon) {
    const rows = [
      ['Type', getTypeLabel(demon)],
      ['Position', getPositionLabel(demon)],
      ['Trait', getTraitLabel(demon)]
    ].filter(([, value]) => value !== null && value !== undefined && value !== '');

    if (!rows.length) return '';

    return `
      <div class="demon-detail-meta">
        ${rows.map(([label, value]) => `
          <div>
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDetailAction(action, index) {
    const variant = action.variant || 'outline-light';
    const icon = action.icon ? `<i class="bi ${escapeHtml(action.icon)}" aria-hidden="true"></i>` : '';
    const attributes = {
      type: 'button',
      class: `btn btn-${variant}`,
      'data-demon-detail-action': index,
      ...(action.dismiss ? { 'data-bs-dismiss': 'modal' } : {}),
      ...(action.disabled ? { disabled: true } : {}),
      ...(action.title ? { title: action.title } : {})
    };

    return `<button ${renderAttributes(attributes)}>${icon}${escapeHtml(action.label || 'Action')}</button>`;
  }

  function renderAttackIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 512 512" class="combat-stat-icon" aria-hidden="true" focusable="false">
        <path class="fa-secondary" d="M19.1 .3C13.9-.7 8.5 .9 4.7 4.7S-.7 13.9 .3 19.1L14.4 89.6c1.9 9.3 6.4 17.8 13.1 24.5L329.4 416 416 329.4 114.2 27.5c-6.7-6.7-15.2-11.3-24.5-13.1L19.1 .3zM146.7 278.6L96 329.4 182.6 416l50.7-50.7-86.6-86.6zm218.5-45.3L484.5 114.2c6.7-6.7 11.3-15.2 13.1-24.5l14.1-70.5c1-5.2-.6-10.7-4.4-14.5s-9.2-5.4-14.5-4.4L422.4 14.4c-9.3 1.9-17.8 6.4-24.5 13.1L278.6 146.7l86.6 86.6z"></path>
        <path class="fa-primary fa-secondary" d="M75.3 308.7c-6.2-6.2-16.4-6.2-22.6 0l-16 16c-4.7 4.7-6 11.8-3.3 17.8l27.5 62L4.7 460.7c-6.2 6.2-6.2 16.4 0 22.6l24 24c6.2 6.2 16.4 6.2 22.6 0l56.2-56.2 62 27.5c6 2.7 13.1 1.4 17.8-3.3l16-16c6.2-6.2 6.2-16.4 0-22.6l-128-128zm361.4 0l-128 128c-6.2 6.2-6.2 16.4 0 22.6l16 16c4.7 4.7 11.8 6 17.8 3.3l62-27.5 56.2 56.2c6.2 6.2 16.4 6.2 22.6 0l24-24c6.2-6.2 6.2-16.4 0-22.6l-56.2-56.2 27.5-62c2.7-6.1 1.4-13.1-3.3-17.8l-16-16c-6.2-6.2-16.4-6.2-22.6 0z"></path>
      </svg>
    `;
  }

  function renderSpeedIcon() {
    return `
      <svg class="combat-stat-icon combat-stat-icon-stroke" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    `;
  }

  function getRarityColor(rarity) {
    const colors = {
      common: '#D1D5D8',
      uncommon: '#41A85F',
      rare: '#2C82C9',
      epic: '#9365B8',
      legendary: '#FAC51C',
      mythic: '#E25041'
    };
    return colors[rarity] || colors.common;
  }

  function renderAttributes(attributes) {
    return Object.entries(attributes)
      .filter(([, value]) => value !== false && value !== null && value !== undefined)
      .map(([name, value]) => {
        if (value === true && name === 'draggable') return 'draggable="true"';
        if (value === true) return escapeHtml(name);
        return `${escapeHtml(name)}="${escapeHtml(value)}"`;
      })
      .join(' ');
  }

  function shouldShowDefeated(demon, options) {
    if (Object.prototype.hasOwnProperty.call(options, 'defeated')) return Boolean(options.defeated);
    return hasNumber(demon.hp) && Number(demon.hp) <= 0;
  }

  function hasNumber(value) {
    return value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value));
  }

  function isRetaliateDemon(demon = {}) {
    return Number(demon.typeId) === 8 || demon.role === 'counter_tank' || demon.targeting === 'none';
  }

  function capitalize(value) {
    if (!value) return '';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function formatLabel(value) {
    return String(value || '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getTypeLabel(demon = {}) {
    return demon.typeId || demon.type || '';
  }

  function getPositionLabel(demon = {}) {
    const position = String(demon.position || demon.preferredPosition || '').toLowerCase();
    if (position === 'front' || position === 'melee') return 'Melee';
    if (position === 'back' || position === 'ranged') return 'Ranged';
    return position ? formatLabel(position) : '';
  }

  function getTraitLabel(demon = {}) {
    const typeId = Number(demon.typeId || demon.type);
    if (TRAIT_LABELS_BY_TYPE[typeId]) return TRAIT_LABELS_BY_TYPE[typeId];
    if (!demon.role) return '';
    return formatTraitLabel(demon.role);
  }

  function formatTraitLabel(role) {
    const normalized = String(role || '').toLowerCase();
    if (normalized === 'poisoner') return 'Poison';
    if (normalized === 'aoe') return 'AoE';
    if (normalized === 'counter_tank') return 'Thorns';
    return formatLabel(role);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  ui.renderDemonCard = renderDemonCard;
  ui.renderCombatStats = renderCombatStats;
  ui.openDemonDetailsModal = openDemonDetailsModal;
  ui.formatRoleLabel = formatTraitLabel;
  ui.formatTraitLabel = formatTraitLabel;
  ui.getDemonRoleLabel = getTraitLabel;
  ui.getDemonTraitLabel = getTraitLabel;
  ui.getDemonPositionLabel = getPositionLabel;
  ui.getRarityColor = getRarityColor;
  ui.escapeHtml = escapeHtml;
  ui.capitalize = capitalize;
})();
