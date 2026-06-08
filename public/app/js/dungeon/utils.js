import { state, elements } from './state.js';

const renderedHtmlByElement = new WeakMap();

function clearRecruitSelection() {
  state.selectedRecruitRewardId = null;
  state.selectedSwapInstanceId = null;
}

function clearDragState() {
  state.draggedRecruitPoolInstanceId = null;
  state.draggedFormationInstanceId = null;
  state.draggedRewardDemonKey = null;
}

function clearRecruitDrafts() {
  state.recruitDraftTeam = null;
  state.recruitDraftPool = null;
}

function resetCombatState() {
  state.combatLog = [];
  state.combatDemons = new Map();
}

function resetEndState() {
  state.endNotice = null;
  state.endSummary = null;
  state.endedReplayRun = null;
}

function handleAuthError(error) {
  if (error.status === 401) {
    window.AmongDemons.clearSession();
    window.location.href = '/login';
    return;
  }

  showError(error);
}

function showError(error) {
  setMessage(error.message || 'Something went wrong.', 'danger');
}

function setMessage(text, type) {
  if (!text) return;

  const className = type === 'danger'
    ? 'fight-log-notice text-danger'
    : type === 'warning'
      ? 'fight-log-notice text-warning'
      : 'fight-log-notice text-success';
  const notice = `<div class="${className}">${escapeHtml(text)}</div>`;

  elements.fightLog.classList.remove('text-muted');
  if (!state.combatLog.length && !state.endNotice) {
    elements.fightLog.innerHTML = notice;
    return;
  }

  elements.fightLog.insertAdjacentHTML('afterbegin', notice);
}

async function withBusy(button, task) {
  if (button) button.disabled = true;
  try {
    await task();
  } finally {
    syncActionButtons(button);
  }
}

function bindClick(element, handler) {
  if (element) element.addEventListener('click', handler);
}

function bindClicks(selector, handler, root = document) {
  root.querySelectorAll(selector).forEach((element) => {
    element.addEventListener('click', (event) => handler(element, event));
  });
}

function setElementHtml(element, html, options = {}) {
  if (!element) return false;

  const nextHtml = String(html || '');
  const renderKey = options.renderKey ? String(options.renderKey) : '';
  const nextCacheValue = getRenderedHtmlCacheValue(nextHtml, renderKey);
  if (renderedHtmlByElement.get(element) === nextCacheValue) return false;

  if (options.patchFormationGrid) {
    patchFormationGridHtml(element, nextHtml, renderKey);
  } else if (options.patchDemonLane) {
    patchDemonLaneHtml(element, nextHtml, renderKey);
  } else if (options.preserveDemonImages) {
    replaceHtmlPreservingDemonImages(element, nextHtml);
  } else {
    element.innerHTML = nextHtml;
  }

  renderedHtmlByElement.set(element, nextCacheValue);
  return true;
}

function replaceHtmlPreservingDemonImages(element, html) {
  const imagesByKey = getReusableDemonImages(element);

  const template = document.createElement('template');
  template.innerHTML = html;
  restoreReusableDemonImages(template.content, imagesByKey);
  element.replaceChildren(template.content);
}

