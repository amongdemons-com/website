import { dungeonActions } from './registry.js';
import { state, elements } from './state.js';
import { api, activeRunPath } from './api.js';
import { clearRecruitDrafts, setMessage, withBusy, bindClick, bindClicks, capitalize, escapeHtml, sleep } from './utils.js';
import { renderIcon, renderSoulAmount } from './shared-ui.js';

const audio = window.AmongDemons.audio;

const isCurrentFloorBattle = (...args) => dungeonActions.isCurrentFloorBattle(...args);
const prepareRecruitStrategyState = (...args) => dungeonActions.prepareRecruitStrategyState(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);
const DEMON_RARITY_TOKEN_PATTERN = /(\[(?:common|uncommon|rare|epic|legendary|mythic)\])/gi;
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

  const wasVisible = !elements.demonicPactOverlay.classList.contains('d-none');
  elements.demonicPactOverlay.classList.toggle('d-none', !isVisible);
  if (!isVisible) {
    state.isPactTeamPreview = false;
    syncDemonicPactView();
    clearDemonicPactRecastAnimation();
    elements.dungeonPactGrid.innerHTML = '';
    if (elements.dungeonPactActions) elements.dungeonPactActions.innerHTML = '';
    return;
  }

  if (!wasVisible) state.isPactTeamPreview = false;
  const choices = getPendingBuffChoices();
  elements.dungeonPactGrid.innerHTML = choices.map(renderDemonicPactCard).join('');
  if (elements.dungeonPactActions) {
    elements.dungeonPactActions.innerHTML = renderDemonicPactActions();
    bindClick(document.getElementById('demonicPactRerollBtn'), (event) => rerollDemonicPacts(event.currentTarget));
  }
  bindClicks('[data-demonic-pact-id]', (button) => chooseDemonicPact(button.dataset.demonicPactId, button), elements.dungeonPactGrid);
  syncDemonicPactView();
}

function toggleDemonicPactView() {
  if (!elements.demonicPactOverlay || elements.demonicPactOverlay.classList.contains('d-none')) return;
  state.isPactTeamPreview = !state.isPactTeamPreview;
  renderRun();
}

function syncDemonicPactView() {
  const isTeamPreview = Boolean(state.isPactTeamPreview);
  elements.demonicPactOverlay?.classList.toggle('is-team-preview', isTeamPreview);
  if (!elements.demonicPactViewToggle) return;

  elements.demonicPactViewToggle.classList.toggle('d-none', isTeamPreview);
  elements.demonicPactViewToggle.textContent = 'View Team';
  elements.demonicPactViewToggle.setAttribute('aria-expanded', String(!isTeamPreview));
}

function renderDemonicPactCard(buff) {
  const rarity = String(buff.rarity || 'common').toLowerCase();
  const tags = Array.isArray(buff.tags) ? buff.tags : [];
  const icon = buff.icon || 'sparkles';

  return `
    <button class="demonic-pact-card is-${escapeHtml(rarity)}" type="button" data-demonic-pact-id="${escapeHtml(buff.id)}">
      <span class="demonic-pact-icon" aria-hidden="true">${renderIcon(icon, { size: 42, strokeWidth: 1.85 })}</span>
      <span class="demonic-pact-rarity rarity-${escapeHtml(rarity)}">${escapeHtml(capitalize(rarity))}</span>
      <strong>${escapeHtml(buff.name || buff.id)}</strong>
      <span class="demonic-pact-description">${renderDemonicPactDescription(buff.description)}</span>
      <span class="demonic-pact-tags">
        ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}
      </span>
    </button>
  `;
}

function renderDemonicPactDescription(description = '') {
  return String(description)
    .split(DEMON_RARITY_TOKEN_PATTERN)
    .map((part) => {
      const match = part.match(/^\[([a-z]+)\]$/i);
      if (!match) return escapeHtml(part);

      const rarity = match[1].toLowerCase();
      return `<span class="demonic-pact-rarity-token rarity-${escapeHtml(rarity)}">${escapeHtml(part)}</span>`;
    })
    .join('');
}

function renderActivePactIcon(buff) {
  const rarity = String(buff.rarity || 'common').toLowerCase();
  const tooltip = getActivePactTooltip(buff);
  const escapedTooltip = escapeTooltipAttribute(tooltip);
  const tagName = buff.href ? 'a' : 'button';
  const linkAttributes = buff.href
    ? `href="${escapeHtml(buff.href)}"`
    : 'type="button"';
  const attentionClass = buff.attention ? 'is-level-power-attention' : '';
  const temporaryClass = buff.expiresAt ? 'is-temporary' : '';

  return `
    <${tagName}
      class="active-pact-chip is-${escapeHtml(rarity)} ${attentionClass} ${temporaryClass}"
      ${linkAttributes}
      data-active-pact-id="${escapeHtml(buff.id)}"
      data-tooltip="${escapedTooltip}"
      aria-label="${escapedTooltip}"
    >
      <span class="active-pact-chip-icon" aria-hidden="true">
        ${renderIcon(buff.icon || 'sparkles', { size: 28, strokeWidth: 1.9 })}
      </span>
    </${tagName}>
  `;
}

