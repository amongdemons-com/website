const db = require('./db');
const { ECHO_SOUL_PRICES, SUMMON_REQUIREMENTS, parseEchoItemKey } = require('./echo-config');
const { lockEchoPlayer } = require('./echo-bag');

function planEchoConversion(rows, ownedDemons) {
  const owned = new Set(ownedDemons.map(row => `${Number(row.typeId)}:${row.rarity}`));
  return rows.map(row => {
    const echo = parseEchoItemKey(row.itemKey);
    if (!echo || !echo.typeId) throw new Error(`Invalid Echo key: ${row.itemKey}`);
    const quantity = Math.max(0, Number(row.quantity) || 0);
    const retained = owned.has(`${echo.typeId}:${echo.rarity}`) ? 0 : Math.min(quantity, SUMMON_REQUIREMENTS[echo.rarity]);
    const removed = quantity - retained;
    return { itemKey: row.itemKey, quantity, retained, removed, souls: removed * ECHO_SOUL_PRICES[echo.rarity] };
  });
}

async function getPlayerEchoConversion(playerId, queryable = db) {
  const [rows] = await queryable.query(
    "SELECT item_key AS itemKey, quantity FROM player_bag WHERE player_id = ? AND item_type = 'echo'",
    [playerId]
  );
  const [owned] = await queryable.query(
    'SELECT type_id AS typeId, rarity FROM player_demons WHERE player_id = ?', [playerId]
  );
  return planEchoConversion(rows, owned);
}

// Caller owns the transaction. Quantity changes and compensation commit together;
// after a successful run, recomputing this plan yields no further compensation.
async function convertPlayerExcessEchoes(playerId, connection, options = {}) {
  try {
    await lockEchoPlayer(playerId, connection);
  } catch (error) {
    // A hunter can be deleted after the migration's candidate query. Keep this
    // exception local to the migration; gameplay and account merges stay strict.
    if (options.skipMissingPlayer && error.status === 404) return null;
    throw error;
  }
  const plan = await getPlayerEchoConversion(playerId, connection);
  const souls = plan.reduce((total, row) => total + row.souls, 0);
  for (const row of plan) {
    if (!row.retained) {
      await connection.query('DELETE FROM player_bag WHERE player_id = ? AND item_key = ?', [playerId, row.itemKey]);
    } else if (row.removed) {
      await connection.query(
        'UPDATE player_bag SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE player_id = ? AND item_key = ?',
        [row.retained, playerId, row.itemKey]
      );
    }
  }
  if (souls) await connection.query('UPDATE players SET souls = souls + ? WHERE id = ?', [souls, playerId]);
  return { playerId, echoesRemoved: plan.reduce((total, row) => total + row.removed, 0), souls };
}

async function convertLegacyEchoes() {
  const [players] = await db.query(`
    SELECT DISTINCT p.id AS playerId
    FROM players p
    INNER JOIN player_bag b ON b.player_id = p.id
    WHERE b.item_type = 'echo'
    ORDER BY p.id
  `);
  const summary = { players: 0, echoesRemoved: 0, souls: 0 };
  for (const { playerId } of players) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      const result = await convertPlayerExcessEchoes(playerId, connection, { skipMissingPlayer: true });
      if (!result) {
        await connection.rollback();
        continue;
      }
      await connection.commit();
      if (result.echoesRemoved) summary.players += 1;
      summary.echoesRemoved += result.echoesRemoved;
      summary.souls += result.souls;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  console.log('Collection Echo conversion:', summary);
  return summary;
}

module.exports = { planEchoConversion, getPlayerEchoConversion, convertPlayerExcessEchoes, convertLegacyEchoes };
