const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const baseCss = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'),
  'utf8'
);
const battleCss = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'battle.css'),
  'utf8'
);

test('shared battle buff summaries add top spacing and center every row item', () => {
  assert.match(
    baseCss,
    /\.battle-buff-summary-chip\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*margin-top:\s*0\.4rem;[^}]*line-height:\s*1;/s
  );
  assert.match(
    baseCss,
    /\.battle-buff-summary-chip > \.game-icon,[\s\S]*?\.battle-buff-summary-chip > strong\s*\{[^}]*display:\s*inline-flex;[^}]*align-self:\s*center;[^}]*align-items:\s*center;[^}]*line-height:\s*1;[^}]*vertical-align:\s*middle;/s
  );
  assert.match(
    baseCss,
    /\.enemy-pressure-chip > \.game-icon,[\s\S]*?\.enemy-pressure-chip > strong\s*\{[^}]*display:\s*inline-flex;[^}]*align-self:\s*center;[^}]*align-items:\s*center;[^}]*line-height:\s*1;[^}]*vertical-align:\s*middle;/s
  );
});

test('dungeon status resets preserve the shared buff-summary top spacing', () => {
  assert.match(
    battleCss,
    /body\.dungeon-page \.battle-side-status \.battle-buff-summary-chip\s*\{[^}]*margin-top:\s*0\.4rem;/s
  );
  assert.match(
    battleCss,
    /body\.dungeon-page \.battle-side-status > \.enemy-pressure-chip\s*\{[^}]*align-items:\s*center;[^}]*margin-top:\s*0\.4rem;/s
  );
});
