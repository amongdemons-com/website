import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const clearRewardSelection = (...args) => dungeonActions.clearRewardSelection(...args);
const getDemonFormationRow = (...args) => dungeonActions.getDemonFormationRow(...args);
const getDemonPosition = (...args) => dungeonActions.getDemonPosition(...args);
const getFormationGridAssignments = (...args) => dungeonActions.getFormationGridAssignments(...args);
const getNextOpenFormationCell = (...args) => dungeonActions.getNextOpenFormationCell(...args);
const getPreferredDemonPosition = (...args) => dungeonActions.getPreferredDemonPosition(...args);
const getSelectedRewardCandidate = (...args) => dungeonActions.getSelectedRewardCandidate(...args);
const refreshRecruitDraftOrder = (...args) => dungeonActions.refreshRecruitDraftOrder(...args);
const refreshRecruitDraftPoolOrder = (...args) => dungeonActions.refreshRecruitDraftPoolOrder(...args);
const returnTeamDemonToPool = (...args) => dungeonActions.returnTeamDemonToPool(...args);
const syncRecruitDraftSelection = (...args) => dungeonActions.syncRecruitDraftSelection(...args);

function prepareRecruitStrategyState() {
  clearRecruitSelection();
  clearRewardSelection();
  clearDragState();
  clearRecruitDrafts();
  if (state.run?.collectionReinforcementAvailable) {
    state.collectionReinforcementPlaceholderInteracted = false;
    state.collectionReinforcementStagedInteracted = true;
  }
}

function getCurrentRecruitRewards() {
  if (!state.run) return [];
  return (state.run.rewards || []).filter((reward) => (
    reward.floor === state.run.currentFloor &&
    reward.type === 'recruit' &&
    !reward.claimed &&
    !reward.recruited &&
    !reward.saved &&
    !reward.extracted &&
    !reward.discarded
  ));
}

function getRecruitPreviewTeam() {
  ensureRecruitDraft();
  return cloneDemons(state.recruitDraftTeam || []).map(applyDungeonCombatStatPreviewToDemon);
}

function getRecruitPreviewHand() {
  ensureRecruitDraft();
  return cloneDemons(state.recruitDraftPool || []).map(applyDungeonCombatStatPreviewToDemon);
}

function getRecruitPreviewEnemyTeam() {
  return cloneDemons(state.run?.nextEnemies || []);
}

function ensureRecruitDraft() {
  if (!state.run?.awaitingRecruit || !state.isRecruiting) return;
  if (state.recruitDraftTeam && state.recruitDraftPool) return;
  if (!state.pendingHandFlowSources) {
    state.isEnemyPreviewDeferred = false;
  }

  state.recruitDraftTeam = (state.run.team || []).map((demon, index) => ({
    ...getFullHpDemon(demon),
    instanceId: demon.instanceId,
    originalInstanceId: demon.instanceId,
    recruitSource: 'team',
    draftOrder: index,
    formationRow: getDemonFormationRow(demon, state.run.team || [], index),
    formationSlot: getDemonFormationRow(demon, state.run.team || [], index),
    position: getDemonPosition(demon, index)
  }));
  state.recruitDraftPool = [
    ...getCurrentRecruitRewards().map((reward, index) => ({
      ...getFullHpDemon(reward.demon),
      instanceId: `reward-${reward.rewardId}`,
      rewardId: reward.rewardId,
      recruitSource: 'reward',
      position: getDemonPosition(reward.demon, index)
    }))
  ];
}

async function ensureCollectionLoaded() {
  if (state.collectionDemons) return;

  const payload = await api('/api/demons');
  state.collectionDemons = payload.demons || [];
}

