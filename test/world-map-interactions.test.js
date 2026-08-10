const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const map = require('../public/api/data/map.json');
const worldSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'world-ui.js'),
  'utf8'
);

test('requested World areas are blocked by rocks', () => {
  const expected = new Set([
    '12,-7', '13,-7', '12,-6', '13,-6', '15,-10', '15,-9', '14,-10'
  ]);
  const actual = new Set(
    map.blocks
      .filter((block) => block.type === 'rocks')
      .map((block) => `${block.x},${block.y}`)
  );

  expected.forEach((coordinate) => assert.equal(actual.has(coordinate), true, coordinate));
});

test('clicking the hunter tile clears pathing instead of opening Camp', () => {
  const currentTileBranch = worldSource.match(
    /if \(positionsEqual\(target, state\.position\)\) \{[\s\S]*?\n    \}/
  )?.[0] || '';

  assert.match(currentTileBranch, /clearRoutePreview\('blocked'\)/);
  assert.doesNotMatch(currentTileBranch, /appUrl\('\/camp'\)/);
});
