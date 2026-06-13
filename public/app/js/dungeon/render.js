import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon, renderSoulAmount } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, setElementHtml, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const battle = (...args) => dungeonActions.battle(...args);
const bindCollectionReinforcementPlaceholders = (...args) => dungeonActions.bindCollectionReinforcementPlaceholders(...args);
const bindDemonDetailCards = (...args) => dungeonActions.bindDemonDetailCards(...args);
const bindFormationDragAndDrop = (...args) => dungeonActions.bindFormationDragAndDrop(...args);
const bindPointerDragAndDrop = (...args) => dungeonActions.bindPointerDragAndDrop(...args);
const bindRecruitDragAndDrop = (...args) => dungeonActions.bindRecruitDragAndDrop(...args);
const bindRewardDragAndDrop = (...args) => dungeonActions.bindRewardDragAndDrop(...args);
const canExtractRun = (...args) => dungeonActions.canExtractRun(...args);
const formatBattleSpeed = (...args) => dungeonActions.formatBattleSpeed(...args);
const getRecruitPreviewEnemyTeam = (...args) => dungeonActions.getRecruitPreviewEnemyTeam(...args);
const getRecruitPreviewHand = (...args) => dungeonActions.getRecruitPreviewHand(...args);
const getRecruitPreviewTeam = (...args) => dungeonActions.getRecruitPreviewTeam(...args);
const getRecruitTeamLimit = (...args) => dungeonActions.getRecruitTeamLimit(...args);
const groupCombatLog = (...args) => dungeonActions.groupCombatLog(...args);
const hasPendingBuffChoices = (...args) => dungeonActions.hasPendingBuffChoices(...args);
const init = (...args) => dungeonActions.init(...args);
const isCurrentFloorBattle = (...args) => dungeonActions.isCurrentFloorBattle(...args);
const pauseCombatPlayback = (...args) => dungeonActions.pauseCombatPlayback(...args);
const playEnemyRevealEffect = (...args) => dungeonActions.playEnemyRevealEffect(...args);
const playPendingHandFlowAnimation = (...args) => dungeonActions.playPendingHandFlowAnimation(...args);
const playRecruitSwapEffect = (...args) => dungeonActions.playRecruitSwapEffect(...args);
const renderButtonMeleeIcon = (...args) => dungeonActions.renderButtonMeleeIcon(...args);
const renderDemonCard = (...args) => dungeonActions.renderDemonCard(...args);
const renderDemonCards = (...args) => dungeonActions.renderDemonCards(...args);
const renderDungeonDemonCard = (...args) => dungeonActions.renderDungeonDemonCard(...args);
const bindActivePactTooltips = (...args) => dungeonActions.bindActivePactTooltips(...args);
const renderDemonicPacts = (...args) => dungeonActions.renderDemonicPacts(...args);
const renderEmptyText = (...args) => dungeonActions.renderEmptyText(...args);
const renderFightLogRow = (...args) => dungeonActions.renderFightLogRow(...args);
const renderHandBar = (...args) => dungeonActions.renderHandBar(...args);
const renderRewardBox = (...args) => dungeonActions.renderRewardBox(...args);
const replayFight = (...args) => dungeonActions.replayFight(...args);
const requestRecruitContinue = (...args) => dungeonActions.requestRecruitContinue(...args);
const resumeCombatPlayback = (...args) => dungeonActions.resumeCombatPlayback(...args);
const setBattleSpeed = (...args) => dungeonActions.setBattleSpeed(...args);
const startNewDungeonAfterDefeat = (...args) => dungeonActions.startNewDungeonAfterDefeat(...args);
const startRun = (...args) => dungeonActions.startRun(...args);
const stepCombatPlayback = (...args) => dungeonActions.stepCombatPlayback(...args);

function renderPlayer() {
  const player = state.player || {};
  elements.navPlayerName.textContent = player.username || '';
}

function setDungeonLoading(isLoading) {
  state.isLoading = Boolean(isLoading);
  renderRun();
}

