import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_FLOOR, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const clearRewardSelection = (...args) => dungeonActions.clearRewardSelection(...args);
const getDemonFormationRow = (...args) => dungeonActions.getDemonFormationRow(...args);
const getDemonPosition = (...args) => dungeonActions.getDemonPosition(...args);
const getPreferredDemonPosition = (...args) => dungeonActions.getPreferredDemonPosition(...args);
const getSelectedRewardCandidate = (...args) => dungeonActions.getSelectedRewardCandidate(...args);
const refreshRecruitDraftOrder = (...args) => dungeonActions.refreshRecruitDraftOrder(...args);
const refreshRecruitDraftPoolOrder = (...args) => dungeonActions.refreshRecruitDraftPoolOrder(...args);
const syncRecruitDraftSelection = (...args) => dungeonActions.syncRecruitDraftSelection(...args);

function prepareRecruitStrategyState() {
  clearRecruitSelection();
  clearRewardSelection();
  clearDragState();
  clearRecruitDrafts();
  if (state.run?.collectionReinforcementAvailable) {
    state.collectionReinforcementPlaceholderInteracted = false;
    state.collectionReinforcementStagedInteracted = true;
  }
}

function getCurrentRecruitRewards() {
  if (!state.run) return [];
  return (state.run.rewards || []).filter((reward) => (
    reward.floor === state.run.currentFloor &&
    reward.type === 'recruit' &&
    !reward.recruited
  ));
}

function getRecruitPreviewTeam() {
  ensureRecruitDraft();
  return cloneDemons(state.recruitDraftTeam || []);
}

function getRecruitPreviewHand() {
  ensureRecruitDraft();
  return cloneDemons(state.recruitDraftPool || []);
}

function getRecruitPreviewEnemyTeam() {
  return cloneDemons(state.run?.nextEnemies || []);
}

function ensureRecruitDraft() {
  if (!state.run?.awaitingRecruit || !state.isRecruiting) return;
  if (state.recruitDraftTeam && state.recruitDraftPool) return;
  if (!state.pendingHandFlowSources) {
    state.isEnemyPreviewDeferred = false;
  }

  state.recruitDraftTeam = (state.run.team || []).map((demon, index) => ({
    ...getFullHpDemon(demon),
    instanceId: demon.instanceId,
    originalInstanceId: demon.instanceId,
    recruitSource: 'team',
    draftOrder: index,
    formationRow: getDemonFormationRow(demon, state.run.team || [], index),
    formationSlot: getDemonFormationRow(demon, state.run.team || [], index),
    position: getDemonPosition(demon, index)
  }));
  state.recruitDraftPool = [
    ...getCurrentRecruitRewards().map((reward, index) => ({
      ...getFullHpDemon(reward.demon),
      instanceId: `reward-${reward.rewardId}`,
      rewardId: reward.rewardId,
      recruitSource: 'reward',
      position: getDemonPosition(reward.demon, index)
    }))
  ];
}

async function ensureCollectionLoaded() {
  if (state.collectionDemons) return;

  const payload = await api('/api/demons');
  state.collectionDemons = payload.demons || [];
}

function getAvailableCollectionReinforcements() {
  if (!state.run?.collectionReinforcementAvailable || getSelectedCollectionReinforcements().length >= getCollectionReinforcementLimit()) return [];
  const existingCollectionIds = new Set((state.run.team || [])
    .map((demon) => Number(demon.collectionDemonId))
    .filter(Boolean));

  const usedCollectionIds = new Set([
    ...(state.recruitDraftTeam || []),
    ...(state.recruitDraftPool || [])
  ]
    .map((demon) => Number(demon.collectionDemonId))
    .filter(Boolean));

  return (state.collectionDemons || [])
    .filter((demon) => !existingCollectionIds.has(Number(demon.id)) && !usedCollectionIds.has(Number(demon.id)));
}

function getCollectionReinforcementLimit() {
  const limit = Number(state.run?.collectionReinforcementLimit);
  if (limit > 0) return limit;
  return state.run?.collectionReinforcementAvailable ? 1 : 0;
}

function getCollectionSlotKey(demon) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  const rarity = String(demon?.rarity || '').toLowerCase();
  if (!typeId || !rarity) return null;
  return `${typeId}:${rarity}`;
}

function isDemonInCollection(demon) {
  if (demon?.recruitSource === 'collection') return true;
  if (demon?.collectionDemonId) return true;
  const key = getCollectionSlotKey(demon);
  if (!key) return false;
  return (state.collectionDemons || []).some((collectionDemon) => getCollectionSlotKey(collectionDemon) === key);
}

function shouldShowCollectionMissingTag(demon, options = {}) {
  if (options.suppressCollectionMissingTag) return false;
  if (state.isBattleAnimating) return false;
  if (!Array.isArray(state.collectionDemons)) return false;
  return Boolean(!isDemonInCollection(demon));
}

function getFullHpDemon(demon) {
  const maxHp = Math.max(Number(demon.maxHp) || Number(demon.hp) || 1, 1);
  return {
    ...demon,
    maxHp,
    hp: maxHp
  };
}

