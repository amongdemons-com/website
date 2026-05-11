(function() {
  'use strict';

  const KEY = 'amongdemons-session';

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch (error) {
      return {};
    }
  }

  function setSession(nextSession) {
    localStorage.setItem(KEY, JSON.stringify(nextSession));
  }

  function clearSession() {
    localStorage.removeItem(KEY);
  }

  function getToken() {
    return getSession().token || '';
  }

  async function api(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(path, {
      ...options,
      headers,
      body: options.body && typeof options.body !== 'string'
        ? JSON.stringify(options.body)
        : options.body
    });
    const text = await response.text();
    const payload = text ? parsePayload(text) : null;

    if (!response.ok) {
      const message = payload && payload.error ? payload.error : 'Something went wrong.';
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function parsePayload(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  window.AmongDemons = {
    api,
    clearSession,
    getSession,
    getToken,
    setSession
  };
})();
