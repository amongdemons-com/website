(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const appUrl = window.AmongDemons.appUrl || ((value) => value);
  const renderSoulAmount = window.AmongDemons.ui?.renderSoulAmount || ((value) => escapeHtml(value));
  const TILE_SIZE = 64;
  const WORLD_RADIUS = 16;
  const DISCOVERY_RADIUS = 4;
  const MIN_ZOOM = 0.55;
  const MAX_ZOOM = 2.15;
  const CLICK_THRESHOLD = 7;
  const STEP_DURATION_MS = 180;
  const BOARD_COLORS = {
    background: 0x0e0b14,
    tileNormal: 0x2a2733,
    tileNormalAlt: 0x252230,
    wall: 0x171022,
    wallEdge: 0x3a2150,
    dangerous: 0x4a1d0e,
    dangerousGlow: 0xff6a2a,
    soulNode: 0x9fd8e6,
    portal: 0x8e44ad,
    portalGlow: 0xc471ed,
    gridLine: 0x000000,
    selection: 0xffe9a8,
    validMove: 0x4fd1ff,
    fog: 0x06040c
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
    'dungeon-portal': BOARD_COLORS.portalGlow
  };

  const state = {
    app: null,
    viewport: null,
    tileLayer: null,
    pathLayer: null,
    markerLayer: null,
    hunterLayer: null,
    effectLayer: null,
    resizeObserver: null,
    cleanup: [],
    position: { x: 0, y: 0 },
    bounds: { min: -WORLD_RADIUS, max: WORLD_RADIUS },
    events: [],
    playersAt: [],
    activeTeam: null,
    currentEvent: null,
    blockedTiles: FALLBACK_BLOCKED_TILES,
    selectedPath: [],
    selectedTarget: null,
    travelLog: [],
    travelStatus: 'idle',
    recentStepEvent: null,
    hunterRenderPosition: null,
    discoveredTiles: new Set(),
    moving: false,
    challengeCooldowns: new Map(),
    initialCameraCentered: false,
    pointer: null
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
      background: '#0e0b14',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    const canvas = app.canvas || app.view;
    canvas.classList.add('world-canvas');
    host.appendChild(canvas);

    state.app = app;
    state.viewport = new Pixi.Container();
    state.tileLayer = new Pixi.Graphics();
    state.pathLayer = new Pixi.Graphics();
    state.markerLayer = new Pixi.Container();
    state.hunterLayer = new Pixi.Graphics();
    state.effectLayer = new Pixi.Graphics();

    state.viewport.addChild(state.tileLayer);
    state.viewport.addChild(state.pathLayer);
    state.viewport.addChild(state.markerLayer);
    state.viewport.addChild(state.hunterLayer);
    state.viewport.addChild(state.effectLayer);
    app.stage.addChild(state.viewport);

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
    state.blockedTiles = Array.isArray(payload.blockedTiles) ? payload.blockedTiles : FALLBACK_BLOCKED_TILES;
    state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
    state.activeTeam = payload.activeTeam || null;
    state.currentEvent = payload.currentEvent || getEventAt(state.position);

    addDiscoveredAround(state.position);
    renderWorld();
    renderPanels();

    if (!state.initialCameraCentered) {
      centerOnHunter();
      state.initialCameraCentered = true;
    }
  }

  async function commitHunterPosition(position, previousPosition) {
    const nextPosition = normalizePosition(position);
    if (!isInBounds(nextPosition)) return;

    state.position = nextPosition;
    state.currentEvent = getEventAt(nextPosition);
    addDiscoveredAround(nextPosition);
    renderWorld();
    renderPanels();

    try {
      const payload = await api('/api/world/move', {
        method: 'POST',
        body: nextPosition
      });

      state.position = normalizePosition(payload.position || nextPosition);
      state.playersAt = Array.isArray(payload.playersAt) ? payload.playersAt : [];
      state.currentEvent = payload.currentEvent || getEventAt(state.position);
      addDiscoveredAround(state.position);
      renderWorld();
      renderPanels();
    } catch (error) {
      if (previousPosition) {
        state.position = previousPosition;
        state.currentEvent = getEventAt(previousPosition);
        renderWorld();
        renderPanels();
      }
      handleAuthError(error);
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
    renderWorld();
    renderTravelPanel();
  }

  async function travelSelectedPath() {
    const path = (state.selectedPath || []).slice();
    if (state.moving || path.length < 2) return;

    const previousPosition = state.position;
    state.moving = true;
    state.travelStatus = 'moving';
    state.travelLog = [];
    state.recentStepEvent = null;
    renderTravelPanel();
    renderWorld();

    try {
      for (let index = 1; index < path.length; index += 1) {
        const step = path[index];
        state.selectedPath = path.slice(index - 1);
        renderWorld();
        await animateHunterStep(step);

        state.selectedPath = path.slice(index);
        const stepEvent = resolveStepEvent(step, index);
        state.recentStepEvent = {
          ...stepEvent,
          position: step
        };
        state.travelLog.unshift(state.recentStepEvent);
        state.currentEvent = getEventAt(step);
        addDiscoveredAround(step);
        renderWorld();
        renderPanels();
        await delay(getStepDelay());
      }

      const finalPosition = state.position;
      clearRoutePreview('arrived', { keepLog: true });
      await commitHunterPosition(finalPosition, previousPosition);
    } finally {
      state.moving = false;
      renderWorld();
      renderPanels();
    }
  }

  function clearRoutePreview(status = 'idle', options = {}) {
    state.selectedTarget = null;
    state.selectedPath = [];
    state.recentStepEvent = null;
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

  function resolveStepEvent(position, stepIndex) {
    // TODO: Replace this deterministic placeholder with server-side travel events.
    const roll = (getTileNoise(position.x, position.y) + stepIndex * 17) % 9;
    return roll === 0
      ? { type: 'ambush', title: 'Ambush' }
      : { type: 'none', title: 'No Event' };
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
    drawTiles();
    drawPath();
    drawMarkers();
    drawStepEffect();
    updateCameraStatus();
  }

  function drawTiles() {
    const layer = state.tileLayer;
    if (!layer) return;

    layer.clear();

    const min = state.bounds.min ?? -WORLD_RADIUS;
    const max = state.bounds.max ?? WORLD_RADIUS;
    for (let y = min; y <= max; y += 1) {
      for (let x = min; x <= max; x += 1) {
        const tileKey = getTileKey({ x, y });
        const blockedTile = getBlockedTile({ x, y });
        const tileEvent = getEventAt({ x, y });
        const discovered = state.discoveredTiles.has(tileKey) || hasEventAt({ x, y });
        const active = state.position.x === x && state.position.y === y;
        const color = blockedTile
          ? BOARD_COLORS.wall
          : active
            ? 0x343142
            : getBoardTileColor(x, y);

        layer.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          .fill({ color, alpha: blockedTile ? 1 : (discovered || active ? 0.96 : 0.9) });

        if (blockedTile) {
          layer.rect(x * TILE_SIZE + 2, y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4)
            .stroke({ color: BOARD_COLORS.wallEdge, width: 3, alpha: 0.8 });
          continue;
        }

        if (tileEvent?.type === 'boss') {
          layer.rect(x * TILE_SIZE + 6, y * TILE_SIZE + 6, TILE_SIZE - 12, TILE_SIZE - 12)
            .fill({ color: BOARD_COLORS.dangerousGlow, alpha: 0.18 });
        } else if (tileEvent?.type === 'soul-cache') {
          layer.circle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.34)
            .fill({ color: BOARD_COLORS.soulNode, alpha: 0.18 });
        } else if (tileEvent?.type === 'dungeon-portal') {
          layer.circle(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE * 0.42)
            .fill({ color: BOARD_COLORS.portalGlow, alpha: 0.2 });
        }

        if (!discovered && !active) {
          layer.rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
            .fill({ color: BOARD_COLORS.fog, alpha: 0.36 });
        }
      }
    }

    for (let x = min; x <= max + 1; x += 1) {
      layer.moveTo(x * TILE_SIZE, min * TILE_SIZE).lineTo(x * TILE_SIZE, (max + 1) * TILE_SIZE);
    }
    for (let y = min; y <= max + 1; y += 1) {
      layer.moveTo(min * TILE_SIZE, y * TILE_SIZE).lineTo((max + 1) * TILE_SIZE, y * TILE_SIZE);
    }
    layer.stroke({ color: BOARD_COLORS.gridLine, width: 1, alpha: 0.35 });
  }

  function drawPath() {
    const layer = state.pathLayer;
    if (!layer) return;

    layer.clear();

    const path = state.selectedPath || [];
    if (path.length < 2) return;

    const pathAlpha = state.moving ? 0.26 : 0.42;
    const centers = path.map(tileCenter);
    layer.moveTo(centers[0].x, centers[0].y);
    centers.slice(1).forEach((point) => layer.lineTo(point.x, point.y));
    layer.stroke({ color: BOARD_COLORS.validMove, width: 4, alpha: pathAlpha });

    path.slice(1, -1).forEach((tile) => {
      const center = tileCenter(tile);
      layer.rect(center.x - TILE_SIZE / 2 + 2, center.y - TILE_SIZE / 2 + 2, TILE_SIZE - 4, TILE_SIZE - 4)
        .fill({ color: BOARD_COLORS.validMove, alpha: state.moving ? 0.08 : 0.14 })
        .stroke({ color: BOARD_COLORS.validMove, width: 2, alpha: state.moving ? 0.32 : 0.66 });
    });

    const target = tileCenter(path[path.length - 1]);
    layer.rect(target.x - 18, target.y - 18, 36, 36)
      .stroke({ color: BOARD_COLORS.selection, width: 3, alpha: state.moving ? 0.32 : 0.86 });
    layer.circle(target.x, target.y, 5).fill({ color: BOARD_COLORS.selection, alpha: state.moving ? 0.28 : 0.76 });
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
      } else {
        marker.circle(0, 0, 16).fill({ color, alpha: 0.28 }).stroke({ color, width: 2, alpha: 0.9 });
        marker.circle(0, 0, 7).fill({ color: 0xbfeaf5, alpha: 0.88 });
      }

      marker.position.set(position.x, position.y);
      layer.addChild(marker);
    });
  }

  function drawHunter() {
    const layer = state.hunterLayer;
    if (!layer) return;

    const center = tileCenter(state.hunterRenderPosition || state.position);
    layer.clear();
    layer.circle(center.x, center.y, 19)
      .fill({ color: 0x050b0e, alpha: 0.96 })
      .stroke({ color: 0xf1b35f, width: 3, alpha: 0.95 });
    layer.circle(center.x, center.y, 9)
      .fill({ color: 0x6fd6bd, alpha: 0.95 })
      .stroke({ color: 0xf8fbf9, width: 1, alpha: 0.64 });
    layer.circle(center.x, center.y, 27)
      .stroke({ color: 0xe78a55, width: 1, alpha: 0.34 });
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
    const target = state.selectedTarget;
    const pathLength = Math.max(0, (state.selectedPath || []).length - 1);
    const statusLabel = getTravelStatusLabel();
    const routeMeta = target && pathLength
      ? `<div class="world-route-summary"><strong>${escapeHtml(statusLabel)}</strong><small>${formatCoords(target)} / ${formatNumber(pathLength)} steps</small></div>`
      : `<p class="world-empty-text">${escapeHtml(statusLabel)}</p>`;

    const logMarkup = logs.length
      ? `<div class="world-travel-log">${logs.slice(0, 5).map(renderTravelLogItem).join('')}</div>`
      : '';

    elements.worldTravelPanel.innerHTML = `${routeMeta}${logMarkup}`;
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

  function getTravelStatusLabel() {
    if (state.travelStatus === 'preview') return 'Route Preview';
    if (state.travelStatus === 'moving') return 'Traveling';
    if (state.travelStatus === 'arrived') return 'Arrived';
    if (state.travelStatus === 'blocked') return 'Blocked';
    return 'No travel yet.';
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
    if (event.button !== 0) return;

    const canvas = event.currentTarget;
    canvas.setPointerCapture?.(event.pointerId);
    state.pointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      dragging: false
    };
  }

  function onPointerMove(event) {
    const pointer = state.pointer;
    if (!pointer || pointer.id !== event.pointerId || !state.viewport) return;

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

  function onPointerUp(event) {
    const pointer = state.pointer;
    if (!pointer || pointer.id !== event.pointerId) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (!pointer.dragging) {
      const tile = screenToTile(event.clientX, event.clientY);
      if (tile && isInBounds(tile)) {
        handleMapTileClick(tile);
      }
    }

    clearPointer();
  }

  function onPointerLeave(event) {
    const pointer = state.pointer;
    if (pointer?.dragging) {
      clearPointer();
    }
  }

  function clearPointer() {
    state.pointer = null;
  }

  function onWheel(event) {
    if (!state.viewport) return;

    event.preventDefault();

    const canvas = state.app?.canvas || state.app?.view;
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const oldScale = state.viewport.scale.x || 1;
    const nextScale = clamp(oldScale * (event.deltaY > 0 ? 0.9 : 1.1), MIN_ZOOM, MAX_ZOOM);

    if (nextScale === oldScale) return;

    const worldX = (screenX - state.viewport.x) / oldScale;
    const worldY = (screenY - state.viewport.y) / oldScale;

    state.viewport.scale.set(nextScale);
    state.viewport.x = screenX - worldX * nextScale;
    state.viewport.y = screenY - worldY * nextScale;
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
    const canvas = state.app?.canvas || state.app?.view;
    if (!canvas || !state.viewport) return null;

    const rect = canvas.getBoundingClientRect();
    const scale = state.viewport.scale.x || 1;
    const worldX = (clientX - rect.left - state.viewport.x) / scale;
    const worldY = (clientY - rect.top - state.viewport.y) / scale;

    return {
      x: Math.floor(worldX / TILE_SIZE),
      y: Math.floor(worldY / TILE_SIZE)
    };
  }

  function addDiscoveredAround(position) {
    for (let y = position.y - DISCOVERY_RADIUS; y <= position.y + DISCOVERY_RADIUS; y += 1) {
      for (let x = position.x - DISCOVERY_RADIUS; x <= position.x + DISCOVERY_RADIUS; x += 1) {
        if (!isInBounds({ x, y })) continue;
        if (Math.hypot(x - position.x, y - position.y) <= DISCOVERY_RADIUS + 0.35) {
          state.discoveredTiles.add(getTileKey({ x, y }));
        }
      }
    }
  }

  function getEventAt(position) {
    return state.events.find((event) => event.x === position.x && event.y === position.y) || null;
  }

  function hasEventAt(position) {
    return Boolean(getEventAt(position));
  }

  function getBlockedTile(position) {
    return (state.blockedTiles || []).find((tile) => tile.x === position.x && tile.y === position.y) || null;
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

  function getBoardTileColor(x, y) {
    return (x + y) % 2 === 0 ? BOARD_COLORS.tileNormal : BOARD_COLORS.tileNormalAlt;
  }

  function getTileNoise(x, y) {
    return ((x * 73856093) ^ (y * 19349663)) >>> 0;
  }

  function getEventLabel(type) {
    if (type === 'boss') return 'Boss Fight';
    if (type === 'soul-cache') return 'Soul Cache';
    if (type === 'dungeon-portal') return 'Dungeon Portal';
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