function renderRun() {
  const run = state.run;
  const hasRun = Boolean(run);

  if (elements.runLoading) elements.runLoading.classList.toggle('d-none', !state.isLoading);
  elements.runEmpty.classList.toggle('d-none', state.isLoading || hasRun);
  elements.runPanel.classList.toggle('d-none', state.isLoading || !hasRun);
  elements.dungeonTitle.innerHTML = renderDungeonTitle(run);
  renderDungeonRewardStrip();
  showCombatPanel();

  if (state.isLoading) {
    if (laneResizeObserver) laneResizeObserver.disconnect();
    elements.fightLog.innerHTML = 'Loading latest dungeon state...';
    elements.fightLog.classList.add('text-muted');
    renderDemonicPacts(false);
    renderFightLogActions();
    syncActionButtons();
    return;
  }

  if (!run) {
    if (laneResizeObserver) laneResizeObserver.disconnect();
    elements.runPanel?.classList.remove('has-hand');
    elements.runPanel?.querySelector('.dungeon-arena')?.classList.remove('is-hand-strategy');
    elements.dungeonBottomPanel?.classList.add('d-none');
    elements.dungeonHandBar?.classList.add('d-none');
    elements.dungeonRewardBox?.classList.add('d-none');
    renderDemonicPacts(false);
    renderTeamSideTitle();
    renderEnemySideTitle();
    updateDungeonJoiner();
    elements.runEmpty.innerHTML = state.endSummary ? renderDungeonEndScreen() : renderEmptyText('Preparing dungeon...');
    bindDungeonEmptyButtons();
    renderFightLog();
    renderFightLogActions();
    syncActionButtons();
    return;
  }

  const hasPendingPacts = hasPendingBuffChoices(run);
  const isHandStrategy = Boolean(state.isRecruiting && run.awaitingRecruit);
  const arena = elements.runPanel?.querySelector('.dungeon-arena');
  const team = isHandStrategy ? getRecruitPreviewTeam() : run.team || [];
  const enemies = isHandStrategy && state.isEnemyPreviewDeferred ? [] : (isHandStrategy ? getRecruitPreviewEnemyTeam() : run.enemies || []);
  const isBattleHandPlaceholder = Boolean(!isHandStrategy && state.isBattleAnimating);
  const hand = isHandStrategy ? getRecruitPreviewHand() : [];
  const handMode = isBattleHandPlaceholder ? 'battle' : 'recruit';
  const showPacts = Boolean(hasPendingPacts && !state.isPactRevealPending && !state.isBattleAnimating && !state.isResultAnimating);
  const showHand = true;
  const handInteractive = Boolean(isHandStrategy && !showPacts);
  const rewardInteractive = handInteractive;
  const canExtract = Boolean(!hasPendingPacts && !state.isResultAnimating && canExtractRun());
  const teamGridStyle = getCurrentFormationGridInlineStyle(elements.teamGrid);
  const enemyGridStyle = getCurrentFormationGridInlineStyle(elements.enemyGrid);
  const teamGridRenderKey = [
    'player',
    run.awaitingRecruit ? 'recruit' : 'battle',
    state.isRecruiting ? 'interactive' : 'locked',
    hasPendingPacts ? 'pacts' : 'ready'
  ].join(':');

  elements.runPanel?.classList.toggle('has-hand', showHand);
  elements.dungeonBottomPanel?.classList.toggle('d-none', !showHand);
  arena?.classList.toggle('is-hand-strategy', isHandStrategy);
  setElementHtml(elements.teamGrid, renderDemonCards(team, {
    side: 'player',
    allowFormationDrag: run.status === 'active' && (!run.awaitingRecruit || (state.isRecruiting && !hasPendingPacts)),
    gridStyle: teamGridStyle
  }), { patchFormationGrid: true, renderKey: teamGridRenderKey });
  setElementHtml(elements.enemyGrid, renderDemonCards((isHandStrategy || (run.team || []).length) ? enemies : [], {
    side: 'enemy',
    allowRecruitDrag: false,
    gridStyle: enemyGridStyle
  }), { patchFormationGrid: true, renderKey: 'enemy' });
  renderHandBar(hand, showHand, handInteractive, handMode);
  renderRewardBox(showHand, rewardInteractive, canExtract);
  renderDemonicPacts(showPacts);
  renderTeamSideTitle(isHandStrategy ? team.length : null, isHandStrategy ? getRecruitTeamLimit() : null);
  renderEnemySideTitle(isHandStrategy ? run.nextEnemyPressure : run.enemyPressure);
  updateDungeonJoiner();
  bindFormationDragAndDrop();
  bindRecruitDragAndDrop();
  bindRewardDragAndDrop();
  bindPointerDragAndDrop();
  bindCollectionReinforcementPlaceholders();
  bindDemonDetailCards();
  bindActivePactTooltips();
  playRecruitSwapEffect();
  playEnemyRevealEffect();
  watchFormationLaneSizing();
  renderFightLog();
  renderFightLogActions();
  syncActionButtons();
  playPendingHandFlowAnimation(isHandStrategy);
}

