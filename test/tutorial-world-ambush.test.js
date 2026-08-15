const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../public/api/lib/db');
const achievements = require('../public/api/lib/achievements');
const worldRouter = require('../public/api/world');
const { simulateWorldAmbush } = require('../public/api/lib/world-combat');
const demonTypes = require('../public/api/data/demon-types.json');
const worldMap = require('../public/api/data/map.json');

const { commitWorldTravel, isTutorialAmbushProtectionActive } = worldRouter._test;

test('ambush protection is limited to the active World travel tutorial checkpoint', () => {
  assert.equal(isTutorialAmbushProtectionActive({ status: 'in_progress', checkpoint: 'world-travel' }), true);
  assert.equal(isTutorialAmbushProtectionActive({ status: 'in_progress', checkpoint: 'world-team' }), false);
  assert.equal(isTutorialAmbushProtectionActive({ status: 'completed', checkpoint: 'complete' }), false);
  assert.equal(isTutorialAmbushProtectionActive(null), false);
  assert.equal(isTutorialAmbushProtectionActive(), false);
});

test('tutorial ambushes remain survivable for either minimum-stat starter demon', async () => {
  for (const typeId of [1, 2]) {
    const playerTeam = [createMinimumStarterDemon(typeId)];

    for (let seed = 1; seed <= 100; seed += 1) {
      const battle = await simulateWorldAmbush(
        { id: 'tutorial-player' },
        { x: 30, y: 30 },
        worldMap.encounters,
        {
          seed,
          tutorialProtected: true,
          context: {
            playerTeam,
            playerBuffs: { activeBuffs: [] },
            demonTypes
          }
        }
      );

      assert.equal(battle.winner, 'player', `starter type ${typeId} lost with seed ${seed}`);
      assert.equal(battle.enemyTeamBefore.length, 1);
      assert.equal(battle.encounter.terror.active, false);
    }
  }
});

test('World travel commits ambush rewards and position together', async () => {
  const calls = [];
  const originalGetConnection = db.getConnection;
  const originalCheckAccountLevel = achievements.checkAccountLevel;
  const player = createPlayer();
  const connection = createTravelConnection(calls, player);

  db.getConnection = async () => connection;
  achievements.checkAccountLevel = async (playerId, level) => {
    calls.push(`achievement:${playerId}:${level}`);
  };

  try {
    const result = await commitWorldTravel(player, { x: 2, y: -1 }, { xp: 7, souls: 1 });

    assert.equal(result.player.xp, 7);
    assert.equal(result.player.souls, 1);
    assert.deepEqual(calls, [
      'begin',
      'lock-player',
      'update-player',
      'read-player',
      'save-position:2,-1',
      'commit',
      'release',
      'achievement:tutorial-player:1'
    ]);
  } finally {
    db.getConnection = originalGetConnection;
    achievements.checkAccountLevel = originalCheckAccountLevel;
  }
});

test('World travel rolls back rewards when saving the position fails', async () => {
  const calls = [];
  const originalGetConnection = db.getConnection;
  const originalCheckAccountLevel = achievements.checkAccountLevel;
  const player = createPlayer();
  const connection = createTravelConnection(calls, player, { failPositionSave: true });

  db.getConnection = async () => connection;
  achievements.checkAccountLevel = async () => {
    calls.push('achievement');
  };

  try {
    await assert.rejects(
      commitWorldTravel(player, { x: 2, y: -1 }, { xp: 7, souls: 1 }),
      /position write failed/
    );
    assert.deepEqual(calls, [
      'begin',
      'lock-player',
      'update-player',
      'read-player',
      'save-position:2,-1',
      'rollback',
      'release'
    ]);
  } finally {
    db.getConnection = originalGetConnection;
    achievements.checkAccountLevel = originalCheckAccountLevel;
  }
});

function createMinimumStarterDemon(typeId) {
  const type = demonTypes[String(typeId)];
  const formationSlot = type.preferredPosition === 'front' ? 0 : 6;

  return {
    instanceId: `starter-${typeId}`,
    typeId,
    species: type.name,
    rarity: 'common',
    maxHp: type.baseStats.hp[0],
    hp: type.baseStats.hp[0],
    atk: type.baseStats.atk[0],
    speed: type.baseStats.speed[0],
    position: type.preferredPosition,
    formationSlot,
    formationRow: formationSlot,
    attackMeter: 0,
    statusEffects: { poison: [] }
  };
}

function createPlayer() {
  return {
    id: 'tutorial-player',
    username: 'TutorialPlayer',
    level: 1,
    xp: 0,
    souls: 0,
    unlocks: []
  };
}

function createTravelConnection(calls, player, options = {}) {
  const rawPlayer = {
    id: player.id,
    username: player.username,
    level: player.level,
    xp: player.xp,
    souls: player.souls,
    unlocks: '[]'
  };
  const updatedPlayer = {
    ...rawPlayer,
    xp: 7,
    souls: 1
  };

  return {
    async beginTransaction() {
      calls.push('begin');
    },
    async query(sql, params = []) {
      const statement = String(sql).replace(/\s+/g, ' ').trim();
      if (statement.includes('FOR UPDATE')) {
        calls.push('lock-player');
        return [[rawPlayer]];
      }
      if (statement.startsWith('UPDATE players SET xp')) {
        calls.push('update-player');
        return [{ affectedRows: 1 }];
      }
      if (statement.startsWith('SELECT * FROM players')) {
        calls.push('read-player');
        return [[updatedPlayer]];
      }
      if (statement.startsWith('INSERT INTO player_world_positions')) {
        calls.push(`save-position:${params[1]},${params[2]}`);
        if (options.failPositionSave) throw new Error('position write failed');
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${statement}`);
    },
    async commit() {
      calls.push('commit');
    },
    async rollback() {
      calls.push('rollback');
    },
    release() {
      calls.push('release');
    }
  };
}
