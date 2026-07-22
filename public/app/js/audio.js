(function() {
  'use strict';

  const root = window.AmongDemons = window.AmongDemons || {};
  const MANIFEST_URL = '/app/sounds/manifest.json?v=20260722-lazy-audio-v1';
  const STORAGE_KEYS = Object.freeze({
    master: 'amongdemons-audio-master-volume',
    music: 'amongdemons-audio-music-volume',
    sfx: 'amongdemons-audio-sfx-volume'
  });
  const MUTE_STORAGE_KEY = 'amongdemons-audio-muted';
  const MUSIC_HANDOFF_KEY = 'amongdemons-audio-music-handoff';
  const MUSIC_HANDOFF_MAX_AGE_MS = 15000;
  const DEFAULT_VOLUMES = Object.freeze({ master: 0.6, music: 0.5, sfx: 0.75 });
  const DEFAULT_MUTED = false;
  const CHANNEL_LEVELS = Object.freeze({ music: 0.72 });
  const SFX_MIXES = Object.freeze({
    'sfx.battle.victory': Object.freeze({ gain: 1.35, musicDuck: 0.2, musicDuckMs: 2500 })
  });

  let manifestPromise = null;

  const scene = { music: null };
  const scenePlayers = { music: null };
  const sceneTrackLists = { music: [] };
  const scenePendingKeys = { music: null };
  const sceneTokens = { music: 0 };
  const lastPlayedAt = new Map();
  const lastSoundUrlByKey = new Map();
  const pendingUnlockSounds = new Map();
  const activeSfx = new Set();
  let volumes = readVolumes();
  let muted = readMuted();
  let audioUnlocked = Boolean(window.navigator?.userActivation?.hasBeenActive);
  let deathVariant = 0;
  let musicDuckLevel = 1;
  let musicDuckTimeoutId = null;

  bindAudioUnlock();
  bindVisibilityPlayback();

  function readVolumes() {
    return {
      master: readStoredVolume(STORAGE_KEYS.master, DEFAULT_VOLUMES.master),
      music: readStoredVolume(STORAGE_KEYS.music, DEFAULT_VOLUMES.music),
      sfx: readStoredVolume(STORAGE_KEYS.sfx, DEFAULT_VOLUMES.sfx)
    };
  }

  function readStoredVolume(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      const stored = Number(raw);
      return Number.isFinite(stored) ? clamp(stored, 0, 1) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readMuted() {
    try {
      const stored = localStorage.getItem(MUTE_STORAGE_KEY);
      return stored === null ? DEFAULT_MUTED : stored === '1';
    } catch (error) {
      return DEFAULT_MUTED;
    }
  }

  function getVolumes() {
    return { ...volumes };
  }

  function isMuted() {
    return muted;
  }

  function setVolumes(next = {}) {
    volumes = {
      master: normalizeVolume(next.master, volumes.master),
      music: normalizeVolume(next.music, volumes.music),
      sfx: normalizeVolume(next.sfx, volumes.sfx)
    };

    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      try {
        localStorage.setItem(key, String(volumes[name]));
      } catch (error) {
        /* The controls still work for this page when storage is unavailable. */
      }
    });

    updateSceneVolumes();
    window.dispatchEvent(new CustomEvent('amongdemons:audio-volume-change', {
      detail: getVolumes()
    }));
    return getVolumes();
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    try {
      localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
    } catch (error) {
      /* The mute control still works for this page when storage is unavailable. */
    }

    if (muted) {
      pendingUnlockSounds.clear();
      activeSfx.forEach((player) => {
        player.pause();
        player.removeAttribute('src');
        player.load();
      });
      activeSfx.clear();
      Object.values(scenePlayers).forEach((player) => player?.pause());
    }
    updateSceneVolumes();
    if (!muted && audioUnlocked && !document.hidden) syncSceneChannel('music');
    window.dispatchEvent(new CustomEvent('amongdemons:audio-mute-change', {
      detail: { muted }
    }));
    return muted;
  }

  function normalizeVolume(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? clamp(number, 0, 1) : fallback;
  }

  function setScene(next = {}) {
    if (Object.prototype.hasOwnProperty.call(next, 'music')) {
      scene.music = next.music || null;
      syncSceneChannel('music');
    }
  }

  function stopScene() {
    scene.music = null;
    stopSceneChannel('music');
  }

  async function syncSceneChannel(channel) {
    const key = scene[channel];
    if (key && scenePendingKeys[channel] === key) return;
    const token = ++sceneTokens[channel];
    if (!key) {
      scenePendingKeys[channel] = null;
      stopSceneChannel(channel);
      return;
    }

    // A scene can be selected during page initialization, but no audio bytes
    // should be requested before the browser has granted user activation.
    if (muted || !audioUnlocked || document.hidden) return;

    const current = scenePlayers[channel];
    if (current?.dataset.soundKey === key) {
      current.volume = getEffectiveVolume(channel, getSceneChannelLevel(channel));
      if (!muted && audioUnlocked && !document.hidden && current.paused) safePlay(current);
      return;
    }

    scenePendingKeys[channel] = key;
    // Consume this before loading the next file so entering a different scene
    // (e.g. a world boss fight) immediately breaks the previous-page handoff.
    const handoff = channel === 'music' ? takeMusicHandoff(key) : null;
    const trackUrls = await resolveSoundUrls(key);
    if (!trackUrls.length || token !== sceneTokens[channel] || scene[channel] !== key) {
      if (scenePendingKeys[channel] === key && token === sceneTokens[channel]) {
        scenePendingKeys[channel] = null;
      }
      return;
    }

    scenePendingKeys[channel] = null;
    const handoffTrackUrl = trackUrls.includes(handoff?.trackUrl) ? handoff.trackUrl : null;
    startSceneTrack(channel, key, trackUrls, {
      preferredUrl: handoffTrackUrl,
      position: handoffTrackUrl ? handoff.position : 0
    });
  }

  function startSceneTrack(channel, key, trackUrls, options = {}) {
    if (scene[channel] !== key || !trackUrls.length) return;

    const url = chooseTrackUrl(trackUrls, options.preferredUrl, options.excludeUrl);
    if (!url) return;

    stopSceneChannel(channel);
    sceneTrackLists[channel] = [...trackUrls];
    const player = new Audio(url);
    player.dataset.soundKey = key;
    player.dataset.soundTrackUrl = url;
    player.loop = trackUrls.length === 1;
    player.preload = 'auto';
    player.volume = getEffectiveVolume(channel, getSceneChannelLevel(channel));
    if (Number(options.position) > 0) restorePlaybackPosition(player, Number(options.position));
    if (!player.loop) {
      player.addEventListener('ended', () => {
        if (scenePlayers[channel] !== player || scene[channel] !== key) return;
        startSceneTrack(channel, key, trackUrls, { excludeUrl: url });
      }, { once: true });
    }
    scenePlayers[channel] = player;
    if (!muted && audioUnlocked && !document.hidden) safePlay(player);
  }

  function chooseTrackUrl(trackUrls, preferredUrl, excludeUrl) {
    if (preferredUrl && trackUrls.includes(preferredUrl)) return preferredUrl;
    const candidates = trackUrls.length > 1
      ? trackUrls.filter((url) => url !== excludeUrl)
      : trackUrls;
    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  }

  function stopSceneChannel(channel) {
    sceneTokens[channel] += 1;
    scenePendingKeys[channel] = null;
    const player = scenePlayers[channel];
    sceneTrackLists[channel] = [];
    if (!player) return;
    player.pause();
    player.removeAttribute('src');
    player.load();
    scenePlayers[channel] = null;
  }

  function updateSceneVolumes() {
    Object.entries(scenePlayers).forEach(([channel, player]) => {
      if (player) player.volume = getEffectiveVolume(channel, getSceneChannelLevel(channel));
    });
  }

  function getSceneChannelLevel(channel) {
    const duckLevel = channel === 'music' ? musicDuckLevel : 1;
    return (CHANNEL_LEVELS[channel] ?? 1) * duckLevel;
  }

  function duckMusic(level, durationMs) {
    if (musicDuckTimeoutId !== null) window.clearTimeout(musicDuckTimeoutId);
    musicDuckLevel = clamp(level, 0, 1);
    updateSceneVolumes();
    musicDuckTimeoutId = window.setTimeout(() => {
      musicDuckTimeoutId = null;
      musicDuckLevel = 1;
      updateSceneVolumes();
    }, Math.max(0, Number(durationMs) || 0));
  }

  function saveMusicHandoff() {
    const key = scene.music;
    if (!key) {
      clearMusicHandoff();
      return;
    }

    const position = Number(scenePlayers.music?.currentTime);
    try {
      sessionStorage.setItem(MUSIC_HANDOFF_KEY, JSON.stringify({
        key,
        trackUrl: scenePlayers.music?.dataset.soundTrackUrl || null,
        position: Number.isFinite(position) && position >= 0 ? position : 0,
        savedAt: Date.now()
      }));
    } catch (error) {
      /* Music still restarts normally when session storage is unavailable. */
    }
  }

  function takeMusicHandoff(key) {
    let handoff = null;
    try {
      const stored = sessionStorage.getItem(MUSIC_HANDOFF_KEY);
      sessionStorage.removeItem(MUSIC_HANDOFF_KEY);
      handoff = JSON.parse(stored || 'null');
    } catch (error) {
      clearMusicHandoff();
      return null;
    }

    const age = Date.now() - Number(handoff?.savedAt);
    const position = Number(handoff?.position);
    if (
      handoff?.key !== key
      || !Number.isFinite(age)
      || age < 0
      || age > MUSIC_HANDOFF_MAX_AGE_MS
      || !Number.isFinite(position)
      || position < 0
    ) {
      return null;
    }

    return {
      position,
      trackUrl: typeof handoff.trackUrl === 'string' ? handoff.trackUrl : null
    };
  }

  function clearMusicHandoff() {
    try {
      sessionStorage.removeItem(MUSIC_HANDOFF_KEY);
    } catch (error) {
      /* Ignore unavailable session storage. */
    }
  }

  function restorePlaybackPosition(player, position) {
    const seek = () => {
      const duration = Number(player.duration);
      const nextPosition = Number.isFinite(duration) && duration > 0
        ? position % duration
        : position;
      try {
        player.currentTime = nextPosition;
        return true;
      } catch (error) {
        return false;
      }
    };

    if (!seek()) player.addEventListener('loadedmetadata', seek, { once: true });
  }

  async function play(key, options = {}) {
    if (!audioUnlocked) {
      if (options.queueUntilUnlock) {
        pendingUnlockSounds.set(key, { ...options, queueUntilUnlock: false });
      }
      return null;
    }
    const mix = SFX_MIXES[key] || {};
    if (!key || getEffectiveVolume('sfx', options.volume ?? 1, mix.gain) <= 0) return null;
    const minInterval = Math.max(0, Number(options.minInterval) || defaultMinInterval(key));
    const now = window.performance?.now?.() ?? Date.now();
    if (now - (lastPlayedAt.get(key) || 0) < minInterval) return null;
    lastPlayedAt.set(key, now);

    const url = await resolveSoundUrl(key);
    if (!url) return null;

    const player = new Audio(url);
    player.preload = 'auto';
    player.volume = getEffectiveVolume('sfx', options.volume ?? 1, mix.gain);
    activeSfx.add(player);
    const releasePlayer = () => activeSfx.delete(player);
    player.addEventListener('ended', releasePlayer, { once: true });
    player.addEventListener('error', releasePlayer, { once: true });
    if (Number.isFinite(Number(options.playbackRate))) {
      player.playbackRate = clamp(Number(options.playbackRate), 0.5, 2);
    }
    if (options.loop) player.loop = true;
    if (Number(mix.musicDuck) < 1) duckMusic(mix.musicDuck, mix.musicDuckMs);
    const playbackPromise = safePlay(player);
    if (Number(options.durationMs) > 0) {
      window.setTimeout(() => {
        releasePlayer();
        player.pause();
        player.removeAttribute('src');
        player.load();
      }, Number(options.durationMs));
    } else if (!options.loop) {
      window.setTimeout(releasePlayer, 30000);
    }
    if (options.waitForEnd && !options.loop) {
      try {
        if (playbackPromise?.then) await playbackPromise;
      } catch (error) {
        releasePlayer();
        return null;
      }
      await waitForPlaybackEnd(player, options.maxWaitMs);
    }
    return player;
  }

  function waitForPlaybackEnd(player, maxWaitMs) {
    if (!player || player.ended) return Promise.resolve();

    return new Promise((resolve) => {
      const events = ['ended', 'error', 'abort', 'emptied'];
      const timeoutMs = Math.max(1000, Number(maxWaitMs) || 30000);
      let timeoutId = null;
      const finish = () => {
        events.forEach((eventName) => player.removeEventListener(eventName, finish));
        if (timeoutId !== null) window.clearTimeout(timeoutId);
        resolve();
      };
      events.forEach((eventName) => player.addEventListener(eventName, finish, { once: true }));
      timeoutId = window.setTimeout(finish, timeoutMs);
    });
  }

  function playDeath() {
    deathVariant = (deathVariant + 1) % 2;
    return play(`sfx.battle.demonDeath0${deathVariant + 1}`, { volume: 0.78, minInterval: 100 });
  }

  async function resolveSoundUrls(key) {
    const manifest = await getManifest();
    if (!manifest) return [];
    const entry = String(key).split('.').reduce((value, part) => value?.[part], manifest);
    const paths = (Array.isArray(entry) ? entry : [entry]).filter((path) => typeof path === 'string');
    if (!paths.length) {
      console.warn(`Unknown audio key: ${key}`);
      return [];
    }
    return paths.map((path) => `${manifest.basePath || '/app/sounds/'}${path}`);
  }

  function getManifest() {
    if (!manifestPromise) {
      manifestPromise = fetch(MANIFEST_URL)
        .then((response) => {
          if (!response.ok) throw new Error(`Audio manifest request failed (${response.status})`);
          return response.json();
        })
        .catch((error) => {
          console.warn('Among Demons audio is unavailable.', error);
          return null;
        });
    }
    return manifestPromise;
  }

  async function resolveSoundUrl(key) {
    const urls = await resolveSoundUrls(key);
    if (!urls.length) return null;
    const previousUrl = lastSoundUrlByKey.get(key);
    const candidates = urls.length > 1
      ? urls.filter((url) => url !== previousUrl)
      : urls;
    const url = candidates[Math.floor(Math.random() * candidates.length)] || urls[0];
    lastSoundUrlByKey.set(key, url);
    return url;
  }

  function getEffectiveVolume(category, level = 1, gain = 1) {
    if (muted) return 0;
    const categoryVolume = category === 'music'
      ? volumes.music
      : volumes.sfx;
    const normalizedGain = Number.isFinite(Number(gain)) ? Math.max(0, Number(gain)) : 1;
    return clamp(volumes.master * categoryVolume * normalizeVolume(level, 1) * normalizedGain, 0, 1);
  }

  function unlockAudio() {
    audioUnlocked = true;
    syncSceneChannel('music');
    const queuedSounds = Array.from(pendingUnlockSounds.entries());
    pendingUnlockSounds.clear();
    queuedSounds.forEach(([key, options]) => play(key, options));
  }

  function bindAudioUnlock() {
    const unlock = () => {
      unlockAudio();
      document.removeEventListener('pointerdown', unlock, true);
      document.removeEventListener('keydown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  function bindVisibilityPlayback() {
    document.addEventListener('visibilitychange', () => {
      Object.values(scenePlayers).forEach((player) => {
        if (!player) return;
        if (document.hidden) player.pause();
        else if (!muted && audioUnlocked) safePlay(player);
      });
    });
    window.addEventListener('pagehide', () => {
      saveMusicHandoff();
      Object.values(scenePlayers).forEach((player) => player?.pause());
    });
    window.addEventListener('pageshow', () => {
      const musicPlayer = scenePlayers.music;
      if (musicPlayer) {
        const handoff = takeMusicHandoff(musicPlayer.dataset.soundKey);
        const trackUrls = sceneTrackLists.music;
        if (
          handoff?.trackUrl
          && handoff.trackUrl !== musicPlayer.dataset.soundTrackUrl
          && trackUrls.includes(handoff.trackUrl)
        ) {
          startSceneTrack('music', scene.music, trackUrls, {
            preferredUrl: handoff.trackUrl,
            position: handoff.position
          });
        } else if (handoff) {
          restorePlaybackPosition(musicPlayer, handoff.position);
        }
      }
      if (muted || !audioUnlocked || document.hidden) return;
      Object.values(scenePlayers).forEach((player) => {
        if (player?.paused) safePlay(player);
      });
    });
  }

  function safePlay(player) {
    try {
      const promise = player.play();
      if (promise?.catch) promise.catch(() => {});
      return promise;
    } catch (error) {
      return null;
    }
  }

  function defaultMinInterval(key) {
    if (key.includes('impact') || key.includes('Death')) return 45;
    return 25;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  root.audio = {
    storageKeys: STORAGE_KEYS,
    muteStorageKey: MUTE_STORAGE_KEY,
    ready: manifestPromise,
    getVolumes,
    setVolumes,
    isMuted,
    setMuted,
    setScene,
    stopScene,
    play,
    playDeath,
    unlock: unlockAudio
  };
})();
