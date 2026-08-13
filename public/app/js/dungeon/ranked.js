import { dungeonActions } from './registry.js';
import { state, elements } from './state.js';
import { api, activeRunPath } from './api.js';
import { escapeHtml, getModal, setMessage, showError } from './utils.js';

const applyRunPayload = (...args) => dungeonActions.applyRunPayload(...args);
const battle = (...args) => dungeonActions.battle(...args);
const finishRun = (...args) => dungeonActions.finishRun(...args);

let shownResultKey = null;
let resultChoiceBusy = false;
let rankedChoiceBusy = false;
let pendingEscapeContinuation = null;

function isDungeonRankedEncounter(run = state.run) {
  return Boolean(run?.rankedEncounter && ['choice', 'result'].includes(run.rankedEncounter.status));
}

function isDungeonRankedPlanning(run = state.run) {
  return run?.rankedEncounter?.status === 'choice';
}

function getVisibleDungeonRankedEncounter(run = state.run) {
  if (run?.awaitingRecruit && run.nextRankedEncounter?.status === 'choice') {
    return run.nextRankedEncounter;
  }
  return run?.rankedEncounter || null;
}

function renderDungeonRankedEnemyIdentity(encounter = state.run?.rankedEncounter) {
  if (!encounter?.opponent) return '';
  const opponent = encounter.opponent;
  const name = String(opponent.hunterName || 'Hunter');
  const division = String(opponent.liveDivision || opponent.division || 'Unranked');
  const slug = getRankSlug(division);
  const hunterUrl = window.AmongDemons.appUrl(`/hunter/${encodeURIComponent(name)}`);

  return `
    <span class="dungeon-ranked-opponent-identity">
      <a class="dungeon-ranked-opponent-name" href="${escapeHtml(hunterUrl)}">${escapeHtml(name)}</a>
      <span class="dungeon-ranked-opponent-separator" aria-hidden="true">&middot;</span>
      <span class="rank-division-text rank-division-text--${escapeHtml(slug)}">${escapeHtml(division)}</span>
    </span>
  `;
}

function openDungeonRankedChoice() {
  const encounter = state.run?.rankedEncounter;
  if (encounter?.status !== 'choice' || !elements.dungeonRankedChoiceModal) return false;

  rankedChoiceBusy = false;
  const opponentName = String(encounter.opponent?.hunterName || 'A rival hunter');
  if (elements.dungeonRankedChoiceUsername) {
    elements.dungeonRankedChoiceUsername.textContent = opponentName;
  }
  setRankedChoiceButtons(false);
  if (encounter.escapeAttempted) {
    if (elements.dungeonRankedChoiceEscapeBtn) elements.dungeonRankedChoiceEscapeBtn.disabled = true;
    if (elements.dungeonRankedChoiceChance) {
      elements.dungeonRankedChoiceChance.textContent = 'Escape failed';
    }
  } else if (elements.dungeonRankedChoiceChance) {
    elements.dungeonRankedChoiceChance.textContent = '70% chance';
  }

  getModal(elements.dungeonRankedChoiceModal, {
    backdrop: 'static',
    keyboard: false
  }).show();
  return true;
}

async function fightDungeonRankedEncounter() {
  if (rankedChoiceBusy || !isDungeonRankedPlanning()) return;
  rankedChoiceBusy = true;
  setRankedChoiceButtons(true, 'Fighting...');
  getModal(elements.dungeonRankedChoiceModal).hide();
  try {
    await battle();
  } finally {
    rankedChoiceBusy = false;
    setRankedChoiceButtons(false);
  }
}

