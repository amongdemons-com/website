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
  const MAX_STAT_POINTS = 5;
  const PATH_DEFINITIONS = {
    ravager: { keys: ['power'], threshold: 5 },
    tempest: { keys: ['haste'], threshold: 5 },
    colossus: { keys: ['vitality'], threshold: 5 },
    aegis: { keys: ['fortitude'], threshold: 5 },
    soulbinder: { keys: ['recovery'], threshold: 5 }
  };
  const STAT_KEYS = Object.keys(STAT_DEFINITIONS);
  const state = {
    summary: null,
    draft: null,
    busy: false,
    viewportCenterScheduled: false
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
      'skillTreeViewport',
      'skillTreeLevel',
      'skillTreeTotal',
      'skillTreeSpent',
      'skillTreeUnspent',
      'skillTreeCoreUnspent',
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
      const node = target?.closest('[data-stat-point-key]');
      const key = node?.dataset.statPointKey;
      if (!node || !STAT_KEYS.includes(key) || state.busy) return;

      updateDraft(key);
    });

    elements.skillTreeGrid?.addEventListener('keydown', (event) => {
      if (!['Enter', ' '].includes(event.key)) return;
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const node = target?.closest('[data-stat-point-key]');
      const key = node?.dataset.statPointKey;
      if (!node || !STAT_KEYS.includes(key) || state.busy) return;

      event.preventDefault();
      updateDraft(key);
    });

    elements.skillTreeSaveButton?.addEventListener('click', save);
    elements.skillTreeResetButton?.addEventListener('click', reset);
  }

  function updateDraft(key) {
    if (!state.summary || !state.draft) return;

    const value = Math.max(0, Number(state.draft[key]) || 0);
    const spent = getSpent(state.draft);
    const total = Math.max(0, Number(state.summary.totalPoints) || 0);
    if (spent >= total || value >= MAX_STAT_POINTS) return;

    state.draft = { ...state.draft, [key]: value + 1 };
    render();
  }

  function render() {
    const ready = Boolean(state.summary && state.draft);
    const total = ready ? Math.max(0, Number(state.summary.totalPoints) || 0) : 0;
    const spent = ready ? getSpent(state.draft) : 0;
    const unspent = total - spent;
    const valid = ready && STAT_KEYS.every((key) => Number.isInteger(Number(state.draft[key])) && Number(state.draft[key]) >= 0 && Number(state.draft[key]) <= MAX_STAT_POINTS) && unspent >= 0;
    const dirty = ready && STAT_KEYS.some((key) => Number(state.draft[key]) !== Number(state.summary.allocations?.[key] || 0));

    setText(elements.skillTreeLevel, ready ? formatNumber(state.summary.level) : '-');
    setText(elements.skillTreeTotal, ready ? formatNumber(total) : '-');
    setText(elements.skillTreeSpent, ready ? formatNumber(spent) : '-');
    setText(elements.skillTreeUnspent, ready ? formatNumber(Math.max(0, unspent)) : '-');
    setText(elements.skillTreeCoreUnspent, ready ? formatNumber(Math.max(0, unspent)) : '-');
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
      const bonusOutput = card.querySelector('[data-stat-bonus]');
      const canInvest = ready && !state.busy && valid && unspent > 0 && value < MAX_STAT_POINTS;

      setText(bonusOutput, `+${formatNumber(bonus)}% ${definition.label}`);
      card.classList.toggle('is-invested', value > 0);
      card.classList.toggle('is-disabled', ready && !canInvest && value < MAX_STAT_POINTS);
      card.classList.toggle('is-maxed', value >= MAX_STAT_POINTS);
      card.setAttribute('aria-disabled', String(!canInvest));
      card.setAttribute('aria-label', `${capitalize(key)}: ${formatNumber(value)} of ${MAX_STAT_POINTS} points. ${canInvest ? 'Activate to invest one point.' : value >= MAX_STAT_POINTS ? 'Maximum reached.' : 'No points available.'}`);
    });

    elements.skillTreeGrid?.querySelectorAll('[data-skill-path]').forEach((path) => {
      const definition = PATH_DEFINITIONS[path.dataset.skillPath];
      if (!definition) return;

      const points = ready
        ? definition.keys.reduce((sum, key) => sum + (Number(state.draft[key]) || 0), 0)
        : 0;
      const unlocked = ready && points >= definition.threshold;
      const progress = path.querySelector('[data-path-progress]');
      const keystone = path.querySelector('[data-path-keystone]');
      const keystoneState = path.querySelector('[data-keystone-state]');
      const connection = elements.skillTreeGrid?.querySelector(`[data-path-connection="${path.dataset.skillPath}"]`);

      setText(progress, `${formatNumber(Math.min(points, definition.threshold))} / ${definition.threshold}`);
      progress?.setAttribute('aria-label', `${formatNumber(points)} points invested; ${definition.threshold} required`);
      path.classList.toggle('is-awakened', unlocked);
      keystone?.classList.toggle('is-unlocked', unlocked);
      connection?.classList.toggle('is-invested', points > 0);
      connection?.classList.toggle('is-awakened', unlocked);
      setText(keystoneState, unlocked ? 'Awakened' : 'Locked');
    });

    if (ready && !state.viewportCenterScheduled) {
      state.viewportCenterScheduled = true;
      scheduleConstellationCenter();
    }

    if (elements.skillTreeSaveButton) {
      elements.skillTreeSaveButton.disabled = !valid || !dirty || state.busy;
      elements.skillTreeSaveButton.textContent = state.busy ? 'Sealing...' : 'Seal Constellation';
    }
    if (elements.skillTreeResetButton) {
      elements.skillTreeResetButton.disabled = !ready || state.busy || getSpent(state.draft) <= 0;
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
      setMessage('Constellation sealed. Your ascension bonuses are active.', 'success');
    } catch (error) {
      handleError(error);
    } finally {
      state.busy = false;
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
    render();

    try {
      applySummary(await api('/api/account/stat-points/reset', { method: 'POST' }));
      setMessage('All constellation bindings were released for free.', 'success');
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

  function centerConstellation() {
    const viewport = elements.skillTreeViewport;
    if (!viewport || viewport.scrollWidth <= viewport.clientWidth) return;
    viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
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

  function capitalize(value) {
    const text = String(value || '');
    return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }
})();
