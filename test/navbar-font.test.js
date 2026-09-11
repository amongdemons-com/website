const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function read(...segments) {
  return fs.readFileSync(path.join(__dirname, '..', ...segments), 'utf8');
}

test('the game navbar uses the preloaded display font', () => {
  const css = read('public', 'app', 'css', 'base.css');
  const server = read('server.js');

  assert.match(css, /body \.game-shell-nav\s*\{[\s\S]*?font-family:\s*"Lilita One",\s*sans-serif;[\s\S]*?font-weight:\s*normal;/);
  assert.match(server, /fonts\.googleapis\.com\/css2\?family=Lilita\+One&display=swap/);
  assert.match(server, /rel="preload"; as="style"/);
  assert.match(server, /fonts\.gstatic\.com.*rel="preconnect"; crossorigin/);
});
