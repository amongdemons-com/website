// Steam wrapper integration. Only active inside the Electron shell, which
// exposes window.steamBridge from its preload script. Signs the player in
// silently with a Steam session ticket and mirrors server-side achievement
// unlocks to the local Steam client so the overlay toast fires.
(function() {
  'use strict';

  const TOAST_SYNC_DELAY_MS = 4000;

  if (!window.steamBridge || typeof window.steamBridge.getAuthTicket !== 'function') return;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  async function init() {
    const AD = window.AmongDemons;
    if (!AD?.api) return;

    try {
      const ticket = await window.steamBridge.getAuthTicket();
      if (!ticket) return;

      const previousPlayerId = AD.getPlayer()?.id || null;
      const payload = await AD.api('/api/auth/steam', {
        method: 'POST',
        body: { ticket }
      });

      AD.setSession({ token: payload.token, player: payload.player });

      // Reload only when the signed-in hunter actually changed, so the page
      // reflects the Steam account without looping on every boot.
      if (previousPlayerId !== payload.player.id) {
        window.location.reload();
        return;
      }
    } catch (error) {
      console.warn('Steam sign-in unavailable:', error);
    }

    setTimeout(syncAchievementToasts, TOAST_SYNC_DELAY_MS);
  }

  // Server-side unlocks (via the Steam Web API) are authoritative; activating
  // the same achievement locally is a no-op for already-seen unlocks and shows
  // the instant overlay toast for fresh ones.
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
    } catch (error) {
      // Toast mirroring is cosmetic; never surface errors for it.
    }
  }
})();
