import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const applyBattleSpeed = (...args) => dungeonActions.applyBattleSpeed(...args);
const bindActions = (...args) => dungeonActions.bindActions(...args);
const cacheElements = (...args) => dungeonActions.cacheElements(...args);
const clearRewardSelection = (...args) => dungeonActions.clearRewardSelection(...args);
const createCombatDemonMap = (...args) => dungeonActions.createCombatDemonMap(...args);
const ensureCollectionLoaded = (...args) => dungeonActions.ensureCollectionLoaded(...args);
const getCurrentRecruitRewards = (...args) => dungeonActions.getCurrentRecruitRewards(...args);
const getDraftRecruitPayload = (...args) => dungeonActions.getDraftRecruitPayload(...args);
const getRecruitPreviewHand = (...args) => dungeonActions.getRecruitPreviewHand(...args);
const getRecruitPreviewTeam = (...args) => dungeonActions.getRecruitPreviewTeam(...args);
const getRecruitTeamLimit = (...args) => dungeonActions.getRecruitTeamLimit(...args);
const getRewardExtractionChoicePayload = (...args) => dungeonActions.getRewardExtractionChoicePayload(...args);
const playCombatLog = (...args) => dungeonActions.playCombatLog(...args);
const prepareRecruitStrategyState = (...args) => dungeonActions.prepareRecruitStrategyState(...args);
const renderFightLog = (...args) => dungeonActions.renderFightLog(...args);
const renderPlayer = (...args) => dungeonActions.renderPlayer(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const setDungeonLoading = (...args) => dungeonActions.setDungeonLoading(...args);
const setFightLogTitle = (...args) => dungeonActions.setFightLogTitle(...args);
const showBattleResultOverlay = (...args) => dungeonActions.showBattleResultOverlay(...args);
const showCombatPanel = (...args) => dungeonActions.showCombatPanel(...args);
const syncRewardSelectionFromRun = (...args) => dungeonActions.syncRewardSelectionFromRun(...args);

async function init() {
  if (!window.AmongDemons.getToken()) {
    window.location.href = '/login';
    return;
  }

  cacheElements();
  bindActions();
  applyBattleSpeed();
  await refreshAll();
}

async function refreshAll() {
  setDungeonLoading(true);
  try {
    const me = await api('/api/auth/me');
    state.player = me.player;
    renderPlayer();

    if (state.run && state.run.runId) {
      await loadRun(state.run.runId);
    } else if (!(await loadCurrentRun()) && !(await loadSavedRun())) {
      await startRun();
    }
    setDungeonLoading(false);
    if (canStartCurrentBattle()) {
      await battle();
    }
  } catch (error) {
    setDungeonLoading(false);
    handleAuthError(error);
  }
}

async function loadSavedRun() {
  const runId = localStorage.getItem(RUN_KEY);
  if (!runId) return false;

  try {
    await loadRun(runId);
    if (state.run?.status !== 'active' && state.run?.status !== 'defeated') {
      clearCurrentRun();
      state.run = null;
      state.combatLog = [];
      return false;
    }
    return true;
  } catch (error) {
    if (error.status !== 404) throw error;
    clearCurrentRun();
    state.run = null;
    state.combatLog = [];
    return false;
  }
}

async function loadCurrentRun() {
  try {
    state.run = await api('/api/runs/current');
    await ensureCollectionLoaded();
    state.combatLog = isCurrentFloorBattle(state.run) ? state.run.lastBattle?.combatLog || [] : [];
    state.isRecruiting = Boolean(state.run.awaitingRecruit);
    if (state.isRecruiting) prepareRecruitStrategyState();
    syncRewardSelectionFromRun();
    storeCurrentRun(state.run.runId);
    renderRun();
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}

async function loadStartOptions() {
  state.startOptions = await api('/api/runs/start-options');
  state.collectionDemons = state.startOptions.collection || [];
}

async function startRun() {
  if (state.run) return;

  try {
    const payload = await createRunFromStartOptions();
    state.combatLog = [];
    resetEndState();
    state.isRecruiting = false;
    state.battleHandPreview = null;
    clearRewardSelection();
    state.startOptions = null;
    storeCurrentRun(payload.runId);
    await loadRun(payload.runId);
  } catch (error) {
    showError(error);
  }
}

async function createRunFromStartOptions() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!state.startOptions) {
      await loadStartOptions();
    }

    try {
      return await api('/api/runs/start', {
        method: 'POST',
        body: { draftToken: state.startOptions?.draftToken || null }
      });
    } catch (error) {
      if (attempt === 0 && error.status === 400 && /expired/i.test(error.message || '')) {
        state.startOptions = null;
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to start dungeon.');
}

async function loadRun(runId) {
  try {
    state.run = await api(runPath(runId));
    await ensureCollectionLoaded();
    state.combatLog = isCurrentFloorBattle(state.run) ? state.run.lastBattle?.combatLog || [] : [];
    state.isRecruiting = Boolean(state.run.awaitingRecruit);
    if (state.isRecruiting) prepareRecruitStrategyState();
    if (!state.isRecruiting) {
      clearRecruitDrafts();
    }
    syncRewardSelectionFromRun();
    storeCurrentRun(state.run.runId);
    renderRun();
  } catch (error) {
    clearCurrentRun();
    state.run = null;
    await loadStartOptions();
    renderRun();
    throw error;
  }
}

async function battle() {
  if (!state.run || state.isBattleAnimating || state.isResultAnimating) return;
  showCombatPanel();

  await withBusy(null, async () => {
    try {
      setFightLogTitle('Fight Log');
      const result = await api(activeRunPath('battle'), { method: 'POST' });
      state.combatDemons = createCombatDemonMap();
      state.combatLog = result.combatLog || [];
      if (result.lastBattle) state.run.lastBattle = result.lastBattle;
      elements.fightLog.innerHTML = '';
      elements.fightLog.classList.remove('text-muted');
      await playCombatLog(result);
      if (result.winner === 'enemy') {
        state.run.status = 'defeated';
        state.run.lastBattle = result.lastBattle || state.run.lastBattle;
        state.battleHandPreview = null;
        await finishRun('Your team was defeated.', { defeated: true });
      } else {
        const handFlowSources = captureEnemyHandFlowSources();
        const resultOverlay = showBattleResultOverlay('victory');
        state.pendingHandFlowSources = handFlowSources;
        state.isEnemyPreviewDeferred = true;
        await loadRun(state.run.runId);
        state.battleHandPreview = null;
        await resultOverlay;
        setMessage(getWinMessage(), 'success');
      }
    } catch (error) {
      showError(error);
    }
  });
}

function canStartCurrentBattle() {
  return Boolean(state.run?.status === 'active' && !state.run.awaitingRecruit);
}

function getWinMessage() {
  return 'Battle won. Adjust your team from hand, then continue.';
}

function captureEnemyHandFlowSources() {
  return Array.from(document.querySelectorAll('#enemyGrid .hunt-demon-card[data-instance-id]'))
    .map((card, index) => {
      const rect = card.getBoundingClientRect();
      return {
        index,
        instanceId: card.dataset.instanceId,
        html: card.outerHTML,
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        }
      };
    })
    .filter((source) => source.rect.width > 0 && source.rect.height > 0);
}

function requestRecruitContinue() {
  if (shouldConfirmShortTeamContinue()) {
    getModal(elements.shortTeamModal).show();
    return;
  }

  confirmRecruitReward();
}

function shouldConfirmShortTeamContinue() {
  if (!state.run?.awaitingRecruit || !state.isRecruiting) return false;
  if (!getCurrentRecruitRewards().length) return false;
  return getRecruitPreviewTeam().length < getRecruitTeamLimit();
}

async function continueShortTeam() {
  await withBusy(elements.confirmShortTeamBtn, async () => {
    getModal(elements.shortTeamModal).hide();
    await confirmRecruitReward();
  });
}

async function confirmRecruitReward() {
  if (!state.run) return;

  const runId = state.run.runId;
  const handPreview = cloneDemons(state.recruitDraftPool || []);
  const recruitChoice = getDraftRecruitPayload();
  const extractChoice = getRewardExtractionChoicePayload();
  if (!recruitChoice.team.length) {
    setMessage('Keep at least one demon on your team before continuing.', 'warning');
    return;
  }

  const body = recruitChoice && recruitChoice.team.length
    ? recruitChoice
    : { skipRecruit: true };
  if (body.skipRecruit) {
    delete body.rewardId;
    delete body.replaceInstanceId;
    delete body.position;
    delete body.team;
  }
  body.extractChoice = extractChoice;

  try {
    await api(activeRunPath('recruit'), {
      method: 'POST',
      body
    });
    clearRecruitSelection();
    state.isRecruiting = false;
    clearDragState();
    state.battleHandPreview = handPreview;
    clearRecruitDrafts();
    resetCombatState();
    resetEndState();
    getModal(elements.teamChoiceModal).hide();
    await loadRun(runId);
    if (canStartCurrentBattle()) {
      await battle();
      return;
    }
    state.battleHandPreview = null;
    setMessage(body.skipRecruit ? 'Continuing to the next floor.' : 'Team updated.', 'success');
  } catch (error) {
    state.battleHandPreview = null;
    showError(error);
  }
}

async function endRun() {
  if (!state.run) return;

  await finishRun();
}

async function finishRun(message, summary = {}) {
  if (!state.run) return;

  try {
    const replayRun = summary.defeated ? createReplayRunSnapshot(state.run) : null;
    const result = await api(activeRunPath('end'), { method: 'POST' });
    clearCurrentRun();
    state.run = null;
    clearRecruitSelection();
    clearRewardSelection();
    state.isRecruiting = false;
    state.battleHandPreview = null;
    clearDragState();
    clearRecruitDrafts();
    state.endSummary = {
      title: 'Dungeon ended',
      outcome: summary.defeated ? 'defeat' : 'extraction',
      message: message || 'Dungeon ended.',
      demon: summary.demon || null,
      xp: result.xp,
      souls: result.souls
    };
    state.endedReplayRun = replayRun;
    state.endNotice = {
      text: `${message || 'Dungeon ended.'} You earned ${result.xp} XP and ${result.souls} souls.`,
      type: summary.defeated ? 'warning' : 'success'
    };
    getModal(elements.teamChoiceModal).hide();
    await loadStartOptions();
    renderRun();
  } catch (error) {
    showError(error);
  }
}

async function startNewHuntAfterDefeat() {
  if (!state.run || state.run.status !== 'defeated') {
    await startRun();
    return;
  }

  await finishRun('Your team was defeated.');
  await startRun();
}

async function replayFight() {
  const replayingEndedRun = !state.run && Boolean(state.endedReplayRun);
  const activeRun = state.run || state.endedReplayRun;
  const lastBattle = activeRun?.lastBattle;
  const wasRecruiting = Boolean(!replayingEndedRun && state.run?.awaitingRecruit && state.isRecruiting);

  if (replayingEndedRun) {
    state.run = createReplayRunSnapshot(state.endedReplayRun);
    state.combatLog = lastBattle?.combatLog || [];
    renderRun();
  }

  const previousBattleHandPreview = state.battleHandPreview;
  if (wasRecruiting) {
    state.battleHandPreview = getRecruitPreviewHand();
    state.isRecruiting = false;
  }
  showCombatPanel();
  if (!lastBattle?.combatLog?.length) {
    if (state.combatLog.length) renderFightLog();
    if (wasRecruiting) {
      state.isRecruiting = true;
      state.battleHandPreview = previousBattleHandPreview;
      renderRun();
    }
    if (replayingEndedRun) {
      state.run = null;
      renderRun();
    }
    return;
  }

  state.run.team = cloneDemons(lastBattle.playerTeamBefore || state.run.team || []);
  state.run.enemies = cloneDemons(lastBattle.enemyTeamBefore || state.run.enemies || []);
  state.combatLog = lastBattle.combatLog || [];
  renderRun();
  setFightLogTitle('Fight Log');
  elements.fightLog.innerHTML = '';
  elements.fightLog.classList.remove('text-muted');
  try {
    await playCombatLog();
    state.run.team = cloneDemons(lastBattle.playerTeamAfter || state.run.team || []);
    state.run.enemies = cloneDemons(lastBattle.enemyTeamAfter || state.run.enemies || []);
    renderRun();
  } finally {
    if (wasRecruiting) {
      state.isRecruiting = true;
      state.battleHandPreview = previousBattleHandPreview;
      renderRun();
    }

    if (replayingEndedRun) {
      state.run = null;
      renderRun();
    }
  }
}

function createReplayRunSnapshot(run) {
  if (!run) return null;

  return {
    ...run,
    team: cloneDemons(run.team || []),
    enemies: cloneDemons(run.enemies || []),
    rewards: [...(run.rewards || [])],
    lastBattle: run.lastBattle ? {
      ...run.lastBattle,
      combatLog: [...(run.lastBattle.combatLog || [])],
      playerTeamBefore: cloneDemons(run.lastBattle.playerTeamBefore || []),
      enemyTeamBefore: cloneDemons(run.lastBattle.enemyTeamBefore || []),
      playerTeamAfter: cloneDemons(run.lastBattle.playerTeamAfter || []),
      enemyTeamAfter: cloneDemons(run.lastBattle.enemyTeamAfter || [])
    } : null,
    awaitingRecruit: false
  };
}

function isCurrentFloorBattle(run) {
  return Boolean(run?.lastBattle?.floor === run?.currentFloor);
}

export {
  init,
  refreshAll,
  loadSavedRun,
  loadCurrentRun,
  loadStartOptions,
  startRun,
  createRunFromStartOptions,
  loadRun,
  battle,
  canStartCurrentBattle,
  getWinMessage,
  captureEnemyHandFlowSources,
  requestRecruitContinue,
  shouldConfirmShortTeamContinue,
  continueShortTeam,
  confirmRecruitReward,
  endRun,
  finishRun,
  startNewHuntAfterDefeat,
  replayFight,
  createReplayRunSnapshot,
  isCurrentFloorBattle
};
