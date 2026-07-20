const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, createSession } = require('../lib/auth');
const { findOrCreateOAuthPlayer } = require('../lib/oauth');
const { authenticateUserTicket, getPlayerSummary, isSteamConfigured } = require('../lib/steam');
const { checkRetroactive, pushUnsyncedToSteam } = require('../lib/achievements');

const router = express.Router();

// Silent sign-in for the Steam wrapper. The Electron shell obtains a session
// ticket from the running Steam client and the page posts it here; Valve
// verifies the ticket, so the SteamID is trusted with no password involved.
router.post('/auth/steam', async (req, res) => {
  if (!isSteamConfigured()) {
    return res.status(503).json({ error: 'Steam sign-in is not configured.' });
  }

  let verified;
  try {
    verified = await authenticateUserTicket(req.body?.ticket);
  } catch (error) {
    const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
    return res.status(status).json({ error: error.message || 'Steam sign-in failed.' });
  }

  // The ticket only proves the SteamID; the persona name needs a separate
  // profile lookup. Best-effort: sign-in proceeds unnamed if the lookup fails.
  let personaName = '';
  try {
    personaName = (await getPlayerSummary(verified.steamId))?.personaName || '';
  } catch (error) {
    personaName = '';
  }

  const currentPlayer = await getBearerPlayer(req);
  let player = await getPlayerLinkedToSteam(verified.steamId);

  if (!player && currentPlayer && !currentPlayer.is_guest) {
    // A signed-in (non-guest) account with no Steam link yet: link it in place
    // so existing web players keep their progress inside the wrapper.
    await db.query(
      `INSERT INTO player_oauth_accounts (player_id, provider, provider_user_id, email, display_name)
       VALUES (?, 'steam', ?, NULL, ?)`,
      [currentPlayer.id, verified.steamId, personaName || null]
    );
    player = currentPlayer;
  }

  if (!player) {
    // New Steam identity: adopt the current guest hunter if there is one,
    // otherwise create a fresh account keyed to the SteamID.
    player = await findOrCreateOAuthPlayer('steam', { id: verified.steamId, displayName: personaName }, {
      claimPlayerId: currentPlayer?.is_guest ? currentPlayer.id : null
    });
  }

  const token = await createSession(player.id);

  // Credit history on first link and flush any unlocks Steam has not seen yet.
  // Best-effort by design: sign-in must succeed even if Steam sync fails.
  await checkRetroactive(player);
  await pushUnsyncedToSteam(player.id);

  res.json({
    token,
    player: cleanPlayer(player),
    steamId: verified.steamId
  });
});

async function getBearerPlayer(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-player-token');
  if (!token) return null;

  const [rows] = await db.query(
    `SELECT p.*
     FROM player_sessions s
     INNER JOIN players p ON p.id = s.player_id
     WHERE s.token = ?
       AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
     LIMIT 1`,
    [token]
  );

  return rows[0] || null;
}

async function getPlayerLinkedToSteam(steamId) {
  const [rows] = await db.query(
    `SELECT p.*
     FROM player_oauth_accounts a
     INNER JOIN players p ON p.id = a.player_id
     WHERE a.provider = 'steam'
       AND a.provider_user_id = ?
     LIMIT 1`,
    [steamId]
  );

  return rows[0] || null;
}

module.exports = router;
