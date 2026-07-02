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
  const ACCOUNT_LEVEL_BASE_XP = 250;
  const ACCOUNT_LEVEL_EXPONENT = 1.65;
  const XP_MINOR_MARKERS = [10, 20, 30, 40, 60, 70, 80, 90];
  const XP_MAJOR_MARKERS = [25, 50, 75];
  const alertTimers = new WeakMap();
  let navXpState = null;

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
    if (hasXpProgressSource(player)) updateNavXpProgress(player);

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
    clearNavXpProgress({ root });
  }

  function ensureNavXpProgress(options = {}) {
    const root = getDocumentRoot(options.root);
    const host = root.body || document.body;
    if (!host) return null;

    let progress = root.querySelector('[data-nav-xp-progress]');
    if (progress) {
      bindNavXpProgress(progress);
      return progress;
    }

    progress = root.createElement('div');
    progress.className = 'nav-xp-progress d-none';
    progress.dataset.navXpProgress = 'true';
    progress.id = 'navXpProgress';
    progress.tabIndex = 0;
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'XP progress');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');
    progress.setAttribute('aria-valuenow', '0');
    progress.setAttribute('aria-describedby', 'navXpProgressTooltip');
    const minorMarkers = XP_MINOR_MARKERS
      .map((value) => `<span class="nav-xp-progress-mark nav-xp-progress-mark-minor" style="left: ${value}%"></span>`)
      .join('');
    const majorMarkers = XP_MAJOR_MARKERS
      .map((value) => `<span class="nav-xp-progress-mark nav-xp-progress-mark-major" style="left: ${value}%"></span>`)
      .join('');
    progress.innerHTML = `
      <span class="nav-xp-progress-fill" data-nav-xp-progress-fill></span>
      <span class="nav-xp-progress-marks" aria-hidden="true">
        ${minorMarkers}
        ${majorMarkers}
      </span>
      <span class="nav-xp-progress-tooltip" id="navXpProgressTooltip" data-nav-xp-tooltip role="tooltip">XP loading</span>
    `;
    host.appendChild(progress);
    bindNavXpProgress(progress);
    return progress;
  }

  function bindNavXpProgress(progress) {
    if (!progress || progress.dataset.navXpProgressBound === 'true') return;
    progress.dataset.navXpProgressBound = 'true';

    progress.addEventListener('click', (event) => {
      event.stopPropagation();
      progress.classList.toggle('is-tooltip-visible');
    });

    progress.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        progress.classList.remove('is-tooltip-visible');
        progress.blur();
        return;
      }

      if (!['Enter', ' '].includes(event.key)) return;
      event.preventDefault();
      progress.classList.toggle('is-tooltip-visible');
    });

    progress.addEventListener('blur', () => {
      window.setTimeout(() => progress.classList.remove('is-tooltip-visible'), 120);
    });

    document.addEventListener('click', () => {
      progress.classList.remove('is-tooltip-visible');
    });
  }

  function updateNavXpProgress(data = {}, options = {}) {
    const root = getDocumentRoot(options.root);
    const progress = ensureNavXpProgress({ root });
    if (!progress) return null;

    const nextState = normalizeXpProgress(data);
    if (!nextState) return null;
    navXpState = nextState;

    const percentValue = Math.round(nextState.percent * 1000) / 10;
    const percentLabel = formatPercent(nextState.percent);
    const xpIntoLevel = formatNumber(nextState.xpIntoLevel);
    const xpForNextLevel = formatNumber(nextState.xpForNextLevel);
    const nextLevel = formatNumber(nextState.level + 1);
    const level = formatNumber(nextState.level);
    const tooltipHtml = `
      <strong>Level ${escapeHtml(level)}</strong>
      <span>${escapeHtml(xpIntoLevel)} / ${escapeHtml(xpForNextLevel)} XP</span>
      <small>${escapeHtml(percentLabel)} to level ${escapeHtml(nextLevel)}</small>
    `;
    const ariaText = `Level ${level}. ${xpIntoLevel} of ${xpForNextLevel} XP. ${percentLabel} to level ${nextLevel}.`;

    progress.classList.remove('d-none');
    progress.style.setProperty('--nav-xp-progress', `${nextState.percent * 100}%`);
    progress.style.setProperty('--nav-xp-tooltip-left', `${nextState.percent * 100}%`);
    progress.setAttribute('aria-valuenow', String(percentValue));
    progress.setAttribute('aria-valuetext', ariaText);
    progress.title = ariaText;
    root.body?.classList.add('has-nav-xp-progress');

    const fill = progress.querySelector('[data-nav-xp-progress-fill]');
    if (fill) fill.style.width = `${nextState.percent * 100}%`;

    const tooltip = progress.querySelector('[data-nav-xp-tooltip]');
    if (tooltip) tooltip.innerHTML = tooltipHtml;

    return nextState;
  }

  function clearNavXpProgress(options = {}) {
    const root = getDocumentRoot(options.root);
    const progress = root.querySelector('[data-nav-xp-progress]');
    if (progress) {
      progress.classList.add('d-none');
      progress.classList.remove('is-tooltip-visible');
    }
    root.body?.classList.remove('has-nav-xp-progress');
    navXpState = null;
  }

  function getDocumentRoot(root) {
    if (!root) return document;
    return root.nodeType === 9 ? root : root.ownerDocument || document;
  }

  function normalizeXpProgress(data = {}) {
    const source = data || {};
    const fallback = navXpState || {};
    const xp = Math.max(0, Math.floor(toFiniteNumber(source.xp, fallback.xp || 0)));
    const levelFromXp = getAccountLevelForXp(xp);
    const level = Math.max(1, Math.floor(toFiniteNumber(source.level, fallback.level || levelFromXp)), levelFromXp);
    const serverProgress = source.levelProgress || {};
    const currentLevelXp = toFiniteNumber(serverProgress.currentLevelXp, getXpForAccountLevel(level));
    const nextLevelXp = toFiniteNumber(serverProgress.nextLevelXp, getXpForAccountLevel(level + 1));
    const xpForNextLevel = Math.max(1, toFiniteNumber(serverProgress.xpForNextLevel, nextLevelXp - currentLevelXp));
    const xpIntoLevel = clamp(
      toFiniteNumber(serverProgress.xpIntoLevel, xp - currentLevelXp),
      0,
      xpForNextLevel
    );
    const xpToNextLevel = Math.max(0, toFiniteNumber(serverProgress.xpToNextLevel, nextLevelXp - xp));
    const percent = clamp(toFiniteNumber(serverProgress.percent, xpIntoLevel / xpForNextLevel), 0, 1);

    return {
      currentLevelXp,
      level,
      nextLevelXp,
      percent,
      xp,
      xpForNextLevel,
      xpIntoLevel,
      xpToNextLevel
    };
  }

  function hasXpProgressSource(data = {}) {
    if (!data) return false;
    return Boolean(
      data.levelProgress ||
      Number.isFinite(Number(data.xp)) ||
      Number.isFinite(Number(data.xpIntoLevel))
    );
  }

  function getAccountLevelForXp(xp) {
    const totalXp = Math.max(0, Math.floor(Number(xp) || 0));
    let level = Math.floor(Math.pow(totalXp / ACCOUNT_LEVEL_BASE_XP, 1 / ACCOUNT_LEVEL_EXPONENT)) + 1;

    while (getXpForAccountLevel(level + 1) <= totalXp) level += 1;
    while (level > 1 && getXpForAccountLevel(level) > totalXp) level -= 1;

    return level;
  }

  function getXpForAccountLevel(level) {
    const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
    if (targetLevel <= 1) return 0;

    return Math.ceil(ACCOUNT_LEVEL_BASE_XP * Math.pow(targetLevel - 1, ACCOUNT_LEVEL_EXPONENT));
  }

  function toFiniteNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function formatPercent(value) {
    const percent = clamp(Number(value) || 0, 0, 1) * 100;
    if (percent > 0 && percent < 1) return '<1%';
    return `${Math.round(percent)}%`;
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

  function initializeGameAlerts() {
    document.querySelectorAll('.alert[role="alert"]').forEach(bindGameAlert);

    if (!document.body || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver((mutations) => {
      const alerts = new Set();

      mutations.forEach((mutation) => {
        if (mutation.target instanceof Element) {
          const alert = mutation.target.matches?.('.alert[role="alert"]')
            ? mutation.target
            : mutation.target.closest?.('.alert[role="alert"]');
          if (alert) alerts.add(alert);
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches('.alert[role="alert"]')) alerts.add(node);
          node.querySelectorAll?.('.alert[role="alert"]').forEach((alert) => alerts.add(alert));
        });
      });

      alerts.forEach(bindGameAlert);
    });

    observer.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      characterData: true
    });
  }

  function bindGameAlert(alert) {
    if (!alert.classList.contains('game-toast-alert')) {
      alert.classList.add('game-toast-alert');
    }

    if (alert.dataset.gameAlertBound !== 'true') {
      alert.dataset.gameAlertBound = 'true';
      alert.tabIndex = 0;
      alert.title = 'Dismiss notification';
      alert.addEventListener('click', () => dismissGameAlert(alert));
      alert.addEventListener('keydown', (event) => {
        if (!['Enter', ' ', 'Escape'].includes(event.key)) return;
        event.preventDefault();
        dismissGameAlert(alert);
      });
    }

    scheduleGameAlertDismissal(alert);
  }

  function scheduleGameAlertDismissal(alert) {
    const currentTimer = alertTimers.get(alert);
    if (currentTimer) window.clearTimeout(currentTimer);
    alertTimers.delete(alert);

    if (alert.classList.contains('d-none') || !alert.textContent.trim()) return;

    const delay = alert.classList.contains('alert-danger') ? 8000 : 5500;
    const timer = window.setTimeout(() => dismissGameAlert(alert), delay);
    alertTimers.set(alert, timer);
  }

  function dismissGameAlert(alert) {
    const currentTimer = alertTimers.get(alert);
    if (currentTimer) window.clearTimeout(currentTimer);
    alertTimers.delete(alert);
    alert.classList.add('d-none');
  }

  function initializeUi() {
    replaceStaticIcons();
    initializeGameAlerts();
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
  ui.updateNavXpProgress = updateNavXpProgress;
  ui.clearNavXpProgress = clearNavXpProgress;
  ui.replaceStaticIcons = replaceStaticIcons;
  ui.dismissGameAlert = dismissGameAlert;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeUi);
  } else {
    initializeUi();
  }
})();
