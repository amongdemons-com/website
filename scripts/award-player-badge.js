const db = require('../public/api/lib/db');
const { initializeSchema } = require('../public/api/lib/schema');
const {
  awardPlayerBadge,
  getPlayerBadgeDefinition
} = require('../public/api/lib/player-badges');

function parseOptions(argv = process.argv.slice(2)) {
  const apply = argv.includes('--apply');
  const values = argv.filter((argument) => argument !== '--apply');
  const [badgeKey, ...usernames] = values;
  if (!badgeKey || !usernames.length) {
    throw new Error('Usage: npm run badge:award -- <badge-key> <username...> [--apply]');
  }
  const badge = getPlayerBadgeDefinition(badgeKey);
  if (!badge) throw new Error(`Unknown player badge: ${badgeKey}`);
  const uniqueUsernames = [...new Map(usernames.map((username) => (
    [String(username).toLowerCase(), String(username)]
  ))).values()];
  return { apply, badge, usernames: uniqueUsernames };
}

async function resolvePlayers(usernames, queryable = db) {
  const placeholders = usernames.map(() => '?').join(', ');
  const [rows] = await queryable.query(
    `SELECT id, username
     FROM players
     WHERE LOWER(username) IN (${placeholders})`,
    usernames.map((username) => username.toLowerCase())
  );
  const playersByName = new Map(rows.map((row) => [String(row.username).toLowerCase(), row]));
  const missing = usernames.filter((username) => !playersByName.has(username.toLowerCase()));
  if (missing.length) throw new Error(`Hunters not found: ${missing.join(', ')}`);
  return usernames.map((username) => playersByName.get(username.toLowerCase()));
}

async function awardBadge(options) {
  if (options.apply) await initializeSchema();
  const players = await resolvePlayers(options.usernames);
  if (!options.apply) return players;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    for (const player of players) {
      await awardPlayerBadge(player.id, options.badge.key, connection);
    }
    await connection.commit();
    return players;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function main() {
  const options = parseOptions();
  const players = await awardBadge(options);
  const action = options.apply ? 'Awarded' : 'Would award';
  console.log(`${action} ${options.badge.name} to ${players.map((player) => player.username).join(', ')}.`);
  if (!options.apply) console.log('Dry run complete. Add --apply to persist these awards.');
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}

module.exports = { awardBadge, parseOptions, resolvePlayers };
