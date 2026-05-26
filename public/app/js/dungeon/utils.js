import { state, elements } from './state.js';

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
