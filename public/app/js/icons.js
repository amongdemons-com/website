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
  const GAME_ALERT_SELECTOR = '.alert.game-alert, .alert[role="alert"], .alert[role="status"]';
  const SOUL_ICON_PATH = '/app/images/assets/soul.svg';
  const ACCOUNT_LEVEL_BASE_XP = 250;
  const ACCOUNT_LEVEL_EXPONENT = 1.65;
  const XP_MINOR_MARKERS = [10, 20, 30, 40, 60, 70, 80, 90];
  const XP_MAJOR_MARKERS = [25, 50, 75];
  const LEVEL_UP_PARTICLE_COUNT = 88;
  const LEVEL_UP_ANIMATION_MS = 3200;
  const LEVEL_UP_REDUCED_ANIMATION_MS = 1600;
  const LEVEL_UP_DISMISS_MS = 220;
  const LEVEL_UP_ANCHOR_ANIMATION_MS = 2200;
  const LEVEL_UP_SEEN_STORAGE_PREFIX = 'amongdemons-level-up-seen';
  const alertTimers = new WeakMap();
  let navXpState = null;
  let levelUpAnimationSerial = 0;
  let dismissActiveLevelUpAnimation = null;

  function renderIcon(name, options = {}) {
    if (isSoulIcon(name)) return renderImageIcon(SOUL_ICON_PATH, 'soul', options);

    const lucideApi = window.lucide;
    if (!lucideApi || typeof lucideApi.createElement !== 'function') return '';

    const iconName = ICON_ALIASES[name] || toPascalCase(name);
    const iconNode = lucideApi.icons?.[iconName] || lucideApi[iconName];
    if (!iconNode) return '';

    const className = [
      'game-icon',
      isPoisonIcon(name) ? 'game-icon-poison' : '',
      shouldFillIcon(name) ? 'game-icon-fill' : '',
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
    const hasSoulValue = options.souls !== undefined || player?.souls !== undefined;
    const souls = hasSoulValue ? (options.souls ?? player?.souls) : undefined;
    const currentSoulText = getCurrentSoulText(soulElement);
    const formattedSouls = hasSoulValue ? formatNumber(souls) : (currentSoulText || '-');

    if (authElement) authElement.classList.add('d-none');
    if (accountElement) accountElement.classList.remove('d-none');
    if (nameElement) nameElement.textContent = username;
    if (levelElement) levelElement.textContent = `Level ${formatNumber(level)}`;
    if (profileImageElement && profileImageUrl) profileImageElement.src = toCompactDemonImageUrl(profileImageUrl);
    if (soulElement && (hasSoulValue || !currentSoulText)) {
      soulElement.innerHTML = renderSoulAmount(formattedSouls, {
        className: 'nav-soul-amount',
        ariaLabel: `${formattedSouls} Souls`
      });
    }
    if (hasXpProgressSource(player)) updateNavXpProgress(player, { root, animate: options.animate });
    applyGuestNav(accountElement, resolveNavIsGuest(player));

    return {
      username,
      souls: formattedSouls
    };
  }

  // Partial nav payloads (e.g. the world state player) may omit isGuest; fall
  // back to the stored session so a guest never loses the Save control when a
  // page refreshes the nav with a slimmer player object.
  function resolveNavIsGuest(player) {
    if (player && typeof player.isGuest === 'boolean') return player.isGuest;
    const stored = window.AmongDemons?.getPlayer?.();
    return Boolean(stored && stored.isGuest);
  }

  // Guest hunters keep settings available, replace logout with a "Save"
  // call-to-action, and retain their souls and identity. The button opens the
  // register page in claim mode (see auth-ui.js).
  function applyGuestNav(accountElement, isGuest) {
    if (!accountElement) return;

    accountElement.classList.toggle('is-guest', isGuest);
    const settingsLink = accountElement.querySelector('.nav-settings-link');
    const logoutButton = accountElement.querySelector('#logoutBtn, .nav-logout-btn');
    if (settingsLink) settingsLink.classList.remove('d-none');
    if (logoutButton) logoutButton.classList.toggle('d-none', isGuest);

    let saveButton = accountElement.querySelector('[data-guest-save]');

    if (!isGuest) {
      if (saveButton) saveButton.classList.add('d-none');
      return;
    }

    if (!saveButton) {
      saveButton = document.createElement('a');
      saveButton.className = 'btn btn-primary btn-sm nav-guest-save-btn';
      saveButton.setAttribute('data-guest-save', '');
      saveButton.href = '/register?claim=1';
      saveButton.title = 'Save your hunter to keep your progress forever';
      saveButton.innerHTML = `${renderIcon('save', { size: 16 })}<span>Save</span>`;
      accountElement.appendChild(saveButton);
    }

    saveButton.classList.remove('d-none');
  }

  // The nav avatar renders at ~34px, so swap full-size demon art for the small
  // WebP variants generated by scripts/generate-demon-map-variants.js.
  function toCompactDemonImageUrl(url) {
    return toDemonImageUrl(url, 'map');
  }

  function toDemonImageUrl(demonOrUrl, variant = 'portrait') {
    const fallback = typeof demonOrUrl === 'object'
      ? demonOrUrl?.imageUrl || demonOrUrl?.image_url || ''
      : String(demonOrUrl || '');
    const explicitId = typeof demonOrUrl === 'object'
      ? Number(demonOrUrl?.sourceDemonId ?? demonOrUrl?.source_demon_id ?? demonOrUrl?.assetId)
      : 0;
    const match = /^\/app\/images\/demons\/(?:(?:thumbnails|map|portrait)\/)?(\d+)\.(?:png|webp)$/i.exec(fallback);
    const sourceId = Number.isInteger(explicitId) && explicitId > 0
      ? explicitId
      : Number(match?.[1]) || 0;
    if (!sourceId || !['map', 'portrait'].includes(variant)) return fallback;
    return `/app/images/demons/${variant}/${sourceId}.webp`;
  }

  function getCurrentSoulText(soulElement) {
    return soulElement?.querySelector?.('.soul-amount-value')?.textContent?.trim() || '';
  }

  function clearNavAccount(options = {}) {
    const root = options.root || document;
    const accountElement = options.accountElement || root.querySelector('[data-nav-account]');
    const authElement = options.authElement || root.querySelector('[data-nav-auth-actions]');

    if (accountElement) accountElement.classList.add('d-none');
    if (authElement) authElement.classList.remove('d-none');
    clearNavXpProgress({ root });
  }

  function updateNavProgression(progression = {}, options = {}) {
    const root = options.root || document;
    const levelElement = options.levelElement || root.querySelector('[data-nav-player-level]') || root.getElementById('navPlayerLevel');
    const soulElement = options.soulElement || root.querySelector('[data-nav-souls]') || root.getElementById('navSoulBalance');

    if (levelElement && Number.isFinite(Number(progression.level))) {
      levelElement.textContent = `Level ${formatNumber(Math.max(1, Number(progression.level) || 1))}`;
    }

    if (soulElement && progression.souls !== undefined) {
      const formattedSouls = formatNumber(progression.souls);
      soulElement.innerHTML = renderSoulAmount(formattedSouls, {
        className: 'nav-soul-amount',
        ariaLabel: `${formattedSouls} Souls`
      });
    }

    if (hasXpProgressSource(progression)) {
      return updateNavXpProgress(progression, options);
    }

    return null;
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
    progress.dataset.xpProgress = 'true';
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

    const authoritativePreviousLevel = Math.max(
      1,
      Math.floor(toFiniteNumber(data.previousLevel, nextState.level))
    );
    // Only a payout response that carries the server-calculated transition may
    // celebrate. Comparing nav snapshots is racy and can also turn a later,
    // unrelated account refresh into a false level-up.
    const confirmedLevelUp = data.leveledUp === true &&
      nextState.level > authoritativePreviousLevel;
    const shouldAnimateLevelUp = options.animate !== false &&
      confirmedLevelUp &&
      (
        options.forceLevelUpAnimation === true ||
        nextState.level > getSeenLevelUpLevel(data)
      );

    if (shouldAnimateLevelUp) {
      const view = root.defaultView || window;
      rememberSeenLevelUpLevel(data, nextState.level);
      view.requestAnimationFrame(() => {
        triggerLevelUpAnimation({
          root,
          level: nextState.level,
          previousLevel: authoritativePreviousLevel,
          detail: getLevelUpDetail({ level: authoritativePreviousLevel }, nextState),
          progress: nextState
        });
      });
    }

    return nextState;
  }

  function triggerLevelUpAnimation(options = {}) {
    const root = getDocumentRoot(options.root);
    const host = root.body || document.body;
    if (!host) return null;

    const view = root.defaultView || window;
    const reducedMotion = Boolean(view.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const currentState = options.progress || navXpState || {};
    const level = Math.max(1, Math.floor(toFiniteNumber(options.level, currentState.level || 1)));
    const previousLevel = Math.max(0, Math.floor(toFiniteNumber(options.previousLevel, 0)));
    const levelLabel = options.label || `Level ${formatNumber(level)}`;
    const detail = options.detail || (previousLevel > 0 && level > previousLevel
      ? getLevelUpDetail({ level: previousLevel }, { level })
      : 'New power awakened');
    const serial = String(++levelUpAnimationSerial);
    rememberSeenLevelUpLevel(currentState, level);
    window.AmongDemons.audio?.play('sfx.progression.levelUp', { volume: 0.96 });

    animateLevelUpAnchors(root, serial, reducedMotion);
    if (typeof dismissActiveLevelUpAnimation === 'function') {
      dismissActiveLevelUpAnimation({ immediate: true });
    }
    root.querySelectorAll('[data-level-up-celebration]').forEach((node) => node.remove());

    const overlay = root.createElement('div');
    overlay.className = `level-up-celebration${reducedMotion ? ' is-reduced-motion' : ''}`;
    overlay.dataset.levelUpCelebration = 'true';
    overlay.dataset.levelUpSerial = serial;
    overlay.tabIndex = -1;
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'assertive');
    overlay.setAttribute('aria-atomic', 'true');
    overlay.innerHTML = renderLevelUpCelebration(levelLabel, detail, reducedMotion);
    host.appendChild(overlay);
    host.classList.add('is-level-up-celebrating');

    let dismissed = false;
    let removalTimer = view.setTimeout(removeLevelUpAnimation, reducedMotion ? LEVEL_UP_REDUCED_ANIMATION_MS : LEVEL_UP_ANIMATION_MS);

    function dismissLevelUpAnimation(eventOrOptions = {}) {
      eventOrOptions.preventDefault?.();
      if (dismissed) return;
      dismissed = true;
      view.clearTimeout(removalTimer);
      cleanupLevelUpAnchors(root, serial);

      if (eventOrOptions.immediate || reducedMotion) {
        removeLevelUpAnimation();
        return;
      }

      overlay.classList.add('is-dismissing');
      removalTimer = view.setTimeout(removeLevelUpAnimation, LEVEL_UP_DISMISS_MS);
    }

    function handleLevelUpKeydown(event) {
      if (event.key === 'Escape') dismissLevelUpAnimation(event);
    }

    function removeLevelUpAnimation() {
      view.clearTimeout(removalTimer);
      root.removeEventListener('keydown', handleLevelUpKeydown);
      cleanupLevelUpAnchors(root, serial);
      if (overlay.isConnected) overlay.remove();
      if (!root.querySelector('[data-level-up-celebration]')) {
        host.classList.remove('is-level-up-celebrating');
      }
      if (dismissActiveLevelUpAnimation === dismissLevelUpAnimation) {
        dismissActiveLevelUpAnimation = null;
      }
    }

    overlay.addEventListener('pointerdown', dismissLevelUpAnimation);
    overlay.addEventListener('click', dismissLevelUpAnimation);
    root.addEventListener('keydown', handleLevelUpKeydown);
    dismissActiveLevelUpAnimation = dismissLevelUpAnimation;

    return overlay;
  }

  function animateLevelUpAnchors(root, serial, reducedMotion) {
    const anchors = getLevelUpAnchors(root);
    const view = root.defaultView || window;

    anchors.forEach((anchor, index) => {
      const fill = anchor.querySelector('[data-nav-xp-progress-fill], .camp-xp-progress-bar, [data-xp-progress-fill]');
      const progress = getAnchorProgress(anchor, fill);
      anchor.dataset.levelUpSerial = serial;
      anchor.style.setProperty('--level-up-progress', progress);
      anchor.style.setProperty('--level-up-delay', `${Math.min(index * 80, 240)}ms`);
      restartClass(anchor, reducedMotion ? 'is-level-up-soft' : 'is-level-up-anchored');

      if (fill) {
        fill.dataset.levelUpSerial = serial;
        restartClass(fill, 'is-level-up-fill');
      }

      view.setTimeout(() => {
        cleanupLevelUpAnchor(anchor, fill, serial);
      }, reducedMotion ? 900 : LEVEL_UP_ANCHOR_ANIMATION_MS + Math.min(index * 80, 240));
    });
  }

  function cleanupLevelUpAnchors(root, serial) {
    root.querySelectorAll('[data-xp-progress], [data-nav-xp-progress], .camp-xp-progress').forEach((anchor) => {
      const fill = anchor.querySelector('[data-nav-xp-progress-fill], .camp-xp-progress-bar, [data-xp-progress-fill]');
      cleanupLevelUpAnchor(anchor, fill, serial);
    });
  }

  function cleanupLevelUpAnchor(anchor, fill, serial) {
    if (anchor.dataset.levelUpSerial === serial) {
      anchor.classList.remove('is-level-up-anchored', 'is-level-up-soft');
      delete anchor.dataset.levelUpSerial;
      anchor.style.removeProperty('--level-up-delay');
    }
    if (fill?.dataset.levelUpSerial === serial) {
      fill.classList.remove('is-level-up-fill');
      delete fill.dataset.levelUpSerial;
    }
  }

  function getLevelUpAnchors(root) {
    return Array.from(root.querySelectorAll('[data-xp-progress], [data-nav-xp-progress], .camp-xp-progress'))
      .filter((anchor) => anchor instanceof Element && !anchor.classList.contains('d-none'));
  }

  function getAnchorProgress(anchor, fill) {
    const navProgress = anchor.style.getPropertyValue('--nav-xp-progress');
    if (navProgress) return navProgress.trim();
    const levelProgress = anchor.style.getPropertyValue('--level-up-progress');
    if (levelProgress) return levelProgress.trim();
    if (fill?.style?.width) return fill.style.width;
    return '50%';
  }

  function restartClass(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  function renderLevelUpCelebration(levelLabel, detail, reducedMotion) {
    const particles = reducedMotion ? '' : renderLevelUpParticles(LEVEL_UP_PARTICLE_COUNT);

    return `
      <div class="level-up-celebration-vignette" aria-hidden="true"></div>
      <div class="level-up-particles" aria-hidden="true">${particles}</div>
      <div class="level-up-celebration-burst">
        <span class="level-up-ring level-up-ring-outer" aria-hidden="true"></span>
        <span class="level-up-ring level-up-ring-inner" aria-hidden="true"></span>
        <span class="level-up-beams" aria-hidden="true"></span>
        <span class="level-up-eyebrow">Level Up</span>
        <strong>${escapeHtml(levelLabel)}</strong>
        <small>${escapeHtml(detail)}</small>
      </div>
    `;
  }

  function renderLevelUpParticles(count) {
    return Array.from({ length: count }, (_, index) => {
      const angle = Math.round((index / count) * 360 + Math.random() * 18 - 9);
      const distance = Math.round(118 + Math.random() * 238);
      const size = Math.round(3 + Math.random() * 7);
      const duration = Math.round(1250 + Math.random() * 1250);
      const delay = Math.round(Math.random() * 420);
      const tone = index % 5 === 0 ? 'is-orange' : (index % 3 === 0 ? 'is-teal' : 'is-gold');

      return `<span class="${tone}" style="--angle: ${angle}deg; --distance: ${distance}px; --size: ${size}px; --duration: ${duration}ms; --delay: ${delay}ms;"></span>`;
    }).join('');
  }

  function getLevelUpDetail(previousState, nextState) {
    const gained = Math.max(1, (Number(nextState?.level) || 1) - (Number(previousState?.level) || 0));
    return gained > 1
      ? `${formatNumber(gained)} levels gained`
      : 'New power awakened';
  }

  function getSeenLevelUpLevel(data = {}) {
    try {
      return Math.max(0, Math.floor(Number(localStorage.getItem(getLevelUpSeenStorageKey(data))) || 0));
    } catch (error) {
      return 0;
    }
  }

  function rememberSeenLevelUpLevel(data = {}, level = 0) {
    const nextLevel = Math.max(0, Math.floor(Number(level) || 0));
    if (nextLevel <= 0) return;

    try {
      const key = getLevelUpSeenStorageKey(data);
      const previousLevel = Math.max(0, Math.floor(Number(localStorage.getItem(key)) || 0));
      if (nextLevel > previousLevel) localStorage.setItem(key, String(nextLevel));
    } catch (error) {}
  }

  function getLevelUpSeenStorageKey(data = {}) {
    const sessionPlayer = typeof window.AmongDemons?.getSession === 'function'
      ? window.AmongDemons.getSession()?.player
      : null;
    const accountId = data?.id || data?.playerId || data?.username || sessionPlayer?.id || sessionPlayer?.username || 'global';
    return `${LEVEL_UP_SEEN_STORAGE_PREFIX}:${accountId}`;
  }

  function getNavXpProgressState() {
    return navXpState ? { ...navXpState } : null;
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
      'game-icon',
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
        class: 'game-icon',
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
    document.querySelectorAll(GAME_ALERT_SELECTOR).forEach(bindGameAlert);

    if (!document.body || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver((mutations) => {
      const alerts = new Set();

      mutations.forEach((mutation) => {
        if (mutation.target instanceof Element) {
          const alert = mutation.target.matches?.(GAME_ALERT_SELECTOR)
            ? mutation.target
            : mutation.target.closest?.(GAME_ALERT_SELECTOR);
          if (alert) alerts.add(alert);
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(GAME_ALERT_SELECTOR)) alerts.add(node);
          node.querySelectorAll?.(GAME_ALERT_SELECTOR).forEach((alert) => alerts.add(alert));
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

    const delay = alert.classList.contains('alert-danger') ? 11000 : 8000;
    const timer = window.setTimeout(() => dismissGameAlert(alert), delay);
    alertTimers.set(alert, timer);
  }

  function dismissGameAlert(alert) {
    const currentTimer = alertTimers.get(alert);
    if (currentTimer) window.clearTimeout(currentTimer);
    alertTimers.delete(alert);
    alert.classList.add('d-none');
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
  ui.updateNavProgression = updateNavProgression;
  ui.clearNavAccount = clearNavAccount;
  ui.updateNavXpProgress = updateNavXpProgress;
  ui.clearNavXpProgress = clearNavXpProgress;
  ui.triggerLevelUpAnimation = triggerLevelUpAnimation;
  ui.getNavXpProgressState = getNavXpProgressState;
  ui.replaceStaticIcons = replaceStaticIcons;
  ui.dismissGameAlert = dismissGameAlert;
  ui.toDemonImageUrl = toDemonImageUrl;

  // The shared runtime is loaded at the end of <body>, so the static icon
  // placeholders already exist when this module executes. Replace them now
  // instead of waiting behind heavier page scripts for DOMContentLoaded.
  replaceStaticIcons();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGameAlerts, { once: true });
  } else {
    initializeGameAlerts();
  }
})();
