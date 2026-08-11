const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

test('Settings offers opt-in Dungeon flow preferences', () => {
  const html = read('public', 'app', 'settings.html');
  const settingsSource = read('public', 'app', 'js', 'settings-ui.js');

  assert.match(html, /id="dungeonSettingsHeading">Dungeon</);
  assert.match(html, /id="settingsAutoResolveDungeonFights"/);
  assert.match(html, /Resolve dungeon fights automatically/);
  assert.match(html, /id="settingsHideRecruitFirstModal"/);
  assert.match(html, /Do not show “Recruit First\?”/);
  assert.match(settingsSource, /DUNGEON_AUTO_RESOLVE_KEY = 'amongdemons-dungeon-auto-resolve'/);
  assert.match(settingsSource, /DUNGEON_HIDE_RECRUIT_FIRST_MODAL_KEY = 'amongdemons-dungeon-hide-recruit-first-modal'/);
  assert.match(settingsSource, /bindPreferenceToggle\(elements\.autoResolveDungeonFights, DUNGEON_AUTO_RESOLVE_KEY, false\)/);
  assert.match(settingsSource, /bindPreferenceToggle\(elements\.hideRecruitFirstModal, DUNGEON_HIDE_RECRUIT_FIRST_MODAL_KEY, false\)/);
});

test('auto-resolve skips combat playback but keeps result animation and replay', () => {
  const lifecycle = read('public', 'app', 'js', 'dungeon', 'lifecycle.js');
  const battle = lifecycle.match(/async function battle\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  const replay = lifecycle.match(/async function replayFight\(options = \{\}\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(battle, /const autoResolve = shouldAutoResolveDungeonFights\(\)/);
  assert.match(battle, /state\.run\.team = cloneDemons\(lastBattle\.playerTeamAfter/);
  assert.match(battle, /state\.run\.enemies = cloneDemons\(lastBattle\.enemyTeamAfter/);
  assert.match(battle, /if \(autoResolve\) \{\s+clearSkippedBattleAnimationState\(\)/);
  assert.match(battle, /else \{\s+await playCombatLog\(playbackResult\)/);
  assert.match(battle, /const resultOverlay = showBattleResultOverlay\(won \? 'victory' : 'defeat'\)/);
  assert.match(battle, /const resultOverlay = showBattleResultOverlay\('defeat'\)/);
  assert.match(battle, /const resultOverlay = showBattleResultOverlay\('victory'\)/);
  assert.match(replay, /await playCombatLog\(/);
  assert.doesNotMatch(replay, /shouldAutoResolveDungeonFights/);
});

test('Recruit First confirmation respects its opt-out preference', () => {
  const lifecycle = read('public', 'app', 'js', 'dungeon', 'lifecycle.js');
  const confirmationCheck = lifecycle.match(/function shouldConfirmShortTeamContinue\(\) \{[\s\S]*?\n\}/)?.[0] || '';

  assert.match(confirmationCheck, /if \(shouldHideRecruitFirstModal\(\)\) return false/);
  assert.match(confirmationCheck, /getRecruitPreviewTeam\(\)\.length < getRecruitTeamLimit\(\)/);
});
