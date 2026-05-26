import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_FLOOR, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const battle = (...args) => dungeonActions.battle(...args);
const getCollectionReinforcementLimit = (...args) => dungeonActions.getCollectionReinforcementLimit(...args);
const getExplicitFormationRow = (...args) => dungeonActions.getExplicitFormationRow(...args);
const getSelectedCollectionReinforcement = (...args) => dungeonActions.getSelectedCollectionReinforcement(...args);
const getSelectedCollectionReinforcements = (...args) => dungeonActions.getSelectedCollectionReinforcements(...args);
const normalizeFormationRow = (...args) => dungeonActions.normalizeFormationRow(...args);
const shouldShowCollectionMissingTag = (...args) => dungeonActions.shouldShowCollectionMissingTag(...args);

function renderDemonCards(demons, options = {}) {
  const side = options.side === 'enemy' ? 'enemy' : 'player';
  const assignments = getFormationGridAssignments(demons || [], side);

  return `
    <div class="battle-formation battle-formation-grid battle-formation-${side}" role="list" aria-label="${side === 'enemy' ? 'Enemy' : 'Your team'} formation">
      ${assignments.map((demon, cellIndex) => renderFormationSlot(demon, cellIndex, options, side)).join('')}
    </div>
  `;
}

function renderFormationSlot(demon, cellIndex, options, side) {
  const position = getFormationSlotPosition(cellIndex, side);
  const slotNumber = cellIndex + 1;
  const sideLabel = options.side === 'enemy' ? 'Enemy' : 'Your team';
  const placeholder = shouldShowCollectionReinforcementPlaceholders(options)
    ? renderCollectionReinforcementPlaceholder(position)
    : '';
  const slotContent = demon
    ? renderDemonCard(demon, options)
    : (placeholder || renderEmptyFormationSlot(position, slotNumber));

  return `
    <div class="formation-slot formation-lane formation-slot-${position} ${demon ? 'has-demon' : 'is-empty'}" data-formation-position="${position}" data-formation-row="${cellIndex}" data-formation-slot="${cellIndex}" role="listitem" aria-label="${escapeHtml(`${sideLabel} slot ${slotNumber}`)}">
      <div class="formation-lane-cards formation-slot-cards" data-formation-drop="${position}" data-formation-row="${cellIndex}">
        ${slotContent}
      </div>
    </div>
  `;
}

function getFormationGridAssignments(demons = [], side = 'player') {
  const cells = Array.from({ length: FORMATION_GRID_SIZE }, () => null);
  const pending = [];
  const overflow = [];

  (demons || []).slice(0, FORMATION_GRID_SIZE).forEach((demon, index) => {
    const explicitCell = getExplicitFormationRow(demon);
    const explicitPosition = explicitCell !== null ? getFormationSlotPosition(explicitCell, side) : null;
    const normalizedDemon = {
      ...demon,
      position: explicitPosition || getDemonPosition(demon, index)
    };
    if (explicitCell !== null && !cells[explicitCell] && getFormationSlotPosition(explicitCell, side) === normalizedDemon.position) {
      cells[explicitCell] = normalizedDemon;
      return;
    }

    pending.push({
      demon: normalizedDemon,
      preferredCell: normalizeFormationRow(index)
    });
  });

  pending.forEach(({ demon, preferredCell }) => {
    if (!cells[preferredCell] && getFormationSlotPosition(preferredCell, side) === demon.position) {
      cells[preferredCell] = demon;
      return;
    }

    overflow.push(demon);
  });

  overflow.forEach((demon) => {
    const cellIndex = getNextOpenFormationCell(cells, side, demon.position);
    if (cellIndex >= 0) cells[cellIndex] = demon;
  });

  return cells;
}

function getNextOpenFormationCell(cells, side = 'player', position = null) {
  for (const index of getFormationSlotOrder(side, position)) {
    if (!cells[index]) return index;
  }

  return cells.findIndex((cell) => !cell);
}

