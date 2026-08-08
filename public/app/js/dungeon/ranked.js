import { dungeonActions } from './registry.js';
import { state, elements } from './state.js';
import { api, activeRunPath } from './api.js';
import { escapeHtml, getModal, setMessage, showError } from './utils.js';

const applyRunPayload = (...args) => dungeonActions.applyRunPayload(...args);
const battle = (...args) => dungeonActions.battle(...args);
const canStartCurrentBattle = (...args) => dungeonActions.canStartCurrentBattle(...args);
const finishRun = (...args) => dungeonActions.finishRun(...args);

let shownResultKey = null;
let resultChoiceBusy = false;

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
  return showRankedResultModal({
    result,
    title: won ? 'Ranked Victory' : 'Ranked Defeat',
    summary: won
      ? `${formatNumber(result.rating)} total RP. Continue to resume your dungeon.`
      : `${formatNumber(result.rating)} total RP. ${opponentName} ended this descent.`
  });
}

function showRankedResultModal({ result, title, summary, continueLabel = 'Continue' } = {}) {
  if (!result || !elements.dungeonRankedResultModal) return false;

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
    setMessage('Ranked victory. Your descent continues.', 'success');
    if (canStartCurrentBattle()) await battle();
  } catch (error) {
    resultChoiceBusy = false;
    if (button) {
      button.disabled = false;
      button.textContent = 'Continue';
    }
    showError(error);
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
  getVisibleDungeonRankedEncounter,
  getRankPresentation,
  getRankSlug,
  isDungeonRankedEncounter,
  isDungeonRankedPlanning,
  renderDungeonRankedEnemyIdentity,
  showRankedResultModal,
  showPendingDungeonRankedResult
};
