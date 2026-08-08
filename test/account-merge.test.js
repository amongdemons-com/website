const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  buildMergedPlayer,
  choosePreferredAccount,
  sumUnsigned,
  unionJsonArrays
} = require('../public/api/lib/account-merge');
const { requireSteamSession } = require('../public/api/account/merge')._test;

const ROOT = path.join(__dirname, '..');

test('account merge keeps the higher-level username and independently keeps the highest XP', () => {
  const steam = player({
    id: 'steam',
    username: 'SteamHunter',
    level: 12,
    xp: 9000,
    souls: 200,
    highest_floor: 8,
    pvp_wins: 3,
    pvp_losses: 1,
    unlocks: JSON.stringify(['camp'])
  });
  const browser = player({
    id: 'browser',
    username: 'OldHunter',
    level: 18,
    xp: 7000,
    souls: 350,
    highest_floor: 11,
    pvp_wins: 4,
    pvp_losses: 2,
    unlocks: JSON.stringify(['world'])
  });

  const preferred = choosePreferredAccount(steam, browser);
  const merged = buildMergedPlayer(steam, browser, preferred, 42);

  assert.equal(preferred.id, 'browser');
  assert.equal(merged.username, 'OldHunter');
  assert.equal(merged.level, 18);
  assert.equal(merged.xp, 9000);
  assert.equal(merged.souls, 550);
  assert.equal(merged.highest_floor, 11);
  assert.equal(merged.pvp_wins, 7);
  assert.equal(merged.profile_demon_id, 42);
  assert.deepEqual(JSON.parse(merged.unlocks), ['camp', 'world']);
});

test('account merge ties prefer Steam and safely unions arrays and balances', () => {
  const steam = player({ id: 'steam', level: 10, xp: 5000, username: 'SteamName' });
  const browser = player({ id: 'browser', level: 10, xp: 5000, username: 'BrowserName' });

  assert.equal(choosePreferredAccount(steam, browser).id, 'steam');
  assert.deepEqual(unionJsonArrays('["one","two"]', ['two', 'three'], 'invalid'), ['one', 'two', 'three']);
  assert.equal(sumUnsigned(4294967290, 100), 4294967295);
});

test('merge API rejects sessions not authenticated by Steam', () => {
  let nextCalled = false;
  const response = {
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };

  requireSteamSession({ authProvider: 'google' }, response, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.match(response.payload.error, /only available.*Steam/i);
  assert.equal(nextCalled, false);

  requireSteamSession({ authProvider: 'steam' }, response, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('merge implementation covers all requested destructive and preservation rules', () => {
  const mergeSource = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'account-merge.js'), 'utf8');
  const achievementSource = fs.readFileSync(path.join(ROOT, 'public', 'api', 'account', 'merge.js'), 'utf8');
  const schemaSource = fs.readFileSync(path.join(ROOT, 'public', 'api', 'lib', 'schema.js'), 'utf8');

  assert.match(mergeSource, /Math\.max\(Number\(target\.level/);
  assert.match(mergeSource, /Math\.max\(Number\(target\.xp/);
  assert.match(mergeSource, /quantity = LEAST/);
  assert.match(mergeSource, /FROM player_bag[\s\S]*?FOR UPDATE/);
  assert.match(mergeSource, /INSERT INTO player_bag[\s\S]*?VALUES \(\?, \?, \?, \?, \?, \?\)/);
  assert.doesNotMatch(mergeSource, /SELECT \?, item_key, item_type, quantity[\s\S]*?FROM player_bag/);
  assert.doesNotMatch(mergeSource, /SELECT \?, boss_id, awarded_at, expires_at[\s\S]*?FROM player_world_boss_buffs/);
  assert.doesNotMatch(mergeSource, /SELECT \?, buff_id, offer_set_id, price[\s\S]*?FROM player_world_soul_font_buffs/);
  assert.doesNotMatch(mergeSource, /SELECT \?, season_id, rating, highest_floor[\s\S]*?FROM ranked_ratings/);
  assert.match(mergeSource, /hp = \?, atk = \?, speed = \?/);
  assert.match(mergeSource, /GREATEST\(expires_at, VALUES\(expires_at\)\)/);
  assert.match(mergeSource, /DELETE FROM player_stat_points/);
  assert.match(mergeSource, /status = 'active'/);
  assert.match(mergeSource, /VALUES \(\?, 0, 0\)/);
  assert.match(mergeSource, /purgePlayerAccount\(source\.id, connection\)/);
  assert.match(achievementSource, /pushUnsyncedToSteam\(player\.id\)/);
  assert.match(schemaSource, /PRIMARY KEY \(player_id, buff_id\)/);
  assert.doesNotMatch(schemaSource, /SHOW INDEX[^\n]+ORDER BY/i);
  assert.match(schemaSource, /Seq_in_index\) - Number\(right\.Seq_in_index/);
});

test('settings contains a full-screen two-account merge review', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'app', 'settings.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'base.css'), 'utf8');
  const client = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'settings-ui.js'), 'utf8');

  assert.match(html, /id="accountMergeModal"/);
  assert.match(html, /This cannot be undone/);
  assert.match(css, /\.account-merge-modal\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;/);
  assert.match(client, /steamAccount/);
  assert.match(client, /connectedAccount/);
  assert.match(client, /Merge accounts/);
  assert.match(client, /sign-in opened in your browser\. Complete it there, then return to the game\./);
  assert.match(client, /dataset\.desktopWrapper === '1'/);
  assert.match(client, /beginDesktopOAuthPolling\(provider\)/);
  assert.match(client, /api\('\/api\/account\/security', \{ dedupe: false \}\)/);
  assert.match(client, /Your Steam hunter is up to date/);
  assert.match(client, /recoverCompletedAccountMerge\(mergeToken, mergeProvider\)/);
  assert.match(client, /Return to Steam; the app will update automatically\./);
});

function player(overrides = {}) {
  return {
    id: 'player',
    username: 'Hunter',
    email: null,
    password_hash: 'hash',
    password_salt: 'salt',
    password_login_enabled: 0,
    level: 1,
    xp: 0,
    souls: 0,
    highest_floor: 0,
    pvp_wins: 0,
    pvp_losses: 0,
    unlocks: '[]',
    ...overrides
  };
}
