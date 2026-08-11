const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const achievements = require('../public/api/data/achievements.json');

test('new world, level-cap, and Ranked achievements have stable Steam definitions', () => {
  const expected = [
    {
      id: 'one-voice-remains',
      steamName: 'ACH_ONE_VOICE_REMAINS',
      title: 'One Voice Remains',
      description: 'Defeat The Anomaly.',
      trigger: 'event'
    },
    {
      id: 'the-well-whispers-back',
      steamName: 'ACH_THE_WELL_WHISPERS_BACK',
      title: 'The Well Whispers Back',
      description: 'Receive a buff from the Whispering Well.',
      trigger: 'event'
    },
    {
      id: 'the-number',
      steamName: 'ACH_THE_NUMBER',
      title: 'The Number',
      description: 'Reach level 666.',
      trigger: 'account-level',
      threshold: 666
    },
    {
      id: 'crowned-in-hell',
      steamName: 'ACH_CROWNED_IN_HELL',
      title: 'Crowned in Hell',
      description: 'Reach Demonic rank.',
      trigger: 'ranked-rating',
      threshold: 3800
    }
  ];

  for (const definition of expected) {
    assert.deepEqual(
      achievements.find((achievement) => achievement.id === definition.id),
      definition
    );
  }
  assert.equal(new Set(achievements.map((achievement) => achievement.id)).size, achievements.length);
  assert.equal(new Set(achievements.map((achievement) => achievement.steamName)).size, achievements.length);
});

test('gameplay routes grant the new event and Ranked achievements', () => {
  const world = fs.readFileSync(path.join(ROOT, 'public', 'api', 'world.js'), 'utf8');
  const battle = fs.readFileSync(path.join(ROOT, 'public', 'api', 'runs', 'battle.js'), 'utf8');
  const ranked = fs.readFileSync(path.join(ROOT, 'public', 'api', 'runs', 'ranked.js'), 'utf8');

  assert.match(world, /grantAchievements\(req\.player\.id, \['the-well-whispers-back'\]\)/);
  assert.match(world, /if \(won\)[\s\S]*?grantAchievements\(req\.player\.id, \['one-voice-remains'\]\)/);
  assert.match(world, /checkRankedRating\(req\.player\.id, pvpResult\.rankedResult\.rating\)/);
  assert.match(battle, /checkRankedRating\(req\.player\.id, rankedResult\.rating, connection\)/);
  assert.match(ranked, /checkRankedRating\(req\.player\.id, rankedResult\.rating, connection\)/);
});

test('retroactive checks use persistent Anomaly, Whispering Well, and Ranked history', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'achievements.js'), 'utf8');
  const schema = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'schema.js'), 'utf8');

  assert.match(source, /FROM player_anomaly_rituals/);
  assert.match(source, /FROM player_world_soul_font_buffs/);
  assert.match(source, /MAX\(rating\) AS highestRating FROM ranked_ratings/);
  assert.match(source, /checkPersistentAchievementHistory\(player\.id\)/);
  assert.match(schema, /SELECT id, 'the-number'[\s\S]*?WHERE level >= 666/);
  assert.match(schema, /SELECT player_id, 'one-voice-remains'[\s\S]*?WHERE victories > 0/);
  assert.match(schema, /SELECT DISTINCT player_id, 'the-well-whispers-back'/);
  assert.match(schema, /SELECT player_id, 'crowned-in-hell'[\s\S]*?HAVING MAX\(rating\) >= 3800/);
});
