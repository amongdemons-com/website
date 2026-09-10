const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const sharedStyles = fs.readFileSync(path.join(root, 'public', 'app', 'css', 'base.css'), 'utf8');
const campStyles = fs.readFileSync(path.join(root, 'public', 'app', 'css', 'camp.css'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'public', 'app', 'css', 'battle.css'), 'utf8');
const combatSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'combat.js'), 'utf8');
const handSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'hand.js'), 'utf8');
const cardsSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'cards.js'), 'utf8');
const renderSource = fs.readFileSync(path.join(root, 'public', 'app', 'js', 'dungeon', 'render.js'), 'utf8');
const dungeonHtml = fs.readFileSync(path.join(root, 'public', 'app', 'dungeon.html'), 'utf8');

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

test('dungeon hand only exposes demon cards and keeps buffs in the formation summaries', () => {
  assert.doesNotMatch(dungeonHtml, /dungeon-hand-tabs|data-dungeon-hand-tab|dungeonMobileBuffsBtn/);
  assert.doesNotMatch(handSource, /renderHandPactTags|getHandBuffs|activeHandTab/);
  assert.doesNotMatch(renderSource, /dungeonMobileHandBtn|dungeonMobileBuffsBtn|setDungeonMobileHandTab/);
  assert.match(renderSource, /renderBattleBuffSummaryChip\(teamBuffs, \{ side: 'enemy' \}\)/);
  assert.match(renderSource, /renderBattleBuffSummaryChip\(buffs, \{ side: 'player' \}\)/);
});

test('demon death tilt is scoped to the artwork while the card keeps defeated grayscale', () => {
  assert.doesNotMatch(styles, /\.dungeon-demon-card\.is-dying\s*\{[^}]*animation:\s*demon-death-fall/s);
  assert.match(styles, /\.dungeon-demon-card\.is-dying \.dungeon-demon-card-image img\s*\{[^}]*animation:\s*demon-death-fall/s);
  assert.match(styles, /\.dungeon-demon-card\.is-defeated\s*\{[^}]*filter:\s*grayscale\(0\.75\)/s);
});

test('demon reactions stay on the artwork and preserve enemy mirroring', () => {
  assert.doesNotMatch(styles, /\.dungeon-demon-card\.is-attacking\s*\{[^}]*animation:/s);
  assert.doesNotMatch(styles, /\.dungeon-demon-card\.is-shaking\s*\{[^}]*animation:/s);
  assert.doesNotMatch(styles, /\.dungeon-demon-card\.is-hit\s*\{[^}]*animation:/s);
  assert.doesNotMatch(styles, /\.dungeon-demon-card\.is-poison-tick\s*\{[^}]*animation:/s);
  assert.match(styles, /\.dungeon-demon-card\.is-attacking \.dungeon-demon-card-image img\s*\{[^}]*animation:\s*demon-attack-hop/s);
  assert.match(styles, /\.dungeon-demon-card\.is-shaking \.dungeon-demon-card-image img\s*\{[^}]*animation:\s*demon-target-shake/s);
  assert.match(styles, /\.dungeon-demon-card\.is-hit \.dungeon-demon-card-image img\s*\{[^}]*animation:\s*demon-hit-flinch/s);
  assert.match(styles, /\.battle-side-enemy \.dungeon-demon-card-image img[\s\S]*?--demon-image-scale-x:\s*-1;[\s\S]*?transform:\s*scaleX\(var\(--demon-image-scale-x\)/s);
  assert.match(sharedStyles, /@keyframes demon-death-fall[\s\S]*?scaleX\(var\(--demon-image-scale-x, 1\)\)/s);
  assert.match(sharedStyles, /@keyframes demon-target-shake[\s\S]*?scaleX\(var\(--demon-image-scale-x, 1\)\)/s);
});

test('battle and level-up effects retain intended transparency', () => {
  assert.match(sharedStyles, /\.dark-spike::before\s*\{[^}]*background:\s*#000;/s);
  assert.match(sharedStyles, /\.dark-spike::after\s*\{[^}]*background:\s*linear-gradient\([^;]*rgba\(143,164,183,0\)/s);
  assert.match(sharedStyles, /\.combat-impact-core\s*\{[^}]*background:\s*radial-gradient\([^;]*transparent 72%\)/s);
  assert.match(sharedStyles, /\.combat-impact-particle\s*\{[^}]*background:\s*linear-gradient\([^;]*transparent\)/s);

  for (const [animation, keyframe, opacity] of [
    ['fireball-ember-fade', '24%', '0.88'],
    ['fire-nova-flash', '18%', '0.95'],
    ['fire-spark-flicker', '52%', '0.92'],
    ['poison-bubble-flame', '58%', '0.86'],
    ['heal-ring-rise', '72%', '0.72'],
    ['chaos-lightning-flash', '36%', '0.38'],
    ['level-up-spark', '74%', '0.86']
  ]) {
    assert.match(
      sharedStyles,
      new RegExp(`@keyframes ${animation}[\\s\\S]*?${keyframe}\\s*\\{[\\s\\S]*?opacity:\\s*${opacity};`)
    );
  }

  assert.match(sharedStyles, /\.level-up-celebration-vignette\s*\{[\s\S]*?conic-gradient\([^;]*transparent/s);
  assert.match(sharedStyles, /\.level-up-beams\s*\{[\s\S]*?repeating-conic-gradient\([^;]*transparent/s);
  assert.match(campStyles, /\.nav-xp-progress\.is-level-up-anchored::after[\s\S]*?linear-gradient\(90deg, transparent/s);
});

test('battle projectile sizing matches the type-specific VFX brief', () => {
  assert.match(combatSource, /const radius = \(2\.2 \+ \(\(index % 4\) \* 0\.8\)\) \* 2;/);
  assert.match(combatSource, /<circle class="fireball-core" cx="0" cy="0" r="17" \/>/);
  assert.match(combatSource, /<circle class="fireball-hot" cx="7\.2" cy="-4\.4" r="8\.4" \/>/);
  assert.match(combatSource, /<circle class="fireball-core" cx="0" cy="0" r="22" \/>/);
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
