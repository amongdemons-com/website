// Android wrapper integration. The native shell owns Play Games platform
// authentication and exposes only non-secret actions to this page. A one-time
// server auth code is delivered by native code through receiveAuthCode().
(function() {
  'use strict';

  const bridge = window.amongDemonsAndroidBridge;
  if (!bridge || typeof bridge.requestPlayGamesSignIn !== 'function') return;

  const LOGIN_FLAG_KEY = 'amongdemons-play-games-login-v1';
  const ACHIEVEMENT_SYNC_KEY = 'amongdemons-play-games-achievement-sync-v1';
  const ACHIEVEMENT_SYNC_INTERVAL_MS = 5 * 60 * 1000;
  let pendingAuthCode = null;
  let authInFlight = false;
  let overlayTimeout = null;

  window.AmongDemonsAndroid = {
    receiveAuthCode(code) {
      if (!code || typeof code !== 'string') return false;
      pendingAuthCode = code;
      void consumeAuthCode();
      return true;
    },
    receiveStatus(status) {
      if (status === 'signed-out' || status === 'unconfigured' || status === 'error') {
        removeConnectOverlay();
      }
      return true;
    },
    showAchievements() {
      bridge.showAchievements();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  function init() {
    const AD = window.AmongDemons;
    if (!AD?.api) return;
    const onAuthPage = Boolean(document.body.dataset.authMode);
    const configured = Boolean(bridge.isPlayGamesConfigured());
    const alreadySignedIn = AD.getToken() && sessionStorage.getItem(LOGIN_FLAG_KEY) === '1';

    if (configured && onAuthPage && !alreadySignedIn) showConnectOverlay();
    if (alreadySignedIn && onAuthPage) {
      showConnectOverlay();
      window.location.replace(AD.appUrl('/camp'));
      return;
    }

    if (configured && !alreadySignedIn) {
      bridge.requestPlayGamesSignIn(false);
    } else if (!configured) {
      removeConnectOverlay();
    }

    void consumeAuthCode();
    if (AD.getToken() && shouldSyncAchievements()) {
      window.setTimeout(syncAchievements, 2500);
    }
  }

  async function consumeAuthCode() {
    const AD = window.AmongDemons;
    if (!pendingAuthCode || !AD?.api || authInFlight) return;
    authInFlight = true;
    const code = pendingAuthCode;
    pendingAuthCode = null;
    const onAuthPage = Boolean(document.body?.dataset.authMode);

    try {
      const previousPlayerId = AD.getPlayer()?.id || null;
      const payload = await AD.api('/api/auth/play-games', {
        method: 'POST',
        body: { code }
      });
      AD.setSession({ token: payload.token, player: payload.player });
      sessionStorage.setItem(LOGIN_FLAG_KEY, '1');
      await syncAchievements();

      if (onAuthPage) {
        window.location.replace(AD.appUrl('/camp'));
        return;
      }
      if (previousPlayerId !== payload.player.id) {
        window.location.reload();
        return;
      }
      removeConnectOverlay();
    } catch (error) {
      console.warn('Play Games sign-in unavailable:', error);
      removeConnectOverlay();
    } finally {
      authInFlight = false;
    }
  }

  async function syncAchievements() {
    const AD = window.AmongDemons;
    if (!AD?.getToken()) return;
    try {
      const payload = await AD.api('/api/account/achievements');
      const ids = (payload.achievements || [])
        .filter((achievement) => achievement.unlocked && achievement.playGamesId)
        .map((achievement) => achievement.playGamesId);
      bridge.syncAchievements(JSON.stringify(ids));
      sessionStorage.setItem(ACHIEVEMENT_SYNC_KEY, String(Date.now()));
    } catch (error) {
      // The durable server outbox will retry; local reconciliation is cosmetic.
    }
  }

  function shouldSyncAchievements() {
    const lastSyncedAt = Number(sessionStorage.getItem(ACHIEVEMENT_SYNC_KEY));
    return !Number.isFinite(lastSyncedAt)
      || lastSyncedAt <= 0
      || Date.now() - lastSyncedAt >= ACHIEVEMENT_SYNC_INTERVAL_MS;
  }

  function showConnectOverlay() {
    if (document.getElementById('playGamesConnectOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'playGamesConnectOverlay';
    overlay.setAttribute('role', 'status');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:9999', 'visibility:visible',
      'display:flex', 'flex-direction:column', 'align-items:center',
      'justify-content:center', 'gap:1.1rem',
      'background:var(--ad-bg, #071013)', 'color:var(--ad-muted, #9fb6b2)',
      'font-size:0.95rem', 'letter-spacing:0.04em'
    ].join(';');
    overlay.innerHTML =
      '<style>@keyframes playGamesConnectSpin{to{transform:rotate(360deg)}}</style>' +
      '<div style="width:2.2rem;height:2.2rem;border-radius:50%;border:3px solid rgba(111,214,189,0.2);border-top-color:var(--ad-teal, #6fd6bd);animation:playGamesConnectSpin 0.9s linear infinite;" aria-hidden="true"></div>' +
      '<div>Signing in through Google Play Games&hellip;</div>';
    document.body.appendChild(overlay);
    overlayTimeout = window.setTimeout(removeConnectOverlay, 12000);
  }

  function removeConnectOverlay() {
    if (overlayTimeout !== null) {
      window.clearTimeout(overlayTimeout);
      overlayTimeout = null;
    }
    document.getElementById('playGamesConnectOverlay')?.remove();
    delete document.documentElement.dataset.steamBoot;
  }
})();
