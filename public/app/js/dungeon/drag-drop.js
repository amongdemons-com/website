import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const applyRewardBoxDrop = (...args) => dungeonActions.applyRewardBoxDrop(...args);
const canDropOnRewardBox = (...args) => dungeonActions.canDropOnRewardBox(...args);
const canExtractRun = (...args) => dungeonActions.canExtractRun(...args);
const canMoveRewardSelectionToPool = (...args) => dungeonActions.canMoveRewardSelectionToPool(...args);
const canMoveRewardSelectionToTeam = (...args) => dungeonActions.canMoveRewardSelectionToTeam(...args);
const completeDeferredDemonicPactRevealAfter = (...args) => dungeonActions.completeDeferredDemonicPactRevealAfter(...args);
const ensureRecruitDraft = (...args) => dungeonActions.ensureRecruitDraft(...args);
const getDemonPosition = (...args) => dungeonActions.getDemonPosition(...args);
const getDemonsForFormationRow = (...args) => dungeonActions.getDemonsForFormationRow(...args);
const getRecruitTeamLimit = (...args) => dungeonActions.getRecruitTeamLimit(...args);
const getRewardCandidateByKey = (...args) => dungeonActions.getRewardCandidateByKey(...args);
const getRewardCandidateFromPayload = (...args) => dungeonActions.getRewardCandidateFromPayload(...args);
const getRewardCandidates = (...args) => dungeonActions.getRewardCandidates(...args);
const getSelectedRewardCandidate = (...args) => dungeonActions.getSelectedRewardCandidate(...args);
const hasPendingBuffChoices = (...args) => dungeonActions.hasPendingBuffChoices(...args);
const init = (...args) => dungeonActions.init(...args);
const markCollectionReinforcementStagedInteracted = (...args) => dungeonActions.markCollectionReinforcementStagedInteracted(...args);
const moveRewardSelectionToPoolLane = (...args) => dungeonActions.moveRewardSelectionToPoolLane(...args);
const moveRewardSelectionToTeamLane = (...args) => dungeonActions.moveRewardSelectionToTeamLane(...args);
const removeRewardSelection = (...args) => dungeonActions.removeRewardSelection(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const swapRewardSelectionWithDraftTarget = (...args) => dungeonActions.swapRewardSelectionWithDraftTarget(...args);

async function setDemonPosition(instanceId, position, rowIndex = null) {
  if (!state.run) return;

  const team = state.run.team || [];
  const target = team.find((demon) => demon.instanceId === instanceId);
  const targetIndex = team.findIndex((demon) => demon.instanceId === instanceId);
  const nextRow = normalizeFormationRow(rowIndex);
  const previousPosition = target?.position;
  const previousRow = target ? getDemonFormationRow(target, team, targetIndex) : null;
  if (!target || (target.position === position && previousRow === nextRow)) return;

  target.position = position;
  setDemonFormationRow(target, nextRow);
  renderRun();

  try {
    const result = await api(activeRunPath('formation'), {
      method: 'POST',
      body: {
        formation: team.map((demon, index) => ({
          instanceId: demon.instanceId,
          position: getDemonPosition(demon, index),
          formationSlot: getDemonFormationRow(demon, team, index)
        }))
      }
    });
    state.run.team = result.team || team;
    setStoredFormationRow(instanceId, nextRow);
    renderRun();
  } catch (error) {
    target.position = previousPosition;
    setDemonFormationRow(target, previousRow);
    renderRun();
    showError(error);
  }
}

function bindNativeDragSource(card, options) {
  const boundKey = options.stateKey || 'default';
  if (card.dataset.nativeDragSourceBound === boundKey) return;
  card.dataset.nativeDragSourceBound = boundKey;

  card.addEventListener('dragstart', (event) => {
    const payload = options.getPayload(card);
    if (!payload) return;
    if (isPactChoiceBlockingDrag()) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
    state[options.stateKey] = payload.instanceId || payload.key || null;
    if (options.markStaged && payload.instanceId) markCollectionReinforcementStagedInteracted(payload.instanceId);
    card.classList.add('is-dragging');
  });

  card.addEventListener('dragend', () => {
    state[options.stateKey] = null;
    card.classList.remove('is-dragging');
    clearDragOverTargets(options.clearSelector);
  });
}

function bindNativeDropTarget(target, options) {
  if (target.dataset.nativeDropTargetBound === 'true') return;
  target.dataset.nativeDropTargetBound = 'true';

  target.addEventListener('dragover', (event) => {
    if (isPactChoiceBlockingDrag()) return;
    const payload = options.readPayload(event);
    if (!(options.canDragOver || options.canDrop)(payload, event, target)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    target.classList.add('is-drag-over');
  });

  target.addEventListener('dragleave', () => target.classList.remove('is-drag-over'));
  target.addEventListener('drop', (event) => {
    const payload = options.readPayload(event);
    target.classList.remove('is-drag-over');
    if (isPactChoiceBlockingDrag()) {
      event.preventDefault();
      return;
    }
    if (!options.canDrop(payload, event, target)) return;

    event.preventDefault();
    if (options.stopPropagation) event.stopPropagation();
    options.onDrop(payload, event, target);
    if (options.renderAfterDrop) renderRun();
  });
}

function clearDragOverTargets(selector) {
  document.querySelectorAll(selector).forEach((target) => target.classList.remove('is-drag-over'));
}

function bindFormationDragAndDrop() {
  if (!state.run || state.run.awaitingRecruit || isPactChoiceBlockingDrag()) return;

  document.querySelectorAll('#teamGrid .dungeon-demon-card[draggable="true"]').forEach((card) => {
    if (card.dataset.rewardId) return;

    bindNativeDragSource(card, {
      stateKey: 'draggedFormationInstanceId',
      clearSelector: FORMATION_DRAG_OVER_SELECTOR,
      markStaged: true,
      getPayload: () => ({
        type: 'formation',
        instanceId: card.dataset.instanceId
      })
    });
  });

  document.querySelectorAll('#teamGrid .formation-lane-cards').forEach((lane) => {
    bindNativeDropTarget(lane, {
      readPayload: readDragPayload,
      canDrop: (payload) => {
        if (payload?.type !== 'formation' && !state.draggedFormationInstanceId) return false;
        return canDropFormationOnLane(payload?.instanceId || state.draggedFormationInstanceId, lane);
      },
      onDrop: (payload) => {
        const instanceId = payload?.instanceId || state.draggedFormationInstanceId;
        if (!instanceId) return;
        setDemonPosition(instanceId, lane.dataset.formationDrop, getFormationLaneInfo(lane)?.rowIndex);
      }
    });
  });
}

function bindRecruitCardDragAndDrop(card, options) {
  bindNativeDragSource(card, {
    stateKey: options.stateKey,
    clearSelector: REWARD_DRAG_OVER_SELECTOR,
    markStaged: options.markStaged,
    getPayload: options.getPayload
  });

  bindNativeDropTarget(card, {
    readPayload: readRecruitDragPayload,
    stopPropagation: true,
    renderAfterDrop: true,
    canDrop: (payload) => canDropRecruitPayloadOnCard(payload, card),
    onDrop: (payload) => applyRecruitPayloadToCard(payload, card)
  });
}

function getRecruitDragPayload(collection, type, card) {
  return findDraftDemon(collection, card.dataset.instanceId)
    ? { type, instanceId: card.dataset.instanceId }
    : null;
}

function getRecruitDropContext(event) {
  const payload = readRecruitDragPayload(event);
  return { payload };
}

function bindTeamFormationDropTarget(target, getLane, getPosition) {
  bindNativeDropTarget(target, {
    readPayload: getRecruitDropContext,
    renderAfterDrop: true,
    canDragOver: (context) => canDragOverTeamFormationTarget(context, getLane(), getPosition()),
    canDrop: (context) => canDropOnTeamFormationTarget(context, getLane(), getPosition()),
    onDrop: (context, event) => applyTeamFormationTargetDrop(context, getLane(), getPosition(), event)
  });
}

function getDraftDropZone(element) {
  if (element?.closest('#teamGrid')) return 'team';
  if (element?.closest('#dungeonHandGrid')) return 'pool';
  if (element?.closest('#dungeonRewardGrid')) return 'reward';
  return null;
}

function canDropRecruitPayloadOnLane(payload, lane, position = null) {
  if (!payload) return false;
  if (isPactChoiceBlockingDrag()) return false;
  const zone = getDraftDropZone(lane);

  if (zone === 'reward') return canDropOnRewardBox(payload);

  if (payload.type === 'reward-selection') {
    if (zone === 'team') return canMoveRewardSelectionToTeam(lane);
    if (zone === 'pool') return canMoveRewardSelectionToPool();
    return false;
  }

  if (zone === 'team') {
    if (!position) return false;
    if (payload.type === 'recruit-pool') return canAddPoolDemonToTeam(payload.instanceId, lane);
    if (payload.type === 'recruit-team') return canMoveTeamDemonToLane(payload.instanceId, lane);
    return false;
  }

  if (zone === 'pool') {
    if (payload.type === 'recruit-team') return canReturnTeamDemonToPool(payload.instanceId);
    if (payload.type === 'recruit-pool') return Boolean(findDraftDemon(state.recruitDraftPool, payload.instanceId));
  }

  return false;
}

function applyRecruitPayloadToLane(payload, lane, position, event = null, insertIndex = null) {
  if (!payload || !lane) return false;
  const zone = getDraftDropZone(lane);

  if (zone === 'reward') {
    applyRewardBoxDrop(payload);
    return true;
  }

  if (payload.type === 'reward-selection') {
    return zone === 'team'
      ? moveRewardSelectionToTeamLane(lane, position, event, insertIndex)
      : moveRewardSelectionToPoolLane(lane, event, insertIndex);
  }

  if (payload.type === 'recruit-pool') {
    if (zone === 'team' && canAddPoolDemonToTeam(payload.instanceId, lane)) {
      addPoolDemonToTeam(
        payload.instanceId,
        position,
        Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, event?.clientY, event?.clientX),
        getFormationLaneInfo(lane)?.rowIndex
      );
      return true;
    }

    if (zone === 'pool' && findDraftDemon(state.recruitDraftPool, payload.instanceId)) {
      applyPoolLaneDrop(payload.instanceId, lane, position, event?.clientY, event?.clientX, insertIndex);
      return true;
    }
  }

  if (payload.type === 'recruit-team') {
    if (zone === 'team') {
      applyTeamLaneDrop(payload.instanceId, lane, position, event?.clientY, event?.clientX, insertIndex);
      return true;
    }

    if (zone === 'pool' && canReturnTeamDemonToPool(payload.instanceId)) {
      applyTeamToPoolLaneDrop(payload.instanceId, lane, position, event?.clientY, event?.clientX, insertIndex);
      return true;
    }
  }

  return false;
}

function canDropRecruitPayloadOnCard(payload, card) {
  if (!payload || !card) return false;
  if (isPactChoiceBlockingDrag()) return false;
  const zone = getDraftDropZone(card);

  if (zone === 'reward') return canDropOnRewardBox(payload);
  if (zone === 'team') return canDropRecruitOnTeamCard(payload, card.dataset.instanceId);
  if (zone === 'pool') return canDropRecruitOnPoolCard(payload, card.dataset.instanceId);
  return false;
}

function applyRecruitPayloadToCard(payload, card) {
  if (!payload || !card) return false;
  const zone = getDraftDropZone(card);

  if (zone === 'reward') {
    applyRewardBoxDrop(payload);
    return true;
  }

  if (zone === 'team' || zone === 'pool') {
    applyRecruitCardDrop(payload, zone === 'team' ? 'team' : 'pool', card.dataset.instanceId);
    return true;
  }

  return false;
}

function canDragOverTeamFormationTarget(context, lane, position) {
  return canDropRecruitPayloadOnLane(context.payload, lane, position);
}

function canDropOnTeamFormationTarget(context, lane, position) {
  return canDropRecruitPayloadOnLane(context.payload, lane, position);
}

function applyTeamFormationTargetDrop(context, lane, position, event) {
  applyRecruitPayloadToLane(context.payload, lane, position, event);
}

function bindHandFormationDropTarget(lane) {
  bindNativeDropTarget(lane, {
    readPayload: getRecruitDropContext,
    renderAfterDrop: true,
    canDragOver: (context) => canDragOverHandFormationTarget(context, lane),
    canDrop: (context) => canDragOverHandFormationTarget(context, lane),
    onDrop: (context, event) => applyHandFormationTargetDrop(context, lane, event)
  });
}

function canDragOverHandFormationTarget(context, lane) {
  return canDropRecruitPayloadOnLane(context.payload, lane, 'hand');
}

function applyHandFormationTargetDrop(context, lane, event) {
  applyRecruitPayloadToLane(context.payload, lane, lane.dataset.formationDrop, event);
}

function bindRecruitDragAndDrop() {
  if (!state.run?.awaitingRecruit || !state.isRecruiting || isPactChoiceBlockingDrag()) return;
  ensureRecruitDraft();

  document.querySelectorAll('#dungeonHandGrid .dungeon-demon-card[data-instance-id]').forEach((card) => {
    bindRecruitCardDragAndDrop(card, {
      stateKey: 'draggedRecruitPoolInstanceId',
      markStaged: true,
      getPayload: () => getRecruitDragPayload(state.recruitDraftPool, 'recruit-pool', card)
    });
  });

  document.querySelectorAll('#teamGrid .dungeon-demon-card[data-instance-id]').forEach((card) => {
    bindRecruitCardDragAndDrop(card, {
      stateKey: 'draggedFormationInstanceId',
      getPayload: () => getRecruitDragPayload(state.recruitDraftTeam, 'recruit-team', card)
    });
  });

  document.querySelectorAll('#teamGrid .formation-lane-cards').forEach((lane) => {
    bindTeamFormationDropTarget(lane, () => lane, () => lane.dataset.formationDrop);
  });

  document.querySelectorAll('#dungeonHandGrid .formation-lane-cards').forEach(bindHandFormationDropTarget);
}

function bindRewardDragAndDrop() {
  if (isPactChoiceBlockingDrag() || !canExtractRun()) return;

  document.querySelectorAll('#dungeonRewardGrid .dungeon-demon-card[data-reward-candidate-key]').forEach((card) => {
    bindNativeDragSource(card, {
      stateKey: 'draggedRewardDemonKey',
      clearSelector: REWARD_DRAG_OVER_SELECTOR,
      getPayload: () => ({
        type: 'reward-selection',
        key: card.dataset.rewardCandidateKey || state.selectedRewardDemonKey
      })
    });
  });

  document.querySelectorAll('#dungeonRewardGrid .dungeon-reward-dropzone').forEach((dropzone) => {
    bindNativeDropTarget(dropzone, {
      readPayload: readRewardDragPayload,
      renderAfterDrop: true,
      canDrop: canDropOnRewardBox,
      onDrop: applyRewardBoxDrop
    });
  });

}

function getRewardCandidateForCard(card) {
  const explicitKey = card?.dataset.rewardCandidateKey;
  if (explicitKey) return getRewardCandidateByKey(explicitKey);

  const instanceId = card?.dataset.instanceId;
  if (!instanceId) return null;

  return getRewardCandidates().find((candidate) => (
    candidate.instanceId === instanceId ||
    candidate.sourceInstanceId === instanceId ||
    candidate.demon?.instanceId === instanceId
  )) || null;
}

function bindPointerDragAndDrop() {
  document.querySelectorAll('#teamGrid .dungeon-demon-card[data-instance-id], #dungeonHandGrid .dungeon-demon-card[data-instance-id], #enemyGrid .dungeon-demon-card[data-instance-id], #dungeonRewardGrid .dungeon-demon-card[data-instance-id]').forEach((card) => {
    if (card.dataset.pointerDragBound === 'true') return;
    card.dataset.pointerDragBound = 'true';
    card.addEventListener('pointerdown', startPointerDrag);
    card.addEventListener('mousedown', startMouseDrag);
    card.addEventListener('touchstart', startTouchDrag, { passive: false });
  });
}

function startPointerDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  if (event.pointerType === 'mouse') return;

  const card = event.currentTarget;
  const payload = getPointerDragPayload(card);
  if (!payload) return;

  trackPointerDrag(createDragSession(
    card,
    payload,
    event.clientX,
    event.clientY,
    card,
    'pointermove',
    'pointerup',
    'pointercancel',
    event.pointerId
  ));
}

