import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon, renderSoulAmount } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, setElementHtml, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const getPayoutPreview = (...args) => dungeonActions.getPayoutPreview(...args);
const getRecruitPreviewEnemyTeam = (...args) => dungeonActions.getRecruitPreviewEnemyTeam(...args);
const getSelectedRewardCandidate = (...args) => dungeonActions.getSelectedRewardCandidate(...args);
const getCollectionStatPreviewDemon = (...args) => dungeonActions.getCollectionStatPreviewDemon(...args);
const completeDeferredDemonicPactRevealAfter = (...args) => dungeonActions.completeDeferredDemonicPactRevealAfter(...args);
const renderCollectionReinforcementPlaceholder = (...args) => dungeonActions.renderCollectionReinforcementPlaceholder(...args);
const renderDemonCard = (...args) => dungeonActions.renderDemonCard(...args);
const renderDungeonDemonCard = (...args) => dungeonActions.renderDungeonDemonCard(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const getActiveBuffs = (...args) => dungeonActions.getActiveBuffs(...args);
const openCashoutModal = (...args) => dungeonActions.openCashoutModal(...args);
const renderActivePactIcon = (...args) => dungeonActions.renderActivePactIcon(...args);
const shouldShowCollectionReinforcementHandPlaceholder = (...args) => dungeonActions.shouldShowCollectionReinforcementHandPlaceholder(...args);
let handTabEventsBound = false;
let handScrollEventsBound = false;
let handScrollResizeEventsBound = false;
let handScrollSyncFrame = 0;

function renderHandBar(hand, isVisible, isInteractive = false, mode = 'recruit') {
  if (!elements.dungeonHandBar || !elements.dungeonHandGrid) return;

  elements.dungeonHandBar.classList.toggle('d-none', !isVisible);
  if (!isVisible) {
    setElementHtml(elements.dungeonHandGrid, '');
    elements.dungeonHandGrid.classList.remove('is-pacts-tab');
    elements.dungeonHandBar.classList.remove('has-pacts', 'is-pacts-tab-active', 'has-level-power-prompt', 'is-battle-controls-mode');
    updateHandTabs('hand', 0, false);
    return;
  }

  const activeBuffs = getHandBuffs();
  const hasLevelPowerPrompt = activeBuffs.some((buff) => buff.id === 'account-level-power-available');
  if (!['hand', 'pacts'].includes(state.activeHandTab)) {
    state.activeHandTab = 'hand';
  }

  const activeTab = state.activeHandTab === 'pacts' ? 'pacts' : 'hand';

  elements.dungeonHandBar.classList.add('has-pacts');
  elements.dungeonHandBar.classList.toggle('is-pacts-tab-active', activeTab === 'pacts');
  elements.dungeonHandBar.classList.toggle('has-level-power-prompt', hasLevelPowerPrompt);
  elements.dungeonHandBar.classList.toggle('is-battle-controls-mode', mode === 'battle');
  elements.dungeonHandGrid.classList.toggle('is-pacts-tab', activeTab === 'pacts');
  updateHandTabs(activeTab, activeBuffs.length, hasLevelPowerPrompt);
  if (activeTab === 'pacts') {
    setElementHtml(elements.dungeonHandGrid, renderHandPactTags(activeBuffs));
  } else {
    const handRenderKey = [
      'hand',
      mode,
      isInteractive ? 'interactive' : 'locked'
    ].join(':');
    setElementHtml(elements.dungeonHandGrid, renderHandCards(hand, isInteractive, mode), {
      patchDemonLane: true,
      renderKey: handRenderKey
    });
  }
  bindHandTabs();
  bindHandScrollButtons();
  scheduleHandScrollControlsSync();
}

function updateHandTabs(activeTab = 'hand', buffCount = 0, hasLevelPowerPrompt = false) {
  const handTab = elements.dungeonHandBar?.querySelector('[data-dungeon-hand-tab="hand"]');
  const pactsTab = elements.dungeonHandBar?.querySelector('[data-dungeon-hand-tab="pacts"]');

  if (handTab) {
    handTab.classList.toggle('active', activeTab === 'hand');
    handTab.setAttribute('aria-selected', activeTab === 'hand' ? 'true' : 'false');
  }

  if (pactsTab) {
    pactsTab.classList.remove('d-none');
    pactsTab.classList.toggle('active', activeTab === 'pacts');
    pactsTab.classList.toggle('is-level-power-attention', hasLevelPowerPrompt);
    pactsTab.setAttribute('aria-selected', activeTab === 'pacts' ? 'true' : 'false');
    pactsTab.disabled = false;
    pactsTab.setAttribute('aria-label', buffCount > 0 ? `Buffs, ${buffCount} active` : 'Buffs, none active');
  }
}

function bindHandTabs() {
  if (handTabEventsBound) return;
  handTabEventsBound = true;

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-dungeon-hand-tab]');
    if (!button || !elements.dungeonHandBar?.contains(button)) return;

    const nextTab = button.dataset.dungeonHandTab === 'pacts' ? 'pacts' : 'hand';
    state.activeHandTab = nextTab;
    renderRun();
  });
}

