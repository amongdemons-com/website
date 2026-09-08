const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const styles = fs.readFileSync(path.join(root, 'public', 'app', 'css', 'battle.css'), 'utf8');
const handSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'hand.js'), 'utf8');
const cardsSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'cards.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'render.js'), 'utf8');

test('dungeon hand scroll controls are available outside mobile portrait', () => {
  const globalShellRule = styles.match(/\.dungeon-hand-scroll-shell\s*\{[^}]*display:\s*grid;[^}]*\}/s);
  const portraitMediaIndex = styles.indexOf('@media (max-width: 575.98px) and (orientation: portrait)');

  assert.ok(globalShellRule, 'the default hand shell should provide the scroll-control grid');
  assert.ok(globalShellRule.index < portraitMediaIndex, 'the scroll-control grid should not be portrait-only');
  assert.match(styles, /\.dungeon-hand-scroll-viewport\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(
    styles,
    /\.dungeon-hand-scroll-shell\.has-scroll-overflow \.dungeon-hand-scroll-btn:not\(\[hidden\]\)\s*\{\s*display:\s*grid;/s
  );
});

test('dungeon hand scroll buttons only appear when the viewport overflows', () => {
  assert.match(handSource, /const hasOverflow = viewport\.scrollWidth > viewport\.clientWidth \+ 1;/);
  assert.match(handSource, /shell\.classList\.toggle\('has-scroll-overflow', hasOverflow\);/);
  assert.match(handSource, /button\.hidden = !hasOverflow;/);
});

test('upgrade-highlighted recruit hands retain the scroll-control grid', () => {
  assert.match(
    styles,
    /@media \(min-width: 576px\)[\s\S]*?#dungeonHandBar:has\(\.dungeon-demon-card\.is-team-upgrade\) \.dungeon-hand-scroll-shell\s*\{[^}]*display:\s*grid;/s
  );
});

test('upgrade-highlighted hand cards paint above the hand frame', () => {
  assert.match(
    styles,
    /\.dungeon-hand-cards \.dungeon-demon-card\.is-team-upgrade::after\s*\{[^}]*border:\s*2px solid #FEC550;/s
  );
  assert.doesNotMatch(styles, /\.dungeon-hand-cards \.dungeon-demon-card\.is-team-upgrade\s*\{[^}]*transform:/s);
  assert.match(
    styles,
    /\.dungeon-hand-cards \.dungeon-demon-card\.is-team-upgrade > \.dungeon-team-upgrade-indicator\s*\{[^}]*top:\s*0\.28rem;/s
  );
  assert.doesNotMatch(styles, /@keyframes team-upgrade-gold-pulse/);
  assert.doesNotMatch(styles, /\.dungeon-hand-cards \.dungeon-demon-card\.is-team-upgrade::after\s*\{[^}]*animation:/s);
  assert.match(
    styles,
    /#dungeonHandBar:has\(\.dungeon-demon-card\.is-team-upgrade\) \.dungeon-demon-card\.is-team-upgrade\s*\{\s*z-index:\s*10;/s
  );
});

test('weaker team cards receive deduplicated swap targets from highlighted hand upgrades', () => {
  assert.match(handSource, /function getHandUpgradeTargetInstanceIds\(hand = \[\], team = \[\]\)/);
  assert.match(handSource, /targetIds\.add\(String\(instanceId\)\)/);
  assert.match(handSource, /candidateTypeId[\s\S]*?isBetterDemon\(candidate, teamDemon\)/);
  assert.match(renderSource, /const teamUpgradeTargetInstanceIds = shouldHighlightHandUpgrades\(handInteractive, handMode\)/);
  assert.match(renderSource, /teamUpgradeTargetInstanceIds,\s*\n\s*gridStyle: teamGridStyle/);
  assert.match(cardsSource, /isTeamUpgradeTarget = isPlayer && teamUpgradeTargetIds\.has\(String\(demon\.instanceId\)\)/);
  assert.match(cardsSource, /isTeamUpgradeTarget \? 'is-team-upgrade-target' : ''/);
});

test('team swap targets use the same flat gold border and downward arrows', () => {
  assert.match(
    styles,
    /\.battle-side-player \.dungeon-demon-card\.is-team-upgrade-target::after\s*\{[^}]*border:\s*2px solid #FEC550;/s
  );
  assert.match(
    styles,
    /\.battle-side-player \.dungeon-demon-card\.is-team-upgrade-target > \.dungeon-team-downgrade-indicator\s*\{[^}]*animation:\s*team-upgrade-arrows-pulse 900ms ease-in-out infinite;/s
  );
  assert.match(cardsSource, /renderTeamUpgradeArrow\('arrow-down'\)/);
  assert.match(cardsSource, /dungeon-team-upgrade-arrow-outline/);
  assert.match(cardsSource, /aria-label="Swap out for an upgrade"/);
  assert.match(fs.readFileSync(path.join(root, 'public', 'app', 'js', 'lucide-subset.js'), 'utf8'), /"arrow-down"/);
});