function startMouseDrag(event) {
  if (event.button !== 0) return;
  if (!shouldUseCustomMouseDrag()) return;
  if (event.currentTarget.classList.contains('is-pointer-dragging')) return;

  const card = event.currentTarget;
  const payload = getPointerDragPayload(card);
  if (!payload) return;

  trackPointerDrag(createDragSession(card, payload, event.clientX, event.clientY, document, 'mousemove', 'mouseup', 'mouseup'));
}

function startTouchDrag(event) {
  if (window.PointerEvent) return;
  if (event.touches.length !== 1) return;

  const card = event.currentTarget;
  const payload = getPointerDragPayload(card);
  if (!payload) return;

  const touch = event.touches[0];
  trackPointerDrag(
    createDragSession(card, payload, touch.clientX, touch.clientY, document, 'touchmove', 'touchend', 'touchcancel'),
    { moveOptions: { passive: false } }
  );
}

function trackPointerDrag(drag, options = {}) {
  const onMove = (moveEvent) => movePointerDrag(moveEvent, drag);
  const onUp = (upEvent) => finishPointerDrag(upEvent, drag, onMove, onUp, onCancel);
  const onCancel = (cancelEvent) => cancelPointerDrag(cancelEvent, drag, onMove, onUp, onCancel);

  if (drag.pointerId !== null) drag.card.setPointerCapture?.(drag.pointerId);
  drag.listenerTarget.addEventListener(drag.moveEvent, onMove, options.moveOptions);
  drag.listenerTarget.addEventListener(drag.upEvent, onUp);
  drag.listenerTarget.addEventListener(drag.cancelEvent, onCancel);
}

