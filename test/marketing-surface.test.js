const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STEAM_APP_ID,
  STEAM_STORE_URL,
  renderHomePage,
  renderPressPage,
  renderSitemap,
  renderUpdatesPage,
  steamCampaignUrl
} = require('../lib/seo-pages');

test('owned-channel Steam links use Steam UTM analytics', () => {
  const url = new URL(steamCampaignUrl('test_link'));

  assert.equal(STEAM_APP_ID, '4973450');
  assert.equal(`${url.origin}${url.pathname}`, STEAM_STORE_URL);
  assert.equal(url.searchParams.get('utm_source'), 'amongdemons.com');
  assert.equal(url.searchParams.get('utm_medium'), 'website');
  assert.equal(url.searchParams.get('utm_campaign'), 'website_conversion');
  assert.equal(url.searchParams.get('utm_content'), 'test_link');
});

test('home page presents one concise Steam and browser choice', () => {
  const html = renderHomePage([]);

  assert.match(html, /Dark fantasy roguelite auto battler/);
  assert.match(html, /extract before one loss ends the run/);
  assert.match(html, /Get it on Steam/);
  assert.match(html, /Play Free in Browser/);
  assert.match(html, /54 achievements/);
  assert.match(html, /player-badge--the_night_remembers/);
  assert.match(html, /data-lucide="bookmark"/);
  assert.match(html, />The Night Remembers<\/span>/);
  assert.doesNotMatch(html, /One persistent world, two editions/);
  assert.doesNotMatch(html, /home_edition_card/);
  assert.match(html, /"gamePlatform":\["Steam","Web browser","Windows"\]/);
});

test('press kit exposes copy-ready facts and official assets', () => {
  const html = renderPressPage();

  assert.match(html, /Press &amp; Creator Resources/i);
  assert.match(html, /August 5, 2026/);
  assert.match(html, /66 demons/);
  assert.match(html, /Steam page &amp; trailer/);
  assert.match(html, /amongdemons_home_logo\.png/);
});

test('patch notes become an indexable updates page', () => {
  const html = renderUpdatesPage(`# Patch Notes

## Patch 2 (Current)

- Added a creator-friendly update page.
  Wrapped details stay in the same item.
- Improved the Steam conversion path.

## Patch 1

- Shipped the game.
`);

  assert.match(html, /Patch 2 \(Current\)/);
  assert.match(html, /Wrapped details stay in the same item/);
  assert.match(html, /Patch 1/);
  assert.match(html, /updates_page/);
});

test('sitemap includes marketing discovery pages', () => {
  const xml = renderSitemap([], []);

  assert.match(xml, /https:\/\/amongdemons\.com\/updates/);
  assert.match(xml, /https:\/\/amongdemons\.com\/press/);
});
