const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rankedSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'ranked.js'),
  'utf8'
);

test('Ranked opens a guest session before loading its authenticated state', () => {
  const initBody = /async function init\(\) \{([\s\S]*?)\n\}/.exec(rankedSource)?.[1] || '';

  assert.match(initBody, /if \(!window\.AmongDemons\.getToken\(\)\) \{[\s\S]*?await window\.AmongDemons\.ensurePlayableSession\(\)/);
  assert.match(initBody, /catch \(error\) \{[\s\S]*?appUrl\('\/login\?next=\/ranked'\)[\s\S]*?return;/);
  assert.ok(
    initBody.indexOf('await window.AmongDemons.ensurePlayableSession()') < initBody.indexOf('await loadBootstrap()'),
    'the guest token must exist before Ranked requests its bootstrap payload'
  );
});