function createDragSession(card, payload, startX, startY, listenerTarget, moveEvent, upEvent, cancelEvent, pointerId = null) {
  return {
    card,
    payload,
    pointerId,
    listenerTarget,
    moveEvent,
    upEvent,
    cancelEvent,
    startX,
    startY,
    currentTarget: null,
    ghost: null,
    active: false
  };
}

function movePointerDrag(event, drag) {
  if (drag.pointerId !== null && event.pointerId !== drag.pointerId) return;

  const point = getDragPoint(event);
  if (!point) return;

  const deltaX = point.clientX - drag.startX;
  const deltaY = point.clientY - drag.startY;
  if (!drag.active && Math.hypot(deltaX, deltaY) < 8) return;

  if (!drag.active) activatePointerDrag(event, drag);

  if (event.cancelable) event.preventDefault();
  positionPointerDragGhost(drag.ghost, point.clientX, point.clientY);
  const target = getPointerDropTarget(point.clientX, point.clientY, drag);
  setPointerDropTarget(drag, target);
}

function activatePointerDrag(event, drag) {
  drag.active = true;
  drag.card.classList.add('is-dragging');
  drag.card.classList.add('is-pointer-dragging');
  drag.card.classList.add('suppress-detail-click');
  if (drag.pointerId !== null) drag.card.setPointerCapture?.(drag.pointerId);

  if (drag.payload.type === 'recruit-pool') {
    state.draggedRecruitPoolInstanceId = drag.payload.instanceId;
    markCollectionReinforcementStagedInteracted(drag.payload.instanceId);
  } else if (drag.payload.type === 'reward-selection') {
    state.draggedRewardDemonKey = drag.payload.key;
  } else {
    state.draggedFormationInstanceId = drag.payload.instanceId;
    if (drag.payload.type === 'recruit-team') {
      markCollectionReinforcementStagedInteracted(drag.payload.instanceId);
    }
  }

  drag.ghost = drag.card.cloneNode(true);
  drag.ghost.classList.add('pointer-drag-ghost');
  drag.ghost.removeAttribute('id');
  drag.ghost.removeAttribute('role');
  drag.ghost.removeAttribute('tabindex');
  drag.ghost.style.width = `${drag.card.getBoundingClientRect().width}px`;
  document.body.appendChild(drag.ghost);
  const point = getDragPoint(event);
  if (point) positionPointerDragGhost(drag.ghost, point.clientX, point.clientY);
}

