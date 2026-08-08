const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const {
  DUNGEON_RANKED_SNAPSHOT_VERSION,
  DUNGEON_RANKED_RATING_RANGE,
  DUNGEON_RANKED_ESCAPE_CHANCE,
  createDungeonRankedSnapshotPayload,
  didDungeonRankedEscape,
  getDungeonRankedLiveOpponentRank,
  getDungeonRankedRatingDelta,
  isDungeonRankedFloor,
  namespaceDungeonRankedOpponentTeam,
  prepareNextDungeonRankedEncounter,
  selectDungeonRankedOpponent,
  serializeDungeonRankedEncounter
} = require('../public/api/lib/dungeon-ranked');
const { advanceDungeonFloor } = require('../public/api/lib/dungeon-progression');
const { serializeRun } = require('../public/api/lib/run-serialization');

test('Ranked dungeon checkpoints replace the normal encounter on floor 30 and every five floors', () => {
  assert.equal(isDungeonRankedFloor(29), false);
  assert.equal(isDungeonRankedFloor(30), true);
  assert.equal(isDungeonRankedFloor(34), false);
  assert.equal(isDungeonRankedFloor(35), true);
  assert.equal(isDungeonRankedFloor(40), true);
  assert.equal(isDungeonRankedFloor(41), false);
});

test('Dungeon progression offers a Ranked rival immediately on the destination checkpoint floor', async () => {
  const encounter = { status: 'choice', floor: 30 };
  const run = {
    id: 'run-a',
    playerId: 'player-a',
    seed: 17,
    status: 'active',
    floor: 29,
    state: {
      currentFloor: 29,
      team: [{ instanceId: 'demon-a', maxHp: 100, hp: 40, atk: 20, speed: 10 }],
      buffs: { active: [], pendingChoices: [], temporary: [] }
    }
  };
  let preparedFloor = null;

  const result = await advanceDungeonFloor(run, { level: 12 }, {
    async prepareRankedEncounter(candidateRun) {
      preparedFloor = candidateRun.floor;
      candidateRun.state.enemies = [{ instanceId: 'ranked-enemy-a' }];
      candidateRun.state.rankedEncounter = encounter;
      return encounter;
    }
  });

  assert.equal(preparedFloor, 30);
  assert.equal(run.floor, 30);
  assert.equal(run.state.currentFloor, 30);
  assert.deepEqual(result.rankedEncounter, encounter);
  assert.equal(run.state.enemies[0].instanceId, 'ranked-enemy-a');
});

test('floor 30 snapshot discovery is reserved while floor 29 preparation is still visible', async () => {
  const run = createFloorTwentyNineRun();
  run.state.enemies = [{ instanceId: 'defeated-floor-29-enemy' }];
  const queries = [];
  const queryable = createRankedPreparationQueryable({ queries });

  const pending = await prepareNextDungeonRankedEncounter(
    run,
    { level: 12, username: 'Player' },
    queryable,
    { random: () => 0 }
  );

  assert.equal(run.floor, 29);
  assert.equal(run.state.currentFloor, 29);
  assert.equal(pending.floor, 30);
  assert.equal(pending.opponent.hunterName, 'Rival');
  assert.equal(pending.playerLevel, 12);
  assert.equal(pending.playerRating, 1100);
  assert.match(pending.enemyTeam[0].instanceId, /^ranked-enemy-/);
  const reservedEnemyId = pending.enemyTeam[0].instanceId;
  assert.equal(run.state.enemies[0].instanceId, 'defeated-floor-29-enemy');
  assert.equal(queries.some(({ sql }) => sql.includes('INSERT INTO dungeon_ranked_snapshots')), false);

  const serialized = await serializeRun(run, {
    playerLevel: 12,
    worldBuffs: [],
    queryable
  });
  assert.equal(serialized.nextRankedEncounter.opponent.hunterName, 'Rival');
  assert.equal(serialized.nextEnemyPressure, null);
  assert.equal(serialized.nextEnemies[0].instanceId, reservedEnemyId);

  // Reservations created by the first preview implementation omitted these
  // internal fields. Promotion must recover them so already-saved runs work.
  delete run.state.nextRankedEncounter.playerLevel;
  delete run.state.nextRankedEncounter.playerRating;

  const result = await advanceDungeonFloor(run, { level: 12, username: 'Player' }, {
    queryable,
    playerCombatBuffs: { activeBuffs: [] }
  });

  assert.equal(run.floor, 30);
  assert.equal(result.rankedEncounter.opponent.hunterName, 'Rival');
  assert.equal(run.state.enemies[0].instanceId, reservedEnemyId);
  assert.equal(run.state.nextRankedEncounter, undefined);
  assert.equal(queries.filter(({ sql }) => sql.includes('FROM dungeon_ranked_snapshots snapshots')).length, 1);
  assert.equal(queries.filter(({ sql }) => sql.includes('INSERT INTO dungeon_ranked_snapshots')).length, 1);
});

