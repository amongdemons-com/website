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
  const ACCOUNT_LEVEL_BASE_XP = 250;
  const ACCOUNT_LEVEL_EXPONENT = 1.65;
  const elements = {};

  onReady(init);

  async function init() {
    if (!window.AmongDemons.getToken()) {
      window.location.href = window.AmongDemons.appUrl('/login');
      return;
    }

    cacheElements();
    bindDisabledLinks();
    await loadCamp();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'navPlayerLevel',
      'campPlayerName',
      'playerHudName',
      'playerTitle',
      'playerSubtitle',
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
      'objectiveList',
      'primaryDungeonMeta',
      'dungeonActionEyebrow'
    ].forEach((id) => {
      elements[id] = document.getElementById(id);
    });
  }

  function bindDisabledLinks() {
    document.querySelectorAll('[data-disabled-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
      });
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
    const username = player.username || 'Camp';
    const souls = progression.souls ?? player.souls ?? '-';
    const level = Number(progression.level ?? player.level ?? 1) || 1;
    const bestFloor = Number(progression.highestFloor ?? player.highestFloor ?? 0) || 0;

    setText(elements.navPlayerName, player.username || '');
    setText(elements.navPlayerLevel, `Level ${formatNumber(level)}`);
    setText(elements.campPlayerName, username);
    setText(elements.playerHudName, username);
    setText(elements.welcomeText, player.username
      ? 'Rest, plan, and push deeper.'
      : 'Rest, plan, and push deeper.');
    setText(elements.playerTitle, getPlayerTitle(level, bestFloor));

    renderLevelProgress(progression, player);
    setText(elements.floorStat, formatNumber(bestFloor));
    updateNavAccount(player, { souls });
    setHtml(elements.soulsStat, renderSoulAmount(formatNumber(souls), {
      showLabel: false,
      className: 'stat-soul-amount',
      ariaLabel: `${formatNumber(souls)} Souls`
    }));
  }

  function getPlayerTitle(level, bestFloor) {
    if (bestFloor >= 30) return 'Deepgate Warden';
    if (level >= 20) return 'Abyss Marshal';
    if (bestFloor >= 12) return 'Gatebreaker';
    if (level >= 8) return 'Demonbound Hunter';
    return 'Ashen Hunter';
  }

  function renderLevelProgress(progression, player) {
    const level = Number(progression.level ?? player.level ?? 1) || 1;
    const xp = Number(progression.xp ?? player.xp ?? 0) || 0;
    const progress = getLevelProgress(progression, level, xp);
    const percent = Math.round(progress.percent * 100);

    setText(elements.levelStat, formatNumber(level));
    setText(elements.xpStat, progress.xpToNextLevel > 0
      ? `${formatNumber(progress.xpToNextLevel)} XP to level ${formatNumber(level + 1)}`
      : `${formatNumber(xp)} total XP`);

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
      setText(elements.runActionLabel, 'Dungeon');
      setText(elements.dungeonActionEyebrow, 'Enter');
      setText(elements.primaryDungeonMeta, 'Descend into the depths and face the unknown.');
      setText(elements.playerSubtitle, 'No active run. Camp reserves are standing by.');
      setText(elements.runStatus, 'Ready');
      setClassName(elements.runStatus, 'play-status-chip is-ready');
      setText(elements.runFloor, '0');
      setText(elements.runSummary, 'No active run. Draft a team and start climbing.');
      setText(elements.runTeam, '-');
      setText(elements.runTeamLabel, 'Team');
      setText(elements.runEnemy, '-');
      setText(elements.runEnemyLabel, 'Enemies');
      setText(elements.runEarned, '0 Souls');
      setText(elements.runEarnedLabel, 'Extract');
      return;
    }

    const isDefeated = run.status === 'defeated';
    const isRecruiting = Boolean(run.awaitingRecruit);
    const teamCount = getTeamCount(run);
    const teamLimit = getTeamLimit(run);
    const enemyCount = getEnemyCount(run);
    const payout = getExtractPayout(run);
    const runSummary = getRunSummary(run);

    setText(elements.runActionLabel, isDefeated ? 'Resolve Run' : 'Dungeon');
    setText(elements.dungeonActionEyebrow, isDefeated ? 'Run Defeated' : (isRecruiting ? 'Victory Pause' : 'Enter'));
    setText(elements.primaryDungeonMeta, runSummary);
    setText(elements.playerSubtitle, isDefeated
      ? 'The last breach collapsed. Resolve it before the next climb.'
      : `Current run holding at floor ${formatNumber(currentFloor)}.`);
    setText(elements.runStatus, isDefeated ? 'Defeated' : (isRecruiting ? 'Recruit' : 'Active'));
    setClassName(elements.runStatus, `play-status-chip ${isDefeated ? 'is-danger' : (isRecruiting ? 'is-choice' : 'is-active')}`);
    setText(elements.runFloor, formatNumber(currentFloor));
    setText(elements.runSummary, runSummary);
    setText(elements.runTeam, Number.isFinite(teamLimit)
      ? `${formatNumber(teamCount)}/${formatNumber(teamLimit)}`
      : formatNumber(teamCount));
    setText(elements.runTeamLabel, Number.isFinite(teamLimit) ? 'Team Slots' : 'Team');
    setText(elements.runEnemy, formatNumber(enemyCount));
    setText(elements.runEnemyLabel, isRecruiting ? 'Next Enemies' : 'Enemies');
    setText(elements.runEarned, `${formatNumber(payout.xp)} XP / ${formatNumber(payout.souls)} Souls`);
    setText(elements.runEarnedLabel, isRecruiting && !isDefeated ? 'Extract Now' : 'Banked');
  }

  function renderObjectives() {
    const run = state.run;
    const progression = state.progression || {};
    const payout = run ? getExtractPayout(run) : { xp: 0, souls: 0 };
    const bestFloor = Number(progression.highestFloor) || 0;
    const currentFloor = Number(run?.currentFloor ?? 0);
    const reachedFloor = Math.max(bestFloor, currentFloor);
    const fightProgress = clamp(currentFloor || 0, 0, 3);
    const extractProgress = payout.souls > 0 ? 1 : 0;
    const floorTarget = Math.max(10, reachedFloor + 1);
    const objectives = [
      {
        icon: 'swords',
        title: 'Win 3 dungeon fights',
        meta: run?.awaitingRecruit ? 'Victory pause active.' : 'Clear battles before extracting.',
        current: fightProgress,
        target: 3,
        unit: 'plain',
        reward: { type: 'souls', value: 15 },
        href: '/dungeon'
      },
      {
        icon: 'skull',
        title: 'Extract 2 demons',
        meta: payout.souls > 0 ? 'A cache is ready at extraction.' : 'Win fights to reveal extraction value.',
        current: extractProgress,
        target: 2,
        unit: 'plain',
        reward: { type: 'xp', value: 20 },
        href: '/dungeon'
      },
      {
        icon: 'flag',
        title: `Reach floor ${formatNumber(floorTarget)}`,
        meta: bestFloor > 0 ? `Best clear: floor ${formatNumber(bestFloor)}.` : 'Your first clear sets the record.',
        current: reachedFloor,
        target: floorTarget,
        unit: 'plain',
        reward: { type: 'souls', value: 25 },
        href: '/dungeon'
      }
    ];

    setHtml(elements.objectiveList, objectives.map(renderObjective).join(''));
  }

  function renderObjective(objective) {
    const target = Math.max(1, Number(objective.target) || 1);
    const current = clamp(Number(objective.current) || 0, 0, target);
    const percent = Math.round((current / target) * 100);

    return `
      <a class="play-objective" href="${escapeAttribute(objective.href || '/dungeon')}">
        <span class="play-objective-icon">${renderIcon(objective.icon)}</span>
        <span class="play-objective-body">
          <strong>${escapeHtml(objective.title)}</strong>
          <small>${escapeHtml(objective.meta)}</small>
          <span class="quest-progress" aria-hidden="true">
            <span style="width: ${percent}%"></span>
          </span>
          <span class="quest-progress-meta">
            <span>${escapeHtml(formatQuestValue(current, objective.unit))} / ${escapeHtml(formatQuestValue(target, objective.unit))}</span>
          </span>
        </span>
        <span class="quest-reward">
          <small>Reward</small>
          <strong>${renderQuestReward(objective.reward)}</strong>
        </span>
      </a>
    `;
  }

  function formatQuestValue(value, unit) {
    const formatted = formatNumber(value);
    if (unit === 'floor') return `F${formatted}`;
    if (unit === 'souls') return `${formatted} Souls`;
    return formatted;
  }

  function renderQuestReward(reward = {}) {
    if (reward.type === 'souls') {
      return `${renderIcon('soul')} ${escapeHtml(formatNumber(reward.value))}`;
    }

    if (reward.type === 'xp') {
      return `<span class="quest-xp-mark">XP</span> ${escapeHtml(formatNumber(reward.value))}`;
    }

    return escapeHtml(reward.value || '-');
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

  function handleAuthError(error) {
    if (error.status === 401) {
      window.AmongDemons.clearSession();
      window.location.href = window.AmongDemons.appUrl('/login');
      return;
    }

    showError(error);
  }

  function showError(error) {
    setMessage(error.message || 'Something went wrong.', 'danger');
  }

  function setMessage(text, type) {
    if (!elements.appMessage) return;
    elements.appMessage.textContent = text;
    elements.appMessage.className = text ? `alert alert-${type}` : 'alert d-none';
  }

  function renderIcon(name) {
    const icon = window.AmongDemons?.ui?.renderIcon;
    return typeof icon === 'function' ? icon(name, { size: 17 }) : '';
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function setHtml(element, value) {
    if (element) element.innerHTML = value;
  }

  function setClassName(element, value) {
    if (element) element.className = value;
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

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
