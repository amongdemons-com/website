const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const achievements = require('../public/api/data/achievements.json');
const playGames = require('../public/api/lib/play-games');
const playGamesAuth = require('../public/api/auth/play-games')._test;

test('Play Console import and runtime map cover every server achievement in order', () => {
  const root = path.join(__dirname, '..');
  const template = require('../play-games-console/achievement-id-map.template.json');
  const rows = fs.readFileSync(
    path.join(root, 'play-games-console', 'AchievementsMetadata.csv'),
    'utf8'
  ).trim().split(/\r?\n/);

  assert.deepEqual(Object.keys(template), achievements.map((achievement) => achievement.id));
  assert.equal(rows.length, achievements.length);
  assert.ok(rows.every((row) => row.split(',').length === 7));
  assert.ok(rows.every((row, index) => row.endsWith(`,10,${index + 1}`)));
});

test('Play Games refresh tokens are encrypted and authenticated at rest', () => {
  const original = process.env.PLAY_GAMES_TOKEN_ENCRYPTION_KEY;
  process.env.PLAY_GAMES_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  try {
    const encrypted = playGames._test.encryptRefreshToken('refresh-secret');
    assert.match(encrypted, /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    assert.equal(playGames._test.decryptRefreshToken(encrypted), 'refresh-secret');
    assert.notEqual(encrypted, 'refresh-secret');
  } finally {
    if (original === undefined) delete process.env.PLAY_GAMES_TOKEN_ENCRYPTION_KEY;
    else process.env.PLAY_GAMES_TOKEN_ENCRYPTION_KEY = original;
  }
});

test('successful Play Games authentication creates the game session before achievement sync', async () => {
  const events = [];
  let payload = null;
  const player = { id: 'play-player', username: 'PlayHunter', is_guest: 0 };
  const handler = playGamesAuth.createPlayGamesAuthHandler({
    db: { query: async () => { throw new Error('Unexpected database query'); } },
    isPlayGamesConfigured: () => true,
    exchangeServerAuthCode: async (code) => {
      events.push(`exchanged:${code}`);
      return { accessToken: 'access-token', refreshToken: 'refresh-token' };
    },
    getAuthenticatedPlayer: async () => ({ id: 'g123', displayName: 'Play Hunter' }),
    getBearerPlayer: async () => null,
    getPlayerLinkedToPlayGames: async () => player,
    storeRefreshToken: async (playerId, token) => events.push(`stored:${playerId}:${token}`),
    createSession: async (playerId, options) => {
      events.push(`session:${playerId}:${options.authProvider}`);
      return 'session-token';
    },
    checkRetroactive: async () => events.push('retroactive'),
    pushUnsyncedToPlayGames: async (playerId, options) => {
      events.push(`synced:${playerId}:${options.accessToken}`);
    },
    cleanPlayer: (value) => ({ id: value.id, username: value.username })
  });
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      events.push('responded');
      payload = value;
      return this;
    }
  };

  await handler({ body: { code: 'one-time-code' } }, response);

  assert.deepEqual(events, [
    'exchanged:one-time-code',
    'stored:play-player:refresh-token',
    'session:play-player:play_games',
    'retroactive',
    'synced:play-player:access-token',
    'responded'
  ]);
  assert.deepEqual(payload, {
    token: 'session-token',
    player: { id: 'play-player', username: 'PlayHunter' },
    playGamesPlayerId: 'g123'
  });
});

test('achievement grants queue both Steam and Play Games durable mirrors', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'api', 'lib', 'achievements.js'),
    'utf8'
  );
  assert.match(source, /queueSteamSync\(playerId\);\s*queuePlayGamesSync\(playerId\);/);
  assert.match(source, /play_games_synced_at IS NULL/);
  assert.match(source, /getPlayerAccessToken\(playerId\)/);
});