function getAvailableCollectionReinforcements() {
  if (!state.run?.collectionReinforcementAvailable || getSelectedCollectionReinforcements().length >= getCollectionReinforcementLimit()) return [];
  const existingCollectionIds = new Set((state.run.team || [])
    .map((demon) => Number(demon.collectionDemonId))
    .filter(Boolean));

  const usedCollectionIds = new Set([
    ...(state.recruitDraftTeam || []),
    ...(state.recruitDraftPool || [])
  ]
    .map((demon) => Number(demon.collectionDemonId))
    .filter(Boolean));

  return (state.collectionDemons || [])
    .filter((demon) => !existingCollectionIds.has(Number(demon.id)) && !usedCollectionIds.has(Number(demon.id)));
}

function getCollectionReinforcementLimit() {
  const limit = Number(state.run?.collectionReinforcementLimit);
  if (limit > 0) return limit;
  return state.run?.collectionReinforcementAvailable ? 1 : 0;
}

function getCollectionSlotKey(demon) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  const rarity = String(demon?.rarity || '').toLowerCase();
  if (!typeId || !rarity) return null;
  return `${typeId}:${rarity}`;
}

function isDemonInCollection(demon) {
  if (demon?.recruitSource === 'collection') return true;
  if (demon?.collectionDemonId) return true;
  const key = getCollectionSlotKey(demon);
  if (!key) return false;
  return (state.collectionDemons || []).some((collectionDemon) => getCollectionSlotKey(collectionDemon) === key);
}

function shouldShowCollectionMissingTag(demon, options = {}) {
  if (options.suppressCollectionMissingTag) return false;
  if (state.isBattleAnimating) return false;
  if (!Array.isArray(state.collectionDemons)) return false;
  return Boolean(!isDemonInCollection(demon));
}

function getFullHpDemon(demon) {
  const maxHp = Math.max(Number(demon.maxHp) || Number(demon.hp) || 1, 1);
  const next = {
    ...demon,
    maxHp,
    hp: maxHp
  };

  delete next.accountStatsApplied;
  delete next.accountStatsPreviewed;
  delete next.runBuffStatsPreviewed;
  delete next.battleBuffs;
  delete next.deathBuffsHandled;
  delete next.shield;

  return next;
}

function applyRunBuffStatPreviewToDemon(demon = {}) {
  if (!demon || demon.runBuffStatsApplied || demon.runBuffStatsPreviewed) return { ...demon };

  const maxHpMult = getRunBuffEffectMultiplier('max_hp_mult', demon);
  const speedMult = getRunBuffEffectMultiplier('speed_mult', demon);
  const baseMaxHp = Math.max(1, Number(demon.runBaseMaxHp) || Number(demon.maxHp) || Number(demon.hp) || 1);
  const baseHp = Math.max(0, Number(demon.hp) || baseMaxHp);
  const hpRatio = baseMaxHp > 0 ? Math.max(0, Math.min(1, baseHp / baseMaxHp)) : 1;
  const nextMaxHp = Math.max(1, Math.round(baseMaxHp * maxHpMult));
  const baseSpeed = Math.max(1, Number(demon.runBaseSpeed) || Number(demon.speed) || 1);
  const baseAtk = Math.max(0, Number(demon.runBaseAtk) || Number(demon.atk) || 0);
  const next = {
    ...demon,
    effectiveAtk: baseAtk,
    maxHp: nextMaxHp,
    hp: Math.max(baseHp > 0 ? 1 : 0, Math.min(nextMaxHp, Math.round(nextMaxHp * hpRatio))),
    speed: Math.max(1, Math.round(baseSpeed * speedMult)),
    runBuffStatsPreviewed: true
  };

  applyDamageOutputStatPreview(next, {
    directDamageMult: getRunBuffEffectMultiplier('direct_damage_mult', next),
    aoeDamageMult: getRunBuffEffectMultiplier('aoe_damage_mult', next),
    aoeDamageFlat: getRunBuffEffectSum('aoe_damage_flat', next),
    healingMult: getRunBuffEffectMultiplier('healing_mult', next),
    healingFlat: getRunBuffEffectSum('healing_flat', next),
    poisonDamageMult: getRunBuffEffectMultiplier('poison_tick_damage_mult', next),
    poisonDamageFlat: getRunBuffEffectSum('poison_damage_flat', next),
    retaliationDamageMult: getRunBuffEffectMultiplier('retaliation_damage_mult', next)
  });

  return next;
}