function renderDungeonTitle(run) {
  const floor = run ? Math.max(1, Number(run.currentFloor) || 1) : 1;

  return `
    <span class="dungeon-title-brand">
      <a class="dungeon-header-brand" href="/camp" aria-label="Back to camp">
        ${renderIcon('back')}
        <img src="/app/images/amongdemons_logo_250x250.png" alt="Among Demons logo" width="32" height="32" loading="eager">
      </a>
      <span class="dungeon-title-copy">
        <span class="dungeon-title-text">Dungeon</span>
        ${run ? `<span class="dungeon-floor-title">
          <span class="dungeon-floor-label">Floor ${floor}</span>
        </span>` : ''}
      </span>
    </span>
  `;
}

function renderDungeonEndScreen() {
  const summary = state.endSummary || {};
  const demon = summary.demon;
  const isDefeat = summary.outcome === 'defeat';
  const eyebrow = isDefeat ? 'Defeat' : 'Extraction';

  return `
    <div class="dungeon-end-screen ${isDefeat ? 'is-defeat' : 'is-extraction'}">
      <div class="dungeon-end-copy">
        <span class="dungeon-phase-eyebrow">${eyebrow}</span>
        <h2>${escapeHtml(summary.title || 'Dungeon ended')}</h2>
        <p>${escapeHtml(summary.message || 'Run extracted.')}</p>
      </div>
      ${demon ? `
        <div class="dungeon-end-demon" aria-label="Collected demon">
          ${renderDungeonDemonCard(demon, {
            className: 'dungeon-end-demon-card',
            suppressCollectionMissingTag: true,
            attributes: { 'data-instance-id': demon.instanceId || `end-${demon.id || 'demon'}` }
          })}
        </div>
      ` : ''}
      <div class="dungeon-end-rewards" aria-label="Rewards obtained">
        ${demon ? `<span>${renderIcon('stars')}${escapeHtml(demon.species || 'Demon')}</span>` : ''}
        <span>${Number(summary.xp) || 0} XP</span>
        ${renderSoulAmount(Number(summary.souls) || 0, { className: 'soul-chip dungeon-end-soul-amount' })}
      </div>
      <div class="dungeon-end-actions">
        <a class="btn btn-outline-light" href="/camp">Leave</a>
        ${state.endedReplayRun?.lastBattle?.combatLog?.length ? `
          <button class="btn btn-warning btn-icon-only" id="replayEndedDungeonBtn" type="button" title="Replay Fight" aria-label="Replay Fight">
            ${renderIcon('replay')}
          </button>
        ` : ''}
        <button class="btn btn-primary" id="startNewDungeonBtn" type="button">
          ${renderIcon('play')}
          Start New Dungeon
        </button>
      </div>
    </div>
  `;
}

