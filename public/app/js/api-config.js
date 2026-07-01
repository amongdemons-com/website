(function() {
  'use strict';

  const WEBSITE_API_BASE_URL = '/api';
  const PACKAGED_API_BASE_URL = 'https://amongdemons.com/api';
  const LOCAL_ROUTES = {
    '/': 'index.html',
    '/camp': 'camp.html',
    '/collection': 'collection.html',
    '/dungeon': 'dungeon.html',
    '/login': 'login.html',
    '/privacy': 'privacy.html',
    '/rank': 'rankings.html',
    '/rankings': 'rankings.html',
    '/register': 'register.html',
    '/settings': 'settings.html',
    '/skill-tree': 'skill-tree.html',
    '/terms': 'terms.html',
    '/world': 'world.html'
  };

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
    const value = String(path || '');
    if (!isPackagedRuntime() || !value || /^[a-z][a-z\d+\-.]*:\/\//i.test(value)) return value;
    if (value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')) return value;

    const parsed = splitLocalUrl(value);
    const normalizedPath = normalizeRoutePath(parsed.pathname);
    const hunterUsername = getHunterUsername(normalizedPath);
    if (hunterUsername) {
      const joiner = parsed.search ? '&' : '';
      return `./hunter.html?username=${encodeURIComponent(hunterUsername)}${joiner}${parsed.search.replace(/^\?/, '')}${parsed.hash}`;
    }

    const rankingSort = getRankingSort(normalizedPath);
    if (rankingSort) return `./rankings.html?sort=${encodeURIComponent(rankingSort)}${parsed.hash}`;

    const routeFile = LOCAL_ROUTES[normalizedPath];
    return routeFile ? `./${routeFile}${parsed.search}${parsed.hash}` : value;
  }

  function bindPackagedRouteLinks() {
    if (!isPackagedRuntime() || !document.body) return;

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      const link = target?.closest('a[href]');
      if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;

      const href = link.getAttribute('href');
      const nextUrl = appUrl(href);
      if (!nextUrl || nextUrl === href) return;

      event.preventDefault();
      window.location.href = nextUrl;
    });
  }

  function isPackagedRuntime() {
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

  function splitLocalUrl(value) {
    const hashIndex = value.indexOf('#');
    const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
    const searchIndex = withoutHash.indexOf('?');

    return {
      pathname: searchIndex >= 0 ? withoutHash.slice(0, searchIndex) : withoutHash,
      search: searchIndex >= 0 ? withoutHash.slice(searchIndex) : '',
      hash
    };
  }

  function normalizeRoutePath(pathname) {
    const normalized = `/${String(pathname || '').replace(/^\/+/, '')}`.replace(/\/+$/, '');
    return normalized === '' ? '/' : normalized;
  }

  function getRankingSort(pathname) {
    if (!pathname.startsWith('/rankings/')) return '';

    const sort = pathname.slice('/rankings/'.length).split('/')[0];
    return ['floor', 'level', 'souls', 'pvp'].includes(sort) ? sort : '';
  }

  function getHunterUsername(pathname) {
    if (!pathname.startsWith('/hunter/')) return '';
    return pathname.slice('/hunter/'.length).split('/')[0] || '';
  }

  window.AmongDemons = {
    ...(window.AmongDemons || {}),
    apiBaseUrl: getApiBaseUrl,
    apiUrl,
    appUrl,
    isPackagedRuntime
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPackagedRouteLinks, { once: true });
  } else {
    bindPackagedRouteLinks();
  }
})();
