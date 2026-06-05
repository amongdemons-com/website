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

function renderHandBar(hand, isVisible, isInteractive = false, mode = 'recruit') {
  if (!elements.dungeonHandBar || !elements.dungeonHandGrid) return;

  elements.dungeonHandBar.classList.toggle('d-none', !isVisible);
  if (!isVisible) {
    setElementHtml(elements.dungeonHandGrid, '');
    elements.dungeonHandGrid.classList.remove('is-pacts-tab');
    elements.dungeonHandBar.classList.remove('has-pacts', 'is-pacts-tab-active');
    updateHandTabs('hand', 0);
    return;
  }

  const activePacts = getActiveBuffs();
  const hasPacts = activePacts.length > 0;
  if (!hasPacts || !['hand', 'pacts'].includes(state.activeHandTab)) {
    state.activeHandTab = 'hand';
  }

  const activeTab = hasPacts && state.activeHandTab === 'pacts' ? 'pacts' : 'hand';

  elements.dungeonHandBar.classList.toggle('has-pacts', hasPacts);
  elements.dungeonHandBar.classList.toggle('is-pacts-tab-active', activeTab === 'pacts');
  elements.dungeonHandGrid.classList.toggle('is-pacts-tab', activeTab === 'pacts');
  updateHandTabs(activeTab, activePacts.length);
  if (activeTab === 'pacts') {
    setElementHtml(elements.dungeonHandGrid, renderHandPactTags(activePacts));
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
}

function updateHandTabs(activeTab = 'hand', pactCount = 0) {
  const handTab = elements.dungeonHandBar?.querySelector('[data-dungeon-hand-tab="hand"]');
  const pactsTab = elements.dungeonHandBar?.querySelector('[data-dungeon-hand-tab="pacts"]');

  if (handTab) {
    handTab.classList.toggle('active', activeTab === 'hand');
    handTab.setAttribute('aria-selected', activeTab === 'hand' ? 'true' : 'false');
  }

  if (pactsTab) {
    pactsTab.classList.toggle('d-none', pactCount <= 0);
    pactsTab.classList.toggle('active', activeTab === 'pacts');
    pactsTab.setAttribute('aria-selected', activeTab === 'pacts' ? 'true' : 'false');
    pactsTab.disabled = pactCount <= 0;
  }
}

function bindHandTabs() {
  if (handTabEventsBound) return;
  handTabEventsBound = true;

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-dungeon-hand-tab]');
    if (!button || !elements.dungeonHandBar?.contains(button)) return;

    const nextTab = button.dataset.dungeonHandTab === 'pacts' ? 'pacts' : 'hand';
    if (nextTab === 'pacts' && !getActiveBuffs().length) return;

    state.activeHandTab = nextTab;
    renderRun();
  });
}

function renderHandPactTags(activePacts) {
  if (!activePacts.length) {
    return '<div class="dungeon-hand-pacts-empty">No Demonic Pacts sealed.</div>';
  }

  return `
    <div class="dungeon-hand-pacts" aria-label="Selected Demonic Pacts">
      ${activePacts.map(renderActivePactIcon).join('')}
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
    <div class="dungeon-hand-cards formation-lane-cards ${modeClass}" data-formation-drop="hand" data-hand-count="${demons.length}">
      ${placeholder}${cardHtml || (placeholder ? '' : renderEmptyHand(mode))}
    </div>
  `;
}

function renderEmptyHand(mode = 'recruit') {
  if (mode === 'battle') {
    return '<div class="formation-empty dungeon-hand-empty dungeon-hand-battle-placeholder"><span>Fighting</span></div>';
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
      <div class="dungeon-reward-payout-item dungeon-reward-payout-souls">
        ${renderSoulAmount(String(souls), {
          className: 'soul-chip dungeon-reward-payout-soul-amount',
          ariaLabel: `${souls} Souls`
        })}
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

export {
  renderHandBar,
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
