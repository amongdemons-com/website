(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
  const state = {
    player: window.AmongDemons.getSession().player || null,
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
    await refreshCollection();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'collectionSummary',
      'collectionMessage',
      'collectionCount',
      'collectionGrid'
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
  }

  async function refreshCollection() {
    await withBusy(elements.refreshBtn, async () => {
      setMessage('', 'danger');

      try {
        const [me, demons] = await Promise.all([
          api('/api/auth/me'),
          api('/api/demons')
        ]);

        state.player = me.player;
        state.collection = demons.demons || [];
        renderCollection();
      } catch (error) {
        handleAuthError(error);
      }
    });
  }

  function renderCollection() {
    const count = state.collection.length;
    const playerName = state.player?.username || '';

    elements.navPlayerName.textContent = playerName;
    elements.collectionCount.textContent = String(count);
    elements.collectionSummary.textContent = count
      ? `${count} demon${count === 1 ? '' : 's'} collected from dungeon runs.`
      : 'Collected demons from dungeon runs will appear here.';
    elements.collectionGrid.innerHTML = count
      ? renderDemonCards(state.collection)
      : renderEmptyState();
  }

  function renderDemonCards(demons) {
    return demons.map((demon) => `
      <div class="col">
        ${renderSharedDemonCard(demon, { className: 'collection-demon-card' })}
      </div>
    `).join('');
  }

  function renderEmptyState() {
    return `
      <div class="col-12">
        <div class="empty-state collection-empty-state">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="">
          <div>
            <h2 class="h5 mb-2">No demons collected yet</h2>
            <p class="text-muted mb-0">Clear dungeon floors and choose demons to bring them here.</p>
          </div>
          <a class="btn btn-primary" href="/dungeon">
            <i class="bi bi-play-fill"></i>
            Start Dungeon
          </a>
        </div>
      </div>
    `;
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

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
