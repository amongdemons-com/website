import { registerDungeonActions } from './dungeon/registry.js';
import { state } from './dungeon/state.js';
import * as combat from './dungeon/combat.js';
import {
  renderDemonCards,
  renderDemonStatus,
  renderFormationSlot,
  renderTeamUpgradeIndicator
} from './dungeon/cards.js';
import { createLevelPowerBuff } from './dungeon/hand.js';
import {
  bindActivePactTooltips,
  compactActivePacts,
  renderStackedActivePactIcon
} from './dungeon/pacts.js';
import {
  renderBattlePlaybackControls,
  renderBattleBuffSummaryChip,
  renderBattleSpeedControl,
  renderBattleSkipControl,
  renderDemonicPactReturnControl,
  renderReplayLogButtons,
  setBattlePanel,
  showBattleResultOverlay,
  toggleFightLogPanel
} from './dungeon/render.js';

const api = window.AmongDemons.api;
const audio = window.AmongDemons.audio;
const renderCard = window.AmongDemons.ui.renderDemonCard;
const renderCombatStats = window.AmongDemons.ui.renderCombatStats;
const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
const RANKED_RARITIES = Object.freeze([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic'
]);
const RANKED_REROLL_RSOUL_COST = 2;
const RANKED_VICTORY_FLOOR = 20;
const RANKED_CARD_RARITY_COSTS = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 7
});
const elements = {};
const seenCombinationEvents = new Set();
let isBusy = false;
let serverRun = null;
let workspace = null;
let isReplayingBattle = false;
let pointerDrag = null;
let nativeDragActive = false;
let suppressDetailUntil = 0;
let rankedSouls = 0;
let rankedCatalog = null;
let rankedCatalogPromise = null;
let previewCombinationCounter = 0;
let stagedPurchaseOfferIds = new Set();
let stagedSoldDemons = [];
let shownVictoryKey = null;
let pendingInterestGain = 0;
let rankedPactScrollSyncFrame = 0;
let rankedRating = null;

registerDungeonActions({
  ...combat,
  battle: startBattle,
  getExplicitFormationRow: (demon) => normalizeSlot(demon?.formationSlot),
  normalizeFormationRow: (slot) => normalizeSlot(slot) ?? 0,
  shouldShowCollectionMissingTag: () => false,
  getDemonPosition,
  renderDemonStatus,
  renderDungeonCenterActions,
  renderFightLog,
  renderFightLogActions,
  renderRun
});

onReady(init);

async function init() {
  if (!window.AmongDemons.getToken()) {
    // First-time visitors play instantly as a guest instead of hitting a gate.
    try {
      await window.AmongDemons.ensurePlayableSession();
    } catch (error) {
      window.location.href = window.AmongDemons.appUrl('/login?next=/ranked');
      return;
    }
  }
  cacheElements();
  bindEvents();
  bindActivePactTooltips();
  combat.applyBattleSpeed();
  audio?.setScene({ music: 'music.default' });
  await loadBootstrap();
}