function applyAccountStatBonusPreviewToDemon(demon = {}) {
  const bonuses = state.statPoints?.bonuses || {};
  // Battle replay snapshots already have player combat buffs baked in server-side; never double-apply.
  if (!demon || demon.accountStatsApplied || demon.accountStatsPreviewed) return { ...demon };

  const maxHpFlat = Math.max(0, Number(bonuses.maxHpFlat) || 0) +
    getRunBuffEffectSum('max_hp_flat', demon) +
    getPlayerWorldBuffEffectSum('max_hp_flat', demon);
  const maxHpMult = (1 + getAccountBonusFraction(bonuses.maxHpPercent)) *
    getPlayerWorldBuffEffectMultiplier('max_hp_mult', demon);
  const receivesSkillTreeAttack = isSingleTargetAttackDemon(demon);
  const attackFlat = (receivesSkillTreeAttack ? Math.max(0, Number(bonuses.attackFlat) || 0) : 0) +
    getRunBuffEffectSum('attack_flat', demon) +
    getPlayerWorldBuffEffectSum('attack_flat', demon);
  const attackMult = (receivesSkillTreeAttack ? 1 + getAccountBonusFraction(bonuses.attackPercent) : 1) *
    getRunBuffEffectMultiplier('attack_mult', demon) *
    getPlayerWorldBuffEffectMultiplier('attack_mult', demon);
  const speedFlat = Math.max(0, Number(bonuses.speedFlat) || 0) +
    getRunBuffEffectSum('speed_flat', demon) +
    getPlayerWorldBuffEffectSum('speed_flat', demon);
  const speedMult = (1 + getAccountBonusFraction(bonuses.speedPercent)) *
    getPlayerWorldBuffEffectMultiplier('speed_mult', demon);
  const directDamageMult = getPlayerWorldBuffEffectMultiplier('direct_damage_mult', demon);
  const aoeDamageFlat = Math.max(0, Number(bonuses.aoeDamageFlat) || 0) +
    getRunBuffEffectSum('aoe_damage_flat', demon) +
    getPlayerWorldBuffEffectSum('aoe_damage_flat', demon);
  const aoeDamageMult = (1 + getAccountBonusFraction(bonuses.aoeDamagePercent)) *
    getPlayerWorldBuffEffectMultiplier('aoe_damage_mult', demon);
  const healingFlat = Math.max(0, Number(bonuses.healingFlat) || 0) +
    getRunBuffEffectSum('healing_flat', demon) +
    getPlayerWorldBuffEffectSum('healing_flat', demon);
  const healingMult = (1 + getAccountBonusFraction(bonuses.healingPercent)) *
    getPlayerWorldBuffEffectMultiplier('healing_mult', demon);
  const poisonDamageFlat = Math.max(0, Number(bonuses.poisonDamageFlat) || 0) +
    getRunBuffEffectSum('poison_damage_flat', demon) +
    getPlayerWorldBuffEffectSum('poison_damage_flat', demon);
  const poisonDamageMult = (1 + getAccountBonusFraction(bonuses.poisonDamagePercent)) *
    getPlayerWorldBuffEffectMultiplier('poison_tick_damage_mult', demon);
  const retaliationDamageMult = getRunBuffEffectMultiplier('retaliation_damage_mult', demon) *
    getPlayerWorldBuffEffectMultiplier('retaliation_damage_mult', demon);

  const hasHpBonus = maxHpFlat > 0 || maxHpMult !== 1;
  const hasAttackBonus = attackFlat > 0 || attackMult !== 1;
  const hasSpeedBonus = speedFlat > 0 || speedMult !== 1;
  const hasDamagePreviewBonus = directDamageMult !== 1 ||
    aoeDamageFlat > 0 ||
    aoeDamageMult !== 1 ||
    healingFlat > 0 ||
    healingMult !== 1 ||
    poisonDamageFlat > 0 ||
    poisonDamageMult !== 1 ||
    retaliationDamageMult !== 1;
  if (!hasHpBonus && !hasAttackBonus && !hasSpeedBonus && !hasDamagePreviewBonus) return { ...demon };

  const next = {
    ...demon,
    accountStatsPreviewed: true
  };

  // Skill-tree and world boss reward buffs are sent to combat as playerBuffs, so mirror
  // applyPreBattleBuffs: flat bonuses first, then percentage multipliers.
  if (hasHpBonus) {
    if (maxHpFlat > 0) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = Math.max(0, Math.min(1, (Number(next.hp) || baseMaxHp) / baseMaxHp));
      next.maxHp = Math.max(1, Math.round(baseMaxHp + maxHpFlat));
      next.hp = Math.max((Number(next.hp) || 0) > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }

    if (maxHpMult !== 1) {
      const baseMaxHp = Math.max(1, Number(next.maxHp) || Number(next.hp) || 1);
      const hpRatio = Math.max(0, Math.min(1, (Number(next.hp) || baseMaxHp) / baseMaxHp));
      next.maxHp = Math.max(1, Math.round(baseMaxHp * maxHpMult));
      next.hp = Math.max((Number(next.hp) || 0) > 0 ? 1 : 0, Math.min(next.maxHp, Math.round(next.maxHp * hpRatio)));
    }
  }

  if (hasAttackBonus) {
    if (attackFlat > 0) {
      applyAttackStatPreviewChange(next, (atk) => Math.max(1, Math.round(atk + attackFlat)));
    }

    if (attackMult !== 1) {
      applyAttackStatPreviewChange(next, (atk) => Math.max(1, Math.round(atk * attackMult)));
    }
  }

  if (hasSpeedBonus) {
    if (speedFlat > 0) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) + speedFlat));
    }

    if (speedMult !== 1) {
      next.speed = Math.max(1, Math.round((Number(next.speed) || 1) * speedMult));
    }
  }

  if (hasAttackBonus || hasDamagePreviewBonus) {
    applyDamageOutputStatPreview(next, {
      directDamageMult: getRunBuffEffectMultiplier('direct_damage_mult', next) * directDamageMult,
      aoeDamageMult: getRunBuffEffectMultiplier('aoe_damage_mult', next) * aoeDamageMult,
      aoeDamageFlat,
      healingMult: getRunBuffEffectMultiplier('healing_mult', next) * healingMult,
      healingFlat,
      poisonDamageMult: getRunBuffEffectMultiplier('poison_tick_damage_mult', next) * poisonDamageMult,
      poisonDamageFlat,
      retaliationDamageMult
    });
  }

  return next;
}