function compactActivePacts(buffs = [], options = {}) {
  const compacted = [];
  const buffById = new Map();
  const onlySource = options.onlySource ? String(options.onlySource) : '';

  buffs.forEach((buff) => {
    if (!buff?.id) return;
    if (onlySource && String(buff.source || '') !== onlySource) {
      compacted.push(buff);
      return;
    }

    const existing = buffById.get(buff.id);
    if (existing) {
      existing.stackCount += 1;
      return;
    }

    const compactedBuff = { ...buff, stackCount: 1 };
    buffById.set(buff.id, compactedBuff);
    compacted.push(compactedBuff);
  });

  return compacted;
}

function renderStackedActivePactIcon(buff, options = {}) {
  const stackCount = Math.max(1, Math.trunc(Number(buff?.stackCount) || 1));
  const stackClass = options.stackClass || 'active-pact-stack';
  const countClass = options.countClass || 'active-pact-stack-count';
  const renderedBuff = stackCount > 1
    ? {
        ...buff,
        tooltip: `${buff.name || buff.id}: ${formatStackedPactDescription(buff, stackCount)}`
      }
    : buff;

  return `
    <span class="${escapeHtml(stackClass)}">
      ${renderActivePactIcon(renderedBuff)}
      ${stackCount > 1 ? `
        <span class="${escapeHtml(countClass)}" aria-label="${stackCount} stacks">${stackCount}</span>
      ` : ''}
    </span>
  `;
}

function formatStackedPactDescription(buff, stackCount) {
  const effectPercentages = (Array.isArray(buff?.effects) ? buff.effects : [])
    .filter((effect) => String(effect?.type || '').endsWith('_mult'))
    .map((effect) => Math.abs((Number(effect.value) - 1) * 100))
    .filter((value) => Number.isFinite(value) && value > 0);
  const description = String(buff?.description || '');
  let replacementCount = 0;

  const stackedDescription = description.replace(/(\d+(?:\.\d+)?)%/g, (match, rawValue) => {
    const baseValue = Number(rawValue);
    const effectIndex = effectPercentages.findIndex(
      (value) => Math.abs(value - baseValue) < .001
    );
    if (effectIndex < 0) return match;

    effectPercentages.splice(effectIndex, 1);
    replacementCount += 1;
    const totalValue = baseValue * stackCount;
    return `${formatPactPercentage(totalValue)}% (${stackCount} x ${formatPactPercentage(baseValue)}%)`;
  });
  if (replacementCount > 0) return stackedDescription;

  return `${description.replace(/\.$/, '')} (${stackCount} copies).`;
}

function formatPactPercentage(value) {
  const rounded = Math.round((Number(value) || 0) * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/0+$/, '').replace(/\.$/, '');
}

function getActivePactTooltip(buff = {}) {
  const baseTooltip = buff.tooltip || `${buff.name || buff.id}: ${buff.description || ''}`;
  const expiryTooltip = getBuffExpiryTooltip(buff);
  return [baseTooltip, expiryTooltip].filter(Boolean).join('\n');
}

function getBuffExpiryTooltip(buff = {}) {
  const expiresAt = Date.parse(buff.expiresAt || '');
  if (!Number.isFinite(expiresAt)) return '';

  const remainingSeconds = Math.ceil((expiresAt - Date.now()) / 1000);
  if (remainingSeconds <= 0) return 'Expired';

  return `Expires in ${formatBuffExpiryDuration(remainingSeconds)}`;
}

function formatBuffExpiryDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatBuffExpiryTimestamp(expiresAt) {
  try {
    return new Date(expiresAt).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return '';
  }
}

function escapeTooltipAttribute(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;');
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
        class="btn btn-primary demonic-pact-reroll-btn"
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
  return [
    ...(Array.isArray(run?.worldBuffs) ? run.worldBuffs : []),
    ...(Array.isArray(run?.buffs?.activeBuffs) ? run.buffs.activeBuffs : [])
  ]
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
    audio?.play('sfx.dungeon.pactReveal', { volume: 0.88 });
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
      audio?.play('sfx.dungeon.pactChoose', { volume: 0.9 });
      setMessage(`${chosen?.name || 'Demonic Pact'} sealed.`, 'success');
    } catch (error) {
      console.error(error);
      setMessage(error, 'danger');
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
      audio?.play('sfx.dungeon.pactReroll', { volume: 0.86 });
      setMessage(`Demonic Pacts recast for ${cost} Souls.`, 'success');
    } catch (error) {
      clearDemonicPactRecastAnimation();
      console.error(error);
      setMessage(error, 'danger');
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
  toggleDemonicPactView,
  syncDemonicPactView,
  compactActivePacts,
  renderActivePactIcon,
  renderStackedActivePactIcon,
  renderDemonicPactCard,
  chooseDemonicPact,
  rerollDemonicPacts
};