function getFormationSlotPosition(cellIndex, side = 'player') {
  const column = normalizeFormationRow(cellIndex) % FORMATION_GRID_COLUMNS;
  const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
  return column === frontColumn ? 'front' : 'back';
}

function getFormationSlotOrder(side = 'player', position = null) {
  const frontColumn = side === 'enemy' ? 0 : FORMATION_GRID_COLUMNS - 1;
  const middleColumn = 1;
  const outerColumn = side === 'enemy' ? FORMATION_GRID_COLUMNS - 1 : 0;
  const columns = side === 'enemy'
    ? position === 'front'
      ? [frontColumn, middleColumn]
      : position === 'back'
        ? [outerColumn, middleColumn]
        : [frontColumn, middleColumn, outerColumn]
    : position === 'front'
      ? [frontColumn]
      : position === 'back'
        ? [middleColumn, outerColumn]
        : [frontColumn, middleColumn, outerColumn];

  return columns.flatMap((column) => (
    Array.from({ length: FORMATION_GRID_COLUMNS }, (item, rowIndex) => rowIndex * FORMATION_GRID_COLUMNS + column)
  ));
}

function getDemonsForFormationRow(demons, position, rowIndex) {
  const demon = getFormationGridAssignments(demons)[normalizeFormationRow(rowIndex)];
  return demon ? [demon] : [];
}

function renderEmptyFormationSlot(position, slotNumber) {
  return `
    <div class="formation-empty formation-empty-${position}" aria-hidden="true" data-slot-number="${slotNumber}">
      <span>Empty</span>
    </div>
  `;
}

function renderButtonMeleeIcon() {
  return renderIcon('melee', { className: 'button-melee-icon' });
}

function shouldShowCollectionReinforcementPlaceholders(options) {
  return Boolean(
    state.isRecruiting &&
    options.side === 'hand' &&
    state.run?.collectionReinforcementAvailable &&
    getSelectedCollectionReinforcements().length < getCollectionReinforcementLimit()
  );
}

function shouldShowCollectionReinforcementHandPlaceholder() {
  return shouldShowCollectionReinforcementPlaceholders({ side: 'hand' });
}

function renderCollectionReinforcementPlaceholder(position) {
  const attentionClass = state.collectionReinforcementPlaceholderInteracted ? '' : 'is-collection-reinforcement-attention';
  return `
    <button class="hunt-demon-card collection-reinforcement-placeholder ${attentionClass}" type="button" data-collection-reinforcement-position="${position}" aria-label="Add from collection">
      <div class="collection-reinforcement-placeholder-icon">${renderIcon('collection')}</div>
      <div class="collection-reinforcement-placeholder-copy">
        <span>Add from</span>
        <small>Collection</small>
      </div>
    </button>
  `;
}

function renderDungeonDemonCard(demon, options = {}) {
  const showMissingTag = shouldShowCollectionMissingTag(demon, options);
  const className = [
    options.className || '',
    showMissingTag ? 'is-new-encounter' : ''
  ].filter(Boolean).join(' ');
  const overlayHtml = `${options.overlayHtml || ''}${showMissingTag ? renderNewEncounterBadge() : ''}`;

  return renderSharedDemonCard(demon, {
    ...options,
    className,
    overlayHtml
  });
}

