(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const usernames = window.AmongDemons.usernames;
  const audio = window.AmongDemons.audio;
  // Keep in sync with the battle-feel keys in js/dungeon/config.js.
  const BATTLE_SCREEN_SHAKE_KEY = 'amongdemons-battle-screen-shake';
  const BATTLE_CARD_SHAKE_KEY = 'amongdemons-battle-card-shake';
  // Keep in sync with the world ambush preference in world-ui.js.
  const HIDE_WINNING_AMBUSHES_KEY = 'amongdemons-hide-winning-ambushes';
  const elements = {};
  let currentUsername = '';

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      redirectToLogin();
      return;
    }

    audio?.setScene({ music: 'music.default' });
    cacheElements();
    elements.form.addEventListener('submit', saveUsername);
    initBattleToggles();
    initAudioControls();

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

      console.error(error);
      showMessage(error, 'danger');
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
    elements.hideWinningAmbushes = document.getElementById('settingsHideWinningAmbushes');
    elements.audioMuted = document.getElementById('settingsAudioMuted');
    elements.masterVolume = document.getElementById('settingsMasterVolume');
    elements.masterVolumeValue = document.getElementById('settingsMasterVolumeValue');
    elements.musicVolume = document.getElementById('settingsMusicVolume');
    elements.musicVolumeValue = document.getElementById('settingsMusicVolumeValue');
    elements.sfxVolume = document.getElementById('settingsSfxVolume');
    elements.sfxVolumeValue = document.getElementById('settingsSfxVolumeValue');
  }

  function initBattleToggles() {
    bindPreferenceToggle(elements.screenShake, BATTLE_SCREEN_SHAKE_KEY);
    bindPreferenceToggle(elements.cardShake, BATTLE_CARD_SHAKE_KEY);
    bindPreferenceToggle(elements.hideWinningAmbushes, HIDE_WINNING_AMBUSHES_KEY, false);
  }

  function initAudioControls() {
    if (!audio) return;

    const current = audio.getVolumes();
    elements.audioMuted.checked = audio.isMuted();
    elements.audioMuted.addEventListener('change', () => audio.setMuted(elements.audioMuted.checked));
    bindVolumeControl(elements.masterVolume, elements.masterVolumeValue, 'master', current.master);
    bindVolumeControl(elements.musicVolume, elements.musicVolumeValue, 'music', current.music);
    bindVolumeControl(elements.sfxVolume, elements.sfxVolumeValue, 'sfx', current.sfx);
  }

  function bindVolumeControl(input, output, name, initialValue) {
    if (!input || !output) return;

    const initialPercent = Math.round((Number(initialValue) || 0) * 100);
    input.value = String(initialPercent);
    output.value = `${initialPercent}%`;
    output.textContent = `${initialPercent}%`;

    input.addEventListener('input', () => {
      const percent = Math.max(0, Math.min(100, Number(input.value) || 0));
      output.value = `${percent}%`;
      output.textContent = `${percent}%`;
      audio.setVolumes({ [name]: percent / 100 });
    });
  }

  function bindPreferenceToggle(toggle, key, defaultEnabled = true) {
    if (!toggle) return;

    toggle.checked = isPreferenceEnabled(key, defaultEnabled);
    toggle.addEventListener('change', () => setPreferenceEnabled(key, toggle.checked));
  }

  function isPreferenceEnabled(key, defaultEnabled = true) {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? defaultEnabled : stored !== '0';
    } catch (error) {
      return defaultEnabled;
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

    const username = usernames?.normalize
      ? usernames.normalize(elements.username.value)
      : elements.username.value.trim();
    elements.username.value = username;

    const usernameError = usernames?.getValidationMessage?.(username) || '';
    if (usernameError) {
      elements.username.setCustomValidity(usernameError);
      elements.username.reportValidity();
      showMessage(usernameError, 'warning');
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

      console.error(error);
      showMessage(error, 'danger');
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
    window.AmongDemons.setGameAlert(elements.message, message, {
      type,
      inline: true,
      className: 'settings-message'
    });
    elements.message.classList.toggle('d-none', !message);
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
