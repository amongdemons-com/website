const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(ROOT, 'public', 'app', 'css', 'battle.css'), 'utf8');
const portraitQuery = '@media (max-width: 600px) and (orientation: portrait)';
const portraitStyles = css.slice(css.lastIndexOf(portraitQuery));

test('mobile portrait dungeon ornaments stay inside their arena tracks', () => {
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.dungeon-arena\s*\{[^}]*row-gap:\s*0;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.dungeon-vs\s*\{[^}]*height:\s*auto;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.dungeon-center-panel\s*\{[^}]*container-type:\s*normal;[^}]*height:\s*auto;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-heading\s*\{[^}]*margin:\s*0 auto;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side\s*\{[^}]*row-gap:\s*0;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-nameplate\s*\{[^}]*background:[^;}]*\/ 100% 106% no-repeat;/s
  );
  assert.match(
    portraitStyles,
    /body\.dungeon-page \.battle-side-status\s*\{[^}]*background:[^;}]*\/ 100% 106% no-repeat;/s
  );
});
