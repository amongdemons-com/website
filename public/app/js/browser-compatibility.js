import compatibility from '../../../lib/browser-compatibility.js';

const CHROME_APP_STORE_URL = 'https://apps.apple.com/app/google-chrome/id535886823';
const NOTICE_ID = 'iosSafariCompatibilityNotice';
const SAFARI_OVERRIDE_KEY = 'amongDemons.iosSafariCompatibilityOverride';
let safariOverrideEnabled = false;

onReady(initIosSafariCompatibilityNotice);

function initIosSafariCompatibilityNotice() {
  if (!compatibility.isIosSafari(window.navigator) || hasIosSafariOverride()) return;

  document.addEventListener('click', (event) => {
    if (hasIosSafariOverride()) return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const playTrigger = target?.closest('[data-play-instantly]');
    if (!playTrigger) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    showIosSafariCompatibilityNotice(
      playTrigger.dataset.playDestination || playTrigger.getAttribute('href') || '/camp'
    );
  }, true);

  if (compatibility.isGamePath(window.location.pathname)) {
    showIosSafariCompatibilityNotice();
  }
}

function showIosSafariCompatibilityNotice(destination = '') {
  if (document.getElementById(NOTICE_ID)) return;

  const gameUrl = getCanonicalGameUrl(destination);
  const notice = document.createElement('section');
  notice.id = NOTICE_ID;
  notice.className = 'browser-compatibility-gate';
  notice.setAttribute('role', 'dialog');
  notice.setAttribute('aria-modal', 'true');
  notice.setAttribute('aria-labelledby', `${NOTICE_ID}Title`);
  notice.setAttribute('aria-describedby', `${NOTICE_ID}Description`);
  notice.innerHTML = `
    <div class="browser-compatibility-card">
      <div class="browser-compatibility-brand" aria-hidden="true">
        <img src="/app/images/amongdemons_logo_250x250.png" alt="" width="72" height="72">
      </div>
      <p class="browser-compatibility-kicker">Browser compatibility</p>
      <h1 id="${NOTICE_ID}Title">Open Among Demons in Chrome</h1>
      <p id="${NOTICE_ID}Description" class="browser-compatibility-description">Safari on iPhone and iPad cannot reliably display the game interface. For stable controls and the intended visual experience, play using Google Chrome.</p>
      <div class="browser-compatibility-note">
        <span aria-hidden="true">${renderIcon('info')}</span>
        <p>After installing Chrome, open <strong>amongdemons.com</strong> there. If your hunter is saved, sign in normally to continue.</p>
      </div>
      <div class="browser-compatibility-actions">
        <a class="btn btn-primary browser-compatibility-download" href="${CHROME_APP_STORE_URL}" rel="noopener noreferrer">
          <span>Download Google Chrome</span>
          ${renderIcon('arrow-right')}
        </a>
        <button class="btn btn-glass-muted browser-compatibility-copy" type="button" data-copy-game-link>
          ${renderIcon('copy')}
          <span>Copy game link</span>
        </button>
        <button class="btn btn-glass-muted browser-compatibility-continue" type="button" data-continue-in-safari>
          <span>Continue in Safari anyway</span>
        </button>
      </div>
      <p class="browser-compatibility-status" data-browser-compatibility-status aria-live="polite">Already have Chrome? Copy the link, then paste it into Chrome.</p>
      <a class="browser-compatibility-home" href="/">Return to homepage</a>
    </div>
  `;

  lockPageBehindNotice(notice);
  document.body.appendChild(notice);
  document.body.classList.add('has-browser-compatibility-gate');
  notice.querySelector('[data-copy-game-link]')?.addEventListener('click', (event) => {
    copyGameLink(gameUrl, event.currentTarget, notice);
  });
  notice.querySelector('[data-continue-in-safari]')?.addEventListener('click', () => {
    continueInSafari(notice, destination);
  });
  trapNoticeFocus(notice);
  window.AmongDemons?.ui?.replaceStaticIcons?.(notice);
  notice.querySelector('.browser-compatibility-download')?.focus({ preventScroll: true });
}

function lockPageBehindNotice(notice) {
  Array.from(document.body.children).forEach((element) => {
    if (element === notice || element.tagName === 'SCRIPT' || element.hasAttribute('inert')) return;
    element.setAttribute('inert', '');
    element.dataset.compatibilityInert = 'true';
  });
}

function continueInSafari(notice, destination = '') {
  safariOverrideEnabled = true;
  try {
    window.sessionStorage.setItem(SAFARI_OVERRIDE_KEY, 'true');
  } catch (error) {
    // The in-memory override still allows the current page to continue.
  }

  unlockPageBehindNotice();
  notice.remove();
  document.body.classList.remove('has-browser-compatibility-gate');

  const nextDestination = getSafeGameDestination(destination);
  if (nextDestination) window.location.assign(nextDestination);
}

function unlockPageBehindNotice() {
  document.querySelectorAll('[data-compatibility-inert="true"]').forEach((element) => {
    element.removeAttribute('inert');
    delete element.dataset.compatibilityInert;
  });
}

function hasIosSafariOverride() {
  if (safariOverrideEnabled) return true;
  try {
    return window.sessionStorage.getItem(SAFARI_OVERRIDE_KEY) === 'true';
  } catch (error) {
    return false;
  }
}

function getSafeGameDestination(destination = '') {
  if (!destination) return '';
  const resolved = new URL(destination, window.location.origin);
  if (resolved.origin !== window.location.origin) return '/camp';
  return `${resolved.pathname}${resolved.search}${resolved.hash}`;
}

function trapNoticeFocus(notice) {
  notice.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(notice.querySelectorAll('a[href], button:not(:disabled)'));
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

async function copyGameLink(gameUrl, button, notice) {
  const copied = await copyText(gameUrl);
  const status = notice.querySelector('[data-browser-compatibility-status]');
  if (status) {
    status.textContent = copied
      ? 'Game link copied. Open Chrome and paste it into the address bar.'
      : `Copy this address into Chrome: ${gameUrl}`;
  }
  if (copied && button) {
    button.classList.add('is-copied');
    const label = button.querySelector('span');
    if (label) label.textContent = 'Link copied';
  }
}

async function copyText(value) {
  try {
    if (window.navigator.clipboard?.writeText) {
      await window.navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    // Fall back to a temporary selection for older iOS versions.
  }

  try {
    const input = document.createElement('textarea');
    input.value = value;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    return copied;
  } catch (error) {
    return false;
  }
}

function getCanonicalGameUrl(destination = '') {
  const currentPath = `${window.location.pathname || '/camp'}${window.location.search || ''}${window.location.hash || ''}`;
  const resolvedDestination = destination ? new URL(destination, window.location.origin) : null;
  const path = resolvedDestination
    ? `${resolvedDestination.pathname}${resolvedDestination.search}${resolvedDestination.hash}`
    : currentPath;
  return `https://amongdemons.com${path}`;
}

function renderIcon(name) {
  const renderer = window.AmongDemons?.ui?.renderIcon;
  return typeof renderer === 'function' ? renderer(name, { size: 18 }) : '';
}

function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
    return;
  }
  callback();
}
