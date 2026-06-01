(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
  const openDemonDetailsModal = window.AmongDemons.ui.openDemonDetailsModal;
  const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
  const updateNavAccount = window.AmongDemons.ui.updateNavAccount || (() => {});
  const clearNavAccount = window.AmongDemons.ui.clearNavAccount || (() => {});
  const RARITY_ORDER = {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6
  };
  const RARITIES = Object.keys(RARITY_ORDER);
  const state = {
    player: window.AmongDemons.getSession().player || null,
    collection: [],
    catalog: [],
    visibleSlots: [],
    types: {},
    isAuthenticated: Boolean(window.AmongDemons.getToken()),
    filters: {
      type: 'all',
      rarity: 'all',
      sort: 'default',
      hideMissing: false
    },
    filtersOpen: false
  };
  const elements = {};

  onReady(init);

  async function init() {
    cacheElements();
    bindActions();
    syncAuthenticatedUi();
    syncFiltersToggle();
    await refreshCollection();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'collectionSummary',
      'collectionMessage',
      'collectionCount',
      'collectionGrid',
      'typeFilter',
      'rarityFilter',
      'sortOrder',
      'hideMissingFilter',
      'filtersToggleBtn',
      'collectionControlsPanel'
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

    elements.filtersToggleBtn.addEventListener('click', () => {
      state.filtersOpen = !state.filtersOpen;
      syncFiltersToggle();
    });

    elements.typeFilter.addEventListener('change', () => {
      state.filters.type = elements.typeFilter.value;
      renderCollection();
    });

    elements.rarityFilter.addEventListener('change', () => {
      state.filters.rarity = elements.rarityFilter.value;
      renderCollection();
    });

    elements.sortOrder.addEventListener('change', () => {
      state.filters.sort = elements.sortOrder.value;
      renderCollection();
    });

    elements.hideMissingFilter.addEventListener('change', () => {
      state.filters.hideMissing = elements.hideMissingFilter.checked;
      renderCollection();
    });

    elements.collectionGrid.addEventListener('click', (event) => {
      const card = event.target.closest('.collection-demon-card[data-demon-id]');
      if (!card) return;

      const demon = state.visibleSlots.find((item) => String(item.id) === card.dataset.demonId);
      if (!demon) return;

      openDemonDetailsModal(withTypeName(demon), {
        actions: getDemonDetailsActions(demon)
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
      state.isAuthenticated = Boolean(window.AmongDemons.getToken());
      syncAuthenticatedUi();

      try {
        if (state.isAuthenticated) {
          const [me, demons] = await Promise.all([
            api('/api/auth/me'),
            api('/api/demons'),
            loadDemonTypes(),
            loadDemonCatalog()
          ]);

          state.player = me.player;
          state.collection = demons.demons || [];
        } else {
          state.player = null;
          state.collection = [];
          await Promise.all([
            loadDemonTypes(),
            loadDemonCatalog()
          ]);
        }

        populateFilters();
        renderCollection();
      } catch (error) {
        await handleCollectionError(error);
      }
    });
  }

  function renderCollection() {
    const ownedDemons = getOwnedDemons();
    const totalSlots = getTotalSlots();
    const visibleSlots = getVisibleCollectionSlots(ownedDemons);
    const collectedCount = ownedDemons.length;
    const playerName = state.player?.username || '';

    state.visibleSlots = visibleSlots;
    elements.navPlayerName.textContent = playerName;
    if (state.player) {
      updateNavAccount(state.player);
    } else {
      clearNavAccount();
    }
    elements.collectionCount.textContent = totalSlots ? `${collectedCount}/${totalSlots}` : String(collectedCount);
    elements.collectionSummary.textContent = totalSlots
      ? renderSummary(visibleSlots.length, collectedCount, totalSlots)
      : 'Collected and summoned demons will appear here.';
    elements.collectionGrid.innerHTML = visibleSlots.length
      ? renderDemonCards(visibleSlots)
      : collectedCount
        ? renderNoMatchesState()
        : renderEmptyState();
  }

  function renderDemonCards(demons) {
    return demons.map((demon) => demon.isMissing
      ? renderMissingDemonCard(demon)
      : renderOwnedDemonCard(demon)
    ).join('');
  }

  function renderOwnedDemonCard(demon) {
    return `
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
    `;
  }

  function renderMissingDemonCard(demon) {
    const typeName = getTypeName(demon.typeId);
    const rarity = capitalize(demon.rarity);

    return `
      <div class="collection-grid-item collection-grid-item-missing">
        ${renderSharedDemonCard(withTypeName(demon), {
          className: 'collection-demon-card collection-missing-card',
          showStats: false,
          footerHtml: '<div class="collection-missing-label">Missing</div>',
          attributes: {
            'data-demon-id': demon.id,
            role: 'button',
            tabindex: '0',
            'aria-label': `View details for missing ${rarity} ${typeName}`,
            title: `Missing ${rarity} ${typeName}`
          }
        })}
      </div>
    `;
  }

  function getVisibleCollectionSlots(ownedDemons = getOwnedDemons()) {
    const ownedBySlot = new Map(ownedDemons.map((demon) => [getSlotKeyForDemon(demon), demon]));

    return state.catalog
      .map((asset) => ownedBySlot.get(getSlotKey(asset.type, asset.rarity)) || createMissingDemon(asset))
      .filter((demon) => !state.filters.hideMissing || !demon.isMissing)
      .filter(matchesFilters)
      .sort(compareCollectionSlots);
  }

  function getOwnedDemons() {
    const ownedBySlot = new Map();

    state.collection.forEach((demon) => {
      const slotKey = getSlotKeyForDemon(demon);
      if (slotKey && !ownedBySlot.has(slotKey)) {
        ownedBySlot.set(slotKey, demon);
      }
    });

    return [...ownedBySlot.values()];
  }

  function createMissingDemon(asset) {
    const typeId = Number(asset.type);

    return {
      id: `missing-${asset.id}`,
      sourceDemonId: asset.id,
      typeId,
      species: getTypeName(typeId),
      rarity: asset.rarity,
      imageUrl: asset.image_url || asset.imageUrl,
      preferredPosition: asset.preferredPosition || state.types[String(typeId)]?.preferredPosition || '',
      role: state.types[String(typeId)]?.role || '',
      isMissing: true
    };
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

  async function loadDemonCatalog() {
    if (state.catalog.length) return state.catalog;
    state.catalog = await api('/api/game/demons');
    return state.catalog;
  }

  function populateFilters() {
    elements.typeFilter.innerHTML = [
      '<option value="all">All Types</option>',
      ...getCatalogTypeIds().map((typeId) => {
        const typeName = getTypeName(typeId);
        return `<option value="${escapeHtml(typeId)}">${escapeHtml(typeName)}</option>`;
      })
    ].join('');
    elements.typeFilter.value = getSelectValue(elements.typeFilter, state.filters.type);
    state.filters.type = elements.typeFilter.value;

    elements.rarityFilter.innerHTML = [
      '<option value="all">All Rarities</option>',
      ...RARITIES.map((rarity) => (
        `<option value="${escapeHtml(rarity)}">${escapeHtml(capitalize(rarity))}</option>`
      ))
    ].join('');
    elements.rarityFilter.value = getSelectValue(elements.rarityFilter, state.filters.rarity);
    state.filters.rarity = elements.rarityFilter.value;
    elements.hideMissingFilter.checked = state.filters.hideMissing;
  }

  function matchesFilters(demon) {
    return (state.filters.type === 'all' || String(demon.typeId || demon.type) === state.filters.type)
      && (state.filters.rarity === 'all' || demon.rarity === state.filters.rarity);
  }

  function compareCollectionSlots(a, b) {
    if (state.filters.sort === 'default') {
      return compareNumber(a.typeId, b.typeId)
        || compareNumber(getRarityRank(a.rarity), getRarityRank(b.rarity));
    }

    if (a.isMissing !== b.isMissing) return a.isMissing ? 1 : -1;

    return compareNumber(b[state.filters.sort], a[state.filters.sort])
      || compareNumber(a.typeId, b.typeId)
      || compareNumber(getRarityRank(a.rarity), getRarityRank(b.rarity))
      || compareNumber(b.hp, a.hp)
      || compareNumber(b.id, a.id);
  }

  function renderSummary(shownCount, collectedCount, totalSlots) {
    if (!state.isAuthenticated) {
      return `Sign in to track your collection. All ${totalSlots} demon slots are shown as missing.`;
    }

    const collectedText = `${collectedCount} of ${totalSlots} demon slots collected.`;
    const shownText = shownCount === totalSlots && !state.filters.hideMissing
      ? ''
      : ` ${shownCount} shown.`;

    return `${collectedText}${shownText}`;
  }

  function getDemonDetailsActions(demon) {
    if (demon.isMissing) {
      return [
        {
          label: 'Enter Dungeon',
          icon: 'play',
          variant: 'primary',
          href: '/dungeon'
        }
      ];
    }

    return [
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
    ];
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

  function getCatalogTypeIds() {
    const typeIds = [
      ...Object.keys(state.types).map(Number),
      ...state.catalog.map((demon) => Number(demon.type))
    ].filter(Boolean);

    return [...new Set(typeIds)].sort((a, b) => a - b);
  }

  function getTotalSlots() {
    return state.catalog.length;
  }

  function getTypeName(typeId) {
    return state.types[String(typeId)]?.name || `Type ${typeId}`;
  }

  function getSelectValue(select, preferredValue) {
    return [...select.options].some((option) => option.value === preferredValue)
      ? preferredValue
      : 'all';
  }

  function getSlotKeyForDemon(demon) {
    return getSlotKey(demon.typeId || demon.type, demon.rarity);
  }

  function getSlotKey(typeId, rarity) {
    const normalizedTypeId = Number(typeId);
    const normalizedRarity = String(rarity || '').toLowerCase();

    return normalizedTypeId && normalizedRarity
      ? `${normalizedTypeId}:${normalizedRarity}`
      : '';
  }

  function getRarityRank(rarity) {
    return RARITY_ORDER[rarity] || 0;
  }

  function compareNumber(a, b) {
    return (Number(a) || 0) - (Number(b) || 0);
  }

  function syncFiltersToggle() {
    elements.collectionControlsPanel.classList.toggle('is-mobile-open', state.filtersOpen);
    elements.filtersToggleBtn.setAttribute('aria-expanded', String(state.filtersOpen));
    const label = elements.filtersToggleBtn.querySelector('span');
    if (label) label.textContent = state.filtersOpen ? 'Hide Filters' : 'Show Filters';
  }

  function syncAuthenticatedUi() {
    if (!state.isAuthenticated) {
      state.filters = {
        type: 'all',
        rarity: 'all',
        sort: 'default',
        hideMissing: false
      };
      state.filtersOpen = false;
    }

    elements.collectionControlsPanel.classList.toggle('d-none', !state.isAuthenticated);
    elements.filtersToggleBtn.classList.toggle('d-none', !state.isAuthenticated);
  }

  async function handleCollectionError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      state.isAuthenticated = false;
      state.player = null;
      state.collection = [];
      syncAuthenticatedUi();

      try {
        await Promise.all([
          loadDemonTypes(),
          loadDemonCatalog()
        ]);
        populateFilters();
        renderCollection();
      } catch (publicError) {
        setMessage(publicError.message || 'Something went wrong.', 'danger');
      }

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
