const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const { _test: hunterPage } = require('../lib/hunter-page');
const {
  awardPlayerBadge,
  backfillPlayerBadgeForOAuthProvider,
  getPlayerBadgeDefinition,
  getPlayerBadgesByPlayerIds
} = require('../public/api/lib/player-badges');
const { _test: steamAuth } = require('../public/api/auth/steam');
const { parseOptions } = require('../scripts/award-player-badge');

test('Chosen Before Dawn stays unchanged', () => {
  const badge = getPlayerBadgeDefinition('chosen_before_dawn');
  assert.equal(badge.name, 'Chosen Before Dawn');
  assert.equal(badge.description, 'Helped test and shape Among Demons during pre-alpha.');
  assert.equal(badge.icon, 'shield');
  assert.equal(badge.color, undefined);
});

test('The Night Remembers has the Steam purchase definition and spectral green color', () => {
  const badge = getPlayerBadgeDefinition('the_night_remembers');
  assert.equal(badge.name, 'The Night Remembers');
  assert.equal(badge.description, 'Supported Among Demons by purchasing the game.');
  assert.equal(badge.icon, 'bookmark');
  assert.equal(badge.color, '#6fd6a7');
  assert.deepEqual(badge.action, {
    label: 'Buy Game',
    href: 'https://store.steampowered.com/app/4973450/Among_Demons/'
  });
});

test('player badges resolve in stable award order', async () => {
  const awardedAt = new Date('2026-08-01T00:00:00.000Z');
  const queryable = {
    async query(sql, params) {
      assert.match(sql, /FROM player_badges/);
      assert.match(sql, /ORDER BY awarded_at ASC, badge_key ASC/);
      assert.deepEqual(params, ['player-1', 'player-2']);
      return [[
        {
          player_id: 'player-1',
          badge_key: 'chosen_before_dawn',
          awarded_at: awardedAt
        },
        {
          player_id: 'player-1',
          badge_key: 'the_night_remembers',
          awarded_at: awardedAt
        }
      ]];
    }
  };
  const result = await getPlayerBadgesByPlayerIds(['player-1', 'player-2'], queryable);
  assert.deepEqual(result.get('player-2'), []);
  assert.deepEqual(
    result.get('player-1').map((badge) => badge.key),
    ['chosen_before_dawn', 'the_night_remembers']
  );
});

