import { dungeonActions } from './registry.js';
import { state, elements } from './state.js';
import { api, activeRunPath } from './api.js';
import { clearRecruitDrafts, setMessage, withBusy, bindClicks, capitalize, escapeHtml } from './utils.js';

const isCurrentFloorBattle = (...args) => dungeonActions.isCurrentFloorBattle(...args);
const prepareRecruitStrategyState = (...args) => dungeonActions.prepareRecruitStrategyState(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);

function hasPendingBuffChoices(run = state.run) {
  return getPendingBuffChoices(run).length > 0;
}

function getPendingBuffChoices(run = state.run) {
  return (run?.buffs?.pendingChoices || [])
    .map((buff) => typeof buff === 'string' ? { id: buff, name: buff, description: '', rarity: 'common', tags: [] } : buff)
    .filter((buff) => buff?.id);
}

function renderDemonicPacts(isVisible = hasPendingBuffChoices()) {
  if (!elements.dungeonPactPanel || !elements.dungeonPactGrid) return;

  elements.dungeonPactPanel.classList.toggle('d-none', !isVisible);
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

  return `
    <button class="demonic-pact-card is-${escapeHtml(rarity)}" type="button" data-demonic-pact-id="${escapeHtml(buff.id)}">
      <span class="demonic-pact-rarity ad-${escapeHtml(rarity)}">${escapeHtml(capitalize(rarity))}</span>
      <strong>${escapeHtml(buff.name || buff.id)}</strong>
      <span class="demonic-pact-description">${escapeHtml(buff.description || '')}</span>
      <span class="demonic-pact-tags">
        ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
      </span>
    </button>
  `;
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
  hasPendingBuffChoices,
  getPendingBuffChoices,
  renderDemonicPacts,
  renderDemonicPactCard,
  chooseDemonicPact
};
