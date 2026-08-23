import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, DUNGEON_DETAIL_BUFF_STATS_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedCombatStats, openDemonDetailsModal } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const addCollectionReinforcementToPool = (...args) => dungeonActions.addCollectionReinforcementToPool(...args);
const battle = (...args) => dungeonActions.battle(...args);
const ensureCollectionLoaded = (...args) => dungeonActions.ensureCollectionLoaded(...args);
const findCollectionReplacement = (...args) => dungeonActions.findCollectionReplacement(...args);
const getAvailableCollectionReinforcements = (...args) => dungeonActions.getAvailableCollectionReinforcements(...args);
const getCollectionStatPreviewDemon = (...args) => dungeonActions.getCollectionStatPreviewDemon(...args);
const getCollectionReinforcementLimit = (...args) => dungeonActions.getCollectionReinforcementLimit(...args);
const getPreferredDemonPosition = (...args) => dungeonActions.getPreferredDemonPosition(...args);
const getRecruitPreviewEnemyTeam = (...args) => dungeonActions.getRecruitPreviewEnemyTeam(...args);
const getRecruitPreviewHand = (...args) => dungeonActions.getRecruitPreviewHand(...args);
const getRecruitPreviewTeam = (...args) => dungeonActions.getRecruitPreviewTeam(...args);
const applyDungeonCombatStatPreviewToDemon = (...args) => dungeonActions.applyDungeonCombatStatPreviewToDemon(...args);
const getDungeonBaseStatPreviewDemon = (...args) => dungeonActions.getDungeonBaseStatPreviewDemon(...args);
const canExtractRun = (...args) => dungeonActions.canExtractRun(...args);
const getRewardCandidates = (...args) => dungeonActions.getRewardCandidates(...args);
const getSelectedCollectionReinforcements = (...args) => dungeonActions.getSelectedCollectionReinforcements(...args);
const getSelectedRewardCandidate = (...args) => dungeonActions.getSelectedRewardCandidate(...args);
const markCollectionReinforcementPlaceholderInteracted = (...args) => dungeonActions.markCollectionReinforcementPlaceholderInteracted(...args);
const markCollectionReinforcementStagedInteracted = (...args) => dungeonActions.markCollectionReinforcementStagedInteracted(...args);
const openCashoutModal = (...args) => dungeonActions.openCashoutModal(...args);
const renderDungeonDemonCard = (...args) => dungeonActions.renderDungeonDemonCard(...args);
const renderEmptyText = (...args) => dungeonActions.renderEmptyText(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const setRewardSelection = (...args) => dungeonActions.setRewardSelection(...args);
let pendingCollectionReinforcementIds = new Set();
let pendingCollectionReinforcementTarget = null;

async function openCollectionReinforcementModal(options = {}) {
  if (!canOpenCollectionReinforcementModal()) return;

  try {
    await ensureCollectionLoaded();
    markCollectionReinforcementPlaceholderInteracted();
    pendingCollectionReinforcementIds = new Set();
    pendingCollectionReinforcementTarget = normalizeCollectionReinforcementTarget(options.formationTarget);
    renderCollectionReinforcementModal('');
    elements.teamChoiceModal.classList.add('is-collection-reinforcement-modal');
    elements.teamChoiceModal.addEventListener('hidden.bs.modal', () => {
      elements.teamChoiceModal.classList.remove('is-collection-reinforcement-modal');
      pendingCollectionReinforcementTarget = null;
    }, { once: true });
    getModal(elements.teamChoiceModal).show();
  } catch (error) {
    showError(error);
  }
}

function normalizeCollectionReinforcementTarget(target) {
  const formationSlot = Math.floor(Number(target?.formationSlot));
  const position = target?.position === 'front' ? 'front' : target?.position === 'back' ? 'back' : null;
  if (!Number.isInteger(formationSlot) || formationSlot < 0 || !position) return null;
  return { formationSlot, position };
}

function canOpenCollectionReinforcementModal() {
  return Boolean(
    state.run?.awaitingRecruit &&
    state.isRecruiting &&
    state.run?.collectionReinforcementAvailable &&
    getSelectedCollectionReinforcements().length < getCollectionReinforcementLimit()
  );
}

function renderCollectionReinforcementModal(query = '') {
  setTeamChoiceModalFullscreen(false);
  const limit = getCollectionReinforcementLimit();
  const alreadySelectedCount = getSelectedCollectionReinforcements().length;
  const remaining = Math.max(0, limit - alreadySelectedCount);
  const selectedCount = pendingCollectionReinforcementIds.size;
  const isStartingTeam = Number(state.run?.currentFloor) === 0;
  const destination = pendingCollectionReinforcementTarget
    ? `team slot ${pendingCollectionReinforcementTarget.formationSlot + 1}`
    : isStartingTeam ? 'your starting team' : 'your hand';
  const normalizedQuery = query.trim().toLowerCase();
  const candidates = getAvailableCollectionReinforcements()
    .filter((demon) => !normalizedQuery || [
      demon.species,
      demon.rarity,
      demon.typeId
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)))
    .sort(compareCollectionReinforcementDemons);

  elements.teamChoiceModalTitle.textContent = 'Demon Collection';
  elements.teamChoiceModalSubtitle.textContent = remaining === 1
    ? `Choose one demon to add to ${destination}.`
    : `Choose up to ${remaining} demons to add to ${destination}.`;
  elements.teamChoiceModalBody.innerHTML = `
    <div class="collection-reinforcement-toolbar">
      <input class="form-control form-control-sm" id="collectionReinforcementSearch" type="search" value="${escapeHtml(query)}" placeholder="Search collection">
    </div>
    <div class="choice-card-grid collection-reinforcement-grid">
      ${candidates.length ? candidates.map(renderCollectionReinforcementChoice).join('') : renderEmptyText('No bound demons can answer this call. Extract more demons, then return.')}
    </div>
  `;
  elements.teamChoiceModalFooter.innerHTML = `
    <button type="button" class="btn btn-glass-muted" data-bs-dismiss="modal">Cancel</button>
    <button type="button" class="btn btn-primary" id="addCollectionReinforcementsBtn" ${selectedCount ? '' : 'disabled'}>
      ${selectedCount
        ? `Add ${selectedCount} Demon${selectedCount === 1 ? '' : 's'} to ${(pendingCollectionReinforcementTarget || isStartingTeam) ? 'Team' : 'Hand'}`
        : 'Select Demons'}
    </button>
  `;

  document.getElementById('collectionReinforcementSearch')?.addEventListener('input', (event) => {
    renderCollectionReinforcementModal(event.target.value);
    const input = document.getElementById('collectionReinforcementSearch');
    input?.focus();
    input?.setSelectionRange(input.value.length, input.value.length);
  });
  bindClicks('.js-call-collection-reinforcement', (button) => {
    const demonId = Number(button.dataset.demonId);
    if (pendingCollectionReinforcementIds.has(demonId)) {
      pendingCollectionReinforcementIds.delete(demonId);
    } else if (pendingCollectionReinforcementIds.size < remaining) {
      pendingCollectionReinforcementIds.add(demonId);
    }
    renderCollectionReinforcementModal(query);
  }, elements.teamChoiceModalBody);
  bindClick(document.getElementById('addCollectionReinforcementsBtn'), () => {
    addPendingCollectionReinforcements();
    pendingCollectionReinforcementIds = new Set();
    getModal(elements.teamChoiceModal).hide();
    renderRun();
  });
}

