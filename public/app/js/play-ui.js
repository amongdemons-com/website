(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const RUN_KEY = 'amongdemons-current-run';
  const session = window.AmongDemons.getSession();
  const state = {
    player: session.player || null,
    progression: null,
    run: null,
    collection: []
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
      'welcomeText',
      'appMessage',
      'levelStat',
      'xpStat',
      'soulsStat',
      'runStatus',
      'runEmpty',
      'runPanel',
      'floorStat',
      'hpStat',
      'teamGrid',
      'enemyGrid',
      'rewardList',
      'collectionGrid',
      'adminCheckResult'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });

    elements.startRunBtn = document.getElementById('startRunBtn');
    elements.refreshBtn = document.getElementById('refreshBtn');
    elements.battleBtn = document.getElementById('battleBtn');
    elements.endRunBtn = document.getElementById('endRunBtn');
    elements.logoutBtn = document.getElementById('logoutBtn');
    elements.adminCheckBtn = document.getElementById('adminCheckBtn');
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
    elements.adminCheckBtn.addEventListener('click', adminCheck);
  }

  async function refreshAll() {
    await withBusy(elements.refreshBtn, async () => {
      try {
        const [me, progression, demons] = await Promise.all([
          api('/api/auth/me'),
          api('/api/account/progression'),
          api('/api/demons')
        ]);

        state.player = me.player;
        state.progression = progression;
        state.collection = demons.demons || [];

        renderPlayer();
        renderCollection();

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
        await loadRun(state.run.runId);
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
      await refreshAll();
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
        await refreshAll();
        localStorage.removeItem(RUN_KEY);
        state.run = null;
        renderRun();
        setMessage(`Hunt ended. You earned ${result.xp} XP and ${result.souls} souls.`, 'success');
      } catch (error) {
        showError(error);
      }
    });
  }

  async function adminCheck() {
    await withBusy(elements.adminCheckBtn, async () => {
      try {
        await api('/api/admin/demon-balance', { method: 'POST', body: {} });
        elements.adminCheckResult.textContent = 'Balance editor is available.';
      } catch (error) {
        elements.adminCheckResult.textContent = error.message;
      }
    });
  }

  function renderPlayer() {
    const player = state.player || {};
    const progression = state.progression || {};

    elements.navPlayerName.textContent = player.username || '';
    elements.welcomeText.textContent = player.username ? `Welcome, ${player.username}.` : 'Welcome.';
    elements.levelStat.textContent = progression.level ?? player.level ?? '-';
    elements.xpStat.textContent = progression.xp ?? player.xp ?? '-';
    elements.soulsStat.textContent = progression.souls ?? player.souls ?? '-';
  }

  function renderRun() {
    const run = state.run;
    const hasRun = Boolean(run && run.status === 'active');

    elements.runEmpty.classList.toggle('d-none', hasRun);
    elements.runPanel.classList.toggle('d-none', !hasRun);
    elements.runStatus.textContent = run ? capitalize(run.status) : 'No hunt';
    elements.runStatus.className = `badge ${hasRun ? 'text-bg-success' : 'text-bg-secondary'}`;
    elements.startRunBtn.disabled = hasRun;

    if (!run) {
      elements.rewardList.innerHTML = renderEmptyText('No rewards yet.');
      return;
    }

    elements.floorStat.textContent = run.currentFloor;
    elements.hpStat.textContent = run.hp;
    elements.teamGrid.innerHTML = renderDemonCards(run.team || []);
    elements.enemyGrid.innerHTML = renderDemonCards((run.team || []).length ? getEnemiesFromRun(run) : []);
    elements.rewardList.innerHTML = renderRewards(run.rewards || []);
    bindRewardButtons();
  }

  function getEnemiesFromRun(run) {
    return run.mapProgress && run.status === 'active' ? run.enemies || [] : [];
  }

  function renderRewards(rewards) {
    if (!rewards.length) return renderEmptyText('Win a battle to reveal rewards.');

    return rewards.map((reward) => `
      <div class="reward-item border rounded p-3">
        <div class="d-flex gap-3">
          ${reward.demon ? `<img src="${escapeHtml(reward.demon.imageUrl)}" alt="" class="reward-image">` : ''}
          <div class="flex-grow-1">
            <h3 class="h6 mb-1">${reward.demon ? escapeHtml(reward.demon.species) : 'Reward'}</h3>
            <p class="mb-2 text-muted">${reward.xp || 0} XP · ${reward.souls || 0} souls</p>
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

  function renderCollection() {
    elements.collectionGrid.innerHTML = state.collection.length
      ? renderDemonCards(state.collection)
      : renderEmptyText('Saved demons will appear here.');
  }

  function renderDemonCards(demons) {
    if (!demons.length) return renderEmptyText('No demons.');

    return demons.map((demon) => `
      <div class="col">
        <div class="card h-100 demon-mini-card">
          <img src="${escapeHtml(demon.imageUrl || demon.image_url)}" class="card-img-top" alt="">
          <div class="card-body">
            <h3 class="h6 card-title mb-1 ad-${escapeHtml(demon.rarity)}">${escapeHtml(demon.species || 'Demon')}</h3>
            <p class="mb-0 text-muted">${capitalize(demon.rarity)} · HP ${demon.hp} · ATK ${demon.atk} · SPD ${demon.speed}</p>
          </div>
        </div>
      </div>
    `).join('');
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
    elements.appMessage.textContent = text;
    elements.appMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  async function withBusy(button, task) {
    button.disabled = true;
    try {
      await task();
    } finally {
      button.disabled = false;
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
