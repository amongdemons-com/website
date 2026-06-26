(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const appUrl = window.AmongDemons.appUrl || ((value) => value);
  const renderSoulAmount = window.AmongDemons.ui?.renderSoulAmount || ((value) => escapeHtml(value));
  const TILE_SIZE = 64;
  const WORLD_RADIUS = 50;
  const ZONE_START_RADIUS = 24;
  const TYPE_COUNT = 11;
  const ZONE_ROTATION = 0.045;
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 2.15;
  const CLICK_THRESHOLD = 7;
  const STEP_DURATION_MS = 180;
  const DEFAULT_PROFILE_IMAGE_URL = '/app/images/demons/thumbnails/1.png';
  const BOARD_COLORS = {
    background: 0x070806,
    tileNormal: 0x121814,
    tileNormalAlt: 0x181e18,
    active: 0x2a3025,
    wall: 0x35281f,
    wallEdge: 0x120d0a,
    obstacle: 0x35281f,
    obstacleInner: 0x241b16,
    obstacleEdge: 0x120d0a,
    dangerous: 0x4b1716,
    dangerousGlow: 0xb65b3f,
    soulNode: 0xc7b56f,
    portal: 0x46324a,
    portalGlow: 0x80638a,
    gridLine: 0x293028,
    selection: 0xd7b765,
    validMove: 0x6f8faa,
    road: 0x191d16,
    roadGlow: 0x2b2a20,
    landmark: 0x9fb3aa
  };
  const FALLBACK_BLOCKED_TILES = [
    { x: 1, y: 1, type: 'basalt' },
    { x: 1, y: 2, type: 'basalt' },
    { x: 1, y: 3, type: 'basalt' },
    { x: 2, y: 3, type: 'basalt' },
    { x: 3, y: 3, type: 'basalt' },
    { x: -1, y: -2, type: 'bone-spur' },
    { x: -2, y: -2, type: 'bone-spur' },
    { x: -3, y: -2, type: 'bone-spur' },
    { x: -5, y: 0, type: 'chasm' },
    { x: -5, y: 1, type: 'chasm' },
    { x: -5, y: 2, type: 'chasm' },
    { x: 5, y: 1, type: 'ruin' },
    { x: 6, y: 1, type: 'ruin' },
    { x: 6, y: 0, type: 'ruin' }
  ];
  const EVENT_COLORS = {
    boss: BOARD_COLORS.dangerousGlow,
    'soul-cache': BOARD_COLORS.soulNode,
    'dungeon-portal': BOARD_COLORS.portalGlow,
    landmark: BOARD_COLORS.landmark
  };
  const RARITY_COLORS = {
    common: '#D1D5D8',
    uncommon: '#41A85F',
    rare: '#2C82C9',
    epic: '#9365B8',
    legendary: '#FAC51C',
    mythic: '#E25041'
  };

  const state = {
    app: null,
    viewport: null,
    groundLayer: null,
    gridLayer: null,
    fogLayer: null,
    roadLayer: null,
    hoverLayer: null,
    hoverTile: null,
    pathLayer: null,
    pathPulse: null,
    markerLayer: null,
    encounterLayer: null,
    hunterLayer: null,
    hunterFrame: null,
    hunterAvatar: null,
    hunterAvatarTexture: null,
    effectLayer: null,
    resizeObserver: null,
    cleanup: [],
    position: { x: 0, y: 0 },
    bounds: { min: -WORLD_RADIUS, max: WORLD_RADIUS },
    events: [],
    roads: [],
    roadKeys: new Set(),
    encounters: [],
    encounterTextures: new Map(),
    tileTextures: new Map(),
    terrainBuilt: false,
    selectedEncounter: null,
    player: null,
    playersAt: [],
    activeTeam: null,
    currentEvent: null,
    currentEncounter: null,
    blockedTiles: FALLBACK_BLOCKED_TILES,
    blockedMap: new Map(),
    selectedPath: [],
    selectedTarget: null,
    travelLog: [],
    travelStatus: 'idle',
    recentStepEvent: null,
    hunterRenderPosition: null,
    moving: false,
    challengeCooldowns: new Map(),
    initialCameraCentered: false,
    pointer: null,
    activePointers: new Map(),
    pinch: null,
    gestureWasPinch: false
  };

  const elements = {};

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      window.location.href = appUrl('/login');
      return;
    }

    cacheElements();
    bindDomControls();

    try {
      await initPixi();
      await loadWorld();
      hideLoading();
    } catch (error) {
      handleAuthError(error);
    }
  }

  function cacheElements() {
    [
      'appMessage',
      'worldCanvasHost',
      'worldLoading',
      'worldPositionButton',
      'worldPositionChip',
      'worldZoomChip',
      'worldTargetTooltip',
      'worldEncounterTooltip',
      'worldTeamSummary',
      'worldEncounterList',
      'worldEventPanel',
      'worldTravelPanel'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindDomControls() {
    elements.worldPositionButton?.addEventListener('click', () => centerOnHunter());

    elements.worldEncounterList?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest('[data-challenge-player]');
      if (!button) return;
      challengePlayer(button.dataset.challengePlayer, button);
    });

    elements.worldEventPanel?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest('[data-world-event-action]');
      if (!button) return;
      handleEventAction(button.dataset.worldEventAction);
    });
  }

  async function initPixi() {
    const host = elements.worldCanvasHost;
    const Pixi = window.PIXI;

    if (!host || !Pixi?.Application) {
      throw new Error('PixiJS failed to load.');
    }

    const app = new Pixi.Application();
    const size = getHostSize();
    await app.init({
      width: size.width,
      height: size.height,
      background: '#040a0d',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    const canvas = app.canvas || app.view;
    canvas.classList.add('world-canvas');
    host.appendChild(canvas);

    state.app = app;
    state.viewport = new Pixi.Container();
    state.groundLayer = new Pixi.Container(); // static terrain + obstacles
    state.gridLayer = new Pixi.Graphics();    // faint static grid
    state.fogLayer = new Pixi.Graphics();     // event glows + active tile (dynamic)
    state.roadLayer = new Pixi.Container();    // static roads
    state.hoverLayer = new Pixi.Graphics();    // hovered-tile hint (dynamic)
    state.pathLayer = new Pixi.Graphics();
    state.pathPulse = new Pixi.Graphics();     // animated destination ring
    state.markerLayer = new Pixi.Container();
    state.encounterLayer = new Pixi.Container();
    state.hunterLayer = new Pixi.Container();
    state.hunterFrame = new Pixi.Graphics();
    state.hunterAvatar = new Pixi.Sprite(Pixi.Texture.EMPTY);
    state.effectLayer = new Pixi.Graphics();

    state.hunterAvatar.anchor.set(0.5);
    state.hunterLayer.addChild(state.hunterFrame);
    state.hunterLayer.addChild(state.hunterAvatar);

    state.viewport.addChild(state.groundLayer);
    state.viewport.addChild(state.gridLayer);
    state.viewport.addChild(state.fogLayer);
    state.viewport.addChild(state.roadLayer);
    state.viewport.addChild(state.hoverLayer);
    state.viewport.addChild(state.pathLayer);
    state.viewport.addChild(state.pathPulse);
    state.viewport.addChild(state.markerLayer);
    state.viewport.addChild(state.encounterLayer);
    state.viewport.addChild(state.hunterLayer);
    state.viewport.addChild(state.effectLayer);
    app.stage.addChild(state.viewport);

    app.ticker.add(updatePathPulse);

    bindCanvasInput(canvas);
    bindResize();
    resizeCanvas();
    setZoom(getInitialZoom(), { preserveCenter: false });
  }

  function bindCanvasInput(canvas) {
    addListener(canvas, 'pointerdown', onPointerDown);
    addListener(canvas, 'pointermove', onPointerMove);
    addListener(canvas, 'pointerup', onPointerUp);
    addListener(canvas, 'pointercancel', clearPointer);
    addListener(canvas, 'pointerleave', onPointerLeave);
    addListener(canvas, 'wheel', onWheel, { passive: false });
    addListener(window, 'pagehide', destroyWorld);
  }

  function bindResize() {
    const host = elements.worldCanvasHost;
    if (!host || typeof ResizeObserver !== 'function') {
      addListener(window, 'resize', resizeCanvas);
      return;
    }

    state.resizeObserver = new ResizeObserver(() => resizeCanvas());
    state.resizeObserver.observe(host);
  }

  async function loadWorld() {
    const payload = await api('/api/world/state');
    state.position = normalizePosition(payload.position);
    state.bounds = payload.bounds || state.bounds;
    state.events = Array.isArray(payload.events) ? payload.events : [];
    state.roads = Array.isArray(payload.roads) ? payload.roads : [];
    state.roadKeys = new Set(state.roads.map((tile) => getTileKey(tile)));
    state.encounters = Array.isArray(payload.encounters) ? payload.encounters : [];
    state.player = payload.player || state.player;
    state.blockedTiles = Array.isArray(payload.blockedTiles) ? payload.blockedTiles : FALLBACK_BLOCKED_TILES;
    state.blockedMap = new Map(state.blockedTiles.map((tile) => [getTileKey(tile), tile]));
    state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
    state.activeTeam = payload.activeTeam || null;
    state.currentEvent = payload.currentEvent || getEventAt(state.position);
    state.currentEncounter = payload.currentEncounter || getEncounterAt(state.position);
    await loadHunterAvatar();
    await loadEncounterTextures();

    buildBoard();
    renderWorld();
    renderPanels();

    if (!state.initialCameraCentered) {
      centerOnHunter();
      state.initialCameraCentered = true;
    }
  }

  function handleMapTileClick(tile) {
    if (state.moving) return;

    const target = normalizePosition(tile);
    if (!isInBounds(target)) return;

    if (positionsEqual(target, state.position)) {
      clearRoutePreview();
      centerOnHunter();
      return;
    }

    if (isBlocked(target)) {
      clearRoutePreview('blocked');
      setMessage('That tile is blocked.', 'warning');
      return;
    }

    if (state.selectedTarget && positionsEqual(target, state.selectedTarget) && state.selectedPath.length > 1) {
      hideEncounterTooltip();
      travelSelectedPath();
      return;
    }

    const path = findPath(state.position, target);
    if (path.length < 2) {
      clearRoutePreview('blocked');
      setMessage('No passable route found.', 'warning');
      return;
    }

    const encounter = getEncounterAt(target);
    if (encounter) {
      showEncounterTooltip(encounter);
    } else {
      hideEncounterTooltip();
    }

    state.selectedTarget = target;
    state.selectedPath = path;
    state.travelStatus = 'preview';
    state.recentStepEvent = null;
    renderWorld();
    renderTravelPanel();
  }

  async function travelSelectedPath() {
    const path = (state.selectedPath || []).slice();
    if (state.moving || path.length < 2) return;

    state.moving = true;
    state.travelStatus = 'moving';
    state.travelLog = [];
    state.recentStepEvent = null;
    renderTravelPanel();
    renderWorld();

    try {
      const payload = await commitTravelPath(path);
      const stepEvents = getTravelStepEvents(payload, path);

      for (let index = 1; index < path.length; index += 1) {
        const step = path[index];
        state.selectedPath = path.slice(index - 1);
        renderWorld();
        await animateHunterStep(step);

        state.selectedPath = path.slice(index);
        const stepEvent = stepEvents[index - 1] || { type: 'none', title: 'No Event', position: step };
        state.recentStepEvent = {
          ...stepEvent,
          position: step
        };
        state.travelLog.unshift(state.recentStepEvent);
        state.currentEvent = getEventAt(step);
        renderWorld();
        renderPanels();
        await delay(getStepDelay());
      }

      state.position = normalizePosition(payload.position || state.position);
      state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
      state.currentEvent = payload.currentEvent || getEventAt(state.position);
      clearRoutePreview('arrived', { keepLog: true });
      renderPanels();
    } catch (error) {
      if (error.status !== 401) {
        clearRoutePreview('idle');
      }
      handleAuthError(error);
    } finally {
      state.moving = false;
      renderWorld();
      renderPanels();
    }
  }

  function commitTravelPath(path) {
    return api('/api/world/move', {
      method: 'POST',
      body: {
        position: path[path.length - 1],
        path
      }
    });
  }

  function getTravelStepEvents(payload, path) {
    const events = Array.isArray(payload?.travelEvents) ? payload.travelEvents : [];
    return path.slice(1).map((step, index) => ({
      type: events[index]?.type || 'none',
      title: events[index]?.title || 'No Event',
      position: normalizePosition(events[index]?.position || step)
    }));
  }

  function clearRoutePreview(status = 'idle', options = {}) {
    state.selectedTarget = null;
    state.selectedPath = [];
    state.recentStepEvent = null;
    hideEncounterTooltip();
    state.travelStatus = status;
    if (!options.keepLog && status !== 'arrived') {
      state.travelLog = [];
    }
    renderWorld();
    renderTravelPanel();
  }

  function findPath(start, target) {
    const origin = normalizePosition(start);
    const destination = normalizePosition(target);
    const queue = [origin];
    const visited = new Set([getTileKey(origin)]);
    const cameFrom = new Map();

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (positionsEqual(current, destination)) {
        return rebuildPath(cameFrom, current);
      }

      getNeighbors(current).forEach((neighbor) => {
        const key = getTileKey(neighbor);
        if (visited.has(key) || !isInBounds(neighbor) || isBlocked(neighbor)) return;

        visited.add(key);
        cameFrom.set(key, current);
        queue.push(neighbor);
      });
    }

    return [];
  }

  function rebuildPath(cameFrom, current) {
    const path = [current];
    let cursor = current;

    while (cameFrom.has(getTileKey(cursor))) {
      cursor = cameFrom.get(getTileKey(cursor));
      path.push(cursor);
    }

    return path.reverse();
  }

  function getNeighbors(position) {
    return [
      { x: position.x + 1, y: position.y },
      { x: position.x - 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x, y: position.y - 1 }
    ];
  }

  function animateHunterStep(nextPosition) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      state.position = nextPosition;
      state.hunterRenderPosition = null;
      return Promise.resolve();
    }

    const from = state.position;
    const to = nextPosition;
    const startedAt = performance.now();

    return new Promise((resolve) => {
      function tick(now) {
        const progress = clamp((now - startedAt) / STEP_DURATION_MS, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        state.hunterRenderPosition = {
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased
        };
        drawHunter();

        if (progress < 1) {
          window.requestAnimationFrame(tick);
          return;
        }

        state.position = to;
        state.hunterRenderPosition = null;
        resolve();
      }

      window.requestAnimationFrame(tick);
    });
  }

  async function challengePlayer(targetPlayerId, button) {
    if (!targetPlayerId) return;

    const cooldownUntil = state.challengeCooldowns.get(targetPlayerId) || 0;
    if (cooldownUntil > Date.now()) {
      renderEncounterPanel();
      return;
    }

    setButtonBusy(button, true);

    try {
      const payload = await api('/api/world/challenge', {
        method: 'POST',
        body: { targetPlayerId }
      });

      rememberCooldown(targetPlayerId, payload.cooldownUntil);
      setMessage(payload.message || 'Challenge placeholder accepted.', 'success');
    } catch (error) {
      if (error.status === 429 && error.payload?.cooldownUntil) {
        rememberCooldown(targetPlayerId, error.payload.cooldownUntil);
      }
      handleAuthError(error);
    } finally {
      setButtonBusy(button, false);
      renderEncounterPanel();
    }
  }

  function handleEventAction(action) {
    const event = state.currentEvent;
    if (!event) return;

    if (action === 'dungeon-portal') {
      window.location.href = appUrl('/dungeon');
      return;
    }

    if (action === 'boss') {
      setMessage('Boss fight placeholder ready for future combat integration.', 'warning');
      return;
    }

    if (action === 'soul-cache') {
      setMessage('Soul cache placeholder ready for future reward integration.', 'success');
    }
  }

  function renderWorld() {
    drawFog();
    drawHover();
    drawPath();
    drawMarkers();
    drawEncounterMarkers();
    drawStepEffect();
    updateCameraStatus();
  }

  // ===========================================================================
  // Procedural tile rendering
  //
  // The static board (ground, obstacles, roads) is painted once into sprite
  // layers built from a small cache of procedurally generated, seeded textures
  // (deterministic per x,y so the world is stable across reloads). Event glows,
  // the active tile and the path preview stay on light dynamic layers.
  // ===========================================================================

  // Calm, dark ruined-world palette. Terrain tones are near-identical so the
  // ground reads as one quiet surface; everything else is built from a single
  // ruined-stone family so the map stays cohesive.
  const DEFAULT_ZONE_PALETTE = {
    ground: [0x0e120d, 0x10140f, 0x0d110c],
    patch: 0x182018,
    road: [0x171a14, 0x1b1d16],
    roadEdge: 0x080a07,
    roadSheen: 0x2b3024,
    stone: [0x282520, 0x302c25, 0x211e19],
    stoneDark: 0x131009,
    stoneLight: 0x3b372e,
    prop: 0x302c25,
    fog: 0x050604,
    accent: 0xe4685e
  };
  const ZONE_PALETTES = [
    null,
    {
      ground: [0x10170f, 0x132012, 0x0c140d],
      patch: 0x263820,
      road: [0x1a1f15, 0x202719],
      roadEdge: 0x080b07,
      roadSheen: 0x304021,
      stone: [0x293026, 0x333a2b, 0x1d241c],
      stoneDark: 0x10160e,
      stoneLight: 0x4a5638,
      prop: 0x54733d,
      fog: 0x061009,
      accent: 0x80d697
    },
    {
      ground: [0x0f1418, 0x101a20, 0x0b1116],
      patch: 0x1c3139,
      road: [0x171d20, 0x1a2327],
      roadEdge: 0x070a0d,
      roadSheen: 0x27414a,
      stone: [0x273038, 0x303a42, 0x1b242b],
      stoneDark: 0x0d1115,
      stoneLight: 0x465964,
      prop: 0x45606a,
      fog: 0x050b10,
      accent: 0x55ffff
    },
    {
      ground: [0x101313, 0x151917, 0x0d1110],
      patch: 0x283024,
      road: [0x1b1c16, 0x202118],
      roadEdge: 0x090907,
      roadSheen: 0x3d3b24,
      stone: [0x2f302b, 0x393a31, 0x22241f],
      stoneDark: 0x10110e,
      stoneLight: 0x595a47,
      prop: 0x6d7149,
      fog: 0x090d0b,
      accent: 0xe8c76a
    },
    {
      ground: [0x151113, 0x1b1418, 0x100d10],
      patch: 0x2d1d25,
      road: [0x1f171b, 0x241a1f],
      roadEdge: 0x0c0709,
      roadSheen: 0x462a35,
      stone: [0x332933, 0x3d303e, 0x251f28],
      stoneDark: 0x130e14,
      stoneLight: 0x60465f,
      prop: 0x6e4666,
      fog: 0x0c070b,
      accent: 0x9c7ac8
    },
    {
      ground: [0x17120e, 0x1c1710, 0x120f0b],
      patch: 0x3a2318,
      road: [0x221a13, 0x271e16],
      roadEdge: 0x0d0805,
      roadSheen: 0x52321e,
      stone: [0x342822, 0x402f25, 0x241d19],
      stoneDark: 0x130d0a,
      stoneLight: 0x634735,
      prop: 0x7a5136,
      fog: 0x0d0704,
      accent: 0xe0793b
    },
    {
      ground: [0x121418, 0x151822, 0x0e1016],
      patch: 0x252c3e,
      road: [0x191b24, 0x1e212b],
      roadEdge: 0x080910,
      roadSheen: 0x30385a,
      stone: [0x292b38, 0x333546, 0x20212d],
      stoneDark: 0x10111a,
      stoneLight: 0x4e5270,
      prop: 0x4a5580,
      fog: 0x060711,
      accent: 0x6f8faa
    },
    {
      ground: [0x151515, 0x191a18, 0x101211],
      patch: 0x2a2c25,
      road: [0x1c1d18, 0x22231d],
      roadEdge: 0x090a08,
      roadSheen: 0x3b3d2d,
      stone: [0x30302c, 0x3c3c34, 0x23231f],
      stoneDark: 0x11110f,
      stoneLight: 0x5c5b4e,
      prop: 0x726f55,
      fog: 0x090a08,
      accent: 0x9fb3aa
    },
    {
      ground: [0x0f1513, 0x111c19, 0x0b1211],
      patch: 0x1c332d,
      road: [0x171e1b, 0x1c2420],
      roadEdge: 0x060a09,
      roadSheen: 0x294e44,
      stone: [0x25342f, 0x30403a, 0x1c2724],
      stoneDark: 0x0d1411,
      stoneLight: 0x45675d,
      prop: 0x448875,
      fog: 0x04100d,
      accent: 0x6fd6bd
    },
    {
      ground: [0x171111, 0x1e1414, 0x120d0d],
      patch: 0x351b1b,
      road: [0x211616, 0x271a18],
      roadEdge: 0x0d0606,
      roadSheen: 0x582523,
      stone: [0x342524, 0x402b29, 0x251b1a],
      stoneDark: 0x140b0b,
      stoneLight: 0x66413d,
      prop: 0x863c38,
      fog: 0x0d0505,
      accent: 0xe4685e
    },
    {
      ground: [0x141216, 0x19151d, 0x100e13],
      patch: 0x282037,
      road: [0x1c1821, 0x211c29],
      roadEdge: 0x09070d,
      roadSheen: 0x3e315f,
      stone: [0x302a3a, 0x3a3348, 0x241f2c],
      stoneDark: 0x120f18,
      stoneLight: 0x594d74,
      prop: 0x66528c,
      fog: 0x08060f,
      accent: 0x9365b8
    },
    {
      ground: [0x141510, 0x191b13, 0x10110d],
      patch: 0x2a311d,
      road: [0x1c1e17, 0x22241a],
      roadEdge: 0x090a06,
      roadSheen: 0x454b25,
      stone: [0x303228, 0x3b3f2e, 0x22251c],
      stoneDark: 0x11130d,
      stoneLight: 0x5d643d,
      prop: 0x7f8a3e,
      fog: 0x090c06,
      accent: 0xb8d45a
    }
  ];
  const OBSTACLE_KINDS = ['brick-wall'];
  const GRID_COLOR = 0x39423a;
  const GROUND_VARIANTS = 6;
  const ROAD_VARIANTS = 2;
  const OBSTACLE_VARIANTS = 2;
  const PROP_CHANCE = 0.05; // rare, subtle stone decals on open ground
  const EMBER_CORE = 0xffd8a6;
  const EMBER_GLOW = 0xd9742e;

  // Deterministic 0..1 hash per (x, y, salt) — drives stable per-tile variation.
  function hashTile(x, y, salt) {
    let h = Math.imul((x | 0) + 0x9e37, 374761393) ^
      Math.imul((y | 0) + 0x85eb, 668265263) ^
      Math.imul((salt | 0) + 1, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function zoneTypeIdForTile(x, y) {
    if (Math.hypot(x, y) < ZONE_START_RADIUS) return 0;
    const angle = Math.atan2(y, x);
    const normalized = (angle + Math.PI) / (2 * Math.PI);
    const sector = Math.floor(((normalized + ZONE_ROTATION) % 1) * TYPE_COUNT) % TYPE_COUNT;
    return sector + 1;
  }

  function zonePaletteForTile(x, y) {
    return ZONE_PALETTES[zoneTypeIdForTile(x, y)] || DEFAULT_ZONE_PALETTE;
  }

  // Seeded RNG used while drawing a single texture variant (props scatter).
  function seededRng(seed) {
    let a = (seed >>> 0) || 1;
    return function next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getTileTexture(key, draw) {
    if (state.tileTextures.has(key)) return state.tileTextures.get(key);
    const Pixi = window.PIXI;
    const g = new Pixi.Graphics();
    draw(g);
    const texture = state.app.renderer.generateTexture({
      target: g,
      frame: new Pixi.Rectangle(0, 0, TILE_SIZE, TILE_SIZE),
      resolution: 2
    });
    g.destroy();
    state.tileTextures.set(key, texture);
    return texture;
  }

  function makeTileSprite(texture, x, y) {
    const sprite = new window.PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    const center = tileCenter({ x, y });
    sprite.position.set(center.x, center.y);
    return sprite;
  }

  // --- texture detail helpers -------------------------------------------------

  // --- texture builders -------------------------------------------------------

  function groundTexture(zone, variant) {
    return getTileTexture(`ground:${zone}:${variant}`, (g) => {
      const rng = seededRng(variant * 911 + 7);
      const palette = ZONE_PALETTES[zone] || DEFAULT_ZONE_PALETTE;
      g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill({ color: palette.ground[variant % palette.ground.length] });
      // A couple of very soft, low-contrast patches — enough to break up flat
      // repetition without any visible square noise. Terrain stays in back.
      for (let i = 0; i < 2; i += 1) {
        g.ellipse(rng() * TILE_SIZE, rng() * TILE_SIZE, 12 + rng() * 18, 10 + rng() * 16)
          .fill({ color: palette.patch, alpha: 0.09 });
      }
    });
  }

  // Rare, subtle stone decals (a few small pebbles) for open ground.
  function propTexture(zone, variant) {
    return getTileTexture(`prop:${zone}:${variant}`, (g) => {
      const rng = seededRng(variant * 521 + 29);
      const palette = ZONE_PALETTES[zone] || DEFAULT_ZONE_PALETTE;
      const count = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i += 1) {
        const cx = 22 + rng() * 20;
        const cy = 26 + rng() * 16;
        const r = 1.6 + rng() * 1.8;
        g.ellipse(cx, cy + 1.5, r * 1.2, r * 0.6).fill({ color: 0x000000, alpha: 0.18 });
        g.ellipse(cx, cy, r, r * 0.8).fill({ color: palette.prop, alpha: 0.85 });
      }
    });
  }

  // Road piece keyed by its 4-bit neighbour mask (N=1, E=2, S=4, W=8) so dirt
  // reaches toward connected sides and tiles read as one continuous path.
  // Clean worn dirt/stone path keyed by its neighbour mask (N=1, E=2, S=4, W=8)
  // so dirt reaches connected sides and tiles merge into one continuous road.
  function roadTexture(mask, variant, zone) {
    return getTileTexture(`road:${zone}:${mask}:${variant}`, (g) => {
      const rng = seededRng(mask * 733 + variant * 197 + 11);
      const palette = ZONE_PALETTES[zone] || DEFAULT_ZONE_PALETTE;
      const w = 24;
      const inset = (TILE_SIZE - w) / 2;
      const half = TILE_SIZE / 2;
      const dirt = palette.road[variant % palette.road.length];

      const segs = [[inset, inset, w, w]];
      if (mask & 1) segs.push([inset, 0, w, half]);
      if (mask & 2) segs.push([half, inset, half, w]);
      if (mask & 4) segs.push([inset, half, w, half]);
      if (mask & 8) segs.push([0, inset, half, w]);

      // Soft dark edge halo, then the dirt fill.
      segs.forEach(([sx, sy, sw, sh]) => g.rect(sx - 2, sy - 2, sw + 4, sh + 4).fill({ color: palette.roadEdge, alpha: 0.34 }));
      segs.forEach(([sx, sy, sw, sh]) => g.rect(sx, sy, sw, sh).fill({ color: dirt, alpha: 0.92 }));

      // Faint worn sheen down the centre of the path.
      g.ellipse(half, half, 8, 8).fill({ color: palette.roadSheen, alpha: 0.18 });

      // Worn darker edges along the path's length (off the connecting ends, so
      // neighbouring road tiles still merge without a seam).
      if ((mask & 1) || (mask & 4) || mask === 0) {
        g.rect(inset, 0, 2, TILE_SIZE).fill({ color: palette.roadEdge, alpha: 0.28 });
        g.rect(inset + w - 2, 0, 2, TILE_SIZE).fill({ color: palette.roadEdge, alpha: 0.28 });
      }
      if ((mask & 2) || (mask & 8) || mask === 0) {
        g.rect(0, inset, TILE_SIZE, 2).fill({ color: palette.roadEdge, alpha: 0.28 });
        g.rect(0, inset + w - 2, TILE_SIZE, 2).fill({ color: palette.roadEdge, alpha: 0.28 });
      }

      // Just a couple of small embedded stones — no speckle clutter.
      for (let i = 0; i < 2; i += 1) {
        g.ellipse(inset + 5 + rng() * (w - 10), inset + 5 + rng() * (w - 10), 1.6 + rng(), 1.3 + rng())
          .fill({ color: palette.stoneDark, alpha: 0.45 });
      }
    });
  }

  function obstacleTexture(kind, variant, zone) {
    return getTileTexture(`obs:${zone}:${kind}:${variant}`, (g) => {
      const rng = seededRng((OBSTACLE_KINDS.indexOf(kind) + 1) * 4099 + variant * 131 + 3);
      const palette = ZONE_PALETTES[zone] || DEFAULT_ZONE_PALETTE;
      drawObstacle(g, kind, rng, palette);
    });
  }

  // Temporary full-square brick wall pattern for every blocked tile.
  function drawObstacle(g, kind, rng, palette) {
    void kind;
    const mortar = palette.stoneDark;
    const brickA = palette.stone[0] || 0x282520;
    const brickB = palette.stone[1] || brickA;
    const brickC = palette.stone[2] || brickA;
    const brickHeight = 12;
    const rowCount = Math.ceil(TILE_SIZE / brickHeight);

    g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill({ color: mortar, alpha: 0.96 });

    for (let row = 0; row < rowCount; row += 1) {
      const y = row * brickHeight + 1;
      const offset = row % 2 === 0 ? 0 : -14;
      for (let x = offset; x < TILE_SIZE; x += 28) {
        const brickTone = [brickA, brickB, brickC][Math.floor(rng() * 3)];
        const left = Math.max(1, x + 1);
        const width = Math.min(27, TILE_SIZE - left - 1);
        if (width <= 0) continue;
        g.rect(left, y, width, brickHeight - 2)
          .fill({ color: brickTone, alpha: 0.92 })
          .stroke({ color: mortar, width: 1, alpha: 0.88 });
      }
    }

    g.rect(0.5, 0.5, TILE_SIZE - 1, TILE_SIZE - 1)
      .stroke({ color: mortar, width: 2, alpha: 0.92 });
    g.rect(3, 3, TILE_SIZE - 6, 3).fill({ color: palette.stoneLight, alpha: 0.13 });
    g.rect(3, TILE_SIZE - 6, TILE_SIZE - 6, 3).fill({ color: 0x000000, alpha: 0.18 });
    return;

    const tone = () => palette.stone[Math.floor(rng() * palette.stone.length)];

    if (kind === 'rocks') {
      for (let i = 0; i < 3; i += 1) {
        const cx = 18 + rng() * 28;
        const cy = 28 + rng() * 18;
        const r = 9 + rng() * 7;
        g.ellipse(cx, cy, r, r * 0.78).fill({ color: tone() }).stroke({ color: palette.stoneDark, width: 1, alpha: 0.55 });
        g.ellipse(cx - r * 0.25, cy - r * 0.3, r * 0.38, r * 0.24).fill({ color: palette.stoneLight, alpha: 0.22 });
      }
    } else if (kind === 'rubble') {
      for (let i = 0; i < 6; i += 1) {
        const s = 5 + rng() * 7;
        const cx = 12 + rng() * 40;
        const cy = 30 + rng() * 18;
        g.poly([cx, cy, cx + s, cy - s * 0.3, cx + s * 0.8, cy + s * 0.6, cx - s * 0.2, cy + s * 0.5])
          .fill({ color: tone() }).stroke({ color: palette.stoneDark, width: 0.8, alpha: 0.5 });
      }
    } else if (kind === 'wall') {
      // Cracked wall — a tall block beside a broken-down stub.
      g.rect(12, 22, 22, 32).fill({ color: tone() }).stroke({ color: palette.stoneDark, width: 1.4, alpha: 0.8 });
      g.rect(34, 34, 18, 20).fill({ color: tone() }).stroke({ color: palette.stoneDark, width: 1.4, alpha: 0.8 });
      g.rect(12, 22, 22, 3).fill({ color: palette.stoneLight, alpha: 0.18 }); // top highlight
      g.moveTo(22, 24).lineTo(19, 38).lineTo(24, 52).stroke({ color: palette.stoneDark, width: 1.2, alpha: 0.6 }); // crack
    } else if (kind === 'pillar') {
      // Broken pillar on a footing.
      g.rect(22, 16, 18, 34).fill({ color: tone() }).stroke({ color: palette.stoneDark, width: 1.4, alpha: 0.8 });
      g.rect(17, 48, 28, 7).fill({ color: tone() }).stroke({ color: palette.stoneDark, width: 1.2, alpha: 0.7 });
      g.rect(22, 16, 18, 3).fill({ color: palette.stoneLight, alpha: 0.2 });
      for (let i = 0; i < 3; i += 1) g.rect(22, 24 + i * 8, 18, 1.4).fill({ color: palette.stoneDark, alpha: 0.45 });
    } else { // masonry — a couple of collapsed brick courses
      for (let r = 0; r < 3; r += 1) {
        const yy = TILE_SIZE - 16 - r * 11;
        const offset = (r % 2) * 8;
        for (let bx = 0; bx < 3; bx += 1) {
          if (r >= 1 && rng() < 0.35) continue; // missing/collapsed bricks
          g.rect(8 + bx * 16 + offset, yy, 15, 9).fill({ color: tone() }).stroke({ color: palette.stoneDark, width: 1, alpha: 0.6 });
        }
      }
    }
  }

  // --- board assembly (runs once) ---------------------------------------------

  function buildBoard() {
    if (state.terrainBuilt || !state.groundLayer) return;
    const Pixi = window.PIXI;
    if (!Pixi?.Sprite) return;

    const min = state.bounds.min ?? -WORLD_RADIUS;
    const max = state.bounds.max ?? WORLD_RADIUS;
    for (let y = min; y <= max; y += 1) {
      for (let x = min; x <= max; x += 1) {
        const zone = zoneTypeIdForTile(x, y);
        const ground = makeTileSprite(groundTexture(zone, Math.floor(hashTile(x, y, 0) * GROUND_VARIANTS)), x, y);
        ground.rotation = Math.floor(hashTile(x, y, 3) * 4) * (Math.PI / 2);
        if (hashTile(x, y, 4) < 0.5) ground.scale.x = -1;
        state.groundLayer.addChild(ground);

        const blocked = getBlockedTile({ x, y });
        if (blocked) {
          const kind = OBSTACLE_KINDS[Math.floor(hashTile(x, y, 1) * OBSTACLE_KINDS.length)];
          const obstacle = makeTileSprite(obstacleTexture(kind, Math.floor(hashTile(x, y, 2) * OBSTACLE_VARIANTS), zone), x, y);
          if (hashTile(x, y, 5) < 0.5) obstacle.scale.x = -1;
          state.groundLayer.addChild(obstacle);
        } else if (!isRoadTile({ x, y }) && hashTile(x, y, 7) < PROP_CHANCE) {
          // Rare, subtle stone decal on open ground.
          const prop = makeTileSprite(propTexture(zone, Math.floor(hashTile(x, y, 8) * 3)), x, y);
          if (hashTile(x, y, 9) < 0.5) prop.scale.x = -1;
          state.groundLayer.addChild(prop);
        }
      }
    }

    drawGrid();

    state.roads.forEach((tile) => {
      if (!isInBounds(tile)) return;
      const mask =
        (isRoadTile({ x: tile.x, y: tile.y - 1 }) ? 1 : 0) |
        (isRoadTile({ x: tile.x + 1, y: tile.y }) ? 2 : 0) |
        (isRoadTile({ x: tile.x, y: tile.y + 1 }) ? 4 : 0) |
        (isRoadTile({ x: tile.x - 1, y: tile.y }) ? 8 : 0);
      const variant = Math.floor(hashTile(tile.x, tile.y, 6) * ROAD_VARIANTS);
      const zone = zoneTypeIdForTile(tile.x, tile.y);
      state.roadLayer.addChild(makeTileSprite(roadTexture(mask, variant, zone), tile.x, tile.y));
    });

    state.terrainBuilt = true;
  }

  // Faint static grid — barely visible by default; emphasis for the active /
  // hovered / path tiles is layered on top by the dynamic passes below.
  function drawGrid() {
    const layer = state.gridLayer;
    if (!layer) return;
    layer.clear();

    const min = state.bounds.min ?? -WORLD_RADIUS;
    const max = state.bounds.max ?? WORLD_RADIUS;

    for (let x = min; x <= max + 1; x += 1) {
      layer.moveTo(x * TILE_SIZE, min * TILE_SIZE).lineTo(x * TILE_SIZE, (max + 1) * TILE_SIZE);
    }
    for (let y = min; y <= max + 1; y += 1) {
      layer.moveTo(min * TILE_SIZE, y * TILE_SIZE).lineTo((max + 1) * TILE_SIZE, y * TILE_SIZE);
    }
    layer.stroke({ color: GRID_COLOR, width: 1, alpha: 0.05 });
  }

  function cellOutline(layer, tile, color, alpha, width) {
    const left = tile.x * TILE_SIZE;
    const top = tile.y * TILE_SIZE;
    layer.rect(left + 1, top + 1, TILE_SIZE - 2, TILE_SIZE - 2).stroke({ color, width, alpha });
  }

  // --- dynamic layers ---------------------------------------------------------

  function drawFog() {
    const layer = state.fogLayer;
    if (!layer) return;
    layer.clear();


    // Event tile glows plus the active tile outline. No fog of war is drawn.
    state.events.forEach((event) => {
      const cx = event.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = event.y * TILE_SIZE + TILE_SIZE / 2;
      if (event.type === 'boss') {
        layer.rect(event.x * TILE_SIZE + 6, event.y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12).fill({ color: BOARD_COLORS.dangerousGlow, alpha: 0.16 });
      } else if (event.type === 'soul-cache') {
        layer.circle(cx, cy, TILE_SIZE * 0.32).fill({ color: BOARD_COLORS.soulNode, alpha: 0.16 });
      } else if (event.type === 'dungeon-portal') {
        layer.circle(cx, cy, TILE_SIZE * 0.4).fill({ color: BOARD_COLORS.portalGlow, alpha: 0.18 });
      } else if (event.type === 'landmark') {
        layer.circle(cx, cy, TILE_SIZE * 0.34).fill({ color: BOARD_COLORS.landmark, alpha: 0.12 });
      }
    });

    // Active tile: a touch more grid emphasis (no heavy box).
    cellOutline(layer, state.position, BOARD_COLORS.selection, 0.32, 1);
  }

  function drawHover() {
    const layer = state.hoverLayer;
    if (!layer) return;
    layer.clear();
    if (!state.hoverTile || state.moving) return;
    if (positionsEqual(state.hoverTile, state.position)) return;
    cellOutline(layer, state.hoverTile, GRID_COLOR, 0.5, 1);
  }

  function drawPath() {
    const layer = state.pathLayer;
    if (!layer) return;
    layer.clear();

    const path = state.selectedPath || [];
    if (path.length < 2) return;

    // A soft ember trail rather than outlined boxes; the destination is a touch
    // stronger so it reads as the target.
    path.forEach((tile, index) => {
      if (index === 0) return;
      const c = tileCenter(tile);
      const isTarget = index === path.length - 1;
      if (isTarget) {
        cellOutline(layer, tile, EMBER_GLOW, 0.4, 1.5);
        return; // glow handled by the animated pulse
      }
      cellOutline(layer, tile, EMBER_GLOW, 0.08, 1);
      layer.circle(c.x, c.y, 4).fill({ color: EMBER_GLOW, alpha: 0.12 });
      layer.circle(c.x, c.y, 1.8).fill({ color: EMBER_CORE, alpha: 0.7 });
    });
  }

  // Animated destination marker — a pulsing ember ring (runs on the ticker).
  function updatePathPulse() {
    const layer = state.pathPulse;
    if (!layer) return;
    layer.clear();

    const path = state.selectedPath || [];
    if (path.length < 2 || state.moving) return;

    const c = tileCenter(path[path.length - 1]);
    const phase = (performance.now() % 1600) / 1600;
    layer.circle(c.x, c.y, 8 + phase * 10).stroke({ color: EMBER_GLOW, width: 1.5, alpha: 0.32 * (1 - phase) });
    layer.circle(c.x, c.y, 6).fill({ color: EMBER_GLOW, alpha: 0.14 });
    layer.circle(c.x, c.y, 2.6).fill({ color: EMBER_CORE, alpha: 0.9 });
  }

  function drawMarkers() {
    drawEventMarkers();
    drawHunter();
  }

  function drawEventMarkers() {
    const layer = state.markerLayer;
    const Pixi = window.PIXI;
    if (!layer || !Pixi?.Graphics) return;

    layer.removeChildren().forEach((child) => child.destroy());

    state.events.forEach((event) => {
      const marker = new Pixi.Graphics();
      const color = EVENT_COLORS[event.type] || 0xe8c76a;
      const position = tileCenter(event);

      if (event.type === 'boss') {
        marker.rect(-15, -15, 30, 30).fill({ color: BOARD_COLORS.dangerous, alpha: 0.88 }).stroke({ color, width: 2, alpha: 0.92 });
        marker.rotation = Math.PI / 4;
      } else if (event.type === 'dungeon-portal') {
        marker.circle(0, 0, 24).fill({ color: BOARD_COLORS.portalGlow, alpha: 0.22 });
        marker.circle(0, 0, 15).fill({ color: BOARD_COLORS.portal, alpha: 0.9 }).stroke({ color, width: 3, alpha: 1 });
      } else if (event.type === 'landmark') {
        marker.rect(-12, -12, 24, 24).fill({ color: 0x111819, alpha: 0.9 }).stroke({ color, width: 2, alpha: 0.85 });
        marker.moveTo(0, -17).lineTo(14, 0).lineTo(0, 17).lineTo(-14, 0).lineTo(0, -17)
          .stroke({ color, width: 1.5, alpha: 0.72 });
      } else {
        marker.circle(0, 0, 16).fill({ color, alpha: 0.28 }).stroke({ color, width: 2, alpha: 0.9 });
        marker.circle(0, 0, 7).fill({ color: 0xbfeaf5, alpha: 0.88 });
      }

      marker.position.set(position.x, position.y);
      layer.addChild(marker);
    });
  }

  function drawEncounterMarkers() {
    const layer = state.encounterLayer;
    const Pixi = window.PIXI;
    if (!layer || !Pixi?.Graphics) return;

    layer.removeChildren().forEach((child) => child.destroy({ children: true }));

    state.encounters.forEach((encounter) => {
      const center = tileCenter(encounter);
      const ringColor = rarityHex(encounter.keyDemon?.rarity);
      const selected = state.selectedEncounter?.id === encounter.id;
      const radius = 22;

      const node = new Pixi.Container();
      node.position.set(center.x, center.y);

      // A grounded world node: a soft ground shadow, a faint rarity glow, and a
      // single thin ring around the portrait — no UI-sticker rings or runes.
      const base = new Pixi.Graphics();
      base.ellipse(0, radius + 3, radius - 2, 5).fill({ color: 0x000000, alpha: 0.35 }); // shadow
      base.circle(0, 0, radius + 4).fill({ color: ringColor, alpha: selected ? 0.18 : 0.09 }); // glow
      base.circle(0, 0, radius + 1).fill({ color: 0x080c0e, alpha: 0.92 });
      base.circle(0, 0, radius + 1).stroke({ color: ringColor, width: selected ? 2.5 : 1.5, alpha: selected ? 0.95 : 0.6 });
      node.addChild(base);

      const texture = state.encounterTextures.get(encounter.keyDemon?.imageUrl);
      if (texture) {
        const portrait = new Pixi.Sprite(texture);
        portrait.anchor.set(0.5);
        portrait.width = radius * 2;
        portrait.height = radius * 2;

        const mask = new Pixi.Graphics();
        mask.circle(0, 0, radius).fill({ color: 0xffffff });
        node.addChild(mask);
        portrait.mask = mask;
        node.addChild(portrait);
      } else {
        base.circle(0, 0, radius).fill({ color: ringColor, alpha: 0.25 });
      }

      layer.addChild(node);
    });
  }

  function drawHunter() {
    const layer = state.hunterLayer;
    const frame = state.hunterFrame;
    const avatar = state.hunterAvatar;
    if (!layer || !frame) return;

    const center = tileCenter(state.hunterRenderPosition || state.position);
    const hasAvatar = Boolean(avatar && state.hunterAvatarTexture);

    frame.clear();

    if (hasAvatar) {
      frame.rect(center.x - 20, center.y - 20, 40, 40)
        .fill({ color: 0x050b0e, alpha: 0.96 })
        .stroke({ color: BOARD_COLORS.selection, width: 2, alpha: 0.92 });
      avatar.texture = state.hunterAvatarTexture;
      avatar.visible = true;
      avatar.position.set(center.x, center.y);
      avatar.width = 34;
      avatar.height = 34;
    } else {
      if (avatar) avatar.visible = false;
      frame.rect(center.x - 20, center.y - 20, 40, 40)
        .fill({ color: 0x050b0e, alpha: 0.96 })
        .stroke({ color: BOARD_COLORS.selection, width: 2, alpha: 0.92 });
      frame.circle(center.x, center.y, 9)
        .fill({ color: 0x6fd6bd, alpha: 0.95 })
        .stroke({ color: 0xf8fbf9, width: 1, alpha: 0.64 });
    }
  }

  function drawStepEffect() {
    const layer = state.effectLayer;
    if (!layer) return;

    layer.clear();

    const stepEvent = state.recentStepEvent;
    if (!stepEvent?.position) return;

    const center = tileCenter(stepEvent.position);
    const color = stepEvent.type === 'ambush' ? 0xe4685e : 0x6fd6bd;
    layer.circle(center.x, center.y, 24)
      .stroke({ color, width: 3, alpha: stepEvent.type === 'ambush' ? 0.72 : 0.34 });
    layer.circle(center.x, center.y, 6)
      .fill({ color, alpha: stepEvent.type === 'ambush' ? 0.74 : 0.32 });
  }

  function renderPanels() {
    renderPositionPanel();
    renderTeamSummary();
    renderEncounterPanel();
    renderEventPanel();
    renderTravelPanel();
  }

  function renderPositionPanel() {
    setText(elements.worldPositionChip, `${state.position.x}, ${state.position.y}`);
  }

  function renderTeamSummary() {
    const team = state.activeTeam || {};
    const members = Array.isArray(team.members) ? team.members : [];

    if (!elements.worldTeamSummary) return;

    if (!members.length) {
      elements.worldTeamSummary.innerHTML = `
        <p class="world-empty-text">No active team.</p>
      `;
      return;
    }

    elements.worldTeamSummary.innerHTML = `
      <div class="world-team-count"><strong>${formatNumber(team.count || members.length)}</strong><span>Hunters' demons</span></div>
      <div class="world-team-list">
        ${members.map(renderTeamMember).join('')}
      </div>
    `;
  }

  function renderTeamMember(member) {
    const species = member.species || 'Demon';
    const rarity = member.rarity || 'common';

    return `
      <article class="world-team-member">
        <span class="world-team-rarity world-rarity-${escapeAttribute(rarity)}"></span>
        <span>
          <strong>${escapeHtml(species)}</strong>
          <small>${escapeHtml(capitalize(rarity))} / ${formatNumber(member.hp)} HP / ${formatNumber(member.atk)} ATK</small>
        </span>
      </article>
    `;
  }

  function renderEncounterPanel() {
    if (!elements.worldEncounterList) return;

    const players = state.playersAt || [];
    if (!players.length) {
      elements.worldEncounterList.innerHTML = '<p class="world-empty-text">No hunters on this tile.</p>';
      return;
    }

    elements.worldEncounterList.innerHTML = players.map((player) => {
      const cooldownUntil = state.challengeCooldowns.get(player.id) || 0;
      const isCoolingDown = cooldownUntil > Date.now();
      const label = isCoolingDown ? 'Cooldown' : 'Challenge';

      return `
        <article class="world-encounter-player">
          <span class="world-encounter-mark" aria-hidden="true"></span>
          <span class="world-encounter-copy">
            <strong>${escapeHtml(player.username || 'Unknown Hunter')}</strong>
            <small>Level ${formatNumber(player.level || 1)} / ${formatCoords(player)}</small>
          </span>
          <button class="btn btn-outline-light btn-sm" type="button" data-challenge-player="${escapeAttribute(player.id)}" ${isCoolingDown ? 'disabled' : ''}>${label}</button>
        </article>
      `;
    }).join('');
  }

  function renderEventPanel() {
    const event = state.currentEvent;
    if (!elements.worldEventPanel) return;

    if (!event) {
      elements.worldEventPanel.innerHTML = '<p class="world-empty-text">No event on this tile.</p>';
      return;
    }

    const action = getEventAction(event);
    elements.worldEventPanel.innerHTML = `
      <article class="world-event-card world-event-${escapeAttribute(event.type)}">
        <span class="world-event-type">${escapeHtml(getEventLabel(event.type))}</span>
        <strong>${escapeHtml(event.title || 'World Event')}</strong>
        <p>${escapeHtml(event.description || '')}</p>
        ${action}
      </article>
    `;
  }

  function renderTravelPanel() {
    if (!elements.worldTravelPanel) return;

    const logs = state.travelLog || [];
    if (!logs.length) {
      elements.worldTravelPanel.innerHTML = '<p class="world-empty-text">No travel yet.</p>';
      return;
    }

    elements.worldTravelPanel.innerHTML = `<div class="world-travel-log">${logs.slice(0, 5).map(renderTravelLogItem).join('')}</div>`;
  }

  function renderTravelLogItem(entry) {
    const isAmbush = entry.type === 'ambush';
    const title = isAmbush ? 'Ambush' : 'No Event';

    return `
      <article class="world-travel-log-item ${isAmbush ? 'is-ambush' : ''}">
        <span aria-hidden="true"></span>
        <strong>${title}</strong>
        <small>${formatCoords(entry.position)}</small>
      </article>
    `;
  }

  function getEventAction(event) {
    if (event.type === 'dungeon-portal') {
      return `<button class="btn btn-warning btn-sm" type="button" data-world-event-action="dungeon-portal">Dungeon</button>`;
    }

    if (event.type === 'boss') {
      return `<button class="btn btn-outline-light btn-sm" type="button" data-world-event-action="boss">Boss Fight</button>`;
    }

    if (event.type === 'soul-cache') {
      return `<button class="btn btn-primary btn-sm" type="button" data-world-event-action="soul-cache">${renderSoulAmount('Open', { showLabel: false })}</button>`;
    }

    return '';
  }

  function onPointerDown(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;

    const canvas = event.currentTarget;
    canvas.setPointerCapture?.(event.pointerId);
    const pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false
    };

    state.activePointers.set(event.pointerId, pointer);

    if (state.activePointers.size >= 2) {
      state.pointer = null;
      state.gestureWasPinch = true;
      state.pinch = getPinchState();
      return;
    }

    state.pointer = pointer;
  }

  function onPointerMove(event) {
    updateHover(event);

    const activePointer = state.activePointers.get(event.pointerId);
    if (!activePointer || !state.viewport) return;

    activePointer.clientX = event.clientX;
    activePointer.clientY = event.clientY;

    if (state.activePointers.size >= 2) {
      event.preventDefault();
      updatePinchZoom();
      return;
    }

    const pointer = state.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;

    const dx = event.clientX - pointer.lastX;
    const dy = event.clientY - pointer.lastY;
    const totalDx = event.clientX - pointer.startX;
    const totalDy = event.clientY - pointer.startY;

    if (!pointer.dragging && Math.hypot(totalDx, totalDy) >= CLICK_THRESHOLD) {
      pointer.dragging = true;
    }

    if (pointer.dragging) {
      state.viewport.x += dx;
      state.viewport.y += dy;
      updateCameraStatus();
    }

    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
  }

  // Track the hovered tile (mouse/pen only) to give the grid a subtle hint.
  function updateHover(event) {
    if (event.pointerType === 'touch' || state.activePointers.size > 0) {
      if (state.hoverTile) {
        state.hoverTile = null;
        drawHover();
      }
      return;
    }

    const tile = screenToTile(event.clientX, event.clientY);
    const next = tile && isInBounds(tile) ? tile : null;
    if (!next && !state.hoverTile) return;
    if (next && state.hoverTile && positionsEqual(next, state.hoverTile)) return;

    state.hoverTile = next;
    drawHover();
  }

  function clearHover() {
    if (!state.hoverTile) return;
    state.hoverTile = null;
    drawHover();
  }

  function onPointerUp(event) {
    const pointer = state.pointer;
    const wasClick = pointer && pointer.id === event.pointerId && !pointer.dragging && !state.gestureWasPinch;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    state.activePointers.delete(event.pointerId);

    if (wasClick) {
      const tile = screenToTile(event.clientX, event.clientY);
      if (tile && isInBounds(tile)) {
        handleMapTileClick(tile);
      }
    }

    if (state.activePointers.size >= 2) {
      state.pointer = null;
      state.pinch = getPinchState();
      return;
    }

    if (state.activePointers.size === 1) {
      state.pinch = null;
      state.pointer = getRemainingPointer({ dragging: true });
      return;
    }

    clearPointer();
  }

  function onPointerLeave(event) {
    clearHover();
    const pointer = state.pointer;
    if (pointer?.dragging || state.gestureWasPinch || state.activePointers.has(event.pointerId)) {
      clearPointer();
    }
  }

  function clearPointer() {
    state.pointer = null;
    state.activePointers.clear();
    state.pinch = null;
    state.gestureWasPinch = false;
  }

  function getRemainingPointer(options = {}) {
    const pointer = Array.from(state.activePointers.values())[0] || null;
    if (!pointer) return null;

    return {
      ...pointer,
      startX: pointer.clientX,
      startY: pointer.clientY,
      lastX: pointer.clientX,
      lastY: pointer.clientY,
      dragging: Boolean(options.dragging)
    };
  }

  function getPinchState() {
    const pinch = getPinchMetrics();
    if (!pinch || !state.viewport) return null;

    const scale = state.viewport.scale.x || 1;
    return {
      distance: pinch.distance,
      scale,
      worldCenter: {
        x: (pinch.center.x - state.viewport.x) / scale,
        y: (pinch.center.y - state.viewport.y) / scale
      }
    };
  }

  function updatePinchZoom() {
    const pinch = getPinchMetrics();
    if (!pinch || !state.pinch || !state.viewport) return;

    const ratio = pinch.distance / Math.max(1, state.pinch.distance);
    const nextScale = clamp(state.pinch.scale * ratio, MIN_ZOOM, MAX_ZOOM);

    state.viewport.scale.set(nextScale);
    state.viewport.x = pinch.center.x - state.pinch.worldCenter.x * nextScale;
    state.viewport.y = pinch.center.y - state.pinch.worldCenter.y * nextScale;
    updateCameraStatus();
  }

  function getPinchMetrics() {
    const points = Array.from(state.activePointers.values()).slice(0, 2).map((pointer) => getCanvasPoint(pointer.clientX, pointer.clientY));
    if (points.length < 2) return null;

    const [a, b] = points;
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      center: {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      }
    };
  }

  function onWheel(event) {
    if (!state.viewport) return;

    event.preventDefault();

    const oldScale = state.viewport.scale.x || 1;
    const nextScale = clamp(oldScale * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);

    if (nextScale === oldScale) return;

    zoomAtClientPoint(event.clientX, event.clientY, nextScale);
  }

  function zoomAtClientPoint(clientX, clientY, nextScale) {
    if (!state.viewport) return;

    const screenPoint = getCanvasPoint(clientX, clientY);
    const oldScale = state.viewport.scale.x || 1;
    const worldX = (screenPoint.x - state.viewport.x) / oldScale;
    const worldY = (screenPoint.y - state.viewport.y) / oldScale;

    state.viewport.scale.set(nextScale);
    state.viewport.x = screenPoint.x - worldX * nextScale;
    state.viewport.y = screenPoint.y - worldY * nextScale;
    updateCameraStatus();
  }

  function resizeCanvas() {
    const app = state.app;
    if (!app) return;

    const size = getHostSize();
    app.renderer.resize(size.width, size.height);
    if (!state.initialCameraCentered) {
      centerOnHunter();
    }
    updateCameraStatus();
  }

  function setZoom(value, options = {}) {
    if (!state.viewport) return;

    const nextScale = clamp(value, MIN_ZOOM, MAX_ZOOM);

    if (options.preserveCenter) {
      const centerBefore = getViewportCenterWorld();
      state.viewport.scale.set(nextScale);
      centerOnWorldPoint(centerBefore);
    } else {
      state.viewport.scale.set(nextScale);
    }

    updateCameraStatus();
  }

  function centerOnHunter() {
    centerOnWorldPoint(tileCenter(state.position));
  }

  function centerOnWorldPoint(point) {
    const app = state.app;
    if (!app || !state.viewport) return;

    const width = app.screen?.width || app.renderer.width;
    const height = app.screen?.height || app.renderer.height;
    const scale = state.viewport.scale.x || 1;

    state.viewport.x = width / 2 - point.x * scale;
    state.viewport.y = height / 2 - point.y * scale;
    updateCameraStatus();
  }

  function getViewportCenterWorld() {
    const app = state.app;
    const width = app ? (app.screen?.width || app.renderer.width) : 0;
    const height = app ? (app.screen?.height || app.renderer.height) : 0;
    const scale = state.viewport?.scale.x || 1;

    return {
      x: (width / 2 - (state.viewport?.x || 0)) / scale,
      y: (height / 2 - (state.viewport?.y || 0)) / scale
    };
  }

  function screenToTile(clientX, clientY) {
    if (!state.viewport) return null;

    const point = getCanvasPoint(clientX, clientY);
    const scale = state.viewport.scale.x || 1;
    const worldX = (point.x - state.viewport.x) / scale;
    const worldY = (point.y - state.viewport.y) / scale;

    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    };
  }

  function getCanvasPoint(clientX, clientY) {
    const canvas = state.app?.canvas || state.app?.view;
    const rect = canvas?.getBoundingClientRect?.();

    return {
      x: clientX - (rect?.left || 0),
      y: clientY - (rect?.top || 0)
    };
  }

  function getEventAt(position) {
    return state.events.find((event) => event.x === position.x && event.y === position.y) || null;
  }

  function hasEventAt(position) {
    return Boolean(getEventAt(position));
  }

  function getEncounterAt(position) {
    return state.encounters.find((encounter) => encounter.x === position.x && encounter.y === position.y) || null;
  }

  function rarityCss(rarity) {
    return RARITY_COLORS[rarity] || RARITY_COLORS.common;
  }

  function rarityHex(rarity) {
    return Number.parseInt(rarityCss(rarity).slice(1), 16);
  }

  function getBlockedTile(position) {
    return state.blockedMap.get(getTileKey(position)) || null;
  }

  function isRoadTile(position) {
    return state.roadKeys.has(getTileKey(position));
  }

  function isBlocked(position) {
    return Boolean(getBlockedTile(position));
  }

  function positionsEqual(a, b) {
    return Number(a?.x) === Number(b?.x) && Number(a?.y) === Number(b?.y);
  }

  function tileCenter(position) {
    return {
      x: position.x * TILE_SIZE + TILE_SIZE / 2,
      y: position.y * TILE_SIZE + TILE_SIZE / 2
    };
  }

  function isInBounds(position) {
    const min = state.bounds.min ?? -WORLD_RADIUS;
    const max = state.bounds.max ?? WORLD_RADIUS;
    return position.x >= min && position.x <= max && position.y >= min && position.y <= max;
  }

  function normalizePosition(position = {}) {
    return {
      x: Math.trunc(Number(position.x) || 0),
      y: Math.trunc(Number(position.y) || 0)
    };
  }

  function getTileKey(position) {
    return `${position.x},${position.y}`;
  }

  function getEventLabel(type) {
    if (type === 'boss') return 'Boss Fight';
    if (type === 'soul-cache') return 'Soul Cache';
    if (type === 'dungeon-portal') return 'Dungeon Portal';
    if (type === 'landmark') return 'Landmark';
    return 'Event';
  }

  function getInitialZoom() {
    const width = elements.worldCanvasHost?.clientWidth || 0;
    if (width < 540) return 0.7;
    if (width < 900) return 0.82;
    return 0.95;
  }

  function getHostSize() {
    const host = elements.worldCanvasHost;
    return {
      width: Math.max(320, Math.floor(host?.clientWidth || 320)),
      height: Math.max(300, Math.floor(host?.clientHeight || 420))
    };
  }

  function updateCameraStatus() {
    const scale = state.viewport?.scale.x || 1;
    setText(elements.worldZoomChip, `${Math.round(scale * 100)}%`);
    updateTargetTooltip();
  }

  async function loadHunterAvatar() {
    const Pixi = window.PIXI;
    if (!Pixi) return;

    const imageUrl = state.player?.profileDemonImageUrl || DEFAULT_PROFILE_IMAGE_URL;

    try {
      state.hunterAvatarTexture = Pixi.Assets
        ? await Pixi.Assets.load(imageUrl)
        : Pixi.Texture.from(imageUrl);
    } catch (error) {
      state.hunterAvatarTexture = null;
    }
  }

  async function loadEncounterTextures() {
    const Pixi = window.PIXI;
    if (!Pixi || !state.encounters.length) return;

    const urls = Array.from(new Set(
      state.encounters
        .map((encounter) => encounter.keyDemon?.imageUrl)
        .filter(Boolean)
    ));

    await Promise.all(urls.map(async (url) => {
      if (state.encounterTextures.has(url)) return;
      try {
        const texture = Pixi.Assets ? await Pixi.Assets.load(url) : Pixi.Texture.from(url);
        state.encounterTextures.set(url, texture);
      } catch (error) {
        state.encounterTextures.set(url, null);
      }
    }));
  }

  function updateTargetTooltip() {
    updateEncounterTooltip();

    const tooltip = elements.worldTargetTooltip;
    const target = state.selectedTarget;
    const path = state.selectedPath || [];
    if (!tooltip) return;

    // The encounter tooltip already labels the tile, so suppress the coord one.
    if (!target || path.length < 2 || state.moving || !state.viewport || state.selectedEncounter) {
      tooltip.classList.add('d-none');
      return;
    }

    const center = tileCenter(target);
    const scale = state.viewport.scale.x || 1;
    const x = state.viewport.x + center.x * scale;
    const y = state.viewport.y + center.y * scale;

    tooltip.textContent = formatCoords(target);
    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
    tooltip.classList.remove('d-none');
  }

  function showEncounterTooltip(encounter) {
    state.selectedEncounter = encounter;
    renderEncounterTooltip();
    updateEncounterTooltip();
  }

  function hideEncounterTooltip() {
    if (!state.selectedEncounter) return;
    state.selectedEncounter = null;
    elements.worldEncounterTooltip?.classList.add('d-none');
  }

  function renderEncounterTooltip() {
    const tooltip = elements.worldEncounterTooltip;
    const encounter = state.selectedEncounter;
    if (!tooltip || !encounter) return;

    const team = Array.isArray(encounter.team) ? encounter.team : [];
    const difficulty = Math.max(1, Math.min(10, Number(encounter.difficulty) || 1));

    // No stats here on purpose — the player learns the team's strength in combat.
    const demons = team.map((member) => {
      const url = member.imageUrl || '';
      const color = rarityCss(member.rarity);
      const elite = member.elite ? ' is-elite' : '';
      return `
        <span class="world-enc-demon${elite}" style="--rarity-color:${color}" title="${escapeAttribute(capitalize(member.rarity || 'common'))}">
          <img src="${escapeAttribute(url)}" alt="" width="34" height="34" loading="lazy">
        </span>
      `;
    }).join('');

    const meter = Array.from({ length: 10 }, (item, index) => (
      `<span class="world-enc-pip${index < difficulty ? ' is-on' : ''}"></span>`
    )).join('');

    tooltip.innerHTML = `
      <div class="world-enc-demons">${demons}</div>
      <div class="world-enc-difficulty">
        <span class="world-enc-difficulty-label">Difficulty</span>
        <span class="world-enc-meter">${meter}</span>
        <span class="world-enc-difficulty-value">${difficulty}/10</span>
      </div>
    `;
  }

  function updateEncounterTooltip() {
    const tooltip = elements.worldEncounterTooltip;
    const encounter = state.selectedEncounter;
    if (!tooltip) return;

    if (!encounter || state.moving || !state.viewport) {
      tooltip.classList.add('d-none');
      return;
    }

    const center = tileCenter(encounter);
    const scale = state.viewport.scale.x || 1;
    const x = state.viewport.x + center.x * scale;
    const y = state.viewport.y + (center.y - TILE_SIZE / 2) * scale;

    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
    tooltip.classList.remove('d-none');
  }

  function hideLoading() {
    elements.worldLoading?.classList.add('d-none');
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function getStepDelay() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 10 : 70;
  }

  function rememberCooldown(targetPlayerId, cooldownUntil) {
    const expiresAt = Date.parse(cooldownUntil || '');
    if (!Number.isFinite(expiresAt)) return;

    state.challengeCooldowns.set(targetPlayerId, expiresAt);
    window.setTimeout(() => renderEncounterPanel(), Math.max(0, expiresAt - Date.now()) + 50);
  }

  function setButtonBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle('is-busy', busy);
  }

  function setMessage(text, type) {
    if (!elements.appMessage) return;
    elements.appMessage.textContent = text;
    elements.appMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  function handleAuthError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      window.location.href = appUrl('/login');
      return;
    }

    setMessage(error.message || 'Something went wrong.', 'danger');
  }

  function destroyWorld() {
    state.cleanup.splice(0).forEach((cleanup) => cleanup());
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;

    state.app?.ticker?.remove(updatePathPulse);
    state.tileTextures.forEach((texture) => texture?.destroy?.(true));
    state.tileTextures.clear();
    state.terrainBuilt = false;

    if (state.app) {
      state.app.destroy(true);
      state.app = null;
    }
  }

  function addListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    state.cleanup.push(() => target.removeEventListener(type, handler, options));
  }

  function formatCoords(position) {
    return `${formatNumber(position.x)}, ${formatNumber(position.y)}`;
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString() : String(value || '-');
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function capitalize(value) {
    const text = String(value || '');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
