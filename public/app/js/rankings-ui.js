(function() {
  'use strict';

  const elements = {};
  const session = window.AmongDemons.getSession();
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => escapeHtml(value));
  const currentUsername = session.player && session.player.username;
  const pathSorts = new Set(['floor', 'level', 'souls', 'pvp']);
  const topRankIcons = ['crown', 'trophy', 'medal'];
  let currentSort = getInitialSort();
  let activeLoadId = 0;

  onReady(init);

  async function init() {
    cacheElements();
    bindSortLinks();
    syncSortLinks();
    await loadRank();
  }

  function cacheElements() {
    elements.body = document.getElementById('rankBody');
    elements.table = elements.body?.closest('table');
    elements.message = document.getElementById('rankMessage');
    elements.sortLinks = document.querySelectorAll('.rank-sort-link');
    elements.statPlayers = document.querySelector('[data-rank-stat="players"]');
    elements.statSouls = document.querySelector('[data-rank-stat="souls"]');
    elements.statPvpBattles = document.querySelector('[data-rank-stat="pvpBattles"]');
  }

  function bindSortLinks() {
    elements.sortLinks.forEach((link) => {
      link.addEventListener('click', async (event) => {
        event.preventDefault();
        if (link.getAttribute('aria-disabled') === 'true') return;

        const nextSort = link.dataset.sort || 'floor';
        if (nextSort === currentSort) return;

        currentSort = nextSort;
        const nextPath = currentSort === 'floor' ? '/rankings' : `/rankings/${currentSort}`;
        window.history.replaceState({}, '', window.AmongDemons.appUrl(nextPath));
        syncSortLinks();
        await loadRank({ preserveRows: true });
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

  async function loadRank(options = {}) {
    const loadId = activeLoadId + 1;
    activeLoadId = loadId;
    const preserveRows = options.preserveRows === true && hasRenderedRows();

    setMessage('', '');
    setRankBusy(true);
    if (!preserveRows) {
      elements.body.innerHTML = '<tr class="rank-empty-row"><td colspan="4" class="rank-empty-cell">Loading rankings...</td></tr>';
    }

    try {
      const payload = await window.AmongDemons.api(`/api/leaderboard?sort=${encodeURIComponent(currentSort)}`);
      if (loadId !== activeLoadId) return;
      renderRows(payload.players || [], payload.stats || {});
    } catch (error) {
      if (loadId !== activeLoadId) return;
      if (!preserveRows) {
        elements.body.innerHTML = '<tr class="rank-empty-row"><td colspan="4" class="rank-empty-cell">Could not load rankings.</td></tr>';
        updateStats([], {});
      }
      setMessage(error.message || 'Could not load rankings.', 'danger');
    } finally {
      if (loadId === activeLoadId) {
        setRankBusy(false);
      }
    }
  }

  function renderRows(players, stats = {}) {
    updateStats(players, stats);

    elements.body.innerHTML = players.length
      ? players.map((player, index) => renderPlayerRow(player, index)).join('')
      : '<tr class="rank-empty-row"><td colspan="4" class="rank-empty-cell">No hunters yet.</td></tr>';
  }

  function renderPlayerRow(player, index) {
    const rank = index + 1;
    const floor = Number(player.highestFloor) || 0;
    const level = Number(player.level) || 1;
    const souls = Number(player.souls) || 0;
    const pvpWins = Math.max(0, Number(player.pvpWins) || 0);
    const pvpLosses = Math.max(0, Number(player.pvpLosses) || 0);
    const hunterHref = window.AmongDemons.appUrl(`/hunter/${encodeURIComponent(player.username || '')}`);
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
            <a class="rank-hunter-name rank-hunter-name-link" href="${escapeHtml(hunterHref)}">${escapeHtml(player.username)}</a>
            <small class="rank-hunter-meta">Level ${formatNumber(level)} &middot; ${formatNumber(pvpWins)}-${formatNumber(pvpLosses)}</small>
          </span>
        </td>
        <td class="rank-floor-cell" data-label="Highest Floor">
          <span class="rank-floor">
            <span class="rank-floor-value">${formatNumber(floor)}</span>
            <span class="rank-floor-label">floor</span>
          </span>
        </td>
        <td data-label="Souls">${renderSoulAmount(formatNumber(souls), {
          showLabel: false,
          className: 'rank-metric rank-metric-souls',
          ariaLabel: `${formatNumber(souls)} Souls`
        })}</td>
      </tr>
    `;
  }

  function updateStats(players, stats = {}) {
    const fallbackPlayers = players.length;
    const fallbackSouls = players.reduce((sum, player) => sum + (Number(player.souls) || 0), 0);
    const fallbackPvpBattles = players.reduce((sum, player) => sum + Math.max(0, Number(player.pvpWins) || 0), 0);
    const playerCount = Number.isFinite(Number(stats.players))
      ? Math.max(0, Number(stats.players) || 0)
      : fallbackPlayers;
    const souls = Number.isFinite(Number(stats.souls))
      ? Math.max(0, Number(stats.souls) || 0)
      : fallbackSouls;
    const pvpBattles = Number.isFinite(Number(stats.pvpBattles))
      ? Math.max(0, Number(stats.pvpBattles) || 0)
      : fallbackPvpBattles;

    setStatText(elements.statPlayers, playerCount, { compact: true, label: 'Hunters' });
    setStatText(elements.statSouls, souls, { compact: true, label: 'Souls held' });
    setStatText(elements.statPvpBattles, pvpBattles, { compact: true, label: 'PvP Battles' });
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

  function hasRenderedRows() {
    return Boolean(elements.body?.querySelector('tr:not(.rank-empty-row)'));
  }

  function setRankBusy(isBusy) {
    elements.table?.classList.toggle('is-rank-loading', isBusy);
    elements.table?.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    elements.sortLinks?.forEach((link) => {
      if (isBusy) {
        link.setAttribute('aria-disabled', 'true');
      } else {
        link.removeAttribute('aria-disabled');
      }
    });
  }

  function renderRankIcon(iconName) {
    const renderIcon = window.AmongDemons?.ui?.renderIcon;
    if (!iconName || typeof renderIcon !== 'function') return '';

    return renderIcon(iconName, { size: 16, className: 'rank-icon' });
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
