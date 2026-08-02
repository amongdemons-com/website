const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'skill-tree.css'),
  'utf8'
);

test('projected Skill Tree reset cost stays aligned with the action buttons', () => {
  assert.match(styles, /\.ascension-reset-cost\.is-projected\s*{[^}]*position:\s*relative;[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;/s);
  assert.match(styles, /\.ascension-reset-cost-preview-label\s*{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100% \+ 0\.1rem\);[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s);
});