function cacheElements() {
  [
    'rankedMessage',
    'runLoading',
    'runEmpty',
    'runPanel',
    'rankedBottomPanel',
    'rankedHandStatus',
    'rankedPreparation',
    'dungeonHandBar',
    'dungeonBottomControls',
    'dungeonReplayLogBox',
    'teamSideTitle',
    'enemySideTitle',
    'teamGrid',
    'enemyGrid',
    'dungeonCenterActions',
    'fightLog',
    'demonicPactOverlay',
    'demonicPactViewToggle',
    'rankedPactGrid',
    'rankedEndRunModal',
    'rankedEndRunEyebrow',
    'rankedEndRunSummary',
    'rankedEndRunFloor',
    'rankedEndRunGain',
    'rankedEndRunRating',
    'rankedVictoryModal',
    'rankedVictoryRankImage',
    'rankedVictoryDivision',
    'rankedVictoryRankGain',
    'rankedVictorySummary'
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.addEventListener('click', async (event) => {
    const endRunConfirm = event.target.closest('[data-ranked-end-confirm]');
    if (endRunConfirm) {
      event.preventDefault();
      await confirmRankedEndRun();
      return;
    }

    const pactScrollButton = event.target.closest('[data-ranked-pact-scroll]');
    if (pactScrollButton) {
      event.preventDefault();
      scrollRankedPacts(pactScrollButton);
      return;
    }

    const victoryAction = event.target.closest('[data-ranked-victory-action]');
    if (victoryAction) {
      event.preventDefault();
      await handleRankedVictoryAction(victoryAction.dataset.rankedVictoryAction);
      return;
    }

    const speedButton = event.target.closest('[data-battle-speed]');
    if (speedButton) {
      event.preventDefault();
      combat.setBattleSpeed(Number(speedButton.dataset.battleSpeed));
      return;
    }

    const stepButton = event.target.closest('[data-battle-step]');
    if (stepButton) {
      event.preventDefault();
      combat.stepCombatPlayback(Number(stepButton.dataset.battleStep));
      return;
    }

    if (event.target.closest('#battlePlaybackToggleBtn')) {
      event.preventDefault();
      if (state.combatPlayback?.isPaused) combat.resumeCombatPlayback();
      else combat.pauseCombatPlayback();
      return;
    }

    if (event.target.closest('#battlePlaybackSkipBtn')) {
      event.preventDefault();
      combat.skipCombatPlayback();
      return;
    }

    if (event.target.closest('#fightLogReplayBtn, #rankedMobileReplayBtn')) {
      event.preventDefault();
      event.target.closest('.ranked-mobile-review-menu')?.removeAttribute('open');
      await replayRankedFight();
      return;
    }

    if (event.target.closest('#fightLogToggleBtn, #rankedMobileLogBtn')) {
      event.preventDefault();
      event.target.closest('.ranked-mobile-review-menu')?.removeAttribute('open');
      toggleFightLogPanel();
      return;
    }

    if (event.target.closest('#demonicPactViewToggle, #demonicPactReturnBtn')) {
      event.preventDefault();
      toggleRankedPactView();
      return;
    }

    const action = event.target.closest('[data-ranked-action]');
    if (action?.matches('button')) {
      event.preventDefault();
      await handleAction(action, event);
      return;
    }

    if (action) {
      event.preventDefault();
      await handleAction(action, event);
    }
  });

  document.addEventListener('dragstart', (event) => {
    const card = event.target.closest('[data-ranked-workspace-id]');
    if (!card || !event.dataTransfer || !workspace) return;
    const instanceId = card.dataset.rankedWorkspaceId;
    nativeDragActive = true;
    beginRankedSaleDrag(instanceId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', instanceId);
    card.classList.add('is-dragging');
  });

  elements.rankedEndRunModal?.addEventListener('hidden.bs.modal', () => {
    setRankedEndRunBusy(false);
  });

  document.addEventListener('dragend', (event) => {
    event.target.closest('[data-ranked-workspace-id]')?.classList.remove('is-dragging');
    suppressDetailUntil = Date.now() + 350;
    nativeDragActive = false;
    endRankedSaleDrag();
    clearDragOver();
  });

  document.addEventListener('dragover', (event) => {
    const target = getWorkspaceDropTarget(event.target);
    if (!target) return;
    event.preventDefault();
    clearDragOver();
    target.classList.add('is-drag-over');
  });

  document.addEventListener('dragleave', (event) => {
    const target = getWorkspaceDropTarget(event.target);
    if (target && !target.contains(event.relatedTarget)) target.classList.remove('is-drag-over');
  });

  document.addEventListener('drop', (event) => {
    const target = getWorkspaceDropTarget(event.target);
    if (!target) return;
    event.preventDefault();
    const instanceId = event.dataTransfer?.getData('text/plain');
    if (!instanceId) return;
    nativeDragActive = false;
    endRankedSaleDrag();
    void moveWorkspaceDemon(instanceId, target, {
      x: event.clientX,
      y: event.clientY
    });
  });

  document.addEventListener('pointerdown', beginPointerDrag);
  document.addEventListener('pointermove', updatePointerDrag);
  document.addEventListener('pointerup', finishPointerDrag);
  document.addEventListener('pointercancel', cancelPointerDrag);

  document.addEventListener('keydown', (event) => {
    const card = event.target.closest('.dungeon-demon-card[data-instance-id]');
    if (!card || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    openCardDetails(card);
  });

  document.addEventListener('scroll', (event) => {
    const viewport = event.target?.closest?.('[data-ranked-pact-scroll-viewport]');
    if (viewport) syncRankedPactScrollControls(viewport.closest('.ranked-reserve-buffs-shell'));
  }, { capture: true, passive: true });
  window.addEventListener('resize', scheduleRankedPactScrollControlsSync);
}

async function loadBootstrap() {
  setLoading(true);
  try {
    const [payload] = await Promise.all([
      api('/api/ranked/bootstrap'),
      loadRankedCatalog().catch((error) => {
        console.warn('Ranked upgrade previews will use current-card art.', error);
        return null;
      })
    ]);
    if (payload.player) acceptPlayer(payload.player);
    rankedRating = payload.rating || null;
    if (payload.run) {
      acceptRun(payload.run);
      if (
        payload.run.status === 'active'
        && payload.run.phase === 'result'
        && !payload.run.awaitingVictoryChoice
      ) {
        await continueRun();
      }
    } else {
      state.run = null;
      serverRun = null;
    }
    setLoading(false);
    renderRun();
    if (serverRun?.awaitingVictoryChoice) {
      showRankedVictoryModal(serverRun);
    }
  } catch (error) {
    setLoading(false);
    showError(error);
  }
}

async function loadRankedCatalog() {
  if (rankedCatalog) return rankedCatalog;
  if (!rankedCatalogPromise) {
    rankedCatalogPromise = api('/api/game/catalog?v=20260722-request-optimization-v1')
      .then((payload) => {
        rankedCatalog = {
          types: payload?.types || {},
          demons: Array.isArray(payload?.demons) ? payload.demons : []
        };
        return rankedCatalog;
      })
      .catch((error) => {
        rankedCatalogPromise = null;
        throw error;
      });
  }
  return rankedCatalogPromise;
}

async function startRun() {
  const payload = await mutate('/api/ranked/start', {});
  if (payload?.run) acceptRun(payload.run);
}

async function handleAction(button, event = null) {
  if (isBusy) return;
  const action = button.dataset.rankedAction;
  if (action === 'start') return startRun();
  if (!serverRun) return;

  if (action === 'reroll') return rerollHand(getInteractionPoint(event, button));
  if (action === 'lock-hand') return toggleHandLock();
  if (action === 'fight') return startBattle();
  if (action === 'continue') return continueRun();
  if (action === 'end') return showRankedEndRunModal();
  if (action === 'pact') return chooseRankedPact(button.dataset.buffId);
}

function showRankedEndRunModal() {
  if (!serverRun || !elements.rankedEndRunModal || !window.bootstrap?.Modal) return;
  const floor = Math.max(1, Number(serverRun.floor) || 1);
  const runDelta = Number(serverRun.rating?.projectedRunDelta ?? serverRun.rating?.runDelta) || 0;
  const rating = Math.max(
    0,
    Number(serverRun.rating?.projectedEnd ?? serverRun.rating?.rating) || 0
  );

  if (elements.rankedEndRunEyebrow) {
    elements.rankedEndRunEyebrow.textContent = `Concede · Floor ${formatNumber(floor)}`;
  }
  if (elements.rankedEndRunSummary) {
    elements.rankedEndRunSummary.textContent = (
      `Ending now calculates your final rank from reaching Floor ${formatNumber(floor)} and retires this temporary roster.`
    );
  }
  if (elements.rankedEndRunFloor) elements.rankedEndRunFloor.textContent = formatNumber(floor);
  if (elements.rankedEndRunGain) {
    elements.rankedEndRunGain.textContent = formatSigned(runDelta);
    elements.rankedEndRunGain.classList.toggle('is-negative', runDelta < 0);
  }
  if (elements.rankedEndRunRating) elements.rankedEndRunRating.textContent = formatNumber(rating);
  setRankedEndRunBusy(false);
  window.bootstrap.Modal.getOrCreateInstance(elements.rankedEndRunModal).show();
}

async function confirmRankedEndRun() {
  if (isBusy || !serverRun || serverRun.status !== 'active') return;
  setRankedEndRunBusy(true);
  const payload = await performRunAction('end', {});
  if (payload?.run?.status === 'ended') {
    window.bootstrap?.Modal.getOrCreateInstance(elements.rankedEndRunModal)?.hide();
    return;
  }
  setRankedEndRunBusy(false);
}

function setRankedEndRunBusy(busy) {
  const modal = elements.rankedEndRunModal;
  if (!modal) return;
  modal.querySelectorAll('button').forEach((button) => {
    button.disabled = Boolean(busy);
  });
  const confirm = modal.querySelector('[data-ranked-end-confirm]');
  confirm?.classList.toggle('is-busy', Boolean(busy));
  confirm?.setAttribute('aria-busy', busy ? 'true' : 'false');
}

async function performRunAction(action, body) {
  const payload = await mutate(`/api/ranked/runs/${encodeURIComponent(serverRun.runId)}/${action}`, body);
  if (payload?.player) acceptPlayer(payload.player, { animate: true });
  if (payload?.run) {
    acceptRun(payload.run);
    if (payload.rewards?.souls) {
      showMessage(`Floor ${RANKED_VICTORY_FLOOR} cleared. ${payload.rewards.souls} Souls awarded.`, 'success');
    }
  }
  return payload;
}

async function continueRun() {
  const payload = await performRunAction('continue', {});
  if (payload?.run?.phase === 'selection' && payload.run.floor > RANKED_VICTORY_FLOOR) {
    showMessage('Endless floor unlocked.', 'success');
  }
}

async function chooseRankedPact(buffId) {
  const payload = await performRunAction('pact', { buffId });
  if (payload?.run) {
    audio?.play('sfx.dungeon.pactChoose', { volume: .9 });
    revealPendingRankedInterest();
  }
  return payload;
}

async function rerollHand(point) {
  if (!canRerollWorkspace() || isBusy) return;
  const payload = await performRunAction('reroll', {
    lineup: serializeWorkspaceLineup(),
    lockHand: Boolean(serverRun.handLocked)
  });
  if (!payload?.run) return;
  const cost = Math.max(0, Number(payload.rerollCost) || RANKED_REROLL_RSOUL_COST);
  showRankedSoulChange(point, -cost);
  audio?.play('sfx.dungeon.pactReroll', { volume: .86 });
}

async function startBattle() {
  if (!canFightWorkspace() || isBusy || state.isBattleAnimating) return;
  pendingInterestGain = 0;
  const autoSale = autoSellPurchasedHandDemons();
  setBusy(true);
  isReplayingBattle = true;
  try {
    const payload = await api(
      `/api/ranked/runs/${encodeURIComponent(serverRun.runId)}/battle`,
      actionOptions({
        lineup: serializeWorkspaceLineup(),
        lockHand: Boolean(serverRun.handLocked)
      })
    );
    if (!payload?.run?.lastBattle) return;
    const interest = payload.rSoulInterest;
    acceptRun(payload.run, { render: false });
    if (Number(interest?.earned) > 0) {
      rankedSouls = Math.max(0, Number(interest.balanceBefore) || 0);
    }
    const battle = payload.run.lastBattle;
    stageRankedBattle(battle);
    setBattlePanel('combat');
    renderRun();
    await combat.playCombatLog();
    await showBattleResult(battle.winner);
    acceptRun(payload.run, { render: false });
    const resultMessages = [];
    if (autoSale.count) {
      resultMessages.push(
        `Auto-sold ${autoSale.count} purchased Hand demon${autoSale.count === 1 ? '' : 's'} for ${formatNumber(autoSale.amount)} rSouls.`
      );
    }
    if (payload.rewards?.souls) {
      resultMessages.push(`Victory milestone: ${payload.rewards.souls} Souls awarded.`);
      if (payload.player) acceptPlayer(payload.player, { animate: true });
    }
    if (Number(interest?.earned) > 0) {
      pendingInterestGain = Math.max(0, Number(interest.earned) || 0);
    }
    showMessage(resultMessages.length ? resultMessages.join(' ') : '', 'success');
    if (payload.run.awaitingVictoryChoice) {
      showRankedVictoryModal(payload.run, { rankGain: payload.rankGain });
    }
  } catch (error) {
    showError(error);
  } finally {
    isReplayingBattle = false;
    setBusy(false);
    renderRun();
    revealPendingRankedInterest();
  }
}

function toggleHandLock() {
  if (!serverRun || !isWorkspacePhase(serverRun)) return;
  const handLocked = !serverRun.handLocked;
  serverRun.handLocked = handLocked;
  state.run.handLocked = handLocked;
  renderRun();
}

async function replayRankedFight() {
  const battle = serverRun?.lastBattle;
  if (isBusy || state.isBattleAnimating || !battle?.combatLog?.length) return;

  isReplayingBattle = true;
  setBusy(true);
  try {
    stageRankedBattle(battle);
    setBattlePanel('combat');
    renderRun();
    elements.fightLog.innerHTML = '';
    elements.fightLog.classList.remove('text-muted');
    await combat.playCombatLog();
    acceptRun(serverRun, { render: false });
  } catch (error) {
    showError(error);
  } finally {
    isReplayingBattle = false;
    setBusy(false);
    renderRun();
  }
}

function stageRankedBattle(battle) {
  state.run.floor = Math.max(1, Number(battle.floor) || Number(state.run.floor) || 1);
  state.run.team = cloneDemons(battle.playerTeamBefore || state.run.team || []);
  state.run.active = state.run.team;
  state.run.enemies = cloneDemons(battle.enemyTeamBefore || state.run.enemies || []);
  state.combatLog = battle.combatLog || [];
  state.combatDemons = combat.createCombatDemonMap();
}

async function mutate(path, body) {
  setBusy(true);
  try {
    return await api(path, actionOptions(body));
  } catch (error) {
    showError(error);
    return null;
  } finally {
    setBusy(false);
  }
}

function actionOptions(body) {
  const actionId = createActionId();
  return {
    method: 'POST',
    headers: { 'Idempotency-Key': actionId },
    body: { ...body, actionId }
  };
}

function acceptRun(run, options = {}) {
  endRankedSaleDrag();
  serverRun = run;
  rankedRating = run.rating || rankedRating;
  rankedSouls = Math.max(0, Math.floor(Number(run.rSouls) || 0));
  const battle = run.lastBattle;
  workspace = isWorkspacePhase(run) ? createWorkspace(run) : null;
  state.run = {
    ...run,
    team: cloneDemons(workspace?.active || run.active || run.team),
    active: cloneDemons(workspace?.active || run.active || run.team),
    reserve: cloneDemons(workspace?.reserve || run.reserve),
    enemies: run.phase === 'result' && battle
      ? cloneDemons(battle.enemyTeamAfter)
      : cloneDemons(run.enemies)
  };
  state.combatLog = battle?.combatLog || [];
  state.combatDemons = combat.createCombatDemonMap();
  if (options.render !== false) renderRun();
  announceCombinations(run.combinationEvents || []);
}

function renderRun() {
  syncWorkspaceIntoRun();
  const run = state.run;
  const hasRun = Boolean(run);
  elements.runEmpty.classList.toggle('d-none', hasRun || state.isLoading);
  elements.runPanel.classList.toggle('d-none', !hasRun || state.isLoading);
  elements.rankedBottomPanel.classList.toggle('d-none', !hasRun || state.isLoading);

  if (!hasRun) {
    setBattlePanel('combat');
    elements.runEmpty.innerHTML = renderRankedStartCard();
    return;
  }

  if ((run.status === 'ended' || run.phase === 'ended') && !isReplayingBattle) {
    setBattlePanel('combat');
    elements.runPanel.classList.add('d-none');
    elements.rankedBottomPanel.classList.add('d-none');
    elements.runEmpty.classList.remove('d-none');
    elements.runEmpty.innerHTML = renderEndedRun(run);
    renderPacts([]);
    return;
  }

  const battlePlaybackView = isReplayingBattle || state.isBattleAnimating;
  const combatView = battlePlaybackView;
  const pactTeamPreview = Boolean(state.isPactTeamPreview && run.pendingPact && !combatView);
  const bottomControlsView = combatView || pactTeamPreview;
  const canReviewFight = Boolean(
    !bottomControlsView
    && (run.lastBattle?.combatLog?.length || state.combatLog?.length)
  );
  elements.enemyGrid.closest('.battle-side')?.classList.toggle('is-ranked-reserve', !combatView);
  elements.rankedBottomPanel.classList.toggle('is-ranked-combat', bottomControlsView);
  elements.rankedBottomPanel.classList.remove('has-fight-review');
  elements.rankedBottomPanel.classList.toggle('is-battle-active', battlePlaybackView);
  elements.dungeonHandBar.classList.toggle('d-none', !bottomControlsView);
  elements.dungeonHandBar.classList.toggle('is-battle-controls-mode', bottomControlsView);
  elements.dungeonReplayLogBox.classList.add('d-none');
  if (!combatView) setBattlePanel('combat');
  renderTeamTitle(run);
  renderEnemyTitle(run, combatView);
  renderDungeonCenterActions();
  elements.teamGrid.innerHTML = renderDemonCards(run.team || run.active || [], {
    side: 'player',
    allowFormationDrag: !combatView && !run.pendingPact
  });
  elements.enemyGrid.innerHTML = combatView
    ? renderDemonCards(run.enemies || [], { side: 'enemy' })
    : renderReserve(run.reserve || [], run);
  elements.rankedPreparation.classList.toggle(
    'd-none',
    combatView || pactTeamPreview || run.phase === 'preparation' && state.isBattleAnimating
  );
  const preparationView = !elements.rankedPreparation.classList.contains('d-none');
  const lives = Math.max(0, Math.min(3, Number(run.lives) || 0));
  const hearts = Array.from(
    { length: 3 },
    (_, index) => `
      <span class="ranked-life-heart ${index < lives ? 'is-active' : 'is-empty'}">\u2665</span>
    `
  ).join('');
  elements.rankedHandStatus.classList.toggle('d-none', !preparationView);
  elements.rankedHandStatus.setAttribute(
    'aria-label',
    `${lives} of 3 lives, ${formatNumber(rankedSouls)} Ranked Souls`
  );
  elements.rankedHandStatus.innerHTML = preparationView
    ? `
      <span class="ranked-lives" aria-hidden="true">${hearts}</span>
      <span class="ranked-hand-status-separator" aria-hidden="true">&middot;</span>
      ${renderRankedSoulBalance(run)}
    `
    : '';
  elements.rankedPreparation.innerHTML = combatView || pactTeamPreview
    ? ''
    : renderPreparation(run, { canReviewFight });
  renderFightLogActions();
  renderFightLog();
  renderPacts(run.pacts?.pendingChoices || []);
  bindCardDetails();
  decorateWorkspaceFormation();
  decorateCombinationCandidates();
  scheduleRankedPactScrollControlsSync();
}

function renderTeamTitle(run) {
  const division = run.rating?.division || 'Bronze II';
  const rank = getRankPresentation(division);
  const team = Array.isArray(run.team) ? run.team : (run.active || []);
  const maxSlots = Math.max(1, Number(run.capacities?.active) || 6);
  const occupiedSlots = Math.min(maxSlots, team.length);
  const teamSlots = `${occupiedSlots}/${maxSlots}`;
  const teamCount = `
    <span class="battle-side-count" aria-label="${escapeHtml(`${occupiedSlots} of ${maxSlots} team slots used`)}">
      ${escapeHtml(teamSlots)}
    </span>
  `;
  elements.teamSideTitle.innerHTML = `
    <span class="ranked-desktop-status">
      ${teamCount}
      ${renderRankBadge(rank, { showLabel: true })}
    </span>
    <span class="ranked-mobile-status">
      ${teamCount}
      ${renderRankBadge(rank, { showLabel: true, compact: true })}
    </span>
    ${renderBattleBuffSummaryChip(getRankedProgressionBuffs(run), { side: 'player' })}
  `;
}

function renderRankedSoulBalance(run) {
  const floor = Math.max(1, Number(run?.floor) || 1);
  const balanceInterest = Math.floor(rankedSouls / 10);
  const earned = floor + balanceInterest;
  return `
    <span class="ranked-rsoul-balance" tabindex="0" aria-describedby="rankedRSoulTooltip">
      ${renderIcon('soul')}
      <span class="ranked-rsoul-value">${formatNumber(rankedSouls)}</span>
      <span class="ranked-rsoul-tooltip" id="rankedRSoulTooltip" role="tooltip">
        <span class="ranked-rsoul-tooltip-main">
          <strong>Interest:</strong>
          ${renderIcon('soul')}
          <strong>${formatNumber(earned)}</strong>
        </span>
        <span class="ranked-rsoul-tooltip-formula">Floor number + 1 every 10 souls</span>
      </span>
    </span>
  `;
}

function renderEnemyTitle(run, combatView) {
  if (!combatView) {
    elements.enemySideTitle.innerHTML = '<span>Reserve</span>';
    return;
  }
  const opponent = run.opponent || run.lastBattle?.opponent || null;
  const name = opponent?.generated
    ? 'Ranked Rival'
    : (opponent?.hunterName || 'Opponent');
  const nameMarkup = !opponent?.generated && opponent?.hunterName
    ? `<a class="ranked-opponent-link" href="${escapeHtml(window.AmongDemons.appUrl(`/hunter/${encodeURIComponent(opponent.hunterName)}`))}">${escapeHtml(name)}</a>`
    : `<span>${escapeHtml(name)}</span>`;
  const opponentRank = getRankPresentation(opponent?.division);
  const rankMarkup = opponent?.division
    ? `
      <span class="ranked-desktop-status">
        ${renderRankBadge(opponentRank, { showLabel: true })}
      </span>
      <span class="ranked-mobile-status">
        ${renderRankBadge(opponentRank, { showLabel: true, compact: true })}
      </span>
    `
    : '';
  elements.enemySideTitle.innerHTML = `
    ${nameMarkup}
    ${rankMarkup}
    ${renderBattleBuffSummaryChip(getRankedEnemyBattleBuffs(run), { side: 'enemy' })}
  `;
}

function getRankPresentation(division = 'Bronze III') {
  const normalized = String(division || 'Bronze III').trim().toLowerCase();
  const slug = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const tier = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'demonic']
    .find((candidate) => normalized.startsWith(candidate)) || 'bronze';
  return {
    division: String(division || 'Bronze III'),
    slug,
    tier,
    imageUrl: `/app/images/assets/ranks/${tier}.svg`
  };
}

function renderRankBadge(rank, options = {}) {
  const compactClass = options.compact ? ' is-compact' : '';
  const hasTeamSlots = Number.isFinite(options.occupiedSlots) && Number.isFinite(options.maxSlots);
  const teamSlots = hasTeamSlots
    ? `${Math.max(0, options.occupiedSlots)}/${Math.max(1, options.maxSlots)}`
    : '';
  return `
    <span class="ranked-rank ranked-rank--${escapeHtml(rank.slug)}${compactClass}"
          aria-label="${escapeHtml(rank.division)} rank">
      <img class="ranked-rank-image" src="${escapeHtml(rank.imageUrl)}" alt="" width="72" height="80" aria-hidden="true">
      ${options.showLabel ? `<span class="ranked-rank-label rank-division-text rank-division-text--${escapeHtml(rank.slug)}">${escapeHtml(rank.division.toUpperCase())}</span>` : ''}
      ${hasTeamSlots ? `
        <span class="ranked-rank-separator" aria-hidden="true">&middot;</span>
        <span class="ranked-team-slots" aria-label="${escapeHtml(`${teamSlots} team slots occupied`)}">${escapeHtml(teamSlots)}</span>
      ` : ''}
    </span>
  `;
}

function getRankedProgressionBuffs(run) {
  const locked = run.lockedBonuses || {};
  const spentPoints = Object.values(locked.allocations || {})
    .reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);
  const skillTree = createLevelPowerBuff({
    spentPoints,
    bonuses: locked.skillBonuses || {}
  });
  const pacts = compactActivePacts(
    Array.isArray(run.pacts?.activeBuffs) ? run.pacts.activeBuffs : []
  );
  const otherBuffs = (Array.isArray(locked.activeBuffs) ? locked.activeBuffs : [])
    .filter((buff) => buff?.source !== 'skill_tree');

  return [
    ...(skillTree ? [skillTree] : []),
    ...pacts,
    ...otherBuffs
  ].filter((buff) => buff?.id);
}

function getRankedEnemyBattleBuffs(run) {
  const enemyBuffs = Array.isArray(run.lastBattle?.enemyBuffs)
    ? run.lastBattle.enemyBuffs
    : [];
  const levelPower = createLevelPowerBuff(run.lastBattle?.enemySkillTree);
  if (!levelPower) return enemyBuffs;
  return [
    levelPower,
    ...enemyBuffs.filter((buff) => buff?.source !== 'skill_tree')
  ];
}

function renderRankedProgressionBuff(buff) {
  return renderStackedActivePactIcon(buff, {
    stackClass: 'ranked-pact-stack',
    countClass: 'ranked-pact-stack-count'
  });
}

function renderReserve(reserve, run) {
  const slots = Array.from({ length: run.capacities.reserve }, () => null);
  const unplaced = [];
  reserve.forEach((demon) => {
    const slot = normalizeReserveSlot(demon.reserveSlot);
    if (slot !== null && !slots[slot]) {
      slots[slot] = demon;
    } else {
      unplaced.push(demon);
    }
  });
  unplaced.forEach((demon) => {
    const slot = slots.findIndex((entry) => !entry);
    if (slot >= 0) slots[slot] = demon;
  });
  const progressionBuffs = getRankedProgressionBuffs(run);
  return `
    <div class="ranked-reserve-panel">
      <div class="battle-formation battle-formation-grid battle-formation-player ranked-reserve-formation"
           data-ranked-zone="reserve" role="list" aria-label="Reserve">
        ${slots.map((demon, index) => (
          renderFormationSlot(demon, index, {
            side: 'player',
            allowFormationDrag: true
          }, 'player')
        )).join('')}
      </div>
      ${progressionBuffs.length ? `
        <div class="ranked-reserve-buffs-shell">
          <button class="ranked-pact-scroll-btn is-previous" type="button" data-ranked-pact-scroll="-1"
                  aria-label="Scroll active buffs left" title="Scroll active buffs left" hidden disabled>
            ${renderIcon('chevron-left')}
          </button>
          <div class="ranked-reserve-buffs-viewport" data-ranked-pact-scroll-viewport tabindex="0"
               role="region" aria-label="Active Ranked Pacts, Skill Tree bonuses, and buffs">
            <div class="dungeon-hand-pacts ranked-reserve-buffs">
              ${progressionBuffs.map(renderRankedProgressionBuff).join('')}
            </div>
          </div>
          <button class="ranked-pact-scroll-btn is-next" type="button" data-ranked-pact-scroll="1"
                  aria-label="Scroll active buffs right" title="Scroll active buffs right" hidden disabled>
            ${renderIcon('chevron-right')}
          </button>
        </div>
      ` : ''}
    </div>
  `;
}

function scrollRankedPacts(button) {
  const shell = button.closest('.ranked-reserve-buffs-shell');
  const viewport = shell?.querySelector('[data-ranked-pact-scroll-viewport]');
  if (!viewport || button.disabled) return;

  const row = viewport.querySelector('.ranked-reserve-buffs');
  const tile = row?.querySelector('.ranked-pact-stack');
  const rowStyles = row ? window.getComputedStyle(row) : null;
  const columnGap = parseFloat(rowStyles?.columnGap || '');
  const fallbackGap = parseFloat(rowStyles?.gap || '');
  const gap = Number.isFinite(columnGap)
    ? columnGap
    : (Number.isFinite(fallbackGap) ? fallbackGap : 0);
  const tileWidth = tile?.getBoundingClientRect().width || 0;
  const direction = Number(button.dataset.rankedPactScroll) || 0;
  const amount = Math.max(tileWidth + gap, viewport.clientWidth * .72, 1);

  viewport.scrollBy({ left: direction * amount, behavior: 'smooth' });
}

function scheduleRankedPactScrollControlsSync() {
  if (rankedPactScrollSyncFrame) window.cancelAnimationFrame(rankedPactScrollSyncFrame);
  rankedPactScrollSyncFrame = window.requestAnimationFrame(() => {
    rankedPactScrollSyncFrame = 0;
    syncRankedPactScrollControls();
  });
}

function syncRankedPactScrollControls(targetShell = null) {
  const shells = targetShell
    ? [targetShell]
    : Array.from(elements.enemyGrid?.querySelectorAll('.ranked-reserve-buffs-shell') || []);
  const compactLayout = window.matchMedia('(max-width: 1199.98px)').matches;

  shells.forEach((shell) => {
    const viewport = shell?.querySelector('[data-ranked-pact-scroll-viewport]');
    const buttons = Array.from(shell?.querySelectorAll('[data-ranked-pact-scroll]') || []);
    if (!viewport || !buttons.length) return;

    if (!compactLayout && viewport.scrollLeft) viewport.scrollLeft = 0;

    const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const hasOverflow = compactLayout && maxScroll > 1;
    const atStart = viewport.scrollLeft <= 1;
    const atEnd = viewport.scrollLeft >= maxScroll - 1;

    shell.classList.toggle('has-scroll-overflow', hasOverflow);
    shell.classList.toggle('is-scroll-start', hasOverflow && atStart);
    shell.classList.toggle('is-scroll-end', hasOverflow && atEnd);
    buttons.forEach((button) => {
      const direction = Number(button.dataset.rankedPactScroll) || 0;
      const unavailable = direction < 0 ? atStart : atEnd;
      button.hidden = !hasOverflow || unavailable;
      button.disabled = !hasOverflow || unavailable;
    });
  });
}

function renderRankedDemon(demon, options = {}) {
  const statsHtml = renderCombatStats?.(demon, { hideHpBar: true }) || '';
  return renderCard(demon, {
    className: 'ranked-preparation-demon-card',
    showStats: false,
    overlayHtml: statsHtml
      ? `<div class="ranked-preparation-stats" aria-label="Combat stats">${statsHtml}</div>`
      : '',
    attributes: {
      'data-instance-id': demon.instanceId,
      ...(options.zone !== 'enemy' ? {
        'data-ranked-workspace-id': demon.instanceId,
        'data-ranked-zone': options.zone,
        draggable: options.interactive ? 'true' : 'false',
        role: 'button',
        tabindex: options.interactive ? '0' : '-1'
      } : {})
    }
  });
}

function renderPreparation(run, options = {}) {
  const hand = workspace?.hand || [];
  const canReviewFight = Boolean(options.canReviewFight);
  const canReroll = canRerollWorkspace() && !isBusy;
  const canFight = canFightWorkspace() && !isBusy;
  const rerollLabel = `Reroll hand for ${RANKED_REROLL_RSOUL_COST} Ranked Souls`;
  const lockLabel = run.handLocked
    ? 'Unlock hand for the next floor'
    : 'Lock hand for the next floor';
  const lockIcon = renderHandLockIcon(run.handLocked);
  return `
    <div class="ranked-reroll-rail">
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-reroll-action" type="button" data-ranked-action="reroll"
              title="${rerollLabel}" aria-label="${rerollLabel}" ${canReroll ? '' : 'disabled'}>
        <span class="ranked-reroll-main">
          <span class="ranked-reroll-icon" aria-hidden="true">${renderIcon('refresh-cw')}</span>
          <span class="ranked-reroll-copy">
            <strong>Reroll</strong>
          </span>
        </span>
        <span class="ranked-reroll-cost" aria-label="${RANKED_REROLL_RSOUL_COST} Ranked Souls">
          ${renderIcon('soul')} <strong>${formatNumber(RANKED_REROLL_RSOUL_COST)}</strong>
        </span>
      </button>
      ${renderRerollOdds(run)}
    </div>
    <div class="ranked-offer-area" data-ranked-drop-zone data-ranked-zone="hand" aria-label="Hand">
      <div class="ranked-offer-grid">
        ${hand.length ? hand.map((demon, index) => `
            <div class="ranked-offer ${!demon._rankedPurchased && getRankedDemonCost(demon) > rankedSouls ? 'is-unaffordable' : ''}"
                 data-ranked-drop-zone data-ranked-zone="hand" data-ranked-index="${index}">
              ${renderRankedDemon(demon, { interactive: true, zone: 'hand' })}
              <span class="ranked-offer-cost ${demon._rankedPurchased ? 'is-purchased' : ''}"
                    aria-label="${demon._rankedPurchased ? 'Purchased' : `${getRankedDemonCost(demon)} Ranked Souls`}">
                ${demon._rankedPurchased ? renderIcon('check') : renderIcon('soul')}
                ${demon._rankedPurchased ? '' : `<span>${formatNumber(getRankedDemonCost(demon))}</span>`}
              </span>
            </div>
          `).join('') : '<div class="ranked-hand-empty">Empty</div>'}
      </div>
      <div class="ranked-hand-sale-prompt" aria-hidden="true" hidden>
        <strong>Sell Demon</strong>
        <span>Drop team or reserve demon here</span>
      </div>
    </div>
    <div class="ranked-action-dock has-end-run">
      <button class="btn ${run.handLocked ? 'btn-success' : 'btn-outline-light'} ranked-side-action ranked-side-action-compact ranked-lock-action"
              type="button" data-ranked-action="lock-hand" aria-pressed="${run.handLocked ? 'true' : 'false'}"
              title="${lockLabel}" aria-label="${lockLabel}">
        ${lockIcon} <span>${run.handLocked ? 'Locked' : 'Lock Hand'}</span>
      </button>
      <div class="ranked-review-actions" role="group" aria-label="Previous fight">
        ${renderReplayLogButtons(canReviewFight, canReviewFight)}
      </div>
      <button class="btn btn-secondary ranked-side-action ranked-side-action-compact ranked-end-run-control"
              type="button" data-ranked-action="end" title="Concede Ranked run" aria-label="Concede Ranked run">
        ${renderIcon('flag')} <span>End Run</span>
      </button>
    </div>
    <button class="btn btn-primary btn-lg ranked-side-action ranked-fight-action" type="button" data-ranked-action="fight"
            title="Start Ranked fight" aria-label="Start Ranked fight" ${canFight ? '' : 'disabled'}>
      ${renderIcon('swords')} <span>Fight</span>
    </button>
    <div class="ranked-mobile-nav has-end-run" role="group" aria-label="Ranked preparation controls">
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-reroll-btn" type="button" data-ranked-action="reroll"
              title="${rerollLabel}" aria-label="${rerollLabel}" ${canReroll ? '' : 'disabled'}>
        <span class="ranked-mobile-reroll-icon" aria-hidden="true">${renderIcon('refresh-cw')}</span>
        <span class="ranked-mobile-reroll-cost" aria-hidden="true">
          ${renderIcon('soul')} <strong>${formatNumber(RANKED_REROLL_RSOUL_COST)}</strong>
        </span>
        <span class="visually-hidden">Reroll</span>
      </button>
      <details class="ranked-mobile-odds" name="ranked-mobile-popover">
        <summary class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" title="Reroll rarity odds" aria-label="Reroll rarity odds">
          ${renderIcon('info')}
          <span class="visually-hidden">Reroll rarity odds</span>
        </summary>
        <div class="ranked-mobile-odds-popover">
          ${renderRerollOdds(run)}
        </div>
      </details>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ${run.handLocked ? 'active' : ''}" type="button"
              data-ranked-action="lock-hand" title="${lockLabel}" aria-label="${lockLabel}"
              aria-pressed="${run.handLocked ? 'true' : 'false'}">
        ${lockIcon}
        <span class="visually-hidden">${run.handLocked ? 'Unlock hand' : 'Lock hand'}</span>
      </button>
      <details class="ranked-mobile-review-menu ${canReviewFight ? '' : 'is-disabled'}" name="ranked-mobile-popover">
        <summary class="dungeon-mobile-nav-btn ranked-mobile-nav-btn" title="Fight Review" aria-label="Fight Review"
                 aria-disabled="${canReviewFight ? 'false' : 'true'}" ${canReviewFight ? '' : 'tabindex="-1"'}>
          ${renderIcon('scroll-text')}
          <span class="visually-hidden">Fight Review</span>
        </summary>
        <div class="ranked-mobile-review-popover" role="group" aria-label="Fight Review actions">
          <button class="dungeon-mobile-nav-btn ranked-mobile-review-action" id="rankedMobileReplayBtn" type="button"
                  title="Replay Fight" aria-label="Replay Fight" ${canReviewFight ? '' : 'disabled'}>
            ${renderIcon('list-restart')} <span>Replay</span>
          </button>
          <button class="dungeon-mobile-nav-btn ranked-mobile-review-action" id="rankedMobileLogBtn" type="button"
                  title="Fight Log" aria-label="Fight Log" ${canReviewFight ? '' : 'disabled'}>
            ${renderIcon('log')} <span>Fight Log</span>
          </button>
        </div>
      </details>
      <button class="dungeon-mobile-nav-btn ranked-mobile-nav-btn ranked-mobile-end-action" type="button"
              data-ranked-action="end" title="Concede Ranked run" aria-label="Concede Ranked run">
        ${renderIcon('flag')}
        <span class="visually-hidden">End Run</span>
      </button>
      <button class="dungeon-mobile-nav-btn dungeon-mobile-fight-btn ranked-mobile-nav-btn game-primary-action"
              type="button" data-ranked-action="fight" title="Start Ranked fight" aria-label="Start Ranked fight"
              ${canFight ? '' : 'disabled'}>
        ${renderIcon('swords')}
        <span class="visually-hidden">Fight</span>
      </button>
    </div>
  `;
}

function renderHandLockIcon(isLocked) {
  return isLocked ? renderIcon('lock') : renderIcon('lock-open');
}

function renderRerollOdds(run) {
  const odds = run?.rarityOdds || {};
  const items = RANKED_RARITIES.map((rarity) => {
    const chance = Math.max(0, Number(odds[rarity]) || 0);
    const label = capitalize(rarity);
    return `
      <span class="ranked-reroll-odd is-${rarity}${chance <= 0 ? ' is-zero' : ''}"
            title="${escapeHtml(label)}: ${formatNumber(chance)}%"
            aria-label="${escapeHtml(label)} ${formatNumber(chance)} percent">
        <strong>${formatNumber(chance)}%</strong>
      </span>
    `;
  }).join('');
  return `
    <div class="ranked-reroll-odds" aria-label="Reroll rarity odds per card">
      <span class="ranked-reroll-odds-grid">${items}</span>
    </div>
  `;
}

function renderFightLog() {
  if (!elements.fightLog) return;
  if (!state.combatLog?.length) {
    elements.fightLog.innerHTML = 'Fight log will appear here after a battle.';
    elements.fightLog.classList.add('text-muted');
    return;
  }
  elements.fightLog.classList.remove('text-muted');
  elements.fightLog.innerHTML = combat.groupCombatLog(state.combatLog)
    .map((step, index) => combat.renderFightLogRow(step, index))
    .join('');
}

function renderFightLogActions() {
  const run = state.run;
  if (!run || !elements.dungeonBottomControls || !elements.dungeonReplayLogBox) return;
  elements.dungeonReplayLogBox.innerHTML = '';

  if (state.isPactTeamPreview && run.pendingPact) {
    setRankedBattleControls('pact', renderDemonicPactReturnControl());
    return;
  }

  if (state.isBattleAnimating) {
    setRankedBattleControls('battle', `
      ${renderBattlePlaybackControls()}
      ${renderBattleSpeedControl()}
      ${renderBattleSkipControl()}
    `);
    syncRankedBattleControls();
    return;
  }
  setRankedBattleControls('empty', '');
}

function setRankedBattleControls(mode, html) {
  if (elements.dungeonBottomControls.dataset.rankedControlMode === mode) return;
  elements.dungeonBottomControls.innerHTML = html;
  elements.dungeonBottomControls.dataset.rankedControlMode = mode;
}

function syncRankedBattleControls() {
  const controls = elements.dungeonBottomControls;
  const playback = state.combatPlayback || {};
  const currentIndex = Number(playback.currentIndex) || 0;
  const totalSteps = Number(playback.totalSteps) || 0;
  const isPaused = Boolean(playback.isPaused);
  const toggleLabel = isPaused ? 'Play' : 'Pause';

  const previousButton = controls.querySelector('[data-battle-step="-1"]');
  const nextButton = controls.querySelector('[data-battle-step="1"]');
  const toggleButton = controls.querySelector('#battlePlaybackToggleBtn');
  if (previousButton) previousButton.disabled = currentIndex <= 0;
  if (nextButton) nextButton.disabled = currentIndex >= totalSteps;
  if (toggleButton && toggleButton.getAttribute('aria-label') !== toggleLabel) {
    toggleButton.title = toggleLabel;
    toggleButton.setAttribute('aria-label', toggleLabel);
    toggleButton.innerHTML = renderIcon(isPaused ? 'play' : 'pause');
  }
  combat.syncBattleSpeedButtons();
}

function renderPacts(choices) {
  const hasChoices = Boolean(choices?.length);
  const visible = hasChoices
    && !state.isBattleAnimating
    && !state.isLoading
    && !isReplayingBattle;
  const wasVisible = !elements.demonicPactOverlay.classList.contains('d-none');
  elements.demonicPactOverlay.classList.toggle('d-none', !visible);
  if (!visible) {
    state.isPactTeamPreview = false;
    syncRankedPactView();
    if (!hasChoices) {
      elements.rankedPactGrid.innerHTML = '';
      delete elements.rankedPactGrid.dataset.pactSignature;
    }
    return;
  }
  if (!wasVisible) state.isPactTeamPreview = false;
  const pactSignature = choices.map((buff) => `${buff.id}:${buff.rarity || 'common'}`).join('|');
  if (elements.rankedPactGrid.dataset.pactSignature !== pactSignature) {
    elements.rankedPactGrid.innerHTML = choices.map((buff) => {
      const rarity = String(buff.rarity || 'common').toLowerCase();
      return `
        <button class="demonic-pact-card is-${escapeHtml(rarity)}" type="button" data-ranked-action="pact" data-buff-id="${escapeHtml(buff.id)}">
          <span class="demonic-pact-icon" aria-hidden="true">${renderIcon(buff.icon || 'sparkles')}</span>
          <span class="demonic-pact-rarity rarity-${escapeHtml(rarity)}">${capitalize(rarity)}</span>
          <strong>${escapeHtml(buff.name || buff.id)}</strong>
          <span class="demonic-pact-description">${escapeHtml(buff.description || '')}</span>
          <span class="demonic-pact-tags">${(buff.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</span>
        </button>
      `;
    }).join('');
    elements.rankedPactGrid.dataset.pactSignature = pactSignature;
  }
  syncRankedPactView();
  if (!wasVisible) {
    audio?.play('sfx.dungeon.pactReveal', { volume: .88 });
  }
}

function toggleRankedPactView() {
  if (!elements.demonicPactOverlay || elements.demonicPactOverlay.classList.contains('d-none')) return;
  state.isPactTeamPreview = !state.isPactTeamPreview;
  renderRun();
}

function syncRankedPactView() {
  const isTeamPreview = Boolean(state.isPactTeamPreview);
  elements.demonicPactOverlay?.classList.toggle('is-team-preview', isTeamPreview);
  if (!elements.demonicPactViewToggle) return;
  elements.demonicPactViewToggle.classList.toggle('d-none', isTeamPreview);
  elements.demonicPactViewToggle.textContent = 'View Team';
  elements.demonicPactViewToggle.setAttribute('aria-expanded', String(!isTeamPreview));
}

function renderEndedRun(run) {
  const cleared = Number(run.highestClearedFloor) || 0;
  const reached = Math.max(cleared, Number(run.endReachedFloor ?? run.floor) || 1);
  const rating = Math.max(0, Number(run.rating?.rating) || 0);
  const delta = Number(run.rating?.runDelta) || 0;
  const rank = getRankPresentation(run.rating?.division || 'Bronze III');
  const reason = run.endReason || (Number(run.lives) <= 0 ? 'defeated' : 'completed');
  const victory = cleared >= RANKED_VICTORY_FLOOR;
  const title = victory
    ? 'Ranked Victory'
    : (reason === 'conceded' ? 'Run Conceded' : (reason === 'defeated' ? 'Run Defeated' : 'Run Complete'));
  const icon = victory ? 'trophy' : (reason === 'defeated' ? 'skull' : 'flag');
  const summary = victory
    ? 'Floor 20 was conquered and your climb has been recorded.'
    : (reason === 'conceded'
      ? `Your final rank was calculated from reaching Floor ${formatNumber(reached)}.`
      : 'All three lives were lost. Your rank now reflects the floor you reached.');
  const deltaClass = delta > 0 ? 'is-positive' : (delta < 0 ? 'is-negative' : 'is-neutral');
  return `
    <div class="ranked-end-card ranked-start-card ranked-results-card ranked-rank--${escapeHtml(rank.slug)} ${deltaClass}">
      <div class="ranked-start-card-glow" aria-hidden="true"></div>
      <span class="dungeon-phase-eyebrow">${escapeHtml(run.season?.name || 'Ranked Season')}</span>
      <span class="ranked-results-sigil" aria-hidden="true">${renderIcon(icon)}</span>
      <h1>${escapeHtml(title)}</h1>
      <p class="ranked-results-summary">${escapeHtml(summary)}</p>
      <div class="ranked-results-progress" aria-label="Run progress">
        <div><span>Reached</span><strong>Floor ${formatNumber(reached)}</strong></div>
        <div><span>Cleared</span><strong>Floor ${formatNumber(cleared)}</strong></div>
        <div><span>Lives Left</span><strong>${formatNumber(run.lives || 0)}</strong></div>
      </div>
      <div class="ranked-results-rank" aria-label="Final rank ${escapeHtml(rank.division)}, ${formatNumber(rating)} Rank Points">
        <span class="ranked-results-emblem" aria-hidden="true">
          <img src="${escapeHtml(rank.imageUrl)}" alt="" width="112" height="124">
        </span>
        <span class="ranked-results-rank-copy">
          <small>Final Rank</small>
          <strong class="rank-division-text rank-division-text--${escapeHtml(rank.slug)}">${escapeHtml(rank.division.toUpperCase())}</strong>
          <span>${formatNumber(rating)} RP</span>
        </span>
        <span class="ranked-results-delta ${deltaClass}">
          <small>Run Result</small>
          <strong>${formatSigned(delta)} RP</strong>
        </span>
      </div>
      <button class="btn btn-primary btn-lg ranked-results-action" type="button" data-ranked-action="start">
        ${renderIcon('trophy')} <span>Start New Run</span>
      </button>
    </div>
  `;
}

function renderRankedStartCard() {
  const division = rankedRating?.division || 'Bronze III';
  const rating = Math.max(0, Number(rankedRating?.rating) || 0);
  const rank = getRankPresentation(division);
  return `
    <div class="ranked-end-card ranked-start-card ranked-rank--${escapeHtml(rank.slug)}">
      <div class="ranked-start-card-glow" aria-hidden="true"></div>
      <span class="dungeon-phase-eyebrow">Seasonal Ranked</span>
      <h1>Draft. Adapt. Climb.</h1>
      <p class="ranked-start-summary">
        Build a temporary standardized roster, survive with three lives, and clear Floor ${RANKED_VICTORY_FLOOR}.
      </p>
      <div class="ranked-start-rank" aria-label="Current rank ${escapeHtml(rank.division)}, ${formatNumber(rating)} Rank Points">
        <span class="ranked-start-rank-eyebrow">Current Rank</span>
        <span class="ranked-start-rank-emblem" aria-hidden="true">
          <img src="${escapeHtml(rank.imageUrl)}" alt="" width="144" height="160">
        </span>
        <strong class="rank-division-text rank-division-text--${escapeHtml(rank.slug)}">${escapeHtml(rank.division.toUpperCase())}</strong>
        <span class="ranked-start-rating">${formatNumber(rating)} RP</span>
      </div>
      <div class="ranked-start-rules" aria-label="Ranked run rules">
        <span>${renderIcon('heart')} Three lives</span>
        <span>${renderIcon('shield-check')} Standardized roster</span>
        <span>${renderIcon('flag')} Floor ${RANKED_VICTORY_FLOOR} victory</span>
      </div>
      <button class="btn btn-primary btn-lg ranked-start-action" type="button" data-ranked-action="start" ${isBusy ? 'disabled' : ''}>
        ${renderIcon('trophy')} <span>Start Ranked Run</span>
      </button>
    </div>
  `;
}

function announceCombinations(events) {
  (events || []).forEach((event) => {
    if (event.deferredPreview) return;
    const key = `${event.resultInstanceId}:${event.fromRarity}:${event.toRarity}`;
    if (seenCombinationEvents.has(key)) return;
    seenCombinationEvents.add(key);
    window.AmongDemons.showGameAlert?.({
      type: 'success',
      title: `${capitalize(event.toRarity)} combination!`,
      message: `Three identical ${capitalize(event.fromRarity)} demons became one ${capitalize(event.toRarity)} demon.`,
      action: `The upgraded demon stayed in ${event.destination === 'active' ? 'your formation' : 'Reserve'}.`
    });
    window.setTimeout(() => {
      document.querySelector(`[data-instance-id="${cssEscape(event.resultInstanceId)}"]`)?.classList.add('is-team-upgrade');
    }, 0);
  });
}

function bindCardDetails() {
  document.querySelectorAll('.dungeon-demon-card[data-instance-id]').forEach((card) => {
    if (card.dataset.rankedDetailsBound === 'true') return;
    card.dataset.rankedDetailsBound = 'true';
    card.addEventListener('click', (event) => {
      if (
        event.defaultPrevented
        || Date.now() < suppressDetailUntil
        || card.classList.contains('is-dragging')
        || card.classList.contains('suppress-detail-click')
      ) return;
      openCardDetails(card);
    });
  });
}

function openCardDetails(card) {
  const demon = findAnyDemon(card?.dataset.instanceId);
  if (demon) {
    window.AmongDemons.ui?.openDemonDetailsModal?.(demon, {
      actions: getRankedDemonDetailActions(demon)
    });
  }
}

function getRankedDemonDetailActions(demon) {
  const location = getWorkspaceLocation(demon?.instanceId);
  const canSellFromHand = Boolean(
    location?.zone === 'hand'
    && demon?._rankedPurchased
    && !isBusy
    && !state.isBattleAnimating
  );
  if (!canSellFromHand) return [];

  const saleValue = getRankedDemonSellValue(demon);
  return [{
    label: 'Sell',
    helper: formatNumber(saleValue),
    icon: 'soul',
    variant: 'secondary',
    className: 'ranked-detail-sell-action',
    title: `Sell for ${formatNumber(saleValue)} Ranked Souls`,
    onClick: sellRankedDemonFromDetails
  }];
}

function sellRankedDemonFromDetails(demon, button) {
  const location = getWorkspaceLocation(demon?.instanceId);
  const currentDemon = location ? workspace?.[location.zone]?.[location.index] : null;
  if (location?.zone !== 'hand' || !currentDemon?._rankedPurchased) return;

  button.disabled = true;
  const sale = stageClientSale(
    currentDemon,
    getInteractionPoint(null, button),
    button
  );
  if (!sale) return;

  const modalElement = document.getElementById('demonDetailModal');
  window.bootstrap?.Modal.getInstance(modalElement)?.hide();
  showMessage(
    `Sold ${currentDemon.species || currentDemon.name || 'demon'} for ${formatNumber(sale.amount)} rSouls.`,
    'success'
  );
  renderRun();
}

async function showBattleResult(winner) {
  await showBattleResultOverlay(
    winner === 'player' ? 'victory' : 'defeat',
    { syncActions: false }
  );
}

function showRankedVictoryModal(run, options = {}) {
  if (!elements.rankedVictoryModal || !window.bootstrap?.Modal) return;
  const division = run?.rating?.division || 'Bronze II';
  const rank = getRankPresentation(division);
  const rankGain = Math.max(
    0,
    Number(options.rankGain ?? run?.victoryRankGain ?? run?.rating?.runDelta) || 0
  );
  const rating = Math.max(0, Number(run?.rating?.rating) || 0);
  const victoryKey = `${run?.runId || 'ranked'}:${RANKED_VICTORY_FLOOR}`;
  const rankShell = elements.rankedVictoryRankImage?.closest('.ranked-victory-rank');

  rankShell?.classList.forEach((className) => {
    if (className.startsWith('ranked-rank--')) rankShell.classList.remove(className);
  });
  rankShell?.classList.add(`ranked-rank--${rank.slug}`);
  if (elements.rankedVictoryRankImage) {
    elements.rankedVictoryRankImage.src = rank.imageUrl;
    elements.rankedVictoryRankImage.alt = `${rank.division} rank emblem`;
  }
  if (elements.rankedVictoryDivision) {
    elements.rankedVictoryDivision.textContent = rank.division;
  }
  if (elements.rankedVictoryRankGain) {
    elements.rankedVictoryRankGain.textContent = `+${formatNumber(rankGain)} RP`;
  }
  if (elements.rankedVictorySummary) {
    elements.rankedVictorySummary.textContent = (
      `${formatNumber(rating)} total RP. Endless records your highest floor but awards no additional RP.`
    );
  }
  setRankedVictoryChoiceBusy(false);
  window.bootstrap.Modal.getOrCreateInstance(elements.rankedVictoryModal, {
    backdrop: 'static',
    keyboard: false
  }).show();

  if (shownVictoryKey !== victoryKey) {
    shownVictoryKey = victoryKey;
    audio?.play('sfx.dungeon.extract', {
      volume: .94,
      queueUntilUnlock: true
    });
  }
}

async function handleRankedVictoryAction(action) {
  if (isBusy || !serverRun?.awaitingVictoryChoice) return;
  setRankedVictoryChoiceBusy(true);
  if (action === 'endless') {
    const payload = await performRunAction('continue', {});
    if (payload?.run && !payload.run.awaitingVictoryChoice) {
      window.bootstrap?.Modal.getOrCreateInstance(elements.rankedVictoryModal)?.hide();
      showMessage('Endless floor unlocked.', 'success');
      return;
    }
    setRankedVictoryChoiceBusy(false);
    return;
  }

  if (action === 'new-run') {
    const payload = await performRunAction('end', {});
    if (payload?.run?.status === 'ended') {
      window.location.href = window.AmongDemons.appUrl('/ranked');
      return;
    }
  }
  setRankedVictoryChoiceBusy(false);
}

function setRankedVictoryChoiceBusy(busy) {
  elements.rankedVictoryModal
    ?.querySelectorAll('[data-ranked-victory-action]')
    .forEach((control) => {
      control.classList.toggle('disabled', Boolean(busy));
      control.setAttribute('aria-disabled', busy ? 'true' : 'false');
      if (control.matches('button')) control.disabled = Boolean(busy);
    });
}

function findAnyDemon(instanceId) {
  return [
    ...(state.run?.team || []),
    ...(state.run?.reserve || []),
    ...(state.run?.enemies || []),
    ...(workspace?.hand || [])
  ].find((demon) => demon?.instanceId === instanceId);
}

function isWorkspacePhase(run) {
  return Boolean(run?.status === 'active' && ['draft', 'selection', 'preparation'].includes(run.phase));
}

function createWorkspace(run) {
  stagedSoldDemons = [];
  stagedPurchaseOfferIds = new Set(
    (run.offers || [])
      .filter((offer) => offer.purchased)
      .map((offer) => String(offer.offerId))
  );
  const active = cloneDemons(run.active || run.team).map((demon, index) => ({
    ...applyRankedDemonPreview(demon, run),
    formationSlot: normalizeSlot(demon.formationSlot) ?? index,
    _rankedOrigin: 'roster',
    _rankedPurchased: true
  }));
  const reserve = cloneDemons(run.reserve).map((demon, index) => ({
    ...applyRankedDemonPreview(demon, run),
    reserveSlot: normalizeReserveSlot(demon.reserveSlot) ?? index,
    _rankedOrigin: 'roster',
    _rankedPurchased: true
  }));
  const hand = (run.offers || []).map((offer) => ({
    ...applyRankedDemonPreview(offer.demon, run),
    _rankedOrigin: 'offer',
    _rankedOfferId: offer.offerId,
    _rankedCost: Math.max(0, Number(offer.cost) || getRankedDemonCost(offer.demon)),
    _rankedPurchased: Boolean(offer.purchased)
  }));
  return { active, reserve, hand };
}

function applyRankedDemonPreview(demon = {}, run = serverRun) {
  const clone = JSON.parse(JSON.stringify(demon));
  const key = `${Number(clone.typeId || clone.type_id || clone.type)}:${String(clone.rarity || 'common').toLowerCase()}`;
  const preview = run?.previewStats?.[key];
  if (!preview) return clone;
  return {
    ...clone,
    ...JSON.parse(JSON.stringify(preview)),
    hp: Math.max(1, Number(preview.maxHp) || Number(preview.hp) || 1),
    _rankedPactPreviewApplied: true
  };
}

function syncWorkspaceIntoRun() {
  if (!workspace || !state.run || !isWorkspacePhase(serverRun)) return;
  state.run.team = workspace.active;
  state.run.active = workspace.active;
  state.run.reserve = workspace.reserve;
  state.run.offers = workspace.hand
    .filter((demon) => demon._rankedOrigin === 'offer')
    .map((demon) => ({ offerId: demon._rankedOfferId, demon }));
}

function serializeWorkspaceLineup() {
  return {
    purchasedOfferIds: [...stagedPurchaseOfferIds],
    sold: stagedSoldDemons.map((demon) => serializeWorkspaceDemonReference(demon)),
    active: (workspace?.active || []).map((demon) => ({
      ...serializeWorkspaceDemonReference(demon),
      formationSlot: normalizeSlot(demon.formationSlot)
    })),
    reserve: (workspace?.reserve || []).map((demon) => ({
      ...serializeWorkspaceDemonReference(demon),
      reserveSlot: normalizeReserveSlot(demon.reserveSlot)
    })),
    hand: (workspace?.hand || []).map((demon) => serializeWorkspaceDemonReference(demon))
  };
}

function serializeWorkspaceDemonReference(demon) {
  return demon?._rankedCombinationRecipe
    ? { combination: JSON.parse(JSON.stringify(demon._rankedCombinationRecipe)) }
    : { instanceId: demon?.instanceId };
}

function getSelectedOfferCount() {
  return [...(workspace?.active || []), ...(workspace?.reserve || [])]
    .filter((demon) => demon._rankedOrigin === 'offer').length;
}

function getRemainingWorkspacePicks() {
  return Math.max(0, Number(serverRun?.picksRemaining) - getSelectedOfferCount());
}

function getDiscardedRosterCount() {
  const keptIds = new Set(
    [...(workspace?.active || []), ...(workspace?.reserve || [])]
      .map((demon) => String(demon.instanceId))
  );
  return [...(serverRun?.active || []), ...(serverRun?.reserve || [])]
    .filter((demon) => !keptIds.has(String(demon.instanceId))).length;
}

function canFightWorkspace() {
  return Boolean(
    workspace
    && serverRun?.status === 'active'
    && !serverRun.pendingPact
    && workspace.active.length > 0
    && workspace.active.length <= Number(serverRun.capacities?.active || 6)
    && workspace.reserve.length <= Number(serverRun.capacities?.reserve || 6)
  );
}

function canRerollWorkspace() {
  if (
    !workspace
    || !['draft', 'selection'].includes(serverRun?.phase)
    || serverRun.pendingPact
  ) return false;
  return rankedSouls >= RANKED_REROLL_RSOUL_COST;
}

function decorateWorkspaceFormation() {
  if (!workspace || isReplayingBattle || state.isBattleAnimating || state.run?.phase === 'result') return;
  elements.teamGrid.querySelectorAll('.formation-slot').forEach((slot) => {
    const dropTarget = slot.querySelector('.formation-lane-cards');
    if (!dropTarget) return;
    dropTarget.dataset.rankedDropZone = '';
    dropTarget.dataset.rankedZone = 'active';
    dropTarget.dataset.formationSlot = slot.dataset.formationSlot;
    const card = dropTarget.querySelector('.dungeon-demon-card[data-instance-id]');
    if (!card) return;
    card.dataset.rankedWorkspaceId = card.dataset.instanceId;
    card.dataset.rankedZone = 'active';
    card.setAttribute('draggable', 'true');
  });
  elements.enemyGrid.querySelectorAll('.ranked-reserve-formation .formation-slot').forEach((slot, index) => {
    slot.setAttribute('aria-label', `Reserve slot ${index + 1}`);
    const dropTarget = slot.querySelector('.formation-lane-cards');
    if (!dropTarget) return;
    dropTarget.dataset.rankedDropZone = '';
    dropTarget.dataset.rankedZone = 'reserve';
    dropTarget.dataset.rankedIndex = String(index);
    const card = dropTarget.querySelector('.dungeon-demon-card[data-instance-id]');
    if (!card) return;
    card.dataset.rankedWorkspaceId = card.dataset.instanceId;
    card.dataset.rankedZone = 'reserve';
    card.setAttribute('draggable', 'true');
  });
}

function decorateCombinationCandidates() {
  if (!workspace || isReplayingBattle || state.isBattleAnimating || state.run?.phase === 'result') return;
  const candidates = getCombinationCandidateIds();
  candidates.forEach((instanceId) => {
    const card = document.querySelector(
      `.ranked-page .dungeon-demon-card[data-instance-id="${cssEscape(instanceId)}"]`
    );
    if (!card) return;
    card.classList.add('is-ranked-combine-ready');
    if (!card.querySelector('.dungeon-team-upgrade-indicator')) {
      card.insertAdjacentHTML('afterbegin', renderTeamUpgradeIndicator());
    }
  });
}

function getCombinationCandidateIds() {
  const groups = new Map();
  [
    ...(workspace?.active || []),
    ...(workspace?.reserve || []),
    ...(workspace?.hand || [])
  ].forEach((demon) => {
    const rarity = String(demon?.rarity || '').toLowerCase();
    const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
    if (!typeId || !getNextRankedRarity(rarity)) return;
    const key = `${typeId}:${rarity}`;
    const group = groups.get(key) || [];
    group.push(String(demon.instanceId));
    groups.set(key, group);
  });
  return new Set(
    [...groups.values()]
      .filter((group) => group.length >= 3)
      .flat()
  );
}

function getWorkspaceDropTarget(node) {
  if (!workspace || !(node instanceof Element)) return null;
  const card = node.closest('[data-ranked-workspace-id]');
  if (card) return card;
  return node.closest('[data-ranked-drop-zone]');
}

function getWorkspaceLocation(instanceId) {
  for (const zone of ['active', 'reserve', 'hand']) {
    const index = workspace?.[zone]?.findIndex((demon) => String(demon.instanceId) === String(instanceId));
    if (index >= 0) {
      return {
        zone,
        index,
        slot: zone === 'active'
          ? normalizeSlot(workspace[zone][index].formationSlot)
          : (zone === 'reserve' ? normalizeReserveSlot(workspace[zone][index].reserveSlot) ?? index : null)
      };
    }
  }
  return null;
}

function describeDropTarget(target) {
  const card = target.closest?.('[data-ranked-workspace-id]');
  if (card) {
    const location = getWorkspaceLocation(card.dataset.rankedWorkspaceId);
    return location ? { ...location, occupantId: card.dataset.rankedWorkspaceId } : null;
  }
  const zone = target.dataset.rankedZone;
  if (!['active', 'reserve', 'hand'].includes(zone)) return null;
  const slot = zone === 'active'
    ? normalizeSlot(target.dataset.formationSlot ?? target.closest('.formation-slot')?.dataset.formationSlot)
    : (zone === 'reserve'
      ? normalizeReserveSlot(target.dataset.rankedIndex ?? target.closest('.formation-slot')?.dataset.formationSlot)
      : null);
  const rawIndex = Number(target.dataset.rankedIndex);
  const index = Number.isInteger(rawIndex) && rawIndex >= 0 ? rawIndex : workspace[zone].length;
  return { zone, slot, index, occupantId: null };
}

function getAvailableReserveDestination(destination = null) {
  const capacity = Number(serverRun?.capacities?.reserve || 6);
  if (workspace.reserve.length >= capacity) return null;

  const occupiedSlots = new Set(
    workspace.reserve
      .map((demon, index) => normalizeReserveSlot(demon.reserveSlot) ?? normalizeReserveSlot(index))
      .filter((slot) => slot !== null)
  );
  const requestedSlot = destination?.zone === 'reserve' && !destination.occupantId
    ? normalizeReserveSlot(destination.slot ?? destination.index)
    : null;
  const slot = requestedSlot !== null && !occupiedSlots.has(requestedSlot)
    ? requestedSlot
    : Array.from({ length: capacity }, (_, index) => index)
      .find((candidate) => !occupiedSlots.has(candidate));
  if (!Number.isInteger(slot)) return null;

  return {
    zone: 'reserve',
    slot,
    index: workspace.reserve.length,
    occupantId: null
  };
}

async function moveWorkspaceDemon(instanceId, target, point = null) {
  if (!workspace || isBusy || state.isBattleAnimating) return;
  const source = getWorkspaceLocation(instanceId);
  const destination = describeDropTarget(target);
  if (!source || !destination || destination.occupantId === String(instanceId)) {
    clearDragOver();
    return;
  }

  const before = {
    active: cloneDemons(workspace.active),
    reserve: cloneDemons(workspace.reserve),
    hand: cloneDemons(workspace.hand)
  };
  const sourceDemon = workspace[source.zone][source.index];
  const destinationDemon = destination.occupantId
    ? workspace[destination.zone][destination.index]
    : null;
  if (source.zone !== 'hand' && destination.zone === 'hand') {
    stageClientSale(sourceDemon, point, target);
    clearDragOver();
    renderRun();
    return;
  }
  const purchaseDemon = (
    source.zone === 'hand'
    && sourceDemon?._rankedOrigin === 'offer'
    && !sourceDemon._rankedPurchased
    && ['active', 'reserve'].includes(destination.zone)
  ) ? sourceDemon : (
    destination.zone === 'hand'
    && destinationDemon?._rankedOrigin === 'offer'
    && !destinationDemon._rankedPurchased
    && ['active', 'reserve'].includes(source.zone)
      ? destinationDemon
      : null
  );
  const purchaseCost = purchaseDemon ? getRankedDemonCost(purchaseDemon) : 0;
  if (purchaseDemon && purchaseCost > rankedSouls) {
    clearDragOver();
    showMessage(`This card costs ${formatNumber(purchaseCost)} rSouls.`, 'warning');
    renderRun();
    return;
  }
  const directCombination = getDirectPurchaseCombination(
    sourceDemon,
    source,
    destination,
    destinationDemon
  );
  if (directCombination) {
    removeWorkspaceDemon(instanceId);
    stageClientPurchase(purchaseDemon, purchaseCost, point, target);
    const combinationEvents = [
      combineWorkspaceDemonEntries(
        directCombination.consumed,
        directCombination.destinationEntry,
        directCombination.rarity
      ),
      ...applyClientCombinations()
    ].filter(Boolean);
    clearDragOver();
    renderRun();
    playClientCombinationFeedback(combinationEvents);
    return;
  }
  const placementDestination = purchaseDemon === sourceDemon && destination.zone !== 'active'
    ? (getAvailableReserveDestination(destination) || destination)
    : destination;
  const activeCapacity = Number(serverRun.capacities?.active || 6);
  if (
    placementDestination.zone === 'active'
    && source.zone !== 'active'
    && !placementDestination.occupantId
    && workspace.active.length >= activeCapacity
  ) {
    clearDragOver();
    showMessage(`Floor ${formatNumber(serverRun.floor)} allows ${formatNumber(activeCapacity)} active demons.`, 'warning');
    renderRun();
    return;
  }
  const demon = removeWorkspaceDemon(instanceId);
  const occupant = placementDestination.occupantId
    ? removeWorkspaceDemon(placementDestination.occupantId)
    : null;
  if (!demon || !placeWorkspaceDemon(demon, placementDestination)) {
    workspace = before;
    clearDragOver();
    renderRun();
    return;
  }
  const occupantDestination = source.zone === 'hand' && placementDestination.zone === 'active'
    ? (getAvailableReserveDestination() || source)
    : source;
  if (occupant && !placeWorkspaceDemon(occupant, occupantDestination)) {
    workspace = before;
    clearDragOver();
    renderRun();
    return;
  }
  if (
    workspace.active.length > Number(serverRun.capacities?.active || 6)
    || workspace.reserve.length > Number(serverRun.capacities?.reserve || 6)
  ) {
    workspace = before;
  }
  if (workspace !== before && purchaseDemon) {
    stageClientPurchase(purchaseDemon, purchaseCost, point, target);
  }
  const combinationEvents = workspace === before ? [] : applyClientCombinations();
  clearDragOver();
  renderRun();
  playClientCombinationFeedback(combinationEvents);
}

function getDirectPurchaseCombination(sourceDemon, source, destination, destinationDemon) {
  if (
    source.zone !== 'hand'
    || sourceDemon?._rankedOrigin !== 'offer'
    || sourceDemon._rankedPurchased
    || !['active', 'reserve'].includes(destination.zone)
    || !destination.occupantId
    || !destinationDemon
  ) return null;

  const rarity = String(sourceDemon.rarity || '').toLowerCase();
  const typeId = Number(sourceDemon.typeId || sourceDemon.type_id || sourceDemon.type);
  if (
    !getNextRankedRarity(rarity)
    || Number(destinationDemon.typeId || destinationDemon.type_id || destinationDemon.type) !== typeId
    || String(destinationDemon.rarity || '').toLowerCase() !== rarity
  ) return null;

  const rosterMatches = [
    ...workspace.active.map((demon) => ({ zone: 'active', demon })),
    ...workspace.reserve.map((demon) => ({ zone: 'reserve', demon }))
  ].filter((entry) => (
    Number(entry.demon?.typeId || entry.demon?.type_id || entry.demon?.type) === typeId
    && String(entry.demon?.rarity || '').toLowerCase() === rarity
  ));
  const destinationEntry = rosterMatches.find((entry) => (
    String(entry.demon.instanceId) === String(destinationDemon.instanceId)
  ));
  const otherEntry = rosterMatches.find((entry) => (
    String(entry.demon.instanceId) !== String(destinationDemon.instanceId)
  ));
  if (!destinationEntry || !otherEntry) return null;

  return {
    rarity,
    destinationEntry,
    consumed: [
      destinationEntry,
      otherEntry,
      { zone: 'hand', demon: sourceDemon }
    ]
  };
}

function stageClientPurchase(demon, cost, point, target) {
  if (!demon) return;
  demon._rankedPurchased = true;
  demon._rankedCost = cost;
  stagedPurchaseOfferIds.add(String(demon._rankedOfferId));
  rankedSouls = Math.max(0, rankedSouls - cost);
  showRankedSoulChange(point || getInteractionPoint(null, target), -cost);
  audio?.play('sfx.world.merchantPurchase', { volume: .82 });
}

function autoSellPurchasedHandDemons() {
  const purchased = (workspace?.hand || []).filter((demon) => demon?._rankedPurchased);
  if (!purchased.length) return { count: 0, amount: 0 };

  let amount = 0;
  let count = 0;
  purchased.forEach((demon) => {
    const sold = removeWorkspaceDemon(demon.instanceId);
    if (!sold) return;
    stagedSoldDemons.push(sold);
    amount += getRankedDemonSellValue(sold);
    count += 1;
  });
  if (!count) return { count: 0, amount: 0 };

  rankedSouls += amount;
  const total = elements.rankedHandStatus?.querySelector('.ranked-rsoul-value');
  showRankedSoulChange(getInteractionPoint(null, total), amount, { interest: true });
  audio?.play('sfx.world.merchantPurchase', { volume: .82 });
  return { count, amount };
}

function stageClientSale(demon, point, target) {
  if (!demon) return null;
  const saleSource = getWorkspaceLocation(demon.instanceId);
  const sold = removeWorkspaceDemon(demon.instanceId);
  if (!sold) return null;
  const amount = getRankedDemonSellValue(sold);
  stagedSoldDemons.push(sold);
  rankedSouls += amount;
  const reserveRefill = saleSource?.zone === 'reserve'
    ? refillReserveFromPurchasedHand(saleSource.slot)
    : null;
  showRankedSoulChange(
    point || getInteractionPoint(null, target),
    amount,
    { interest: true }
  );
  audio?.play('sfx.world.merchantPurchase', { volume: .82 });
  return { sold, amount, reserveRefill };
}

function refillReserveFromPurchasedHand(preferredSlot) {
  const purchasedDemon = workspace?.hand?.find((demon) => demon?._rankedPurchased);
  if (!purchasedDemon) return null;

  const source = getWorkspaceLocation(purchasedDemon.instanceId);
  const destination = getAvailableReserveDestination({
    zone: 'reserve',
    slot: preferredSlot,
    index: preferredSlot,
    occupantId: null
  });
  if (!source || !destination) return null;

  const moved = removeWorkspaceDemon(purchasedDemon.instanceId);
  if (!moved) return null;
  if (!placeWorkspaceDemon(moved, destination)) {
    placeWorkspaceDemon(moved, source);
    return null;
  }
  return moved;
}

function removeWorkspaceDemon(instanceId) {
  const location = getWorkspaceLocation(instanceId);
  if (!location) return null;
  return workspace[location.zone].splice(location.index, 1)[0] || null;
}

function placeWorkspaceDemon(demon, location) {
  if (!demon || !location || !workspace[location.zone]) return false;
  if (location.zone === 'active') {
    if (workspace.active.length >= Number(serverRun.capacities?.active || 6)) return false;
    const slot = normalizeSlot(location.slot);
    if (slot === null || workspace.active.some((entry) => normalizeSlot(entry.formationSlot) === slot)) return false;
    demon.formationSlot = slot;
    demon.position = slot % 3 === 2 ? 'front' : 'back';
    workspace.active.push(demon);
    workspace.active.sort((left, right) => Number(left.formationSlot) - Number(right.formationSlot));
    return true;
  }
  if (location.zone === 'reserve' && workspace.reserve.length >= Number(serverRun.capacities?.reserve || 6)) {
    return false;
  }
  if (location.zone === 'reserve') {
    const slot = normalizeReserveSlot(location.slot ?? location.index);
    if (slot === null || workspace.reserve.some((entry) => normalizeReserveSlot(entry.reserveSlot) === slot)) {
      return false;
    }
    delete demon.formationSlot;
    demon.reserveSlot = slot;
    demon.position = demon.preferredPosition === 'back' ? 'back' : 'front';
    workspace.reserve.push(demon);
    return true;
  }
  delete demon.formationSlot;
  delete demon.reserveSlot;
  demon.position = demon.preferredPosition === 'back' ? 'back' : 'front';
  const index = Math.min(Math.max(0, Number(location.index) || 0), workspace[location.zone].length);
  workspace[location.zone].splice(index, 0, demon);
  return true;
}

function applyClientCombinations() {
  if (!workspace) return [];
  const events = [];
  let combined = true;

  while (combined) {
    combined = false;
    for (const rarity of RANKED_RARITIES.slice(0, -1)) {
      const groups = new Map();
      const entries = [
        ...workspace.active.map((demon) => ({ zone: 'active', demon })),
        ...workspace.reserve.map((demon) => ({ zone: 'reserve', demon }))
      ];
      entries.forEach((entry) => {
        if (String(entry.demon?.rarity || '').toLowerCase() !== rarity) return;
        const key = `${Number(entry.demon?.typeId)}:${rarity}`;
        const group = groups.get(key) || [];
        group.push(entry);
        groups.set(key, group);
      });
      const match = [...groups.values()].find((group) => group.length >= 3);
      if (!match) continue;

      const consumed = match.slice(0, 3);
      const destinationEntry = consumed.find((entry) => entry.zone === 'active') || consumed[0];
      events.push(combineWorkspaceDemonEntries(consumed, destinationEntry, rarity));
      combined = true;
      break;
    }
  }

  return events;
}

function combineWorkspaceDemonEntries(consumed, destinationEntry, rarity) {
  const consumedIds = new Set(consumed.map((entry) => String(entry.demon.instanceId)));
  workspace.active = workspace.active.filter((demon) => !consumedIds.has(String(demon.instanceId)));
  workspace.reserve = workspace.reserve.filter((demon) => !consumedIds.has(String(demon.instanceId)));

  const upgraded = createClientCombinationDemon(
    consumed.map((entry) => entry.demon),
    getNextRankedRarity(rarity),
    destinationEntry
  );
  workspace[destinationEntry.zone].push(upgraded);
  if (destinationEntry.zone === 'active') {
    workspace.active.sort((left, right) => Number(left.formationSlot) - Number(right.formationSlot));
  }
  return {
    resultInstanceId: upgraded.instanceId,
    fromRarity: rarity,
    toRarity: upgraded.rarity,
    destination: destinationEntry.zone
  };
}

function createClientCombinationDemon(consumed, rarity, destinationEntry) {
  const source = consumed[0] || {};
  const typeId = Number(source.typeId || source.type_id || source.type);
  previewCombinationCounter += 1;
  const instanceId = `ranked-preview-combine-${Date.now()}-${previewCombinationCounter}`;
  const type = rankedCatalog?.types?.[String(typeId)] || {};
  const asset = rankedCatalog?.demons?.find((candidate) => (
    Number(candidate.type) === typeId
    && String(candidate.rarity).toLowerCase() === rarity
  ));
  const multiplier = Number(type.rarityMultiplier?.[rarity]) || 1;
  const upgraded = asset ? {
    instanceId,
    sourceDemonId: asset.id,
    typeId,
    species: type.name || source.species,
    role: type.role || source.role,
    targeting: type.targeting || source.targeting,
    preferredPosition: type.preferredPosition === 'back' ? 'back' : 'front',
    rarity,
    imageUrl: asset.image_url || asset.imageUrl,
    maxHp: midpointRankedStat(type.baseStats?.hp, multiplier),
    hp: midpointRankedStat(type.baseStats?.hp, multiplier),
    atk: midpointRankedStat(type.baseStats?.atk, multiplier),
    speed: midpointRankedStat(type.baseStats?.speed, multiplier),
    position: type.preferredPosition === 'back' ? 'back' : 'front',
    attackMeter: 0,
    ranked: true
  } : {
    ...JSON.parse(JSON.stringify(source)),
    instanceId,
    rarity,
    hp: Math.max(1, Number(source.maxHp) || Number(source.hp) || 1),
    attackMeter: 0
  };

  delete upgraded.formationSlot;
  delete upgraded.reserveSlot;
  delete upgraded._rankedCost;
  delete upgraded._rankedOfferId;
  delete upgraded._rankedPurchased;
  upgraded._rankedOrigin = 'combination';
  upgraded._rankedCombinationRecipe = {
    sources: consumed.map((demon) => serializeWorkspaceDemonReference(demon))
  };
  if (destinationEntry.zone === 'active') {
    upgraded.formationSlot = normalizeSlot(destinationEntry.demon.formationSlot);
    upgraded.position = upgraded.formationSlot % 3 === 2 ? 'front' : 'back';
  } else {
    upgraded.reserveSlot = normalizeReserveSlot(destinationEntry.demon.reserveSlot);
  }
  return applyRankedDemonPreview(upgraded);
}

function midpointRankedStat(bounds, multiplier) {
  const min = Number(bounds?.[0]) || 1;
  const max = Number(bounds?.[1]) || min;
  return Math.max(1, Math.round(((min + max) / 2) * multiplier));
}

function getNextRankedRarity(rarity) {
  const index = RANKED_RARITIES.indexOf(String(rarity || '').toLowerCase());
  return index >= 0 && index < RANKED_RARITIES.length - 1
    ? RANKED_RARITIES[index + 1]
    : null;
}

function playClientCombinationFeedback(events) {
  if (!events?.length) return;
  window.requestAnimationFrame(() => {
    let visibleIndex = 0;
    events.forEach((event) => {
      const card = document.querySelector(
        `.ranked-page .dungeon-demon-card[data-instance-id="${cssEscape(event.resultInstanceId)}"]`
      );
      if (!card) return;
      const delay = visibleIndex * 120;
      visibleIndex += 1;
      window.setTimeout(() => {
        attachRankedCombinationNova(card);
        audio?.play('sfx.progression.trainingSuccess', { volume: .88 });
      }, delay);
    });
  });
}

function attachRankedCombinationNova(card) {
  const rect = card?.getBoundingClientRect?.();
  if (!rect) return;
  const nova = document.createElement('span');
  nova.className = 'ranked-combination-nova';
  nova.setAttribute('aria-hidden', 'true');
  nova.style.setProperty(
    '--ranked-combination-nova-size',
    `${Math.round(Math.max(48, rect.width, rect.height) * 1.5)}px`
  );
  nova.style.left = `${Math.round(rect.left + rect.width / 2)}px`;
  nova.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
  nova.innerHTML = `
    <span class="ranked-combination-nova-ring"></span>
    <span class="ranked-combination-nova-ring is-delayed"></span>
    <span class="ranked-combination-nova-core"></span>
    ${Array.from({ length: 6 }, (_, index) => (
      `<span class="ranked-combination-nova-ray" style="--angle: ${index * 60}deg"></span>`
    )).join('')}
  `;
  document.body.appendChild(nova);
  card.classList.add('is-ranked-upgrading');
  nova.addEventListener('animationend', (event) => {
    if (event.target === nova) nova.remove();
  });
  window.setTimeout(() => {
    nova.remove();
    card.classList.remove('is-ranked-upgrading');
  }, 1000);
}

function clearDragOver() {
  document.querySelectorAll('.is-drag-over').forEach((target) => target.classList.remove('is-drag-over'));
}

function beginRankedSaleDrag(instanceId) {
  const source = getWorkspaceLocation(instanceId);
  setRankedSaleTargetState(Boolean(source && source.zone !== 'hand'));
}

function endRankedSaleDrag() {
  setRankedSaleTargetState(false);
}

function setRankedSaleTargetState(active) {
  const selling = Boolean(active);
  const offerArea = elements.rankedPreparation?.querySelector('.ranked-offer-area');
  const offerGrid = offerArea?.querySelector('.ranked-offer-grid');
  const prompt = offerArea?.querySelector('.ranked-hand-sale-prompt');
  document.documentElement.classList.toggle('is-ranked-selling-demon', selling);
  elements.rankedBottomPanel?.classList.toggle('is-ranked-selling-demon', selling);
  offerArea?.classList.toggle('is-ranked-sale-target', selling);
  offerArea?.setAttribute('aria-label', selling ? 'Sell Demon' : 'Hand');
  offerGrid?.toggleAttribute('hidden', selling);
  offerArea?.querySelectorAll('.ranked-offer, .ranked-hand-empty').forEach((card) => {
    card.toggleAttribute('hidden', selling);
  });
  prompt?.toggleAttribute('hidden', !selling);
  prompt?.setAttribute('aria-hidden', String(!selling));
}

function beginPointerDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const card = event.target.closest('[data-ranked-workspace-id]');
  if (!card || !workspace || isBusy || state.isBattleAnimating) return;
  pointerDrag = {
    card,
    instanceId: card.dataset.rankedWorkspaceId,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
    ghost: null,
    target: null
  };
  beginRankedSaleDrag(pointerDrag.instanceId);
  card.setPointerCapture?.(event.pointerId);
}

