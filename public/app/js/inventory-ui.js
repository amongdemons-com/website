(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const audio = window.AmongDemons.audio;
  const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
  const getRarityColor = window.AmongDemons.ui.getRarityColor || (() => '#9ca3af');
  const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  const state = {
    items: [],
    config: {},
    selectedKey: null,
    pending: false,
    filter: 'all',
    sort: 'ready',
    inspectedKey: null,
    lastPointerType: 'mouse',
    slotCapacity: 24,
    slotColumns: 4
  };
  const elements = {};
  let resizeFrame = 0;

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

    await refreshInventory();
  }

  function cacheElements() {
    ['inventoryCount', 'inventoryFilter', 'inventorySort', 'inventoryLoading', 'inventoryGridViewport', 'inventoryGrid', 'inventoryItemTooltip', 'inventoryDetailModal', 'inventoryDetailContent', 'inventorySummonCelebration']
      .forEach((id) => { elements[id] = document.getElementById(id); });
  }

  function bindActions() {
    elements.inventoryFilter.addEventListener('change', () => {
      state.filter = elements.inventoryFilter.value;
      renderInventory();
    });
    elements.inventorySort.addEventListener('change', () => {
      state.sort = elements.inventorySort.value;
      renderInventory();
    });
    elements.inventoryGrid.addEventListener('pointerdown', (event) => {
      state.lastPointerType = event.pointerType || 'mouse';
    });
    elements.inventoryGrid.addEventListener('pointerover', (event) => {
      const item = event.target.closest('[data-inventory-key]');
      if (!item || item.contains(event.relatedTarget) || event.pointerType === 'touch') return;
      showItemTooltip(item.dataset.inventoryKey, item);
    });
    elements.inventoryGrid.addEventListener('pointerout', (event) => {
      const item = event.target.closest('[data-inventory-key]');
      if (!item || item.contains(event.relatedTarget) || state.inspectedKey === item.dataset.inventoryKey) return;
      hideItemTooltip();
    });
    elements.inventoryGrid.addEventListener('focusin', (event) => {
      const item = event.target.closest('[data-inventory-key]');
      if (item) showItemTooltip(item.dataset.inventoryKey, item);
    });
    elements.inventoryGrid.addEventListener('focusout', (event) => {
      const item = event.target.closest('[data-inventory-key]');
      if (!item || item.contains(event.relatedTarget) || state.inspectedKey === item.dataset.inventoryKey) return;
      hideItemTooltip();
    });
    elements.inventoryGrid.addEventListener('click', (event) => {
      const item = event.target.closest('[data-inventory-key]');
      if (!item) return;
      const itemKey = item.dataset.inventoryKey;
      const touchLike = state.lastPointerType === 'touch' || window.matchMedia('(hover: none), (pointer: coarse)').matches;
      if (touchLike && state.inspectedKey !== itemKey) {
        state.inspectedKey = itemKey;
        renderInventory();
        window.requestAnimationFrame(() => {
          const inspectedItem = elements.inventoryGrid.querySelector(`[data-inventory-key="${cssEscape(itemKey)}"]`);
          inspectedItem?.focus({ preventScroll: true });
          showItemTooltip(itemKey, inspectedItem);
        });
        return;
      }
      openItem(itemKey);
    });
    document.addEventListener('pointerdown', (event) => {
      if (event.target.closest('[data-inventory-key]')) return;
      state.inspectedKey = null;
      elements.inventoryGrid.querySelector('.is-inspecting')?.classList.remove('is-inspecting');
      hideItemTooltip();
    });
    elements.inventoryGridViewport.addEventListener('scroll', () => {
      if (!state.inspectedKey) {
        hideItemTooltip();
        return;
      }
      const item = elements.inventoryGrid.querySelector(`[data-inventory-key="${cssEscape(state.inspectedKey)}"]`);
      showItemTooltip(state.inspectedKey, item);
    }, { passive: true });
    elements.inventoryDetailContent.addEventListener('click', handleDetailAction);
    elements.inventorySummonCelebration.addEventListener('click', dismissCelebration);

    const resizeObserver = new ResizeObserver(scheduleSlotMeasurement);
    resizeObserver.observe(elements.inventoryGridViewport);
    window.addEventListener('resize', scheduleSlotMeasurement, { passive: true });
  }

  async function refreshInventory() {
    elements.inventoryLoading.hidden = false;
    elements.inventoryGridViewport.hidden = true;
    try {
      const payload = await api('/api/inventory');
      applyPayload(payload);
    } catch (error) {
      showError(error);
      state.items = [];
      renderInventory();
    } finally {
      elements.inventoryLoading.hidden = true;
      elements.inventoryGridViewport.hidden = false;
      scheduleSlotMeasurement();
    }
  }

  function applyPayload(payload = {}) {
    state.items = Array.isArray(payload.items) ? payload.items : [];
    state.config = payload.config || state.config || {};
    renderInventory();
    if (state.selectedKey) {
      const item = getSelectedItem();
      if (item) renderItemDetail(item);
    }
  }

  function renderInventory() {
    const items = state.items
      .filter((item) => state.filter === 'all' || item.itemType === state.filter)
      .sort(compareItems);
    elements.inventoryCount.textContent = `${state.items.length} ${state.items.length === 1 ? 'stack' : 'stacks'}`;
    const emptySlotCount = Math.max(0, state.slotCapacity - items.length);
    elements.inventoryGrid.style.setProperty('--inventory-columns', state.slotColumns);
    elements.inventoryGrid.innerHTML = [
      ...items.map(renderItem),
      ...Array.from({ length: emptySlotCount }, renderEmptySlot)
    ].join('');
    elements.inventoryGridViewport.classList.toggle('is-scrollable', items.length > state.slotCapacity);
    if (!state.inspectedKey) {
      hideItemTooltip();
      return;
    }

    const inspectedItem = elements.inventoryGrid.querySelector(`[data-inventory-key="${cssEscape(state.inspectedKey)}"]`);
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
    const status = getItemStatus(item);
    const aria = `${capitalize(rarity)} ${item.species} Echo, quantity ${item.quantity}. ${status}.`;

    return `
      <button class="inventory-slot inventory-item ${item.summonReady ? 'is-ready' : ''} ${state.inspectedKey === item.itemKey ? 'is-inspecting' : ''}" type="button" data-inventory-key="${escapeHtml(item.itemKey)}" style="--item-rarity: ${escapeHtml(color)}" aria-label="${escapeHtml(aria)}">
        <span class="inventory-rarity-diamond" aria-hidden="true"></span>
        <span class="inventory-item-visual">
          <img class="inventory-item-image" src="${escapeHtml(item.imageUrl)}" alt="" loading="lazy">
          <span class="inventory-item-count">x${escapeHtml(formatNumber(item.quantity))}</span>
        </span>
      </button>
    `;
  }

  function renderEmptySlot() {
    return '<span class="inventory-slot inventory-slot-empty" aria-hidden="true"></span>';
  }

  function openItem(itemKey) {
    const item = state.items.find((candidate) => candidate.itemKey === itemKey);
    if (!item) return;
    state.inspectedKey = null;
    hideItemTooltip();
    state.selectedKey = itemKey;
    renderItemDetail(item);
    bootstrap.Modal.getOrCreateInstance(elements.inventoryDetailModal).show();
  }

  function renderItemDetail(item) {
    const rarity = normalizeRarity(item.rarity);
    const color = getRarityColor(rarity);
    const progress = Math.min(100, Math.round((Number(item.summonProgress) / Math.max(1, Number(item.summonRequirement))) * 100));
    const summonTitle = item.owned ? 'Already summoned' : 'Permanent summoning';
    const summonCopy = item.owned
      ? 'This demon is already in your Collection. New Echoes remain safely banked for refinement.'
      : `Gather ${item.summonRequirement} exact ${Number(item.summonRequirement) === 1 ? 'Echo' : 'Echoes'} to manifest this demon permanently.`;
    const discoveryCopy = item.naturallyDiscovered
      ? 'Naturally extracted'
      : item.owned
        ? 'Known through Collection'
        : 'Refined Echo';

    elements.inventoryDetailContent.style.setProperty('--item-rarity', color);
    elements.inventoryDetailContent.innerHTML = `
      <div class="inventory-detail-head">
        <img class="inventory-detail-portrait" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(`${capitalize(rarity)} ${item.species}`)}">
        <div>
          <span class="inventory-detail-rarity">${escapeHtml(capitalize(rarity))} Demon Echo</span>
          <h2 class="h4 mb-1" id="inventoryDetailTitle">${escapeHtml(item.species)}</h2>
          <span class="text-muted">${escapeHtml(item.role || 'Demon')} - ${escapeHtml(item.preferredPosition || 'front')} line</span>
          <span class="inventory-detail-discovery">${renderIcon(item.naturallyDiscovered ? 'check' : 'info')}${escapeHtml(discoveryCopy)}</span>
        </div>
        <button type="button" class="btn-close inventory-detail-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="inventory-detail-body">
        <section class="inventory-detail-panel">
          <div class="d-flex align-items-center justify-content-between gap-3 mb-2">
            <h3 class="mb-0">${escapeHtml(summonTitle)}</h3>
            <strong>x${escapeHtml(formatNumber(item.quantity))}</strong>
          </div>
          <p class="small text-muted">${escapeHtml(summonCopy)}</p>
          ${item.owned ? '' : `
            <div class="d-flex justify-content-between small mb-1"><span>Echo progress</span><strong>${escapeHtml(`${item.summonProgress}/${item.summonRequirement}`)}</strong></div>
            <div class="inventory-progress-track" aria-label="${escapeHtml(`${progress}% of Echoes gathered`)}"><div class="inventory-progress-fill" style="width: ${progress}%"></div></div>
          `}
        </section>
        ${renderRefinementPanel(item)}
      </div>
      <div class="inventory-detail-actions">
        <button class="btn btn-glass-muted" type="button" data-bs-dismiss="modal">Close</button>
        ${item.owned ? `<a class="btn btn-glass-muted" href="/collection">View Collection</a>` : `
          <button class="btn btn-glass-muted" type="button" data-inventory-action="summon" ${item.summonReady && !state.pending ? '' : 'disabled'}>
            ${state.pending ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' : renderIcon('sparkles')}
            <span>${item.summonReady ? 'Summon Demon' : `Need ${Math.max(0, item.summonRequirement - item.quantity)} More`}</span>
          </button>
        `}
      </div>
    `;
  }

  function renderRefinementPanel(item) {
    if (!item.nextRarity) {
      return `
        <section class="inventory-detail-panel">
          <h3>Refinement</h3>
          <p class="small text-muted mb-0">Mythic is the highest Echo rarity. Surplus Mythic Echoes remain safely stored.</p>
        </section>
      `;
    }

    const sourceLabel = `${capitalize(item.rarity)} ${item.species}`;
    const targetLabel = `${capitalize(item.nextRarity)} ${item.species}`;
    const lacking = Math.max(0, Number(item.refinementCost) - Number(item.quantity));
    const lockedCopy = !item.targetDiscovered
      ? `Extract ${getIndefiniteArticle(item.nextRarity)} ${targetLabel} Echo naturally before refining into this rarity.`
      : lacking > 0
        ? `Gather ${lacking} more ${sourceLabel} ${lacking === 1 ? 'Echo' : 'Echoes'} to refine.`
        : `Consume ${item.refinementCost} ${sourceLabel} Echoes to create one ${targetLabel} Echo.`;

    return `
      <section class="inventory-detail-panel">
        <h3>Refinement</h3>
        <div class="inventory-recipe" aria-label="${escapeHtml(`${item.refinementCost} ${sourceLabel} Echoes become 1 ${targetLabel} Echo`)}">
          <div class="inventory-recipe-item"><strong>x${escapeHtml(item.refinementCost)}</strong><small class="d-block text-muted">${escapeHtml(capitalize(item.rarity))}</small></div>
          <span aria-hidden="true">${renderIcon('arrow-right')}</span>
          <div class="inventory-recipe-item"><strong>x1</strong><small class="d-block" style="color:${escapeHtml(getRarityColor(item.nextRarity))}">${escapeHtml(capitalize(item.nextRarity))}</small></div>
        </div>
        <p class="small text-muted">${escapeHtml(lockedCopy)}</p>
        <button class="btn btn-sm btn-primary w-100" type="button" data-inventory-action="refine" ${item.canRefine && !state.pending ? '' : 'disabled'}>
          ${state.pending ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' : renderIcon('sparkles')}
          <span>Refine Echo</span>
        </button>
      </section>
    `;
  }

  async function handleDetailAction(event) {
    const button = event.target.closest('[data-inventory-action]');
    if (!button || state.pending) return;
    const item = getSelectedItem();
    if (!item) return;
    const action = button.dataset.inventoryAction;

    if (action === 'refine') {
      const message = `Refine ${item.refinementCost} ${capitalize(item.rarity)} ${item.species} Echoes into 1 ${capitalize(item.nextRarity)} Echo?`;
      if (!window.confirm(message)) return;
      await performAction('/api/inventory/echoes/refine', item, 'refine');
    }
    if (action === 'summon') {
      const message = `Consume ${item.summonRequirement} Echoes to permanently summon ${capitalize(item.rarity)} ${item.species}?`;
      if (!window.confirm(message)) return;
      await performAction('/api/inventory/echoes/summon', item, 'summon');
    }
  }

  async function performAction(endpoint, item, action) {
    state.pending = true;
    renderItemDetail(item);
    try {
      const payload = await api(endpoint, {
        method: 'POST',
        body: { typeId: item.typeId, rarity: item.rarity }
      });
      if (action === 'summon') {
        bootstrap.Modal.getOrCreateInstance(elements.inventoryDetailModal).hide();
        showSummonCelebration(payload.demon || item);
      } else {
        audio?.play('sfx.progression.levelUp', { volume: 0.72 });
        const sourceStillExists = (payload.items || []).some((candidate) => candidate.itemKey === item.itemKey);
        if (!sourceStillExists && payload.refinement?.targetRarity) {
          state.selectedKey = `echo:${item.typeId}:${payload.refinement.targetRarity}`;
        }
      }
      applyPayload(payload);
    } catch (error) {
      showError(error);
    } finally {
      state.pending = false;
      const selected = getSelectedItem();
      if (selected && elements.inventoryDetailModal.classList.contains('show')) {
        renderItemDetail(selected);
      } else if (!selected) {
        bootstrap.Modal.getOrCreateInstance(elements.inventoryDetailModal).hide();
      }
    }
  }

  function showSummonCelebration(demon) {
    const rarity = normalizeRarity(demon.rarity);
    elements.inventorySummonCelebration.hidden = false;
    elements.inventorySummonCelebration.style.setProperty('--item-rarity', getRarityColor(rarity));
    elements.inventorySummonCelebration.innerHTML = `
      <div class="inventory-summon-card">
        <span class="inventory-kicker">Summoning complete</span>
        <img src="${escapeHtml(demon.imageUrl || demon.image_url || '')}" alt="${escapeHtml(`${capitalize(rarity)} ${demon.species || 'demon'}`)}">
        <h2>${escapeHtml(`${capitalize(rarity)} ${demon.species || 'Demon'}`)}</h2>
        <p>This demon now lives in your permanent Collection.</p>
        <div class="d-flex justify-content-center gap-2">
          <button class="btn btn-outline-light" type="button" data-celebration-close>Return to Inventory</button>
          <a class="btn btn-primary" href="/collection">View Collection</a>
        </div>
      </div>
    `;
    audio?.play('sfx.progression.levelUp', { volume: 0.92 });
    elements.inventorySummonCelebration.querySelector('[data-celebration-close]')?.focus();
  }

  function dismissCelebration(event) {
    if (event.target.closest('a')) return;
    if (event.target === elements.inventorySummonCelebration || event.target.closest('[data-celebration-close]')) {
      elements.inventorySummonCelebration.hidden = true;
      elements.inventorySummonCelebration.innerHTML = '';
    }
  }

  function getSelectedItem() {
    return state.items.find((item) => item.itemKey === state.selectedKey) || null;
  }

  function compareItems(a, b) {
    if (state.sort === 'ready') {
      return Number(Boolean(b.summonReady)) - Number(Boolean(a.summonReady)) || compareRarity(b, a) || compareName(a, b);
    }
    if (state.sort === 'rarity') return compareRarity(b, a) || compareName(a, b);
    if (state.sort === 'quantity') return Number(b.quantity) - Number(a.quantity) || compareRarity(b, a) || compareName(a, b);
    return compareName(a, b) || compareRarity(a, b);
  }

  function compareRarity(a, b) {
    return (RARITY_RANK[a.rarity] || 0) - (RARITY_RANK[b.rarity] || 0);
  }

  function compareName(a, b) {
    return String(a.species || '').localeCompare(String(b.species || ''));
  }

  function getItemStatus(item) {
    if (item.owned) return 'Summoned - surplus Echoes';
    if (item.summonReady) return 'Ready to summon';
    return `${item.summonProgress}/${item.summonRequirement} to summon`;
  }

  function showItemTooltip(itemKey, anchor) {
    const item = state.items.find((candidate) => candidate.itemKey === itemKey);
    if (!item || !anchor || !elements.inventoryItemTooltip) {
      hideItemTooltip();
      return;
    }

    const rarity = normalizeRarity(item.rarity);
    const tooltip = elements.inventoryItemTooltip;
    tooltip.style.setProperty('--item-rarity', getRarityColor(rarity));
    tooltip.innerHTML = `
      <span class="inventory-tooltip-rarity">${escapeHtml(capitalize(rarity))} Echo</span>
      <strong class="inventory-tooltip-title">${escapeHtml(item.species)}</strong>
      <span class="inventory-tooltip-meta">${escapeHtml(getItemStatus(item))}</span>
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
    const top = isBelow
      ? anchorRect.bottom + gap
      : anchorRect.top - tooltipRect.height - gap;

    tooltip.classList.toggle('is-below', isBelow);
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(Math.max(margin, top))}px`;
  }

  function hideItemTooltip() {
    if (!elements.inventoryItemTooltip) return;
    elements.inventoryItemTooltip.hidden = true;
    elements.inventoryItemTooltip.innerHTML = '';
  }

  function scheduleSlotMeasurement() {
    window.cancelAnimationFrame(resizeFrame);
    resizeFrame = window.requestAnimationFrame(measureSlotCapacity);
  }

  function measureSlotCapacity() {
    const viewport = elements.inventoryGridViewport;
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
    renderInventory();
  }

  function showError(error) {
    if (typeof window.AmongDemons.showGameAlert === 'function') {
      window.AmongDemons.showGameAlert(error, { context: 'inventory' });
    } else {
      console.error(error);
    }
  }

  function normalizeRarity(value) {
    const rarity = String(value || 'common').toLowerCase();
    return RARITY_RANK[rarity] ? rarity : 'common';
  }

  function capitalize(value) {
    const text = String(value || '');
    return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
  }

  function formatNumber(value) {
    return Math.max(0, Number(value) || 0).toLocaleString();
  }

  function getIndefiniteArticle(value) {
    return /^[aeiou]/i.test(String(value || '')) ? 'an' : 'a';
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
