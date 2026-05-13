(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const RUN_KEY = 'amongdemons-current-run';
  const session = window.AmongDemons.getSession();
  const state = {
    player: session.player || null,
    run: null,
    startOptions: null,
    selectedStarter: null,
    selectedRecruitRewardId: null,
    selectedSwapInstanceId: null,
    selectedCashoutDemonKey: null,
    isRecruiting: false,
    showPostWinActions: false,
    draggedRewardId: null,
    draggedRecruitPoolInstanceId: null,
    draggedFormationInstanceId: null,
    recruitDraftTeam: null,
    recruitDraftPool: null,
    combatLog: [],
    combatDemons: new Map(),
    endNotice: null,
    promptedStarter: false
  };
  const elements = {};

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      window.location.href = '/login';
      return;
    }

    cacheElements();
    bindActions();
    await refreshAll();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'huntTitle',
      'runEmpty',
      'runPanel',
      'teamGrid',
      'enemyGrid',
      'fightLogTitle',
      'fightLog',
      'fightLogActions',
      'starterModal',
      'starterModalBody',
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

    elements.confirmStarterBtn = document.getElementById('confirmStarterBtn');
    elements.battleBtn = document.getElementById('battleBtn');
    elements.logoutBtn = document.getElementById('logoutBtn');
  }

  function bindActions() {
    elements.logoutBtn.addEventListener('click', () => {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
    });

    elements.confirmStarterBtn.addEventListener('click', startRun);
    elements.cashoutConfirmBtn.addEventListener('click', cashOutDungeon);
    elements.confirmShortTeamBtn.addEventListener('click', continueShortTeam);
    if (elements.battleBtn) elements.battleBtn.addEventListener('click', battle);
  }

  async function refreshAll() {
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
        await loadStartOptions();
        renderRun();
        if (!state.promptedStarter) {
          state.promptedStarter = true;
          openStarterModal();
        }
      }
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function loadSavedRun() {
    const runId = localStorage.getItem(RUN_KEY);
    if (!runId) return false;

    try {
      await loadRun(runId);
      if (state.run?.status === 'ended') {
        localStorage.removeItem(RUN_KEY);
        state.run = null;
        state.combatLog = [];
        return false;
      }
      return true;
    } catch (error) {
      if (error.status !== 404) throw error;
      localStorage.removeItem(RUN_KEY);
      state.run = null;
      state.combatLog = [];
      return false;
    }
  }

  async function loadCurrentRun() {
    try {
      state.run = await api('/api/runs/current');
      state.combatLog = isCurrentFloorBattle(state.run) ? state.run.lastBattle?.combatLog || [] : [];
      state.isRecruiting = Boolean(state.run.awaitingRecruit);
      state.showPostWinActions = false;
      localStorage.setItem(RUN_KEY, state.run.runId);
      renderRun();
      return true;
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }

  async function loadStartOptions() {
    state.startOptions = await api('/api/runs/start-options');
    state.selectedStarter = null;
  }

  async function openStarterModal() {
    if (state.run) return;

    try {
      if (!state.startOptions) {
        await loadStartOptions();
      }
      renderStarterModal();
      getModal(elements.starterModal).show();
    } catch (error) {
      showError(error);
    }
  }

  async function startRun() {
    if (state.run) return;

    await withBusy(elements.confirmStarterBtn, async () => {
      try {
        if (!state.startOptions) {
          await loadStartOptions();
          renderStarterModal();
          setMessage('Choose one demon to begin the dungeon.', 'warning');
          return;
        }

        if (!state.selectedStarter) {
          setMessage('Choose one demon to begin the dungeon.', 'warning');
          return;
        }

        const payload = await api('/api/runs/start', {
          method: 'POST',
          body: state.selectedStarter
        });
        state.combatLog = [];
        state.endNotice = null;
        state.isRecruiting = false;
        state.showPostWinActions = false;
        state.selectedStarter = null;
        state.startOptions = null;
        getModal(elements.starterModal).hide();
        localStorage.setItem(RUN_KEY, payload.runId);
        await loadRun(payload.runId);
        await battle();
      } catch (error) {
        showError(error);
      }
    });
  }

  async function loadRun(runId, options = {}) {
    try {
      state.run = await api(`/api/runs/${encodeURIComponent(runId)}`);
      state.combatLog = isCurrentFloorBattle(state.run) ? state.run.lastBattle?.combatLog || [] : [];
      state.showPostWinActions = Boolean(options.showPostWinActions && state.run.awaitingRecruit);
      state.isRecruiting = Boolean(state.run.awaitingRecruit && !state.showPostWinActions);
      if (!state.isRecruiting) {
        state.recruitDraftTeam = null;
        state.recruitDraftPool = null;
      }
      localStorage.setItem(RUN_KEY, state.run.runId);
      renderRun();
      showPendingChoiceModal();
    } catch (error) {
      localStorage.removeItem(RUN_KEY);
      state.run = null;
      await loadStartOptions();
      renderRun();
      throw error;
    }
  }

  async function battle() {
    if (!state.run) return;

    await withBusy(elements.battleBtn, async () => {
      try {
        setFightLogTitle('Fight Log');
        const result = await api(`/api/runs/${encodeURIComponent(state.run.runId)}/battle`, { method: 'POST' });
        state.combatDemons = createCombatDemonMap();
        state.combatLog = result.combatLog || [];
        if (result.lastBattle) state.run.lastBattle = result.lastBattle;
        elements.fightLog.innerHTML = '';
        elements.fightLog.classList.remove('text-muted');
        await playCombatLog(result);
        if (result.winner === 'enemy') {
          state.run.status = 'defeated';
          state.run.lastBattle = result.lastBattle || state.run.lastBattle;
          setMessage('Your team was defeated.', 'warning');
          renderFightLogActions();
          syncActionButtons();
        } else {
          await loadRun(state.run.runId, { showPostWinActions: true });
          setMessage(getWinMessage(), 'success');
        }
      } catch (error) {
        showError(error);
      }
    });
  }

  function getWinMessage() {
    if (state.run?.status === 'completed') return 'Floor 10 cleared. Choose your final demon.';
    return 'Battle won. Choose one defeated demon for the next fight.';
  }

  function selectRecruitReward(rewardId) {
    if (!state.run) return;

    state.selectedRecruitRewardId = rewardId;
    state.selectedSwapInstanceId = null;
    renderTeamChoiceModal();
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

    const recruitChoice = getDraftRecruitPayload();
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
      await api(`/api/runs/${encodeURIComponent(state.run.runId)}/recruit`, {
        method: 'POST',
        body
      });
      state.selectedRecruitRewardId = null;
      state.selectedSwapInstanceId = null;
      state.isRecruiting = false;
      state.showPostWinActions = false;
      state.draggedRewardId = null;
      state.draggedRecruitPoolInstanceId = null;
      state.draggedFormationInstanceId = null;
      state.recruitDraftTeam = null;
      state.recruitDraftPool = null;
      state.combatLog = [];
      state.combatDemons = new Map();
      state.endNotice = null;
      getModal(elements.teamChoiceModal).hide();
      await loadRun(state.run.runId);
      setMessage(body.skipRecruit ? 'Continuing to the next floor.' : 'Team updated.', 'success');
    } catch (error) {
      showError(error);
    }
  }

  async function saveReward(rewardId) {
    try {
      await api('/api/demons/save', {
        method: 'POST',
        body: {
          runId: state.run.runId,
          rewardId
        }
      });
      getModal(elements.teamChoiceModal).hide();
      await finishRun('Dungeon complete. Final demon added to your collection.');
    } catch (error) {
      showError(error);
    }
  }

  function openCashoutModal() {
    if (!state.run?.awaitingRecruit) return;

    state.selectedCashoutDemonKey = null;
    renderCashoutModal();
    getModal(elements.cashoutModal).show();
  }

  function renderCashoutModal() {
    const earned = state.run?.earned || { xp: 0, souls: 0 };
    const candidates = getCashoutCandidates();

    elements.cashoutModalBody.innerHTML = `
      <div class="cashout-summary">
        <p class="mb-2">Ending the dungeon now gives you <strong>${earned.xp || 0} XP</strong>, <strong>${earned.souls || 0} souls</strong>, and one selected demon.</p>
        <p class="text-warning mb-0">This ends the dungeon immediately.</p>
      </div>
      <div class="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3 mt-1">
        ${candidates.map(renderCashoutCandidate).join('')}
      </div>
    `;
    elements.cashoutConfirmBtn.disabled = !state.selectedCashoutDemonKey;

    document.querySelectorAll('.cashout-demon-card').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedCashoutDemonKey = button.dataset.cashoutKey;
        renderCashoutModal();
      });
    });
  }

  function getCashoutCandidates() {
    ensureRecruitDraft();
    return [
      ...(state.recruitDraftTeam || []).map((demon) => ({
        key: demon.recruitSource === 'reward' ? `reward:${demon.rewardId}` : `team:${demon.originalInstanceId || demon.instanceId}`,
        source: demon.recruitSource === 'reward' ? 'reward' : 'team',
        instanceId: demon.originalInstanceId || demon.instanceId,
        rewardId: demon.rewardId || null,
        demon
      })),
      ...(state.recruitDraftPool || []).map((demon) => ({
        key: demon.recruitSource === 'reward' ? `reward:${demon.rewardId}` : `team:${demon.originalInstanceId || demon.instanceId}`,
        source: demon.recruitSource === 'reward' ? 'reward' : 'team',
        instanceId: demon.originalInstanceId || demon.instanceId,
        rewardId: demon.rewardId || null,
        demon
      }))
    ].filter((candidate) => canCashoutCandidate(candidate));
  }

  function canCashoutCandidate(candidate) {
    return candidate.source === 'reward' || !candidate.demon.collectionDemonId;
  }

  function renderCashoutCandidate(candidate) {
    const demon = candidate.demon;
    const active = state.selectedCashoutDemonKey === candidate.key;

    return `
      <div class="col">
        <button class="cashout-demon-card ${active ? 'active' : ''}" type="button" data-cashout-key="${escapeHtml(candidate.key)}">
          <img src="${escapeHtml(demon.imageUrl || demon.image_url)}" alt="">
          <span class="cashout-demon-name"><span class="ad-${escapeHtml(demon.rarity)}">${escapeHtml(capitalize(demon.rarity))}</span> ${escapeHtml(demon.species || 'Demon')}</span>
          ${renderCombatStats(demon)}
        </button>
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

    await withBusy(elements.cashoutConfirmBtn, async () => {
      try {
        const result = await api(`/api/runs/${encodeURIComponent(state.run.runId)}/cashout`, {
          method: 'POST',
          body: {
            source: candidate.source,
            instanceId: candidate.instanceId,
            rewardId: candidate.rewardId
          }
        });
        localStorage.removeItem(RUN_KEY);
        state.run = null;
        state.selectedCashoutDemonKey = null;
        state.recruitDraftTeam = null;
        state.recruitDraftPool = null;
        state.combatLog = [];
        state.combatDemons = new Map();
        state.endNotice = {
          text: `Dungeon ended. ${result.demon?.species || 'Demon'} joined your collection. You earned ${result.xp} XP and ${result.souls} souls.`,
          type: 'success'
        };
        getModal(elements.cashoutModal).hide();
        await loadStartOptions();
        renderRun();
      } catch (error) {
        showError(error);
      }
    });
  }

  async function endRun() {
    if (!state.run) return;

    await finishRun();
  }

  async function finishRun(message) {
    if (!state.run) return;

    try {
      const result = await api(`/api/runs/${encodeURIComponent(state.run.runId)}/end`, { method: 'POST' });
      localStorage.removeItem(RUN_KEY);
      state.run = null;
      state.selectedRecruitRewardId = null;
      state.selectedSwapInstanceId = null;
      state.isRecruiting = false;
      state.showPostWinActions = false;
      state.draggedRewardId = null;
      state.draggedRecruitPoolInstanceId = null;
      state.draggedFormationInstanceId = null;
      state.recruitDraftTeam = null;
      state.recruitDraftPool = null;
      state.endNotice = {
        text: `${message || 'Dungeon ended.'} You earned ${result.xp} XP and ${result.souls} souls.`,
        type: message ? 'warning' : 'success'
      };
      getModal(elements.teamChoiceModal).hide();
      getModal(elements.starterModal).hide();
      await loadStartOptions();
      renderRun();
      scrollFightLogToBottom();
    } catch (error) {
      showError(error);
    }
  }

  function renderPlayer() {
    const player = state.player || {};
    elements.navPlayerName.textContent = player.username || '';
  }

  function renderRun() {
    const run = state.run;
    const hasRun = Boolean(run);

    elements.runEmpty.classList.toggle('d-none', hasRun);
    elements.runPanel.classList.toggle('d-none', !hasRun);
    elements.huntTitle.innerHTML = run ? renderHuntTitle(run) : 'Dungeon';

    if (!run) {
      elements.runEmpty.innerHTML = `
        <img src="/app/images/demons/thumbnails/1.png" alt="">
        <p class="mb-0 text-muted">Choose your first demon to begin.</p>
      `;
      renderFightLog();
      renderFightLogActions();
      renderPhaseTitle();
      syncActionButtons();
      return;
    }

    const team = state.isRecruiting ? getRecruitPreviewTeam() : run.team || [];
    const enemies = state.isRecruiting ? getRecruitPreviewEnemies() : run.enemies || [];
    elements.teamGrid.innerHTML = renderDemonCards(team, {
      side: 'player',
      allowFormationDrag: run.status === 'active' && !run.awaitingRecruit && !run.awaitingFinalPick
    });
    elements.enemyGrid.innerHTML = renderDemonCards((run.team || []).length ? enemies : [], {
      side: 'enemy',
      allowRecruitDrag: state.isRecruiting
    });
    bindFormationDragAndDrop();
    bindRecruitDragAndDrop();
    renderFightLog();
    renderFightLogActions();
    renderPhaseTitle();
    syncActionButtons();
  }

  function renderStarterModal() {
    if (!state.startOptions) {
      elements.starterModalBody.innerHTML = `
        <img src="/app/images/demons/thumbnails/1.png" alt="">
        <p class="mb-0 text-muted">Loading starter demons...</p>
      `;
      elements.confirmStarterBtn.disabled = true;
      return;
    }

    const collection = state.startOptions.collection || [];
    const draft = state.startOptions.draft || [];
    const selectedTab = state.selectedStarter?.source === 'collection' ? 'collection' : 'draft';

    elements.starterModalBody.innerHTML = `
      <div class="starter-picker w-100">
        <ul class="nav nav-tabs starter-tabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link ${selectedTab === 'draft' ? 'active' : ''}" id="starterDraftTab" data-bs-toggle="tab" data-bs-target="#starterDraftPanel" type="button" role="tab" aria-controls="starterDraftPanel" aria-selected="${selectedTab === 'draft'}">New Demons</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link ${selectedTab === 'collection' ? 'active' : ''}" id="starterCollectionTab" data-bs-toggle="tab" data-bs-target="#starterCollectionPanel" type="button" role="tab" aria-controls="starterCollectionPanel" aria-selected="${selectedTab === 'collection'}">Collection</button>
          </li>
        </ul>
        <div class="tab-content starter-tab-content">
          <div class="tab-pane fade ${selectedTab === 'draft' ? 'show active' : ''}" id="starterDraftPanel" role="tabpanel" aria-labelledby="starterDraftTab" tabindex="0">
            <div class="starter-card-grid">
              ${draft.map((demon, index) => renderChoiceCard(demon, {
                type: 'draft',
                value: index,
                selected: state.selectedStarter?.source === 'draft' && state.selectedStarter?.draftIndex === index
              })).join('')}
            </div>
          </div>
          <div class="tab-pane fade ${selectedTab === 'collection' ? 'show active' : ''}" id="starterCollectionPanel" role="tabpanel" aria-labelledby="starterCollectionTab" tabindex="0">
            ${collection.length ? `
              <div class="starter-card-grid">
                ${collection.map((demon) => renderChoiceCard(demon, {
                  type: 'collection',
                  value: demon.id,
                  selected: state.selectedStarter?.source === 'collection' && state.selectedStarter?.demonId === demon.id
                })).join('')}
              </div>
            ` : '<p class="text-muted mb-0 py-3">No saved demons yet.</p>'}
          </div>
        </div>
      </div>
    `;
    elements.confirmStarterBtn.disabled = !state.selectedStarter;
    bindStarterButtons();
  }

  function renderChoiceCard(demon, options) {
    const rarityColor = getRarityColor(demon.rarity);

    return `
      <button class="hunt-demon-card hunt-choice-card ${options.selected ? 'active' : ''}" style="--rarity-color: ${rarityColor}" type="button" data-choice-type="${options.type}" data-choice-value="${options.value}">
        <div class="hunt-demon-card-image" aria-label="${escapeHtml(capitalize(demon.rarity || 'common'))} rarity">
          <img src="${escapeHtml(demon.imageUrl || demon.image_url)}" alt="" draggable="false">
          <span class="hunt-demon-rarity-gem" aria-hidden="true"></span>
        </div>
        <div class="hunt-demon-card-body">
          <div class="hunt-demon-card-title">
            <span class="text-white">${escapeHtml(demon.species || 'Demon')}</span>
          </div>
          ${renderCombatStats(demon)}
        </div>
      </button>
    `;
  }

  function bindStarterButtons() {
    document.querySelectorAll('.hunt-choice-card').forEach((button) => {
      button.addEventListener('click', () => {
        const type = button.dataset.choiceType;
        const rawValue = Number(button.dataset.choiceValue);
        state.selectedStarter = type === 'collection'
          ? { source: 'collection', demonId: rawValue }
          : { source: 'draft', draftToken: state.startOptions.draftToken, draftIndex: rawValue };
        renderStarterModal();
      });
    });
  }

  function renderRewardsPanel() {
    renderRewards(state.run.rewards || []);
    bindRewardButtons();
  }

  async function playCombatLog() {
    if (!state.run) return;

    const allDemonsById = new Map([...(state.run.team || []), ...(state.run.enemies || [])].map((demon) => [demon.instanceId, demon]));
    const steps = groupCombatLog(state.combatLog);

    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];

      step.entries.forEach((entry) => {
        const target = allDemonsById.get(entry.target);
        if (target) {
          target.hp = entry.targetHp;
        }
      });

      appendFightLogRow(step, index);
      updateTeamHp();
      setActiveLogRow(index);
      animateAttackerCard(step.attacker);
      const attackerSide = getDemonSide(step.attacker);
      step.entries.forEach((entry) => {
        drawAttackZap(step.attacker, entry.target);
        updateTargetCard(entry.target, entry.targetHp, attackerSide);
      });
      await sleep(320);
    }

    setActiveLogRow(-1);
  }

  function updateTeamHp() {
    if (!state.run) return;
    state.run.hp = (state.run.team || []).reduce((sum, demon) => sum + Math.max(0, Number(demon.hp) || 0), 0);
  }

  function renderHuntTitle(run) {
    const floor = Math.max(1, Math.min(10, Number(run.currentFloor) || 1));
    const percent = Math.round((floor / 10) * 100);

    return `
      <span class="hunt-floor-title">
        <span class="hunt-floor-label">Floor</span>
        <strong>${floor} / 10</strong>
      </span>
      <span class="hunt-floor-track" aria-hidden="true">
        <span style="width: ${percent}%"></span>
      </span>
    `;
  }

  function setActiveLogRow(index) {
    document.querySelectorAll('.fight-log-row').forEach((row) => {
      row.classList.toggle('active', Number(row.dataset.logIndex) === index);
    });
  }

  function animateAttackerCard(instanceId) {
    const card = findDemonCard(instanceId);
    if (!card) return;

    card.classList.toggle('is-player-attack', getDemonSide(instanceId) === 'player');
    card.classList.toggle('is-enemy-attack', getDemonSide(instanceId) === 'enemy');
    playTemporaryCardClass(card, 'is-attacking', 320);
  }

  function drawAttackZap(attackerId, targetId) {
    const attacker = findDemonCard(attackerId);
    const target = findDemonCard(targetId);
    if (!attacker || !target) return;

    const attackerRect = attacker.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const startX = attackerRect.left + attackerRect.width / 2;
    const startY = attackerRect.top + attackerRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
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

    const zap = document.createElement('div');
    zap.className = `attack-zap ${getDemonSide(attackerId) === 'player' ? 'is-player-attack' : 'is-enemy-attack'} ${isBackLineAttack ? 'is-back-attack' : ''}`;
    zap.innerHTML = `
      <svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" aria-hidden="true" focusable="false">
        <path class="attack-zap-trail" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${(midX + normalX * bend).toFixed(1)} ${(midY + normalY * bend).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" />
        <circle class="attack-zap-impact" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${isBackLineAttack ? 5 : 4}" />
      </svg>
    `;
    document.body.appendChild(zap);
    setTimeout(() => zap.remove(), 320);
  }

  function updateTargetCard(instanceId, hp, attackerSide = 'unknown') {
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

    card.classList.toggle('is-player-attack', attackerSide === 'player');
    card.classList.toggle('is-enemy-attack', attackerSide === 'enemy');
    playTemporaryCardClass(card, 'is-hit', 320);
    card.classList.toggle('is-defeated', Number(hp) <= 0);
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
      if (className === 'is-attacking') {
        card.classList.remove('is-player-attack', 'is-enemy-attack');
      }
      if (className === 'is-hit') {
        card.classList.remove('is-player-attack', 'is-enemy-attack');
      }
      card[timerKey] = null;
    }, duration);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function renderFightLog() {
    if (state.run?.awaitingRecruit && state.isRecruiting) {
      const recruitCount = getCurrentRecruitRewards().length;
      const teamLimit = getRecruitTeamLimit();
      const teamCount = getRecruitPreviewTeam().length;
      const teamIsFull = teamCount >= teamLimit;
      elements.fightLog.classList.remove('text-muted');
      elements.fightLog.innerHTML = `
        ${renderRewardsInfoCard()}
        <div class="hunt-phase-panel recruit-phase-panel">
          <div>
            <div class="hunt-phase-eyebrow">Recruit</div>
            <h3>Choose your next demon</h3>
            <p>Drag defeated demons into your team or swap them with current members, then continue deeper.</p>
            <div class="hunt-phase-meta">
              <span class="hunt-tag-neutral">${recruitCount} recruitable ${recruitCount === 1 ? 'demon' : 'demons'}</span>
              <span class="hunt-tag-team ${teamIsFull ? 'is-full' : 'is-short'}">${teamCount} / ${teamLimit} team</span>
            </div>
          </div>
          <div class="hunt-phase-card-actions">
            <button class="btn btn-success btn-sm" id="fightLogContinueHuntBtn" type="button">
              ${renderButtonMeleeIcon()}
              Continue
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (!state.combatLog.length && !state.endNotice) {
      elements.fightLog.innerHTML = getIdleFightLogContent();
      elements.fightLog.classList.add('text-muted');
      return;
    }

    elements.fightLog.classList.remove('text-muted');
    const rows = groupCombatLog(state.combatLog).map((step, index) => `
      ${renderFightLogRow(step, index)}
    `).join('');
    elements.fightLog.innerHTML = rows + renderEndNotice();
    scrollFightLogToBottom();
  }

  function getIdleFightLogContent() {
    if (state.run?.status === 'active') {
      return `
        <div class="hunt-phase-panel strategy-phase-panel">
          <div class="hunt-phase-eyebrow">Strategy Phase</div>
          <h3>Prepare for the next fight</h3>
          <p>Set your formation now. Buffs and items will live here later.</p>
        </div>
      `;
    }

    return 'Battle actions will appear here.';
  }

  function renderRewardsInfoCard() {
    const earned = state.run?.earned || { xp: 0, souls: 0 };
    return `
      <div class="hunt-phase-panel dungeon-reward-card">
        <div>
          <div class="hunt-phase-eyebrow">Rewards</div>
          <div class="dungeon-reward-card-body">
            <h3 class="dungeon-reward-title">Leave with a demon</h3>
            <p>Permanently add one current demon to your collection and claim your XP and souls by leaving the dungeon now.</p>
          </div>
          <div class="hunt-phase-meta dungeon-reward-meta">
            <span>+1 Demon Collection</span>
            <span>${earned.xp || 0} XP</span>
            <span>${earned.souls || 0} souls</span>
          </div>
        </div>
        <div class="hunt-phase-card-actions">
          <button class="btn btn-warning btn-sm" id="getRewardBtn" type="button">
            <i class="bi bi-flag-fill"></i>
            Get Reward
          </button>
        </div>
      </div>
    `;
  }

  function renderPhaseTitle() {
    if (!elements.fightLogTitle) return;

    if (state.run?.awaitingRecruit && state.isRecruiting) {
      elements.fightLogTitle.textContent = 'Choose Path';
      return;
    }

    if (state.run?.status === 'active' && !state.run.awaitingRecruit && !state.run.awaitingFinalPick) {
      elements.fightLogTitle.textContent = 'Strategy Phase';
      return;
    }

    if (state.run?.awaitingRecruit && state.showPostWinActions) {
      elements.fightLogTitle.textContent = 'Fight Won';
      return;
    }

    if (state.run?.status === 'defeated') {
      elements.fightLogTitle.textContent = 'Defeated';
      return;
    }

    if (state.run?.status === 'completed' || state.run?.awaitingFinalPick) {
      elements.fightLogTitle.textContent = 'Dungeon Complete';
      return;
    }

    elements.fightLogTitle.textContent = 'Fight Log';
  }

  function setFightLogTitle(title) {
    if (elements.fightLogTitle) elements.fightLogTitle.textContent = title;
  }

  function appendFightLogRow(step, index) {
    elements.fightLog.insertAdjacentHTML('beforeend', renderFightLogRow(step, index));
    scrollFightLogToBottom();
  }

  function renderFightLogRow(step, index) {
    const primaryEntry = step.entries[0];
    const damageText = step.isAoe ? `${step.entries.length} x ${primaryEntry.dmg} dmg` : `${primaryEntry.dmg} dmg`;
    const targetText = step.isAoe
      ? `${step.entries.length} enemies`
      : `${renderFightLogDemonName(primaryEntry.target)} ${renderLogPosition(primaryEntry.targetPosition)}`;
    const hpText = step.isAoe ? 'AOE' : `${primaryEntry.targetHp} HP`;

    return `
      <div class="fight-log-row ${getLogRowClass(primaryEntry)}" data-log-index="${index}">
        <span class="text-secondary">T${primaryEntry.tick}</span>
        <span class="fight-log-side">${getLogSideLabel(primaryEntry)}</span>
        <span class="fight-log-action">${renderFightLogDemonName(primaryEntry.attacker)} ${getFightLogVerb(primaryEntry)} ${targetText}</span>
        <span class="fight-log-damage">${damageText}</span>
        <span class="text-secondary">${hpText}</span>
      </div>
    `;
  }

  function groupCombatLog(combatLog) {
    const steps = [];

    for (const entry of combatLog || []) {
      const previous = steps[steps.length - 1];
      const isSameAoe = entry.targeting === 'all' &&
        previous?.isAoe &&
        previous.tick === entry.tick &&
        previous.attacker === entry.attacker;

      if (isSameAoe) {
        previous.entries.push(entry);
        continue;
      }

      steps.push({
        tick: entry.tick,
        attacker: entry.attacker,
        isAoe: entry.targeting === 'all',
        entries: [entry]
      });
    }

    return steps;
  }

  function renderLogPosition(position) {
    if (!position) return '';
    return `<span class="fight-log-position">${position === 'front' ? 'Front' : 'Back'}</span>`;
  }

  function getFightLogVerb(entry) {
    return entry.targeting === 'all' ? 'splashed' : 'hit';
  }

  function renderEndNotice() {
    if (!state.endNotice) return '';

    const className = state.endNotice.type === 'warning'
      ? 'fight-log-notice fight-log-end-notice text-warning'
      : 'fight-log-notice fight-log-end-notice text-success';

    return `<div class="${className}">${escapeHtml(state.endNotice.text)}</div>`;
  }

  function beginRecruiting() {
    if (!state.run?.awaitingRecruit) return;

    state.isRecruiting = true;
    state.showPostWinActions = false;
    state.selectedRecruitRewardId = null;
    state.selectedSwapInstanceId = null;
    state.draggedRewardId = null;
    state.draggedRecruitPoolInstanceId = null;
    ensureRecruitDraft();
    renderRun();
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

  function getRecruitPreviewEnemies() {
    ensureRecruitDraft();
    return cloneDemons(state.recruitDraftPool || []);
  }

  function ensureRecruitDraft() {
    if (!state.run?.awaitingRecruit || !state.isRecruiting) return;
    if (state.recruitDraftTeam && state.recruitDraftPool) return;

    state.recruitDraftTeam = (state.run.team || []).map((demon, index) => ({
      ...getFullHpDemon(demon),
      instanceId: demon.instanceId,
      originalInstanceId: demon.instanceId,
      recruitSource: 'team',
      position: getDemonPosition(demon, index)
    }));
    state.recruitDraftPool = getCurrentRecruitRewards().map((reward, index) => ({
      ...getFullHpDemon(reward.demon),
      instanceId: `reward-${reward.rewardId}`,
      rewardId: reward.rewardId,
      recruitSource: 'reward',
      position: getDemonPosition(reward.demon, index)
    }));
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
    if (!state.run) return 3;
    return Math.min(3, Math.max(1, Number(state.run.currentFloor) + 1));
  }

  function getDraftRecruitPayload() {
    ensureRecruitDraft();
    const draftTeam = state.recruitDraftTeam || [];
    return {
      team: draftTeam.map((demon, index) => ({
        source: demon.recruitSource === 'reward' ? 'reward' : 'team',
        instanceId: demon.originalInstanceId || demon.instanceId,
        rewardId: demon.rewardId || undefined,
        position: getDemonPosition(demon, index)
      }))
    };
  }

  function renderFightLogActions() {
    const isDefeated = state.run?.status === 'defeated';
    const canStart = !state.run || isDefeated || state.run.status === 'ended';
    const canBattle = Boolean(state.run?.status === 'active' && !state.run.awaitingRecruit && !state.run.awaitingFinalPick);
    const canReplay = Boolean(!state.isRecruiting && isCurrentFloorBattle(state.run) && (state.run?.lastBattle?.combatLog?.length || state.combatLog.length));
    const canContinueAfterWin = Boolean(state.run?.awaitingRecruit && state.showPostWinActions);

    elements.fightLogActions.innerHTML = `
      ${canBattle ? `
        <button class="btn btn-hunt-battle btn-sm" id="battleBtn" type="button">
          <i class="bi bi-lightning-charge"></i>
          Battle
        </button>
      ` : ''}
      ${canReplay ? `
        <button class="btn btn-warning btn-sm btn-icon-only" id="fightLogReplayBtn" type="button" title="Replay Fight" aria-label="Replay Fight">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
      ` : ''}
      ${canContinueAfterWin ? `
        <button class="btn btn-success btn-sm" id="fightLogContinueBtn" type="button">
          <i class="bi bi-arrow-right-circle"></i>
          Continue
        </button>
      ` : ''}
      ${canStart ? `
      <button class="btn btn-primary btn-sm" id="fightLogStartBtn" type="button">
        <i class="bi bi-play-fill"></i>
        ${isDefeated ? 'Start New Dungeon' : 'Start Dungeon'}
      </button>
      ` : ''}
    `;

    elements.battleBtn = document.getElementById('battleBtn');
    if (elements.battleBtn) elements.battleBtn.addEventListener('click', battle);
    const startButton = document.getElementById('fightLogStartBtn');
    if (startButton) startButton.addEventListener('click', isDefeated ? startNewHuntAfterDefeat : openStarterModal);
    const replayButton = document.getElementById('fightLogReplayBtn');
    if (replayButton) replayButton.addEventListener('click', replayFight);
    const continueButton = document.getElementById('fightLogContinueBtn');
    if (continueButton) continueButton.addEventListener('click', beginRecruiting);
    bindPathButtons();
  }

  function bindPathButtons() {
    const getRewardButton = document.getElementById('getRewardBtn');
    if (getRewardButton) getRewardButton.addEventListener('click', openCashoutModal);
    const continueHuntButton = document.getElementById('fightLogContinueHuntBtn');
    if (continueHuntButton) continueHuntButton.addEventListener('click', requestRecruitContinue);
  }

  async function startNewHuntAfterDefeat() {
    if (!state.run || state.run.status !== 'defeated') {
      await openStarterModal();
      return;
    }

    await finishRun('Your team was defeated.');
    await openStarterModal();
  }

  async function replayFight() {
    const lastBattle = state.run?.lastBattle;
    if (!lastBattle?.combatLog?.length) {
      if (state.combatLog.length) renderFightLog();
      return;
    }

    state.run.team = cloneDemons(lastBattle.playerTeamBefore || state.run.team || []);
    state.run.enemies = cloneDemons(lastBattle.enemyTeamBefore || state.run.enemies || []);
    state.combatLog = lastBattle.combatLog || [];
    renderRun();
    setFightLogTitle('Fight Log');
    elements.fightLog.innerHTML = '';
    elements.fightLog.classList.remove('text-muted');
    await playCombatLog();
    state.run.team = cloneDemons(lastBattle.playerTeamAfter || state.run.team || []);
    state.run.enemies = cloneDemons(lastBattle.enemyTeamAfter || state.run.enemies || []);
    renderRun();
  }

  function cloneDemons(demons) {
    return (demons || []).map((demon) => ({ ...demon }));
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

  function scrollFightLogToBottom() {
    elements.fightLog.scrollTop = elements.fightLog.scrollHeight;
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

  function renderRewards(rewards) {
    if (!state.run) return renderEmptyText('Choose a starter to begin.');

    const currentFloorRewards = rewards.filter((reward) => reward.floor === state.run.currentFloor);
    const finalRewards = currentFloorRewards.filter((reward) => reward.type === 'final');
    const recruitRewards = currentFloorRewards.filter((reward) => reward.type === 'recruit');

    if (state.run.status === 'completed') {
      return `
        <div class="reward-phase">
          <h3 class="h6 mb-2">Dungeon complete</h3>
          <p class="text-muted">${hasSavedFinalReward() ? 'Final demon saved to your collection.' : 'Choose one of your team demons, or exit without collecting.'}</p>
          <button class="btn btn-outline-info btn-sm js-open-choice-modal" type="button" ${hasSavedFinalReward() ? 'disabled' : ''}>
            <i class="bi bi-stars"></i>
            Finish Dungeon
          </button>
        </div>
      `;
    }

    if (state.run.awaitingRecruit) {
      return `
        <div class="reward-phase">
          <h3 class="h6 mb-2">${recruitRewards.length} defeated demons available</h3>
          <p class="text-muted">Pick one in the team editor, preview your swap, then continue.</p>
          <button class="btn btn-outline-success btn-sm js-open-choice-modal" type="button">
            <i class="bi bi-person-plus"></i>
            Edit Team
          </button>
        </div>
      `;
    }

    const earned = state.run.earned || { xp: 0, souls: 0 };
    return renderEmptyText(`Clear the floor to recruit a defeated demon. Dungeon earnings: ${earned.xp || 0} XP, ${earned.souls || 0} souls.`);
  }

  function showPendingChoiceModal() {
    if (!state.run || !(state.run.awaitingFinalPick || state.run.status === 'completed')) return;
    if (state.run.status === 'completed' && hasSavedFinalReward()) return;

    renderTeamChoiceModal();
    getModal(elements.teamChoiceModal, { backdrop: 'static', keyboard: false }).show();
  }

  function openTeamChoiceModal() {
    if (!state.run) return;
    renderTeamChoiceModal();
    getModal(elements.teamChoiceModal, { backdrop: 'static', keyboard: false }).show();
  }

  function renderTeamChoiceModal() {
    if (!state.run) return;

    const currentFloorRewards = (state.run.rewards || []).filter((reward) => reward.floor === state.run.currentFloor);

    if (state.run.status === 'completed') {
      const finalRewards = currentFloorRewards.filter((reward) => reward.type === 'final');
      elements.teamChoiceModalTitle.textContent = 'Dungeon complete';
      elements.teamChoiceModalSubtitle.textContent = 'Choose one demon from your team for your collection, or exit without collecting.';
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
      const modalExitHuntBtn = document.getElementById('modalExitHuntBtn');
      if (modalExitHuntBtn) modalExitHuntBtn.addEventListener('click', () => finishRun('Dungeon complete.'));
      return;
    }

    const recruitRewards = currentFloorRewards.filter((reward) => reward.type === 'recruit');
    const needsSwap = (state.run.team || []).length >= 3;
    elements.teamChoiceModalTitle.textContent = 'Edit your team';
    elements.teamChoiceModalSubtitle.textContent = needsSwap
      ? 'Choose a defeated demon, tap one of your demons to preview the swap, then continue.'
      : 'Choose one defeated demon, then continue to the next floor.';
    elements.teamChoiceModalBody.innerHTML = `
      <div class="row g-4">
        <div class="col-12 col-xl-8">
          <h3 class="h6 text-muted">Defeated Demons</h3>
          <div class="row row-cols-1 row-cols-sm-2 row-cols-xxl-3 g-3">
            ${recruitRewards.map(renderRecruitReward).join('')}
          </div>
        </div>
        <div class="col-12 col-xl-4">
          <h3 class="h6 text-muted">Current Team</h3>
          ${renderTeamEditorCards()}
        </div>
      </div>
    `;
    elements.teamChoiceModalFooter.innerHTML = `
      <button type="button" class="btn btn-success" id="modalContinueBtn" ${canConfirmTeamChoice() ? '' : 'disabled'}>
        <i class="bi bi-arrow-right-circle"></i>
        ${getContinueButtonLabel()}
      </button>
    `;
    bindRewardButtons();
    const modalContinueBtn = document.getElementById('modalContinueBtn');
    if (modalContinueBtn) modalContinueBtn.addEventListener('click', confirmRecruitReward);
  }

  function renderRecruitReward(reward) {
    const selected = state.selectedRecruitRewardId === reward.rewardId;
    return `
      <div class="col">
        <div class="reward-item border rounded p-3 ${selected ? 'active' : ''}">
          ${renderRewardDemon(reward.demon)}
          <button class="btn ${selected ? 'btn-success' : 'btn-outline-success'} btn-sm w-100 mt-3 js-select-recruit" data-reward-id="${reward.rewardId}">
            ${getRecruitButtonLabel(reward)}
          </button>
        </div>
      </div>
    `;
  }

  function getRecruitButtonLabel(reward) {
    if (reward.recruited) return 'Recruited';
    if ((state.run.team || []).length >= 3) return state.selectedRecruitRewardId === reward.rewardId ? 'Selected' : 'Add to Team';
    if (state.selectedRecruitRewardId === reward.rewardId) return 'Selected';
    return 'Add to Team';
  }

  function canConfirmTeamChoice() {
    return true;
  }

  function getContinueButtonLabel() {
    if (!state.selectedRecruitRewardId) return 'Continue Without Changes';
    if ((state.run.team || []).length < 3) return 'Continue With Recruit';
    return state.selectedSwapInstanceId ? 'Continue With Swap' : 'Continue Without Changes';
  }

  function renderTeamEditorCards() {
    const team = state.run.team || [];
    const needsSwap = team.length >= 3;
    const previewReward = getSelectedRecruitReward();

    return `
      <div class="team-editor-list">
        ${needsSwap ? `
          <p class="text-muted small">${state.selectedRecruitRewardId ? 'Tap a teammate to preview the swap.' : 'Select a defeated demon first.'}</p>
        ` : '<p class="text-muted small">There is room for one more demon.</p>'}
        <div class="row row-cols-1 g-3">
          ${team.map((demon) => {
            const isSwapTarget = state.selectedSwapInstanceId === demon.instanceId;
            const displayDemon = isSwapTarget && previewReward ? previewReward.demon : demon;
            return `
            <div class="col">
              <button class="team-editor-card ${isSwapTarget ? 'active' : ''} ${needsSwap ? 'is-clickable swap-choice' : ''}" type="button" data-swap-id="${escapeHtml(demon.instanceId)}" ${needsSwap && state.selectedRecruitRewardId ? '' : 'disabled'}>
                <img src="${escapeHtml(displayDemon.imageUrl || displayDemon.image_url)}" alt="">
                <div class="team-editor-card-body">
                  <h4 class="h6 mb-1"><span class="ad-${escapeHtml(displayDemon.rarity)}">${escapeHtml(capitalize(displayDemon.rarity))}</span> ${escapeHtml(displayDemon.species || 'Demon')}</h4>
                  ${renderCombatStats(displayDemon)}
                  ${isSwapTarget ? `<p class="swap-note mb-0 mt-2">Replacing ${escapeHtml(demon.species || 'Demon')}</p>` : ''}
                </div>
              </button>
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function getSelectedRecruitReward() {
    if (!state.selectedRecruitRewardId) return null;
    return (state.run?.rewards || []).find((reward) => reward.rewardId === state.selectedRecruitRewardId) || null;
  }

  function renderFinalReward(reward) {
    return `
      <div class="col">
        <div class="reward-item border rounded p-3">
          ${renderRewardDemon(reward.demon)}
          <button class="btn btn-outline-info btn-sm w-100 mt-3 js-save" data-reward-id="${reward.rewardId}" ${reward.saved || hasSavedFinalReward() ? 'disabled' : ''}>
            ${reward.saved ? 'Saved' : 'Collect From Team'}
          </button>
        </div>
      </div>
    `;
  }

  function hasSavedFinalReward() {
    return (state.run?.rewards || []).some((reward) => reward.type === 'final' && reward.saved);
  }

  function renderRewardDemon(demon) {
    return `
      <div class="text-center">
        <img src="${escapeHtml(demon.imageUrl)}" alt="" class="reward-image mb-2">
        <h3 class="h6 mb-1">${escapeHtml(demon.species)}</h3>
        <p class="mb-0"><span class="ad-${escapeHtml(demon.rarity)}">${escapeHtml(capitalize(demon.rarity))}</span></p>
        ${renderCombatStats(demon)}
      </div>
    `;
  }

  function bindRewardButtons() {
    document.querySelectorAll('.js-select-recruit').forEach((button) => {
      button.addEventListener('click', () => selectRecruitReward(Number(button.dataset.rewardId)));
    });
    document.querySelectorAll('.js-save').forEach((button) => {
      button.addEventListener('click', () => saveReward(Number(button.dataset.rewardId)));
    });
    document.querySelectorAll('.js-open-choice-modal').forEach((button) => {
      button.addEventListener('click', openTeamChoiceModal);
    });
    document.querySelectorAll('.swap-choice').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedSwapInstanceId = button.dataset.swapId;
        renderTeamChoiceModal();
      });
    });
  }

  async function setDemonPosition(instanceId, position) {
    if (!state.run) return;

    const team = state.run.team || [];
    const target = team.find((demon) => demon.instanceId === instanceId);
    if (!target || target.position === position) return;

    target.position = position;
    renderRun();

    try {
      const result = await api(`/api/runs/${encodeURIComponent(state.run.runId)}/formation`, {
        method: 'POST',
        body: {
          formation: team.map((demon, index) => ({
            instanceId: demon.instanceId,
            position: getDemonPosition(demon, index)
          }))
        }
      });
      state.run.team = result.team || team;
      renderRun();
    } catch (error) {
      target.position = position === 'front' ? 'back' : 'front';
      renderRun();
      showError(error);
    }
  }

  function bindFormationDragAndDrop() {
    if (!state.run || state.run.awaitingRecruit || state.run.awaitingFinalPick) return;

    document.querySelectorAll('#teamGrid .hunt-demon-card[draggable="true"]').forEach((card) => {
      if (card.dataset.rewardId) return;

      card.addEventListener('dragstart', (event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'formation',
          instanceId: card.dataset.instanceId
        }));
        state.draggedFormationInstanceId = card.dataset.instanceId;
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => {
        state.draggedFormationInstanceId = null;
        card.classList.remove('is-dragging');
        document.querySelectorAll('.formation-lane-cards.is-drag-over').forEach((lane) => lane.classList.remove('is-drag-over'));
      });
    });

    document.querySelectorAll('#teamGrid .formation-lane-cards').forEach((lane) => {
      lane.addEventListener('dragover', (event) => {
        const payload = readDragPayload(event);
        if (payload?.type !== 'formation' && !state.draggedFormationInstanceId) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        lane.classList.add('is-drag-over');
      });
      lane.addEventListener('dragleave', () => lane.classList.remove('is-drag-over'));
      lane.addEventListener('drop', (event) => {
        const payload = readDragPayload(event);
        const instanceId = payload?.instanceId || state.draggedFormationInstanceId;
        lane.classList.remove('is-drag-over');
        if (!instanceId) return;

        event.preventDefault();
        setDemonPosition(instanceId, lane.dataset.formationDrop);
      });
    });
  }

  function bindRecruitDragAndDrop() {
    if (!state.run?.awaitingRecruit || !state.isRecruiting) return;
    ensureRecruitDraft();

    document.querySelectorAll('#enemyGrid .hunt-demon-card[data-instance-id]').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        const poolDemon = findDraftDemon(state.recruitDraftPool, card.dataset.instanceId);
        if (!poolDemon) return;

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'recruit-pool',
          instanceId: card.dataset.instanceId
        }));
        state.draggedRewardId = poolDemon.rewardId || null;
        state.draggedRecruitPoolInstanceId = card.dataset.instanceId;
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => {
        state.draggedRewardId = null;
        state.draggedRecruitPoolInstanceId = null;
        card.classList.remove('is-dragging');
        document.querySelectorAll('.hunt-demon-card.is-drag-over').forEach((target) => target.classList.remove('is-drag-over'));
      });
    });

    document.querySelectorAll('#teamGrid .hunt-demon-card[data-instance-id]').forEach((card) => {
      card.addEventListener('dragstart', (event) => {
        const teamDemon = findDraftDemon(state.recruitDraftTeam, card.dataset.instanceId);
        if (!teamDemon) return;

        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'recruit-team',
          instanceId: card.dataset.instanceId
        }));
        state.draggedFormationInstanceId = card.dataset.instanceId;
        card.classList.add('is-dragging');
      });
      card.addEventListener('dragend', () => {
        state.draggedFormationInstanceId = null;
        card.classList.remove('is-dragging');
        document.querySelectorAll('.hunt-demon-card.is-drag-over, .formation-lane-cards.is-drag-over').forEach((target) => target.classList.remove('is-drag-over'));
      });
      card.addEventListener('dragover', (event) => {
        const payload = readDragPayload(event);
        const poolInstanceId = payload?.instanceId || state.draggedRecruitPoolInstanceId;
        if ((payload?.type && payload.type !== 'recruit-pool') || !canSwapPoolDemonIntoTeam(poolInstanceId, card.dataset.instanceId)) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        card.classList.add('is-drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('is-drag-over'));
      card.addEventListener('drop', (event) => {
        const payload = readDragPayload(event);
        const poolInstanceId = payload?.instanceId || state.draggedRecruitPoolInstanceId;
        card.classList.remove('is-drag-over');
        if ((payload?.type && payload.type !== 'recruit-pool') || !canSwapPoolDemonIntoTeam(poolInstanceId, card.dataset.instanceId)) return;

        event.preventDefault();
        swapPoolDemonIntoTeam(poolInstanceId, card.dataset.instanceId);
        renderRun();
      });
    });

    document.querySelectorAll('#teamGrid .formation-lane-cards').forEach((lane) => {
      lane.addEventListener('dragover', (event) => {
        const payload = readDragPayload(event);
        const poolInstanceId = payload?.instanceId || state.draggedRecruitPoolInstanceId;
        const teamInstanceId = payload?.instanceId || state.draggedFormationInstanceId;
        const isPoolDrop = (payload?.type === 'recruit-pool' || (!payload?.type && poolInstanceId)) && findDraftDemon(state.recruitDraftPool, poolInstanceId);
        const isTeamMove = (payload?.type === 'recruit-team' || (!payload?.type && teamInstanceId)) && findDraftDemon(state.recruitDraftTeam, teamInstanceId);
        if (!isPoolDrop && !isTeamMove) return;

        if (isPoolDrop && !canAddPoolDemonToTeam(poolInstanceId)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        lane.classList.add('is-drag-over');
      });
      lane.addEventListener('dragleave', () => lane.classList.remove('is-drag-over'));
      lane.addEventListener('drop', (event) => {
        const payload = readDragPayload(event);
        const poolInstanceId = payload?.instanceId || state.draggedRecruitPoolInstanceId;
        const teamInstanceId = payload?.instanceId || state.draggedFormationInstanceId;
        lane.classList.remove('is-drag-over');
        if (!poolInstanceId && !teamInstanceId) return;

        if (payload?.type === 'recruit-team' || (!payload?.type && teamInstanceId)) {
          event.preventDefault();
          moveDraftTeamDemon(teamInstanceId, lane.dataset.formationDrop);
          renderRun();
          return;
        }

        if ((payload?.type === 'recruit-pool' || (!payload?.type && poolInstanceId)) && canAddPoolDemonToTeam(poolInstanceId)) {
          event.preventDefault();
          addPoolDemonToTeam(poolInstanceId, lane.dataset.formationDrop);
          renderRun();
        }
      });
    });

    document.querySelectorAll('#enemyGrid .formation-lane-cards').forEach((lane) => {
      lane.addEventListener('dragover', (event) => {
        const payload = readDragPayload(event);
        const teamInstanceId = payload?.instanceId || state.draggedFormationInstanceId;
        if ((payload?.type && payload.type !== 'recruit-team') || !canReturnTeamDemonToPool(teamInstanceId)) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        lane.classList.add('is-drag-over');
      });
      lane.addEventListener('dragleave', () => lane.classList.remove('is-drag-over'));
      lane.addEventListener('drop', (event) => {
        const payload = readDragPayload(event);
        const teamInstanceId = payload?.instanceId || state.draggedFormationInstanceId;
        lane.classList.remove('is-drag-over');
        if ((payload?.type && payload.type !== 'recruit-team') || !canReturnTeamDemonToPool(teamInstanceId)) return;

        event.preventDefault();
        returnTeamDemonToPool(teamInstanceId, lane.dataset.formationDrop);
        renderRun();
      });
    });
  }

  function findDraftDemon(collection, instanceId) {
    if (!instanceId) return null;
    return (collection || []).find((demon) => demon.instanceId === instanceId) || null;
  }

  function teamHasDraftRecruit(exceptInstanceId = null) {
    return (state.recruitDraftTeam || []).some((demon) => (
      demon.recruitSource === 'reward' &&
      demon.instanceId !== exceptInstanceId
    ));
  }

  function canAddPoolDemonToTeam(poolInstanceId) {
    const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
    if (!poolDemon || poolDemon.recruitSource !== 'reward') return false;
    return (state.recruitDraftTeam || []).length < getRecruitTeamLimit();
  }

  function canSwapPoolDemonIntoTeam(poolInstanceId, teamInstanceId) {
    const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
    const teamDemon = findDraftDemon(state.recruitDraftTeam, teamInstanceId);
    if (!poolDemon || !teamDemon) return false;
    return true;
  }

  function addPoolDemonToTeam(poolInstanceId, position) {
    const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
    if (!poolDemon) return;

    state.recruitDraftTeam.push({
      ...poolDemon,
      position
    });
    syncRecruitDraftSelection();
  }

  function swapPoolDemonIntoTeam(poolInstanceId, teamInstanceId) {
    const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
    const teamDemon = removeDraftDemon(state.recruitDraftTeam, teamInstanceId);
    if (!poolDemon || !teamDemon) {
      if (poolDemon) state.recruitDraftPool.push(poolDemon);
      if (teamDemon) state.recruitDraftTeam.push(teamDemon);
      return;
    }

    const targetPosition = getDemonPosition(teamDemon);
    state.recruitDraftTeam.push({
      ...poolDemon,
      position: targetPosition
    });
    state.recruitDraftPool.push({
      ...teamDemon,
      position: getDemonPosition(poolDemon)
    });
    sortRecruitDraftTeam();
    syncRecruitDraftSelection();
  }

  function moveDraftTeamDemon(instanceId, position) {
    const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
    if (!demon) return;
    demon.position = position;
    syncRecruitDraftSelection();
  }

  function canReturnTeamDemonToPool(instanceId) {
    const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
    return Boolean(demon?.recruitSource === 'reward' && (state.recruitDraftTeam || []).length > (state.run?.team || []).length);
  }

  function returnTeamDemonToPool(instanceId, position) {
    const demon = removeDraftDemon(state.recruitDraftTeam, instanceId);
    if (!demon) return;

    state.recruitDraftPool.push({
      ...demon,
      position
    });
    syncRecruitDraftSelection();
  }

  function removeDraftDemon(collection, instanceId) {
    const index = (collection || []).findIndex((demon) => demon.instanceId === instanceId);
    if (index === -1) return null;
    return collection.splice(index, 1)[0];
  }

  function sortRecruitDraftTeam() {
    const originalOrder = new Map((state.run?.team || []).map((demon, index) => [demon.instanceId, index]));
    state.recruitDraftTeam.sort((a, b) => {
      const aOrder = originalOrder.has(a.originalInstanceId) ? originalOrder.get(a.originalInstanceId) : 99;
      const bOrder = originalOrder.has(b.originalInstanceId) ? originalOrder.get(b.originalInstanceId) : 99;
      return aOrder - bOrder;
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

  function renderDemonCards(demons, options = {}) {
    if (!demons.length && !options.allowRecruitDrag) return renderEmptyText('No demons.');
    const normalizedDemons = demons.map((demon, index) => ({
      ...demon,
      position: getDemonPosition(demon, index)
    }));

    return `
      <div class="battle-formation">
        ${getFormationOrder(options).map((position) => renderFormationLane(position, normalizedDemons, options)).join('')}
      </div>
    `;
  }

  function getFormationOrder(options) {
    return options.side === 'enemy' ? ['front', 'back'] : ['back', 'front'];
  }

  function getPositionLabel(position) {
    return position === 'front' ? 'Melee row' : 'Ranged row';
  }

  function renderFormationLane(position, demons, options) {
    const laneDemons = demons.filter((demon, index) => getDemonPosition(demon, index) === position);
    const label = getPositionLabel(position);

    return `
      <div class="formation-lane formation-lane-${position}" data-formation-position="${position}">
        <div class="formation-lane-cards" data-formation-drop="${position}">
          ${laneDemons.length ? laneDemons.map((demon) => renderDemonCard(demon, options)).join('') : renderEmptyFormationLane(position, label)}
        </div>
      </div>
    `;
  }

  function renderEmptyFormationLane(position, label) {
    return `
      <div class="formation-empty formation-empty-${position}">
        ${renderFormationLaneIcon(position)}
        <span>Empty ${escapeHtml(label)}</span>
      </div>
    `;
  }

  function renderFormationLaneIcon(position) {
    if (position === 'front') {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 512 512" class="formation-lane-icon mb-1" role="img" aria-hidden="true" focusable="false">
          <defs></defs>
          <path class="fa-secondary" d="M19.1 .3C13.9-.7 8.5 .9 4.7 4.7S-.7 13.9 .3 19.1L14.4 89.6c1.9 9.3 6.4 17.8 13.1 24.5L329.4 416 416 329.4 114.2 27.5c-6.7-6.7-15.2-11.3-24.5-13.1L19.1 .3zM146.7 278.6L96 329.4 182.6 416l50.7-50.7-86.6-86.6zm218.5-45.3L484.5 114.2c6.7-6.7 11.3-15.2 13.1-24.5l14.1-70.5c1-5.2-.6-10.7-4.4-14.5s-9.2-5.4-14.5-4.4L422.4 14.4c-9.3 1.9-17.8 6.4-24.5 13.1L278.6 146.7l86.6 86.6z"></path>
          <path class="fa-primary fa-secondary" d="M75.3 308.7c-6.2-6.2-16.4-6.2-22.6 0l-16 16c-4.7 4.7-6 11.8-3.3 17.8l27.5 62L4.7 460.7c-6.2 6.2-6.2 16.4 0 22.6l24 24c6.2 6.2 16.4 6.2 22.6 0l56.2-56.2 62 27.5c6 2.7 13.1 1.4 17.8-3.3l16-16c6.2-6.2 6.2-16.4 0-22.6l-128-128zm361.4 0l-128 128c-6.2 6.2-6.2 16.4 0 22.6l16 16c4.7 4.7 11.8 6 17.8 3.3l62-27.5 56.2 56.2c6.2 6.2 16.4 6.2 22.6 0l24-24c6.2-6.2 6.2-16.4 0-22.6l-56.2-56.2 27.5-62c2.7-6.1 1.4-13.1-3.3-17.8l-16-16c-6.2-6.2-16.4-6.2-22.6 0z"></path>
        </svg>
      `;
    }

    return `
      <svg class="formation-lane-icon formation-lane-icon-stroke" viewBox="0 0 48 48" role="img" aria-hidden="true" focusable="false">
        <path d="M15 6c12 6 12 30 0 36" />
        <path d="M15 6c-5 11-5 25 0 36" />
        <path d="M15 6v36" />
        <path d="M15 24h24" />
        <path d="M33 18l6 6-6 6" />
        <path d="M23 20l-4 4 4 4" />
      </svg>
    `;
  }

  function renderButtonMeleeIcon() {
    return renderFormationLaneIcon('front').replace('formation-lane-icon mb-1', 'button-melee-icon');
  }

  function renderDemonCard(demon, options) {
    const position = getDemonPosition(demon);
    const isPlayer = options.side !== 'enemy';
    const isRecruitPoolDemon = Boolean(options.allowRecruitDrag && demon.recruitSource);
    const canDropRecruit = Boolean(state.isRecruiting && isPlayer);
    const canDragFormation = Boolean((options.allowFormationDrag || state.isRecruiting) && isPlayer);
    const draggable = isRecruitPoolDemon || canDragFormation;
    const classes = [
      'hunt-demon-card',
      Number(demon.hp) <= 0 ? 'is-defeated' : '',
      isRecruitPoolDemon ? 'is-recruit-draggable' : '',
      canDropRecruit ? 'is-recruit-drop-target' : '',
      state.selectedSwapInstanceId === demon.instanceId || state.selectedRecruitRewardId === demon.rewardId ? 'active' : ''
    ].filter(Boolean).join(' ');
    const rarityColor = getRarityColor(demon.rarity);

    return `
      <div class="${classes}" style="--rarity-color: ${rarityColor}" data-instance-id="${escapeHtml(demon.instanceId)}" ${demon.rewardId ? `data-reward-id="${escapeHtml(demon.rewardId)}"` : ''} ${demon.recruitSource ? `data-recruit-source="${escapeHtml(demon.recruitSource)}"` : ''} ${draggable ? 'draggable="true"' : ''}>
        <div class="hunt-demon-card-image" aria-label="${escapeHtml(capitalize(demon.rarity || 'common'))} rarity">
          <img src="${escapeHtml(demon.imageUrl || demon.image_url)}" alt="" draggable="false">
          <span class="hunt-demon-rarity-gem" aria-hidden="true"></span>
        </div>
        <div class="hunt-demon-card-body">
          <div class="hunt-demon-card-title">
            <span class="text-white">${escapeHtml(demon.species || 'Demon')}</span>
          </div>
          ${renderCombatStats(demon)}
        </div>
      </div>
    `;
  }

  function getDemonPosition(demon, index = 0) {
    return demon.position === 'back' || (!demon.position && index > 0) ? 'back' : 'front';
  }

  function renderCombatStats(demon) {
    const currentHp = Math.max(0, Number(demon.hp) || 0);
    const maxHp = Math.max(currentHp, Number(demon.maxHp) || currentHp || 1);
    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));

    return `
      <div class="combat-stat-strip" aria-label="Combat stats">
        <span>${renderAttackIcon()}${demon.atk}</span>
        <span>${renderSpeedIcon()}${demon.speed}</span>
      </div>
      <div class="combat-hp-bar" aria-label="HP ${currentHp} of ${maxHp}">
        <div class="combat-hp-fill js-demon-hp-fill" data-max-hp="${maxHp}" style="width: ${hpPercent}%"></div>
      </div>
      <div class="combat-hp-meta"><span class="js-demon-hp">${currentHp}</span> / ${maxHp}<i class="bi bi-droplet-fill"></i></div>
    `;
  }

  function getRarityColor(rarity) {
    const colors = {
      common: '#D1D5D8',
      uncommon: '#41A85F',
      rare: '#2C82C9',
      epic: '#9365B8',
      legendary: '#FAC51C',
      mythic: '#E25041'
    };
    return colors[rarity] || colors.common;
  }

  function renderAttackIcon() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 512 512" class="combat-stat-icon" aria-hidden="true" focusable="false">
        <defs></defs>
        <path class="fa-secondary" d="M19.1 .3C13.9-.7 8.5 .9 4.7 4.7S-.7 13.9 .3 19.1L14.4 89.6c1.9 9.3 6.4 17.8 13.1 24.5L329.4 416 416 329.4 114.2 27.5c-6.7-6.7-15.2-11.3-24.5-13.1L19.1 .3zM146.7 278.6L96 329.4 182.6 416l50.7-50.7-86.6-86.6zm218.5-45.3L484.5 114.2c6.7-6.7 11.3-15.2 13.1-24.5l14.1-70.5c1-5.2-.6-10.7-4.4-14.5s-9.2-5.4-14.5-4.4L422.4 14.4c-9.3 1.9-17.8 6.4-24.5 13.1L278.6 146.7l86.6 86.6z"></path>
        <path class="fa-primary fa-secondary" d="M75.3 308.7c-6.2-6.2-16.4-6.2-22.6 0l-16 16c-4.7 4.7-6 11.8-3.3 17.8l27.5 62L4.7 460.7c-6.2 6.2-6.2 16.4 0 22.6l24 24c6.2 6.2 16.4 6.2 22.6 0l56.2-56.2 62 27.5c6 2.7 13.1 1.4 17.8-3.3l16-16c6.2-6.2 6.2-16.4 0-22.6l-128-128zm361.4 0l-128 128c-6.2 6.2-6.2 16.4 0 22.6l16 16c4.7 4.7 11.8 6 17.8 3.3l62-27.5 56.2 56.2c6.2 6.2 16.4 6.2 22.6 0l24-24c6.2-6.2 6.2-16.4 0-22.6l-56.2-56.2 27.5-62c2.7-6.1 1.4-13.1-3.3-17.8l-16-16c-6.2-6.2-16.4-6.2-22.6 0z"></path>
      </svg>
    `;
  }

  function renderSpeedIcon() {
    return `
      <svg class="combat-stat-icon combat-stat-icon-stroke" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
      </svg>
    `;
  }

  function renderEmptyText(text) {
    return `<p class="text-muted mb-0">${escapeHtml(text)}</p>`;
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
    button.disabled = true;
    try {
      await task();
    } finally {
      syncActionButtons(button);
    }
  }

  function getModal(element, options) {
    return bootstrap.Modal.getOrCreateInstance(element, options);
  }

  function syncActionButtons(fallbackButton) {
    const hasActiveRun = Boolean(state.run && state.run.status === 'active');
    const waitingForChoice = Boolean(state.run && (state.run.awaitingRecruit || state.run.awaitingFinalPick));

    if (elements.battleBtn) elements.battleBtn.disabled = !hasActiveRun || waitingForChoice;
    if (elements.confirmStarterBtn) elements.confirmStarterBtn.disabled = !state.selectedStarter;
    if (fallbackButton && ![elements.confirmStarterBtn, elements.battleBtn].includes(fallbackButton)) {
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