function updatePointerDrag(event) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
  if (!pointerDrag.active && distance < 8) return;
  if (!pointerDrag.active) activatePointerDrag(event);
  if (event.cancelable) event.preventDefault();
  pointerDrag.ghost.style.left = `${event.clientX}px`;
  pointerDrag.ghost.style.top = `${event.clientY}px`;
  pointerDrag.ghost.hidden = true;
  const element = document.elementFromPoint(event.clientX, event.clientY);
  pointerDrag.ghost.hidden = false;
  const target = getWorkspaceDropTarget(element);
  clearDragOver();
  target?.classList.add('is-drag-over');
  pointerDrag.target = target;
}

function activatePointerDrag(event) {
  pointerDrag.active = true;
  beginRankedSaleDrag(pointerDrag.instanceId);
  pointerDrag.card.classList.add('is-dragging', 'is-pointer-dragging', 'suppress-detail-click');
  pointerDrag.ghost = pointerDrag.card.cloneNode(true);
  pointerDrag.ghost.classList.add('pointer-drag-ghost');
  pointerDrag.ghost.classList.remove('is-dragging', 'is-pointer-dragging', 'suppress-detail-click', 'is-drag-over');
  pointerDrag.ghost.removeAttribute('role');
  pointerDrag.ghost.removeAttribute('tabindex');
  pointerDrag.ghost.setAttribute('aria-hidden', 'true');
  pointerDrag.ghost.style.width = `${pointerDrag.card.getBoundingClientRect().width}px`;
  pointerDrag.ghost.style.left = `${event.clientX}px`;
  pointerDrag.ghost.style.top = `${event.clientY}px`;
  document.body.appendChild(pointerDrag.ghost);
}

