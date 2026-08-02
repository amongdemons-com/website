const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

const bootstrapSource = read('public', 'api', 'bootstrap.js');
const campHtml = read('public', 'app', 'camp.html');
const campSource = read('public', 'app', 'js', 'camp-ui.js');
const campCss = read('public', 'app', 'css', 'camp.css');

test('Camp bootstrap includes the player active world boss reward buffs', () => {
  assert.match(bootstrapSource, /getActiveWorldBossRewardBuffs/);
  assert.match(bootstrapSource, /getActiveWorldBossRewardBuffs\(req\.player\.id\)/);
  assert.match(bootstrapSource, /res\.json\(\{[\s\S]*?worldBuffs[\s\S]*?\}\);/);
});

test('Camp renders world buffs directly beneath the skill tree stats', () => {
  assert.match(campHtml, /id="campSkillTreeStats"[\s\S]*?<\/div>\s*<section class="camp-world-buffs" id="campWorldBuffs"/);
  assert.match(campSource, /state\.worldBuffs = Array\.isArray\(payload\.worldBuffs\)/);
  assert.match(campSource, /renderWorldBuffs\(\);/);
  assert.match(campSource, /<article class="camp-world-buff"/);
  assert.match(campSource, /formatWorldBuffExpiry\(buff\?\.expiresAt\)/);
  assert.doesNotMatch(campSource, /renderWorldBuffHeading/);
  assert.match(campSource, /elements\.campWorldBuffs\.hidden = !buffs\.length/);
  assert.match(campSource, /data-tooltip="\$\{formatTooltipAttribute\(tooltip\)\}"/);
  assert.match(campCss, /\.camp-world-buff \{/);
  assert.match(campCss, /\.camp-world-buffs \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(campCss, /\.camp-world-buff--legendary/);
  assert.match(campCss, /\.camp-world-buff \{[\s\S]*?align-items: center;[\s\S]*?align-content: center;[\s\S]*?border: 1px solid rgba\(161,212,201,0\.1\);/);
  assert.match(campCss, /\.camp-world-buff time \{[\s\S]*?align-items: center;[\s\S]*?color: #f8fbf9;/);
  assert.match(campCss, /\.camp-world-buff::after/);
});
