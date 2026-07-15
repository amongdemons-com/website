import { BATTLE_SPEED_KEY, BATTLE_SPEED_OPTIONS, COMBAT_THEMES, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE } from './dungeon/config.js';
import { registerDungeonActions } from './dungeon/registry.js';
import { state as dungeonState, elements as dungeonElements } from './dungeon/state.js';
import * as dungeonDom from './dungeon/dom.js';
import * as dungeonLifecycle from './dungeon/lifecycle.js?v=20260715-grim-defeat-v1';
import * as dungeonRender from './dungeon/render.js?v=20260715-grim-defeat-v1';
import * as dungeonCombat from './dungeon/combat.js?v=20260715-fight-intro-controls-v1';
import * as dungeonRewards from './dungeon/rewards.js?v=20260714-audio-v1';
import * as dungeonPacts from './dungeon/pacts.js?v=20260714-audio-v1';
import * as dungeonHand from './dungeon/hand.js?v=20260706-stat-preview-v4';
import * as dungeonRecruit from './dungeon/recruit.js?v=20260706-stat-preview-v4';
import * as dungeonModals from './dungeon/modals.js?v=20260706-stat-preview-v4';
import * as dungeonDragDrop from './dungeon/drag-drop.js?v=20260714-audio-v2';
import * as dungeonCards from './dungeon/cards.js';
import * as dungeonUtils from './dungeon/utils.js';

