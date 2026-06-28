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
const applyAccountStatBonusPreviewToDemon = (...args) => dungeonActions.applyAccountStatBonusPreviewToDemon(...args);
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
  window.AmongDemons.ui?.updateNavAccount?.(player);
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
  renderDungeonRewardStrip();
  showCombatPanel();

  if (state.isLoading) {
    if (laneResizeObserver) laneResizeObserver.disconnect();
    state.isMobileRewardBoxOpen = false;
    elements.dungeonBottomPanel?.classList.remove('is-battle-active', 'is-mobile-reward-open');
    elements.fightLog.innerHTML = 'Loading latest dungeon state...';
    elements.fightLog.classList.add('text-muted');
    renderDemonicPacts(false);
    renderFightLogActions();
    syncActionButtons();
    return;
  }

  if (!run) {
    if (laneResizeObserver) laneResizeObserver.disconnect();
    elements.runPanel?.querySelector('.dungeon-arena')?.classList.remove('is-hand-strategy');
    elements.dungeonBottomPanel?.classList.add('d-none');
    state.isMobileRewardBoxOpen = false;
    elements.dungeonBottomPanel?.classList.remove('is-battle-active', 'is-mobile-reward-open');
    elements.dungeonHandBar?.classList.add('d-none');
    elements.dungeonRewardBox?.classList.add('d-none');
    renderDemonicPacts(false);
    renderTeamSideTitle();
    renderEnemySideTitle();
    updateDungeonJoiner();
    elements.runEmpty.innerHTML = state.endSummary ? renderDungeonEndScreen() : renderDungeonStartPrompt();
    bindDungeonEmptyButtons();
    renderFightLog();
    renderFightLogActions();
    syncActionButtons();
    return;
  }

  const hasPendingPacts = hasPendingBuffChoices(run);
  const isHandStrategy = Boolean(state.isRecruiting && run.awaitingRecruit);
  const arena = elements.runPanel?.querySelector('.dungeon-arena');
  const team = (isHandStrategy ? getRecruitPreviewTeam() : run.team || []).map(applyAccountStatBonusPreviewToDemon);
  const enemies = isHandStrategy && state.isEnemyPreviewDeferred ? [] : (isHandStrategy ? getRecruitPreviewEnemyTeam() : run.enemies || []);
  const isBattleHandPlaceholder = Boolean(!isHandStrategy && state.isBattleAnimating);
  const hand = (isHandStrategy ? getRecruitPreviewHand() : []).map(applyAccountStatBonusPreviewToDemon);
  const handMode = isBattleHandPlaceholder ? 'battle' : 'recruit';
  const showPacts = Boolean(hasPendingPacts && !state.isPactRevealPending && !state.isBattleAnimating && !state.isResultAnimating);
  const pactChoiceBlocksDrag = Boolean(hasPendingPacts || state.isPactRevealPending);
  const showHand = true;
  const handInteractive = Boolean(isHandStrategy && !pactChoiceBlocksDrag);
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

  elements.dungeonBottomPanel?.classList.toggle('d-none', !showHand);
  if (!canExtract || state.isBattleAnimating || state.isResultAnimating) state.isMobileRewardBoxOpen = false;
  elements.dungeonBottomPanel?.classList.toggle('is-battle-active', Boolean(state.isBattleAnimating));
  elements.dungeonBottomPanel?.classList.toggle('is-mobile-reward-open', Boolean(state.isMobileRewardBoxOpen && canExtract && !state.isBattleAnimating));
  arena?.classList.toggle('is-hand-strategy', isHandStrategy);
  setElementHtml(elements.teamGrid, renderDemonCards(team, {
    side: 'player',
    allowFormationDrag: run.status === 'active' && !pactChoiceBlocksDrag && (!run.awaitingRecruit || state.isRecruiting),
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
        <a class="btn btn-glass-muted" href="/camp">Leave</a>
        ${state.endedReplayRun?.lastBattle?.combatLog?.length ? `
          <button class="btn btn-glass-gold btn-icon-only" id="replayEndedDungeonBtn" type="button" title="Replay Fight" aria-label="Replay Fight">
            ${renderIcon('replay')}
          </button>
        ` : ''}
        <button class="btn btn-glass-gold" id="startNewDungeonBtn" type="button">
          ${renderIcon('play')}
          Start New Dungeon
        </button>
      </div>
    </div>
  `;
}

function renderDungeonStartPrompt() {
  return `
    <img src="/app/images/demons/1.png" alt="Boof Nitza demon preparing for a dungeon run" width="1024" height="1024" loading="lazy" decoding="async">
    <p class="mb-0 text-muted">Ready to descend into the dungeon?</p>
    <button class="btn btn-glass-gold dungeon-start-prompt-btn" id="startNewDungeonBtn" type="button">
      ${renderIcon('play')}
      Start Dungeon
    </button>
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
  const floor = state.run ? Math.max(1, Number(state.run.currentFloor) || 1) : null;
  elements.dungeonJoiner.classList.remove('is-recruiting');
  elements.dungeonJoiner.innerHTML = `
    <div class="dungeon-center-actions" id="dungeonCenterActions"></div>
    ${floor ? `<span class="dungeon-floor-marker" aria-label="Current floor ${floor}"><span>Floor</span><strong>${floor}</strong></span>` : ''}
  `;
  elements.dungeonCenterActions = document.getElementById('dungeonCenterActions');
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
    const nextWidth = Math.max(42, Math.min(260, widthFromContainer, widthFromHeight));

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

// The battle playback + speed controls render into #dungeonBottomControls, which
// overlays the (empty during battle) hand grid — replacing the old "Fighting"
// placeholder. The dedicated control bar has been removed.
function renderBattleControlsOverlay(html) {
  if (!elements.dungeonBottomControls) return false;
  return setElementHtml(elements.dungeonBottomControls, html);
}

// Replay + fight-log buttons live in their own box between the hand bar and the
// reward box (replay on top, log on bottom). The buttons are always present and
// just toggle disabled so the box keeps a stable size across run states.
function renderReplayLogBox(canReplay, canViewLog) {
  if (!elements.dungeonReplayLogBox) return false;
  return setElementHtml(elements.dungeonReplayLogBox, `
    <button class="btn btn-glass-gold btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogReplayBtn" type="button" title="Replay Fight" aria-label="Replay Fight" ${canReplay ? '' : 'disabled'}>
      ${renderIcon('replay')}
    </button>
    <button class="btn btn-glass-muted btn-sm btn-icon-only dungeon-replaylog-btn" id="fightLogToggleBtn" type="button" title="Fight Log" aria-label="Fight Log" ${canViewLog ? '' : 'disabled'}>
      ${renderIcon('log')}
    </button>
  `);
}

function renderFightLogActions() {
  if (state.isLoading) {
    renderDungeonCenterActions();
    renderDungeonMobileFightBox({ canReplay: false, canViewLog: false, canExtract: false });
    renderBattleControlsOverlay('');
    renderReplayLogBox(false, false);
    return;
  }

  const isDefeated = state.run?.status === 'defeated';
  const canStart = !state.endSummary && (!state.run || isDefeated || state.run.status === 'ended');
  const canShowSpeedControl = Boolean(
    state.run &&
    !state.isResultAnimating &&
    state.isBattleAnimating &&
    state.combatPlayback
  );
  const hasCurrentFightLog = Boolean(isCurrentFloorBattle(state.run) && (state.run?.lastBattle?.combatLog?.length || state.combatLog.length));
  const canReplay = Boolean(!state.isBattleAnimating && !state.isResultAnimating && hasCurrentFightLog);
  const canViewLog = canReplay;
  const hasPendingPacts = hasPendingBuffChoices(state.run);
  const canChooseRecruit = Boolean(!hasPendingPacts && !state.isResultAnimating && state.run?.awaitingRecruit && state.isRecruiting);
  const canExtract = Boolean(!state.isBattleAnimating && !state.isResultAnimating && !hasPendingPacts && canExtractRun());
  const continuePending = Boolean(state.isRecruitContinuePending);
  const isFighting = Boolean(state.isBattleAnimating);

  // The "Start (New) Dungeon" button shows in the center when a run object still
  // exists but is over (e.g. right after a defeat). The no-run start prompt is
  // handled by the empty state (see renderDungeonStartPrompt).
  const actionOptions = {
    canFight: canChooseRecruit || continuePending || isFighting,
    isPending: continuePending,
    isFighting,
    canStart: canStart && Boolean(state.run),
    isDefeated,
    canReplay,
    canViewLog,
    canExtract
  };

  renderDungeonCenterActions(actionOptions);
  const mobileFightChanged = renderDungeonMobileFightBox(actionOptions);

  const battleControlsHtml = canShowSpeedControl ? `${renderBattlePlaybackControls()}${renderBattleSpeedControl()}` : '';
  const overlayChanged = renderBattleControlsOverlay(battleControlsHtml);
  const boxChanged = renderReplayLogBox(canReplay, canViewLog);

  if (!overlayChanged && !boxChanged && !mobileFightChanged) return;

  bindClicks('[data-battle-speed]', (button) => setBattleSpeed(Number(button.dataset.battleSpeed)));
  bindClick(document.getElementById('battlePlaybackToggleBtn'), () => {
    if (state.combatPlayback?.isPaused) {
      resumeCombatPlayback();
    } else {
      pauseCombatPlayback();
    }
  });
  bindClicks('[data-battle-step]', (button) => stepCombatPlayback(Number(button.dataset.battleStep)));
  bindClick(document.getElementById('fightLogReplayBtn'), replayFight);
  bindClick(document.getElementById('fightLogToggleBtn'), toggleFightLogPanel);
}

function renderDungeonCenterActions(options = {}) {
  const { canFight = false, isPending = false, isFighting = false, canStart = false, isDefeated = false } = options;

  if (canStart) {
    const startChanged = setElementHtml(elements.dungeonCenterActions, `
      <div class="dungeon-center-action-stack">
        <button class="btn btn-glass-gold dungeon-fight-btn dungeon-center-start-btn" id="dungeonCenterStartBtn" type="button" title="${isDefeated ? 'Start a new dungeon' : 'Start the dungeon'}">
          ${renderIcon('play')}
          <span>${isDefeated ? 'New Dungeon' : 'Start Dungeon'}</span>
        </button>
      </div>
    `);
    if (startChanged) {
      bindClick(document.getElementById('dungeonCenterStartBtn'), isDefeated ? startNewDungeonAfterDefeat : startRun);
    }
    return;
  }

  const mode = isFighting ? 'fighting' : isPending ? 'preparing' : 'ready';
  const isDisabled = mode !== 'ready';
  const label = mode === 'fighting' ? 'Fighting' : mode === 'preparing' ? 'Preparing' : 'Fight';
  const title = mode === 'fighting'
    ? 'Fight in progress'
    : mode === 'preparing'
      ? 'Preparing the next fight'
      : 'Start the next fight';

  const changed = setElementHtml(elements.dungeonCenterActions, canFight ? `
    <div class="dungeon-center-action-stack">
      <span class="dungeon-fight-mark" aria-hidden="true">${renderButtonMeleeIcon()}</span>
      <button
        class="btn btn-glass-gold dungeon-fight-btn ${mode === 'preparing' ? 'is-loading' : ''} ${mode === 'fighting' ? 'is-fighting' : ''}"
        id="dungeonFightBtn"
        type="button"
        title="${title}"
        aria-label="${title}"
        ${isDisabled ? 'disabled aria-busy="true"' : ''}
      >
        ${mode === 'preparing' ? '<span class="dungeon-action-spinner" aria-hidden="true"></span>' : ''}
        <span>${label}</span>
      </button>
    </div>
  ` : '');

  if (changed) bindPathButtons();
}

function renderDungeonMobileFightBox(options = {}) {
  if (!elements.dungeonMobileFightBox) return false;
  if (state.isLoading) return setElementHtml(elements.dungeonMobileFightBox, '');

  const {
    canFight = false,
    isPending = false,
    isFighting = false,
    canReplay = false,
    canViewLog = false,
    canExtract = false
  } = options;
  const mode = isFighting ? 'fighting' : isPending ? 'preparing' : 'ready';
  const isDisabled = mode !== 'ready';
  const label = mode === 'fighting' ? 'Fighting' : mode === 'preparing' ? 'Preparing' : 'Fight';
  const title = mode === 'fighting'
    ? 'Fight in progress'
    : mode === 'preparing'
      ? 'Preparing the next fight'
      : 'Start the next fight';
  const hasRun = Boolean(state.run);
  const activeTab = state.activeHandTab === 'pacts' ? 'pacts' : 'hand';
  const rewardOpen = Boolean(state.isMobileRewardBoxOpen && canExtract);
  const tabDisabled = !hasRun || isFighting;

  const changed = setElementHtml(elements.dungeonMobileFightBox, `
    <button
      class="dungeon-mobile-nav-btn ${activeTab === 'hand' ? 'active' : ''}"
      id="dungeonMobileHandBtn"
      type="button"
      title="Hand"
      aria-label="Hand"
      aria-pressed="${activeTab === 'hand' ? 'true' : 'false'}"
      ${tabDisabled ? 'disabled' : ''}
    >
      ${renderIcon('collection')}
      <span class="visually-hidden">Hand</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn ${activeTab === 'pacts' ? 'active' : ''}"
      id="dungeonMobileBuffsBtn"
      type="button"
      title="Buffs"
      aria-label="Buffs"
      aria-pressed="${activeTab === 'pacts' ? 'true' : 'false'}"
      ${tabDisabled ? 'disabled' : ''}
    >
      ${renderIcon('stars')}
      <span class="visually-hidden">Buffs</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn"
      id="dungeonMobileReplayBtn"
      type="button"
      title="Replay Fight"
      aria-label="Replay Fight"
      ${canReplay ? '' : 'disabled'}
    >
      ${renderIcon('replay')}
      <span class="visually-hidden">Replay Fight</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn"
      id="dungeonMobileLogBtn"
      type="button"
      title="Fight Log"
      aria-label="Fight Log"
      ${canViewLog ? '' : 'disabled'}
    >
      ${renderIcon('log')}
      <span class="visually-hidden">Fight Log</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn ${rewardOpen ? 'active' : ''}"
      id="dungeonMobileExtractBtn"
      type="button"
      title="Extract"
      aria-label="Extract"
      aria-pressed="${rewardOpen ? 'true' : 'false'}"
      ${canExtract ? '' : 'disabled'}
    >
      ${renderIcon('flag')}
      <span class="visually-hidden">Extract</span>
    </button>
    <button
      class="dungeon-mobile-nav-btn dungeon-fight-btn dungeon-mobile-fight-btn ${mode === 'preparing' ? 'is-loading' : ''} ${mode === 'fighting' ? 'is-fighting' : ''}"
      id="dungeonMobileFightBtn"
      type="button"
      title="${title}"
      aria-label="${title}"
      ${!canFight || isDisabled ? 'disabled' : ''}
      ${isDisabled ? 'aria-busy="true"' : ''}
    >
      ${mode === 'preparing' ? '<span class="dungeon-action-spinner" aria-hidden="true"></span>' : renderButtonMeleeIcon()}
      <span class="visually-hidden">${label}</span>
    </button>
  `);

  if (changed) {
    bindDungeonMobileNavButtons();
    bindPathButtons();
  }
  return changed;
}

function bindDungeonMobileNavButtons() {
  bindClick(document.getElementById('dungeonMobileHandBtn'), () => setDungeonMobileHandTab('hand'));
  bindClick(document.getElementById('dungeonMobileBuffsBtn'), () => setDungeonMobileHandTab('pacts'));
  bindClick(document.getElementById('dungeonMobileReplayBtn'), replayFight);
  bindClick(document.getElementById('dungeonMobileLogBtn'), toggleFightLogPanel);
  bindClick(document.getElementById('dungeonMobileExtractBtn'), toggleDungeonMobileRewardBox);
}

function setDungeonMobileHandTab(tab) {
  if (!state.run || state.isBattleAnimating) return;
  state.activeHandTab = tab === 'pacts' ? 'pacts' : 'hand';
  renderRun();
}

function toggleDungeonMobileRewardBox() {
  if (state.isBattleAnimating || state.isResultAnimating || !canExtractRun()) return;
  state.isMobileRewardBoxOpen = !state.isMobileRewardBoxOpen;
  renderRun();
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
  [document.getElementById('dungeonFightBtn'), document.getElementById('dungeonMobileFightBtn')].forEach((button) => {
    if (!button || button.dataset.dungeonFightBound === 'true') return;

    button.dataset.dungeonFightBound = 'true';
    bindClick(button, (event) => requestRecruitContinue(event.currentTarget));
  });
}

export {
  renderPlayer,
  setDungeonLoading,
  renderRun,
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
  renderDungeonCenterActions,
  renderDungeonMobileFightBox,
  renderBattlePlaybackControls,
  renderBattleSpeedControl,
  bindPathButtons
};
