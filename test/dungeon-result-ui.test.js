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

test('Dungeon result action labels stay vertically centered and Replay uses the shared secondary style', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'dungeon', 'render.js'),
    'utf8'
  );

  assert.match(source, /<span>Train Demons<\/span>/);
  assert.match(source, /<span>Return to Camp<\/span>/);
  assert.match(source, /<span>Replay Last Fight<\/span>/);
  assert.match(styles, /\.dungeon-result-actions \.btn > span:last-child\s*{[^}]*align-content:\s*center;[^}]*text-align:\s*left;/s);
  assert.match(styles, /\.dungeon-result-replay:hover,[\s\S]*?background:\s*var\(--secondary-hover-bg\);[\s\S]*?box-shadow:\s*none;[\s\S]*?color:\s*var\(--secondary-hover-text\);/);
});

test('Dungeon result action buttons are text-only while result effects retain flat victory text', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'js', 'dungeon', 'render.js'),
    'utf8'
  );
  const actionBlocks = [...source.matchAll(/<div class="dungeon-end-actions dungeon-result-actions">([\s\S]*?)<\/div>/g)]
    .map(([, block]) => block);

  assert.equal(actionBlocks.length, 2);
  for (const block of actionBlocks) assert.doesNotMatch(block, /renderIcon\(/);
  assert.match(styles, /\.battle-result-burst\.is-victory\s*\{[\s\S]*?radial-gradient\(/);
  assert.match(styles, /\.battle-result-burst\.is-defeat\s*\{[\s\S]*?radial-gradient\([\s\S]*?linear-gradient\(/);
  assert.match(styles, /\.battle-result-burst::before\s*\{[\s\S]*?background:\s*none;[\s\S]*?filter:\s*none;/);
  const victoryText = styles.match(/\.battle-result-burst\.is-victory \.battle-result-burst-text\s*\{([^}]*)}/)?.[1] || '';
  assert.match(victoryText, /background:\s*none;/);
  assert.doesNotMatch(victoryText, /linear-gradient/);
});

test('Dungeon extraction drop target uses a faded team-slot placeholder above its prompt', () => {
  assert.match(styles, /\.dungeon-reward-dropzone \.dungeon-reward-empty\s*\{[\s\S]*?flex-direction:\s*column;[\s\S]*?gap:\s*0\.28rem;/);
  assert.match(styles, /\.dungeon-reward-dropzone \.dungeon-reward-empty::before\s*\{[\s\S]*?amongdemons_team_slot_placeholder\.png[\s\S]*?opacity:\s*0\.16;/);
});
