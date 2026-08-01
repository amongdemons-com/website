const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'battle.css'),
  'utf8'
);

test('Dungeon result Soul icons use the requested presentation', () => {
  assert.match(styles, /\.dungeon-result-reward > \.soul-amount\s*{[^}]*width:\s*3rem;[^}]*height:\s*3rem;[^}]*place-items:\s*flex-end;[^}]*box-shadow:\s*none;/s);
});

test('Dungeon result screens compact at laptop heights without visible scrollbars', () => {
  assert.match(styles, /\.dungeon-end-screen\.is-defeat::-webkit-scrollbar,[\s\S]*?display:\s*none;/);
  assert.match(styles, /@media \(max-height:\s*860px\) and \(min-width:\s*576px\)[\s\S]*?grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/);
  assert.match(styles, /@media \(max-height:\s*860px\)[\s\S]*?\.dungeon-extraction-prize \.dungeon-end-demon\s*{[^}]*width:\s*min\(7\.5rem, 19vh\);/s);
});

test('Dungeon result action labels stay vertically centered and left-aligned while Replay hover remains text-only', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'dungeon', 'render.js'),
    'utf8'
  );

  assert.match(source, /<span>Train Demons<\/span>/);
  assert.match(source, /<span>Return to Camp<\/span>/);
  assert.match(source, /<span>Replay Last Fight<\/span>/);
  assert.match(styles, /\.dungeon-result-actions \.btn > span:last-child\s*{[^}]*align-content:\s*center;[^}]*text-align:\s*left;/s);
  assert.match(styles, /\.dungeon-result-replay:hover,[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;[\s\S]*?color:\s*#dceae6;/);
});
