const IOS_SAFARI_EXCLUSIONS = /(?:CriOS|EdgiOS|FxiOS|OPiOS|DuckDuckGo|YaBrowser|GSA)\//i;
const GAME_PATH_PATTERN = /^\/(?:camp|world|dungeon|ranked|bag|collection|skill-tree)(?:\/|$)/i;
const LEGACY_GAME_PATH_PATTERN = /^\/app\/(?:camp|world|dungeon|ranked|bag|collection|skill-tree)\.html$/i;

function isIosDevice(navigatorLike = {}) {
  const userAgent = String(navigatorLike.userAgent || '');
  const platform = String(navigatorLike.platform || '');
  const touchPoints = Math.max(0, Number(navigatorLike.maxTouchPoints) || 0);

  return /iPhone|iPad|iPod/i.test(userAgent)
    || (/Macintosh/i.test(userAgent) && /Mac/i.test(platform) && touchPoints > 1);
}

function isIosSafari(navigatorLike = {}) {
  const userAgent = String(navigatorLike.userAgent || '');
  return isIosDevice(navigatorLike)
    && /Safari\//i.test(userAgent)
    && !IOS_SAFARI_EXCLUSIONS.test(userAgent);
}

function isGamePath(pathname) {
  const path = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
  return GAME_PATH_PATTERN.test(path) || LEGACY_GAME_PATH_PATTERN.test(path);
}

function requiresIosSafariNotice(navigatorLike, pathname) {
  return isIosSafari(navigatorLike) && isGamePath(pathname);
}

module.exports = {
  isGamePath,
  isIosDevice,
  isIosSafari,
  requiresIosSafariNotice
};
