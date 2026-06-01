(function() {
  'use strict';

  const elements = {};
  const session = window.AmongDemons.getSession();
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => escapeHtml(value));
  const currentUsername = session.player && session.player.username;
  const pathSorts = new Set(['floor', 'level', 'souls']);
  const topRankTitles = [
    { title: 'Dungeon Sovereign', icon: 'crown' },
    { title: 'Abyss Warden', icon: 'trophy' },
    { title: 'Rift Champion', icon: 'medal' },
    { title: 'Elite Delver', icon: 'sparkles' },
    { title: 'Oathbound Hunter', icon: 'flame' }
  ];
  let currentSort = getInitialSort();

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
        currentSort = link.dataset.sort || 'floor';
        window.history.replaceState({}, '', currentSort === 'floor' ? '/rankings' : `/rankings/${currentSort}`);
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
    elements.body.innerHTML = '<tr><td colspan="5" class="text-muted">Loading...</td></tr>';

    try {
      const payload = await window.AmongDemons.api(`/api/leaderboard?sort=${encodeURIComponent(currentSort)}`);
      renderRows(payload.players || []);
    } catch (error) {
      elements.body.innerHTML = '<tr><td colspan="5" class="text-muted">Could not load rankings.</td></tr>';
      setMessage(error.message || 'Could not load rankings.', 'danger');
    }
  }

  function renderRows(players) {
    const highestFloor = players.reduce((max, player) => Math.max(max, Number(player.highestFloor) || 0), 0);

    elements.body.innerHTML = players.length
      ? players.map((player, index) => renderPlayerRow(player, index, highestFloor)).join('')
      : '<tr><td colspan="5" class="text-muted">No hunters yet.</td></tr>';
  }

  function renderPlayerRow(player, index, highestFloor) {
    const rank = index + 1;
    const floor = Number(player.highestFloor) || 0;
    const level = Number(player.level) || 1;
    const souls = Number(player.souls) || 0;
    const topRank = topRankTitles[index];
    const rowClasses = [
      'rank-row',
      topRank ? `rank-top rank-top-${rank}` : '',
      player.username === currentUsername ? 'current-player-rank' : ''
    ].filter(Boolean).join(' ');
    const progress = highestFloor > 0 ? Math.max(4, Math.round((floor / highestFloor) * 100)) : 0;
    const style = topRank ? ` style="--rank-progress: ${progress}%;"` : '';

    return `
      <tr class="${rowClasses}"${style}>
        <td>
          <span class="rank-badge">
            <span class="rank-badge-icon">${renderRankIcon(topRank?.icon)}</span>
            <span class="rank-badge-number">${rank}</span>
          </span>
        </td>
        <td>
          <span class="rank-hunter">
            <span class="rank-hunter-name">${escapeHtml(player.username)}</span>
            ${topRank ? `<span class="rank-title">${topRank.title}</span>` : ''}
          </span>
        </td>
        <td class="rank-floor-cell">
          <span class="rank-floor">
            <span class="rank-floor-value">${formatNumber(floor)}</span>
            <span class="rank-floor-label">floor</span>
          </span>
          ${topRank ? '<span class="rank-progress-bar" aria-hidden="true"><span></span></span>' : ''}
        </td>
        <td><span class="rank-metric">${formatNumber(level)}</span></td>
        <td>${renderSoulAmount(formatNumber(souls), {
          showLabel: false,
          className: 'rank-metric rank-metric-souls',
          ariaLabel: `${formatNumber(souls)} Souls`
        })}</td>
      </tr>
    `;
  }

  function getInitialSort() {
    const normalizedPath = window.location.pathname.replace(/\/$/, '');
    const maybeSort = normalizedPath.slice(normalizedPath.lastIndexOf('/') + 1);

    return pathSorts.has(maybeSort) ? maybeSort : 'floor';
  }

  function setMessage(text, type) {
    elements.message.textContent = text;
    elements.message.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  function renderRankIcon(iconName) {
    const renderIcon = window.AmongDemons?.ui?.renderIcon;
    if (!iconName || typeof renderIcon !== 'function') return '';

    return renderIcon(iconName, { size: 16, className: 'rank-icon' });
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
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
