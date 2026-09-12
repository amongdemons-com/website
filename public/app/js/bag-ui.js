(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const audio = window.AmongDemons.audio;
  const RARITY_COLORS = {
    common: '#D1D5D8',
    uncommon: '#41A85F',
    rare: '#2C82C9',
    epic: '#9365B8',
    legendary: '#FAC51C',
    mythic: '#E25041'
  };
  const getRarityColor = window.AmongDemons.ui.getRarityColor
    || ((rarity) => RARITY_COLORS[String(rarity || '').toLowerCase()] || RARITY_COLORS.common);
  const renderItemVisual = window.AmongDemons.bagVisuals?.renderItemVisual
    || (() => '<span class="bag-item-renderer bag-unknown-visual" aria-hidden="true"></span>');
  const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  const BAG_SORT_STORAGE_PREFIX = 'amongdemons-bag-sort';
  const BAG_SORT_OPTIONS = new Set(['type', 'rarity', 'name', 'quantity']);
  const DEFAULT_BAG_SORT = 'type';
  const state = {
    items: [],
    selectedKey: null,
    filter: 'all',
    sort: DEFAULT_BAG_SORT,
    inspectedKey: null,
    lastPointerType: 'mouse',
    slotCapacity: 24,
    slotColumns: 4
  };
  const elements = {};
  let resizeFrame = 0;
  let tooltipHideTimer = 0;

  onReady(init);

  async function init() {
    audio?.setScene({ music: 'music.default' });
    cacheElements();
    bindActions();

    if (!window.AmongDemons.getToken()) {
      try {
        await window.AmongDemons.ensurePlayableSession();
      } catch (error) {
        window.location.href = window.AmongDemons.appUrl('/login');
        return;
      }
    }

    restoreSortPreference();
    await refreshBag();
  }

  function cacheElements() {
    ['bagBackLink', 'bagCount', 'bagFilter', 'bagSort', 'bagLoading', 'bagGridViewport', 'bagGrid', 'bagItemTooltip', 'bagDetailModal', 'bagDetailContent', 'bagDetailTitle']
      .forEach((id) => { elements[id] = document.getElementById(id); });
  }

  function bindActions() {
    elements.bagBackLink?.addEventListener('click', (event) => {
      if (window.history.length <= 1) return;
      event.preventDefault();
      window.history.back();
    });
    elements.bagFilter.addEventListener('change', () => {
      state.filter = elements.bagFilter.value;
      renderBag();
    });
    elements.bagSort.addEventListener('change', () => {
      state.sort = BAG_SORT_OPTIONS.has(elements.bagSort.value)
        ? elements.bagSort.value
        : DEFAULT_BAG_SORT;
      saveSortPreference();
      renderBag();
    });
    elements.bagGrid.addEventListener('pointerdown', (event) => {
      state.lastPointerType = event.pointerType || 'mouse';
    });
    elements.bagGrid.addEventListener('pointerover', (event) => {
      const item = event.target.closest('[data-bag-key]');
      if (!item || item.contains(event.relatedTarget) || event.pointerType === 'touch') return;
      showItemTooltip(item.dataset.bagKey, item);
    });
    elements.bagGrid.addEventListener('pointerout', (event) => {
      const item = event.target.closest('[data-bag-key]');
      if (!item || item.contains(event.relatedTarget) || elements.bagItemTooltip.contains(event.relatedTarget) || state.inspectedKey === item.dataset.bagKey) return;
      scheduleItemTooltipHide();
    });
    elements.bagGrid.addEventListener('focusin', (event) => {
      const item = event.target.closest('[data-bag-key]');
      if (item) showItemTooltip(item.dataset.bagKey, item);
    });
    elements.bagGrid.addEventListener('focusout', (event) => {
      const item = event.target.closest('[data-bag-key]');
      if (!item || item.contains(event.relatedTarget) || elements.bagItemTooltip.contains(event.relatedTarget) || state.inspectedKey === item.dataset.bagKey) return;
      scheduleItemTooltipHide();
    });
    elements.bagGrid.addEventListener('click', (event) => {
      const item = event.target.closest('[data-bag-key]');
      if (!item) return;
      const itemKey = item.dataset.bagKey;
      const touchLike = state.lastPointerType === 'touch' || window.matchMedia('(hover: none), (pointer: coarse)').matches;
      if (touchLike && state.inspectedKey !== itemKey) {
        state.inspectedKey = itemKey;
        renderBag();
        window.requestAnimationFrame(() => {
          const inspectedItem = elements.bagGrid.querySelector(`[data-bag-key="${cssEscape(itemKey)}"]`);
          inspectedItem?.focus({ preventScroll: true });
          showItemTooltip(itemKey, inspectedItem);
        });
        return;
      }
      openItem(itemKey);
    });
    document.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-bag-key], #bagItemTooltip')) return;
      state.inspectedKey = null;
      elements.bagGrid.querySelector('.is-inspecting')?.classList.remove('is-inspecting');
      hideItemTooltip();
    });
    elements.bagItemTooltip.addEventListener('pointerover', cancelItemTooltipHide);
    elements.bagItemTooltip.addEventListener('pointerout', (event) => {
      if (elements.bagItemTooltip.contains(event.relatedTarget)) return;
      const relatedItem = event.relatedTarget?.closest?.('[data-bag-key]');
      if (relatedItem?.dataset.bagKey === elements.bagItemTooltip.dataset.bagKey) return;
      if (!state.inspectedKey) scheduleItemTooltipHide();
    });
    elements.bagItemTooltip.addEventListener('focusin', cancelItemTooltipHide);
    elements.bagItemTooltip.addEventListener('focusout', (event) => {
      if (elements.bagItemTooltip.contains(event.relatedTarget) || state.inspectedKey) return;
      scheduleItemTooltipHide();
    });
    elements.bagItemTooltip.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bag-tooltip-open]');
      if (button) openItem(button.dataset.bagTooltipOpen);
    });
    elements.bagGridViewport.addEventListener('scroll', () => {
      if (!state.inspectedKey) {
        hideItemTooltip();
        return;
      }
      const item = elements.bagGrid.querySelector(`[data-bag-key="${cssEscape(state.inspectedKey)}"]`);
      showItemTooltip(state.inspectedKey, item);
    }, { passive: true });

    const resizeObserver = new ResizeObserver(scheduleSlotMeasurement);
    resizeObserver.observe(elements.bagGridViewport);
    window.addEventListener('resize', scheduleSlotMeasurement, { passive: true });
  }

  async function refreshBag() {
    elements.bagLoading.hidden = false;
    elements.bagGridViewport.hidden = true;
    try {
      const payload = await api('/api/bag');
      applyPayload(payload);
    } catch (error) {
      showError(error);
      state.items = [];
      renderBag();
    } finally {
      elements.bagLoading.hidden = true;
      elements.bagGridViewport.hidden = false;
      scheduleSlotMeasurement();
    }
  }

  function applyPayload(payload = {}) {
    state.items = Array.isArray(payload.items) ? payload.items.filter(item => item.itemType !== 'echo') : [];
    renderBag();
    if (state.selectedKey) {
      const item = getSelectedItem();
      if (item) renderItemDetail(item);
    }
  }

  function renderBag() {
    const items = state.items
      .filter((item) => state.filter === 'all' || item.itemType === state.filter)
      .sort(compareItems);
    elements.bagCount.textContent = `${state.items.length} ${state.items.length === 1 ? 'stack' : 'stacks'}`;
    const emptySlotCount = Math.max(0, state.slotCapacity - items.length);
    elements.bagGrid.style.setProperty('--bag-columns', state.slotColumns);
    elements.bagGrid.innerHTML = [
      ...items.map(renderItem),
      ...Array.from({ length: emptySlotCount }, renderEmptySlot)
    ].join('');
    elements.bagGridViewport.classList.toggle('is-scrollable', items.length > state.slotCapacity);
    if (!state.inspectedKey) {
      hideItemTooltip();
      return;
    }

    const inspectedItem = elements.bagGrid.querySelector(`[data-bag-key="${cssEscape(state.inspectedKey)}"]`);
    if (!inspectedItem) {
      state.inspectedKey = null;
      hideItemTooltip();
      return;
    }
    window.requestAnimationFrame(() => showItemTooltip(state.inspectedKey, inspectedItem));
  }

  function renderItem(item) {
    const rarity = normalizeRarity(item.rarity);
    const color = getRarityColor(rarity);
    const aria = `${item.name || item.itemKey}, quantity ${item.quantity}.`;

    return `
      <button class="bag-slot bag-item bag-item-kind-${escapeHtml(normalizeItemType(item.itemType))} ${state.inspectedKey === item.itemKey ? 'is-inspecting' : ''}" type="button" data-bag-key="${escapeHtml(item.itemKey)}" style="--item-rarity: ${escapeHtml(color)}" aria-label="${escapeHtml(aria)}">
        <span class="bag-rarity-diamond" aria-hidden="true"></span>
        <span class="bag-item-visual">
          ${renderItemVisual(item, { context: 'slot' })}
          <span class="bag-item-count">x${escapeHtml(formatNumber(item.quantity))}</span>
        </span>
      </button>
    `;
  }

  function renderEmptySlot() {
    return '<span class="bag-slot bag-slot-empty" aria-hidden="true"></span>';
  }

  function openItem(itemKey) {
    const item = state.items.find((candidate) => candidate.itemKey === itemKey);
    if (!item) return;
    state.inspectedKey = null;
    hideItemTooltip();
    state.selectedKey = itemKey;
    renderItemDetail(item);
    bootstrap.Modal.getOrCreateInstance(elements.bagDetailModal).show();
  }

  function renderItemDetail(item) {
    elements.bagDetailContent.innerHTML = `
      <div class="modal-header"><h2 class="modal-title h5" id="bagDetailTitle">${escapeHtml(item.name || item.itemKey)}</h2><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>
      <div class="modal-body"><p>Quantity: ${escapeHtml(formatNumber(item.quantity))}</p></div>
    `;
  }

  function getSelectedItem() {
    return state.items.find((item) => item.itemKey === state.selectedKey) || null;
  }

  function compareItems(a, b) {
    if (state.sort === 'type') return compareType(a, b) || compareRarity(a, b) || compareName(a, b);
    if (state.sort === 'rarity') return compareRarity(b, a) || compareName(a, b);
    if (state.sort === 'quantity') return Number(b.quantity) - Number(a.quantity) || compareRarity(b, a) || compareName(a, b);
    return compareName(a, b) || compareRarity(a, b);
  }

  function compareRarity(a, b) {
    return (RARITY_RANK[a.rarity] || 0) - (RARITY_RANK[b.rarity] || 0);
  }

  function compareType(a, b) {
    return String(a.itemType || '').localeCompare(String(b.itemType || ''));
  }

  function compareName(a, b) {
    return String(a.name || a.itemKey || '').localeCompare(String(b.name || b.itemKey || ''));
  }

  function restoreSortPreference() {
    let storedSort = '';
    try {
      storedSort = localStorage.getItem(getSortStorageKey()) || '';
    } catch (error) {
      // Storage can be unavailable in restricted browsing modes; use the default.
    }

    state.sort = BAG_SORT_OPTIONS.has(storedSort) ? storedSort : DEFAULT_BAG_SORT;
    elements.bagSort.value = state.sort;
  }

  function saveSortPreference() {
    if (!BAG_SORT_OPTIONS.has(state.sort)) return;
    try {
      localStorage.setItem(getSortStorageKey(), state.sort);
    } catch (error) {
      // Sorting still works for this visit even when persistence is unavailable.
    }
  }

  function getSortStorageKey() {
    const player = window.AmongDemons.getPlayer?.();
    const playerKey = player?.id || player?.username || 'browser';
    return `${BAG_SORT_STORAGE_PREFIX}:${playerKey}`;
  }

  function getItemStatus(item) {
    return item.description || '';
  }

  function showItemTooltip(itemKey, anchor) {
    const item = state.items.find((candidate) => candidate.itemKey === itemKey);
    if (!item || !anchor || !elements.bagItemTooltip) {
      hideItemTooltip();
      return;
    }

    const rarity = normalizeRarity(item.rarity);
    const tooltip = elements.bagItemTooltip;
    cancelItemTooltipHide();
    tooltip.dataset.bagKey = itemKey;
    tooltip.style.setProperty('--item-rarity', getRarityColor(rarity));
    tooltip.innerHTML = `
      <span class="bag-tooltip-rarity">${escapeHtml(capitalize(item.itemType))}</span>
      <strong class="bag-tooltip-title">${escapeHtml(item.name || item.itemKey)}</strong>
      <span class="bag-tooltip-meta">x${escapeHtml(formatNumber(item.quantity))}</span>
      <span class="bag-tooltip-meta">${escapeHtml(getItemStatus(item))}</span>
      <button class="bag-tooltip-action" type="button" data-bag-tooltip-open="${escapeHtml(itemKey)}">View details</button>
    `;
    tooltip.hidden = false;
    tooltip.classList.remove('is-below');

    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const margin = 12;
    const gap = 11;
    const isBelow = anchorRect.top < tooltipRect.height + gap + margin;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - margin,
      Math.max(margin, anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2))
    );
    const anchorCenter = anchorRect.left + (anchorRect.width / 2);
    const arrowOffset = Math.min(
      tooltipRect.width - 12,
      Math.max(12, anchorCenter - left)
    );
    const top = isBelow
      ? anchorRect.bottom + gap
      : anchorRect.top - tooltipRect.height - gap;

    tooltip.classList.toggle('is-below', isBelow);
    tooltip.style.setProperty('--tooltip-arrow-x', `${Math.round(arrowOffset)}px`);
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(Math.max(margin, top))}px`;
  }

  function hideItemTooltip() {
    if (!elements.bagItemTooltip) return;
    cancelItemTooltipHide();
    elements.bagItemTooltip.hidden = true;
    delete elements.bagItemTooltip.dataset.bagKey;
    elements.bagItemTooltip.innerHTML = '';
  }

  function scheduleItemTooltipHide() {
    window.clearTimeout(tooltipHideTimer);
    tooltipHideTimer = window.setTimeout(() => hideItemTooltip(), 160);
  }

  function cancelItemTooltipHide() {
    window.clearTimeout(tooltipHideTimer);
    tooltipHideTimer = 0;
  }

  function scheduleSlotMeasurement() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(measureSlotCapacity);
  }

  function measureSlotCapacity() {
    const viewport = elements.bagGridViewport;
    if (!viewport) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    if (!width || !height) return;

    const compact = width < 520;
    const minimumSlotWidth = compact ? 140 : 168;
    const gap = compact ? 7 : 10;
    const columns = Math.max(2, Math.floor((width + gap) / (minimumSlotWidth + gap)));
    const slotWidth = (width - (gap * (columns - 1))) / columns;
    const rows = Math.max(1, Math.floor((height + gap) / (slotWidth + gap)));
    const capacity = Math.max(columns, columns * rows);
    if (capacity === state.slotCapacity && columns === state.slotColumns) return;

    state.slotCapacity = capacity;
    state.slotColumns = columns;
    renderBag();
  }

  function showError(error) {
    if (typeof window.AmongDemons.showGameAlert === 'function') {
      window.AmongDemons.showGameAlert(error, { context: 'bag' });
    } else {
      console.error(error);
    }
  }

  function normalizeRarity(value) {
    const rarity = String(value || 'common').toLowerCase();
    return RARITY_RANK[rarity] ? rarity : 'common';
  }

  function normalizeItemType(value) {
    return String(value || 'other').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'other';
  }

  function capitalize(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  function formatNumber(value) {
    return Math.max(0, Number(value) || 0).toLocaleString();
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value || ''));
    return String(value || '').replace(/(["\\])/g, '\\$1');
  }

  function onReady(callback) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', callback, { once: true });
    else callback();
  }
})();
