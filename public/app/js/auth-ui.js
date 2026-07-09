(function() {
  'use strict';

  const SESSION_KEY = 'amongdemons-session';
  const api = window.AmongDemons.api;
  const apiUrl = window.AmongDemons.apiUrl || ((value) => value);
  const usernames = window.AmongDemons.usernames;
  const mode = document.body.dataset.authMode;
  const form = document.getElementById('authForm');
  const message = document.getElementById('authMessage');
  const oauthButtons = Array.from(document.querySelectorAll('[data-oauth-provider]'));
  // A guest arriving at the register page is here to SAVE their existing hunter,
  // not to open a second account — so we claim in place instead of registering.
  const claimMode = mode === 'register' && Boolean(window.AmongDemons.isGuest?.());

  if (!form) return;

  // The register page keeps its full UI (Google, Discord, password, switch link)
  // in every mode. In claim mode the provider buttons carry the guest's token so
  // signing up with Google/Discord claims the existing hunter in place.
  initOAuthButtons();
  if (claimMode) applyClaimMode();
  initPasswordToggles();
  showOAuthQueryMessage();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('', '');

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const formData = new FormData(form);
      const usernameInput = form.querySelector('[name="username"]');
      const body = {
        username: usernames?.normalize
          ? usernames.normalize(formData.get('username'))
          : String(formData.get('username') || '').trim(),
        password: String(formData.get('password') || '')
      };

      if (mode === 'register') {
        const usernameError = usernames?.getValidationMessage?.(body.username) || '';
        if (usernameError) {
          usernameInput?.setCustomValidity(usernameError);
          usernameInput?.reportValidity();
          setMessage(usernameError, 'warning');
          return;
        }
      }

      usernameInput?.setCustomValidity('');

      if (mode === 'register') {
        const email = String(formData.get('email') || '').trim();
        if (email) body.email = email;
      }

      if (claimMode) {
        await window.AmongDemons.claimGuest(body);
        setMessage({
          type: 'success',
          title: 'Your hunter is saved.',
          message: 'Your demons, progress, and profile are kept forever.',
          action: 'Taking you to camp...'
        }, 'success');
        setTimeout(() => {
          window.location.href = window.AmongDemons.appUrl('/camp');
        }, 900);
        return;
      }

      const payload = await api(`/api/auth/${mode}`, {
        method: 'POST',
        body
      });

      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token: payload.token,
        player: payload.player
      }));
      window.location.href = window.AmongDemons.appUrl('/camp');
    } catch (error) {
      console.error(error);
      setMessage(error, 'danger');
    } finally {
      submitButton.disabled = false;
    }
  });

  async function initOAuthButtons() {
    oauthButtons.forEach((button) => {
      const provider = button.dataset.oauthProvider;
      const claimSuffix = claimMode
        ? `&claimToken=${encodeURIComponent(window.AmongDemons.getToken() || '')}`
        : '';
      button.href = apiUrl(`/api/auth/oauth/${encodeURIComponent(provider)}?mode=${encodeURIComponent(mode || 'login')}${claimSuffix}`);
      button.addEventListener('click', (event) => {
        if (button.dataset.oauthEnabled === 'false') {
          event.preventDefault();
          setMessage(`${getProviderLabel(provider)} sign-in is not configured yet.`, 'warning');
        }
      });
    });

    if (!oauthButtons.length) return;

    try {
      const payload = await api('/api/auth/oauth/providers');
      applyProviderStatus(payload.providers || []);
    } catch (error) {
      oauthButtons.forEach((button) => {
        button.dataset.oauthEnabled = 'true';
      });
    }
  }

  function applyProviderStatus(providers) {
    const byId = new Map(providers.map((provider) => [provider.id, provider]));

    oauthButtons.forEach((button) => {
      const provider = button.dataset.oauthProvider;
      const status = byId.get(provider);
      const enabled = Boolean(status && status.enabled);

      button.dataset.oauthEnabled = enabled ? 'true' : 'false';
      button.classList.toggle('is-disabled', !enabled);
      button.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      button.title = enabled ? '' : `${getProviderLabel(provider)} sign-in is not configured yet.`;
    });
  }

  function showOAuthQueryMessage() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('oauth');
    if (!code) return;

    const messages = {
      access_denied: 'Sign-in was cancelled.',
      invalid_state: 'Your sign-in session expired. Try again.',
      oauth_failed: 'The provider could not sign you in. Try again.',
      provider_unavailable: 'That sign-in provider is not configured yet.'
    };
    const type = code === 'access_denied' || code === 'provider_unavailable' ? 'warning' : 'danger';
    setMessage(messages[code] || 'Sign-in could not continue.', type);
  }

  function getProviderLabel(provider) {
    const labels = {
      discord: 'Discord',
      google: 'Google'
    };

    return labels[provider] || 'Provider';
  }

  function initPasswordToggles() {
    document.querySelectorAll('[data-password-toggle]').forEach((button) => {
      const inputId = button.dataset.passwordToggle;
      const input = document.getElementById(inputId);
      if (!input) return;

      button.addEventListener('click', () => {
        const isVisible = input.type === 'text';
        input.type = isVisible ? 'password' : 'text';
        button.classList.toggle('is-visible', !isVisible);
        button.setAttribute('aria-label', isVisible ? 'Show password' : 'Hide password');
      });
    });
  }

  function applyClaimMode() {
    document.title = 'Save your hunter | Among Demons';

    const title = document.querySelector('[data-auth-title]');
    if (title) title.textContent = 'Save your hunter';

    const subtitle = document.querySelector('[data-auth-subtitle]');
    if (subtitle) {
      subtitle.textContent = 'Create an account to keep your demons, progress, and profile forever.';
      subtitle.hidden = false;
    }

    const submitLabel = document.querySelector('[data-auth-submit-label]');
    if (submitLabel) submitLabel.textContent = 'Save Progress';

    // The divider copy is nudged for claim context; Google/Discord and the
    // switch link stay visible (provider sign-up claims the guest in place).
    const divider = document.querySelector('[data-oauth-divider] span');
    if (divider) divider.textContent = 'or save with password';
  }

  function setMessage(text, type) {
    window.AmongDemons.setGameAlert(message, text, { type });
  }
})();
