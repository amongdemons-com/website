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

  if (!elements) return;

  setStaticPageState();
  onReady(init);

  async function init() {
    try {
      const catalog = await loadCatalog();
      const totalTypes = getTotalTypes(catalog.types, catalog.demons);

      elements.title.textContent = catalog.types[currentType]?.name || 'Unknown';
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
})();