function finishPointerDrag(event) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  const drag = pointerDrag;
  if (drag.active) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    suppressDetailUntil = Date.now() + 350;
    const target = drag.target;
    cleanupPointerDrag();
    if (target) void moveWorkspaceDemon(drag.instanceId, target, {
      x: event.clientX,
      y: event.clientY
    });
    return;
  }
  cleanupPointerDrag();
}

function cancelPointerDrag(event) {
  if (!pointerDrag || event.pointerId !== pointerDrag.pointerId) return;
  cleanupPointerDrag({ preserveSaleTarget: nativeDragActive });
}

function cleanupPointerDrag(options = {}) {
  if (!pointerDrag) return;
  pointerDrag.card?.classList.remove('is-dragging', 'is-pointer-dragging', 'suppress-detail-click');
  pointerDrag.ghost?.remove();
  pointerDrag = null;
  if (!options.preserveSaleTarget) endRankedSaleDrag();
  clearDragOver();
}

function getDemonPosition(demon) {
  return demon?.position === 'back' ? 'back' : 'front';
}

function renderDungeonCenterActions() {
  if (!elements.dungeonCenterActions) return;
  const floor = Math.max(1, Number(state.run?.floor) || 1);
  elements.dungeonCenterActions.innerHTML = `
    <span class="dungeon-floor-marker ranked-floor-marker" aria-label="Current floor ${formatNumber(floor)}">
      <span>Floor</span>
      <strong>${formatNumber(floor)}</strong>
    </span>
  `;
}

