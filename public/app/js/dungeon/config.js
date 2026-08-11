export const RUN_KEY = 'amongdemons-current-run';
export const BATTLE_SPEED_KEY = 'amongdemons-battle-speed';
// Client-side battle-feel preferences toggled from /settings. Each is on unless explicitly
// disabled. Screen shake is Chu Perk (juggernaut) only; card shake covers all heavy hits.
export const BATTLE_SCREEN_SHAKE_KEY = 'amongdemons-battle-screen-shake';
export const BATTLE_CARD_SHAKE_KEY = 'amongdemons-battle-card-shake';
// Opt-in Dungeon flow preferences. Settings writes "1" only when the player
// explicitly enables one of these shortcuts.
export const DUNGEON_AUTO_RESOLVE_KEY = 'amongdemons-dungeon-auto-resolve';
export const DUNGEON_HIDE_RECRUIT_FIRST_MODAL_KEY = 'amongdemons-dungeon-hide-recruit-first-modal';
export const MAX_DUNGEON_TEAM_SIZE = 6;
export const FORMATION_GRID_COLUMNS = 3;
export const FORMATION_GRID_SIZE = 9;
export const FORMATION_CELL_CAPACITY = 1;
export const BATTLE_SPEED_OPTIONS = [0.5, 1, 2, 4];
export const FORMATION_DRAG_OVER_SELECTOR = '.formation-lane-cards.is-drag-over';
export const REWARD_DRAG_OVER_SELECTOR = '.dungeon-demon-card.is-drag-over, .formation-lane-cards.is-drag-over, .dungeon-reward-dropzone.is-drag-over';
export const COMBAT_THEMES = {
  default: { color: '#FAC51C', shadow: 'rgba(250,197,28,0.85)' },
  poison: { color: '#167246', shadow: 'rgba(22,114,70,0.92)' },
  heal: { color: '#8DE7FF', shadow: 'rgba(141,231,255,0.86)', outline: '#0d2530' },
  1: { color: '#D1D5D8', shadow: 'rgba(209,213,216,0.82)', outline: '#101820' },
  2: { color: '#171D24', shadow: 'rgba(0,0,0,0.88)' },
  3: { color: '#167246', shadow: 'rgba(22,114,70,0.92)' },
  4: { color: '#E25041', shadow: 'rgba(226,80,65,0.88)' },
  5: { color: '#C8CED2', shadow: 'rgba(200,206,210,0.82)', outline: '#101820' },
  6: { color: '#C084FC', shadow: 'rgba(192,132,252,0.9)' },
  7: { color: '#FFB23F', shadow: 'rgba(255,178,63,0.9)' },
  8: { color: '#6E8F45', shadow: 'rgba(110,143,69,0.86)' },
  9: { color: '#B8BDC2', shadow: 'rgba(184,189,194,0.84)', outline: '#101820' },
  10: { color: '#8DE7FF', shadow: 'rgba(141,231,255,0.86)', outline: '#0d2530' },
  11: { color: '#52B7FF', shadow: 'rgba(82,183,255,0.9)' }
};

export function isDungeonPreferenceEnabled(key, defaultEnabled = false) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultEnabled : stored !== '0';
  } catch (error) {
    return defaultEnabled;
  }
}

export function shouldAutoResolveDungeonFights() {
  return isDungeonPreferenceEnabled(DUNGEON_AUTO_RESOLVE_KEY, false);
}

export function shouldHideRecruitFirstModal() {
  return isDungeonPreferenceEnabled(DUNGEON_HIDE_RECRUIT_FIRST_MODAL_KEY, false);
}