function applyDungeonCombatStatPreviewToDemon(demon = {}) {
  return applyAccountStatBonusPreviewToDemon(applyRunBuffStatPreviewToDemon(demon));
}

function applyAttackStatPreviewChange(demon, updateAtk) {
  const previousAtk = Math.max(1, Number(demon.atk) || 1);
  const previousEffectiveAtk = Number(demon.effectiveAtk);
  const nextAtk = Math.max(1, Math.round(Number(updateAtk(previousAtk)) || previousAtk));
  demon.atk = nextAtk;

  if (Number.isFinite(previousEffectiveAtk) && previousEffectiveAtk > 0) {
    demon.effectiveAtk = Math.max(1, Math.round(previousEffectiveAtk * (nextAtk / previousAtk)));
  }
}

function applyDamageOutputStatPreview(demon, options = {}) {
  const directDamageMult = Math.max(0, Number(options.directDamageMult) || 1);
  const aoeDamageMult = Math.max(0, Number(options.aoeDamageMult) || 1);
  const aoeDamageFlat = Math.max(0, Number(options.aoeDamageFlat) || 0);
  const healingMult = Math.max(0, Number(options.healingMult) || 1);
  const healingFlat = Math.max(0, Number(options.healingFlat) || 0);
  const poisonDamageMult = Math.max(0, Number(options.poisonDamageMult) || 1);
  const poisonDamageFlat = Math.max(0, Number(options.poisonDamageFlat) || 0);
  const retaliationDamageMult = Math.max(0, Number(options.retaliationDamageMult) || 1);
  const isAoe = isAoeDemon(demon);
  const isSingleTarget = isSingleTargetAttackDemon(demon);
  const isRetaliation = isRetaliateDemon(demon);
  const isHealing = isHealingDemon(demon);
  const isPoison = isPoisonDemon(demon);
  const damageMult = (isSingleTarget ? directDamageMult : 1) * (isAoe ? aoeDamageMult : 1);
  const damageFlat = isAoe ? aoeDamageFlat : 0;
  const hasDamageModifier = damageMult !== 1 || damageFlat > 0;
  const hasHealingModifier = isHealing && (healingMult !== 1 || healingFlat > 0);
  const hasPoisonModifier = isPoison && (poisonDamageMult !== 1 || poisonDamageFlat > 0);
  if (!isRetaliation && !hasDamageModifier && !hasHealingModifier && !hasPoisonModifier) return;

  const baseAtk = Math.max(1, Number(demon.atk) || 1);
  if (hasPoisonModifier) {
    const basePoisonDamage = Math.max(1, Math.round(baseAtk * getPoisonDamageScale(demon)));
    demon.effectiveAtk = Math.max(1, Math.round((basePoisonDamage + poisonDamageFlat) * poisonDamageMult));
    return;
  }

  if (hasHealingModifier) {
    demon.effectiveAtk = Math.max(1, Math.round((baseAtk + healingFlat) * healingMult));
    return;
  }

  if (isRetaliation) {
    demon.effectiveAtk = Math.max(1, Math.round(baseAtk * retaliationDamageMult));
    return;
  }

  demon.effectiveAtk = Math.max(1, Math.round((baseAtk + damageFlat) * damageMult));
}

