// One-off migration: collapse inflated account XP down to the minimum XP for
// the level each player already reached. Levels never go down (players.level
// is left untouched and the normalized XP maps back to the same level), only
// banked progress toward the next level is removed.
//
// Usage:
//   node scripts/normalize-account-xp.js          # dry run, prints what would change
//   node scripts/normalize-account-xp.js --apply  # writes changes + backup log
//
// Every applied change is recorded in player_xp_normalization_log first, so
// old XP can be restored with:
//   UPDATE players p
//   INNER JOIN player_xp_normalization_log l ON l.player_id = p.id
//   SET p.xp = l.old_xp;

const db = require('../public/api/lib/db');
const {
  getAccountLevelForXp,
  getNormalizedAccountXp
} = require('../public/api/lib/progression');

const APPLY = process.argv.includes('--apply');

async function main() {
  const [players] = await db.query('SELECT id, xp, level FROM players');

  const changes = [];
  for (const player of players) {
    const oldXp = Math.max(0, Number(player.xp) || 0);
    const currentLevel = getAccountLevelForXp(oldXp);
    const normalizedXp = getNormalizedAccountXp(oldXp);

    // Only ever reduce XP, and never in a way that would change the level.
    if (normalizedXp >= oldXp) continue;
    if (getAccountLevelForXp(normalizedXp) !== currentLevel) {
      throw new Error(`Refusing to change level for player ${player.id} (xp ${oldXp} -> ${normalizedXp}).`);
    }

    changes.push({
      playerId: player.id,
      oldXp,
      newXp: normalizedXp,
      oldLevel: Math.max(1, Number(player.level) || 1),
      xpLevel: currentLevel
    });
  }

  const trimmedXp = changes.reduce((sum, change) => sum + (change.oldXp - change.newXp), 0);
  console.log(`${players.length} players scanned, ${changes.length} need normalization (${trimmedXp} XP trimmed total).`);
  changes.forEach((change) => {
    console.log(`  player ${change.playerId}: xp ${change.oldXp} -> ${change.newXp} (level ${change.oldLevel} kept)`);
  });

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply to write changes.');
    return;
  }

  if (!changes.length) {
    console.log('Nothing to apply.');
    return;
  }

  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();

    await connection.query(
      `CREATE TABLE IF NOT EXISTS player_xp_normalization_log (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        player_id INT NOT NULL,
        old_xp INT NOT NULL,
        new_xp INT NOT NULL,
        old_level INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_player (player_id)
      )`
    );

    let applied = 0;
    for (const change of changes) {
      // players.level is intentionally untouched: it is the source of truth for
      // earned skill points and only ever moves up via getNextAccountLevel().
      // The `xp = old` guard skips players whose XP moved since the scan (e.g.
      // a hunt settled mid-migration) instead of clobbering the new value.
      const [result] = await connection.query(
        'UPDATE players SET xp = ? WHERE id = ? AND xp = ?',
        [change.newXp, change.playerId, change.oldXp]
      );

      if (!result.affectedRows) {
        console.warn(`  player ${change.playerId}: xp changed since scan, skipped (re-run to normalize).`);
        continue;
      }

      await connection.query(
        `INSERT INTO player_xp_normalization_log (player_id, old_xp, new_xp, old_level)
         VALUES (?, ?, ?, ?)`,
        [change.playerId, change.oldXp, change.newXp, change.oldLevel]
      );
      applied += 1;
    }

    await connection.commit();
    committed = true;
    console.log(`Applied ${applied} of ${changes.length} normalizations. Backup rows written to player_xp_normalization_log.`);
  } catch (error) {
    if (!committed) {
      await connection.rollback();
    }
    throw error;
  } finally {
    connection.release();
  }
}

main()
  .then(() => db.end())
  .catch((error) => {
    console.error(error);
    return db.end().finally(() => process.exit(1));
  });
