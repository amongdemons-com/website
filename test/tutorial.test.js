const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  TUTORIAL_CHECKPOINTS,
  applyTutorialMutation,
  calculateTutorialTrainingTopUp,
  chooseMergedTutorialProgress
} = require('../public/api/lib/tutorial');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');
const NOW = new Date('2026-08-11T10:00:00.000Z');

test('tutorial starts for an account and only moves forward', () => {
  const started = applyTutorialMutation(progress(), { action: 'start' }, NOW);
  assert.equal(started.status, 'in_progress');
  assert.equal(started.checkpoint, 'world-map');
  assert.equal(started.startedAt, NOW);

  const advanced = applyTutorialMutation(started, {
    action: 'advance',
    checkpoint: 'dungeon-prepare'
  }, NOW);
  assert.equal(advanced.checkpoint, 'dungeon-prepare');

  const stale = applyTutorialMutation(advanced, {
    action: 'advance',
    checkpoint: 'world-team'
  }, NOW);
  assert.equal(stale.checkpoint, 'dungeon-prepare');
});

test('skip and completion are terminal until an explicit Settings restart', () => {
  const skipped = applyTutorialMutation(progress(), { action: 'skip' }, NOW);
  assert.equal(skipped.status, 'skipped');
  assert.equal(applyTutorialMutation(skipped, { action: 'start' }, NOW).status, 'skipped');

  const restarted = applyTutorialMutation(skipped, { action: 'restart' }, NOW);
  assert.equal(restarted.status, 'in_progress');
  assert.equal(restarted.checkpoint, 'world-map');
  assert.equal(restarted.skippedAt, null);

  const completed = applyTutorialMutation(restarted, { action: 'complete' }, NOW);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.checkpoint, 'complete');
  assert.equal(completed.guides.training.completed, true);
  assert.equal(applyTutorialMutation(completed, { action: 'skip' }, NOW).status, 'completed');
  assert.equal(applyTutorialMutation(completed, { action: 'restart' }, NOW).status, 'in_progress');
});

test('tutorial rejects invalid or out-of-sequence mutations', () => {
  assert.throws(
    () => applyTutorialMutation(progress(), { action: 'advance', checkpoint: 'world-team' }, NOW),
    /Start the tutorial/
  );
  const started = applyTutorialMutation(progress(), { action: 'start' }, NOW);
  assert.throws(
    () => applyTutorialMutation(started, { action: 'advance', checkpoint: 'not-real' }, NOW),
    /valid tutorial checkpoint/
  );
  assert.throws(
    () => applyTutorialMutation(started, { action: 'advance', checkpoint: 'complete' }, NOW),
    /complete action/
  );
});

test('account merge keeps terminal progress or the furthest active checkpoint', () => {
  const active = progress({ status: 'in_progress', checkpoint: 'dungeon-prepare', updated_at: '2026-08-10' });
  const skipped = progress({ player_id: 'source', status: 'skipped', checkpoint: 'world-team', skipped_at: NOW });
  const terminal = chooseMergedTutorialProgress([active, skipped]);
  assert.equal(terminal.status, 'skipped');

  const completed = progress({ player_id: 'source', status: 'completed', checkpoint: 'world-map', completed_at: NOW });
  const completeWinner = chooseMergedTutorialProgress([skipped, completed]);
  assert.equal(completeWinner.status, 'completed');
  assert.equal(completeWinner.checkpoint, 'complete');

  const farther = progress({ player_id: 'source', status: 'in_progress', checkpoint: 'bag-echo' });
  assert.equal(chooseMergedTutorialProgress([active, farther]).checkpoint, 'bag-echo');

  const contextual = chooseMergedTutorialProgress([
    progress({ summon_guide_completed: 1, skill_tree_guide_pending: 1, training_souls_granted: 1 }),
    progress({ player_id: 'source', training_guide_completed: 1 })
  ]);
  assert.equal(contextual.guides.summon.completed, true);
  assert.equal(contextual.guides.training.completed, true);
  assert.equal(contextual.trainingSoulsGranted, true);
  assert.equal(contextual.guides.skillTree.pending, true);
});

test('training tutorial tops up only the deficit for one attempt', () => {
  const demons = [
    { id: 10, training: { maxed: true, cost: null } },
    { id: 20, training: { maxed: false, cost: 7 } },
    { id: 30, training: { maxed: false, cost: 3 } }
  ];
  assert.deepEqual(calculateTutorialTrainingTopUp(demons, 2), {
    demonId: 20,
    cost: 7,
    amount: 5
  });
  assert.equal(calculateTutorialTrainingTopUp(demons, 10).amount, 0);
  assert.deepEqual(calculateTutorialTrainingTopUp([{ id: 10, training: { maxed: true } }], 0), {
    demonId: null,
    cost: 0,
    amount: 0
  });
});

