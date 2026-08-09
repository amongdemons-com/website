const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'css', 'skill-tree.css'),
  'utf8'
);
const markup = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'skill-tree.html'),
  'utf8'
);
const script = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'skill-tree-ui.js'),
  'utf8'
);

test('projected Skill Tree reset cost stays aligned with the action buttons', () => {
  assert.match(styles, /\.ascension-reset-cost\.is-projected\s*{[^}]*position:\s*relative;[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;/s);
  assert.match(styles, /\.ascension-reset-cost-preview-label\s*{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100% \+ 0\.1rem\);[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\);/s);
});

test('uncapped Skill Tree nodes have color-matched multi-add controls on the requested side', () => {
  const sides = {
    health_mastery: 'left',
    healing_mastery: 'left',
    thorns_mastery: 'left',
    poison_mastery: 'left',
    soul_capacity_mastery: 'right',
    aoe_mastery: 'right',
    attack_mastery: 'right'
  };
  const controls = Array.from(markup.matchAll(/<button class="ascension-multi-add-trigger[^>]+data-multi-add-key="([^"]+)"[^>]*>/g));

  assert.equal(controls.length, Object.keys(sides).length);
  Object.entries(sides).forEach(([key, side]) => {
    const node = markup.match(new RegExp(`<article[^>]+data-stat-point-key="${key}"[^>]*>`))?.[0] || '';
    const control = controls.find((match) => match[1] === key)?.[0] || '';
    const nodeAccent = node.match(/--path-accent:(#[0-9a-f]+)/i)?.[1];
    const controlAccent = control.match(/--path-accent:(#[0-9a-f]+)/i)?.[1];

    assert.match(control, new RegExp(`ascension-multi-add-trigger is-${side}`));
    assert.equal(controlAccent, nodeAccent);
  });
});

test('multi-add modal validates draft points and remembers the last positive amount', () => {
  assert.match(markup, /id="skillTreeMultiAddInput"[^>]+type="number"[^>]+min="1"[^>]+step="1"/);
  assert.match(markup, /id="skillTreeMultiAddButton">Add points<\/button>/);
  assert.match(script, /state\.draft = \{ \.\.\.state\.draft, \[key\]: current \+ amount \}/);
  assert.match(script, /if \(!amount \|\| amount > available\)/);
  assert.match(script, /localStorage\.setItem\(MULTI_ADD_AMOUNT_STORAGE_KEY, String\(amount\)\)/);
  assert.match(script, /localStorage\.getItem\(MULTI_ADD_AMOUNT_STORAGE_KEY\)/);
  assert.match(styles, /\.ascension-multi-add-trigger\s*{[^}]*var\(--path-accent\)/s);
});

test('multi-add plus is geometrically centered and the AoE control keeps the standard gap', () => {
  assert.match(styles, /\.ascension-multi-add-trigger > span::before,\s*\.ascension-multi-add-trigger > span::after\s*{[^}]*top:\s*50%;[^}]*left:\s*50%;[^}]*transform:\s*translate\(-50%, -50%\);/s);
  assert.match(styles, /\.ascension-multi-add-trigger > span::before\s*{[^}]*width:\s*0\.78rem;[^}]*height:\s*1\.5px;/s);
  assert.match(styles, /\.ascension-multi-add-trigger > span::after\s*{[^}]*width:\s*1\.5px;[^}]*height:\s*0\.78rem;/s);
  assert.match(markup, /data-stat-point-key="aoe_mastery" style="--node-x:93\.333%;/);
  assert.match(markup, /data-multi-add-key="aoe_mastery" style="--node-x:93\.333%;--node-y:67\.708%;--path-accent:#6fd6bd"/);
});