function getAccountBonusFraction(value) {
  const percent = Number(value);
  return Number.isFinite(percent) && percent > 0 ? percent / 100 : 0;
}

function getCollectionStatPreviewDemon(demon = {}) {
  const maxHp = Number(demon.runBaseMaxHp);
  const atk = Number(demon.runBaseAtk);
  const speed = Number(demon.runBaseSpeed);
  const next = { ...demon };

  if (Number.isFinite(maxHp) && maxHp > 0) {
    next.maxHp = Math.max(1, Math.round(maxHp));
    next.hp = next.maxHp;
  }

  if (Number.isFinite(atk) && atk > 0) {
    next.atk = Math.max(1, Math.round(atk));
  }

  if (Number.isFinite(speed) && speed > 0) {
    next.speed = Math.max(1, Math.round(speed));
  }

  delete next.effectiveAtk;
  delete next.runBaseAtk;
  delete next.runBaseMaxHp;
  delete next.runBaseSpeed;
  delete next.runBuffStatsApplied;
  delete next.runBuffStatsPreviewed;
  delete next.accountStatsApplied;
  delete next.accountStatsPreviewed;
  delete next.battleBuffs;
  delete next.deathBuffsHandled;
  delete next.shield;
  return next;
}

function getRunBuffEffectMultiplier(type, demon = null) {
  return getBuffEffectMultiplier(state.run?.buffs?.activeBuffs || [], type, demon);
}

function getRunBuffEffectSum(type, demon = null) {
  return getBuffEffectSum(state.run?.buffs?.activeBuffs || [], type, demon);
}