async function tryDungeonRankedEscape() {
  const encounter = state.run?.rankedEncounter;
  if (rankedChoiceBusy || encounter?.status !== 'choice') return;
  if (encounter.escapeAttempted) {
    await fightDungeonRankedEncounter();
    return;
  }

  rankedChoiceBusy = true;
  setRankedChoiceButtons(true, 'Running...');

  try {
    const opponentName = String(encounter.opponent?.hunterName || 'the rival hunter');
    const payload = await api(activeRunPath('ranked/escape'), { method: 'POST' });
    getModal(elements.dungeonRankedChoiceModal).hide();

    if (!payload.escaped) {
      if (payload.run) await applyRunPayload(payload.run);
      setMessage(`${opponentName} cut off your escape. Fight!`, 'warning');
      rankedChoiceBusy = false;
      await battle();
      return;
    }

    if (payload.run) await applyRunPayload(payload.run);
    pendingEscapeContinuation = {
      opponentName,
      floor: Math.max(1, Number(payload.nextFloor) || Number(state.run?.currentFloor) + 1 || 1)
    };
    showRankedResultModal({
      result: payload.rankedResult,
      title: 'Escape Successful',
      summary: `You slipped away from ${opponentName}. Prepare for Floor ${pendingEscapeContinuation.floor}.`
    });
  } catch (error) {
    rankedChoiceBusy = false;
    setRankedChoiceButtons(false);
    showError(error);
  }
}

function setRankedChoiceButtons(disabled, primaryLabel = 'Fight') {
  if (elements.dungeonRankedChoiceFightBtn) {
    elements.dungeonRankedChoiceFightBtn.disabled = disabled;
    elements.dungeonRankedChoiceFightBtn.textContent = primaryLabel;
  }
  if (elements.dungeonRankedChoiceEscapeBtn) {
    elements.dungeonRankedChoiceEscapeBtn.disabled = disabled;
  }
  if (elements.dungeonRankedChoiceEscapeLabel) {
    elements.dungeonRankedChoiceEscapeLabel.textContent = disabled && primaryLabel === 'Running...'
      ? 'Running...'
      : 'Try to Run';
  }
}

function showPendingDungeonRankedResult(run = state.run) {
  const encounter = run?.rankedEncounter;
  const result = encounter?.result;
  if (encounter?.status !== 'result' || !result || !elements.dungeonRankedResultModal) return false;

  const key = `${run.runId}:${encounter.floor}:${result.rating}:${result.delta}`;
  if (shownResultKey === key && elements.dungeonRankedResultModal.classList.contains('show')) return true;
  shownResultKey = key;
  resultChoiceBusy = false;

  const won = result.winner === 'player';
  const opponentName = encounter.opponent?.hunterName || 'the rival hunter';
  const nextFloor = Math.max(1, Number(encounter.floor) + 1 || Number(run.currentFloor) + 1 || 1);
  return showRankedResultModal({
    result,
    title: won ? 'Ranked Victory' : 'Ranked Defeat',
    summary: won
      ? `${formatNumber(result.rating)} total RP. Continue to prepare for Floor ${nextFloor}.`
      : `${formatNumber(result.rating)} total RP. ${opponentName} ended this descent.`
  });
}

