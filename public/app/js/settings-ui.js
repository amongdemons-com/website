(function() {
  'use strict';

  const api = window.AmongDemons.api;
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
