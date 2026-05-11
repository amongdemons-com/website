(function() {
  'use strict';

  const elements = {};
  const session = window.AmongDemons.getSession();
  const currentUsername = session.player && session.player.username;
  let currentSort = window.location.pathname.replace(/\/$/, '').endsWith('/souls') ? 'souls' : 'level';

  onReady(init);

  async function init() {
    cacheElements();
    bindSortLinks();
    syncSortLinks();
    await loadRank();
  }

  function cacheElements() {
    elements.body = document.getElementById('rankBody');
    elements.message = document.getElementById('rankMessage');
    elements.sortLinks = document.querySelectorAll('.rank-sort-link');
  }

  function bindSortLinks() {
    elements.sortLinks.forEach((link) => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        currentSort = link.dataset.sort || 'level';
        window.history.replaceState({}, '', currentSort === 'level' ? '/rankings' : `/rankings/${currentSort}`);
        syncSortLinks();
        await loadRank();
      });
    });
  }

  function syncSortLinks() {
    elements.sortLinks.forEach((link) => {
      link.classList.toggle('active', link.dataset.sort === currentSort);
    });
  }

  async function loadRank() {
    setMessage('', '');
    elements.body.innerHTML = '<tr><td colspan="4" class="text-muted">Loading...</td></tr>';

    try {
      const payload = await window.AmongDemons.api(`/api/leaderboard?sort=${encodeURIComponent(currentSort)}`);
      renderRows(payload.players || []);
    } catch (error) {
      elements.body.innerHTML = '<tr><td colspan="4" class="text-muted">Could not load rankings.</td></tr>';
      setMessage(error.message || 'Could not load rankings.', 'danger');
    }
  }

  function renderRows(players) {
    elements.body.innerHTML = players.length
      ? players.map((player, index) => `
        <tr class="${player.username === currentUsername ? 'current-player-rank' : ''}">
          <td class="text-secondary">${index + 1}</td>
          <td>${escapeHtml(player.username)}</td>
          <td>${player.level}</td>
          <td>${player.souls}</td>
        </tr>
      `).join('')
      : '<tr><td colspan="4" class="text-muted">No hunters yet.</td></tr>';
  }

  function setMessage(text, type) {
    elements.message.textContent = text;
    elements.message.className = text ? `alert alert-${type}` : 'alert d-none';
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