function showRankedResultModal({ result, title, summary, continueLabel = 'Continue' } = {}) {
  if (!result || !elements.dungeonRankedResultModal) return false;

  // Each result modal starts a new interaction. A successful Ranked victory
  // can leave this guard set after its request completes, so carrying it into
  // a later successful escape would make that escape's Continue button inert.
  resultChoiceBusy = false;

  const won = result.winner === 'player';
  const rank = getRankPresentation(result.division);
  const rankShell = elements.dungeonRankedResultRank;
  rankShell?.classList.forEach((className) => {
    if (className.startsWith('ranked-rank--')) rankShell.classList.remove(className);
  });
  rankShell?.classList.add(`ranked-rank--${rank.slug}`);

  if (elements.dungeonRankedResultTitle) {
    elements.dungeonRankedResultTitle.textContent = title || (won ? 'Ranked Victory' : 'Ranked Defeat');
  }
  if (elements.dungeonRankedResultRankImage) {
    elements.dungeonRankedResultRankImage.src = rank.imageUrl;
    elements.dungeonRankedResultRankImage.alt = `${rank.division} rank emblem`;
  }
  if (elements.dungeonRankedResultDivision) {
    elements.dungeonRankedResultDivision.textContent = rank.division;
  }
  if (elements.dungeonRankedResultDelta) {
    elements.dungeonRankedResultDelta.textContent = `${formatSigned(result.delta)} RP`;
    elements.dungeonRankedResultDelta.classList.toggle('is-loss', Number(result.delta) < 0);
  }
  if (elements.dungeonRankedResultSummary) {
    elements.dungeonRankedResultSummary.textContent = summary || `${formatNumber(result.rating)} total RP.`;
  }
  if (elements.dungeonRankedResultContinueBtn) {
    elements.dungeonRankedResultContinueBtn.disabled = false;
    elements.dungeonRankedResultContinueBtn.textContent = continueLabel;
  }

  getModal(elements.dungeonRankedResultModal, {
    backdrop: 'static',
    keyboard: false
  }).show();
  return true;
}

async function continueDungeonRankedResult() {
  if (resultChoiceBusy) return;
  if (pendingEscapeContinuation) {
    resultChoiceBusy = true;
    const escape = pendingEscapeContinuation;
    pendingEscapeContinuation = null;
    getModal(elements.dungeonRankedResultModal).hide();
    setMessage(`Escaped ${escape.opponentName}. Prepare your team for Floor ${escape.floor}.`, 'success');
    resultChoiceBusy = false;
    return;
  }
  const encounter = state.run?.rankedEncounter;
  const result = encounter?.result;
  if (encounter?.status !== 'result' || !result) return;

  resultChoiceBusy = true;
  const button = elements.dungeonRankedResultContinueBtn;
  if (button) {
    button.disabled = true;
    button.textContent = 'Continuing...';
  }

  try {
    getModal(elements.dungeonRankedResultModal).hide();
    if (result.winner !== 'player') {
      await finishRun('A rival hunter ended your descent.', { defeated: true });
      if (state.run) {
        resultChoiceBusy = false;
        showPendingDungeonRankedResult(state.run);
      }
      return;
    }

    const payload = await api(activeRunPath('ranked/continue'), { method: 'POST' });
    await applyRunPayload(payload.run);
    const nextFloor = Math.max(1, Number(payload.nextFloor) || Number(state.run?.currentFloor) + 1 || 1);
    setMessage(`Ranked victory. Prepare your team for Floor ${nextFloor}.`, 'success');
  } catch (error) {
    if (button) {
      button.disabled = false;
      button.textContent = 'Continue';
    }
    showError(error);
  } finally {
    resultChoiceBusy = false;
  }
}

function getRankPresentation(division = 'Bronze III') {
  const label = String(division || 'Bronze III');
  const normalized = label.trim().toLowerCase();
  const tier = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'demonic']
    .find((candidate) => normalized.startsWith(candidate)) || 'bronze';
  return {
    division: label,
    slug: getRankSlug(label),
    imageUrl: `/app/images/assets/ranks/${tier}.svg`
  };
}

function getRankSlug(division) {
  return String(division || 'Unranked')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unranked';
}

function formatSigned(value) {
  const number = Math.trunc(Number(value) || 0);
  return `${number >= 0 ? '+' : ''}${formatNumber(number)}`;
}

function formatNumber(value) {
  return Math.trunc(Number(value) || 0).toLocaleString();
}

export {
  continueDungeonRankedResult,
  fightDungeonRankedEncounter,
  getVisibleDungeonRankedEncounter,
  getRankPresentation,
  getRankSlug,
  isDungeonRankedEncounter,
  isDungeonRankedPlanning,
  openDungeonRankedChoice,
  renderDungeonRankedEnemyIdentity,
  showRankedResultModal,
  showPendingDungeonRankedResult,
  tryDungeonRankedEscape
};
