(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
  const openDemonDetailsModal = window.AmongDemons.ui.openDemonDetailsModal;
  const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
  const PAGE_SIZE = 24;
  const RARITY_ORDER = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6
  };
  const state = {
    player: window.AmongDemons.getSession().player || null,
    collection: [],
    types: {},
    filters: {
      type: 'all',
      rarity: 'all',
      sort: 'default'
    },
    page: 1
  };
  const elements = {};

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      window.location.href = '/login';
      return;
    }

    cacheElements();
    bindActions();
    await refreshCollection();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'collectionSummary',
      'collectionMessage',
      'collectionCount',
      'collectionGrid',
      'collectionPagination',
      'typeFilter',
      'rarityFilter',
      'sortOrder'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });

    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.logoutBtn = document.getElementById('logoutBtn');
  }

  function bindActions() {
    elements.logoutBtn.addEventListener('click', () => {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
    });

    elements.refreshBtn.addEventListener('click', refreshCollection);

    elements.typeFilter.addEventListener('change', () => {
      state.filters.type = elements.typeFilter.value;
      state.page = 1;
      renderCollection();
    });

    elements.rarityFilter.addEventListener('change', () => {
      state.filters.rarity = elements.rarityFilter.value;
      state.page = 1;
      renderCollection();
    });

    elements.sortOrder.addEventListener('change', () => {
      state.filters.sort = elements.sortOrder.value;
      state.page = 1;
      renderCollection();
    });

    elements.collectionPagination.addEventListener('click', (event) => {
      const link = event.target.closest('[data-page]');
      if (!link) return;

      event.preventDefault();
      const nextPage = Number(link.dataset.page);
      if (!Number.isInteger(nextPage) || nextPage === state.page) return;

      state.page = nextPage;
      renderCollection();
    });

    elements.collectionGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.collection-demon-card[data-demon-id]');
      if (!card) return;

      const demon = state.collection.find((item) => String(item.id) === card.dataset.demonId);
      if (!demon) return;

      openDemonDetailsModal(withTypeName(demon), {
        actions: [
          {
            label: 'Banish',
            icon: 'trash',
            variant: 'outline-danger',
            onClick: () => setMessage('Banishing is not available yet.', 'warning')
          },
          {
            label: 'Train',
            icon: 'crosshair',
            variant: 'success',
            onClick: () => setMessage('Training is not available yet.', 'warning')
          }
        ]
      });
    });

    elements.collectionGrid.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const card = event.target.closest('.collection-demon-card[data-demon-id]');
      if (!card) return;

      event.preventDefault();
      card.click();
    });
  }

  async function refreshCollection() {
    await withBusy(elements.refreshBtn, async () => {
      setMessage('', 'danger');

      try {
        const [me, demons] = await Promise.all([
          api('/api/auth/me'),
          api('/api/demons'),
          loadDemonTypes()
        ]);

        state.player = me.player;
        state.collection = demons.demons || [];
        populateFilters();
        state.page = clampPage(state.page, getFilteredDemons().length);
        renderCollection();
      } catch (error) {
        handleAuthError(error);
      }
    });
  }

  function renderCollection() {
    const totalCount = state.collection.length;
    const filteredDemons = getFilteredDemons();
    const count = filteredDemons.length;
    const totalPages = getTotalPages(count);
    state.page = clampPage(state.page, count);
    const pageDemons = filteredDemons.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    const playerName = state.player?.username || '';

    elements.navPlayerName.textContent = playerName;
    elements.collectionCount.textContent = String(totalCount);
    elements.collectionSummary.textContent = totalCount
      ? renderSummary(count, totalCount, totalPages)
      : 'Collected and summoned demons will appear here.';
    elements.collectionGrid.innerHTML = totalCount
      ? count
        ? renderDemonCards(pageDemons)
        : renderNoMatchesState()
      : renderEmptyState();
    elements.collectionPagination.innerHTML = renderPagination(totalPages);
    elements.collectionPagination.classList.toggle('d-none', totalPages <= 1);
  }

  function renderDemonCards(demons) {
    return demons.map((demon) => `
      <div class="collection-grid-item">
        ${renderSharedDemonCard(withTypeName(demon), {
          className: 'collection-demon-card',
          attributes: {
            'data-demon-id': demon.id,
            role: 'button',
            tabindex: '0'
          }
        })}
      </div>
    `).join('');
  }

  function withTypeName(demon) {
    const typeId = demon.typeId || demon.type;
    const type = state.types[String(typeId)] || {};
    return {
      ...demon,
      typeName: type.name || (typeId ? `Type ${typeId}` : ''),
      preferredPosition: demon.preferredPosition || type.preferredPosition || '',
      role: demon.role || type.role || ''
    };
  }

  async function loadDemonTypes() {
    if (Object.keys(state.types).length) return state.types;
    state.types = await api('/api/game/demon-types');
    return state.types;
  }

  function populateFilters() {
    elements.typeFilter.innerHTML = [
      '<option value="all">All Types</option>',
      ...getCollectionTypeIds().map((typeId) => {
        const typeName = state.types[String(typeId)]?.name || `Type ${typeId}`;
        return `<option value="${escapeHtml(typeId)}">${escapeHtml(typeName)}</option>`;
      })
    ].join('');
    elements.typeFilter.value = getSelectValue(elements.typeFilter, state.filters.type);
    state.filters.type = elements.typeFilter.value;

    elements.rarityFilter.innerHTML = [
      '<option value="all">All Rarities</option>',
      ...getCollectionRarities().map((rarity) => (
        `<option value="${escapeHtml(rarity)}">${escapeHtml(capitalize(rarity))}</option>`
      ))
    ].join('');
    elements.rarityFilter.value = getSelectValue(elements.rarityFilter, state.filters.rarity);
    state.filters.rarity = elements.rarityFilter.value;
  }

  function getFilteredDemons() {
    return state.collection
      .filter((demon) => state.filters.type === 'all' || String(demon.typeId) === state.filters.type)
      .filter((demon) => state.filters.rarity === 'all' || demon.rarity === state.filters.rarity)
      .sort(compareDemons);
  }

  function compareDemons(a, b) {
    if (state.filters.sort === 'default') {
      return compareNumber(b.typeId, a.typeId)
        || compareNumber(getRarityRank(b.rarity), getRarityRank(a.rarity))
        || compareNumber(b.hp, a.hp)
        || compareNumber(b.atk, a.atk)
        || compareNumber(b.speed, a.speed)
        || compareNumber(b.id, a.id);
    }

    return compareNumber(b[state.filters.sort], a[state.filters.sort])
      || compareNumber(b.typeId, a.typeId)
      || compareNumber(getRarityRank(b.rarity), getRarityRank(a.rarity))
      || compareNumber(b.hp, a.hp)
      || compareNumber(b.id, a.id);
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) return '';

    return `
      <ul class="pagination justify-content-center mb-0">
        ${renderPageItem(state.page - 1, '&laquo;', state.page === 1, 'Previous')}
        ${Array.from({ length: totalPages }, (_, index) => renderPageItem(index + 1, index + 1, false, `Page ${index + 1}`)).join('')}
        ${renderPageItem(state.page + 1, '&raquo;', state.page === totalPages, 'Next')}
      </ul>
    `;
  }

  function renderPageItem(page, label, disabled, ariaLabel) {
    const active = page === state.page && !disabled;
    const className = [
      'page-item',
      active ? 'active' : '',
      disabled ? 'disabled' : ''
    ].filter(Boolean).join(' ');
    const attributes = [
      `class="page-link"`,
      `href="#"`,
      `aria-label="${escapeHtml(ariaLabel)}"`,
      disabled ? 'tabindex="-1" aria-disabled="true"' : `data-page="${page}"`
    ].filter(Boolean).join(' ');

    return `
      <li class="${className}" ${active ? 'aria-current="page"' : ''}>
        <a ${attributes}>${label}</a>
      </li>
    `;
  }

  function renderSummary(count, totalCount, totalPages) {
    const filteredText = count === totalCount
      ? `${totalCount} demon${totalCount === 1 ? '' : 's'} in your collection.`
      : `${count} of ${totalCount} demon${totalCount === 1 ? '' : 's'} shown.`;
    const pageText = totalPages > 1 ? ` Page ${state.page} of ${totalPages}.` : '';

    return `${filteredText}${pageText}`;
  }

  function renderEmptyState() {
    return `
      <div class="collection-grid-full">
        <div class="empty-state collection-empty-state">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="">
          <div>
            <h2 class="h5 mb-2">No demons collected yet</h2>
            <p class="text-muted mb-0">Earn, summon, and choose demons to bring them here.</p>
          </div>
          <a class="btn btn-primary" href="/dungeon">
            ${renderIcon('play')}
            Start Dungeon
          </a>
        </div>
      </div>
    `;
  }

  function renderNoMatchesState() {
    return `
      <div class="collection-grid-full">
        <div class="empty-state collection-empty-state">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="">
          <div>
            <h2 class="h5 mb-2">No demons match these filters</h2>
            <p class="text-muted mb-0">Try another type or rarity.</p>
          </div>
        </div>
      </div>
    `;
  }

  function getCollectionTypeIds() {
    return [...new Set(state.collection.map((demon) => Number(demon.typeId)).filter(Boolean))]
      .sort((a, b) => b - a);
  }

  function getCollectionRarities() {
    return [...new Set(state.collection.map((demon) => demon.rarity).filter(Boolean))]
      .sort((a, b) => getRarityRank(b) - getRarityRank(a));
  }

  function getSelectValue(select, preferredValue) {
    return [...select.options].some((option) => option.value === preferredValue)
      ? preferredValue
      : 'all';
  }

  function getRarityRank(rarity) {
    return RARITY_ORDER[rarity] || 0;
  }

  function compareNumber(a, b) {
    return (Number(a) || 0) - (Number(b) || 0);
  }

  function getTotalPages(count) {
    return Math.max(1, Math.ceil(count / PAGE_SIZE));
  }

  function clampPage(page, count) {
    return Math.min(Math.max(Number(page) || 1, 1), getTotalPages(count));
  }

  function handleAuthError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
      return;
    }

    setMessage(error.message || 'Something went wrong.', 'danger');
  }

  function setMessage(text, type) {
    elements.collectionMessage.textContent = text;
    elements.collectionMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  async function withBusy(button, task) {
    button.disabled = true;
    try {
      await task();
    } finally {
      button.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function capitalize(value) {
    if (!value) return '';
    return String(value).charAt(0).toUpperCase() + String(value).slice(1);
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
