const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const AUDIO_SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'audio.js'),
  'utf8'
);

function createAudioHarness() {
  let nextTimerId = 1;
  const timers = new Map();
  const players = [];

  class MockAudio {
    constructor(url) {
      this.src = url;
      this.dataset = {};
      this.listeners = new Map();
      this.paused = true;
      this.ended = false;
      this.loadCount = 0;
      players.push(this);
    }

    addEventListener(name, listener) {
      const listeners = this.listeners.get(name) || new Set();
      listeners.add(listener);
      this.listeners.set(name, listeners);
    }

    removeEventListener(name, listener) {
      this.listeners.get(name)?.delete(listener);
    }

    dispatch(name) {
      if (name === 'ended') this.ended = true;
      [...(this.listeners.get(name) || [])].forEach((listener) => listener({ type: name }));
    }

    play() {
      this.paused = false;
      return Promise.resolve();
    }

    pause() {
      this.paused = true;
    }

    removeAttribute(name) {
      if (name === 'src') this.src = '';
    }

    load() {
      this.loadCount += 1;
    }
  }

  const window = {
    AmongDemons: {},
    navigator: { userActivation: { hasBeenActive: true } },
    performance: { now: () => 1000 },
    addEventListener() {},
    dispatchEvent() {},
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    }
  };
  const storage = new Map();
  const context = vm.createContext({
    window,
    document: { hidden: false, addEventListener() {} },
    navigator: window.navigator,
    performance: window.performance,
    Audio: MockAudio,
    CustomEvent: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    sessionStorage: {
      getItem: () => null,
      setItem() {},
      removeItem() {}
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({ basePath: '/sounds/', sfx: { test: 'test.ogg' } })
    }),
    console
  });

  vm.runInContext(AUDIO_SOURCE, context);
  return { audio: window.AmongDemons.audio, players, timers };
}

test('finished sound effects release their audio and fallback timer immediately', async () => {
  const { audio, players, timers } = createAudioHarness();
  const player = await audio.play('sfx.test');

  assert.equal(players.length, 1);
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].delay, 30000);

  player.dispatch('ended');

  assert.equal(timers.size, 0);
  assert.equal(player.src, '');
  assert.equal(player.paused, true);
  assert.equal(player.loadCount, 1);
});

test('muting cleans up active sound effects and their fallback timers', async () => {
  const { audio, timers } = createAudioHarness();
  const player = await audio.play('sfx.test');

  audio.setMuted(true);

  assert.equal(timers.size, 0);
  assert.equal(player.src, '');
  assert.equal(player.paused, true);
  assert.equal(player.loadCount, 1);
});