function addPendingCollectionReinforcements() {
  const selectedIds = Array.from(pendingCollectionReinforcementIds);
  const targetedDemonId = getBestCollectionReinforcementForTarget(selectedIds, pendingCollectionReinforcementTarget)?.id;
  const orderedIds = targetedDemonId
    ? [Number(targetedDemonId), ...selectedIds.filter((demonId) => Number(demonId) !== Number(targetedDemonId))]
    : selectedIds;

  orderedIds.forEach((demonId) => addCollectionReinforcementToPool(demonId, {
    formationTarget: Number(demonId) === Number(targetedDemonId)
      ? pendingCollectionReinforcementTarget
      : null
  }));
}

function getBestCollectionReinforcementForTarget(selectedIds, target) {
  if (!target || !selectedIds.length) return null;
  const selected = new Set(selectedIds.map(Number));
  return getAvailableCollectionReinforcements()
    .filter((demon) => selected.has(Number(demon.id)))
    .sort((a, b) => (
      getCollectionTargetFitScore(b, target) - getCollectionTargetFitScore(a, target) ||
      compareCollectionReinforcementDemons(a, b)
    ))[0] || null;
}

function getCollectionTargetFitScore(demon, target) {
  return getPreferredDemonPosition(demon) === target?.position ? 1 : 0;
}

