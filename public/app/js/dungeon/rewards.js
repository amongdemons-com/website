import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon, renderSoulAmount, getRarityColor } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const battle = (...args) => dungeonActions.battle(...args);
const canAddDemonToFormationLane = (...args) => dungeonActions.canAddDemonToFormationLane(...args);
const confirmCollectionReplacement = (...args) => dungeonActions.confirmCollectionReplacement(...args);
const ensureRecruitDraft = (...args) => dungeonActions.ensureRecruitDraft(...args);
const findDraftDemon = (...args) => dungeonActions.findDraftDemon(...args);
const getDemonFormationRow = (...args) => dungeonActions.getDemonFormationRow(...args);
const getDemonPosition = (...args) => dungeonActions.getDemonPosition(...args);
const getDraftPayloadSource = (...args) => dungeonActions.getDraftPayloadSource(...args);
const getDraftPoolIndex = (...args) => dungeonActions.getDraftPoolIndex(...args);
const getDraftTeamIndex = (...args) => dungeonActions.getDraftTeamIndex(...args);
const getCollectionStatPreviewDemon = (...args) => dungeonActions.getCollectionStatPreviewDemon(...args);
const getFormationLaneInfo = (...args) => dungeonActions.getFormationLaneInfo(...args);
const getHandDropPosition = (...args) => dungeonActions.getHandDropPosition(...args);
const getLaneDropDraftIndex = (...args) => dungeonActions.getLaneDropDraftIndex(...args);
const getRecruitTeamLimit = (...args) => dungeonActions.getRecruitTeamLimit(...args);
const hasPendingBuffChoices = (...args) => dungeonActions.hasPendingBuffChoices(...args);
const loadStartOptions = (...args) => dungeonActions.loadStartOptions(...args);
const normalizeFormationRow = (...args) => dungeonActions.normalizeFormationRow(...args);
const refreshRecruitDraftOrder = (...args) => dungeonActions.refreshRecruitDraftOrder(...args);
const refreshRecruitDraftPoolOrder = (...args) => dungeonActions.refreshRecruitDraftPoolOrder(...args);
const removeDraftDemon = (...args) => dungeonActions.removeDraftDemon(...args);
const renderDungeonDemonCard = (...args) => dungeonActions.renderDungeonDemonCard(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const syncRecruitDraftSelection = (...args) => dungeonActions.syncRecruitDraftSelection(...args);

function openCashoutModal() {
  if (!canExtractRun()) return;

  const subtitle = document.getElementById('cashoutModalSubtitle');
  if (subtitle) subtitle.textContent = 'Choose what leaves the dungeon with you.';
  renderCashoutModal();
  getModal(elements.cashoutModal).show();
}

function renderCashoutModal() {
  const candidate = getSelectedRewardCandidate();
  const earned = getPayoutPreview(candidate);
  const demon = candidate?.demon ? getCollectionStatPreviewDemon(candidate.demon) : null;
  const demonName = escapeHtml(demon?.species || 'Demon');
  const demonRarity = String(demon?.rarity || 'common').toLowerCase();
  const demonRarityLabel = escapeHtml(capitalize(demonRarity));
  const demonRarityColor = escapeHtml(getRarityColor(demonRarity));

  elements.cashoutModalBody.innerHTML = `
    <div class="cashout-summary cashout-extract-summary">
      <div class="cashout-selected-reward">
        ${demon ? renderDungeonDemonCard(demon, {
          className: 'cashout-demon-card',
          suppressCollectionMissingTag: true,
          attributes: { 'data-instance-id': demon.instanceId || `extract-${candidate.key}` }
        }) : `
          <div class="dungeon-reward-empty">
            <span>No demon selected</span>
          </div>
        `}
      </div>
      <div class="cashout-extract-copy">
        <div class="cashout-demon-summary">
          <h3 class="cashout-demon-name-line">${demon ? `
            <span class="cashout-rarity-label" style="--rarity-color: ${demonRarityColor}">${demonRarityLabel}</span>
            <span>${demonName}</span>
          ` : 'No Demon'}</h3>
          <p>${demon
            ? 'Will be added to your collection.'
            : 'Extract now to claim run rewards only.'}</p>
        </div>
        <div class="cashout-section-title pt-3">
          <span>Run Rewards</span>
        </div>
        <div class="cashout-reward-chips" aria-label="Dungeon rewards">
          <span>${renderIcon('stars')}${earned.xp || 0} XP</span>
          ${renderSoulAmount(earned.souls || 0, { className: 'soul-chip cashout-soul-amount' })}
        </div>
        <div class="cashout-divider" aria-hidden="true"></div>
      </div>
      <div class="cashout-extract-note">
        ${renderIcon('info')}
        <span>Your run will end after extraction.</span>
      </div>
    </div>
  `;
  elements.cashoutConfirmBtn.disabled = false;
}

function getRewardCandidates() {
  if (!state.run?.awaitingRecruit || !state.isRecruiting) return [];

  ensureRecruitDraft();
  return [
    ...(state.recruitDraftTeam || []).map((demon) => ({
      key: getRewardCandidateKey(demon),
      source: getDraftPayloadSource(demon),
      origin: 'team',
      instanceId: demon.originalInstanceId || demon.instanceId,
      rewardId: demon.rewardId || null,
      demon
    })),
    ...(state.recruitDraftPool || []).map((demon) => ({
      key: getRewardCandidateKey(demon),
      source: getDraftPayloadSource(demon),
      origin: 'pool',
      instanceId: demon.originalInstanceId || demon.instanceId,
      rewardId: demon.rewardId || null,
      demon
    }))
  ].filter((candidate) => canRewardCandidate(candidate));
}

function getRewardCandidateByKey(key) {
  return getRewardCandidates().find((candidate) => candidate.key === key) || null;
}

function getSelectedRewardCandidate() {
  if (state.rewardDraftCandidate) return cloneRewardCandidate(state.rewardDraftCandidate);

  const candidate = getRewardCandidateByKey(state.selectedRewardDemonKey);
  if (!candidate && state.selectedRewardDemonKey) state.selectedRewardDemonKey = null;
  return candidate;
}

function setRewardSelection(candidate) {
  state.rewardDraftCandidate = candidate ? cloneRewardCandidate(candidate) : null;
  state.selectedRewardDemonKey = state.rewardDraftCandidate?.key || null;
}

function cloneRewardCandidate(candidate) {
  if (!candidate) return null;
  return {
    ...candidate,
    demon: candidate.demon ? { ...candidate.demon } : null
  };
}

function canRewardCandidate(candidate) {
  return candidate.source === 'reward' || candidate.source === 'team' || candidate.source === 'reserved';
}

function getRewardCandidateKey(demon) {
  if (demon.recruitSource === 'reward') return `reward:${demon.rewardId}`;
  if (demon.recruitSource === 'collection') return `collection:${demon.collectionDemonId}`;
  if (demon.recruitSource === 'reserved') return `reserved:${demon.originalInstanceId || demon.instanceId}`;
  return `team:${demon.originalInstanceId || demon.instanceId}`;
}

function getRewardCandidateFromPayload(payload) {
  if (!payload) return null;
  if (payload.type === 'reward-selection') return getSelectedRewardCandidate();
  if (payload.type !== 'recruit-pool' && payload.type !== 'recruit-team') return null;

  ensureRecruitDraft();
  const collection = payload.type === 'recruit-pool' ? state.recruitDraftPool : state.recruitDraftTeam;
  const demon = findDraftDemon(collection, payload.instanceId);
  if (!demon) return null;

  const candidate = {
    key: getRewardCandidateKey(demon),
    source: getDraftPayloadSource(demon),
    origin: payload.type === 'recruit-pool' ? 'pool' : 'team',
    instanceId: demon.originalInstanceId || demon.instanceId,
    rewardId: demon.rewardId || null,
    demon
  };
  return canRewardCandidate(candidate) ? candidate : null;
}

function canDropOnRewardBox(payload) {
  return Boolean(getRewardCandidateFromPayload(payload));
}

function applyRewardBoxDrop(payload) {
  const candidate = getRewardCandidateFromPayload(payload);
  if (!candidate) return;
  if (candidate.key === state.selectedRewardDemonKey && state.rewardDraftCandidate) return;

  const previous = getSelectedRewardCandidate();
  const sourcePlacement = getRewardCandidateCurrentPlacement(candidate);
  const reserved = detachRewardCandidate(candidate);
  if (!reserved) return;

  if (previous && previous.key !== reserved.key) {
    insertRewardCandidateIntoPlacement(previous, sourcePlacement) ||
      restoreRewardCandidateToOrigin(previous);
  }
  setRewardSelection(reserved);
  refreshRewardDraftState();
}

function clearRewardSelection(options = {}) {
  const { restore = false } = options;
  const candidate = restore ? getSelectedRewardCandidate() : null;
  state.selectedRewardDemonKey = null;
  state.rewardDraftCandidate = null;
  if (candidate) {
    restoreRewardCandidateToOrigin(candidate);
    refreshRewardDraftState();
  }
}

function detachRewardCandidate(candidate) {
  if (!candidate) return null;
  ensureRecruitDraft();

  if (candidate.origin === 'team') {
    const index = getDraftTeamIndex(candidate.demon?.instanceId);
    const demon = removeDraftDemon(state.recruitDraftTeam, candidate.demon?.instanceId);
    if (!demon) return null;
    return cloneRewardCandidate({
      ...candidate,
      originIndex: index,
      originPosition: getDemonPosition(demon),
      originFormationRow: getDemonFormationRow(demon, state.recruitDraftTeam, index),
      demon
    });
  }

  if (candidate.origin === 'pool') {
    const index = getDraftPoolIndex(candidate.demon?.instanceId);
    const demon = removeDraftDemon(state.recruitDraftPool, candidate.demon?.instanceId);
    if (!demon) return null;
    return cloneRewardCandidate({
      ...candidate,
      originIndex: index,
      originPosition: getDemonPosition(demon),
      demon
    });
  }

  return cloneRewardCandidate(candidate);
}

function getRewardCandidateCurrentPlacement(candidate) {
  if (!candidate?.demon) return null;

  if (candidate.origin === 'team') {
    const index = getDraftTeamIndex(candidate.demon.instanceId);
    return {
      zone: 'team',
      index,
      position: getDemonPosition(candidate.demon),
      rowIndex: getDemonFormationRow(candidate.demon, state.recruitDraftTeam, index)
    };
  }

  if (candidate.origin === 'pool') {
    return {
      zone: 'pool',
      index: getDraftPoolIndex(candidate.demon.instanceId),
      position: getDemonPosition(candidate.demon)
    };
  }

  return null;
}

function insertRewardCandidateIntoPlacement(candidate, placement) {
  if (!placement) return false;

  if (placement.zone === 'team') {
    return insertRewardCandidateIntoTeam(
      candidate,
      placement.position || getDemonPosition(candidate?.demon),
      Number.isInteger(placement.index) ? placement.index : null,
      Number.isInteger(placement.rowIndex) ? placement.rowIndex : null
    );
  }

  if (placement.zone === 'pool') {
    return insertRewardCandidateIntoPool(
      candidate,
      placement.position || getDemonPosition(candidate?.demon),
      Number.isInteger(placement.index) ? placement.index : null
    );
  }

  return false;
}

function restoreRewardCandidateToOrigin(candidate) {
  if (!candidate) return false;
  if (!state.isRecruiting || !state.run?.awaitingRecruit) return false;
  ensureRecruitDraft();

  if (candidate.origin === 'team') {
    return insertRewardCandidateIntoTeam(
      candidate,
      candidate.originPosition || getDemonPosition(candidate.demon),
      Number.isInteger(candidate.originIndex) ? candidate.originIndex : null,
      Number.isInteger(candidate.originFormationRow) ? candidate.originFormationRow : null
    );
  }

  if (candidate.origin === 'pool') {
    return insertRewardCandidateIntoPool(
      candidate,
      candidate.originPosition || getDemonPosition(candidate.demon),
      Number.isInteger(candidate.originIndex) ? candidate.originIndex : null
    );
  }

  return false;
}

function insertRewardCandidateIntoTeam(candidate, position, insertIndex = null, rowIndex = null) {
  if (!candidate?.demon) return false;
  ensureRecruitDraft();

  const targetRow = normalizeFormationRow(rowIndex);
  const draftDemon = {
    ...candidate.demon,
    position: position || getDemonPosition(candidate.demon),
    formationRow: targetRow,
    formationSlot: targetRow
  };

  if (Number.isInteger(insertIndex) && insertIndex >= 0) {
    state.recruitDraftTeam.splice(Math.min(insertIndex, state.recruitDraftTeam.length), 0, draftDemon);
  } else {
    state.recruitDraftTeam.push(draftDemon);
  }
  return true;
}

function insertRewardCandidateIntoPool(candidate, position, insertIndex = null) {
  if (!candidate?.demon) return false;
  ensureRecruitDraft();

  const draftDemon = {
    ...candidate.demon,
    position: getHandDropPosition(position || 'hand', candidate.demon)
  };
  delete draftDemon.formationRow;
  delete draftDemon.formationSlot;

  if (Number.isInteger(insertIndex) && insertIndex >= 0) {
    state.recruitDraftPool.splice(Math.min(insertIndex, state.recruitDraftPool.length), 0, draftDemon);
  } else {
    state.recruitDraftPool.push(draftDemon);
  }
  return true;
}

function refreshRewardDraftState() {
  refreshRecruitDraftOrder();
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function removeRewardSelection() {
  clearRewardSelection({ restore: true });
}

function canMoveRewardSelectionToTeam(lane) {
  const candidate = getSelectedRewardCandidate();
  if (!candidate) return false;
  if (!state.isRecruiting || !state.run?.awaitingRecruit) return true;
  return (state.recruitDraftTeam || []).length < getRecruitTeamLimit() &&
    canAddDemonToFormationLane(state.recruitDraftTeam, lane);
}

function canMoveRewardSelectionToPool() {
  return Boolean(getSelectedRewardCandidate());
}

function moveRewardSelectionToTeamLane(lane, position, event = null, insertIndex = null) {
  const candidate = getSelectedRewardCandidate();
  if (!candidate) return false;

  if (!state.isRecruiting || !state.run?.awaitingRecruit) {
    clearRewardSelection();
    return true;
  }

  if (!canMoveRewardSelectionToTeam(lane)) return false;

  const laneInfo = getFormationLaneInfo(lane);
  const targetIndex = Number.isInteger(insertIndex)
    ? insertIndex
    : getLaneDropDraftIndex(lane, event?.clientY, event?.clientX);
  clearRewardSelection();
  const inserted = insertRewardCandidateIntoTeam(
    candidate,
    position || laneInfo?.position || getDemonPosition(candidate.demon),
    targetIndex,
    laneInfo?.rowIndex
  );
  refreshRewardDraftState();
  return inserted;
}

function moveRewardSelectionToPoolLane(lane, event = null, insertIndex = null) {
  const candidate = getSelectedRewardCandidate();
  if (!candidate) return false;

  if (!state.isRecruiting || !state.run?.awaitingRecruit) {
    clearRewardSelection();
    return true;
  }

  const targetIndex = Number.isInteger(insertIndex)
    ? insertIndex
    : getLaneDropDraftIndex(lane, event?.clientY, event?.clientX);
  clearRewardSelection();
  const inserted = insertRewardCandidateIntoPool(
    candidate,
    lane?.dataset.formationDrop || 'hand',
    targetIndex
  );
  refreshRewardDraftState();
  return inserted;
}

function swapRewardSelectionWithDraftTarget(targetSide, targetInstanceId) {
  const candidate = getSelectedRewardCandidate();
  if (!candidate || !targetInstanceId) return false;

  if (!state.isRecruiting || !state.run?.awaitingRecruit) {
    clearRewardSelection();
    return true;
  }

  const targetPayload = {
    type: targetSide === 'team' ? 'recruit-team' : 'recruit-pool',
    instanceId: targetInstanceId
  };
  const targetCandidate = getRewardCandidateFromPayload(targetPayload);
  if (!targetCandidate || targetCandidate.key === candidate.key) return false;

  const targetIndex = targetSide === 'team' ? getDraftTeamIndex(targetInstanceId) : getDraftPoolIndex(targetInstanceId);
  const targetPosition = getDemonPosition(targetCandidate.demon);
  const targetRow = targetSide === 'team'
    ? getDemonFormationRow(targetCandidate.demon, state.recruitDraftTeam, targetIndex)
    : null;
  const reservedTarget = detachRewardCandidate(targetCandidate);
  if (!reservedTarget) return false;

  clearRewardSelection();
  const inserted = targetSide === 'team'
    ? insertRewardCandidateIntoTeam(candidate, targetPosition, targetIndex, targetRow)
    : insertRewardCandidateIntoPool(candidate, targetPosition, targetIndex);
  if (!inserted) {
    restoreRewardCandidateToOrigin(reservedTarget);
    refreshRewardDraftState();
    return false;
  }

  setRewardSelection(reservedTarget);
  refreshRewardDraftState();
  return true;
}

function getPayoutPreview(selectedCandidate = null) {
  const earned = state.run?.earned || { xp: 0, souls: 0 };
  const candidate = selectedCandidate === true
    ? getSelectedRewardCandidate()
    : selectedCandidate;
  return {
    xp: Number(earned.xp) || 0,
    souls: state.run?.status === 'defeated'
      ? 0
      : (Number(earned.souls) || 0) + getPendingDiscardedSoulValue(candidate)
  };
}

function getPendingDiscardedSoulValue(candidate = null) {
  const excludedRewardIds = getKeptOrExtractedRewardIds(candidate);

  return (state.run?.rewards || []).reduce((total, reward) => {
    if (!isPendingDiscardSoulReward(reward, excludedRewardIds)) return total;
    return total + getRewardSoulValue(reward);
  }, 0);
}

function getKeptOrExtractedRewardIds(candidate = null) {
  const rewardIds = new Set();

  if ((candidate?.source === 'reward' || candidate?.origin === 'reserved') && candidate.rewardId) {
    rewardIds.add(Number(candidate.rewardId));
  }

  (state.recruitDraftTeam || []).forEach((demon) => {
    if ((demon.recruitSource === 'reward' || demon.rewardId) && demon.rewardId) {
      rewardIds.add(Number(demon.rewardId));
    }
  });

  return rewardIds;
}

function isPendingDiscardSoulReward(reward, excludedRewardIds = new Set()) {
  if (!reward || reward.type !== 'recruit') return false;
  if (Number(reward.floor) !== Number(state.run?.currentFloor)) return false;
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

function canExtractRun() {
  return Boolean(state.run?.status === 'active' && state.run?.awaitingRecruit && state.isRecruiting && !hasPendingBuffChoices(state.run));
}

function syncRewardSelectionFromRun() {
  if (!state.run || !Object.prototype.hasOwnProperty.call(state.run, 'extractChoice')) return;
  const choice = state.run.extractChoice;
  if (!choice?.demon) {
    setRewardSelection(null);
    return;
  }

  const key = choice.key || getStoredExtractChoiceKey(choice);
  setRewardSelection({
    key,
    source: choice.source || 'reserved',
    origin: 'reserved',
    instanceId: choice.instanceId || choice.demon.instanceId,
    rewardId: choice.rewardId || null,
    demon: {
      ...choice.demon,
      instanceId: choice.demon.instanceId || choice.instanceId || `reserved-${key}`,
      originalInstanceId: choice.instanceId || choice.demon.originalInstanceId || choice.demon.instanceId,
      rewardId: choice.rewardId || choice.demon.rewardId || null,
      rewardCandidateKey: key,
      recruitSource: 'reserved'
    }
  });
}

function getStoredExtractChoiceKey(choice) {
  if (choice?.key) return choice.key;
  if (choice?.source === 'reward' && choice.rewardId) return `reward:${choice.rewardId}`;
  if (choice?.source === 'team' && choice.instanceId) return `team:${choice.instanceId}`;
  return `reserved:${choice?.instanceId || choice?.rewardId || 'demon'}`;
}

async function cashOutDungeon() {
  if (!state.run || !canExtractRun()) return;

  const candidate = getSelectedRewardCandidate();
  if (candidate && !(await confirmCollectionReplacement(candidate.demon))) return;

  await cashOut({
    button: elements.cashoutConfirmBtn,
    clearCollection: Boolean(candidate),
    body: getCashoutBodyForCandidate(candidate)
  });
}

function getCashoutBodyForCandidate(candidate) {
  if (!candidate) return { skipDemon: true };
  if (candidate.source === 'reserved' || candidate.origin === 'reserved') {
    return { source: 'reserved' };
  }
  return {
    source: candidate.source,
    instanceId: candidate.instanceId,
    rewardId: candidate.rewardId
  };
}

async function cashOut({ button, body, clearCollection = false }) {
  await withBusy(button, async () => {
    try {
      const result = await api(activeRunPath('cashout'), { method: 'POST', body });
      await finishCashout(result, { clearCollection, skippedDemon: Boolean(body.skipDemon) });
    } catch (error) {
      showError(error);
    }
  });
}

async function finishCashout(result, options = {}) {
  const skippedDemon = Boolean(options.skippedDemon);
  const demonMessage = skippedDemon ? '' : getCashoutDemonMessage(result);

  clearCurrentRun();
  if (options.clearCollection) state.collectionDemons = null;
  state.run = null;
  clearRewardSelection();
  state.battleHandPreview = null;
  clearRecruitDrafts();
  resetCombatState();
  state.endSummary = {
    title: 'Dungeon ended',
    outcome: 'extraction',
    message: skippedDemon ? 'No demon was extracted.' : demonMessage,
    demon: skippedDemon ? null : result.demon || null,
    xp: result.xp,
    souls: result.souls
  };
  state.endedReplayRun = null;
  state.endNotice = {
    html: skippedDemon
      ? renderEarnedNoticeHtml('Dungeon ended.', result)
      : renderEarnedNoticeHtml(`Dungeon ended. ${demonMessage}`, result),
    type: 'success'
  };
  getModal(elements.cashoutModal).hide();
  await loadStartOptions();
  renderRun();
}

function renderEarnedNoticeHtml(message, result) {
  return `${escapeHtml(message)} You earned ${renderXpNoticeAmount(result.xp)} and ${renderSoulAmount(Number(result.souls) || 0, { className: 'soul-chip soul-chip-inline fight-log-soul-amount' })}.`;
}

function renderXpNoticeAmount(xp) {
  return `<span class="fight-log-reward-inline">${renderIcon('stars')}${escapeHtml(String(Number(xp) || 0))} XP</span>`;
}

function getCashoutDemonMessage(result) {
  const species = result.demon?.species || 'Demon';
  return result.replaced
    ? `${species} replaced your previous collection demon.`
    : `${species} joined your collection.`;
}

export {
  openCashoutModal,
  renderCashoutModal,
  getRewardCandidates,
  getRewardCandidateByKey,
  getSelectedRewardCandidate,
  setRewardSelection,
  cloneRewardCandidate,
  canRewardCandidate,
  getRewardCandidateKey,
  getRewardCandidateFromPayload,
  canDropOnRewardBox,
  applyRewardBoxDrop,
  clearRewardSelection,
  detachRewardCandidate,
  getRewardCandidateCurrentPlacement,
  insertRewardCandidateIntoPlacement,
  restoreRewardCandidateToOrigin,
  insertRewardCandidateIntoTeam,
  insertRewardCandidateIntoPool,
  refreshRewardDraftState,
  removeRewardSelection,
  canMoveRewardSelectionToTeam,
  canMoveRewardSelectionToPool,
  moveRewardSelectionToTeamLane,
  moveRewardSelectionToPoolLane,
  swapRewardSelectionWithDraftTarget,
  getPayoutPreview,
  canExtractRun,
  syncRewardSelectionFromRun,
  getStoredExtractChoiceKey,
  cashOutDungeon,
  getCashoutBodyForCandidate,
  cashOut,
  finishCashout,
  getCashoutDemonMessage
};
