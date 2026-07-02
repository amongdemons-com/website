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
    const toApiUrl = window.AmongDemons?.apiUrl || ((value) => value);
    const url = toApiUrl(path);
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

    const body = options.body && typeof options.body !== 'string'
      ? JSON.stringify(options.body)
      : options.body;

    if (shouldUseNativeHttp()) {
      return nativeApi(url, options, headers, body);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      body
    });
    const text = await response.text();

    return handleApiResponse(response.ok, response.status, text ? parsePayload(text) : null, path);
  }

  async function nativeApi(url, options, headers, body) {
    const response = await window.Capacitor.Plugins.CapacitorHttp.request({
      url,
      method: (options.method || 'GET').toUpperCase(),
      headers,
      data: body,
      responseType: 'text'
    });

    const status = Number(response.status || 0);
    return handleApiResponse(status >= 200 && status < 300, status, normalizePayload(response.data), url);
  }

  function shouldUseNativeHttp() {
    return Boolean(
      window.AmongDemons?.isPackagedRuntime?.()
      && window.Capacitor?.isNativePlatform?.()
      && window.Capacitor?.Plugins?.CapacitorHttp?.request
    );
  }

  function handleApiResponse(ok, status, payload, path = '') {
    if (!ok) {
      const message = payload && payload.error ? payload.error : 'Something went wrong.';
      const error = new Error(message);
      error.status = status;
      error.payload = payload;
      throw error;
    }

    notifyProgressionPayload(payload, path);
    return payload;
  }

  function notifyProgressionPayload(payload, path = '') {
    if (!payload || typeof payload !== 'object') return;

    const ui = window.AmongDemons?.ui;
    if (!ui) return;

    const candidate = getProgressionCandidate(payload, path);
    if (!candidate) return;

    if (candidate.kind === 'player' && typeof ui.updateNavAccount === 'function') {
      ui.updateNavAccount(candidate.data);
      return;
    }

    if (typeof ui.updateNavProgression === 'function') {
      ui.updateNavProgression(candidate.data);
      return;
    }

    if (typeof ui.updateNavXpProgress === 'function') {
      ui.updateNavXpProgress(candidate.data);
    }
  }

  function getProgressionCandidate(payload, path = '') {
    // Future XP-granting endpoints should return updated `player` or `progression`.
    // Top-level `xp` is ignored because run payout responses use it as earned XP, not total account XP.
    if (hasProgressionShape(payload.progression)) {
      return { kind: 'progression', data: payload.progression };
    }

    if (hasProgressionShape(payload.player)) {
      return { kind: 'player', data: payload.player };
    }

    if (isProgressionEndpoint(path) && hasProgressionShape(payload)) {
      return { kind: 'progression', data: payload };
    }

    if (payload.levelProgress && hasProgressionShape(payload)) {
      return { kind: 'progression', data: payload };
    }

    return null;
  }

  function hasProgressionShape(value) {
    if (!value || typeof value !== 'object') return false;
    return Boolean(
      value.levelProgress ||
      Number.isFinite(Number(value.xp)) ||
      Number.isFinite(Number(value.level))
    );
  }

  function isProgressionEndpoint(path = '') {
    try {
      return new URL(String(path), window.location.origin).pathname.replace(/\/+$/, '') === '/api/account/progression';
    } catch (error) {
      return String(path).replace(/\/+$/, '') === '/api/account/progression';
    }
  }

  function normalizePayload(data) {
    if (!data) return null;
    return typeof data === 'string' ? parsePayload(data) : data;
  }

  function parsePayload(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return text;
    }
  }

  window.AmongDemons = {
    ...(window.AmongDemons || {}),
    api,
    clearSession,
    getSession,
    getToken,
    setSession
  };
})();
