(function() {
  'use strict';

  const ME_API = '/api/auth/me';
  const PROGRESSION_API = '/api/account/progression';
  const AUTH_VALIDATION_KEY = 'amongdemons-nav-auth-validation-v1';
  const AUTH_VALIDATION_TTL_MS = 30000;
  const PAGE_ACCOUNT_APIS = [
    ['/camp', '/api/camp/bootstrap'],
    ['/collection', '/api/collection/bootstrap'],
    ['/world', '/api/world/state'],
    ['/dungeon', '/api/runs/bootstrap'],
    ['/ranked', '/api/ranked/bootstrap'],
    ['/bag', '/api/bag'],
    ['/skill-tree', '/api/account/stat-points']
  ];
  const GLOBAL_PAGE_SHORTCUTS = new Map([
    ['m', '/world'],
    ['c', '/camp'],
    ['t', '/skill-tree'],
    ['i', '/bag'],
    ['b', '/bag'],
    ['r', '/ranked']
  ]);
  const DEFAULT_MUSIC_ROUTE = /^\/(?:demons|bosses|events|ranked|leaderboard|hunter)(?:\/|$)/;

  onReady(init);

  function init() {
    initDefaultMusic();
    hideRankedNavigation();
    markCurrentGameNav();
    bindDisabledLinks();
    bindGlobalPageShortcuts();
    bindPlayInstantly();
    initAccountNav();
  }

  function hideRankedNavigation() {
    document.querySelectorAll('[data-game-route="ranked"]').forEach((link) => {
      const item = link.closest('.nav-item');
      if (item) item.remove();
      else link.remove();
    });
  }

  function initDefaultMusic() {
    if (!DEFAULT_MUSIC_ROUTE.test(window.location.pathname)) return;
    window.AmongDemons?.audio?.setScene({ music: 'music.default' });
  }

  function bindGlobalPageShortcuts() {
    document.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isEditableShortcutTarget(event.target)) return;

      const path = GLOBAL_PAGE_SHORTCUTS.get(String(event.key || '').toLowerCase());
      if (!path) return;

      event.preventDefault();
      const destination = typeof window.AmongDemons?.appUrl === 'function'
        ? window.AmongDemons.appUrl(path)
        : path;
      const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
      const destinationPath = new URL(destination, window.location.href).pathname.replace(/\/+$/, '') || '/';
      if (currentPath === destinationPath) return;
      window.location.href = destination;
    });
  }

  function isEditableShortcutTarget(target) {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
    );
  }

  // "Play Instantly" opens a guest hunter (or reuses an existing session) and
  // sends the visitor straight into the game - no email, username, or password.
  // Capture phase prevents the anchor from navigating before the guest exists.
  function bindPlayInstantly() {
    document.addEventListener('click', async (event) => {
      const trigger = event.target.closest('[data-play-instantly]');
      if (!trigger) return;

      event.preventDefault();
      event.stopPropagation();
      const auth = window.AmongDemons || {};
      if (typeof auth.playAsGuest !== 'function') {
        window.location.href = trigger.getAttribute('href') || '/camp';
        return;
      }

      if (trigger.dataset.playInstantlyBusy === 'true') return;
      trigger.dataset.playInstantlyBusy = 'true';
      trigger.classList.add('is-loading');
      trigger.setAttribute('aria-busy', 'true');

      const destination = trigger.dataset.playDestination
        || trigger.getAttribute('href')
        || '/camp';

      try {
        await auth.playAsGuest();
        window.location.href = destination;
      } catch (error) {
        console.error(error);
        trigger.dataset.playInstantlyBusy = 'false';
        trigger.classList.remove('is-loading');
        trigger.removeAttribute('aria-busy');
        if (typeof auth.showGameAlert === 'function') {
          auth.showGameAlert(error, { context: 'guest' });
        }
      }
    }, true);
  }

  function markCurrentGameNav() {
    const pathname = window.location.pathname.replace(/\/$/, '') || '/';
    const section = pathname === '/camp'
      ? 'camp'
      : pathname.startsWith('/world')
        ? 'world'
        : pathname.startsWith('/dungeon')
          ? 'dungeon'
          : pathname.startsWith('/ranked')
            ? 'ranked'
          : pathname.startsWith('/demons')
            ? 'demons'
            : pathname.startsWith('/bosses')
              ? 'bosses'
              : pathname.startsWith('/events')
              ? 'events'
              : pathname.startsWith('/collection')
              ? 'collection'
              : pathname.startsWith('/bag')
                ? 'bag'
                : pathname.startsWith('/leaderboard')
                  ? 'leaderboard'
                  : '';

    document.querySelectorAll('[data-game-route], [data-game-sections]').forEach((link) => {
      const sections = String(link.dataset.gameSections || link.dataset.gameRoute || '')
        .split(/\s+/)
        .filter(Boolean);
      const isActive = Boolean(section && sections.includes(section));
      link.classList.toggle('active', isActive);
      if (isActive && link.dataset.gameRoute) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function bindDisabledLinks() {
    document.querySelectorAll('[data-disabled-link]').forEach((link) => {
      if (link.dataset.disabledLinkBound === 'true') return;
      link.dataset.disabledLinkBound = 'true';
      link.addEventListener('click', (event) => event.preventDefault());
    });
  }

  function initAccountNav() {
    const accountElement = document.querySelector('[data-nav-account]');
    const authElement = document.querySelector('[data-nav-auth-actions]');
    const auth = window.AmongDemons || {};
    const session = typeof auth.getSession === 'function' ? auth.getSession() : getStoredSession();
    const token = typeof auth.getToken === 'function' ? auth.getToken() : session.token;

    updateBrandDestination(Boolean(token));

    if (!accountElement && !authElement) return;

    bindLogout();

    if (!token) {
      clearAccountNav();
      return;
    }

    if (session.player) {
      updateAccountNav(session.player, { animate: false });
    }

    if (typeof auth.api === 'function') {
      registerXpProgressRefresh(auth);
      refreshAccount(auth, session);
    }
  }

  function bindLogout() {
    const logoutButton = document.getElementById('logoutBtn');
    if (!logoutButton || logoutButton.dataset.navLogoutBound === 'true') return;

    logoutButton.dataset.navLogoutBound = 'true';
    logoutButton.addEventListener('click', () => {
      if (window.AmongDemons && typeof window.AmongDemons.clearSession === 'function') {
        window.AmongDemons.clearSession();
      } else {
        localStorage.removeItem('amongdemons-session');
      }

      window.location.href = window.AmongDemons?.appUrl ? window.AmongDemons.appUrl('/') : '/';
    });
  }

  async function refreshAccount(auth, session) {
    const endpoint = getPageAccountApi();
    const token = typeof auth.getToken === 'function' ? auth.getToken() : session.token;
    if (endpoint === ME_API && hasFreshAuthValidation(token)) return;

    try {
      const payload = await auth.api(endpoint);
      const account = payload?.account || payload || {};
      const player = account.player || payload?.player || null;
      const progression = account.progression || payload?.progression || null;
      if (!player) return;
      if (endpoint === ME_API) rememberAuthValidation(token);

      if (typeof auth.setSession === 'function') {
        auth.setSession({
          ...session,
          token: typeof auth.getToken === 'function' ? auth.getToken() : session.token,
          player
        });
      }

      updateAccountNav({ ...player, ...(progression || {}) }, { animate: false });
      if (progression) {
        window.AmongDemons?.ui?.updateNavXpProgress?.(progression, { animate: false });
      }
    } catch (error) {
      if (error.status === 401) {
        if (typeof auth.clearSession === 'function') auth.clearSession();
        clearAccountNav();
      }
    }
  }

  function hasFreshAuthValidation(token) {
    if (!token) return false;
    try {
      const stored = JSON.parse(sessionStorage.getItem(AUTH_VALIDATION_KEY) || 'null');
      return stored?.token === token
        && Date.now() - Number(stored.validatedAt) < AUTH_VALIDATION_TTL_MS;
    } catch (error) {
      return false;
    }
  }

  function rememberAuthValidation(token) {
    if (!token) return;
    try {
      sessionStorage.setItem(AUTH_VALIDATION_KEY, JSON.stringify({
        token,
        validatedAt: Date.now()
      }));
    } catch (error) {
      /* Navigation still works when session storage is unavailable. */
    }
  }

  function getPageAccountApi() {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const match = PAGE_ACCOUNT_APIS.find(([route]) => pathname === route || pathname.startsWith(`${route}/`));
    return match?.[1] || ME_API;
  }

  function registerXpProgressRefresh(auth) {
    const ui = window.AmongDemons?.ui;
    if (!ui || typeof auth.api !== 'function') return;

    ui.refreshNavXpProgress = () => refreshProgress(auth);
  }

  async function refreshProgress(auth) {
    const updater = window.AmongDemons?.ui?.updateNavXpProgress;
    if (typeof auth.api !== 'function' || typeof updater !== 'function') return null;

    try {
      const progression = await auth.api(PROGRESSION_API);
      return updater(progression, { animate: false });
    } catch (error) {
      if (error.status === 401) {
        if (typeof auth.clearSession === 'function') auth.clearSession();
        clearAccountNav();
      }
      return null;
    }
  }

  function updateAccountNav(player, options = {}) {
    const updater = window.AmongDemons?.ui?.updateNavAccount;
    if (typeof updater === 'function') {
      updater(player, options);
    }
  }

  function clearAccountNav() {
    updateBrandDestination(false);

    const clearer = window.AmongDemons?.ui?.clearNavAccount;
    if (typeof clearer === 'function') {
      clearer();
      return;
    }

    document.querySelector('[data-nav-account]')?.classList.add('d-none');
    document.querySelector('[data-nav-auth-actions]')?.classList.remove('d-none');
  }

  function updateBrandDestination(hasSession) {
    const brandLink = document.querySelector('.game-shell-brand');
    if (!brandLink) return;

    const destination = hasSession ? '/camp' : '/';
    brandLink.href = typeof window.AmongDemons?.appUrl === 'function'
      ? window.AmongDemons.appUrl(destination)
      : destination;
    brandLink.setAttribute('aria-label', hasSession ? 'Among Demons camp' : 'Among Demons home');
  }

  function getStoredSession() {
    try {
      return JSON.parse(localStorage.getItem('amongdemons-session') || '{}');
    } catch (error) {
      return {};
    }
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
