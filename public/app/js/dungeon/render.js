import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_FLOOR, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const battle = (...args) => dungeonActions.battle(...args);
const bindCollectionReinforcementPlaceholders = (...args) => dungeonActions.bindCollectionReinforcementPlaceholders(...args);
const bindDemonDetailCards = (...args) => dungeonActions.bindDemonDetailCards(...args);
const bindFormationDragAndDrop = (...args) => dungeonActions.bindFormationDragAndDrop(...args);
const bindPointerDragAndDrop = (...args) => dungeonActions.bindPointerDragAndDrop(...args);
const bindRecruitDragAndDrop = (...args) => dungeonActions.bindRecruitDragAndDrop(...args);
const bindRewardDragAndDrop = (...args) => dungeonActions.bindRewardDragAndDrop(...args);
const canExtractRun = (...args) => dungeonActions.canExtractRun(...args);
const formatBattleSpeed = (...args) => dungeonActions.formatBattleSpeed(...args);
const getFinalRewardHand = (...args) => dungeonActions.getFinalRewardHand(...args);
const getRecruitPreviewEnemyTeam = (...args) => dungeonActions.getRecruitPreviewEnemyTeam(...args);
const getRecruitPreviewHand = (...args) => dungeonActions.getRecruitPreviewHand(...args);
const getRecruitPreviewTeam = (...args) => dungeonActions.getRecruitPreviewTeam(...args);
const getRecruitTeamLimit = (...args) => dungeonActions.getRecruitTeamLimit(...args);
const groupCombatLog = (...args) => dungeonActions.groupCombatLog(...args);
const init = (...args) => dungeonActions.init(...args);
const isCurrentFloorBattle = (...args) => dungeonActions.isCurrentFloorBattle(...args);
const isFinalRewardPhase = (...args) => dungeonActions.isFinalRewardPhase(...args);
const openCashoutModal = (...args) => dungeonActions.openCashoutModal(...args);
const playEnemyRevealEffect = (...args) => dungeonActions.playEnemyRevealEffect(...args);
const playPendingHandFlowAnimation = (...args) => dungeonActions.playPendingHandFlowAnimation(...args);
const playRecruitSwapEffect = (...args) => dungeonActions.playRecruitSwapEffect(...args);
const renderButtonMeleeIcon = (...args) => dungeonActions.renderButtonMeleeIcon(...args);
const renderDemonCard = (...args) => dungeonActions.renderDemonCard(...args);
const renderDemonCards = (...args) => dungeonActions.renderDemonCards(...args);
const renderDungeonDemonCard = (...args) => dungeonActions.renderDungeonDemonCard(...args);
const renderEmptyText = (...args) => dungeonActions.renderEmptyText(...args);
const renderFightLogRow = (...args) => dungeonActions.renderFightLogRow(...args);
const renderHandBar = (...args) => dungeonActions.renderHandBar(...args);
const renderRewardBox = (...args) => dungeonActions.renderRewardBox(...args);
const replayFight = (...args) => dungeonActions.replayFight(...args);
const requestRecruitContinue = (...args) => dungeonActions.requestRecruitContinue(...args);
const setBattleSpeed = (...args) => dungeonActions.setBattleSpeed(...args);
const startNewHuntAfterDefeat = (...args) => dungeonActions.startNewHuntAfterDefeat(...args);
const startRun = (...args) => dungeonActions.startRun(...args);

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
  elements.huntTitle.innerHTML = renderHuntTitle(run);
  renderHuntProgress(run);
  renderDungeonRewardStrip();
  renderBattleOutcome();
  showCombatPanel();

  if (state.isLoading) {
    if (laneResizeObserver) laneResizeObserver.disconnect();
    elements.fightLog.innerHTML = 'Loading latest dungeon state...';
    elements.fightLog.classList.add('text-muted');
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
    renderTeamSideTitle();
    if (elements.enemySideTitle) elements.enemySideTitle.textContent = 'Enemies';
    updateDungeonJoiner();
    elements.runEmpty.innerHTML = state.endSummary ? renderDungeonEndScreen() : renderEmptyText('Preparing dungeon...');
    bindDungeonEmptyButtons();
    renderFightLog();
    renderFightLogActions();
    renderPhaseTitle();
    syncActionButtons();
    return;
  }

  const isHandStrategy = Boolean(state.isRecruiting && run.awaitingRecruit);
  const isFinalPick = isFinalRewardPhase();
  const arena = elements.runPanel?.querySelector('.dungeon-arena');
  const team = isHandStrategy ? getRecruitPreviewTeam() : run.team || [];
  const enemies = isHandStrategy && state.isEnemyPreviewDeferred ? [] : (isHandStrategy ? getRecruitPreviewEnemyTeam() : run.enemies || []);
  const showBattleHand = Boolean(!isHandStrategy && state.isBattleAnimating && state.battleHandPreview?.length);
  const hand = isFinalPick ? getFinalRewardHand() : (isHandStrategy ? getRecruitPreviewHand() : (showBattleHand ? cloneDemons(state.battleHandPreview) : []));
  const handMode = isFinalPick ? 'final' : 'recruit';
  const showHand = true;
  const rewardInteractive = Boolean(isHandStrategy || isFinalPick);

  elements.runPanel?.classList.toggle('has-hand', showHand);
  elements.dungeonBottomPanel?.classList.toggle('d-none', !showHand);
  arena?.classList.toggle('is-hand-strategy', isHandStrategy);
  elements.teamGrid.innerHTML = renderDemonCards(team, {
    side: 'player',
    allowFormationDrag: run.status === 'active' && (!run.awaitingRecruit || state.isRecruiting) && !run.awaitingFinalPick
  });
  elements.enemyGrid.innerHTML = renderDemonCards((isHandStrategy || (run.team || []).length) ? enemies : [], {
    side: 'enemy',
    allowRecruitDrag: false
  });
  renderHandBar(hand, showHand, isHandStrategy || isFinalPick, handMode);
  renderRewardBox(showHand, rewardInteractive);
  renderTeamSideTitle(isHandStrategy ? team.length : null, isHandStrategy ? getRecruitTeamLimit() : null);
  if (elements.enemySideTitle) elements.enemySideTitle.textContent = 'Enemies';
  updateDungeonJoiner();
  bindFormationDragAndDrop();
  bindRecruitDragAndDrop();
  bindRewardDragAndDrop();
  bindPointerDragAndDrop();
  bindCollectionReinforcementPlaceholders();
  bindDemonDetailCards();
  playRecruitSwapEffect();
  playEnemyRevealEffect();
  watchFormationLaneSizing();
  renderFightLog();
  renderFightLogActions();
  renderPhaseTitle();
  syncActionButtons();
  playPendingHandFlowAnimation(isHandStrategy);
}

