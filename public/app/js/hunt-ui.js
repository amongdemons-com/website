(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSharedDemonCard = window.AmongDemons.ui.renderDemonCard;
  const renderSharedCombatStats = window.AmongDemons.ui.renderCombatStats;
  const openDemonDetailsModal = window.AmongDemons.ui.openDemonDetailsModal;
  const renderIcon = window.AmongDemons.ui.renderIcon || (() => '');
  const RUN_KEY = 'amongdemons-current-run';
  const BATTLE_SPEED_KEY = 'amongdemons-battle-speed';
  const MAX_DUNGEON_FLOOR = 20;
  const MAX_DUNGEON_TEAM_SIZE = 6;
  const FORMATION_GRID_COLUMNS = 3;
  const FORMATION_GRID_SIZE = 9;
  const FORMATION_CELL_CAPACITY = 1;
  const BATTLE_SPEED_OPTIONS = [0.5, 1, 2, 4];
  const FORMATION_DRAG_OVER_SELECTOR = '.formation-lane-cards.is-drag-over';
  const RECRUIT_DRAG_OVER_SELECTOR = '.hunt-demon-card.is-drag-over, .formation-lane-cards.is-drag-over';
  const session = window.AmongDemons.getSession();
  const COMBAT_THEMES = {
    default: { color: '#FAC51C', shadow: 'rgba(250,197,28,0.85)' },
    poison: { color: '#167246', shadow: 'rgba(22,114,70,0.92)' },
    heal: { color: '#8DE7FF', shadow: 'rgba(141,231,255,0.86)', outline: '#0d2530' },
    1: { color: '#D1D5D8', shadow: 'rgba(209,213,216,0.82)', outline: '#101820' },
    2: { color: '#171D24', shadow: 'rgba(0,0,0,0.88)' },
    3: { color: '#167246', shadow: 'rgba(22,114,70,0.92)' },
    4: { color: '#E25041', shadow: 'rgba(226,80,65,0.88)' },
    5: { color: '#C8CED2', shadow: 'rgba(200,206,210,0.82)', outline: '#101820' },
    6: { color: '#C084FC', shadow: 'rgba(192,132,252,0.9)' },
    7: { color: '#FFB23F', shadow: 'rgba(255,178,63,0.9)' },
    8: { color: '#6E8F45', shadow: 'rgba(110,143,69,0.86)' },
    9: { color: '#B8BDC2', shadow: 'rgba(184,189,194,0.84)', outline: '#101820' },
    10: { color: '#8DE7FF', shadow: 'rgba(141,231,255,0.86)', outline: '#0d2530' },
    11: { color: '#52B7FF', shadow: 'rgba(82,183,255,0.9)' }
  };
  const state = {
    player: session.player || null,
    run: null,
    startOptions: null,
    selectedRecruitRewardId: null,
    selectedSwapInstanceId: null,
    selectedCashoutDemonKey: null,
    isRecruiting: false,
    isResultAnimating: false,
    draggedRecruitPoolInstanceId: null,
    draggedFormationInstanceId: null,
    recruitSwapEffectIds: [],
    pendingHandFlowSources: null,
    isEnemyPreviewDeferred: false,
    enemyRevealEffectIds: [],
    battleHandPreview: null,
    recruitDraftTeam: null,
    recruitDraftPool: null,
    collectionDemons: null,
    collectionReinforcementPlaceholderInteracted: false,
    collectionReinforcementStagedInteracted: true,
    combatLog: [],
    combatDemons: new Map(),
    battleSpeed: getStoredBattleSpeed(),
    isBattleAnimating: false,
    endNotice: null,
    endSummary: null,
    endedReplayRun: null,
    formationRows: new Map(),
    isLoading: true
  };
  const elements = {};
  let laneResizeObserver = null;

  onReady(init);

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

  function cacheElements() {
    [
      'navPlayerName',
      'huntTitle',
      'huntProgress',
      'dungeonRewardStrip',
      'runLoading',
      'runEmpty',
      'runPanel',
      'teamGrid',
      'enemyGrid',
      'dungeonHandBar',
      'dungeonHandGrid',
      'dungeonHandTitle',
      'teamSideTitle',
      'enemySideTitle',
      'dungeonJoiner',
      'battleOutcome',
      'fightLogTitle',
      'fightLog',
      'fightLogActions',
      'teamChoiceModal',
      'teamChoiceModalTitle',
      'teamChoiceModalSubtitle',
      'teamChoiceModalBody',
      'teamChoiceModalFooter',
      'cashoutModal',
      'cashoutModalBody',
      'cashoutConfirmBtn',
      'shortTeamModal',
      'confirmShortTeamBtn'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });

    elements.logoutBtn = document.getElementById('logoutBtn');
  }

  function bindActions() {
    bindClick(elements.logoutBtn, () => {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
    });

    bindClick(elements.cashoutConfirmBtn, cashOutDungeon);
    bindClick(elements.confirmShortTeamBtn, continueShortTeam);
    window.addEventListener('resize', syncCompressedFormationLanes);
  }

  async function refreshAll() {
    setDungeonLoading(true);
    try {
      const me = await api('/api/auth/me');
      state.player = me.player;
      renderPlayer();

      if (state.run && state.run.runId) {
        await loadRun(state.run.runId);
      } else if (await loadCurrentRun()) {
        showPendingChoiceModal();
      } else if (await loadSavedRun()) {
        showPendingChoiceModal();
      } else {
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
      if (state.run?.status === 'ended') {
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
      storeCurrentRun(state.run.runId);
      renderRun();
      showPendingChoiceModal();
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
    return Boolean(state.run?.status === 'active' && !state.run.awaitingRecruit && !state.run.awaitingFinalPick);
  }

  function getWinMessage() {
    if (state.run?.status === 'completed') return `Floor ${MAX_DUNGEON_FLOOR} cleared. Choose your final demon.`;
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

  async function saveReward(rewardId) {
    try {
      const reward = (state.run?.rewards || []).find((item) => Number(item.rewardId) === Number(rewardId));
      if (reward?.demon && !(await confirmCollectionReplacement(reward.demon))) return;

      const saved = await api('/api/demons/save', {
        method: 'POST',
        body: {
          runId: state.run.runId,
          rewardId
        }
      });
      state.collectionDemons = null;
      getModal(elements.teamChoiceModal).hide();
      await finishRun(saved.replaced
        ? 'Dungeon complete. Collection demon replaced.'
        : 'Dungeon complete. Final demon added to your collection.', {
        completed: true,
        demon: saved.demon
      });
    } catch (error) {
      showError(error);
    }
  }

  function openCashoutModal() {
    if (!state.run?.awaitingRecruit) return;

    state.selectedCashoutDemonKey = null;
    const subtitle = document.getElementById('cashoutModalSubtitle');
    if (subtitle) subtitle.textContent = 'Pick one demon to keep, or leave without one.';
    renderCashoutModal();
    getModal(elements.cashoutModal).show();
  }

  function renderCashoutModal() {
    const earned = state.run?.earned || { xp: 0, souls: 0 };
    const candidates = getCashoutCandidates();

    elements.cashoutModalBody.innerHTML = `
      <div class="cashout-summary cashout-summary-compact">
        <div>
          <span class="hunt-phase-eyebrow">Leave now</span>
          <p class="mb-0">Pick one demon to keep, or leave with only the earned rewards.</p>
        </div>
        <div class="cashout-reward-chips" aria-label="Dungeon rewards">
          <span>${earned.xp || 0} XP</span>
          <span>${earned.souls || 0} souls</span>
        </div>
      </div>
      <div class="cashout-candidate-grid">
        ${candidates.map(renderCashoutCandidate).join('')}
      </div>
      <button class="btn btn-outline-light w-100 mt-3" id="cashoutSkipDemonBtn" type="button">
        Leave Without Demon
      </button>
    `;
    elements.cashoutConfirmBtn.disabled = !state.selectedCashoutDemonKey;

    bindClicks('.cashout-demon-card', (button) => {
      state.selectedCashoutDemonKey = button.dataset.cashoutKey;
      renderCashoutModal();
    });
    bindClick(document.getElementById('cashoutSkipDemonBtn'), cashOutWithoutDemon);
  }

  function getCashoutCandidates() {
    ensureRecruitDraft();
    return [
      ...(state.recruitDraftTeam || []).map((demon) => ({
        key: getCashoutCandidateKey(demon),
        source: getDraftPayloadSource(demon),
        instanceId: demon.originalInstanceId || demon.instanceId,
        rewardId: demon.rewardId || null,
        demon
      })),
      ...(state.recruitDraftPool || []).map((demon) => ({
        key: getCashoutCandidateKey(demon),
        source: getDraftPayloadSource(demon),
        instanceId: demon.originalInstanceId || demon.instanceId,
        rewardId: demon.rewardId || null,
        demon
      }))
    ].filter((candidate) => canCashoutCandidate(candidate));
  }

  function canCashoutCandidate(candidate) {
    return candidate.source === 'reward' || !candidate.demon.collectionDemonId;
  }

  function getCashoutCandidateKey(demon) {
    if (demon.recruitSource === 'reward') return `reward:${demon.rewardId}`;
    if (demon.recruitSource === 'collection') return `collection:${demon.collectionDemonId}`;
    return `team:${demon.originalInstanceId || demon.instanceId}`;
  }

  function renderCashoutCandidate(candidate) {
    const demon = candidate.demon;
    const active = state.selectedCashoutDemonKey === candidate.key;

    return `
      <div class="cashout-candidate">
        ${renderDungeonDemonCard(demon, {
          tag: 'button',
          className: 'cashout-demon-card',
          active,
          attributes: { 'data-cashout-key': candidate.key }
        })}
      </div>
    `;
  }

  async function cashOutDungeon() {
    if (!state.run || !state.selectedCashoutDemonKey) return;

    const candidate = getCashoutCandidates().find((item) => item.key === state.selectedCashoutDemonKey);
    if (!candidate) {
      setMessage('Choose a demon reward.', 'warning');
      return;
    }

    if (!(await confirmCollectionReplacement(candidate.demon))) return;

    await cashOut({
      button: elements.cashoutConfirmBtn,
      clearCollection: true,
      body: {
        source: candidate.source,
        instanceId: candidate.instanceId,
        rewardId: candidate.rewardId
      }
    });
  }

  async function cashOutWithoutDemon() {
    if (!state.run) return;

    await cashOut({
      button: document.getElementById('cashoutSkipDemonBtn'),
      body: { skipDemon: true }
    });
  }

  async function cashOut({ button, body, clearCollection = false }) {
    await withBusy(button, async () => {
      try {
        const result = await api(activeRunPath('cashout'), { method: 'POST', body });
        await finishCashout(result, { clearCollection, skippedDemon: Boolean(body.skipDemon) });
      } catch (error) {
        showError(error);
      }
    });
  }

  async function finishCashout(result, options = {}) {
    const skippedDemon = Boolean(options.skippedDemon);
    const demonMessage = skippedDemon ? '' : getCashoutDemonMessage(result);

    clearCurrentRun();
    if (options.clearCollection) state.collectionDemons = null;
    state.run = null;
    state.selectedCashoutDemonKey = null;
    state.battleHandPreview = null;
    clearRecruitDrafts();
    resetCombatState();
    state.endSummary = {
      title: 'Dungeon ended',
      message: skippedDemon ? 'You left without recruiting a demon.' : demonMessage,
      demon: skippedDemon ? null : result.demon || null,
      xp: result.xp,
      souls: result.souls
    };
    state.endedReplayRun = null;
    state.endNotice = {
      text: skippedDemon
        ? `Dungeon ended. You earned ${result.xp} XP and ${result.souls} souls.`
        : `Dungeon ended. ${demonMessage} You earned ${result.xp} XP and ${result.souls} souls.`,
      type: 'success'
    };
    getModal(elements.cashoutModal).hide();
    await loadStartOptions();
    renderRun();
  }

  function getCashoutDemonMessage(result) {
    const species = result.demon?.species || 'Demon';
    return result.replaced
      ? `${species} replaced your previous collection demon.`
      : `${species} joined your collection.`;
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
      state.isRecruiting = false;
      state.battleHandPreview = null;
      clearDragState();
      clearRecruitDrafts();
      state.endSummary = {
        title: summary.completed ? 'Dungeon complete' : 'Dungeon ended',
        outcome: summary.defeated ? 'defeat' : 'victory',
        message: summary.completed
          ? 'Congratulations. You cleared the dungeon.'
          : (message || 'Dungeon ended.'),
        demon: summary.demon || null,
        xp: result.xp,
        souls: result.souls
      };
      state.endedReplayRun = replayRun;
      state.endNotice = {
        text: `${message || 'Dungeon ended.'} You earned ${result.xp} XP and ${result.souls} souls.`,
        type: summary.completed || !message ? 'success' : 'warning'
      };
      getModal(elements.teamChoiceModal).hide();
      await loadStartOptions();
      renderRun();
    } catch (error) {
      showError(error);
    }
  }

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
      elements.dungeonHandBar?.classList.add('d-none');
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
    const arena = elements.runPanel?.querySelector('.dungeon-arena');
    const team = isHandStrategy ? getRecruitPreviewTeam() : run.team || [];
    const enemies = isHandStrategy && state.isEnemyPreviewDeferred ? [] : (isHandStrategy ? getRecruitPreviewEnemyTeam() : run.enemies || []);
    const showBattleHand = Boolean(!isHandStrategy && state.isBattleAnimating && state.battleHandPreview?.length);
    const hand = isHandStrategy ? getRecruitPreviewHand() : (showBattleHand ? cloneDemons(state.battleHandPreview) : []);
    const showHand = true;

    elements.runPanel?.classList.toggle('has-hand', showHand);
    arena?.classList.toggle('is-hand-strategy', isHandStrategy);
    elements.teamGrid.innerHTML = renderDemonCards(team, {
      side: 'player',
      allowFormationDrag: run.status === 'active' && (!run.awaitingRecruit || state.isRecruiting) && !run.awaitingFinalPick
    });
    elements.enemyGrid.innerHTML = renderDemonCards((isHandStrategy || (run.team || []).length) ? enemies : [], {
      side: 'enemy',
      allowRecruitDrag: false
    });
    renderHandBar(hand, showHand, isHandStrategy);
    renderTeamSideTitle(isHandStrategy ? team.length : null, isHandStrategy ? getRecruitTeamLimit() : null);
    if (elements.enemySideTitle) elements.enemySideTitle.textContent = 'Enemies';
    updateDungeonJoiner();
    bindFormationDragAndDrop();
    bindRecruitDragAndDrop();
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

  async function playCombatLog() {
    if (!state.run) return;

    const allDemonsById = new Map([...(state.run.team || []), ...(state.run.enemies || [])].map((demon) => [demon.instanceId, demon]));
    const steps = groupCombatLog(state.combatLog);
    state.isBattleAnimating = true;
    renderRun();
    renderFightLog();

    try {
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];

        step.entries.forEach((entry) => {
          const target = allDemonsById.get(entry.target);
          if (target) {
            target.hp = entry.targetHp;
            if (entry.effect === 'poison_apply') {
              target.statusEffects = target.statusEffects || {};
              target.statusEffects.poison = Array.from({ length: Math.max(1, Number(entry.poisonStacks) || 1) }, () => ({}));
            }
            if (entry.effect === 'poison' && Object.prototype.hasOwnProperty.call(entry, 'poisonStacks')) {
              target.statusEffects = target.statusEffects || {};
              target.statusEffects.poison = Array.from({ length: Math.max(0, Number(entry.poisonStacks) || 0) }, () => ({}));
            }
          }
        });

        updateTeamHp();
        setActiveLogRow(index);
        if (step.primaryEffect !== 'poison') animateAttackerCard(step.attacker, step.primaryEffect);
        const attackerSide = getDemonSide(step.attacker);
        step.entries.forEach((entry, entryIndex) => {
          if (entry.effect === 'poison') {
            if (entryIndex === 0) {
              showFloatingDamage(entry.target, getPoisonBurstDamage(step), 'poison', entry.attacker, entry.effect, {
                burstCount: step.entries.length
              });
            }
            updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false });
            syncPoisonStatus(entry.target, entry.poisonStacks);
            return;
          }

          if (entry.effect === 'heal') {
            drawHealEffect(entry.attacker, entry.target);
            updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false, healing: entry.healing });
            showFloatingDamage(entry.target, entry.healing, 'heal', entry.attacker, entry.effect);
            return;
          }

          if (entry.effect === 'poison_apply') {
            drawAttackZap(step.attacker, entry.target, { effect: entry.effect, poison: true, bubbles: 15, variant: 'poison-flame' });
            syncPoisonStatus(entry.target, entry.poisonStacks || 1);
            updateTargetCard(entry.target, entry.targetHp, attackerSide);
            return;
          }

          drawCombatAnimation(entry);
          if (Number(entry.dmg) > 0) {
            showFloatingDamage(entry.target, entry.dmg, isTypeTwoAttack(entry.attacker) ? 'dark' : 'damage', entry.attacker, entry.effect);
          }
          updateTargetCard(entry.target, entry.targetHp, attackerSide);
        });
        await sleep(scaleCombatDuration(getCombatStepDelay(step)));
      }
    } finally {
      state.isBattleAnimating = false;
      renderRun();
    }

    setActiveLogRow(-1);
  }

  function updateTeamHp() {
    if (!state.run) return;
    state.run.hp = (state.run.team || []).reduce((sum, demon) => sum + Math.max(0, Number(demon.hp) || 0), 0);
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

  function setActiveLogRow(index) {
    document.querySelectorAll('.fight-log-row').forEach((row) => {
      row.classList.toggle('active', Number(row.dataset.logIndex) === index);
    });
  }

  function animateAttackerCard(instanceId, effect) {
    const card = findDemonCard(instanceId);
    if (!card) return;

    applyCombatTheme(card, getCombatTheme(instanceId, effect));
    card.classList.toggle('is-player-attack', getDemonSide(instanceId) === 'player');
    card.classList.toggle('is-enemy-attack', getDemonSide(instanceId) === 'enemy');
    playTemporaryCardClass(card, 'is-attacking', 320);
  }

  function drawCombatAnimation(entry) {
    const typeId = Number(getCombatDemon(entry.attacker)?.typeId);

    if (entry.targeting === 'chaotic') {
      drawChaoticLightning(entry.attacker, entry.target);
      return;
    }

    const typeAnimation = {
      2: () => drawDarkSpike(entry.attacker, entry.target),
      4: () => drawAttackZap(entry.attacker, entry.target, { effect: entry.effect, variant: 'fiery', flames: 14 }),
      5: () => drawAttackZap(entry.attacker, entry.target, { effect: entry.effect, variant: 'heavy', duration: 520 }),
      6: () => drawAttackZap(entry.attacker, entry.target, { effect: entry.effect, variant: 'assassin', duration: 240 }),
      7: () => drawSwordSwing(entry.attacker, entry.target),
      8: () => drawThornBurst(entry.attacker, entry.target),
      9: () => {
        drawAttackZap(entry.attacker, entry.target, { effect: entry.effect, variant: 'crushing', duration: 960 });
        shakeTargetCard(entry.target);
      }
    }[typeId];

    if (typeAnimation) typeAnimation();
    else drawAttackZap(entry.attacker, entry.target, { effect: entry.effect });
  }

  function drawAttackZap(attackerId, targetId, options = {}) {
    const attacker = findDemonCard(attackerId);
    const target = findDemonCard(targetId);
    if (!attacker || !target) return;

    const { attackerRect, startX, startY, endX, endY } = getAttackGeometry(attacker, target);
    const attackerDemon = getCombatDemon(attackerId);
    const isBackLineAttack = attackerDemon && getDemonPosition(attackerDemon) === 'back';
    const startT = isBackLineAttack ? 0.12 : 0.22;
    const endT = isBackLineAttack ? 0.9 : 0.78;
    const x1 = startX + (endX - startX) * startT;
    const y1 = startY + (endY - startY) * startT;
    const x2 = startX + (endX - startX) * endT;
    const y2 = startY + (endY - startY) * endT;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    const normalX = -(y2 - y1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1));
    const normalY = (x2 - x1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1));
    const bend = isBackLineAttack ? 10 : 6;
    const controlX = midX + normalX * bend;
    const controlY = midY + normalY * bend;
    const bubbleCount = Number(options.bubbles) || 0;
    const bubbleHtml = bubbleCount
      ? Array.from({ length: bubbleCount }, (_, index) => {
          const t = 0.08 + (index / Math.max(1, bubbleCount - 1)) * 0.84;
          const x = ((1 - t) * (1 - t) * x1) + (2 * (1 - t) * t * controlX) + (t * t * x2);
          const y = ((1 - t) * (1 - t) * y1) + (2 * (1 - t) * t * controlY) + (t * t * y2);
          const drift = ((index % 2) ? -1 : 1) * (4 + (index % 4));
          const radius = 2.2 + ((index % 4) * 0.8);
          return `<circle class="poison-bubble" cx="${(x + normalX * drift).toFixed(1)}" cy="${(y + normalY * drift).toFixed(1)}" r="${radius.toFixed(1)}" style="animation-delay: ${scaleCombatDuration(index * 18).toFixed(0)}ms" />`;
        }).join('')
      : '';
    const flameCount = Number(options.flames) || 0;
    const flameHtml = flameCount
      ? Array.from({ length: flameCount }, (_, index) => {
          const t = 0.08 + (index / Math.max(1, flameCount - 1)) * 0.84;
          const x = ((1 - t) * (1 - t) * x1) + (2 * (1 - t) * t * controlX) + (t * t * x2);
          const y = ((1 - t) * (1 - t) * y1) + (2 * (1 - t) * t * controlY) + (t * t * y2);
          const drift = ((index % 2) ? -1 : 1) * (5 + (index % 3) * 2);
          const size = 5 + (index % 4);
          const cx = x + normalX * drift;
          const cy = y + normalY * drift;
          return `<path class="fire-spark" d="M ${cx.toFixed(1)} ${(cy - size).toFixed(1)} C ${(cx + size * 0.72).toFixed(1)} ${(cy - size * 0.2).toFixed(1)} ${(cx + size * 0.45).toFixed(1)} ${(cy + size * 0.72).toFixed(1)} ${cx.toFixed(1)} ${(cy + size).toFixed(1)} C ${(cx - size * 0.55).toFixed(1)} ${(cy + size * 0.42).toFixed(1)} ${(cx - size * 0.45).toFixed(1)} ${(cy - size * 0.32).toFixed(1)} ${cx.toFixed(1)} ${(cy - size).toFixed(1)} Z" style="animation-delay: ${scaleCombatDuration(index * 16).toFixed(0)}ms" />`;
        }).join('')
      : '';

    const zap = createCombatElement([
      'attack-zap',
      getDemonSide(attackerId) === 'player' ? 'is-player-attack' : 'is-enemy-attack',
      isBackLineAttack ? 'is-back-attack' : '',
      options.variant ? `is-${options.variant}` : '',
      options.poison ? 'is-poison-apply' : ''
    ].filter(Boolean).join(' '), attackerId, options.effect);
    zap.innerHTML = renderViewportSvg(`
        <path class="attack-zap-trail" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" />
        ${options.variant === 'assassin' ? `<path class="attack-zap-trail attack-zap-trail-secondary" d="M ${(x1 + normalX * 7).toFixed(1)} ${(y1 + normalY * 7).toFixed(1)} Q ${(controlX + normalX * 7).toFixed(1)} ${(controlY + normalY * 7).toFixed(1)} ${(x2 + normalX * 7).toFixed(1)} ${(y2 + normalY * 7).toFixed(1)}" />` : ''}
        ${bubbleHtml}
        ${flameHtml}
        <circle class="attack-zap-impact" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${isBackLineAttack ? 5 : 4}" />
    `);
    appendTemporaryElement(zap, options.duration || 320);
  }

  function updateTargetCard(instanceId, hp, attackerSide = 'unknown', options = {}) {
    const card = findDemonCard(instanceId);
    if (!card) return;

    const hpElement = card.querySelector('.js-demon-hp');
    if (hpElement) hpElement.textContent = hp;

    const hpFillElement = card.querySelector('.js-demon-hp-fill');
    if (hpFillElement) {
      const maxHp = Number(hpFillElement.dataset.maxHp) || Number(hp) || 1;
      const hpPercent = Math.max(0, Math.min(100, Math.round((Number(hp) / maxHp) * 100)));
      hpFillElement.style.width = `${hpPercent}%`;
    }

    card.classList.toggle('is-defeated', Number(hp) <= 0);
  }

  function syncPoisonStatus(instanceId, stackCount) {
    const card = findDemonCard(instanceId);
    if (!card) return;

    const existing = card.querySelector('.demon-status-poison');
    if (Number(stackCount) <= 0) {
      card.querySelector('.demon-status-strip')?.remove();
      card.classList.remove('is-poisoned');
      return;
    }

    card.classList.add('is-poisoned');
    card.querySelector('.demon-status-strip')?.remove();
    card.insertAdjacentHTML('beforeend', renderDemonStatus({
      statusEffects: {
        poison: Array.from({ length: Math.max(1, Number(stackCount) || 1) }, () => ({}))
      }
    }));
  }

  function showFloatingDamage(instanceId, amount, type, attackerId, effect, options = {}) {
    const card = findDemonCard(instanceId);
    if (!card) return;

    const floating = createCombatElement(`floating-combat-number is-${type}`, attackerId, effect || type);
    floating.innerHTML = type === 'heal'
      ? `+${escapeHtml(amount)}`
      : `-${escapeHtml(amount)}`;
    if (type === 'poison' && Number(options.burstCount) > 1) {
      const burstCount = Math.max(1, Number(options.burstCount) || 1);
      const scale = Math.min(2.2, 1 + (burstCount - 1) * 0.12);
      floating.style.fontSize = `calc(1.22rem * ${scale.toFixed(2)})`;
    }
    appendTemporaryElement(floating, 760, card);
  }

  function drawSwordSwing(attackerId, targetId) {
    const attacker = findDemonCard(attackerId);
    const target = findDemonCard(targetId);
    if (!attacker || !target) return;

    const { attackerRect, startX, startY, endX, endY, angle } = getAttackGeometry(attacker, target);
    const height = Math.max(70, attackerRect.height * 0.92);
    const width = Math.max(18, attackerRect.width * 0.2);
    const distance = attackerRect.width * 0.58;
    const x = startX + Math.cos(angle) * distance;
    const y = startY + Math.sin(angle) * distance;
    const endOffset = Math.max(22, attackerRect.width * 0.26);
    const swing = createCombatElement('sword-swing', attackerId);
    swing.innerHTML = renderViewportSvg(`
        ${[-0.18, 0, 0.18].map((offset, index) => {
          const offsetX = x + Math.cos(angle + Math.PI / 2) * height * offset;
          const offsetY = y + Math.sin(angle + Math.PI / 2) * height * offset;
          const d = `M ${offsetX.toFixed(1)} ${(offsetY - height * 0.34).toFixed(1)} Q ${(offsetX + width).toFixed(1)} ${offsetY.toFixed(1)} ${offsetX.toFixed(1)} ${(offsetY + height * 0.34).toFixed(1)}`;
          const transform = `rotate(${(angle * 180 / Math.PI).toFixed(1)} ${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) translate(${endOffset.toFixed(1)} 0)`;
          return `<path class="sword-swing-belly sword-scratch-${index + 1}" d="${d}" transform="${transform}" /><path class="sword-swing-arc sword-scratch-${index + 1}" d="${d}" transform="${transform}" />`;
        }).join('')}
    `);
    appendTemporaryElement(swing, 440);
  }

  function drawThornBurst(attackerId, targetId) {
    const attacker = findDemonCard(attackerId);
    const target = findDemonCard(targetId);
    if (!attacker || !target) return;

    const { attackerRect, startX, startY, angle } = getAttackGeometry(attacker, target);
    const originDistance = Math.max(42, attackerRect.width * 0.5);
    const originX = startX + Math.cos(angle) * originDistance;
    const originY = startY + Math.sin(angle) * originDistance;
    const thornLength = Math.max(22, attackerRect.width * 0.28);
    const thorns = createCombatElement('thorn-burst', attackerId);
    const offsets = [-0.48, -0.28, -0.1, 0.1, 0.28, 0.48];
    thorns.innerHTML = renderViewportSvg(`
        ${offsets.map((offset, index) => {
          const thornAngle = angle + offset;
          const length = thornLength * (0.74 + (index % 2) * 0.16);
          const spread = attackerRect.height * 0.82;
          const baseX = originX + Math.cos(angle + Math.PI / 2) * ((index / (offsets.length - 1)) - 0.5) * spread;
          const baseY = originY + Math.sin(angle + Math.PI / 2) * ((index / (offsets.length - 1)) - 0.5) * spread;
          const tipX = baseX + Math.cos(thornAngle) * length;
          const tipY = baseY + Math.sin(thornAngle) * length;
          return `<path class="thorn-spike" d="M ${baseX.toFixed(1)} ${baseY.toFixed(1)} L ${tipX.toFixed(1)} ${tipY.toFixed(1)}" />`;
        }).join('')}
    `);
    appendTemporaryElement(thorns, 520);
  }

  function shakeTargetCard(instanceId) {
    const card = findDemonCard(instanceId);
    if (!card) return;
    playTemporaryCardClass(card, 'is-shaking', 360);
  }

  function drawHealEffect(attackerId, targetId) {
    const target = findDemonCard(targetId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const ring = Math.max(18, rect.width * 0.18);
    const heal = createCombatElement('heal-effect', attackerId, 'heal');
    heal.innerHTML = renderViewportSvg(`
        <circle class="heal-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${ring.toFixed(1)}" />
        <circle class="heal-ring heal-ring-secondary" cx="${(x - ring * 0.6).toFixed(1)}" cy="${(y + ring * 0.16).toFixed(1)}" r="${(ring * 0.72).toFixed(1)}" />
        <circle class="heal-ring heal-ring-tertiary" cx="${(x + ring * 0.58).toFixed(1)}" cy="${(y - ring * 0.14).toFixed(1)}" r="${(ring * 0.58).toFixed(1)}" />
    `);
    appendTemporaryElement(heal, 620);
  }

  function drawChaoticLightning(attackerId, targetId) {
    const target = findDemonCard(targetId);
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const top = Math.max(0, rect.top - Math.min(170, window.innerHeight * 0.24));
    const strikeY = rect.top + rect.height * 0.56;
    const branchY = rect.top + rect.height * 0.26;
    const zap = createCombatElement('chaos-lightning is-thunderstrike', attackerId);
    const boltD = `M ${(x - 12).toFixed(1)} ${top.toFixed(1)} L ${(x + 10).toFixed(1)} ${(top + 42).toFixed(1)} L ${(x - 8).toFixed(1)} ${(top + 42).toFixed(1)} L ${(x + 7).toFixed(1)} ${(branchY + 10).toFixed(1)} L ${(x - 16).toFixed(1)} ${(branchY + 10).toFixed(1)} L ${(x + 4).toFixed(1)} ${strikeY.toFixed(1)}`;
    const branchOneD = `M ${(x + 7).toFixed(1)} ${(branchY - 4).toFixed(1)} L ${(x + 34).toFixed(1)} ${(branchY + 10).toFixed(1)} L ${(x + 14).toFixed(1)} ${(branchY + 18).toFixed(1)}`;
    const branchTwoD = `M ${(x - 4).toFixed(1)} ${(branchY + 22).toFixed(1)} L ${(x - 35).toFixed(1)} ${(branchY + 34).toFixed(1)} L ${(x - 13).toFixed(1)} ${(branchY + 43).toFixed(1)}`;
    zap.innerHTML = renderViewportSvg(`
        <path class="chaos-thunder-border chaos-thunder-core" d="${boltD}" />
        <path class="chaos-thunder-border chaos-thunder-branch" d="${branchOneD}" />
        <path class="chaos-thunder-border chaos-thunder-branch" d="${branchTwoD}" />
        <path class="chaos-thunder-core" d="${boltD}" />
        <path class="chaos-thunder-branch" d="${branchOneD}" />
        <path class="chaos-thunder-branch" d="${branchTwoD}" />
    `);
    appendTemporaryElement(zap, 360);
  }

  function drawDarkSpike(attackerId, targetId) {
    const attacker = findDemonCard(attackerId);
    const target = findDemonCard(targetId);
    if (!attacker || !target) return;

    const attackerRect = attacker.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = attackerRect.left + attackerRect.width / 2;
    const startY = attackerRect.top + attackerRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    const angle = Math.atan2(endY - startY, endX - startX);
    const length = Math.max(24, Math.hypot(endX - startX, endY - startY));
    const spike = createCombatElement('dark-spike', attackerId);
    spike.style.left = `${startX}px`;
    spike.style.top = `${startY}px`;
    spike.style.width = `${length}px`;
    spike.style.setProperty('--dark-spike-angle', `${angle}rad`);
    appendTemporaryElement(spike, 340);
  }

  function getCombatTheme(attackerId, effect) {
    if (effect === 'poison' || effect === 'poison_apply') return COMBAT_THEMES.poison;
    if (effect === 'heal') return COMBAT_THEMES.heal;

    const typeId = Number(getCombatDemon(attackerId)?.typeId);
    return COMBAT_THEMES[typeId] || COMBAT_THEMES.default;
  }

  function applyCombatTheme(element, theme) {
    if (!element || !theme) return;
    element.style.setProperty('--combat-color', theme.color);
    element.style.setProperty('--combat-shadow', theme.shadow);
    element.style.setProperty('--combat-text-outline', theme.outline || '#fff');
  }

  function createCombatElement(className, attackerId, effect) {
    const element = document.createElement('div');
    element.className = className;
    applyCombatTheme(element, getCombatTheme(attackerId, effect));
    return element;
  }

  function appendTemporaryElement(element, duration, parent = document.body) {
    parent.appendChild(element);
    setTimeout(() => element.remove(), scaleCombatDuration(duration));
    return element;
  }

  function renderViewportSvg(content) {
    return `<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" aria-hidden="true" focusable="false">${content}</svg>`;
  }

  function getAttackGeometry(attacker, target) {
    const attackerRect = attacker.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = attackerRect.left + attackerRect.width / 2;
    const startY = attackerRect.top + attackerRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    return {
      attackerRect,
      targetRect,
      startX,
      startY,
      endX,
      endY,
      angle: Math.atan2(endY - startY, endX - startX)
    };
  }

  function getCombatStepDelay(step) {
    return Math.max(
      320,
      ...(step.entries || []).map((entry) => {
        const typeId = Number(getCombatDemon(entry.attacker)?.typeId);
        if (entry.effect === 'heal') return 500;
        if (typeId === 5 || typeId === 8) return 520;
        if (typeId === 9) return 960;
        return 320;
      })
    );
  }

  function getStoredBattleSpeed() {
    const stored = Number(localStorage.getItem(BATTLE_SPEED_KEY));
    return BATTLE_SPEED_OPTIONS.includes(stored) ? stored : 1;
  }

  function setBattleSpeed(speed) {
    if (!BATTLE_SPEED_OPTIONS.includes(speed)) return;
    state.battleSpeed = speed;
    localStorage.setItem(BATTLE_SPEED_KEY, String(speed));
    applyBattleSpeed();
    syncBattleSpeedButtons();
  }

  function applyBattleSpeed() {
    document.documentElement.style.setProperty('--battle-animation-scale', String(getBattleTimeScale()));
    [24, 34, 36, 48, 80, 150, 240, 320, 340, 360, 440, 520, 620, 760, 960].forEach((duration) => {
      document.documentElement.style.setProperty(`--battle-duration-${duration}`, `${scaleCombatDuration(duration)}ms`);
    });
  }

  function getBattleTimeScale() {
    return 1 / (Number(state.battleSpeed) || 1);
  }

  function scaleCombatDuration(duration) {
    return Math.max(0, Math.round((Number(duration) || 0) * getBattleTimeScale()));
  }

  function formatBattleSpeed(speed) {
    return `${Number(speed)}x`;
  }

  function syncBattleSpeedButtons() {
    document.querySelectorAll('[data-battle-speed]').forEach((button) => {
      const active = Number(button.dataset.battleSpeed) === state.battleSpeed;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function isTypeTwoAttack(instanceId) {
    return Number(getCombatDemon(instanceId)?.typeId) === 2;
  }

  function findDemonCard(instanceId) {
    return Array.from(document.querySelectorAll('.hunt-demon-card'))
      .find((item) => item.dataset.instanceId === instanceId);
  }

  function playTemporaryCardClass(card, className, duration) {
    const timerKey = `${className}Timer`;
    if (card[timerKey]) {
      clearTimeout(card[timerKey]);
    }

    card.classList.remove(className);
    void card.offsetWidth;
    card.classList.add(className);
    card[timerKey] = setTimeout(() => {
      card.classList.remove(className);
      if (className === 'is-attacking' || className === 'is-hit') {
        card.classList.remove('is-player-attack', 'is-enemy-attack');
      }
      card[timerKey] = null;
    }, scaleCombatDuration(duration));
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    laneResizeObserver = new ResizeObserver(() => syncCompressedFormationLanes());
    lanes.forEach((lane) => laneResizeObserver.observe(lane));
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

  function renderRewardTags(extraClass = '') {
    const earned = state.run?.earned || { xp: 0, souls: 0 };
    const handCount = state.run?.awaitingRecruit ? getCurrentRecruitRewards().length : 1;
    const showLabel = !extraClass.includes('dungeon-header-rewards');
    return `
      <div class="dungeon-meta-group dungeon-reward-meta ${extraClass}">
        ${showLabel ? '<span class="hunt-phase-eyebrow">Rewards</span>' : ''}
        <span>${handCount} ${handCount === 1 ? 'Demon' : 'Demons'}</span>
        <span>${earned.xp || 0} XP</span>
        <span>${earned.souls || 0} souls</span>
      </div>
    `;
  }

  function renderDungeonRewardStrip() {
    if (!elements.dungeonRewardStrip) return;

    const shouldShow = Boolean(!state.isLoading && state.run?.awaitingRecruit && state.isRecruiting);
    elements.dungeonRewardStrip.innerHTML = shouldShow ? renderRewardTags('dungeon-mobile-rewards') : '';
  }

  function renderPhaseTitle() {
    if (!elements.fightLogTitle) return;
    elements.fightLogTitle.textContent = 'Fight Log';
  }

  function setFightLogTitle(title) {
    if (elements.fightLogTitle) elements.fightLogTitle.textContent = title;
  }

  function renderFightLogRow(step, index) {
    const primaryEntry = step.entries[0];
    const damageText = getFightLogAmountText(step);
    const hpText = primaryEntry.effect === 'poison_apply'
      ? 'Poisoned'
      : primaryEntry.effect === 'heal'
        ? `${primaryEntry.targetHp} HP`
        : step.isAoe
          ? 'AOE'
          : `${primaryEntry.targetHp} HP`;

    return `
      <div class="fight-log-row ${getLogRowClass(primaryEntry)}" data-log-index="${index}">
        <span class="text-secondary">T${primaryEntry.tick}</span>
        <span class="fight-log-side">${getLogSideLabel(primaryEntry)}</span>
        <span class="fight-log-action">${getFightLogActionText(step)}</span>
        <span class="fight-log-damage">${damageText}</span>
        <span class="text-secondary">${hpText}</span>
      </div>
    `;
  }

  function groupCombatLog(combatLog) {
    const steps = [];

    for (const entry of combatLog || []) {
      const previous = steps[steps.length - 1];
      const isSameAoe = (entry.targeting === 'all' || entry.targeting === 'cleave') &&
        previous?.isAoe &&
        previous.tick === entry.tick &&
        previous.attacker === entry.attacker;
      const isSameRetaliation = entry.effect === 'retaliate' &&
        previous &&
        previous.tick === entry.tick &&
        previous.entries.some((previousEntry) => previousEntry.attacker === entry.target && previousEntry.target === entry.attacker);
      const isSamePoisonBurst = entry.effect === 'poison' &&
        previous?.primaryEffect === 'poison' &&
        previous.tick === entry.tick &&
        previous.entries.every((previousEntry) => previousEntry.target === entry.target);

      if (isSameAoe || isSameRetaliation || isSamePoisonBurst) {
        previous.entries.push(entry);
        continue;
      }

      steps.push({
        tick: entry.tick,
        attacker: entry.attacker,
        isAoe: entry.targeting === 'all' || entry.targeting === 'cleave',
        primaryEffect: entry.effect || null,
        entries: [entry]
      });
    }

    return steps;
  }

  function renderLogPosition(position) {
    if (!position) return '';
    return `<span class="fight-log-position">${position === 'front' ? 'Front' : 'Back'}</span>`;
  }

  function getFightLogActionText(step) {
    const entry = step.entries[0];
    const attacker = renderFightLogDemonName(entry.attacker);
    const target = `${renderFightLogDemonName(entry.target)} ${renderLogPosition(entry.targetPosition)}`;

    if (entry.effect === 'poison_apply') return `${attacker} applied poison to ${target}`;
    if (entry.effect === 'poison') return `${target} took poison damage`;
    if (entry.effect === 'heal') return `${attacker} healed ${target}`;
    if (entry.effect === 'retaliate') return `${attacker} retaliated against ${target}`;
    if (entry.targeting === 'chaotic') return `${attacker} chaotically struck ${target}`;
    if (entry.targeting === 'cleave') return `${attacker} cleaved ${step.entries.length} demons`;
    if (step.isAoe) return `${attacker} splashed ${step.entries.length} enemies`;
    return `${attacker} ${getFightLogVerb(entry)} ${target}`;
  }

  function getFightLogVerb(entry) {
    if (entry.effect === 'poison_apply') return 'poisoned';
    if (entry.effect === 'poison') return 'poisoned';
    if (entry.effect === 'heal') return 'healed';
    if (entry.effect === 'retaliate') return 'retaliated against';
    if (entry.targeting === 'chaotic') return 'chaotically struck';
    if (entry.targeting === 'cleave') return 'cleaved';
    return entry.targeting === 'all' ? 'splashed' : 'hit';
  }

  function getFightLogAmountText(step) {
    const entry = step.entries[0];
    const retaliationEntry = step.entries.find((item) => item.effect === 'retaliate');
    if (entry.effect === 'poison_apply') return 'poison';
    if (entry.effect === 'poison') {
      return `${getPoisonBurstDamage(step)} poison`;
    }
    if (entry.effect === 'heal') return `+${entry.healing || 0} hp`;
    if (retaliationEntry) return `${entry.dmg} dmg, ${retaliationEntry.dmg} thorns`;
    if (entry.targeting === 'cleave') return `${step.entries.length} x ${entry.dmg} cleave`;
    if (step.isAoe) return `${step.entries.length} x ${entry.dmg} dmg`;
    return `${entry.dmg} dmg`;
  }

  function getPoisonBurstDamage(step) {
    return (step.entries || [])
      .filter((entry) => entry.effect === 'poison')
      .reduce((total, entry) => total + (Number(entry.dmg) || 0), 0);
  }

  function renderEndNotice() {
    if (!state.endNotice) return '';

    const className = state.endNotice.type === 'warning'
      ? 'fight-log-notice fight-log-end-notice text-warning'
      : 'fight-log-notice fight-log-end-notice text-success';

    return `<div class="${className}">${escapeHtml(state.endNotice.text)}</div>`;
  }

  function prepareRecruitStrategyState() {
    clearRecruitSelection();
    clearDragState();
    clearRecruitDrafts();
    if (state.run?.collectionReinforcementAvailable) {
      state.collectionReinforcementPlaceholderInteracted = false;
      state.collectionReinforcementStagedInteracted = true;
    }
  }

  function getCurrentRecruitRewards() {
    if (!state.run) return [];
    return (state.run.rewards || []).filter((reward) => (
      reward.floor === state.run.currentFloor &&
      reward.type === 'recruit' &&
      !reward.recruited
    ));
  }

  function getRecruitPreviewTeam() {
    ensureRecruitDraft();
    return cloneDemons(state.recruitDraftTeam || []);
  }

  function getRecruitPreviewHand() {
    ensureRecruitDraft();
    return cloneDemons(state.recruitDraftPool || []);
  }

  function getRecruitPreviewEnemyTeam() {
    return cloneDemons(state.run?.nextEnemies || []);
  }

  function renderHandBar(hand, isVisible, isInteractive = false) {
    if (!elements.dungeonHandBar || !elements.dungeonHandGrid) return;

    elements.dungeonHandBar.classList.toggle('d-none', !isVisible);
    if (!isVisible) {
      elements.dungeonHandGrid.innerHTML = '';
      if (elements.dungeonHandTitle) elements.dungeonHandTitle.textContent = '0 demons';
      return;
    }

    const count = hand.length;
    if (elements.dungeonHandTitle) {
      elements.dungeonHandTitle.textContent = `${count} ${count === 1 ? 'demon' : 'demons'}`;
    }

    elements.dungeonHandGrid.innerHTML = renderHandCards(hand, isInteractive);
  }

  function renderHandCards(demons, isInteractive = false) {
    const placeholder = isInteractive && shouldShowCollectionReinforcementHandPlaceholder()
      ? renderCollectionReinforcementPlaceholder('hand')
      : '';
    const cardHtml = demons.map((demon) => renderDemonCard(demon, {
      side: 'hand',
      allowRecruitDrag: isInteractive
    })).join('');

    return `
      <div class="dungeon-hand-cards formation-lane-cards" data-formation-drop="hand">
        ${placeholder}${cardHtml || (placeholder ? '' : renderEmptyHand())}
      </div>
    `;
  }

  function renderEmptyHand() {
    return '<div class="formation-empty dungeon-hand-empty"><span>Empty</span></div>';
  }

  function playPendingHandFlowAnimation(isHandStrategy) {
    const sources = state.pendingHandFlowSources;
    if (!sources) return;
    state.pendingHandFlowSources = null;
    if (!sources.length || !isHandStrategy || !elements.dungeonHandGrid) {
      revealDeferredEnemyPreview();
      return;
    }

    const targets = getHandFlowTargetCards();
    if (!targets.length) {
      revealDeferredEnemyPreview();
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const flowAnimations = sources.slice(0, targets.length).map((source, index) => {
      const target = targets[index];
      if (!target) return Promise.resolve();

      target.classList.add('is-hand-flow-arriving');
      if (reducedMotion) {
        target.classList.remove('is-hand-flow-arriving');
        markHandFlowLanded(target);
        return Promise.resolve();
      }

      return flowEnemyCardToHand(source, target, index);
    });

    Promise.all(flowAnimations).then(() => {
      revealDeferredEnemyPreview();
    });
  }

  function revealDeferredEnemyPreview() {
    if (!state.isEnemyPreviewDeferred) return;

    state.isEnemyPreviewDeferred = false;
    state.enemyRevealEffectIds = getRecruitPreviewEnemyTeam().map((demon) => demon.instanceId).filter(Boolean);
    renderRun();
  }

  function getHandFlowTargetCards() {
    return Array.from(elements.dungeonHandGrid.querySelectorAll('.hunt-demon-card[data-instance-id]'))
      .filter((card) => card.dataset.recruitSource === 'reward' || card.dataset.rewardId);
  }

  function flowEnemyCardToHand(source, target, index) {
    const targetRect = target.getBoundingClientRect();
    if (!targetRect.width || !targetRect.height) {
      target.classList.remove('is-hand-flow-arriving');
      return Promise.resolve();
    }

    const ghost = createHandFlowGhost(source);
    if (!ghost) {
      target.classList.remove('is-hand-flow-arriving');
      return Promise.resolve();
    }

    document.body.appendChild(ghost);
    if (typeof ghost.animate !== 'function') {
      ghost.remove();
      target.classList.remove('is-hand-flow-arriving');
      markHandFlowLanded(target);
      return Promise.resolve();
    }

    const deltaX = targetRect.left - source.rect.left;
    const deltaY = targetRect.top - source.rect.top;
    const scaleX = targetRect.width / source.rect.width;
    const scaleY = targetRect.height / source.rect.height;
    const lift = Math.max(24, Math.min(90, Math.abs(deltaY) * 0.2));
    const arcX = deltaX * 0.46;
    const arcY = deltaY * 0.46 - lift;
    const tilt = index % 2 === 0 ? -2.4 : 2.4;

    const animation = ghost.animate([
      {
        opacity: 0.98,
        transform: 'translate3d(0, 0, 0) scale(1, 1) rotate(0deg)',
        filter: 'brightness(1)'
      },
      {
        offset: 0.58,
        opacity: 0.96,
        transform: `translate3d(${arcX}px, ${arcY}px, 0) scale(${Math.max(scaleX, 0.88)}, ${Math.max(scaleY, 0.88)}) rotate(${tilt}deg)`,
        filter: 'brightness(1.18)'
      },
      {
        opacity: 0.2,
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY}) rotate(0deg)`,
        filter: 'brightness(1.06)'
      }
    ], {
      delay: index * 90,
      duration: 760,
      easing: 'cubic-bezier(0.18, 0.84, 0.18, 1)',
      fill: 'both'
    });

    return animation.finished
      .catch(() => {})
      .then(() => {
        ghost.remove();
        target.classList.remove('is-hand-flow-arriving');
        markHandFlowLanded(target);
      });
  }

  function createHandFlowGhost(source) {
    if (!source?.html || !source.rect?.width || !source.rect?.height) return null;

    const ghost = document.createElement('div');
    ghost.className = 'hand-flow-ghost';
    ghost.style.left = `${source.rect.left}px`;
    ghost.style.top = `${source.rect.top}px`;
    ghost.style.width = `${source.rect.width}px`;
    ghost.style.height = `${source.rect.height}px`;
    ghost.innerHTML = source.html;

    const card = ghost.firstElementChild;
    if (card) {
      card.classList.remove('is-dragging', 'is-drag-over', 'is-pointer-dragging');
      card.classList.add('is-hand-flow-card');
      card.removeAttribute('id');
      card.removeAttribute('role');
      card.removeAttribute('tabindex');
      card.removeAttribute('draggable');
      card.setAttribute('aria-hidden', 'true');
    }

    return ghost;
  }

  function markHandFlowLanded(target) {
    target.classList.remove('is-hand-flow-landed');
    void target.offsetWidth;
    target.classList.add('is-hand-flow-landed');
    window.setTimeout(() => {
      target.classList.remove('is-hand-flow-landed');
    }, 760);
  }

  function ensureRecruitDraft() {
    if (!state.run?.awaitingRecruit || !state.isRecruiting) return;
    if (state.recruitDraftTeam && state.recruitDraftPool) return;
    if (!state.pendingHandFlowSources) {
      state.isEnemyPreviewDeferred = false;
    }

    state.recruitDraftTeam = (state.run.team || []).map((demon, index) => ({
      ...getFullHpDemon(demon),
      instanceId: demon.instanceId,
      originalInstanceId: demon.instanceId,
      recruitSource: 'team',
      draftOrder: index,
      formationRow: getDemonFormationRow(demon, state.run.team || [], index),
      formationSlot: getDemonFormationRow(demon, state.run.team || [], index),
      position: getDemonPosition(demon, index)
    }));
    state.recruitDraftPool = [
      ...getCurrentRecruitRewards().map((reward, index) => ({
        ...getFullHpDemon(reward.demon),
        instanceId: `reward-${reward.rewardId}`,
        rewardId: reward.rewardId,
        recruitSource: 'reward',
        position: getDemonPosition(reward.demon, index)
      }))
    ];
  }

  async function ensureCollectionLoaded() {
    if (state.collectionDemons) return;

    const payload = await api('/api/demons');
    state.collectionDemons = payload.demons || [];
  }

  function getAvailableCollectionReinforcements() {
    if (!state.run?.collectionReinforcementAvailable || getSelectedCollectionReinforcements().length >= getCollectionReinforcementLimit()) return [];
    const existingCollectionIds = new Set((state.run.team || [])
      .map((demon) => Number(demon.collectionDemonId))
      .filter(Boolean));

    const usedCollectionIds = new Set([
      ...(state.recruitDraftTeam || []),
      ...(state.recruitDraftPool || [])
    ]
      .map((demon) => Number(demon.collectionDemonId))
      .filter(Boolean));

    return (state.collectionDemons || [])
      .filter((demon) => !existingCollectionIds.has(Number(demon.id)) && !usedCollectionIds.has(Number(demon.id)));
  }

  function getCollectionReinforcementLimit() {
    const limit = Number(state.run?.collectionReinforcementLimit);
    if (limit > 0) return limit;
    return state.run?.collectionReinforcementAvailable ? 1 : 0;
  }

  function getCollectionSlotKey(demon) {
    const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
    const rarity = String(demon?.rarity || '').toLowerCase();
    if (!typeId || !rarity) return null;
    return `${typeId}:${rarity}`;
  }

  function isDemonInCollection(demon) {
    if (demon?.recruitSource === 'collection') return true;
    if (demon?.collectionDemonId) return true;
    const key = getCollectionSlotKey(demon);
    if (!key) return false;
    return (state.collectionDemons || []).some((collectionDemon) => getCollectionSlotKey(collectionDemon) === key);
  }

  function shouldShowCollectionMissingTag(demon, options = {}) {
    if (options.suppressCollectionMissingTag) return false;
    if (state.isBattleAnimating) return false;
    if (!Array.isArray(state.collectionDemons)) return false;
    return Boolean(!isDemonInCollection(demon));
  }

  function getFullHpDemon(demon) {
    const maxHp = Math.max(Number(demon.maxHp) || Number(demon.hp) || 1, 1);
    return {
      ...demon,
      maxHp,
      hp: maxHp
    };
  }

  function getRecruitTeamLimit() {
    if (!state.run) return MAX_DUNGEON_TEAM_SIZE;
    return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(2, Number(state.run.currentFloor) + 2));
  }

  function getDraftRecruitPayload() {
    ensureRecruitDraft();
    const draftTeam = state.recruitDraftTeam || [];
    return {
      team: draftTeam.map((demon, index) => ({
        source: getDraftPayloadSource(demon),
        instanceId: demon.originalInstanceId || demon.instanceId,
        rewardId: demon.rewardId || undefined,
        demonId: demon.collectionDemonId || undefined,
        position: getDemonPosition(demon, index),
        formationSlot: getDemonFormationRow(demon, draftTeam, index)
      }))
    };
  }

  function getDraftPayloadSource(demon) {
    if (demon.recruitSource === 'reward') return 'reward';
    if (demon.recruitSource === 'collection') return 'collection';
    return 'team';
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
      ${canChooseRecruit ? `
        ${shouldUseMobileRewardStrip() ? '' : renderRewardTags('dungeon-header-rewards')}
        <button class="btn btn-warning btn-sm" id="getRewardBtn" type="button">
          ${renderIcon('flag')}
          Get Reward
        </button>
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

  function cloneDemons(demons) {
    return (demons || []).map((demon) => ({ ...demon }));
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
      awaitingRecruit: false,
      awaitingFinalPick: false
    };
  }

  function isCurrentFloorBattle(run) {
    return Boolean(run?.lastBattle?.floor === run?.currentFloor);
  }

  function createCombatDemonMap() {
    return new Map([
      ...(state.run?.team || []).map((demon) => [demon.instanceId, { ...demon, side: 'player' }]),
      ...(state.run?.enemies || []).map((demon) => [demon.instanceId, { ...demon, side: 'enemy' }])
    ]);
  }

  function getLogRowClass(entry) {
    return getDemonSide(entry.attacker) === 'player' ? 'is-player-action' : 'is-enemy-action';
  }

  function getLogSideLabel(entry) {
    return getDemonSide(entry.attacker) === 'player' ? 'You' : 'Enemy';
  }

  function getDemonSide(instanceId) {
    if ((state.run?.team || []).some((demon) => demon.instanceId === instanceId)) return 'player';
    if ((state.run?.enemies || []).some((demon) => demon.instanceId === instanceId)) return 'enemy';
    if (state.combatDemons.get(instanceId)?.side) return state.combatDemons.get(instanceId).side;
    return 'unknown';
  }

  function getCombatDemon(instanceId) {
    return [...(state.run?.team || []), ...(state.run?.enemies || [])]
      .find((item) => item.instanceId === instanceId) || state.combatDemons.get(instanceId) || null;
  }

  function renderFightLogDemonName(instanceId) {
    const demon = [...(state.run?.team || []), ...(state.run?.enemies || [])]
      .find((item) => item.instanceId === instanceId) || state.combatDemons.get(instanceId);

    if (!demon) return escapeHtml(instanceId);
    return `<span class="ad-${escapeHtml(demon.rarity)}">${escapeHtml(demon.species || 'Demon')}</span>`;
  }

  function showPendingChoiceModal() {
    if (!state.run || !(state.run.awaitingFinalPick || state.run.status === 'completed')) return;
    if (state.run.status === 'completed' && hasSavedFinalReward()) return;

    renderTeamChoiceModal();
    getModal(elements.teamChoiceModal, { backdrop: 'static', keyboard: false }).show();
  }

  function renderTeamChoiceModal() {
    if (!state.run) return;
    setTeamChoiceModalFullscreen(true);

    const currentFloorRewards = (state.run.rewards || []).filter((reward) => reward.floor === state.run.currentFloor);

    const finalRewards = currentFloorRewards.filter((reward) => reward.type === 'final');
    elements.teamChoiceModalTitle.textContent = 'Dungeon complete';
    elements.teamChoiceModalSubtitle.textContent = 'Choose one available demon for your collection, or exit without collecting.';
    elements.teamChoiceModalBody.innerHTML = `
      <div class="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
        ${finalRewards.map(renderFinalReward).join('')}
      </div>
    `;
    elements.teamChoiceModalFooter.innerHTML = `
      <button type="button" class="btn btn-outline-light" id="modalExitHuntBtn">
        Exit Without Collecting
      </button>
    `;
    bindRewardButtons();
    bindClick(document.getElementById('modalExitHuntBtn'), () => finishRun('Dungeon complete.', { completed: true }));
  }

  async function openCollectionReinforcementModal() {
    if (!state.run?.collectionReinforcementAvailable) return;

    try {
      await ensureCollectionLoaded();
      markCollectionReinforcementPlaceholderInteracted();
      renderCollectionReinforcementModal('');
      getModal(elements.teamChoiceModal).show();
    } catch (error) {
      showError(error);
    }
  }

  function renderCollectionReinforcementModal(query = '') {
    setTeamChoiceModalFullscreen(false);
    const selected = getSelectedCollectionReinforcements();
    const limit = getCollectionReinforcementLimit();
    const normalizedQuery = query.trim().toLowerCase();
    const candidates = getAvailableCollectionReinforcements()
      .filter((demon) => !normalizedQuery || [
        demon.species,
        demon.rarity,
        demon.typeId
      ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
      .sort(compareCollectionReinforcementDemons);

    elements.teamChoiceModalTitle.textContent = 'Collection reinforcement';
    elements.teamChoiceModalSubtitle.textContent = selected.length
      ? `${selected.length} / ${limit} collection demons staged. Remove one to choose another if the limit is full.`
      : `Choose up to ${limit} collection demon${limit === 1 ? '' : 's'} to place in hand, then drag them into your team.`;
    elements.teamChoiceModalBody.innerHTML = `
      ${selected.length ? `
        <div class="collection-reinforcement-current">
          ${selected.map((demon) => `
            <div>
              <span class="hunt-phase-eyebrow">Staged</span>
              ${renderSharedDemonCard(demon, { className: 'collection-reinforcement-card' })}
              <button class="btn btn-outline-warning btn-sm js-remove-collection-reinforcement" data-instance-id="${escapeHtml(demon.instanceId)}" type="button">Remove</button>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="collection-reinforcement-toolbar">
        <input class="form-control form-control-sm" id="collectionReinforcementSearch" type="search" value="${escapeHtml(query)}" placeholder="Search collection">
      </div>
      <div class="choice-card-grid collection-reinforcement-grid">
        ${candidates.length ? candidates.map(renderCollectionReinforcementChoice).join('') : renderEmptyText('No available collection demons.')}
      </div>
    `;
    elements.teamChoiceModalFooter.innerHTML = `
      <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Done</button>
    `;

    document.getElementById('collectionReinforcementSearch')?.addEventListener('input', (event) => {
      renderCollectionReinforcementModal(event.target.value);
      const input = document.getElementById('collectionReinforcementSearch');
      input?.focus();
      input?.setSelectionRange(input.value.length, input.value.length);
    });
    bindClicks('.js-remove-collection-reinforcement', (button) => {
      removeCollectionReinforcement(button.dataset.instanceId);
      renderCollectionReinforcementModal(query);
      renderRun();
    });
    bindClicks('.js-call-collection-reinforcement', (button) => {
      addCollectionReinforcementToPool(Number(button.dataset.demonId));
      getModal(elements.teamChoiceModal).hide();
      renderRun();
    });
  }

  function renderCollectionReinforcementChoice(demon) {
    const selected = getSelectedCollectionReinforcements()
      .some((item) => Number(item.collectionDemonId) === Number(demon.id));

    return renderDungeonDemonCard(demon, {
      tag: 'button',
      className: 'hunt-choice-card js-call-collection-reinforcement',
      active: selected,
      suppressCollectionMissingTag: true,
      attributes: {
        type: 'button',
        'data-demon-id': demon.id,
        disabled: selected
      }
    });
  }

  function compareCollectionReinforcementDemons(a, b) {
    return getRarityRank(b.rarity) - getRarityRank(a.rarity) ||
      (Number(b.typeId) || 0) - (Number(a.typeId) || 0) ||
      (Number(b.atk) || 0) - (Number(a.atk) || 0);
  }

  function getRarityRank(rarity) {
    return {
      common: 1,
      uncommon: 2,
      rare: 3,
      epic: 4,
      legendary: 5,
      mythic: 6
    }[String(rarity || '').toLowerCase()] || 0;
  }

  function getSelectedCollectionReinforcement() {
    return getSelectedCollectionReinforcements()[0] || null;
  }

  function getSelectedCollectionReinforcements() {
    return [
      ...(state.recruitDraftTeam || []),
      ...(state.recruitDraftPool || [])
    ].filter((demon) => demon.recruitSource === 'collection');
  }

  function addCollectionReinforcementToPool(demonId) {
    ensureRecruitDraft();
    if (getSelectedCollectionReinforcements().length >= getCollectionReinforcementLimit()) return;

    const demon = (state.collectionDemons || []).find((item) => Number(item.id) === Number(demonId));
    if (!demon) return;

    const position = getPreferredDemonPosition(demon);
    state.recruitDraftPool.splice(getCollectionHandInsertIndex(), 0, {
      ...getFullHpDemon(demon),
      instanceId: `collection-${demon.id}`,
      collectionDemonId: demon.id,
      recruitSource: 'collection',
      position
    });
    state.collectionReinforcementStagedInteracted = false;
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
  }

  function getCollectionHandInsertIndex() {
    const firstNonCollectionIndex = (state.recruitDraftPool || []).findIndex((demon) => demon.recruitSource !== 'collection');
    return firstNonCollectionIndex >= 0 ? firstNonCollectionIndex : (state.recruitDraftPool || []).length;
  }

  function removeCollectionReinforcement(instanceId = null) {
    const shouldRemove = (demon) => (
      demon.recruitSource === 'collection' &&
      (!instanceId || demon.instanceId === instanceId)
    );
    state.recruitDraftTeam = (state.recruitDraftTeam || []).filter((demon) => !shouldRemove(demon));
    state.recruitDraftPool = (state.recruitDraftPool || []).filter((demon) => !shouldRemove(demon));
    state.collectionReinforcementStagedInteracted = true;
    refreshRecruitDraftOrder();
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
  }

  function markCollectionReinforcementPlaceholderInteracted() {
    state.collectionReinforcementPlaceholderInteracted = true;
    document.querySelectorAll('.collection-reinforcement-placeholder').forEach((card) => {
      card.classList.remove('is-collection-reinforcement-attention');
    });
  }

  function markCollectionReinforcementStagedInteracted(instanceId = null) {
    const staged = instanceId
      ? getSelectedCollectionReinforcements().find((demon) => demon.instanceId === instanceId)
      : getSelectedCollectionReinforcement();
    if (!staged || (instanceId && staged.instanceId !== instanceId)) return;

    state.collectionReinforcementStagedInteracted = true;
    document.querySelectorAll(`.hunt-demon-card[data-instance-id="${cssEscape(staged.instanceId)}"]`).forEach((card) => {
      card.classList.remove('is-collection-reinforcement-attention');
    });
  }

  async function confirmCollectionReplacement(incomingDemon) {
    await ensureCollectionLoaded();
    const existing = findCollectionReplacement(incomingDemon);
    if (!existing) return true;

    return new Promise((resolve) => {
      const modalElement = document.createElement('div');
      modalElement.className = 'modal fade hunt-modal';
      modalElement.tabIndex = -1;
      modalElement.setAttribute('aria-hidden', 'true');
      modalElement.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <div>
                <h2 class="modal-title h4">Replace collection demon?</h2>
                <p class="text-muted mb-0">This slot already has a demon. Choose whether to keep it or replace it.</p>
              </div>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="collection-replace-preview">
                <div>
                  <span class="hunt-phase-eyebrow">Current</span>
                  ${renderDungeonDemonCard(existing, { className: 'collection-replace-card', suppressCollectionMissingTag: true })}
                </div>
                <div>
                  <span class="hunt-phase-eyebrow">Incoming</span>
                  ${renderDungeonDemonCard(incomingDemon, { className: 'collection-replace-card' })}
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-light" data-choice="keep">Keep Current</button>
              <button type="button" class="btn btn-warning" data-choice="replace">Replace</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modalElement);
      const modal = getModal(modalElement);
      let decided = false;

      bindClick(modalElement.querySelector('[data-choice="keep"]'), () => {
        decided = true;
        resolve(false);
        modal.hide();
      });
      bindClick(modalElement.querySelector('[data-choice="replace"]'), () => {
        decided = true;
        resolve(true);
        modal.hide();
      });
      modalElement.addEventListener('hidden.bs.modal', () => {
        if (!decided) resolve(false);
        modalElement.remove();
      }, { once: true });
      modal.show();
    });
  }

  function findCollectionReplacement(demon) {
    const key = getCollectionSlotKey(demon);
    if (!key) return null;
    return (state.collectionDemons || []).find((collectionDemon) => getCollectionSlotKey(collectionDemon) === key) || null;
  }

  function renderFinalReward(reward) {
    return `
      <div class="col">
        <div class="reward-item border rounded p-3">
          ${renderRewardDemon(reward.demon)}
          <button class="btn btn-outline-info btn-sm w-100 mt-3 js-save" data-reward-id="${reward.rewardId}" ${reward.saved || hasSavedFinalReward() ? 'disabled' : ''}>
            ${reward.saved ? 'Saved' : 'Add to Collection'}
          </button>
        </div>
      </div>
    `;
  }

  function hasSavedFinalReward() {
    return (state.run?.rewards || []).some((reward) => reward.type === 'final' && reward.saved);
  }

  function renderRewardDemon(demon) {
    return renderDungeonDemonCard(demon, { className: 'reward-demon-card' });
  }

  function bindRewardButtons() {
    bindClicks('.js-save', (button) => saveReward(Number(button.dataset.rewardId)));
  }

  async function setDemonPosition(instanceId, position, rowIndex = null) {
    if (!state.run) return;

    const team = state.run.team || [];
    const target = team.find((demon) => demon.instanceId === instanceId);
    const targetIndex = team.findIndex((demon) => demon.instanceId === instanceId);
    const nextRow = normalizeFormationRow(rowIndex);
    const previousPosition = target?.position;
    const previousRow = target ? getDemonFormationRow(target, team, targetIndex) : null;
    if (!target || (target.position === position && previousRow === nextRow)) return;

    target.position = position;
    setDemonFormationRow(target, nextRow);
    renderRun();

    try {
      const result = await api(activeRunPath('formation'), {
        method: 'POST',
        body: {
          formation: team.map((demon, index) => ({
            instanceId: demon.instanceId,
            position: getDemonPosition(demon, index),
            formationSlot: getDemonFormationRow(demon, team, index)
          }))
        }
      });
      state.run.team = result.team || team;
      setStoredFormationRow(instanceId, nextRow);
      renderRun();
    } catch (error) {
      target.position = previousPosition;
      setDemonFormationRow(target, previousRow);
      renderRun();
      showError(error);
    }
  }

  function bindNativeDragSource(card, options) {
    card.addEventListener('dragstart', (event) => {
      const payload = options.getPayload(card);
      if (!payload) return;

      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', JSON.stringify(payload));
      state[options.stateKey] = payload.instanceId;
      if (options.markStaged) markCollectionReinforcementStagedInteracted(payload.instanceId);
      card.classList.add('is-dragging');
    });

    card.addEventListener('dragend', () => {
      state[options.stateKey] = null;
      card.classList.remove('is-dragging');
      clearDragOverTargets(options.clearSelector);
    });
  }

  function bindNativeDropTarget(target, options) {
    target.addEventListener('dragover', (event) => {
      const payload = options.readPayload(event);
      if (!(options.canDragOver || options.canDrop)(payload, event, target)) return;

      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      target.classList.add('is-drag-over');
    });

    target.addEventListener('dragleave', () => target.classList.remove('is-drag-over'));
    target.addEventListener('drop', (event) => {
      const payload = options.readPayload(event);
      target.classList.remove('is-drag-over');
      if (!options.canDrop(payload, event, target)) return;

      event.preventDefault();
      if (options.stopPropagation) event.stopPropagation();
      options.onDrop(payload, event, target);
      if (options.renderAfterDrop) renderRun();
    });
  }

  function clearDragOverTargets(selector) {
    document.querySelectorAll(selector).forEach((target) => target.classList.remove('is-drag-over'));
  }

  function bindFormationDragAndDrop() {
    if (!state.run || state.run.awaitingRecruit || state.run.awaitingFinalPick) return;

    document.querySelectorAll('#teamGrid .hunt-demon-card[draggable="true"]').forEach((card) => {
      if (card.dataset.rewardId) return;

      bindNativeDragSource(card, {
        stateKey: 'draggedFormationInstanceId',
        clearSelector: FORMATION_DRAG_OVER_SELECTOR,
        markStaged: true,
        getPayload: () => ({
          type: 'formation',
          instanceId: card.dataset.instanceId
        })
      });
    });

    document.querySelectorAll('#teamGrid .formation-lane-cards').forEach((lane) => {
      bindNativeDropTarget(lane, {
        readPayload: readDragPayload,
        canDrop: (payload) => {
          if (payload?.type !== 'formation' && !state.draggedFormationInstanceId) return false;
          return canDropFormationOnLane(payload?.instanceId || state.draggedFormationInstanceId, lane);
        },
        onDrop: (payload) => {
          const instanceId = payload?.instanceId || state.draggedFormationInstanceId;
          if (!instanceId) return;
          setDemonPosition(instanceId, lane.dataset.formationDrop, getFormationLaneInfo(lane)?.rowIndex);
        }
      });
    });
  }

  function bindRecruitCardDragAndDrop(card, options) {
    bindNativeDragSource(card, {
      stateKey: options.stateKey,
      clearSelector: RECRUIT_DRAG_OVER_SELECTOR,
      markStaged: options.markStaged,
      getPayload: options.getPayload
    });

    bindNativeDropTarget(card, {
      readPayload: readRecruitDragPayload,
      stopPropagation: true,
      renderAfterDrop: true,
      canDrop: (payload) => options.canDrop(payload, card.dataset.instanceId),
      onDrop: (payload) => applyRecruitCardDrop(payload, options.targetSide, card.dataset.instanceId)
    });
  }

  function getRecruitDragPayload(collection, type, card) {
    return findDraftDemon(collection, card.dataset.instanceId)
      ? { type, instanceId: card.dataset.instanceId }
      : null;
  }

  function getRecruitDropContext(event) {
    const payload = readRecruitDragPayload(event);
    const poolInstanceId = payload?.instanceId || state.draggedRecruitPoolInstanceId;
    const teamInstanceId = payload?.instanceId || state.draggedFormationInstanceId;
    const hasPoolPayload = payload?.type === 'recruit-pool' || (!payload?.type && poolInstanceId);
    const hasTeamPayload = payload?.type === 'recruit-team' || (!payload?.type && teamInstanceId);

    return {
      payload,
      poolInstanceId,
      teamInstanceId,
      hasPoolPayload,
      hasTeamPayload,
      isPoolDrop: hasPoolPayload && findDraftDemon(state.recruitDraftPool, poolInstanceId),
      isTeamMove: hasTeamPayload && findDraftDemon(state.recruitDraftTeam, teamInstanceId)
    };
  }

  function bindTeamFormationDropTarget(target, getLane, getPosition) {
    bindNativeDropTarget(target, {
      readPayload: getRecruitDropContext,
      renderAfterDrop: true,
      canDragOver: (context) => canDragOverTeamFormationTarget(context, getLane(), getPosition()),
      canDrop: (context) => canDropOnTeamFormationTarget(context, getLane(), getPosition()),
      onDrop: (context, event) => applyTeamFormationTargetDrop(context, getLane(), getPosition(), event)
    });
  }

  function canDragOverTeamFormationTarget(context, lane, position) {
    if (!position || (!context.isPoolDrop && !context.isTeamMove)) return false;
    if (context.isPoolDrop && !canAddPoolDemonToTeam(context.poolInstanceId, lane)) return false;
    if (context.isTeamMove && !canMoveTeamDemonToLane(context.teamInstanceId, lane)) return false;
    return true;
  }

  function canDropOnTeamFormationTarget(context, lane, position) {
    if (!position || (!context.poolInstanceId && !context.teamInstanceId)) return false;
    if (context.hasTeamPayload) return canMoveTeamDemonToLane(context.teamInstanceId, lane);
    return context.hasPoolPayload && canAddPoolDemonToTeam(context.poolInstanceId, lane);
  }

  function applyTeamFormationTargetDrop(context, lane, position, event) {
    if (context.hasTeamPayload) {
      applyTeamLaneDrop(context.teamInstanceId, lane, position, event.clientY, event.clientX);
      return;
    }

    if (context.hasPoolPayload && canAddPoolDemonToTeam(context.poolInstanceId, lane)) {
      addPoolDemonToTeam(
        context.poolInstanceId,
        position,
        getLaneDropDraftIndex(lane, event.clientY, event.clientX),
        getFormationLaneInfo(lane)?.rowIndex
      );
    }
  }

  function bindHandFormationDropTarget(lane) {
    bindNativeDropTarget(lane, {
      readPayload: getRecruitDropContext,
      renderAfterDrop: true,
      canDragOver: (context) => canDragOverHandFormationTarget(context),
      canDrop: (context) => canDragOverHandFormationTarget(context),
      onDrop: (context, event) => applyHandFormationTargetDrop(context, lane, event)
    });
  }

  function canDragOverHandFormationTarget(context) {
    const isTeamDrop = context.hasTeamPayload && canReturnTeamDemonToPool(context.teamInstanceId);
    const isPoolMove = context.hasPoolPayload && findDraftDemon(state.recruitDraftPool, context.poolInstanceId);
    return Boolean(isTeamDrop || isPoolMove);
  }

  function applyHandFormationTargetDrop(context, lane, event) {
    if (context.hasTeamPayload && canReturnTeamDemonToPool(context.teamInstanceId)) {
      applyTeamToPoolLaneDrop(context.teamInstanceId, lane, lane.dataset.formationDrop, event.clientY, event.clientX);
      return;
    }

    if (context.hasPoolPayload && findDraftDemon(state.recruitDraftPool, context.poolInstanceId)) {
      applyPoolLaneDrop(context.poolInstanceId, lane, lane.dataset.formationDrop, event.clientY, event.clientX);
    }
  }

  function bindRecruitDragAndDrop() {
    if (!state.run?.awaitingRecruit || !state.isRecruiting) return;
    ensureRecruitDraft();

    document.querySelectorAll('#dungeonHandGrid .hunt-demon-card[data-instance-id]').forEach((card) => {
      bindRecruitCardDragAndDrop(card, {
        stateKey: 'draggedRecruitPoolInstanceId',
        targetSide: 'pool',
        markStaged: true,
        getPayload: () => getRecruitDragPayload(state.recruitDraftPool, 'recruit-pool', card),
        canDrop: canDropRecruitOnPoolCard
      });
    });

    document.querySelectorAll('#teamGrid .hunt-demon-card[data-instance-id]').forEach((card) => {
      bindRecruitCardDragAndDrop(card, {
        stateKey: 'draggedFormationInstanceId',
        targetSide: 'team',
        getPayload: () => getRecruitDragPayload(state.recruitDraftTeam, 'recruit-team', card),
        canDrop: canDropRecruitOnTeamCard
      });
    });

    document.querySelectorAll('#teamGrid .formation-lane-cards').forEach((lane) => {
      bindTeamFormationDropTarget(lane, () => lane, () => lane.dataset.formationDrop);
    });

    document.querySelectorAll('#dungeonHandGrid .formation-lane-cards').forEach(bindHandFormationDropTarget);
  }

  function bindPointerDragAndDrop() {
    document.querySelectorAll('#teamGrid .hunt-demon-card[data-instance-id], #dungeonHandGrid .hunt-demon-card[data-instance-id], #enemyGrid .hunt-demon-card[data-instance-id]').forEach((card) => {
      card.addEventListener('pointerdown', startPointerDrag);
      card.addEventListener('mousedown', startMouseDrag);
      card.addEventListener('touchstart', startTouchDrag, { passive: false });
    });
  }

  function bindCollectionReinforcementPlaceholders() {
    bindClicks('.collection-reinforcement-placeholder', () => openCollectionReinforcementModal());
  }

  function startPointerDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.pointerType === 'mouse') return;

    const card = event.currentTarget;
    const payload = getPointerDragPayload(card);
    if (!payload) return;

    trackPointerDrag(createDragSession(
      card,
      payload,
      event.clientX,
      event.clientY,
      card,
      'pointermove',
      'pointerup',
      'pointercancel',
      event.pointerId
    ));
  }

  function startMouseDrag(event) {
    if (event.button !== 0) return;
    if (!shouldUseCustomMouseDrag()) return;
    if (event.currentTarget.classList.contains('is-pointer-dragging')) return;

    const card = event.currentTarget;
    const payload = getPointerDragPayload(card);
    if (!payload) return;

    trackPointerDrag(createDragSession(card, payload, event.clientX, event.clientY, document, 'mousemove', 'mouseup', 'mouseup'));
  }

  function startTouchDrag(event) {
    if (window.PointerEvent) return;
    if (event.touches.length !== 1) return;

    const card = event.currentTarget;
    const payload = getPointerDragPayload(card);
    if (!payload) return;

    const touch = event.touches[0];
    trackPointerDrag(
      createDragSession(card, payload, touch.clientX, touch.clientY, document, 'touchmove', 'touchend', 'touchcancel'),
      { moveOptions: { passive: false } }
    );
  }

  function trackPointerDrag(drag, options = {}) {
    const onMove = (moveEvent) => movePointerDrag(moveEvent, drag);
    const onUp = (upEvent) => finishPointerDrag(upEvent, drag, onMove, onUp, onCancel);
    const onCancel = (cancelEvent) => cancelPointerDrag(cancelEvent, drag, onMove, onUp, onCancel);

    if (drag.pointerId !== null) drag.card.setPointerCapture?.(drag.pointerId);
    drag.listenerTarget.addEventListener(drag.moveEvent, onMove, options.moveOptions);
    drag.listenerTarget.addEventListener(drag.upEvent, onUp);
    drag.listenerTarget.addEventListener(drag.cancelEvent, onCancel);
  }

  function createDragSession(card, payload, startX, startY, listenerTarget, moveEvent, upEvent, cancelEvent, pointerId = null) {
    return {
      card,
      payload,
      pointerId,
      listenerTarget,
      moveEvent,
      upEvent,
      cancelEvent,
      startX,
      startY,
      currentTarget: null,
      ghost: null,
      active: false
    };
  }

  function movePointerDrag(event, drag) {
    if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;

    const point = getDragPoint(event);
    if (!point) return;

    const deltaX = point.clientX - drag.startX;
    const deltaY = point.clientY - drag.startY;
    if (!drag.active && Math.hypot(deltaX, deltaY) < 8) return;

    if (!drag.active) activatePointerDrag(event, drag);

    if (event.cancelable) event.preventDefault();
    positionPointerDragGhost(drag.ghost, point.clientX, point.clientY);
    const target = getPointerDropTarget(point.clientX, point.clientY, drag);
    setPointerDropTarget(drag, target);
  }

  function activatePointerDrag(event, drag) {
    drag.active = true;
    drag.card.classList.add('is-dragging');
    drag.card.classList.add('is-pointer-dragging');
    drag.card.classList.add('suppress-detail-click');
    if (drag.pointerId !== null) drag.card.setPointerCapture?.(drag.pointerId);

    if (drag.payload.type === 'recruit-pool') {
      state.draggedRecruitPoolInstanceId = drag.payload.instanceId;
      markCollectionReinforcementStagedInteracted(drag.payload.instanceId);
    } else {
      state.draggedFormationInstanceId = drag.payload.instanceId;
      if (drag.payload.type === 'recruit-team') {
        markCollectionReinforcementStagedInteracted(drag.payload.instanceId);
      }
    }

    drag.ghost = drag.card.cloneNode(true);
    drag.ghost.classList.add('pointer-drag-ghost');
    drag.ghost.removeAttribute('id');
    drag.ghost.removeAttribute('role');
    drag.ghost.removeAttribute('tabindex');
    drag.ghost.style.width = `${drag.card.getBoundingClientRect().width}px`;
    document.body.appendChild(drag.ghost);
    const point = getDragPoint(event);
    if (point) positionPointerDragGhost(drag.ghost, point.clientX, point.clientY);
  }

  function finishPointerDrag(event, drag, onMove, onUp, onCancel) {
    cleanupPointerDragListeners(drag, onMove, onUp, onCancel);
    if (!drag.active) return;

    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    const point = getDragPoint(event);
    const target = point ? getPointerDropTarget(point.clientX, point.clientY, drag) : null;
    applyPointerDrop(drag.payload, target);
    cleanupPointerDrag(drag);
  }

  function cancelPointerDrag(event, drag, onMove, onUp, onCancel) {
    cleanupPointerDragListeners(drag, onMove, onUp, onCancel);
    if (drag.active) {
      if (event.cancelable) event.preventDefault();
      cleanupPointerDrag(drag);
    }
  }

  function cleanupPointerDragListeners(drag, onMove, onUp, onCancel) {
    drag.listenerTarget.removeEventListener(drag.moveEvent, onMove);
    drag.listenerTarget.removeEventListener(drag.upEvent, onUp);
    drag.listenerTarget.removeEventListener(drag.cancelEvent, onCancel);
    if (drag.pointerId !== null) drag.card.releasePointerCapture?.(drag.pointerId);
  }

  function cleanupPointerDrag(drag) {
    drag.card.classList.remove('is-dragging', 'is-pointer-dragging');
    drag.ghost?.remove();
    setPointerDropTarget(drag, null);
    clearDragState();

    window.setTimeout(() => {
      drag.card.classList.remove('suppress-detail-click');
    }, 120);
  }

  function getPointerDragPayload(card) {
    const instanceId = card.dataset.instanceId;
    if (!instanceId) return null;

    if (state.run?.awaitingRecruit && state.isRecruiting) {
      if (card.closest('#dungeonHandGrid') && findDraftDemon(state.recruitDraftPool, instanceId)) {
        return { type: 'recruit-pool', instanceId };
      }
      if (card.closest('#teamGrid') && findDraftDemon(state.recruitDraftTeam, instanceId)) {
        return { type: 'recruit-team', instanceId };
      }
      return null;
    }

    if (state.run && !state.run.awaitingRecruit && !state.run.awaitingFinalPick && card.closest('#teamGrid')) {
      return { type: 'formation', instanceId };
    }

    return null;
  }

  function getPointerDropTarget(x, y, drag) {
    const ghostDisplay = drag.ghost?.style.display;
    if (drag.ghost) drag.ghost.style.display = 'none';
    const element = document.elementFromPoint(x, y);
    if (drag.ghost) drag.ghost.style.display = ghostDisplay || '';
    if (!element) return null;

    const card = element.closest('.hunt-demon-card[data-instance-id]');
    const lane = element.closest('.formation-lane-cards');

    if (card && canPointerDropOnCard(drag.payload, card)) {
      return { element: card, kind: 'card' };
    }

    if (lane && canPointerDropOnLane(drag.payload, lane)) {
      return { element: lane, kind: 'lane', insertIndex: getLaneDropDraftIndex(lane, y, x), clientX: x, clientY: y };
    }

    return null;
  }

  function canPointerDropOnCard(payload, card) {
    if (!payload) return false;
    if (card.closest('#teamGrid')) return canDropRecruitOnTeamCard(payload, card.dataset.instanceId);
    if (card.closest('#dungeonHandGrid')) return canDropRecruitOnPoolCard(payload, card.dataset.instanceId);
    return false;
  }

  function canPointerDropOnLane(payload, lane) {
    if (!payload) return false;

    if (payload.type === 'formation') {
      return Boolean(lane.closest('#teamGrid') && canDropFormationOnLane(payload.instanceId, lane));
    }

    if (payload.type === 'recruit-pool') {
      return Boolean(
        (lane.closest('#teamGrid') && canAddPoolDemonToTeam(payload.instanceId, lane)) ||
        (lane.closest('#dungeonHandGrid') && findDraftDemon(state.recruitDraftPool, payload.instanceId))
      );
    }

    if (payload.type === 'recruit-team') {
      return Boolean(
        (lane.closest('#teamGrid') && canMoveTeamDemonToLane(payload.instanceId, lane)) ||
        (lane.closest('#dungeonHandGrid') && canReturnTeamDemonToPool(payload.instanceId))
      );
    }

    return false;
  }

  function setPointerDropTarget(drag, target) {
    if (drag.currentTarget?.element === target?.element) return;

    drag.currentTarget?.element.classList.remove('is-drag-over');
    drag.currentTarget = target;
    drag.currentTarget?.element.classList.add('is-drag-over');
  }

  function applyPointerDrop(payload, target) {
    if (!target) return;

    if (payload.type === 'formation') {
      const position = target.element.dataset.formationDrop;
      if (position) setDemonPosition(payload.instanceId, position, getFormationLaneInfo(target.element)?.rowIndex);
      return;
    }

    if (payload.type === 'recruit-pool') {
      if (target.kind === 'card') {
        applyRecruitCardDrop(payload, target.element.closest('#teamGrid') ? 'team' : 'pool', target.element.dataset.instanceId);
        renderRun();
        return;
      }

      const position = target.element.dataset.formationDrop;
      if (position && target.element.closest('#teamGrid') && canAddPoolDemonToTeam(payload.instanceId, target.element)) {
        addPoolDemonToTeam(payload.instanceId, position, target.insertIndex, getFormationLaneInfo(target.element)?.rowIndex);
        renderRun();
        return;
      }

      if (position && target.element.closest('#dungeonHandGrid') && findDraftDemon(state.recruitDraftPool, payload.instanceId)) {
        applyPoolLaneDrop(payload.instanceId, target.element, position, target.clientY, target.clientX, target.insertIndex);
        renderRun();
      }
      return;
    }

    if (payload.type === 'recruit-team') {
      const position = target.element.dataset.formationDrop;
      if (!position) return;

      if (target.element.closest('#teamGrid')) {
        applyTeamLaneDrop(payload.instanceId, target.element, position, target.clientY, target.clientX, target.insertIndex);
        renderRun();
        return;
      }

      if (target.element.closest('#dungeonHandGrid') && canReturnTeamDemonToPool(payload.instanceId)) {
        applyTeamToPoolLaneDrop(payload.instanceId, target.element, position, target.clientY, target.clientX, target.insertIndex);
        renderRun();
      }
    }
  }

  function positionPointerDragGhost(ghost, x, y) {
    if (!ghost) return;
    ghost.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
  }

  function getDragPoint(event) {
    if (event.changedTouches?.length) return event.changedTouches[0];
    if (event.touches?.length) return event.touches[0];
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) return event;
    return null;
  }

  function shouldUseMobileRewardStrip() {
    return window.matchMedia('(max-width: 575.98px)').matches;
  }

  function shouldUseCustomMouseDrag() {
    return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 575.98px)').matches;
  }

  function bindDemonDetailCards() {
    document.querySelectorAll('#teamGrid .hunt-demon-card[data-instance-id], #dungeonHandGrid .hunt-demon-card[data-instance-id], #enemyGrid .hunt-demon-card[data-instance-id]').forEach((card) => {
      card.addEventListener('click', (event) => {
        if (event.defaultPrevented || card.classList.contains('is-dragging') || card.classList.contains('suppress-detail-click')) return;

        const demon = getDemonForDetailCard(card);
        if (!demon) return;
        if (demon.recruitSource === 'collection') {
          markCollectionReinforcementStagedInteracted(demon.instanceId);
        }

        openDemonDetailsModal(demon, {
          actions: getDungeonDetailActions()
        });
      });

      card.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;

        event.preventDefault();
        card.click();
      });
    });
  }

  function getDemonForDetailCard(card) {
    const instanceId = card.dataset.instanceId;
    if (!instanceId) return null;

    return [
      ...(state.isRecruiting ? getRecruitPreviewTeam() : state.run?.team || []),
      ...(state.isRecruiting ? getRecruitPreviewHand() : state.battleHandPreview || []),
      ...(state.isRecruiting ? getRecruitPreviewEnemyTeam() : state.run?.enemies || [])
    ].find((demon) => demon.instanceId === instanceId) || null;
  }

  function getDungeonDetailActions() {
    const actions = [];

    if (isStrategyPhase()) {
      actions.push({
        label: 'Potions',
        icon: 'potion',
        variant: 'success',
        onClick: () => setMessage('Potions are not available yet.', 'warning')
      });
    }

    return actions;
  }

  function isStrategyPhase() {
    return Boolean(state.run?.status === 'active' && !state.run.awaitingFinalPick && (!state.run.awaitingRecruit || state.isRecruiting));
  }

  function findDraftDemon(collection, instanceId) {
    if (!instanceId) return null;
    return (collection || []).find((demon) => demon.instanceId === instanceId) || null;
  }

  function canAddPoolDemonToTeam(poolInstanceId, lane = null) {
    const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
    if (!poolDemon) return false;
    return (state.recruitDraftTeam || []).length < getRecruitTeamLimit() && canAddDemonToFormationLane(state.recruitDraftTeam, lane);
  }

  function canMoveTeamDemonToLane(instanceId, lane) {
    const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
    if (!demon || !lane) return false;
    if (isDemonInFormationLane(state.recruitDraftTeam, instanceId, lane)) return true;
    return canAddDemonToFormationLane(state.recruitDraftTeam, lane);
  }

  function canDropFormationOnLane(instanceId, lane) {
    const demon = findDraftDemon(state.run?.team || [], instanceId);
    if (!demon || !lane) return false;
    if (isDemonInFormationLane(state.run?.team || [], instanceId, lane)) return true;
    return canAddDemonToFormationLane(state.run?.team || [], lane);
  }

  function canAddDemonToFormationLane(collection, lane) {
    if (!lane?.closest('#teamGrid')) return true;
    return getFormationLaneDemons(collection, lane).length < FORMATION_CELL_CAPACITY;
  }

  function canDropRecruitOnTeamCard(payload, teamInstanceId) {
    if (!payload || !teamInstanceId) return false;
    if (payload.type === 'recruit-pool') return canSwapPoolDemonIntoTeam(payload.instanceId, teamInstanceId);
    if (payload.type === 'recruit-team') return canSwapDraftDemons(state.recruitDraftTeam, payload.instanceId, teamInstanceId);
    return false;
  }

  function canDropRecruitOnPoolCard(payload, poolInstanceId) {
    if (!payload || !poolInstanceId) return false;
    if (payload.type === 'recruit-team') return canSwapTeamDemonIntoPool(payload.instanceId, poolInstanceId);
    if (payload.type === 'recruit-pool') return canSwapDraftDemons(state.recruitDraftPool, payload.instanceId, poolInstanceId);
    return false;
  }

  function applyRecruitCardDrop(payload, targetSide, targetInstanceId) {
    if (targetSide === 'team') {
      if (payload.type === 'recruit-pool') {
        swapPoolDemonIntoTeam(payload.instanceId, targetInstanceId);
      } else if (payload.type === 'recruit-team') {
        swapDraftDemons(state.recruitDraftTeam, payload.instanceId, targetInstanceId);
        refreshRecruitDraftOrder();
        syncRecruitDraftSelection();
      }
      return;
    }

    if (payload.type === 'recruit-team') {
      swapTeamDemonIntoPool(payload.instanceId, targetInstanceId);
    } else if (payload.type === 'recruit-pool') {
      swapDraftDemons(state.recruitDraftPool, payload.instanceId, targetInstanceId);
      refreshRecruitDraftPoolOrder();
      syncRecruitDraftSelection();
    }
  }

  function canSwapPoolDemonIntoTeam(poolInstanceId, teamInstanceId) {
    const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
    const teamDemon = findDraftDemon(state.recruitDraftTeam, teamInstanceId);
    return Boolean(poolDemon && teamDemon);
  }

  function canSwapTeamDemonIntoPool(teamInstanceId, poolInstanceId) {
    const teamDemon = findDraftDemon(state.recruitDraftTeam, teamInstanceId);
    const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
    return Boolean(teamDemon && poolDemon && (state.recruitDraftTeam || []).length > 1);
  }

  function canSwapDraftDemons(collection, sourceInstanceId, targetInstanceId) {
    return Boolean(
      sourceInstanceId &&
      targetInstanceId &&
      sourceInstanceId !== targetInstanceId &&
      findDraftDemon(collection, sourceInstanceId) &&
      findDraftDemon(collection, targetInstanceId)
    );
  }

  function addPoolDemonToTeam(poolInstanceId, position, insertIndex = null, rowIndex = null) {
    const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
    if (!poolDemon) return;

    const targetRow = normalizeFormationRow(rowIndex);
    const draftDemon = {
      ...poolDemon,
      position,
      formationRow: targetRow,
      formationSlot: targetRow
    };
    if (Number.isInteger(insertIndex) && insertIndex >= 0) {
      state.recruitDraftTeam.splice(insertIndex, 0, draftDemon);
    } else {
      state.recruitDraftTeam.push(draftDemon);
    }
    refreshRecruitDraftOrder();
    syncRecruitDraftSelection();
  }

  function swapPoolDemonIntoTeam(poolInstanceId, teamInstanceId) {
    const targetIndex = (state.recruitDraftTeam || []).findIndex((demon) => demon.instanceId === teamInstanceId);
    const poolIndex = getDraftPoolIndex(poolInstanceId);
    const currentTeamDemon = state.recruitDraftTeam?.[targetIndex];
    const currentPoolDemon = state.recruitDraftPool?.[poolIndex];
    const targetRow = getDemonFormationRow(currentTeamDemon, state.recruitDraftTeam, targetIndex);
    const poolRow = getDemonFormationRow(currentPoolDemon, state.recruitDraftPool, poolIndex);
    const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
    const teamDemon = removeDraftDemon(state.recruitDraftTeam, teamInstanceId);
    if (!poolDemon || !teamDemon) {
      if (poolDemon) state.recruitDraftPool.push(poolDemon);
      if (teamDemon) state.recruitDraftTeam.push(teamDemon);
      return;
    }

    const targetPosition = getDemonPosition(teamDemon);
    state.recruitDraftTeam.splice(Math.max(targetIndex, 0), 0, {
      ...poolDemon,
      draftOrder: getDraftOrder(teamDemon),
      position: targetPosition,
      formationRow: targetRow,
      formationSlot: targetRow
    });
    state.recruitDraftPool.splice(Math.max(poolIndex, 0), 0, {
      ...teamDemon,
      draftOrder: getDraftOrder(poolDemon),
      position: getDemonPosition(poolDemon),
      formationRow: poolRow,
      formationSlot: poolRow
    });
    state.recruitSwapEffectIds = [poolDemon.instanceId, teamDemon.instanceId].filter(Boolean);
    refreshRecruitDraftOrder();
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
  }

  function swapTeamDemonIntoPool(teamInstanceId, poolInstanceId) {
    const teamIndex = getDraftTeamIndex(teamInstanceId);
    const poolIndex = getDraftPoolIndex(poolInstanceId);
    const currentTeamDemon = state.recruitDraftTeam?.[teamIndex];
    const currentPoolDemon = state.recruitDraftPool?.[poolIndex];
    const teamRow = getDemonFormationRow(currentTeamDemon, state.recruitDraftTeam, teamIndex);
    const poolRow = getDemonFormationRow(currentPoolDemon, state.recruitDraftPool, poolIndex);
    const teamDemon = removeDraftDemon(state.recruitDraftTeam, teamInstanceId);
    const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
    if (!teamDemon || !poolDemon) {
      if (teamDemon) state.recruitDraftTeam.push(teamDemon);
      if (poolDemon) state.recruitDraftPool.push(poolDemon);
      return;
    }

    state.recruitDraftTeam.splice(Math.max(teamIndex, 0), 0, {
      ...poolDemon,
      position: getDemonPosition(teamDemon),
      formationRow: teamRow,
      formationSlot: teamRow
    });
    state.recruitDraftPool.splice(Math.max(poolIndex, 0), 0, {
      ...teamDemon,
      position: getDemonPosition(poolDemon),
      formationRow: poolRow,
      formationSlot: poolRow
    });
    state.recruitSwapEffectIds = [poolDemon.instanceId, teamDemon.instanceId].filter(Boolean);
    refreshRecruitDraftOrder();
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
  }

  function playRecruitSwapEffect() {
    if (!state.recruitSwapEffectIds.length) return;

    const effectIds = state.recruitSwapEffectIds;
    state.recruitSwapEffectIds = [];
    effectIds.forEach((instanceId) => {
      const card = document.querySelector(`.hunt-demon-card[data-instance-id="${cssEscape(instanceId)}"]`);
      if (!card) return;

      card.classList.remove('is-swap-confirmed');
      void card.offsetWidth;
      card.classList.add('is-swap-confirmed');
      window.setTimeout(() => {
        card.classList.remove('is-swap-confirmed');
      }, 720);
    });
  }

  function playEnemyRevealEffect() {
    if (!state.enemyRevealEffectIds.length) return;

    const effectIds = state.enemyRevealEffectIds;
    state.enemyRevealEffectIds = [];
    effectIds.forEach((instanceId, index) => {
      const card = document.querySelector(`#enemyGrid .hunt-demon-card[data-instance-id="${cssEscape(instanceId)}"]`);
      if (!card) return;

      card.classList.remove('is-enemy-revealed');
      card.style.setProperty('--enemy-reveal-delay', `${index * 90}ms`);
      void card.offsetWidth;
      card.classList.add('is-enemy-revealed');
      window.setTimeout(() => {
        card.classList.remove('is-enemy-revealed');
        card.style.removeProperty('--enemy-reveal-delay');
      }, 980 + index * 90);
    });
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function moveDraftTeamDemon(instanceId, position, insertIndex = null, rowIndex = null) {
    moveDraftDemonWithin(state.recruitDraftTeam, instanceId, position, insertIndex, rowIndex);
    refreshRecruitDraftOrder();
    syncRecruitDraftSelection();
  }

  function applyTeamLaneDrop(instanceId, lane, position, clientY = null, clientX = null, insertIndex = null) {
    const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
    if (!demon || !position) return;
    if (!canMoveTeamDemonToLane(instanceId, lane)) return;

    const targetInstanceId = getLaneSwapTargetInstanceId(lane, instanceId, clientY, clientX);
    if (targetInstanceId && getDemonPosition(demon) !== position) {
      swapDraftDemons(state.recruitDraftTeam, instanceId, targetInstanceId);
      refreshRecruitDraftOrder();
      syncRecruitDraftSelection();
      return;
    }

    moveDraftTeamDemon(
      instanceId,
      position,
      Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX),
      getFormationLaneInfo(lane)?.rowIndex
    );
  }

  function moveDraftPoolDemon(instanceId, position, insertIndex = null) {
    const demon = findDraftDemon(state.recruitDraftPool, instanceId);
    moveDraftDemonWithin(state.recruitDraftPool, instanceId, getHandDropPosition(position, demon), insertIndex);
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
  }

  function applyPoolLaneDrop(instanceId, lane, position, clientY = null, clientX = null, insertIndex = null) {
    const targetInstanceId = getLaneSwapTargetInstanceId(lane, instanceId, clientY, clientX);
    if (targetInstanceId) {
      swapDraftDemons(state.recruitDraftPool, instanceId, targetInstanceId);
      refreshRecruitDraftPoolOrder();
      syncRecruitDraftSelection();
      return;
    }

    moveDraftPoolDemon(instanceId, position, Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX));
  }

  function canReturnTeamDemonToPool(instanceId) {
    const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
    return Boolean(demon);
  }

  function returnTeamDemonToPool(instanceId, position, insertIndex = null) {
    const demon = removeDraftDemon(state.recruitDraftTeam, instanceId);
    if (!demon) return;

    const draftDemon = {
      ...demon,
      position: getHandDropPosition(position, demon)
    };
    delete draftDemon.formationRow;
    delete draftDemon.formationSlot;
    if (Number.isInteger(insertIndex) && insertIndex >= 0) {
      state.recruitDraftPool.splice(insertIndex, 0, draftDemon);
    } else {
      state.recruitDraftPool.push(draftDemon);
    }
    refreshRecruitDraftOrder();
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
  }

  function applyTeamToPoolLaneDrop(instanceId, lane, position, clientY = null, clientX = null, insertIndex = null) {
    if (isHandLane(lane)) {
      returnTeamDemonToPool(instanceId, position, Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX));
      return;
    }

    const targetInstanceId = getLaneSwapTargetInstanceId(lane, instanceId, clientY, clientX);
    if (targetInstanceId && canSwapTeamDemonIntoPool(instanceId, targetInstanceId)) {
      swapTeamDemonIntoPool(instanceId, targetInstanceId);
      return;
    }

    returnTeamDemonToPool(instanceId, position, Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX));
  }

  function getHandDropPosition(position, demon) {
    return position === 'hand' ? getDemonPosition(demon) : position;
  }

  function removeDraftDemon(collection, instanceId) {
    const index = (collection || []).findIndex((demon) => demon.instanceId === instanceId);
    if (index === -1) return null;
    return collection.splice(index, 1)[0];
  }

  function getDraftTeamIndex(instanceId) {
    return (state.recruitDraftTeam || []).findIndex((demon) => demon.instanceId === instanceId);
  }

  function getDraftPoolIndex(instanceId) {
    return (state.recruitDraftPool || []).findIndex((demon) => demon.instanceId === instanceId);
  }

  function getLaneSwapTargetInstanceId(lane, sourceInstanceId, clientY = null, clientX = null) {
    const cards = Array.from(lane?.querySelectorAll('.hunt-demon-card[data-instance-id]') || [])
      .filter((card) => card.dataset.instanceId !== sourceInstanceId);
    if (!cards.length) return null;

    const useHorizontalDistance = isHorizontalDropLane(lane) && Number.isFinite(clientX);
    const pointerCoordinate = useHorizontalDistance ? clientX : clientY;
    if (!Number.isFinite(pointerCoordinate)) return cards[0].dataset.instanceId || null;

    return cards
      .map((card) => {
        const rect = card.getBoundingClientRect();
        const center = useHorizontalDistance
          ? rect.left + (rect.width / 2)
          : rect.top + (rect.height / 2);
        return {
          instanceId: card.dataset.instanceId,
          distance: Math.abs(pointerCoordinate - center)
        };
      })
      .sort((a, b) => a.distance - b.distance)[0]?.instanceId || null;
  }

  function getLaneDropDraftIndex(lane, clientY = null, clientX = null) {
    if (!lane) return null;
    const collection = getDraftCollectionForLane(lane);
    const cards = Array.from(lane.querySelectorAll('.hunt-demon-card[data-instance-id]'));
    if (!cards.length) return getFormationRowInsertIndex(collection, lane);

    if (isHorizontalDropLane(lane) && Number.isFinite(clientX)) {
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (clientX < rect.left + (rect.width / 2)) {
          const cardIndex = getDraftIndex(collection, card.dataset.instanceId);
          return cardIndex >= 0 ? cardIndex : null;
        }
      }
    } else if (Number.isFinite(clientY)) {
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        if (clientY < rect.top + (rect.height / 2)) {
          const cardIndex = getDraftIndex(collection, card.dataset.instanceId);
          return cardIndex >= 0 ? cardIndex : null;
        }
      }
    }

    const lastCardIndex = getDraftIndex(collection, cards[cards.length - 1].dataset.instanceId);
    return lastCardIndex >= 0 ? lastCardIndex + 1 : null;
  }

  function getDraftCollectionForLane(lane) {
    if (lane?.closest('#dungeonHandGrid')) return state.recruitDraftPool;
    return state.recruitDraftTeam;
  }

  function getFormationRowInsertIndex(collection, lane) {
    const rowInfo = getFormationLaneInfo(lane);
    if (!rowInfo || !lane.closest('#teamGrid')) return (collection || []).length;

    return Math.min(normalizeFormationRow(rowInfo.rowIndex), (collection || []).length);
  }

  function getFormationLaneInfo(lane) {
    const formationLane = lane?.closest('.formation-lane');
    if (!formationLane) return null;
    const position = formationLane.dataset.formationPosition || lane.dataset.formationDrop;
    const rowIndex = Number(formationLane.dataset.formationRow || lane.dataset.formationRow || 0);
    if (!position) return null;
    return {
      position,
      rowIndex: Number.isFinite(rowIndex) ? rowIndex : 0
    };
  }

  function getFormationLaneDemons(collection, lane) {
    const rowInfo = getFormationLaneInfo(lane);
    if (!rowInfo) return [];
    return getDemonsForFormationRow(collection || [], rowInfo.position, rowInfo.rowIndex);
  }

  function isDemonInFormationLane(collection, instanceId, lane) {
    return getFormationLaneDemons(collection, lane)
      .some((demon) => demon.instanceId === instanceId);
  }

  function getDemonFormationRow(demon, collection = [], index = 0) {
    if (!demon) return 0;

    const explicitRow = getExplicitFormationRow(demon);
    if (explicitRow !== null) return explicitRow;

    const collectionIndex = (collection || []).findIndex((item) => item.instanceId && item.instanceId === demon.instanceId);
    return normalizeFormationRow(collectionIndex >= 0 ? collectionIndex : index);
  }

  function getExplicitFormationRow(demon) {
    const ownSlot = Number(demon?.formationSlot);
    if (Number.isInteger(ownSlot)) return normalizeFormationRow(ownSlot);

    const ownRow = Number(demon?.formationRow);
    if (Number.isInteger(ownRow)) return normalizeFormationRow(ownRow);

    if (demon?.instanceId && state.formationRows.has(demon.instanceId)) {
      return normalizeFormationRow(state.formationRows.get(demon.instanceId));
    }

    return null;
  }

  function normalizeFormationRow(rowIndex) {
    const numericRow = Number(rowIndex);
    if (!Number.isInteger(numericRow)) return 0;
    return Math.max(0, Math.min(FORMATION_GRID_SIZE - 1, numericRow));
  }

  function setDemonFormationRow(demon, rowIndex) {
    if (!demon) return;

    const normalizedRow = normalizeFormationRow(rowIndex);
    demon.formationRow = normalizedRow;
    demon.formationSlot = normalizedRow;
    setStoredFormationRow(demon.instanceId, normalizedRow);
  }

  function setStoredFormationRow(instanceId, rowIndex) {
    if (!instanceId) return;
    state.formationRows.set(instanceId, normalizeFormationRow(rowIndex));
  }

  function isHandLane(lane) {
    return Boolean(lane?.closest('#dungeonHandGrid'));
  }

  function isHorizontalDropLane(lane) {
    return isHandLane(lane);
  }

  function getDraftIndex(collection, instanceId) {
    return (collection || []).findIndex((demon) => demon.instanceId === instanceId);
  }

  function moveDraftDemonWithin(collection, instanceId, position, insertIndex = null, rowIndex = null) {
    const fromIndex = getDraftIndex(collection, instanceId);
    if (fromIndex === -1) return;

    const [demon] = collection.splice(fromIndex, 1);
    demon.position = position;
    if (rowIndex !== null && rowIndex !== undefined) {
      setDemonFormationRow(demon, rowIndex);
    }
    let targetIndex = Number.isInteger(insertIndex) && insertIndex >= 0 ? insertIndex : collection.length;
    if (targetIndex > fromIndex) targetIndex -= 1;
    targetIndex = Math.max(0, Math.min(targetIndex, collection.length));
    collection.splice(targetIndex, 0, demon);
  }

  function swapDraftDemons(collection, sourceInstanceId, targetInstanceId) {
    const sourceIndex = getDraftIndex(collection, sourceInstanceId);
    const targetIndex = getDraftIndex(collection, targetInstanceId);
    if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

    const sourcePosition = getDemonPosition(collection[sourceIndex]);
    const sourceRow = getDemonFormationRow(collection[sourceIndex], collection, sourceIndex);
    const targetRow = getDemonFormationRow(collection[targetIndex], collection, targetIndex);
    const swapsFormationRows = collection === state.recruitDraftTeam;
    collection[sourceIndex].position = getDemonPosition(collection[targetIndex]);
    collection[targetIndex].position = sourcePosition;
    [collection[sourceIndex], collection[targetIndex]] = [collection[targetIndex], collection[sourceIndex]];
    if (swapsFormationRows) {
      setDemonFormationRow(collection[sourceIndex], sourceRow);
      setDemonFormationRow(collection[targetIndex], targetRow);
    }
    state.recruitSwapEffectIds = [sourceInstanceId, targetInstanceId].filter(Boolean);
  }

  function getDraftOrder(demon) {
    if (Number.isFinite(demon?.draftOrder)) return demon.draftOrder;
    return 99;
  }

  function refreshRecruitDraftOrder() {
    (state.recruitDraftTeam || []).forEach((demon, index) => {
      demon.draftOrder = index;
    });
  }

  function refreshRecruitDraftPoolOrder() {
    (state.recruitDraftPool || []).forEach((demon, index) => {
      demon.draftOrder = index;
    });
  }

  function syncRecruitDraftSelection() {
    const recruit = (state.recruitDraftTeam || []).find((demon) => demon.recruitSource === 'reward' && demon.rewardId);
    state.selectedRecruitRewardId = recruit?.rewardId || null;

    const draftOriginalIds = new Set(
      (state.recruitDraftTeam || [])
        .filter((demon) => demon.recruitSource === 'team')
        .map((demon) => demon.originalInstanceId || demon.instanceId)
    );
    const replaced = (state.run?.team || []).find((demon) => !draftOriginalIds.has(demon.instanceId));
    state.selectedSwapInstanceId = replaced?.instanceId || null;
  }

  function readDragPayload(event) {
    const raw = event.dataTransfer?.getData('text/plain');
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function readRecruitDragPayload(event) {
    const payload = readDragPayload(event);
    if (payload) return payload;
    if (state.draggedRecruitPoolInstanceId) {
      return { type: 'recruit-pool', instanceId: state.draggedRecruitPoolInstanceId };
    }
    if (state.draggedFormationInstanceId) {
      return { type: 'recruit-team', instanceId: state.draggedFormationInstanceId };
    }
    return null;
  }

  function renderDemonCards(demons, options = {}) {
    const side = options.side === 'enemy' ? 'enemy' : 'player';
    const assignments = getFormationGridAssignments(demons || [], side);

    return `
      <div class="battle-formation battle-formation-grid battle-formation-${side}" role="list" aria-label="${side === 'enemy' ? 'Enemy' : 'Your team'} formation">
        ${assignments.map((demon, cellIndex) => renderFormationSlot(demon, cellIndex, options, side)).join('')}
      </div>
    `;
  }

  function renderFormationSlot(demon, cellIndex, options, side) {
    const position = getFormationSlotPosition(cellIndex, side);
    const slotNumber = cellIndex + 1;
    const sideLabel = options.side === 'enemy' ? 'Enemy' : 'Your team';
    const placeholder = shouldShowCollectionReinforcementPlaceholders(options)
      ? renderCollectionReinforcementPlaceholder(position)
      : '';
    const slotContent = demon
      ? renderDemonCard(demon, options)
      : (placeholder || renderEmptyFormationSlot(position, slotNumber));

    return `
      <div class="formation-slot formation-lane formation-slot-${position} ${demon ? 'has-demon' : 'is-empty'}" data-formation-position="${position}" data-formation-row="${cellIndex}" data-formation-slot="${cellIndex}" role="listitem" aria-label="${escapeHtml(`${sideLabel} slot ${slotNumber}`)}">
        <div class="formation-lane-cards formation-slot-cards" data-formation-drop="${position}" data-formation-row="${cellIndex}">
          ${slotContent}
        </div>
      </div>
    `;
  }

  function getFormationGridAssignments(demons = [], side = 'player') {
    const cells = Array.from({ length: FORMATION_GRID_SIZE }, () => null);
    const pending = [];
    const overflow = [];

    (demons || []).slice(0, FORMATION_GRID_SIZE).forEach((demon, index) => {
      const explicitCell = getExplicitFormationRow(demon);
      const explicitPosition = explicitCell !== null ? getFormationSlotPosition(explicitCell, side) : null;
      const normalizedDemon = {
        ...demon,
        position: explicitPosition || getDemonPosition(demon, index)
      };
      if (explicitCell !== null && !cells[explicitCell] && getFormationSlotPosition(explicitCell, side) === normalizedDemon.position) {
        cells[explicitCell] = normalizedDemon;
        return;
      }

      pending.push({
        demon: normalizedDemon,
        preferredCell: normalizeFormationRow(index)
      });
    });

    pending.forEach(({ demon, preferredCell }) => {
      if (!cells[preferredCell] && getFormationSlotPosition(preferredCell, side) === demon.position) {
        cells[preferredCell] = demon;
        return;
      }

      overflow.push(demon);
    });

    overflow.forEach((demon) => {
      const cellIndex = getNextOpenFormationCell(cells, side, demon.position);
      if (cellIndex >= 0) cells[cellIndex] = demon;
    });

    return cells;
  }

  function getNextOpenFormationCell(cells, side = 'player', position = null) {
    for (const index of getFormationSlotOrder(side, position)) {
      if (!cells[index]) return index;
    }

    return cells.findIndex((cell) => !cell);
  }

  function getFormationSlotPosition(cellIndex, side = 'player') {
    const column = normalizeFormationRow(cellIndex) % FORMATION_GRID_COLUMNS;
    const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
    return column === frontColumn ? 'front' : 'back';
  }

  function getFormationSlotOrder(side = 'player', position = null) {
    const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
    const middleColumn = 1;
    const outerColumn = side === 'enemy' ? FORMATION_GRID_COLUMNS - 1 : 0;
    const columns = position === 'front'
      ? [frontColumn]
      : position === 'back'
        ? [middleColumn, outerColumn]
        : [frontColumn, middleColumn, outerColumn];

    return columns.flatMap((column) => (
      Array.from({ length: FORMATION_GRID_COLUMNS }, (item, rowIndex) => rowIndex * FORMATION_GRID_COLUMNS + column)
    ));
  }

  function getDemonsForFormationRow(demons, position, rowIndex) {
    const demon = getFormationGridAssignments(demons)[normalizeFormationRow(rowIndex)];
    return demon ? [demon] : [];
  }

  function renderEmptyFormationSlot(position, slotNumber) {
    return `
      <div class="formation-empty formation-empty-${position}" aria-hidden="true" data-slot-number="${slotNumber}">
        <span>Empty</span>
      </div>
    `;
  }

  function renderButtonMeleeIcon() {
    return renderIcon('melee', { className: 'button-melee-icon' });
  }

  function shouldShowCollectionReinforcementPlaceholders(options) {
    return Boolean(
      state.isRecruiting &&
      options.side === 'hand' &&
      state.run?.collectionReinforcementAvailable &&
      getSelectedCollectionReinforcements().length < getCollectionReinforcementLimit()
    );
  }

  function shouldShowCollectionReinforcementHandPlaceholder() {
    return shouldShowCollectionReinforcementPlaceholders({ side: 'hand' });
  }

  function renderCollectionReinforcementPlaceholder(position) {
    const attentionClass = state.collectionReinforcementPlaceholderInteracted ? '' : 'is-collection-reinforcement-attention';
    const label = position === 'hand' ? 'Hand' : `${position === 'front' ? 'Melee' : 'Ranged'} slot`;
    return `
      <button class="hunt-demon-card collection-reinforcement-placeholder ${attentionClass}" type="button" data-collection-reinforcement-position="${position}" aria-label="Choose collection reinforcement">
        <div class="collection-reinforcement-placeholder-icon">${renderIcon('collection')}</div>
        <div class="collection-reinforcement-placeholder-copy">
          <span>Collection</span>
          <small>${label}</small>
        </div>
      </button>
    `;
  }

  function renderDungeonDemonCard(demon, options = {}) {
    const showMissingTag = shouldShowCollectionMissingTag(demon, options);
    const className = [
      options.className || '',
      showMissingTag ? 'is-new-encounter' : ''
    ].filter(Boolean).join(' ');
    const overlayHtml = `${options.overlayHtml || ''}${showMissingTag ? renderNewEncounterBadge() : ''}`;

    return renderSharedDemonCard(demon, {
      ...options,
      className,
      overlayHtml
    });
  }

  function renderDemonCard(demon, options) {
    const isPlayer = options.side === 'player';
    const isRecruitPoolDemon = Boolean(options.allowRecruitDrag && demon.recruitSource);
    const canDropRecruit = Boolean(state.isRecruiting && isPlayer);
    const canDragFormation = Boolean((options.allowFormationDrag || state.isRecruiting) && isPlayer);
    const draggable = isRecruitPoolDemon || canDragFormation;
    const classes = [
      'hunt-demon-card',
      isRecruitPoolDemon ? 'is-recruit-draggable' : '',
      demon.recruitSource === 'collection' && !state.collectionReinforcementStagedInteracted ? 'is-collection-reinforcement-attention' : '',
      canDropRecruit ? 'is-recruit-drop-target' : '',
      hasPoisonStatus(demon) ? 'is-poisoned' : '',
    ].filter(Boolean).join(' ');

    return renderDungeonDemonCard(demon, {
      className: classes.replace('hunt-demon-card', '').trim(),
      defeated: Number(demon.hp) <= 0,
      active: state.selectedSwapInstanceId === demon.instanceId || state.selectedRecruitRewardId === demon.rewardId,
      overlayHtml: renderDemonStatus(demon),
      attributes: {
        'data-instance-id': demon.instanceId,
        'data-reward-id': demon.rewardId || null,
        'data-recruit-source': demon.recruitSource || null,
        role: 'button',
        tabindex: '0',
        draggable
      }
    });
  }

  function renderDemonStatus(demon) {
    const poisonStacks = getPoisonStackCount(demon);
    if (!poisonStacks) return '';

    return `
      <div class="demon-status-strip" aria-label="Status effects">
        <span class="demon-status-badge demon-status-poison" aria-label="Poisoned, ${poisonStacks} stack${poisonStacks === 1 ? '' : 's'}" title="Poisoned">
          <span class="demon-status-icon">${renderPoisonIcon()}</span>
          ${poisonStacks > 1 ? `<span class="demon-status-count">${escapeHtml(poisonStacks)}</span>` : ''}
        </span>
      </div>
    `;
  }

  function renderNewEncounterBadge() {
    return `
      <div class="new-encounter-badge" title="Missing from collection" aria-label="Missing from collection">
        New
      </div>
    `;
  }

  function hasPoisonStatus(demon) {
    return getPoisonStackCount(demon) > 0;
  }

  function getPoisonStackCount(demon) {
    return (demon.statusEffects?.poison || []).length;
  }

  function renderPoisonIcon() {
    return renderIcon('poison');
  }

  function getDemonPosition(demon, index = 0) {
    return demon.position === 'back' || (!demon.position && index > 0) ? 'back' : 'front';
  }

  function getPreferredDemonPosition(demon, index = 0) {
    if (demon.position === 'back' || demon.position === 'front') return demon.position;
    if (demon.preferredPosition === 'back' || demon.preferredPosition === 'front') return demon.preferredPosition;
    return index > 0 ? 'back' : 'front';
  }

  function getFirstDraftIndexForPosition(collection, position) {
    const index = (collection || []).findIndex((demon, demonIndex) => getDemonPosition(demon, demonIndex) === position);
    return index >= 0 ? index : (collection || []).length;
  }

  function renderCombatStats(demon) {
    return renderSharedCombatStats(demon, {
      hideSpeed: isRetaliateDemon(demon)
    });
  }

  function isRetaliateDemon(demon = {}) {
    return Number(demon.typeId) === 8 || demon.role === 'counter_tank' || demon.targeting === 'none';
  }

  function renderEmptyText(text) {
    return `<p class="text-muted mb-0">${escapeHtml(text)}</p>`;
  }

  function runPath(runId, action = '') {
    const suffix = action ? `/${action}` : '';
    return `/api/runs/${encodeURIComponent(runId)}${suffix}`;
  }

  function activeRunPath(action = '') {
    return runPath(state.run.runId, action);
  }

  function storeCurrentRun(runId) {
    localStorage.setItem(RUN_KEY, runId);
  }

  function clearCurrentRun() {
    localStorage.removeItem(RUN_KEY);
  }

  function clearRecruitSelection() {
    state.selectedRecruitRewardId = null;
    state.selectedSwapInstanceId = null;
  }

  function clearDragState() {
    state.draggedRecruitPoolInstanceId = null;
    state.draggedFormationInstanceId = null;
  }

  function clearRecruitDrafts() {
    state.recruitDraftTeam = null;
    state.recruitDraftPool = null;
  }

  function resetCombatState() {
    state.combatLog = [];
    state.combatDemons = new Map();
  }

  function resetEndState() {
    state.endNotice = null;
    state.endSummary = null;
    state.endedReplayRun = null;
  }

  function handleAuthError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
      return;
    }

    showError(error);
  }

  function showError(error) {
    setMessage(error.message || 'Something went wrong.', 'danger');
  }

  function setMessage(text, type) {
    if (!text) return;

    const className = type === 'danger'
      ? 'fight-log-notice text-danger'
      : type === 'warning'
        ? 'fight-log-notice text-warning'
        : 'fight-log-notice text-success';
    const notice = `<div class="${className}">${escapeHtml(text)}</div>`;

    elements.fightLog.classList.remove('text-muted');
    if (!state.combatLog.length && !state.endNotice) {
      elements.fightLog.innerHTML = notice;
      return;
    }

    elements.fightLog.insertAdjacentHTML('afterbegin', notice);
  }

  async function withBusy(button, task) {
    if (button) button.disabled = true;
    try {
      await task();
    } finally {
      syncActionButtons(button);
    }
  }

  function bindClick(element, handler) {
    if (element) element.addEventListener('click', handler);
  }

  function bindClicks(selector, handler, root = document) {
    root.querySelectorAll(selector).forEach((element) => {
      element.addEventListener('click', (event) => handler(element, event));
    });
  }

  function getModal(element, options) {
    return bootstrap.Modal.getOrCreateInstance(element, options);
  }

  function setTeamChoiceModalFullscreen(isFullscreen) {
    const dialog = elements.teamChoiceModal?.querySelector('.modal-dialog');
    if (!dialog) return;

    dialog.classList.toggle('modal-fullscreen', Boolean(isFullscreen));
    dialog.classList.toggle('modal-lg', !isFullscreen);
    dialog.classList.toggle('modal-dialog-centered', !isFullscreen);
    dialog.classList.toggle('modal-dialog-scrollable', !isFullscreen);
  }

  function syncActionButtons(fallbackButton) {
    if (fallbackButton) {
      fallbackButton.disabled = false;
    }
  }

  function capitalize(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();

