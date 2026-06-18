import { dungeonActions } from './registry.js';
import { state, elements } from './state.js';
import { api, activeRunPath } from './api.js';
import { clearRecruitDrafts, setMessage, withBusy, bindClick, bindClicks, capitalize, escapeHtml, sleep } from './utils.js';
import { renderIcon, renderSoulAmount } from './shared-ui.js';

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
    clearDemonicPactRecastAnimation();
    elements.dungeonPactGrid.innerHTML = '';
    if (elements.dungeonPactActions) elements.dungeonPactActions.innerHTML = '';
    return;
  }

  const choices = getPendingBuffChoices();
  elements.dungeonPactGrid.innerHTML = choices.map(renderDemonicPactCard).join('');
  if (elements.dungeonPactActions) {
    elements.dungeonPactActions.innerHTML = renderDemonicPactActions();
    bindClick(document.getElementById('demonicPactRerollBtn'), (event) => rerollDemonicPacts(event.currentTarget));
  }
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
  const tooltip = `${buff.name || buff.id}: ${buff.description || ''}`;

  return `
    <button
      class="active-pact-chip is-${escapeHtml(rarity)}"
      type="button"
      data-active-pact-id="${escapeHtml(buff.id)}"
      data-tooltip="${escapeHtml(tooltip)}"
      aria-label="${escapeHtml(tooltip)}"
    >
      <span class="active-pact-chip-icon" aria-hidden="true">
        ${renderIcon(buff.icon || 'sparkles', { size: 28, strokeWidth: 1.9 })}
      </span>
    </button>
  `;
}

function renderDemonicPactActions() {
  const cost = getPactRerollCost();
  const playerSouls = Number(state.player?.souls) || 0;
  const canAfford = playerSouls >= cost;
  const title = canAfford
    ? `Recast these choices for ${cost} Souls.`
    : `Recast costs ${cost} Souls.`;

  return `
    <div class="demonic-pact-reroll-cluster ${canAfford ? '' : 'is-disabled'}">
      <button
        class="btn demonic-pact-reroll-btn"
        id="demonicPactRerollBtn"
        type="button"
        ${canAfford ? '' : 'disabled'}
        title="${escapeHtml(title)}"
        aria-label="${escapeHtml(title)}"
      >
        ${renderIcon('replay', { size: 18, className: 'demonic-pact-reroll-icon' })}
        <span>Recast</span>
      </button>
      ${renderSoulAmount(`-${cost}`, {
        className: 'soul-chip demonic-pact-reroll-cost',
        ariaLabel: `Costs ${cost} Souls`,
        showLabel: false
      })}
    </div>
  `;
}

function getPactRerollCost() {
  const serializedCost = Number(state.run?.buffs?.rerollCost);
  return Number.isFinite(serializedCost) && serializedCost > 0 ? serializedCost : 10;
}

function getActiveBuffs(run = state.run) {
  return (run?.buffs?.activeBuffs || [])
    .map((buff) => typeof buff === 'string' ? { id: buff, name: buff, description: '', rarity: 'common', tags: [] } : buff)
    .filter((buff) => buff?.id);
}

function bindActivePactTooltips() {
  if (activePactTooltipEventsBound) return;
  activePactTooltipEventsBound = true;

  document.addEventListener('pointerover', (event) => {
    const chip = event.target.closest?.('.active-pact-chip');
    if (chip) positionActivePactTooltip(chip);
  });

  document.addEventListener('focusin', (event) => {
    const chip = event.target.closest?.('.active-pact-chip');
    if (chip) positionActivePactTooltip(chip);
  });

  document.addEventListener('click', (event) => {
    const chip = event.target.closest?.('.active-pact-chip');
    document.querySelectorAll('.active-pact-chip.is-tooltip-visible').forEach((activeChip) => {
      if (activeChip !== chip) activeChip.classList.remove('is-tooltip-visible');
    });
    if (chip) {
      positionActivePactTooltip(chip);
      chip.classList.add('is-tooltip-visible');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    document.querySelectorAll('.active-pact-chip.is-tooltip-visible').forEach((activeChip) => {
      activeChip.classList.remove('is-tooltip-visible');
    });
  });

  window.addEventListener('resize', positionVisibleActivePactTooltips);
  window.addEventListener('scroll', positionVisibleActivePactTooltips, true);
}

function positionVisibleActivePactTooltips() {
  document.querySelectorAll('.active-pact-chip.is-tooltip-visible').forEach(positionActivePactTooltip);
}

function positionActivePactTooltip(chip) {
  if (!chip) return;

  const rect = chip.getBoundingClientRect();
  const tooltipWidth = Math.min(384, window.innerWidth * 0.88);
  const left = clamp(rect.left + rect.width / 2, tooltipWidth / 2 + 8, window.innerWidth - tooltipWidth / 2 - 8);
  const hasSpaceAbove = rect.top > 118;
  const top = hasSpaceAbove
    ? Math.max(8, rect.top - 8)
    : Math.min(window.innerHeight - 8, rect.bottom + 8);

  chip.style.setProperty('--active-pact-tooltip-left', `${left}px`);
  chip.style.setProperty('--active-pact-tooltip-top', `${top}px`);
  chip.classList.toggle('is-tooltip-below', !hasSpaceAbove);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
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
    state.isRecruiting = Boolean(state.run?.awaitingRecruit);
    if (state.isRecruiting) {
      prepareRecruitStrategyState();
    } else {
      clearRecruitDrafts();
    }
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

async function rerollDemonicPacts(button = null) {
  if (!state.run || !hasPendingBuffChoices(state.run)) return;
  const cost = getPactRerollCost();

  await withBusy(button, async () => {
    try {
      await playDemonicPactRecastOut();
      const payload = await api(activeRunPath('buff/reroll'), {
        method: 'POST'
      });

      state.run = payload.run || payload;
      if (payload.player) {
        syncPlayer(payload.player);
      }
      state.isPactRevealPending = false;
      beginDemonicPactRecastIn();
      renderRun();
      setMessage(`Demonic Pacts recast for ${cost} Souls.`, 'success');
    } catch (error) {
      clearDemonicPactRecastAnimation();
      setMessage(error.message || 'Unable to recast Demonic Pacts.', 'danger');
    }
  });
}

async function playDemonicPactRecastOut() {
  if (!elements.demonicPactOverlay || prefersReducedMotion()) return;
  clearDemonicPactRecastAnimation();
  void elements.demonicPactOverlay.offsetWidth;
  elements.demonicPactOverlay.classList.add('is-recasting-out');
  await sleep(340);
}

function beginDemonicPactRecastIn() {
  if (!elements.demonicPactOverlay || prefersReducedMotion()) return false;
  clearDemonicPactRecastAnimation();
  void elements.demonicPactOverlay.offsetWidth;
  elements.demonicPactOverlay.classList.add('is-recasting-in');
  window.setTimeout(() => {
    elements.demonicPactOverlay?.classList.remove('is-recasting-in');
    elements.demonicPactOverlay?.classList.add('has-recast-settled');
  }, 840);
  return true;
}

function clearDemonicPactRecastAnimation() {
  elements.demonicPactOverlay?.classList.remove('is-recasting-out', 'is-recasting-in', 'has-recast-settled');
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function syncPlayer(player) {
  if (!player) return;

  state.player = player;
  const session = window.AmongDemons.getSession();
  window.AmongDemons.setSession({
    ...session,
    player
  });
  window.AmongDemons.ui?.updateNavAccount?.(player);
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
  chooseDemonicPact,
  rerollDemonicPacts
};
