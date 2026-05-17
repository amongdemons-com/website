(function() {
  'use strict';

  const AmongDemons = window.AmongDemons = window.AmongDemons || {};
  const ui = AmongDemons.ui = AmongDemons.ui || {};

  const ICON_ALIASES = {
    attack: 'Swords',
    battle: 'Zap',
    back: 'ChevronLeft',
    collection: 'Grid3X3',
    crosshair: 'Crosshair',
    flag: 'Flag',
    hp: 'Droplet',
    log: 'List',
    login: 'LogIn',
    logout: 'LogOut',
    melee: 'Swords',
    play: 'Play',
    poison: 'FlaskConical',
    potion: 'FlaskConical',
    ranged: 'BowArrow',
    recruit: 'UserPlus',
    refresh: 'RefreshCw',
    replay: 'RotateCcw',
    send: 'Send',
    settings: 'SlidersHorizontal',
    skip: 'CircleArrowRight',
    speed: 'Zap',
    stars: 'Sparkles',
    trash: 'Trash2'
  };

  function renderIcon(name, options = {}) {
    const lucideApi = window.lucide;
    if (!lucideApi || typeof lucideApi.createElement !== 'function') return '';

    const iconName = ICON_ALIASES[name] || toPascalCase(name);
    const iconNode = lucideApi.icons?.[iconName] || lucideApi[iconName];
    if (!iconNode) return '';

    const className = [
      'ad-icon',
      isPoisonIcon(name) ? 'ad-icon-poison' : '',
      shouldFillIcon(name) ? 'ad-icon-fill' : '',
      options.className || ''
    ].filter(Boolean).join(' ');
    const attributes = {
      class: className,
      width: options.size || 16,
      height: options.size || 16,
      'aria-hidden': options.label ? null : 'true',
      'aria-label': options.label || null,
      focusable: 'false',
      role: options.label ? 'img' : null,
      'stroke-width': options.strokeWidth || 2.25
    };
    const svg = lucideApi.createElement(iconNode, cleanAttributes(attributes));
    return svg.outerHTML;
  }

  function replaceStaticIcons() {
    if (!window.lucide || typeof window.lucide.createIcons !== 'function') return;
    window.lucide.createIcons({
      attrs: {
        class: 'ad-icon',
        'aria-hidden': 'true',
        focusable: 'false',
        'stroke-width': 2.25
      }
    });
  }

  function cleanAttributes(attributes) {
    return Object.fromEntries(
      Object.entries(attributes).filter(([, value]) => value !== null && value !== undefined && value !== '')
    );
  }

  function shouldFillIcon(name) {
    return ['attack', 'hp', 'melee'].includes(String(name || '').toLowerCase());
  }

  function isPoisonIcon(name) {
    return String(name || '').toLowerCase() === 'poison';
  }

  function toPascalCase(value) {
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  ui.renderIcon = renderIcon;
  ui.replaceStaticIcons = replaceStaticIcons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', replaceStaticIcons);
  } else {
    replaceStaticIcons();
  }
})();
