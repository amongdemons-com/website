const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

const worldSource = read('public', 'app', 'js', 'world-ui.js');
const worldCss = read('public', 'app', 'css', 'world.css');

test('World tooltip travel hints trigger the selected path travel flow', () => {
  assert.match(worldSource, /worldTargetTooltip\?\.addEventListener\('click', onWorldActivityTooltipClick\)/);
  assert.match(worldSource, /worldEncounterTooltip\?\.addEventListener\('click', onWorldActivityTooltipClick\)/);
  assert.match(worldSource, /closest\('\[data-world-tooltip-travel\]'\)[\s\S]*?hideWorldActivityTooltip\(\);[\s\S]*?travelSelectedPath\(\);/);
  assert.match(worldSource, /<button class="world-tooltip-hint world-tooltip-travel-action" type="button" data-world-tooltip-travel>/);
  assert.equal((worldSource.match(/renderWorldTooltipTravelAction\(\)/g) || []).length, 4);
});

test('World tooltips accept pointer input only when they contain actions', () => {
  assert.match(worldCss, /\.world-target-tooltip\.has-actions,\s*\.world-encounter-tooltip\.has-actions\s*{\s*pointer-events: auto;/);
  assert.match(worldCss, /\.world-tooltip-travel-action\s*{[\s\S]*?cursor: pointer;/);
  assert.doesNotMatch(worldCss, /\.world-tooltip-travel-action:hover/);
});
