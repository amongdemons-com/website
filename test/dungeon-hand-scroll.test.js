const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'public', 'app', 'css', 'battle.css'), 'utf8');
const handSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'hand.js'), 'utf8');

test('dungeon hand scroll controls are available outside mobile portrait', () => {
  const globalShellRule = styles.match(/\.dungeon-hand-scroll-shell\s*\{[^}]*display:\s*grid;[^}]*\}/s);
  const portraitMediaIndex = styles.indexOf('@media (max-width: 575.98px) and (orientation: portrait)');

  assert.ok(globalShellRule, 'the default hand shell should provide the scroll-control grid');
  assert.ok(globalShellRule.index < portraitMediaIndex, 'the scroll-control grid should not be portrait-only');
  assert.match(styles, /\.dungeon-hand-scroll-viewport\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(
    styles,
    /\.dungeon-hand-scroll-shell\.has-scroll-overflow \.dungeon-hand-scroll-btn:not\(\[hidden\]\)\s*\{\s*display:\s*grid;/s
  );
});

test('dungeon hand scroll buttons only appear when the viewport overflows', () => {
  assert.match(handSource, /const hasOverflow = viewport\.scrollWidth > viewport\.clientWidth \+ 1;/);
  assert.match(handSource, /shell\.classList\.toggle\('has-scroll-overflow', hasOverflow\);/);
  assert.match(handSource, /button\.hidden = !hasOverflow;/);
});

test('upgrade-highlighted recruit hands retain the scroll-control grid', () => {
  assert.match(
    styles,
    /@media \(min-width: 576px\)[\s\S]*?#dungeonHandBar:has\(\.dungeon-demon-card\.is-team-upgrade\) \.dungeon-hand-scroll-shell\s*\{[^}]*display:\s*grid;/s
  );
});
