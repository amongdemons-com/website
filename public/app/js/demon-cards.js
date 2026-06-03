(function() {
  'use strict';

  const AmongDemons = window.AmongDemons = window.AmongDemons || {};
  const ui = AmongDemons.ui = AmongDemons.ui || {};
  const renderIcon = ui.renderIcon || (() => '');
  let detailsModalElement = null;
  const DEMON_IMAGE_WIDTH = 768;
  const DEMON_IMAGE_HEIGHT = 1024;
  const FALLBACK_IMAGE_URL = '/app/images/amongdemons_logo_250x250.png';
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
    const imageUrl = demon.imageUrl || demon.image_url || FALLBACK_IMAGE_URL;
    const title = options.title || demon.species || demon.name || capitalize(demon.rarity) || 'Demon';
    const rarity = capitalize(demon.rarity || 'common');
    const imageAlt = options.imageAlt || getDemonImageAlt(demon, title, rarity);
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
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(imageAlt)}" width="${DEMON_IMAGE_WIDTH}" height="${DEMON_IMAGE_HEIGHT}" loading="${escapeHtml(options.imageLoading || 'lazy')}" decoding="async" draggable="false" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_URL}';">
          <span class="hunt-demon-rarity-gem" aria-hidden="true"></span>
        </div>
        ${options.overlayHtml || ''}
        <div class="hunt-demon-card-body">
          <div class="hunt-demon-card-title">
            <span class="hunt-demon-card-rarity">${escapeHtml(rarity)}</span>
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
        <div class="combat-hp-meta"><span class="combat-current-hp js-demon-hp">${currentHp}</span>${renderIcon('hp')}</div>
      ` : ''}
    `;
  }

  function openDemonDetailsModal(demon = {}, options = {}) {
    ensureDemonDetailsModal();

    const actions = options.actions || [];
    const title = options.title || demon.species || demon.name || capitalize(demon.rarity) || 'Demon';
    const titleHtml = renderDetailTitle(title, demon);
    const imageUrl = demon.imageUrl || demon.image_url || FALLBACK_IMAGE_URL;
    const rarity = capitalize(demon.rarity || 'common');
    const currentHp = Math.max(0, Number(demon.hp) || 0);
    const maxHp = Math.max(currentHp, Number(demon.maxHp) || Number(demon.hp) || 1);
    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));

    detailsModalElement.querySelector('.modal-content').style.setProperty('--rarity-color', getRarityColor(demon.rarity));
    detailsModalElement.querySelector('.modal-body').innerHTML = `
        <div class="demon-detail-layout" data-detail-demon-id="${escapeHtml(demon.id || '')}">
        <div class="demon-detail-art">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(getDemonImageAlt(demon, title, rarity))}" width="${DEMON_IMAGE_WIDTH}" height="${DEMON_IMAGE_HEIGHT}" loading="eager" decoding="async" onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_URL}';">
        </div>
        <div class="demon-detail-panel">
          <div class="demon-detail-heading">
            <div>
              <h2 class="demon-detail-title">${titleHtml}</h2>
              <p class="demon-detail-rarity">${escapeHtml(rarity)}</p>
            </div>
            <button type="button" class="btn-close demon-detail-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>

          <div class="demon-detail-stats" aria-label="Combat stats">
            ${hasNumber(demon.atk) ? renderDetailStat(renderAttackIcon(), 'Attack', demon.atk) : ''}
            ${hasNumber(demon.speed) && !isRetaliateDemon(demon) ? renderDetailStat(renderSpeedIcon(), 'Speed', demon.speed) : ''}
            ${hasNumber(demon.hp) || hasNumber(demon.maxHp) ? renderDetailStat(renderIcon('hp'), 'HP', `${currentHp} / ${maxHp}`) : ''}
          </div>

          ${hasNumber(demon.hp) || hasNumber(demon.maxHp) ? `
            <div class="demon-detail-hp" aria-label="HP ${currentHp} of ${maxHp}">
              <div class="demon-detail-hp-fill" style="width: ${hpPercent}%"></div>
            </div>
          ` : ''}

          ${renderDetailMeta(demon)}

          ${options.detailHtml ? `
            <div class="demon-detail-extra">
              ${options.detailHtml}
            </div>
          ` : ''}

          ${actions.length ? `
            <div class="demon-detail-actions">
              ${options.actionsLeadHtml ? `<div class="demon-detail-action-lead">${options.actionsLeadHtml}</div>` : ''}
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
    const iconHtml = String(icon).includes('<svg') ? icon : renderIcon(icon);

    return `
      <span class="demon-detail-stat" title="${escapeHtml(label)}" data-detail-stat="${escapeHtml(getDetailStatKey(label))}">
        ${iconHtml}
        <span class="demon-detail-stat-value">${escapeHtml(value)}</span>
      </span>
    `;
  }

  function getDetailStatKey(label) {
    const normalized = String(label || '').toLowerCase();
    if (normalized === 'attack') return 'atk';
    if (normalized === 'hp') return 'hp';
    return normalized;
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
        ${rows.map(([label, value]) => renderDetailMetaRow(label, value, demon)).join('')}
      </div>
    `;
  }

  function renderDetailMetaRow(label, value, demon = {}) {
    const isType = label === 'Type';
    const href = isType ? getDemonTypeHref(demon) : '';

    return `
      <div class="${isType && href ? 'demon-detail-meta-type' : ''}">
        <span class="demon-detail-meta-label">
          <span class="demon-detail-meta-label-text">${escapeHtml(label)}</span>
          ${href ? `
            <a class="demon-detail-type-info" href="${escapeHtml(href)}" target="_blank" rel="noopener" aria-label="Open ${escapeHtml(label)} ${escapeHtml(value)} details" title="Open type details">i</a>
          ` : ''}
        </span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderDetailAction(action, index) {
    const variant = action.variant || 'outline-light';
    const icon = action.icon ? renderIcon(action.icon) : '';
    const attributes = action.href
      ? {
        href: action.href,
        class: `btn btn-${variant}`,
        ...(action.target ? { target: action.target } : {}),
        ...(action.rel ? { rel: action.rel } : {}),
        ...(action.title ? { title: action.title } : {})
      }
      : {
        type: 'button',
        class: `btn btn-${variant}`,
        'data-demon-detail-action': index,
        ...(action.dismiss ? { 'data-bs-dismiss': 'modal' } : {}),
        ...(action.disabled ? { disabled: true } : {}),
        ...(action.title ? { title: action.title } : {})
      };
    const tag = action.href ? 'a' : 'button';

    return `<${tag} ${renderAttributes(attributes)}>${icon}${escapeHtml(action.label || 'Action')}</${tag}>`;
  }

  function renderDetailTitle(title, demon = {}) {
    const href = getDemonTypeHref(demon);
    const text = escapeHtml(title);

    return href
      ? `<a class="demon-detail-title-link" href="${escapeHtml(href)}" target="_blank" rel="noopener">${text}</a>`
      : text;
  }

  function getDemonTypeHref(demon = {}) {
    const typeId = Number(demon.typeId || demon.type);
    return typeId > 0 ? `/demons/type/${typeId}` : '';
  }

  function renderAttackIcon() {
    return renderIcon('attack', { className: 'combat-stat-icon' });
  }

  function renderSpeedIcon() {
    return renderIcon('speed', { className: 'combat-stat-icon' });
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
    const position = String(demon.preferredPosition || demon.position || '').toLowerCase();
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

  function getDemonImageAlt(demon = {}, title = 'Demon', rarity = '') {
    const trait = getTraitLabel(demon);
    const position = getPositionLabel(demon);
    const parts = [
      rarity,
      title,
      trait ? `${trait.toLowerCase()} demon` : 'demon',
      position ? `for ${position.toLowerCase()} teams` : '',
      'in Among Demons'
    ].filter(Boolean);
    return parts.join(' ');
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