function finishPointerDrag(event, drag, onMove, onUp, onCancel) {
  cleanupPointerDragListeners(drag, onMove, onUp, onCancel);
  if (!drag.active) {
    clearDragState();
    return;
  }

  if (event.cancelable) event.preventDefault();
  event.stopPropagation();
  const point = getDragPoint(event);
  const target = point ? getPointerDropTarget(point.clientX, point.clientY, drag) : null;
  suppressSyntheticClickAfterDrag(point);
  cleanupPointerDrag(drag);
  applyPointerDrop(drag.payload, target);
}

function cancelPointerDrag(event, drag, onMove, onUp, onCancel) {
  cleanupPointerDragListeners(drag, onMove, onUp, onCancel);
  if (drag.active) {
    if (event.cancelable) event.preventDefault();
    cleanupPointerDrag(drag);
  }
}

function cleanupPointerDragListeners(drag, onMove, onUp, onCancel) {
  drag.listenerTarget.removeEventListener(drag.moveEvent, onMove);
  drag.listenerTarget.removeEventListener(drag.upEvent, onUp);
  drag.listenerTarget.removeEventListener(drag.cancelEvent, onCancel);
  if (drag.pointerId !== null) drag.card.releasePointerCapture?.(drag.pointerId);
}

function cleanupPointerDrag(drag) {
  drag.card.classList.remove('is-dragging', 'is-pointer-dragging');
  drag.ghost?.remove();
  setPointerDropTarget(drag, null);
  clearDragState();

  window.setTimeout(() => {
    drag.card.classList.remove('suppress-detail-click');
  }, 120);
}

function suppressSyntheticClickAfterDrag(point) {
  if (!point) return;

  const startedAt = Date.now();
  const maxAgeMs = 350;
  const maxDistancePx = 24;
  const releaseX = point.clientX;
  const releaseY = point.clientY;
  const remove = () => document.removeEventListener('click', onClick, true);
  const onClick = (event) => {
    const age = Date.now() - startedAt;
    const distance = Math.hypot(event.clientX - releaseX, event.clientY - releaseY);
    remove();
    if (age > maxAgeMs || distance > maxDistancePx) return;

    event.preventDefault();
    event.stopPropagation();
  };

  document.addEventListener('click', onClick, true);
  window.setTimeout(remove, maxAgeMs);
}

function getPointerDragPayload(card) {
  const instanceId = card.dataset.instanceId;
  if (!instanceId) return null;
  if (isPactChoiceBlockingDrag()) return null;

  if (card.closest('#dungeonRewardGrid') && state.selectedRewardDemonKey) {
    if (!canExtractRun()) return null;
    return { type: 'reward-selection', key: state.selectedRewardDemonKey };
  }

  if (state.run?.awaitingRecruit && state.isRecruiting) {
    if (card.closest('#dungeonHandGrid') && findDraftDemon(state.recruitDraftPool, instanceId)) {
      return { type: 'recruit-pool', instanceId };
    }
    if (card.closest('#teamGrid') && findDraftDemon(state.recruitDraftTeam, instanceId)) {
      return { type: 'recruit-team', instanceId };
    }
    return null;
  }

  if (state.run && !state.run.awaitingRecruit && card.closest('#teamGrid')) {
    return { type: 'formation', instanceId };
  }

  return null;
}

function getPointerDropTarget(x, y, drag) {
  const ghostDisplay = drag.ghost?.style.display;
  if (drag.ghost) drag.ghost.style.display = 'none';
  const element = document.elementFromPoint(x, y);
  if (drag.ghost) drag.ghost.style.display = ghostDisplay || '';
  if (!element) return null;

  const rewardDropzone = element.closest('#dungeonRewardGrid .dungeon-reward-dropzone');
  const card = element.closest('.dungeon-demon-card[data-instance-id]');
  const lane = element.closest('.formation-lane-cards');

  if (rewardDropzone && canPointerDropOnRewardBox(drag.payload)) {
    return { element: rewardDropzone, kind: 'reward' };
  }

  if (card && canPointerDropOnCard(drag.payload, card)) {
    return { element: card, kind: 'card' };
  }

  if (lane && canPointerDropOnLane(drag.payload, lane)) {
    return { element: lane, kind: 'lane', insertIndex: getLaneDropDraftIndex(lane, y, x), clientX: x, clientY: y };
  }

  return null;
}

function canPointerDropOnCard(payload, card) {
  return canDropRecruitPayloadOnCard(payload, card);
}

function canPointerDropOnRewardBox(payload) {
  return canDropOnRewardBox(payload);
}

function canPointerDropOnLane(payload, lane) {
  if (!payload) return false;

  if (payload.type === 'formation') {
    return Boolean(lane.closest('#teamGrid') && canDropFormationOnLane(payload.instanceId, lane));
  }

  return canDropRecruitPayloadOnLane(payload, lane, lane.dataset.formationDrop);
}

function setPointerDropTarget(drag, target) {
  if (drag.currentTarget?.element === target?.element) return;

  drag.currentTarget?.element.classList.remove('is-drag-over');
  drag.currentTarget = target;
  drag.currentTarget?.element.classList.add('is-drag-over');
}

function applyPointerDrop(payload, target) {
  if (isPactChoiceBlockingDrag()) return;

  if (!target) {
    if (payload?.type === 'reward-selection') {
      removeRewardSelection();
      renderRun();
    }
    return;
  }

  if (target.kind === 'reward') {
    applyRewardBoxDrop(payload);
    renderRun();
    return;
  }

  if (payload.type === 'reward-selection') {
    if (target.kind === 'card') {
      applyRecruitPayloadToCard(payload, target.element);
    } else {
      applyRecruitPayloadToLane(
        payload,
        target.element,
        target.element.dataset.formationDrop,
        { clientY: target.clientY, clientX: target.clientX },
        target.insertIndex
      );
    }
    renderRun();
    return;
  }

  if (payload.type === 'formation') {
    const position = target.element.dataset.formationDrop;
    if (position) setDemonPosition(payload.instanceId, position, getFormationLaneInfo(target.element)?.rowIndex);
    return;
  }

  if (payload.type === 'recruit-pool') {
    if (target.kind === 'card') {
      applyRecruitPayloadToCard(payload, target.element);
      renderRun();
      return;
    }

    applyRecruitPayloadToLane(
      payload,
      target.element,
      target.element.dataset.formationDrop,
      { clientY: target.clientY, clientX: target.clientX },
      target.insertIndex
    );
    renderRun();
    return;
  }

  if (payload.type === 'recruit-team') {
    if (target.kind === 'card') {
      applyRecruitPayloadToCard(payload, target.element);
      renderRun();
      return;
    }

    applyRecruitPayloadToLane(
      payload,
      target.element,
      target.element.dataset.formationDrop,
      { clientY: target.clientY, clientX: target.clientX },
      target.insertIndex
    );
    renderRun();
  }
}

