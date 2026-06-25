(function() {
  'use strict';

  const api = window.AmongDemons.api;
  // Keep in sync with the battle-feel keys in js/dungeon/config.js.
  const BATTLE_SCREEN_SHAKE_KEY = 'amongdemons-battle-screen-shake';
  const BATTLE_CARD_SHAKE_KEY = 'amongdemons-battle-card-shake';
  const elements = {};
  let currentUsername = '';

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      redirectToLogin();
      return;
    }

    cacheElements();
    elements.form.addEventListener('submit', saveUsername);
    initBattleToggles();

    try {
      const payload = await api('/api/auth/me');
      syncPlayer(payload.player);
      setFormEnabled(true);
    } catch (error) {
      if (error.status === 401) {
        window.AmongDemons.clearSession();
        redirectToLogin();
        return;
      }

      showMessage(error.message || 'Unable to load settings.', 'danger');
    }
  }

  function cacheElements() {
    elements.form = document.getElementById('usernameForm');
    elements.username = document.getElementById('settingsUsername');
    elements.message = document.getElementById('settingsMessage');
    elements.submit = document.getElementById('saveUsernameButton');
    elements.submitLabel = document.getElementById('saveUsernameLabel');
    elements.screenShake = document.getElementById('settingsScreenShake');
    elements.cardShake = document.getElementById('settingsCardShake');
  }

  function initBattleToggles() {
    bindPreferenceToggle(elements.screenShake, BATTLE_SCREEN_SHAKE_KEY);
    bindPreferenceToggle(elements.cardShake, BATTLE_CARD_SHAKE_KEY);
  }

  function bindPreferenceToggle(toggle, key) {
    if (!toggle) return;

    toggle.checked = isPreferenceEnabled(key);
    toggle.addEventListener('change', () => setPreferenceEnabled(key, toggle.checked));
  }

  function isPreferenceEnabled(key) {
    try {
      return localStorage.getItem(key) !== '0';
    } catch (error) {
      return true;
    }
  }

  function setPreferenceEnabled(key, enabled) {
    try {
      localStorage.setItem(key, enabled ? '1' : '0');
    } catch (error) {
      /* localStorage unavailable; preference simply won't persist. */
    }
  }

  async function saveUsername(event) {
    event.preventDefault();

    const username = elements.username.value.trim();
    elements.username.value = username;

    if (username.length < 3 || username.length > 64) {
      elements.username.setCustomValidity('Username must be between 3 and 64 characters.');
      elements.username.reportValidity();
      return;
    }

    elements.username.setCustomValidity('');

    if (username === currentUsername) {
      showMessage('Your username is already up to date.', 'secondary');
      return;
    }

    setBusy(true);

    try {
      const payload = await api('/api/account/profile', {
        method: 'PATCH',
        body: { username }
      });
      syncPlayer(payload.player);
      showMessage('Username updated.', 'success');
    } catch (error) {
      if (error.status === 401) {
        window.AmongDemons.clearSession();
        redirectToLogin();
        return;
      }

      showMessage(error.message || 'Unable to update username.', 'danger');
    } finally {
      setBusy(false);
    }
  }

  function syncPlayer(player) {
    if (!player) return;

    currentUsername = player.username || '';
    elements.username.value = currentUsername;

    const session = window.AmongDemons.getSession();
    window.AmongDemons.setSession({ ...session, player });
    window.AmongDemons.ui?.updateNavAccount?.(player);
  }

  function setFormEnabled(enabled) {
    elements.username.disabled = !enabled;
    elements.submit.disabled = !enabled;
  }

  function setBusy(busy) {
    elements.username.disabled = busy;
    elements.submit.disabled = busy;
    elements.form.setAttribute('aria-busy', String(busy));
    elements.submitLabel.textContent = busy ? 'Saving...' : 'Save';
  }

  function showMessage(message, type) {
    const tone = type === 'success'
      ? 'is-success'
      : type === 'danger'
        ? 'is-error'
        : 'is-neutral';

    elements.message.textContent = message;
    elements.message.className = `settings-message ${tone}`;
  }

  function redirectToLogin() {
    window.location.href = window.AmongDemons.appUrl('/login');
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }
})();
