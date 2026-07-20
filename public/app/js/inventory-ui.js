(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const audio = window.AmongDemons.audio;
  const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
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
  const renderItemVisual = window.AmongDemons.inventoryVisuals?.renderItemVisual
    || (() => '<span class="inventory-item-renderer inventory-unknown-visual" aria-hidden="true"></span>');
  const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  const SUMMON_REVEAL_DELAY_MS = 3000;
  const state = {
    items: [],
    config: {},
    selectedKey: null,
    pending: false,
    pendingAction: null,
    filter: 'all',
    sort: 'ready',
    inspectedKey: null,
    lastPointerType: 'mouse',
    slotCapacity: 24,
    slotColumns: 4,
    detailError: ''
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

    await refreshInventory();
  }

  function cacheElements() {
    ['inventoryCount', 'inventoryFilter', 'inventorySort', 'inventoryLoading', 'inventoryGridViewport', 'inventoryGrid', 'inventoryItemTooltip', 'inventoryDetailModal', 'inventoryDetailContent', 'inventorySummonModal', 'inventorySummonContent', 'inventoryRefineModal', 'inventoryRefineContent']
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
      if (!item || item.contains(event.relatedTarget) || elements.inventoryItemTooltip.contains(event.relatedTarget) || state.inspectedKey === item.dataset.inventoryKey) return;
      scheduleItemTooltipHide();
    });
    elements.inventoryGrid.addEventListener('focusin', (event) => {
      const item = event.target.closest('[data-inventory-key]');
      if (item) showItemTooltip(item.dataset.inventoryKey, item);
    });
    elements.inventoryGrid.addEventListener('focusout', (event) => {
      const item = event.target.closest('[data-inventory-key]');
      if (!item || item.contains(event.relatedTarget) || elements.inventoryItemTooltip.contains(event.relatedTarget) || state.inspectedKey === item.dataset.inventoryKey) return;
      scheduleItemTooltipHide();
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
      if (event.target.closest('[data-inventory-key], #inventoryItemTooltip')) return;
      state.inspectedKey = null;
      elements.inventoryGrid.querySelector('.is-inspecting')?.classList.remove('is-inspecting');
      hideItemTooltip();
    });
    elements.inventoryItemTooltip.addEventListener('pointerover', cancelItemTooltipHide);
    elements.inventoryItemTooltip.addEventListener('pointerout', (event) => {
      if (elements.inventoryItemTooltip.contains(event.relatedTarget)) return;
      const relatedItem = event.relatedTarget?.closest?.('[data-inventory-key]');
      if (relatedItem?.dataset.inventoryKey === elements.inventoryItemTooltip.dataset.inventoryKey) return;
      if (!state.inspectedKey) scheduleItemTooltipHide();
    });
    elements.inventoryItemTooltip.addEventListener('focusin', cancelItemTooltipHide);
    elements.inventoryItemTooltip.addEventListener('focusout', (event) => {
      if (elements.inventoryItemTooltip.contains(event.relatedTarget) || state.inspectedKey) return;
      scheduleItemTooltipHide();
    });
    elements.inventoryItemTooltip.addEventListener('click', (event) => {
      const button = event.target.closest('[data-inventory-tooltip-open]');
      if (button) openItem(button.dataset.inventoryTooltipOpen);
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
      <button class="inventory-slot inventory-item inventory-item-kind-${escapeHtml(normalizeItemType(item.itemType))} ${item.summonReady ? 'is-ready' : ''} ${state.inspectedKey === item.itemKey ? 'is-inspecting' : ''}" type="button" data-inventory-key="${escapeHtml(item.itemKey)}" style="--item-rarity: ${escapeHtml(color)}" aria-label="${escapeHtml(aria)}">
        <span class="inventory-rarity-diamond" aria-hidden="true"></span>
        <span class="inventory-item-visual">
          ${renderItemVisual(item, { context: 'slot' })}
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
    state.detailError = '';
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
        <div class="inventory-detail-visual">${renderItemVisual(item, { context: 'detail' })}</div>
        <div>
          <span class="inventory-detail-rarity">${escapeHtml(capitalize(rarity))} Demon Echo</span>
          <h2 class="h4 mb-1" id="inventoryDetailTitle">${escapeHtml(item.species)}</h2>
          <span class="text-muted">${escapeHtml(capitalize(item.role || 'Demon'))} - ${escapeHtml(item.preferredPosition || 'front')} line</span>
          <span class="inventory-detail-discovery">${renderIcon(item.naturallyDiscovered ? 'check' : 'info')}<span>Source: ${escapeHtml(discoveryCopy)}</span></span>
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
            ${item.summonReady ? `
              <button class="btn btn-sm btn-primary inventory-summon-action" type="button" data-inventory-action="summon" ${state.pending ? 'disabled' : ''}>
                ${state.pendingAction === 'summon' ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' : renderIcon('sparkles')}
                <span>${state.pendingAction === 'summon' ? 'Summoning...' : 'Summon Demon'}</span>
              </button>
            ` : ''}
          `}
        </section>
        ${renderRefinementPanel(item)}
      </div>
      <div class="inventory-detail-actions">
        <button class="btn btn-glass-muted" type="button" data-bs-dismiss="modal">Close</button>
        ${item.owned ? '<a class="btn btn-glass-muted" href="/collection">View Collection</a>' : ''}
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
    const lockedCopy = lacking > 0
      ? `Gather ${lacking} more ${sourceLabel} ${lacking === 1 ? 'Echo' : 'Echoes'} to refine.`
      : `Consume ${item.refinementCost} ${sourceLabel} Echoes to create one ${targetLabel} Echo.`;

    return `
      <section class="inventory-detail-panel">
        <h3>Refinement</h3>
        <div class="inventory-recipe" aria-label="${escapeHtml(`${item.refinementCost} ${sourceLabel} Echoes become 1 ${targetLabel} Echo`)}">
          <div class="inventory-recipe-item"><strong>x${escapeHtml(item.refinementCost)}</strong><small class="d-block inventory-recipe-rarity" style="--recipe-rarity:${escapeHtml(getRarityColor(item.rarity))}">${escapeHtml(capitalize(item.rarity))}</small></div>
          <span aria-hidden="true">${renderIcon('arrow-right')}</span>
          <div class="inventory-recipe-item"><strong>x1</strong><small class="d-block inventory-recipe-rarity" style="--recipe-rarity:${escapeHtml(getRarityColor(item.nextRarity))}">${escapeHtml(capitalize(item.nextRarity))}</small></div>
        </div>
        <p class="small text-muted">${escapeHtml(lockedCopy)}</p>
        ${state.detailError ? `<div class="inventory-action-error mb-3" role="alert">${escapeHtml(state.detailError)}</div>` : ''}
        <button class="btn btn-sm btn-primary inventory-refine-action" type="button" data-inventory-action="refine" ${item.canRefine && !state.pending ? '' : 'disabled'}>
          ${state.pendingAction === 'refine' ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' : renderIcon('sparkles')}
          <span>${state.pendingAction === 'refine' ? 'Refining...' : 'Refine Echo'}</span>
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
      await performAction('/api/inventory/echoes/refine', item, 'refine');
    }
    if (action === 'summon') {
      await performAction('/api/inventory/echoes/summon', item, 'summon');
    }
  }

  async function performAction(endpoint, item, action) {
    state.pending = true;
    state.pendingAction = action;
    state.detailError = '';
    renderItemDetail(item);
    const summonDelay = action === 'summon' ? startSummonRitual() : 0;
    try {
      const request = api(endpoint, {
        method: 'POST',
        body: { typeId: item.typeId, rarity: item.rarity }
      });
      const payload = action === 'summon'
        ? (await Promise.all([request, wait(summonDelay)]))[0]
        : await request;
      if (action === 'summon') {
        stopSummonRitual();
        applyPayload(payload);
        showSummonResult(payload.demon || item);
      } else {
        audio?.play('sfx.progression.refineSuccess', { volume: 0.72 });
        const sourceStillExists = (payload.items || []).some((candidate) => candidate.itemKey === item.itemKey);
        if (!sourceStillExists && payload.refinement?.targetRarity) {
          state.selectedKey = `echo:${item.typeId}:${payload.refinement.targetRarity}`;
        }
        applyPayload(payload);
        showRefineResult(item, payload);
      }
    } catch (error) {
      stopSummonRitual();
      if (action === 'refine') {
        state.detailError = error?.message || 'Refinement failed. Please try again.';
      } else {
        showError(error);
      }
    } finally {
      state.pending = false;
      state.pendingAction = null;
      const selected = getSelectedItem();
      if (selected && elements.inventoryDetailModal.classList.contains('show')) {
        renderItemDetail(selected);
      } else if (!selected) {
        bootstrap.Modal.getOrCreateInstance(elements.inventoryDetailModal).hide();
      }
    }
  }

  function showRefineResult(sourceItem, payload = {}) {
    const targetItem = getRefinementTargetItem(sourceItem, payload);
    const targetRarity = normalizeRarity(targetItem.rarity);
    const targetSpecies = targetItem.species || sourceItem.species;
    elements.inventoryRefineContent.style.setProperty('--item-rarity', getRarityColor(targetRarity));
    elements.inventoryRefineContent.innerHTML = `
      <div class="modal-header">
        <div>
          <p class="inventory-action-kicker mb-1">Refinement complete</p>
          <h2 class="modal-title h4" id="inventoryRefineTitle"><span class="inventory-action-title-rarity">${escapeHtml(capitalize(targetRarity))}</span> ${escapeHtml(targetSpecies)} Echo</h2>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body inventory-action-result-body">
        <div class="inventory-action-echo-result">${renderItemVisual(targetItem, { context: 'detail' })}</div>
        <p class="inventory-action-description" id="inventoryRefineDescription">Your refined Echo has been added to Inventory.</p>
      </div>
    `;
    transitionBetweenModals(elements.inventoryDetailModal, elements.inventoryRefineModal);
  }

  function getRefinementTargetItem(sourceItem, payload = {}) {
    const targetRarity = normalizeRarity(payload.refinement?.targetRarity || sourceItem.nextRarity);
    const itemKey = `echo:${sourceItem.typeId}:${targetRarity}`;
    return (payload.items || []).find((item) => item.itemKey === itemKey) || {
      ...sourceItem,
      itemKey,
      rarity: targetRarity,
      quantity: Math.max(1, Number(payload.refinement?.quantity) || 1)
    };
  }

  function transitionBetweenModals(fromElement, toElement, beforeShow) {
    const reveal = () => {
      beforeShow?.();
      bootstrap.Modal.getOrCreateInstance(toElement).show();
    };
    if (fromElement.classList.contains('show')) {
      fromElement.addEventListener('hidden.bs.modal', reveal, { once: true });
      const fromModal = bootstrap.Modal.getOrCreateInstance(fromElement);
      if (fromModal._isTransitioning) {
        fromElement.addEventListener('shown.bs.modal', () => fromModal.hide(), { once: true });
      } else {
        fromModal.hide();
      }
    } else {
      reveal();
    }
  }

  function startSummonRitual() {
    stopSummonRitual();
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;

    const target = elements.inventoryDetailContent;
    const action = target?.querySelector('.inventory-summon-action');
    if (!target || !action) return 0;

    const actionRect = action.getBoundingClientRect();
    const viewportRect = { width: window.innerWidth, height: window.innerHeight };
    const coreX = actionRect.left + (actionRect.width / 2);
    const coreY = actionRect.top + (actionRect.height / 2);
    const ritual = document.createElement('div');
    ritual.className = 'inventory-summon-ritual';
    ritual.setAttribute('aria-hidden', 'true');
    ritual.style.setProperty('--item-rarity', target.style.getPropertyValue('--item-rarity'));
    ritual.style.setProperty('--summon-core-x', `${coreX.toFixed(1)}px`);
    ritual.style.setProperty('--summon-core-y', `${coreY.toFixed(1)}px`);
    ritual.innerHTML = `
      <div class="inventory-summon-vortex">${renderSummonParticles(viewportRect)}</div>
      <div class="inventory-summon-core"></div>
    `;

    action.classList.add('is-summoning');
    document.body.appendChild(ritual);
    audio?.play('sfx.progression.summonAttempt', { volume: 0.86 });
    return SUMMON_REVEAL_DELAY_MS;
  }

  function stopSummonRitual() {
    elements.inventoryDetailContent?.querySelector('.inventory-summon-action.is-summoning')?.classList.remove('is-summoning');
    document.querySelectorAll('body > .inventory-summon-ritual').forEach((ritual) => ritual.remove());
  }

  function renderSummonParticles(rect) {
    const width = Math.max(360, Number(rect?.width) || 480);
    const height = Math.max(440, Number(rect?.height) || 620);
    const count = 78;

    return Array.from({ length: count }, () => {
      const angle = Math.random() * Math.PI * 2;
      const radius = randomBetween(0.52, 0.82);
      const sx = Math.cos(angle) * width * radius;
      const sy = Math.sin(angle) * height * radius;
      const delay = randomBetween(0, 560);
      const duration = (SUMMON_REVEAL_DELAY_MS - delay) / 0.68;
      const size = randomBetween(0.55, 1.18);
      const spin = randomBetween(-260, 260);
      return `<span class="inventory-summon-particle" style="--sx:${sx.toFixed(1)}px;--sy:${sy.toFixed(1)}px;--delay:${delay.toFixed(0)}ms;--duration:${duration.toFixed(0)}ms;--size:${size.toFixed(2)};--spin:${spin.toFixed(0)}deg"></span>`;
    }).join('');
  }

  function wait(milliseconds) {
    const delay = Math.max(0, Number(milliseconds) || 0);
    return delay ? new Promise((resolve) => window.setTimeout(resolve, delay)) : Promise.resolve();
  }

  function randomBetween(minimum, maximum) {
    return minimum + (Math.random() * (maximum - minimum));
  }

  function showSummonResult(demon) {
    const rarity = normalizeRarity(demon.rarity);
    elements.inventorySummonContent.style.setProperty('--item-rarity', getRarityColor(rarity));
    elements.inventorySummonContent.innerHTML = `
      <div class="modal-header">
        <div>
          <p class="inventory-action-kicker mb-1">Summoning complete</p>
          <h2 class="modal-title h4" id="inventorySummonTitle">${escapeHtml(`${capitalize(rarity)} ${demon.species || 'Demon'}`)}</h2>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body inventory-action-result-body">
        <img class="inventory-summon-portrait" src="${escapeHtml(demon.imageUrl || demon.image_url || '')}" alt="${escapeHtml(`${capitalize(rarity)} ${demon.species || 'demon'}`)}">
        <p class="inventory-action-description" id="inventorySummonDescription">Your summon has joined your permanent Collection.</p>
      </div>
      <div class="modal-footer inventory-action-footer-centered">
        <a class="btn btn-primary" href="/collection">View Collection</a>
      </div>
    `;

    transitionBetweenModals(elements.inventoryDetailModal, elements.inventorySummonModal);
    audio?.play('sfx.progression.summonSuccess', { volume: 0.92 });
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
    cancelItemTooltipHide();
    tooltip.dataset.inventoryKey = itemKey;
    tooltip.style.setProperty('--item-rarity', getRarityColor(rarity));
    tooltip.innerHTML = `
      <span class="inventory-tooltip-rarity">${escapeHtml(capitalize(rarity))} Echo</span>
      <strong class="inventory-tooltip-title">${escapeHtml(item.species)}</strong>
      <span class="inventory-tooltip-meta">${escapeHtml(capitalize(item.role || 'Demon'))} - x${escapeHtml(formatNumber(item.quantity))}</span>
      <span class="inventory-tooltip-meta">${escapeHtml(getItemStatus(item))}</span>
      <button class="inventory-tooltip-action" type="button" data-inventory-tooltip-open="${escapeHtml(itemKey)}">View details</button>
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
    if (!elements.inventoryItemTooltip) return;
    cancelItemTooltipHide();
    elements.inventoryItemTooltip.hidden = true;
    delete elements.inventoryItemTooltip.dataset.inventoryKey;
    elements.inventoryItemTooltip.innerHTML = '';
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