test('a no-snapshot preview remains a normal floor after the player continues', async () => {
  const run = createFloorTwentyNineRun();
  const queries = [];
  const queryable = createRankedPreparationQueryable({ queries, opponent: null });

  const pending = await prepareNextDungeonRankedEncounter(run, { level: 12 }, queryable);
  assert.equal(pending, null);
  assert.equal(run.state.nextRankedEncounter.status, 'none');

  let lateDiscoveryAttempted = false;
  const result = await advanceDungeonFloor(run, { level: 12 }, {
    queryable,
    playerCombatBuffs: { activeBuffs: [] },
    async prepareRankedEncounter() {
      lateDiscoveryAttempted = true;
      return { status: 'choice', floor: 30 };
    },
    async createEnemies() {
      return [{ instanceId: 'normal-floor-30-enemy' }];
    }
  });

  assert.equal(lateDiscoveryAttempted, false);
  assert.equal(result.rankedEncounter, null);
  assert.equal(run.state.enemies[0].instanceId, 'normal-floor-30-enemy');
  assert.equal(run.state.rankedEncounter, undefined);
  assert.equal(run.state.nextRankedEncounter, undefined);
});

test('Ranked dungeon snapshots preserve the exact team and active build buffs', () => {
  const run = {
    id: 'run-a',
    seed: 17,
    floor: 35,
    state: {
      team: [{ instanceId: 'demon-a', formationSlot: 2, hp: 120, atk: 44 }]
    }
  };
  const buffs = {
    active: ['blood_pact'],
    activeBuffs: [{ id: 'skill_force', effects: [{ type: 'attack_flat', value: 5 }] }]
  };

  const snapshot = createDungeonRankedSnapshotPayload(run, {
    playerLevel: 12,
    rating: 1100,
    buffs
  });

  assert.deepEqual(snapshot.team, run.state.team);
  assert.notEqual(snapshot.team, run.state.team);
  assert.equal(snapshot.floor, 35);
  assert.equal(snapshot.playerLevel, 12);
  assert.equal(snapshot.division, 'Bronze I');
  assert.deepEqual(snapshot.buffs.active, ['blood_pact']);
  assert.equal(snapshot.buffs.activeBuffs.some((buff) => buff.id === 'skill_force'), true);
});

test('opponent formations mirror their exact player-side slots', () => {
  const opponent = namespaceDungeonRankedOpponentTeam([
    { instanceId: 'front', formationSlot: 2, position: 'front' },
    { instanceId: 'back', formationSlot: 0, position: 'back' }
  ], 'snapshot-a');

  assert.equal(opponent[0].formationSlot, 0);
  assert.equal(opponent[0].position, 'front');
  assert.equal(opponent[1].formationSlot, 2);
  assert.equal(opponent[1].position, 'back');
  assert.match(opponent[0].instanceId, /^ranked-enemy-/);
});

test('equal-RP Ranked encounters use a 32-point Elo result', () => {
  assert.equal(getDungeonRankedRatingDelta('player', 1000, 1000), 16);
  assert.equal(getDungeonRankedRatingDelta('enemy', 1000, 1000), -16);
  assert.ok(getDungeonRankedRatingDelta('player', 1000, 1400) > 16);
  assert.ok(getDungeonRankedRatingDelta('enemy', 1000, 1400) > -16);
});

test('Ranked dungeon escape attempts have a 70% server-side success chance', () => {
  assert.equal(DUNGEON_RANKED_ESCAPE_CHANCE, 0.7);
  assert.equal(didDungeonRankedEscape(() => 0), true);
  assert.equal(didDungeonRankedEscape(() => 0.699999), true);
  assert.equal(didDungeonRankedEscape(() => 0.7), false);
  assert.equal(didDungeonRankedEscape(() => 0.999999), false);
});