function positionPointerDragGhost(ghost, x, y) {
  if (!ghost) return;
  ghost.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -50%)`;
}

function getDragPoint(event) {
  if (event.changedTouches?.length) return event.changedTouches[0];
  if (event.touches?.length) return event.touches[0];
  if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) return event;
  return null;
}

function shouldUseCustomMouseDrag() {
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 575.98px)').matches;
}

function findDraftDemon(collection, instanceId) {
  if (!instanceId) return null;
  return (collection || []).find((demon) => demon.instanceId === instanceId) || null;
}

function canAddPoolDemonToTeam(poolInstanceId, lane = null) {
  const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
  if (!poolDemon) return false;
  return (state.recruitDraftTeam || []).length < getRecruitTeamLimit() && canAddDemonToFormationLane(state.recruitDraftTeam, lane);
}

function canMoveTeamDemonToLane(instanceId, lane) {
  const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
  if (!demon || !lane) return false;
  if (isDemonInFormationLane(state.recruitDraftTeam, instanceId, lane)) return true;
  return canAddDemonToFormationLane(state.recruitDraftTeam, lane);
}

function canDropFormationOnLane(instanceId, lane) {
  const demon = findDraftDemon(state.run?.team || [], instanceId);
  if (!demon || !lane) return false;
  if (isPactChoiceBlockingDrag()) return false;
  if (isDemonInFormationLane(state.run?.team || [], instanceId, lane)) return true;
  return canAddDemonToFormationLane(state.run?.team || [], lane);
}

function isPactChoiceBlockingDrag() {
  return Boolean(state.isPactRevealPending || hasPendingBuffChoices(state.run));
}

function canAddDemonToFormationLane(collection, lane) {
  if (!lane?.closest('#teamGrid')) return true;
  return getFormationLaneDemons(collection, lane).length < FORMATION_CELL_CAPACITY;
}

function canDropRecruitOnTeamCard(payload, teamInstanceId) {
  if (!payload || !teamInstanceId) return false;
  if (payload.type === 'reward-selection') {
    return Boolean(getSelectedRewardCandidate() && getRewardCandidateFromPayload({ type: 'recruit-team', instanceId: teamInstanceId }));
  }
  if (payload.type === 'recruit-pool') return canSwapPoolDemonIntoTeam(payload.instanceId, teamInstanceId);
  if (payload.type === 'recruit-team') return canSwapDraftDemons(state.recruitDraftTeam, payload.instanceId, teamInstanceId);
  return false;
}

function canDropRecruitOnPoolCard(payload, poolInstanceId) {
  if (!payload || !poolInstanceId) return false;
  if (payload.type === 'reward-selection') {
    return Boolean(getSelectedRewardCandidate() && getRewardCandidateFromPayload({ type: 'recruit-pool', instanceId: poolInstanceId }));
  }
  if (payload.type === 'recruit-team') return canSwapTeamDemonIntoPool(payload.instanceId, poolInstanceId);
  if (payload.type === 'recruit-pool') return canSwapDraftDemons(state.recruitDraftPool, payload.instanceId, poolInstanceId);
  return false;
}

function applyRecruitCardDrop(payload, targetSide, targetInstanceId) {
  if (payload.type === 'reward-selection') {
    swapRewardSelectionWithDraftTarget(targetSide, targetInstanceId);
    return;
  }

  if (targetSide === 'team') {
    if (payload.type === 'recruit-pool') {
      swapPoolDemonIntoTeam(payload.instanceId, targetInstanceId);
    } else if (payload.type === 'recruit-team') {
      swapDraftDemons(state.recruitDraftTeam, payload.instanceId, targetInstanceId);
      refreshRecruitDraftOrder();
      syncRecruitDraftSelection();
    }
    return;
  }

  if (payload.type === 'recruit-team') {
    swapTeamDemonIntoPool(payload.instanceId, targetInstanceId);
  } else if (payload.type === 'recruit-pool') {
    swapDraftDemons(state.recruitDraftPool, payload.instanceId, targetInstanceId);
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
  }
}

function canSwapPoolDemonIntoTeam(poolInstanceId, teamInstanceId) {
  const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
  const teamDemon = findDraftDemon(state.recruitDraftTeam, teamInstanceId);
  return Boolean(poolDemon && teamDemon);
}

function canSwapTeamDemonIntoPool(teamInstanceId, poolInstanceId) {
  const teamDemon = findDraftDemon(state.recruitDraftTeam, teamInstanceId);
  const poolDemon = findDraftDemon(state.recruitDraftPool, poolInstanceId);
  return Boolean(teamDemon && poolDemon);
}

function canSwapDraftDemons(collection, sourceInstanceId, targetInstanceId) {
  return Boolean(
    sourceInstanceId &&
    targetInstanceId &&
    sourceInstanceId !== targetInstanceId &&
    findDraftDemon(collection, sourceInstanceId) &&
    findDraftDemon(collection, targetInstanceId)
  );
}

function addPoolDemonToTeam(poolInstanceId, position, insertIndex = null, rowIndex = null) {
  const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
  if (!poolDemon) return;

  const targetRow = normalizeFormationRow(rowIndex);
  const draftDemon = {
    ...poolDemon,
    position,
    formationRow: targetRow,
    formationSlot: targetRow
  };
  if (Number.isInteger(insertIndex) && insertIndex >= 0) {
    state.recruitDraftTeam.splice(insertIndex, 0, draftDemon);
  } else {
    state.recruitDraftTeam.push(draftDemon);
  }
  refreshRecruitDraftOrder();
  syncRecruitDraftSelection();
}

function swapPoolDemonIntoTeam(poolInstanceId, teamInstanceId) {
  const targetIndex = (state.recruitDraftTeam || []).findIndex((demon) => demon.instanceId === teamInstanceId);
  const poolIndex = getDraftPoolIndex(poolInstanceId);
  const currentTeamDemon = state.recruitDraftTeam?.[targetIndex];
  const currentPoolDemon = state.recruitDraftPool?.[poolIndex];
  const targetRow = getDemonFormationRow(currentTeamDemon, state.recruitDraftTeam, targetIndex);
  const poolRow = getDemonFormationRow(currentPoolDemon, state.recruitDraftPool, poolIndex);
  const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
  const teamDemon = removeDraftDemon(state.recruitDraftTeam, teamInstanceId);
  if (!poolDemon || !teamDemon) {
    if (poolDemon) state.recruitDraftPool.push(poolDemon);
    if (teamDemon) state.recruitDraftTeam.push(teamDemon);
    return;
  }

  const targetPosition = getDemonPosition(teamDemon);
  state.recruitDraftTeam.splice(Math.max(targetIndex, 0), 0, {
    ...poolDemon,
    draftOrder: getDraftOrder(teamDemon),
    position: targetPosition,
    formationRow: targetRow,
    formationSlot: targetRow
  });
  state.recruitDraftPool.splice(Math.max(poolIndex, 0), 0, {
    ...teamDemon,
    draftOrder: getDraftOrder(poolDemon),
    position: getDemonPosition(poolDemon),
    formationRow: poolRow,
    formationSlot: poolRow
  });
  state.recruitSwapEffectIds = [poolDemon.instanceId, teamDemon.instanceId].filter(Boolean);
  refreshRecruitDraftOrder();
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function swapTeamDemonIntoPool(teamInstanceId, poolInstanceId) {
  const teamIndex = getDraftTeamIndex(teamInstanceId);
  const poolIndex = getDraftPoolIndex(poolInstanceId);
  const currentTeamDemon = state.recruitDraftTeam?.[teamIndex];
  const currentPoolDemon = state.recruitDraftPool?.[poolIndex];
  const teamRow = getDemonFormationRow(currentTeamDemon, state.recruitDraftTeam, teamIndex);
  const poolRow = getDemonFormationRow(currentPoolDemon, state.recruitDraftPool, poolIndex);
  const teamDemon = removeDraftDemon(state.recruitDraftTeam, teamInstanceId);
  const poolDemon = removeDraftDemon(state.recruitDraftPool, poolInstanceId);
  if (!teamDemon || !poolDemon) {
    if (teamDemon) state.recruitDraftTeam.push(teamDemon);
    if (poolDemon) state.recruitDraftPool.push(poolDemon);
    return;
  }

  state.recruitDraftTeam.splice(Math.max(teamIndex, 0), 0, {
    ...poolDemon,
    position: getDemonPosition(teamDemon),
    formationRow: teamRow,
    formationSlot: teamRow
  });
  state.recruitDraftPool.splice(Math.max(poolIndex, 0), 0, {
    ...teamDemon,
    position: getDemonPosition(poolDemon),
    formationRow: poolRow,
    formationSlot: poolRow
  });
  state.recruitSwapEffectIds = [poolDemon.instanceId, teamDemon.instanceId].filter(Boolean);
  refreshRecruitDraftOrder();
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function playRecruitSwapEffect() {
  if (!state.recruitSwapEffectIds.length) return;

  const effectIds = state.recruitSwapEffectIds;
  state.recruitSwapEffectIds = [];
  effectIds.forEach((instanceId) => {
    const card = document.querySelector(`.dungeon-demon-card[data-instance-id="${cssEscape(instanceId)}"]`);
    if (!card) return;

    card.classList.remove('is-swap-confirmed');
    void card.offsetWidth;
    card.classList.add('is-swap-confirmed');
    window.setTimeout(() => {
      card.classList.remove('is-swap-confirmed');
    }, 720);
  });
}

function playEnemyRevealEffect() {
  if (!state.enemyRevealEffectIds.length) return;

  const effectIds = state.enemyRevealEffectIds;
  state.enemyRevealEffectIds = [];
  const revealDuration = 980 + Math.max(0, effectIds.length - 1) * 90;
  effectIds.forEach((instanceId, index) => {
    const card = document.querySelector(`#enemyGrid .dungeon-demon-card[data-instance-id="${cssEscape(instanceId)}"]`);
    if (!card) return;

    card.classList.remove('is-enemy-revealed');
    card.style.setProperty('--enemy-reveal-delay', `${index * 90}ms`);
    void card.offsetWidth;
    card.classList.add('is-enemy-revealed');
    window.setTimeout(() => {
      card.classList.remove('is-enemy-revealed');
      card.style.removeProperty('--enemy-reveal-delay');
    }, 980 + index * 90);
  });
  completeDeferredDemonicPactRevealAfter(revealDuration);
}