(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const audio = window.AmongDemons.audio;
  const appUrl = window.AmongDemons.appUrl || ((value) => value);
  const renderIcon = window.AmongDemons?.ui?.renderIcon || (() => '');
  const renderDemonCard = window.AmongDemons?.ui?.renderDemonCard || (() => '');
  const openDemonDetailsModal = window.AmongDemons?.ui?.openDemonDetailsModal || (() => {});
  const replaceStaticIcons = window.AmongDemons?.ui?.replaceStaticIcons || (() => {});
  const TILE_SIZE = 64;
  const WORLD_RADIUS = 50;
  const ZONE_START_RADIUS = 24;
  const TYPE_COUNT = 11;
  const ZONE_ROTATION = 0.045;
  // Keep terrain colors/effects aligned with the generated encounter zones.
  const ZONE_TYPE_REMAP = { 4: 5, 5: 4 };
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 2.15;
  const AVERAGE_TERRAIN_COST = 2;
  const ROAD_MOVE_COST = AVERAGE_TERRAIN_COST - 1;
  const CLICK_THRESHOLD = 7;
  const STEP_DURATION_MS = 180;
  const TRAVEL_ZOOM = 1;
  // Kept in sync with world-combat.js so the live hunt readout matches the server payout.
  const HUNT_DEFAULT_KILL_SECONDS = 300;
  const HUNT_STATUS_REFRESH_MS = 15000;
  // Keep this in sync with WORLD_BATTLE_REPLAY_STEP_MS in public/api/lib/world-combat.js.
  const WORLD_BATTLE_REPLAY_STEP_MS = 520;
  const WORLD_BATTLE_REPLAY_REDUCED_STEP_MS = 160;
  const WORLD_DISTANCE_REWARD_START = 8;
  const WORLD_DISTANCE_REWARD_CAP = 70;
  const WORLD_DISTANCE_XP_MULTIPLIER_BONUS = 2;
  // Keep this in sync with PASSIVE_HUNT_XP_MULTIPLIER in public/api/lib/world-combat.js.
  const PASSIVE_HUNT_XP_MULTIPLIER = 0.20;
  const WORLD_TERROR_START_DISTANCE = 10;
  const WORLD_TERROR_MAX_LEVEL = 40;
  const WORLD_AMBUSH_DEFEAT_FADE_MS = 900;
  const WORLD_AMBUSH_DEFEAT_HOLD_MS = 140;
  const WORLD_TEAM_LIMIT = 6;
  const DEFAULT_DARKNESS_PORTAL_SUMMON_SOUL_COST_PER_DISTANCE = 2;
  const DEFAULT_PROFILE_IMAGE_URL = '/app/images/demons/map/1.webp';
  // World boss intro dialog: a random boss taunts the hunter when they enter
  // the world. Currently shown on every visit while the feature is tuned;
  // gate it behind sessionStorage once the novelty should wear off.
  // Taunt lines and each boss's personality live in
  // public/api/data/world-bosses.json and arrive on the boss payload.
  const WORLD_BOSS_INTRO_TYPE_MS = 24;
  // "Mute for 24h" checkbox in the dialog stores an expiry timestamp here.
  const WORLD_BOSS_INTRO_MUTE_KEY = 'amongdemons-world-boss-mute';
  const WORLD_BOSS_INTRO_MUTE_MS = 24 * 60 * 60 * 1000;
  const WORLD_BOSS_INTRO_FALLBACK_LINES = [
    'So... another hunter dares to walk among demons. This world is ours. Prove you belong in it.'
  ];
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
    shrine: 0x3b1618,
    shrineGlow: 0xe8c76a,
    shrineSoul: 0x8de7ff,
    portal: 0x46324a,
    portalGlow: 0x80638a,
    gridLine: 0x293028,
    selection: 0xd7b765,
    validMove: 0x6f8faa,
    road: 0x191d16,
    roadGlow: 0x2b2a20
  };
  const FALLBACK_BLOCKED_TILES = [
    { x: 1, y: 1, type: 'rocks' },
    { x: 1, y: 2, type: 'rocks' },
    { x: 1, y: 3, type: 'rocks' },
    { x: 2, y: 3, type: 'rocks' },
    { x: 3, y: 3, type: 'rocks' },
    { x: -1, y: -2, type: 'rocks' },
    { x: -2, y: -2, type: 'rocks' },
    { x: -3, y: -2, type: 'rocks' },
    { x: -5, y: 0, type: 'rocks' },
    { x: -5, y: 1, type: 'rocks' },
    { x: -5, y: 2, type: 'rocks' },
    { x: 5, y: 1, type: 'rocks' },
    { x: 6, y: 1, type: 'rocks' },
    { x: 6, y: 0, type: 'rocks' }
  ];
  const EVENT_COLORS = {
    forsaken_shrine: BOARD_COLORS.shrineGlow,
    'darkness-portal': BOARD_COLORS.portalGlow
  };
  const RARITY_COLORS = {
    common: '#D1D5D8',
    uncommon: '#41A85F',
    rare: '#2C82C9',
    epic: '#9365B8',
    legendary: '#FAC51C',
    mythic: '#E25041'
  };
  const RARITY_SORT_RANK = {
    mythic: 0,
    mithyc: 0,
    legendary: 1,
    epic: 2,
    rare: 3,
    uncommon: 4,
    common: 5
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
    bossLayer: null,
    hunterLayer: null,
    hunterFrame: null,
    hunterAvatar: null,
    hunterMask: null,
    hunterAvatarTexture: null,
    effectLayer: null,
    resizeObserver: null,
    sidePanelResizeObserver: null,
    cleanup: [],
    position: { x: 0, y: 0 },
    bounds: { min: -WORLD_RADIUS, max: WORLD_RADIUS },
    events: [],
    roads: [],
    roadKeys: new Set(),
    encounters: [],
    bosses: [],
    encounterTextures: new Map(),
    bossTextures: new Map(),
    tileTextures: new Map(),
    terrainBuilt: false,
    puddleFxTiles: [],
    puddleFxStyles: null,
    puddleFxLast: 0,
    selectedEncounter: null,
    selectedBoss: null,
    bossIntro: null,
    player: null,
    playersAt: [],
    activeTeam: null,
    currentEvent: null,
    currentEncounter: null,
    currentBoss: null,
    hunt: null,
    huntBusy: false,
    huntBusyAction: null,
    bossBusy: false,
    huntTicker: null,
    huntStatusRefreshAt: 0,
    bossRefreshTimer: null,
    boundShrine: null,
    bindingShrine: false,
    summoningPortal: false,
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
    sidePanelExpanded: true,
    worldEncounterTab: 'pve',
    activeWorldBattle: null,
    activeWorldBattleMeta: null,
    worldBattleReplayToken: 0,
    ambushDefeatBlackoutActive: false,
    ambushDefeatBlackoutClosing: false,
    worldTeamEditor: {
      collection: [],
      team: [],
      loaded: false,
      loading: false,
      saving: false,
      status: '',
      statusType: 'info',
      drag: null,
      suppressClickUntil: 0
    }
  };

  const elements = {};

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      // First-time visitors play instantly as a guest instead of hitting a gate.
      try {
        await window.AmongDemons.ensurePlayableSession();
      } catch (error) {
        window.location.href = appUrl('/login');
        return;
      }
    }

    audio?.setScene({ music: 'music.default' });
    cacheElements();
    bindDomControls();

    try {
      // Fetch the world state while Pixi boots instead of after it.
      const statePromise = api('/api/world/state');
      await initPixi();
      await loadWorld(await statePromise);
      hideLoading();
      maybeShowWorldBossIntro();
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
      'worldHoverCoordinates',
      'worldHoverCoordinateX',
      'worldHoverCoordinateY',
      'worldTargetTooltip',
      'worldEncounterTooltip',
      'worldHuntTooltip',
      'worldEditTeamButton',
      'worldTeamSummary',
      'worldTeamModal',
      'worldTravelTeamRequiredModal',
      'worldTravelTeamConfirmButton',
      'worldTeamEditorStatus',
      'worldTeamEditorCount',
      'worldTeamEditorGrid',
      'worldTeamEditorCollection',
      'worldTeamCollectionPrev',
      'worldTeamCollectionNext',
      'worldTeamSaveButton',
      'worldShrinePanel',
      'worldEncounterHeading',
      'worldEncounterList',
      'worldTravelPanel',
      'worldSidePanel',
      'worldSideToggle',
      'worldSideStatusLabel',
      'worldSideAreaLabel',
      'worldBattleModal',
      'worldBossDialog',
      'worldBossDialogPortrait',
      'worldBossDialogName',
      'worldBossDialogDemon',
      'worldBossDialogText',
      'worldBossDialogContinue',
      'worldBossDialogMute'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindDomControls() {
    elements.worldPositionButton?.addEventListener('click', () => resetCameraOnHunter());
    elements.worldTargetTooltip?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const summonButton = target?.closest('[data-summon-portal]');
      if (!summonButton) return;

      event.preventDefault();
      event.stopPropagation();
      summonDarknessPortal(summonButton);
    });
    elements.worldEditTeamButton?.addEventListener('click', openWorldTeamEditor);
    elements.worldTravelTeamConfirmButton?.addEventListener('click', openWorldTeamEditorFromTravelWarning);
    elements.worldTeamSaveButton?.addEventListener('click', saveWorldTeamEditor);
    elements.worldTeamModal?.addEventListener('pointerdown', onWorldTeamEditorPointerDown);
    elements.worldTeamModal?.addEventListener('click', onWorldTeamEditorCardClick);
    elements.worldTeamModal?.addEventListener('keydown', onWorldTeamEditorCardKeydown);
    elements.worldTeamCollectionPrev?.addEventListener('click', () => scrollWorldTeamEditorCollection(-1));
    elements.worldTeamCollectionNext?.addEventListener('click', () => scrollWorldTeamEditorCollection(1));
    elements.worldTeamEditorCollection?.addEventListener('scroll', updateWorldTeamEditorCollectionScroll, { passive: true });
    window.addEventListener('resize', updateWorldTeamEditorCollectionScroll);
    elements.worldTeamModal?.addEventListener('shown.bs.modal', updateWorldTeamEditorCollectionScroll);
    elements.worldTeamModal?.addEventListener('hidden.bs.modal', () => {
      cancelWorldTeamEditorDrag();
      setWorldTeamEditorStatus('');
    });
    elements.worldBossDialogMute?.addEventListener('change', (event) => {
      setWorldBossIntroMuted(Boolean(event.target?.checked));
    });
    elements.worldBossDialogContinue?.addEventListener('click', onWorldBossIntroAdvance);
    bindWorldSidePanel();

    elements.worldEncounterList?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const tabButton = target?.closest('[data-world-encounter-tab]');
      if (tabButton) {
        state.worldEncounterTab = tabButton.dataset.worldEncounterTab === 'pvp' ? 'pvp' : 'pve';
        renderEncounterPanel();
        return;
      }
      const anchorButton = target?.closest('[data-anchor-soul]');
      if (anchorButton) {
        anchorSoul(anchorButton);
        return;
      }
      const challengeButton = target?.closest('[data-challenge-player]');
      if (challengeButton) {
        challengePlayer(challengeButton.dataset.challengePlayer, challengeButton);
        return;
      }
      const challengeBossButton = target?.closest('[data-challenge-boss]');
      if (challengeBossButton) {
        challengeBoss(challengeBossButton.dataset.challengeBoss, challengeBossButton);
        return;
      }
      const replayButton = target?.closest('[data-view-world-battle]');
      if (replayButton) {
        const entry = state.travelLog[Number(replayButton.dataset.viewWorldBattle)];
        if (shouldShowAmbushBattleReplay(entry?.battle)) {
          showWorldBattleReplay(entry.battle, getWorldBattleMeta('ambush', entry.battle));
        }
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
      if (shouldShowAmbushBattleReplay(entry?.battle)) {
        showWorldBattleReplay(entry.battle, getWorldBattleMeta('ambush', entry.battle));
      }
    });

    elements.worldBattleModal?.addEventListener('hidden.bs.modal', () => {
      cancelWorldBattleReplay();
    });
    elements.worldBattleModal?.querySelector('.world-battle-close')?.addEventListener('click', (event) => {
      if (!shouldCloseWorldBattleModalInstantly()) return;
      event.preventDefault();
      event.stopPropagation();
      closeWorldBattleModal();
    });
  }

  function bindWorldSidePanel() {
    if (!elements.worldSidePanel || !elements.worldSideToggle) return;

    elements.worldSideToggle.addEventListener('click', () => {
      setWorldSidePanelExpanded(!state.sidePanelExpanded);
    });

    if (typeof ResizeObserver === 'function') {
      state.sidePanelResizeObserver = new ResizeObserver(() => queueWorldSidePanelMeasure());
      state.sidePanelResizeObserver.observe(elements.worldSidePanel);
    } else {
      addListener(window, 'resize', queueWorldSidePanelMeasure);
    }

    syncWorldSidePanel();
  }

  function setWorldSidePanelExpanded(expanded) {
    state.sidePanelExpanded = Boolean(expanded);
    syncWorldSidePanel();
  }

  function syncWorldSidePanel() {
    const panel = elements.worldSidePanel;
    const toggle = elements.worldSideToggle;
    if (!panel || !toggle) return;

    const status = getWorldSidePanelStatus();
    panel.classList.add('is-sheet-mode');
    panel.classList.toggle('is-collapsed', !state.sidePanelExpanded);
    document.body?.classList.toggle('is-world-side-collapsed', !state.sidePanelExpanded);
    panel.dataset.worldStatus = status.toLowerCase();
    toggle.setAttribute('aria-expanded', String(!panel.classList.contains('is-collapsed')));
    setText(elements.worldSideStatusLabel, `${status.toUpperCase()} \u00b7 Area ${formatCoords(state.position)}`);
    setText(elements.worldSideAreaLabel, '');
    queueWorldSidePanelMeasure();
  }

  function queueWorldSidePanelMeasure() {
    window.requestAnimationFrame?.(syncWorldSidePanelMetrics) || syncWorldSidePanelMetrics();
  }

  function syncWorldSidePanelMetrics() {
    const panel = elements.worldSidePanel;
    if (!panel) return;

    const height = Math.ceil(panel.getBoundingClientRect().height);
    if (height > 0) {
      document.body?.style.setProperty('--world-side-panel-height', `${height}px`);
    }
  }

  function getWorldSidePanelStatus() {
    if (state.moving || state.travelStatus === 'moving') return 'Traveling';
    if (isHuntActive()) return 'Hunting';
    return 'Resting';
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
    state.portalGlow = new Pixi.Graphics();    // animated breathing aura around darkness portals
    state.bossAura = new Pixi.Graphics();      // animated pulsating aura beneath boss markers
    state.puddleFx = new Pixi.Graphics();      // animated bubbles / embers over puddles
    state.markerLayer = new Pixi.Container();
    state.encounterLayer = new Pixi.Container();
    state.bossLayer = new Pixi.Container();
    state.hunterLayer = new Pixi.Container();
    state.hunterFrame = new Pixi.Graphics();
    state.hunterAvatar = new Pixi.Sprite(Pixi.Texture.EMPTY);
    state.effectLayer = new Pixi.Graphics();

    state.hunterAvatar.anchor.set(0.5);
    state.hunterLayer.addChild(state.hunterFrame);
    state.hunterLayer.addChild(state.hunterAvatar);
    // Circular portrait mask for the hunter token (repositioned in drawHunter).
    state.hunterMask = new Pixi.Graphics();
    state.hunterLayer.addChild(state.hunterMask);
    state.hunterAvatar.mask = state.hunterMask;

    state.viewport.addChild(state.groundLayer);
    state.viewport.addChild(state.gridLayer);
    state.viewport.addChild(state.fogLayer);
    state.viewport.addChild(state.roadLayer);
    state.viewport.addChild(state.puddleFx);
    state.viewport.addChild(state.hoverLayer);
    state.viewport.addChild(state.pathLayer);
    state.viewport.addChild(state.pathPulse);
    state.viewport.addChild(state.shrineGlow);
    state.viewport.addChild(state.portalGlow);
    state.viewport.addChild(state.markerLayer);
    state.viewport.addChild(state.encounterLayer);
    state.viewport.addChild(state.bossAura);
    state.viewport.addChild(state.bossLayer);
    state.viewport.addChild(state.hunterLayer);
    state.viewport.addChild(state.effectLayer);
    app.stage.addChild(state.viewport);

    app.ticker.add(updatePathPulse);
    app.ticker.add(updateShrineGlow);
    app.ticker.add(updatePortalGlow);
    app.ticker.add(updateBossAura);
    app.ticker.add(updatePuddleFx);

    bindCanvasInput(canvas);
    bindResize();
    resizeCanvas();
    setZoom(getInitialZoom(), { preserveCenter: false });

    // Debug handle for tooling (Pixi devtools / dev captures).
    window.__adWorld = { app, state, renderWorld };
  }

  function bindCanvasInput(canvas) {
    addListener(canvas, 'pointerdown', onPointerDown);
    addListener(canvas, 'pointermove', onPointerMove);
    addListener(canvas, 'pointerup', onPointerUp);
    addListener(canvas, 'pointercancel', clearPointer);
    addListener(canvas, 'pointerleave', onPointerLeave);
    addListener(document, 'pointermove', (event) => {
      if (event.target !== canvas) clearHover();
    }, { passive: true });
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

  async function loadWorld(initialPayload = null) {
    const payload = initialPayload || await api('/api/world/state');
    // Static map layout comes from a separate immutable-cached endpoint keyed
    // by mapVersion, so repeat visits skip re-downloading the whole map.
    const map = await loadWorldMapData(payload.mapVersion);
    state.position = normalizePosition(payload.position);
    state.bounds = map.bounds || state.bounds;
    // Plain landmarks were retired from the map; drop any still present in
    // cached map data.
    state.events = (Array.isArray(map.events) ? map.events : [])
      .filter((event) => event.type !== 'landmark');
    state.roads = Array.isArray(map.roads) ? map.roads : [];
    state.roadKeys = new Set(state.roads.map((tile) => getTileKey(tile)));
    state.encounters = Array.isArray(map.encounters) ? map.encounters : [];
    setWorldBossState(payload, { deferArt: true });
    state.player = payload.player || state.player;
    const blockedTiles = Array.isArray(map.blockedTiles) ? map.blockedTiles : FALLBACK_BLOCKED_TILES;
    state.blockedTiles = blockedTiles.map((tile) => ({ ...tile, type: getBlockedTileType(tile) }));
    state.blockedMap = new Map(state.blockedTiles.map((tile) => [getTileKey(tile), tile]));
    state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
    state.activeTeam = payload.activeTeam || null;
    setHuntState(payload.hunt);
    state.boundShrine = normalizeShrine(payload.boundShrine);
    state.currentEvent = payload.currentEvent || getEventAt(state.position);
    state.currentEncounter = payload.currentEncounter || getEncounterAt(state.position);
    state.currentBoss = payload.currentBoss || getBossAt(state.position);

    buildBoard();
    renderWorld();
    renderPanels();

    if (!state.initialCameraCentered) {
      centerOnHunter();
      state.initialCameraCentered = true;
    }

    // Portrait art is not worth blocking the map for: markers render with
    // rarity-tinted fallbacks and get their portraits swapped in on arrival.
    void loadWorldArt();
  }

  async function loadWorldMapData(version) {
    if (state.worldMapData && state.worldMapDataVersion === version) {
      return state.worldMapData;
    }

    const query = version ? `?v=${encodeURIComponent(version)}` : '';
    const map = await api(`/api/world/map${query}`);
    state.worldMapData = map;
    state.worldMapDataVersion = map.mapVersion || version || null;
    return map;
  }

  async function loadWorldArt() {
    try {
      await Promise.all([loadHunterAvatar(), loadEncounterTextures(), loadBossTextures()]);
    } finally {
      drawMarkers();
      drawEncounterMarkers();
      drawBossMarkers();
    }
  }

  function setWorldBossState(payload = {}, options = {}) {
    const selectedBossId = state.selectedBoss?.id || null;
    if (Array.isArray(payload.bosses)) {
      state.bosses = payload.bosses.map(normalizeWorldBoss).filter(Boolean);
    }
    if (selectedBossId) {
      state.selectedBoss = getBossById(selectedBossId);
      if (!state.selectedBoss) elements.worldEncounterTooltip?.classList.add('d-none');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'currentBoss')) {
      state.currentBoss = normalizeWorldBoss(payload.currentBoss);
    } else {
      state.currentBoss = getBossAt(state.position);
    }
    scheduleWorldBossRefresh();

    if (!options.deferArt) {
      void loadBossTextures().finally(() => {
        drawBossMarkers();
        updateSelectedWorldActivityTooltip();
      });
    }
  }

  function scheduleWorldBossRefresh() {
    if (state.bossRefreshTimer) {
      window.clearTimeout(state.bossRefreshTimer);
      state.bossRefreshTimer = null;
    }

    const nextMoveAt = (state.bosses || [])
      .map((boss) => Date.parse(boss.movesAt || ''))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];
    if (!Number.isFinite(nextMoveAt)) return;

    const delayMs = clamp(nextMoveAt - Date.now() + 1200, 5000, 3600000);
    state.bossRefreshTimer = window.setTimeout(() => {
      state.bossRefreshTimer = null;
      void refreshWorldBossState();
    }, delayMs);
  }

  async function refreshWorldBossState() {
    if (state.moving) {
      scheduleWorldBossRefresh();
      return;
    }

    try {
      const payload = await api('/api/world/state');
      setWorldBossState(payload);
      state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
      state.currentEvent = payload.currentEvent || getEventAt(state.position);
      state.currentEncounter = payload.currentEncounter || getEncounterAt(state.position);
      state.currentBoss = payload.currentBoss || getBossAt(state.position);
      state.activeTeam = payload.activeTeam || state.activeTeam;
      setHuntState(payload.hunt);
      renderWorld();
      renderPanels();
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function handleMapTileClick(tile) {
    if (state.moving) return;

    const target = normalizePosition(tile);
    if (!isInBounds(target)) return;

    const sign = getSignAt(target);

    const boss = getBossAt(target);
    if (boss && positionsEqual(target, state.position)) {
      state.selectedTarget = target;
      state.selectedPath = [];
      state.travelStatus = 'idle';
      state.recentStepEvent = null;
      showBossTooltip(boss);
      renderWorld();
      renderTravelPanel();
      return;
    }

    if (positionsEqual(target, state.position)) {
      if (sign) {
        state.selectedTarget = target;
        state.selectedPath = [];
        state.travelStatus = 'idle';
        state.recentStepEvent = null;
        hideWorldActivityTooltip();
        renderWorld();
        renderTravelPanel();
        renderEncounterPanel();
        return;
      }
      window.location.href = appUrl('/camp');
      return;
    }

    if (isBlocked(target)) {
      audio?.play('sfx.world.moveBlocked', { volume: 0.68 });
      clearRoutePreview('blocked');
      return;
    }

    const event = getEventAt(target);
    if (isDarknessPortalEvent(event)) {
      audio?.play('sfx.world.pathSelect', { volume: 0.66 });
      state.selectedTarget = target;
      state.selectedPath = [];
      state.travelStatus = 'preview';
      state.recentStepEvent = null;
      hideWorldActivityTooltip();
      renderWorld();
      renderTravelPanel();
      return;
    }

    if (state.selectedTarget && positionsEqual(target, state.selectedTarget) && state.selectedPath.length > 1) {
      hideWorldActivityTooltip();
      travelSelectedPath();
      return;
    }

    const path = findPath(state.position, target);
    if (path.length < 2) {
      audio?.play('sfx.world.moveBlocked', { volume: 0.68 });
      clearRoutePreview('blocked');
      setMessage('No passable route found.', 'warning');
      return;
    }

    state.selectedTarget = target;
    state.selectedPath = path;
    audio?.play('sfx.world.pathSelect', { volume: 0.66 });
    state.travelStatus = 'preview';
    state.recentStepEvent = null;

    const encounter = getEncounterAt(target);
    if (boss) {
      showBossTooltip(boss);
    } else if (encounter) {
      showEncounterTooltip(encounter);
    } else {
      hideWorldActivityTooltip();
    }

    renderWorld();
    renderTravelPanel();
  }

  async function travelSelectedPath() {
    const path = (state.selectedPath || []).slice();
    if (state.moving || state.huntBusy || path.length < 2) return;
    if (!hasAssignedWorldTeam()) {
      showTravelTeamRequiredModal();
      return;
    }
    if (!(await stopHuntingForTravel())) return;

    state.moving = true;
    state.travelStatus = 'moving';
    state.travelLog = [];
    state.recentStepEvent = null;
    setTravelCameraZoom();
    setWorldSidePanelExpanded(false);
    renderTravelPanel();
    renderWorld();

    let completedTravel = false;
    try {
      const payload = await commitTravelPath(path);
      setWorldBossState(payload);
      const stepEvents = getTravelStepEvents(payload, path);

      let lostAmbush = false;
      for (let index = 1; index < path.length; index += 1) {
        const step = path[index];
        state.selectedPath = path.slice(index - 1);
        renderWorld();
        await animateHunterStep(step);
        audio?.play('sfx.world.move', {
          volume: 0.54,
          minInterval: Math.max(80, getStepDelay() - 20)
        });

        state.selectedPath = path.slice(index);
        const stepEvent = stepEvents[index - 1] || { type: 'none', title: 'No Event', position: step };
        state.recentStepEvent = {
          ...stepEvent,
          position: step
        };
        state.travelLog.unshift(state.recentStepEvent);
        state.currentEvent = getEventAt(step);
        state.currentEncounter = getEncounterAt(step);
        state.currentBoss = getBossAt(step);
        renderWorld();
        renderPanels();
        const successfulAmbush = stepEvent.type === 'ambush' && stepEvent.battle?.winner === 'enemy';
        if (successfulAmbush) {
          audio?.play('sfx.world.ambush', { volume: 0.9 });
        }
        if (shouldShowAmbushBattleReplay(stepEvent.battle)) {
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
        completedTravel = true;
      } else {
        state.position = normalizePosition(payload.position || state.position);
        state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
        state.currentEvent = payload.currentEvent || getEventAt(state.position);
        state.currentEncounter = payload.currentEncounter || getEncounterAt(state.position);
        state.currentBoss = payload.currentBoss || getBossAt(state.position);
        clearRoutePreview('arrived', { keepLog: true });
        completedTravel = true;
        renderPanels();
      }
    } catch (error) {
      if (isTravelTeamRequiredError(error)) {
        state.travelStatus = state.selectedPath.length > 1 ? 'preview' : 'idle';
        state.recentStepEvent = null;
        setWorldSidePanelExpanded(true);
        showTravelTeamRequiredModal();
        return;
      }
      if (error.status !== 401) {
        clearRoutePreview('idle');
      }
      handleAuthError(error);
    } finally {
      state.moving = false;
      const shouldFadeOutAmbushDefeat = state.ambushDefeatBlackoutActive;
      if (completedTravel) {
        setWorldSidePanelExpanded(true);
      } else {
        syncWorldSidePanel();
      }
      renderWorld();
      renderPanels();
      if (shouldFadeOutAmbushDefeat) {
        await fadeWorldAmbushDefeatFromBlack();
      }
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

  async function resolveAmbushDefeat(options = {}) {
    const recovery = await api('/api/world/ambush-defeat', { method: 'POST' });
    const returnPosition = normalizePosition(recovery.position || state.position);
    setWorldBossState(recovery);

    state.boundShrine = normalizeShrine(recovery.boundShrine);
    state.position = returnPosition;
    state.hunterRenderPosition = null;
    state.playersAt = Array.isArray(recovery.playersAt) ? recovery.playersAt : [];
    state.currentEvent = recovery.currentEvent || getEventAt(returnPosition);
    state.currentEncounter = recovery.currentEncounter || getEncounterAt(returnPosition);
    state.currentBoss = recovery.currentBoss || getBossAt(returnPosition);
    audio?.play('sfx.world.respawn', { volume: 0.88 });

    clearRoutePreview('arrived', { keepLog: true });
    centerOnHunter();
    setMessage(
      options.message || recovery.message || 'You were defeated and dragged back to your Anchored Shrine.',
      'danger'
    );
    renderPanels();
  }

  function clearRoutePreview(status = 'idle', options = {}) {
    state.selectedTarget = null;
    state.selectedPath = [];
    state.recentStepEvent = null;
    hideWorldActivityTooltip();
    state.travelStatus = status;
    if (!options.keepLog && status !== 'arrived') {
      state.travelLog = [];
    }
    renderWorld();
    renderTravelPanel();
    renderEncounterPanel();
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
      centerOnWorldPoint(tileCenter(nextPosition));
      return Promise.resolve();
    }

    const from = state.position;
    const to = nextPosition;
    const startedAt = performance.now();
    const cameraFrom = state.viewport
      ? { x: state.viewport.x, y: state.viewport.y }
      : null;
    const cameraTo = getCenteredViewportPosition(tileCenter(to));

    return new Promise((resolve) => {
      function tick(now) {
        const progress = clamp((now - startedAt) / STEP_DURATION_MS, 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        state.hunterRenderPosition = {
          x: from.x + (to.x - from.x) * eased,
          y: from.y + (to.y - from.y) * eased
        };
        drawHunter();
        if (cameraFrom && cameraTo && state.viewport) {
          state.viewport.x = cameraFrom.x + (cameraTo.x - cameraFrom.x) * eased;
          state.viewport.y = cameraFrom.y + (cameraTo.y - cameraFrom.y) * eased;
          updateCameraStatus();
        }

        if (progress < 1) {
          window.requestAnimationFrame(tick);
          return;
        }

        state.position = to;
        state.hunterRenderPosition = null;
        if (cameraTo) {
          setViewportPosition(cameraTo);
        }
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
    audio?.play('sfx.world.pvpChallenge', { volume: 0.88 });

    try {
      const payload = await api('/api/world/challenge', {
        method: 'POST',
        body: { targetPlayerId }
      });

      rememberCooldown(targetPlayerId, payload.cooldownUntil);
      const battle = payload.battle || null;
      const targetPlayer = payload.targetPlayer || battle?.targetPlayer || getPvpPlayerById(targetPlayerId);
      applyPvpChallengeRecords(payload);
      const battleMeta = getWorldBattleMeta('pvp_challenge', battle, { targetPlayer });
      if (shouldShowWorldBattleReplay(battle)) {
        await showWorldBattleReplay(battle, battleMeta);
      }
      if (isLostPvpChallenge(battle, battleMeta)) {
        await resolveAmbushDefeat({
          message: 'You lost the challenge and returned to your Anchored Shrine.'
        });
      } else {
        setMessage(
          payload.message || getWorldBattleFallbackMessage(battle, battleMeta),
          battle?.winner === 'enemy' ? 'warning' : 'success'
        );
      }
    } catch (error) {
      if (error.status === 429 && error.payload?.cooldownUntil) {
        rememberCooldown(targetPlayerId, error.payload.cooldownUntil);
      }
      handleAuthError(error);
    } finally {
      setButtonBusy(button, false);
      renderEncounterPanel();
      if (state.ambushDefeatBlackoutActive) {
        await fadeWorldAmbushDefeatFromBlack();
      }
    }
  }

  async function challengeBoss(bossId, button) {
    if (!bossId || state.bossBusy) return;
    state.bossBusy = true;
    setButtonBusy(button, true);
    const startBossMusic = () => audio?.setScene({ music: 'music.worldBoss' });
    window.addEventListener('amongdemons:battle-intro-complete', startBossMusic, { once: true });

    try {
      const payload = await api('/api/world/boss/challenge', {
        method: 'POST',
        body: { bossId }
      });
      setWorldBossState(payload);
      const battle = payload.battle || null;
      const boss = payload.boss || battle?.boss || getBossById(bossId);
      const rewardBuff = payload.rewardBuff || battle?.rewardBuff || boss?.rewardBuff || null;
      const battleMeta = getWorldBattleMeta('world_boss', battle, {
        boss,
        rewardBuff
      });
      if (shouldShowWorldBattleReplay(battle)) {
        await showWorldBattleReplay(battle, battleMeta);
      }
      const won = battle?.winner === 'player';
      if (won) audio?.play('sfx.bosses.defeated', { volume: 0.96 });
      setMessage(
        payload.message || getWorldBattleFallbackMessage(battle, battleMeta),
        won ? 'success' : 'warning'
      );
    } catch (error) {
      handleAuthError(error);
    } finally {
      window.removeEventListener('amongdemons:battle-intro-complete', startBossMusic);
      audio?.setScene({ music: 'music.default' });
      state.bossBusy = false;
      setButtonBusy(button, false);
      renderEncounterPanel();
    }
  }

  async function tryHunt(encounterId, button) {
    if (!encounterId || state.huntBusy) return;
    state.huntBusy = true;
    state.huntBusyAction = 'fight';
    setButtonBusy(button, true, 'Fighting…');

    try {
      const payload = await api('/api/world/hunt/try', {
        method: 'POST',
        body: { encounterId }
      });
      setHuntState(payload.hunt);
      const won = payload.battle?.winner === 'player';
      if (shouldShowWorldBattleReplay(payload.battle)) {
        await showWorldBattleReplay(payload.battle, getWorldBattleMeta('try_hunt', payload.battle));
      }
      setMessage(won ? 'You are strong enough to hunt in this area.' : 'Fight failed. Hunting remains locked.', won ? 'success' : 'warning');
    } catch (error) {
      handleAuthError(error);
    } finally {
      state.huntBusy = false;
      state.huntBusyAction = null;
      setButtonBusy(button, false);
      renderEncounterPanel();
    }
  }

  async function startHunting(encounterId, button) {
    if (!encounterId || state.huntBusy) return;
    state.huntBusy = true;
    state.huntBusyAction = 'start';
    setButtonBusy(button, true, 'Starting…');

    try {
      const payload = await api('/api/world/hunting/start', {
        method: 'POST',
        body: { encounterId }
      });
      setHuntState(payload.hunt);
      audio?.play('sfx.world.huntStart', { volume: 0.84 });
      setMessage(`You started hunting ${getEncounterHuntTargetLabel(getEncounterById(encounterId))}.`, 'success');
    } catch (error) {
      handleAuthError(error);
    } finally {
      state.huntBusy = false;
      state.huntBusyAction = null;
      setButtonBusy(button, false);
      renderEncounterPanel();
      syncHuntTicker();
    }
  }

  async function stopHunting(button) {
    await finishActiveHunt({ button });
  }

  async function stopHuntingForTravel() {
    if (!isHuntActive()) return true;
    return finishActiveHunt({
      alreadyStoppedMessage: 'Hunting already stopped. Traveling now.',
      stoppedMessage: (rewards) => `Hunting ended. ${formatHuntRewardSummary(rewards)}`,
      render: false
    });
  }

  function formatHuntRewardSummary(rewards = {}) {
    const soulsLost = Math.max(0, Number(rewards.soulsLost) || 0);
    const overflowNote = soulsLost > 0
      ? ` Your Soul Vessel overflowed — ${formatSoulCount(soulsLost)} slipped into the dark.`
      : '';
    return `Earned ${formatNumber(rewards.xp || 0)} XP and ${formatNumber(rewards.souls || 0)} Souls.${overflowNote}`;
  }

  async function finishActiveHunt(options = {}) {
    if (state.huntBusy) return false;
    state.huntBusy = true;
    state.huntBusyAction = 'end';
    setButtonBusy(options.button, true, 'Ending…');

    try {
      const payload = await api('/api/world/hunting/stop', { method: 'POST' });
      setHuntState(payload.hunt);
      if (payload.player) {
        state.player = {
          ...(state.player || {}),
          ...payload.player
        };
        window.AmongDemons.ui?.updateNavAccount?.(payload.player);
      }
      const rewards = payload.rewards || {};
      if (!payload.alreadyStopped) audio?.play('sfx.world.huntStop', { volume: 0.78 });
      setMessage(
        payload.alreadyStopped
          ? (options.alreadyStoppedMessage || 'Hunting already stopped.')
          : (typeof options.stoppedMessage === 'function'
            ? options.stoppedMessage(rewards)
            : `Hunting stopped. ${formatHuntRewardSummary(rewards)}`),
        'success'
      );
      return true;
    } catch (error) {
      if (error.status === 404) {
        try {
          await refreshHuntStatus({ force: true, render: false });
        } catch (refreshError) {
          setHuntState({
            unlockedEncounterIds: state.hunt?.unlockedEncounterIds || [],
            active: null
          });
        }
        setMessage(options.alreadyStoppedMessage || 'Hunting already stopped.', 'success');
        return true;
      } else {
        handleAuthError(error);
        return false;
      }
    } finally {
      state.huntBusy = false;
      state.huntBusyAction = null;
      setButtonBusy(options.button, false);
      if (options.render !== false) {
        renderEncounterPanel();
      }
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
      audio?.play('sfx.world.shrineBind', { volume: 0.92 });
      setMessage(
        payload.message || 'Soul anchored. You will return to this Forsaken Shrine if defeated.',
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

  async function summonDarknessPortal(button) {
    if (state.summoningPortal || state.moving) return;

    const position = normalizePosition({
      x: button?.dataset?.summonPortalX,
      y: button?.dataset?.summonPortalY
    });
    const portal = getEventAt(position);
    if (!isDarknessPortalEvent(portal)) return;

    state.summoningPortal = true;
    setButtonBusy(button, true);

    try {
      if (!(await stopHuntingForTravel())) return;

      const payload = await api('/api/world/portal/summon', {
        method: 'POST',
        body: { position }
      });
      audio?.play('sfx.world.portalOpen', { volume: 0.94 });

      // Same blackout as an ambush defeat: fade to black, relocate the hunter
      // while the screen is dark, then fade back in (in the finally below).
      await fadeWorldAmbushDefeatToBlack();
      setWorldBossState(payload);

      if (payload.player) {
        state.player = {
          ...(state.player || {}),
          ...payload.player
        };
        window.AmongDemons.ui?.updateNavAccount?.(payload.player);
      }

      state.position = normalizePosition(payload.position || position);
      state.hunterRenderPosition = null;
      audio?.play('sfx.world.teleport', { volume: 0.92 });
      state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
      state.currentEvent = payload.currentEvent || getEventAt(state.position);
      state.currentEncounter = payload.currentEncounter || getEncounterAt(state.position);
      state.currentBoss = payload.currentBoss || getBossAt(state.position);

      clearRoutePreview('arrived', { keepLog: true });
      centerOnHunter();
      setWorldSidePanelExpanded(true);
      setMessage(payload.message || `Summoned to Area ${formatCoords(state.position)}.`, 'success');
    } catch (error) {
      handleAuthError(error);
    } finally {
      state.summoningPortal = false;
      setButtonBusy(button, false);
      renderWorld();
      renderPanels();
      if (state.ambushDefeatBlackoutActive) {
        await fadeWorldAmbushDefeatFromBlack();
      }
    }
  }

  function renderWorld() {
    drawFog();
    drawHover();
    drawPath();
    drawMarkers();
    drawEncounterMarkers();
    drawBossMarkers();
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
    ground: [0x131812, 0x141913, 0x121711],
    patch: 0x20291f,
    moss: 0x28381f,
    crack: 0x0a0d09,
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
  const PATH_CORE = 0xd8f3ff;
  const PATH_GLOW = 0x58c7f0;

  function createZonePalette(typeId) {
    const accent = zoneAccentForType(typeId);
    const accentRgb = colorNumberToRgb(accent);

    return {
      ground: [
        tintBaseColor(DEFAULT_ZONE_PALETTE.ground[0], accentRgb, 0.08),
        tintBaseColor(DEFAULT_ZONE_PALETTE.ground[1], accentRgb, 0.08),
        tintBaseColor(DEFAULT_ZONE_PALETTE.ground[2], accentRgb, 0.08)
      ],
      patch: tintBaseColor(DEFAULT_ZONE_PALETTE.patch, accentRgb, 0.14),
      moss: tintBaseColor(DEFAULT_ZONE_PALETTE.moss, accentRgb, 0.1),
      crack: tintBaseColor(DEFAULT_ZONE_PALETTE.crack, accentRgb, 0.04),
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

  // Organic zone boundaries. The neutral border radius breathes with the angle
  // and the wedge borders meander with distance from spawn. All theta harmonics
  // use integer frequencies so the field stays continuous across the -PI/PI
  // wrap. Keep in sync with zoneTypeId in scripts/generate-world-map.js.
  function neutralZoneRadius(theta) {
    return ZONE_START_RADIUS +
      Math.sin(theta * 3 + 1.7) * 3.4 +
      Math.sin(theta * 5 + 0.6) * 2.1 +
      Math.sin(theta * 9 + 4.1) * 1.2;
  }

  // Angular offset (in 0..1 turns) applied to wedge borders; ~0.02 turns peak,
  // which bends a border by roughly 3 tiles at the neutral rim and 6 at the map edge.
  function zoneBoundaryJitter(radius, theta) {
    return (
      Math.sin(radius * 0.31 + theta * 2) * 0.5 +
      Math.sin(radius * 0.17 - theta * 3 + 2.3) * 0.35 +
      Math.sin(radius * 0.53 + theta * 5 + 4.6) * 0.15
    ) * 0.02;
  }

  function zoneTypeIdForTile(x, y) {
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    if (radius < neutralZoneRadius(angle)) return 0;
    const normalized = (angle + Math.PI) / (2 * Math.PI);
    const jittered = normalized + ZONE_ROTATION + zoneBoundaryJitter(radius, angle);
    const sector = Math.floor((((jittered % 1) + 1) % 1) * TYPE_COUNT) % TYPE_COUNT;
    return remapZoneTypeId(sector + 1);
  }

  function remapZoneTypeId(typeId) {
    return ZONE_TYPE_REMAP[typeId] || typeId;
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

  // Mossy broken-flagstone ground. Values stay near-identical across variants —
  // large-scale tonal drift comes from the macro shading overlay, not the tile
  // grid, so the ground reads as one continuous surface instead of a checker.
  function groundTexture(zone, variant) {
    return getTileTexture(`ground:${zone}:${variant}`, (g) => {
      const rng = seededRng(variant * 911 + zone * 53 + 7);
      const palette = ZONE_PALETTES[zone] || DEFAULT_ZONE_PALETTE;
      g.rect(0, 0, TILE_SIZE, TILE_SIZE).fill({ color: palette.ground[variant % palette.ground.length] });

      // Soft low-contrast patches to break flat repetition.
      for (let i = 0; i < 2; i += 1) {
        g.ellipse(rng() * TILE_SIZE, rng() * TILE_SIZE, 12 + rng() * 18, 10 + rng() * 16)
          .fill({ color: palette.patch, alpha: 0.08 });
      }

      // Flagstone cracks: 2-3 faint meandering seams wandering across the tile.
      // Kept very low contrast so random tile rotation never shows a seam.
      const cracks = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < cracks; i += 1) {
        const vertical = rng() < 0.5;
        let x = vertical ? rng() * TILE_SIZE : -2;
        let y = vertical ? -2 : rng() * TILE_SIZE;
        g.moveTo(x, y);
        const steps = 3 + Math.floor(rng() * 2);
        for (let s = 1; s <= steps; s += 1) {
          const t = s / steps;
          x = vertical ? x + (rng() - 0.5) * 22 : -2 + t * (TILE_SIZE + 4);
          y = vertical ? -2 + t * (TILE_SIZE + 4) : y + (rng() - 0.5) * 22;
          g.lineTo(x, y);
        }
        g.stroke({ color: palette.crack, width: 1 + rng(), alpha: 0.5 });
      }

      // Moss creeping out of a couple of crack junctions: small clustered dabs.
      const mossClumps = rng() < 0.75 ? 1 + Math.floor(rng() * 2) : 0;
      for (let i = 0; i < mossClumps; i += 1) {
        const mx = 8 + rng() * (TILE_SIZE - 16);
        const my = 8 + rng() * (TILE_SIZE - 16);
        const dabs = 3 + Math.floor(rng() * 3);
        for (let d = 0; d < dabs; d += 1) {
          g.ellipse(mx + (rng() - 0.5) * 12, my + (rng() - 0.5) * 10, 2.5 + rng() * 4, 2 + rng() * 3)
            .fill({ color: palette.moss, alpha: 0.16 + rng() * 0.1 });
        }
      }

      // A few tiny grit speckles.
      for (let i = 0; i < 3; i += 1) {
        g.circle(rng() * TILE_SIZE, rng() * TILE_SIZE, 0.7 + rng() * 0.7)
          .fill({ color: rng() < 0.5 ? palette.stoneDark : palette.stoneLight, alpha: 0.12 });
      }
    });
  }

  // World-space macro shading: broad, soft light/dark pools laid over the whole
  // board so tonal drift crosses tile boundaries. This is what makes the ground
  // read as terrain instead of a grid of squares. Static — drawn once.
  function drawMacroShading(g) {
    const min = state.bounds.min ?? -WORLD_RADIUS;
    const max = state.bounds.max ?? WORLD_RADIUS;
    const cell = 5; // one blob every ~5 tiles
    for (let gy = min; gy <= max; gy += cell) {
      for (let gx = min; gx <= max; gx += cell) {
        const r1 = hashTile(gx, gy, 21);
        const r2 = hashTile(gx, gy, 22);
        const r3 = hashTile(gx, gy, 23);
        const cx = (gx + r1 * cell) * TILE_SIZE;
        const cy = (gy + r2 * cell) * TILE_SIZE;
        const radius = TILE_SIZE * (2.2 + r3 * 2.6);
        const dark = hashTile(gx, gy, 24) < 0.55;
        g.ellipse(cx, cy, radius, radius * (0.7 + r1 * 0.4))
          .fill({ color: dark ? 0x000000 : 0x8fa08a, alpha: dark ? 0.05 : 0.025 });
      }
    }
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
      const rng = seededRng(mask * 733 + variant * 197 + zone * 61 + 11);
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

      // Organic bulges along each arm's spine. Kept away from the tile edge so
      // the cross-section at the boundary stays constant and neighbouring road
      // tiles still merge without a seam. Collected once, drawn in two passes
      // (edge halo below, dirt above) so bulges never stripe over each other.
      const bulges = [];
      const spine = (dx, dy) => {
        for (const at of [0.28, 0.52, 0.74]) {
          const jitter = (rng() - 0.5) * 5;
          bulges.push({
            x: half + dx * at * half + (dy ? jitter : 0),
            y: half + dy * at * half + (dx ? jitter : 0),
            r: w * 0.52 + rng() * 4.5
          });
        }
      };
      if (mask & 1) spine(0, -1);
      if (mask & 2) spine(1, 0);
      if (mask & 4) spine(0, 1);
      if (mask & 8) spine(-1, 0);
      if (!mask) bulges.push({ x: half, y: half, r: w * 0.62 });

      // Dark packed-earth halo first (rect arms + bulges), then the dirt body.
      segs.forEach(([sx, sy, sw, sh]) => g.rect(sx - 2.5, sy - 2.5, sw + 5, sh + 5).fill({ color: palette.roadEdge, alpha: 0.4 }));
      bulges.forEach(({ x, y, r }) => g.ellipse(x, y, r + 2.5, (r + 2.5) * 0.9).fill({ color: palette.roadEdge, alpha: 0.4 }));
      segs.forEach(([sx, sy, sw, sh]) => g.rect(sx, sy, sw, sh).fill({ color: dirt, alpha: 0.96 }));
      bulges.forEach(({ x, y, r }) => g.ellipse(x, y, r, r * 0.9).fill({ color: dirt, alpha: 0.96 }));

      // Worn sheen down the centre of each arm.
      const sheen = (dx, dy) => {
        for (const at of [0.2, 0.55]) {
          g.ellipse(half + dx * at * half, half + dy * at * half, 6 + rng() * 3, 5 + rng() * 3)
            .fill({ color: palette.roadSheen, alpha: 0.14 });
        }
      };
      g.ellipse(half, half, 7, 7).fill({ color: palette.roadSheen, alpha: 0.16 });
      if (mask & 1) sheen(0, -1);
      if (mask & 2) sheen(1, 0);
      if (mask & 4) sheen(0, 1);
      if (mask & 8) sheen(-1, 0);

      // Embedded cobbles scattered along the arms: rounded worn stones with a
      // hint of a shadow. Kept off the tile boundary so they never get sliced.
      const margin = 5;
      const cobbleIn = (sx, sy, sw, sh, count) => {
        for (let i = 0; i < count; i += 1) {
          const cx = clamp(sx + 4 + rng() * (sw - 8), margin, TILE_SIZE - margin);
          const cy = clamp(sy + 4 + rng() * (sh - 8), margin, TILE_SIZE - margin);
          const rx = 2.2 + rng() * 2.4;
          const ry = rx * (0.7 + rng() * 0.25);
          const tone = palette.stone[Math.floor(rng() * palette.stone.length)];
          g.ellipse(cx + 0.8, cy + 1, rx, ry).fill({ color: palette.roadEdge, alpha: 0.5 });
          g.ellipse(cx, cy, rx, ry).fill({ color: tone, alpha: 0.5 + rng() * 0.2 });
        }
      };
      segs.forEach(([sx, sy, sw, sh], index) => cobbleIn(sx, sy, sw, sh, index === 0 ? 2 : 3));

      // Moss nibbling at the road edges.
      const mossBits = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < mossBits; i += 1) {
        const [sx, sy, sw, sh] = segs[Math.floor(rng() * segs.length)];
        const side = rng() < 0.5 ? -1 : 1;
        const alongX = sw >= sh;
        const mx = clamp(alongX ? sx + rng() * sw : sx + (side < 0 ? 1 : sw - 1), margin, TILE_SIZE - margin);
        const my = clamp(alongX ? sy + (side < 0 ? 1 : sh - 1) : sy + rng() * sh, margin, TILE_SIZE - margin);
        g.ellipse(mx, my, 2.5 + rng() * 3, 2 + rng() * 2).fill({ color: palette.moss, alpha: 0.2 });
      }
    });
  }

  function obstacleTexture(kind, variant, zone, blockType) {
    return getTileTexture(`obs:${zone}:${blockType}:${kind}:${variant}`, (g) => {
      const rng = seededRng((OBSTACLE_KINDS.indexOf(kind) + 1) * 4099 + variant * 131 + 3);
      const palette = ZONE_PALETTES[zone] || DEFAULT_ZONE_PALETTE;
      if (blockType === 'poison') {
        drawPoisonPuddle(g, rng, palette);
        return;
      }
      if (blockType === 'lava') {
        drawLavaPuddle(g, rng, palette);
        return;
      }
      drawObstacle(g, kind, rng, palette);
    });
  }

  // Top-down cluster of dark leaves used to mask blocked tiles in the demon
  // type 8 zone. The tile stays blocked in pathing logic; this only changes how
  // it's drawn.
  // Deep, desaturated leaf greens tinted by the zone accent — dark and brooding.
  function leafClusterColors(palette) {
    const accentRgb = colorNumberToRgb(palette.accent);
    return {
      leafDeep: tintBaseColor(0x0c1207, accentRgb, 0.12),
      leafDark: tintBaseColor(0x14200d, accentRgb, 0.16),
      leafMid: tintBaseColor(0x1f3214, accentRgb, 0.2),
      leafEdge: tintBaseColor(0x35501f, accentRgb, 0.24) // faint rim light
    };
  }

  // Paint one pile of overlapping leaves centred at (cx,cy). No shadow — the
  // caller lays shadows down first so a merged mass shares one continuous pool.
  function drawLeafCluster(g, cx, cy, radius, rng, colors) {
    const { leafDeep, leafDark, leafMid, leafEdge } = colors;

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

  function drawTreeObstacle(g, rng, palette) {
    const cx = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const cy = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const radius = TILE_SIZE * 0.46;
    g.ellipse(cx + 3, cy + 4, radius * 0.85, radius * 0.72)
      .fill({ color: 0x000000, alpha: 0.32 });
    drawLeafCluster(g, cx, cy, radius, rng, leafClusterColors(palette));
  }

  // A single merged leaf mass spanning a connected cluster of blocked zone-8
  // tiles. Drawn in world coordinates so the foliage flows across tile
  // boundaries. Blocking/pathing logic is unchanged — every tile stays blocked.
  function drawGiantLeafCluster(g, tiles, palette) {
    const colors = leafClusterColors(palette);
    const keySet = new Set(tiles.map(getTileKey));
    const seedFor = (a, b, c) => (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ (c >>> 0)) >>> 0;

    // Collect a leaf pile per tile, plus extra piles at the seam between each
    // pair of adjacent tiles so the foliage reads continuous with no gap.
    const nodes = [];
    for (const t of tiles) {
      const c = tileCenter(t);
      nodes.push({ x: c.x, y: c.y, r: TILE_SIZE * 0.5, seed: seedFor(t.x, t.y, 0x9e3779b1) });
    }
    for (const t of tiles) {
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const n = { x: t.x + d.x, y: t.y + d.y };
        if (!keySet.has(getTileKey(n))) continue;
        const a = tileCenter(t);
        const b = tileCenter(n);
        nodes.push({
          x: (a.x + b.x) / 2,
          y: (a.y + b.y) / 2,
          r: TILE_SIZE * 0.44,
          seed: seedFor(t.x + n.x, t.y + n.y, 0x85ebca6b)
        });
      }
    }

    // Shadows first (one soft pool per pile), then all the leaves on top.
    for (const node of nodes) {
      g.ellipse(node.x + 3, node.y + 4, node.r * 0.85, node.r * 0.72)
        .fill({ color: 0x000000, alpha: 0.26 });
    }
    for (const node of nodes) {
      drawLeafCluster(g, node.x, node.y, node.r, seededRng(node.seed), colors);
    }
  }

  // --- puddle-style obstacles (poison ooze in zone 3, lava in zone 4) --------
  // A blocked tile is drawn as an irregular puddle; connected clusters merge
  // into one giant puddle. The tile stays blocked in pathing logic — this only
  // changes how it's drawn. Poison and lava share the same shape/merge code and
  // differ only in their colour set and the details painted on the surface.

  // Trace an irregular closed puddle outline into the current path (no fill).
  // Summing a few sine harmonics at different frequencies gives organic bumps
  // and concave bays instead of a regular polygon; the curve is smoothed by
  // passing through edge midpoints with the raw vertices as control points.
  // `ampScale` dials the wobble down for the overlapping blobs of a merged
  // puddle so their union never pinches apart.
  function tracePuddleBlobPath(g, cx, cy, radius, rng, ampScale = 1) {
    const lobes = 16;
    const h = [
      { freq: 2, amp: (0.16 + rng() * 0.1) * ampScale, phase: rng() * Math.PI * 2 },
      { freq: 3, amp: (0.12 + rng() * 0.08) * ampScale, phase: rng() * Math.PI * 2 },
      { freq: 5, amp: (0.07 + rng() * 0.06) * ampScale, phase: rng() * Math.PI * 2 }
    ];
    const pts = [];
    for (let i = 0; i < lobes; i += 1) {
      const a = (i / lobes) * Math.PI * 2;
      let raw = 0;
      for (const { freq, amp, phase } of h) raw += amp * Math.sin(a * freq + phase);
      // Asymmetric: shallow outward bulges but deeper inward bays — the lobed,
      // irregular look of a real puddle edge.
      const factor = 1 + (raw > 0 ? raw * 0.5 : raw * 0.95);
      const r = radius * factor;
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.95 });
    }
    const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const start = mid(pts[lobes - 1], pts[0]);
    g.moveTo(start.x, start.y);
    for (let i = 0; i < lobes; i += 1) {
      const cur = pts[i];
      const m = mid(cur, pts[(i + 1) % lobes]);
      g.quadraticCurveTo(cur.x, cur.y, m.x, m.y);
    }
    g.closePath();
  }

  // Generic single-tile puddle: irregular body + dark rim + style-specific
  // surface details.
  function drawPuddle(g, rng, palette, colorsFn, drawDetails) {
    const cx = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const cy = TILE_SIZE / 2 + (rng() - 0.5) * 4;
    const radius = TILE_SIZE * 0.46;
    const colors = colorsFn(palette);

    tracePuddleBlobPath(g, cx, cy, radius, rng);
    g.fill({ color: colors.body })
      .stroke({ color: colors.border, width: 3, alpha: 0.95 });

    drawDetails(g, cx, cy, radius, rng, colors);
  }

  // Generic merged puddle spanning a connected cluster of blocked tiles. Drawn
  // in world coordinates (not a per-tile texture) so the shape flows across tile
  // boundaries. Blocking/pathing logic is unchanged — every tile in `tiles` is
  // still individually blocked.
  function drawGiantPuddle(g, tiles, palette, colorsFn, drawDetails) {
    const colors = colorsFn(palette);
    const keySet = new Set(tiles.map(getTileKey));
    const tileRng = (t) => seededRng((Math.imul(t.x | 0, 73856093) ^ Math.imul(t.y | 0, 19349663) ^ 0x9e3779b1) >>> 0);
    const edgeRng = (t, n) => seededRng((Math.imul((t.x + n.x) | 0, 40503) ^ Math.imul((t.y + n.y) | 0, 12289) ^ 0x85ebca6b) >>> 0);

    // Trace the whole silhouette once. `grow` inflates every piece uniformly so
    // the border pass sits just outside the body pass, leaving a clean outer rim
    // and no seams between merged tiles.
    const tracePass = (grow) => {
      for (const t of tiles) {
        const c = tileCenter(t);
        tracePuddleBlobPath(g, c.x, c.y, TILE_SIZE * 0.5 + grow, tileRng(t), 0.55);
      }
      // Bridge each tile to its right/down neighbour (each edge once) with a
      // couple of overlapping rounded blobs along the corridor. Blobs (not a
      // straight rectangle) keep the join organic — no straight edges or hard
      // corners — while still overlapping enough that it can never pinch apart.
      for (const t of tiles) {
        for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
          const n = { x: t.x + d.x, y: t.y + d.y };
          if (!keySet.has(getTileKey(n))) continue;
          const a = tileCenter(t);
          const b = tileCenter(n);
          const rng = edgeRng(t, n);
          for (const at of [0.34, 0.66]) {
            const nx = a.x + (b.x - a.x) * at;
            const ny = a.y + (b.y - a.y) * at;
            tracePuddleBlobPath(g, nx, ny, TILE_SIZE * 0.42 + grow, rng, 0.4);
          }
        }
      }
      // Fill the middle of any solid 2x2 quad so it leaves no diamond hole.
      for (const t of tiles) {
        const right = getTileKey({ x: t.x + 1, y: t.y });
        const down = getTileKey({ x: t.x, y: t.y + 1 });
        const diag = { x: t.x + 1, y: t.y + 1 };
        if (keySet.has(right) && keySet.has(down) && keySet.has(getTileKey(diag))) {
          const a = tileCenter(t);
          tracePuddleBlobPath(g, a.x + TILE_SIZE / 2, a.y + TILE_SIZE / 2, TILE_SIZE * 0.5 + grow, edgeRng(t, diag), 0.35);
        }
      }
    };

    tracePass(3);
    g.fill({ color: colors.border });
    tracePass(0);
    g.fill({ color: colors.body });

    // Surface details scattered per tile so the large surface stays lively.
    for (const t of tiles) {
      const c = tileCenter(t);
      drawDetails(g, c.x, c.y, TILE_SIZE * 0.42, tileRng(t), colors);
    }
  }

  // --- poison ooze (demon type 3) --------------------------------------------
  // Sickly green ooze tones tinted by the zone accent.
  function poisonPuddleColors(palette) {
    const accentRgb = colorNumberToRgb(palette.accent);
    return {
      border: tintBaseColor(0x060d07, accentRgb, 0.2), // dark wet edge
      body: tintBaseColor(0x14291a, accentRgb, 0.4), // murky ooze
      deep: tintBaseColor(0x0b1a0e, accentRgb, 0.3),
      glow: tintBaseColor(0x4e8a48, accentRgb, 0.55) // bright toxic sheen
    };
  }

  // Baked surface of a poison puddle: a darker depth pool, floating scum
  // blotches and a glossy toxic sheen. The rising gas bubbles are animated
  // separately (see drawPoisonFxParticle).
  function drawPoisonDetails(g, cx, cy, radius, rng, colors) {
    const { deep, glow } = colors;

    // Deeper murk pooled off-centre.
    g.ellipse(cx + radius * 0.1, cy + radius * 0.12, radius * 0.55, radius * 0.42)
      .fill({ color: deep, alpha: 0.55 });

    // Floating scum blotches drifting on the surface.
    const scum = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < scum; i += 1) {
      const a = rng() * Math.PI * 2;
      const dist = radius * (0.15 + rng() * 0.5);
      g.ellipse(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist * 0.85, radius * (0.1 + rng() * 0.12), radius * (0.06 + rng() * 0.07))
        .fill({ color: glow, alpha: 0.12 + rng() * 0.08 });
    }

    // Glossy sheen crescent catching the light.
    g.ellipse(cx - radius * 0.24, cy - radius * 0.26, radius * 0.3, radius * 0.14)
      .fill({ color: glow, alpha: 0.3 });
    g.ellipse(cx - radius * 0.1, cy - radius * 0.38, radius * 0.12, radius * 0.06)
      .fill({ color: glow, alpha: 0.22 });
  }

  function drawPoisonPuddle(g, rng, palette) {
    drawPuddle(g, rng, palette, poisonPuddleColors, drawPoisonDetails);
  }

  function drawGiantPoisonPuddle(g, tiles, palette) {
    drawGiantPuddle(g, tiles, palette, poisonPuddleColors, drawPoisonDetails);
  }

  // --- lava (demon type 4) ---------------------------------------------------
  // Molten body with a cooled dark crust rim, tinted by the zone accent.
  function lavaPuddleColors(palette) {
    const accentRgb = colorNumberToRgb(palette.accent);
    return {
      border: tintBaseColor(0x120704, accentRgb, 0.12), // cooled rock crust
      body: tintBaseColor(0x31100a, accentRgb, 0.22), // dark cooling crust
      deep: tintBaseColor(0x190803, accentRgb, 0.12), // cold crust plates
      fissure: tintBaseColor(0xff7a2e, accentRgb, 0.15), // molten crack
      glow: tintBaseColor(0xffc257, accentRgb, 0.12) // white-hot core
    };
  }

  // Cooled crust plates and the occasional white-hot well — the non-fissure
  // surface of a lava pool. The rising embers are animated separately
  // (see drawLavaFxParticle).
  function drawLavaCrust(g, cx, cy, radius, rng, colors) {
    const { deep, fissure, glow } = colors;

    const crusts = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < crusts; i += 1) {
      const a = rng() * Math.PI * 2;
      const dist = radius * (0.2 + rng() * 0.45);
      const px = cx + Math.cos(a) * dist;
      const py = cy + Math.sin(a) * dist * 0.9;
      const r = radius * (0.18 + rng() * 0.14);
      g.ellipse(px, py, r, r * 0.75).fill({ color: deep, alpha: 0.5 });
    }

    if (rng() < 0.45) {
      const a = rng() * Math.PI * 2;
      const dist = radius * (0.1 + rng() * 0.4);
      const px = cx + Math.cos(a) * dist;
      const py = cy + Math.sin(a) * dist * 0.9;
      const r = radius * (0.05 + rng() * 0.04);
      g.circle(px, py, r * 2.4).fill({ color: fissure, alpha: 0.3 });
      g.circle(px, py, r).fill({ color: glow, alpha: 0.95 });
    }
  }

  // Solo tiles and merged pools both keep just the crust plates and hot
  // wells — no glowing crack lines.
  function drawLavaPuddle(g, rng, palette) {
    drawPuddle(g, rng, palette, lavaPuddleColors, drawLavaCrust);
  }

  function drawGiantLavaPuddle(g, tiles, palette) {
    drawGiantPuddle(g, tiles, palette, lavaPuddleColors, drawLavaCrust);
  }

  // --- animated puddle particles (rising bubbles / embers) -------------------
  // The puddle bodies are baked once; only these particles animate. They loop
  // purely off a time value (no per-particle state) and are drawn each tick for
  // on-screen puddle tiles only, so cost scales with what's visible, not the
  // whole world.
  const PUDDLE_FX_RADIUS = TILE_SIZE * 0.42;

  // Deterministic 0..1 hash so a particle can pick a fresh spawn spot each loop.
  function fxHash(a, b, c) {
    let h = Math.imul((a | 0) ^ 0x9e3779b1, 2654435761);
    h = Math.imul(h ^ ((b | 0) + 0x85ebca6b), 2246822519);
    h = Math.imul(h ^ ((c | 0) + 0x27d4eb2f), 3266489917);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  // A poison gas bubble: translucent dark body with a bright rim.
  function drawPoisonFxParticle(g, x, y, r, alpha, colors) {
    g.circle(x, y, r * 1.6).fill({ color: colors.glow, alpha: 0.14 * alpha });
    g.circle(x, y, r).fill({ color: colors.deep, alpha: 0.7 * alpha })
      .stroke({ color: colors.glow, width: 1.2, alpha: 0.85 * alpha });
  }

  // A lava ember: a glowing hot dot with a soft halo.
  function drawLavaFxParticle(g, x, y, r, alpha, colors) {
    g.circle(x, y, r * 1.9).fill({ color: colors.glow, alpha: 0.22 * alpha });
    g.circle(x, y, r).fill({ color: colors.glow, alpha: 0.92 * alpha });
  }

  // Draw one tile's worth of rising particles at time `now` (ms). Each particle
  // is born low in the pool, floats north, shrinks and fades over its lifetime,
  // then respawns at a new spot on the next loop.
  function drawPuddleFxParticles(g, cx, cy, now, seed, style) {
    const radius = PUDDLE_FX_RADIUS;
    for (let i = 0; i < style.count; i += 1) {
      const t = now / style.period + i / style.count;
      const life = t - Math.floor(t); // 0 at birth → 1 at top
      const cycle = Math.floor(t); // increments each loop → reseed spawn
      const baseX = cx + (fxHash(seed, i * 7 + 1, cycle) - 0.5) * radius * 0.9;
      const sway = Math.sin(life * Math.PI * 1.4 + fxHash(seed, i * 7 + 3, cycle) * 6.283) * radius * 0.12;
      const x = baseX + sway;
      const y = cy + radius * 0.15 - life * radius * style.rise;
      const r = radius * style.startR * (1 - life * 0.72); // shrink as it rises
      if (r <= 0.4) continue;
      const alpha = Math.sin(life * Math.PI); // fade in then out
      style.render(g, x, y, r, alpha, style.colors);
    }
  }

  // Build the per-style particle config once (colours depend on zone palette).
  function buildPuddleFxStyles() {
    return {
      poison: {
        colors: poisonPuddleColors(ZONE_PALETTES[3] || DEFAULT_ZONE_PALETTE),
        render: drawPoisonFxParticle,
        count: 3, period: 2600, rise: 1.35, startR: 0.13
      },
      lava: {
        colors: lavaPuddleColors(ZONE_PALETTES[4] || DEFAULT_ZONE_PALETTE),
        render: drawLavaFxParticle,
        count: 4, period: 2100, rise: 1.5, startR: 0.13
      }
    };
  }

  // Ticker: redraw the animated particles for every on-screen puddle tile.
  function updatePuddleFx() {
    const layer = state.puddleFx;
    if (!layer) return;
    const tiles = state.puddleFxTiles;
    if (!tiles || !tiles.length) return;

    const now = performance.now();
    // Embers drift slowly — ~30fps is plenty and halves the redraw cost.
    if (now - (state.puddleFxLast || 0) < 33) return;
    state.puddleFxLast = now;

    layer.clear();

    // Visible world rectangle (with a tile of margin) for culling.
    const scale = state.viewport.scale.x || 1;
    const margin = TILE_SIZE;
    const left = -state.viewport.x / scale - margin;
    const top = -state.viewport.y / scale - margin;
    const right = (state.app.screen.width - state.viewport.x) / scale + margin;
    const bottom = (state.app.screen.height - state.viewport.y) / scale + margin;

    const styles = state.puddleFxStyles;
    for (const tile of tiles) {
      if (tile.cx < left || tile.cx > right || tile.cy < top || tile.cy > bottom) continue;
      drawPuddleFxParticles(layer, tile.cx, tile.cy, now, tile.seed, styles[tile.styleKey]);
    }
  }

  // Group blocked tiles of a given explicit type into orthogonally-connected
  // clusters so adjacent ones can be rendered as one merged shape.
  function computeBlockedComponents(blockType, zoneId = undefined) {
    const set = new Set();
    const byKey = new Map();
    for (const t of state.blockedTiles) {
      if (!isInBounds(t) || getBlockedTileType(t) !== blockType) continue;
      if (zoneId !== undefined && zoneTypeIdForTile(t.x, t.y) !== zoneId) continue;
      const k = getTileKey(t);
      set.add(k);
      byKey.set(k, { x: t.x, y: t.y });
    }
    const seen = new Set();
    const components = [];
    for (const [key, tile] of byKey) {
      if (seen.has(key)) continue;
      const comp = [];
      const stack = [tile];
      seen.add(key);
      while (stack.length) {
        const cur = stack.pop();
        comp.push(cur);
        const neigh = [
          { x: cur.x + 1, y: cur.y }, { x: cur.x - 1, y: cur.y },
          { x: cur.x, y: cur.y + 1 }, { x: cur.x, y: cur.y - 1 }
        ];
        for (const nb of neigh) {
          const nk = getTileKey(nb);
          if (set.has(nk) && !seen.has(nk)) {
            seen.add(nk);
            stack.push(byKey.get(nk));
          }
        }
      }
      components.push(comp);
    }
    return components;
  }

  // Trace one irregular angular boulder outline centred at (cx,cy).
  function boulderPoints(cx, cy, radius, rng) {
    const sides = 6 + Math.floor(rng() * 3);
    const start = rng() * Math.PI * 2;
    const pts = [];
    for (let i = 0; i < sides; i += 1) {
      const a = start + (i / sides) * Math.PI * 2 + (rng() - 0.5) * 0.35;
      const r = radius * (0.62 + rng() * 0.38);
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86);
    }
    return pts;
  }

  // One dark angular boulder with a moonlit facet and a crack line.
  function drawBoulder(g, x, y, r, rng, palette) {
    const body = palette.stone[Math.floor(rng() * palette.stone.length)];
    const pts = boulderPoints(x, y, r, rng);
    g.poly(pts).fill({ color: body })
      .stroke({ color: palette.stoneDark, width: 1.6, alpha: 0.85 });

    // Moonlit facet on the upper-left of the boulder.
    const litPts = boulderPoints(x - r * 0.18, y - r * 0.22, r * 0.55, rng);
    g.poly(litPts).fill({ color: palette.stoneLight, alpha: 0.16 });

    // A crack line falling from near the top.
    const crackX = x + (rng() - 0.5) * r * 0.6;
    g.moveTo(crackX, y - r * 0.55)
      .lineTo(crackX + (rng() - 0.5) * 6, y - r * 0.1)
      .lineTo(crackX + (rng() - 0.5) * 8, y + r * 0.4)
      .stroke({ color: palette.stoneDark, width: 1.1, alpha: 0.6 });
  }

  // Blocked tile: a cluster of ruined rock outcrops — dark angular boulders
  // with a moonlit top edge, rubble at the base and moss in the cracks.
  function drawObstacle(g, kind, rng, palette) {
    void kind;
    const tone = () => palette.stone[Math.floor(rng() * palette.stone.length)];

    // Shared pool of ground shadow under the whole cluster.
    g.ellipse(TILE_SIZE / 2 + 2, TILE_SIZE / 2 + 6, TILE_SIZE * 0.42, TILE_SIZE * 0.32)
      .fill({ color: 0x000000, alpha: 0.35 });

    // Two or three overlapping boulders, back-to-front.
    const count = 2 + Math.floor(rng() * 2);
    const spots = [
      { x: TILE_SIZE * (0.34 + rng() * 0.1), y: TILE_SIZE * (0.36 + rng() * 0.08), r: TILE_SIZE * (0.3 + rng() * 0.06) },
      { x: TILE_SIZE * (0.62 + rng() * 0.1), y: TILE_SIZE * (0.5 + rng() * 0.1), r: TILE_SIZE * (0.26 + rng() * 0.06) },
      { x: TILE_SIZE * (0.4 + rng() * 0.14), y: TILE_SIZE * (0.62 + rng() * 0.08), r: TILE_SIZE * (0.2 + rng() * 0.05) }
    ];
    for (let i = 0; i < count; i += 1) {
      const { x, y, r } = spots[i];
      drawBoulder(g, x, y, r, rng, palette);
    }

    // Rubble scatter at the base.
    const rubble = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < rubble; i += 1) {
      const a = rng() * Math.PI * 2;
      const dist = TILE_SIZE * (0.3 + rng() * 0.14);
      const px = TILE_SIZE / 2 + Math.cos(a) * dist;
      const py = TILE_SIZE / 2 + Math.sin(a) * dist * 0.8 + 4;
      const s = 1.6 + rng() * 2.6;
      g.ellipse(px, py, s, s * 0.75).fill({ color: tone(), alpha: 0.8 });
    }

    // Moss clinging to the shaded side.
    const mossBits = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < mossBits; i += 1) {
      g.ellipse(TILE_SIZE * (0.3 + rng() * 0.4), TILE_SIZE * (0.5 + rng() * 0.24), 2.5 + rng() * 3.5, 2 + rng() * 2.5)
        .fill({ color: palette.moss, alpha: 0.3 });
    }
  }

  // A single merged rock formation spanning a connected cluster of blocked
  // tiles (every zone without a bespoke obstacle style). Drawn in world
  // coordinates so boulders straddle tile boundaries and the cluster reads as
  // one outcrop. Blocking/pathing logic is unchanged — every tile stays blocked.
  function drawGiantRockCluster(g, tiles, palette) {
    const keySet = new Set(tiles.map(getTileKey));
    const seedFor = (a, b, c) => (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ (c >>> 0)) >>> 0;

    // Boulder nodes in three size bands, biggest placed first. Anything that
    // would sit inside a bigger rock's footprint is dropped — a large rock
    // replaces the small clutter instead of being surrounded by it — and the
    // bands overlap in size so the mix reads small → medium → large.
    const bigs = [];
    for (const t of tiles) {
      const right = getTileKey({ x: t.x + 1, y: t.y });
      const down = getTileKey({ x: t.x, y: t.y + 1 });
      const diag = { x: t.x + 1, y: t.y + 1 };
      if (!keySet.has(right) || !keySet.has(down) || !keySet.has(getTileKey(diag))) continue;
      const c = tileCenter(t);
      const rng = seededRng(seedFor(t.x + diag.x, t.y + diag.y, 0xb5297a4d));
      const node = {
        x: c.x + TILE_SIZE / 2 + (rng() - 0.5) * 10,
        y: c.y + TILE_SIZE / 2 + (rng() - 0.5) * 10,
        r: TILE_SIZE * (0.55 + rng() * 0.17),
        seed: seedFor(t.x + diag.x, t.y + diag.y, 0x27d4eb2f)
      };
      // Overlapping 2x2 chunks would pile big rocks on top of each other.
      if (bigs.some((b) => Math.hypot(b.x - node.x, b.y - node.y) < TILE_SIZE * 1.1)) continue;
      bigs.push(node);
    }
    const insideBig = (x, y, factor) => bigs.some((b) => Math.hypot(b.x - x, b.y - y) < b.r * factor);

    const nodes = [...bigs];
    // Medium boulders bridge each seam between neighbouring tiles.
    for (const t of tiles) {
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const n = { x: t.x + d.x, y: t.y + d.y };
        if (!keySet.has(getTileKey(n))) continue;
        const a = tileCenter(t);
        const b = tileCenter(n);
        const rng = seededRng(seedFor(t.x + n.x, t.y + n.y, 0x85ebca6b));
        const x = (a.x + b.x) / 2 + (rng() - 0.5) * 8;
        const y = (a.y + b.y) / 2 + (rng() - 0.5) * 8;
        if (insideBig(x, y, 0.95)) continue;
        nodes.push({
          x,
          y,
          r: TILE_SIZE * (0.34 + rng() * 0.14),
          seed: seedFor(t.x + n.x, t.y + n.y, 0x165667b1)
        });
      }
    }
    // Small boulders fill whatever ground the bigger rocks left open.
    for (const t of tiles) {
      const c = tileCenter(t);
      const rng = seededRng(seedFor(t.x, t.y, 0x9e3779b1));
      const count = 1 + (rng() < 0.35 ? 1 : 0);
      for (let i = 0; i < count; i += 1) {
        const x = c.x + (rng() - 0.5) * TILE_SIZE * 0.5;
        const y = c.y + (rng() - 0.5) * TILE_SIZE * 0.5;
        const r = TILE_SIZE * (0.2 + rng() * 0.18);
        if (insideBig(x, y, 0.8)) continue;
        nodes.push({ x, y, r, seed: seedFor(t.x, t.y, 0x6c62272e + i) });
      }
    }

    // Shadows first (one shared pool of darkness), then all the boulders
    // back-to-front so the overlaps stack naturally.
    for (const node of nodes) {
      g.ellipse(node.x + 2, node.y + 6, node.r * 1.35, node.r * 1.05)
        .fill({ color: 0x000000, alpha: 0.28 });
    }
    nodes.sort((a, b) => (a.y - b.y) || (a.r - b.r));
    for (const node of nodes) {
      drawBoulder(g, node.x, node.y, node.r, seededRng(node.seed), palette);
    }

    // Rubble and moss scattered per tile so the formation stays weathered.
    for (const t of tiles) {
      const c = tileCenter(t);
      const rng = seededRng(seedFor(t.x, t.y, 0x38495ab5));
      const rubble = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < rubble; i += 1) {
        const a = rng() * Math.PI * 2;
        const dist = TILE_SIZE * (0.3 + rng() * 0.16);
        const px = c.x + Math.cos(a) * dist;
        const py = c.y + Math.sin(a) * dist * 0.8 + 4;
        const s = 1.6 + rng() * 2.6;
        if (insideBig(px, py, 0.9)) continue;
        g.ellipse(px, py, s, s * 0.75)
          .fill({ color: palette.stone[Math.floor(rng() * palette.stone.length)], alpha: 0.8 });
      }
      const mossBits = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < mossBits; i += 1) {
        const mx = c.x + (rng() - 0.5) * TILE_SIZE * 0.5;
        const my = c.y + (rng() - 0.2) * TILE_SIZE * 0.3;
        const mw = 2.5 + rng() * 3.5;
        const mh = 2 + rng() * 2.5;
        if (insideBig(mx, my, 0.9)) continue;
        g.ellipse(mx, my, mw, mh).fill({ color: palette.moss, alpha: 0.3 });
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

    // Tiles in a connected cluster of 2+ blocked tiles get drawn together as one
    // merged shape below (poison puddle, lava pool, or rock formation), so skip
    // their per-tile obstacle art here. The block's type, not its zone, selects
    // the obstacle style.
    const poisonComponents = computeBlockedComponents('poison');
    const lavaComponents = computeBlockedComponents('lava');
    const rockZones = new Set();
    for (const t of state.blockedTiles) {
      if (getBlockedTileType(t) !== 'rocks') continue;
      const zone = zoneTypeIdForTile(t.x, t.y);
      rockZones.add(zone);
    }
    const rockComponents = [];
    for (const zone of rockZones) {
      for (const comp of computeBlockedComponents('rocks', zone)) {
        rockComponents.push({ zone, tiles: comp });
      }
    }
    const mergedKeys = new Set();
    for (const comps of [poisonComponents, lavaComponents, rockComponents.map((c) => c.tiles)]) {
      for (const comp of comps) {
        if (comp.length >= 2) for (const t of comp) mergedKeys.add(getTileKey(t));
      }
    }

    // Every poison/lava tile emits animated particles on the ticker, whether it
    // renders solo or as part of a merge.
    state.puddleFxStyles = buildPuddleFxStyles();
    state.puddleFxTiles = [];
    const PUDDLE_FX_TYPES = { poison: 'poison', lava: 'lava' };

    for (let y = min; y <= max; y += 1) {
      for (let x = min; x <= max; x += 1) {
        const zone = zoneTypeIdForTile(x, y);
        const ground = makeTileSprite(groundTexture(zone, Math.floor(hashTile(x, y, 0) * GROUND_VARIANTS)), x, y);
        ground.rotation = Math.floor(hashTile(x, y, 3) * 4) * (Math.PI / 2);
        if (hashTile(x, y, 4) < 0.5) ground.scale.x = -1;
        state.groundLayer.addChild(ground);

        const blocked = getBlockedTile({ x, y });
        if (blocked) {
          const blockType = getBlockedTileType(blocked);
          const fxStyle = PUDDLE_FX_TYPES[blockType];
          if (fxStyle) {
            const c = tileCenter({ x, y });
            state.puddleFxTiles.push({
              cx: c.x,
              cy: c.y,
              seed: (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0,
              styleKey: fxStyle
            });
          }
          if (blockType === 'sign') {
            // Signs are passable world markers, drawn above roads with the
            // other interactive objects in drawEventMarkers().
          } else if (mergedKeys.has(getTileKey({ x, y }))) {
            // Part of a merged cluster drawn after this loop.
          } else {
            const kind = OBSTACLE_KINDS[Math.floor(hashTile(x, y, 1) * OBSTACLE_KINDS.length)];
            const obstacle = makeTileSprite(obstacleTexture(kind, Math.floor(hashTile(x, y, 2) * OBSTACLE_VARIANTS), zone, blockType), x, y);
            if (hashTile(x, y, 5) < 0.5) obstacle.scale.x = -1;
            state.groundLayer.addChild(obstacle);
          }
        } else if (!isRoadTile({ x, y }) && hashTile(x, y, 7) < PROP_CHANCE) {
          // Rare, subtle stone decal on open ground.
          const prop = makeTileSprite(propTexture(zone, Math.floor(hashTile(x, y, 8) * 3)), x, y);
          if (hashTile(x, y, 9) < 0.5) prop.scale.x = -1;
          state.groundLayer.addChild(prop);
        }
      }
    }

    // Merged clusters: one Graphics per connected component, in world coordinates.
    for (const comp of poisonComponents) {
      if (comp.length < 2) continue;
      const puddle = new Pixi.Graphics();
      drawGiantPoisonPuddle(puddle, comp, ZONE_PALETTES[3] || DEFAULT_ZONE_PALETTE);
      state.groundLayer.addChild(puddle);
    }
    for (const comp of lavaComponents) {
      if (comp.length < 2) continue;
      const lava = new Pixi.Graphics();
      drawGiantLavaPuddle(lava, comp, ZONE_PALETTES[4] || DEFAULT_ZONE_PALETTE);
      state.groundLayer.addChild(lava);
    }
    for (const { zone, tiles } of rockComponents) {
      if (tiles.length < 2) continue;
      const rocks = new Pixi.Graphics();
      drawGiantRockCluster(rocks, tiles, ZONE_PALETTES[zone] || DEFAULT_ZONE_PALETTE);
      state.groundLayer.addChild(rocks);
    }

    // Broad soft light/dark pools across the whole board (crosses tile seams).
    const macro = new Pixi.Graphics();
    drawMacroShading(macro);
    state.groundLayer.addChild(macro);

    buildBorderRidge();

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

  // --- border ridge -----------------------------------------------------------
  // An impassable rocky ridge hems in the playable map and sinks into the
  // darkness beyond. Purely cosmetic — pathing already clamps to the bounds —
  // and derived from state.bounds, so it moves outward if the map ever grows.
  const BORDER_RIDGE_DEPTH = 3;

  // Continuous fade for the border ridge: 0 at the playable edge, ~0.92 at the
  // outer rim, eased so the shore stays bright and the far rocks all but merge
  // with the void. `dt` is distance beyond the edge in tiles.
  function borderRidgeDarkness(dt) {
    const k = clamp(dt / BORDER_RIDGE_DEPTH, 0, 1);
    return k * k * (3 - 2 * k) * 0.92;
  }

  function buildBorderRidge() {
    const Pixi = window.PIXI;
    const min = state.bounds.min ?? -WORLD_RADIUS;
    const max = state.bounds.max ?? WORLD_RADIUS;
    const loPx = min * TILE_SIZE;
    const hiPx = (max + 1) * TILE_SIZE;
    // Distance (in tiles) of a world-pixel point beyond the playable edge.
    const depthAt = (px, py) =>
      Math.max(loPx - px, px - hiPx, loPx - py, py - hiPx, 0) / TILE_SIZE;
    const shadeStone = (color, k) => rgbToColorNumber(mixRgb(colorNumberToRgb(color), [4, 8, 10], k));

    const eachRingTile = (depth, visit) => {
      const lo = min - depth;
      const hi = max + depth;
      for (let x = lo; x <= hi; x += 1) {
        visit(x, lo);
        visit(x, hi);
      }
      for (let y = lo + 1; y <= hi - 1; y += 1) {
        visit(lo, y);
        visit(hi, y);
      }
    };

    // Ground first for every ring so no boulder overhang gets painted over,
    // continuing each zone's terrain out under the rocks, at full brightness —
    // the darkening comes from the smooth veil below, not per-tile tints.
    for (let depth = 1; depth <= BORDER_RIDGE_DEPTH; depth += 1) {
      eachRingTile(depth, (x, y) => {
        const zone = zoneTypeIdForTile(x, y);
        const ground = makeTileSprite(groundTexture(zone, Math.floor(hashTile(x, y, 21) * GROUND_VARIANTS)), x, y);
        ground.rotation = Math.floor(hashTile(x, y, 22) * 4) * (Math.PI / 2);
        state.groundLayer.addChild(ground);
      });
    }

    // Darkness veil over the ring ground: thin concentric strips stepping the
    // fade curve every few pixels, so the ground dims as one continuous
    // gradient instead of tile-sized bands. Reaches full void at the rim (no
    // outer seam) and sits under the rocks, which carry their own shading.
    const veil = new Pixi.Graphics();
    const VEIL_STEP = TILE_SIZE / 8;
    const veilSteps = BORDER_RIDGE_DEPTH * 8;
    for (let i = 0; i < veilSteps; i += 1) {
      const inner = i * VEIL_STEP;
      const outer = inner + VEIL_STEP;
      const alpha = Math.min(1, borderRidgeDarkness((inner + VEIL_STEP / 2) / TILE_SIZE) * 1.15);
      if (alpha <= 0) continue;
      const x0 = loPx - outer;
      const width = (hiPx + outer) - x0;
      veil.rect(x0, loPx - outer, width, VEIL_STEP).fill({ color: 0x040a0d, alpha });
      veil.rect(x0, hiPx + inner, width, VEIL_STEP).fill({ color: 0x040a0d, alpha });
      veil.rect(x0, loPx - inner, VEIL_STEP, (hiPx + inner) - (loPx - inner)).fill({ color: 0x040a0d, alpha });
      veil.rect(hiPx + inner, loPx - inner, VEIL_STEP, (hiPx + inner) - (loPx - inner)).fill({ color: 0x040a0d, alpha });
    }
    state.groundLayer.addChild(veil);

    // Rocks outside-in so the innermost (brightest) boulders overlap the darker
    // ones behind them. Every boulder is shaded by its own distance into the
    // dark (plus noise), so the fade is a gradient, not stepped rings. The
    // shore ring is a ragged mix of sizes; the outer rings pack solid large
    // boulders.
    const ridge = new Pixi.Graphics();
    for (let depth = BORDER_RIDGE_DEPTH; depth >= 1; depth -= 1) {
      eachRingTile(depth, (x, y) => {
        const rng = seededRng((Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ (0xa53a90 + depth)) >>> 0);
        const palette = ZONE_PALETTES[zoneTypeIdForTile(x, y)] || DEFAULT_ZONE_PALETTE;
        const c = tileCenter({ x, y });

        // Occasional gap on the shore ring keeps the inner edge irregular.
        if (depth === 1 && rng() < 0.12) return;

        const big = depth > 1 || rng() < 0.35;
        const r = TILE_SIZE * (big ? 0.5 + rng() * 0.2 : 0.34 + rng() * 0.14);
        const bx = c.x + (rng() - 0.5) * TILE_SIZE * 0.7;
        const by = c.y + (rng() - 0.5) * TILE_SIZE * 0.7;
        const dark = clamp(borderRidgeDarkness(depthAt(bx, by)) + (rng() - 0.5) * 0.1, 0, 0.95);
        const shaded = {
          stone: palette.stone.map((tone) => shadeStone(tone, dark)),
          stoneDark: shadeStone(palette.stoneDark, dark),
          stoneLight: shadeStone(palette.stoneLight, dark)
        };
        ridge.ellipse(bx + 2, by + 6, r * 1.3, r).fill({ color: 0x000000, alpha: 0.3 * (1 - dark * 0.7) });
        drawBoulder(ridge, bx, by, r, rng, shaded);

        // A companion stone at the base of some boulders.
        if (rng() < 0.4) {
          const sr = TILE_SIZE * (0.16 + rng() * 0.12);
          const sx = bx + (rng() - 0.5) * TILE_SIZE * 0.8;
          const sy = by + (0.2 + rng() * 0.4) * TILE_SIZE * 0.6;
          drawBoulder(ridge, sx, sy, sr, rng, shaded);
        }
      });
    }
    state.groundLayer.addChild(ridge);
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

  // --- dynamic layers ---------------------------------------------------------

  function drawFog() {
    const layer = state.fogLayer;
    if (!layer) return;
    layer.clear();

    // Event glows all animate on the ticker now (updateShrineGlow /
    // updatePortalGlow), so only the active tile outline is drawn here.

    // Active tile: a faint gold ground-ring under the hunter token.
    const active = tileCenter(state.position);
    layer.circle(active.x, active.y, 26).stroke({ color: BOARD_COLORS.selection, width: 1.2, alpha: 0.22 });
  }

  function drawHover() {
    const layer = state.hoverLayer;
    if (!layer) return;
    layer.clear();
    if (!state.hoverTile || state.moving || positionsEqual(state.hoverTile, state.position)) {
      updateHoverCoordinates();
      return;
    }

    // Corner brackets identify the exact tile without covering its terrain.
    const inset = 7;
    const cornerLength = 11;
    const left = state.hoverTile.x * TILE_SIZE + inset;
    const top = state.hoverTile.y * TILE_SIZE + inset;
    const right = (state.hoverTile.x + 1) * TILE_SIZE - inset;
    const bottom = (state.hoverTile.y + 1) * TILE_SIZE - inset;

    layer.rect(left, top, right - left, bottom - top).fill({ color: PATH_GLOW, alpha: 0.045 });
    layer.moveTo(left, top + cornerLength).lineTo(left, top).lineTo(left + cornerLength, top);
    layer.moveTo(right - cornerLength, top).lineTo(right, top).lineTo(right, top + cornerLength);
    layer.moveTo(right, bottom - cornerLength).lineTo(right, bottom).lineTo(right - cornerLength, bottom);
    layer.moveTo(left + cornerLength, bottom).lineTo(left, bottom).lineTo(left, bottom - cornerLength);
    layer.stroke({ color: PATH_GLOW, width: 1.8, alpha: 0.72 });
    updateHoverCoordinates(state.hoverTile);
  }

  function updateHoverCoordinates(tile = null) {
    const badge = elements.worldHoverCoordinates;
    if (!badge) return;

    const hoverTile = tile || state.hoverTile;
    if (!hoverTile || state.moving || !state.viewport || positionsEqual(hoverTile, state.position)) {
      badge.classList.add('d-none');
      return;
    }

    const scale = state.viewport.scale.x || 1;
    const center = tileCenter(hoverTile);
    const tileTop = state.viewport.y + hoverTile.y * TILE_SIZE * scale;
    const tileBottom = state.viewport.y + (hoverTile.y + 1) * TILE_SIZE * scale;
    const x = state.viewport.x + center.x * scale;
    const navBottom = document.querySelector('.game-shell-nav')?.getBoundingClientRect().bottom || 0;
    const placeBelow = tileTop < navBottom + 30;

    setText(elements.worldHoverCoordinateX, formatNumber(hoverTile.x));
    setText(elements.worldHoverCoordinateY, formatNumber(hoverTile.y));
    badge.classList.toggle('is-below', placeBelow);
    badge.classList.remove('d-none');

    const hostWidth = elements.worldCanvasHost?.clientWidth || state.app?.screen?.width || 0;
    const horizontalInset = badge.offsetWidth / 2 + 8;
    const clampedX = hostWidth > horizontalInset * 2
      ? clamp(x, horizontalInset, hostWidth - horizontalInset)
      : x;

    badge.style.left = `${Math.round(clampedX)}px`;
    badge.style.top = `${Math.round(placeBelow ? tileBottom : tileTop)}px`;
  }

  function drawPath() {
    const layer = state.pathLayer;
    if (!layer) return;
    layer.clear();

    const path = state.selectedPath || [];
    if (path.length < 2) return;

    // A trail of drifting pale-blue motes — jittered off the tile centres so the
    // route reads as a wandering trace, not a grid. The destination glow is
    // handled by the animated pulse.
    path.forEach((tile, index) => {
      if (index === 0) return;
      const c = tileCenter(tile);
      const isTarget = index === path.length - 1;
      if (isTarget) {
        layer.circle(c.x, c.y, 12).fill({ color: PATH_GLOW, alpha: 0.12 });
        return;
      }
      const jx = (hashTile(tile.x, tile.y, 41) - 0.5) * 16;
      const jy = (hashTile(tile.x, tile.y, 42) - 0.5) * 16;
      layer.circle(c.x + jx, c.y + jy, 4.5).fill({ color: PATH_GLOW, alpha: 0.14 });
      layer.circle(c.x + jx, c.y + jy, 1.8).fill({ color: PATH_CORE, alpha: 0.75 });
      // A smaller trailing spark between this mote and the previous tile.
      const prev = tileCenter(path[index - 1]);
      const mx = (c.x + jx + prev.x) / 2 + (hashTile(tile.x, tile.y, 43) - 0.5) * 10;
      const my = (c.y + jy + prev.y) / 2 + (hashTile(tile.x, tile.y, 44) - 0.5) * 10;
      layer.circle(mx, my, 1.1).fill({ color: PATH_CORE, alpha: 0.4 });
    });
  }

  // Animated destination marker — a pulsing pale-blue ring (runs on the ticker).
  function updatePathPulse() {
    const layer = state.pathPulse;
    if (!layer) return;
    layer.clear();

    const path = state.selectedPath || [];
    if (path.length < 2 || state.moving) return;

    const c = tileCenter(path[path.length - 1]);
    const phase = (performance.now() % 1600) / 1600;
    layer.circle(c.x, c.y, 8 + phase * 10).stroke({ color: PATH_GLOW, width: 1.5, alpha: 0.32 * (1 - phase) });
    layer.circle(c.x, c.y, 6).fill({ color: PATH_GLOW, alpha: 0.14 });
    layer.circle(c.x, c.y, 2.6).fill({ color: PATH_CORE, alpha: 0.9 });
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

  // Animated aura for darkness portals — a soft violet glow that slowly swells
  // and shrinks in a loop (runs on the ticker).
  function updatePortalGlow() {
    const layer = state.portalGlow;
    if (!layer) return;
    layer.clear();

    const portals = (state.events || []).filter((event) => isDarknessPortalEvent(event));
    if (!portals.length) return;

    const now = performance.now();
    portals.forEach((event) => {
      const c = tileCenter(event);
      // Per-portal phase offset so the portals don't all pulse in sync.
      const phase = event.x * 17 + event.y * 29;
      const breath = (Math.sin(now / 900 + phase) + 1) / 2; // 0..1 loop, ~5.6s
      const radius = TILE_SIZE * (0.34 + breath * 0.12);
      layer.circle(c.x, c.y, radius)
        .fill({ color: BOARD_COLORS.portalGlow, alpha: 0.12 + breath * 0.08 });
      layer.circle(c.x, c.y, radius * 0.6)
        .fill({ color: BOARD_COLORS.portalGlow, alpha: 0.1 + breath * 0.06 });
    });
  }

  // Animated pulsating aura beneath boss markers — a gold halo that swells and
  // fades in a loop, with a second slower ring so the threat reads at a glance
  // (runs on the ticker, drawn under the boss node in drawBossMarkers).
  function updateBossAura() {
    const layer = state.bossAura;
    if (!layer) return;
    layer.clear();

    const bosses = state.bosses || [];
    if (!bosses.length) return;

    const now = performance.now();
    const gold = 0xf2c35e;

    bosses.forEach((boss) => {
      const c = tileCenter(boss);
      const selected = state.selectedBoss?.id === boss.id;
      // Per-boss phase so multiple bosses don't pulse in lockstep.
      const phase = boss.x * 19 + boss.y * 31;
      const breath = (Math.sin(now / 780 + phase) + 1) / 2; // 0..1 loop, ~4.9s
      const intensity = selected ? 1 : 0.7;

      // Soft breathing halo.
      layer.circle(c.x, c.y, TILE_SIZE * (0.58 + breath * 0.3))
        .fill({ color: gold, alpha: (0.1 + breath * 0.1) * intensity });
      layer.circle(c.x, c.y, TILE_SIZE * (0.36 + breath * 0.16))
        .fill({ color: gold, alpha: (0.08 + breath * 0.08) * intensity });

      // An outward pulse ring that expands and fades on a separate cadence.
      const pulse = ((now / 1900) + phase * 0.01) % 1;
      layer.circle(c.x, c.y, TILE_SIZE * (0.44 + pulse * 0.6))
        .stroke({ color: gold, width: 2.4, alpha: (1 - pulse) * 0.42 * intensity });
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
      const rng = seededRng((Math.imul(event.x | 0, 48271) ^ Math.imul(event.y | 0, 16807)) >>> 0);

      if (event.type === 'darkness-portal') {
        // A dark well with pale light swirling into it. The breathing aura is
        // drawn by updatePortalGlow on the ticker, beneath this marker.
        marker.ellipse(0, 14, 17, 6).fill({ color: 0x000000, alpha: 0.38 });
        marker.circle(0, 0, 15).fill({ color: 0x0d0812, alpha: 0.95 })
          .stroke({ color, width: 2.5, alpha: 0.95 });
        for (let i = 0; i < 3; i += 1) {
          const a = (i / 3) * Math.PI * 2;
          const r = 9.5 - i * 1.5;
          marker.moveTo(Math.cos(a) * r, Math.sin(a) * r)
            .arc(0, 0, r, a, a + Math.PI * 0.9)
            .stroke({ color, width: 1.6, alpha: 0.6 - i * 0.12 });
        }
        marker.circle(0, 0, 2.6).fill({ color: 0xd9c8ea, alpha: 0.9 });
      } else if (event.type === 'forsaken_shrine') {
        const bound = isBoundShrine(event);
        const soul = BOARD_COLORS.shrineSoul;
        drawShrineMarker(marker, soul, bound, rng);
      } else {
        return;
      }

      marker.position.set(position.x, position.y);
      layer.addChild(marker);
    });

    state.blockedTiles
      .filter((block) => getBlockedTileType(block) === 'sign')
      .forEach((sign) => {
        if (!isInBounds(sign)) return;
        const marker = new Pixi.Graphics();
        const position = tileCenter(sign);
        const rng = seededRng((Math.imul(sign.x | 0, 74131) ^ Math.imul(sign.y | 0, 31337)) >>> 0);
        drawSignMarker(marker, rng);
        marker.scale.set(0.8);
        marker.position.set(position.x, position.y);
        layer.addChild(marker);
      });
  }

  // A hand-built wooden trail sign. Uneven planks, iron nails and wood grain
  // keep it readable as a sign even when the map is zoomed out.
  function drawSignMarker(g, rng) {
    const woodDark = 0x2a160c;
    const wood = 0x754622;
    const woodLight = 0xb47a3f;
    const iron = 0x171716;

    // Ground shadow and a slightly crooked, sharpened post.
    g.ellipse(2, 23, 17, 5).fill({ color: 0x000000, alpha: 0.42 });
    g.poly([-4, -3, 4, -3, 3, 23, 0, 28, -3, 23])
      .fill({ color: woodDark, alpha: 0.98 })
      .stroke({ color: 0x110904, width: 1.5, alpha: 0.92 });
    g.poly([-2.5, -2, 0, -2, -0.5, 22, -2, 24])
      .fill({ color: woodLight, alpha: 0.36 });

    // Two mismatched boards lashed to the post, with chipped corners.
    g.poly([-25, -24, 20, -22, 25, -17, 21, -8, -23, -9, -27, -14])
      .fill({ color: wood, alpha: 0.99 })
      .stroke({ color: woodDark, width: 2, alpha: 0.98 });
    g.poly([-21, -8, 24, -7, 27, -2, 22, 6, -24, 4, -27, -1])
      .fill({ color: 0x68401f, alpha: 0.99 })
      .stroke({ color: woodDark, width: 1.8, alpha: 0.98 });

    // Grain, old blade marks and two iron nails.
    g.moveTo(-19, -18).bezierCurveTo(-8, -21, 5, -16, 17, -19)
      .stroke({ color: woodLight, width: 1, alpha: 0.38 });
    g.moveTo(-17, -3).bezierCurveTo(-5, 0, 8, -5, 19, -2)
      .stroke({ color: woodLight, width: 1, alpha: 0.3 });
    for (let i = 0; i < 3; i += 1) {
      const x = -15 + rng() * 32;
      const y = -14 + rng() * 10;
      g.moveTo(x, y).lineTo(x + 3 + rng() * 4, y + (rng() - 0.5) * 2)
        .stroke({ color: woodDark, width: 0.8, alpha: 0.55 });
    }
    g.circle(-19, -16, 1.7).fill({ color: iron, alpha: 0.95 });
    g.circle(19, -2, 1.7).fill({ color: iron, alpha: 0.95 });
    g.circle(-19.4, -16.4, 0.55).fill({ color: 0x9a8d73, alpha: 0.7 });
    g.circle(18.6, -2.4, 0.55).fill({ color: 0x9a8d73, alpha: 0.7 });

  }

  // A forsaken shrine: a cracked standing stone on a slab, its carved rune
  // spilling soul-light. The drifting smoke comes from updateShrineGlow.
  function drawShrineMarker(g, soul, bound, rng) {
    const glowAlpha = bound ? 0.9 : 0.66;

    // Ground shadow + base slab.
    g.ellipse(1, 16, 17, 6).fill({ color: 0x000000, alpha: 0.4 });
    g.poly([-14, 13, 14, 13, 11, 18, -11, 18]).fill({ color: 0x161a19, alpha: 0.96 })
      .stroke({ color: 0x070909, width: 1.4, alpha: 0.9 });

    // The standing stone, slightly asymmetric with a broken shoulder.
    g.poly([-8, 13, -9, -10, -4, -17, 3, -19, 8, -12, 9, 5, 7, 13])
      .fill({ color: 0x1d2323, alpha: 0.97 })
      .stroke({ color: 0x0a0d0d, width: 1.6, alpha: 0.9 });
    // Lit face on the left edge.
    g.poly([-7.5, 10, -8.5, -9, -4, -16, -2, -16, -3.5, 10]).fill({ color: 0x394547, alpha: 0.4 });
    // A crack running down from the broken shoulder.
    g.moveTo(3 + rng() * 2, -18).lineTo(1, -8).lineTo(3.5, 2)
      .stroke({ color: 0x0a0d0d, width: 1.1, alpha: 0.7 });

    // Carved soul rune, glowing.
    g.circle(0, -3, 8).fill({ color: soul, alpha: bound ? 0.16 : 0.09 });
    g.moveTo(0, -9).lineTo(0, 3).stroke({ color: soul, width: 1.6, alpha: glowAlpha });
    g.moveTo(-4, -6.5).lineTo(4, -6.5).stroke({ color: soul, width: 1.5, alpha: glowAlpha });
    g.moveTo(-3.5, 0).lineTo(3.5, 0).stroke({ color: soul, width: 1.3, alpha: glowAlpha * 0.8 });

    // A small soul-flame guttering at the crown.
    g.circle(0, -21, 5.5).fill({ color: soul, alpha: bound ? 0.28 : 0.16 });
    g.ellipse(0, -21, 2.4, 3.4).fill({ color: soul, alpha: glowAlpha });
    g.ellipse(0, -21.8, 1.1, 1.8).fill({ color: 0xeafcff, alpha: 0.9 });
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
      const rng = seededRng((Math.imul(encounter.x | 0, 92821) ^ Math.imul(encounter.y | 0, 68917)) >>> 0);

      const node = new Pixi.Container();
      node.position.set(center.x, center.y);

      // A grounded world node: trampled dark earth where the demon prowls, a
      // soft ground shadow, a faint rarity glow, and a single thin ring around
      // the portrait — no UI-sticker rings or runes.
      const base = new Pixi.Graphics();
      // Trampled ground: overlapping dark scuffs with a few prowl marks.
      for (let i = 0; i < 3; i += 1) {
        base.ellipse((rng() - 0.5) * 14, radius - 4 + (rng() - 0.5) * 8, radius * (0.6 + rng() * 0.3), 6 + rng() * 4)
          .fill({ color: 0x000000, alpha: 0.1 });
      }
      for (let i = 0; i < 4; i += 1) {
        const a = rng() * Math.PI;
        const dist = radius * (0.7 + rng() * 0.4);
        base.ellipse(Math.cos(a) * dist, radius - 2 + Math.sin(a) * 6, 1.6 + rng(), 1 + rng() * 0.8)
          .fill({ color: 0x000000, alpha: 0.22 });
      }
      base.ellipse(0, radius + 3, radius - 2, 5).fill({ color: 0x000000, alpha: 0.35 }); // shadow
      base.circle(0, 0, radius + 4).fill({ color: ringColor, alpha: selected ? 0.2 : 0.09 }); // glow
      if (selected) base.circle(0, 0, radius + 8).fill({ color: ringColor, alpha: 0.08 });
      base.circle(0, 0, radius + 1).fill({ color: 0x080c0e, alpha: 0.92 });
      base.circle(0, 0, radius + 2.5).stroke({ color: 0x0a0705, width: 2, alpha: 0.7 }); // dark rim seats the ring
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

  function drawBossMarkers() {
    const layer = state.bossLayer;
    const Pixi = window.PIXI;
    if (!layer || !Pixi?.Graphics) return;

    layer.removeChildren().forEach((child) => child.destroy({ children: true }));

    state.bosses.forEach((boss) => {
      const center = tileCenter(boss);
      const selected = state.selectedBoss?.id === boss.id;
      const ringColor = 0xf2c35e;
      const ember = rarityHex(boss.keyDemon?.rarity) || 0xf2c35e;
      const radius = 25;
      const rng = seededRng((Math.imul(boss.x | 0, 110351) ^ Math.imul(boss.y | 0, 73471)) >>> 0);

      const node = new Pixi.Container();
      node.position.set(center.x, center.y);

      const base = new Pixi.Graphics();
      base.ellipse(0, radius + 6, radius + 5, 7).fill({ color: 0x000000, alpha: 0.42 });
      base.circle(0, 0, radius + 11).fill({ color: ringColor, alpha: selected ? 0.18 : 0.1 });
      base.circle(0, 0, radius + 7).fill({ color: ember, alpha: selected ? 0.14 : 0.08 });
      for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * Math.PI * 2 + rng() * 0.16;
        const inner = radius + 5;
        const outer = radius + 9 + rng() * 3;
        base.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
          .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
          .stroke({ color: ringColor, width: selected ? 2 : 1.3, alpha: selected ? 0.8 : 0.52 });
      }
      base.circle(0, 0, radius + 3).fill({ color: 0x080604, alpha: 0.95 });
      base.circle(0, 0, radius + 4.5).stroke({ color: 0x0a0705, width: 2.4, alpha: 0.75 });
      base.circle(0, 0, radius + 2).stroke({ color: ringColor, width: selected ? 3 : 2, alpha: selected ? 1 : 0.78 });
      base.poly([-8, -radius - 3, 0, -radius - 11, 8, -radius - 3, 4, -radius - 1, 0, -radius - 5, -4, -radius - 1])
        .fill({ color: ringColor, alpha: 0.95 })
        .stroke({ color: 0x060302, width: 1.2, alpha: 0.8 });
      node.addChild(base);

      const texture = state.bossTextures.get(boss.keyDemon?.imageUrl);
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
        base.circle(0, 0, radius).fill({ color: ringColor, alpha: 0.22 });
      }

      layer.addChild(node);
    });
  }

  // The hunter token uses a player-only badge shape so a demon profile avatar
  // does not read as another circular demon spot on the map.
  function drawHunter() {
    const layer = state.hunterLayer;
    const frame = state.hunterFrame;
    const avatar = state.hunterAvatar;
    if (!layer || !frame) return;

    const center = tileCenter(state.hunterRenderPosition || state.position);
    const hasAvatar = Boolean(avatar && state.hunterAvatarTexture);
    const avatarRadius = 22;
    const frameRadius = 25;
    const soulAccent = 0x6fd6bd;
    const brightEdge = 0xf7fbf5;

    frame.clear();

    frame.ellipse(center.x, center.y + frameRadius + 7, frameRadius + 4, 7).fill({ color: 0x000000, alpha: 0.42 });
    frame.circle(center.x, center.y, frameRadius + 9).fill({ color: soulAccent, alpha: 0.09 });
    frame.circle(center.x, center.y, frameRadius + 6).fill({ color: BOARD_COLORS.selection, alpha: 0.08 });

    frame.poly([
      center.x - 7, center.y + frameRadius - 1,
      center.x + 7, center.y + frameRadius - 1,
      center.x, center.y + frameRadius + 13
    ])
      .fill({ color: 0x050b0e, alpha: 0.98 })
      .stroke({ color: soulAccent, width: 2.3, alpha: 0.92 });

    frame.circle(center.x, center.y, frameRadius + 3).fill({ color: 0x050b0e, alpha: 0.98 });
    frame.circle(center.x, center.y, frameRadius + 5).stroke({ color: 0x020607, width: 3.4, alpha: 0.96 });
    frame.circle(center.x, center.y, frameRadius + 2).stroke({ color: soulAccent, width: 2.8, alpha: 0.95 });
    frame.circle(center.x, center.y, frameRadius - 1).stroke({ color: BOARD_COLORS.selection, width: 1.8, alpha: 0.96 });
    frame.circle(center.x, center.y, avatarRadius + 0.5).stroke({ color: brightEdge, width: 1.1, alpha: 0.62 });

    frame.poly([
      center.x - 8, center.y - frameRadius - 5,
      center.x, center.y - frameRadius - 12,
      center.x + 8, center.y - frameRadius - 5,
      center.x + 4, center.y - frameRadius - 3,
      center.x, center.y - frameRadius - 7,
      center.x - 4, center.y - frameRadius - 3
    ])
      .fill({ color: BOARD_COLORS.selection, alpha: 0.96 })
      .stroke({ color: 0x020607, width: 1.2, alpha: 0.75 });

    if (hasAvatar) {
      avatar.texture = state.hunterAvatarTexture;
      avatar.visible = true;
      avatar.position.set(center.x, center.y);
      avatar.width = avatarRadius * 2;
      avatar.height = avatarRadius * 2;
      if (state.hunterMask) {
        state.hunterMask.clear();
        state.hunterMask.circle(center.x, center.y, avatarRadius).fill({ color: 0xffffff });
      }
    } else {
      if (avatar) avatar.visible = false;
      if (state.hunterMask) state.hunterMask.clear();
      frame.circle(center.x, center.y, 8)
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
    syncWorldSidePanel();
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
    const members = getActiveTeamMembers();

    if (!elements.worldTeamSummary) return;
    setText(document.getElementById('worldTeamHeading'), isHuntActive() ? 'Team' : 'Active Team');

    if (!members.length) {
      elements.worldTeamSummary.innerHTML = `
        <p class="world-empty-text">No active team assigned.</p>
      `;
      return;
    }

    elements.worldTeamSummary.innerHTML = renderDemonPortraitGroup(members, {
      className: 'world-team-demons',
      label: 'Active team demons'
    });
  }

  async function openWorldTeamEditor() {
    const modalElement = elements.worldTeamModal;
    const modalApi = window.bootstrap?.Modal;
    if (!modalElement || !modalApi) {
      setMessage('Hunting team editor is unavailable.', 'danger');
      return;
    }

    state.worldTeamEditor.loading = true;
    state.worldTeamEditor.loaded = false;
    setWorldTeamEditorStatus('Loading team...', 'info');
    renderWorldTeamEditor();
    modalApi.getOrCreateInstance(modalElement).show();

    try {
      const payload = await api('/api/world/team');
      const collection = normalizeWorldTeamEditorCollection(payload.collection || []);
      state.worldTeamEditor.collection = collection;
      state.worldTeamEditor.team = normalizeWorldTeamEditorTeam(payload.team || [], collection);
      state.worldTeamEditor.loaded = true;
      setWorldTeamEditorStatus('');
    } catch (error) {
      if (error.status === 401) {
        handleAuthError(error);
        return;
      }
      console.error(error);
      setWorldTeamEditorStatus(error, 'danger');
    } finally {
      state.worldTeamEditor.loading = false;
      renderWorldTeamEditor();
    }
  }

  async function saveWorldTeamEditor() {
    const editor = state.worldTeamEditor;
    if (editor.loading || editor.saving || !editor.loaded) return;

    const team = getSortedWorldTeamEditorTeam();

    editor.saving = true;
    setWorldTeamEditorStatus('');
    renderWorldTeamEditor();

    try {
      const payload = await api('/api/world/team', {
        method: 'POST',
        body: {
          team: team.map((demon) => ({
            demonId: getWorldTeamEditorDemonId(demon),
            formationSlot: normalizeWorldTeamEditorSlot(demon.formationSlot)
          }))
        }
      });

      state.activeTeam = payload.activeTeam || null;
      if (payload.hunt) {
        setHuntState(payload.hunt);
      }
      if (payload.player) {
        state.player = payload.player;
        window.AmongDemons.ui?.updateNavAccount?.(payload.player);
      }
      renderTeamSummary();
      renderEncounterPanel();
      syncHuntTicker();
      setMessage(getWorldTeamSaveMessage(payload), 'success');
      window.bootstrap?.Modal.getOrCreateInstance(elements.worldTeamModal)?.hide();
    } catch (error) {
      if (error.status === 401) {
        handleAuthError(error);
        return;
      }
      console.error(error);
      setWorldTeamEditorStatus(error, 'danger');
    } finally {
      editor.saving = false;
      renderWorldTeamEditor();
    }
  }

  function getWorldTeamSaveMessage(payload = {}) {
    const reset = payload.huntingReset || {};
    if (!payload.teamChanged) return 'Hunting team updated.';

    if (reset.stoppedHunt) {
      const rewards = payload.rewards || {};
      return `Hunting team updated. Active hunt ended. ${formatHuntRewardSummary(rewards)} Hunting spots reset.`;
    }

    return 'Hunting team updated. Hunting spots reset.';
  }

  function renderWorldTeamEditor() {
    const editor = state.worldTeamEditor;
    const team = getSortedWorldTeamEditorTeam();

    renderWorldTeamEditorStatus();
    setText(elements.worldTeamEditorCount, `${team.length}/${WORLD_TEAM_LIMIT}`);

    if (elements.worldTeamSaveButton) {
      elements.worldTeamSaveButton.disabled = editor.loading || editor.saving || !editor.loaded;
      elements.worldTeamSaveButton.classList.toggle('is-busy', editor.saving);
      elements.worldTeamSaveButton.setAttribute('aria-busy', editor.saving ? 'true' : 'false');
      elements.worldTeamSaveButton.setAttribute('aria-label', editor.saving ? 'Saving team' : 'Save team');
      elements.worldTeamSaveButton.innerHTML = editor.saving
        ? '<span class="dungeon-action-spinner" aria-hidden="true"></span><span>Saving</span>'
        : `${renderIcon('save')}<span>Save</span>`;
    }

    if (elements.worldTeamEditorGrid) {
      elements.worldTeamEditorGrid.innerHTML = renderWorldTeamEditorFormation(team);
    }

    if (elements.worldTeamEditorCollection) {
      elements.worldTeamEditorCollection.classList.add('world-team-drop-target');
      elements.worldTeamEditorCollection.dataset.worldTeamDropZone = 'collection';
      elements.worldTeamEditorCollection.innerHTML = renderWorldTeamEditorCollection();
    }

    replaceStaticIcons();
    updateWorldTeamEditorCollectionScroll();
  }

  function scrollWorldTeamEditorCollection(direction) {
    const grid = elements.worldTeamEditorCollection;
    if (!grid) return;
    grid.scrollBy({ left: direction * Math.max(grid.clientWidth * 0.8, 120), behavior: 'smooth' });
  }

  function updateWorldTeamEditorCollectionScroll() {
    const grid = elements.worldTeamEditorCollection;
    if (!grid) return;

    const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
    grid.parentElement?.classList.toggle('is-scrollable', maxScroll > 4);
    if (elements.worldTeamCollectionPrev) elements.worldTeamCollectionPrev.disabled = grid.scrollLeft <= 2;
    if (elements.worldTeamCollectionNext) elements.worldTeamCollectionNext.disabled = grid.scrollLeft >= maxScroll - 2;
  }

  function renderWorldTeamEditorStatus() {
    const status = elements.worldTeamEditorStatus;
    if (!status) return;

    const text = state.worldTeamEditor.status || '';
    if (!text) {
      status.innerHTML = '';
      status.className = 'world-team-editor-status d-none';
      return;
    }

    window.AmongDemons.setGameAlert(status, text, {
      type: state.worldTeamEditor.statusType || 'info',
      inline: true,
      className: 'world-team-editor-status'
    });
  }

  function setWorldTeamEditorStatus(text, type = 'info') {
    state.worldTeamEditor.status = text || '';
    state.worldTeamEditor.statusType = type || 'info';
    renderWorldTeamEditorStatus();
  }

  function renderWorldTeamEditorFormation(team = []) {
    const assignments = new Map(team.map((demon) => [normalizeWorldTeamEditorSlot(demon.formationSlot), demon]));

    return `
      <div class="battle-formation battle-formation-grid battle-formation-player" role="list" aria-label="Hunting team formation">
        ${Array.from({ length: FORMATION_GRID_SIZE }, (item, slot) => renderWorldTeamEditorSlot(assignments.get(slot), slot)).join('')}
      </div>
    `;
  }

  function renderWorldTeamEditorSlot(demon, slot) {
    const position = getWorldTeamEditorSlotPosition(slot);
    const classes = [
      'formation-slot',
      `formation-slot-${position}`,
      demon ? 'has-demon' : 'is-empty'
    ].join(' ');

    return `
      <div class="${classes}" data-formation-slot="${slot}" role="listitem" aria-label="${escapeAttribute(`Hunting team slot ${slot + 1}`)}">
        <div class="formation-slot-cards world-team-drop-target" data-world-team-drop-zone="team" data-world-team-slot="${slot}">
          ${demon ? renderWorldTeamEditorDemonCard(demon, 'team', slot) : renderWorldTeamEditorEmptySlot(position, slot + 1)}
        </div>
      </div>
    `;
  }

  function renderWorldTeamEditorEmptySlot(position, slotNumber) {
    return `
      <div class="formation-empty formation-empty-${position}" aria-hidden="true" data-slot-number="${slotNumber}">
        <img class="formation-slot-placeholder-img" src="/app/images/assets/amongdemons_team_slot_placeholder.png" alt="" width="1024" height="1024" loading="lazy" decoding="async" draggable="false">
      </div>
    `;
  }

  function renderWorldTeamEditorCollection() {
    const editor = state.worldTeamEditor;
    if (editor.loading) return '<p class="world-empty-text">Gathering bound demons...</p>';

    const extractCard = renderWorldTeamExtractCard();
    if (!editor.collection.length) {
      return `<p class="world-empty-text">No bound demons available. Extract one from the dungeon first.</p>${extractCard}`;
    }

    // The extract shortcut sits at the end of the collected demons.
    return `${editor.collection.map((demon) => renderWorldTeamEditorDemonCard(demon, 'collection')).join('')}${extractCard}`;
  }

  function renderWorldTeamExtractCard() {
    return `
      <a class="world-team-extract-card" href="${appUrl('/dungeon')}" data-world-team-extract aria-label="Extract from Dungeon" title="Extract more demons from the dungeon">
        <span class="world-team-extract-icon" aria-hidden="true">${renderIcon('swords')}</span>
        <span class="world-team-extract-label">Extract from Dungeon</span>
      </a>
    `;
  }

  function renderWorldTeamEditorDemonCard(demon, zone, slot = null) {
    const demonId = getWorldTeamEditorDemonId(demon);
    const teamEntry = getWorldTeamEditorTeamEntry(demonId);
    const isCollection = zone === 'collection';
    const isInTeam = Boolean(teamEntry);
    const displayDemon = normalizeWorldTeamEditorCardDemon(
      isCollection ? { ...demon, ...(teamEntry ? { formationSlot: teamEntry.formationSlot } : {}) } : demon,
      zone,
      slot
    );
    const classes = [
      'world-team-editor-card',
      'world-team-drop-target',
      isCollection ? 'world-team-editor-collection-card' : 'world-team-editor-team-card',
      isCollection && isInTeam ? 'is-in-team' : ''
    ].filter(Boolean).join(' ');
    const overlayHtml = isCollection && isInTeam
      ? `<span class="world-team-editor-in-team-mark" title="In team" aria-label="In team">${renderIcon('check')}</span>`
      : '';

    return renderDemonCard(displayDemon, {
      className: classes,
      overlayHtml,
      attributes: {
        'data-world-team-demon-id': demonId,
        'data-world-team-drop-zone': zone,
        'data-world-team-source-zone': zone,
        'data-world-team-slot': Number.isInteger(slot) ? slot : null,
        'data-world-team-in-team': isInTeam ? 'true' : null,
        role: 'button',
        tabindex: '0'
      }
    });
  }

  function normalizeWorldTeamEditorCollection(collection = []) {
    return (Array.isArray(collection) ? collection : [])
      .map((demon) => {
        const demonId = Number(demon?.id ?? demon?.collectionDemonId);
        if (!Number.isInteger(demonId) || demonId <= 0) return null;
        return normalizeWorldTeamEditorCardDemon({
          ...demon,
          id: demonId,
          collectionDemonId: demonId
        }, 'collection');
      })
      .filter(Boolean)
      .sort(compareWorldTeamEditorCollectionDemons);
  }

  function compareWorldTeamEditorCollectionDemons(a, b) {
    return getWorldTeamEditorRarityRank(a?.rarity) - getWorldTeamEditorRarityRank(b?.rarity)
      || getWorldTeamEditorCreatedTime(b) - getWorldTeamEditorCreatedTime(a)
      || getWorldTeamEditorDemonId(b) - getWorldTeamEditorDemonId(a)
      || String(a?.species || '').localeCompare(String(b?.species || ''));
  }

  function getWorldTeamEditorRarityRank(rarity) {
    return RARITY_SORT_RANK[String(rarity || 'common').toLowerCase()] ?? 99;
  }

  function getWorldTeamEditorCreatedTime(demon = {}) {
    const time = Date.parse(demon.createdAt || demon.created_at || '');
    return Number.isFinite(time) ? time : 0;
  }

  function normalizeWorldTeamEditorTeam(team = [], collection = []) {
    const collectionById = new Map(collection.map((demon) => [getWorldTeamEditorDemonId(demon), demon]));
    const usedDemons = new Set();
    const usedSlots = new Set();

    return (Array.isArray(team) ? team : [])
      .map((demon, index) => {
        const demonId = Number(demon?.collectionDemonId ?? demon?.id);
        if (!Number.isInteger(demonId) || demonId <= 0 || usedDemons.has(demonId)) return null;
        const requestedSlot = normalizeWorldTeamEditorSlot(demon.formationSlot ?? demon.formationRow);
        const slot = requestedSlot !== null && !usedSlots.has(requestedSlot)
          ? requestedSlot
          : getNextWorldTeamEditorOpenSlot(usedSlots, index);
        if (slot === null) return null;

        usedDemons.add(demonId);
        usedSlots.add(slot);

        return createWorldTeamEditorTeamEntry(collectionById.get(demonId) || demon, slot);
      })
      .filter(Boolean)
      .sort(compareWorldTeamEditorSlots);
  }

  function normalizeWorldTeamEditorCardDemon(demon = {}, zone = 'collection', slot = null) {
    const demonId = getWorldTeamEditorDemonId(demon);
    const maxHp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
    const currentHp = Math.max(0, Math.min(maxHp, Number(demon.hp) || maxHp));
    const formationSlot = normalizeWorldTeamEditorSlot(slot ?? demon.formationSlot ?? demon.formationRow);

    return {
      ...demon,
      id: demonId,
      collectionDemonId: demonId,
      instanceId: `world-team-editor-${zone}-${demonId}`,
      maxHp,
      hp: currentHp,
      formationSlot,
      formationRow: formationSlot,
      position: formationSlot === null ? normalizeWorldTeamEditorPosition(demon.preferredPosition || demon.position) : getWorldTeamEditorSlotPosition(formationSlot)
    };
  }

  function createWorldTeamEditorTeamEntry(demon, slot) {
    const normalizedSlot = normalizeWorldTeamEditorSlot(slot);
    return normalizeWorldTeamEditorCardDemon(demon, 'team', normalizedSlot === null ? 0 : normalizedSlot);
  }

  function onWorldTeamEditorPointerDown(event) {
    if (!elements.worldTeamModal?.classList.contains('show')) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (state.worldTeamEditor.loading || state.worldTeamEditor.saving) return;

    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const card = target?.closest('.world-team-editor-card[data-world-team-demon-id]');
    if (!card || !elements.worldTeamModal.contains(card)) return;

    const demonId = Number(card.dataset.worldTeamDemonId);
    if (!Number.isInteger(demonId) || demonId <= 0) return;

    const drag = {
      card,
      demonId,
      pointerId: event.pointerId,
      sourceZone: card.dataset.worldTeamSourceZone === 'team' ? 'team' : 'collection',
      sourceSlot: normalizeWorldTeamEditorSlot(card.dataset.worldTeamSlot),
      startX: event.clientX,
      startY: event.clientY,
      currentTarget: null,
      ghost: null,
      active: false,
      onMove: null,
      onUp: null,
      onCancel: null
    };

    drag.onMove = (moveEvent) => moveWorldTeamEditorDrag(moveEvent);
    drag.onUp = (upEvent) => finishWorldTeamEditorDrag(upEvent);
    drag.onCancel = (cancelEvent) => cancelWorldTeamEditorDrag(cancelEvent);
    state.worldTeamEditor.drag = drag;

    document.addEventListener('pointermove', drag.onMove, { passive: false });
    document.addEventListener('pointerup', drag.onUp);
    document.addEventListener('pointercancel', drag.onCancel);
  }

  function moveWorldTeamEditorDrag(event) {
    const drag = state.worldTeamEditor.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active && Math.hypot(dx, dy) < 8) return;
    if (!drag.active) activateWorldTeamEditorDrag(drag, event.clientX, event.clientY);

    if (event.cancelable) event.preventDefault();
    positionWorldTeamEditorDragGhost(drag, event.clientX, event.clientY);
    setWorldTeamEditorDropTarget(drag, getWorldTeamEditorDropTarget(event.clientX, event.clientY, drag));
  }

  function activateWorldTeamEditorDrag(drag, clientX, clientY) {
    drag.active = true;
    drag.card.classList.add('is-dragging');
    document.body.classList.add('is-world-team-dragging');
    drag.ghost = document.createElement('div');
    drag.ghost.className = 'pointer-drag-ghost world-team-drag-ghost';
    drag.ghost.innerHTML = drag.card.outerHTML;
    document.body.appendChild(drag.ghost);
    positionWorldTeamEditorDragGhost(drag, clientX, clientY);
  }

  function finishWorldTeamEditorDrag(event) {
    const drag = state.worldTeamEditor.drag;
    if (!drag || event.pointerId !== drag.pointerId) return;

    if (drag.active) {
      if (event.cancelable) event.preventDefault();
      const target = getWorldTeamEditorDropTarget(event.clientX, event.clientY, drag);
      if (target) {
        applyWorldTeamEditorDrop(drag, target);
      }
      state.worldTeamEditor.suppressClickUntil = Date.now() + 250;
    }

    cleanupWorldTeamEditorDrag();
  }

  function cancelWorldTeamEditorDrag(event = null) {
    const drag = state.worldTeamEditor.drag;
    if (event && drag && event.pointerId !== drag.pointerId) return;
    cleanupWorldTeamEditorDrag();
  }

  function cleanupWorldTeamEditorDrag() {
    const drag = state.worldTeamEditor.drag;
    if (!drag) return;

    document.removeEventListener('pointermove', drag.onMove);
    document.removeEventListener('pointerup', drag.onUp);
    document.removeEventListener('pointercancel', drag.onCancel);
    drag.card?.classList.remove('is-dragging');
    drag.ghost?.remove();
    drag.currentTarget?.classList.remove('is-drag-over');
    document.body.classList.remove('is-world-team-dragging');
    state.worldTeamEditor.drag = null;
  }

  function positionWorldTeamEditorDragGhost(drag, clientX, clientY) {
    if (!drag?.ghost) return;
    drag.ghost.style.left = `${Math.round(clientX)}px`;
    drag.ghost.style.top = `${Math.round(clientY)}px`;
  }

  function getWorldTeamEditorDropTarget(clientX, clientY, drag) {
    const element = document.elementFromPoint(clientX, clientY);
    const target = element?.closest?.('.world-team-drop-target');
    if (!target || !elements.worldTeamModal?.contains(target)) return null;
    return canDropWorldTeamEditorDragOnTarget(drag, target) ? target : null;
  }

  function setWorldTeamEditorDropTarget(drag, target) {
    if (drag.currentTarget === target) return;
    drag.currentTarget?.classList.remove('is-drag-over');
    drag.currentTarget = target;
    drag.currentTarget?.classList.add('is-drag-over');
  }

  function canDropWorldTeamEditorDragOnTarget(drag, target) {
    if (!drag || !target) return false;
    const zone = target.dataset.worldTeamDropZone;
    if (zone === 'team') {
      const slot = normalizeWorldTeamEditorSlot(target.dataset.worldTeamSlot);
      return slot !== null;
    }
    if (zone === 'collection') {
      return Boolean(getWorldTeamEditorTeamEntry(drag.demonId));
    }
    return false;
  }

  function applyWorldTeamEditorDrop(drag, target) {
    const zone = target.dataset.worldTeamDropZone;
    if (zone === 'team') {
      const slot = normalizeWorldTeamEditorSlot(target.dataset.worldTeamSlot);
      if (slot !== null) moveWorldTeamEditorDemonToSlot(drag.demonId, slot);
    } else if (zone === 'collection') {
      removeWorldTeamEditorDemonFromTeam(drag.demonId);
    }

    renderWorldTeamEditor();
  }

  function moveWorldTeamEditorDemonToSlot(demonId, targetSlot) {
    const editor = state.worldTeamEditor;
    const sourceEntry = getWorldTeamEditorTeamEntry(demonId);
    const targetEntry = editor.team.find((demon) => normalizeWorldTeamEditorSlot(demon.formationSlot) === targetSlot) || null;
    const sourceDemon = sourceEntry || getWorldTeamEditorCollectionDemon(demonId);
    if (!sourceDemon) return;
    if (!sourceEntry && !targetEntry && editor.team.length >= WORLD_TEAM_LIMIT) {
      return;
    }

    const sourceSlot = normalizeWorldTeamEditorSlot(sourceEntry?.formationSlot);
    const nextTeam = editor.team.filter((demon) => {
      const id = getWorldTeamEditorDemonId(demon);
      const slot = normalizeWorldTeamEditorSlot(demon.formationSlot);
      return id !== demonId && slot !== targetSlot;
    });

    if (sourceEntry && targetEntry && getWorldTeamEditorDemonId(targetEntry) !== demonId && sourceSlot !== null) {
      nextTeam.push(createWorldTeamEditorTeamEntry(targetEntry, sourceSlot));
    }

    nextTeam.push(createWorldTeamEditorTeamEntry(sourceDemon, targetSlot));
    editor.team = nextTeam.sort(compareWorldTeamEditorSlots);
  }

  function removeWorldTeamEditorDemonFromTeam(demonId) {
    state.worldTeamEditor.team = state.worldTeamEditor.team
      .filter((demon) => getWorldTeamEditorDemonId(demon) !== Number(demonId))
      .sort(compareWorldTeamEditorSlots);
  }

  function onWorldTeamEditorCardClick(event) {
    if (Date.now() < state.worldTeamEditor.suppressClickUntil) {
      event.preventDefault();
      return;
    }

    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const card = target?.closest('.world-team-editor-card[data-world-team-demon-id]');
    if (!card || !elements.worldTeamModal?.contains(card)) return;

    openWorldTeamEditorCardDetails(card);
  }

  function onWorldTeamEditorCardKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const card = target?.closest('.world-team-editor-card[data-world-team-demon-id]');
    if (!card || !elements.worldTeamModal?.contains(card)) return;

    event.preventDefault();
    openWorldTeamEditorCardDetails(card);
  }

  function openWorldTeamEditorCardDetails(card) {
    const demonId = Number(card.dataset.worldTeamDemonId);
    const demon = getWorldTeamEditorTeamEntry(demonId) || getWorldTeamEditorCollectionDemon(demonId);
    if (demon) openDemonDetailsModal(demon);
  }

  function getWorldTeamEditorCollectionDemon(demonId) {
    const id = Number(demonId);
    return state.worldTeamEditor.collection.find((demon) => getWorldTeamEditorDemonId(demon) === id) || null;
  }

  function getWorldTeamEditorTeamEntry(demonId) {
    const id = Number(demonId);
    return state.worldTeamEditor.team.find((demon) => getWorldTeamEditorDemonId(demon) === id) || null;
  }

  function getSortedWorldTeamEditorTeam() {
    return [...(state.worldTeamEditor.team || [])].sort(compareWorldTeamEditorSlots);
  }

  function compareWorldTeamEditorSlots(a, b) {
    return (normalizeWorldTeamEditorSlot(a?.formationSlot) ?? FORMATION_GRID_SIZE)
      - (normalizeWorldTeamEditorSlot(b?.formationSlot) ?? FORMATION_GRID_SIZE)
      || getWorldTeamEditorDemonId(a) - getWorldTeamEditorDemonId(b);
  }

  function getNextWorldTeamEditorOpenSlot(usedSlots, fallbackIndex = 0) {
    const preferred = normalizeWorldTeamEditorSlot(fallbackIndex);
    if (preferred !== null && !usedSlots.has(preferred)) return preferred;
    for (let slot = 0; slot < FORMATION_GRID_SIZE; slot += 1) {
      if (!usedSlots.has(slot)) return slot;
    }
    return null;
  }

  function getWorldTeamEditorDemonId(demon = {}) {
    return Number(demon.collectionDemonId ?? demon.id ?? demon.demonId) || 0;
  }

  function getWorldTeamEditorSlotPosition(slot) {
    const normalizedSlot = normalizeWorldTeamEditorSlot(slot);
    const column = (normalizedSlot === null ? 0 : normalizedSlot) % FORMATION_GRID_COLUMNS;
    return column === FORMATION_GRID_COLUMNS - 1 ? 'front' : 'back';
  }

  function normalizeWorldTeamEditorSlot(slot) {
    const number = Number(slot);
    if (!Number.isInteger(number) || number < 0 || number >= FORMATION_GRID_SIZE) return null;
    return number;
  }

  function normalizeWorldTeamEditorPosition(position) {
    return position === 'back' ? 'back' : 'front';
  }

  // Static SVG twin of drawShrineMarker (the Pixi board marker): the same
  // cracked standing stone, slab, soul rune and crown flame — minus the smoke.
  function renderShrineMarkSvg(bound) {
    const soul = '#8de7ff';
    const glowAlpha = bound ? 0.9 : 0.66;

    return `
      <svg class="world-shrine-mark" viewBox="-17 -28 34 51" aria-hidden="true" focusable="false">
        <ellipse cx="1" cy="16" rx="17" ry="6" fill="#000000" opacity="0.4"></ellipse>
        <polygon points="-14,13 14,13 11,18 -11,18" fill="#161a19" fill-opacity="0.96" stroke="#070909" stroke-width="1.4" stroke-opacity="0.9"></polygon>
        <polygon points="-8,13 -9,-10 -4,-17 3,-19 8,-12 9,5 7,13" fill="#1d2323" fill-opacity="0.97" stroke="#0a0d0d" stroke-width="1.6" stroke-opacity="0.9"></polygon>
        <polygon points="-7.5,10 -8.5,-9 -4,-16 -2,-16 -3.5,10" fill="#394547" fill-opacity="0.4"></polygon>
        <path d="M4 -18 L1 -8 L3.5 2" fill="none" stroke="#0a0d0d" stroke-width="1.1" stroke-opacity="0.7"></path>
        <circle cx="0" cy="-3" r="8" fill="${soul}" fill-opacity="${bound ? 0.16 : 0.09}"></circle>
        <line x1="0" y1="-9" x2="0" y2="3" stroke="${soul}" stroke-width="1.6" stroke-opacity="${glowAlpha}"></line>
        <line x1="-4" y1="-6.5" x2="4" y2="-6.5" stroke="${soul}" stroke-width="1.5" stroke-opacity="${glowAlpha}"></line>
        <line x1="-3.5" y1="0" x2="3.5" y2="0" stroke="${soul}" stroke-width="1.3" stroke-opacity="${glowAlpha * 0.8}"></line>
        <circle cx="0" cy="-21" r="5.5" fill="${soul}" fill-opacity="${bound ? 0.28 : 0.16}"></circle>
        <ellipse cx="0" cy="-21" rx="2.4" ry="3.4" fill="${soul}" fill-opacity="${glowAlpha}"></ellipse>
        <ellipse cx="0" cy="-21.8" rx="1.1" ry="1.8" fill="#eafcff" fill-opacity="0.9"></ellipse>
      </svg>
    `;
  }

  function renderShrinePanel() {
    if (!elements.worldShrinePanel) return;

    const boundShrine = state.boundShrine;
    const parts = [];

    if (boundShrine) {
      parts.push(`
        <article class="world-shrine-status is-bound">
          ${renderShrineMarkSvg(true)}
          <span class="world-shrine-copy">
            <strong>${escapeHtml(boundShrine.title || 'Forsaken Shrine')}</strong>
            <span class="world-shrine-label">Respawn Point</span>
          </span>
          <span class="world-shrine-area">Area ${escapeHtml(formatCoords(boundShrine))}</span>
        </article>
      `);
    } else {
      parts.push(`
        <article class="world-shrine-status">
          ${renderShrineMarkSvg(false)}
          <span class="world-shrine-copy">
            <strong>Default Spawn</strong>
            <span class="world-shrine-label">Respawn Point</span>
          </span>
          <span class="world-shrine-area">Area ${escapeHtml(formatCoords({ x: 0, y: 0 }))}</span>
        </article>
      `);
    }

    elements.worldShrinePanel.innerHTML = parts.join('');
  }

  function renderEncounterPanel() {
    if (!elements.worldEncounterList) return;
    setText(elements.worldEncounterHeading, `World activity at Area ${formatCoords(state.position)}`);

    const players = (state.playersAt || []).filter(hasPvpTeamAssigned);
    const encounter = state.moving ? null : state.currentEncounter;
    const boss = state.moving ? null : state.currentBoss;
    const currentShrine = state.moving ? null : getShrineAt(state.position);
    const currentSign = state.moving ? null : getSignAt(state.position);
    const pveParts = renderPveSidebarParts({ encounter, boss, currentShrine, currentSign });
    const pvpParts = players.map(renderPvpPlayerCard);

    const activeTab = state.worldEncounterTab === 'pvp' ? 'pvp' : 'pve';
    const activeParts = activeTab === 'pvp' ? pvpParts : pveParts;
    const emptyText = activeTab === 'pvp' ? 'No hunters on this tile.' : 'No PvE activity on this tile.';

    elements.worldEncounterList.innerHTML = `
      ${renderEncounterTabs({
        activeTab,
        pveCount: pveParts.length,
        pvpCount: pvpParts.length
      })}
      <div class="world-encounter-tab-panel" role="tabpanel">
        ${activeParts.length ? activeParts.join('') : `<p class="world-empty-text">${emptyText}</p>`}
      </div>
    `;
    queueWorldSidePanelMeasure();
  }

  function renderPveSidebarParts({ encounter, boss, currentShrine, currentSign }) {
    if (state.moving || state.travelStatus === 'moving') {
      return [renderTravelStatusCard()];
    }

    if (isHuntActive()) {
      return [renderActiveHuntSummary()];
    }

    return [
      currentSign ? renderCurrentSign(currentSign) : '',
      currentShrine ? renderShrineAnchorAction(currentShrine) : '',
      boss ? renderCurrentBoss(boss) : '',
      encounter ? renderCurrentEncounter(encounter) : ''
    ].filter(Boolean);
  }

  function renderEncounterTabs({ activeTab, pveCount, pvpCount }) {
    return `
      <div class="world-encounter-tabs" role="tablist" aria-label="Area encounters">
        ${renderEncounterTabButton('pve', 'PvE', pveCount, activeTab)}
        ${renderEncounterTabButton('pvp', 'PvP', pvpCount, activeTab)}
      </div>
    `;
  }

  function renderEncounterTabButton(tab, label, count, activeTab) {
    const active = tab === activeTab;
    return `
      <button class="world-encounter-tab ${active ? 'is-active' : ''}" type="button" role="tab" aria-selected="${active}" data-world-encounter-tab="${tab}">
        <span>${label}</span>
        <strong>${formatNumber(count)}</strong>
      </button>
    `;
  }

  function renderShrineAnchorAction(currentShrine) {
    const isCurrentAnchor = state.boundShrine && positionsEqual(currentShrine, state.boundShrine);
    const description = currentShrine.description || (isCurrentAnchor
      ? 'Your respawn point.'
      : 'Anchor your soul to this place.');
    const action = isCurrentAnchor
      ? ''
      : `
        <button class="btn btn-warning btn-sm world-card-action" type="button" data-anchor-soul ${state.bindingShrine ? 'disabled' : ''}>
          ${renderIcon('hand-heart')}
          <span>Pray</span>
        </button>
      `;

    return `
      <article class="world-sidebar-card world-shrine-card">
        <span class="world-card-copy">
          <strong class="world-card-title">${escapeHtml(currentShrine.title || 'Forsaken Shrine')}</strong>
          <small class="world-card-meta">${escapeHtml(description)}</small>
        </span>
        ${action}
      </article>
    `;
  }

  function renderCurrentSign(sign) {
    return `
      <article class="world-sidebar-card world-sign-card">
        <span class="world-card-copy">
          <span class="world-card-kicker">Trail Sign</span>
          <span class="world-card-meta world-sign-message">${escapeHtml(getSignMessage(sign))}</span>
        </span>
      </article>
    `;
  }

  function renderCurrentEncounter(encounter) {
    const unlocked = isEncounterUnlocked(encounter.id);
    const terror = getEncounterTerror(encounter);
    const enemyDemons = renderDemonPortraitGroup(encounter.team, {
      className: 'world-enemy-demons',
      label: 'Enemy demons'
    });
    const action = unlocked
      ? `<button class="btn btn-warning btn-sm world-card-action ${state.huntBusyAction === 'start' ? 'is-busy' : ''}" type="button" data-start-hunting="${escapeAttribute(encounter.id)}" ${state.huntBusy ? 'disabled aria-busy="true"' : ''}>${state.huntBusyAction === 'start' ? 'Starting…' : 'Hunt'}</button>`
      : `<button class="btn btn-warning btn-sm world-card-action ${state.huntBusyAction === 'fight' ? 'is-busy' : ''}" type="button" data-try-hunt="${escapeAttribute(encounter.id)}" ${state.huntBusy ? 'disabled aria-busy="true"' : ''}>${state.huntBusyAction === 'fight' ? 'Fighting…' : 'Fight'}</button>`;

    return `
      <article class="world-sidebar-card world-spot-card">
        <span class="world-card-copy">
          ${renderEncounterTitle(encounter)}
          ${renderWorldCardMeta([
            renderWorldTerrorChip(terror, { inline: true }),
            `Threat ${formatNumber(encounter.difficulty || 1)}`
          ])}
          ${enemyDemons}
        </span>
        ${action}
      </article>
    `;
  }

  function renderCurrentBoss(boss) {
    const enemyDemons = renderDemonPortraitGroup(boss.team, {
      className: 'world-boss-demons',
      label: 'Boss demons'
    });
    const enemyBuffSummary = renderBossEnemyBuffSummary(boss.enemyBuffs, { inline: true });

    return `
      <article class="world-sidebar-card world-boss-card">
        <span class="world-card-copy">
          <span class="world-card-kicker">Boss Fight</span>
          ${renderBossTitle(boss)}
          ${renderWorldCardMeta([
            enemyBuffSummary,
            `Threat ${formatNumber(boss.difficulty || 1)}`,
            formatBossMoveMeta(boss)
          ])}
          ${enemyDemons}
          ${renderBossRewardLine(boss.rewardBuff)}
        </span>
        <button class="btn btn-warning btn-sm world-card-action" type="button" data-challenge-boss="${escapeAttribute(boss.id)}" ${state.bossBusy ? 'disabled' : ''}>
          Challenge
        </button>
      </article>
    `;
  }

  function renderBossEnemyBuffSummary(enemyBuffs = [], options = {}) {
    const buffs = (Array.isArray(enemyBuffs) ? enemyBuffs : []).filter(Boolean);
    if (!buffs.length) return '';
    const inlineClass = options.inline ? ' is-inline' : '';

    return `
      <span class="world-boss-buffs${inlineClass}" aria-label="Boss buffs">
        ${buffs.slice(0, 2).map((buff) => `
          <span class="world-boss-buff" tabindex="0" data-tooltip="${formatTooltipAttribute(getBossEnemyBuffTooltip(buff))}" aria-label="${formatTooltipAttribute(getBossEnemyBuffTooltip(buff))}">
            ${renderIcon(buff.icon || 'sparkles')}
            <span>${escapeHtml(buff.name || formatWorldBattleLabel(buff.id))}</span>
          </span>
        `).join('')}
        ${buffs.length > 2 ? `<span class="world-boss-buff" tabindex="0" data-tooltip="${formatTooltipAttribute(getBossEnemyBuffOverflowTooltip(buffs.slice(2)))}" aria-label="${formatTooltipAttribute(getBossEnemyBuffOverflowTooltip(buffs.slice(2)))}">+${formatNumber(buffs.length - 2)}</span>` : ''}
      </span>
    `;
  }

  function getBossEnemyBuffTooltip(buff = {}) {
    const name = buff.name || formatWorldBattleLabel(buff.id) || 'Boss Buff';
    return [
      name,
      buff.description || ''
    ].filter(Boolean).join('\n');
  }

  function getBossEnemyBuffOverflowTooltip(buffs = []) {
    const rows = (Array.isArray(buffs) ? buffs : [])
      .map((buff) => [
        buff.name || formatWorldBattleLabel(buff.id) || 'Boss Buff',
        buff.description || ''
      ].filter(Boolean).join(': '))
      .filter(Boolean);

    return ['More boss enemy buffs', ...rows].join('\n');
  }

  function renderBossRewardLine(buff, options = {}) {
    if (!buff) return '';
    const label = options.compact ? 'Victory reward' : 'Battle buff';
    const duration = formatBossBuffDuration(buff);
    const description = buff.description || '';

    return `
      <span class="world-boss-reward" title="${escapeAttribute(description || buff.name || '')}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(buff.name || formatWorldBattleLabel(buff.id))}</strong>
        <small>${escapeHtml([description, duration].filter(Boolean).join(' · '))}</small>
      </span>
    `;
  }

  function renderBossTitle(boss, extraClass = '') {
    const classes = ['world-encounter-title', 'world-boss-title', extraClass].filter(Boolean).join(' ');
    return `
      <strong class="${classes}">
        <span class="world-encounter-rarity" style="--rarity-color:#f2c35e">Boss</span>
        <span class="world-encounter-name">${escapeHtml(boss?.title || 'World Boss')}</span>
      </strong>
    `;
  }

  function renderActiveHuntSummary() {
    const encounter = getActiveHuntEncounter();
    const progress = computeHuntProgress();
    const rate = computeHuntRate(encounter);
    const terror = rate.terror || getEncounterTerror(encounter);
    const huntingDemons = renderDemonPortraitGroup(encounter?.team, {
      max: 5,
      className: 'world-hunt-target-demons',
      label: 'Hunting demons'
    });

    return `
      <article class="world-sidebar-card world-active-hunt-card">
        <span class="world-card-copy">
          ${renderEncounterTitleLink(encounter, 'world-card-title')}
          ${renderWorldCardMeta([
            renderWorldTerrorChip(terror, { inline: true }),
            `Threat ${formatNumber(rate.difficulty)}`
          ])}
        </span>
        ${huntingDemons || '<p class="world-empty-text">No hunted demons visible.</p>'}
        ${renderHuntProgress(progress, rate)}
        ${renderHuntRewardLines(rate, progress)}
        <button class="btn btn-outline-light btn-sm world-card-action world-end-hunt-action ${state.huntBusyAction === 'end' ? 'is-busy' : ''}" type="button" data-stop-hunting ${state.huntBusy ? 'disabled aria-busy="true"' : ''}>${state.huntBusyAction === 'end' ? 'Ending…' : 'End Hunt'}</button>
      </article>
    `;
  }

  function renderPvpPlayerCard(player) {
    const cooldownUntil = state.challengeCooldowns.get(player.id) || 0;
    const isCoolingDown = cooldownUntil > Date.now();
    const label = isCoolingDown ? 'Cooldown' : 'Challenge';
    const pvpWins = Math.max(0, Number(player.pvpWins) || 0);
    const pvpLosses = Math.max(0, Number(player.pvpLosses) || 0);
    const username = player.username || 'Unknown Hunter';
    const hunterHref = getHunterProfileHref(player);
    const hunterName = hunterHref
      ? `<a class="world-hunter-profile-link" href="${escapeAttribute(hunterHref)}">${escapeHtml(username)}</a>`
      : escapeHtml(username);
    const scoutAction = hunterHref
      ? `
        <a class="btn btn-outline-light btn-sm world-scout-action" href="${escapeAttribute(hunterHref)}" title="Scout ${escapeAttribute(username)}" aria-label="Scout ${escapeAttribute(username)}">
          ${renderIcon('search', { size: 15 })}
        </a>
      `
      : '';

    return `
      <article class="world-sidebar-card world-pvp-card">
        <span class="world-card-copy">
          <strong class="world-card-title">${hunterName}</strong>
          <small class="world-card-meta">Level ${formatNumber(player.level || 1)} \u00b7 ${formatNumber(pvpWins)}-${formatNumber(pvpLosses)}</small>
        </span>
        <span class="world-pvp-actions">
          ${scoutAction}
          <button class="btn btn-warning btn-sm world-card-action" type="button" data-challenge-player="${escapeAttribute(player.id)}" ${isCoolingDown ? 'disabled' : ''}>${label}</button>
        </span>
      </article>
    `;
  }

  function getHunterProfileHref(player = {}) {
    const username = String(player.username || '').trim();
    return username ? appUrl(`/hunter/${encodeURIComponent(username)}`) : '';
  }

  function applyPvpChallengeRecords(payload = {}) {
    if (payload.player) {
      state.player = {
        ...(state.player || {}),
        ...payload.player
      };
      window.AmongDemons.ui?.updateNavAccount?.(payload.player);
    }

    const targetPlayer = payload.targetPlayer || payload.battle?.targetPlayer;
    if (!targetPlayer?.id) return;

    state.playersAt = (state.playersAt || []).map((player) => (
      String(player.id) === String(targetPlayer.id)
        ? {
          ...player,
          pvpWins: Math.max(0, Number(targetPlayer.pvpWins) || 0),
          pvpLosses: Math.max(0, Number(targetPlayer.pvpLosses) || 0)
        }
        : player
    ));
  }

  function hasPvpTeamAssigned(player = {}) {
    return Math.max(0, Number(player.teamCount) || Number(player.activeTeam?.count) || 0) > 0;
  }

  function getPvpPlayerById(playerId) {
    const id = String(playerId || '');
    return (state.playersAt || []).find((player) => String(player.id) === id) || null;
  }

  function renderTravelStatusCard() {
    const destination = state.selectedPath?.[state.selectedPath.length - 1] || state.selectedTarget || state.position;
    const remainingSteps = getPathStepCount(state.selectedPath || []);
    const logs = state.travelLog || [];
    const meta = remainingSteps
      ? `${formatStepCount(remainingSteps)} remaining`
      : 'Resolving route';

    return `
      <article class="world-sidebar-card world-travel-card">
        <span class="world-card-kicker">Traveling</span>
        <span class="world-card-copy">
          <strong class="world-card-title">Area ${escapeHtml(formatCoords(destination))}</strong>
          <small class="world-card-meta">${escapeHtml(meta)}</small>
        </span>
        ${logs.length ? renderTravelLog(logs) : '<p class="world-empty-text">Moving through the wilds.</p>'}
      </article>
    `;
  }

  function renderHuntRewardLines(rate, progress) {
    const accruedXp = progress ? progress.accruedXp : 0;
    const accruedSouls = progress ? progress.accruedSouls : 0;
    // Passive hunts pay reduced XP; show the reduced per-kill rate so the
    // ticker matches what the server banks when the hunt ends.
    const passiveXpPerKill = Math.max(1, Math.floor(rate.xpPerCycle * PASSIVE_HUNT_XP_MULTIPLIER));

    return `
      <span class="world-hunt-reward-lines">
        <span class="world-hunt-reward-row">
          <span class="world-hunt-reward-label">Per kill:</span>
          <span class="world-hunt-reward-value world-hunt-xp-value">${formatNumber(passiveXpPerKill)} XP</span>
          <span class="world-hunt-reward-value world-hunt-souls-value">${formatSoulCount(rate.soulsPerCycle)}</span>
        </span>
        <span class="world-hunt-reward-row is-earned">
          <span class="world-hunt-reward-label">Earned:</span>
          <span class="world-hunt-reward-value world-hunt-xp-value">${formatNumber(accruedXp)} XP</span>
          ${renderHuntEarnedSouls(progress, accruedSouls)}
        </span>
      </span>
    `;
  }

  function renderHuntEarnedSouls(progress, accruedSouls) {
    const capacity = Number(progress?.soulCapacity);
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return `<span class="world-hunt-reward-value world-hunt-souls-value">${formatSoulCount(accruedSouls)}</span>`;
    }

    const displayedSouls = Math.max(0, Number(accruedSouls) || 0);
    const full = Boolean(progress?.vesselFull) || displayedSouls >= capacity;
    const tooltip = full
      ? 'Your Soul Vessel is full. End the hunt to bank souls, or expand the vessel in the skill tree.'
      : 'Souls banked while hunting are held in your Soul Vessel. When it fills, souls stop accruing until the hunt ends.';

    return `
      <span class="world-hunt-reward-value world-hunt-souls-value world-hunt-earned-souls ${full ? 'is-vessel-full' : ''}" data-tooltip="${escapeAttribute(tooltip)}" title="${escapeAttribute(tooltip)}" tabindex="0" aria-label="${escapeAttribute(tooltip)}">
        <span class="world-hunt-vessel-amount">${formatNumber(displayedSouls)} / ${formatNumber(capacity)} Souls</span>
        <a class="world-hunt-vessel-upgrade-btn" href="${escapeAttribute(appUrl('/skill-tree'))}" title="Expand Soul Vessel" aria-label="Expand your Soul Vessel in the skill tree"><span aria-hidden="true">+</span></a>
      </span>
    `;
  }

  function renderHuntProgress(progress, rate) {
    const { progressPercent, roundedProgress } = getHuntProgressDisplay(progress, rate);

    return `
      <span class="world-hunt-progress" role="progressbar" aria-label="Reward progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${roundedProgress}">
        <span class="world-hunt-progress-fill" style="--hunt-progress:${progressPercent.toFixed(2)}%"></span>
      </span>
    `;
  }

  function getHuntProgressDisplay(progress, rate) {
    const totalSeconds = Math.max(1, Number(progress?.killSeconds || rate.killSeconds) || HUNT_DEFAULT_KILL_SECONDS);
    const remainingSeconds = progress ? progress.secondsToNext : totalSeconds;
    const progressPercent = clamp(((totalSeconds - remainingSeconds) / totalSeconds) * 100, 0, 100);

    return {
      progressPercent,
      roundedProgress: Math.round(progressPercent)
    };
  }

  function renderEncounterTitle(encounter, extraClass = '') {
    const identity = getEncounterIdentity(encounter);
    const classes = ['world-encounter-title', extraClass].filter(Boolean).join(' ');

    return `
      <strong class="${classes}">
        <span class="world-encounter-rarity" style="--rarity-color:${identity.color}">${escapeHtml(identity.rarityLabel)}</span>
        <span class="world-encounter-name">${escapeHtml(`${identity.name} Spot`)}</span>
      </strong>
    `;
  }

  function renderEncounterTitleLink(encounter, extraClass = '') {
    const href = getEncounterDemonPageHref(encounter);
    if (!href) return renderEncounterTitle(encounter, extraClass);

    const identity = getEncounterIdentity(encounter);
    const classes = ['world-encounter-title', 'world-encounter-title-link', extraClass].filter(Boolean).join(' ');
    const label = `${identity.rarityLabel} ${identity.name} Spot`;

    return `
      <a class="${classes}" href="${escapeAttribute(href)}" aria-label="Open ${escapeAttribute(label)} demon guide">
        <span class="world-encounter-rarity" style="--rarity-color:${identity.color}">${escapeHtml(identity.rarityLabel)}</span>
        <span class="world-encounter-name">${escapeHtml(`${identity.name} Spot`)}</span>
      </a>
    `;
  }

  function getEncounterDemonPageHref(encounter) {
    const keyDemon = encounter?.keyDemon || (Array.isArray(encounter?.team) ? encounter.team[0] : null);
    const name = keyDemon?.species || keyDemon?.typeName || keyDemon?.name;
    const rarity = keyDemon?.rarity;
    if (!name || !rarity) return '';

    return appUrl(`/demons/${slugify(`${name}-${rarity}`)}`);
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

  function renderDemonPortraitGroup(members = [], options = {}) {
    const demons = (Array.isArray(members) ? members : []).filter(Boolean);
    if (!demons.length) return '';

    const max = Number.isInteger(options.max) && options.max > 0 ? options.max : demons.length;
    const visibleDemons = demons.slice(0, max);
    const overflow = Math.max(0, demons.length - visibleDemons.length);
    const classes = ['world-enc-demons', options.className || ''].filter(Boolean).join(' ');
    const label = options.label ? ` aria-label="${escapeAttribute(options.label)}"` : '';

    return `
      <div class="${classes}"${label}>
        ${visibleDemons.map(renderDemonPortrait).join('')}
        ${overflow ? `<span class="world-enc-demon-overflow">+${formatNumber(overflow)}</span>` : ''}
      </div>
    `;
  }

  function getActiveTeamMembers() {
    const team = state.activeTeam || {};
    return Array.isArray(team.members) ? team.members.filter(Boolean) : [];
  }

  function hasAssignedWorldTeam() {
    return getActiveTeamMembers().length > 0;
  }

  function showTravelTeamRequiredModal() {
    const modalElement = elements.worldTravelTeamRequiredModal;
    const modalApi = window.bootstrap?.Modal;

    if (!modalElement || !modalApi) {
      setMessage("It's dangerous to travel alone. Assign a team before traveling.", 'warning');
      openWorldTeamEditor();
      return;
    }

    modalApi.getOrCreateInstance(modalElement).show();
  }

  function openWorldTeamEditorFromTravelWarning() {
    const modalElement = elements.worldTravelTeamRequiredModal;
    const modalApi = window.bootstrap?.Modal;

    if (!modalElement || !modalApi) {
      openWorldTeamEditor();
      return;
    }

    const openEditor = () => {
      openWorldTeamEditor();
    };

    if (modalElement.classList.contains('show')) {
      modalElement.addEventListener('hidden.bs.modal', openEditor, { once: true });
      modalApi.getOrCreateInstance(modalElement).hide();
      return;
    }

    openEditor();
  }

  function isTravelTeamRequiredError(error) {
    return Number(error?.status) === 409 &&
      String(error?.message || '').toLowerCase().includes('dangerous to travel alone');
  }

  function formatSoulCount(value) {
    const count = Math.max(0, Number(value) || 0);
    return `${formatNumber(count)} ${count === 1 ? 'Soul' : 'Souls'}`;
  }

  function slugify(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/['\u2018\u2019]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function renderTravelPanel() {
    if (!elements.worldTravelPanel) return;

    const logs = state.travelLog || [];
    if (!logs.length) {
      elements.worldTravelPanel.innerHTML = '<p class="world-empty-text">No path taken yet.</p>';
      return;
    }

    elements.worldTravelPanel.innerHTML = renderTravelLog(logs);
  }

  function renderTravelLog(logs = []) {
    return `<div class="world-travel-log">${logs.slice(0, 5).map((entry, index) => renderTravelLogItem(entry, index)).join('')}</div>`;
  }

  function renderTravelLogItem(entry, index = 0) {
    const isAmbush = entry.type === 'ambush';
    const battleWinner = entry.battle?.winner;
    const canReplay = isAmbush && shouldShowAmbushBattleReplay(entry.battle);
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

  function shouldShowAmbushBattleReplay(battle) {
    return battle?.winner === 'enemy' && shouldShowWorldBattleReplay(battle);
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
        `).join('') : '<p class="world-empty-text">No active buffs yet.</p>'}
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

  function getWorldBattleMeta(type, battle = {}, overrides = {}) {
    return normalizeWorldBattleMeta(type, battle || {}, overrides);
  }

  function normalizeWorldBattleMeta(type = 'battle', battle = {}, overrides = {}) {
    const battleState = battle || {};
    const normalizedType = type || overrides.type || 'battle';
    const won = battleState.winner === 'player';
    const lost = battleState.winner === 'enemy';
    const pvpTargetName = getWorldBattlePvpTargetName(battleState, overrides);
    const bossName = getWorldBattleBossName(battleState, overrides);
    const title = normalizedType === 'try_hunt'
      ? won ? 'Fight Won' : 'Fight Failed'
      : normalizedType === 'pvp_challenge'
        ? won ? 'Challenge Won' : lost ? 'Challenge Lost' : 'Challenge'
        : normalizedType === 'world_boss'
          ? won ? 'Boss Defeated' : lost ? 'Boss Failed' : 'Boss Fight'
          : won ? 'Ambush Won' : lost ? 'Ambush Lost' : 'Ambush';

    return {
      type: normalizedType,
      eyebrow: overrides.eyebrow || (normalizedType === 'try_hunt'
        ? 'Fight'
        : normalizedType === 'pvp_challenge'
          ? 'PvP Challenge'
          : normalizedType === 'world_boss'
            ? 'World Boss'
            : 'World Ambush'),
      title: overrides.title || title,
      enemyLabel: overrides.enemyLabel || (normalizedType === 'try_hunt'
        ? getEncounterPlainLabel(battleState.encounter)
        : normalizedType === 'pvp_challenge'
          ? pvpTargetName
          : normalizedType === 'world_boss'
            ? bossName
            : 'Ambushers'),
      winText: overrides.winText || (normalizedType === 'try_hunt'
        ? 'Hunting unlocked'
        : normalizedType === 'pvp_challenge'
          ? `Defeated ${pvpTargetName}`
          : normalizedType === 'world_boss'
            ? `Defeated ${bossName}${overrides.rewardBuff?.name ? ` - ${overrides.rewardBuff.name} active` : ''}`
            : 'Ambush cleared'),
      lossText: overrides.lossText || (normalizedType === 'try_hunt'
        ? 'Hunting remains locked'
        : normalizedType === 'pvp_challenge'
          ? `${pvpTargetName} won`
          : normalizedType === 'world_boss'
            ? `${bossName} endured`
            : 'Ambush lost'),
      neutralText: overrides.neutralText || 'Battle ended'
    };
  }

  function getWorldBattlePvpTargetName(battle = {}, overrides = {}) {
    return overrides.targetPlayer?.username || battle.targetPlayer?.username || 'Hunter';
  }

  function getWorldBattleBossName(battle = {}, overrides = {}) {
    return overrides.boss?.title || battle.boss?.title || 'World Boss';
  }

  function getWorldBattleFallbackMessage(battle = {}, meta = {}) {
    const battleState = battle || {};
    const normalizedMeta = normalizeWorldBattleMeta(meta.type, battleState, meta);
    if (battleState.winner === 'player') return normalizedMeta.winText;
    if (battleState.winner === 'enemy') return normalizedMeta.lossText;
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
    const hiddenPromise = new Promise((resolve) => {
      modalElement.addEventListener('hidden.bs.modal', () => {
        const waitForBackdrop = shouldReturnToShrineAfterWorldBattle(battle, meta)
          ? waitForWorldBattleBackdropClear()
          : Promise.resolve();
        waitForBackdrop.then(resolve);
      }, { once: true });
    });

    if (!modalElement.classList.contains('show')) modal.show();
    await shownPromise;
    if (state.worldBattleReplayToken !== token) return hiddenPromise;

    try {
      await dungeonLifecycle.replayFight({ waitForBattleIntro: true });
      const resultType = getWorldDungeonBattleResultType(battle);
      if (state.worldBattleReplayToken === token && resultType) {
        await showWorldDungeonBattleResultOverlay(resultType);
      }
      if (state.worldBattleReplayToken === token) {
        renderWorldDungeonBattleResultDock(battle);
        renderWorldDungeonBattleCenterIcon();
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
    setWorldDungeonBattleResultAnimation(false);
    setWorldDungeonBattleResultMode(false);
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
    setWorldDungeonBattleResultMode(false);
    dungeonCombat.applyBattleSpeed();
    dungeonRender.renderRun();
    renderWorldDungeonBattleCenterIcon();
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

    const enemyPressure = getWorldBattleEnemyPressure(battle);
    const enemyBuffs = isWorldBossBattle(battle, meta)
      ? getWorldBattleEnemySideBuffs(battle)
      : [];

    return {
      runId: `world-${meta.type || 'battle'}-${Date.now()}`,
      status: 'active',
      currentFloor,
      team: playerBefore,
      enemies: enemyBefore,
      enemyLabel: meta.enemyLabel || 'Enemies',
      rewards: [],
      recruitRewards: [],
      awaitingRecruit: true,
      enemyPressure,
      nextEnemyPressure: enemyPressure,
      enemyBuffs,
      nextEnemyBuffs: enemyBuffs,
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

  function getWorldBattleEnemyPressure(battle = {}) {
    const encounterPressure = battle.encounter?.terror;
    if (encounterPressure?.active) {
      return {
        description: 'Demons grow stronger farther from the center.',
        ...encounterPressure
      };
    }

    const terrorBuff = (Array.isArray(battle.enemyBuffs) ? battle.enemyBuffs : [])
      .find((buff) => isWorldTerrorBuff(buff));
    if (!terrorBuff) return null;

    const hpMult = getBuffEffectMultiplier(terrorBuff, 'max_hp_mult');
    const atkMult = getBuffEffectMultiplier(terrorBuff, 'attack_mult');
    const speedMult = getBuffEffectMultiplier(terrorBuff, 'speed_mult');
    const level = Math.max(0, Math.round(Number(String(terrorBuff.id || terrorBuff.name || '').match(/\d+/)?.[0]) || 0));

    return {
      level,
      hpMult,
      atkMult,
      speedMult,
      hpBonusPct: getBonusPercent(hpMult),
      atkBonusPct: getBonusPercent(atkMult),
      speedBonusPct: getBonusPercent(speedMult),
      description: 'Demons grow stronger farther from the center.',
      active: level > 0 || hpMult > 1 || atkMult > 1 || speedMult > 1
    };
  }

  function getBuffEffectMultiplier(buff = {}, type) {
    return (Array.isArray(buff.effects) ? buff.effects : [])
      .filter((effect) => effect?.type === type)
      .reduce((product, effect) => product * positiveMultiplier(effect.value, 1), 1);
  }

  function isWorldTerrorBuff(buff = {}) {
    const tags = Array.isArray(buff.tags) ? buff.tags : [];
    const id = String(buff.id || '').toLowerCase();
    const name = String(buff.name || '').toLowerCase();
    return tags.includes('Terror')
      || id.startsWith('world_terror_')
      || name.startsWith('terror ');
  }

  function positiveMultiplier(value, fallback = 1) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
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
    const isPlayerSnapshot = side === 'player';

    return {
      ...demon,
      instanceId,
      maxHp,
      hp,
      shield: Math.max(0, Number(demon.shield) || 0),
      position: demon.position === 'back' ? 'back' : (index > 0 ? 'back' : 'front'),
      formationRow,
      formationSlot: formationRow,
      ...(isPlayerSnapshot ? {
        accountStatsApplied: true,
        runBuffStatsApplied: true
      } : {}),
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

  function renderWorldDungeonBattleResultDock(battle = {}) {
    const resultLayer = getWorldDungeonBattleResultLayer();
    if (!resultLayer) return;

    const won = battle.winner === 'player';
    const lost = battle.winner === 'enemy';
    const label = won ? 'VICTORY' : lost ? 'DEFEAT' : 'BATTLE ENDED';
    const tone = won ? 'is-victory' : lost ? 'is-defeat' : 'is-neutral';
    const canReplay = shouldShowWorldBattleReplay(battle);

    setWorldDungeonBattleResultMode(true);
    resultLayer.innerHTML = `
      <div class="world-dungeon-result ${tone}" role="status" aria-live="polite">
        <strong>${escapeHtml(label)}</strong>
        <span class="world-dungeon-result-actions">
          <button class="btn btn-glass-muted btn-sm btn-icon-only world-dungeon-result-icon-btn" type="button" data-world-dungeon-result-replay title="Replay Fight" aria-label="Replay Fight" ${canReplay ? '' : 'disabled'}>
            ${renderIcon('replay')}
          </button>
          <button class="btn btn-glass-muted btn-sm btn-icon-only world-dungeon-result-icon-btn" type="button" data-world-dungeon-result-log title="Fight Log" aria-label="Fight Log" aria-pressed="false" ${canReplay ? '' : 'disabled'}>
            ${renderIcon('log')}
          </button>
          <button class="btn btn-glass-gold world-dungeon-result-continue" type="button">
            Continue
          </button>
        </span>
      </div>
    `;
    resultLayer.querySelector('.world-dungeon-result-continue')?.addEventListener('click', closeWorldBattleModal, { once: true });
    resultLayer.querySelector('[data-world-dungeon-result-replay]')?.addEventListener('click', (event) => {
      void replayWorldDungeonBattleFromResult(event.currentTarget);
    });
    resultLayer.querySelector('[data-world-dungeon-result-log]')?.addEventListener('click', (event) => {
      toggleWorldDungeonBattleLogFromResult(event.currentTarget);
    });
  }

  async function replayWorldDungeonBattleFromResult(button) {
    const battle = state.activeWorldBattle;
    if (!battle || button?.disabled) return;

    if (button) button.disabled = true;
    setWorldDungeonBattleResultMode(false);
    dungeonRender.setBattlePanel('combat');

    try {
      await dungeonLifecycle.replayFight({ waitForBattleIntro: true });
      const resultType = getWorldDungeonBattleResultType(battle);
      if (resultType) {
        await showWorldDungeonBattleResultOverlay(resultType);
      }
      renderWorldDungeonBattleResultDock(battle);
      renderWorldDungeonBattleCenterIcon();
    } catch (error) {
      console.error('World battle replay failed', error);
      setMessage(getWorldBattleFallbackMessage(battle, state.activeWorldBattleMeta || {}), battle.winner === 'player' ? 'success' : 'warning');
      renderWorldDungeonBattleResultDock(battle);
    }
  }

  async function showWorldDungeonBattleResultOverlay(resultType) {
    setWorldDungeonBattleResultAnimation(true);
    try {
      await dungeonRender.showBattleResultOverlay(resultType);
    } finally {
      setWorldDungeonBattleResultAnimation(false);
    }
  }

  function toggleWorldDungeonBattleLogFromResult(button) {
    dungeonRender.toggleFightLogPanel();
    const isLogActive = Boolean(elements.worldBattleModal?.querySelector('#battleLogPanel')?.classList.contains('show'));
    button?.classList.toggle('is-primary', isLogActive);
    button?.setAttribute('aria-pressed', String(isLogActive));
  }

  function setWorldDungeonBattleResultMode(enabled) {
    const modal = elements.worldBattleModal;
    const handBar = modal?.querySelector('#dungeonHandBar');
    const handCards = modal?.querySelector('.dungeon-hand-cards');
    const active = Boolean(enabled);

    modal?.classList.toggle('is-world-battle-result-mode', active);
    handBar?.classList.toggle('is-world-battle-result-mode', active);
    handCards?.classList.toggle('is-world-battle-result', active);
    if (!active) {
      modal?.querySelector('.world-dungeon-result-layer')?.remove();
    }
  }

  function getWorldDungeonBattleResultLayer() {
    const modalBody = elements.worldBattleModal?.querySelector('.modal-body');
    if (!modalBody) return null;

    const existing = modalBody.querySelector('.world-dungeon-result-layer');
    if (existing) return existing;

    const layer = document.createElement('div');
    layer.className = 'world-dungeon-result-layer';
    modalBody.appendChild(layer);
    return layer;
  }

  function setWorldDungeonBattleResultAnimation(enabled) {
    const active = Boolean(enabled);
    document.body.classList.toggle('is-world-battle-result-animating', active);
    elements.worldBattleModal?.classList.toggle('is-world-battle-result-animating', active);
  }

  function renderWorldDungeonBattleCenterIcon() {
    const centerActions = elements.worldBattleModal?.querySelector('#dungeonCenterActions');
    if (!centerActions || dungeonState.isBattleAnimating) return;
    centerActions.innerHTML = `
      <span class="dungeon-fight-mark world-dungeon-center-mark" aria-hidden="true">
        ${dungeonCards.renderButtonMeleeIcon()}
      </span>
    `;
  }

  function closeWorldBattleModal() {
    const modalElement = elements.worldBattleModal;
    if (!modalElement) return;
    const closeInstantly = shouldCloseWorldBattleModalInstantly();
    if (closeInstantly) {
      void closeLostAmbushWorldBattleModal(modalElement);
      return;
    }

    window.bootstrap?.Modal.getOrCreateInstance(modalElement)?.hide();
  }

  async function closeLostAmbushWorldBattleModal(modalElement) {
    if (state.ambushDefeatBlackoutClosing) return;
    state.ambushDefeatBlackoutClosing = true;
    await fadeWorldAmbushDefeatToBlack();

    const hadFade = modalElement.classList.contains('fade');

    document.body.classList.add('is-world-battle-instant-close');
    modalElement.classList.remove('fade');

    const cleanupInstantClose = () => {
      if (hadFade) modalElement.classList.add('fade');
      document.body.classList.remove('is-world-battle-instant-close');
      state.ambushDefeatBlackoutClosing = false;
    };

    modalElement.addEventListener('hidden.bs.modal', cleanupInstantClose, { once: true });
    window.bootstrap?.Modal.getOrCreateInstance(modalElement)?.hide();
    if (!modalElement.classList.contains('show')) cleanupInstantClose();
  }

  function shouldCloseWorldBattleModalInstantly() {
    return shouldReturnToShrineAfterWorldBattle(state.activeWorldBattle, state.activeWorldBattleMeta);
  }

  function shouldReturnToShrineAfterWorldBattle(battle = {}, meta = {}) {
    return isLostAmbushBattle(battle, meta) || isLostPvpChallenge(battle, meta);
  }

  function isLostAmbushBattle(battle = {}, meta = {}) {
    return meta?.type === 'ambush' && battle?.winner === 'enemy';
  }

  function isLostPvpChallenge(battle = {}, meta = {}) {
    return meta?.type === 'pvp_challenge' && battle?.winner === 'enemy';
  }

  async function waitForWorldBattleBackdropClear() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (!document.querySelector('.modal-backdrop')) return;
      await delay(16);
    }

    if (!document.querySelector('.modal.show')) {
      document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
    }
  }

  async function fadeWorldAmbushDefeatToBlack() {
    const overlay = getWorldAmbushDefeatOverlay();
    const fadeMs = getWorldAmbushDefeatFadeMs();
    overlay.style.setProperty('--world-ambush-defeat-fade-ms', `${fadeMs}ms`);
    document.body.classList.add('is-world-ambush-defeat-transition');
    await delay(16);
    state.ambushDefeatBlackoutActive = true;
    document.body.classList.add('is-world-ambush-defeat-blackout');
    await delay(fadeMs);
  }

  async function fadeWorldAmbushDefeatFromBlack() {
    const overlay = document.querySelector('.world-ambush-defeat-fade');
    const fadeMs = getWorldAmbushDefeatFadeMs();
    if (!overlay) {
      clearWorldAmbushDefeatBlackout();
      return;
    }

    await delay(getWorldAmbushDefeatHoldMs());
    overlay.style.setProperty('--world-ambush-defeat-fade-ms', `${fadeMs}ms`);
    document.body.classList.remove('is-world-ambush-defeat-blackout');
    await delay(fadeMs);
    overlay.remove();
    clearWorldAmbushDefeatBlackout();
  }

  function clearWorldAmbushDefeatBlackout() {
    state.ambushDefeatBlackoutActive = false;
    state.ambushDefeatBlackoutClosing = false;
    document.body.classList.remove('is-world-ambush-defeat-transition', 'is-world-ambush-defeat-blackout', 'is-world-battle-instant-close');
  }

  function getWorldAmbushDefeatOverlay() {
    const existing = document.querySelector('.world-ambush-defeat-fade');
    if (existing) return existing;

    const overlay = document.createElement('div');
    overlay.className = 'world-ambush-defeat-fade';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(overlay);
    return overlay;
  }

  function getWorldAmbushDefeatFadeMs() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 120 : WORLD_AMBUSH_DEFEAT_FADE_MS;
  }

  function getWorldAmbushDefeatHoldMs() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 20 : WORLD_AMBUSH_DEFEAT_HOLD_MS;
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
    if (!state.hoverTile) {
      updateHoverCoordinates();
      return;
    }
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
    if (state.moving) return;

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
    if (state.moving) return;

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

  function setTravelCameraZoom() {
    setZoom(TRAVEL_ZOOM);
    centerOnHunter();
  }

  function centerOnWorldPoint(point) {
    setViewportPosition(getCenteredViewportPosition(point));
  }

  function getCenteredViewportPosition(point) {
    const app = state.app;
    if (!app || !state.viewport) return null;

    const width = app.screen?.width || app.renderer.width;
    const height = app.screen?.height || app.renderer.height;
    const scale = state.viewport.scale.x || 1;

    return {
      x: width / 2 - point.x * scale,
      y: height / 2 - point.y * scale
    };
  }

  function setViewportPosition(position) {
    if (!position || !state.viewport) return;

    state.viewport.x = position.x;
    state.viewport.y = position.y;
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

  function isDarknessPortalEvent(event) {
    return event?.type === 'darkness-portal';
  }

  function getDarknessPortalSummonCost(event = {}) {
    return getTileDistance(state.position, event) * getDarknessPortalSummonCostPerDistance(event);
  }

  function getDarknessPortalSummonCostPerDistance(event = {}) {
    const cost = Number(event.summonCostPerDistance);
    return Number.isFinite(cost) && cost >= 0
      ? Math.floor(cost)
      : DEFAULT_DARKNESS_PORTAL_SUMMON_SOUL_COST_PER_DISTANCE;
  }

  function getPlayerSoulBalance() {
    const souls = Number(state.player?.souls);
    return Number.isFinite(souls) ? Math.max(0, Math.floor(souls)) : null;
  }

  function getTileDistance(from = {}, to = {}) {
    return Math.abs(Number(to.x) - Number(from.x)) + Math.abs(Number(to.y) - Number(from.y));
  }

  function isBoundShrine(event) {
    return Boolean(event?.type === 'forsaken_shrine' && state.boundShrine && positionsEqual(event, state.boundShrine));
  }

  function getEncounterAt(position) {
    return state.encounters.find((encounter) => encounter.x === position.x && encounter.y === position.y) || null;
  }

  function getEncounterIdentity(encounter = {}) {
    const keyDemon = encounter?.keyDemon || (Array.isArray(encounter?.team) ? encounter.team[0] : null) || {};
    const rarity = String(keyDemon.rarity || 'common').toLowerCase();
    const name = keyDemon.species || keyDemon.name || 'Demon';

    return {
      rarity,
      rarityLabel: capitalize(rarity),
      name,
      color: rarityCss(rarity)
    };
  }

  function getEncounterPlainLabel(encounter = {}) {
    const identity = getEncounterIdentity(encounter);
    return `${identity.rarityLabel} ${identity.name} Spot`;
  }

  function getEncounterHuntTargetLabel(encounter = {}) {
    const identity = getEncounterIdentity(encounter);
    return `${identity.rarityLabel} ${identity.name} demons`;
  }

  function getSignAt(position) {
    const block = getBlockedTile(position);
    return getBlockedTileType(block) === 'sign' ? block : null;
  }

  function getSignMessage(sign = {}) {
    return String(sign.message || sign.description || 'The weathered lettering has worn away.').trim();
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

  function getBlockedTileType(tile) {
    const type = String(tile?.type || '').trim().toLowerCase();
    return type === 'poison' || type === 'lava' || type === 'sign' ? type : 'rocks';
  }

  function isRoadTile(position) {
    return state.roadKeys.has(getTileKey(position));
  }

  function isBlocked(position) {
    const block = getBlockedTile(position);
    return Boolean(block && getBlockedTileType(block) !== 'sign');
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
    const active = hunt?.active?.encounterId
      ? {
        ...hunt.active,
        encounterId: String(hunt.active.encounterId)
      }
      : null;

    return {
      unlockedEncounterIds: Array.isArray(hunt?.unlockedEncounterIds) ? hunt.unlockedEncounterIds.map(String) : [],
      active
    };
  }

  function setHuntState(hunt) {
    state.hunt = normalizeHunt(hunt);
    state.huntStatusRefreshAt = Date.now();
    syncWorldSidePanel();
    return state.hunt;
  }

  async function refreshHuntStatus(options = {}) {
    const force = Boolean(options.force);
    const now = Date.now();
    if (!force && state.huntStatusRefreshAt && now - state.huntStatusRefreshAt < HUNT_STATUS_REFRESH_MS) {
      return state.hunt;
    }

    state.huntStatusRefreshAt = now;

    try {
      setHuntState(await api('/api/world/hunting/status'));
    } catch (error) {
      state.huntStatusRefreshAt = 0;
      throw error;
    }

    if (options.render !== false) {
      renderEncounterPanel();
      syncHuntTicker();
    }

    return state.hunt;
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

  function isWorldBossBattle(battle = {}, meta = {}) {
    return meta.type === 'world_boss'
      || battle.combatType === 'world_boss'
      || Boolean(battle.boss);
  }

  function getWorldBattleEnemySideBuffs(battle = {}) {
    return normalizeWorldDungeonBuffs(battle.enemyBuffs)
      .filter((buff) => !isWorldTerrorBuff(buff));
  }

  function normalizeWorldBoss(boss) {
    if (!boss || typeof boss !== 'object') return null;
    const position = normalizePosition(boss);
    return {
      ...boss,
      ...position,
      id: String(boss.id || ''),
      title: boss.title || 'World Boss',
      taunts: Array.isArray(boss.taunts) ? boss.taunts.filter(Boolean) : [],
      difficulty: Math.max(1, Number(boss.difficulty) || 1),
      team: Array.isArray(boss.team) ? boss.team : [],
      enemyBuffs: Array.isArray(boss.enemyBuffs) ? boss.enemyBuffs : [],
      rewardBuff: boss.rewardBuff || null
    };
  }

  function getBossAt(position) {
    const target = normalizePosition(position);
    return (state.bosses || []).find((boss) => positionsEqual(boss, target)) || null;
  }

  function getBossById(bossId) {
    const id = String(bossId || '');
    if (!id) return null;
    return (state.bosses || []).find((boss) => String(boss.id) === id) || null;
  }

  function formatBossMoveMeta(boss = {}) {
    const movesAt = Date.parse(boss.movesAt || '');
    if (!Number.isFinite(movesAt)) return 'Moves hourly';
    const remainingSeconds = Math.max(0, Math.ceil((movesAt - Date.now()) / 1000));
    if (remainingSeconds <= 0) return 'Moves soon';
    return `Moves in ${formatDuration(remainingSeconds)}`;
  }

  function formatBossBuffDuration(buff = {}) {
    const hours = Number(buff.durationHours);
    if (Number.isFinite(hours) && hours > 0) {
      return hours % 1 === 0 ? `${formatNumber(hours)}h` : `${formatNumber(Math.round(hours * 10) / 10)}h`;
    }
    const seconds = Number(buff.durationSeconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      return formatDuration(seconds);
    }
    return '24h';
  }

  function getActiveHuntEncounter() {
    const active = state.hunt?.active;
    if (!active) return null;
    return getEncounterById(active.encounterId)
      || (isActiveHuntFor(state.currentEncounter?.id) ? state.currentEncounter : null);
  }

  // Expected payout per kill. Active hunts receive server-snapshotted values
  // based on the 1x unlock-fight playback time and defeated demon count.
  function computeHuntRate(encounter) {
    const difficulty = Math.max(1, Number(encounter?.difficulty) || 1);
    const active = state.hunt?.active;
    const activeKillSeconds = Number(active?.killSeconds ?? active?.enemyRespawnSeconds);
    const explicit = Number(encounter?.enemyRespawnSeconds || encounter?.respawnSeconds);
    const fallbackKillSeconds = Number.isFinite(explicit) && explicit > 0
      ? Math.floor(explicit)
      : HUNT_DEFAULT_KILL_SECONDS + Math.max(0, difficulty - 1) * 60;
    const killSeconds = Number.isFinite(activeKillSeconds) && activeKillSeconds > 0
      ? Math.floor(activeKillSeconds)
      : fallbackKillSeconds;
    const soulReward = active?.soulReward || encounter?.soulReward || computeWorldSoulReward(encounter);
    const xpReward = active?.xpReward || encounter?.xpReward || computeWorldXpReward(encounter);
    const fallbackSoulCount = Number.isFinite(Number(soulReward?.soulsPerCycle))
      ? Math.floor(Number(soulReward.soulsPerCycle))
      : Array.isArray(encounter?.team)
        ? encounter.team.length
        : Math.max(1, Math.ceil(difficulty / 2));
    const xpPerCycle = Number(active?.xpPerCycle ?? active?.xpPerKill);
    const soulsPerCycle = Number(active?.soulsPerCycle ?? active?.soulsPerKill ?? active?.defeatedDemonsPerCycle);

    return {
      difficulty,
      killSeconds,
      respawnSeconds: killSeconds,
      xpReward,
      soulReward,
      terror: active?.terror || getEncounterTerror(encounter),
      xpPerCycle: Number.isFinite(xpPerCycle) && xpPerCycle >= 0
        ? Math.round(xpPerCycle)
        : Math.max(0, Math.round(Number(xpReward?.xpPerCycle) || (5 + difficulty * 2))),
      soulsPerCycle: Number.isFinite(soulsPerCycle) && soulsPerCycle >= 0
        ? Math.floor(soulsPerCycle)
        : fallbackSoulCount
    };
  }

  // Mirrors calculateHuntRewards() on the server: each kill interval yields one
  // win against the snapshotted demon spot. XP is uncapped; souls stop at the
  // Soul Vessel capacity.
  function computeHuntProgress(active = state.hunt?.active, now = Date.now()) {
    if (!active) return null;

    const startedAt = Date.parse(active.startedAt || '');
    const encounter = getActiveHuntEncounter();
    const rate = computeHuntRate(encounter);
    const killSeconds = Math.max(1, Number(active.killSeconds ?? active.enemyRespawnSeconds ?? rate.killSeconds) || HUNT_DEFAULT_KILL_SECONDS);

    const elapsedSeconds = Number.isFinite(startedAt)
      ? Math.max(0, Math.floor((now - startedAt) / 1000))
      : 0;
    const cycles = Math.floor(elapsedSeconds / killSeconds);

    const secondsIntoCycle = elapsedSeconds % killSeconds;
    const secondsToNext = killSeconds - secondsIntoCycle;

    // Souls stop accruing once the Soul Vessel fills; XP keeps flowing.
    const capacityRaw = Number(active.soulCapacity);
    const soulCapacity = Number.isFinite(capacityRaw) && capacityRaw > 0 ? Math.floor(capacityRaw) : Infinity;
    const uncappedSouls = cycles * rate.soulsPerCycle;
    const accruedSouls = Math.min(uncappedSouls, soulCapacity);

    return {
      elapsedSeconds,
      killSeconds,
      respawnSeconds: killSeconds,
      difficulty: rate.difficulty,
      cycles,
      xpPerCycle: rate.xpPerCycle,
      soulsPerCycle: rate.soulsPerCycle,
      accruedXp: cycles > 0 ? Math.max(1, Math.floor(cycles * rate.xpPerCycle * PASSIVE_HUNT_XP_MULTIPLIER)) : 0,
      accruedSouls,
      soulCapacity: Number.isFinite(soulCapacity) ? soulCapacity : null,
      vesselFull: Number.isFinite(soulCapacity) && (uncappedSouls >= soulCapacity || accruedSouls >= soulCapacity),
      soulsLost: Math.max(0, uncappedSouls - accruedSouls),
      secondsToNext
    };
  }

  function renderWorldCardMeta(parts = []) {
    const visibleParts = parts.filter(Boolean);
    if (!visibleParts.length) return '';

    return `
      <small class="world-card-meta world-card-meta-inline">
        ${visibleParts.map((part, index) => `${index > 0 ? '<span class="world-meta-separator" aria-hidden="true">·</span>' : ''}<span class="world-meta-item">${part}</span>`).join('')}
      </small>
    `;
  }

  function renderWorldTerrorChip(terror = null, options = {}) {
    if (!terror?.active) return '';

    const level = Math.max(0, Math.round(Number(terror.level) || 0));
    if (level <= 0) return '';

    const tooltip = [
      `Terror ${level}`,
      'Demons grow stronger farther from the center.',
      `Enemy HP +${formatNumber(terror.hpBonusPct || 0)}%`,
      `Enemy Attack +${formatNumber(terror.atkBonusPct || 0)}%`,
      `Enemy Speed +${formatNumber(terror.speedBonusPct || 0)}%`
    ].join('\n');
    const className = [
      'enemy-pressure-chip',
      options.inline ? 'world-terror-meta-chip' : ''
    ].filter(Boolean).join(' ');
    const chip = `
      <span
        class="${className}"
        tabindex="0"
        data-tooltip="${escapeAttribute(tooltip)}"
        aria-label="${escapeAttribute(tooltip)}"
      >
        <span>Terror</span>
        <strong>${escapeHtml(String(level))}</strong>
      </span>
    `;

    if (options.inline) return chip;

    return `
      <span class="world-terror-line">
        ${chip}
      </span>
    `;
  }

  function getEncounterTerror(encounter = {}) {
    return encounter?.terror || computeWorldTerror(encounter);
  }

  function computeWorldTerror(encounter = {}) {
    const level = getWorldTerrorLevel(encounter);
    const pressure = getDungeonTerrorPressure(level);

    return {
      level,
      distance: roundNumber(getWorldTerrorDistance(encounter), 1),
      hpMult: roundMultiplier(pressure.hp),
      atkMult: roundMultiplier(pressure.atk),
      speedMult: roundMultiplier(pressure.speed),
      hpBonusPct: getBonusPercent(pressure.hp),
      atkBonusPct: getBonusPercent(pressure.atk),
      speedBonusPct: getBonusPercent(pressure.speed),
      active: level > 0
    };
  }

  function getWorldTerrorLevel(encounter = {}) {
    return clamp(Math.floor(getWorldTerrorDistance(encounter) - WORLD_TERROR_START_DISTANCE), 0, WORLD_TERROR_MAX_LEVEL);
  }

  function getDungeonTerrorPressure(level) {
    const terrorLevel = Math.max(0, Number(level) || 0);

    return {
      hp: 1 + terrorLevel * 0.045,
      atk: 1 + terrorLevel * 0.04,
      speed: Math.min(1.85, 1 + terrorLevel * 0.012)
    };
  }

  function computeWorldSoulReward(encounter = {}) {
    const baseSouls = Array.isArray(encounter?.team) ? encounter.team.length : 0;

    return {
      baseSouls,
      soulsPerCycle: baseSouls
    };
  }

  function computeWorldXpReward(encounter = {}) {
    const difficulty = Math.max(1, Number(encounter?.difficulty) || 1);
    const baseXp = 5 + difficulty * 2;
    const distance = getWorldDistance(encounter);
    const distanceFactor = getDistanceProgress(encounter, WORLD_DISTANCE_REWARD_START, WORLD_DISTANCE_REWARD_CAP);
    const distanceMultiplier = 1 + Math.pow(distanceFactor, 1.4) * WORLD_DISTANCE_XP_MULTIPLIER_BONUS;

    return {
      baseXp,
      xpPerCycle: Math.ceil(baseXp * distanceMultiplier),
      distance: roundNumber(distance, 1),
      distanceFactor: roundNumber(distanceFactor, 3),
      distanceMultiplier: roundMultiplier(distanceMultiplier)
    };
  }

  function getDistanceProgress(encounter = {}, start, cap) {
    return clamp((getWorldDistance(encounter) - start) / Math.max(1, cap - start), 0, 1);
  }

  function getWorldDistance(encounter = {}) {
    return Math.hypot(Number(encounter?.x) || 0, Number(encounter?.y) || 0);
  }

  function getWorldTerrorDistance(encounter = {}) {
    return Math.max(Math.abs(Number(encounter?.x) || 0), Math.abs(Number(encounter?.y) || 0));
  }

  function roundMultiplier(value) {
    return Math.round((Number(value) || 1) * 1000) / 1000;
  }

  function getBonusPercent(value) {
    return Math.max(0, Math.round(((Number(value) || 1) - 1) * 100));
  }

  function roundNumber(value, precision = 0) {
    const factor = 10 ** Math.max(0, Number(precision) || 0);
    return Math.round((Number(value) || 0) * factor) / factor;
  }

  function getTileKey(position) {
    return `${position.x},${position.y}`;
  }

  function getEventLabel(type) {
    if (type === 'forsaken_shrine') return 'Respawn Point';
    if (type === 'darkness-portal') return 'Darkness Portal';
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
    updateHoverCoordinates();
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

  async function loadBossTextures() {
    const Pixi = window.PIXI;
    if (!Pixi || !state.bosses.length) return;

    const urls = Array.from(new Set(
      state.bosses
        .map((boss) => boss.keyDemon?.imageUrl)
        .filter(Boolean)
    ));

    await Promise.all(urls.map(async (url) => {
      if (state.bossTextures.has(url)) return;
      try {
        const texture = Pixi.Assets ? await Pixi.Assets.load(url) : Pixi.Texture.from(url);
        state.bossTextures.set(url, texture);
      } catch (error) {
        state.bossTextures.set(url, null);
      }
    }));
  }

  function updateTargetTooltip() {
    updateSelectedWorldActivityTooltip();

    const tooltip = elements.worldTargetTooltip;
    const target = state.selectedTarget;
    const path = state.selectedPath || [];
    const event = target ? getEventAt(target) : null;
    const sign = target ? getSignAt(target) : null;
    const isPortalTarget = isDarknessPortalEvent(event);
    if (!tooltip) return;

    if (!target || (!isPortalTarget && !sign && path.length < 2) || state.moving || !state.viewport || state.selectedEncounter || state.selectedBoss) {
      tooltip.classList.add('d-none');
      return;
    }

    const center = tileCenter(target);
    const scale = state.viewport.scale.x || 1;
    const x = state.viewport.x + center.x * scale;
    const y = state.viewport.y + center.y * scale;

    tooltip.innerHTML = renderTargetTooltipContent(target, path);
    tooltip.classList.toggle('has-actions', isPortalTarget);
    tooltip.style.left = `${Math.round(x)}px`;
    tooltip.style.top = `${Math.round(y)}px`;
    tooltip.classList.remove('d-none');
  }

  function renderTargetTooltipContent(target, path) {
    const event = getEventAt(target);
    const sign = getSignAt(target);
    const isPortalTarget = isDarknessPortalEvent(event);
    const isCurrentSign = Boolean(sign && positionsEqual(target, state.position));
    const stepCount = isPortalTarget
      ? getTileDistance(state.position, target)
      : getPathStepCount(path);
    const meta = escapeHtml(formatTravelMeta(target, stepCount));
    const header = `
      <strong class="world-tooltip-title">${isCurrentSign ? 'Trail Sign' : (isPortalTarget ? 'Teleport to' : 'Travel to')}</strong>
      <span class="world-tooltip-meta">${meta}</span>
    `;
    const travelHint = isPortalTarget || isCurrentSign ? '' : '<span class="world-tooltip-hint">(Click again to travel)</span>';

    if (sign) {
      return `
        ${header}
        ${isCurrentSign ? '' : '<span class="world-target-event-type">Trail Sign</span>'}
        <span class="world-target-event-copy">${escapeHtml(getSignMessage(sign))}</span>
        ${travelHint}
      `;
    }

    if (!event) return `${header}${travelHint}`;
    const eventLabel = getEventLabel(event.type);
    const eventTitle = String(event.title || '').trim();
    const eventTitleMarkup = eventTitle && eventTitle !== eventLabel
      ? `<span class="world-target-event-title">${escapeHtml(eventTitle)}</span>`
      : '';

    return `
      ${header}
      <span class="world-target-event-type">${escapeHtml(eventLabel)}</span>
      ${eventTitleMarkup}
      ${event.description ? `<span class="world-target-event-copy">${escapeHtml(event.description)}</span>` : ''}
      ${isDarknessPortalEvent(event) ? renderDarknessPortalSummonAction(event) : ''}
      ${travelHint}
    `;
  }

  function renderDarknessPortalSummonAction(event) {
    const cost = getDarknessPortalSummonCost(event);
    const souls = getPlayerSoulBalance();
    const canAfford = souls === null || souls >= cost;
    const disabled = state.summoningPortal || !canAfford;
    const title = canAfford
      ? `Summon to this Darkness Portal for ${formatSoulCount(cost)}.`
      : `Summon costs ${formatSoulCount(cost)}.`;

    return `
      <span class="world-target-summon-cost">Cost: ${escapeHtml(formatSoulCount(cost))}</span>
      <button class="btn btn-warning btn-sm world-target-summon-button" type="button"
        data-summon-portal data-summon-portal-x="${escapeAttribute(event.x)}" data-summon-portal-y="${escapeAttribute(event.y)}"
        title="${escapeAttribute(title)}" ${disabled ? 'disabled' : ''}>
        ${renderIcon('sparkles')}
        <span>Summon</span>
      </button>
    `;
  }

  function showEncounterTooltip(encounter) {
    state.selectedEncounter = encounter;
    state.selectedBoss = null;
    renderEncounterTooltip();
    updateEncounterTooltip();
  }

  function hideEncounterTooltip() {
    if (!state.selectedEncounter) return;
    state.selectedEncounter = null;
    if (!state.selectedBoss) elements.worldEncounterTooltip?.classList.add('d-none');
  }

  function showBossTooltip(boss) {
    state.selectedBoss = boss;
    state.selectedEncounter = null;
    renderBossTooltip();
    updateBossTooltip();
  }

  function hideBossTooltip() {
    if (!state.selectedBoss) return;
    state.selectedBoss = null;
    if (!state.selectedEncounter) elements.worldEncounterTooltip?.classList.add('d-none');
  }

  function hideWorldActivityTooltip() {
    state.selectedEncounter = null;
    state.selectedBoss = null;
    elements.worldEncounterTooltip?.classList.add('d-none');
  }

  function updateSelectedWorldActivityTooltip() {
    if (state.selectedBoss) {
      updateBossTooltip();
      return;
    }
    updateEncounterTooltip();
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
      ${renderEncounterTitle(encounter, 'world-tooltip-title')}
      <span class="world-tooltip-meta">${escapeHtml(formatTravelMeta(encounter, stepCount))}</span>
      ${demons ? `<div class="world-enc-demons">${demons}</div>` : ''}
      <div class="world-enc-difficulty is-${meterTone}">
        <span class="world-enc-difficulty-label">Threat</span>
        <span class="world-enc-meter" aria-label="Threat ${difficulty} of 10">${meter}</span>
      </div>
      <span class="world-tooltip-hint">(Click again to travel)</span>
    `;
  }

  function renderBossTooltip() {
    const tooltip = elements.worldEncounterTooltip;
    const boss = state.selectedBoss;
    if (!tooltip || !boss) return;

    const team = Array.isArray(boss.team) ? boss.team : [];
    const stepCount = positionsEqual(boss, state.position)
      ? 0
      : getPathStepCount(state.selectedPath || []);
    const formation = renderBossFormationPreview(team);
    const reward = renderBossRewardLine(boss.rewardBuff, { compact: true });
    const travelHint = positionsEqual(boss, state.position)
      ? '<span class="world-tooltip-hint">Challenge from the sidebar.</span>'
      : '<span class="world-tooltip-hint">(Click again to travel)</span>';

    tooltip.innerHTML = `
      ${renderBossTitle(boss, 'world-tooltip-title')}
      <span class="world-tooltip-meta">${escapeHtml(formatTravelMeta(boss, stepCount))}</span>
      ${formation}
      ${reward}
      ${travelHint}
    `;
  }

  function renderBossFormationPreview(team = []) {
    const assignments = getWorldBattleFormationAssignments(team, 'enemy');
    if (!assignments.size) return '';

    const displayAssignments = new Map();
    assignments.forEach((demon, slot) => {
      const row = Math.floor(slot / FORMATION_GRID_COLUMNS);
      const column = slot % FORMATION_GRID_COLUMNS;
      const mirroredSlot = row * FORMATION_GRID_COLUMNS + (FORMATION_GRID_COLUMNS - 1 - column);
      displayAssignments.set(mirroredSlot, demon);
    });

    return `
      <div class="world-boss-formation" role="group" aria-label="Boss formation; front row is on the right">
        <div class="world-boss-formation-grid">
          ${Array.from({ length: FORMATION_GRID_SIZE }, (item, slot) => {
            const demon = displayAssignments.get(slot);
            return `<span class="world-boss-formation-cell${demon ? ' has-demon' : ''}">${demon ? renderDemonPortrait(demon) : ''}</span>`;
          }).join('')}
        </div>
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

  function updateBossTooltip() {
    const tooltip = elements.worldEncounterTooltip;
    const boss = state.selectedBoss;
    if (!tooltip) return;

    if (!boss || state.moving || !state.viewport) {
      tooltip.classList.add('d-none');
      return;
    }

    const center = tileCenter(boss);
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
      void refreshHuntStatus().catch(() => {});
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

    // Keep the interactive card stable while its live values tick. Replacing
    // the whole sidebar here used to detach the End Hunt button once a second,
    // which could swallow clicks that straddled a refresh.
    updateActiveHuntReadout();
    updateHuntTooltip();
    void refreshHuntStatus({ render: false })
      .then(() => {
        if (!isHuntActive()) {
          renderEncounterPanel();
          syncHuntTicker();
          return;
        }
        updateActiveHuntReadout();
      })
      .catch(() => {});
  }

  function updateActiveHuntReadout() {
    const card = elements.worldEncounterList?.querySelector('.world-active-hunt-card');
    if (!card) return;

    const progress = computeHuntProgress();
    if (!progress) return;

    const rate = computeHuntRate(getActiveHuntEncounter());
    const progressElement = card.querySelector('.world-hunt-progress');
    const progressFill = progressElement?.querySelector('.world-hunt-progress-fill');
    const rewardRows = card.querySelectorAll('.world-hunt-reward-row');
    const perKillRow = rewardRows[0];
    const earnedRow = rewardRows[1];

    if (progressElement && progressFill) {
      const { progressPercent, roundedProgress } = getHuntProgressDisplay(progress, rate);
      progressElement.setAttribute('aria-valuenow', String(roundedProgress));
      progressFill.style.setProperty('--hunt-progress', `${progressPercent.toFixed(2)}%`);
    }

    const passiveXpPerKill = Math.max(1, Math.floor(rate.xpPerCycle * PASSIVE_HUNT_XP_MULTIPLIER));
    setText(perKillRow?.querySelector('.world-hunt-xp-value'), `${formatNumber(passiveXpPerKill)} XP`);
    setText(perKillRow?.querySelector('.world-hunt-souls-value'), formatSoulCount(rate.soulsPerCycle));
    setText(earnedRow?.querySelector('.world-hunt-xp-value'), `${formatNumber(progress.accruedXp)} XP`);
    updateHuntEarnedSouls(earnedRow?.querySelector('.world-hunt-souls-value'), progress);
  }

  function updateHuntEarnedSouls(element, progress) {
    if (!element) return;

    const capacity = Number(progress?.soulCapacity);
    const displayedSouls = Math.max(0, Number(progress?.accruedSouls) || 0);
    const vesselAmount = element.querySelector('.world-hunt-vessel-amount');

    if (!Number.isFinite(capacity) || capacity <= 0) {
      if (vesselAmount) {
        element.outerHTML = renderHuntEarnedSouls(progress, displayedSouls);
      } else {
        setText(element, formatSoulCount(displayedSouls));
      }
      return;
    }

    if (!vesselAmount) {
      element.outerHTML = renderHuntEarnedSouls(progress, displayedSouls);
      return;
    }

    const full = Boolean(progress?.vesselFull) || displayedSouls >= capacity;
    const tooltip = full
      ? 'Your Soul Vessel is full. End the hunt to bank souls, or expand the vessel in the skill tree.'
      : 'Souls banked while hunting are held in your Soul Vessel. When it fills, souls stop accruing until the hunt ends.';

    element.classList.toggle('is-vessel-full', full);
    element.dataset.tooltip = tooltip;
    element.title = tooltip;
    element.setAttribute('aria-label', tooltip);
    setText(vesselAmount, `${formatNumber(displayedSouls)} / ${formatNumber(capacity)} Souls`);
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
    const next = `Next kill in ${formatDuration(progress.secondsToNext)}`;

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

  function maybeShowWorldBossIntro() {
    if (!elements.worldBossDialog || isWorldBossIntroMuted()) return;
    const bosses = state.bosses || [];
    if (!bosses.length) return;
    const boss = bosses[Math.floor(Math.random() * bosses.length)];
    showWorldBossIntro(boss);
  }

  function isWorldBossIntroMuted() {
    try {
      const mutedUntil = Number(window.localStorage.getItem(WORLD_BOSS_INTRO_MUTE_KEY));
      if (Number.isFinite(mutedUntil) && Date.now() < mutedUntil) return true;
      if (mutedUntil) window.localStorage.removeItem(WORLD_BOSS_INTRO_MUTE_KEY);
    } catch (error) {
      /* Storage unavailable: treat as unmuted. */
    }
    return false;
  }

  function setWorldBossIntroMuted(muted) {
    try {
      if (muted) {
        window.localStorage.setItem(WORLD_BOSS_INTRO_MUTE_KEY, String(Date.now() + WORLD_BOSS_INTRO_MUTE_MS));
      } else {
        window.localStorage.removeItem(WORLD_BOSS_INTRO_MUTE_KEY);
      }
    } catch (error) {
      /* Storage unavailable: the mute simply won't persist. */
    }
  }

  function showWorldBossIntro(boss) {
    const dialog = elements.worldBossDialog;
    if (!dialog) return;

    const lines = boss.taunts?.length ? boss.taunts : WORLD_BOSS_INTRO_FALLBACK_LINES;
    audio?.play('sfx.bosses.introStinger', { volume: 0.9, queueUntilUnlock: true });
    const line = lines[Math.floor(Math.random() * lines.length)];
    setText(elements.worldBossDialogName, boss.title || 'World Boss');

    const keyDemon = boss.keyDemon || (Array.isArray(boss.team) ? boss.team[0] : null);
    const keyDemonRarity = String(keyDemon?.rarity || 'common').toLowerCase();
    const demonLabel = elements.worldBossDialogDemon;
    if (demonLabel) {
      const species = keyDemon?.species || keyDemon?.typeName || keyDemon?.name || '';
      if (keyDemonRarity && species) {
        demonLabel.innerHTML = `<span class="world-boss-dialog-rarity" style="color:${rarityCss(keyDemonRarity)}">${escapeHtml(capitalize(keyDemonRarity))}</span> ${escapeHtml(species)}`;
        demonLabel.classList.remove('d-none');
      } else {
        demonLabel.innerHTML = '';
        demonLabel.classList.add('d-none');
      }
    }

    const portrait = elements.worldBossDialogPortrait;
    if (portrait) {
      portrait.closest('.world-boss-dialog-portrait-frame')
        ?.style.setProperty('--rarity-color', rarityCss(keyDemonRarity));
      const mapUrl = keyDemon?.imageUrl || '';
      portrait.onerror = () => {
        portrait.onerror = null;
        if (mapUrl) portrait.src = mapUrl;
      };
      portrait.src = toDemonPortraitUrl(mapUrl) || DEFAULT_PROFILE_IMAGE_URL;
    }

    state.bossIntro = { line, index: 0, timer: null };
    if (elements.worldBossDialogMute) elements.worldBossDialogMute.checked = false;
    setText(elements.worldBossDialogText, '');
    dialog.classList.remove('d-none', 'is-ready');
    dialog.classList.add('is-typing');
    document.addEventListener('keydown', onWorldBossIntroKeydown);

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      completeWorldBossIntroTyping();
      return;
    }

    state.bossIntro.timer = window.setInterval(() => {
      const intro = state.bossIntro;
      if (!intro) return;
      intro.index += 1;
      setText(elements.worldBossDialogText, intro.line.slice(0, intro.index));
      if (intro.index >= intro.line.length) completeWorldBossIntroTyping();
    }, WORLD_BOSS_INTRO_TYPE_MS);
  }

  function completeWorldBossIntroTyping() {
    const intro = state.bossIntro;
    if (!intro) return;
    if (intro.timer) {
      window.clearInterval(intro.timer);
      intro.timer = null;
    }
    intro.index = intro.line.length;
    setText(elements.worldBossDialogText, intro.line);
    elements.worldBossDialog?.classList.remove('is-typing');
    elements.worldBossDialog?.classList.add('is-ready');
    elements.worldBossDialogContinue?.focus?.({ preventScroll: true });
  }

  function dismissWorldBossIntro() {
    const dialog = elements.worldBossDialog;
    if (state.bossIntro?.timer) window.clearInterval(state.bossIntro.timer);
    state.bossIntro = null;
    dialog?.classList.add('d-none');
    dialog?.classList.remove('is-typing', 'is-ready');
    document.removeEventListener('keydown', onWorldBossIntroKeydown);
  }

  // Advance = finish the typewriter if it's still running, dismiss otherwise.
  // Only the Continue button and the keyboard trigger this; clicks elsewhere
  // on the overlay deliberately do nothing.
  function onWorldBossIntroAdvance() {
    const intro = state.bossIntro;
    if (!intro) return;
    if (intro.index < intro.line.length) {
      completeWorldBossIntroTyping();
      return;
    }
    dismissWorldBossIntro();
  }

  function onWorldBossIntroKeydown(event) {
    if (!state.bossIntro) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissWorldBossIntro();
      return;
    }
    // Leave Space alone on the checkbox so the keyboard can toggle it.
    if (event.target === elements.worldBossDialogMute) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onWorldBossIntroAdvance();
    }
  }

  // Dialog portraits want more pixels than the tiny world-map tokens, so swap
  // the map WebP for the 512px portrait variant when the URL matches.
  function toDemonPortraitUrl(url) {
    const match = /^\/app\/images\/demons\/map\/(\d+)\.webp$/.exec(String(url || ''));
    return match ? `/app/images/demons/portrait/${match[1]}.webp` : url;
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

  function setButtonBusy(button, busy, busyText = '') {
    if (!button) return;

    if (busy && busyText) {
      if (!Object.prototype.hasOwnProperty.call(button.dataset, 'busyOriginalHtml')) {
        button.dataset.busyOriginalHtml = button.innerHTML;
      }
      button.textContent = busyText;
    } else if (!busy && Object.prototype.hasOwnProperty.call(button.dataset, 'busyOriginalHtml')) {
      button.innerHTML = button.dataset.busyOriginalHtml;
      delete button.dataset.busyOriginalHtml;
    }

    button.disabled = busy;
    button.classList.toggle('is-busy', busy);
    if (busy) {
      button.setAttribute('aria-busy', 'true');
    } else {
      button.removeAttribute('aria-busy');
    }
  }

  function setMessage(text, type) {
    if (!elements.appMessage) return;
    window.AmongDemons.setGameAlert(elements.appMessage, text, { type });
  }

  function handleAuthError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      window.location.href = appUrl('/login');
      return;
    }

    console.error(error);
    setMessage(error, 'danger');
  }

  function destroyWorld() {
    state.cleanup.splice(0).forEach((cleanup) => cleanup());
    if (state.bossRefreshTimer) {
      window.clearTimeout(state.bossRefreshTimer);
      state.bossRefreshTimer = null;
    }
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    state.sidePanelResizeObserver?.disconnect();
    state.sidePanelResizeObserver = null;

    state.app?.ticker?.remove(updatePathPulse);
    state.app?.ticker?.remove(updateShrineGlow);
    state.app?.ticker?.remove(updatePortalGlow);
    state.app?.ticker?.remove(updateBossAura);
    state.app?.ticker?.remove(updatePuddleFx);
    state.tileTextures.forEach((texture) => texture?.destroy?.(true));
    state.tileTextures.clear();
    state.bossTextures.forEach((texture) => texture?.destroy?.(true));
    state.bossTextures.clear();
    state.puddleFxTiles = [];
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
    return `Area ${formatCoords(position)} · ${formatStepCount(stepCount)}`;
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

  function formatTooltipAttribute(value) {
    return escapeAttribute(value).replace(/\n/g, '&#10;');
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
