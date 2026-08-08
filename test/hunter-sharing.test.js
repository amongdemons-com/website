const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { renderHunterOgSvg, _test: hunterOg } = require('../lib/hunter-og-image');
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
  assert.match(meta.image, /\.png\?v=4$/);
});

test('hunter sharing image subtitle mirrors the hero identity line', async () => {
  const svg = await renderHunterOgSvg(rankedProfile, rankedProfile.hunter.username);
  assert.match(svg, /<tspan fill="#bd7048" fill-opacity="1">Bronze III<\/tspan>/);
  assert.match(svg, /<tspan fill="#edf5f2" fill-opacity="0\.78"> \u00b7 Level 33 \u00b7 4-6<\/tspan>/);
});

test('leaderboard compacts Soul values without compacting ranks', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'rankings-ui.js'), 'utf8');
  assert.match(source, /renderSoulAmount\(formatCompactNumber\(souls\)/);
  assert.match(source, /rank-position-number">\$\{rank\}/);
  assert.match(source, /rankedRating\)\}<\/strong>/);
});

test('hunter sharing image uses the matching color for each Ranked division', async () => {
  assert.equal(hunterOg.getRankDivisionColor('Iron III'), '#66727a');
  assert.equal(hunterOg.getRankDivisionColor('Iron II'), '#82919a');
  assert.equal(hunterOg.getRankDivisionColor('Iron I'), '#a4b0b7');
  assert.equal(hunterOg.getRankDivisionColor('Bronze III'), '#bd7048');
  assert.equal(hunterOg.getRankDivisionColor('Gold I'), '#ffd866');
  assert.equal(hunterOg.getRankDivisionColor('Diamond II'), '#76c5ff');
  assert.equal(hunterOg.getRankDivisionColor('Demonic'), '#e58aff');
  assert.equal(hunterOg.getRankDivisionColor('Unranked'), '#98a3ad');

  const markup = hunterOg.renderSubtitleMarkup({
    found: true,
    rankColor: '#ffd866',
    rankDivision: 'Gold I',
    subtitle: `Gold I \u00b7 Level 20 \u00b7 8-3`
  });
  assert.match(markup, /foreground="#ffd866"[^>]*>Gold I<\/span>/);
  assert.ok(markup.includes('<span foreground="#c2cbc9" weight="800"> \u00b7 Level 20 \u00b7 8-3</span>'));

  const png = await hunterOg.renderHunterOgPng(rankedProfile, rankedProfile.hunter.username);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
});

test('hunter hero contains long unbroken names before the stats column', () => {
  const hunterSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'hunter-ui.js'), 'utf8');
  const baseCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'), 'utf8');

  assert.match(hunterSource, /const isCompact = length >= 18;/);
  assert.match(baseCss, /\.hunter-title-block h1 \{[\s\S]*?max-width: 100%;[\s\S]*?min-width: 0;[\s\S]*?overflow-wrap: anywhere;/);
});

test('hunter desktop hero stats size to their content', () => {
  const baseCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'), 'utf8');

  assert.match(baseCss, /@media \(min-width: 992px\) \{[\s\S]*?\.hunter-stat-grid \{[\s\S]*?grid-template-columns: repeat\(2, max-content\);[\s\S]*?justify-content: end;/);
});

test('hunter mobile portrait coordinates omit the Area prefix', () => {
  const hunterSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'hunter-ui.js'), 'utf8');
  const baseCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'), 'utf8');

  assert.match(hunterSource, /prefix\.className = 'hunter-coordinate-area-prefix';/);
  assert.match(hunterSource, /element\.replaceChildren\(prefix, formatCoordinates\(coordinates\)\);/);
  assert.match(baseCss, /@media \(max-width: 575\.98px\) and \(orientation: portrait\) \{[\s\S]*?\.hunter-coordinate-area-prefix \{[\s\S]*?display: none;/);
});
