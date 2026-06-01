(function() {
  'use strict';

  const TYPES_API = '/api/game/demon-types';
  const ME_API = '/api/auth/me';
  const dropdownElement = document.getElementById('demonTypesDropdown');

  onReady(init);

  async function init() {
    initAccountNav();

    if (!dropdownElement) return;

    try {
      const types = await fetchJson(TYPES_API);
      dropdownElement.innerHTML = renderTypeLinks(types);
    } catch (error) {
      console.error('Error loading demon types for navigation:', error);
      dropdownElement.innerHTML = renderTypeLinks(getFallbackTypes());
    }
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

      window.location.href = '/login';
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

  async function fetchJson(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Request failed: ${url}`);
    }

    return response.json();
  }

  function renderTypeLinks(types) {
    return Object.keys(types)
      .map(Number)
      .sort((a, b) => a - b)
      .map((typeNumber) => `<li><a class="dropdown-item" href="/demons/type/${typeNumber}">${types[typeNumber].name}</a></li>`)
      .join('');
  }

  function getFallbackTypes() {
    return {
      1: { name: 'Boof Nitza' },
      2: { name: "Gon G'ah" },
      3: { name: "Ma'Zga" },
      4: { name: 'Tor Tza' },
      5: { name: "Vi'Zel" }
    };
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
