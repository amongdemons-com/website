const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

test('Settings offers an opt-in low-power world map preference', () => {
  const html = read('public', 'app', 'settings.html');
  const settingsSource = read('public', 'app', 'js', 'settings-ui.js');

  assert.match(html, /id="settingsWorldLowPower"/);
  assert.match(html, /Low-power world map/);
  assert.match(settingsSource, /WORLD_LOW_POWER_KEY = 'amongdemons-world-low-power'/);
  assert.match(settingsSource, /bindPreferenceToggle\(elements\.worldLowPower, WORLD_LOW_POWER_KEY, false\)/);
});

test('low-power mode reduces Pixi cost without removing map effects', () => {
  const worldSource = read('public', 'app', 'js', 'world-ui.js');
  const effectUpdater = worldSource.match(/function updateWorldEffects\(\) \{[\s\S]*?\n  \}/)?.[0] || '';

  assert.match(worldSource, /WORLD_LOW_POWER_FPS = 20/);
  assert.match(worldSource, /antialias: !state\.lowPowerMode/);
  assert.match(worldSource, /resolution: state\.lowPowerMode \? 1/);
  assert.match(worldSource, /if \(state\.lowPowerMode\) app\.ticker\.maxFPS = WORLD_LOW_POWER_FPS/);
  assert.match(effectUpdater, /if \(state\.lowPowerMode && !state\.worldEffectsDirty\) return/);
  assert.match(effectUpdater, /updatePathPulse\(\)/);
  assert.match(effectUpdater, /updatePuddleFx\(\)/);
  assert.match(effectUpdater, /updateMerchantDirectionArrow\(\)/);
  assert.match(worldSource, /function updateCameraStatus\(\) \{\s+invalidateWorldEffects\(\)/);
});
