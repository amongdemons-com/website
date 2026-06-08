import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const addCollectionReinforcementToPool = (...args) => dungeonActions.addCollectionReinforcementToPool(...args);
const battle = (...args) => dungeonActions.battle(...args);
const ensureCollectionLoaded = (...args) => dungeonActions.ensureCollectionLoaded(...args);
const findCollectionReplacement = (...args) => dungeonActions.findCollectionReplacement(...args);
const getAvailableCollectionReinforcements = (...args) => dungeonActions.getAvailableCollectionReinforcements(...args);
const getCollectionReinforcementLimit = (...args) => dungeonActions.getCollectionReinforcementLimit(...args);
const getRecruitPreviewEnemyTeam = (...args) => dungeonActions.getRecruitPreviewEnemyTeam(...args);
const getRecruitPreviewHand = (...args) => dungeonActions.getRecruitPreviewHand(...args);
const getRecruitPreviewTeam = (...args) => dungeonActions.getRecruitPreviewTeam(...args);
const getSelectedCollectionReinforcements = (...args) => dungeonActions.getSelectedCollectionReinforcements(...args);
const getSelectedRewardCandidate = (...args) => dungeonActions.getSelectedRewardCandidate(...args);
const markCollectionReinforcementPlaceholderInteracted = (...args) => dungeonActions.markCollectionReinforcementPlaceholderInteracted(...args);
const markCollectionReinforcementStagedInteracted = (...args) => dungeonActions.markCollectionReinforcementStagedInteracted(...args);
const renderDungeonDemonCard = (...args) => dungeonActions.renderDungeonDemonCard(...args);
const renderEmptyText = (...args) => dungeonActions.renderEmptyText(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);

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
  const limit = getCollectionReinforcementLimit();
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = getAvailableCollectionReinforcements()
    .filter((demon) => !normalizedQuery || [
      demon.species,
      demon.rarity,
      demon.typeId
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
    .sort(compareCollectionReinforcementDemons);

  elements.teamChoiceModalTitle.textContent = 'Add from collection';
  elements.teamChoiceModalSubtitle.textContent = `Choose a collection demon to add to your hand${limit > 1 ? ', then add another if you want' : ''}.`;
  elements.teamChoiceModalBody.innerHTML = `
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
    className: 'dungeon-choice-card js-call-collection-reinforcement',
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
    modalElement.className = 'modal fade dungeon-modal';
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
                <span class="dungeon-phase-eyebrow">Current</span>
                ${renderDungeonDemonCard(existing, { className: 'collection-replace-card', suppressCollectionMissingTag: true })}
              </div>
              <div>
                <span class="dungeon-phase-eyebrow">Incoming</span>
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

function bindCollectionReinforcementPlaceholders() {
  document.querySelectorAll('.collection-reinforcement-placeholder').forEach((placeholder) => {
    if (placeholder.dataset.collectionReinforcementBound === 'true') return;
    placeholder.dataset.collectionReinforcementBound = 'true';
    placeholder.addEventListener('click', () => openCollectionReinforcementModal());
  });
}

function bindDemonDetailCards() {
  document.querySelectorAll('#teamGrid .dungeon-demon-card[data-instance-id], #dungeonHandGrid .dungeon-demon-card[data-instance-id], #enemyGrid .dungeon-demon-card[data-instance-id], #dungeonRewardGrid .dungeon-demon-card[data-instance-id]').forEach((card) => {
    if (card.dataset.demonDetailBound === 'true') return;
    card.dataset.demonDetailBound = 'true';

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
  const selectedReward = getSelectedRewardCandidate();

  if (card.closest('#dungeonRewardGrid')) {
    return selectedReward?.demon || null;
  }

  return [
    selectedReward?.demon,
    ...(state.isRecruiting ? getRecruitPreviewTeam() : state.run?.team || []),
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
  return Boolean(state.run?.status === 'active' && (!state.run.awaitingRecruit || state.isRecruiting));
}

export {
  openCollectionReinforcementModal,
  renderCollectionReinforcementModal,
  renderCollectionReinforcementChoice,
  compareCollectionReinforcementDemons,
  getRarityRank,
  confirmCollectionReplacement,
  bindCollectionReinforcementPlaceholders,
  bindDemonDetailCards,
  getDemonForDetailCard,
  getDungeonDetailActions,
  isStrategyPhase
};
