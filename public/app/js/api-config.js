(function() {
  'use strict';

  const WEBSITE_API_BASE_URL = '/api';
  const PACKAGED_API_BASE_URL = 'https://amongdemons.com/api';

  function getApiBaseUrl() {
    return isPackagedRuntime() ? PACKAGED_API_BASE_URL : WEBSITE_API_BASE_URL;
  }

  function apiUrl(path = '') {
    const value = String(path || '');
    if (/^[a-z][a-z\d+\-.]*:\/\//i.test(value)) return value;

    const baseUrl = getApiBaseUrl().replace(/\/$/, '');
    const normalizedPath = value.replace(/^\/+/, '');

    if (!normalizedPath || normalizedPath === 'api') return baseUrl;
    if (normalizedPath.startsWith('api/')) return `${baseUrl}/${normalizedPath.slice(4)}`;
    if (normalizedPath.startsWith('api?')) return `${baseUrl}${normalizedPath.slice(3)}`;
    if (normalizedPath.startsWith('?')) return `${baseUrl}${normalizedPath}`;

    return `${baseUrl}/${normalizedPath}`;
  }

  function appUrl(path = '') {
    return String(path || '');
  }

  function isPackagedRuntime() {
    // TEMP capture workaround - REVERT: force local API on localhost so the
    // Electron-UA preview browser hits the dev server instead of production.
    if (/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)) return false;
    return isCapacitorRuntime() || isElectronRuntime();
  }

  function isCapacitorRuntime() {
    return Boolean(window.Capacitor?.isNativePlatform?.())
      || Boolean(window.Capacitor)
      || Boolean(window.CapacitorHttpAndroidInterface)
      || ['capacitor:', 'ionic:'].includes(window.location.protocol);
  }

  function isElectronRuntime() {
    const runtime = window.AmongDemonsRuntime || {};
    return runtime.platform === 'steam'
      || runtime.platform === 'electron'
      || runtime.isElectron === true
      || /\bElectron\b/i.test(window.navigator.userAgent || '');
  }

  window.AmongDemons = {
    ...(window.AmongDemons || {}),
    apiBaseUrl: getApiBaseUrl,
    apiUrl,
    appUrl,
    isPackagedRuntime
  };
})();
