(function() {
  'use strict';

  const ME_API = '/api/auth/me';

  onReady(init);

  function init() {
    initAccountNav();
  }

  function initAccountNav() {
    const accountElement = document.querySelector('[data-nav-account]');
    const authElement = document.querySelector('[data-nav-auth-actions]');

    if (!accountElement && !authElement) return;

    bindLogout();

    const auth = window.AmongDemons || {};
    const session = typeof auth.getSession === 'function' ? auth.getSession() : getStoredSession();
    const token = typeof auth.getToken === 'function' ? auth.getToken() : session.token;

    if (!token) {
      clearAccountNav();
      return;
    }

    if (session.player) {
      updateAccountNav(session.player);
    }

    if (typeof auth.api === 'function') {
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

      window.location.href = '/';
    });
  }

  async function refreshAccount(auth, session) {
    try {
      const payload = await auth.api(ME_API);
      const player = payload && payload.player ? payload.player : null;
      if (!player) return;

      if (typeof auth.setSession === 'function') {
        auth.setSession({
          ...session,
          token: typeof auth.getToken === 'function' ? auth.getToken() : session.token,
          player
        });
      }

      updateAccountNav(player);
    } catch (error) {
      if (error.status === 401) {
        if (typeof auth.clearSession === 'function') auth.clearSession();
        clearAccountNav();
      }
    }
  }

  function updateAccountNav(player, options = {}) {
    const updater = window.AmongDemons?.ui?.updateNavAccount;
    if (typeof updater === 'function') {
      updater(player, options);
    }
  }

  function clearAccountNav() {
    const clearer = window.AmongDemons?.ui?.clearNavAccount;
    if (typeof clearer === 'function') {
      clearer();
      return;
    }

    document.querySelector('[data-nav-account]')?.classList.add('d-none');
    document.querySelector('[data-nav-auth-actions]')?.classList.remove('d-none');
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
