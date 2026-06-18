(function() {
  'use strict';

  const elements = {};
  const session = window.AmongDemons.getSession();
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => escapeHtml(value));
  const currentUsername = session.player && session.player.username;
  const pathSorts = new Set(['floor', 'level', 'souls']);
  const topRankIcons = ['crown', 'trophy', 'medal'];
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
    elements.statPlayers = document.querySelector('[data-rank-stat="players"]');
    elements.statFloor = document.querySelector('[data-rank-stat="floor"]');
    elements.statSouls = document.querySelector('[data-rank-stat="souls"]');
  }

  function bindSortLinks() {
    elements.sortLinks.forEach((link) => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        currentSort = link.dataset.sort || 'floor';
        const nextPath = currentSort === 'floor' ? '/rankings' : `/rankings/${currentSort}`;
        window.history.replaceState({}, '', window.AmongDemons.appUrl(nextPath));
        syncSortLinks();
        await loadRank();
      });
    });
  }

  function syncSortLinks() {
    elements.sortLinks.forEach((link) => {
      const isActive = link.dataset.sort === currentSort;
      link.classList.toggle('active', isActive);
      link.setAttribute('aria-current', isActive ? 'page' : 'false');
    });
  }

  async function loadRank() {
    setMessage('', '');
    elements.body.innerHTML = '<tr class="rank-empty-row"><td colspan="5" class="rank-empty-cell">Loading rankings...</td></tr>';

    try {
      const payload = await window.AmongDemons.api(`/api/leaderboard?sort=${encodeURIComponent(currentSort)}`);
      renderRows(payload.players || []);
    } catch (error) {
      elements.body.innerHTML = '<tr class="rank-empty-row"><td colspan="5" class="rank-empty-cell">Could not load rankings.</td></tr>';
      updateStats([]);
      setMessage(error.message || 'Could not load rankings.', 'danger');
    }
  }

  function renderRows(players) {
    updateStats(players);

    elements.body.innerHTML = players.length
      ? players.map((player, index) => renderPlayerRow(player, index)).join('')
      : '<tr class="rank-empty-row"><td colspan="5" class="rank-empty-cell">No hunters yet.</td></tr>';
  }

  function renderPlayerRow(player, index) {
    const rank = index + 1;
    const floor = Number(player.highestFloor) || 0;
    const level = Number(player.level) || 1;
    const souls = Number(player.souls) || 0;
    const topRankIcon = topRankIcons[index] || '';
    const rowClasses = [
      'rank-row',
      rank <= 5 ? `rank-top rank-top-${rank}` : '',
      player.username === currentUsername ? 'current-player-rank' : ''
    ].filter(Boolean).join(' ');

    return `
      <tr class="${rowClasses}">
        <td class="rank-position-cell" data-label="Rank">
          <span class="rank-position">
            <span class="rank-position-icon">${renderRankIcon(topRankIcon)}</span>
            <span class="rank-position-number">${rank}</span>
          </span>
        </td>
        <td class="rank-hunter-cell" data-label="Hunter">
          <span class="rank-hunter">
            <span class="rank-hunter-name">${escapeHtml(player.username)}</span>
          </span>
        </td>
        <td class="rank-floor-cell" data-label="Highest Floor">
          <span class="rank-floor">
            <span class="rank-floor-value">${formatNumber(floor)}</span>
            <span class="rank-floor-label">floor</span>
          </span>
        </td>
        <td data-label="Level"><span class="rank-metric">${formatNumber(level)}</span></td>
        <td data-label="Souls">${renderSoulAmount(formatNumber(souls), {
          showLabel: false,
          className: 'rank-metric rank-metric-souls',
          ariaLabel: `${formatNumber(souls)} Souls`
        })}</td>
      </tr>
    `;
  }

  function updateStats(players) {
    const highestFloor = players.reduce((max, player) => Math.max(max, Number(player.highestFloor) || 0), 0);
    const souls = players.reduce((sum, player) => sum + (Number(player.souls) || 0), 0);

    setStatText(elements.statPlayers, players.length, { compact: true, label: 'Hunters' });
    setText(elements.statFloor, formatNumber(highestFloor));
    setStatText(elements.statSouls, souls, { compact: true, label: 'Souls held' });
  }

  function getInitialSort() {
    const querySort = new URLSearchParams(window.location.search).get('sort');
    if (pathSorts.has(querySort)) return querySort;

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

  function setText(element, text) {
    if (element) element.textContent = text;
  }

  function setStatText(element, value, options = {}) {
    if (!element) return;

    const formatted = options.compact ? formatCompactNumber(value) : formatNumber(value);
    const fullValue = formatNumber(value);
    element.textContent = formatted;
    element.title = fullValue;
    if (options.label) {
      element.setAttribute('aria-label', `${fullValue} ${options.label}`);
    }
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatCompactNumber(value) {
    const number = Number(value || 0);
    const abs = Math.abs(number);

    if (abs < 1000) return formatNumber(number);

    const units = [
      { value: 1000000000, suffix: 'b' },
      { value: 1000000, suffix: 'm' },
      { value: 1000, suffix: 'k' }
    ];
    const unit = units.find((entry) => abs >= entry.value);
    const scaled = number / unit.value;
    const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10;

    return `${String(rounded).replace(/\.0$/, '')}${unit.suffix}`;
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