test('snapshot matchmaking uses capture-time RP instead of the opponent current RP', async () => {
  let receivedParams;
  const queryable = {
    async query(sql, params) {
      assert.match(sql, /player_level BETWEEN \? AND \?/);
      assert.match(sql, /snapshots\.rating BETWEEN \? AND \?/);
      assert.doesNotMatch(sql, /JOIN ranked_ratings/);
      receivedParams = params;
      return [[{
        id: 'snapshot-b',
        player_id: 'player-b',
        hunter_name: 'Rival',
        player_level: 15,
        rating: 1250,
        current_rating: 3500,
        previously_served: null,
        snapshot: JSON.stringify({
          snapshotVersion: DUNGEON_RANKED_SNAPSHOT_VERSION,
          team: [{ instanceId: 'rival-demon', formationSlot: 2 }],
          buffs: { active: ['shared_pain'] }
        })
      }]];
    }
  };

  const opponent = await selectDungeonRankedOpponent({
    playerId: 'player-a',
    seasonId: 'season-a',
    floor: 35,
    playerLevel: 12,
    playerRating: 1100
  }, queryable, { random: () => 0 });

  assert.equal(receivedParams[6], 7);
  assert.equal(receivedParams[7], 17);
  assert.equal(receivedParams[8], 1100 - DUNGEON_RANKED_RATING_RANGE);
  assert.equal(receivedParams[9], 1100 + DUNGEON_RANKED_RATING_RANGE);
  assert.equal(opponent.hunterName, 'Rival');
  assert.equal(opponent.division, 'Silver III');
  assert.deepEqual(opponent.buffs.active, ['shared_pain']);
});

test('missing eligible snapshots return no Ranked encounter', async () => {
  const opponent = await selectDungeonRankedOpponent({
    playerId: 'player-a',
    seasonId: 'season-a',
    floor: 35,
    playerLevel: 12
  }, { async query() { return [[]]; } });

  assert.equal(opponent, null);
});

test('ranked encounter identity exposes live rank without changing snapshot RP', async () => {
  const encounter = {
    status: 'choice',
    floor: 35,
    seasonId: 'season-a',
    opponent: {
      playerId: 'player-b',
      hunterName: 'Rival',
      rating: 1250,
      division: 'Silver III'
    }
  };
  const liveOpponentRank = await getDungeonRankedLiveOpponentRank(encounter, {
    async query() {
      return [[{
        rating: 3500,
        highest_floor: 50,
        victories: 10,
        runs_played: 12
      }]];
    }
  });
  const serialized = serializeDungeonRankedEncounter(encounter, { liveOpponentRank });

  assert.equal(serialized.opponent.rating, 1250);
  assert.equal(serialized.opponent.division, 'Silver III');
  assert.equal(serialized.opponent.liveRating, 3500);
  assert.equal(serialized.opponent.liveDivision, 'Diamond I');
});

test('ranked encounter identity shows Unranked when the opponent has no live rating', async () => {
  const encounter = {
    status: 'choice',
    floor: 30,
    seasonId: 'season-a',
    opponent: { playerId: 'player-b', rating: 1000, division: 'Bronze II' }
  };
  const liveOpponentRank = await getDungeonRankedLiveOpponentRank(
    encounter,
    { async query() { return [[]]; } }
  );
  const serialized = serializeDungeonRankedEncounter(encounter, { liveOpponentRank });

  assert.equal(serialized.opponent.rating, 1000);
  assert.equal(serialized.opponent.liveRating, null);
  assert.equal(serialized.opponent.liveDivision, 'Unranked');
});