function bindDungeonEmptyButtons() {
  bindClick(document.getElementById('startNewDungeonBtn'), async () => {
    resetEndState();
    await startRun();
    renderRun();
  });
  bindClick(document.getElementById('replayEndedDungeonBtn'), replayFight);
}

function renderFightLog() {
  const logRows = state.combatLog.length
    ? groupCombatLog(state.combatLog).map((step, index) => `
      ${renderFightLogRow(step, index)}
    `).join('')
    : '';
  const logContent = logRows + renderEndNotice();

  if (!logContent.trim()) {
    elements.fightLog.innerHTML = 'Fight log will appear here after a battle.';
    elements.fightLog.classList.add('text-muted');
    return;
  }

  elements.fightLog.classList.remove('text-muted');
  elements.fightLog.innerHTML = logContent;
}

function showBattleResultOverlay(type) {
  const existing = document.querySelector('.battle-result-burst');
  if (existing) existing.remove();
  state.isResultAnimating = true;
  renderFightLogActions();
  syncActionButtons();

  const overlay = document.createElement('div');
  overlay.className = `battle-result-burst is-${type}`;
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = `
    <div class="battle-result-burst-ring" aria-hidden="true"></div>
    <div class="battle-result-burst-text">${type === 'victory' ? 'Victory' : 'Defeat'}</div>
    <div class="battle-result-burst-sparks" aria-hidden="true">
      ${Array.from({ length: 10 }, () => '<span></span>').join('')}
    </div>
  `;
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    setTimeout(() => {
      overlay.remove();
      state.isResultAnimating = false;
      renderFightLogActions();
      syncActionButtons();
      resolve();
    }, 2200);
  });
}

function renderTeamSideTitle(teamCount = null, teamLimit = null) {
  if (!elements.teamSideTitle) return;

  const countHtml = Number.isFinite(teamCount) && Number.isFinite(teamLimit)
    ? `<span class="battle-side-count" aria-label="${teamCount} of ${teamLimit} team slots used">${teamCount}/${teamLimit}</span>`
    : '';

  elements.teamSideTitle.innerHTML = `<span>Your Team</span>${countHtml ? ` ${countHtml}` : ''}`;
}

function renderEnemySideTitle(pressure = null) {
  if (!elements.enemySideTitle) return;

  elements.enemySideTitle.innerHTML = `<span>Enemies</span>${renderEnemyPressureChip(pressure)}`;
}

function renderEnemyPressureChip(pressure = null) {
  if (!pressure?.active) return '';

  const hpBonus = formatBonusPercent(pressure.hpBonusPct);
  const atkBonus = formatBonusPercent(pressure.atkBonusPct);
  const speedBonus = formatBonusPercent(pressure.speedBonusPct);
  const level = Math.max(0, Math.round(Number(pressure.level) || 0));
  if (level <= 0) return '';

  const tooltip = [
    `Terror ${level}`,
    'Demons grow stronger in darkness.',
    `Enemy HP ${hpBonus}`,
    `Enemy Attack ${atkBonus}`,
    `Enemy Speed ${speedBonus}`
  ].join('\n');
  const escapedTooltip = escapeTooltipAttribute(tooltip);

  return `
    <span
      class="enemy-pressure-chip"
      tabindex="0"
      data-tooltip="${escapedTooltip}"
      aria-label="${escapedTooltip}"
    >
      <span>Terror</span>
      <strong>${escapeHtml(String(level))}</strong>
    </span>
  `;
}

function formatBonusPercent(value) {
  return `+${Math.max(0, Math.round(Number(value) || 0))}%`;
}

function escapeTooltipAttribute(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;');
}

function updateDungeonJoiner() {
  if (!elements.dungeonJoiner) return;
  elements.dungeonJoiner.classList.remove('is-recruiting');
  elements.dungeonJoiner.innerHTML = '<span>VS</span>';
}

function showCombatPanel() {
  setBattlePanel('combat');
}