function getPlayerWorldBuffEffectMultiplier(type, demon = null) {
  return getBuffEffectMultiplier(getPlayerWorldBuffs(), type, demon);
}

function getPlayerWorldBuffEffectSum(type, demon = null) {
  return getBuffEffectSum(getPlayerWorldBuffs(), type, demon);
}

function getPlayerWorldBuffs() {
  return Array.isArray(state.run?.worldBuffs) ? state.run.worldBuffs : [];
}

function getBuffEffectMultiplier(buffs = [], type, demon = null) {
  return (Array.isArray(buffs) ? buffs : []).reduce((multiplier, buff) => {
    const effects = Array.isArray(buff?.effects) ? buff.effects : [];
    return effects.reduce((nextMultiplier, effect) => {
      if (effect?.type !== type || !buffEffectAppliesToDemon(effect, demon)) return nextMultiplier;
      const value = Number(effect.value);
      return Number.isFinite(value) && value > 0 ? nextMultiplier * value : nextMultiplier;
    }, multiplier);
  }, 1);
}

function buffEffectAppliesToDemon(effect, demon = null) {
  const targetRarities = Array.isArray(effect?.targetRarities) ? effect.targetRarities : [];
  if (targetRarities.length && (!demon || !targetRarities.includes(String(demon.rarity || '').toLowerCase()))) {
    return false;
  }
  if (effect?.singleTargetOnly && !isSingleTargetAttackDemon(demon)) {
    return false;
  }
  return true;
}

function getBuffEffectSum(buffs = [], type, demon = null) {
  return (Array.isArray(buffs) ? buffs : []).reduce((sum, buff) => {
    const effects = Array.isArray(buff?.effects) ? buff.effects : [];
    return effects.reduce((nextSum, effect) => {
      if (effect?.type !== type || !buffEffectAppliesToDemon(effect, demon)) return nextSum;
      const value = Number(effect.value);
      return Number.isFinite(value) ? nextSum + value : nextSum;
    }, sum);
  }, 0);
}

function isAoeDemon(demon) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  const role = String(demon?.role || '').toLowerCase();
  const targeting = String(demon?.targeting || '').toLowerCase();
  const abilityKind = String(demon?.abilityKind || demon?.ability?.kind || '').toLowerCase();
  return typeId === 4 ||
    typeId === 7 ||
    role === 'aoe' ||
    targeting === 'all' ||
    targeting === 'cleave' ||
    abilityKind === 'aoe_attack' ||
    abilityKind === 'cleave_attack';
}

function isSingleTargetAttackDemon(demon) {
  if (!demon || isAoeDemon(demon)) return false;

  const typeId = Number(demon.typeId || demon.type_id || demon.type);
  const abilityKind = String(demon.abilityKind || demon.ability?.kind || '').toLowerCase();
  return ![3, 8, 10].includes(typeId) && !['heal', 'poison', 'retaliate'].includes(abilityKind);
}

function isRetaliateDemon(demon) {
  if (!demon) return false;

  const typeId = Number(demon.typeId || demon.type_id || demon.type);
  const role = String(demon.role || '').toLowerCase();
  const targeting = String(demon.targeting || '').toLowerCase();
  const abilityKind = String(demon.abilityKind || demon.ability?.kind || '').toLowerCase();
  return typeId === 8 ||
    role === 'counter_tank' ||
    targeting === 'none' ||
    abilityKind === 'retaliate';
}

function isHealingDemon(demon) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  const role = String(demon?.role || '').toLowerCase();
  const abilityKind = String(demon?.abilityKind || demon?.ability?.kind || '').toLowerCase();
  return typeId === 10 || role === 'healer' || abilityKind === 'heal';
}

function isPoisonDemon(demon) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  const role = String(demon?.role || '').toLowerCase();
  const abilityKind = String(demon?.abilityKind || demon?.ability?.kind || '').toLowerCase();
  return typeId === 3 || role === 'poisoner' || abilityKind === 'poison';
}

