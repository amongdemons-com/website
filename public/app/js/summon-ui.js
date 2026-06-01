(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => String(value));
  const state = {
    player: window.AmongDemons.getSession().player || null,
    progression: null
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
    await refresh();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'soulsBalance',
      'summonPlayerLabel',
      'summonMessage'
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

    elements.refreshBtn.addEventListener('click', refresh);
  }

  async function refresh() {
    await withBusy(elements.refreshBtn, async () => {
      setMessage('', 'danger');

      try {
        const [me, progression] = await Promise.all([
          api('/api/auth/me'),
          api('/api/account/progression')
        ]);

        state.player = me.player;
        state.progression = progression;
        render();
      } catch (error) {
        handleAuthError(error);
      }
    });
  }

  function render() {
    const player = state.player || {};
    const progression = state.progression || {};
    const souls = progression.souls ?? player.souls ?? 0;

    elements.navPlayerName.textContent = player.username || '';
    elements.soulsBalance.innerHTML = renderSoulAmount(souls, {
      showLabel: false,
      className: 'summon-soul-amount',
      size: 48,
      ariaLabel: `${souls} Souls`
    });
    elements.summonPlayerLabel.textContent = player.username
      ? `${player.username}'s available balance`
      : 'Available balance';
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
    elements.summonMessage.textContent = text;
    elements.summonMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  async function withBusy(button, task) {
    button.disabled = true;
    try {
      await task();
    } finally {
      button.disabled = false;
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