function getRecruitTeamLimit() {
  if (!state.run) return MAX_DUNGEON_TEAM_SIZE;
  return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(2, Number(state.run.currentFloor) + 2));
}

function getDraftRecruitPayload() {
  ensureRecruitDraft();
  const draftTeam = state.recruitDraftTeam || [];
  return {
    team: draftTeam.map((demon, index) => ({
      source: getDraftPayloadSource(demon),
      instanceId: demon.originalInstanceId || demon.instanceId,
      rewardId: demon.rewardId || undefined,
      demonId: demon.collectionDemonId || undefined,
      position: getDemonPosition(demon, index),
      formationSlot: getDemonFormationRow(demon, draftTeam, index)
    }))
  };
}

function getRewardExtractionChoicePayload() {
  const candidate = getSelectedRewardCandidate();
  if (!candidate || candidate.source === 'final') return null;

  return {
    source: candidate.origin === 'reserved' ? 'reserved' : candidate.source,
    instanceId: candidate.instanceId || null,
    rewardId: candidate.rewardId || null,
    key: candidate.key
  };
}

function getDraftPayloadSource(demon) {
  if (demon.recruitSource === 'reward') return 'reward';
  if (demon.recruitSource === 'collection') return 'collection';
  if (demon.recruitSource === 'reserved') return 'reserved';
  return 'team';
}

function getSelectedCollectionReinforcement() {
  return getSelectedCollectionReinforcements()[0] || null;
}

function getSelectedCollectionReinforcements() {
  return [
    ...(state.recruitDraftTeam || []),
    ...(state.recruitDraftPool || [])
  ].filter((demon) => demon.recruitSource === 'collection');
}

function addCollectionReinforcementToPool(demonId) {
  ensureRecruitDraft();
  if (getSelectedCollectionReinforcements().length >= getCollectionReinforcementLimit()) return;

  const demon = (state.collectionDemons || []).find((item) => Number(item.id) === Number(demonId));
  if (!demon) return;

  const position = getPreferredDemonPosition(demon);
  state.recruitDraftPool.splice(getCollectionHandInsertIndex(), 0, {
    ...getFullHpDemon(demon),
    instanceId: `collection-${demon.id}`,
    collectionDemonId: demon.id,
    recruitSource: 'collection',
    position
  });
  state.collectionReinforcementStagedInteracted = false;
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function getCollectionHandInsertIndex() {
  const firstNonCollectionIndex = (state.recruitDraftPool || []).findIndex((demon) => demon.recruitSource !== 'collection');
  return firstNonCollectionIndex >= 0 ? firstNonCollectionIndex : (state.recruitDraftPool || []).length;
}

function removeCollectionReinforcement(instanceId = null) {
  const shouldRemove = (demon) => (
    demon.recruitSource === 'collection' &&
    (!instanceId || demon.instanceId === instanceId)
  );
  state.recruitDraftTeam = (state.recruitDraftTeam || []).filter((demon) => !shouldRemove(demon));
  state.recruitDraftPool = (state.recruitDraftPool || []).filter((demon) => !shouldRemove(demon));
  state.collectionReinforcementStagedInteracted = true;
  refreshRecruitDraftOrder();
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function markCollectionReinforcementPlaceholderInteracted() {
  state.collectionReinforcementPlaceholderInteracted = true;
  document.querySelectorAll('.collection-reinforcement-placeholder').forEach((card) => {
    card.classList.remove('is-collection-reinforcement-attention');
  });
}

function markCollectionReinforcementStagedInteracted(instanceId = null) {
  const staged = instanceId
    ? getSelectedCollectionReinforcements().find((demon) => demon.instanceId === instanceId)
    : getSelectedCollectionReinforcement();
  if (!staged || (instanceId && staged.instanceId !== instanceId)) return;

  state.collectionReinforcementStagedInteracted = true;
  document.querySelectorAll(`.hunt-demon-card[data-instance-id="${cssEscape(staged.instanceId)}"]`).forEach((card) => {
    card.classList.remove('is-collection-reinforcement-attention');
  });
}

function findCollectionReplacement(demon) {
  const key = getCollectionSlotKey(demon);
  if (!key) return null;
  return (state.collectionDemons || []).find((collectionDemon) => getCollectionSlotKey(collectionDemon) === key) || null;
}

export {
  prepareRecruitStrategyState,
  getCurrentRecruitRewards,
  getRecruitPreviewTeam,
  getRecruitPreviewHand,
  getRecruitPreviewEnemyTeam,
  ensureRecruitDraft,
  ensureCollectionLoaded,
  getAvailableCollectionReinforcements,
  getCollectionReinforcementLimit,
  getCollectionSlotKey,
  isDemonInCollection,
  shouldShowCollectionMissingTag,
  getFullHpDemon,
  getRecruitTeamLimit,
  getDraftRecruitPayload,
  getRewardExtractionChoicePayload,
  getDraftPayloadSource,
  getSelectedCollectionReinforcement,
  getSelectedCollectionReinforcements,
  addCollectionReinforcementToPool,
  getCollectionHandInsertIndex,
  removeCollectionReinforcement,
  markCollectionReinforcementPlaceholderInteracted,
  markCollectionReinforcementStagedInteracted,
  findCollectionReplacement
};
