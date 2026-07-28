const express = require('express');
const db = require('../lib/db');
const {
  blockGuests,
  hashPassword,
  requireAuth,
  verifyPassword
} = require('../lib/auth');
const {
  cancelAccountDeletion,
  scheduleAccountDeletion
} = require('../lib/account-deletion');
const {
  getProviderStatuses,
  isSupportedProvider
} = require('../lib/oauth');

const router = express.Router();
const PASSWORD_MIN_LENGTH = 6;
const PASSWORD_MAX_LENGTH = 256;

router.get('/account/security', requireAuth, blockGuests, async (req, res) => {
  const [rows] = await db.query(
    `SELECT provider, email, display_name
     FROM player_oauth_accounts
     WHERE player_id = ?
       AND provider IN ("google", "discord")`,
    [req.player.id]
  );
  const connectedByProvider = new Map(rows.map((row) => [row.provider, row]));

  res.json({
    hasPassword: req.player.hasPassword,
    deletionRequestedAt: req.player.deletionRequestedAt,
    deletionScheduledFor: req.player.deletionScheduledFor,
    providers: getProviderStatuses().map((provider) => {
      const connection = connectedByProvider.get(provider.id);
      return {
        ...provider,
        connected: Boolean(connection),
        email: connection?.email || null,
        displayName: connection?.display_name || null
      };
    })
  });
});

router.delete('/account/oauth/:provider', requireAuth, blockGuests, async (req, res) => {
  const provider = normalizeProvider(req.params.provider);
  if (!provider) {
    return res.status(404).json({ error: 'Unsupported account provider.' });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [playerRows] = await connection.query(
      'SELECT password_login_enabled FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
      [req.player.id]
    );
    const [providerRows] = await connection.query(
      `SELECT id
       FROM player_oauth_accounts
       WHERE player_id = ?
         AND provider = ?
       FOR UPDATE`,
      [req.player.id, provider]
    );

    if (!providerRows.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'That account is not connected.' });
    }

    const [otherRows] = await connection.query(
      `SELECT id
       FROM player_oauth_accounts
       WHERE player_id = ?
         AND provider <> ?
       LIMIT 1
       FOR UPDATE`,
      [req.player.id, provider]
    );
    const hasPassword = Boolean(Number(playerRows[0]?.password_login_enabled) || 0);
    if (!hasPassword && !otherRows.length) {
      await connection.rollback();
      return res.status(409).json({
        error: 'Add a password or connect another account before disconnecting your only sign-in method.'
      });
    }

    await connection.query(
      'DELETE FROM player_oauth_accounts WHERE player_id = ? AND provider = ?',
      [req.player.id, provider]
    );
    await connection.commit();
    res.json({ disconnected: true, provider });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

router.put('/account/password', requireAuth, blockGuests, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');

  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.` });
  }
  if (newPassword.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.` });
  }

  const [rows] = await db.query(
    `SELECT password_hash, password_salt, password_login_enabled
     FROM players
     WHERE id = ?
     LIMIT 1`,
    [req.player.id]
  );
  const player = rows[0];
  if (!player) return res.status(404).json({ error: 'Account not found.' });

  if (Number(player.password_login_enabled) === 1) {
    if (!currentPassword || !verifyPassword(currentPassword, player.password_salt, player.password_hash)) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }
  }

  const { salt, hash } = hashPassword(newPassword);
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE players
       SET password_hash = ?,
           password_salt = ?,
           password_login_enabled = 1
       WHERE id = ?`,
      [hash, salt, req.player.id]
    );
    await connection.query(
      'DELETE FROM player_sessions WHERE player_id = ? AND token <> ?',
      [req.player.id, req.token]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  res.json({ changed: true, hasPassword: true });
});

router.post('/account/deletion', requireAuth, blockGuests, async (req, res) => {
  const confirmation = String(req.body.confirmation || '').trim();
  const currentPassword = String(req.body.currentPassword || '');

  if (confirmation !== req.player.username) {
    return res.status(400).json({ error: 'Enter your exact username to schedule deletion.' });
  }

  const [rows] = await db.query(
    `SELECT password_hash, password_salt, password_login_enabled,
            deletion_requested_at, deletion_scheduled_for
     FROM players
     WHERE id = ?
     LIMIT 1`,
    [req.player.id]
  );
  const player = rows[0];
  if (!player) return res.status(404).json({ error: 'Account not found.' });

  if (player.deletion_scheduled_for) {
    return res.status(409).json({
      error: 'Account deletion is already scheduled.',
      deletionRequestedAt: player.deletion_requested_at,
      deletionScheduledFor: player.deletion_scheduled_for
    });
  }

  if (Number(player.password_login_enabled) === 1 &&
      (!currentPassword || !verifyPassword(currentPassword, player.password_salt, player.password_hash))) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const deletion = await scheduleAccountDeletion(req.player.id);
  res.status(202).json({
    scheduled: true,
    deletionRequestedAt: deletion.deletion_requested_at,
    deletionScheduledFor: deletion.deletion_scheduled_for
  });
});

router.delete('/account/deletion', requireAuth, blockGuests, async (req, res) => {
  const cancelled = await cancelAccountDeletion(req.player.id);
  if (!cancelled) {
    return res.status(409).json({ error: 'There is no pending account deletion to cancel.' });
  }

  res.json({ cancelled: true });
});

function normalizeProvider(value) {
  const provider = String(value || '').trim().toLowerCase();
  return isSupportedProvider(provider) ? provider : '';
}

module.exports = router;