function toggleFightLogPanel() {
  const isLogActive = document.getElementById('battleLogPanel')?.classList.contains('show');
  setBattlePanel(isLogActive ? 'combat' : 'log');
}

function setBattlePanel(panel) {
  const showLog = panel === 'log';
  document.getElementById('combatPanel')?.classList.toggle('show', !showLog);
  document.getElementById('combatPanel')?.classList.toggle('active', !showLog);
  document.getElementById('battleLogPanel')?.classList.toggle('show', showLog);
  document.getElementById('battleLogPanel')?.classList.toggle('active', showLog);
}

function watchFormationLaneSizing() {
  if (laneResizeObserver) laneResizeObserver.disconnect();
  const lanes = Array.from(document.querySelectorAll('.battle-side .formation-lane-cards'));
  const formationSizingTargets = Array.from(document.querySelectorAll('.battle-side > #teamGrid, .battle-side > #enemyGrid'));
  if (!lanes.length && !formationSizingTargets.length) return;

  const observer = new ResizeObserver(() => syncCompressedFormationLanes());
  setLaneResizeObserver(observer);
  lanes.forEach((lane) => observer.observe(lane));
  formationSizingTargets.forEach((target) => observer.observe(target));
  document.querySelectorAll('.battle-side .dungeon-demon-card-image img').forEach((image) => {
    if (!image.complete) image.addEventListener('load', syncCompressedFormationLanes, { once: true });
  });
  syncFormationGridSizing();
  syncCompressedFormationLanes();
}

function syncCompressedFormationLanes() {
  syncFormationGridSizing();
  requestAnimationFrame(() => {
    syncFormationGridSizing();
    const laneAdjustments = [];
    const lanes = Array.from(document.querySelectorAll('.battle-side .formation-lane-cards'));
    lanes.forEach((lane) => {
      const cards = Array.from(lane.querySelectorAll('.dungeon-demon-card'));
      lane.classList.remove('is-compressed');
      lane.style.removeProperty('--dungeon-demon-card-width');
      lane.style.removeProperty('--dungeon-demon-card-height');

      if (!cards.length) return;

      const laneRect = lane.getBoundingClientRect();
      const lastCard = cards[cards.length - 1];
      const overflows = lastCard.getBoundingClientRect().bottom > laneRect.bottom + 1 || lane.scrollHeight > lane.clientHeight + 1;
      if (!overflows) return;

      const gap = parseFloat(getComputedStyle(lane).rowGap || getComputedStyle(lane).gap) || 0;
      const isHorizontalLane = getComputedStyle(lane).flexDirection.startsWith('row');
      const availableCardHeight = isHorizontalLane
        ? laneRect.height
        : (laneRect.height - gap * (cards.length - 1)) / cards.length;
      const availableCardWidth = isHorizontalLane
        ? (laneRect.width - gap * (cards.length - 1)) / cards.length
        : availableCardHeight;
      const nextWidth = Math.max(46, Math.min(148, availableCardHeight, availableCardWidth));
      laneAdjustments.push(nextWidth);
    });

    if (!laneAdjustments.length) return;

    const sharedWidth = Math.min(...laneAdjustments);
    lanes.forEach((lane) => {
      lane.style.setProperty('--dungeon-demon-card-width', `${sharedWidth}px`);
      lane.style.setProperty('--dungeon-demon-card-height', `${sharedWidth}px`);
      lane.classList.add('is-compressed');
    });
  });
}

function syncFormationGridSizing() {
  const grids = Array.from(document.querySelectorAll('.battle-side .battle-formation-grid'));
  grids.forEach((grid) => {
    const container = grid.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const style = getComputedStyle(grid);
    const columns = 3;
    const rows = 3;
    const cardHeightRatio = 1;
    const gap = cssPixels(style.gap || style.rowGap || style.columnGap);
    const paddingX = cssPixels(style.paddingLeft) + cssPixels(style.paddingRight);
    const paddingY = cssPixels(style.paddingTop) + cssPixels(style.paddingBottom);
    const widthFromContainer = (rect.width - paddingX - gap * (columns - 1)) / columns;
    const widthFromHeight = (rect.height - paddingY - gap * (rows - 1)) / (rows * cardHeightRatio);
    const nextWidth = Math.max(42, Math.min(190, widthFromContainer, widthFromHeight));

    if (!Number.isFinite(nextWidth)) return;
    setFormationGridCardSize(grid, nextWidth, nextWidth * cardHeightRatio);
  });
}

