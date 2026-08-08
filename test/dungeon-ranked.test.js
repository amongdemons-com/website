const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const {
  createDungeonRankedSnapshotPayload,
  getDungeonRankedRatingDelta,
  isDungeonRankedFloor,
  namespaceDungeonRankedOpponentTeam,
  selectDungeonRankedOpponent
} = require('../public/api/lib/dungeon-ranked');

test('Ranked dungeon checkpoints begin when floor 30 is cleared and repeat every five floors', () => {
  assert.equal(isDungeonRankedFloor(29), false);
  assert.equal(isDungeonRankedFloor(30), true);
  assert.equal(isDungeonRankedFloor(34), false);
  assert.equal(isDungeonRankedFloor(35), true);
  assert.equal(isDungeonRankedFloor(40), true);
  assert.equal(isDungeonRankedFloor(41), false);
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

test('snapshot matchmaking uses the same floor and a plus-or-minus-five level window', async () => {
  let receivedParams;
  const queryable = {
    async query(sql, params) {
      assert.match(sql, /player_level BETWEEN \? AND \?/);
      receivedParams = params;
      return [[{
        id: 'snapshot-b',
        player_id: 'player-b',
        hunter_name: 'Rival',
        player_level: 15,
        current_rating: 1250,
        previously_served: null,
        snapshot: JSON.stringify({
          snapshotVersion: 'dungeon-ranked-v1',
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
    playerLevel: 12
  }, queryable, { random: () => 0 });

  assert.equal(receivedParams[6], 7);
  assert.equal(receivedParams[7], 17);
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

test('Dungeon UI contains the Ranked checkpoint identity, glimmer, and result flow', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'app', 'dungeon.html'), 'utf8');
  const styles = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'battle.css'), 'utf8');
  const rankedUi = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'ranked.js'), 'utf8');

  assert.match(html, /id="dungeonRankedResultModal"/);
  assert.match(html, /rank-divisions\.css/);
  assert.match(styles, /dungeon-ranked-grid-glimmer/);
  assert.match(styles, /is-ranked-encounter-planning #enemyGrid::before/);
  assert.match(rankedUi, /dungeon-ranked-opponent-name/);
  assert.match(rankedUi, /rank-division-text--/);
  assert.match(rankedUi, /ranked\/continue/);
});

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