function moveDraftTeamDemon(instanceId, position, insertIndex = null, rowIndex = null) {
  moveDraftDemonWithin(state.recruitDraftTeam, instanceId, position, insertIndex, rowIndex);
  refreshRecruitDraftOrder();
  syncRecruitDraftSelection();
}

function applyTeamLaneDrop(instanceId, lane, position, clientY = null, clientX = null, insertIndex = null) {
  const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
  if (!demon || !position) return;
  if (!canMoveTeamDemonToLane(instanceId, lane)) return;

  const targetInstanceId = getLaneSwapTargetInstanceId(lane, instanceId, clientY, clientX);
  if (targetInstanceId && getDemonPosition(demon) !== position) {
    swapDraftDemons(state.recruitDraftTeam, instanceId, targetInstanceId);
    refreshRecruitDraftOrder();
    syncRecruitDraftSelection();
    return;
  }

  moveDraftTeamDemon(
    instanceId,
    position,
    Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX),
    getFormationLaneInfo(lane)?.rowIndex
  );
}

function moveDraftPoolDemon(instanceId, position, insertIndex = null) {
  const demon = findDraftDemon(state.recruitDraftPool, instanceId);
  moveDraftDemonWithin(state.recruitDraftPool, instanceId, getHandDropPosition(position, demon), insertIndex);
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function applyPoolLaneDrop(instanceId, lane, position, clientY = null, clientX = null, insertIndex = null) {
  const targetInstanceId = getLaneSwapTargetInstanceId(lane, instanceId, clientY, clientX);
  if (targetInstanceId) {
    swapDraftDemons(state.recruitDraftPool, instanceId, targetInstanceId);
    refreshRecruitDraftPoolOrder();
    syncRecruitDraftSelection();
    return;
  }

  moveDraftPoolDemon(instanceId, position, Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX));
}

function canReturnTeamDemonToPool(instanceId) {
  const demon = findDraftDemon(state.recruitDraftTeam, instanceId);
  return Boolean(demon);
}

function returnTeamDemonToPool(instanceId, position, insertIndex = null) {
  const demon = removeDraftDemon(state.recruitDraftTeam, instanceId);
  if (!demon) return;

  const draftDemon = {
    ...demon,
    position: getHandDropPosition(position, demon)
  };
  delete draftDemon.formationRow;
  delete draftDemon.formationSlot;
  if (Number.isInteger(insertIndex) && insertIndex >= 0) {
    state.recruitDraftPool.splice(insertIndex, 0, draftDemon);
  } else {
    state.recruitDraftPool.push(draftDemon);
  }
  refreshRecruitDraftOrder();
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function applyTeamToPoolLaneDrop(instanceId, lane, position, clientY = null, clientX = null, insertIndex = null) {
  if (isHandLane(lane)) {
    returnTeamDemonToPool(instanceId, position, Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX));
    return;
  }

  const targetInstanceId = getLaneSwapTargetInstanceId(lane, instanceId, clientY, clientX);
  if (targetInstanceId && canSwapTeamDemonIntoPool(instanceId, targetInstanceId)) {
    swapTeamDemonIntoPool(instanceId, targetInstanceId);
    return;
  }

  returnTeamDemonToPool(instanceId, position, Number.isInteger(insertIndex) ? insertIndex : getLaneDropDraftIndex(lane, clientY, clientX));
}

