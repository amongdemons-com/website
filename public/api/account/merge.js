const express = require('express');
const db = require('../lib/db');
const { cleanPlayer, requireAuth } = require('../lib/auth');
const {
  cancelPendingAccountMerge,
  getAccountMergePreview,
  mergePlayerAccounts
} = require('../lib/account-merge');
const { checkRetroactive, pushUnsyncedToSteam } = require('../lib/achievements');

const router = express.Router();

router.get('/account/merge/:token', requireAuth, requireSteamSession, async (req, res) => {
  const preview = await getAccountMergePreview(req.params.token, req.player.id);
  res.set('Cache-Control', 'no-store');
  res.json({ preview });
});

router.post('/account/merge/:token', requireAuth, requireSteamSession, async (req, res) => {
  await mergePlayerAccounts(req.params.token, req.player.id);

  const [rows] = await db.query(
    `SELECT p.*, pd.image_url AS profile_demon_image_url
     FROM players p
     LEFT JOIN player_demons pd
       ON pd.id = p.profile_demon_id
      AND pd.player_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [req.player.id]
  );
  const player = rows[0];
  if (!player) return res.status(404).json({ error: 'The merged hunter could not be loaded.' });

  // Unioned achievements are deliberately marked unsynced by the transaction.
  // Re-evaluate state-derived achievements too, then mirror everything to the
  // surviving Steam identity before reporting success.
  await checkRetroactive(player);
  await pushUnsyncedToSteam(player.id);

  res.json({ merged: true, player: cleanPlayer(player) });
});

router.delete('/account/merge/:token', requireAuth, requireSteamSession, async (req, res) => {
  await cancelPendingAccountMerge(req.params.token, req.player.id);
  res.json({ cancelled: true });
});

function requireSteamSession(req, res, next) {
  if (req.authProvider !== 'steam') {
    return res.status(403).json({
      error: 'Account merging is only available when Settings is opened through Steam.'
    });
  }
  next();
}

module.exports = router;
module.exports._test = { requireSteamSession };