function getCurrentFormationGridInlineStyle(container) {
  const grid = container?.querySelector?.('.battle-formation-grid');
  const width = grid?.style.getPropertyValue('--dungeon-demon-card-width');
  const height = grid?.style.getPropertyValue('--dungeon-demon-card-height');
  if (!width || !height) return '';
  return `--dungeon-demon-card-width: ${width}; --dungeon-demon-card-height: ${height};`;
}

function setFormationGridCardSize(grid, width, height) {
  const widthValue = `${width}px`;
  const heightValue = `${height}px`;

  if (grid.style.getPropertyValue('--dungeon-demon-card-width') !== widthValue) {
    grid.style.setProperty('--dungeon-demon-card-width', widthValue);
  }

  if (grid.style.getPropertyValue('--dungeon-demon-card-height') !== heightValue) {
    grid.style.setProperty('--dungeon-demon-card-height', heightValue);
  }
}

function cssPixels(value) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function renderDungeonRewardStrip() {
  if (!elements.dungeonRewardStrip) return;
  elements.dungeonRewardStrip.innerHTML = '';
}

function renderEndNotice() {
  if (!state.endNotice) return '';

  const className = state.endNotice.type === 'warning'
    ? 'fight-log-notice fight-log-end-notice text-warning'
    : 'fight-log-notice fight-log-end-notice text-success';

  return `<div class="${className}">${state.endNotice.html || escapeHtml(state.endNotice.text)}</div>`;
}

function renderFightLogActions() {
  if (state.isLoading) {
    setElementHtml(elements.fightLogActions, `
      <span class="dungeon-loading-status" aria-live="polite">
        <span class="dungeon-loading-dot" aria-hidden="true"></span>
        Loading
      </span>
    `);
    return;
  }

  const isDefeated = state.run?.status === 'defeated';
  const canStart = !state.endSummary && (!state.run || isDefeated || state.run.status === 'ended');
  const canShowSpeedControl = Boolean(
    state.run?.status === 'active' &&
    !state.isResultAnimating &&
    state.isBattleAnimating
  );
  const hasCurrentFightLog = Boolean(isCurrentFloorBattle(state.run) && (state.run?.lastBattle?.combatLog?.length || state.combatLog.length));
  const canReplay = Boolean(!state.isBattleAnimating && !state.isResultAnimating && hasCurrentFightLog);
  const canViewLog = Boolean(!state.isBattleAnimating && !state.isResultAnimating && hasCurrentFightLog);
  const hasPendingPacts = hasPendingBuffChoices(state.run);
  const canChooseRecruit = Boolean(!hasPendingPacts && !state.isResultAnimating && state.run?.awaitingRecruit && state.isRecruiting);

  const actionsChanged = setElementHtml(elements.fightLogActions, `
    ${canShowSpeedControl ? `${renderBattlePlaybackControls()}${renderBattleSpeedControl()}` : ''}
    ${canReplay ? `
      <button class="btn btn-warning btn-sm btn-icon-only" id="fightLogReplayBtn" type="button" title="Replay Fight" aria-label="Replay Fight">
        ${renderIcon('replay')}
      </button>
    ` : ''}
    ${canViewLog ? `
      <button class="btn btn-outline-light btn-sm btn-icon-only" id="fightLogToggleBtn" type="button" title="Fight Log" aria-label="Fight Log">
        ${renderIcon('log')}
      </button>
    ` : ''}
    ${canChooseRecruit ? `
      <button class="btn btn-success btn-sm" id="fightLogContinueDungeonBtn" type="button">
        ${renderButtonMeleeIcon()}
        Continue
      </button>
    ` : ''}
    ${canStart ? `
    <button class="btn btn-primary btn-sm" id="fightLogStartBtn" type="button">
      ${renderIcon('play')}
      ${isDefeated ? 'Start New Dungeon' : 'Start Dungeon'}
    </button>
    ` : ''}
  `);

  if (!actionsChanged) return;

  bindClicks('[data-battle-speed]', (button) => setBattleSpeed(Number(button.dataset.battleSpeed)));
  bindClick(document.getElementById('battlePlaybackToggleBtn'), () => {
    if (state.combatPlayback?.isPaused) {
      resumeCombatPlayback();
    } else {
      pauseCombatPlayback();
    }
  });
  bindClicks('[data-battle-step]', (button) => stepCombatPlayback(Number(button.dataset.battleStep)));
  bindClick(document.getElementById('fightLogStartBtn'), isDefeated ? startNewDungeonAfterDefeat : startRun);
  bindClick(document.getElementById('fightLogReplayBtn'), replayFight);
  bindClick(document.getElementById('fightLogToggleBtn'), toggleFightLogPanel);
  bindPathButtons();
}

