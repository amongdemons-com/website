(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const apiUrl = window.AmongDemons.apiUrl || ((value) => value);
  const usernames = window.AmongDemons.usernames;
  const audio = window.AmongDemons.audio;
  // Keep in sync with the battle-feel keys in js/dungeon/config.js.
  const BATTLE_SCREEN_SHAKE_KEY = 'amongdemons-battle-screen-shake';
  const BATTLE_CARD_SHAKE_KEY = 'amongdemons-battle-card-shake';
  // Keep in sync with the world ambush preference in world-ui.js.
  const HIDE_WINNING_AMBUSHES_KEY = 'amongdemons-hide-winning-ambushes';
  // This explicit preference takes precedence over the dialog's separate 24-hour mute.
  const WORLD_BOSS_NARRATION_KEY = 'amongdemons-world-boss-narration';
  const WORLD_BOSS_INTRO_MUTE_KEY = 'amongdemons-world-boss-mute';
  const DESKTOP_OAUTH_PENDING_KEY = 'amongdemons-desktop-oauth-pending-v1';
  const DESKTOP_OAUTH_POLL_INTERVAL_MS = 2000;
  const DESKTOP_OAUTH_TIMEOUT_MS = 15 * 60 * 1000;
  const elements = {};
  const providerElements = new Map();
  let currentUsername = '';
  let currentMergeToken = '';
  let currentMergeProvider = '';
  let desktopOAuthPollTimer = null;
  let desktopOAuthPollBusy = false;
  let desktopOAuthPending = null;
  let isGuestAccount = false;
  let securityState = {
    hasPassword: true,
    providers: [],
    deletionScheduledFor: null
  };

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      redirectToLogin();
      return;
    }

    audio?.setScene({ music: 'music.default' });
    cacheElements();
    bindEvents();
    initBattleToggles();
    initWorldToggles();
    initAudioControls();

    try {
      const payload = await api('/api/auth/me');
      syncPlayer(payload.player);
      setUsernameFormEnabled(true);
      isGuestAccount = Boolean(payload.player?.isGuest);

      if (isGuestAccount) {
        await loadGuestProviders();
        showMessage(
          elements.providerMessage,
          'Connect Google or Discord to save this hunter and keep all progress.',
          'info'
        );
      } else {
        await loadSecurity();
      }

      await showOAuthResult();
      resumeDesktopOAuthPolling();
    } catch (error) {
      handleAuthError(error, elements.usernameMessage);
    }
  }

  function cacheElements() {
    elements.usernameForm = document.getElementById('usernameForm');
    elements.username = document.getElementById('settingsUsername');
    elements.usernameMessage = document.getElementById('settingsMessage');
    elements.usernameSubmit = document.getElementById('saveUsernameButton');
    elements.usernameSubmitLabel = document.getElementById('saveUsernameLabel');

    elements.screenShake = document.getElementById('settingsScreenShake');
    elements.cardShake = document.getElementById('settingsCardShake');
    elements.hideWinningAmbushes = document.getElementById('settingsHideWinningAmbushes');
    elements.bossNarration = document.getElementById('settingsBossNarration');
    elements.audioMuted = document.getElementById('settingsAudioMuted');
    elements.masterVolume = document.getElementById('settingsMasterVolume');
    elements.masterVolumeValue = document.getElementById('settingsMasterVolumeValue');
    elements.musicVolume = document.getElementById('settingsMusicVolume');
    elements.musicVolumeValue = document.getElementById('settingsMusicVolumeValue');
    elements.sfxVolume = document.getElementById('settingsSfxVolume');
    elements.sfxVolumeValue = document.getElementById('settingsSfxVolumeValue');

    elements.providerMessage = document.getElementById('providerMessage');
    elements.mergeModal = document.getElementById('accountMergeModal');
    elements.mergeAccounts = document.getElementById('accountMergeAccounts');
    elements.mergeError = document.getElementById('accountMergeError');
    elements.mergeSubmit = document.getElementById('accountMergeSubmit');
    elements.mergeCancel = document.getElementById('accountMergeCancel');
    document.querySelectorAll('[data-provider-action]').forEach((button) => {
      const provider = button.dataset.providerAction;
      providerElements.set(provider, {
        button,
        row: document.querySelector(`[data-provider-row="${provider}"]`),
        status: document.querySelector(`[data-provider-status="${provider}"]`)
      });
    });

    elements.passwordForm = document.getElementById('passwordForm');
    elements.currentPasswordField = document.getElementById('currentPasswordField');
    elements.currentPassword = document.getElementById('settingsCurrentPassword');
    elements.newPassword = document.getElementById('settingsNewPassword');
    elements.confirmPassword = document.getElementById('settingsConfirmPassword');
    elements.passwordDescription = document.getElementById('passwordSettingsDescription');
    elements.passwordSubmit = document.getElementById('savePasswordButton');
    elements.passwordSubmitLabel = document.getElementById('savePasswordLabel');
    elements.passwordMessage = document.getElementById('passwordMessage');

    elements.deletionForm = document.getElementById('deleteAccountForm');
    elements.deletionConfirmation = document.getElementById('deleteAccountConfirmation');
    elements.deletionPasswordField = document.getElementById('deletePasswordField');
    elements.deletionPassword = document.getElementById('deleteAccountPassword');
    elements.deletionSubmit = document.getElementById('scheduleDeletionButton');
    elements.deletionSubmitLabel = document.getElementById('scheduleDeletionLabel');
    elements.deletionMessage = document.getElementById('deletionMessage');
    elements.deletionPendingPanel = document.getElementById('deletionPendingPanel');
    elements.deletionPendingText = document.getElementById('deletionPendingText');
    elements.cancelDeletion = document.getElementById('cancelDeletionButton');
  }

  function bindEvents() {
    elements.usernameForm.addEventListener('submit', saveUsername);
    elements.username.addEventListener('input', handleUsernameInput);
    elements.passwordForm.addEventListener('submit', changePassword);
    elements.currentPassword.addEventListener('input', handlePasswordInput);
    elements.newPassword.addEventListener('input', handlePasswordInput);
    elements.confirmPassword.addEventListener('input', handlePasswordInput);
    elements.deletionForm.addEventListener('submit', scheduleDeletion);
    elements.cancelDeletion.addEventListener('click', cancelDeletion);
    elements.mergeSubmit.addEventListener('click', confirmAccountMerge);
    elements.mergeCancel.addEventListener('click', cancelAccountMerge);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !elements.mergeModal.classList.contains('d-none')) {
        cancelAccountMerge();
      }
    });
    window.addEventListener('focus', checkDesktopOAuthCompletion);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) checkDesktopOAuthCompletion();
    });

    providerElements.forEach(({ button }, provider) => {
      button.addEventListener('click', () => handleProviderAction(provider));
    });
  }

  async function loadSecurity() {
    const payload = await api('/api/account/security');
    applySecurityState(payload);
  }

  async function loadGuestProviders() {
    const payload = await api('/api/auth/oauth/providers');
    securityState.providers = (payload.providers || []).map((provider) => ({
      ...provider,
      connected: false
    }));
    syncProviderRows();
  }

  function applySecurityState(payload = {}) {
    securityState = {
      ...securityState,
      ...payload,
      providers: Array.isArray(payload.providers) ? payload.providers : securityState.providers
    };

    syncPasswordMode();
    syncProviderRows();
    syncDeletionState();
  }

  function syncProviderRows() {
    const providersById = new Map(securityState.providers.map((provider) => [provider.id, provider]));

    providerElements.forEach(({ button, row, status }, providerId) => {
      const provider = providersById.get(providerId);
      const connected = Boolean(provider?.connected);
      const enabled = Boolean(provider?.enabled);
      row.classList.toggle('is-connected', connected);
      button.dataset.connected = String(connected);
      button.disabled = !connected && !enabled;
      button.textContent = connected ? 'Disconnect' : enabled ? 'Connect' : 'Unavailable';
      button.classList.toggle('btn-outline-danger', connected);
      button.classList.toggle('btn-outline-light', !connected);

      if (connected) {
        status.textContent = provider.displayName || provider.email || 'Connected';
      } else {
        status.textContent = enabled ? 'Not connected' : 'Provider unavailable';
      }
    });
  }

  function syncPasswordMode() {
    const hasPassword = Boolean(securityState.hasPassword);
    elements.currentPasswordField.classList.toggle('d-none', !hasPassword);
    elements.currentPassword.required = hasPassword;
    elements.currentPassword.disabled = !hasPassword;
    elements.newPassword.disabled = false;
    elements.confirmPassword.disabled = false;
    elements.passwordSubmitLabel.textContent = hasPassword ? 'Change password' : 'Set password';
    elements.passwordDescription.textContent = hasPassword
      ? 'Change the password used for username sign-in.'
      : 'Add a password so you can also sign in with your username.';
    updatePasswordSubmitState();

    elements.deletionPasswordField.classList.toggle('d-none', !hasPassword);
    elements.deletionPassword.required = hasPassword;
    elements.deletionPassword.disabled = false;
    elements.deletionConfirmation.disabled = false;
    elements.deletionSubmit.disabled = false;
  }

  function syncDeletionState() {
    const scheduledFor = securityState.deletionScheduledFor;
    const pending = Boolean(scheduledFor);
    elements.deletionPendingPanel.classList.toggle('d-none', !pending);
    elements.deletionForm.classList.toggle('d-none', pending);

    if (pending) {
      elements.deletionPendingText.textContent =
        `Your hunter and all progress will be permanently deleted on ${formatDate(scheduledFor)}.`;
    } else {
      elements.deletionPendingText.textContent = '';
    }
  }

  async function handleProviderAction(provider) {
    const controls = providerElements.get(provider);
    if (!controls || controls.button.disabled) return;

    const connected = controls.button.dataset.connected === 'true';
    controls.button.disabled = true;
    controls.button.textContent = connected ? 'Disconnecting…' : 'Connecting…';
    hideMessage(elements.providerMessage);

    try {
      if (connected) {
        const label = provider === 'google' ? 'Google' : 'Discord';
        if (!window.confirm(`Disconnect ${label} from this hunter?`)) {
          syncProviderRows();
          return;
        }

        await api(`/api/account/oauth/${encodeURIComponent(provider)}`, {
          method: 'DELETE'
        });
        await loadSecurity();
        showMessage(elements.providerMessage, `${label} disconnected.`, 'success');
        return;
      }

      if (isGuestAccount) {
        const claimToken = window.AmongDemons.getToken?.() || '';
        const params = new URLSearchParams({
          mode: 'register',
          claimToken,
          returnTo: '/settings?oauth=connected'
        });
        window.location.href = apiUrl(`/api/auth/oauth/${encodeURIComponent(provider)}?${params}`);
        return;
      }

      const payload = await api(`/api/account/oauth/${encodeURIComponent(provider)}/connect`, {
        method: 'POST',
        body: {}
      });
      if (!payload?.authorizationUrl) {
        throw new Error('The server did not return a provider authorization URL.');
      }

      if (document.documentElement.dataset.desktopWrapper === '1') {
        const label = providerLabel(provider);
        controls.status.textContent = 'Continue in your browser';
        showMessage(
          elements.providerMessage,
          `${label} sign-in opened in your browser. Complete it there, then return to the game.`,
          'info'
        );
        beginDesktopOAuthPolling(provider);
        window.location.href = payload.authorizationUrl;
        return;
      }
      window.location.href = payload.authorizationUrl;
    } catch (error) {
      console.error(error);
      const label = provider === 'google' ? 'Google' : 'Discord';
      showMessage(elements.providerMessage, {
        type: 'error',
        title: `${label} could not be connected.`,
        message: error?.message || 'The connection could not be started.',
        action: 'Refresh Settings and try again.'
      }, 'danger');
      syncProviderRows();
    }
  }

  function beginDesktopOAuthPolling(provider) {
    const pending = {
      provider: String(provider || '').toLowerCase(),
      startedAt: Date.now()
    };
    desktopOAuthPending = pending;
    try {
      sessionStorage.setItem(DESKTOP_OAUTH_PENDING_KEY, JSON.stringify(pending));
    } catch (error) {
      // Polling still works for this page even if storage is unavailable.
    }
    scheduleDesktopOAuthPoll(DESKTOP_OAUTH_POLL_INTERVAL_MS);
  }

  function resumeDesktopOAuthPolling() {
    if (document.documentElement.dataset.desktopWrapper !== '1') return;
    const pending = getPendingDesktopOAuth();
    if (!pending) return;

    const controls = providerElements.get(pending.provider);
    if (controls) controls.status.textContent = 'Continue in your browser';
    showMessage(
      elements.providerMessage,
      `${providerLabel(pending.provider)} sign-in is waiting in your browser. Complete it there; this app will update automatically.`,
      'info'
    );
    scheduleDesktopOAuthPoll(0);
  }

  function scheduleDesktopOAuthPoll(delay = DESKTOP_OAUTH_POLL_INTERVAL_MS) {
    if (desktopOAuthPollTimer) window.clearTimeout(desktopOAuthPollTimer);
    desktopOAuthPollTimer = window.setTimeout(checkDesktopOAuthCompletion, Math.max(0, delay));
  }

  async function checkDesktopOAuthCompletion() {
    if (document.documentElement.dataset.desktopWrapper !== '1' || desktopOAuthPollBusy) return;
    const pending = getPendingDesktopOAuth();
    if (!pending) return;

    if (Date.now() - pending.startedAt >= DESKTOP_OAUTH_TIMEOUT_MS) {
      clearPendingDesktopOAuth();
      await loadSecurity().catch(() => {});
      showMessage(
        elements.providerMessage,
        `${providerLabel(pending.provider)} sign-in expired. Start the connection again when you are ready.`,
        'warning'
      );
      return;
    }

    desktopOAuthPollBusy = true;
    try {
      const security = await api('/api/account/security', { dedupe: false });
      applySecurityState(security);
      const connected = (security.providers || []).some(
        (provider) => provider.id === pending.provider && provider.connected
      );
      if (!connected) {
        const controls = providerElements.get(pending.provider);
        if (controls) controls.status.textContent = 'Continue in your browser';
        return;
      }

      const payload = await api('/api/auth/me', { dedupe: false });
      syncPlayer(payload.player);
      clearPendingDesktopOAuth();
      showMessage(
        elements.providerMessage,
        `${providerLabel(pending.provider)} is connected. Your Steam hunter is up to date.`,
        'success'
      );
    } catch (error) {
      // A closed browser or a temporary request failure is not terminal. The
      // player can resume the provider flow until its short-lived intent ends.
    } finally {
      desktopOAuthPollBusy = false;
      if (getPendingDesktopOAuth()) scheduleDesktopOAuthPoll();
    }
  }

  function getPendingDesktopOAuth() {
    try {
      const pending = desktopOAuthPending
        || JSON.parse(sessionStorage.getItem(DESKTOP_OAUTH_PENDING_KEY) || 'null');
      const provider = String(pending?.provider || '').toLowerCase();
      const startedAt = Number(pending?.startedAt);
      if (!providerElements.has(provider) || !Number.isFinite(startedAt) || startedAt <= 0) {
        clearPendingDesktopOAuth();
        return null;
      }
      desktopOAuthPending = { provider, startedAt };
      return desktopOAuthPending;
    } catch (error) {
      clearPendingDesktopOAuth();
      return null;
    }
  }

  function clearPendingDesktopOAuth() {
    if (desktopOAuthPollTimer) window.clearTimeout(desktopOAuthPollTimer);
    desktopOAuthPollTimer = null;
    desktopOAuthPending = null;
    try {
      sessionStorage.removeItem(DESKTOP_OAUTH_PENDING_KEY);
    } catch (error) {
      // Nothing else is required when browser storage is unavailable.
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    hideMessage(elements.passwordMessage);

    const currentPassword = elements.currentPassword.value;
    const newPassword = elements.newPassword.value;
    const confirmation = elements.confirmPassword.value;

    if (newPassword.length < 6) {
      showMessage(elements.passwordMessage, 'Password must be at least 6 characters.', 'warning');
      elements.newPassword.reportValidity();
      return;
    }
    if (newPassword !== confirmation) {
      elements.confirmPassword.setCustomValidity('Passwords do not match.');
      elements.confirmPassword.reportValidity();
      showMessage(elements.passwordMessage, 'New passwords do not match.', 'warning');
      return;
    }

    elements.confirmPassword.setCustomValidity('');
    setPasswordBusy(true);

    try {
      await api('/api/account/password', {
        method: 'PUT',
        body: {
          currentPassword,
          newPassword
        }
      });
      elements.passwordForm.reset();
      securityState.hasPassword = true;
      syncPasswordMode();
      showMessage(elements.passwordMessage, 'Password changed. Other sessions were signed out.', 'success');
    } catch (error) {
      handleAuthError(error, elements.passwordMessage);
    } finally {
      setPasswordBusy(false);
    }
  }

  function handlePasswordInput() {
    elements.confirmPassword.setCustomValidity('');
    hideMessage(elements.passwordMessage);
    updatePasswordSubmitState();
  }

  function updatePasswordSubmitState() {
    const busy = elements.passwordForm.getAttribute('aria-busy') === 'true';
    const currentPasswordReady = !securityState.hasPassword || elements.currentPassword.value.length > 0;
    const newPasswordReady = elements.newPassword.value.length > 0;
    const confirmationReady = elements.confirmPassword.value.length > 0;
    elements.passwordSubmit.disabled =
      busy || !currentPasswordReady || !newPasswordReady || !confirmationReady;
  }

  function setPasswordBusy(busy) {
    elements.passwordForm.setAttribute('aria-busy', String(busy));
    elements.currentPassword.disabled = busy || !securityState.hasPassword;
    elements.newPassword.disabled = busy;
    elements.confirmPassword.disabled = busy;
    elements.passwordSubmitLabel.textContent = busy
      ? 'Saving…'
      : securityState.hasPassword
        ? 'Change password'
        : 'Set password';
    updatePasswordSubmitState();
  }

  async function scheduleDeletion(event) {
    event.preventDefault();
    hideMessage(elements.deletionMessage);

    const confirmation = elements.deletionConfirmation.value.trim();
    if (confirmation !== currentUsername) {
      showMessage(elements.deletionMessage, 'Enter your exact username to schedule deletion.', 'warning');
      elements.deletionConfirmation.focus();
      return;
    }

    if (!window.confirm('Schedule permanent account deletion for seven days from now?')) return;
    setDeletionBusy(true);

    try {
      const payload = await api('/api/account/deletion', {
        method: 'POST',
        body: {
          confirmation,
          currentPassword: elements.deletionPassword.value
        }
      });
      elements.deletionForm.reset();
      applySecurityState(payload);
      showMessage(elements.deletionMessage, 'Account deletion scheduled. You can cancel during the next seven days.', 'warning');
    } catch (error) {
      handleAuthError(error, elements.deletionMessage);
    } finally {
      setDeletionBusy(false);
    }
  }

  async function cancelDeletion() {
    if (!window.confirm('Cancel the pending account deletion?')) return;

    elements.cancelDeletion.disabled = true;
    hideMessage(elements.deletionMessage);
    try {
      await api('/api/account/deletion', { method: 'DELETE' });
      applySecurityState({
        deletionRequestedAt: null,
        deletionScheduledFor: null
      });
      showMessage(elements.deletionMessage, 'Account deletion cancelled.', 'success');
    } catch (error) {
      handleAuthError(error, elements.deletionMessage);
    } finally {
      elements.cancelDeletion.disabled = false;
    }
  }

  function setDeletionBusy(busy) {
    elements.deletionForm.setAttribute('aria-busy', String(busy));
    elements.deletionConfirmation.disabled = busy;
    elements.deletionPassword.disabled = busy;
    elements.deletionSubmit.disabled = busy;
    elements.deletionSubmitLabel.textContent = busy ? 'Scheduling…' : 'Delete in 7 days';
  }

  function handleUsernameInput() {
    elements.username.setCustomValidity('');
    hideMessage(elements.usernameMessage);
    updateUsernameSaveState();
  }

  function initBattleToggles() {
    bindPreferenceToggle(elements.screenShake, BATTLE_SCREEN_SHAKE_KEY);
    bindPreferenceToggle(elements.cardShake, BATTLE_CARD_SHAKE_KEY);
    bindPreferenceToggle(elements.hideWinningAmbushes, HIDE_WINNING_AMBUSHES_KEY, false);
  }

  function initWorldToggles() {
    if (!elements.bossNarration) return;

    const explicitPreference = getStoredPreference(WORLD_BOSS_NARRATION_KEY);
    elements.bossNarration.checked = explicitPreference === null
      ? !isTemporaryBossNarrationMuted()
      : explicitPreference;
    elements.bossNarration.addEventListener('change', () => {
      setPreferenceEnabled(WORLD_BOSS_NARRATION_KEY, elements.bossNarration.checked);
    });
  }

  function isTemporaryBossNarrationMuted() {
    try {
      const mutedUntil = Number(localStorage.getItem(WORLD_BOSS_INTRO_MUTE_KEY));
      return Number.isFinite(mutedUntil) && Date.now() < mutedUntil;
    } catch (error) {
      return false;
    }
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
    const stored = getStoredPreference(key);
    return stored === null ? defaultEnabled : stored;
  }

  function getStoredPreference(key) {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? null : stored !== '0';
    } catch (error) {
      return null;
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
    updateUsernameSaveState();

    const usernameError = usernames?.getValidationMessage?.(username) || '';
    if (usernameError) {
      elements.username.setCustomValidity(usernameError);
      elements.username.reportValidity();
      showMessage(elements.usernameMessage, usernameError, 'warning');
      return;
    }

    elements.username.setCustomValidity('');
    if (username === currentUsername) {
      showMessage(elements.usernameMessage, 'Your username is already up to date.', 'secondary');
      return;
    }

    setUsernameBusy(true);

    try {
      const payload = await api('/api/account/profile', {
        method: 'PATCH',
        body: { username }
      });
      syncPlayer(payload.player);
      showMessage(elements.usernameMessage, 'Username updated.', 'success');
    } catch (error) {
      handleAuthError(error, elements.usernameMessage);
    } finally {
      setUsernameBusy(false);
    }
  }

  function syncPlayer(player) {
    if (!player) return;

    currentUsername = player.username || '';
    elements.username.value = currentUsername;
    updateUsernameSaveState();

    const session = window.AmongDemons.getSession();
    window.AmongDemons.setSession({ ...session, player });
    window.AmongDemons.ui?.updateNavAccount?.(player);
  }

  function setUsernameFormEnabled(enabled) {
    elements.username.disabled = !enabled;
    updateUsernameSaveState();
  }

  function setUsernameBusy(busy) {
    elements.username.disabled = busy;
    elements.usernameForm.setAttribute('aria-busy', String(busy));
    elements.usernameSubmitLabel.textContent = busy ? 'Saving…' : 'Change username';
    updateUsernameSaveState();
  }

  function updateUsernameSaveState() {
    const usernameChanged = elements.username.value !== currentUsername;
    elements.usernameSubmit.disabled = elements.username.disabled || !usernameChanged;
  }

  async function showOAuthResult() {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('oauth');
    if (!result) return;

    if (result === 'merge') {
      const mergeToken = url.searchParams.get('mergeToken') || '';
      clearOAuthResultFromUrl(url);
      if (!mergeToken) {
        showMessage(elements.providerMessage, 'That account merge request is incomplete. Connect the account again.', 'warning');
        return;
      }

      try {
        const payload = await api(`/api/account/merge/${encodeURIComponent(mergeToken)}`);
        currentMergeToken = mergeToken;
        renderAccountMerge(payload.preview);
      } catch (error) {
        showMessage(elements.providerMessage, error, error.status === 403 ? 'warning' : 'danger');
      }
      return;
    }

    const messages = {
      connected: { message: 'Account connected.', type: 'success' },
      access_denied: { message: 'Account connection was cancelled.', type: 'warning' },
      invalid_state: { message: 'That connection request expired. Try again.', type: 'warning' },
      oauth_conflict: { message: 'That provider account is already connected to another hunter.', type: 'warning' },
      oauth_failed: { message: 'The provider could not be connected. Try again.', type: 'danger' },
      provider_unavailable: { message: 'That sign-in provider is unavailable.', type: 'warning' }
    };
    const feedback = messages[result] || messages.oauth_failed;
    showMessage(elements.providerMessage, feedback.message, feedback.type);
    clearOAuthResultFromUrl(url);
  }

  function clearOAuthResultFromUrl(url) {
    url.searchParams.delete('oauth');
    url.searchParams.delete('mergeToken');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function renderAccountMerge(preview = {}) {
    currentMergeProvider = String(preview.provider || '').toLowerCase();
    elements.mergeAccounts.replaceChildren(
      createAccountMergeCard(preview.steamAccount, 'Steam hunter', 'steam'),
      createMergeDivider(),
      createAccountMergeCard(
        preview.connectedAccount,
        `${providerLabel(preview.provider)} hunter`,
        preview.provider
      )
    );
    elements.mergeError.classList.add('d-none');
    elements.mergeError.textContent = '';
    elements.mergeModal.classList.remove('d-none');
    document.body.classList.add('account-merge-open');
    elements.mergeSubmit.disabled = false;
    elements.mergeSubmit.querySelector('span').textContent = 'Merge accounts';
    elements.mergeSubmit.focus();
  }

  function createAccountMergeCard(account = {}, heading, provider) {
    const card = document.createElement('article');
    card.className = 'account-merge-card';

    const providerRow = document.createElement('div');
    providerRow.className = 'account-merge-provider';
    const logo = document.createElement('span');
    logo.className = `account-merge-provider-mark is-${provider}`;
    if (provider === 'google' || provider === 'discord') {
      const image = document.createElement('img');
      image.src = `/app/images/assets/oauth-${provider}.svg`;
      image.alt = '';
      image.width = 26;
      image.height = 26;
      logo.appendChild(image);
    } else {
      logo.textContent = 'S';
    }
    const providerCopy = document.createElement('div');
    const eyebrow = document.createElement('span');
    eyebrow.textContent = heading;
    const username = document.createElement('strong');
    username.textContent = account.username || 'Unknown hunter';
    providerCopy.append(eyebrow, username);
    providerRow.append(logo, providerCopy);

    const stats = document.createElement('dl');
    stats.className = 'account-merge-stats';
    [
      ['Level', account.level],
      ['XP', account.xp],
      ['Souls', account.souls],
      ['Summoned demons', account.demonCount],
      ['Bag items', account.bagItems],
      ['Highest floor', account.highestFloor],
      ['Achievements', account.achievementCount]
    ].forEach(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = formatNumber(value);
      row.append(term, detail);
      stats.appendChild(row);
    });

    const identities = document.createElement('p');
    identities.className = 'account-merge-identities';
    identities.textContent = `Connected: ${(account.providers || []).map((item) => providerLabel(item.id)).join(', ') || 'None'}`;
    card.append(providerRow, stats, identities);
    return card;
  }

  function createMergeDivider() {
    const divider = document.createElement('div');
    divider.className = 'account-merge-divider';
    divider.setAttribute('aria-hidden', 'true');
    divider.textContent = '+';
    return divider;
  }

  async function confirmAccountMerge() {
    if (!currentMergeToken || elements.mergeSubmit.disabled) return;
    const mergeToken = currentMergeToken;
    const mergeProvider = currentMergeProvider;
    elements.mergeSubmit.disabled = true;
    elements.mergeCancel.disabled = true;
    elements.mergeSubmit.querySelector('span').textContent = 'Merging…';
    elements.mergeError.classList.add('d-none');

    try {
      const payload = await api(`/api/account/merge/${encodeURIComponent(currentMergeToken)}`, {
        method: 'POST',
        body: {}
      });
      await completeAccountMerge(payload.player);
    } catch (error) {
      if (await recoverCompletedAccountMerge(mergeToken, mergeProvider)) return;
      elements.mergeError.textContent = error?.message || 'The accounts could not be merged.';
      elements.mergeError.classList.remove('d-none');
      elements.mergeSubmit.disabled = false;
      elements.mergeSubmit.querySelector('span').textContent = 'Merge accounts';
    } finally {
      elements.mergeCancel.disabled = false;
    }
  }

  async function recoverCompletedAccountMerge(mergeToken, provider) {
    try {
      // A committed merge deletes its one-time intent. If the intent still
      // exists, the transaction rolled back and the original error is real.
      await api(`/api/account/merge/${encodeURIComponent(mergeToken)}`, { dedupe: false });
      return false;
    } catch (error) {
      if (error?.status !== 404) return false;
    }

    try {
      const security = await api('/api/account/security', { dedupe: false });
      const connected = (security.providers || []).some(
        (item) => item.id === provider && item.connected
      );
      if (!connected) return false;
      const payload = await api('/api/auth/me', { dedupe: false });
      await completeAccountMerge(payload.player, security);
      return true;
    } catch (error) {
      return false;
    }
  }

  async function completeAccountMerge(player, security = null) {
    syncPlayer(player);
    currentMergeToken = '';
    currentMergeProvider = '';
    closeAccountMerge();
    if (security) applySecurityState(security);
    else await loadSecurity();
    showMessage(elements.providerMessage, {
      type: 'success',
      title: 'Accounts merged.',
      message: 'Your achievements and progress are now connected to Steam.',
      action: 'Return to Steam; the app will update automatically.'
    }, 'success');
  }

  async function cancelAccountMerge() {
    const token = currentMergeToken;
    currentMergeToken = '';
    currentMergeProvider = '';
    closeAccountMerge();
    if (token) {
      try {
        await api(`/api/account/merge/${encodeURIComponent(token)}`, { method: 'DELETE' });
      } catch (error) {
        // The intent is short-lived and harmless if it already expired.
      }
    }
    showMessage(elements.providerMessage, 'Account merge cancelled. No progress was changed.', 'info');
  }

  function closeAccountMerge() {
    elements.mergeModal.classList.add('d-none');
    document.body.classList.remove('account-merge-open');
    elements.mergeError.classList.add('d-none');
    elements.mergeError.textContent = '';
  }

  function providerLabel(provider) {
    const labels = { steam: 'Steam', google: 'Google', discord: 'Discord' };
    return labels[String(provider || '').toLowerCase()] || 'Account';
  }

  function formatNumber(value) {
    return Math.max(0, Number(value) || 0).toLocaleString();
  }

  function handleAuthError(error, messageElement) {
    if (error.status === 401 || error.status === 410) {
      window.AmongDemons.clearSession();
      redirectToLogin();
      return;
    }

    console.error(error);
    showMessage(messageElement, error, 'danger');
  }

  function showMessage(element, message, type) {
    window.AmongDemons.setGameAlert(element, message, {
      type,
      inline: true,
      className: 'settings-message'
    });
    element.classList.toggle('d-none', !message);
  }

  function hideMessage(element) {
    element.classList.add('d-none');
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'the scheduled date';
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'long',
      timeStyle: 'short'
    }).format(date);
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
