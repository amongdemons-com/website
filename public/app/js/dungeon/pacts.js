import { dungeonActions } from './registry.js';
import { state, elements } from './state.js';
import { api, activeRunPath } from './api.js';
import { clearRecruitDrafts, setMessage, withBusy, bindClicks, capitalize, escapeHtml } from './utils.js';
import { renderIcon } from './shared-ui.js';

const isCurrentFloorBattle = (...args) => dungeonActions.isCurrentFloorBattle(...args);
const prepareRecruitStrategyState = (...args) => dungeonActions.prepareRecruitStrategyState(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
let activePactTooltipEventsBound = false;

function hasPendingBuffChoices(run = state.run) {
  return getPendingBuffChoices(run).length > 0;
}

function getPendingBuffChoices(run = state.run) {
  return (run?.buffs?.pendingChoices || [])
    .map((buff) => typeof buff === 'string' ? { id: buff, name: buff, description: '', rarity: 'common', tags: [] } : buff)
    .filter((buff) => buff?.id);
}

function renderDemonicPacts(isVisible = hasPendingBuffChoices()) {
  if (!elements.demonicPactOverlay || !elements.dungeonPactGrid) return;

  elements.demonicPactOverlay.classList.toggle('d-none', !isVisible);
  if (!isVisible) {
    elements.dungeonPactGrid.innerHTML = '';
    return;
  }

  const choices = getPendingBuffChoices();
  elements.dungeonPactGrid.innerHTML = choices.map(renderDemonicPactCard).join('');
  bindClicks('[data-demonic-pact-id]', (button) => chooseDemonicPact(button.dataset.demonicPactId, button), elements.dungeonPactGrid);
}

function renderDemonicPactCard(buff) {
  const rarity = String(buff.rarity || 'common').toLowerCase();
  const tags = Array.isArray(buff.tags) ? buff.tags : [];
  const icon = buff.icon || 'sparkles';

  return `
    <button class="demonic-pact-card is-${escapeHtml(rarity)}" type="button" data-demonic-pact-id="${escapeHtml(buff.id)}">
      <span class="demonic-pact-icon" aria-hidden="true">${renderIcon(icon, { size: 42, strokeWidth: 1.85 })}</span>
      <span class="demonic-pact-rarity ad-${escapeHtml(rarity)}">${escapeHtml(capitalize(rarity))}</span>
      <strong>${escapeHtml(buff.name || buff.id)}</strong>
      <span class="demonic-pact-description">${escapeHtml(buff.description || '')}</span>
      <span class="demonic-pact-tags">
        ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
      </span>
    </button>
  `;
}

function renderActivePactIcon(buff) {
  const rarity = String(buff.rarity || 'common').toLowerCase();
  const tags = Array.isArray(buff.tags) ? buff.tags : [];
  const tooltip = `${buff.name || buff.id}: ${buff.description || ''}`;
  const visibleTags = tags.slice(0, 2);

  return `
    <button
      class="active-pact-chip is-${escapeHtml(rarity)}"
      type="button"
      data-active-pact-id="${escapeHtml(buff.id)}"
      data-tooltip="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(tooltip)}"
      title="${escapeHtml(tooltip)}"
    >
      <span class="active-pact-chip-art" aria-hidden="true">
        <span class="active-pact-chip-icon">${renderIcon(buff.icon || 'sparkles', { size: 30, strokeWidth: 1.9 })}</span>
      </span>
      <span class="active-pact-chip-body">
        <strong class="active-pact-chip-name">${escapeHtml(buff.name || buff.id)}</strong>
        ${visibleTags.length ? `
          <span class="active-pact-chip-tags">
            ${visibleTags.map((tag) => `<span class="active-pact-chip-tag">${escapeHtml(tag)}</span>`).join('')}
          </span>
        ` : ''}
      </span>
    </button>
  `;
}

function getActiveBuffs(run = state.run) {
  return (run?.buffs?.activeBuffs || [])
    .map((buff) => typeof buff === 'string' ? { id: buff, name: buff, description: '', rarity: 'common', tags: [] } : buff)
    .filter((buff) => buff?.id);
}

function bindActivePactTooltips() {
  if (activePactTooltipEventsBound) return;
  activePactTooltipEventsBound = true;

  document.addEventListener('click', (event) => {
    const chip = event.target.closest?.('.active-pact-chip');
    document.querySelectorAll('.active-pact-chip.is-tooltip-visible').forEach((activeChip) => {
      if (activeChip !== chip) activeChip.classList.remove('is-tooltip-visible');
    });
    if (chip) chip.classList.add('is-tooltip-visible');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.active-pact-chip.is-tooltip-visible').forEach((activeChip) => {
      activeChip.classList.remove('is-tooltip-visible');
    });
  });
}

function beginDeferredDemonicPactReveal() {
  state.isPactRevealPending = true;
  if (state.pactRevealTimer) {
    window.clearTimeout(state.pactRevealTimer);
    state.pactRevealTimer = null;
  }
}

function completeDeferredDemonicPactRevealAfter(delay = 0) {
  if (!state.isPactRevealPending) return;
  if (!hasPendingBuffChoices(state.run)) {
    if (state.pactRevealTimer) window.clearTimeout(state.pactRevealTimer);
    state.isPactRevealPending = false;
    state.pactRevealTimer = null;
    return;
  }

  if (state.pactRevealTimer) {
    window.clearTimeout(state.pactRevealTimer);
  }

  state.pactRevealTimer = window.setTimeout(() => {
    state.isPactRevealPending = false;
    state.pactRevealTimer = null;
    state.isRecruiting = false;
    clearRecruitDrafts();
    renderRun();
  }, Math.max(0, Number(delay) || 0) + 180);
}

async function chooseDemonicPact(buffId, button = null) {
  if (!state.run || !buffId) return;
  const chosen = getPendingBuffChoices().find((buff) => buff.id === buffId);

  await withBusy(button, async () => {
    try {
      const updatedRun = await api(activeRunPath('buff'), {
        method: 'POST',
        body: { buffId }
      });

      state.run = updatedRun;
      state.combatLog = isCurrentFloorBattle(state.run) ? state.run.lastBattle?.combatLog || [] : [];
      state.isPactRevealPending = false;
      state.activeHandTab = 'hand';
      state.isRecruiting = Boolean(state.run.awaitingRecruit && !hasPendingBuffChoices(state.run));
      if (state.isRecruiting) {
        prepareRecruitStrategyState();
      } else {
        clearRecruitDrafts();
      }
      renderRun();
      setMessage(`${chosen?.name || 'Demonic Pact'} sealed.`, 'success');
    } catch (error) {
      setMessage(error.message || 'Unable to choose Demonic Pact.', 'danger');
    }
  });
}

export {
  beginDeferredDemonicPactReveal,
  completeDeferredDemonicPactRevealAfter,
  getActiveBuffs,
  bindActivePactTooltips,
  hasPendingBuffChoices,
  getPendingBuffChoices,
  renderDemonicPacts,
  renderActivePactIcon,
  renderDemonicPactCard,
  chooseDemonicPact
};
