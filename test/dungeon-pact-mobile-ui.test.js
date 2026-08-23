const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'base.css'),
  'utf8'
);
const pactSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'dungeon', 'pacts.js'),
  'utf8'
);

test('mobile portrait Pact selection stays within the dynamic viewport', () => {
  assert.match(styles, /@media \(max-width:\s*575\.98px\) and \(orientation:\s*portrait\)[\s\S]*?body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-overlay\s*{[^}]*height:\s*100vh;[^}]*height:\s*100dvh;[^}]*max-height:\s*100dvh;[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-stage\s*{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;[^}]*height:\s*100%;[^}]*min-height:\s*0;/s);
});

test('mobile portrait Pact choices use compact flexible cards', () => {
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-grid\s*{[^}]*grid-template-rows:\s*repeat\(3, minmax\(0, 1fr\)\);[^}]*max-height:\s*31\.5rem;[^}]*min-height:\s*0;/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-card\s*{[^}]*grid-template-rows:\s*minmax\(min-content, 1fr\) auto auto;[^}]*min-height:\s*0;[^}]*padding:\s*0\.46rem 0\.55rem;/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-card-main\s*{[^}]*grid-template-columns:\s*2\.4rem minmax\(0, 1fr\);[^}]*grid-template-rows:\s*auto auto minmax\(min-content, 1fr\);/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-card-emblem,[\s\S]*?body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-card-copy\s*{[^}]*display:\s*contents;/s);
  assert.match(styles, /body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-description\s*{[^}]*padding-block:\s*0\.38rem;[^}]*line-height:\s*1\.25;/s);
  assert.match(styles, /@media \(max-width:\s*575\.98px\) and \(max-height:\s*540px\) and \(orientation:\s*portrait\)[\s\S]*?\.demonic-pact-overlay\s*{[^}]*overflow-y:\s*auto;[\s\S]*?\.demonic-pact-stage\s*{[^}]*grid-template-rows:\s*auto auto auto;[^}]*align-self:\s*start;[^}]*height:\s*auto;[^}]*max-height:\s*none;[\s\S]*?\.demonic-pact-grid\s*{[^}]*grid-template-rows:\s*repeat\(3, auto\);[^}]*max-height:\s*none;[\s\S]*?\.demonic-pact-description\s*{[^}]*padding-block:\s*0\.22rem;[^}]*line-height:\s*1\.2;/s);
});

test('desktop Pact content centers as one collision-free stack', () => {
  const cardStyles = styles.match(/\.demonic-pact-card\s*{([^}]*)}/s)?.[1] || '';
  const mainStyles = styles.match(/\.demonic-pact-card-main\s*{([^}]*)}/s)?.[1] || '';
  const emblemStyles = styles.match(/\.demonic-pact-card-emblem\s*{([^}]*)}/s)?.[1] || '';
  const copyStyles = styles.match(/\.demonic-pact-card-copy\s*{([^}]*)}/s)?.[1] || '';
  const tagStyles = styles.match(/\.demonic-pact-tags\s*{([^}]*)}/s)?.[1] || '';

  assert.match(cardStyles, /grid-template-rows:\s*minmax\(min-content, 1fr\) 2\.1rem auto;/);
  assert.match(mainStyles, /grid-template-rows:\s*auto var\(--demonic-pact-copy-height, auto\);/);
  assert.match(mainStyles, /align-content:\s*center;/);
  assert.match(mainStyles, /gap:\s*clamp\(1\.85rem, 2\.8vh, 2\.25rem\);/);
  assert.match(mainStyles, /transform:\s*translateY\(clamp\(0\.55rem, 1\.2vh, 0\.8rem\)\);/);
  assert.match(emblemStyles, /display:\s*grid;/);
  assert.match(copyStyles, /align-content:\s*start;/);
  assert.match(tagStyles, /display:\s*flex;/);
  assert.match(tagStyles, /grid-row:\s*3;/);
  assert.doesNotMatch(tagStyles, /position:\s*(?:absolute|fixed)/);
  assert.match(pactSource, /function syncDemonicPactCardAlignment\(\)[\s\S]*--demonic-pact-copy-height[\s\S]*tallestCopy/);
});

test('View Team is grouped beside the centered Recast action on desktop', () => {
  const dungeonHtml = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'app', 'dungeon.html'),
    'utf8'
  );
  const actionStack = dungeonHtml.match(/<div class="demonic-pact-action-stack">([\s\S]*?)<\/div>\s*<\/div>/)?.[1] || '';
  const toggleStyles = styles.match(/\.demonic-pact-view-toggle\s*{([^}]*)}/s)?.[1] || '';

  assert.match(actionStack, /id="demonicPactViewToggle"[\s\S]*id="dungeonPactActions"/);
  assert.match(actionStack, /data-lucide="users"[\s\S]*View Team/);
  assert.match(toggleStyles, /min-height:\s*2\.85rem;/);
  assert.doesNotMatch(toggleStyles, /position:\s*fixed/);
  assert.match(styles, /\.demonic-pact-action-stack\s*{[^}]*display:\s*flex;[^}]*align-items:\s*stretch;[^}]*justify-content:\s*center;/s);
  assert.match(styles, /@media \(max-width:\s*575\.98px\) and \(orientation:\s*portrait\)[\s\S]*?body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-actions\s*{[^}]*order:\s*1;[\s\S]*?body\.dungeon-page:not\(\.ranked-page\) \.demonic-pact-view-toggle\s*{[^}]*order:\s*2;/s);
});
