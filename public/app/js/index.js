(function() {
  'use strict';

  const API = {
    demons: '/api/game/demons',
    types: '/api/game/demon-types'
  };

  const MAX_VISIBLE_TYPES = 11;
  const currentType = getCurrentTypeFromPath();
  const elements = getPageElements();
  const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
  const formatTraitLabel = window.AmongDemons.ui.formatTraitLabel || window.AmongDemons.ui.formatRoleLabel;
  const getPositionLabel = window.AmongDemons.ui.getDemonPositionLabel;

  if (!elements) return;

  setStaticPageState();
  onReady(init);

  async function init() {
    try {
      const catalog = await loadCatalog();
      const totalTypes = getTotalTypes(catalog.types, catalog.demons);
      const typeInfo = catalog.types[String(currentType)];

      elements.title.textContent = typeInfo?.name || 'Unknown';
      elements.typeInfo.innerHTML = renderTypeInfo(typeInfo);
      elements.grid.innerHTML = renderDemonCards(catalog.demonsByType[currentType] || [], catalog.types);
      elements.pagination.innerHTML = renderPagination(totalTypes);
      renderAdjacentTypeLinks(totalTypes);
    } catch (error) {
      console.error('Error loading demon data:', error);
      elements.grid.innerHTML = '<div class="text-center text-danger">Failed to load demon data. Please try again later.</div>';
      elements.pagination.innerHTML = '';
      renderAdjacentTypeLinks(0);
    }
  }

  async function loadCatalog() {
    const [demons, types] = await Promise.all([
      fetchJson(API.demons),
      fetchJson(API.types)
    ]);

    return {
      demons,
      types,
      demonsByType: groupByType(demons)
    };
  }

  async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Request failed: ${url}`);
    }

    return response.json();
  }

  function renderDemonCards(demons, types) {
    return demons.map((demon) => `
      <div class="col">
        ${renderSharedDemonCard({
          ...demon,
          species: types[String(demon.type)]?.name || `Type ${demon.type}`
        })}
      </div>
    `).join('');
  }

  function renderTypeInfo(typeInfo) {
    if (!typeInfo) {
      return '<p class="m-0 text-center text-body-secondary">No type data found.</p>';
    }

    return `
      <div class="demon-type-info-heading">
        ${renderInfoBadge('Trait', typeInfo.role)}
        ${renderInfoBadge('Targeting', typeInfo.targeting)}
        ${renderInfoBadge('Position', typeInfo.preferredPosition)}
        ${renderInfoBadge('Spawn Weight', typeInfo.spawnWeight)}
      </div>
      <div class="demon-type-info-grid">
        <article>
          <h2>Base Stats</h2>
          <div class="type-stat-row">
            ${renderStatPill('HP', typeInfo.baseStats?.hp)}
            ${renderStatPill('ATK', typeInfo.baseStats?.atk)}
            ${renderStatPill('SPD', typeInfo.baseStats?.speed)}
          </div>
        </article>
        <article>
          <h2>Ability</h2>
          <dl class="type-detail-list">
            ${renderObjectDetails(typeInfo.ability)}
          </dl>
        </article>
        <article>
          <h2>Strengths</h2>
          ${renderTextList(typeInfo.strengths)}
        </article>
        <article>
          <h2>Weaknesses</h2>
          ${renderTextList(typeInfo.weaknesses)}
        </article>
        <article class="type-rarity-panel">
          <h2>Rarity Scaling</h2>
          <div class="type-rarity-grid">
            ${renderRarityMultipliers(typeInfo.rarityMultiplier)}
          </div>
        </article>
      </div>
    `;
  }

  function renderInfoBadge(label, value) {
    const displayValue = label === 'Trait'
      ? formatTraitLabel(value)
      : label === 'Position'
        ? getPositionLabel({ preferredPosition: value })
        : formatValue(value);

    return `
      <span class="type-info-badge">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(displayValue)}</strong>
      </span>
    `;
  }

  function renderStatPill(label, value) {
    return `
      <span class="type-stat-pill">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(formatValue(value))}</strong>
      </span>
    `;
  }

  function renderObjectDetails(details) {
    if (!details || typeof details !== 'object') {
      return '<div class="type-empty-text">No ability data.</div>';
    }

    return Object.entries(details).map(([key, value]) => `
      <div>
        <dt>${escapeHtml(formatLabel(key))}</dt>
        <dd>${escapeHtml(formatValue(value))}</dd>
      </div>
    `).join('');
  }

  function renderTextList(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<p class="type-empty-text">None listed.</p>';
    }

    return `<ul class="type-text-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
  }

  function renderRarityMultipliers(multipliers) {
    if (!multipliers || typeof multipliers !== 'object') {
      return '<span class="type-empty-text">No rarity data.</span>';
    }

    return Object.entries(multipliers).map(([rarity, multiplier]) => `
      <span class="type-rarity-pill type-rarity-${escapeHtml(rarity)}">
        <span>${escapeHtml(formatLabel(rarity))}</span>
        <strong>x${escapeHtml(Number(multiplier).toFixed(2))}</strong>
      </span>
    `).join('');
  }

  function renderPagination(totalPages) {
    return Array.from({ length: Math.min(totalPages, MAX_VISIBLE_TYPES) }, (_, index) => {
      const typeNumber = index + 1;

      return typeNumber === currentType
        ? `<li class="page-item active" aria-current="page"><span class="page-link d-flex align-items-center justify-content-center">${typeNumber}</span></li>`
        : `<li class="page-item"><a class="page-link d-flex align-items-center justify-content-center" href="/demons/type/${typeNumber}">${typeNumber}</a></li>`;
    }).join('');
  }

  function renderAdjacentTypeLinks(totalPages) {
    elements.previous.innerHTML = currentType > 1
      ? renderAdjacentLink(currentType - 1, 'Previous', 'ps-2', '&laquo;')
      : '&nbsp;&nbsp;&nbsp;&nbsp;';

    elements.next.innerHTML = currentType < totalPages
      ? renderAdjacentLink(currentType + 1, 'Next', 'pe-2', '&raquo;')
      : '&nbsp;&nbsp;&nbsp;&nbsp;';
  }

  function renderAdjacentLink(typeNumber, label, paddingClass, text) {
    return `<a class="text-decoration-none ${paddingClass}" href="/demons/type/${typeNumber}" style="font-size: 2rem; line-height: 1;" aria-label="${label}">${text}</a>`;
  }

  function groupByType(demons) {
    return demons.reduce((groups, demon) => {
      groups[demon.type] ||= [];
      groups[demon.type].push(demon);
      return groups;
    }, {});
  }

  function getTotalTypes(types, demons) {
    const typeKeys = Object.keys(types).map(Number);
    const demonTypes = demons.map((demon) => demon.type);

    return Math.max(0, ...typeKeys, ...demonTypes);
  }

  function getCurrentTypeFromPath() {
    const match = window.location.pathname.match(/\/demons\/type\/(\d+)\/?$/);
    return match ? parseInt(match[1], 10) : 1;
  }

  function getPageElements() {
    const pageElements = {
      currentType: document.getElementById('type-number'),
      title: document.getElementById('demon-title'),
      typeInfo: document.getElementById('type-info-panel'),
      grid: document.getElementById('demons-grid'),
      pagination: document.getElementById('pagination'),
      previous: document.getElementById('previous-type-slot'),
      next: document.getElementById('next-type-slot')
    };

    return Object.values(pageElements).every(Boolean) ? pageElements : null;
  }

  function setStaticPageState() {
    elements.currentType.textContent = currentType;
    document.title = `Demon Type ${currentType} - Among Demons NFTs`;

    const ogImageElement = document.querySelector('meta[property="og:image"]');
    if (ogImageElement) {
      ogImageElement.setAttribute('content', `/app/images/demons/thumbnails/${currentType}.png`);
    }
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }

  function formatLabel(value) {
    return String(value)
      .replace(/[_-]+/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatValue(value) {
    if (Array.isArray(value)) {
      return value.join(' - ');
    }

    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }

    if (value === null || typeof value === 'undefined') {
      return 'None';
    }

    return formatLabel(value);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }
})();