test('contextual guides persist independently from the replayable core tutorial', () => {
  const summon = applyTutorialMutation(progress({ status: 'completed' }), {
    action: 'complete-guide',
    guide: 'summon'
  }, NOW);
  assert.equal(summon.guides.summon.completed, true);

  const pendingSkillTree = applyTutorialMutation(summon, {
    action: 'trigger-guide',
    guide: 'skill-tree'
  }, NOW);
  assert.equal(pendingSkillTree.guides.skillTree.pending, true);

  const finishedSkillTree = applyTutorialMutation(pendingSkillTree, {
    action: 'complete-guide',
    guide: 'skill-tree'
  }, NOW);
  assert.equal(finishedSkillTree.guides.skillTree.pending, false);
  assert.equal(finishedSkillTree.guides.skillTree.completed, true);

  const replayed = applyTutorialMutation(finishedSkillTree, { action: 'restart' }, NOW);
  assert.equal(replayed.status, 'in_progress');
  assert.equal(replayed.guides.skillTree.completed, true);
});

test('tutorial is account-backed for all accounts and wired across the real game journey', () => {
  const schema = read('public', 'api', 'lib', 'schema.js');
  const serverTutorial = read('public', 'api', 'lib', 'tutorial.js');
  const api = read('public', 'api', 'account', 'tutorial.js');
  const worldApi = read('public', 'api', 'world.js');
  const deletion = read('public', 'api', 'lib', 'account-deletion.js');
  const merge = read('public', 'api', 'lib', 'account-merge.js');
  const client = read('public', 'app', 'js', 'tutorial.js');
  const runtime = read('scripts', 'browser-runtime-entry.js');
  const world = read('public', 'app', 'js', 'world-ui.js');
  const dungeon = read('public', 'app', 'js', 'dungeon', 'lifecycle.js');
  const rewards = read('public', 'app', 'js', 'dungeon', 'rewards.js');
  const bag = read('public', 'app', 'js', 'bag-ui.js');
  const collection = read('public', 'app', 'js', 'collection-ui.js');
  const skillTree = read('public', 'app', 'js', 'skill-tree-ui.js');
  const dungeonPage = read('public', 'app', 'dungeon.html');
  const settings = read('public', 'app', 'settings.html');
  const css = read('public', 'app', 'css', 'base.css');
  const worldCss = read('public', 'app', 'css', 'world.css');
  const lucideSubset = read('public', 'app', 'js', 'lucide-subset.js');

  assert.deepEqual(TUTORIAL_CHECKPOINTS, [
    'world-map',
    'world-team',
    'world-travel',
    'dungeon-prepare',
    'dungeon-extract',
    'bag-echo',
    'collection-training',
    'world-hunt-rewards',
    'complete'
  ]);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS player_tutorials/);
  assert.match(schema, /PLAYER_TUTORIAL_SCHEMA_MIGRATION/);
  assert.match(schema, /runMigrationOnce\(PLAYER_TUTORIAL_SCHEMA_MIGRATION, addPlayerTutorialSchema\)/);
  assert.match(schema, /PLAYER_TUTORIAL_GUIDES_SCHEMA_MIGRATION/);
  assert.match(schema, /PLAYER_TUTORIAL_TRAINING_GRANT_SCHEMA_MIGRATION/);
  assert.match(schema, /STARTER_TYPE_3_COMMON_ECHO_BACKFILL_MIGRATION/);
  assert.match(schema, /SELECT id, 'echo:3:common', 'echo', 1[\s\S]*?FROM players/);
  assert.match(schema, /training_souls_granted/);
  assert.match(schema, /summon_guide_completed/);
  assert.match(schema, /skill_tree_guide_pending/);
  assert.match(serverTutorial, /INSERT INTO player_tutorials[\s\S]*?'not_started'/);
  assert.match(serverTutorial, /grantTutorialTrainingSouls/);
  assert.match(serverTutorial, /UPDATE players SET souls = souls \+ \?/);
  assert.match(api, /router\.get\('\/account\/tutorial', requireAuth/);
  assert.match(api, /router\.post\('\/account\/tutorial\/restart'/);
  assert.match(deletion, /'player_tutorials'/);
  assert.match(merge, /mergePlayerTutorialProgress/);

  assert.match(runtime, /tutorial\.js/);
  assert.match(client, /Skip tutorial/);
  assert.match(client, /replay the tutorial from Settings/);
  assert.match(client, /Tutorial unavailable\./);
  assert.match(client, /prefers-reduced-motion|TOTAL_MOMENTS/);
  assert.match(client, /Start with a melee demon/);
  assert.match(client, /Protect a ranged demon/);
  assert.match(client, /syncMobileTutorialSurfaces/);
  assert.match(client, /worldMapPanelPrepared/);
  assert.match(client, /worldTeamPanelPrepared/);
  assert.match(client, /href: '\/events'/);
  assert.match(client, /href: '\/bosses'/);
  assert.match(client, /applyWorldTeamRoleHighlights/);
  assert.match(client, /duplicate demons are allowed/);
  assert.match(client, /getActionDrivenWorldTravelView/);
  assert.match(client, /TUTORIAL_WORLD_SPOT = Object\.freeze\(\{ x: 0, y: -3 \}\)/);
  assert.match(client, /Travel to Area 0, -3/);
  assert.match(client, /target: \['#worldTutorialSpotAnchor',[\s\S]*?placement: 'top'/);
  assert.match(client, /suppressFocusRing: true/);
  assert.match(client, /waitForAmbushConfirmation/);
  assert.match(client, /primaryLabel: 'Got it'/);
  assert.match(client, /primaryLabel: 'Open Panel'/);
  assert.match(client, /Fight to unlock this spot/);
  assert.match(client, /Hunt the defeated spot/);
  assert.match(client, /Claim the Hunt rewards/);
  assert.match(client, /world-hunt-rewards/);
  assert.match(client, /While the Hunt gathers Souls/);
  assert.match(client, /Enter Your First Dungeon/);
  assert.match(client, /Enter First Dungeon/);
  assert.match(client, /worldTutorialSpotAnchor/);
  assert.match(client, /choiceTargets/);
  assert.match(client, /Hunt defeated spots/);
  assert.match(client, /Recruit now or fight as-is/);
  assert.match(client, /You can add more demons from Hand/);
  assert.match(client, /Option 1 of 2: Fight another floor/);
  assert.match(client, /Option 2 of 2: Extract safely/);
  assert.match(client, /primaryLabel: 'Show Extraction Option'/);
  assert.match(client, /primaryLabel: 'Open Extraction'/);
  assert.match(client, /secondaryLabel: 'Review Fight Option'/);
  assert.match(client, /You can close and reopen this tray at any time/);
  assert.match(client, /isCurrentCheckpoint\('dungeon-extract'\)\) model\.localSteps\.dungeonExtract = 1/);
  assert.match(client, /target\?\.closest\?\.\('#dungeonMobileExtractBtn'\)[\s\S]*?model\.localSteps\.dungeonExtract = 1/);
  const dungeonExtractView = /function getDungeonExtractView\(progress\)([\s\S]*?)function getBagEchoView/.exec(client)?.[1] || '';
  assert.ok(
    dungeonExtractView.indexOf('if (compact && mobileExtractButton && !mobileRewardOpen)')
      < dungeonExtractView.indexOf('if (selectedReward && rewardExtractButton)'),
    'closed mobile extraction state must be handled before its transitioning contents'
  );
  assert.doesNotMatch(dungeonExtractView, /Your Echo is selected/);
  assert.match(client, /Watch the summon meter/);
  assert.match(client, /Refine surplus Echoes/);
  assert.match(client, /Train permanent demons/);
  assert.match(client, /Continue to Collection/);
  assert.match(client, /Summon a permanent demon/);
  assert.match(client, /#bagSummonModal\.show a\[href="\/collection"\]/);
  assert.match(client, /Your permanent demon is ready/);
  assert.match(client, /getCollectionTrainingView/);
  assert.match(client, /Train once with Souls/);
  assert.match(client, /Click on a demon card/);
  assert.match(client, /revealMobileWorldTeamCollection/);
  assert.match(client, /mobileDock: 'bottom'/);
  assert.match(client, /positionCompactTutorial/);
  assert.match(client, /getVerticalOverlap/);
  assert.match(client, /getTutorialTargetRect/);
  assert.match(client, /\.game-nav-link, \.game-nav-dropdown-item/);
  assert.match(client, /scheduleSettledPosition/);
  assert.match(client, /getTutorialViewRenderKey/);
  assert.match(client, /model\.renderKey !== renderKey/);
  assert.match(client, /model\.currentView\?\.onPrimary\?\.\(\)/);
  assert.match(client, /isCoreActive/);
  const echoSecuredView = /if \(checkpoint === 'bag-echo'[\s\S]*?\n    \}/.exec(client)?.[0] || '';
  assert.doesNotMatch(echoSecuredView, /choiceTargets/);
  assert.match(client, /mobilePlacement/);
  assert.match(css, /\.tutorial-coachmark/);
  assert.match(css, /\.tutorial-progress-rail/);
  assert.match(css, /--tutorial-gold:/);
  assert.match(css, /\.tutorial-coachmark-actions \.btn-primary\s*\{[\s\S]*?border-image:\s*none !important;[\s\S]*?background:\s*#d8ad55;[\s\S]*?box-shadow:\s*none;[\s\S]*?text-shadow:\s*none;/);
  assert.match(css, /\.tutorial-coachmark-actions \.btn-primary::before\s*\{\s*content:\s*none;/);
  assert.doesNotMatch(css, /radial-gradient\(circle at 7% -10%/);
  assert.match(client, /tutorial-coachmark-progress"><strong>Tutorial<\/strong>/);
  assert.match(css, /\.tutorial-facts/);
  assert.match(css, /\.tutorial-fact\.is-link/);
  assert.match(css, /\.tutorial-coachmark-host\s*\{[\s\S]*?z-index:\s*2147482000/);
  assert.match(css, /\.tutorial-coachmark-host\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(css, /\.tutorial-coachmark\s*\{[\s\S]*?pointer-events:\s*auto/);
  assert.match(css, /@media \(max-width: 767\.98px\)/);
  assert.match(css, /\.tutorial-coachmark-host\.is-centered \.tutorial-coachmark\s*\{[\s\S]*?width:\s*min\(22rem, calc\(100vw - 1rem\)\)/);
  assert.doesNotMatch(css, /\.tutorial-coachmark\s*\{[\s\S]*?top:\s*auto\s*!important/);
  assert.match(world, /tutorial\?\.emit\?\.\('world-team-saved'/);
  assert.match(world, /tutorial\?\.emit\?\.\('world-route-previewed'/);
  assert.match(world, /tutorial\?\.emit\?\.\('world-map-explored'/);
  assert.match(world, /tutorial\?\.emit\?\.\('world-team-editor-changed'/);
  assert.match(world, /function moveWorldTeamEditorSlotEntry[\s\S]*?tutorial\?\.emit\?\.\('world-team-editor-changed'/);
  assert.match(world, /waitForAmbushConfirmation/);
  assert.match(world, /tutorial\?\.emit\?\.\('world-hunt-fight'/);
  assert.match(world, /tutorial\?\.emit\?\.\('world-hunt-started'/);
  assert.match(world, /tutorial\?\.emit\?\.\('world-hunt-claimed'/);
  assert.match(world, /isCoreTutorialActive/);
  assert.match(world, /tutorial\?\.isCoreActive\?\.\(\)/);
  assert.match(lucideSubset, /"hand-coins"/);
  assert.match(world, /data-world-team-position/);
  assert.match(world, /getNextWorldTeamEditorOpenSlotForPosition/);
  assert.match(worldCss, /\.tutorial-role-candidate/);
  assert.match(worldCss, /\.tutorial-role-slot/);
  assert.match(worldCss, /tutorial-role-front-guide/);
  assert.match(worldCss, /tutorial-role-back-guide/);
  assert.match(worldCss, /\.world-tutorial-spot-anchor\s*\{[\s\S]*?border:\s*0;/);
  assert.match(worldCss, /\.world-tutorial-spot-anchor\s*\{[\s\S]*?animation:\s*worldTutorialSpotGlow/);
  assert.match(client, /title: 'Travel to Area 0, -3'[\s\S]*?placementGap:\s*36,[\s\S]*?suppressFocusRing:\s*true/);
  assert.match(dungeon, /tutorial\?\.emit\?\.\('dungeon-state'/);
  assert.match(rewards, /tutorial\?\.emit\?\.\('dungeon-extracted'/);
  assert.match(bag, /tutorial\?\.emit\?\.\('bag-ready'/);
  assert.match(bag, /readyUnownedKey/);
  assert.match(bag, /tutorial\?\.emit\?\.\('demon-summoned'/);
  assert.match(bag, /bagSummonModal\.addEventListener\('shown\.bs\.modal'[\s\S]*?'demon-summoned'/);
  assert.match(collection, /tutorial\?\.emit\?\.\('collection-ready'/);
  assert.match(collection, /trainingDemonId/);
  assert.match(collection, /trainingCost/);
  assert.match(collection, /tutorial\?\.emit\?\.\('demon-trained'/);
  assert.match(collection, /function revealTrainingOutcome[\s\S]*?showTrainingResult[\s\S]*?tutorial\?\.emit\?\.\('demon-trained'/);
  assert.match(client, /Now that we\\'re done training, let\\'s go back to check on our Hunt results\./);
  assert.match(client, /primaryLabel: 'Check Hunt Results'/);
  const trainingCompleteView = /if \(collection\.trainingComplete\) \{([\s\S]*?)\n    \}/.exec(client)?.[1] || '';
  assert.match(trainingCompleteView, /centered: true/);
  assert.doesNotMatch(trainingCompleteView, /target:/);
  assert.match(client, /if \(trainOnce\.classList\.contains\('is-training'\)\) return \{ hidden: true \}/);
  assert.doesNotMatch(client, /Echoes lead to permanent demons/);
  assert.match(client, /if \(summonInProgress\) return \{ hidden: true \}/);
  assert.match(client, /if \(summonResultPrepared && !bag\.summoned\) return \{ hidden: true \}/);
  assert.match(client, /The Echo has finished summoning[\s\S]*?primaryLabel: 'Next'/);
  assert.match(skillTree, /tutorial\?\.emit\?\.\('skill-tree-ready'/);
  assert.match(skillTree, /tutorial\?\.emit\?\.\('skill-tree-saved'/);
  assert.match(dungeonPage, /id="shortTeamCount"/);
  assert.match(settings, /id="settingsRestartTutorial"/);

  const starterEcho = read('public', 'api', 'lib', 'starter-echo.js');
  const register = read('public', 'api', 'auth', 'register.js');
  const guest = read('public', 'api', 'auth', 'guest.js');
  assert.match(starterEcho, /STARTER_ECHO_TYPE_ID = 3/);
  assert.match(starterEcho, /STARTER_ECHO_RARITY = 'common'/);
  assert.match(register, /grantStarterEcho\(playerId\)/);
  assert.match(guest, /grantStarterEcho\(playerId\)/);
  assert.match(client, /\.dungeon-result-actions a\[href="\/bag"\]/);
  assert.doesNotMatch(client, /title: 'Fight in progress'/);
  assert.doesNotMatch(client, /title: 'The next fight is underway'/);
  assert.match(client, /if \(dungeon\.battleActive\) \{\s*return \{ hidden: true \};\s*\}/);
  assert.doesNotMatch(client, /title: 'Your stronger demon is ready'/);
  assert.match(client, /tutorial\.checkpoint === 'world-hunt-rewards'[\s\S]*?!model\.automaticUi\.worldHuntRewardsPanelPrepared/);
  assert.match(worldApi, /id: 'tutorial-baobaw'[\s\S]*?x: 0,[\s\S]*?y: -3/);
  assert.match(worldApi, /species: 'Baobaw'[\s\S]*?rarity: 'common'/);
  assert.match(worldApi, /team: \[\{[\s\S]*?instanceId: 'tutorial-baobaw-m1'[\s\S]*?\}\]/);
  assert.match(worldApi, /return tutorial\?\.status === 'in_progress' \? TUTORIAL_WORLD_ENCOUNTER : null/);
  const tutorialCompleteView = /title: 'Hunt rewards secured'([\s\S]*?)\n      \};/.exec(client)?.[1] || '';
  assert.match(tutorialCompleteView, /centered: true/);
  assert.doesNotMatch(tutorialCompleteView, /target:/);
  assert.match(tutorialCompleteView, /primaryLabel: 'Finish Tutorial'/);
  const huntStartedHandler = /name === 'world-hunt-started'[\s\S]*?\} else if \(name === 'world-hunt-claimed'/.exec(client)?.[0] || '';
  assert.doesNotMatch(huntStartedHandler, /advance\('dungeon-prepare'/);
});

function progress(overrides = {}) {
  return {
    player_id: 'target',
    tutorial_key: 'core-onboarding',
    version: 1,
    status: 'not_started',
    checkpoint: 'world-map',
    started_at: null,
    completed_at: null,
    skipped_at: null,
    created_at: '2026-08-11T00:00:00.000Z',
    updated_at: '2026-08-11T00:00:00.000Z',
    ...overrides
  };
}
