const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'),
  'utf8'
);

test('mobile portrait Pact selection stays within the dynamic viewport', () => {
  assert.match(styles, /@media \(max-width:\s*575\.98px\) and \(orientation:\s*portrait\)[\s\S]*?body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-overlay\s*{[^}]*height:\s*100vh;[^}]*height:\s*100dvh;[^}]*max-height:\s*100dvh;[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-stage\s*{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;[^}]*height:\s*100%;[^}]*min-height:\s*0;/s);
});

test('mobile portrait Pact choices use compact flexible cards', () => {
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-grid\s*{[^}]*grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\);[^}]*max-height:\s*31\.5rem;[^}]*min-height:\s*0;/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-card\s*{[^}]*grid-template-columns:\s*2\.4rem minmax\(0, 1fr\);[^}]*min-height:\s*0;[^}]*padding:\s*0\.46rem 0\.55rem;/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-description\s*{[^}]*padding-block:\s*0\.38rem;[^}]*line-height:\s*1\.25;/s);
  assert.match(styles, /@media \(max-width:\s*575\.98px\) and \(max-height:\s*540px\) and \(orientation:\s*portrait\)[\s\S]*?\.demonic-pact-description\s*{[^}]*padding-block:\s*0\.22rem;[^}]*line-height:\s*1\.2;/s);
});
