const crypto = require('node:crypto');
const db = require('../public/api/lib/db');
const { hashPassword } = require('../public/api/lib/auth');
const { addEcho } = require('../public/api/lib/echo-bag');
const { saveCollectionDemon } = require('../public/api/lib/collection-demons');
const { createDemon } = require('../public/api/lib/demon-factory');
const { createRng } = require('../public/api/lib/rng');
const { FEATURE_TEST_ACCOUNT_ID_PREFIX } = require('../public/api/lib/system-players');
const { assertValidUsername } = require('../public/api/lib/usernames');

const APPLY_FLAG = '--apply';
const TEST_SOULS = 100_000;
const MYTHIC_ECHOES_PER_TYPE = 3;
const RARITIES = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']);
const TYPE_IDS = Object.freeze(Array.from({ length: 11 }, (_, index) => index + 1));
const TEAM_SLOTS = Object.freeze([
  [8, 0],
  [9, 1],
  [5, 2],
  [4, 6],
  [10, 7],
  [11, 8]
]);

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    console.log(`Dry run: would create one leaderboard-excluded feature test account. Re-run with ${APPLY_FLAG} to apply.`);
    return;
  }

  const username = assertValidUsername(createUsername());
  const password = `${crypto.randomBytes(12).toString('base64url')}!7`;
  const playerId = `${FEATURE_TEST_ACCOUNT_ID_PREFIX}${crypto.randomUUID()}`;
  const { salt, hash } = hashPassword(password);
  const connection = await db.getConnection();
  let committed = false;

  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      'SELECT id FROM players WHERE username = ? LIMIT 1 FOR UPDATE',
      [username]
    );
    if (existingRows.length) throw new Error(`Username ${username} already exists; no account was created.`);

    await connection.query(
      `INSERT INTO players
        (id, username, email, password_hash, password_salt, password_login_enabled,
         level, xp, souls, highest_floor, pvp_wins, pvp_losses, unlocks, is_guest)
       VALUES (?, ?, NULL, ?, ?, 1, 1, 0, ?, 0, 0, 0, '[]', 0)`,
      [playerId, username, hash, salt, TEST_SOULS]
    );
    await connection.query(
      `INSERT INTO player_world_positions (player_id, x, y)
       VALUES (?, 4, 0)
       ON DUPLICATE KEY UPDATE x = VALUES(x), y = VALUES(y)`,
      [playerId]
    );
    await connection.query(
      `INSERT INTO player_bound_world_shrines (player_id, x, y)
       VALUES (?, 0, 0)
       ON DUPLICATE KEY UPDATE x = VALUES(x), y = VALUES(y)`,
      [playerId]
    );
    await connection.query(
      `INSERT INTO player_tutorials
        (player_id, tutorial_key, version, status, checkpoint, skipped_at,
         summon_guide_completed, training_guide_completed,
         skill_tree_guide_pending, skill_tree_guide_completed)
       VALUES (?, 'core-onboarding', 3, 'skipped', 'complete', CURRENT_TIMESTAMP, 1, 1, 0, 1)`,
      [playerId]
    );

    const mythicDemons = new Map();
    for (const typeId of TYPE_IDS) {
      for (const rarity of RARITIES) {
        const demon = await createDemon(createRng(0x5a170000 ^ (typeId * 97) ^ rarity.length), {
          typeId,
          rarity
        });
        const saved = await saveCollectionDemon(playerId, demon, connection);
        if (rarity === 'mythic') mythicDemons.set(typeId, saved.demon.id);
      }
      for (let quantity = 0; quantity < MYTHIC_ECHOES_PER_TYPE; quantity += 1) {
        await addEcho(playerId, { typeId, rarity: 'mythic' }, {
          queryable: connection,
          natural: true
        });
      }
    }

    for (const [typeId, formationSlot] of TEAM_SLOTS) {
      const demonId = mythicDemons.get(typeId);
      if (!demonId) throw new Error(`Mythic collection demon ${typeId} was not created.`);
      await connection.query(
        `INSERT INTO player_world_teams (player_id, demon_id, formation_slot)
         VALUES (?, ?, ?)`,
        [playerId, demonId, formationSlot]
      );
    }

    await connection.commit();
    committed = true;

    const [[verification]] = await connection.query(
      `SELECT p.level,
              p.xp,
              p.souls,
              (SELECT COUNT(*) FROM player_demons pd WHERE pd.player_id = p.id) AS collectionSlots,
              (SELECT COALESCE(SUM(pb.quantity), 0)
                 FROM player_bag pb
                WHERE pb.player_id = p.id AND pb.item_type = 'echo'
                  AND pb.item_key LIKE 'echo:%:mythic') AS mythicEchoes,
              (SELECT COUNT(*) FROM player_world_teams pwt WHERE pwt.player_id = p.id) AS teamSize
       FROM players p
       WHERE p.id = ?`,
      [playerId]
    );
    if (
      Number(verification?.level) !== 1 ||
      Number(verification?.xp) !== 0 ||
      Number(verification?.collectionSlots) !== TYPE_IDS.length * RARITIES.length ||
      Number(verification?.mythicEchoes) !== TYPE_IDS.length * MYTHIC_ECHOES_PER_TYPE ||
      Number(verification?.teamSize) !== TEAM_SLOTS.length
    ) {
      throw new Error('The account was created, but its verification did not match the requested test setup.');
    }

    console.log(JSON.stringify({
      username,
      password,
      playerId,
      level: Number(verification.level),
      xp: Number(verification.xp),
      souls: Number(verification.souls),
      skillTreePoints: 666,
      collectionSlots: Number(verification.collectionSlots),
      mythicEchoes: Number(verification.mythicEchoes),
      teamSize: Number(verification.teamSize),
      worldPosition: [4, 0],
      excludedFromLeaderboards: playerId.startsWith('ranked-bot:')
    }, null, 2));
  } catch (error) {
    if (!committed) await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await db.end();
  }
}

function createUsername() {
  const now = new Date();
  const stamp = [
    String(now.getUTCFullYear()).slice(-2),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
    String(now.getUTCHours()).padStart(2, '0'),
    String(now.getUTCMinutes()).padStart(2, '0'),
    String(now.getUTCSeconds()).padStart(2, '0')
  ].join('');
  return `AnomalyQA${stamp}`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
