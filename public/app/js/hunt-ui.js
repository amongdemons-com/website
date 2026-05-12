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
      'fightLog',
      'fightLogActions',
      'starterModal',
      'starterModalBody',
      'teamChoiceModal',
      'teamChoiceModalTitle',
      'teamChoiceModalSubtitle',
      'teamChoiceModalBody',
      'teamChoiceModalFooter'
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
    elements.battleBtn.addEventListener('click', battle);
  }

  async function refreshAll() {
    try {
      const me = await api('/api/auth/me');
      state.player = me.player;
      renderPlayer();

      const savedRunId = localStorage.getItem(RUN_KEY);
      if (state.run && state.run.runId) {
        await loadRun(state.run.runId);
      } else if (savedRunId) {
        await loadRun(savedRunId);
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
          setMessage('Choose one demon to begin the hunt.', 'warning');
          return;
        }

        if (!state.selectedStarter) {
          setMessage('Choose one demon to begin the hunt.', 'warning');
          return;
        }

        const payload = await api('/api/runs/start', {
          method: 'POST',
          body: state.selectedStarter
        });
        state.combatLog = [];
        state.endNotice = null;
        state.selectedStarter = null;
        state.startOptions = null;
        getModal(elements.starterModal).hide();
        localStorage.setItem(RUN_KEY, payload.runId);
        await loadRun(payload.runId);
        setMessage('Hunt started.', 'success');
      } catch (error) {
        showError(error);
      }
    });
  }

  async function loadRun(runId) {
    try {
      state.run = await api(`/api/runs/${encodeURIComponent(runId)}`);
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
        const result = await api(`/api/runs/${encodeURIComponent(state.run.runId)}/battle`, { method: 'POST' });
        state.combatDemons = createCombatDemonMap();
        state.combatLog = result.combatLog || [];
        elements.fightLog.innerHTML = '';
        elements.fightLog.classList.remove('text-muted');
        await playCombatLog(result);
        if (result.winner === 'enemy') {
          state.run.status = 'defeated';
          await finishRun('Your team was defeated.');
        } else {
          await loadRun(state.run.runId);
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

  async function confirmRecruitReward() {
    if (!state.run) return;

    const body = state.selectedRecruitRewardId
      ? { rewardId: state.selectedRecruitRewardId }
      : { skipRecruit: true };
    if ((state.run.team || []).length >= 3) {
      if (state.selectedRecruitRewardId && !state.selectedSwapInstanceId) {
        body.skipRecruit = true;
        delete body.rewardId;
      } else if (state.selectedSwapInstanceId) {
        body.replaceInstanceId = state.selectedSwapInstanceId;
      }
    }

    try {
      await api(`/api/runs/${encodeURIComponent(state.run.runId)}/recruit`, {
        method: 'POST',
        body
      });
      state.selectedRecruitRewardId = null;
      state.selectedSwapInstanceId = null;
      state.combatLog = [];
      state.combatDemons = new Map();
      state.endNotice = null;
      getModal(elements.teamChoiceModal).hide();
      await loadRun(state.run.runId);
      setMessage(body.skipRecruit ? 'Continuing to the next floor.' : 'Demon joined the hunt.', 'success');
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
      await finishRun('Hunt complete. Final demon added to your collection.');
    } catch (error) {
      showError(error);
    }
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
      state.endNotice = {
        text: `${message || 'Hunt ended.'} You earned ${result.xp} XP and ${result.souls} souls.`,
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
    elements.huntTitle.textContent = run ? `Hunt: Floor ${run.currentFloor} / 10` : 'Hunt';

    if (!run) {
      elements.runEmpty.innerHTML = `
        <img src="/app/images/demons/thumbnails/1.png" alt="">
        <p class="mb-0 text-muted">Choose your first demon to begin.</p>
      `;
      renderFightLog();
      renderFightLogActions();
      syncActionButtons();
      return;
    }

    elements.teamGrid.innerHTML = renderDemonCards(run.team || []);
    elements.enemyGrid.innerHTML = renderDemonCards((run.team || []).length ? run.enemies || [] : []);
    renderFightLog();
    renderFightLogActions();
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

    elements.starterModalBody.innerHTML = `
      <div class="starter-picker w-100">
        <h3 class="h6 text-muted">Hunt Starters</h3>
        <div class="row row-cols-1 row-cols-sm-3 g-3 mb-4">
          ${draft.map((demon, index) => renderChoiceCard(demon, {
            type: 'draft',
            value: index,
            selected: state.selectedStarter?.source === 'draft' && state.selectedStarter?.draftIndex === index
          })).join('')}
        </div>
        <h3 class="h6 text-muted">Collection</h3>
        <div class="row row-cols-1 row-cols-sm-2 row-cols-xl-3 g-3">
          ${collection.length ? collection.map((demon) => renderChoiceCard(demon, {
            type: 'collection',
            value: demon.id,
            selected: state.selectedStarter?.source === 'collection' && state.selectedStarter?.demonId === demon.id
          })).join('') : '<div class="col"><p class="text-muted mb-0">No saved demons yet.</p></div>'}
        </div>
      </div>
    `;
    elements.confirmStarterBtn.disabled = !state.selectedStarter;
    bindStarterButtons();
  }

  function renderChoiceCard(demon, options) {
    return `
      <div class="col">
        <button class="hunt-choice-card ${options.selected ? 'active' : ''}" type="button" data-choice-type="${options.type}" data-choice-value="${options.value}">
          <img src="${escapeHtml(demon.imageUrl || demon.image_url)}" alt="">
          <span class="hunt-choice-name"><span class="ad-${escapeHtml(demon.rarity)}">${escapeHtml(capitalize(demon.rarity))}</span> ${escapeHtml(demon.species || 'Demon')}</span>
          <span class="combat-stat-strip">
            <span><i class="bi bi-crosshair"></i>${demon.atk}</span>
            <span><i class="bi bi-shield-fill"></i>${demon.speed}</span>
            <span>${demon.maxHp || demon.hp}<i class="bi bi-droplet-fill"></i></span>
          </span>
        </button>
      </div>
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

    for (let index = 0; index < state.combatLog.length; index += 1) {
      const entry = state.combatLog[index];
      const target = allDemonsById.get(entry.target);

      if (target) {
        target.hp = entry.targetHp;
      }

      appendFightLogRow(entry, index);
      updateTeamHp();
      setActiveLogRow(index);
      updateTargetCard(entry.target, entry.targetHp);
      scrollFightLogToBottom();
      await sleep(260);
    }

    setActiveLogRow(-1);
  }

  function updateTeamHp() {
    if (!state.run) return;
    state.run.hp = (state.run.team || []).reduce((sum, demon) => sum + Math.max(0, Number(demon.hp) || 0), 0);
  }

  function setActiveLogRow(index) {
    document.querySelectorAll('.fight-log-row').forEach((row) => {
      row.classList.toggle('active', Number(row.dataset.logIndex) === index);
    });
  }

  function updateTargetCard(instanceId, hp) {
    const card = Array.from(document.querySelectorAll('.hunt-demon-card'))
      .find((item) => item.dataset.instanceId === instanceId);

    if (!card) return;

    const hpElement = card.querySelector('.js-demon-hp');
    if (hpElement) hpElement.textContent = hp;

    const hpFillElement = card.querySelector('.js-demon-hp-fill');
    if (hpFillElement) {
      const maxHp = Number(hpFillElement.dataset.maxHp) || Number(hp) || 1;
      const hpPercent = Math.max(0, Math.min(100, Math.round((Number(hp) / maxHp) * 100)));
      hpFillElement.style.width = `${hpPercent}%`;
    }

    card.classList.remove('is-hit');
    void card.offsetWidth;
    card.classList.add('is-hit');
    card.classList.toggle('is-defeated', Number(hp) <= 0);
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function renderFightLog() {
    if (!state.combatLog.length && !state.endNotice) {
      elements.fightLog.textContent = 'Battle actions will appear here.';
      elements.fightLog.classList.add('text-muted');
      return;
    }

    elements.fightLog.classList.remove('text-muted');
    elements.fightLog.innerHTML = state.combatLog.map((entry, index) => `
      ${renderFightLogRow(entry, index)}
    `).join('') + renderEndNotice();
  }

  function appendFightLogRow(entry, index) {
    elements.fightLog.insertAdjacentHTML('beforeend', renderFightLogRow(entry, index));
  }

  function renderFightLogRow(entry, index) {
    return `
      <div class="fight-log-row ${getLogRowClass(entry)}" data-log-index="${index}">
        <span class="text-secondary">T${entry.tick}</span>
        <span class="fight-log-side">${getLogSideLabel(entry)}</span>
        <span class="fight-log-action">${renderFightLogDemonName(entry.attacker)} hit ${renderFightLogDemonName(entry.target)}</span>
        <span class="text-danger">${entry.dmg} dmg</span>
        <span class="text-secondary">${entry.targetHp} HP</span>
      </div>
    `;
  }

  function renderEndNotice() {
    if (!state.endNotice) return '';

    const className = state.endNotice.type === 'warning'
      ? 'fight-log-notice fight-log-end-notice text-warning'
      : 'fight-log-notice fight-log-end-notice text-success';

    return `<div class="${className}">${escapeHtml(state.endNotice.text)}</div>`;
  }

  function renderFightLogActions() {
    const canStart = !state.run || ['defeated', 'ended'].includes(state.run.status);

    elements.fightLogActions.innerHTML = canStart ? `
      <button class="btn btn-primary w-100 mt-3" id="fightLogStartBtn" type="button">
        <i class="bi bi-play-fill"></i>
        Start Hunt
      </button>
    ` : '';

    const startButton = document.getElementById('fightLogStartBtn');
    if (startButton) startButton.addEventListener('click', openStarterModal);
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
          <h3 class="h6 mb-2">Hunt complete</h3>
          <p class="text-muted">${hasSavedFinalReward() ? 'Final demon saved to your collection.' : 'Choose one of your team demons, or exit without collecting.'}</p>
          <button class="btn btn-outline-info btn-sm js-open-choice-modal" type="button" ${hasSavedFinalReward() ? 'disabled' : ''}>
            <i class="bi bi-stars"></i>
            Finish Hunt
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
    return renderEmptyText(`Clear the floor to recruit a defeated demon. Hunt earnings: ${earned.xp || 0} XP, ${earned.souls || 0} souls.`);
  }

  function showPendingChoiceModal() {
    if (!state.run || !(state.run.awaitingRecruit || state.run.awaitingFinalPick || state.run.status === 'completed')) return;
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
      elements.teamChoiceModalTitle.textContent = 'Hunt complete';
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
      if (modalExitHuntBtn) modalExitHuntBtn.addEventListener('click', () => finishRun('Hunt complete.'));
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

  function renderDemonCards(demons) {
    if (!demons.length) return renderEmptyText('No demons.');

    return demons.map((demon) => `
      <div class="col">
        <div class="card h-100 demon-mini-card hunt-demon-card ${Number(demon.hp) <= 0 ? 'is-defeated' : ''}" data-instance-id="${escapeHtml(demon.instanceId)}">
          <img src="${escapeHtml(demon.imageUrl || demon.image_url)}" class="card-img-top" alt="">
          <div class="card-body">
            <h3 class="h6 card-title mb-1"><span class="ad-${escapeHtml(demon.rarity)}">${escapeHtml(capitalize(demon.rarity))}</span> <span class="text-white">${escapeHtml(demon.species || 'Demon')}</span></h3>
            ${renderCombatStats(demon)}
          </div>
        </div>
      </div>
    `).join('');
  }

  function renderCombatStats(demon) {
    const currentHp = Math.max(0, Number(demon.hp) || 0);
    const maxHp = Math.max(currentHp, Number(demon.maxHp) || currentHp || 1);
    const hpPercent = Math.max(0, Math.min(100, Math.round((currentHp / maxHp) * 100)));

    return `
      <div class="combat-stat-strip" aria-label="Combat stats">
        <span><i class="bi bi-crosshair"></i>${demon.atk}</span>
        <span><i class="bi bi-shield-fill"></i>${demon.speed}</span>
        <span><span class="js-demon-hp">${currentHp}</span> / ${maxHp}<i class="bi bi-droplet-fill"></i></span>
      </div>
      <div class="combat-hp-bar" aria-label="HP ${currentHp} of ${maxHp}">
        <div class="combat-hp-fill js-demon-hp-fill" data-max-hp="${maxHp}" style="width: ${hpPercent}%"></div>
      </div>
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
