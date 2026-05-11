(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const session = window.AmongDemons.getSession();
  const state = {
    player: session.player || null,
    progression: null,
    collection: []
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
    await refreshAll();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'welcomeText',
      'appMessage',
      'levelStat',
      'xpStat',
      'soulsStat',
      'collectionGrid',
      'adminCheckResult'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });

    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.logoutBtn = document.getElementById('logoutBtn');
    elements.adminCheckBtn = document.getElementById('adminCheckBtn');
  }

  function bindActions() {
    elements.logoutBtn.addEventListener('click', () => {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
    });

    elements.refreshBtn.addEventListener('click', refreshAll);
    elements.adminCheckBtn.addEventListener('click', adminCheck);
  }

  async function refreshAll() {
    await withBusy(elements.refreshBtn, async () => {
      try {
        const [me, progression, demons] = await Promise.all([
          api('/api/auth/me'),
          api('/api/account/progression'),
          api('/api/demons')
        ]);

        state.player = me.player;
        state.progression = progression;
        state.collection = demons.demons || [];

        renderPlayer();
        renderCollection();
      } catch (error) {
        handleAuthError(error);
      }
    });
  }

  async function adminCheck() {
    await withBusy(elements.adminCheckBtn, async () => {
      try {
        await api('/api/admin/demon-balance', { method: 'POST', body: {} });
        elements.adminCheckResult.textContent = 'Balance editor is available.';
      } catch (error) {
        elements.adminCheckResult.textContent = error.message;
      }
    });
  }

  function renderPlayer() {
    const player = state.player || {};
    const progression = state.progression || {};

    elements.navPlayerName.textContent = player.username || '';
    elements.welcomeText.textContent = player.username ? `Welcome, ${player.username}.` : 'Welcome.';
    elements.levelStat.textContent = progression.level ?? player.level ?? '-';
    elements.xpStat.textContent = progression.xp ?? player.xp ?? '-';
    elements.soulsStat.textContent = progression.souls ?? player.souls ?? '-';
  }

  function renderCollection() {
    elements.collectionGrid.innerHTML = state.collection.length
      ? renderDemonCards(state.collection)
      : renderEmptyText('Saved demons will appear here.');
  }

  function renderDemonCards(demons) {
    if (!demons.length) return renderEmptyText('No demons.');

    return demons.map((demon) => `
      <div class="col">
        <div class="card h-100 demon-mini-card">
          <img src="${escapeHtml(demon.imageUrl || demon.image_url)}" class="card-img-top" alt="">
          <div class="card-body">
            <h3 class="h6 card-title mb-1 ad-${escapeHtml(demon.rarity)}">${escapeHtml(demon.species || 'Demon')}</h3>
            <p class="mb-0 text-muted">${capitalize(demon.rarity)} &middot; HP ${demon.hp} &middot; ATK ${demon.atk} &middot; SPD ${demon.speed}</p>
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderEmptyText(text) {
    return `<p class="text-muted mb-0">${text}</p>`;
  }

  function handleAuthError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
      return;
    }

    showError(error);
  }

  function showError(error) {
    setMessage(error.message || 'Something went wrong.', 'danger');
  }

  function setMessage(text, type) {
    elements.appMessage.textContent = text;
    elements.appMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  async function withBusy(button, task) {
    button.disabled = true;
    try {
      await task();
    } finally {
      button.disabled = false;
    }
  }

  function capitalize(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
