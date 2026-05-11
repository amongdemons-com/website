(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const RUN_KEY = 'amongdemons-current-run';
  const session = window.AmongDemons.getSession();
  const state = {
    player: session.player || null,
    run: null,
    combatLog: []
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
      'rewardList',
      'fightLog'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });

    elements.startRunBtn = document.getElementById('startRunBtn');
    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.battleBtn = document.getElementById('battleBtn');
    elements.endRunBtn = document.getElementById('endRunBtn');
    elements.logoutBtn = document.getElementById('logoutBtn');
  }

  function bindActions() {
    elements.logoutBtn.addEventListener('click', () => {
      window.AmongDemons.clearSession();
      window.location.href = '/login';
    });

    elements.refreshBtn.addEventListener('click', refreshAll);
    elements.startRunBtn.addEventListener('click', startRun);
    elements.battleBtn.addEventListener('click', battle);
    elements.endRunBtn.addEventListener('click', endRun);
  }

  async function refreshAll() {
    await withBusy(elements.refreshBtn, async () => {
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
          renderRun();
        }
      } catch (error) {
        handleAuthError(error);
      }
    });
  }

  async function startRun() {
    await withBusy(elements.startRunBtn, async () => {
      try {
        const payload = await api('/api/runs/start', { method: 'POST' });
        state.combatLog = [];
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
    } catch (error) {
      localStorage.removeItem(RUN_KEY);
      state.run = null;
      renderRun();
      throw error;
    }
  }

  async function battle() {
    if (!state.run) return;

    await withBusy(elements.battleBtn, async () => {
      try {
        const result = await api(`/api/runs/${encodeURIComponent(state.run.runId)}/battle`, { method: 'POST' });
        state.combatLog = result.combatLog || [];
        renderFightLog();
        await playCombatLog(result);
        finalizeBattle(result);
        setMessage(result.winner === 'player' ? 'Battle won.' : 'Your team was defeated.', result.winner === 'player' ? 'success' : 'warning');
      } catch (error) {
        showError(error);
      }
    });
  }

  async function claimReward(rewardId) {
    await runRewardAction(rewardId, 'reward', 'Reward claimed.');
  }

  async function recruitReward(rewardId) {
    await runRewardAction(rewardId, 'recruit', 'Demon recruited.');
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
      await refreshAll();
      setMessage('Demon added to your collection.', 'success');
    } catch (error) {
      showError(error);
    }
  }

  async function runRewardAction(rewardId, action, successMessage) {
    if (!state.run) return;

    try {
      await api(`/api/runs/${encodeURIComponent(state.run.runId)}/${action}`, {
        method: 'POST',
        body: { rewardId }
      });
      await loadRun(state.run.runId);
      setMessage(successMessage, 'success');
    } catch (error) {
      showError(error);
    }
  }

  async function endRun() {
    if (!state.run) return;

    await withBusy(elements.endRunBtn, async () => {
      try {
        const result = await api(`/api/runs/${encodeURIComponent(state.run.runId)}/end`, { method: 'POST' });
        localStorage.removeItem(RUN_KEY);
        state.combatLog = [];
        state.run = null;
        renderRun();
        setMessage(`Hunt ended. You earned ${result.xp} XP and ${result.souls} souls.`, 'success');
      } catch (error) {
        showError(error);
      }
    });
  }

  function renderPlayer() {
    const player = state.player || {};

    elements.navPlayerName.textContent = player.username || '';
  }

  function renderRun() {
    const run = state.run;
    const hasRun = Boolean(run);
    const hasActiveRun = Boolean(run && run.status === 'active');

    elements.runEmpty.classList.toggle('d-none', hasRun);
    elements.runPanel.classList.toggle('d-none', !hasRun);
    elements.huntTitle.textContent = run ? `Hunt: Floor ${run.currentFloor}` : 'Hunt';
    elements.startRunBtn.disabled = hasActiveRun;
    elements.battleBtn.disabled = !hasActiveRun;
    elements.endRunBtn.disabled = !run;

    if (!run) {
      elements.rewardList.innerHTML = renderEmptyText('No rewards yet.');
      return;
    }

    elements.teamGrid.innerHTML = renderDemonCards(run.team || []);
    elements.enemyGrid.innerHTML = renderDemonCards((run.team || []).length ? run.enemies || [] : []);
    elements.rewardList.innerHTML = renderRewards(run.rewards || []);
    bindRewardButtons();
    renderFightLog();
  }

  async function playCombatLog(result) {
    if (!state.run) return;

    const allDemonsById = new Map([...(state.run.team || []), ...(state.run.enemies || [])].map((demon) => [demon.instanceId, demon]));

    for (let index = 0; index < state.combatLog.length; index += 1) {
      const entry = state.combatLog[index];
      const target = allDemonsById.get(entry.target);

      if (target) {
        target.hp = entry.targetHp;
      }

      updateTeamHp();
      setActiveLogRow(index);
      updateTargetCard(entry.target, entry.targetHp);
      await sleep(260);
    }

    setActiveLogRow(-1);
  }

  function finalizeBattle(result) {
    if (!state.run) return;

    updateTeamHp();

    if (result.winner === 'enemy') {
      state.run.status = 'defeated';
      localStorage.removeItem(RUN_KEY);
      return;
    }

    if (result.rewards && result.rewards.rewardId) {
      state.run.rewards = [...(state.run.rewards || []), result.rewards];
    }

    renderRun();
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
    if (hpElement) {
      hpElement.textContent = hp;
    }

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
    if (!state.combatLog.length) {
      elements.fightLog.textContent = 'Battle actions will appear here.';
      elements.fightLog.classList.add('text-muted');
      return;
    }

    elements.fightLog.classList.remove('text-muted');
    elements.fightLog.innerHTML = state.combatLog.map((entry, index) => `
      <div class="fight-log-row ${getLogRowClass(entry)}" data-log-index="${index}">
        <span class="text-secondary">T${entry.tick}</span>
        <span class="fight-log-side">${getLogSideLabel(entry)}</span>
        <span class="fight-log-action">${renderFightLogDemonName(entry.attacker)} hit ${renderFightLogDemonName(entry.target)}</span>
        <span class="text-danger">${entry.dmg} dmg</span>
        <span class="text-secondary">${entry.targetHp} HP</span>
      </div>
    `).join('');
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
    return 'unknown';
  }

  function renderFightLogDemonName(instanceId) {
    const demon = [...(state.run?.team || []), ...(state.run?.enemies || [])]
      .find((item) => item.instanceId === instanceId);

    if (!demon) return escapeHtml(instanceId);
    return `<span class="ad-${escapeHtml(demon.rarity)}">${escapeHtml(demon.species || 'Demon')}</span>`;
  }

  function renderRewards(rewards) {
    if (!rewards.length) return renderEmptyText('Win a battle to reveal rewards.');

    return rewards.map((reward) => `
      <div class="reward-item border rounded p-3">
        <div class="d-flex gap-3">
          ${reward.demon ? `<img src="${escapeHtml(reward.demon.imageUrl)}" alt="" class="reward-image">` : ''}
          <div class="flex-grow-1">
            <h3 class="h6 mb-1">${reward.demon ? escapeHtml(reward.demon.species) : 'Reward'}</h3>
            <p class="mb-2 text-muted">${reward.xp || 0} XP &middot; ${reward.souls || 0} souls</p>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-outline-light btn-sm js-claim" data-reward-id="${reward.rewardId}" ${reward.claimed ? 'disabled' : ''}>Claim</button>
              <button class="btn btn-outline-success btn-sm js-recruit" data-reward-id="${reward.rewardId}" ${reward.recruited ? 'disabled' : ''}>Recruit</button>
              <button class="btn btn-outline-info btn-sm js-save" data-reward-id="${reward.rewardId}" ${reward.saved ? 'disabled' : ''}>Save</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  function bindRewardButtons() {
    document.querySelectorAll('.js-claim').forEach((button) => {
      button.addEventListener('click', () => claimReward(Number(button.dataset.rewardId)));
    });
    document.querySelectorAll('.js-recruit').forEach((button) => {
      button.addEventListener('click', () => recruitReward(Number(button.dataset.rewardId)));
    });
    document.querySelectorAll('.js-save').forEach((button) => {
      button.addEventListener('click', () => saveReward(Number(button.dataset.rewardId)));
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
    return `<p class="text-muted mb-0">${text}</p>`;
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

    if (!state.combatLog.length) {
      elements.fightLog.classList.remove('text-muted');
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

  function syncActionButtons(fallbackButton) {
    const hasActiveRun = Boolean(state.run && state.run.status === 'active');
    const hasRun = Boolean(state.run);

    if (elements.startRunBtn) elements.startRunBtn.disabled = hasActiveRun;
    if (elements.battleBtn) elements.battleBtn.disabled = !hasActiveRun;
    if (elements.endRunBtn) elements.endRunBtn.disabled = !hasRun;
    if (elements.refreshBtn) elements.refreshBtn.disabled = false;
    if (fallbackButton && ![elements.startRunBtn, elements.battleBtn, elements.endRunBtn, elements.refreshBtn].includes(fallbackButton)) {
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
