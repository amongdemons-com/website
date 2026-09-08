const test = require('node:test');
const assert = require('node:assert/strict');

test('server app loads with the installed Express runtime', () => {
  const app = require('../server');

  assert.equal(typeof app, 'function');
  assert.equal(typeof app.listen, 'function');
});
