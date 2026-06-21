(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => escapeHtml(value));
  const updateNavAccount = window.AmongDemons.ui.updateNavAccount || (() => {});
  const session = window.AmongDemons.getSession();
  const DEFAULT_PROFILE_IMAGE_URL = '/app/images/demons/thumbnails/1.png';
  const state = {
    player: session.player || null,
    progression: null,
    run: null,
    questData: null,
    collection: [],
    collectionLoaded: false,
    profilePickerOpen: false,
    questClaimPending: false,
    dailyRewardPending: false
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
    bindProfilePicker();
    bindQuestControls();
    await loadCamp();
  }

  function cacheElements() {
    [
      'navPlayerName',
      'navPlayerLevel',
      'navProfileImage',
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
      'runTeam',
      'runTeamLabel',
      'runEnemy',
      'runEnemyLabel',
      'runEarned',
      'runEarnedLabel',
      'objectiveList',
      'questResetChip',
      'dailyRewardTitle',
      'dailyRewardValue',
      'dailyRewardStatus',
      'dailyRewardButton',
      'primaryDungeonMeta',
      'dungeonActionEyebrow',
      'profileDemonButton',
      'profileDemonImage',
      'profileDemonPicker',
      'profileDemonPickerClose',
      'profileDemonPickerStatus',
      'profileDemonGrid'
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

  function bindProfilePicker() {
    if (elements.profileDemonButton?.dataset.profilePickerBound === 'true') return;

    elements.profileDemonButton?.addEventListener('click', openProfilePicker);
    elements.profileDemonButton?.setAttribute('data-profile-picker-bound', 'true');

    elements.profileDemonGrid?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target.parentElement;
      const button = target?.closest('[data-profile-demon-id]');
      if (!button) return;
      selectProfileDemon(button.dataset.profileDemonId, button);
    });

    document.querySelectorAll('[data-profile-picker-close]').forEach((button) => {
      button.addEventListener('click', closeProfilePicker);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.profilePickerOpen) {
        closeProfilePicker();
      }
    });
  }

  function bindQuestControls() {
    elements.objectiveList?.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : event.target?.parentElement;
      const button = target?.closest('[data-quest-claim]');
      if (!button) return;
      claimQuestReward(button.dataset.questClaim, button);
    });

    elements.dailyRewardButton?.addEventListener('click', () => {
      claimCampfireCache(elements.dailyRewardButton);
    });
  }

  function openProfilePicker() {
    if (!elements.profileDemonPicker) return;

    state.profilePickerOpen = true;
    renderProfilePicker();
    elements.profileDemonPicker.hidden = false;
    document.body.classList.add('is-profile-demon-picker-open');
    window.requestAnimationFrame(() => {
      elements.profileDemonPicker.classList.add('is-open');
      elements.profileDemonPickerClose?.focus();
    });
  }

  function closeProfilePicker() {
    if (!elements.profileDemonPicker) return;

    state.profilePickerOpen = false;
    elements.profileDemonPicker.classList.remove('is-open');
    document.body.classList.remove('is-profile-demon-picker-open');
    elements.profileDemonPicker.hidden = true;
    elements.profileDemonButton?.focus();
  }

  function renderProfilePicker() {
    const demons = state.collection || [];
    const selectedId = Number(state.player?.profileDemonId) || 0;

    if (!elements.profileDemonGrid) return;

    if (!state.collectionLoaded) {
      setText(elements.profileDemonPickerStatus, 'Loading collection demons...');
      setHtml(elements.profileDemonGrid, `
        <div class="profile-demon-empty">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="" width="88" height="88" loading="lazy">
          <span>Loading collection</span>
        </div>
      `);
      return;
    }

    if (!demons.length) {
      setText(elements.profileDemonPickerStatus, 'Collect a demon in the dungeon before choosing a camp portrait.');
      setHtml(elements.profileDemonGrid, `
        <div class="profile-demon-empty">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="" width="88" height="88" loading="lazy">
          <span>No collection demons yet</span>
        </div>
      `);
      return;
    }

    setText(elements.profileDemonPickerStatus, 'Pick one collected demon for your camp portrait.');
    setHtml(elements.profileDemonGrid, demons.map((demon) => renderProfileDemonOption(demon, selectedId)).join(''));
    replaceStaticIcons();
  }

  function renderProfileDemonOption(demon, selectedId) {
    const id = Number(demon.id);
    const isSelected = id === selectedId;
    const name = demon.species || 'Demon';
    const rarity = capitalize(demon.rarity || 'common');
    const imageUrl = getDemonImageUrl(demon);

    return `
      <button class="profile-demon-option ${isSelected ? 'is-selected' : ''}" type="button" data-profile-demon-id="${escapeAttribute(id)}" aria-pressed="${isSelected ? 'true' : 'false'}">
        <span class="profile-demon-option-art">
          <img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(`${rarity} ${name}`)}" width="96" height="96" loading="lazy" decoding="async">
        </span>
        <span class="profile-demon-option-copy">
          <strong>${escapeHtml(name)}</strong>
          <small>${escapeHtml(rarity)}</small>
        </span>
        ${isSelected ? `<span class="profile-demon-selected-mark">${renderIcon('check')}</span>` : ''}
      </button>
    `;
  }

  async function selectProfileDemon(profileDemonId, button) {
    const demonId = Number(profileDemonId);
    if (!Number.isInteger(demonId) || demonId <= 0) return;
    if (Number(state.player?.profileDemonId) === demonId) {
      closeProfilePicker();
      return;
    }

    setProfilePickerBusy(button, true);

    try {
      const payload = await api('/api/account/profile', {
        method: 'PATCH',
        body: { profileDemonId: demonId }
      });
      state.player = payload.player;
      syncSessionPlayer(payload.player);
      syncProfileImages(payload.profileDemon || getCollectionDemon(demonId));
      renderProfilePicker();
      closeProfilePicker();
    } catch (error) {
      showError(error);
    } finally {
      setProfilePickerBusy(button, false);
    }
  }

  function setProfilePickerBusy(button, busy) {
    if (!button) return;
    button.disabled = busy;
    button.classList.toggle('is-busy', busy);
  }

  async function loadCamp() {
    try {
      const [me, progression, run, collection, questData] = await Promise.all([
        api('/api/auth/me'),
        api('/api/account/progression'),
        loadCurrentRun(),
        loadCollection(),
        api('/api/account/quests')
      ]);

      state.player = me.player;
      state.progression = progression;
      state.run = run;
      state.questData = questData;
      state.collection = collection.demons || [];
      state.collectionLoaded = true;

      renderPlayer();
      renderRun();
      renderObjectives();
      renderDailyReward();
      if (state.profilePickerOpen) renderProfilePicker();
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function loadCollection() {
    return api('/api/demons');
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
    setText(elements.playerTitle, 'Demon Hunter');

    renderLevelProgress(progression, player);
    setText(elements.floorStat, formatNumber(bestFloor));
    updateNavAccount(player, { souls });
    syncProfileImages(getSelectedProfileDemon());
    setHtml(elements.soulsStat, renderSoulAmount(formatNumber(souls), {
      showLabel: false,
      className: 'stat-soul-amount',
      ariaLabel: `${formatNumber(souls)} Souls`
    }));
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
    setText(elements.dungeonActionEyebrow, isDefeated ? 'Run Defeated' : (isRecruiting ? 'Continue' : 'Enter'));
    setText(elements.primaryDungeonMeta, runSummary);
    setText(elements.playerSubtitle, isDefeated
      ? 'The last breach collapsed. Resolve it before the next climb.'
      : `Current run holding at floor ${formatNumber(currentFloor)}.`);
    setText(elements.runStatus, isDefeated ? 'Defeated' : (isRecruiting ? 'Recruit' : 'Active'));
    setClassName(elements.runStatus, `play-status-chip ${isDefeated ? 'is-danger' : (isRecruiting ? 'is-choice' : 'is-active')}`);
    setText(elements.runFloor, formatNumber(currentFloor));
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
    const objectives = state.questData?.quests || [];
    setHtml(elements.objectiveList, objectives.map(renderObjective).join(''));
  }

  function renderObjective(objective) {
    const target = Math.max(1, Number(objective.target) || 1);
    const current = clamp(Number(objective.current) || 0, 0, target);
    const percent = Math.round((current / target) * 100);

    const tag = objective.claimable ? 'button' : (objective.claimed ? 'div' : 'a');
    const attributes = objective.claimable
      ? `type="button" data-quest-claim="${escapeAttribute(objective.id)}"`
      : (objective.claimed ? '' : `href="${escapeAttribute(objective.href || '/dungeon')}"`);
    const stateClass = objective.claimed
      ? 'is-claimed'
      : (objective.claimable ? 'is-claimable' : (objective.completed ? 'is-complete' : ''));
    const rewardLabel = objective.claimed ? 'Claimed' : (objective.claimable ? 'Claim' : 'Reward');
    const rewardMarkup = objective.claimed
      ? renderIcon('check')
      : renderQuestReward(objective.reward);
    const requirements = renderQuestRequirements(objective.requirements);
    const requirementsClass = requirements ? 'has-requirements' : '';

    return `
      <${tag} class="play-objective ${stateClass} ${requirementsClass}" ${attributes}>
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
        ${requirements}
        <span class="quest-reward">
          <small>${escapeHtml(rewardLabel)}</small>
          <strong>${rewardMarkup}</strong>
        </span>
      </${tag}>
    `;
  }

  function renderQuestRequirements(requirements) {
    if (!Array.isArray(requirements) || !requirements.length) return '';

    return `
      <span class="quest-requirements" aria-label="Quest requirements">
        ${requirements.map((requirement) => `
          <span class="quest-requirement">
            ${renderIcon(requirement.icon)}
            <span>${escapeHtml(requirement.label)}</span>
          </span>
        `).join('')}
      </span>
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

  function renderDailyReward() {
    const dailyReward = state.questData?.dailyReward || {};
    const period = state.questData?.period || {};
    const claimed = Boolean(dailyReward.claimed);
    const claimable = Boolean(dailyReward.claimable) && !claimed;

    setText(elements.dailyRewardTitle, dailyReward.title || 'Campfire Cache');
    setHtml(elements.dailyRewardValue, renderQuestReward(dailyReward.reward));
    setText(elements.dailyRewardStatus, claimed
      ? 'Claimed until reset.'
      : 'Ready once today.');
    setText(elements.questResetChip, formatResetCountdown(period.resetsAt));

    if (elements.questResetChip && period.resetsAt) {
      elements.questResetChip.title = `Resets ${new Date(period.resetsAt).toLocaleString()}`;
    }
    if (elements.dailyRewardButton) {
      elements.dailyRewardButton.disabled = !claimable || state.dailyRewardPending;
      elements.dailyRewardButton.textContent = claimed ? 'Claimed' : (state.dailyRewardPending ? 'Claiming...' : 'Claim');
      elements.dailyRewardButton.classList.toggle('is-claimed', claimed);
      elements.dailyRewardButton.classList.toggle('is-busy', state.dailyRewardPending);
    }
  }

  async function claimQuestReward(questId, button) {
    if (!questId || state.questClaimPending) return;

    state.questClaimPending = true;
    button.disabled = true;
    button.classList.add('is-busy');

    try {
      const payload = await api(`/api/account/quests/${encodeURIComponent(questId)}/claim`, {
        method: 'POST'
      });
      applyQuestPayload(payload);
      setMessage('Quest reward claimed.', 'success');
    } catch (error) {
      showError(error);
    } finally {
      state.questClaimPending = false;
      renderObjectives();
    }
  }

  async function claimCampfireCache(button) {
    if (state.dailyRewardPending || !state.questData?.dailyReward?.claimable) return;

    state.dailyRewardPending = true;
    renderDailyReward();
    button?.classList.add('is-busy');

    try {
      const payload = await api('/api/account/daily-reward/claim', { method: 'POST' });
      applyQuestPayload(payload);
      setMessage('Campfire Cache claimed.', 'success');
    } catch (error) {
      showError(error);
    } finally {
      state.dailyRewardPending = false;
      renderDailyReward();
    }
  }

  function applyQuestPayload(payload) {
    state.questData = {
      period: payload.period,
      quests: payload.quests || [],
      dailyReward: payload.dailyReward || null
    };

    if (payload.progression) {
      state.progression = {
        ...(state.progression || {}),
        ...payload.progression,
        levelProgress: null
      };
      state.player = {
        ...(state.player || {}),
        ...payload.progression
      };
      syncSessionPlayer(state.player);
      renderPlayer();
    }

    renderObjectives();
    renderDailyReward();
  }

  function formatResetCountdown(resetsAt) {
    const resetTime = new Date(resetsAt).getTime();
    if (!Number.isFinite(resetTime)) return 'Daily';

    const minutes = Math.max(0, Math.ceil((resetTime - Date.now()) / 60000));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
  }

  function getRunSummary(run) {
    var tfloor = Number(run.currentFloor) || 0;
    if (tfloor <=1)
      return 'Descend into the depths and face the unknown.';
    return 'Floor ' + tfloor + ': the darkness grows heavier.';
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

  function getSelectedProfileDemon() {
    const selectedId = Number(state.player?.profileDemonId) || 0;
    return selectedId ? getCollectionDemon(selectedId) : null;
  }

  function getCollectionDemon(demonId) {
    return (state.collection || []).find((demon) => Number(demon.id) === Number(demonId)) || null;
  }

  function syncProfileImages(demon) {
    const imageUrl = getDemonImageUrl(demon);
    const imageAlt = demon
      ? `${capitalize(demon.rarity || 'common')} ${demon.species || 'Demon'} profile demon`
      : 'Default profile demon';

    [elements.profileDemonImage, elements.navProfileImage].forEach((image) => {
      if (!image) return;
      image.src = imageUrl;
      image.alt = imageAlt;
    });
  }

  function getDemonImageUrl(demon) {
    return demon?.imageUrl || demon?.image_url || DEFAULT_PROFILE_IMAGE_URL;
  }

  function syncSessionPlayer(player) {
    if (!player) return;

    const currentSession = window.AmongDemons.getSession();
    window.AmongDemons.setSession({
      ...currentSession,
      player
    });
  }

  function replaceStaticIcons() {
    const replacer = window.AmongDemons?.ui?.replaceStaticIcons;
    if (typeof replacer === 'function') replacer();
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

  function capitalize(value) {
    if (!value) return '';
    const text = String(value);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback);
      return;
    }

    callback();
  }
})();
