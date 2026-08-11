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
  const renderItemVisual = window.AmongDemons.bagVisuals?.renderItemVisual
    || (() => '<span class="bag-item-renderer bag-unknown-visual" aria-hidden="true"></span>');
  const getDemonRoleLabel = window.AmongDemons.ui.getDemonRoleLabel
    || ((demon) => capitalize(demon?.role || 'Demon'));
  const RARITY_RANK = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5, mythic: 6 };
  const BAG_SORT_STORAGE_PREFIX = 'amongdemons-bag-sort';
  const BAG_SORT_OPTIONS = new Set(['type', 'ready', 'rarity', 'name', 'quantity']);
  const DEFAULT_BAG_SORT = 'type';
  const SUMMON_REVEAL_DELAY_MS = 3000;
  const state = {
    items: [],
    config: {},
    selectedKey: null,
    pending: false,
    pendingAction: null,
    filter: 'all',
    sort: DEFAULT_BAG_SORT,
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

    restoreSortPreference();
    await refreshBag();
  }

  function cacheElements() {
    ['bagBackLink', 'bagCount', 'bagFilter', 'bagSort', 'bagLoading', 'bagGridViewport', 'bagGrid', 'bagItemTooltip', 'bagDetailModal', 'bagDetailContent', 'bagSummonModal', 'bagSummonContent', 'bagRefineModal', 'bagRefineContent']
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
    elements.bagDetailContent.addEventListener('click', handleDetailAction);

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
    state.items = Array.isArray(payload.items) ? payload.items : [];
    state.config = payload.config || state.config || {};
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
    const status = getItemStatus(item);
    const aria = `${capitalize(rarity)} ${item.species} Echo, quantity ${item.quantity}. ${status}.`;

    return `
      <button class="bag-slot bag-item bag-item-kind-${escapeHtml(normalizeItemType(item.itemType))} ${item.summonReady ? 'is-ready' : ''} ${state.inspectedKey === item.itemKey ? 'is-inspecting' : ''}" type="button" data-bag-key="${escapeHtml(item.itemKey)}" style="--item-rarity: ${escapeHtml(color)}" aria-label="${escapeHtml(aria)}">
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
    state.detailError = '';
    hideItemTooltip();
    state.selectedKey = itemKey;
    renderItemDetail(item);
    bootstrap.Modal.getOrCreateInstance(elements.bagDetailModal).show();
  }

  function renderItemDetail(item) {
    const rarity = normalizeRarity(item.rarity);
    const color = getRarityColor(rarity);
    const progress = Math.min(100, Math.round((Number(item.summonProgress) / Math.max(1, Number(item.summonRequirement))) * 100));
    const summonCopy = `Gather ${item.summonRequirement} exact ${Number(item.summonRequirement) === 1 ? 'Echo' : 'Echoes'} to manifest this demon permanently.`;
    const discoveryCopy = item.naturallyDiscovered
      ? 'Naturally extracted'
      : item.owned
        ? 'Known through Collection'
        : 'Refined Echo';

    elements.bagDetailContent.style.setProperty('--item-rarity', color);
    elements.bagDetailContent.innerHTML = `
      <div class="bag-detail-head">
        <div class="bag-detail-visual">${renderItemVisual(item, { context: 'detail' })}</div>
        <div>
          <span class="bag-detail-rarity">${escapeHtml(capitalize(rarity))} Demon Echo</span>
          <h2 class="h4 mb-1" id="bagDetailTitle">${escapeHtml(item.species)}</h2>
          <span class="text-muted">${escapeHtml(getDemonRoleLabel(item) || 'Demon')} - ${escapeHtml(item.preferredPosition || 'front')} line</span>
          <span class="bag-detail-discovery">${renderIcon(item.naturallyDiscovered ? 'check' : 'info')}<span>Source: ${escapeHtml(discoveryCopy)}</span></span>
        </div>
        <button type="button" class="btn-close bag-detail-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="bag-detail-body">
        ${item.owned ? '' : `
          <section class="bag-detail-panel">
            <div class="d-flex align-items-center justify-content-between gap-3 mb-2">
              <h3 class="mb-0">Permanent summoning</h3>
              <strong>x${escapeHtml(formatNumber(item.quantity))}</strong>
            </div>
            <p class="small text-muted">${escapeHtml(summonCopy)}</p>
            <div class="d-flex justify-content-between small mb-1"><span>Echo progress</span><strong>${escapeHtml(`${item.summonProgress}/${item.summonRequirement}`)}</strong></div>
            <div class="bag-progress-track" aria-label="${escapeHtml(`${progress}% of Echoes gathered`)}"><div class="bag-progress-fill" style="width: ${progress}%"></div></div>
            ${item.summonReady ? `
              <button class="btn btn-sm btn-primary bag-summon-action" type="button" data-bag-action="summon" ${state.pending ? 'disabled' : ''}>
                ${state.pendingAction === 'summon' ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' : renderIcon('sparkles')}
                <span>${state.pendingAction === 'summon' ? 'Summoning...' : 'Summon Demon'}</span>
              </button>
            ` : ''}
          </section>
        `}
        ${renderRefinementPanel(item)}
      </div>
      <div class="bag-detail-actions">
        <button class="btn btn-glass-muted" type="button" data-bs-dismiss="modal">Close</button>
        ${item.owned ? '<a class="btn btn-glass-muted" href="/collection">View Collection</a>' : ''}
      </div>
    `;
  }

  function renderRefinementPanel(item) {
    if (!item.nextRarity) {
      return `
        <section class="bag-detail-panel">
          <h3>Refinement</h3>
          <p class="small text-muted mb-0">Mythic is the highest Echo rarity. Surplus Mythic Echoes remain safely stored.</p>
        </section>
      `;
    }

    const sourceLabel = `${capitalize(item.rarity)} ${item.species}`;
    const targetLabel = `${capitalize(item.nextRarity)} ${item.species}`;
    const lacking = Math.max(0, Number(item.refinementCost) - Number(item.quantity));
    const refinementCount = Math.floor(Number(item.quantity) / Number(item.refinementCost));
    const consumedQuantity = refinementCount * Number(item.refinementCost);
    const lockedCopy = lacking > 0
      ? `Gather ${lacking} more ${sourceLabel} ${lacking === 1 ? 'Echo' : 'Echoes'} to refine.`
      : `Consume ${consumedQuantity} ${sourceLabel} Echoes to create ${refinementCount} ${targetLabel} ${refinementCount === 1 ? 'Echo' : 'Echoes'}.`;

    return `
      <section class="bag-detail-panel">
        <h3>Refinement</h3>
        <div class="bag-recipe" aria-label="${escapeHtml(`${consumedQuantity || item.refinementCost} ${sourceLabel} Echoes become ${refinementCount || 1} ${targetLabel} ${refinementCount === 1 ? 'Echo' : 'Echoes'}`)}">
          <div class="bag-recipe-item"><strong>x${escapeHtml(consumedQuantity || item.refinementCost)}</strong><small class="d-block bag-recipe-rarity" style="--recipe-rarity:${escapeHtml(getRarityColor(item.rarity))}">${escapeHtml(capitalize(item.rarity))}</small></div>
          <span aria-hidden="true">${renderIcon('arrow-right')}</span>
          <div class="bag-recipe-item"><strong>x${escapeHtml(refinementCount || 1)}</strong><small class="d-block bag-recipe-rarity" style="--recipe-rarity:${escapeHtml(getRarityColor(item.nextRarity))}">${escapeHtml(capitalize(item.nextRarity))}</small></div>
        </div>
        <p class="small text-muted">${escapeHtml(lockedCopy)}</p>
        ${state.detailError ? `<div class="bag-action-error mb-3" role="alert">${escapeHtml(state.detailError)}</div>` : ''}
        <button class="btn btn-sm btn-primary bag-refine-action" type="button" data-bag-action="refine" ${item.canRefine && !state.pending ? '' : 'disabled'}>
          ${state.pendingAction === 'refine' ? '<span class="spinner-border spinner-border-sm" aria-hidden="true"></span>' : renderIcon('sparkles')}
          <span>${state.pendingAction === 'refine' ? 'Refining...' : 'Refine All'}</span>
        </button>
      </section>
    `;
  }

  async function handleDetailAction(event) {
    const button = event.target.closest('[data-bag-action]');
    if (!button || state.pending) return;
    const item = getSelectedItem();
    if (!item) return;
    const action = button.dataset.bagAction;

    if (action === 'refine') {
      await performAction('/api/bag/echoes/refine', item, 'refine');
    }
    if (action === 'summon') {
      await performAction('/api/bag/echoes/summon', item, 'summon');
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
      if (selected && elements.bagDetailModal.classList.contains('show')) {
        renderItemDetail(selected);
      } else if (!selected) {
        bootstrap.Modal.getOrCreateInstance(elements.bagDetailModal).hide();
      }
    }
  }

  function showRefineResult(sourceItem, payload = {}) {
    const targetItem = getRefinementTargetItem(sourceItem, payload);
    const targetRarity = normalizeRarity(targetItem.rarity);
    const targetSpecies = targetItem.species || sourceItem.species;
    const refinedQuantity = Math.max(1, Number(payload.refinement?.quantity) || 1);
    elements.bagRefineContent.style.setProperty('--item-rarity', getRarityColor(targetRarity));
    elements.bagRefineContent.innerHTML = `
      <div class="modal-header">
        <div>
          <p class="bag-action-kicker mb-1">Refinement complete</p>
          <h2 class="modal-title h4" id="bagRefineTitle"><span class="bag-action-title-rarity">${escapeHtml(capitalize(targetRarity))}</span> ${escapeHtml(targetSpecies)} Echo</h2>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body bag-action-result-body">
        <div class="bag-action-echo-result">
          ${renderItemVisual(targetItem, { context: 'detail' })}
          ${refinedQuantity > 1 ? `<span class="bag-item-count">x${escapeHtml(formatNumber(refinedQuantity))}</span>` : ''}
        </div>
        <p class="bag-action-description" id="bagRefineDescription">${escapeHtml(refinedQuantity === 1
          ? 'Your refined Echo has been added to Bag.'
          : `${refinedQuantity} refined Echoes have been added to Bag.`)}</p>
      </div>
      <div class="modal-footer bag-action-footer-centered">
        <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Confirm</button>
      </div>
    `;
    transitionBetweenModals(elements.bagDetailModal, elements.bagRefineModal);
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

    const target = elements.bagDetailContent;
    const action = target?.querySelector('.bag-summon-action');
    if (!target || !action) return 0;

    const actionRect = action.getBoundingClientRect();
    const viewportRect = { width: window.innerWidth, height: window.innerHeight };
    const coreX = actionRect.left + (actionRect.width / 2);
    const coreY = actionRect.top + (actionRect.height / 2);
    const ritual = document.createElement('div');
    ritual.className = 'bag-summon-ritual';
    ritual.setAttribute('aria-hidden', 'true');
    ritual.style.setProperty('--item-rarity', target.style.getPropertyValue('--item-rarity'));
    ritual.style.setProperty('--summon-core-x', `${coreX.toFixed(1)}px`);
    ritual.style.setProperty('--summon-core-y', `${coreY.toFixed(1)}px`);
    ritual.innerHTML = `
      <div class="bag-summon-vortex">${renderSummonParticles(viewportRect)}</div>
      <div class="bag-summon-core"></div>
    `;

    action.classList.add('is-summoning');
    document.body.appendChild(ritual);
    audio?.play('sfx.progression.summonAttempt', { volume: 0.86 });
    return SUMMON_REVEAL_DELAY_MS;
  }

  function stopSummonRitual() {
    elements.bagDetailContent?.querySelector('.bag-summon-action.is-summoning')?.classList.remove('is-summoning');
    document.querySelectorAll('body > .bag-summon-ritual').forEach((ritual) => ritual.remove());
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
      return `<span class="bag-summon-particle" style="--sx:${sx.toFixed(1)}px;--sy:${sy.toFixed(1)}px;--delay:${delay.toFixed(0)}ms;--duration:${duration.toFixed(0)}ms;--size:${size.toFixed(2)};--spin:${spin.toFixed(0)}deg"></span>`;
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
    elements.bagSummonContent.style.setProperty('--item-rarity', getRarityColor(rarity));
    elements.bagSummonContent.innerHTML = `
      <div class="modal-header">
        <div>
          <p class="bag-action-kicker mb-1">Summoning complete</p>
          <h2 class="modal-title h4" id="bagSummonTitle">${escapeHtml(`${capitalize(rarity)} ${demon.species || 'Demon'}`)}</h2>
        </div>
        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>
      <div class="modal-body bag-action-result-body">
        <img class="bag-summon-portrait" src="${escapeHtml(demon.imageUrl || demon.image_url || '')}" alt="${escapeHtml(`${capitalize(rarity)} ${demon.species || 'demon'}`)}">
        <p class="bag-action-description" id="bagSummonDescription">Your summon has joined your permanent Collection.</p>
      </div>
      <div class="modal-footer bag-action-footer-centered">
        <a class="btn btn-primary" href="/collection">View Collection</a>
      </div>
    `;

    transitionBetweenModals(elements.bagDetailModal, elements.bagSummonModal);
    audio?.play('sfx.progression.summonSuccess', { volume: 0.92 });
  }

  function getSelectedItem() {
    return state.items.find((item) => item.itemKey === state.selectedKey) || null;
  }

  function compareItems(a, b) {
    if (state.sort === 'type') return compareType(a, b) || compareRarity(a, b) || compareName(a, b);
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

  function compareType(a, b) {
    return Number(a.typeId || 0) - Number(b.typeId || 0);
  }

  function compareName(a, b) {
    return String(a.species || '').localeCompare(String(b.species || ''));
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
    if (item.owned) return 'Summoned - surplus Echoes';
    if (item.summonReady) return 'Ready to summon';
    return `${item.summonProgress}/${item.summonRequirement} to summon`;
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
      <span class="bag-tooltip-rarity">${escapeHtml(capitalize(rarity))} Echo</span>
      <strong class="bag-tooltip-title">${escapeHtml(item.species)}</strong>
      <span class="bag-tooltip-meta">${escapeHtml(getDemonRoleLabel(item) || 'Demon')} - x${escapeHtml(formatNumber(item.quantity))}</span>
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