function bindHandScrollButtons() {
  if (handScrollEventsBound) return;
  handScrollEventsBound = true;

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-hand-scroll]');
    if (!button || !elements.dungeonHandBar?.contains(button)) return;

    const shell = button.closest('.dungeon-hand-scroll-shell');
    const viewport = shell?.querySelector('[data-hand-scroll-viewport]');
    if (!viewport) return;

    const direction = Number(button.dataset.handScroll) || 0;
    const amount = getHandScrollAmount(viewport);
    viewport.scrollBy({
      left: direction * amount,
      behavior: 'smooth'
    });
  });

  if (!handScrollResizeEventsBound) {
    handScrollResizeEventsBound = true;
    window.addEventListener('resize', scheduleHandScrollControlsSync);
  }
}

function scheduleHandScrollControlsSync() {
  if (handScrollSyncFrame) window.cancelAnimationFrame(handScrollSyncFrame);
  handScrollSyncFrame = window.requestAnimationFrame(() => {
    handScrollSyncFrame = 0;
    syncHandScrollControls();
  });
}

function syncHandScrollControls() {
  elements.dungeonHandGrid?.querySelectorAll('.dungeon-hand-scroll-shell').forEach((shell) => {
    const viewport = shell.querySelector('[data-hand-scroll-viewport]');
    const buttons = Array.from(shell.querySelectorAll('[data-hand-scroll]'));
    if (!viewport || !buttons.length) return;

    shell.classList.remove('has-scroll-overflow');
    buttons.forEach((button) => {
      button.hidden = true;
      button.disabled = true;
    });

    const hasOverflow = viewport.scrollWidth > viewport.clientWidth + 1;
    shell.classList.toggle('has-scroll-overflow', hasOverflow);
    buttons.forEach((button) => {
      button.hidden = !hasOverflow;
      button.disabled = !hasOverflow;
    });
  });
}

function getHandScrollAmount(viewport) {
  const card = viewport.querySelector('.dungeon-demon-card, .collection-reinforcement-placeholder, .dungeon-hand-empty, .active-pact-chip');
  const lane = viewport.querySelector('.dungeon-hand-cards, .dungeon-hand-pacts');
  const laneStyles = lane ? window.getComputedStyle(lane) : null;
  const columnGap = parseFloat(laneStyles?.columnGap || '');
  const fallbackGap = parseFloat(laneStyles?.gap || '');
  const gap = Number.isFinite(columnGap) ? columnGap : (Number.isFinite(fallbackGap) ? fallbackGap : 0);
  const cardWidth = card?.getBoundingClientRect().width || 0;
  return Math.max(cardWidth + gap, viewport.clientWidth * 0.72, 1);
}

function getHandBuffs() {
  const levelPowerBuff = createLevelPowerBuff(state.statPoints);
  const levelPowerPrompt = createLevelPowerPrompt(state.statPoints);
  return [
    ...(levelPowerBuff ? [levelPowerBuff] : []),
    ...(levelPowerPrompt ? [levelPowerPrompt] : []),
    ...getActiveBuffs()
  ];
}