function renderHuntTitle(run) {
  const floor = run ? Math.max(1, Math.min(MAX_DUNGEON_FLOOR, Number(run.currentFloor) || 1)) : MAX_DUNGEON_FLOOR;

  return `
    <div class="dungeon-title-brand">
      <a class="dungeon-header-brand" href="/play" aria-label="Back to Play">
        ${renderIcon('back')}
        <img src="/app/images/amongdemons_logo_250x250.png" alt="">
      </a>
      <div class="dungeon-title-copy">
        <span class="dungeon-title-text">Dungeon</span>
        ${run ? `<span class="hunt-floor-title">
          <span class="hunt-floor-label">Floor ${floor} / ${MAX_DUNGEON_FLOOR}</span>
        </span>` : ''}
      </div>
    </div>
  `;
}

function renderDungeonEndScreen() {
  const summary = state.endSummary || {};
  const demon = summary.demon;
  const isDefeat = summary.outcome === 'defeat';

  return `
    <div class="dungeon-end-screen ${isDefeat ? 'is-defeat' : 'is-victory'}">
      <div class="dungeon-end-copy">
        <span class="hunt-phase-eyebrow">${isDefeat ? 'Defeat' : 'Victory'}</span>
        <h2>${escapeHtml(summary.title || 'Dungeon complete')}</h2>
        <p>${escapeHtml(summary.message || 'Congratulations. You cleared the dungeon.')}</p>
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
        <span>${Number(summary.souls) || 0} souls</span>
      </div>
      <div class="dungeon-end-actions">
        <a class="btn btn-outline-light" href="/play">Leave</a>
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

function renderHuntProgress(run) {
  if (!elements.huntProgress) return;
  const floor = run ? Math.max(1, Math.min(MAX_DUNGEON_FLOOR, Number(run.currentFloor) || 1)) : 0;
  const percent = Math.round((floor / MAX_DUNGEON_FLOOR) * 100);
  elements.huntProgress.querySelector('span').style.width = `${percent}%`;
}

function renderFightLog() {
  renderBattleOutcome();

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

function renderBattleOutcome() {
  if (!elements.battleOutcome) return;

  let text = '';
  let type = '';
  if (state.run?.awaitingRecruit && Number(state.run.currentFloor) <= 0) {
    text = 'Preparation';
    type = 'victory';
  } else if (state.run?.awaitingRecruit) {
    text = 'Victory';
    type = 'victory';
  } else if (state.run?.status === 'defeated') {
    text = 'Defeat';
    type = 'defeat';
  }

  elements.battleOutcome.textContent = text;
  elements.battleOutcome.classList.toggle('is-victory', type === 'victory');
  elements.battleOutcome.classList.toggle('is-defeat', type === 'defeat');
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
  if (!lanes.length) return;

  const observer = new ResizeObserver(() => syncCompressedFormationLanes());
  setLaneResizeObserver(observer);
  lanes.forEach((lane) => observer.observe(lane));
  document.querySelectorAll('.battle-side .hunt-demon-card-image img').forEach((image) => {
    if (!image.complete) image.addEventListener('load', syncCompressedFormationLanes, { once: true });
  });
  syncCompressedFormationLanes();
}

function syncCompressedFormationLanes() {
  requestAnimationFrame(() => {
    const laneAdjustments = [];
    const lanes = Array.from(document.querySelectorAll('.battle-side .formation-lane-cards'));
    lanes.forEach((lane) => {
      const cards = Array.from(lane.querySelectorAll('.hunt-demon-card'));
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
        : availableCardHeight * 0.75;
      const nextWidth = Math.max(46, Math.min(148, availableCardHeight * 0.75, availableCardWidth));
      laneAdjustments.push(nextWidth);
    });

    if (!laneAdjustments.length) return;

    const sharedWidth = Math.min(...laneAdjustments);
    lanes.forEach((lane) => {
      lane.style.setProperty('--dungeon-demon-card-width', `${sharedWidth}px`);
      lane.style.setProperty('--dungeon-demon-card-height', `${sharedWidth * 1.333}px`);
      lane.classList.add('is-compressed');
    });
  });
}

function renderDungeonRewardStrip() {
  if (!elements.dungeonRewardStrip) return;
  elements.dungeonRewardStrip.innerHTML = '';
}

function renderPhaseTitle() {
  if (!elements.fightLogTitle) return;
  elements.fightLogTitle.textContent = 'Fight Log';
}

function setFightLogTitle(title) {
  if (elements.fightLogTitle) elements.fightLogTitle.textContent = title;
}

function renderEndNotice() {
  if (!state.endNotice) return '';

  const className = state.endNotice.type === 'warning'
    ? 'fight-log-notice fight-log-end-notice text-warning'
    : 'fight-log-notice fight-log-end-notice text-success';

  return `<div class="${className}">${escapeHtml(state.endNotice.text)}</div>`;
}

function renderFightLogActions() {
  if (state.isLoading) {
    elements.fightLogActions.innerHTML = `
      <span class="dungeon-loading-status" aria-live="polite">
        <span class="dungeon-loading-dot" aria-hidden="true"></span>
        Loading
      </span>
    `;
    return;
  }

  const isDefeated = state.run?.status === 'defeated';
  const canStart = !state.endSummary && (!state.run || isDefeated || state.run.status === 'ended');
  const canShowSpeedControl = Boolean(
    state.run?.status === 'active' &&
    !state.run.awaitingFinalPick &&
    !state.isResultAnimating &&
    state.isBattleAnimating
  );
  const hasCurrentFightLog = Boolean(isCurrentFloorBattle(state.run) && (state.run?.lastBattle?.combatLog?.length || state.combatLog.length));
  const canReplay = Boolean(!state.isBattleAnimating && !state.isResultAnimating && hasCurrentFightLog);
  const canViewLog = Boolean(!state.isBattleAnimating && !state.isResultAnimating && hasCurrentFightLog);
  const canChooseRecruit = Boolean(!state.isResultAnimating && state.run?.awaitingRecruit && state.isRecruiting);
  const canExtract = Boolean(!state.isResultAnimating && canExtractRun());

  elements.fightLogActions.innerHTML = `
    ${canShowSpeedControl ? renderBattleSpeedControl() : ''}
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
    ${canExtract ? `
      <button class="btn btn-warning btn-sm" id="getRewardBtn" type="button">
        ${renderIcon('flag')}
        Extract
      </button>
    ` : ''}
    ${canChooseRecruit ? `
      <span class="dungeon-action-or">or</span>
      <button class="btn btn-success btn-sm" id="fightLogContinueHuntBtn" type="button">
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
  `;

  bindClicks('[data-battle-speed]', (button) => setBattleSpeed(Number(button.dataset.battleSpeed)));
  bindClick(document.getElementById('fightLogStartBtn'), isDefeated ? startNewHuntAfterDefeat : startRun);
  bindClick(document.getElementById('fightLogReplayBtn'), replayFight);
  bindClick(document.getElementById('fightLogToggleBtn'), toggleFightLogPanel);
  bindPathButtons();
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
  bindClick(document.getElementById('getRewardBtn'), openCashoutModal);
  bindClick(document.getElementById('fightLogContinueHuntBtn'), requestRecruitContinue);
}

export {
  renderPlayer,
  setDungeonLoading,
  renderRun,
  renderHuntTitle,
  renderDungeonEndScreen,
  bindDungeonEmptyButtons,
  renderHuntProgress,
  renderFightLog,
  renderBattleOutcome,
  showBattleResultOverlay,
  renderTeamSideTitle,
  updateDungeonJoiner,
  showCombatPanel,
  toggleFightLogPanel,
  setBattlePanel,
  watchFormationLaneSizing,
  syncCompressedFormationLanes,
  renderDungeonRewardStrip,
  renderPhaseTitle,
  setFightLogTitle,
  renderEndNotice,
  renderFightLogActions,
  renderBattleSpeedControl,
  bindPathButtons
};