function patchFormationGridHtml(element, html, renderKey = '') {
  const template = document.createElement('template');
  template.innerHTML = html;

  const currentGrid = element.querySelector('.battle-formation-grid');
  const nextGrid = template.content.querySelector('.battle-formation-grid');
  if (!currentGrid || !nextGrid) {
    const imagesByKey = getReusableDemonImages(element);
    restoreReusableDemonImages(template.content, imagesByKey);
    element.replaceChildren(template.content);
    cacheRenderedFormationSlots(element.querySelector('.battle-formation-grid'), renderKey);
    return;
  }

  const imagesByKey = getReusableDemonImages(element);
  syncElementAttributes(currentGrid, nextGrid);

  const currentSlots = getDirectFormationSlots(currentGrid);
  const currentSlotsByKey = new Map(currentSlots.map((slot) => [slot.dataset.formationSlot, slot]));
  const nextSlots = getDirectFormationSlots(nextGrid);
  const nextSlotKeys = new Set(nextSlots.map((slot) => slot.dataset.formationSlot));

  nextSlots.forEach((nextSlot, index) => {
    const key = nextSlot.dataset.formationSlot;
    const currentSlot = currentSlotsByKey.get(key);
    if (!currentSlot) {
      restoreReusableDemonImages(nextSlot, imagesByKey);
      currentGrid.insertBefore(nextSlot, currentGrid.children[index] || null);
      return;
    }

    if (currentSlot !== currentGrid.children[index]) {
      currentGrid.insertBefore(currentSlot, currentGrid.children[index] || null);
    }

    const nextSlotHtml = nextSlot.outerHTML;
    const nextSlotCacheValue = getRenderedHtmlCacheValue(nextSlotHtml, renderKey);
    if ((renderedHtmlByElement.get(currentSlot) || currentSlot.outerHTML) === nextSlotCacheValue) return;
    restoreReusableDemonImages(nextSlot, imagesByKey);
    renderedHtmlByElement.set(nextSlot, nextSlotCacheValue);
    currentSlot.replaceWith(nextSlot);
  });

  currentSlots.forEach((slot) => {
    if (!nextSlotKeys.has(slot.dataset.formationSlot)) slot.remove();
  });
}

function patchDemonLaneHtml(element, html, renderKey = '') {
  const template = document.createElement('template');
  template.innerHTML = html;

  const currentLane = element.querySelector('.formation-lane-cards');
  const nextLane = template.content.querySelector('.formation-lane-cards');
  if (!currentLane || !nextLane) {
    const imagesByKey = getReusableDemonImages(element);
    restoreReusableDemonImages(template.content, imagesByKey);
    element.replaceChildren(template.content);
    cacheRenderedDemonLaneChildren(element.querySelector('.formation-lane-cards'), renderKey);
    return;
  }

  const imagesByKey = getReusableDemonImages(element);
  syncElementAttributes(currentLane, nextLane);
  patchDirectChildrenByKey(currentLane, Array.from(nextLane.children), {
    imagesByKey,
    renderKey,
    getKey: getDemonLaneChildKey
  });
}

function getDirectFormationSlots(grid) {
  if (!grid) return [];
  return Array.from(grid.children).filter((child) => child.matches?.('.formation-slot[data-formation-slot]'));
}

function cacheRenderedFormationSlots(grid, renderKey = '') {
  getDirectFormationSlots(grid).forEach((slot) => {
    renderedHtmlByElement.set(slot, getRenderedHtmlCacheValue(slot.outerHTML, renderKey));
  });
}

function patchDirectChildrenByKey(parent, nextChildren, options = {}) {
  const { imagesByKey = new Map(), renderKey = '', getKey } = options;
  const currentChildren = Array.from(parent.children);
  const currentByKey = new Map(currentChildren.map((child, index) => [getKey(child, index), child]));
  const nextKeys = new Set(nextChildren.map((child, index) => getKey(child, index)));

  nextChildren.forEach((nextChild, index) => {
    const key = getKey(nextChild, index);
    const currentChild = currentByKey.get(key);
    if (!currentChild) {
      restoreReusableDemonImages(nextChild, imagesByKey);
      renderedHtmlByElement.set(nextChild, getRenderedHtmlCacheValue(nextChild.outerHTML, renderKey));
      parent.insertBefore(nextChild, parent.children[index] || null);
      return;
    }

    if (currentChild !== parent.children[index]) {
      parent.insertBefore(currentChild, parent.children[index] || null);
    }

    const nextChildHtml = nextChild.outerHTML;
    const nextChildCacheValue = getRenderedHtmlCacheValue(nextChildHtml, renderKey);
    if ((renderedHtmlByElement.get(currentChild) || currentChild.outerHTML) === nextChildCacheValue) return;
    restoreReusableDemonImages(nextChild, imagesByKey);
    renderedHtmlByElement.set(nextChild, nextChildCacheValue);
    currentChild.replaceWith(nextChild);
  });

  currentChildren.forEach((child, index) => {
    if (!nextKeys.has(getKey(child, index))) child.remove();
  });
}

