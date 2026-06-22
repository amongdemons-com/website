(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const STAT_DEFINITIONS = {
    vitality: { perPoint: 3, label: 'max HP' },
    power: { perPoint: 3, label: 'attack' },
    haste: { perPoint: 1.5, label: 'speed' },
    fortitude: { perPoint: 2, cap: 30, label: 'damage reduction' },
    recovery: { perPoint: 3, label: 'healing received' }
  };
  const STAT_KEYS = Object.keys(STAT_DEFINITIONS);
  const state = {
    summary: null,
    draft: null,
    busy: false
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
      state.summary = summary;
      state.draft = { ...summary.allocations };
      window.AmongDemons.ui?.updateNavAccount?.(me.player);
      render();
    } catch (error) {
      handleError(error);
    }
  }

  function cacheElements() {
    [
      'appMessage',
      'skillTreeGrid',
      'skillTreeLevel',
      'skillTreeTotal',
      'skillTreeSpent',
      'skillTreeUnspent',
      'skillTreeUnspentCard',
      'skillTreeStatus',
      'skillTreeSaveButton',
      'skillTreeResetButton'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindControls() {
    document.querySelectorAll('[data-disabled-link]').forEach((link) => {
      link.addEventListener('click', (event) => event.preventDefault());
    });

    elements.skillTreeGrid?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest('[data-stat-point-action]');
      const key = button?.closest('[data-stat-point-key]')?.dataset.statPointKey;
      if (!button || !STAT_KEYS.includes(key) || state.busy) return;

      updateDraft(key, button.dataset.statPointAction === 'increase' ? 1 : -1);
    });

    elements.skillTreeSaveButton?.addEventListener('click', save);
    elements.skillTreeResetButton?.addEventListener('click', reset);
  }

  function updateDraft(key, direction) {
    if (!state.summary || !state.draft) return;

    const value = Math.max(0, Number(state.draft[key]) || 0);
    const spent = getSpent(state.draft);
    const total = Math.max(0, Number(state.summary.totalPoints) || 0);
    if (direction > 0 && spent >= total) return;
    if (direction < 0 && value <= 0) return;

    state.draft = { ...state.draft, [key]: value + direction };
    render();
  }

  function render() {
    const ready = Boolean(state.summary && state.draft);
    const total = ready ? Math.max(0, Number(state.summary.totalPoints) || 0) : 0;
    const spent = ready ? getSpent(state.draft) : 0;
    const unspent = total - spent;
    const valid = ready && STAT_KEYS.every((key) => Number.isInteger(Number(state.draft[key])) && Number(state.draft[key]) >= 0) && unspent >= 0;
    const dirty = ready && STAT_KEYS.some((key) => Number(state.draft[key]) !== Number(state.summary.allocations?.[key] || 0));

    setText(elements.skillTreeLevel, ready ? formatNumber(state.summary.level) : '-');
    setText(elements.skillTreeTotal, ready ? formatNumber(total) : '-');
    setText(elements.skillTreeSpent, ready ? formatNumber(spent) : '-');
    setText(elements.skillTreeUnspent, ready ? formatNumber(Math.max(0, unspent)) : '-');
    elements.skillTreeUnspentCard?.classList.toggle('has-unspent-points', valid && unspent > 0);
    setText(elements.skillTreeStatus, !ready
      ? 'Loading level points...'
      : !valid
        ? `Allocations exceed your earned points by ${formatNumber(Math.abs(unspent))}.`
        : unspent > 0
          ? `${formatNumber(unspent)} point${unspent === 1 ? '' : 's'} available.`
          : 'All earned points allocated.');

    elements.skillTreeGrid?.querySelectorAll('[data-stat-point-key]').forEach((card) => {
      const key = card.dataset.statPointKey;
      const definition = STAT_DEFINITIONS[key];
      const value = ready ? Math.max(0, Number(state.draft[key]) || 0) : 0;
      const bonus = Math.min(definition.cap || Infinity, value * definition.perPoint);
      const output = card.querySelector('output');
      const bonusOutput = card.querySelector('[data-stat-bonus]');
      const decrease = card.querySelector('[data-stat-point-action="decrease"]');
      const increase = card.querySelector('[data-stat-point-action="increase"]');

      setText(output, formatNumber(value));
      setText(bonusOutput, `+${formatNumber(bonus)}% ${definition.label}`);
      if (decrease) decrease.disabled = !ready || state.busy || value <= 0;
      if (increase) increase.disabled = !ready || state.busy || !valid || unspent <= 0;
    });

    if (elements.skillTreeSaveButton) {
      elements.skillTreeSaveButton.disabled = !valid || !dirty || state.busy;
      elements.skillTreeSaveButton.textContent = state.busy ? 'Saving...' : 'Save Allocations';
    }
    if (elements.skillTreeResetButton) {
      elements.skillTreeResetButton.disabled = !ready || state.busy || Number(state.summary.spentPoints) <= 0;
    }
  }

  async function save() {
    if (!state.summary || !state.draft || state.busy) return;
    state.busy = true;
    render();

    try {
      const summary = await api('/api/account/stat-points', {
        method: 'POST',
        body: { allocations: state.draft }
      });
      applySummary(summary);
      setMessage('Level points saved. Your upgrades are active.', 'success');
    } catch (error) {
      handleError(error);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function reset() {
    if (!state.summary || state.busy) return;
    state.busy = true;
    render();

    try {
      applySummary(await api('/api/account/stat-points/reset', { method: 'POST' }));
      setMessage('All level point allocations were reset for free.', 'success');
    } catch (error) {
      handleError(error);
    } finally {
      state.busy = false;
      render();
    }
  }

  function applySummary(summary) {
    state.summary = summary;
    state.draft = { ...summary.allocations };
  }

  function getSpent(allocations) {
    return STAT_KEYS.reduce((sum, key) => sum + (Number(allocations?.[key]) || 0), 0);
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
