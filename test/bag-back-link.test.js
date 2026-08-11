const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');

test('Bag heading has an accessible link back to the previous page', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'app', 'bag.html'), 'utf8');
  const source = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'bag-ui.js'), 'utf8');

  assert.match(html, /id="bagBackLink"[^>]+aria-label="Back to previous page"/);
  assert.match(html, /id="bagBackLink"[\s\S]*?data-lucide="chevron-left"[\s\S]*?id="bagVaultTitle"/);
  assert.match(source, /bagBackLink\?\.addEventListener\('click',[\s\S]*?window\.history\.back\(\)/);
});