function cacheRenderedDemonLaneChildren(lane, renderKey = '') {
  if (!lane) return;
  Array.from(lane.children).forEach((child) => {
    renderedHtmlByElement.set(child, getRenderedHtmlCacheValue(child.outerHTML, renderKey));
  });
}

function getDemonLaneChildKey(child, index = 0) {
  const instanceId = child.dataset?.instanceId;
  if (instanceId) return `demon:${instanceId}`;

  const reinforcementPosition = child.dataset?.collectionReinforcementPosition;
  if (reinforcementPosition) return `collection-reinforcement:${reinforcementPosition}`;

  if (child.classList?.contains('dungeon-hand-empty')) return 'empty:hand';
  return `node:${index}`;
}

function getRenderedHtmlCacheValue(html, renderKey = '') {
  return renderKey ? `${renderKey}\n${html}` : html;
}

function getReusableDemonImages(root) {
  const imagesByKey = new Map();
  root.querySelectorAll('.dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img').forEach((image) => {
    const key = getReusableDemonImageKey(image);
    if (key && !imagesByKey.has(key)) imagesByKey.set(key, image);
  });
  return imagesByKey;
}

function restoreReusableDemonImages(root, imagesByKey) {
  root.querySelectorAll('.dungeon-demon-card[data-instance-id] .dungeon-demon-card-image img').forEach((nextImage) => {
    const key = getReusableDemonImageKey(nextImage);
    const currentImage = key ? imagesByKey.get(key) : null;
    if (!currentImage) return;

    syncElementAttributes(currentImage, nextImage);
    nextImage.replaceWith(currentImage);
    imagesByKey.delete(key);
  });
}

function getReusableDemonImageKey(image) {
  const card = image.closest('.dungeon-demon-card[data-instance-id]');
  const instanceId = card?.dataset.instanceId;
  const src = image.getAttribute('src') || '';
  return instanceId && src ? `${instanceId}|${src}` : '';
}

function syncElementAttributes(element, source) {
  Array.from(element.attributes).forEach((attribute) => {
    if (!source.hasAttribute(attribute.name)) element.removeAttribute(attribute.name);
  });

  Array.from(source.attributes).forEach((attribute) => {
    if (element.getAttribute(attribute.name) !== attribute.value) {
      element.setAttribute(attribute.name, attribute.value);
    }
  });
}

function getModal(element, options) {
  return bootstrap.Modal.getOrCreateInstance(element, options);
}

function setTeamChoiceModalFullscreen(isFullscreen) {
  const dialog = elements.teamChoiceModal?.querySelector('.modal-dialog');
  if (!dialog) return;

  dialog.classList.toggle('modal-fullscreen', Boolean(isFullscreen));
  dialog.classList.toggle('modal-lg', !isFullscreen);
  dialog.classList.toggle('modal-dialog-centered', !isFullscreen);
  dialog.classList.toggle('modal-dialog-scrollable', !isFullscreen);
}

function syncActionButtons(fallbackButton) {
  if (fallbackButton) {
    fallbackButton.disabled = false;
  }
}

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function onReady(callback) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', callback);
    return;
  }

  callback();
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/["\\]/g, '\\$&');
}

function cloneDemons(demons) {
  return (demons || []).map((demon) => ({ ...demon }));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export {
  clearRecruitSelection,
  clearDragState,
  clearRecruitDrafts,
  resetCombatState,
  resetEndState,
  handleAuthError,
  showError,
  setMessage,
  withBusy,
  bindClick,
  bindClicks,
  setElementHtml,
  getModal,
  setTeamChoiceModalFullscreen,
  syncActionButtons,
  capitalize,
  escapeHtml,
  onReady,
  cssEscape,
  cloneDemons,
  sleep
};
