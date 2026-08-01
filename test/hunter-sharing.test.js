const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { renderHunterOgSvg } = require('../lib/hunter-og-image');
const { _test: hunterPage } = require('../lib/hunter-page');

const rankedProfile = {
  hunter: {
    username: 'RankedHunter',
    level: 33,
    souls: 10911,
    highestFloor: 24,
    pvpWins: 4,
    pvpLosses: 6
  },
  ranked: { division: 'Bronze III', rank: 18 },
  coordinates: { x: 0, y: 0 },
  worldTeam: [],
  buffs: []
};

test('hunter sharing metadata includes the Ranked division when one exists', () => {
  const meta = hunterPage.buildHunterMeta(rankedProfile, rankedProfile.hunter.username);
  assert.match(meta.description, /Bronze III rank/);
  assert.match(meta.description, /Level 33 hunter/);
});

test('hunter sharing image subtitle mirrors the hero identity line', async () => {
  const svg = await renderHunterOgSvg(rankedProfile, rankedProfile.hunter.username);
  assert.match(svg, /Bronze III · Level 33 · 4-6/);
});

test('leaderboard compacts Soul values without compacting ranks', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'rankings-ui.js'), 'utf8');
  assert.match(source, /renderSoulAmount\(formatCompactNumber\(souls\)/);
  assert.match(source, /rank-position-number">\$\{rank\}/);
  assert.match(source, /rankedRating\)\}<\/strong>/);
});
