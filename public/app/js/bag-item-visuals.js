(function() {
  'use strict';

  const bagVisuals = window.AmongDemons.bagVisuals || {};
  const renderers = new Map();
  const RARITIES = new Set(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
  const ASSET_BASE = '/app/images/items/echo';
  const ECHO_TYPES = Object.freeze({
    1: { key: 'melee', label: 'Melee', asset: '01-melee', motion: 'strike', essence: '#D1D5D8' },
    2: { key: 'ranged', label: 'Ranged sniper', asset: '02-ranged', motion: 'focus', essence: '#171D24' },
    3: { key: 'poisoner', label: 'Poisoner', asset: '03-poisoner', motion: 'bubble', essence: '#167246' },
    4: { key: 'aoe', label: 'AOE', asset: '04-aoe', motion: 'expand', essence: '#E25041' },
    5: { key: 'bruiser', label: 'Bruiser', asset: '05-bruiser', motion: 'heavy', essence: '#C8BDAA' },
    6: { key: 'assassin', label: 'Assassin', asset: '06-assassin', motion: 'dart', essence: '#C084FC' },
    7: { key: 'striker', label: 'Striker / cleave', asset: '07-striker', motion: 'cleave', essence: '#FFB23F' },
    8: { key: 'counter-tank', label: 'Counter tank', asset: '08-counter-tank', motion: 'roots', essence: '#6E8F45' },
    9: { key: 'juggernaut', label: 'Juggernaut', asset: '09-juggernaut', motion: 'core', essence: '#9BA8B8' },
    10: { key: 'healer', label: 'Healer', asset: '10-healer', motion: 'rise', essence: '#8DE7FF' },
    11: { key: 'chaotic', label: 'Chaotic', asset: '11-chaotic', motion: 'chaos', essence: '#52B7FF' }
  });
  function registerItemVisual(itemType, renderer) {
    const key = String(itemType || '').trim().toLowerCase();
    if (!key || typeof renderer !== 'function') return false;
    renderers.set(key, renderer);
    return true;
  }

  function renderItemVisual(item, options = {}) {
    const itemType = String(item?.itemType || 'other').toLowerCase();
    const renderer = renderers.get(itemType);
    if (!renderer) return renderUnknownItemVisual(item, options);
    try {
      return renderer(item, options);
    } catch (error) {
      console.error(`Unable to render ${itemType} bag visual.`, error);
      return renderUnknownItemVisual(item, options);
    }
  }

  function EchoItemVisual(item, options = {}) {
    const typeId = Number(item?.typeId);
    const knownType = ECHO_TYPES[typeId];
    const type = knownType || ECHO_TYPES[1];
    const rarity = normalizeRarity(item?.rarity);
    const context = options.context === 'detail' ? 'detail' : 'slot';
    const shellUrl = `${ASSET_BASE}/${type.asset}.webp`;
    const maskUrl = `${ASSET_BASE}/${type.asset}-mask.png`;
    const typeAttribute = knownType ? String(typeId) : 'unknown';
    const loading = context === 'detail' ? 'eager' : 'lazy';
    const title = typeof options.title === 'string'
      ? options.title
      : `${knownType ? type.label : 'Unknown'} Echo vessel`;

    return `
      <span class="bag-item-renderer echo-item-visual echo-type-${type.key} echo-motion-${type.motion} echo-context-${context}" data-echo-type="${typeAttribute}" data-rarity="${rarity}" style="--echo-shell-mask: url('${shellUrl}'); --echo-fill-mask: url('${maskUrl}'); --echo-essence-color: ${type.essence}" title="${escapeHtml(title)}" aria-hidden="true">
        <span class="echo-rarity-ornament" aria-hidden="true"></span>
        <span class="echo-rarity-aura" aria-hidden="true"></span>
        <span class="echo-essence-fill" aria-hidden="true"><span class="echo-fill-surface"></span></span>
        <img class="echo-item-shell" src="${shellUrl}" alt="" width="512" height="512" loading="${loading}" decoding="async" draggable="false">
        ${knownType ? '' : '<span class="echo-unknown-mark" aria-hidden="true">?</span>'}
      </span>`;
  }

  function renderUnknownItemVisual(item, options = {}) {
    const context = options.context === 'detail' ? 'detail' : 'slot';
    const itemType = escapeHtml(String(item?.itemType || 'other').toLowerCase());
    return `
      <span class="bag-item-renderer bag-unknown-visual echo-context-${context}" data-item-type="${itemType}" aria-hidden="true">
        <span class="unknown-item-body"><span class="unknown-item-mark">?</span></span>
      </span>`;
  }

  function normalizeRarity(value) {
    const rarity = String(value || 'common').toLowerCase();
    return RARITIES.has(rarity) ? rarity : 'common';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    })[character]);
  }

  registerItemVisual('echo', EchoItemVisual);

  window.AmongDemons.bagVisuals = Object.assign(bagVisuals, {
    ECHO_TYPES,
    EchoItemVisual,
    registerItemVisual,
    renderItemVisual
  });
})();
