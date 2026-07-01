(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSoulAmount = window.AmongDemons.ui?.renderSoulAmount || ((value) => String(value ?? '-'));
  const NODE_DEFINITIONS = {
    health_flat: { label: 'Max Health', cap: 5, requires: [] },
    health_percent: { label: 'Greater Health', cap: 5, requires: [['health_flat', 5]] },
    health_mastery: { label: 'Endless Health', cap: Infinity, requires: [['health_percent', 5]] },
    healing_percent: { label: 'Healing', cap: 5, requires: [['health_flat', 5]] },
    healing_mastery: { label: 'Endless Healing', cap: Infinity, requires: [['healing_percent', 5]] },
    thorns_percent: { label: 'Thorns', cap: 5, requires: [['health_flat', 5]] },
    thorns_mastery: { label: 'Endless Thorns', cap: Infinity, requires: [['thorns_percent', 5]] },
    speed_flat: { label: 'Speed', cap: 5, requires: [] },
    speed_percent: { label: 'Momentum', cap: 5, requires: [['speed_flat', 5]] },
    speed_mastery: { label: 'Endless Speed', cap: Infinity, requires: [['speed_percent', 5]] },
    attack_percent: { label: 'Brutal Force', cap: 5, requires: [['speed_flat', 5]] },
    attack_mastery: { label: 'Endless Force', cap: Infinity, requires: [['attack_percent', 5]] },
    aoe_percent: { label: 'Wide Ruin', cap: 5, requires: [['speed_flat', 5]] },
    aoe_mastery: { label: 'Endless Ruin', cap: Infinity, requires: [['aoe_percent', 5]] },
    poison_flat: { label: 'Poison Damage', cap: 5, requires: [] },
    poison_percent: { label: 'Virulent Poison', cap: 5, requires: [['poison_flat', 5]] },
    poison_mastery: { label: 'Endless Poison', cap: Infinity, requires: [['poison_percent', 5]] }
  };
  const STAT_KEYS = Object.keys(NODE_DEFINITIONS);
  const PAN_CLICK_THRESHOLD = 5;
  const state = {
    summary: null,
    draft: null,
    player: null,
    busy: false,
    busyAction: '',
    viewportCenterScheduled: false,
    viewportPointer: null,
    suppressNextClick: false
  };
  const elements = {};

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      window.location.href = window.AmongDemons.appUrl('/login');
      return;
    }

    cacheElements();
    bindControls();

    try {
      const [me, summary] = await Promise.all([
        api('/api/auth/me'),
        api('/api/account/stat-points')
      ]);
      applyPlayer(me.player);
      applySummary(summary);
      render();
    } catch (error) {
      handleError(error);
    }
  }

  function cacheElements() {
    [
      'appMessage',
      'skillTreeGrid',
      'skillTreeViewport',
      'skillTreeTotal',
      'skillTreeSpent',
      'skillTreeUnspent',
      'skillTreeCoreUnspent',
      'skillTreeUnspentCard',
      'skillTreeStatus',
      'skillTreeSaveButton',
      'skillTreeResetButton',
      'skillTreeResetCost'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindControls() {
    document.querySelectorAll('[data-disabled-link]').forEach((link) => {
      link.addEventListener('click', (event) => event.preventDefault());
    });

    elements.skillTreeGrid?.addEventListener('click', (event) => {
      if (state.suppressNextClick) {
        state.suppressNextClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const node = target?.closest('[data-stat-point-key]');
      if (!node || state.busy) return;
      updateDraft(node.dataset.statPointKey);
    });

    elements.skillTreeGrid?.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const node = target?.closest('[data-stat-point-key]');
      if (!node || state.busy) return;

      event.preventDefault();
      updateDraft(node.dataset.statPointKey);
    });

    elements.skillTreeGrid?.addEventListener('contextmenu', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const node = target?.closest('[data-stat-point-key]');
      if (!node) return;

      event.preventDefault();
      if (state.busy) return;
      decrementDraft(node.dataset.statPointKey);
    });

    elements.skillTreeSaveButton?.addEventListener('click', save);
    elements.skillTreeResetButton?.addEventListener('click', reset);

    elements.skillTreeViewport?.addEventListener('pointerdown', onViewportPointerDown);
    elements.skillTreeViewport?.addEventListener('wheel', onViewportWheel, { passive: false });
    window.addEventListener('blur', clearViewportPointer);
  }

  function updateDraft(key) {
    const definition = NODE_DEFINITIONS[key];
    if (!definition || !state.summary || !state.draft || !canInvest(key)) return;

    state.draft = {
      ...state.draft,
      [key]: Math.max(0, Number(state.draft[key]) || 0) + 1
    };
    render();
  }

  function decrementDraft(key) {
    const definition = NODE_DEFINITIONS[key];
    if (!definition || !state.summary || !state.draft) return;

    const current = Math.max(0, Number(state.draft[key]) || 0);
    // Only unsaved points can be removed here; sealed points are refunded through Reset.
    const floor = Math.max(0, Number(state.summary.allocations?.[key]) || 0);
    if (current <= floor) return;

    const next = { ...state.draft, [key]: current - 1 };
    // Skip removals that would strand a dependent node below its requirement.
    if (!isDraftValid(next)) return;

    state.draft = next;
    render();
  }

  function render() {
    const ready = Boolean(state.summary && state.draft);
    const total = ready ? Math.max(0, Number(state.summary.totalPoints) || 0) : 0;
    const spent = ready ? getSpent(state.draft) : 0;
    const unspent = total - spent;
    const valid = ready && isDraftValid(state.draft) && unspent >= 0;
    const dirty = ready && STAT_KEYS.some((key) => Number(state.draft[key]) !== Number(state.summary.allocations?.[key] || 0));
    const savedSpent = ready ? getSpent(state.summary.allocations) : 0;
    const resetCost = ready ? getResetCost() : 0;
    const playerSouls = getPlayerSouls();
    const canAffordReset = resetCost <= 0 || playerSouls >= resetCost;

    setText(elements.skillTreeTotal, ready ? formatNumber(total) : '-');
    setText(elements.skillTreeSpent, ready ? formatNumber(spent) : '-');
    setText(elements.skillTreeUnspent, ready ? formatNumber(Math.max(0, unspent)) : '-');
    setText(elements.skillTreeCoreUnspent, ready ? formatNumber(Math.max(0, unspent)) : '-');
    elements.skillTreeUnspentCard?.classList.toggle('has-unspent-points', valid && unspent > 0);
    setText(elements.skillTreeStatus, !ready
      ? 'Loading level points...'
      : !valid
        ? 'This allocation is no longer valid.'
        : unspent > 0
          ? `${formatNumber(unspent)} point${unspent === 1 ? '' : 's'} available.`
          : 'All earned points allocated.');

    elements.skillTreeGrid?.querySelectorAll('[data-stat-point-key]').forEach((node) => {
      const key = node.dataset.statPointKey;
      const definition = NODE_DEFINITIONS[key];
      if (!definition) return;

      const rank = ready ? Math.max(0, Number(state.draft[key]) || 0) : 0;
      const unlocked = ready && requirementsMet(state.draft, definition.requires);
      const complete = Number.isFinite(definition.cap) && rank >= definition.cap;
      const investable = valid && !state.busy && canInvest(key);

      setText(node.querySelector('[data-node-progress]'), Number.isFinite(definition.cap)
        ? `${formatNumber(rank)} / ${definition.cap}`
        : `${formatNumber(rank)} ∞`);
      node.classList.toggle('is-locked', !unlocked);
      node.classList.toggle('is-invested', rank > 0);
      node.classList.toggle('is-complete', complete);
      node.classList.toggle('is-maxed', complete);
      node.classList.toggle('is-disabled', unlocked && !investable && !complete);
      node.setAttribute('aria-disabled', String(!investable));
      node.setAttribute('aria-label', `${definition.label}: ${formatNumber(rank)}${Number.isFinite(definition.cap) ? ` of ${definition.cap}` : ' points'}. ${investable ? 'Activate to invest one point.' : complete ? 'Complete.' : !unlocked ? 'Locked.' : 'No points available.'}`);
      node.tabIndex = unlocked ? 0 : -1;
    });

    elements.skillTreeGrid?.querySelectorAll('[data-unlock-key]').forEach((line) => {
      const key = line.dataset.unlockKey;
      const requiredRank = Math.max(1, Number(line.dataset.unlockRank) || 1);
      const rank = ready ? Math.max(0, Number(state.draft[key]) || 0) : 0;
      line.classList.toggle('is-active', rank >= requiredRank);
    });

    if (ready && !state.viewportCenterScheduled) {
      state.viewportCenterScheduled = true;
      scheduleConstellationCenter();
    }

    if (elements.skillTreeSaveButton) {
      elements.skillTreeSaveButton.disabled = !valid || !dirty || state.busy;
      elements.skillTreeSaveButton.textContent = state.busyAction === 'save' ? 'Saving...' : 'Save';
    }
    if (elements.skillTreeResetButton) {
      elements.skillTreeResetButton.disabled = !ready || state.busy || spent <= 0 || !canAffordReset;
      elements.skillTreeResetButton.textContent = getResetButtonLabel({
        busy: state.busyAction === 'reset'
      });
      elements.skillTreeResetButton.title = resetCost > 0
        ? `Reset costs ${formatNumber(resetCost)} Soul${resetCost === 1 ? '' : 's'}.`
        : 'Clear unsaved skill point changes.';
    }

    renderResetCost({
      ready,
      savedSpent,
      resetCost,
      playerSouls,
      canAffordReset
    });
  }

  function canInvest(key) {
    const definition = NODE_DEFINITIONS[key];
    if (!definition || !state.summary || !state.draft) return false;

    const rank = Math.max(0, Number(state.draft[key]) || 0);
    const unspent = Math.max(0, Number(state.summary.totalPoints) || 0) - getSpent(state.draft);
    return unspent > 0 && rank < definition.cap && requirementsMet(state.draft, definition.requires);
  }

  function isDraftValid(allocations) {
    return STAT_KEYS.every((key) => {
      const definition = NODE_DEFINITIONS[key];
      const rank = Number(allocations[key]);
      return Number.isSafeInteger(rank) &&
        rank >= 0 &&
        rank <= definition.cap &&
        (rank === 0 || requirementsMet(allocations, definition.requires));
    });
  }

  function requirementsMet(allocations, requirements = []) {
    return requirements.every(([key, rank]) => Number(allocations?.[key]) >= rank);
  }

  async function save() {
    if (!state.summary || !state.draft || state.busy) return;
    state.busy = true;
    state.busyAction = 'save';
    render();

    try {
      applySummary(await api('/api/account/stat-points', {
        method: 'POST',
        body: { allocations: state.draft }
      }));
      setMessage('Constellation sealed. Your skill bonuses are active.', 'success');
    } catch (error) {
      handleError(error);
    } finally {
      state.busy = false;
      state.busyAction = '';
      render();
    }
  }

  async function reset() {
    if (!state.summary || state.busy) return;
    if (getSpent(state.summary.allocations) <= 0) {
      state.draft = { ...state.summary.allocations };
      setMessage('Draft constellation cleared.', 'info');
      render();
      return;
    }

    state.busy = true;
    state.busyAction = 'reset';
    render();

    try {
      const payload = await api('/api/account/stat-points/reset', { method: 'POST' });
      applyPlayer(payload.player);
      applySummary(payload);
      const cost = Math.max(0, Number(payload.reset?.cost ?? payload.resetCost) || 0);
      setMessage(`All constellation bindings were released for ${formatNumber(cost)} Soul${cost === 1 ? '' : 's'}.`, 'success');
    } catch (error) {
      handleError(error);
    } finally {
      state.busy = false;
      state.busyAction = '';
      render();
    }
  }

  function applySummary(summary) {
    state.summary = summary;
    state.draft = STAT_KEYS.reduce((allocations, key) => {
      allocations[key] = Math.max(0, Number(summary.allocations?.[key]) || 0);
      return allocations;
    }, {});
  }

  function applyPlayer(player) {
    if (!player) return;

    state.player = player;
    const session = typeof window.AmongDemons.getSession === 'function'
      ? window.AmongDemons.getSession()
      : {};

    if (typeof window.AmongDemons.setSession === 'function') {
      window.AmongDemons.setSession({
        ...session,
        token: typeof window.AmongDemons.getToken === 'function' ? window.AmongDemons.getToken() : session.token,
        player
      });
    }

    window.AmongDemons.ui?.updateNavAccount?.(player);
  }

  function getSpent(allocations) {
    return STAT_KEYS.reduce((sum, key) => sum + (Number(allocations?.[key]) || 0), 0);
  }

  function getResetCost() {
    return Math.max(0, Number(state.summary?.resetCost) || getSpent(state.summary?.allocations));
  }

  function getPlayerSouls() {
    return Math.max(0, Number(state.player?.souls) || 0);
  }

  function getResetButtonLabel({ busy }) {
    if (busy) return 'Resetting...';
    return 'Reset';
  }

  function renderResetCost({ ready, savedSpent, resetCost, playerSouls, canAffordReset }) {
    const element = elements.skillTreeResetCost;
    if (!element) return;

    const visible = ready && savedSpent > 0 && resetCost > 0;
    element.classList.toggle('d-none', !visible);
    element.classList.toggle('is-disabled', visible && !canAffordReset);

    if (!visible) {
      element.innerHTML = '';
      element.removeAttribute('title');
      element.removeAttribute('aria-label');
      return;
    }

    const deficit = Math.max(0, resetCost - playerSouls);
    const formattedCost = formatNumber(resetCost);
    const title = canAffordReset
      ? `Reset costs ${formattedCost} Soul${resetCost === 1 ? '' : 's'}.`
      : `Need ${formatNumber(deficit)} more Soul${deficit === 1 ? '' : 's'} to reset.`;

    element.title = title;
    element.innerHTML = renderSoulAmount(`-${formattedCost}`, {
      className: 'soul-chip ascension-reset-cost-chip',
      ariaLabel: title,
      showLabel: false
    });
  }

  function handleError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      window.location.href = window.AmongDemons.appUrl('/login');
      return;
    }
    setMessage(error.message || 'Something went wrong.', 'danger');
  }

  function setMessage(text, type) {
    if (!elements.appMessage) return;
    elements.appMessage.textContent = text;
    elements.appMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function onViewportPointerDown(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;

    const viewport = elements.skillTreeViewport;
    if (!viewport) return;

    clearViewportPointer();

    state.viewportPointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false
    };

    document.addEventListener('pointermove', onViewportPointerMove, { passive: false });
    document.addEventListener('pointerup', onViewportPointerUp);
    document.addEventListener('pointercancel', onViewportPointerUp);
  }

  function onViewportPointerMove(event) {
    const viewport = elements.skillTreeViewport;
    const pointer = state.viewportPointer;
    if (!viewport || !pointer || pointer.id !== event.pointerId) return;

    const totalDx = event.clientX - pointer.startX;
    const totalDy = event.clientY - pointer.startY;

    if (!pointer.dragging && Math.hypot(totalDx, totalDy) >= PAN_CLICK_THRESHOLD) {
      pointer.dragging = true;
      viewport.classList.add('is-panning');
    }

    if (pointer.dragging) {
      event.preventDefault();
      viewport.scrollLeft = pointer.startScrollLeft - totalDx;
      viewport.scrollTop = pointer.startScrollTop - totalDy;
    }

    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  }

  function onViewportPointerUp(event) {
    const viewport = elements.skillTreeViewport;
    const pointer = state.viewportPointer;
    if (!viewport || !pointer || pointer.id !== event.pointerId) return;

    if (pointer.dragging) {
      state.suppressNextClick = true;
      window.setTimeout(() => {
        state.suppressNextClick = false;
      }, 100);
    }

    clearViewportPointer();
  }

  function clearViewportPointer() {
    document.removeEventListener('pointermove', onViewportPointerMove);
    document.removeEventListener('pointerup', onViewportPointerUp);
    document.removeEventListener('pointercancel', onViewportPointerUp);
    elements.skillTreeViewport?.classList.remove('is-panning');
    state.viewportPointer = null;
  }

  function onViewportWheel(event) {
    const viewport = elements.skillTreeViewport;
    if (!viewport) return;

    let deltaX = normalizeWheelDelta(event.deltaX, event, viewport);
    let deltaY = normalizeWheelDelta(event.deltaY, event, viewport);

    if (event.shiftKey && Math.abs(deltaX) < Math.abs(deltaY)) {
      deltaX = deltaY;
      deltaY = 0;
    }

    if (!deltaX && !deltaY) return;

    const previousLeft = viewport.scrollLeft;
    const previousTop = viewport.scrollTop;
    viewport.scrollLeft += deltaX;
    viewport.scrollTop += deltaY;

    if (viewport.scrollLeft !== previousLeft || viewport.scrollTop !== previousTop) {
      event.preventDefault();
    }
  }

  function normalizeWheelDelta(value, event, viewport) {
    const delta = Number(value) || 0;
    if (!delta) return 0;
    if (event.deltaMode === 1) return delta * 16;
    if (event.deltaMode === 2) return delta * viewport.clientHeight;
    return delta;
  }

  function centerConstellation() {
    const viewport = elements.skillTreeViewport;
    if (!viewport) return;
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
  }

  function scheduleConstellationCenter() {
    const centerAfterLayout = () => window.setTimeout(centerConstellation, 0);
    if (document.readyState === 'complete') {
      centerAfterLayout();
    } else {
      window.addEventListener('load', centerAfterLayout, { once: true });
    }
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString() : String(value ?? '-');
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }
})();
