// Steam wrapper integration. Only active inside the Electron shell, which
// exposes window.steamBridge from its preload script. Signs the player in
// silently with a Steam session ticket, adds a wrapper-only exit button to
// the navbar, and mirrors server-side achievement unlocks to the local Steam
// client.
(function() {
  'use strict';

  const TOAST_SYNC_DELAY_MS = 4000;
  const TOAST_SYNC_INTERVAL_MS = 5 * 60 * 1000;
  // The ticket handshake only needs to run once per app run, not on every
  // page navigation; sessionStorage survives navigations within the wrapper.
  const LOGIN_FLAG_KEY = 'amongdemons-steam-login-v1';
  const ACHIEVEMENT_SYNC_KEY = 'amongdemons-steam-achievement-sync-v1';

  if (!window.steamBridge || typeof window.steamBridge.getAuthTicket !== 'function') return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  async function init() {
    const AD = window.AmongDemons;
    if (!AD?.api) return;

    insertNavExitButton();

    // Session-gated pages bounce to /login before this async handshake can
    // finish, so the wrapper's first boot lands on the sign-in form. Once the
    // handshake has produced a session, an auth page should go to camp instead
    // of staying on (or reloading into) the login form.
    const onAuthPage = Boolean(document.body.dataset.authMode);

    const alreadySignedIn = AD.getToken() && sessionStorage.getItem(LOGIN_FLAG_KEY) === '1';
    if (!alreadySignedIn) {
      // The ticket + Valve round-trip takes a few seconds; cover the sign-in
      // form with a loading screen so the wrapper's first boot doesn't look
      // like it wants a password. The form comes back if the handshake fails.
      if (onAuthPage) showConnectOverlay();
      try {
        const ticket = await window.steamBridge.getAuthTicket();
        if (ticket) {
          const previousPlayerId = AD.getPlayer()?.id || null;
          const payload = await AD.api('/api/auth/steam', {
            method: 'POST',
            body: { ticket }
          });

          AD.setSession({ token: payload.token, player: payload.player });
          sessionStorage.setItem(LOGIN_FLAG_KEY, '1');

          if (onAuthPage) {
            // Keep the overlay up while the browser swaps to camp.
            window.location.replace(AD.appUrl('/camp'));
            return;
          }

          // Reload only when the signed-in hunter actually changed, so the
          // page reflects the Steam account without looping on every boot.
          if (previousPlayerId !== payload.player.id) {
            window.location.reload();
            return;
          }
        } else {
          removeConnectOverlay();
        }
      } catch (error) {
        console.warn('Steam sign-in unavailable:', error);
        removeConnectOverlay();
      }
    } else if (onAuthPage) {
      showConnectOverlay();
      window.location.replace(AD.appUrl('/camp'));
      return;
    }

    if (shouldSyncAchievementToasts()) {
      setTimeout(syncAchievementToasts, TOAST_SYNC_DELAY_MS);
    }
  }

  // Full-page cover shown on auth pages while the Steam handshake runs, so
  // the login form never greets a wrapper player who will be signed in
  // automatically. Inline-styled on purpose: it must not depend on page CSS.
  function showConnectOverlay() {
    if (document.getElementById('steamConnectOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'steamConnectOverlay';
    overlay.setAttribute('role', 'status');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:9999',
      // The auth pages hide <body> during wrapper boot; the overlay must
      // stay visible inside it.
      'visibility:visible',
      'display:flex',
      'flex-direction:column',
      'align-items:center',
      'justify-content:center',
      'gap:1.1rem',
      'background:var(--ad-bg, #071013)',
      'color:var(--ad-muted, #9fb6b2)',
      'font-size:0.95rem',
      'letter-spacing:0.04em'
    ].join(';');
    overlay.innerHTML =
      '<style>@keyframes steamConnectSpin{to{transform:rotate(360deg)}}</style>' +
      '<div style="width:2.2rem;height:2.2rem;border-radius:50%;border:3px solid rgba(111,214,189,0.2);border-top-color:var(--ad-teal, #6fd6bd);animation:steamConnectSpin 0.9s linear infinite;" aria-hidden="true"></div>' +
      '<div>Signing in through Steam&hellip;</div>';

    document.body.appendChild(overlay);
  }

  function removeConnectOverlay() {
    document.getElementById('steamConnectOverlay')?.remove();
    // Un-hide the auth page hidden at first paint so the form works as the
    // fallback when Steam sign-in fails.
    delete document.documentElement.dataset.steamBoot;
  }

  // Wrapper-only exit affordance: takes the navbar spot of the logout button
  // (which the wrapper hides) and opens the wrapper's exit confirm dialog.
  function insertNavExitButton() {
    if (typeof window.steamBridge.requestExit !== 'function') return;

    const logoutButton = document.getElementById('logoutBtn');
    if (!logoutButton || document.querySelector('.steam-nav-exit')) return;

    const exitButton = document.createElement('button');
    exitButton.type = 'button';
    exitButton.className = 'btn nav-logout-btn steam-nav-exit';
    exitButton.title = 'Exit game';
    exitButton.setAttribute('aria-label', 'Exit game');
    exitButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>';
    exitButton.addEventListener('click', () => {
      window.steamBridge.requestExit();
    });

    logoutButton.insertAdjacentElement('afterend', exitButton);
  }

  // Server-side unlocks (via the Steam Web API) are authoritative; activating
  // the same achievement locally is a no-op for already-seen unlocks and shows
  // the instant overlay toast for fresh ones (only when achievements allow
  // client writes; with Official GS protection this is a harmless no-op).
  async function syncAchievementToasts() {
    const AD = window.AmongDemons;
    if (!AD?.getToken()) return;

    try {
      const payload = await AD.api('/api/account/achievements');
      for (const achievement of payload.achievements || []) {
        if (achievement.unlocked && achievement.steamName) {
          void window.steamBridge.unlockAchievement(achievement.steamName);
        }
      }
      sessionStorage.setItem(ACHIEVEMENT_SYNC_KEY, String(Date.now()));
    } catch (error) {
      // Toast mirroring is cosmetic; never surface errors for it.
    }
  }

  function shouldSyncAchievementToasts() {
    const lastSyncedAt = Number(sessionStorage.getItem(ACHIEVEMENT_SYNC_KEY));
    return !Number.isFinite(lastSyncedAt)
      || lastSyncedAt <= 0
      || Date.now() - lastSyncedAt >= TOAST_SYNC_INTERVAL_MS;
  }
})();
