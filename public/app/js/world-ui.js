import { COMBAT_THEMES } from './dungeon/config.js';
import { registerDungeonActions } from './dungeon/registry.js';
import { state as dungeonState, elements as dungeonElements } from './dungeon/state.js';
import * as dungeonDom from './dungeon/dom.js';
import * as dungeonLifecycle from './dungeon/lifecycle.js';
import * as dungeonRender from './dungeon/render.js';
import * as dungeonCombat from './dungeon/combat.js?v=20260627-fire-nova-v3';
import * as dungeonRewards from './dungeon/rewards.js';
import * as dungeonPacts from './dungeon/pacts.js';
import * as dungeonHand from './dungeon/hand.js';
import * as dungeonRecruit from './dungeon/recruit.js';
import * as dungeonModals from './dungeon/modals.js';
import * as dungeonDragDrop from './dungeon/drag-drop.js';
import * as dungeonCards from './dungeon/cards.js';
import * as dungeonUtils from './dungeon/utils.js';

(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const appUrl = window.AmongDemons.appUrl || ((value) => value);
  const renderIcon = window.AmongDemons?.ui?.renderIcon || (() => '');
  const TILE_SIZE = 64;
  const WORLD_RADIUS = 50;
  const ZONE_START_RADIUS = 24;
  const TYPE_COUNT = 11;
  const ZONE_ROTATION = 0.045;
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 2.15;
  const AVERAGE_TERRAIN_COST = 2;
  const ROAD_MOVE_COST = AVERAGE_TERRAIN_COST - 1;
  const CLICK_THRESHOLD = 7;
  const STEP_DURATION_MS = 180;
  // Kept in sync with world-combat.js so the live hunt readout matches the server payout.
  const HUNT_DEFAULT_RESPAWN_SECONDS = 300;
  const HUNT_REWARD_CYCLE_CAP = 288;
  const WORLD_SIDE_PANEL_QUERY = '(max-width: 899.98px) and (orientation: portrait)';
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
    shrine: 0x3b1618,
    shrineGlow: 0xe8c76a,
    shrineSoul: 0x8de7ff,
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
    forsaken_shrine: BOARD_COLORS.shrineGlow,
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
    hunt: null,
    huntBusy: false,
    huntTicker: null,
    boundShrine: null,
    bindingShrine: false,
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
    gestureWasPinch: false,
    sidePanelMedia: null,
    sidePanelExpanded: false,
    activeWorldBattle: null,
    activeWorldBattleMeta: null,
    worldBattleReplayToken: 0
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
      'worldHuntTooltip',
      'worldTeamSummary',
      'worldShrinePanel',
      'worldEncounterHeading',
      'worldEncounterList',
      'worldTravelPanel',
      'worldSidePanel',
      'worldSideToggle',
      'worldBattleModal'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindDomControls() {
    elements.worldPositionButton?.addEventListener('click', () => resetCameraOnHunter());
    bindWorldSidePanel();

    elements.worldEncounterList?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const challengeButton = target?.closest('[data-challenge-player]');
      if (challengeButton) {
        challengePlayer(challengeButton.dataset.challengePlayer, challengeButton);
        return;
      }
      const tryHuntButton = target?.closest('[data-try-hunt]');
      if (tryHuntButton) {
        tryHunt(tryHuntButton.dataset.tryHunt, tryHuntButton);
        return;
      }
      const startHuntingButton = target?.closest('[data-start-hunting]');
      if (startHuntingButton) {
        startHunting(startHuntingButton.dataset.startHunting, startHuntingButton);
        return;
      }
      const stopHuntingButton = target?.closest('[data-stop-hunting]');
      if (stopHuntingButton) {
        stopHunting(stopHuntingButton);
      }
    });

    elements.worldTravelPanel?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const replayButton = target?.closest('[data-view-world-battle]');
      if (!replayButton) return;
      const entry = state.travelLog[Number(replayButton.dataset.viewWorldBattle)];
      if (entry?.battle) {
        showWorldBattleReplay(entry.battle, getWorldBattleMeta('ambush', entry.battle));
      }
    });

    elements.worldBattleModal?.addEventListener('hidden.bs.modal', () => {
      cancelWorldBattleReplay();
    });

    elements.worldShrinePanel?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest('[data-anchor-soul]');
      if (!button) return;
      anchorSoul(button);
    });
  }

  function bindWorldSidePanel() {
    if (!elements.worldSidePanel || !elements.worldSideToggle) return;

    elements.worldSideToggle.addEventListener('click', () => {
      state.sidePanelExpanded = !state.sidePanelExpanded;
      syncWorldSidePanel();
    });

    if (typeof window.matchMedia === 'function') {
      state.sidePanelMedia = window.matchMedia(WORLD_SIDE_PANEL_QUERY);
      state.sidePanelMedia.addEventListener?.('change', syncWorldSidePanel);
      state.cleanup.push(() => state.sidePanelMedia?.removeEventListener?.('change', syncWorldSidePanel));
    }

    syncWorldSidePanel();
  }

  function syncWorldSidePanel() {
    const panel = elements.worldSidePanel;
    const toggle = elements.worldSideToggle;
    if (!panel || !toggle) return;

    const sheetMode = Boolean(state.sidePanelMedia?.matches);
    panel.classList.toggle('is-sheet-mode', sheetMode);
    panel.classList.toggle('is-collapsed', sheetMode && !state.sidePanelExpanded);
    toggle.setAttribute('aria-expanded', String(!panel.classList.contains('is-collapsed')));
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
    state.shrineGlow = new Pixi.Graphics();    // animated soul smoke around forsaken shrines
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
    state.viewport.addChild(state.shrineGlow);
    state.viewport.addChild(state.markerLayer);
    state.viewport.addChild(state.encounterLayer);
    state.viewport.addChild(state.hunterLayer);
    state.viewport.addChild(state.effectLayer);
    app.stage.addChild(state.viewport);

    app.ticker.add(updatePathPulse);
    app.ticker.add(updateShrineGlow);

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
    state.hunt = normalizeHunt(payload.hunt);
    state.boundShrine = normalizeShrine(payload.boundShrine);
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

    if (isHuntActive()) {
      clearRoutePreview();
      setMessage('Stop hunting before you travel.', 'warning');
      return;
    }

    if (isBlocked(target)) {
      clearRoutePreview('blocked');
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

    state.selectedTarget = target;
    state.selectedPath = path;
    state.travelStatus = 'preview';
    state.recentStepEvent = null;

    const encounter = getEncounterAt(target);
    if (encounter) {
      showEncounterTooltip(encounter);
    } else {
      hideEncounterTooltip();
    }

    renderWorld();
    renderTravelPanel();
  }

  async function travelSelectedPath() {
    const path = (state.selectedPath || []).slice();
    if (state.moving || path.length < 2) return;
    if (isHuntActive()) {
      clearRoutePreview();
      setMessage('Stop hunting before you travel.', 'warning');
      return;
    }

    state.moving = true;
    state.travelStatus = 'moving';
    state.travelLog = [];
    state.recentStepEvent = null;
    renderTravelPanel();
    renderWorld();

    try {
      const payload = await commitTravelPath(path);
      const stepEvents = getTravelStepEvents(payload, path);

      let lostAmbush = false;
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
        state.currentEncounter = getEncounterAt(step);
        renderWorld();
        renderPanels();
        if (shouldShowWorldBattleReplay(stepEvent.battle)) {
          await showWorldBattleReplay(stepEvent.battle, getWorldBattleMeta('ambush', stepEvent.battle));
        } else if (stepEvent.type === 'ambush' && stepEvent.battle?.error) {
          setMessage(stepEvent.battle.error, 'warning');
        }
        await delay(getStepDelay());

        // A lost ambush drags the hunter back to their Anchored Shrine (or spawn),
        // so stop the march here and resolve the defeat instead of finishing the path.
        if (stepEvent.type === 'ambush' && stepEvent.battle?.winner === 'enemy') {
          lostAmbush = true;
          break;
        }
      }

      if (lostAmbush) {
        await resolveAmbushDefeat();
      } else {
        state.position = normalizePosition(payload.position || state.position);
        state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
        state.currentEvent = payload.currentEvent || getEventAt(state.position);
        state.currentEncounter = payload.currentEncounter || getEncounterAt(state.position);
        clearRoutePreview('arrived', { keepLog: true });
        renderPanels();
      }
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
      position: normalizePosition(events[index]?.position || step),
      battle: events[index]?.battle || null
    }));
  }

  async function resolveAmbushDefeat() {
    const recovery = await api('/api/world/ambush-defeat', { method: 'POST' });
    const returnPosition = normalizePosition(recovery.position || state.position);

    state.boundShrine = normalizeShrine(recovery.boundShrine);
    state.position = returnPosition;
    state.hunterRenderPosition = null;
    state.playersAt = Array.isArray(recovery.playersAt) ? recovery.playersAt : [];
    state.currentEvent = recovery.currentEvent || getEventAt(returnPosition);
    state.currentEncounter = recovery.currentEncounter || getEncounterAt(returnPosition);

    clearRoutePreview('arrived', { keepLog: true });
    centerOnHunter();
    setMessage(
      recovery.message || 'You were defeated and dragged back to your Anchored Shrine.',
      'danger'
    );
    renderPanels();
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
    const queue = [{ position: origin, cost: 0 }];
    const visited = new Set();
    const costs = new Map([[getTileKey(origin), 0]]);
    const cameFrom = new Map();

    while (queue.length) {
      const bestIndex = getLowestCostQueueIndex(queue);
      const currentEntry = queue.splice(bestIndex, 1)[0];
      const current = currentEntry.position;
      const currentKey = getTileKey(current);
      if (visited.has(currentKey)) continue;
      visited.add(currentKey);

      if (positionsEqual(current, destination)) {
        return rebuildPath(cameFrom, current);
      }

      getNeighbors(current).forEach((neighbor) => {
        const key = getTileKey(neighbor);
        if (visited.has(key) || !isInBounds(neighbor) || isBlocked(neighbor)) return;

        const nextCost = currentEntry.cost + tileMoveCost(neighbor);
        if (nextCost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) return;

        costs.set(key, nextCost);
        cameFrom.set(key, current);
        queue.push({ position: neighbor, cost: nextCost });
      });
    }

    return [];
  }

  function getLowestCostQueueIndex(queue) {
    let bestIndex = 0;
    let bestCost = queue[0]?.cost ?? 0;

    for (let index = 1; index < queue.length; index += 1) {
      if (queue[index].cost < bestCost) {
        bestCost = queue[index].cost;
        bestIndex = index;
      }
    }

    return bestIndex;
  }

  function tileMoveCost(position) {
    return isRoadTile(position) ? ROAD_MOVE_COST : AVERAGE_TERRAIN_COST;
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

  async function tryHunt(encounterId, button) {
    if (!encounterId || state.huntBusy) return;
    state.huntBusy = true;
    setButtonBusy(button, true);

    try {
      const payload = await api('/api/world/hunt/try', {
        method: 'POST',
        body: { encounterId }
      });
      state.hunt = normalizeHunt(payload.hunt);
      const won = payload.battle?.winner === 'player';
      if (shouldShowWorldBattleReplay(payload.battle)) {
        await showWorldBattleReplay(payload.battle, getWorldBattleMeta('try_hunt', payload.battle));
      }
      setMessage(won ? 'Hunting unlocked for this patrol.' : 'Try Hunt failed. Hunting remains locked.', won ? 'success' : 'warning');
    } catch (error) {
      handleAuthError(error);
    } finally {
      state.huntBusy = false;
      setButtonBusy(button, false);
      renderEncounterPanel();
    }
  }

  async function startHunting(encounterId, button) {
    if (!encounterId || state.huntBusy) return;
    state.huntBusy = true;
    setButtonBusy(button, true);

    try {
      const payload = await api('/api/world/hunting/start', {
        method: 'POST',
        body: { encounterId }
      });
      state.hunt = normalizeHunt(payload.hunt);
      setMessage('Hunting started. Current skill buffs were snapshotted.', 'success');
    } catch (error) {
      handleAuthError(error);
    } finally {
      state.huntBusy = false;
      setButtonBusy(button, false);
      renderEncounterPanel();
      syncHuntTicker();
    }
  }

  async function stopHunting(button) {
    if (state.huntBusy) return;
    state.huntBusy = true;
    setButtonBusy(button, true);

    try {
      const payload = await api('/api/world/hunting/stop', { method: 'POST' });
      state.hunt = normalizeHunt(payload.hunt);
      if (payload.player) {
        window.AmongDemons.ui?.updateNavAccount?.(payload.player);
      }
      const rewards = payload.rewards || {};
      setMessage(`Hunting stopped. Earned ${formatNumber(rewards.xp || 0)} XP and ${formatNumber(rewards.souls || 0)} Souls.`, 'success');
    } catch (error) {
      handleAuthError(error);
    } finally {
      state.huntBusy = false;
      setButtonBusy(button, false);
      renderEncounterPanel();
      syncHuntTicker();
    }
  }

  async function anchorSoul(button) {
    if (state.bindingShrine || state.moving) return;

    state.bindingShrine = true;
    setButtonBusy(button, true);

    try {
      const payload = await api('/api/world/shrine/bind', {
        method: 'POST',
        body: {}
      });

      state.boundShrine = normalizeShrine(payload.boundShrine);
      state.currentEvent = payload.currentShrine || getEventAt(state.position);
      setMessage(
        payload.message || 'Soul anchored. You will return to this Forsaken Shrine if defeated while traveling.',
        'success'
      );
      renderWorld();
    } catch (error) {
      handleAuthError(error);
    } finally {
      state.bindingShrine = false;
      setButtonBusy(button, false);
      renderPanels();
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
    ground: [0x121711, 0x151a13, 0x10150f],
    patch: 0x20291f,
    road: [0x261f14, 0x2d2618],
    roadEdge: 0x0d0a06,
    roadSheen: 0x4a3d22,
    stone: [0x302c25, 0x39342b, 0x28241e],
    stoneDark: 0x18130d,
    stoneLight: 0x4a4335,
    prop: 0x3b3529,
    fog: 0x070806,
    accent: 0xe4685e
  };
  const ZONE_COLOR_VARIANTS = {
    5: '#D8D0C4',
    9: '#A9B7C8'
  };
  const ZONE_PALETTES = Array.from({ length: TYPE_COUNT + 1 }, (item, typeId) => (
    typeId === 0 ? null : createZonePalette(typeId)
  ));
  const OBSTACLE_KINDS = ['brick-wall'];
  const GRID_COLOR = 0x39423a;
  const GROUND_VARIANTS = 6;
  const ROAD_VARIANTS = 2;
  const OBSTACLE_VARIANTS = 2;
  const PROP_CHANCE = 0.05; // rare, subtle stone decals on open ground
  const EMBER_CORE = 0xffd8a6;
  const EMBER_GLOW = 0xd9742e;

  function createZonePalette(typeId) {
    const accent = zoneAccentForType(typeId);
    const accentRgb = colorNumberToRgb(accent);

    return {
      ground: [
        tintBaseColor(DEFAULT_ZONE_PALETTE.ground[0], accentRgb, 0.08),
        tintBaseColor(DEFAULT_ZONE_PALETTE.ground[1], accentRgb, 0.1),
        tintBaseColor(DEFAULT_ZONE_PALETTE.ground[2], accentRgb, 0.07)
      ],
      patch: tintBaseColor(DEFAULT_ZONE_PALETTE.patch, accentRgb, 0.14),
      road: [
        tintBaseColor(DEFAULT_ZONE_PALETTE.road[0], accentRgb, 0.06),
        tintBaseColor(DEFAULT_ZONE_PALETTE.road[1], accentRgb, 0.08)
      ],
      roadEdge: tintBaseColor(DEFAULT_ZONE_PALETTE.roadEdge, accentRgb, 0.03),
      roadSheen: tintBaseColor(DEFAULT_ZONE_PALETTE.roadSheen, accentRgb, 0.13),
      stone: [
        tintBaseColor(DEFAULT_ZONE_PALETTE.stone[0], accentRgb, 0.08),
        tintBaseColor(DEFAULT_ZONE_PALETTE.stone[1], accentRgb, 0.1),
        tintBaseColor(DEFAULT_ZONE_PALETTE.stone[2], accentRgb, 0.07)
      ],
      stoneDark: tintBaseColor(DEFAULT_ZONE_PALETTE.stoneDark, accentRgb, 0.04),
      stoneLight: tintBaseColor(DEFAULT_ZONE_PALETTE.stoneLight, accentRgb, 0.14),
      prop: tintBaseColor(DEFAULT_ZONE_PALETTE.prop, accentRgb, 0.28),
      fog: tintBaseColor(DEFAULT_ZONE_PALETTE.fog, accentRgb, 0.03),
      accent
    };
  }

  function zoneAccentForType(typeId) {
    const color = ZONE_COLOR_VARIANTS[typeId] || COMBAT_THEMES[typeId]?.color || COMBAT_THEMES.default.color;
    return hexToColorNumber(color);
  }

  function tintBaseColor(baseColor, accentRgb, amount) {
    return rgbToColorNumber(mixRgb(colorNumberToRgb(baseColor), accentRgb, amount));
  }

  function mixRgb(from, to, amount) {
    const ratio = clamp(amount, 0, 1);
    return from.map((channel, index) => Math.round(channel + (to[index] - channel) * ratio));
  }

  function hexToColorNumber(value) {
    const normalized = String(value || '').trim().replace(/^#/, '');
    const parsed = Number.parseInt(normalized, 16);
    return Number.isFinite(parsed) ? parsed : 0xffffff;
  }

  function colorNumberToRgb(color) {
    return [
      (color >> 16) & 255,
      (color >> 8) & 255,
      color & 255
    ];
  }

  function rgbToColorNumber(rgb) {
    return ((rgb[0] & 255) << 16) | ((rgb[1] & 255) << 8) | (rgb[2] & 255);
  }

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
      if (zone === 8) {
        drawTreeObstacle(g, rng, palette);
        return;
      }
      if (zone === 3) {
        drawPoisonPuddle(g, rng, palette);
        return;
      }
      drawObstacle(g, kind, rng, palette);
    });
  }

  // Top-down cluster of dark leaves used to mask blocked tiles in the demon
  // type 8 zone. The tile stays blocked in pathing logic; this only changes how
  // it's drawn.
  function drawTreeObstacle(g, rng, palette) {
    const cx = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const cy = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const radius = TILE_SIZE * 0.46;

    // Deep, desaturated greens tinted by the zone accent — dark and brooding.
    const accentRgb = colorNumberToRgb(palette.accent);
    const leafDeep = tintBaseColor(0x0c1207, accentRgb, 0.12);
    const leafDark = tintBaseColor(0x14200d, accentRgb, 0.16);
    const leafMid = tintBaseColor(0x1f3214, accentRgb, 0.2);
    const leafEdge = tintBaseColor(0x35501f, accentRgb, 0.24); // faint rim light

    // A single pointed leaf (almond shape) from base (ox,oy) toward `angle`.
    const leaf = (ox, oy, angle, length, width, color, alpha) => {
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);
      const tipX = ox + ca * length;
      const tipY = oy + sa * length;
      const mx = ox + ca * length * 0.5;
      const my = oy + sa * length * 0.5;
      const px = -sa * width;
      const py = ca * width;
      g.moveTo(ox, oy)
        .quadraticCurveTo(mx + px, my + py, tipX, tipY)
        .quadraticCurveTo(mx - px, my - py, ox, oy)
        .fill({ color, alpha });
    };

    // Soft cast shadow pooled under the cluster.
    g.ellipse(cx + 3, cy + 4, radius * 0.85, radius * 0.72)
      .fill({ color: 0x000000, alpha: 0.32 });

    // Dark underlayer of leaves fanning out in every direction.
    const under = 9 + Math.floor(rng() * 3);
    for (let i = 0; i < under; i += 1) {
      const angle = (i / under) * Math.PI * 2 + (rng() - 0.5) * 0.5;
      const len = radius * (0.85 + rng() * 0.5);
      leaf(cx, cy, angle, len, radius * (0.2 + rng() * 0.08), leafDeep, 0.95);
    }

    // Mid-tone leaves clustered tighter, giving the canopy its body.
    const mid = 8 + Math.floor(rng() * 3);
    for (let i = 0; i < mid; i += 1) {
      const angle = rng() * Math.PI * 2;
      const dist = radius * (0.1 + rng() * 0.4);
      const ox = cx + Math.cos(angle) * dist;
      const oy = cy + Math.sin(angle) * dist;
      const len = radius * (0.55 + rng() * 0.4);
      const tone = rng() < 0.5 ? leafDark : leafMid;
      leaf(ox, oy, rng() * Math.PI * 2, len, radius * (0.18 + rng() * 0.08), tone, 0.95);
    }

    // A few lighter leaves catching the light near the top of the pile.
    const top = 4 + Math.floor(rng() * 3);
    for (let i = 0; i < top; i += 1) {
      const angle = rng() * Math.PI * 2;
      const dist = radius * (0.05 + rng() * 0.3);
      const ox = cx - 2 + Math.cos(angle) * dist;
      const oy = cy - 2 + Math.sin(angle) * dist;
      const len = radius * (0.4 + rng() * 0.3);
      leaf(ox, oy, rng() * Math.PI * 2, len, radius * (0.16 + rng() * 0.06), leafEdge, 0.55);
    }
  }

  // Top-down toxic puddle used to mask blocked tiles in the demon type 3 zone.
  // The tile stays blocked in pathing logic; this only changes how it's drawn.
  function drawPoisonPuddle(g, rng, palette) {
    const cx = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const cy = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const radius = TILE_SIZE * 0.46;

    // Sickly green ooze tones tinted by the zone accent.
    const accentRgb = colorNumberToRgb(palette.accent);
    const oozeBorder = tintBaseColor(0x081209, accentRgb, 0.28); // dark wet edge
    const oozeBody = tintBaseColor(0x1d3a22, accentRgb, 0.55);
    const oozeDeep = tintBaseColor(0x102414, accentRgb, 0.45);
    const oozeGlow = tintBaseColor(0x39663a, accentRgb, 0.7); // bright toxic sheen

    // A single irregular puddle outline. Summing a few sine harmonics at
    // different frequencies (rather than one) gives organic bumps and concave
    // bays instead of a regular polygon; the curve is then smoothed below.
    const lobes = 16;
    const h = [
      { freq: 2, amp: 0.16 + rng() * 0.1, phase: rng() * Math.PI * 2 },
      { freq: 3, amp: 0.12 + rng() * 0.08, phase: rng() * Math.PI * 2 },
      { freq: 5, amp: 0.07 + rng() * 0.06, phase: rng() * Math.PI * 2 }
    ];
    const pts = [];
    for (let i = 0; i < lobes; i += 1) {
      const a = (i / lobes) * Math.PI * 2;
      let raw = 0;
      for (const { freq, amp, phase } of h) raw += amp * Math.sin(a * freq + phase);
      // Asymmetric: shallow outward bulges (stay inside the tile) but deep
      // inward bays, which is what gives a puddle its lobed, irregular outline.
      const factor = 1 + (raw > 0 ? raw * 0.5 : raw * 0.95);
      const r = radius * factor;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.95 });
    }

    // Trace a smooth closed curve that passes through the midpoint of each edge,
    // using the raw vertices as quadratic control points — rounds off the shape.
    const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const start = mid(pts[lobes - 1], pts[0]);
    g.moveTo(start.x, start.y);
    for (let i = 0; i < lobes; i += 1) {
      const cur = pts[i];
      const m = mid(cur, pts[(i + 1) % lobes]);
      g.quadraticCurveTo(cur.x, cur.y, m.x, m.y);
    }
    g.closePath()
      .fill({ color: oozeBody })
      .stroke({ color: oozeBorder, width: 3, alpha: 0.95 });

    // One glossy highlight toward the upper-left (light source).
    g.ellipse(cx - radius * 0.22, cy - radius * 0.24, radius * 0.3, radius * 0.16)
      .fill({ color: oozeGlow, alpha: 0.4 });

    // Bubbles of toxic gas rising in the ooze — bright rims, dark mouths.
    const bubbles = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < bubbles; i += 1) {
      const a = rng() * Math.PI * 2;
      const dist = radius * (0.1 + rng() * 0.5);
      const bx = cx + Math.cos(a) * dist;
      const by = cy + Math.sin(a) * dist * 0.9;
      const r = radius * (0.07 + rng() * 0.08);
      g.circle(bx, by, r).fill({ color: oozeDeep, alpha: 0.9 })
        .stroke({ color: oozeGlow, width: 1.4, alpha: 0.7 });
      g.circle(bx - r * 0.3, by - r * 0.3, r * 0.32).fill({ color: oozeGlow, alpha: 0.7 });
    }
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
      } else if (event.type === 'forsaken_shrine') {
        // Soul-glow is drawn entirely by updateShrineGlow (above the roads), so the
        // smoke isn't clipped by road tiles. Nothing to draw on the fog layer here.
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

  // Animated soul glow for forsaken shrines — a gently breathing blue halo with a
  // few drifting "smoke" wisps that rise and fade in a loop (runs on the ticker).
  function updateShrineGlow() {
    const layer = state.shrineGlow;
    if (!layer) return;
    layer.clear();

    const shrines = (state.events || []).filter((event) => event.type === 'forsaken_shrine');
    if (!shrines.length) return;

    const now = performance.now();
    const soul = BOARD_COLORS.shrineSoul;
    const WISPS = 3;

    shrines.forEach((event) => {
      const c = tileCenter(event);
      const bound = isBoundShrine(event);
      const base = bound ? 0.26 : 0.16;
      const phase = (event.x * 13 + event.y * 7);

      // Steady (non-pulsing) soul halo, drawn here so it sits above the roads.
      layer.circle(c.x, c.y - 2, TILE_SIZE * 0.36).fill({ color: soul, alpha: bound ? 0.16 : 0.1 });

      // Rising wisps of soul-smoke: born at the shrine, drift up, expand, fade.
      for (let i = 0; i < WISPS; i += 1) {
        const seed = phase + i * 37;
        const life = ((now / 3200) + i / WISPS + seed * 0.013) % 1;
        const rise = life * 30;
        const drift = Math.sin(life * Math.PI * 2 + seed) * 5;
        const radius = 3.5 + life * 8;
        const alpha = Math.sin(life * Math.PI) * base * 0.7;
        if (alpha <= 0) continue;
        layer.circle(c.x + drift, c.y - 6 - rise, radius).fill({ color: soul, alpha });
      }
    });
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
      } else if (event.type === 'forsaken_shrine') {
        const bound = isBoundShrine(event);
        const soul = BOARD_COLORS.shrineSoul;
        // Same silhouette as the Old Watch landmark — a dark hollow box with an
        // inscribed star — just outlined in soul-blue. The floating smoke
        // (updateShrineGlow) supplies the glow, so no rings or core here.
        marker.rect(-12, -12, 24, 24).fill({ color: 0x111819, alpha: 0.9 }).stroke({ color: soul, width: bound ? 2.4 : 1.8, alpha: bound ? 0.95 : 0.78 });
        marker.moveTo(0, -17).lineTo(14, 0).lineTo(0, 17).lineTo(-14, 0).lineTo(0, -17)
          .stroke({ color: soul, width: 1.5, alpha: bound ? 0.85 : 0.62 });
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
    renderShrinePanel();
    renderEncounterPanel();
    renderTravelPanel();
    syncHuntTicker();
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

    elements.worldTeamSummary.innerHTML = `<div class="world-team-demons">${members.map(renderDemonPortrait).join('')}</div>`;
  }

  function renderShrinePanel() {
    if (!elements.worldShrinePanel) return;

    const currentShrine = state.moving ? null : getShrineAt(state.position);
    const boundShrine = state.boundShrine;
    const parts = [];

    if (boundShrine) {
      parts.push(`
        <article class="world-shrine-status is-bound">
          <span class="world-shrine-mark" aria-hidden="true"></span>
          <span class="world-shrine-copy">
            <strong>${escapeHtml(boundShrine.title || 'Forsaken Shrine')}</strong>
            <small>${escapeHtml(formatCoords(boundShrine))}</small>
          </span>
        </article>
      `);
    } else {
      parts.push(`
        <article class="world-shrine-status">
          <span class="world-shrine-mark" aria-hidden="true"></span>
          <span class="world-shrine-copy">
            <strong>Respawn Point</strong>
            <small>Default · ${escapeHtml(formatCoords({ x: 0, y: 0 }))}</small>
          </span>
        </article>
      `);
    }

    if (currentShrine) {
      const isCurrentAnchor = boundShrine && positionsEqual(currentShrine, boundShrine);
      parts.push(`
        <article class="world-shrine-action ${isCurrentAnchor ? 'is-current-anchor' : ''}">
          <div class="world-shrine-action-copy">
            <strong>${escapeHtml(currentShrine.title || 'Forsaken Shrine')}</strong>
            <small>Anchor your soul to this place.</small>
          </div>
          <button class="btn btn-warning btn-sm" type="button" data-anchor-soul ${state.bindingShrine ? 'disabled' : ''}>
            ${renderIcon('anchor')}
            <span>Anchor Soul</span>
          </button>
        </article>
      `);
    }

    elements.worldShrinePanel.innerHTML = parts.join('');
  }

  function renderEncounterPanel() {
    if (!elements.worldEncounterList) return;
    setText(elements.worldEncounterHeading, `Area ${formatCoords(state.position)}`);

    const players = state.playersAt || [];
    const parts = [];
    const encounter = state.moving ? null : state.currentEncounter;

    if (encounter) {
      parts.push(renderCurrentEncounter(encounter));
    }

    if (!players.length) {
      parts.push('<p class="world-empty-text">No hunters on this tile.</p>');
      elements.worldEncounterList.innerHTML = parts.join('');
      return;
    }

    parts.push(players.map((player) => {
      const cooldownUntil = state.challengeCooldowns.get(player.id) || 0;
      const isCoolingDown = cooldownUntil > Date.now();
      const label = isCoolingDown ? 'Cooldown' : 'Challenge';

      return `
        <article class="world-encounter-player">
          <span class="world-encounter-mark" aria-hidden="true"></span>
          <span class="world-encounter-copy">
            <strong>${escapeHtml(player.username || 'Unknown Hunter')}</strong>
            <small>Level ${formatNumber(player.level || 1)}</small>
          </span>
          <button class="btn btn-outline-light btn-sm" type="button" data-challenge-player="${escapeAttribute(player.id)}" ${isCoolingDown ? 'disabled' : ''}>${label}</button>
        </article>
      `;
    }).join(''));
    elements.worldEncounterList.innerHTML = parts.join('');
  }

  function renderCurrentEncounter(encounter) {
    const unlocked = isEncounterUnlocked(encounter.id);
    const active = isActiveHuntFor(encounter.id);
    const activeElsewhere = Boolean(state.hunt?.active && !active);
    const demons = (Array.isArray(encounter.team) ? encounter.team : []).slice(0, 4).map(renderDemonPortrait).join('');
    const action = active
      ? `<button class="btn btn-warning btn-sm" type="button" data-stop-hunting ${state.huntBusy ? 'disabled' : ''}>Stop Hunting</button>`
      : unlocked
        ? `<button class="btn btn-outline-light btn-sm" type="button" data-start-hunting="${escapeAttribute(encounter.id)}" ${state.huntBusy || activeElsewhere ? 'disabled' : ''}>Start Hunting</button>`
        : `<button class="btn btn-outline-light btn-sm" type="button" data-try-hunt="${escapeAttribute(encounter.id)}" ${state.huntBusy ? 'disabled' : ''}>Try Hunt</button>`;

    return `
      <article class="world-encounter-player">
        <span class="world-encounter-mark" aria-hidden="true"></span>
        <span class="world-encounter-copy">
          <strong>Demon Patrol</strong>
          <small>Threat ${formatNumber(encounter.difficulty || 1)}${active ? ' - Hunting' : unlocked ? ' - Hunting unlocked' : ''}</small>
          ${demons ? `<span class="world-enc-demons">${demons}</span>` : ''}
        </span>
        ${action}
      </article>
      ${renderHuntRewards(encounter, active)}
    `;
  }

  function renderHuntRewards(encounter, active) {
    const rate = computeHuntRate(encounter);
    const progress = active ? computeHuntProgress() : null;

    const expected = `
      <div class="world-hunt-stat">
        <span class="world-hunt-stat-label">Per kill</span>
        <span class="world-hunt-stat-value">+${formatNumber(rate.xpPerCycle)} XP · +${formatNumber(rate.soulsPerCycle)} Souls</span>
        <span class="world-hunt-stat-note">one kill every ${formatDuration(rate.respawnSeconds)}</span>
      </div>
    `;

    const accrued = progress ? `
      <div class="world-hunt-stat is-accrued">
        <span class="world-hunt-stat-label">Accumulated</span>
        <span class="world-hunt-stat-value">+${formatNumber(progress.accruedXp)} XP · +${formatNumber(progress.accruedSouls)} Souls</span>
        <span class="world-hunt-stat-note">${formatNumber(progress.cycles)} ${progress.cycles === 1 ? 'kill' : 'kills'}${progress.capped ? ' · cap reached' : ''}</span>
      </div>
    ` : '';

    return `<div class="world-hunt-rewards">${expected}${accrued}</div>`;
  }

  function renderDemonPortrait(member) {
    const url = member.imageUrl || DEFAULT_PROFILE_IMAGE_URL;
    const rarity = member.rarity || 'common';
    const species = member.species || 'Demon';
    const color = rarityCss(rarity);

    return `
      <span class="world-enc-demon" style="--rarity-color:${color}" title="${escapeAttribute(`${capitalize(rarity)} ${species}`)}">
        <img src="${escapeAttribute(url)}" alt="" width="34" height="34" loading="lazy">
      </span>
    `;
  }

  function renderTravelPanel() {
    if (!elements.worldTravelPanel) return;

    const logs = state.travelLog || [];
    if (!logs.length) {
      elements.worldTravelPanel.innerHTML = '<p class="world-empty-text">No travel yet.</p>';
      return;
    }

    elements.worldTravelPanel.innerHTML = `<div class="world-travel-log">${logs.slice(0, 5).map((entry, index) => renderTravelLogItem(entry, index)).join('')}</div>`;
  }

  function renderTravelLogItem(entry, index = 0) {
    const isAmbush = entry.type === 'ambush';
    const battleWinner = entry.battle?.winner;
    const canReplay = isAmbush && shouldShowWorldBattleReplay(entry.battle);
    const title = isAmbush
      ? battleWinner === 'player'
        ? 'Ambush Won'
        : battleWinner === 'enemy'
          ? 'Ambush Lost'
          : 'Ambush'
      : 'No Event';

    return `
      <article class="world-travel-log-item ${isAmbush ? 'is-ambush' : ''}">
        <span class="world-travel-log-mark" aria-hidden="true"></span>
        <span class="world-travel-log-copy">
          <strong>${title}</strong>
          <small>${formatCoords(entry.position)}</small>
        </span>
        ${canReplay ? `
          <button class="btn btn-outline-light btn-sm world-travel-replay-btn" type="button" data-view-world-battle="${index}" title="Replay Ambush" aria-label="Replay Ambush">
            ${renderIcon('replay')}
            <span>Replay</span>
          </button>
        ` : ''}
      </article>
    `;
  }

  function shouldShowWorldBattleReplay(battle) {
    return Boolean(battle && Array.isArray(battle.combatLog) && battle.combatLog.length);
  }

  function showWorldBattleReplay(battle, meta = {}) {
    if (!battle) return Promise.resolve();

    if (battle.error && !Array.isArray(battle.combatLog)) {
      setMessage(battle.error, 'warning');
      return Promise.resolve();
    }

    const modalElement = elements.worldBattleModal;
    const modalApi = window.bootstrap?.Modal;
    if (!modalElement || !modalApi) {
      setMessage(getWorldBattleFallbackMessage(battle, meta), battle.winner === 'player' ? 'success' : 'warning');
      return Promise.resolve();
    }

    state.activeWorldBattle = battle;
    state.activeWorldBattleMeta = normalizeWorldBattleMeta(meta.type, battle, meta);
    state.activeWorldBattleTeams = createWorldBattleReplayTeams(battle);
    state.activeWorldBattleLogIndex = -1;
    state.worldBattlePlayback = null;
    state.worldBattleReplayPlaying = false;
    state.worldBattleLogOpen = false;
    state.worldBattleBuffsOpen = false;
    renderWorldBattleReplay(battle);

    const modal = modalApi.getOrCreateInstance(modalElement);
    const playWhenVisible = () => {
      playWorldBattleReplay(battle);
    };

    if (modalElement.classList.contains('show')) {
      playWhenVisible();
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      modalElement.addEventListener('shown.bs.modal', playWhenVisible, { once: true });
      modalElement.addEventListener('hidden.bs.modal', () => {
        modalElement.removeEventListener('shown.bs.modal', playWhenVisible);
        resolve();
      }, { once: true });
      modal.show();
    });
  }

  function cancelWorldBattleReplay() {
    state.worldBattleReplayToken += 1;
    state.worldBattleReplayPlaying = false;
    state.activeWorldBattle = null;
    state.activeWorldBattleMeta = null;
    state.activeWorldBattleTeams = null;
    state.activeWorldBattleLogIndex = -1;
    state.worldBattlePlayback = null;
    state.worldBattleLogOpen = false;
    state.worldBattleBuffsOpen = false;
    setWorldBattlePausedClass(false);
    clearWorldBattleTransientEffects();
  }

  async function playWorldBattleReplay(battle) {
    const combatLog = Array.isArray(battle?.combatLog) ? battle.combatLog : [];
    const token = state.worldBattleReplayToken + 1;
    state.worldBattleReplayToken = token;
    state.activeWorldBattle = battle;
    state.activeWorldBattleTeams = createWorldBattleReplayTeams(battle);
    state.activeWorldBattleLogIndex = -1;
    state.worldBattleReplayPlaying = true;
    state.worldBattlePlayback = {
      totalSteps: combatLog.length,
      isPaused: false,
      stepDirection: 0,
      waitResolve: null
    };
    setWorldBattlePausedClass(false);
    renderWorldBattleReplay(battle);

    await waitForWorldBattlePlaybackDelay(getWorldBattleReplayDelay() / 2);

    while (state.activeWorldBattleLogIndex < combatLog.length - 1) {
      if (state.worldBattleReplayToken !== token) return;
      const command = await waitForWorldBattlePlaybackReady();
      if (!command || state.worldBattleReplayToken !== token) return;
      if (command === 'previous') {
        renderWorldBattlePlaybackFrame(Math.max(0, state.activeWorldBattleLogIndex));
        continue;
      }

      const index = state.activeWorldBattleLogIndex + 1;
      state.activeWorldBattleLogIndex = index;
      applyWorldBattleLogEntry(combatLog[index], state.activeWorldBattleTeams);
      renderWorldBattleReplay(battle);
      highlightWorldBattleLogEntry(combatLog[index], token);
      await waitForWorldBattlePlaybackDelay(getWorldBattleReplayDelay(combatLog[index]));
    }

    if (state.worldBattleReplayToken !== token) return;
    state.worldBattleReplayPlaying = false;
    state.activeWorldBattleLogIndex = combatLog.length - 1;
    state.worldBattlePlayback = {
      totalSteps: combatLog.length,
      isPaused: true,
      stepDirection: 0,
      waitResolve: null
    };
    setWorldBattlePausedClass(true);
    renderWorldBattleReplay(battle);
  }

  function getWorldBattleReplayDelay() {
    const baseDelay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ? WORLD_BATTLE_REPLAY_REDUCED_STEP_MS
      : WORLD_BATTLE_REPLAY_STEP_MS;
    return Math.max(25, baseDelay / (Number(state.worldBattleSpeed) || 1));
  }

  async function waitForWorldBattlePlaybackReady() {
    while (state.worldBattlePlayback?.isPaused) {
      setWorldBattlePausedClass(true);
      const direction = Number(state.worldBattlePlayback.stepDirection) || 0;
      state.worldBattlePlayback.stepDirection = 0;

      if (direction < 0) return 'previous';
      if (direction > 0) {
        return state.activeWorldBattleLogIndex < (state.worldBattlePlayback.totalSteps - 1) ? 'next' : null;
      }

      await waitForWorldBattlePlaybackSignal();
    }

    setWorldBattlePausedClass(false);
    return state.worldBattlePlayback ? 'play' : null;
  }

  function waitForWorldBattlePlaybackDelay(duration) {
    const playback = state.worldBattlePlayback;
    if (!playback) return delay(duration);

    return new Promise((resolve) => {
      const timer = window.setTimeout(finish, Math.max(0, Number(duration) || 0));

      function finish() {
        window.clearTimeout(timer);
        if (playback.waitResolve === finish) playback.waitResolve = null;
        resolve();
      }

      playback.waitResolve = finish;
    });
  }

  function waitForWorldBattlePlaybackSignal() {
    const playback = state.worldBattlePlayback;
    if (!playback) return Promise.resolve();

    return new Promise((resolve) => {
      playback.waitResolve = () => {
        playback.waitResolve = null;
        resolve();
      };
    });
  }

  function resolveWorldBattlePlaybackWait() {
    const resolve = state.worldBattlePlayback?.waitResolve;
    if (resolve) resolve();
  }

  function toggleWorldBattlePlayback() {
    if (!state.activeWorldBattle) return;
    if (!state.worldBattleReplayPlaying) {
      playWorldBattleReplay(state.activeWorldBattle);
      return;
    }

    state.worldBattlePlayback = state.worldBattlePlayback || { totalSteps: 0, isPaused: false, stepDirection: 0, waitResolve: null };
    state.worldBattlePlayback.isPaused = !state.worldBattlePlayback.isPaused;
    state.worldBattlePlayback.stepDirection = 0;
    setWorldBattlePausedClass(state.worldBattlePlayback.isPaused);
    resolveWorldBattlePlaybackWait();
    renderWorldBattleControls();
  }

  function stepWorldBattlePlayback(direction) {
    if (!state.activeWorldBattle) return;
    const normalizedDirection = Number(direction) < 0 ? -1 : 1;

    if (state.worldBattleReplayPlaying && state.worldBattlePlayback) {
      state.worldBattlePlayback.isPaused = true;
      state.worldBattlePlayback.stepDirection = normalizedDirection;
      setWorldBattlePausedClass(true);
      resolveWorldBattlePlaybackWait();
      renderWorldBattleControls();
      return;
    }

    const entries = Array.isArray(state.activeWorldBattle.combatLog) ? state.activeWorldBattle.combatLog : [];
    const currentStepCount = Math.max(0, state.activeWorldBattleLogIndex + 1);
    renderWorldBattlePlaybackFrame(clamp(currentStepCount + normalizedDirection, 0, entries.length));
  }

  function renderWorldBattlePlaybackFrame(stepCount) {
    if (!state.activeWorldBattle) return;
    const entries = Array.isArray(state.activeWorldBattle.combatLog) ? state.activeWorldBattle.combatLog : [];
    const nextStepCount = clamp(Math.floor(Number(stepCount) || 0), 0, entries.length);

    clearWorldBattleTransientEffects();
    state.activeWorldBattleTeams = createWorldBattleReplayTeams(state.activeWorldBattle);
    for (let index = 0; index < nextStepCount; index += 1) {
      applyWorldBattleLogEntry(entries[index], state.activeWorldBattleTeams);
    }
    state.activeWorldBattleLogIndex = nextStepCount - 1;
    state.worldBattleReplayPlaying = false;
    state.worldBattlePlayback = {
      totalSteps: entries.length,
      isPaused: true,
      stepDirection: 0,
      waitResolve: null
    };
    setWorldBattlePausedClass(true);
    renderWorldBattleReplay(state.activeWorldBattle);
  }

  function setWorldBattleSpeed(speed) {
    if (!BATTLE_SPEED_OPTIONS.includes(speed)) return;
    state.worldBattleSpeed = speed;
    try {
      localStorage.setItem(BATTLE_SPEED_KEY, String(speed));
    } catch (error) {
      // Ignore storage failures; the in-memory speed still applies.
    }
    renderWorldBattleControls();
  }

  function setWorldBattlePausedClass(isPaused) {
    document.documentElement.classList.toggle('is-combat-paused', Boolean(isPaused));
  }

  function renderWorldBattleReplay(battle) {
    const meta = state.activeWorldBattleMeta || normalizeWorldBattleMeta('battle', battle);
    const teams = state.activeWorldBattleTeams || createWorldBattleReplayTeams(battle);
    const playerTeam = teams.player || [];
    const enemyTeam = teams.enemy || [];

    elements.worldBattleModal?.classList.toggle('is-log-open', state.worldBattleLogOpen);
    elements.worldBattleModal?.classList.toggle('is-buffs-open', state.worldBattleBuffsOpen);
    setText(elements.worldBattleEyebrow, meta.eyebrow);
    setText(elements.worldBattleTitle, meta.title);
    setText(elements.worldBattleEnemyLabel, meta.enemyLabel);
    setText(elements.worldBattlePlayerCount, `${countLivingWorldBattleDemons(playerTeam)}/${playerTeam.length}`);
    setText(elements.worldBattleEnemyCount, `${countLivingWorldBattleDemons(enemyTeam)}/${enemyTeam.length}`);

    if (elements.worldBattleResult) {
      elements.worldBattleResult.innerHTML = renderWorldBattleResult(battle, meta);
    }
    if (elements.worldBattleBuffPanel) {
      elements.worldBattleBuffPanel.hidden = !state.worldBattleBuffsOpen;
      elements.worldBattleBuffPanel.innerHTML = state.worldBattleBuffsOpen
        ? renderWorldBattleBuffPanel(battle.playerBuffs, battle.enemyBuffs)
        : '';
    }
    if (elements.worldBattleTeamGrid) {
      elements.worldBattleTeamGrid.innerHTML = renderWorldBattleFormation(playerTeam, 'player');
    }
    if (elements.worldBattleEnemyGrid) {
      elements.worldBattleEnemyGrid.innerHTML = renderWorldBattleFormation(enemyTeam, 'enemy');
    }

    renderWorldBattleControls();
    renderWorldBattleFightLog(battle);
  }

  function renderWorldBattleResult(battle, meta) {
    const won = battle.winner === 'player';
    const lost = battle.winner === 'enemy';
    const title = won ? meta.winText : lost ? meta.lossText : meta.neutralText;
    const detail = `${formatNumber(battle.ticks || 0)} ticks${battle.endReason ? ` - ${escapeHtml(formatWorldBattleLabel(battle.endReason))}` : ''}`;
    const icon = won ? 'swords' : lost ? 'skull' : 'stars';
    const tone = won ? 'is-win' : lost ? 'is-loss' : '';

    return `
      <span class="world-battle-outcome ${tone}">
        ${renderIcon(icon)}
        <span>
          <strong>${escapeHtml(title)}</strong>
          <small>${detail}</small>
        </span>
      </span>
      ${renderWorldBattleBuffSummary(battle.playerBuffs, { compact: true })}
    `;
  }

  function renderWorldBattleBuffSummary(buffs = [], options = {}) {
    const activeBuffs = (Array.isArray(buffs) ? buffs : []).filter(Boolean);
    if (!activeBuffs.length) return '';
    const limit = options.compact ? 3 : activeBuffs.length;

    return `
      <span class="world-battle-buffs" aria-label="Soulbound Buffs">
        <span class="world-battle-buffs-label">Soulbound Buffs</span>
        ${activeBuffs.slice(0, limit).map((buff) => `
          <span class="world-battle-buff" title="${escapeAttribute(buff.description || buff.name || '')}">
            ${renderIcon(buff.icon || 'stars')}
            <span>${escapeHtml(buff.name || formatWorldBattleLabel(buff.id))}</span>
          </span>
        `).join('')}
        ${activeBuffs.length > limit ? `<span class="world-battle-buff">+${activeBuffs.length - limit}</span>` : ''}
      </span>
    `;
  }

  function renderWorldBattleBuffPanel(playerBuffs = [], enemyBuffs = []) {
    const playerList = renderWorldBattleBuffList(playerBuffs, 'Your Buffs');
    const enemyList = renderWorldBattleBuffList(enemyBuffs, 'Enemy Buffs');

    return `
      <div class="world-battle-buff-grid">
        ${playerList}
        ${enemyList}
      </div>
    `;
  }

  function renderWorldBattleBuffList(buffs = [], title = 'Buffs') {
    const activeBuffs = (Array.isArray(buffs) ? buffs : []).filter(Boolean);

    return `
      <section class="world-battle-buff-list" aria-label="${escapeAttribute(title)}">
        <h3>${escapeHtml(title)}</h3>
        ${activeBuffs.length ? activeBuffs.map((buff) => `
          <article class="world-battle-buff-detail">
            <span>${renderIcon(buff.icon || 'stars')}</span>
            <span>
              <strong>${escapeHtml(buff.name || formatWorldBattleLabel(buff.id))}</strong>
              ${buff.description ? `<small>${escapeHtml(buff.description)}</small>` : ''}
            </span>
          </article>
        `).join('') : '<p class="world-empty-text">No active buffs.</p>'}
      </section>
    `;
  }

  function renderWorldBattleControls() {
    if (!elements.worldBattleControls) return;

    const total = Array.isArray(state.activeWorldBattle?.combatLog) ? state.activeWorldBattle.combatLog.length : 0;
    const current = total ? Math.max(0, state.activeWorldBattleLogIndex + 1) : 0;
    const playback = state.worldBattlePlayback || {};
    const isPaused = Boolean(playback.isPaused) || !state.worldBattleReplayPlaying;
    const canStepBack = current > 0;
    const canStepForward = current < total;

    elements.worldBattleControls.innerHTML = `
      <div class="world-battle-toolbar-group">
        <div class="battle-playback-control" role="group" aria-label="Battle playback">
          <button class="battle-playback-btn" type="button" data-world-battle-step="-1" title="Last attack" aria-label="Last attack" ${canStepBack ? '' : 'disabled'}>
            ${renderIcon('last-attack')}
          </button>
          <button class="battle-playback-btn is-primary" type="button" data-world-battle-toggle-play title="${isPaused ? 'Play' : 'Pause'}" aria-label="${isPaused ? 'Play' : 'Pause'}" ${total ? '' : 'disabled'}>
            ${renderIcon(isPaused ? 'play' : 'pause')}
          </button>
          <button class="battle-playback-btn" type="button" data-world-battle-step="1" title="Next attack" aria-label="Next attack" ${canStepForward ? '' : 'disabled'}>
            ${renderIcon('next-attack')}
          </button>
          <button class="battle-playback-btn" type="button" data-world-battle-replay title="Replay Fight" aria-label="Replay Fight" ${state.worldBattleReplayPlaying || !total ? 'disabled' : ''}>
            ${renderIcon('replay')}
          </button>
        </div>
        <div class="battle-speed-control" role="group" aria-label="Battle animation speed">
          ${BATTLE_SPEED_OPTIONS.map((speed) => `
            <button class="battle-speed-option ${state.worldBattleSpeed === speed ? 'active' : ''}" type="button" data-world-battle-speed="${speed}" aria-pressed="${state.worldBattleSpeed === speed ? 'true' : 'false'}" title="${formatWorldBattleSpeed(speed)} battle speed">
              ${formatWorldBattleSpeed(speed)}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="world-battle-toolbar-group">
        <button class="battle-playback-btn ${state.worldBattleBuffsOpen ? 'is-primary' : ''}" type="button" data-world-battle-toggle-buffs title="Buffs" aria-label="Buffs" aria-pressed="${state.worldBattleBuffsOpen ? 'true' : 'false'}">
          ${renderIcon('stars')}
        </button>
        <button class="battle-playback-btn ${state.worldBattleLogOpen ? 'is-primary' : ''}" type="button" data-world-battle-toggle-log title="Fight Log" aria-label="Fight Log" aria-pressed="${state.worldBattleLogOpen ? 'true' : 'false'}">
          ${renderIcon('log')}
        </button>
        <small class="world-battle-step-count">${formatNumber(current)} / ${formatNumber(total)}</small>
      </div>
    `;
  }

  function renderWorldBattleFightLog(battle) {
    const fightLog = elements.worldBattleFightLog;
    if (!fightLog) return;

    fightLog.hidden = !state.worldBattleLogOpen;
    if (!state.worldBattleLogOpen) {
      fightLog.innerHTML = '';
      return;
    }

    const entries = Array.isArray(battle?.combatLog) ? battle.combatLog : [];
    if (!entries.length) {
      fightLog.classList.add('text-muted');
      fightLog.innerHTML = 'No battle actions were recorded.';
      return;
    }

    const lookup = createWorldBattleLookup(battle);
    fightLog.classList.remove('text-muted');
    fightLog.innerHTML = entries.map((entry, index) => renderWorldBattleLogRow(entry, index, lookup)).join('');
    fightLog.querySelector('.fight-log-row.active')?.scrollIntoView({ block: 'nearest' });
  }

  function renderWorldBattleLogRow(entry, index, lookup) {
    const side = getWorldBattleEntrySide(entry, lookup);
    const actionClass = side === 'player' ? 'is-player-action' : 'is-enemy-action';
    const activeClass = index === state.activeWorldBattleLogIndex ? 'active' : '';
    const amount = getWorldBattleEntryAmount(entry);
    const targetHp = Object.prototype.hasOwnProperty.call(entry, 'targetHp') ? Math.max(0, Number(entry.targetHp) || 0) : null;

    return `
      <div class="fight-log-row ${actionClass} ${activeClass}" data-world-battle-log-index="${index}">
        <span>${formatNumber(entry.tick || index + 1)}</span>
        <span class="fight-log-side">${side === 'player' ? 'You' : 'Enemy'}</span>
        <span class="fight-log-action">${escapeHtml(formatWorldBattleLogAction(entry, lookup))}</span>
        <span class="fight-log-damage">${escapeHtml(amount)}</span>
        <span>${targetHp === null ? '' : `${formatNumber(targetHp)} HP`}</span>
      </div>
    `;
  }

  function renderWorldBattleFormation(team, side) {
    const assignments = getWorldBattleFormationAssignments(team, side);
    const sideClass = side === 'enemy' ? 'battle-formation-enemy' : 'battle-formation-player';

    return `
      <div class="battle-formation battle-formation-grid ${sideClass}">
        ${Array.from({ length: FORMATION_GRID_SIZE }, (item, slot) => (
          renderWorldBattleFormationSlot(assignments.get(slot), side, slot)
        )).join('')}
      </div>
    `;
  }

  function renderWorldBattleFormationSlot(demon, side, slot) {
    const position = getFormationSlotPosition(slot, side);
    const classes = [
      'formation-slot',
      `formation-slot-${position}`,
      demon ? 'has-demon' : 'is-empty'
    ].join(' ');

    return `
      <div class="${classes}" data-formation-slot="${slot}">
        <div class="formation-slot-cards">
          ${demon ? renderWorldBattleDemonCard(demon, side) : renderWorldBattleEmptySlot(position, slot + 1)}
        </div>
      </div>
    `;
  }

  function renderWorldBattleDemonCard(demon, side) {
    const poisonStacks = getWorldBattlePoisonStackCount(demon);
    const className = [
      'world-battle-demon-card',
      side === 'enemy' ? 'is-enemy-revealed' : '',
      poisonStacks ? 'is-poisoned' : ''
    ].filter(Boolean).join(' ');

    return renderSharedDemonCard(demon, {
      className,
      defeated: Number(demon.hp) <= 0,
      imageLoading: 'eager',
      overlayHtml: renderWorldBattleDemonStatus(demon),
      attributes: {
        'data-instance-id': demon.instanceId,
        'data-side': side
      }
    });
  }

  function renderWorldBattleDemonStatus(demon) {
    const poisonStacks = getWorldBattlePoisonStackCount(demon);
    if (!poisonStacks) return '';

    return `
      <div class="demon-status-strip" aria-label="Status effects">
        <span class="demon-status-badge demon-status-poison" aria-label="Poisoned, ${poisonStacks} stack${poisonStacks === 1 ? '' : 's'}" title="Poisoned">
          <span class="demon-status-icon">${renderIcon('poison')}</span>
          ${poisonStacks > 1 ? `<span class="demon-status-count">${formatNumber(poisonStacks)}</span>` : ''}
        </span>
      </div>
    `;
  }

  function renderWorldBattleEmptySlot(position, slotNumber) {
    return `
      <div class="formation-empty formation-empty-${position}" aria-hidden="true" data-slot-number="${slotNumber}">
        <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </div>
    `;
  }

  function createWorldBattleReplayTeams(battle = {}) {
    return {
      player: createWorldBattleReplayTeam(battle.playerTeamBefore, 'player'),
      enemy: createWorldBattleReplayTeam(battle.enemyTeamBefore, 'enemy')
    };
  }

  function createWorldBattleReplayTeam(team = [], side = 'player') {
    const usedSlots = new Set();
    return (Array.isArray(team) ? team : []).slice(0, FORMATION_GRID_SIZE).map((demon, index) => {
      const instanceId = String(demon.instanceId || demon.id || `${side}-${index + 1}`);
      const explicitSlot = normalizeFormationSlot(demon.formationSlot ?? demon.formationRow);
      const requestedPosition = explicitSlot !== null
        ? getFormationSlotPosition(explicitSlot, side)
        : normalizeBattlePosition(demon.position || (index === 0 ? 'front' : 'back'));
      const slot = explicitSlot !== null && !usedSlots.has(explicitSlot)
        ? explicitSlot
        : chooseFormationSlot(usedSlots, requestedPosition, side);
      const maxHp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
      const hp = Math.max(0, Math.min(maxHp, Number(demon.hp) || 0));

      usedSlots.add(slot);

      return {
        ...demon,
        instanceId,
        maxHp,
        hp,
        shield: Math.max(0, Number(demon.shield) || 0),
        position: getFormationSlotPosition(slot, side),
        formationSlot: slot,
        statusEffects: {
          poison: Array.isArray(demon.statusEffects?.poison)
            ? demon.statusEffects.poison.map((poison) => ({ ...poison }))
            : []
        }
      };
    });
  }

  function applyWorldBattleLogEntry(entry, teams) {
    if (!entry || !teams) return;

    const target = findWorldBattleDemon(teams, entry.target);
    if (target) {
      if (Object.prototype.hasOwnProperty.call(entry, 'targetHp')) {
        target.hp = Math.max(0, Number(entry.targetHp) || 0);
      }
      if (Object.prototype.hasOwnProperty.call(entry, 'targetShield')) {
        target.shield = Math.max(0, Number(entry.targetShield) || 0);
      }
      if (entry.effect === 'poison_apply') {
        syncWorldBattlePoisonStatus(target, entry.poisonStacks || 1);
      } else if (entry.effect === 'poison' && Object.prototype.hasOwnProperty.call(entry, 'poisonStacks')) {
        syncWorldBattlePoisonStatus(target, entry.poisonStacks);
      }
    }

    applyWorldBattleKnockback(entry.knockback, teams);
  }

  function applyWorldBattleKnockback(knockback, teams) {
    if (!knockback) return;

    const side = knockback.side === 'enemy' ? 'enemy' : 'player';
    const target = findWorldBattleDemon(teams, knockback.target);
    const targetSlot = normalizeFormationSlot(knockback.toSlot);
    if (target && targetSlot !== null) {
      target.formationSlot = targetSlot;
      target.position = normalizeBattlePosition(knockback.targetPositionAfter || getFormationSlotPosition(targetSlot, side));
    }

    const swapped = findWorldBattleDemon(teams, knockback.swappedWith);
    const swappedSlot = normalizeFormationSlot(knockback.swappedToSlot);
    if (swapped && swappedSlot !== null) {
      swapped.formationSlot = swappedSlot;
      swapped.position = normalizeBattlePosition(knockback.swappedPositionAfter || getFormationSlotPosition(swappedSlot, side));
    }
  }

  function syncWorldBattlePoisonStatus(demon, stackCount) {
    const count = Math.max(0, Math.floor(Number(stackCount) || 0));
    demon.statusEffects = demon.statusEffects || {};
    demon.statusEffects.poison = Array.from({ length: count }, () => ({}));
  }

  function highlightWorldBattleLogEntry(entry, token) {
    const attackerCard = findWorldBattleCard(entry?.attacker);
    const targetCard = findWorldBattleCard(entry?.target);
    const attackerSide = attackerCard?.dataset.side;

    drawWorldBattleAttackEffect(entry, token);
    showWorldBattleFloatingAmount(entry, token);
    attackerCard?.classList.add('is-attacking', attackerSide === 'enemy' ? 'is-enemy-attack' : 'is-player-attack');
    if (entry?.effect === 'poison') {
      targetCard?.classList.add('is-poison-tick');
    } else if (entry?.effect !== 'heal') {
      targetCard?.classList.add('is-hit');
    }

    window.setTimeout(() => {
      if (state.worldBattleReplayToken !== token) return;
      attackerCard?.classList.remove('is-attacking', 'is-player-attack', 'is-enemy-attack');
      targetCard?.classList.remove('is-hit', 'is-poison-tick');
    }, Math.max(120, getWorldBattleReplayDelay(entry) - 80));
  }

  function drawWorldBattleAttackEffect(entry, token) {
    if (!entry?.attacker || !entry?.target || entry.effect === 'heal' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const attackerCard = findWorldBattleCard(entry.attacker);
    const targetCard = findWorldBattleCard(entry.target);
    const container = elements.worldBattleModal;
    if (!attackerCard || !targetCard || !container) return;

    const start = getElementCenter(attackerCard);
    const end = getElementCenter(targetCard);
    const controlX = (start.x + end.x) / 2;
    const controlY = Math.min(start.y, end.y) - Math.max(26, Math.abs(end.x - start.x) * 0.08);
    const theme = getWorldBattleEntryTheme(entry);
    const classes = [
      'attack-zap',
      getWorldBattleEntrySide(entry, createWorldBattleLookup(state.activeWorldBattle)) === 'player' ? 'is-player-attack' : 'is-enemy-attack',
      entry.effect === 'poison_apply' ? 'is-poison-apply is-poison-flame' : '',
      Number(entry.dmg) >= 40 ? 'is-heavy' : ''
    ].filter(Boolean).join(' ');

    const zap = document.createElement('div');
    zap.className = classes;
    zap.style.setProperty('--combat-color', theme.color || COMBAT_THEMES.default.color);
    zap.style.setProperty('--combat-shadow', theme.shadow || COMBAT_THEMES.default.shadow);
    zap.innerHTML = `
      <svg aria-hidden="true" focusable="false">
        <path class="attack-zap-trail" d="M ${start.x.toFixed(1)} ${start.y.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}" />
        <circle class="attack-zap-impact" cx="${end.x.toFixed(1)}" cy="${end.y.toFixed(1)}" r="4" />
      </svg>
    `;
    container.appendChild(zap);
    window.setTimeout(() => {
      if (state.worldBattleReplayToken === token) zap.remove();
    }, Math.max(180, getWorldBattleReplayDelay(entry) + 140));
  }

  function showWorldBattleFloatingAmount(entry, token) {
    if (!entry?.target || entry.effect === 'poison_apply' || (!Object.prototype.hasOwnProperty.call(entry, 'dmg') && !Object.prototype.hasOwnProperty.call(entry, 'healing'))) return;

    const targetCard = findWorldBattleCard(entry.target);
    const container = elements.worldBattleModal;
    if (!targetCard || !container) return;

    const amount = entry.effect === 'heal' ? `+${formatNumber(entry.healing || 0)}` : `-${formatNumber(entry.dmg || 0)}`;
    const type = entry.effect === 'heal' ? 'heal' : entry.effect === 'poison' ? 'poison' : 'damage';
    const theme = getWorldBattleEntryTheme(entry);
    const center = getElementCenter(targetCard);
    const floating = document.createElement('span');
    floating.className = `floating-combat-number is-${type}`;
    floating.style.setProperty('--combat-color', theme.color || COMBAT_THEMES.default.color);
    floating.style.setProperty('--combat-shadow', theme.shadow || COMBAT_THEMES.default.shadow);
    floating.style.left = `${Math.round(center.x)}px`;
    floating.style.top = `${Math.round(center.y - 12)}px`;
    floating.textContent = amount;
    container.appendChild(floating);
    window.setTimeout(() => {
      if (state.worldBattleReplayToken === token) floating.remove();
    }, Math.max(280, getWorldBattleReplayDelay(entry) + 360));
  }

  function clearWorldBattleTransientEffects() {
    elements.worldBattleModal?.querySelectorAll('.attack-zap, .floating-combat-number').forEach((element) => element.remove());
  }

  function getElementCenter(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function getWorldBattleEntryTheme(entry = {}) {
    if (entry.effect === 'poison' || entry.effect === 'poison_apply') return COMBAT_THEMES.poison;
    if (entry.effect === 'heal') return COMBAT_THEMES.heal;
    const attacker = findWorldBattleDemon(state.activeWorldBattleTeams, entry.attacker);
    return COMBAT_THEMES[Number(attacker?.typeId)] || COMBAT_THEMES.default;
  }

  function findWorldBattleCard(instanceId) {
    if (!instanceId || !elements.worldBattleModal) return null;
    return elements.worldBattleModal.querySelector(`.dungeon-demon-card[data-instance-id="${cssEscape(String(instanceId))}"]`);
  }

  function findWorldBattleDemon(teams, instanceId) {
    if (!instanceId) return null;
    return [...(teams?.player || []), ...(teams?.enemy || [])].find((demon) => String(demon.instanceId) === String(instanceId)) || null;
  }

  function getWorldBattleFormationAssignments(team, side) {
    const assignments = new Map();
    const usedSlots = new Set();

    (Array.isArray(team) ? team : []).slice(0, FORMATION_GRID_SIZE).forEach((demon, index) => {
      const explicitSlot = normalizeFormationSlot(demon.formationSlot ?? demon.formationRow);
      const slot = explicitSlot !== null && !usedSlots.has(explicitSlot)
        ? explicitSlot
        : chooseFormationSlot(usedSlots, demon.position || (index === 0 ? 'front' : 'back'), side);
      usedSlots.add(slot);
      assignments.set(slot, {
        ...demon,
        formationSlot: slot,
        position: getFormationSlotPosition(slot, side)
      });
    });

    return assignments;
  }

  function chooseFormationSlot(takenSlots, position, side = 'player') {
    const preferredSlot = getFormationSlotOrder(position, side).find((slot) => !takenSlots.has(slot));
    if (preferredSlot !== undefined) return preferredSlot;
    return Array.from({ length: FORMATION_GRID_SIZE }, (item, index) => index).find((slot) => !takenSlots.has(slot)) || 0;
  }

  function getFormationSlotOrder(position, side = 'player') {
    const normalizedPosition = normalizeBattlePosition(position);
    const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
    const middleColumn = 1;
    const outerColumn = side === 'enemy' ? FORMATION_GRID_COLUMNS - 1 : 0;
    const columns = side === 'enemy'
      ? normalizedPosition === 'front'
        ? [frontColumn, middleColumn]
        : [outerColumn, middleColumn]
      : normalizedPosition === 'front'
        ? [frontColumn]
        : [middleColumn, outerColumn];

    return columns.flatMap((column) => (
      Array.from({ length: FORMATION_GRID_COLUMNS }, (item, rowIndex) => rowIndex * FORMATION_GRID_COLUMNS + column)
    ));
  }

  function getFormationSlotPosition(slot, side = 'player') {
    const normalizedSlot = normalizeFormationSlot(slot);
    const column = (normalizedSlot === null ? 0 : normalizedSlot) % FORMATION_GRID_COLUMNS;
    const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
    return column === frontColumn ? 'front' : 'back';
  }

  function normalizeFormationSlot(slot) {
    const number = Number(slot);
    if (!Number.isInteger(number) || number < 0 || number >= FORMATION_GRID_SIZE) return null;
    return number;
  }

  function normalizeBattlePosition(position) {
    return position === 'back' ? 'back' : 'front';
  }

  function countLivingWorldBattleDemons(team = []) {
    return (Array.isArray(team) ? team : []).filter((demon) => Number(demon.hp) > 0).length;
  }

  function getWorldBattlePoisonStackCount(demon = {}) {
    return Array.isArray(demon.statusEffects?.poison) ? demon.statusEffects.poison.length : 0;
  }

  function createWorldBattleLookup(battle = {}) {
    const playerTeam = [
      ...(Array.isArray(battle.playerTeamBefore) ? battle.playerTeamBefore : []),
      ...(Array.isArray(battle.playerTeamAfter) ? battle.playerTeamAfter : [])
    ];
    const enemyTeam = [
      ...(Array.isArray(battle.enemyTeamBefore) ? battle.enemyTeamBefore : []),
      ...(Array.isArray(battle.enemyTeamAfter) ? battle.enemyTeamAfter : [])
    ];
    const names = new Map();
    const sides = new Map();

    playerTeam.forEach((demon) => {
      if (!demon?.instanceId) return;
      names.set(String(demon.instanceId), demon.species || demon.name || 'Demon');
      sides.set(String(demon.instanceId), 'player');
    });
    enemyTeam.forEach((demon) => {
      if (!demon?.instanceId) return;
      names.set(String(demon.instanceId), demon.species || demon.name || 'Demon');
      sides.set(String(demon.instanceId), 'enemy');
    });

    return { names, sides };
  }

  function getWorldBattleEntrySide(entry, lookup) {
    const attackerSide = lookup.sides.get(String(entry?.attacker || ''));
    if (attackerSide) return attackerSide;
    const targetSide = lookup.sides.get(String(entry?.target || ''));
    return targetSide === 'player' ? 'enemy' : 'player';
  }

  function getWorldBattleEntryAmount(entry = {}) {
    if (entry.effect === 'heal') return `+${formatNumber(entry.healing || 0)}`;
    if (entry.effect === 'poison_apply') return 'poison';
    if (Object.prototype.hasOwnProperty.call(entry, 'dmg')) return `${formatNumber(entry.dmg || 0)} dmg`;
    return '';
  }

  function formatWorldBattleLogAction(entry, lookup) {
    const attacker = getWorldBattleDemonName(entry?.attacker, lookup);
    const target = getWorldBattleDemonName(entry?.target, lookup);

    if (entry?.effect === 'heal') return `${attacker} healed ${target}`;
    if (entry?.effect === 'poison_apply') return `${attacker} poisoned ${target}`;
    if (entry?.effect === 'poison') return `${target} took poison damage`;
    if (entry?.effect === 'retaliate') return `${attacker} retaliated against ${target}`;
    if (entry?.effect === 'thorns') return `${attacker} returned thorns to ${target}`;
    if (entry?.knockback) return `${attacker} pushed ${target} back`;
    return `${attacker} hit ${target}`;
  }

  function getWorldBattleDemonName(instanceId, lookup) {
    if (!instanceId) return 'Combat';
    return lookup.names.get(String(instanceId)) || 'Demon';
  }

  function getWorldBattleMeta(type, battle = {}) {
    return normalizeWorldBattleMeta(type, battle);
  }

  function normalizeWorldBattleMeta(type = 'battle', battle = {}, overrides = {}) {
    const normalizedType = type || overrides.type || 'battle';
    const won = battle.winner === 'player';
    const title = normalizedType === 'try_hunt'
      ? won ? 'Try Hunt Won' : 'Try Hunt Failed'
      : won ? 'Ambush Won' : battle.winner === 'enemy' ? 'Ambush Lost' : 'Ambush';

    return {
      type: normalizedType,
      eyebrow: overrides.eyebrow || (normalizedType === 'try_hunt' ? 'Try Hunt' : 'World Ambush'),
      title: overrides.title || title,
      enemyLabel: overrides.enemyLabel || (normalizedType === 'try_hunt' ? 'Demon Patrol' : 'Ambushers'),
      winText: overrides.winText || (normalizedType === 'try_hunt' ? 'Hunting unlocked' : 'Ambush cleared'),
      lossText: overrides.lossText || (normalizedType === 'try_hunt' ? 'Hunting remains locked' : 'Ambush lost'),
      neutralText: overrides.neutralText || 'Battle ended'
    };
  }

  function getWorldBattleFallbackMessage(battle = {}, meta = {}) {
    const normalizedMeta = normalizeWorldBattleMeta(meta.type, battle, meta);
    if (battle.winner === 'player') return normalizedMeta.winText;
    if (battle.winner === 'enemy') return normalizedMeta.lossText;
    return normalizedMeta.neutralText;
  }

  function formatWorldBattleLabel(value) {
    return capitalize(String(value || '').replace(/[_-]+/g, ' '));
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  let worldDungeonBattleActionsRegistered = false;

  function registerWorldDungeonBattleActions() {
    if (worldDungeonBattleActionsRegistered) return;
    registerDungeonActions({
      ...dungeonDom,
      ...dungeonLifecycle,
      ...dungeonRender,
      ...dungeonCombat,
      ...dungeonRewards,
      ...dungeonPacts,
      ...dungeonHand,
      ...dungeonRecruit,
      ...dungeonModals,
      ...dungeonDragDrop,
      ...dungeonCards,
      ...dungeonUtils
    });
    worldDungeonBattleActionsRegistered = true;
  }

  function shouldShowWorldBattleReplay(battle) {
    return Boolean(battle && Array.isArray(battle.combatLog) && battle.combatLog.length);
  }

  async function showWorldBattleReplay(battle, meta = {}) {
    if (!battle) return Promise.resolve();

    if (battle.error && !Array.isArray(battle.combatLog)) {
      setMessage(battle.error, 'warning');
      return Promise.resolve();
    }

    const modalElement = elements.worldBattleModal;
    const modalApi = window.bootstrap?.Modal;
    if (!modalElement || !modalApi) {
      setMessage(getWorldBattleFallbackMessage(battle, meta), battle.winner === 'player' ? 'success' : 'warning');
      return Promise.resolve();
    }

    registerWorldDungeonBattleActions();
    dungeonDom.cacheElements();
    const token = state.worldBattleReplayToken + 1;
    state.worldBattleReplayToken = token;
    state.activeWorldBattle = battle;
    state.activeWorldBattleMeta = normalizeWorldBattleMeta(meta.type, battle, meta);
    document.body.classList.add('dungeon-page', 'is-world-battle-open');
    prepareWorldDungeonBattleReplay(battle, state.activeWorldBattleMeta);

    const modal = modalApi.getOrCreateInstance(modalElement);
    const shownPromise = modalElement.classList.contains('show')
      ? Promise.resolve()
      : new Promise((resolve) => modalElement.addEventListener('shown.bs.modal', resolve, { once: true }));
    const hiddenPromise = new Promise((resolve) => modalElement.addEventListener('hidden.bs.modal', resolve, { once: true }));

    if (!modalElement.classList.contains('show')) modal.show();
    await shownPromise;
    if (state.worldBattleReplayToken !== token) return hiddenPromise;

    try {
      await dungeonLifecycle.replayFight();
      const resultType = getWorldDungeonBattleResultType(battle);
      if (state.worldBattleReplayToken === token && resultType) {
        await dungeonRender.showBattleResultOverlay(resultType);
      }
    } catch (error) {
      console.error('World battle replay failed', error);
      setMessage(getWorldBattleFallbackMessage(battle, meta), battle.winner === 'player' ? 'success' : 'warning');
    }

    return hiddenPromise;
  }

  function cancelWorldBattleReplay() {
    state.worldBattleReplayToken += 1;
    state.activeWorldBattle = null;
    state.activeWorldBattleMeta = null;
    const resolvePlayback = dungeonState.combatPlayback?.waitResolve;
    dungeonState.combatPlayback = null;
    dungeonState.isBattleAnimating = false;
    dungeonState.isResultAnimating = false;
    if (resolvePlayback) resolvePlayback();
    document.body.classList.remove('dungeon-page', 'is-world-battle-open');
    document.documentElement.classList.remove('is-combat-paused');
    clearWorldDungeonBattleTransientElements();
  }

  function prepareWorldDungeonBattleReplay(battle, meta = {}) {
    const run = createWorldDungeonBattleRun(battle, meta);
    dungeonState.player = state.player || dungeonState.player;
    dungeonState.statPoints = null;
    dungeonState.run = run;
    dungeonState.combatLog = run.lastBattle.combatLog || [];
    dungeonState.combatDemons = new Map();
    dungeonState.combatPlayback = null;
    dungeonState.isLoading = false;
    dungeonState.isRecruiting = false;
    dungeonState.isResultAnimating = false;
    dungeonState.isBattleAnimating = false;
    dungeonState.endNotice = null;
    dungeonState.endSummary = null;
    dungeonState.endedReplayRun = null;
    dungeonState.selectedRecruitRewardId = null;
    dungeonState.selectedSwapInstanceId = null;
    dungeonState.selectedRewardDemonKey = null;
    dungeonState.rewardDraftCandidate = null;
    dungeonState.battleHandPreview = null;
    dungeonState.activeHandTab = 'hand';
    dungeonState.isMobileRewardBoxOpen = false;
    dungeonState.isRecruitContinuePending = false;
    dungeonState.collectionReinforcementPlaceholderInteracted = true;
    dungeonState.collectionReinforcementStagedInteracted = true;
    dungeonState.formationRows = new Map();
    dungeonRender.setBattlePanel('combat');
    dungeonCombat.applyBattleSpeed();
    dungeonRender.renderRun();
  }

  function createWorldDungeonBattleRun(battle = {}, meta = {}) {
    const currentFloor = 1;
    const playerBefore = normalizeWorldDungeonTeam(battle.playerTeamBefore || battle.playerTeam || [], 'player');
    const enemyBefore = normalizeWorldDungeonTeam(battle.enemyTeamBefore || battle.enemyTeam || [], 'enemy');
    const playerAfter = Array.isArray(battle.playerTeamAfter) && battle.playerTeamAfter.length
      ? normalizeWorldDungeonTeam(battle.playerTeamAfter, 'player')
      : null;
    const enemyAfter = Array.isArray(battle.enemyTeamAfter) && battle.enemyTeamAfter.length
      ? normalizeWorldDungeonTeam(battle.enemyTeamAfter, 'enemy')
      : null;

    return {
      runId: `world-${meta.type || 'battle'}-${Date.now()}`,
      status: 'active',
      currentFloor,
      team: playerBefore,
      enemies: enemyBefore,
      rewards: [],
      recruitRewards: [],
      awaitingRecruit: true,
      enemyPressure: null,
      nextEnemyPressure: null,
      buffs: {
        activeBuffs: normalizeWorldDungeonBuffs(battle.playerBuffs),
        pendingChoices: []
      },
      lastBattle: {
        ...battle,
        floor: currentFloor,
        combatLog: Array.isArray(battle.combatLog) ? battle.combatLog : [],
        playerTeamBefore: playerBefore,
        enemyTeamBefore: enemyBefore,
        playerTeamAfter: playerAfter,
        enemyTeamAfter: enemyAfter
      }
    };
  }

  function normalizeWorldDungeonTeam(team = [], side = 'player') {
    return (Array.isArray(team) ? team : []).map((demon, index) => normalizeWorldDungeonDemon(demon, index, side));
  }

  function normalizeWorldDungeonDemon(demon = {}, index = 0, side = 'player') {
    const instanceId = String(demon.instanceId || demon.id || `${side}-${index + 1}`);
    const maxHp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
    const rawHp = Number(demon.hp);
    const hp = Math.max(0, Math.min(maxHp, Number.isFinite(rawHp) ? rawHp : maxHp));
    const formationRow = normalizeWorldDungeonFormationRow(demon.formationSlot ?? demon.formationRow ?? index);

    return {
      ...demon,
      instanceId,
      maxHp,
      hp,
      shield: Math.max(0, Number(demon.shield) || 0),
      position: demon.position === 'back' ? 'back' : (index > 0 ? 'back' : 'front'),
      formationRow,
      formationSlot: formationRow,
      statusEffects: {
        ...(demon.statusEffects || {}),
        poison: Array.isArray(demon.statusEffects?.poison)
          ? demon.statusEffects.poison.map((poison) => ({ ...poison }))
          : []
      }
    };
  }

  function normalizeWorldDungeonFormationRow(value) {
    const row = Number(value);
    if (!Number.isInteger(row)) return 0;
    return Math.max(0, Math.min(8, row));
  }

  function normalizeWorldDungeonBuffs(buffs = []) {
    return (Array.isArray(buffs) ? buffs : [])
      .map((buff, index) => {
        if (!buff) return null;
        if (typeof buff === 'string') {
          return { id: buff, name: formatWorldBattleLabel(buff), description: '', rarity: 'common', icon: 'sparkles', tags: ['World'] };
        }
        const id = buff.id || buff.name || `world-buff-${index + 1}`;
        return {
          ...buff,
          id,
          name: buff.name || formatWorldBattleLabel(id),
          description: buff.description || '',
          tooltip: buff.tooltip || [buff.name || formatWorldBattleLabel(id), buff.description || ''].filter(Boolean).join('\n'),
          rarity: String(buff.rarity || 'common').toLowerCase(),
          icon: buff.icon || 'sparkles',
          tags: Array.isArray(buff.tags) && buff.tags.length ? buff.tags : ['World']
        };
      })
      .filter(Boolean);
  }

  function getWorldDungeonBattleResultType(battle = {}) {
    if (battle.winner === 'player') return 'victory';
    if (battle.winner === 'enemy') return 'defeat';
    return null;
  }

  function clearWorldDungeonBattleTransientElements() {
    document.querySelectorAll([
      '.attack-zap',
      '.battle-result-burst',
      '.chaos-lightning',
      '.combat-impact-burst',
      '.dark-spike',
      '.fireball-shot',
      '.fire-nova',
      '.floating-combat-number',
      '.heal-effect',
      '.sword-swing',
      '.thorn-burst'
    ].join(',')).forEach((element) => element.remove());
    document.querySelector('.dungeon-arena')?.classList.remove('is-combat-screenshake');
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

  function resetCameraOnHunter() {
    setZoom(1);
    centerOnHunter();
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

  function getShrineAt(position) {
    return state.events.find((event) => event.type === 'forsaken_shrine' && event.x === position.x && event.y === position.y) || null;
  }

  function isBoundShrine(event) {
    return Boolean(event?.type === 'forsaken_shrine' && state.boundShrine && positionsEqual(event, state.boundShrine));
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

  function normalizeShrine(shrine) {
    if (!shrine || shrine.type !== 'forsaken_shrine') return null;
    const position = normalizePosition(shrine);

    return {
      ...shrine,
      ...position,
      type: 'forsaken_shrine',
      title: shrine.title || 'Forsaken Shrine'
    };
  }

  function normalizeHunt(hunt) {
    return {
      unlockedEncounterIds: Array.isArray(hunt?.unlockedEncounterIds) ? hunt.unlockedEncounterIds.map(String) : [],
      active: hunt?.active || null
    };
  }

  function isEncounterUnlocked(encounterId) {
    return (state.hunt?.unlockedEncounterIds || []).includes(String(encounterId));
  }

  function isActiveHuntFor(encounterId) {
    return String(state.hunt?.active?.encounterId || '') === String(encounterId || '');
  }

  function isHuntActive() {
    return Boolean(state.hunt?.active);
  }

  function getEncounterById(encounterId) {
    const id = String(encounterId || '');
    if (!id) return null;
    return (state.encounters || []).find((encounter) => String(encounter.id) === id) || null;
  }

  function getActiveHuntEncounter() {
    const active = state.hunt?.active;
    if (!active) return null;
    return getEncounterById(active.encounterId) || state.currentEncounter || null;
  }

  // Expected payout per respawn cycle for an encounter, derived from its threat
  // the same way getEnemyRespawnSeconds()/calculateHuntRewards() do server-side.
  function computeHuntRate(encounter) {
    const difficulty = Math.max(1, Number(encounter?.difficulty) || 1);
    const explicit = Number(encounter?.enemyRespawnSeconds || encounter?.respawnSeconds);
    const respawnSeconds = Number.isFinite(explicit) && explicit > 0
      ? Math.floor(explicit)
      : HUNT_DEFAULT_RESPAWN_SECONDS + Math.max(0, difficulty - 1) * 60;

    return {
      difficulty,
      respawnSeconds,
      xpPerCycle: 5 + difficulty * 2,
      soulsPerCycle: Math.max(1, Math.ceil(difficulty / 2))
    };
  }

  // Mirrors calculateHuntRewards() on the server: each respawn cycle yields one
  // win against the snapshotted patrol, capped at HUNT_REWARD_CYCLE_CAP cycles.
  function computeHuntProgress(active = state.hunt?.active, now = Date.now()) {
    if (!active) return null;

    const startedAt = Date.parse(active.startedAt || '');
    const respawnSeconds = Math.max(1, Number(active.enemyRespawnSeconds) || HUNT_DEFAULT_RESPAWN_SECONDS);
    const encounter = getActiveHuntEncounter();
    const difficulty = Math.max(1, Number(encounter?.difficulty) || 1);

    const elapsedSeconds = Number.isFinite(startedAt)
      ? Math.max(0, Math.floor((now - startedAt) / 1000))
      : 0;
    const cyclesRaw = Math.floor(elapsedSeconds / respawnSeconds);
    const cycles = Math.min(HUNT_REWARD_CYCLE_CAP, cyclesRaw);
    const capped = cyclesRaw >= HUNT_REWARD_CYCLE_CAP;

    const xpPerCycle = 5 + difficulty * 2;
    const soulsPerCycle = Math.max(1, Math.ceil(difficulty / 2));
    const secondsIntoCycle = elapsedSeconds % respawnSeconds;
    const secondsToNext = capped ? 0 : respawnSeconds - secondsIntoCycle;

    return {
      elapsedSeconds,
      respawnSeconds,
      difficulty,
      cycles,
      capped,
      xpPerCycle,
      soulsPerCycle,
      accruedXp: cycles * xpPerCycle,
      accruedSouls: cycles * soulsPerCycle,
      secondsToNext
    };
  }

  function getTileKey(position) {
    return `${position.x},${position.y}`;
  }

  function getEventLabel(type) {
    if (type === 'boss') return 'Boss Fight';
    if (type === 'soul-cache') return 'Soul Cache';
    if (type === 'forsaken_shrine') return 'Forsaken Shrine';
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
    updateHuntTooltip();
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

    if (!target || path.length < 2 || state.moving || !state.viewport || state.selectedEncounter) {
      tooltip.classList.add('d-none');
      return;
    }

    const center = tileCenter(target);
    const scale = state.viewport.scale.x || 1;
    const x = state.viewport.x + center.x * scale;
    const y = state.viewport.y + center.y * scale;

    tooltip.innerHTML = renderTargetTooltipContent(target, path);
    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
    tooltip.classList.remove('d-none');
  }

  function renderTargetTooltipContent(target, path) {
    const event = getEventAt(target);
    const meta = escapeHtml(formatTravelMeta(target, getPathStepCount(path)));
    const header = `
      <strong class="world-tooltip-title">Move to</strong>
      <span class="world-tooltip-meta">${meta}</span>
    `;

    if (!event) return header;

    return `
      ${header}
      <span class="world-target-event-type">${escapeHtml(getEventLabel(event.type))}</span>
      <span class="world-target-event-title">${escapeHtml(event.title || 'World Event')}</span>
      ${event.description ? `<span class="world-target-event-copy">${escapeHtml(event.description)}</span>` : ''}
    `;
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
    const stepCount = getPathStepCount(state.selectedPath || []);

    const demons = team.map(renderDemonPortrait).join('');

    const meterTone = difficulty <= 3 ? 'easy' : (difficulty >= 8 ? 'hard' : 'medium');
    const meter = Array.from({ length: 10 }, (item, index) => (
      `<span class="world-enc-pip${index < difficulty ? ' is-on' : ''}"></span>`
    )).join('');

    tooltip.innerHTML = `
      <strong class="world-tooltip-title">Demon Patrol</strong>
      <span class="world-tooltip-meta">${escapeHtml(formatTravelMeta(encounter, stepCount))}</span>
      ${demons ? `<div class="world-enc-demons">${demons}</div>` : ''}
      <div class="world-enc-difficulty is-${meterTone}">
        <span class="world-enc-difficulty-label">Threat</span>
        <span class="world-enc-meter" aria-label="Threat ${difficulty} of 10">${meter}</span>
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

  // ===========================================================================
  // Passive hunt readout — a ticking timer pinned to the hunter tile plus the
  // accumulated/expected rewards mirrored into the sidebar encounter panel.
  // ===========================================================================

  function syncHuntTicker() {
    if (isHuntActive()) {
      updateHuntTooltip();
      if (!state.huntTicker) {
        state.huntTicker = window.setInterval(onHuntTick, 1000);
        state.cleanup.push(stopHuntTicker);
      }
    } else {
      stopHuntTicker();
      elements.worldHuntTooltip?.classList.add('d-none');
    }
  }

  function stopHuntTicker() {
    if (state.huntTicker) {
      window.clearInterval(state.huntTicker);
      state.huntTicker = null;
    }
  }

  function onHuntTick() {
    if (!isHuntActive()) {
      syncHuntTicker();
      return;
    }
    updateHuntTooltip();
    renderEncounterPanel();
  }

  function updateHuntTooltip() {
    const tooltip = elements.worldHuntTooltip;
    if (!tooltip) return;

    const progress = computeHuntProgress();
    if (!progress || state.moving || !state.viewport) {
      tooltip.classList.add('d-none');
      return;
    }

    tooltip.innerHTML = renderHuntTooltipContent(progress);

    const center = tileCenter(state.hunterRenderPosition || state.position);
    const scale = state.viewport.scale.x || 1;
    const x = state.viewport.x + center.x * scale;
    const y = state.viewport.y + (center.y - TILE_SIZE / 2) * scale;

    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
    tooltip.classList.remove('d-none');
  }

  function renderHuntTooltipContent(progress) {
    const next = progress.capped
      ? 'Reward cap reached'
      : `Next kill in ${formatDuration(progress.secondsToNext)}`;

    return `
      <strong class="world-tooltip-title">Hunting</strong>
      <span class="world-hunt-timer">${formatDuration(progress.elapsedSeconds)}</span>
      <span class="world-hunt-next">${escapeHtml(next)}</span>
    `;
  }

  function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = (value) => String(value).padStart(2, '0');
    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(secs)}`
      : `${pad(minutes)}:${pad(secs)}`;
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
    state.app?.ticker?.remove(updateShrineGlow);
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

  function formatTravelMeta(position, stepCount) {
    return `${formatCoords(position)} · ${formatStepCount(stepCount)}`;
  }

  function getPathStepCount(path) {
    return Math.max(0, (Array.isArray(path) ? path.length : 0) - 1);
  }

  function formatStepCount(stepCount) {
    const count = Math.max(0, Math.trunc(Number(stepCount) || 0));
    return `${formatNumber(count)} ${count === 1 ? 'step' : 'steps'}`;
  }

  function getStoredWorldBattleSpeed() {
    try {
      const stored = Number(localStorage.getItem(BATTLE_SPEED_KEY));
      return BATTLE_SPEED_OPTIONS.includes(stored) ? stored : 1;
    } catch (error) {
      return 1;
    }
  }

  function formatWorldBattleSpeed(speed) {
    return `${Number(speed)}x`;
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
