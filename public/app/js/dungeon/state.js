import { BATTLE_SPEED_KEY, BATTLE_SPEED_OPTIONS } from './config.js';

const session = window.AmongDemons.getSession();

export const state = {
  player: session.player || null,
  run: null,
  startOptions: null,
  selectedRecruitRewardId: null,
  selectedSwapInstanceId: null,
  selectedRewardDemonKey: null,
  rewardDraftCandidate: null,
  isRecruiting: false,
  isResultAnimating: false,
  draggedRecruitPoolInstanceId: null,
  draggedFormationInstanceId: null,
  draggedRewardDemonKey: null,
  recruitSwapEffectIds: [],
  pendingHandFlowSources: null,
  isEnemyPreviewDeferred: false,
  enemyRevealEffectIds: [],
  battleHandPreview: null,
  recruitDraftTeam: null,
  recruitDraftPool: null,
  collectionDemons: null,
  collectionReinforcementPlaceholderInteracted: false,
  collectionReinforcementStagedInteracted: true,
  combatLog: [],
  combatDemons: new Map(),
  battleSpeed: getStoredBattleSpeed(),
  isBattleAnimating: false,
  endNotice: null,
  endSummary: null,
  endedReplayRun: null,
  formationRows: new Map(),
  isLoading: true
};

export const elements = {};

export let laneResizeObserver = null;

export function setLaneResizeObserver(observer) {
  laneResizeObserver = observer;
}

export function getStoredBattleSpeed() {
  const stored = Number(localStorage.getItem(BATTLE_SPEED_KEY));
  return BATTLE_SPEED_OPTIONS.includes(stored) ? stored : 1;
}
