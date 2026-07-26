import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon, renderSoulAmount } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, showDungeonResultProgression, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const audio = window.AmongDemons.audio;
let lastConvergenceAnnouncementKey = null;

const applyBattleSpeed = (...args) => dungeonActions.applyBattleSpeed(...args);
const beginDeferredDemonicPactReveal = (...args) => dungeonActions.beginDeferredDemonicPactReveal(...args);
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
const hasPendingBuffChoices = (...args) => dungeonActions.hasPendingBuffChoices(...args);
const playCombatLog = (...args) => dungeonActions.playCombatLog(...args);
const prepareRecruitStrategyState = (...args) => dungeonActions.prepareRecruitStrategyState(...args);
const renderFightLog = (...args) => dungeonActions.renderFightLog(...args);
const renderPlayer = (...args) => dungeonActions.renderPlayer(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const setDungeonLoading = (...args) => dungeonActions.setDungeonLoading(...args);
const showBattleResultOverlay = (...args) => dungeonActions.showBattleResultOverlay(...args);
const showCombatPanel = (...args) => dungeonActions.showCombatPanel(...args);
const syncRewardSelectionFromRun = (...args) => dungeonActions.syncRewardSelectionFromRun(...args);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      // First-time visitors play instantly as a guest instead of hitting a gate.
      try {
        await window.AmongDemons.ensurePlayableSession();
      } catch (error) {
        window.location.href = window.AmongDemons.appUrl('/login');
        return;
      }
    }

  audio?.setScene({ music: 'music.default' });
  cacheElements();
  bindActions();
  applyBattleSpeed();
  await refreshAll();
}