function createLevelPowerBuff(statPoints) {
  if (!statPoints || Number(statPoints.spentPoints) <= 0) return null;

  const bonuses = statPoints.bonuses || {};
  const flatRows = [
    [bonuses.maxHpFlat, 'max HP'],
    [bonuses.attackFlat, 'attack damage'],
    [bonuses.speedFlat, 'Speed'],
    [bonuses.healingFlat, 'healing'],
    [bonuses.thornsFlat, 'thorns damage'],
    [bonuses.aoeDamageFlat, 'AOE damage'],
    [bonuses.poisonDamageFlat, 'poison damage']
  ]
    .filter(([value]) => Number(value) > 0)
    .map(([value, label]) => `+${formatLevelPowerBonus(value)} ${label}`);
  const percentRows = [
    [bonuses.maxHpPercent, 'max HP'],
    [bonuses.attackPercent, 'attack damage'],
    [bonuses.speedPercent, 'Speed'],
    [bonuses.healingPercent, 'healing'],
    [bonuses.thornsPercent, 'thorns'],
    [bonuses.aoeDamagePercent, 'AOE damage'],
    [bonuses.poisonDamagePercent, 'poison damage']
  ]
    .filter(([value]) => Number(value) > 0)
    .map(([value, label]) => `+${formatLevelPowerBonus(value)}% ${label}`);
  const bonusRows = [...flatRows, ...percentRows];

  return {
    id: 'account-level-power',
    name: 'Level Power',
    description: bonusRows.join(', '),
    tooltip: ['Level Power', ...bonusRows].join('\n'),
    rarity: 'account',
    icon: 'sparkles',
    tags: ['Permanent', 'Account']
  };
}

function createLevelPowerPrompt(statPoints) {
  const unspentPoints = Math.max(0, Number(statPoints?.unspentPoints) || 0);
  if (!statPoints || unspentPoints <= 0) return null;

  return {
    id: 'account-level-power-available',
    name: 'Level Points Available',
    description: `You have ${unspentPoints} skill point${unspentPoints === 1 ? '' : 's'} available.`,
    tooltip: [
      'Level Points Available',
      `${unspentPoints} skill point${unspentPoints === 1 ? '' : 's'} unspent`,
      'Open Skill Tree to allocate them.'
    ].join('\n'),
    rarity: 'account-available',
    icon: 'plus',
    href: '/skill-tree',
    attention: true,
    tags: ['Skill Tree']
  };
}

function formatLevelPowerBonus(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, '');
}

function renderHandPactTags(activeBuffs) {
  if (!activeBuffs.length) {
    return '<div class="dungeon-hand-pacts-empty">No active buffs.</div>';
  }

  return `
    <div class="dungeon-hand-scroll-shell dungeon-hand-pacts-shell">
      <button class="dungeon-hand-scroll-btn" type="button" data-hand-scroll="-1" aria-label="Scroll buffs left" title="Scroll buffs left" hidden disabled>
        ${renderIcon('back')}
      </button>
      <div class="dungeon-hand-scroll-viewport" data-hand-scroll-viewport>
        <div class="dungeon-hand-pacts" aria-label="Active dungeon buffs">
          ${activeBuffs.map(renderActivePactIcon).join('')}
        </div>
      </div>
      <button class="dungeon-hand-scroll-btn" type="button" data-hand-scroll="1" aria-label="Scroll buffs right" title="Scroll buffs right" hidden disabled>
        ${renderIcon('chevron-right')}
      </button>
    </div>
  `;
}

function renderHandCards(demons, isInteractive = false, mode = 'recruit') {
  const placeholder = isInteractive && mode === 'recruit' && shouldShowCollectionReinforcementHandPlaceholder()
    ? renderCollectionReinforcementPlaceholder('hand')
    : '';
  const modeClass = mode === 'battle' ? 'is-battle' : 'is-recruit';
  const cardHtml = demons.map((demon) => renderDemonCard(demon, {
    side: 'hand',
    allowRecruitDrag: isInteractive && mode === 'recruit'
  })).join('');

  return `
    <div class="dungeon-hand-scroll-shell">
      <button class="dungeon-hand-scroll-btn" type="button" data-hand-scroll="-1" aria-label="Scroll hand left" title="Scroll hand left" hidden disabled>
        ${renderIcon('back')}
      </button>
      <div class="dungeon-hand-scroll-viewport" data-hand-scroll-viewport>
        <div class="dungeon-hand-cards formation-lane-cards ${modeClass}" data-formation-drop="hand" data-hand-count="${demons.length}">
          ${placeholder}${cardHtml || (placeholder ? '' : renderEmptyHand(mode))}
        </div>
      </div>
      <button class="dungeon-hand-scroll-btn" type="button" data-hand-scroll="1" aria-label="Scroll hand right" title="Scroll hand right" hidden disabled>
        ${renderIcon('chevron-right')}
      </button>
    </div>
  `;
}

