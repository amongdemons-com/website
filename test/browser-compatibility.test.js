const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isGamePath,
  isIosSafari,
  isSamsungInternet,
  requiresIosSafariNotice
} = require('../lib/browser-compatibility');

const IPHONE_SAFARI = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5
};

const SAMSUNG_INTERNET = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36'
};

test('iPhone and desktop-mode iPad Safari are detected', () => {
  assert.equal(isIosSafari(IPHONE_SAFARI), true);
  assert.equal(isIosSafari({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    platform: 'MacIntel',
    maxTouchPoints: 5
  }), true);
});

test('Chrome and other iOS browsers do not receive the Safari notice', () => {
  assert.equal(isIosSafari({
    ...IPHONE_SAFARI,
    userAgent: IPHONE_SAFARI.userAgent.replace('Version/18.0 Mobile/15E148 Safari/604.1', 'CriOS/140.0.0.0 Mobile/15E148 Safari/604.1')
  }), false);
  assert.equal(isIosSafari({
    ...IPHONE_SAFARI,
    userAgent: IPHONE_SAFARI.userAgent.replace('Version/18.0 Mobile/15E148 Safari/604.1', 'EdgiOS/140.0 Mobile/15E148 Safari/604.1')
  }), false);
});

test('Samsung Internet is detected without matching regular Chromium browsers', () => {
  assert.equal(isSamsungInternet(SAMSUNG_INTERNET), true);
  assert.equal(isSamsungInternet({
    userAgent: SAMSUNG_INTERNET.userAgent.replace('SamsungBrowser/27.0 ', '')
  }), false);
});

test('the compatibility notice is limited to gameplay routes', () => {
  ['/camp', '/world', '/dungeon/run', '/bag', '/collection', '/skill-tree']
    .forEach((path) => assert.equal(isGamePath(path), true, path));
  ['/leaderboard', '/hunter/TestHunter', '/', '/settings']
    .forEach((path) => assert.equal(isGamePath(path), false, path));

  assert.equal(requiresIosSafariNotice(IPHONE_SAFARI, '/world'), true);
  assert.equal(requiresIosSafariNotice(IPHONE_SAFARI, '/leaderboard'), false);
});

test('Safari compatibility interception loads before Play Instantly navigation', () => {
  const root = path.join(__dirname, '..');
  const runtime = fs.readFileSync(path.join(root, 'scripts', 'browser-runtime-entry.js'), 'utf8');
  const compatibilityUi = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'browser-compatibility.js'), 'utf8');

  assert.ok(runtime.indexOf('browser-compatibility.js') < runtime.indexOf('navigation.js'));
  assert.match(compatibilityUi, /closest\('\[data-play-instantly\]'\)/);
  assert.match(compatibilityUi, /stopImmediatePropagation\(\)/);
  assert.match(compatibilityUi, /dataset\.browser = 'samsung-internet'/);
});

test('Samsung Internet receives the readable Arial fallback only', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'), 'utf8');

  assert.match(css, /html\[data-browser="samsung-internet"\][\s\S]*font-family: Arial, Helvetica, sans-serif !important;/);
  assert.match(css, /html\[data-browser="samsung-internet"\] \.outline[\s\S]*-webkit-text-stroke: 0 !important;/);
});

test('Safari compatibility notice offers an explicit session-scoped override', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'browser-compatibility.js'),
    'utf8'
  );

  assert.match(source, /data-continue-in-safari/);
  assert.match(source, /Continue in Safari anyway/);
  assert.match(source, /sessionStorage\.setItem\(SAFARI_OVERRIDE_KEY, 'true'\)/);
  assert.match(source, /removeAttribute\('inert'\)/);
});
