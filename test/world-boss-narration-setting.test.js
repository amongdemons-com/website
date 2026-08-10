const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('Settings offers a World boss narration preference', () => {
  const html = fs.readFileSync(path.join(ROOT, 'public', 'app', 'settings.html'), 'utf8');
  const settingsSource = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'settings-ui.js'), 'utf8');

  assert.match(html, /id="worldSettingsHeading">World</);
  assert.match(html, /id="settingsBossNarration"/);
  assert.match(html, /Boss narration/);
  assert.match(settingsSource, /WORLD_BOSS_NARRATION_KEY = 'amongdemons-world-boss-narration'/);
  assert.match(settingsSource, /setPreferenceEnabled\(WORLD_BOSS_NARRATION_KEY/);
});

test('explicit boss narration preference overrides the separate 24-hour mute', () => {
  const source = fs.readFileSync(path.join(ROOT, 'public', 'app', 'js', 'world-ui.js'), 'utf8');
  const muteCheck = source.match(/function isWorldBossIntroMuted\(\) \{[\s\S]*?\n  \}/)?.[0] || '';

  assert.match(source, /WORLD_BOSS_NARRATION_KEY = 'amongdemons-world-boss-narration'/);
  assert.match(source, /WORLD_BOSS_INTRO_MUTE_KEY = 'amongdemons-world-boss-mute'/);
  assert.match(muteCheck, /narrationPreference !== null/);
  assert.ok(
    muteCheck.indexOf('WORLD_BOSS_NARRATION_KEY') < muteCheck.indexOf('WORLD_BOSS_INTRO_MUTE_KEY'),
    'the explicit Settings preference must be checked before the temporary mute'
  );
});