function renderCollectionReinforcementChoice(demon) {
  const demonId = Number(demon.id);
  const selected = pendingCollectionReinforcementIds.has(demonId);
  const remaining = Math.max(0, getCollectionReinforcementLimit() - getSelectedCollectionReinforcements().length);
  const selectionFull = pendingCollectionReinforcementIds.size >= remaining;
  const displayDemon = applyDungeonCombatStatPreviewToDemon(demon);

  return renderDungeonDemonCard(displayDemon, {
    tag: 'button',
    className: 'dungeon-choice-card js-call-collection-reinforcement',
    active: selected,
    suppressCollectionMissingTag: true,
    attributes: {
      type: 'button',
      'data-demon-id': demon.id,
      'aria-pressed': selected,
      disabled: selectionFull && !selected
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
            <button type="button" class="btn btn-glass-muted" data-choice="keep">Keep Current</button>
            <button type="button" class="btn btn-glass-danger" data-choice="replace">Replace</button>
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
  document.querySelectorAll('.collection-reinforcement-placeholder, .collection-reinforcement-team-slot').forEach((placeholder) => {
    if (placeholder.dataset.collectionReinforcementBound === 'true') return;
    placeholder.dataset.collectionReinforcementBound = 'true';
    placeholder.addEventListener('click', () => {
      const slot = placeholder.closest('#teamGrid .formation-slot');
      openCollectionReinforcementModal({
        formationTarget: slot ? {
          formationSlot: slot.dataset.formationSlot,
          position: slot.dataset.formationPosition
        } : null
      });
    });
  });
}

function bindDemonDetailCards() {
  document.querySelectorAll('#teamGrid .dungeon-demon-card[data-instance-id], #dungeonHandGrid .dungeon-demon-card[data-instance-id], #enemyGrid .dungeon-demon-card[data-instance-id], #dungeonRewardGrid .dungeon-demon-card[data-instance-id]').forEach((card) => {
    if (card.dataset.demonDetailBound === 'true') return;
    card.dataset.demonDetailBound = 'true';

    card.addEventListener('click', (event) => {
      if (event.defaultPrevented || card.classList.contains('is-dragging') || card.classList.contains('suppress-detail-click')) return;

      openDungeonDemonDetails(card);
    });

    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      card.click();
    });
  });
}

function openDungeonDemonDetails(card, showBuffStats = null, focusStatToggle = false) {
  const isPlayerTeamCard = Boolean(card?.closest('#teamGrid'));
  const shouldShowBuffStats = isPlayerTeamCard
    ? showBuffStats ?? readDungeonDetailBuffStatsPreference()
    : true;
  const sourceDemon = isPlayerTeamCard ? getPlayerTeamDetailSourceDemon(card) : null;
  const baseDemon = sourceDemon ? getDungeonBaseStatPreviewDemon(sourceDemon) : null;
  const buffedDemon = sourceDemon ? applyDungeonCombatStatPreviewToDemon(sourceDemon) : null;
  const demon = isPlayerTeamCard
    ? shouldShowBuffStats ? buffedDemon : baseDemon
    : getDemonForDetailCard(card);
  if (!demon?.instanceId) return;

  const extractionCandidate = getExtractionCandidateForDetailCard(card);
  if (demon.recruitSource === 'collection') {
    markCollectionReinforcementStagedInteracted(demon.instanceId);
  }

  openDemonDetailsModal(demon, {
    actions: getDungeonDetailActions(extractionCandidate),
    statToggle: isPlayerTeamCard && hasDungeonBuffedStatDifference(baseDemon, buffedDemon)
      ? {
        checked: shouldShowBuffStats,
        label: 'Show with buffs applied',
        description: 'Switch between this demon\'s base stats and its stats with active Pacts and buffs applied.',
        onChange: (checked) => {
          writeDungeonDetailBuffStatsPreference(checked);
          openDungeonDemonDetails(card, checked, true);
        }
      }
      : null
  });

  if (focusStatToggle) {
    window.requestAnimationFrame?.(() => {
      document.querySelector('[data-demon-detail-stat-toggle]')?.focus();
    });
  }
}

function getExtractionCandidateForDetailCard(card) {
  if (!canExtractRun() || card?.closest('#enemyGrid')) return null;
  const instanceId = card?.dataset.instanceId;
  if (!instanceId) return null;

  return getRewardCandidates().find((candidate) => (
    candidate.instanceId === instanceId ||
    candidate.demon?.instanceId === instanceId ||
    candidate.demon?.originalInstanceId === instanceId
  )) || null;
}

function getDemonForDetailCard(card) {
  const instanceId = card.dataset.instanceId;
  if (!instanceId) return null;
  const selectedReward = getSelectedRewardCandidate();

  if (card.closest('#dungeonRewardGrid')) {
    return selectedReward?.demon ? applyDungeonCombatStatPreviewToDemon(getCollectionStatPreviewDemon(selectedReward.demon)) : null;
  }

  return [
    ...(state.isRecruiting ? getRecruitPreviewTeam() : state.run?.team || []).map(applyDungeonCombatStatPreviewToDemon),
    ...(state.isRecruiting ? getRecruitPreviewHand() : state.battleHandPreview || []).map(applyDungeonCombatStatPreviewToDemon),
    ...(state.isRecruiting ? getRecruitPreviewEnemyTeam() : state.run?.enemies || [])
  ].filter(Boolean).find((demon) => demon.instanceId === instanceId) || null;
}

function getPlayerTeamDetailSourceDemon(card) {
  const instanceId = card?.dataset.instanceId;
  if (!instanceId) return null;
  const team = state.isRecruiting
    ? state.recruitDraftTeam || []
    : state.run?.team || [];

  return team.find((demon) => (
    demon?.instanceId === instanceId
    || demon?.originalInstanceId === instanceId
  )) || null;
}

function hasDungeonBuffedStatDifference(baseDemon = {}, buffedDemon = {}) {
  return getDungeonDetailAttackValue(baseDemon) !== getDungeonDetailAttackValue(buffedDemon)
    || Math.round(Number(baseDemon.maxHp) || Number(baseDemon.hp) || 0) !== Math.round(Number(buffedDemon.maxHp) || Number(buffedDemon.hp) || 0)
    || Math.round(Number(baseDemon.speed) || 0) !== Math.round(Number(buffedDemon.speed) || 0);
}

function getDungeonDetailAttackValue(demon = {}) {
  const value = Number(demon.effectiveAtk ?? demon.atk);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

function readDungeonDetailBuffStatsPreference() {
  try {
    const stored = localStorage.getItem(DUNGEON_DETAIL_BUFF_STATS_KEY);
    return stored === null ? true : stored !== '0';
  } catch (error) {
    return true;
  }
}

function writeDungeonDetailBuffStatsPreference(showBuffStats) {
  try {
    localStorage.setItem(DUNGEON_DETAIL_BUFF_STATS_KEY, showBuffStats ? '1' : '0');
  } catch (error) {
    // The checkbox still works for this visit when browser storage is blocked.
  }
}

function getDungeonDetailActions(extractionCandidate = null) {
  const actions = [];

  if (extractionCandidate) {
    actions.push({
      label: 'Extract',
      icon: 'flag',
      variant: 'primary',
      onClick: () => {
        setRewardSelection(extractionCandidate);
        renderRun();
        transitionFromDemonDetailsToCashout();
      }
    });
  }

  // Potions hidden until the feature ships.
  // if (isStrategyPhase()) {
  //   actions.push({
  //     label: 'Potions',
  //     icon: 'potion',
  //     variant: 'success',
  //     onClick: () => setMessage('Potions are not available yet.', 'warning')
  //   });
  // }

  return actions;
}

function transitionFromDemonDetailsToCashout() {
  const detailModalElement = document.getElementById('demonDetailModal');
  if (!detailModalElement?.classList.contains('show')) {
    openCashoutModal();
    return;
  }

  detailModalElement.addEventListener('hidden.bs.modal', openCashoutModal, { once: true });
  getModal(detailModalElement).hide();
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
  openDungeonDemonDetails,
  getDemonForDetailCard,
  getPlayerTeamDetailSourceDemon,
  hasDungeonBuffedStatDifference,
  readDungeonDetailBuffStatsPreference,
  getDungeonDetailActions,
  isStrategyPhase
};