function getPoisonDamageScale(demon) {
  const explicitScale = Number(demon?.ability?.damagePerTickScale || demon?.ability?.damagePerTurnScale);
  if (Number.isFinite(explicitScale) && explicitScale > 0) return explicitScale;
  return Number(demon?.typeId || demon?.type_id || demon?.type) === 3 ? 1.15 : 1;
}

function getRecruitTeamLimit() {
  if (!state.run) return MAX_DUNGEON_TEAM_SIZE;
  const serializedLimit = Number(state.run.teamLimit);
  if (state.run.awaitingRecruit && Number.isFinite(serializedLimit) && serializedLimit > 0) {
    return serializedLimit;
  }
  return Math.min(MAX_DUNGEON_TEAM_SIZE, Math.max(2, Number(state.run.currentFloor) + 2));
}

function getDraftRecruitPayload() {
  ensureRecruitDraft();
  const draftTeam = state.recruitDraftTeam || [];
  return {
    team: draftTeam.map((demon, index) => ({
      source: getDraftPayloadSource(demon),
      instanceId: demon.originalInstanceId || demon.instanceId,
      rewardId: demon.rewardId || undefined,
      demonId: demon.collectionDemonId || undefined,
      position: getDemonPosition(demon, index),
      formationSlot: getDemonFormationRow(demon, draftTeam, index)
    }))
  };
}

function getRewardExtractionChoicePayload() {
  const candidate = getSelectedRewardCandidate();
  if (!candidate) return null;

  return {
    source: candidate.origin === 'reserved' ? 'reserved' : candidate.source,
    instanceId: candidate.instanceId || null,
    rewardId: candidate.rewardId || null,
    key: candidate.key
  };
}

function getDraftPayloadSource(demon) {
  if (demon.recruitSource === 'reward') return 'reward';
  if (demon.recruitSource === 'collection') return 'collection';
  if (demon.recruitSource === 'reserved') return 'reserved';
  return 'team';
}

function getSelectedCollectionReinforcement() {
  return getSelectedCollectionReinforcements()[0] || null;
}

function getSelectedCollectionReinforcements() {
  return [
    ...(state.recruitDraftTeam || []),
    ...(state.recruitDraftPool || [])
  ].filter((demon) => demon.recruitSource === 'collection');
}

function addCollectionReinforcementToPool(demonId) {
  ensureRecruitDraft();
  if (getSelectedCollectionReinforcements().length >= getCollectionReinforcementLimit()) return;

  const demon = (state.collectionDemons || []).find((item) => Number(item.id) === Number(demonId));
  if (!demon) return;

  const stagedDemon = {
    ...getFullHpDemon(demon),
    instanceId: `collection-${demon.id}`,
    collectionDemonId: demon.id,
    recruitSource: 'collection',
    position: getPreferredDemonPosition(demon)
  };

  if (isStartingTeamSelection()) {
    addCollectionReinforcementToStartingTeam(stagedDemon);
  } else {
    state.recruitDraftPool.splice(getCollectionHandInsertIndex(), 0, stagedDemon);
    refreshRecruitDraftPoolOrder();
  }

  state.collectionReinforcementStagedInteracted = false;
  syncRecruitDraftSelection();
}

function isStartingTeamSelection() {
  return Number(state.run?.currentFloor) === 0;
}