test('server-rendered hunter badges keep both accessible tooltips in order', () => {
  const html = hunterPage.renderServerPlayerBadges([
    getPlayerBadgeDefinition('chosen_before_dawn'),
    getPlayerBadgeDefinition('the_night_remembers')
  ]);
  assert.match(html, /<strong>Chosen Before Dawn<\/strong>\s*<span>Helped test and shape Among Demons during pre-alpha\.<\/span>/);
  assert.match(html, /<strong>The Night Remembers<\/strong>\s*<span>Supported Among Demons by purchasing the game\.<\/span>/);
  assert.match(html, /data-lucide="shield"/);
  assert.match(html, /data-lucide="bookmark"/);
  assert.equal((html.match(/tabindex="0"/g) || []).length, 2);
  assert.ok(html.indexOf('Chosen Before Dawn') < html.indexOf('The Night Remembers'));
  assert.match(html, /role="group" aria-label="The Night Remembers badge details"/);
  assert.match(html, /href="https:\/\/store\.steampowered\.com\/app\/4973450\/Among_Demons\/"/);
  assert.match(html, /<span>Buy Game<\/span><i data-lucide="arrow-right"><\/i><\/a>/);
  assert.match(html, /aria-label="Buy Game for The Night Remembers \(opens in a new tab\)"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('shared browser rendering keeps both badges together on leaderboard rows', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'player-badges.js'),
    'utf8'
  );
  const context = {
    window: {
      AmongDemons: {
        ui: {
          renderIcon: (icon) => `<svg data-icon="${icon}"></svg>`
        }
      }
    }
  };
  vm.runInNewContext(source, context);
  const html = context.window.AmongDemons.ui.renderPlayerBadges([
    getPlayerBadgeDefinition('chosen_before_dawn'),
    getPlayerBadgeDefinition('the_night_remembers')
  ], { context: 'leaderboard' });

  assert.match(html, /class="player-badges player-badges--leaderboard"/);
  assert.equal((html.match(/class="player-badge /g) || []).length, 2);
  assert.ok(html.indexOf('player-badge--chosen_before_dawn') < html.indexOf('player-badge--the_night_remembers'));
  assert.match(html, /data-icon="bookmark"/);
  assert.match(html, /player-badge-tooltip--action" role="group"/);
  assert.match(html, /<span>Buy Game<\/span><svg data-icon="arrow-right"><\/svg><\/a>/);
  assert.match(html, /aria-label="Buy Game for The Night Remembers \(opens in a new tab\)"/);
});

test('hunter badge group stays centered while the new badge alone uses spectral green', () => {
  const css = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'),
    'utf8'
  );

  assert.match(css, /\.player-badge \{[\s\S]*?color: #a98ac4;/);
  assert.match(css, /\.player-badge--the_night_remembers \{\s*color: #6fd6a7;/);
  assert.match(css, /\.hunter-avatar-frame > \.player-badges--hunter \{[\s\S]*?left: 50%;[\s\S]*?transform: translateX\(-50%\);/);
  assert.match(css, /\.player-badges \{[\s\S]*?justify-content: center;[\s\S]*?flex-wrap: nowrap;/);
  assert.match(css, /\.player-badge:focus-within \.player-badge-tooltip/);
  assert.match(css, /\.player-badge--has-action:focus-within \.player-badge-tooltip--action \{\s*pointer-events: auto;/);
  assert.match(css, /\.player-badge-tooltip-action \{[\s\S]*?justify-self: end;[\s\S]*?color: #fff;[\s\S]*?text-align: right;/);
  assert.match(css, /\.player-badge-tooltip-action:visited,[\s\S]*?color: #fff;/);
  const actionRule = css.match(/\.player-badge-tooltip-action \{[\s\S]*?\n\}/)?.[0] || '';
  assert.doesNotMatch(actionRule, /\b(?:background|border|min-height|padding):/);
  assert.match(css, /\.player-badge-tooltip-action:focus-visible \{[\s\S]*?outline:/);
  assert.match(css, /@media \(min-width: 576px\) \{[\s\S]*?\.hunter-avatar-frame \.player-badge-tooltip \{\s*left: calc\(50% \+ 2rem\);/);
  assert.match(css, /\.hunter-avatar-frame \.player-badge-tooltip::before \{\s*left: calc\(50% - 2rem\);/);
});

test('badge awarding is duplicate-safe', async () => {
  const awarded = new Set();
  const queries = [];
  const queryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      const key = params.join(':');
      if (awarded.has(key)) assert.match(sql, /ON DUPLICATE KEY UPDATE/);
      awarded.add(key);
      return [{ affectedRows: 1 }];
    }
  };

  await awardPlayerBadge('player-1', 'the_night_remembers', queryable);
  await awardPlayerBadge('player-1', 'the_night_remembers', queryable);

  assert.equal(awarded.size, 1);
  assert.equal(queries.length, 2);
  assert.deepEqual(queries[0].params, ['player-1', 'the_night_remembers']);
});

test('Steam badge backfill selects every linked account idempotently', async () => {
  const calls = [];
  const queryable = {
    async query(sql, params) {
      calls.push({ sql, params });
      return [{ affectedRows: 2 }];
    }
  };

  await backfillPlayerBadgeForOAuthProvider('the_night_remembers', 'Steam', queryable);

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /SELECT DISTINCT player_id/);
  assert.match(calls[0].sql, /FROM player_oauth_accounts/);
  assert.match(calls[0].sql, /ON DUPLICATE KEY UPDATE/);
  assert.deepEqual(calls[0].params, ['the_night_remembers', 'steam']);
});

test('schema initialization registers the Steam purchase badge backfill', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'api', 'lib', 'schema.js'),
    'utf8'
  );

  assert.match(source, /20260803_the_night_remembers_steam_backfill_v1/);
  assert.match(source, /backfillPlayerBadgeForOAuthProvider\('the_night_remembers', 'steam'\)/);
  assert.match(source, /runMigrationOnce\(STEAM_PURCHASE_BADGE_BACKFILL_MIGRATION, backfillSteamPurchaseBadge\)/);
});

test('successful Steam authentication awards the badge before responding', async () => {
  const events = [];
  let payload = null;
  const player = { id: 'steam-player', username: 'SteamHunter', is_guest: 0 };
  const handler = steamAuth.createSteamAuthHandler({
    db: { query: async () => { throw new Error('Unexpected database query'); } },
    isSteamConfigured: () => true,
    authenticateUserTicket: async () => {
      events.push('authenticated');
      return { steamId: '76561198000000000' };
    },
    getPlayerSummary: async () => ({ personaName: 'Steam Hunter' }),
    getBearerPlayer: async () => null,
    getPlayerLinkedToSteam: async () => player,
    awardPlayerBadge: async (playerId, badgeKey) => {
      events.push(`awarded:${playerId}:${badgeKey}`);
    },
    createSession: async () => {
      events.push('session');
      return 'session-token';
    },
    checkRetroactive: async () => events.push('retroactive'),
    pushUnsyncedToSteam: async () => events.push('synced'),
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

  await handler({ body: { ticket: 'verified-ticket' } }, response);

  assert.deepEqual(events, [
    'authenticated',
    'awarded:steam-player:the_night_remembers',
    'session',
    'retroactive',
    'synced',
    'responded'
  ]);
  assert.deepEqual(payload, {
    token: 'session-token',
    player: { id: 'steam-player', username: 'SteamHunter' },
    steamId: '76561198000000000'
  });
});

test('manual badge awards require explicit apply and accept future buyer awards', () => {
  const preview = parseOptions(['chosen_before_dawn', 'albanezu']);
  const applied = parseOptions(['the_night_remembers', 'albanezu', '--apply']);
  assert.equal(preview.apply, false);
  assert.equal(applied.apply, true);
  assert.equal(applied.badge.key, 'the_night_remembers');
});
