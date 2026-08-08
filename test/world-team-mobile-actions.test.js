const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

const worldSource = read('public', 'app', 'js', 'world-ui.js');
const worldCss = read('public', 'app', 'css', 'world.css');

test('Firefox mobile card gestures stay inside the World team editor', () => {
  assert.match(worldCss, /\.world-team-modal\s*{[\s\S]*?overscroll-behavior:\s*none;/);
  assert.match(worldCss, /\.world-team-editor-collection-card\s*{\s*touch-action:\s*none;/);
  assert.match(worldSource, /card\.setPointerCapture\?\.\(event\.pointerId\)/);
  assert.match(worldSource, /shouldScrollWorldTeamCollectionDrag\(drag, dx, dy\)/);
  assert.match(worldSource, /drag\.startScrollLeft - dx/);
  assert.match(worldSource, /if \(event\.cancelable\) event\.preventDefault\(\)/);
});

test('World demon details can add collection cards or remove exact team slots', () => {
  assert.match(worldSource, /label:\s*'Add to team'/);
  assert.match(worldSource, /label:\s*'Remove from team'/);
  assert.match(worldSource, /label:\s*'Remove from team'[\s\S]*?variant:\s*'secondary'/);
  assert.match(worldSource, /addWorldTeamEditorDemonToNextSlot\(demonId\)/);
  assert.match(worldSource, /removeWorldTeamEditorSlot\(sourceSlot\)/);
  assert.match(worldSource, /getWorldTeamEditorSlotEntry\(sourceSlot\)/);
  assert.match(worldSource, /Your World team is full\./);
});