function normalizeSlot(slot) {
  const number = Number(slot);
  return Number.isInteger(number) && number >= 0 && number < 9 ? number : null;
}

function normalizeReserveSlot(slot) {
  const number = Number(slot);
  const capacity = Number(serverRun?.capacities?.reserve || 6);
  return Number.isInteger(number) && number >= 0 && number < capacity ? number : null;
}

function getRankedDemonCost(demon) {
  const assigned = Number(demon?._rankedCost);
  if (Number.isFinite(assigned) && assigned >= 0) return Math.floor(assigned);
  const rarity = String(demon?.rarity || 'common').toLowerCase();
  return RANKED_CARD_RARITY_COSTS[rarity] || RANKED_CARD_RARITY_COSTS.common;
}

function getRankedDemonSellValue(demon) {
  return Math.ceil(getRankedDemonCost(demon) / 2);
}

function acceptPlayer(player, options = {}) {
  if (!player) return;
  const session = window.AmongDemons.getSession?.() || {};
  window.AmongDemons.setSession?.({
    ...session,
    player: {
      ...(session.player || {}),
      ...player
    }
  });
  window.AmongDemons.ui?.updateNavAccount?.(player, options);
}

function getInteractionPoint(event, element) {
  if (Number.isFinite(event?.clientX) && Number.isFinite(event?.clientY) && (event.clientX || event.clientY)) {
    return { x: event.clientX, y: event.clientY };
  }
  const rect = element?.getBoundingClientRect?.();
  return rect
    ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function showRankedSoulInterest(amount) {
  const total = elements.rankedHandStatus?.querySelector('.ranked-rsoul-value');
  showRankedSoulChange(
    getInteractionPoint(null, total),
    amount,
    { interest: true }
  );
}

function revealPendingRankedInterest() {
  if (pendingInterestGain <= 0 || serverRun?.pendingPact) return;
  const earned = pendingInterestGain;
  pendingInterestGain = 0;
  window.requestAnimationFrame(() => showRankedSoulInterest(earned));
}

function showRankedSoulChange(point, amount, options = {}) {
  const floating = document.createElement('span');
  const change = Number(amount) || 0;
  const startX = Math.round(Number(point?.x) || window.innerWidth / 2);
  const startY = Math.round(Number(point?.y) || window.innerHeight / 2);
  floating.className = [
    'ranked-soul-spend-float',
    change > 0 ? 'is-gain' : 'is-spend',
    options.interest ? 'is-interest' : ''
  ].filter(Boolean).join(' ');
  floating.style.left = `${startX}px`;
  floating.style.top = `${startY}px`;
  floating.innerHTML = options.interest
    ? `<strong>+</strong>${renderIcon('soul')}<strong>${formatNumber(Math.abs(change))}</strong>`
    : `${renderIcon('soul')}<strong>${change > 0 ? '+' : '-'}${formatNumber(Math.abs(change))}</strong>`;
  document.body.appendChild(floating);
  floating.addEventListener('animationend', () => floating.remove(), { once: true });
  window.setTimeout(() => floating.remove(), 1400);
}

function setLoading(loading) {
  state.isLoading = Boolean(loading);
  elements.runLoading?.classList.toggle('d-none', !loading);
}

function setBusy(busy) {
  isBusy = Boolean(busy);
  document.documentElement.classList.toggle('is-ranked-busy', isBusy);
}

function showError(error) {
  console.error(error);
  window.AmongDemons.setGameAlert(elements.rankedMessage, error, { type: 'danger' });
}

function showMessage(message, type = 'info') {
  window.AmongDemons.setGameAlert(elements.rankedMessage, message, { type });
}

function createActionId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `ranked-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function cloneDemons(demons = []) {
  return (demons || []).map((demon) => JSON.parse(JSON.stringify(demon)));
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatSigned(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function cssEscape(value) {
  return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/["\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback, { once: true });
    return;
  }
  callback();
}
