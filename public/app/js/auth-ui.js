(function() {
  'use strict';

  const SESSION_KEY = 'amongdemons-session';
  const mode = document.body.dataset.authMode;
  const form = document.getElementById('authForm');
  const message = document.getElementById('authMessage');

  if (!form) return;

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

      const response = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Could not continue.');
      }

      localStorage.setItem(SESSION_KEY, JSON.stringify({
        token: payload.token,
        player: payload.player
      }));
      window.location.href = '/';
    } catch (error) {
      setMessage(error.message, 'danger');
    } finally {
      submitButton.disabled = false;
    }
  });

  function setMessage(text, type) {
    message.textContent = text;
    message.className = text ? `alert alert-${type}` : 'alert d-none';
  }
})();
