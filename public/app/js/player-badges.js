(function() {
  'use strict';

  const AmongDemons = window.AmongDemons = window.AmongDemons || {};
  const ui = AmongDemons.ui = AmongDemons.ui || {};

  function renderPlayerBadges(badges = [], options = {}) {
    const entries = (Array.isArray(badges) ? badges : []).filter((badge) => (
      badge && badge.key && badge.name && badge.description
    ));
    const idAttribute = options.id ? ` id="${escapeHtml(options.id)}"` : '';
    const contextClass = options.context ? ` player-badges--${toClassName(options.context)}` : '';
    return `<span${idAttribute} class="player-badges${contextClass}" aria-label="Hunter badges">
      ${entries.map(renderPlayerBadge).join('')}
    </span>`;
  }

  function renderPlayerBadge(badge) {
    const key = toClassName(badge.key);
    const name = String(badge.name || 'Player badge');
    const description = String(badge.description || '');
    const icon = String(badge.icon || 'shield');
    const renderIcon = ui.renderIcon;
    const iconHtml = typeof renderIcon === 'function'
      ? renderIcon(icon, { size: 18, strokeWidth: 2.15 })
      : '';
    return `
      <span class="player-badge player-badge--${key}" tabindex="0"
            aria-label="${escapeHtml(`${name}. ${description}`)}">
        <span class="player-badge-mark" aria-hidden="true">${iconHtml}</span>
        <span class="player-badge-tooltip" role="tooltip">
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(description)}</span>
        </span>
      </span>`;
  }

  function toClassName(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  ui.renderPlayerBadges = renderPlayerBadges;
})();