function renderBattlePlaybackControls() {
  const playback = state.combatPlayback || {};
  const isPaused = Boolean(playback.isPaused);
  const currentIndex = Number(playback.currentIndex) || 0;
  const totalSteps = Number(playback.totalSteps) || 0;
  const canStepBack = currentIndex > 0;
  const canStepForward = currentIndex < totalSteps;

  return `
    <div class="battle-playback-control" role="group" aria-label="Battle playback">
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="-1"
        title="Last attack"
        aria-label="Last attack"
        ${canStepBack ? '' : 'disabled'}
      >
        ${renderIcon('last-attack')}
      </button>
      <button
        class="battle-playback-btn is-primary"
        id="battlePlaybackToggleBtn"
        type="button"
        title="${isPaused ? 'Play' : 'Pause'}"
        aria-label="${isPaused ? 'Play' : 'Pause'}"
      >
        ${renderIcon(isPaused ? 'play' : 'pause')}
      </button>
      <button
        class="battle-playback-btn"
        type="button"
        data-battle-step="1"
        title="Next attack"
        aria-label="Next attack"
        ${canStepForward ? '' : 'disabled'}
      >
        ${renderIcon('next-attack')}
      </button>
    </div>
  `;
}

function renderBattleSpeedControl() {
  return `
    <div class="battle-speed-control" role="group" aria-label="Battle animation speed">
      ${BATTLE_SPEED_OPTIONS.map((speed) => `
        <button
          class="battle-speed-option ${state.battleSpeed === speed ? 'active' : ''}"
          type="button"
          data-battle-speed="${speed}"
          aria-pressed="${state.battleSpeed === speed ? 'true' : 'false'}"
          title="${formatBattleSpeed(speed)} battle speed"
        >
          ${formatBattleSpeed(speed)}
        </button>
      `).join('')}
    </div>
  `;
}

function bindPathButtons() {
  bindClick(document.getElementById('fightLogContinueDungeonBtn'), requestRecruitContinue);
}

export {
  renderPlayer,
  setDungeonLoading,
  renderRun,
  renderDungeonTitle,
  renderDungeonEndScreen,
  bindDungeonEmptyButtons,
  renderFightLog,
  showBattleResultOverlay,
  renderTeamSideTitle,
  renderEnemySideTitle,
  updateDungeonJoiner,
  showCombatPanel,
  toggleFightLogPanel,
  setBattlePanel,
  watchFormationLaneSizing,
  syncCompressedFormationLanes,
  syncFormationGridSizing,
  renderDungeonRewardStrip,
  renderEndNotice,
  renderFightLogActions,
  renderBattlePlaybackControls,
  renderBattleSpeedControl,
  bindPathButtons
};