async function refreshAll() {
  setDungeonLoading(true);
  try {
    const bootstrap = await api('/api/runs/bootstrap');
    state.player = bootstrap.player;
    state.statPoints = bootstrap.statPoints;
    state.collectionDemons = bootstrap.collection || [];
    state.startOptions = bootstrap.startOptions || null;
    renderPlayer();

    if (bootstrap.run) {
      await applyRunPayload(bootstrap.run);
    } else {
      clearCurrentRun();
      state.run = null;
      state.combatLog = [];
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

async function loadAccountStatPoints() {
  state.statPoints = await api('/api/account/stat-points');
  return state.statPoints;
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
    await applyRunPayload(await api('/api/runs/current'));
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
    if (payload.run) {
      await applyRunPayload(payload.run);
    } else {
      await loadRun(payload.runId);
    }
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
    await applyRunPayload(await api(runPath(runId)));
  } catch (error) {
    clearCurrentRun();
    state.run = null;
    await Promise.all([loadStartOptions(), loadAccountStatPoints()]);
    renderRun();
    throw error;
  }
}

async function applyRunPayload(run) {
  state.run = run;
  await ensureCollectionLoaded();
  state.combatLog = isCurrentFloorBattle(state.run) ? state.run.lastBattle?.combatLog || [] : [];
  state.isRecruiting = Boolean(state.run.awaitingRecruit);
  if (state.isRecruiting) {
    prepareRecruitStrategyState();
  } else {
    clearRecruitDrafts();
  }
  syncRewardSelectionFromRun();
  storeCurrentRun(state.run.runId);
  renderRun();
  announceConvergence(state.run);
}

function announceConvergence(run) {
  if (!run) return;
  const isPreview = Boolean(run.awaitingRecruit);
  const floor = Math.max(1, Number(run.currentFloor) + (isPreview ? 1 : 0));
  const buffs = isPreview ? run.nextEnemyBuffs : run.enemyBuffs;
  const convergence = (Array.isArray(buffs) ? buffs : [])
    .find((buff) => buff?.id === 'rarity-convergence');
  if (!convergence) return;

  const key = `${run.runId}:${floor}:${convergence.rarity || convergence.name}`;
  if (lastConvergenceAnnouncementKey === key) return;
  lastConvergenceAnnouncementKey = key;
  setMessage(
    `${convergence.name} on Floor ${floor}. Every enemy shares this rarity; its extra Terror lasts for this fight only.`,
    'warning'
  );
}

async function battle() {
  if (!state.run || state.isBattleAnimating || state.isResultAnimating) return;
  showCombatPanel();

  await withBusy(null, async () => {
    try {
      const result = await api(activeRunPath('battle'), { method: 'POST' });
      const lastBattle = result.run?.lastBattle || result.lastBattle || null;
      const combatLog = lastBattle?.combatLog || result.combatLog || [];
      const playbackResult = { ...result, lastBattle, combatLog };
      state.combatLog = combatLog;
      if (lastBattle) {
        state.run.lastBattle = lastBattle;
        state.run.team = cloneDemons(lastBattle.playerTeamBefore || state.run.team || []);
        state.run.enemies = cloneDemons(lastBattle.enemyTeamBefore || state.run.enemies || []);
      }
      state.combatDemons = createCombatDemonMap();
      elements.fightLog.innerHTML = '';
      elements.fightLog.classList.remove('text-muted');
      await playCombatLog(playbackResult);
      if (result.winner === 'enemy') {
        state.run.status = 'defeated';
        state.run.lastBattle = lastBattle || state.run.lastBattle;
        state.battleHandPreview = null;
        const resultOverlay = showBattleResultOverlay('defeat');
        window.setTimeout(() => audio?.play('sfx.dungeon.runLost', { volume: 0.88 }), 1050);
        await resultOverlay;
        await finishRun(getDefeatMessage(result), { defeated: true });
      } else {
        const handFlowSources = captureEnemyHandFlowSources();
        const resultOverlay = showBattleResultOverlay('victory');
        if ((result.buffs?.pendingChoices || []).length) beginDeferredDemonicPactReveal();
        state.pendingHandFlowSources = handFlowSources;
        state.isEnemyPreviewDeferred = true;
        await resultOverlay;
        if (result.run) {
          await applyRunPayload(result.run);
        } else {
          await loadRun(state.run.runId);
        }
        state.battleHandPreview = null;
        setMessage(getWinMessage(), 'success');
      }
    } catch (error) {
      showError(error);
    }
  });
}

function getDefeatMessage(result = {}) {
  if (result.endReason === 'stalemate') {
    return 'Battle stalemated. Your team could not finish the fight.';
  }
  if (result.endReason === 'timeout') {
    return 'Battle timed out. Your team could not finish the fight.';
  }
  return 'Your team was defeated.';
}

function canStartCurrentBattle() {
  return Boolean(state.run?.status === 'active' && !state.run.awaitingRecruit && !hasPendingBuffChoices(state.run));
}

function getWinMessage() {
  if (hasPendingBuffChoices(state.run)) {
    return 'Choose a Demonic Pact to continue.';
  }

  return 'Battle won. Adjust your team from hand, then continue.';
}

function captureEnemyHandFlowSources() {
  return Array.from(document.querySelectorAll('#enemyGrid .dungeon-demon-card[data-instance-id]'))
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
  if (state.isRecruitContinuePending) return;

  if (hasPendingBuffChoices(state.run)) {
    setMessage('Choose a Demonic Pact before continuing.', 'warning');
    return;
  }

  if (shouldConfirmShortTeamContinue()) {
    getModal(elements.shortTeamModal).show();
    return;
  }

  runRecruitContinue();
}

function shouldConfirmShortTeamContinue() {
  if (!state.run?.awaitingRecruit || !state.isRecruiting) return false;
  if (!getCurrentRecruitRewards().length) return false;
  return getRecruitPreviewTeam().length < getRecruitTeamLimit();
}

async function continueShortTeam() {
  if (state.isRecruitContinuePending) return;

  getModal(elements.shortTeamModal).hide();
  await runRecruitContinue();
}

async function runRecruitContinue() {
  state.isRecruitContinuePending = true;
  renderRun();

  try {
    await confirmRecruitReward();
  } finally {
    state.isRecruitContinuePending = false;
    renderRun();
  }
}

async function confirmRecruitReward() {
  if (!state.run) return;
  if (hasPendingBuffChoices(state.run)) {
    setMessage('Choose a Demonic Pact before continuing.', 'warning');
    return;
  }

  const runId = state.run.runId;
  const recruitChoice = getDraftRecruitPayload();
  const extractChoice = getRewardExtractionChoicePayload();
  if (!recruitChoice.team.length) {
    setMessage('Keep at least one demon on your team before continuing.', 'warning');
    return;
  }

  if (recruitChoice.team.length > getRecruitTeamLimit()) {
    setMessage(`Choose up to ${getRecruitTeamLimit()} demons before continuing.`, 'warning');
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
    const result = await api(activeRunPath('recruit'), {
      method: 'POST',
      body
    });
    clearRecruitSelection();
    state.isRecruiting = false;
    clearDragState();
    state.battleHandPreview = null;
    clearRecruitDrafts();
    resetCombatState();
    resetEndState();
    getModal(elements.teamChoiceModal).hide();
    if (result.run) {
      await applyRunPayload(result.run);
    } else {
      await loadRun(runId);
    }
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
    const result = await api(activeRunPath('end'), {
      method: 'POST',
      progressionAnimation: false
    });
    clearCurrentRun();
    state.run = null;
    clearRecruitSelection();
    clearRewardSelection();
    state.isRecruiting = false;
    state.battleHandPreview = null;
    clearDragState();
    clearRecruitDrafts();
    state.endSummary = {
      title: summary.defeated ? 'Run ended in defeat' : 'Extraction complete',
      outcome: summary.defeated ? 'defeat' : 'extraction',
      message: message || (summary.defeated ? 'Your team was defeated.' : 'You left the dungeon with your rewards.'),
      demon: summary.demon || null,
      xp: result.xp,
      souls: result.souls
    };
    state.endedReplayRun = replayRun;
    state.endNotice = {
      html: renderEarnedNoticeHtml(message || (summary.defeated ? 'Run ended in defeat.' : 'Extraction complete.'), result),
      type: summary.defeated ? 'warning' : 'success'
    };
    getModal(elements.teamChoiceModal).hide();
    await Promise.all([
      loadStartOptions(),
      loadAccountStatPoints()
    ]);
    renderRun();
    showDungeonResultProgression(result.progression);
  } catch (error) {
    showError(error);
  }
}

function renderEarnedNoticeHtml(message, result) {
  return `${escapeHtml(message)} You earned ${renderXpNoticeAmount(result.xp)} and ${renderSoulAmount(Number(result.souls) || 0, { className: 'soul-chip soul-chip-inline fight-log-soul-amount' })}.`;
}

function renderXpNoticeAmount(xp) {
  return `<span class="fight-log-reward-inline">${renderIcon('stars')}${escapeHtml(String(Number(xp) || 0))} XP</span>`;
}

async function startNewDungeonAfterDefeat() {
  if (!state.run || state.run.status !== 'defeated') {
    await startRun();
    return;
  }

  await finishRun('Your team was defeated.');
  await startRun();
}

async function replayFight(options = {}) {
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
  elements.fightLog.innerHTML = '';
  elements.fightLog.classList.remove('text-muted');
  try {
    await playCombatLog({
      waitForBattleIntro: Boolean(options.waitForBattleIntro),
      combatPlayback: options.combatPlayback
    });
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
  loadAccountStatPoints,
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
  startNewDungeonAfterDefeat,
  replayFight,
  createReplayRunSnapshot,
  isCurrentFloorBattle
};