function getHandDropPosition(position, demon) {
  return position === 'hand' ? getDemonPosition(demon) : position;
}

function removeDraftDemon(collection, instanceId) {
  const index = (collection || []).findIndex((demon) => demon.instanceId === instanceId);
  if (index === -1) return null;
  return collection.splice(index, 1)[0];
}

function getDraftTeamIndex(instanceId) {
  return (state.recruitDraftTeam || []).findIndex((demon) => demon.instanceId === instanceId);
}

function getDraftPoolIndex(instanceId) {
  return (state.recruitDraftPool || []).findIndex((demon) => demon.instanceId === instanceId);
}

function getLaneSwapTargetInstanceId(lane, sourceInstanceId, clientY = null, clientX = null) {
  const cards = Array.from(lane?.querySelectorAll('.dungeon-demon-card[data-instance-id]') || [])
    .filter((card) => card.dataset.instanceId !== sourceInstanceId);
  if (!cards.length) return null;

  const useHorizontalDistance = isHorizontalDropLane(lane) && Number.isFinite(clientX);
  const pointerCoordinate = useHorizontalDistance ? clientX : clientY;
  if (!Number.isFinite(pointerCoordinate)) return cards[0].dataset.instanceId || null;

  return cards
    .map((card) => {
      const rect = card.getBoundingClientRect();
      const center = useHorizontalDistance
        ? rect.left + (rect.width / 2)
        : rect.top + (rect.height / 2);
      return {
        instanceId: card.dataset.instanceId,
        distance: Math.abs(pointerCoordinate - center)
      };
    })
    .sort((a, b) => a.distance - b.distance)[0]?.instanceId || null;
}

function getLaneDropDraftIndex(lane, clientY = null, clientX = null) {
  if (!lane) return null;
  const collection = getDraftCollectionForLane(lane);
  const cards = Array.from(lane.querySelectorAll('.dungeon-demon-card[data-instance-id]'));
  if (!cards.length) return getFormationRowInsertIndex(collection, lane);

  if (isHorizontalDropLane(lane) && Number.isFinite(clientX)) {
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientX < rect.left + (rect.width / 2)) {
        const cardIndex = getDraftIndex(collection, card.dataset.instanceId);
        return cardIndex >= 0 ? cardIndex : null;
      }
    }
  } else if (Number.isFinite(clientY)) {
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY < rect.top + (rect.height / 2)) {
        const cardIndex = getDraftIndex(collection, card.dataset.instanceId);
        return cardIndex >= 0 ? cardIndex : null;
      }
    }
  }

  const lastCardIndex = getDraftIndex(collection, cards[cards.length - 1].dataset.instanceId);
  return lastCardIndex >= 0 ? lastCardIndex + 1 : null;
}

function getDraftCollectionForLane(lane) {
  if (lane?.closest('#dungeonHandGrid')) return state.recruitDraftPool;
  return state.recruitDraftTeam;
}

function getFormationRowInsertIndex(collection, lane) {
  const rowInfo = getFormationLaneInfo(lane);
  if (!rowInfo || !lane.closest('#teamGrid')) return (collection || []).length;

  return Math.min(normalizeFormationRow(rowInfo.rowIndex), (collection || []).length);
}

function getFormationLaneInfo(lane) {
  const formationLane = lane?.closest('.formation-lane');
  if (!formationLane) return null;
  const position = formationLane.dataset.formationPosition || lane.dataset.formationDrop;
  const rowIndex = Number(formationLane.dataset.formationRow || lane.dataset.formationRow || 0);
  if (!position) return null;
  return {
    position,
    rowIndex: Number.isFinite(rowIndex) ? rowIndex : 0
  };
}

function getFormationLaneDemons(collection, lane) {
  const rowInfo = getFormationLaneInfo(lane);
  if (!rowInfo) return [];
  return getDemonsForFormationRow(collection || [], rowInfo.position, rowInfo.rowIndex);
}

function isDemonInFormationLane(collection, instanceId, lane) {
  return getFormationLaneDemons(collection, lane)
    .some((demon) => demon.instanceId === instanceId);
}

function getDemonFormationRow(demon, collection = [], index = 0) {
  if (!demon) return 0;

  const explicitRow = getExplicitFormationRow(demon);
  if (explicitRow !== null) return explicitRow;

  const collectionIndex = (collection || []).findIndex((item) => item.instanceId && item.instanceId === demon.instanceId);
  return normalizeFormationRow(collectionIndex >= 0 ? collectionIndex : index);
}

function getExplicitFormationRow(demon) {
  const ownSlot = Number(demon?.formationSlot);
  if (Number.isInteger(ownSlot)) return normalizeFormationRow(ownSlot);

  const ownRow = Number(demon?.formationRow);
  if (Number.isInteger(ownRow)) return normalizeFormationRow(ownRow);

  if (demon?.instanceId && state.formationRows.has(demon.instanceId)) {
    return normalizeFormationRow(state.formationRows.get(demon.instanceId));
  }

  return null;
}

function normalizeFormationRow(rowIndex) {
  const numericRow = Number(rowIndex);
  if (!Number.isInteger(numericRow)) return 0;
  return Math.max(0, Math.min(FORMATION_GRID_SIZE - 1, numericRow));
}

function setDemonFormationRow(demon, rowIndex) {
  if (!demon) return;

  const normalizedRow = normalizeFormationRow(rowIndex);
  demon.formationRow = normalizedRow;
  demon.formationSlot = normalizedRow;
  setStoredFormationRow(demon.instanceId, normalizedRow);
}

function setStoredFormationRow(instanceId, rowIndex) {
  if (!instanceId) return;
  state.formationRows.set(instanceId, normalizeFormationRow(rowIndex));
}

function isHandLane(lane) {
  return Boolean(lane?.closest('#dungeonHandGrid'));
}

function isHorizontalDropLane(lane) {
  return isHandLane(lane);
}

function getDraftIndex(collection, instanceId) {
  return (collection || []).findIndex((demon) => demon.instanceId === instanceId);
}

function moveDraftDemonWithin(collection, instanceId, position, insertIndex = null, rowIndex = null) {
  const fromIndex = getDraftIndex(collection, instanceId);
  if (fromIndex === -1) return;

  const [demon] = collection.splice(fromIndex, 1);
  demon.position = position;
  if (rowIndex !== null && rowIndex !== undefined) {
    setDemonFormationRow(demon, rowIndex);
  }
  let targetIndex = Number.isInteger(insertIndex) && insertIndex >= 0 ? insertIndex : collection.length;
  if (targetIndex > fromIndex) targetIndex -= 1;
  targetIndex = Math.max(0, Math.min(targetIndex, collection.length));
  collection.splice(targetIndex, 0, demon);
}

