import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const battle = (...args) => dungeonActions.battle(...args);
const cashOut = (...args) => dungeonActions.cashOut(...args);
const cashOutDungeon = (...args) => dungeonActions.cashOutDungeon(...args);
const continueShortTeam = (...args) => dungeonActions.continueShortTeam(...args);
const syncCompressedFormationLanes = (...args) => dungeonActions.syncCompressedFormationLanes(...args);

function cacheElements() {
  [
    'navPlayerName',
    'dungeonTitle',
    'dungeonRewardStrip',
    'runLoading',
    'runEmpty',
    'runPanel',
    'dungeonBottomPanel',
    'demonicPactOverlay',
    'dungeonPactGrid',
    'dungeonPactActions',
    'teamGrid',
    'enemyGrid',
    'dungeonHandBar',
    'dungeonHandGrid',
    'dungeonRewardBox',
    'dungeonRewardGrid',
    'teamSideTitle',
    'enemySideTitle',
    'dungeonJoiner',
    'dungeonCenterActions',
    'fightLog',
    'fightLogActions',
    'teamChoiceModal',
    'teamChoiceModalTitle',
    'teamChoiceModalSubtitle',
    'teamChoiceModalBody',
    'teamChoiceModalFooter',
    'cashoutModal',
    'cashoutModalBody',
    'cashoutConfirmBtn',
    'shortTeamModal',
    'confirmShortTeamBtn'
  ].forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.logoutBtn = document.getElementById('logoutBtn');
}

function bindActions() {
    bindClick(elements.logoutBtn, () => {
      window.AmongDemons.clearSession();
      window.location.href = window.AmongDemons.appUrl('/login');
    });

  bindClick(elements.cashoutConfirmBtn, cashOutDungeon);
  bindClick(elements.confirmShortTeamBtn, continueShortTeam);
  window.addEventListener('resize', syncCompressedFormationLanes);
}

export {
  cacheElements,
  bindActions
};