function renderDemonCard(demon, options) {
  const isPlayer = options.side === 'player';
  const isRecruitPoolDemon = Boolean(options.allowRecruitDrag && demon.recruitSource);
  const isRewardDraggable = Boolean(options.allowRewardDrag && demon.rewardCandidateKey);
  const canDropRecruit = Boolean(state.isRecruiting && isPlayer);
  const canDragFormation = Boolean((options.allowFormationDrag || state.isRecruiting) && isPlayer);
  const draggable = isRecruitPoolDemon || isRewardDraggable || canDragFormation;
  const classes = [
    'hunt-demon-card',
    isRecruitPoolDemon ? 'is-recruit-draggable' : '',
    isRewardDraggable ? 'is-reward-draggable' : '',
    demon.recruitSource === 'collection' && !state.collectionReinforcementStagedInteracted ? 'is-collection-reinforcement-attention' : '',
    canDropRecruit ? 'is-recruit-drop-target' : '',
    hasPoisonStatus(demon) ? 'is-poisoned' : '',
  ].filter(Boolean).join(' ');

  return renderDungeonDemonCard(demon, {
    className: classes.replace('hunt-demon-card', '').trim(),
    defeated: Number(demon.hp) <= 0,
    active: state.selectedSwapInstanceId === demon.instanceId ||
      state.selectedRecruitRewardId === demon.rewardId ||
      state.selectedRewardDemonKey === demon.rewardCandidateKey,
    overlayHtml: renderDemonStatus(demon),
    attributes: {
      'data-instance-id': demon.instanceId,
      'data-reward-id': demon.rewardId || null,
      'data-reward-candidate-key': demon.rewardCandidateKey || null,
      'data-recruit-source': demon.recruitSource || null,
      role: 'button',
      tabindex: '0',
      draggable
    }
  });
}

function renderDemonStatus(demon) {
  const poisonStacks = getPoisonStackCount(demon);
  if (!poisonStacks) return '';

  return `
    <div class="demon-status-strip" aria-label="Status effects">
      <span class="demon-status-badge demon-status-poison" aria-label="Poisoned, ${poisonStacks} stack${poisonStacks === 1 ? '' : 's'}" title="Poisoned">
        <span class="demon-status-icon">${renderPoisonIcon()}</span>
        ${poisonStacks > 1 ? `<span class="demon-status-count">${escapeHtml(poisonStacks)}</span>` : ''}
      </span>
    </div>
  `;
}

function renderNewEncounterBadge() {
  return `
    <div class="new-encounter-badge" title="Missing from collection" aria-label="Missing from collection">
      New
    </div>
  `;
}

function hasPoisonStatus(demon) {
  return getPoisonStackCount(demon) > 0;
}

function getPoisonStackCount(demon) {
  return (demon.statusEffects?.poison || []).length;
}

function renderPoisonIcon() {
  return renderIcon('poison');
}

function getDemonPosition(demon, index = 0) {
  return demon.position === 'back' || (!demon.position && index > 0) ? 'back' : 'front';
}

function getPreferredDemonPosition(demon, index = 0) {
  if (demon.position === 'back' || demon.position === 'front') return demon.position;
  if (demon.preferredPosition === 'back' || demon.preferredPosition === 'front') return demon.preferredPosition;
  return index > 0 ? 'back' : 'front';
}

function getFirstDraftIndexForPosition(collection, position) {
  const index = (collection || []).findIndex((demon, demonIndex) => getDemonPosition(demon, demonIndex) === position);
  return index >= 0 ? index : (collection || []).length;
}

function renderCombatStats(demon) {
  return renderSharedCombatStats(demon, {
    hideSpeed: isRetaliateDemon(demon)
  });
}

function isRetaliateDemon(demon = {}) {
  return Number(demon.typeId) === 8 || demon.role === 'counter_tank' || demon.targeting === 'none';
}

function renderEmptyText(text) {
  return `<p class="text-muted mb-0">${escapeHtml(text)}</p>`;
}

export {
  renderDemonCards,
  renderFormationSlot,
  getFormationGridAssignments,
  getNextOpenFormationCell,
  getFormationSlotPosition,
  getFormationSlotOrder,
  getDemonsForFormationRow,
  renderEmptyFormationSlot,
  renderButtonMeleeIcon,
  shouldShowCollectionReinforcementPlaceholders,
  shouldShowCollectionReinforcementHandPlaceholder,
  renderCollectionReinforcementPlaceholder,
  renderDungeonDemonCard,
  renderDemonCard,
  renderDemonStatus,
  renderNewEncounterBadge,
  hasPoisonStatus,
  getPoisonStackCount,
  renderPoisonIcon,
  getDemonPosition,
  getPreferredDemonPosition,
  getFirstDraftIndexForPosition,
  renderCombatStats,
  isRetaliateDemon,
  renderEmptyText
};