function addCollectionReinforcementToStartingTeam(stagedDemon) {
  const team = state.recruitDraftTeam || [];
  const teamLimit = getRecruitTeamLimit();
  let formationSlot = getNextOpenFormationCell(
    getFormationGridAssignments(team, 'player'),
    'player',
    stagedDemon.position
  );

  if (team.length >= teamLimit) {
    const replacement = [...team].reverse().find((demon) => demon.recruitSource !== 'collection');
    if (!replacement) return;

    const replacementIndex = team.findIndex((demon) => demon.instanceId === replacement.instanceId);
    stagedDemon.position = getDemonPosition(replacement, replacementIndex);
    formationSlot = getDemonFormationRow(replacement, team, replacementIndex);
    returnTeamDemonToPool(replacement.instanceId, 'hand');
  }

  if (formationSlot >= 0) {
    stagedDemon.formationRow = formationSlot;
    stagedDemon.formationSlot = formationSlot;
  }
  state.recruitDraftTeam.push(stagedDemon);
  refreshRecruitDraftOrder();
}

function getCollectionHandInsertIndex() {
  const firstNonCollectionIndex = (state.recruitDraftPool || []).findIndex((demon) => demon.recruitSource !== 'collection');
  return firstNonCollectionIndex >= 0 ? firstNonCollectionIndex : (state.recruitDraftPool || []).length;
}

function removeCollectionReinforcement(instanceId = null) {
  const shouldRemove = (demon) => (
    demon.recruitSource === 'collection' &&
    (!instanceId || demon.instanceId === instanceId)
  );
  state.recruitDraftTeam = (state.recruitDraftTeam || []).filter((demon) => !shouldRemove(demon));
  state.recruitDraftPool = (state.recruitDraftPool || []).filter((demon) => !shouldRemove(demon));
  state.collectionReinforcementStagedInteracted = true;
  refreshRecruitDraftOrder();
  refreshRecruitDraftPoolOrder();
  syncRecruitDraftSelection();
}

function markCollectionReinforcementPlaceholderInteracted() {
  state.collectionReinforcementPlaceholderInteracted = true;
  document.querySelectorAll('.collection-reinforcement-placeholder').forEach((card) => {
    card.classList.remove('is-collection-reinforcement-attention');
  });
}

function markCollectionReinforcementStagedInteracted(instanceId = null) {
  const staged = instanceId
    ? getSelectedCollectionReinforcements().find((demon) => demon.instanceId === instanceId)
    : getSelectedCollectionReinforcement();
  if (!staged || (instanceId && staged.instanceId !== instanceId)) return;

  state.collectionReinforcementStagedInteracted = true;
  document.querySelectorAll(`.dungeon-demon-card[data-instance-id="${cssEscape(staged.instanceId)}"]`).forEach((card) => {
    card.classList.remove('is-collection-reinforcement-attention');
  });
}

function findCollectionReplacement(demon) {
  const key = getCollectionSlotKey(demon);
  if (!key) return null;
  return (state.collectionDemons || []).find((collectionDemon) => getCollectionSlotKey(collectionDemon) === key) || null;
}

export {
  prepareRecruitStrategyState,
  getCurrentRecruitRewards,
  getRecruitPreviewTeam,
  getRecruitPreviewHand,
  getRecruitPreviewEnemyTeam,
  ensureRecruitDraft,
  ensureCollectionLoaded,
  getAvailableCollectionReinforcements,
  getCollectionReinforcementLimit,
  getCollectionSlotKey,
  isDemonInCollection,
  shouldShowCollectionMissingTag,
  getFullHpDemon,
  getRecruitTeamLimit,
  getDraftRecruitPayload,
  getRewardExtractionChoicePayload,
  applyRunBuffStatPreviewToDemon,
  applyAccountStatBonusPreviewToDemon,
  applyDungeonCombatStatPreviewToDemon,
  getCollectionStatPreviewDemon,
  getDraftPayloadSource,
  getSelectedCollectionReinforcement,
  getSelectedCollectionReinforcements,
  addCollectionReinforcementToPool,
  isStartingTeamSelection,
  addCollectionReinforcementToStartingTeam,
  getCollectionHandInsertIndex,
  removeCollectionReinforcement,
  markCollectionReinforcementPlaceholderInteracted,
  markCollectionReinforcementStagedInteracted,
  findCollectionReplacement
};
