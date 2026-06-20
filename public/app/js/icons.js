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
    'last-attack': 'SkipBack',
    melee: 'Swords',
    'next-attack': 'SkipForward',
    pause: 'Pause',
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
  const SOUL_ICON_PATH = '/app/images/assets/soul.svg';

  function renderIcon(name, options = {}) {
    if (isSoulIcon(name)) return renderImageIcon(SOUL_ICON_PATH, 'soul', options);

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

  function renderSoulAmount(value, options = {}) {
    const normalizedValue = value === null || value === undefined || value === '' ? '-' : value;
    const label = options.label || 'Souls';
    const className = [
      'soul-amount',
      options.className || ''
    ].filter(Boolean).join(' ');
    const ariaLabel = options.ariaLabel || `${normalizedValue} ${label}`;

    return `
      <span class="${escapeAttribute(className)}" aria-label="${escapeAttribute(ariaLabel)}">
        ${renderIcon('soul', { size: options.size || 16, className: options.iconClassName || '' })}
        <span class="soul-amount-value">${escapeHtml(normalizedValue)}</span>
        ${options.showLabel === false ? '' : `<span class="soul-amount-label">${escapeHtml(label)}</span>`}
      </span>
    `;
  }

  function updateNavAccount(player = {}, options = {}) {
    const root = options.root || document;
    const accountElement = options.accountElement || root.querySelector('[data-nav-account]');
    const authElement = options.authElement || root.querySelector('[data-nav-auth-actions]');
    const nameElement = options.nameElement || root.querySelector('[data-nav-player-name]') || root.getElementById('navPlayerName');
    const levelElement = options.levelElement || root.querySelector('[data-nav-player-level]') || root.getElementById('navPlayerLevel');
    const profileImageElement = options.profileImageElement || root.querySelector('[data-nav-profile-image]') || root.getElementById('navProfileImage');
    const soulElement = options.soulElement || root.querySelector('[data-nav-souls]') || root.getElementById('navSoulBalance');
    const username = player && player.username ? player.username : 'Hunter';
    const level = Math.max(1, Number(player?.level) || 1);
    const profileImageUrl = options.profileImageUrl || player?.profileDemonImageUrl || '';
    const souls = options.souls ?? player?.souls ?? '-';
    const formattedSouls = formatNumber(souls);

    if (authElement) authElement.classList.add('d-none');
    if (accountElement) accountElement.classList.remove('d-none');
    if (nameElement) nameElement.textContent = username;
    if (levelElement) levelElement.textContent = `Level ${formatNumber(level)}`;
    if (profileImageElement && profileImageUrl) profileImageElement.src = profileImageUrl;
    if (soulElement) {
      soulElement.innerHTML = renderSoulAmount(formattedSouls, {
        className: 'nav-soul-amount',
        ariaLabel: `${formattedSouls} Souls`
      });
    }

    return {
      username,
      souls: formattedSouls
    };
  }

  function clearNavAccount(options = {}) {
    const root = options.root || document;
    const accountElement = options.accountElement || root.querySelector('[data-nav-account]');
    const authElement = options.authElement || root.querySelector('[data-nav-auth-actions]');

    if (accountElement) accountElement.classList.add('d-none');
    if (authElement) authElement.classList.remove('d-none');
  }

  function renderImageIcon(src, name, options = {}) {
    const className = [
      'ad-icon',
      `${name}-icon`,
      options.className || ''
    ].filter(Boolean).join(' ');
    const attributes = {
      class: className,
      src,
      width: options.size || 16,
      height: options.size || 16,
      alt: options.label || '',
      'aria-hidden': options.label ? null : 'true',
      'aria-label': options.label || null,
      focusable: 'false',
      role: options.label ? 'img' : null
    };

    return `<img ${serializeAttributes(cleanAttributes(attributes))}>`;
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

  function isSoulIcon(name) {
    return ['soul', 'souls'].includes(String(name || '').toLowerCase());
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string' && value.trim() === '-') return '-';

    const number = Number(value);
    if (!Number.isFinite(number)) return String(value);

    return number.toLocaleString();
  }

  function toPascalCase(value) {
    return String(value || '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }

  function serializeAttributes(attributes) {
    return Object.entries(attributes)
      .map(([key, value]) => `${key}="${escapeAttribute(value)}"`)
      .join(' ');
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  ui.renderIcon = renderIcon;
  ui.renderSoulAmount = renderSoulAmount;
  ui.updateNavAccount = updateNavAccount;
  ui.clearNavAccount = clearNavAccount;
  ui.replaceStaticIcons = replaceStaticIcons;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', replaceStaticIcons);
  } else {
    replaceStaticIcons();
  }
})();
