(function() {
  'use strict';

  const api = window.AmongDemons.api;
  const audio = window.AmongDemons.audio;
  const renderSoulAmount = window.AmongDemons.ui.renderSoulAmount || ((value) => escapeHtml(value));
  const updateNavAccount = window.AmongDemons.ui.updateNavAccount || (() => {});
  const session = window.AmongDemons.getSession();
  const DEFAULT_PROFILE_IMAGE_URL = '/app/images/demons/map/1.webp';
  const state = {
    player: session.player || null,
    progression: null,
    questData: null,
    statPoints: null,
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

    audio?.setScene({ music: 'music.default' });
    cacheElements();
    startDailySoulAnimation();
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
      'campPlayerNameLink',
      'playerHudName',
      'playerTitle',
      'welcomeText',
      'appMessage',
      'levelStat',
      'xpStat',
      'xpProgressBar',
      'floorStat',
      'soulsStat',
      'objectiveList',
      'questResetChip',
      'dailyRewardTitle',
      'dailyRewardValue',
      'dailyRewardStatus',
      'dailyRewardButton',
      'profileDemonButton',
      'profileDemonImage',
      'profileDemonPicker',
      'profileDemonPickerClose',
      'profileDemonPickerStatus',
      'profileDemonGrid',
      'campSkillTreeLink',
      'campSkillTreeMeta'
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

  function startDailySoulAnimation() {
    const canvas = document.getElementById('dailySoulCanvas');
    if (!canvas || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const soulImg = new Image();
    soulImg.src = '/app/images/assets/soul.svg';

    const W = 120;
    const H = 140;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    function spawnSoul() {
      return {
        x: 60 + (Math.random() - 0.5) * 34,
        y: 126 + Math.random() * 5,
        life: Math.random(),
        speed: 0.00055 + Math.random() * 0.00025,
        size: 19 + Math.random() * 14,
        drift: 2 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
        opacity: 0.085 + Math.random() * 0.075,
        visibleFrom: 0.05 + Math.random() * 0.14,
        visibleFor: 0.36 + Math.random() * 0.12,
        grow: Math.random() > 0.5
      };
    }

    const souls = Array.from({ length: 10 }, spawnSoul);

    function drawSoul(soul) {
      soul.life += soul.speed;

      if (soul.life >= 1) {
        Object.assign(soul, spawnSoul());
        soul.life = 0;
      }

      const start = soul.visibleFrom;
      const end = start + soul.visibleFor;
      if (soul.life < start || soul.life > end) return;

      const local = (soul.life - start) / soul.visibleFor;

      const x = soul.x + Math.sin(local * Math.PI * 2 + soul.phase) * soul.drift;
      const y = soul.y - local * 106;

      const fadeIn = Math.min(1, local / 0.18);
      const fadeOut = local < 0.78 ? 1 : (1 - local) / 0.22;
      const alpha = soul.opacity * fadeIn * fadeOut;

      const scale = soul.grow
        ? 0.82 + local * 0.38
        : 1.12 - local * 0.26;

      const size = soul.size * scale;

      ctx.save();

      ctx.globalAlpha = alpha * 0.45;
      ctx.shadowColor = 'rgba(120,255,245,0.75)';
      ctx.shadowBlur = 18;
      ctx.drawImage(soulImg, x - size / 2, y - size / 2, size, size);

      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 0;
      ctx.drawImage(soulImg, x - size / 2, y - size / 2, size, size);

      ctx.restore();
    }

    function animateSouls() {
      ctx.clearRect(0, 0, W, H);
      souls.forEach(drawSoul);
      window.requestAnimationFrame(animateSouls);
    }

    soulImg.onload = animateSouls;
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
      setText(elements.profileDemonPickerStatus, 'Gathering bound demons...');
      setHtml(elements.profileDemonGrid, `
        <div class="profile-demon-empty">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="" width="88" height="88" loading="lazy">
          <span>Gathering demons</span>
        </div>
      `);
      return;
    }

    if (!demons.length) {
      setText(elements.profileDemonPickerStatus, 'Extract a demon from the dungeon before choosing a camp portrait.');
      setHtml(elements.profileDemonGrid, `
        <div class="profile-demon-empty">
          <img src="/app/images/amongdemons_logo_250x250.png" alt="" width="88" height="88" loading="lazy">
          <span>No demons bound yet</span>
        </div>
      `);
      return;
    }

    setText(elements.profileDemonPickerStatus, 'Choose one bound demon for your camp portrait.');
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
      const [me, progression, collection, questData, statPoints] = await Promise.all([
        api('/api/auth/me'),
        api('/api/account/progression'),
        loadCollection(),
        api('/api/account/quests'),
        api('/api/account/stat-points')
      ]);

      state.player = me.player;
      state.progression = progression;
      state.questData = questData;
      state.statPoints = statPoints;
      state.collection = collection.demons || [];
      state.collectionLoaded = true;

      renderPlayer();
      renderObjectives();
      renderDailyReward();
      renderSkillTreeLink();
      if (state.profilePickerOpen) renderProfilePicker();
    } catch (error) {
      handleAuthError(error);
    }
  }

  async function loadCollection() {
    return api('/api/demons');
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
    // The camp name links to the player's own public profile once it exists.
    if (elements.campPlayerNameLink) {
      elements.campPlayerNameLink.textContent = username;
      if (player.username) {
        elements.campPlayerNameLink.setAttribute('href', `/hunter/${encodeURIComponent(player.username)}`);
      } else {
        elements.campPlayerNameLink.removeAttribute('href');
      }
    } else {
      setText(elements.campPlayerName, username);
    }
    setText(elements.playerHudName, username);
    setText(elements.welcomeText, player.username
      ? 'Rest, plan, and push deeper.'
      : 'Rest, plan, and push deeper.');
    setText(elements.playerTitle, 'Demon Hunter');

    renderLevelProgress(progression, player);
    setText(elements.floorStat, formatNumber(bestFloor));
    updateNavAccount({ ...player, ...progression }, { souls });
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
    const nextLevel = level + 1;
    const progressText = `${formatNumber(progress.xpToNextLevel)} XP to level ${formatNumber(nextLevel)}`;

    setText(elements.levelStat, formatNumber(level));
    setText(elements.xpStat, progressText);

    if (elements.xpProgressBar) {
      elements.xpProgressBar.style.width = `${percent}%`;
      const progressTrack = elements.xpProgressBar.parentElement;
      if (progressTrack) {
        progressTrack.dataset.xpProgress = 'true';
        progressTrack.setAttribute('role', 'progressbar');
        progressTrack.setAttribute('aria-valuemin', '0');
        progressTrack.setAttribute('aria-valuemax', '100');
        progressTrack.setAttribute('aria-valuenow', String(percent));
        progressTrack.style.setProperty('--level-up-progress', `${percent}%`);
        progressTrack.setAttribute('aria-label', progressText);
      }
    }
  }

  function renderSkillTreeLink() {
    const summary = state.statPoints;
    const unspent = Math.max(0, Number(summary?.unspentPoints) || 0);

    elements.campSkillTreeLink?.classList.toggle('has-unspent-points', unspent > 0);
    setText(elements.campSkillTreeMeta, !summary
      ? 'Loading level points...'
      : unspent > 0
        ? `${formatNumber(unspent)} unspent point${unspent === 1 ? '' : 's'}`
        : 'Review your upgrades');
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
      xpForNextLevel,
      xpIntoLevel,
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

  function renderObjectives() {
    const objectives = state.questData?.quests || [];
    const visibleObjectives = objectives.filter((objective) => !objective.claimed);
    setHtml(
      elements.objectiveList,
      visibleObjectives.length
        ? visibleObjectives.map(renderObjective).join('')
        : renderCompletedQuestsMessage()
    );
  }

  function renderCompletedQuestsMessage() {
    return `
      <div class="camp-quests-complete" role="status">
        <span class="camp-quests-complete-icon" aria-hidden="true">${renderIcon('check')}</span>
        <span>
          <strong>All quests complete</strong>
          <small>You finished today's quests. More arrive at the daily reset.</small>
        </span>
      </div>
    `;
  }

  function renderObjective(objective) {
    const target = Math.max(1, Number(objective.target) || 1);
    const current = clamp(Number(objective.current) || 0, 0, target);
    const percent = Math.round((current / target) * 100);

    const requirements = renderQuestRequirements(objective.requirements);
    const requirementsClass = requirements ? 'has-requirements' : '';

    // Quests with requirement tags stay non-links so tapping a tag reveals its
    // tooltip on touch devices instead of navigating away (these quests are
    // locked until their requirements are met anyway).
    const isLink = !objective.claimable && !objective.claimed && !requirements;
    const tag = objective.claimable ? 'button' : (isLink ? 'a' : 'div');
    const attributes = objective.claimable
      ? `type="button" data-quest-claim="${escapeAttribute(objective.id)}"`
      : (isLink ? `href="${escapeAttribute(objective.href || '/dungeon')}"` : '');
    const stateClass = objective.claimed
      ? 'is-claimed'
      : (objective.claimable ? 'is-claimable' : (objective.completed ? 'is-complete' : ''));
    const rewardLabel = objective.claimed ? 'Claimed' : (objective.claimable ? 'Claim' : 'Reward');
    const rewardMarkup = objective.claimed
      ? renderIcon('check')
      : renderQuestReward(objective.reward);

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
        ${requirements.map((requirement) => {
          const tooltip = requirement.detail
            ? ` tabindex="0" data-tooltip="${escapeAttribute(requirement.detail)}" aria-label="${escapeAttribute(`${requirement.label}: ${requirement.detail}`)}"`
            : '';
          return `
          <span class="quest-requirement${requirement.detail ? ' has-tooltip' : ''}"${tooltip}>
            ${renderIcon(requirement.icon)}
            <span>${escapeHtml(requirement.label)}</span>
          </span>
        `;
        }).join('')}
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
      return `${renderIcon('soul')} <span class="quest-reward-amount quest-reward-souls">${escapeHtml(formatNumber(reward.value))}</span>`;
    }

    if (reward.type === 'xp') {
      return `<span class="quest-xp-mark">XP</span> <span class="quest-reward-amount quest-reward-xp">${escapeHtml(formatNumber(reward.value))}</span>`;
    }

    return escapeHtml(reward.value || '-');
  }

  function renderDailyReward() {
    const dailyReward = state.questData?.dailyReward || {};
    const period = state.questData?.period || {};
    const claimed = Boolean(dailyReward.claimed);
    const claimable = Boolean(dailyReward.claimable) && !claimed;

    setText(elements.dailyRewardTitle, dailyReward.title || 'Lost Souls');
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
      audio?.play('sfx.progression.questComplete', { volume: 0.9 });
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
      audio?.play('sfx.progression.dailyReward', { volume: 0.92 });
      setMessage('Lost Souls claimed.', 'success');
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
    console.error(error);
    setMessage(error, 'danger');
  }

  function setMessage(text, type) {
    if (!elements.appMessage) return;
    window.AmongDemons.setGameAlert(elements.appMessage, text, { type });
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