function renderEmptyHand(mode = 'recruit') {
  // During battle the hand grid is intentionally left empty: the battle
  // controls (playback + speed) are rendered into #dungeonBottomControls, which
  // overlays this area (see renderFightLogActions / main.css .dungeon-bottom-controls).
  if (mode === 'battle') {
    return '';
  }

  return '<div class="formation-empty dungeon-hand-empty"><span>Empty</span></div>';
}

function renderRewardBox(isVisible, isInteractive = false, canExtract = false) {
  if (!elements.dungeonRewardBox || !elements.dungeonRewardGrid) return;

  elements.dungeonRewardBox.classList.toggle('d-none', !isVisible);
  if (!isVisible) {
    setElementHtml(elements.dungeonRewardGrid, '');
    return;
  }

  const candidate = getSelectedRewardCandidate();
  const earned = getPayoutPreview(candidate);

  const rewardChanged = setElementHtml(elements.dungeonRewardGrid, `
    <div class="dungeon-reward-panel ${candidate ? 'has-demon' : 'is-empty'}">
      <div class="dungeon-reward-dropzone formation-lane-cards ${candidate ? 'has-demon' : 'is-empty'}" data-reward-drop="true">
        <div class="dungeon-reward-slot">
          ${candidate ? renderRewardBoxCard(candidate, isInteractive) : renderEmptyRewardSlot()}
        </div>
      </div>
      ${renderRewardPayout(earned, canExtract)}
    </div>
  `, { preserveDemonImages: true });
  const rewardButton = document.getElementById('getRewardBtn');
  if (rewardChanged || rewardButton?.dataset.rewardActionBound !== 'true') {
    bindClick(rewardButton, openCashoutModal);
    if (rewardButton) rewardButton.dataset.rewardActionBound = 'true';
  }
}

function renderRewardPayout(earned, canExtract = false) {
  const xp = Number(earned.xp) || 0;
  const souls = Number(earned.souls) || 0;
  return `
    <div class="dungeon-reward-payout" aria-label="Dungeon rewards">
      <div class="dungeon-reward-payout-item">
        <strong>${escapeHtml(String(xp))}</strong>
        <span>XP</span>
      </div>
      <div class="dungeon-reward-payout-item">
        <strong>${escapeHtml(String(souls))}</strong>
        <span>Souls</span>
      </div>
      <button class="btn btn-warning dungeon-reward-extract-btn" id="getRewardBtn" type="button" ${canExtract ? '' : 'disabled'}>
        ${renderIcon('flag')}
        Extract
      </button>
    </div>
  `;
}

function renderRewardBoxCard(candidate, isInteractive = false) {
  const demon = {
    ...getCollectionStatPreviewDemon(candidate.demon),
    rewardCandidateKey: candidate.key
  };

  return renderDungeonDemonCard(demon, {
    className: 'dungeon-reward-demon-card',
    suppressCollectionMissingTag: true,
    attributes: {
      'data-instance-id': demon.instanceId || `reward-${candidate.key}`,
      'data-reward-candidate-key': candidate.key,
      role: 'button',
      tabindex: '0',
      draggable: isInteractive
    }
  });
}

function renderEmptyRewardSlot() {
  return `
    <div class="formation-empty dungeon-reward-empty">
      <span>Drop Demon</span>
    </div>
  `;
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
  if (!state.enemyRevealEffectIds.length) {
    completeDeferredDemonicPactRevealAfter(0);
  }
  renderRun();
}

function getHandFlowTargetCards() {
  return Array.from(elements.dungeonHandGrid.querySelectorAll('.dungeon-demon-card[data-instance-id]'))
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

export {
  renderHandBar,
  getHandBuffs,
  createLevelPowerBuff,
  createLevelPowerPrompt,
  updateHandTabs,
  bindHandTabs,
  renderHandPactTags,
  renderHandCards,
  renderEmptyHand,
  renderRewardBox,
  renderRewardPayout,
  renderRewardBoxCard,
  renderEmptyRewardSlot,
  playPendingHandFlowAnimation,
  revealDeferredEnemyPreview,
  getHandFlowTargetCards,
  flowEnemyCardToHand,
  createHandFlowGhost,
  markHandFlowLanded
};
