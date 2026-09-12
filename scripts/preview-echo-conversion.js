// Read-only preview. The schema migration applies the conversion on deployment.
const db = require('../public/api/lib/db');
const { getPlayerEchoConversion } = require('../public/api/lib/echo-conversion');

async function main() {
  const [players] = await db.query(`
    SELECT DISTINCT p.id AS playerId
    FROM players p
    INNER JOIN player_bag b ON b.player_id = p.id
    WHERE b.item_type = 'echo'
    ORDER BY p.id
  `);
  const report = [];
  for (const { playerId } of players) {
    const items = (await getPlayerEchoConversion(playerId)).filter(row => row.removed);
    if (items.length) report.push({ playerId, souls: items.reduce((total, row) => total + row.souls, 0), items });
  }
  console.log(JSON.stringify({
    players: report.length,
    echoesRemoved: report.flatMap(player => player.items).reduce((total, row) => total + row.removed, 0),
    souls: report.reduce((total, player) => total + player.souls, 0),
    report
  }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.end());
