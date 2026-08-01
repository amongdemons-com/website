const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { getEchoRefinementBatch } = require('../public/api/lib/echo-config');

test('Echo refinement consumes every complete recipe batch', () => {
  assert.deepEqual(getEchoRefinementBatch(10, 'common'), {
    recipeCost: 3,
    refinedQuantity: 3,
    consumedQuantity: 9,
    remainingQuantity: 1
  });
});

test('Echo refinement leaves an incomplete recipe untouched', () => {
  assert.deepEqual(getEchoRefinementBatch(4, 'epic'), {
    recipeCost: 5,
    refinedQuantity: 0,
    consumedQuantity: 0,
    remainingQuantity: 4
  });
});

test('Echo refinement result confirms completion and shows only multi-Echo quantities', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'js', 'bag-ui.js'), 'utf8');
  const styles = fs.readFileSync(path.join(__dirname, '..', 'public', 'app', 'css', 'bag.css'), 'utf8');

  assert.match(source, /refinedQuantity > 1 \? `<span class="bag-item-count">x\$\{escapeHtml\(formatNumber\(refinedQuantity\)\)\}<\/span>` : ''/);
  assert.match(source, /class="btn btn-primary" data-bs-dismiss="modal">Confirm<\/button>/);
  assert.match(styles, /\.bag-action-echo-result > \.bag-item-count\s*{[^}]*min-width:\s*3rem;[^}]*font-size:\s*1rem;/s);
});
