import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_FLOOR, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const addCollectionReinforcementToPool = (...args) => dungeonActions.addCollectionReinforcementToPool(...args);
const battle = (...args) => dungeonActions.battle(...args);
const ensureCollectionLoaded = (...args) => dungeonActions.ensureCollectionLoaded(...args);
const findCollectionReplacement = (...args) => dungeonActions.findCollectionReplacement(...args);
const finishRun = (...args) => dungeonActions.finishRun(...args);
const getAvailableCollectionReinforcements = (...args) => dungeonActions.getAvailableCollectionReinforcements(...args);
const getCollectionReinforcementLimit = (...args) => dungeonActions.getCollectionReinforcementLimit(...args);
const getFinalRewardHand = (...args) => dungeonActions.getFinalRewardHand(...args);
const getRecruitPreviewEnemyTeam = (...args) => dungeonActions.getRecruitPreviewEnemyTeam(...args);
const getRecruitPreviewHand = (...args) => dungeonActions.getRecruitPreviewHand(...args);
const getRecruitPreviewTeam = (...args) => dungeonActions.getRecruitPreviewTeam(...args);
const getSelectedCollectionReinforcement = (...args) => dungeonActions.getSelectedCollectionReinforcement(...args);
const getSelectedCollectionReinforcements = (...args) => dungeonActions.getSelectedCollectionReinforcements(...args);
const getSelectedRewardCandidate = (...args) => dungeonActions.getSelectedRewardCandidate(...args);
const isFinalRewardPhase = (...args) => dungeonActions.isFinalRewardPhase(...args);
const markCollectionReinforcementPlaceholderInteracted = (...args) => dungeonActions.markCollectionReinforcementPlaceholderInteracted(...args);
const markCollectionReinforcementStagedInteracted = (...args) => dungeonActions.markCollectionReinforcementStagedInteracted(...args);
const removeCollectionReinforcement = (...args) => dungeonActions.removeCollectionReinforcement(...args);
const renderDungeonDemonCard = (...args) => dungeonActions.renderDungeonDemonCard(...args);
const renderEmptyText = (...args) => dungeonActions.renderEmptyText(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const saveReward = (...args) => dungeonActions.saveReward(...args);

function showPendingChoiceModal() {
  if (!state.run || !(state.run.awaitingFinalPick || state.run.status === 'completed')) return;
  renderRun();
}

function renderTeamChoiceModal() {
  if (!state.run) return;
  setTeamChoiceModalFullscreen(true);

  const currentFloorRewards = (state.run.rewards || []).filter((reward) => reward.floor === state.run.currentFloor);

  const finalRewards = currentFloorRewards.filter((reward) => reward.type === 'final');
  elements.teamChoiceModalTitle.textContent = 'Dungeon complete';
  elements.teamChoiceModalSubtitle.textContent = 'Choose one available demon for your collection, or exit without collecting.';
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
  bindClick(document.getElementById('modalExitHuntBtn'), () => finishRun('Dungeon complete.', { completed: true }));
}

async function openCollectionReinforcementModal() {
  if (!state.run?.collectionReinforcementAvailable) return;

  try {
    await ensureCollectionLoaded();
    markCollectionReinforcementPlaceholderInteracted();
    renderCollectionReinforcementModal('');
    getModal(elements.teamChoiceModal).show();
  } catch (error) {
    showError(error);
  }
}

function renderCollectionReinforcementModal(query = '') {
  setTeamChoiceModalFullscreen(false);
  const selected = getSelectedCollectionReinforcements();
  const limit = getCollectionReinforcementLimit();
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = getAvailableCollectionReinforcements()
    .filter((demon) => !normalizedQuery || [
      demon.species,
      demon.rarity,
      demon.typeId
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
    .sort(compareCollectionReinforcementDemons);

  elements.teamChoiceModalTitle.textContent = 'Collection reinforcement';
  elements.teamChoiceModalSubtitle.textContent = selected.length
    ? `${selected.length} / ${limit} collection demons staged. Remove one to choose another if the limit is full.`
    : `Choose up to ${limit} collection demon${limit === 1 ? '' : 's'} to place in hand, then drag them into your team.`;
  elements.teamChoiceModalBody.innerHTML = `
    ${selected.length ? `
      <div class="collection-reinforcement-current">
        ${selected.map((demon) => `
          <div>
            <span class="hunt-phase-eyebrow">Staged</span>
            ${renderSharedDemonCard(demon, { className: 'collection-reinforcement-card' })}
            <button class="btn btn-outline-warning btn-sm js-remove-collection-reinforcement" data-instance-id="${escapeHtml(demon.instanceId)}" type="button">Remove</button>
          </div>
        `).join('')}
      </div>
    ` : ''}
    <div class="collection-reinforcement-toolbar">
      <input class="form-control form-control-sm" id="collectionReinforcementSearch" type="search" value="${escapeHtml(query)}" placeholder="Search collection">
    </div>
    <div class="choice-card-grid collection-reinforcement-grid">
      ${candidates.length ? candidates.map(renderCollectionReinforcementChoice).join('') : renderEmptyText('No available collection demons.')}
    </div>
  `;
  elements.teamChoiceModalFooter.innerHTML = `
    <button type="button" class="btn btn-outline-light" data-bs-dismiss="modal">Done</button>
  `;

  document.getElementById('collectionReinforcementSearch')?.addEventListener('input', (event) => {
    renderCollectionReinforcementModal(event.target.value);
    const input = document.getElementById('collectionReinforcementSearch');
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });
  bindClicks('.js-remove-collection-reinforcement', (button) => {
    removeCollectionReinforcement(button.dataset.instanceId);
    renderCollectionReinforcementModal(query);
    renderRun();
  });
  bindClicks('.js-call-collection-reinforcement', (button) => {
    addCollectionReinforcementToPool(Number(button.dataset.demonId));
    getModal(elements.teamChoiceModal).hide();
    renderRun();
  });
}

function renderCollectionReinforcementChoice(demon) {
  const selected = getSelectedCollectionReinforcements()
    .some((item) => Number(item.collectionDemonId) === Number(demon.id));

  return renderDungeonDemonCard(demon, {
    tag: 'button',
    className: 'hunt-choice-card js-call-collection-reinforcement',
    active: selected,
    suppressCollectionMissingTag: true,
    attributes: {
      type: 'button',
      'data-demon-id': demon.id,
      disabled: selected
    }
  });
}

function compareCollectionReinforcementDemons(a, b) {
  return getRarityRank(b.rarity) - getRarityRank(a.rarity) ||
    (Number(b.typeId) || 0) - (Number(a.typeId) || 0) ||
    (Number(b.atk) || 0) - (Number(a.atk) || 0);
}

function getRarityRank(rarity) {
  return {
    common: 1,
    uncommon: 2,
    rare: 3,
    epic: 4,
    legendary: 5,
    mythic: 6
  }[String(rarity || '').toLowerCase()] || 0;
}

async function confirmCollectionReplacement(incomingDemon) {
  await ensureCollectionLoaded();
  const existing = findCollectionReplacement(incomingDemon);
  if (!existing) return true;

  return new Promise((resolve) => {
    const modalElement = document.createElement('div');
    modalElement.className = 'modal fade hunt-modal';
    modalElement.tabIndex = -1;
    modalElement.setAttribute('aria-hidden', 'true');
    modalElement.innerHTML = `
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <h2 class="modal-title h4">Replace collection demon?</h2>
              <p class="text-muted mb-0">This slot already has a demon. Choose whether to keep it or replace it.</p>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <div class="collection-replace-preview">
              <div>
                <span class="hunt-phase-eyebrow">Current</span>
                ${renderDungeonDemonCard(existing, { className: 'collection-replace-card', suppressCollectionMissingTag: true })}
              </div>
              <div>
                <span class="hunt-phase-eyebrow">Incoming</span>
                ${renderDungeonDemonCard(incomingDemon, { className: 'collection-replace-card' })}
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-light" data-choice="keep">Keep Current</button>
            <button type="button" class="btn btn-warning" data-choice="replace">Replace</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalElement);
    const modal = getModal(modalElement);
    let decided = false;

    bindClick(modalElement.querySelector('[data-choice="keep"]'), () => {
      decided = true;
      resolve(false);
      modal.hide();
    });
    bindClick(modalElement.querySelector('[data-choice="replace"]'), () => {
      decided = true;
      resolve(true);
      modal.hide();
    });
    modalElement.addEventListener('hidden.bs.modal', () => {
      if (!decided) resolve(false);
      modalElement.remove();
    }, { once: true });
    modal.show();
  });
}

function renderFinalReward(reward) {
  return `
    <div class="col">
      <div class="reward-item border rounded p-3">
        ${renderRewardDemon(reward.demon)}
        <button class="btn btn-outline-info btn-sm w-100 mt-3 js-save" data-reward-id="${reward.rewardId}" ${reward.saved || hasSavedFinalReward() ? 'disabled' : ''}>
          ${reward.saved ? 'Saved' : 'Extract'}
        </button>
      </div>
    </div>
  `;
}

function hasSavedFinalReward() {
  return (state.run?.rewards || []).some((reward) => reward.type === 'final' && reward.saved);
}

function renderRewardDemon(demon) {
  return renderDungeonDemonCard(demon, { className: 'reward-demon-card' });
}

function bindRewardButtons() {
  bindClicks('.js-save', (button) => saveReward(Number(button.dataset.rewardId)));
}

function bindCollectionReinforcementPlaceholders() {
  bindClicks('.collection-reinforcement-placeholder', () => openCollectionReinforcementModal());
}

function bindDemonDetailCards() {
  document.querySelectorAll('#teamGrid .hunt-demon-card[data-instance-id], #dungeonHandGrid .hunt-demon-card[data-instance-id], #enemyGrid .hunt-demon-card[data-instance-id]').forEach((card) => {
    card.addEventListener('click', (event) => {
      if (event.defaultPrevented || card.classList.contains('is-dragging') || card.classList.contains('suppress-detail-click')) return;

      const demon = getDemonForDetailCard(card);
      if (!demon) return;
      if (demon.recruitSource === 'collection') {
        markCollectionReinforcementStagedInteracted(demon.instanceId);
      }

      openDemonDetailsModal(demon, {
        actions: getDungeonDetailActions()
      });
    });

    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      card.click();
    });
  });
}

function getDemonForDetailCard(card) {
  const instanceId = card.dataset.instanceId;
  if (!instanceId) return null;

  return [
    getSelectedRewardCandidate()?.demon,
    ...(state.isRecruiting ? getRecruitPreviewTeam() : state.run?.team || []),
    ...(isFinalRewardPhase() ? getFinalRewardHand() : []),
    ...(state.isRecruiting ? getRecruitPreviewHand() : state.battleHandPreview || []),
    ...(state.isRecruiting ? getRecruitPreviewEnemyTeam() : state.run?.enemies || [])
  ].filter(Boolean).find((demon) => demon.instanceId === instanceId) || null;
}

function getDungeonDetailActions() {
  const actions = [];

  if (isStrategyPhase()) {
    actions.push({
      label: 'Potions',
      icon: 'potion',
      variant: 'success',
      onClick: () => setMessage('Potions are not available yet.', 'warning')
    });
  }

  return actions;
}

function isStrategyPhase() {
  return Boolean(state.run?.status === 'active' && !state.run.awaitingFinalPick && (!state.run.awaitingRecruit || state.isRecruiting));
}

export {
  showPendingChoiceModal,
  renderTeamChoiceModal,
  openCollectionReinforcementModal,
  renderCollectionReinforcementModal,
  renderCollectionReinforcementChoice,
  compareCollectionReinforcementDemons,
  getRarityRank,
  confirmCollectionReplacement,
  renderFinalReward,
  hasSavedFinalReward,
  renderRewardDemon,
  bindRewardButtons,
  bindCollectionReinforcementPlaceholders,
  bindDemonDetailCards,
  getDemonForDetailCard,
  getDungeonDetailActions,
  isStrategyPhase
};