function swapDraftDemons(collection, sourceInstanceId, targetInstanceId) {
  const sourceIndex = getDraftIndex(collection, sourceInstanceId);
  const targetIndex = getDraftIndex(collection, targetInstanceId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

  const sourcePosition = getDemonPosition(collection[sourceIndex]);
  const sourceRow = getDemonFormationRow(collection[sourceIndex], collection, sourceIndex);
  const targetRow = getDemonFormationRow(collection[targetIndex], collection, targetIndex);
  const swapsFormationRows = collection === state.recruitDraftTeam;
  collection[sourceIndex].position = getDemonPosition(collection[targetIndex]);
  collection[targetIndex].position = sourcePosition;
  [collection[sourceIndex], collection[targetIndex]] = [collection[targetIndex], collection[sourceIndex]];
  if (swapsFormationRows) {
    setDemonFormationRow(collection[sourceIndex], sourceRow);
    setDemonFormationRow(collection[targetIndex], targetRow);
  }
  state.recruitSwapEffectIds = [sourceInstanceId, targetInstanceId].filter(Boolean);
}

function getDraftOrder(demon) {
  if (Number.isFinite(demon?.draftOrder)) return demon.draftOrder;
  return 99;
}

function refreshRecruitDraftOrder() {
  (state.recruitDraftTeam || []).forEach((demon, index) => {
    demon.draftOrder = index;
  });
}

function refreshRecruitDraftPoolOrder() {
  (state.recruitDraftPool || []).forEach((demon, index) => {
    demon.draftOrder = index;
  });
}

function syncRecruitDraftSelection() {
  const recruit = (state.recruitDraftTeam || []).find((demon) => demon.recruitSource === 'reward' && demon.rewardId);
  state.selectedRecruitRewardId = recruit?.rewardId || null;

  const draftOriginalIds = new Set(
    (state.recruitDraftTeam || [])
      .filter((demon) => demon.recruitSource === 'team')
      .map((demon) => demon.originalInstanceId || demon.instanceId)
  );
  const replaced = (state.run?.team || []).find((demon) => !draftOriginalIds.has(demon.instanceId));
  state.selectedSwapInstanceId = replaced?.instanceId || null;
}

function readDragPayload(event) {
  const raw = event.dataTransfer?.getData('text/plain');
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function readRecruitDragPayload(event) {
  const payload = readDragPayload(event);
  if (payload) return payload;
  if (state.draggedRewardDemonKey) {
    return { type: 'reward-selection', key: state.draggedRewardDemonKey };
  }
  if (state.draggedRecruitPoolInstanceId) {
    return { type: 'recruit-pool', instanceId: state.draggedRecruitPoolInstanceId };
  }
  if (state.draggedFormationInstanceId) {
    return { type: 'recruit-team', instanceId: state.draggedFormationInstanceId };
  }
  return null;
}

function readRewardDragPayload(event) {
  const payload = readDragPayload(event);
  if (payload) return payload;
  if (state.draggedRewardDemonKey) return { type: 'reward-selection', key: state.draggedRewardDemonKey };
  if (state.draggedRecruitPoolInstanceId) return { type: 'recruit-pool', instanceId: state.draggedRecruitPoolInstanceId };
  if (state.draggedFormationInstanceId) return { type: 'recruit-team', instanceId: state.draggedFormationInstanceId };
  return null;
}

export {
  setDemonPosition,
  bindNativeDragSource,
  bindNativeDropTarget,
  clearDragOverTargets,
  bindFormationDragAndDrop,
  bindRecruitCardDragAndDrop,
  getRecruitDragPayload,
  getRecruitDropContext,
  bindTeamFormationDropTarget,
  getDraftDropZone,
  canDropRecruitPayloadOnLane,
  applyRecruitPayloadToLane,
  canDropRecruitPayloadOnCard,
  applyRecruitPayloadToCard,
  canDragOverTeamFormationTarget,
  canDropOnTeamFormationTarget,
  applyTeamFormationTargetDrop,
  bindHandFormationDropTarget,
  canDragOverHandFormationTarget,
  applyHandFormationTargetDrop,
  bindRecruitDragAndDrop,
  bindRewardDragAndDrop,
  getRewardCandidateForCard,
  bindPointerDragAndDrop,
  startPointerDrag,
  startMouseDrag,
  startTouchDrag,
  trackPointerDrag,
  createDragSession,
  movePointerDrag,
  activatePointerDrag,
  finishPointerDrag,
  cancelPointerDrag,
  cleanupPointerDragListeners,
  cleanupPointerDrag,
  getPointerDragPayload,
  getPointerDropTarget,
  canPointerDropOnCard,
  canPointerDropOnRewardBox,
  canPointerDropOnLane,
  setPointerDropTarget,
  applyPointerDrop,
  positionPointerDragGhost,
  getDragPoint,
  shouldUseCustomMouseDrag,
  findDraftDemon,
  canAddPoolDemonToTeam,
  canMoveTeamDemonToLane,
  canDropFormationOnLane,
  canAddDemonToFormationLane,
  canDropRecruitOnTeamCard,
  canDropRecruitOnPoolCard,
  applyRecruitCardDrop,
  canSwapPoolDemonIntoTeam,
  canSwapTeamDemonIntoPool,
  canSwapDraftDemons,
  addPoolDemonToTeam,
  swapPoolDemonIntoTeam,
  swapTeamDemonIntoPool,
  playRecruitSwapEffect,
  playEnemyRevealEffect,
  moveDraftTeamDemon,
  applyTeamLaneDrop,
  moveDraftPoolDemon,
  applyPoolLaneDrop,
  canReturnTeamDemonToPool,
  returnTeamDemonToPool,
  applyTeamToPoolLaneDrop,
  getHandDropPosition,
  removeDraftDemon,
  getDraftTeamIndex,
  getDraftPoolIndex,
  getLaneSwapTargetInstanceId,
  getLaneDropDraftIndex,
  getDraftCollectionForLane,
  getFormationRowInsertIndex,
  getFormationLaneInfo,
  getFormationLaneDemons,
  isDemonInFormationLane,
  getDemonFormationRow,
  getExplicitFormationRow,
  normalizeFormationRow,
  setDemonFormationRow,
  setStoredFormationRow,
  isHandLane,
  isHorizontalDropLane,
  getDraftIndex,
  moveDraftDemonWithin,
  swapDraftDemons,
  getDraftOrder,
  refreshRecruitDraftOrder,
  refreshRecruitDraftPoolOrder,
  syncRecruitDraftSelection,
  readDragPayload,
  readRecruitDragPayload,
  readRewardDragPayload
};
