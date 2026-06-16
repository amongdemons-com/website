(function() {
  'use strict';

  const SESSION_KEY = 'amongdemons-session';
  const api = window.AmongDemons.api;
  const apiUrl = window.AmongDemons.apiUrl || ((value) => value);
  const mode = document.body.dataset.authMode;
  const form = document.getElementById('authForm');
  const message = document.getElementById('authMessage');
  const oauthButtons = Array.from(document.querySelectorAll('[data-oauth-provider]'));

  if (!form) return;

  initOAuthButtons();
  initPasswordToggles();
  showOAuthQueryMessage();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage('', '');

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;

    try {
      const formData = new FormData(form);
      const body = {
        username: String(formData.get('username') || '').trim(),
        password: String(formData.get('password') || '')
      };

      if (mode === 'register') {
        const email = String(formData.get('email') || '').trim();
        if (email) body.email = email;
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
      setMessage(error.message, 'danger');
    } finally {
      submitButton.disabled = false;
    }
  });

  async function initOAuthButtons() {
    oauthButtons.forEach((button) => {
      const provider = button.dataset.oauthProvider;
      button.href = apiUrl(`/api/auth/oauth/${encodeURIComponent(provider)}?mode=${encodeURIComponent(mode || 'login')}`);
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

  function setMessage(text, type) {
    message.textContent = text;
    message.className = text ? `alert alert-${type}` : 'alert d-none';
  }
})();
