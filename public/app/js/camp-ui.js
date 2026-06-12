(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => escapeHtml(value));
  const updateNavAccount = window.AmongDemons.ui.updateNavAccount || (() => {});
  const session = window.AmongDemons.getSession();
  const state = {
    player: session.player || null,
    progression: null,
    run: null
  };
  const CAMPFIRE_FRAMES = [
    '/app/images/assets/animation/campfire/1.png',
    '/app/images/assets/animation/campfire/2.png',
    '/app/images/assets/animation/campfire/3.png',
    '/app/images/assets/animation/campfire/4.png'
  ];
  const DUNGEON_FRAMES = [
    '/app/images/assets/animation/dungeon/1.png',
    '/app/images/assets/animation/dungeon/2.png',
    '/app/images/assets/animation/dungeon/3.png',
    '/app/images/assets/animation/dungeon/4.png'
  ];
  const CAMPFIRE_FRAME_INTERVAL_MS = 180;
  const DUNGEON_FRAME_INTERVAL_MS = 180;
  const ACCOUNT_LEVEL_BASE_XP = 250;
  const ACCOUNT_LEVEL_EXPONENT = 1.65;
  const elements = {};

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      window.location.href = '/login';
      return;
    }

    cacheElements();
    startInteractiveAnimations();
    await loadCamp();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'campPlayerName',
      'campfireFrame',
      'dungeonFrame',
      'welcomeText',
      'appMessage',
      'levelStat',
      'xpStat',
      'xpProgressBar',
      'floorStat',
      'soulsStat',
      'runActionLabel',
      'runStatus',
      'runFloor',
      'runSummary',
      'runTeam',
      'runTeamLabel',
      'runEnemy',
      'runEnemyLabel',
      'runEarned',
      'runEarnedLabel',
      'objectiveList'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  async function loadCamp() {
    try {
      const [me, progression, run] = await Promise.all([
        api('/api/auth/me'),
        api('/api/account/progression'),
        loadCurrentRun()
      ]);

      state.player = me.player;
      state.progression = progression;
      state.run = run;

      renderPlayer();
      renderRun();
      renderObjectives();
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function loadCurrentRun() {
    try {
      return await api('/api/runs/current');
    } catch (error) {
      if (error.status === 404) return null;
      throw error;
    }
  }

  function renderPlayer() {
    const player = state.player || {};
    const progression = state.progression || {};
    const souls = progression.souls ?? player.souls ?? '-';

    elements.navPlayerName.textContent = player.username || '';
    elements.campPlayerName.textContent = player.username || 'Camp';
    elements.welcomeText.textContent = player.username
      ? 'Rest, review your spoils, then choose how deep to go.'
      : 'Rest, then choose how deep to go.';
    renderLevelProgress(progression, player);
    elements.floorStat.textContent = formatNumber(progression.highestFloor ?? player.highestFloor ?? 0);
    updateNavAccount(player, { souls });
    elements.soulsStat.innerHTML = renderSoulAmount(formatNumber(souls), {
      showLabel: false,
      className: 'stat-soul-amount',
      ariaLabel: `${formatNumber(souls)} Souls`
    });
  }

  function startInteractiveAnimations() {
    setupInteractiveFrameLoop({
      frame: elements.campfireFrame,
      target: elements.campfireFrame?.closest('.camp-hero-fire'),
      frames: CAMPFIRE_FRAMES,
      intervalMs: CAMPFIRE_FRAME_INTERVAL_MS
    });
    setupInteractiveFrameLoop({
      frame: elements.dungeonFrame,
      target: elements.dungeonFrame?.closest('.play-run-dungeon'),
      frames: DUNGEON_FRAMES,
      intervalMs: DUNGEON_FRAME_INTERVAL_MS
    });
  }

  function setupInteractiveFrameLoop({ frame, target, frames, intervalMs }) {
    if (!frame || !target || frames.length < 2 || prefersReducedMotion()) return;

    frames.slice(1).forEach((src) => {
      const image = new Image();
      image.src = src;
    });

    let frameIndex = 0;
    let intervalId = null;
    let hoverActive = false;
    let tapActive = false;

    function advanceFrame() {
      if (document.hidden) return;
      frameIndex = (frameIndex + 1) % frames.length;
      frame.src = frames[frameIndex];
    }

    function play() {
      if (intervalId) return;
      advanceFrame();
      intervalId = window.setInterval(advanceFrame, CAMPFIRE_FRAME_INTERVAL_MS);
    }

    function pause() {
      if (!intervalId) return;
      window.clearInterval(intervalId);
      intervalId = null;
    }

    target.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'touch') return;
      hoverActive = true;
      play();
    });

    target.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'touch') return;
      hoverActive = false;
      tapActive = false;
      pause();
    });

    target.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'mouse') return;
      tapActive = !tapActive;
      if (tapActive) {
        play();
        return;
      }

      pause();
    });

    document.addEventListener('pointerup', (event) => {
      if (target.contains(event.target)) return;
      hoverActive = false;
      tapActive = false;
      pause();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function renderLevelProgress(progression, player) {
    const level = Number(progression.level ?? player.level ?? 1) || 1;
    const xp = Number(progression.xp ?? player.xp ?? 0) || 0;
    const progress = getLevelProgress(progression, level, xp);
    const percent = Math.round(progress.percent * 100);

    elements.levelStat.textContent = formatNumber(level);
    elements.xpStat.textContent = progress.xpToNextLevel > 0
      ? `${formatNumber(progress.xpToNextLevel)} XP to level ${formatNumber(level + 1)}`
      : `${formatNumber(xp)} total XP`;

    if (elements.xpProgressBar) {
      elements.xpProgressBar.style.width = `${percent}%`;
      const progressTrack = elements.xpProgressBar.parentElement;
      if (progressTrack) {
        progressTrack.setAttribute('aria-label', `${percent}% progress to level ${formatNumber(level + 1)}`);
      }
    }
  }

  function getLevelProgress(progression, level, xp) {
    const serverProgress = progression.levelProgress || {};
    const currentLevelXp = toFiniteNumber(serverProgress.currentLevelXp, getXpForAccountLevel(level));
    const nextLevelXp = toFiniteNumber(serverProgress.nextLevelXp, getXpForAccountLevel(level + 1));
    const xpForNextLevel = Math.max(1, toFiniteNumber(serverProgress.xpForNextLevel, nextLevelXp - currentLevelXp));
    const xpIntoLevel = clamp(toFiniteNumber(serverProgress.xpIntoLevel, xp - currentLevelXp), 0, xpForNextLevel);
    const xpToNextLevel = Math.max(0, toFiniteNumber(serverProgress.xpToNextLevel, nextLevelXp - xp));
    const percent = clamp(toFiniteNumber(serverProgress.percent, xpIntoLevel / xpForNextLevel), 0, 1);

    return {
      percent,
      xpToNextLevel
    };
  }

  function getXpForAccountLevel(level) {
    const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
    if (targetLevel <= 1) return 0;

    return Math.ceil(ACCOUNT_LEVEL_BASE_XP * Math.pow(targetLevel - 1, ACCOUNT_LEVEL_EXPONENT));
  }

  function toFiniteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function renderRun() {
    const run = state.run;
    const currentFloor = Number(run?.currentFloor ?? 0);

    if (!run) {
      elements.runActionLabel.textContent = 'Start Dungeon';
      elements.runStatus.textContent = 'Ready';
      elements.runStatus.className = 'play-status-chip is-ready';
      elements.runFloor.textContent = '0';
      elements.runSummary.textContent = 'No active run. Draft a team and start climbing.';
      elements.runTeam.textContent = '-';
      elements.runTeamLabel.textContent = 'Team';
      elements.runEnemy.textContent = '-';
      elements.runEnemyLabel.textContent = 'Enemies';
      elements.runEarned.textContent = '0';
      elements.runEarnedLabel.textContent = 'Extract Now';
      return;
    }

    const isDefeated = run.status === 'defeated';
    const isRecruiting = Boolean(run.awaitingRecruit);
    const teamCount = getTeamCount(run);
    const teamLimit = getTeamLimit(run);
    const enemyCount = getEnemyCount(run);
    const payout = getExtractPayout(run);

    elements.runActionLabel.textContent = isDefeated ? 'Resolve Run' : 'Continue Run';
    elements.runStatus.textContent = isDefeated ? 'Defeated' : (isRecruiting ? 'Recruit' : 'Active');
    elements.runStatus.className = `play-status-chip ${isDefeated ? 'is-danger' : (isRecruiting ? 'is-choice' : 'is-active')}`;
    elements.runFloor.textContent = formatNumber(currentFloor);
    elements.runSummary.textContent = getRunSummary(run);
    elements.runTeam.textContent = Number.isFinite(teamLimit)
      ? `${formatNumber(teamCount)}/${formatNumber(teamLimit)}`
      : formatNumber(teamCount);
    elements.runTeamLabel.textContent = Number.isFinite(teamLimit) ? 'Team Slots' : 'Team';
    elements.runEnemy.textContent = formatNumber(enemyCount);
    elements.runEnemyLabel.textContent = isRecruiting ? 'Next Enemies' : 'Enemies';
    elements.runEarned.textContent = `${formatNumber(payout.xp)} XP / ${formatNumber(payout.souls)} Souls`;
    elements.runEarnedLabel.textContent = isRecruiting && !isDefeated ? 'Extract Now' : 'Banked';
  }

  function renderObjectives() {
    const run = state.run;
    const progression = state.progression || {};
    const payout = run ? getExtractPayout(run) : { xp: 0, souls: 0 };
    const bestFloor = Number(progression.highestFloor) || 0;
    const currentFloor = Number(run?.currentFloor ?? 0);
    const objectives = [
      run
        ? {
            icon: run.awaitingRecruit ? 'user-plus' : 'swords',
            title: run.awaitingRecruit ? 'Choose the next recruit' : 'Clear the next fight',
            meta: run.awaitingRecruit
              ? 'Recruit, skip, or extract before pushing deeper.'
              : `Next target: floor ${formatNumber(currentFloor + 1)}.`
          }
        : {
            icon: 'play',
            title: 'Start a dungeon run',
            meta: 'Draft starters, set formation, and enter floor 1.'
          },
      {
        icon: 'flag',
        title: 'Set a floor record',
        meta: bestFloor > 0 ? `Current best: floor ${formatNumber(bestFloor)}.` : 'Your first clear sets the record.'
      },
      {
        icon: 'coins',
        title: run && (payout.xp || payout.souls) ? 'Extract current rewards' : 'Bank rewards between fights',
        meta: run && (payout.xp || payout.souls)
          ? `${formatNumber(payout.xp)} XP and ${formatNumber(payout.souls)} Souls can be claimed now.`
          : 'Win fights, then extract before defeat.'
      }
    ];

    elements.objectiveList.innerHTML = objectives.map(renderObjective).join('');
  }

  function renderObjective(objective) {
    return `
      <a class="play-objective" href="/dungeon">
        <span class="play-objective-icon">${renderIcon(objective.icon)}</span>
        <span>
          <strong>${escapeHtml(objective.title)}</strong>
          <small>${escapeHtml(objective.meta)}</small>
        </span>
      </a>
    `;
  }

  function getRunSummary(run) {
    if (run.status === 'defeated') return 'The run is defeated. Resolve it in the dungeon.';
    if (run.awaitingRecruit) return 'Victory pause. Choose a recruit, skip, or extract rewards.';
    if ((run.enemies || []).length) return 'Formation locked. Finish the active battle.';
    return 'Run is open. Continue from the dungeon table.';
  }

  function getTeamCount(run) {
    return (run?.team || []).length;
  }

  function getTeamLimit(run) {
    if (!run || run.status !== 'active') return null;
    const floor = Number(run.currentFloor) || 0;
    return Math.min(6, Math.max(2, floor + 2));
  }

  function getEnemyCount(run) {
    if (!run) return 0;
    if (run.awaitingRecruit && (run.nextEnemies || []).length) {
      return run.nextEnemies.length;
    }

    const enemies = run.enemies || [];
    if (!enemies.length) return 0;

    const livingEnemies = enemies.filter((enemy) => Number(enemy.hp) > 0);
    return livingEnemies.length || enemies.length;
  }

  function getExtractPayout(run) {
    const earned = run?.earned || { xp: 0, souls: 0 };
    if (run?.status === 'defeated') return { xp: 0, souls: 0 };

    return {
      xp: Number(earned.xp) || 0,
      souls: (Number(earned.souls) || 0) + getPendingDiscardedSoulValue(run)
    };
  }

  function getPendingDiscardedSoulValue(run) {
    const excludedRewardIds = getKeptOrExtractedRewardIds(run);

    return (run?.rewards || []).reduce((total, reward) => {
      if (!isPendingDiscardSoulReward(run, reward, excludedRewardIds)) return total;
      return total + getRewardSoulValue(reward);
    }, 0);
  }

  function getKeptOrExtractedRewardIds(run) {
    const rewardIds = new Set();
    const choice = run?.extractChoice;

    if (choice?.source === 'reward' && choice.rewardId) {
      rewardIds.add(Number(choice.rewardId));
    }

    return rewardIds;
  }

  function isPendingDiscardSoulReward(run, reward, excludedRewardIds = new Set()) {
    if (!reward || reward.type !== 'recruit') return false;
    if (Number(reward.floor) !== Number(run?.currentFloor)) return false;
    if (Number(reward.floor) <= 0) return false;
    if (excludedRewardIds.has(Number(reward.rewardId))) return false;
    if (!(reward.soulPending === true || (Number(reward.souls) > 0 && !reward.soulAwarded))) return false;
    return !(
      reward.claimed ||
      reward.recruited ||
      reward.saved ||
      reward.extracted ||
      reward.discarded ||
      reward.soulAwarded
    );
  }

  function getRewardSoulValue(reward) {
    const souls = Number(reward?.souls);
    return Number.isFinite(souls) && souls > 0 ? souls : 1;
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

  function renderIcon(name) {
    const icon = window.AmongDemons?.ui?.renderIcon;
    return typeof icon === 'function' ? icon(name, { size: 17 }) : '';
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'string' && value.trim() === '-') return '-';

    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString() : String(value);
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
