const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, createSession } = require('../lib/auth');
const { findOrCreateOAuthPlayer } = require('../lib/oauth');
const {
  exchangeServerAuthCode,
  getAuthenticatedPlayer,
  isPlayGamesConfigured,
  storeRefreshToken
} = require('../lib/play-games');
const { checkRetroactive, pushUnsyncedToPlayGames } = require('../lib/achievements');

const router = express.Router();

router.post('/auth/play-games', createPlayGamesAuthHandler());

function createPlayGamesAuthHandler(overrides = {}) {
  const dependencies = {
    checkRetroactive,
    cleanPlayer,
    createSession,
    db,
    exchangeServerAuthCode,
    findOrCreateOAuthPlayer,
    getAuthenticatedPlayer,
    getBearerPlayer,
    getPlayerLinkedToPlayGames,
    isPlayGamesConfigured,
    pushUnsyncedToPlayGames,
    storeRefreshToken,
    ...overrides
  };

  return async (req, res) => {
    if (!dependencies.isPlayGamesConfigured()) {
      return res.status(503).json({ error: 'Play Games sign-in is not configured.' });
    }

    let authorization;
    let profile;
    try {
      authorization = await dependencies.exchangeServerAuthCode(req.body?.code);
      profile = await dependencies.getAuthenticatedPlayer(authorization.accessToken);
    } catch (error) {
      const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502;
      return res.status(status).json({ error: error.message || 'Play Games sign-in failed.' });
    }

    const currentPlayer = await dependencies.getBearerPlayer(req, dependencies.db);
    let player = await dependencies.getPlayerLinkedToPlayGames(profile.id, dependencies.db);

    if (!player && currentPlayer && !currentPlayer.is_guest) {
      await dependencies.db.query(
        `INSERT INTO player_oauth_accounts (player_id, provider, provider_user_id, email, display_name)
         VALUES (?, 'play_games', ?, NULL, ?)`,
        [currentPlayer.id, profile.id, profile.displayName || null]
      );
      player = currentPlayer;
    }

    if (!player) {
      player = await dependencies.findOrCreateOAuthPlayer(
        'play_games',
        profile,
        { claimPlayerId: currentPlayer?.is_guest ? currentPlayer.id : null }
      );
    }

    await dependencies.storeRefreshToken(player.id, authorization.refreshToken, dependencies.db);
    const token = await dependencies.createSession(player.id, { authProvider: 'play_games' });

    // The game database is authoritative. Historical unlocks are evaluated
    // before the Google mirror is flushed, including achievements earned in a
    // normal browser before this Android launch.
    await dependencies.checkRetroactive(player);
    await dependencies.pushUnsyncedToPlayGames(player.id, {
      accessToken: authorization.accessToken
    });

    res.json({
      token,
      player: dependencies.cleanPlayer(player),
      playGamesPlayerId: profile.id
    });
  };
}

async function getBearerPlayer(req, queryable = db) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.get('x-player-token');
  if (!token) return null;

  const [rows] = await queryable.query(
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

async function getPlayerLinkedToPlayGames(playerId, queryable = db) {
  const [rows] = await queryable.query(
    `SELECT p.*
     FROM player_oauth_accounts a
     INNER JOIN players p ON p.id = a.player_id
     WHERE a.provider = 'play_games'
       AND a.provider_user_id = ?
     LIMIT 1`,
    [playerId]
  );
  return rows[0] || null;
}

module.exports = router;
module.exports._test = { createPlayGamesAuthHandler };