test('Dungeon UI contains the Ranked checkpoint identity, glimmer, and result flow', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'app', 'dungeon.html'), 'utf8');
  const styles = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'battle.css'), 'utf8');
  const rankedUi = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'ranked.js'), 'utf8');
  const lifecycle = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'lifecycle.js'), 'utf8');
  const dungeonRender = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'render.js'), 'utf8');
  const battleApi = fs.readFileSync(path.join(ROOT, 'public', 'api', 'runs', 'battle.js'), 'utf8');
  const rankedApi = fs.readFileSync(path.join(ROOT, 'public', 'api', 'runs', 'ranked.js'), 'utf8');

  assert.match(html, /id="dungeonRankedResultModal"/);
  assert.match(html, /id="dungeonRankedChoiceModal"/);
  assert.match(html, /id="dungeonRankedChoiceFightBtn"/);
  assert.match(html, /id="dungeonRankedChoiceEscapeBtn"/);
  assert.match(html, /id="dungeonRankedChoiceEscapeBtn"[\s\S]*id="dungeonRankedChoiceChance"/);
  assert.match(html, /70% chance/);
  assert.match(html, /rank-divisions\.css/);
  assert.match(styles, /dungeon-ranked-grid-glimmer/);
  assert.match(styles, /dungeon-ranked-choice-modal/);
  assert.match(styles, /dungeon-ranked-choice-escape-btn small/);
  assert.match(styles, /is-ranked-encounter-planning #enemyGrid \.battle-formation-grid::before/);
  assert.match(styles, /rgba\(226, 80, 65, 0\.42\)/);
  assert.match(rankedUi, /dungeon-ranked-opponent-name/);
  assert.match(rankedUi, /opponent\.liveDivision \|\| opponent\.division/);
  assert.match(rankedUi, /rank-division-text--/);
  assert.match(rankedUi, /ranked\/continue/);
  assert.match(rankedUi, /ranked\/escape/);
  assert.match(rankedUi, /openDungeonRankedChoice/);
  assert.match(rankedUi, /nextRankedEncounter/);
  assert.match(lifecycle, /isDungeonRankedPlanning\(state\.run\)[\s\S]*?openDungeonRankedChoice\(\)/);
  assert.match(lifecycle, /Choose your next move\.[\s\S]*?openDungeonRankedChoice\(\)/);
  assert.match(dungeonRender, /state\.run\?\.nextRankedEncounter\?\.status === 'choice'/);
  assert.match(dungeonRender, /isRankedChoice: canContinueIntoRankedChoice/);
  assert.match(battleApi, /prepareNextDungeonRankedEncounter\(run, req\.player\)/);
  assert.match(rankedApi, /ranked\/escape/);
  assert.match(rankedApi, /applyDungeonRankedRatingResult\(run, 'enemy', connection\)/);
  assert.match(rankedApi, /skipRankedEncounter: true/);
});

function createFloorTwentyNineRun() {
  return {
    id: 'run-a',
    playerId: 'player-a',
    seed: 17,
    status: 'active',
    floor: 29,
    rewards: [],
    state: {
      currentFloor: 29,
      team: [{ instanceId: 'demon-a', maxHp: 100, hp: 40, atk: 20, speed: 10 }],
      enemies: [],
      awaitingRecruit: true,
      buffs: { active: [], pendingChoices: [], temporary: [] }
    }
  };
}

function createRankedPreparationQueryable({ queries = [], opponent } = {}) {
  const snapshot = opponent === null ? null : {
    id: 'snapshot-b',
    player_id: 'player-b',
    hunter_name: 'Rival',
    player_level: 12,
    rating: 1100,
    previously_served: null,
    snapshot: JSON.stringify({
      snapshotVersion: DUNGEON_RANKED_SNAPSHOT_VERSION,
      team: [{ instanceId: 'rival-demon', formationSlot: 2, maxHp: 100, hp: 100, atk: 20, speed: 10 }],
      buffs: { active: [] }
    })
  };

  return {
    async query(sql, params) {
      if ((params || []).some((value) => value === undefined)) {
        throw new Error('Bind parameters must not contain undefined');
      }
      queries.push({ sql, params });
      if (sql.includes('SELECT *') && sql.includes('FROM ranked_ratings')) {
        return [[{ rating: 1100, highest_floor: 30, victories: 1, runs_played: 1 }]];
      }
      if (sql.includes('FROM dungeon_ranked_snapshots snapshots')) {
        return [snapshot ? [snapshot] : []];
      }
      return [{ affectedRows: 1 }];
    }
  };
}

test('the standalone Ranked mode is retired while its old page redirects to Dungeon', () => {
  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  const apiIndex = fs.readFileSync(path.join(ROOT, 'public', 'api', 'index.js'), 'utf8');
  const manifest = fs.readFileSync(path.join(ROOT, 'public', 'app', 'dist', 'manifest.json'), 'utf8');

  assert.match(server, /app\.get\(\['\/ranked', '\/ranked\/'\][\s\S]*?redirect\(301, '\/dungeon'\)/);
  assert.doesNotMatch(apiIndex, /require\('\.\/ranked'\)/);
  assert.equal(fs.existsSync(path.join(ROOT, 'public', 'app', 'ranked.html')), false);
  assert.doesNotMatch(manifest, /ranked\.bundle/);
});

test('deployment performs the requested one-time Ranked fresh start', () => {
  const schema = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'schema.js'), 'utf8');

  assert.match(schema, /20260808_ranked_fresh_start_v1/);
  for (const table of [
    'dungeon_ranked_history',
    'dungeon_ranked_snapshots',
    'ranked_action_receipts',
    'ranked_opponent_history',
    'ranked_opponent_snapshots',
    'ranked_generated_opponents',
    'ranked_runs',
    'ranked_ratings'
  ]) {
    assert.match(schema, new RegExp(`'${table}'`));
  }
  assert.match(schema, /DELETE FROM \$\{table\}/);
});
