import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, BATTLE_SCREEN_SHAKE_KEY, BATTLE_CARD_SHAKE_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const battle = (...args) => dungeonActions.battle(...args);
const getDemonPosition = (...args) => dungeonActions.getDemonPosition(...args);
const renderDemonStatus = (...args) => dungeonActions.renderDemonStatus(...args);
const renderFightLog = (...args) => dungeonActions.renderFightLog(...args);
const renderFightLogActions = (...args) => dungeonActions.renderFightLogActions(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);

async function playCombatLog() {
  if (!state.run) return;

  const steps = groupCombatLog(state.combatLog);
  state.combatPlayback = {
    currentIndex: 0,
    isPaused: false,
    stepDirection: 0,
    steps,
    totalSteps: steps.length,
    waitResolve: null
  };
  state.isBattleAnimating = true;
  renderRun();
  renderFightLog();

  try {
    while (state.combatPlayback && state.combatPlayback.currentIndex < steps.length) {
      const playbackCommand = await waitForCombatPlaybackReady();
      if (!playbackCommand || !state.combatPlayback) break;

      if (playbackCommand === 'previous') {
        await replayPreviousCombatPlaybackStep();
        continue;
      }

      const index = state.combatPlayback.currentIndex;
      const step = steps[index];
      setCombatPlaybackPausedClass(false);
      applyCombatStep(step, index, { animate: true });
      state.combatPlayback.currentIndex = index + 1;
      renderFightLogActions();
      await waitForCombatPlaybackDelay(scaleCombatDuration(getCombatStepDelay(step)));
      setCombatPlaybackPausedClass(Boolean(state.combatPlayback?.isPaused));
    }
  } finally {
    state.isBattleAnimating = false;
    state.combatPlayback = null;
    setCombatPlaybackPausedClass(false);
    renderRun();
  }

  setActiveLogRow(-1);
}

function applyCombatStep(step, index = -1, options = {}) {
  const allDemonsById = getCurrentBattleDemonMap();
  const animate = options.animate !== false;

  step.entries.forEach((entry) => {
    const target = allDemonsById.get(entry.target);
    if (target) {
      target.hp = entry.targetHp;
      if (entry.effect === 'poison_apply') {
        target.statusEffects = target.statusEffects || {};
        target.statusEffects.poison = Array.from({ length: Math.max(1, Number(entry.poisonStacks) || 1) }, () => ({}));
      }
      if (entry.effect === 'poison' && Object.prototype.hasOwnProperty.call(entry, 'poisonStacks')) {
        target.statusEffects = target.statusEffects || {};
        target.statusEffects.poison = Array.from({ length: Math.max(0, Number(entry.poisonStacks) || 0) }, () => ({}));
      }
    }
  });

  updateTeamHp();
  if (!animate) {
    syncCombatHpCards();
    return;
  }

  // Animate path: HP/number/impact reactions are deferred to "impact time" so the
  // card update feels synced to the projectile landing rather than the step start.
  setActiveLogRow(index);
  const attackerSide = getDemonSide(step.attacker);
  const isAoe = Boolean(step.isAoe) || (step.entries || []).length > 1;
  if (step.primaryEffect !== 'poison') {
    animateAttackerCard(step.attacker, step.primaryEffect, step.entries[0]?.target);
  }

  // Fire (type 4): instead of one fireball per target, lob a single fireball at the centre
  // of the whole target group; it detonates in a red nova on arrival. Per-entry impact
  // reactions (HP/floating numbers/burst) still run, lined up just after the detonation.
  const fireGroup = getFireGroupPlan(step);
  if (fireGroup) drawGroupFireball(step.attacker, fireGroup.targetIds, { effect: step.primaryEffect, travel: fireGroup.travel });

  step.entries.forEach((entry, entryIndex) => {
    animateCombatEntry(entry, step, attackerSide, entryIndex, isAoe, fireGroup);
  });
}

// Damage effects that route through the standard projectile branch (everything that isn't a
// status/heal special-case). Used to decide which entries the grouped fire shot covers.
const NON_DAMAGE_EFFECTS = new Set(['poison', 'heal', 'last_breath', 'shared_pain', 'poison_apply']);

function isGroupedFireEntry(entry) {
  return !NON_DAMAGE_EFFECTS.has(entry.effect);
}

// Returns the grouped-fire plan for a step, or null when the step shouldn't use it
// (reduced motion, chaotic targeting, non-fire attacker, or no damage entries).
function getFireGroupPlan(step) {
  if (prefersReducedMotion()) return null;
  if (step.targeting === 'chaotic') return null;
  if (Number(getCombatDemon(step.attacker)?.typeId) !== 4) return null;
  const damageEntries = (step.entries || []).filter(isGroupedFireEntry);
  if (!damageEntries.length) return null;
  return {
    targetIds: damageEntries.map((entry) => entry.target),
    travel: getAttackProfile(damageEntries[0]).travel,
    lead: 90
  };
}

// Routes a single combat-log entry to the right visual treatment. Damage/heal/poison
// reactions (HP bar, floating number, impact burst, card shake) are scheduled at the
// attack's impact moment via scheduleImpact so they line up with the travelling effect.
function animateCombatEntry(entry, step, attackerSide, entryIndex, isAoe, fireGroup = null) {
  const reduced = prefersReducedMotion();

  if (entry.effect === 'poison') {
    scheduleImpact(160, () => {
      if (entryIndex === 0) {
        showFloatingDamage(entry.target, getPoisonBurstDamage(step), 'poison', entry.attacker, entry.effect, {
          burstCount: step.entries.length
        });
      }
      updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false });
      syncPoisonStatus(entry.target, entry.poisonStacks);
      poisonTickCard(entry.target);
    });
    return;
  }

  if (entry.effect === 'heal') {
    if (!reduced) drawHealEffect(entry.attacker, entry.target);
    scheduleImpact(200, () => {
      updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false, healing: entry.healing });
      showFloatingDamage(entry.target, entry.healing, 'heal', entry.attacker, entry.effect);
      healTargetCard(entry.target);
    });
    return;
  }

  if (entry.effect === 'last_breath') {
    scheduleImpact(160, () => {
      updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false });
      showFloatingDamage(entry.target, 1, 'heal', entry.attacker, entry.effect);
      healTargetCard(entry.target);
    });
    return;
  }

  if (entry.effect === 'shared_pain') {
    updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false });
    return;
  }

  if (entry.effect === 'poison_apply') {
    if (!reduced) drawAttackZap(step.attacker, entry.target, { effect: entry.effect, poison: true, bubbles: 15, variant: 'poison-flame' });
    scheduleImpact(220, () => {
      syncPoisonStatus(entry.target, entry.poisonStacks || 1);
      updateTargetCard(entry.target, entry.targetHp, attackerSide);
      spawnImpactBurst(entry.target, { attackerId: entry.attacker, effect: entry.effect, variant: 'poison' });
      poisonTickCard(entry.target);
    });
    return;
  }

  const profile = getAttackProfile(entry);
  // Grouped fire draws one shared fireball in applyCombatStep, so skip the per-entry
  // projectile and hold the impact reactions until just after the nova detonates.
  const grouped = fireGroup && isGroupedFireEntry(entry);
  if (!reduced && !grouped) profile.draw();
  const impactDelay = grouped
    ? fireGroup.travel + fireGroup.lead + entryIndex * 50
    : profile.travel + (isAoe ? entryIndex * 70 : 0);
  scheduleImpact(impactDelay, () => {
    updateTargetCard(entry.target, entry.targetHp, attackerSide);
    if (Number(entry.dmg) > 0) {
      showFloatingDamage(entry.target, entry.dmg, isTypeTwoAttack(entry.attacker) ? 'dark' : 'damage', entry.attacker, entry.effect);
    }
    spawnImpactBurst(entry.target, {
      attackerId: entry.attacker,
      effect: entry.effect,
      heavy: profile.heavy,
      variant: profile.key,
      aoe: isAoe
    });
    hitTargetCard(entry.target, profile.heavy);
    if (profile.screenShake) triggerScreenShake();
    maybePlayDeath(entry.target, entry.targetHp);
  });
}

async function waitForCombatPlaybackReady() {
  while (state.combatPlayback?.isPaused) {
    setCombatPlaybackPausedClass(true);
    const direction = Number(state.combatPlayback.stepDirection) || 0;
    state.combatPlayback.stepDirection = 0;

    if (direction < 0) {
      return 'previous';
    }

    if (direction > 0) {
      return state.combatPlayback.currentIndex < state.combatPlayback.totalSteps ? 'next' : null;
    }

    await waitForCombatPlaybackSignal();
  }

  setCombatPlaybackPausedClass(false);
  return state.combatPlayback ? 'play' : null;
}

function waitForCombatPlaybackDelay(duration) {
  const playback = state.combatPlayback;
  if (!playback) return Promise.resolve();

  return new Promise((resolve) => {
    const timer = window.setTimeout(finish, Math.max(0, Number(duration) || 0));

    function finish() {
      window.clearTimeout(timer);
      if (playback.waitResolve === finish) playback.waitResolve = null;
      resolve();
    }

    playback.waitResolve = finish;
  });
}

function waitForCombatPlaybackSignal() {
  const playback = state.combatPlayback;
  if (!playback) return Promise.resolve();

  return new Promise((resolve) => {
    playback.waitResolve = () => {
      playback.waitResolve = null;
      resolve();
    };
  });
}

function pauseCombatPlayback() {
  if (!state.combatPlayback || !state.isBattleAnimating) return;
  state.combatPlayback.isPaused = true;
  setCombatPlaybackPausedClass(true);
  resolveCombatPlaybackWait();
  renderFightLogActions();
}

function resumeCombatPlayback() {
  if (!state.combatPlayback || !state.isBattleAnimating) return;
  state.combatPlayback.isPaused = false;
  state.combatPlayback.stepDirection = 0;
  setCombatPlaybackPausedClass(false);
  resolveCombatPlaybackWait();
  renderFightLogActions();
}

function stepCombatPlayback(direction) {
  if (!state.combatPlayback || !state.isBattleAnimating) return;
  state.combatPlayback.isPaused = true;
  state.combatPlayback.stepDirection = Number(direction) < 0 ? -1 : 1;
  setCombatPlaybackPausedClass(true);
  resolveCombatPlaybackWait();
  renderFightLogActions();
}

function resolveCombatPlaybackWait() {
  const resolve = state.combatPlayback?.waitResolve;
  if (resolve) resolve();
}

function renderCombatPlaybackFrame(stepCount) {
  if (!state.run || !state.combatPlayback) return;
  clearCombatTransientElements();
  resetCombatTeamsToBattleStart();
  const steps = state.combatPlayback.steps || [];
  const nextIndex = clamp(Math.floor(Number(stepCount) || 0), 0, steps.length);

  for (let index = 0; index < nextIndex; index += 1) {
    applyCombatStep(steps[index], index, { animate: false });
  }

  state.combatPlayback.currentIndex = nextIndex;
  renderRun();
  setActiveLogRow(nextIndex > 0 ? nextIndex - 1 : -1);
}

async function replayPreviousCombatPlaybackStep() {
  const playback = state.combatPlayback;
  if (!state.run || !playback || playback.currentIndex <= 0) return;

  const steps = playback.steps || [];
  const targetIndex = clamp(playback.currentIndex - 2, 0, steps.length - 1);
  const step = steps[targetIndex];
  if (!step) return;

  renderCombatPlaybackFrame(targetIndex);
  setCombatPlaybackPausedClass(false);
  applyCombatStep(step, targetIndex, { animate: true });
  playback.currentIndex = targetIndex + 1;
  renderFightLogActions();
  await waitForCombatPlaybackDelay(scaleCombatDuration(getCombatStepDelay(step)));

  if (state.combatPlayback) {
    state.combatPlayback.isPaused = true;
    setCombatPlaybackPausedClass(true);
    renderFightLogActions();
  }
}

function resetCombatTeamsToBattleStart() {
  const lastBattle = state.run?.lastBattle || {};
  state.run.team = cloneDemons(lastBattle.playerTeamBefore || state.run.team || []);
  state.run.enemies = cloneDemons(lastBattle.enemyTeamBefore || state.run.enemies || []);
  state.combatDemons = createCombatDemonMap();
}

function getCurrentBattleDemonMap() {
  return new Map([...(state.run?.team || []), ...(state.run?.enemies || [])].map((demon) => [demon.instanceId, demon]));
}

function clearCombatTransientElements() {
  cancelPendingImpacts();
  document.querySelectorAll([
    '.attack-zap',
    '.chaos-lightning',
    '.combat-impact-burst',
    '.dark-spike',
    '.fireball-shot',
    '.fire-nova',
    '.floating-combat-number',
    '.heal-effect',
    '.sword-swing',
    '.thorn-burst'
  ].join(',')).forEach((element) => element.remove());
  document.querySelector('.dungeon-arena')?.classList.remove('is-combat-screenshake');
}

function setCombatPlaybackPausedClass(isPaused) {
  const paused = Boolean(isPaused);
  document.documentElement.classList.toggle('is-combat-paused', paused);
  // Keep deferred impacts in lockstep with the visual freeze.
  if (paused) pauseImpactTimers();
  else resumeImpactTimers();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function updateTeamHp() {
  if (!state.run) return;
  state.run.hp = (state.run.team || []).reduce((sum, demon) => sum + Math.max(0, Number(demon.hp) || 0), 0);
}

function syncCombatHpCards() {
  [...(state.run?.team || []), ...(state.run?.enemies || [])].forEach((demon) => {
    updateTargetCard(demon.instanceId, demon.hp);
  });
}

function setActiveLogRow(index) {
  document.querySelectorAll('.fight-log-row').forEach((row) => {
    row.classList.toggle('active', Number(row.dataset.logIndex) === index);
  });
}

function animateAttackerCard(instanceId, effect, targetId) {
  const card = findDemonCard(instanceId);
  if (!card) return;

  applyCombatTheme(card, getCombatTheme(instanceId, effect));
  card.classList.toggle('is-player-attack', getDemonSide(instanceId) === 'player');
  card.classList.toggle('is-enemy-attack', getDemonSide(instanceId) === 'enemy');
  setAttackerLunge(card, targetId);
  playTemporaryCardClass(card, 'is-attacking', 320);
}

// Nudges the attacking card a few pixels toward its target so the swing reads as physical.
// The CSS hop animation consumes --lunge-x / --lunge-y; reduced motion zeroes them out.
function setAttackerLunge(card, targetId) {
  if (prefersReducedMotion() || !targetId) {
    card.style.setProperty('--lunge-x', '0px');
    card.style.setProperty('--lunge-y', '0px');
    return;
  }

  const targetCard = findDemonCard(targetId);
  if (!targetCard) {
    card.style.setProperty('--lunge-x', '0px');
    card.style.setProperty('--lunge-y', '0px');
    return;
  }

  const attackerRect = card.getBoundingClientRect();
  const targetRect = targetCard.getBoundingClientRect();
  const dx = (targetRect.left + targetRect.width / 2) - (attackerRect.left + attackerRect.width / 2);
  const dy = (targetRect.top + targetRect.height / 2) - (attackerRect.top + attackerRect.height / 2);
  const length = Math.hypot(dx, dy) || 1;
  const reach = Math.min(18, length * 0.26);
  card.style.setProperty('--lunge-x', `${(dx / length * reach).toFixed(1)}px`);
  card.style.setProperty('--lunge-y', `${(dy / length * reach).toFixed(1)}px`);
}

// Single source of truth for how each demon archetype attacks: which projectile/effect
// to draw, how long it travels before impact, and whether the hit is "heavy" (bigger burst
// + card shake) or should kick a screen micro-shake. Keeping this in one registry avoids
// the duplicated per-type animation branches the old code had.
function getAttackProfile(entry) {
  const { attacker, target, effect } = entry;

  if (entry.targeting === 'chaotic') {
    return {
      key: 'chaotic',
      travel: 150,
      heavy: true,
      screenShake: false,
      draw: () => drawChaoticLightning(attacker, target)
    };
  }

  const typeId = Number(getCombatDemon(attacker)?.typeId);
  const profiles = {
    2: {
      key: 'dark',
      travel: 200,
      heavy: false,
      draw: () => drawDarkSpike(attacker, target)
    },
    4: {
      key: 'fire',
      travel: 380,
      heavy: true,
      screenShake: false,
      draw: () => drawFireball(attacker, target, { effect })
    },
    5: {
      key: 'sniper',
      travel: 360,
      heavy: true,
      draw: () => drawAttackZap(attacker, target, { effect, variant: 'heavy', duration: 520 })
    },
    6: {
      key: 'assassin',
      travel: 120,
      heavy: false,
      draw: () => drawAttackZap(attacker, target, { effect, variant: 'assassin', duration: 240 })
    },
    7: {
      key: 'melee',
      travel: 170,
      heavy: false,
      draw: () => drawSwordSwing(attacker, target)
    },
    8: {
      key: 'thorn',
      travel: 210,
      heavy: false,
      draw: () => drawThornBurst(attacker, target)
    },
    9: {
      key: 'crushing',
      travel: 620,
      heavy: true,
      screenShake: true,
      draw: () => drawAttackZap(attacker, target, { effect, variant: 'crushing', duration: 960 })
    }
  };

  return profiles[typeId] || {
    key: 'melee',
    travel: 150,
    heavy: false,
    draw: () => drawAttackZap(attacker, target, { effect })
  };
}

// Preserved public helper: draws only the travelling effect for an entry (no impact reactions).
function drawCombatAnimation(entry) {
  getAttackProfile(entry).draw();
}

function prefersReducedMotion() {
  return Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

// Pause-aware, cancelable impact scheduler. Each scheduled impact runs on a setTimeout, but:
//  - it freezes/thaws together with the visual pause (driven by setCombatPlaybackPausedClass),
//    so a paused battle doesn't apply HP while the projectile is frozen mid-flight;
//  - it is cancelled by clearCombatTransientElements() when a playback frame is rebuilt
//    (step-back / scrub), so stale impacts never land after the board is re-derived.
// Reduced motion and zero delays fire synchronously.
const pendingImpacts = new Set();

function combatNow() {
  return window.performance?.now?.() ?? Date.now();
}

function scheduleImpact(baseMs, fn) {
  const delay = scaleCombatDuration(baseMs);
  if (prefersReducedMotion() || delay <= 0) {
    fn();
    return;
  }

  const record = { fn, remaining: delay, startedAt: 0, handle: null };
  record.run = () => {
    record.handle = null;
    pendingImpacts.delete(record);
    record.fn();
  };
  pendingImpacts.add(record);
  if (!isCombatVisuallyPaused()) startImpactTimer(record);
}

function startImpactTimer(record) {
  record.startedAt = combatNow();
  record.handle = window.setTimeout(record.run, record.remaining);
}

function isCombatVisuallyPaused() {
  return document.documentElement.classList.contains('is-combat-paused');
}

function pauseImpactTimers() {
  pendingImpacts.forEach((record) => {
    if (record.handle == null) return;
    window.clearTimeout(record.handle);
    record.handle = null;
    record.remaining = Math.max(0, record.remaining - (combatNow() - record.startedAt));
  });
}

function resumeImpactTimers() {
  pendingImpacts.forEach((record) => {
    if (record.handle == null) startImpactTimer(record);
  });
}

function cancelPendingImpacts() {
  pendingImpacts.forEach((record) => {
    if (record.handle != null) window.clearTimeout(record.handle);
  });
  pendingImpacts.clear();
}

// Small burst of impact particles placed exactly on the target card centre.
function spawnImpactBurst(targetId, options = {}) {
  if (prefersReducedMotion()) return;
  const card = findDemonCard(targetId);
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const burst = createCombatElement([
    'combat-impact-burst',
    options.heavy ? 'is-heavy' : '',
    options.aoe ? 'is-aoe' : '',
    `is-${options.variant || 'melee'}`
  ].filter(Boolean).join(' '), options.attackerId, options.effect);
  burst.style.left = `${(rect.left + rect.width / 2).toFixed(1)}px`;
  burst.style.top = `${(rect.top + rect.height / 2).toFixed(1)}px`;

  const duration = options.heavy ? 520 : 380;
  burst.style.setProperty('--fx-duration', `${scaleCombatDuration(duration)}ms`);
  const count = options.heavy ? 9 : 6;
  const spread = options.heavy ? 26 : 17;
  const particles = Array.from({ length: count }, (_, index) => {
    const angle = (360 / count) * index + (index % 2 ? 14 : -10);
    const distance = spread + (index % 3) * 5;
    return `<span class="combat-impact-particle" style="--p-angle:${angle.toFixed(0)}deg;--p-dist:${distance}px;animation-delay:${scaleCombatDuration(index * 6)}ms"></span>`;
  }).join('');
  burst.innerHTML = `<span class="combat-impact-core"></span>${options.aoe ? '<span class="combat-impact-ring"></span>' : ''}${particles}`;
  appendTemporaryElement(burst, duration);
}

// User preferences (set from /settings). Each stays on unless explicitly disabled.
function isPreferenceEnabled(key) {
  try {
    return localStorage.getItem(key) !== '0';
  } catch (error) {
    return true;
  }
}

function isCardShakeEnabled() {
  return isPreferenceEnabled(BATTLE_CARD_SHAKE_KEY);
}

function isScreenShakeEnabled() {
  return isPreferenceEnabled(BATTLE_SCREEN_SHAKE_KEY);
}

function hitTargetCard(targetId, heavy) {
  if (prefersReducedMotion()) return;
  const card = findDemonCard(targetId);
  if (!card) return;
  // Heavy hits use the positional card shake; when card shake is disabled, fall back to the
  // lighter flinch so the impact still reads without the card rattling.
  const shakeAllowed = isCardShakeEnabled();
  playTemporaryCardClass(card, heavy && shakeAllowed ? 'is-shaking' : 'is-hit', heavy && shakeAllowed ? 360 : 240);
}

function poisonTickCard(targetId) {
  if (prefersReducedMotion()) return;
  const card = findDemonCard(targetId);
  if (!card) return;
  playTemporaryCardClass(card, 'is-poison-tick', 520);
}

function healTargetCard(targetId) {
  if (prefersReducedMotion()) return;
  const card = findDemonCard(targetId);
  if (!card) return;
  playTemporaryCardClass(card, 'is-healed', 520);
}

let lastScreenShakeAt = 0;

// Heavy-hit only: a brief camera shake on the arena. Throttled so a multi-target heavy
// AOE doesn't stack into a violent rattle.
function triggerScreenShake() {
  if (prefersReducedMotion() || !isScreenShakeEnabled()) return;
  const now = (window.performance?.now?.() ?? Date.now());
  if (now - lastScreenShakeAt < 140) return;
  lastScreenShakeAt = now;
  const arena = document.querySelector('.dungeon-arena');
  if (!arena) return;
  playTemporaryCardClass(arena, 'is-combat-screenshake', 360);
}

function maybePlayDeath(targetId, hp) {
  if (Number(hp) > 0 || prefersReducedMotion()) return;
  const card = findDemonCard(targetId);
  if (!card || card.classList.contains('is-dying')) return;
  playTemporaryCardClass(card, 'is-dying', 620);
}

function drawAttackZap(attackerId, targetId, options = {}) {
  const attacker = findDemonCard(attackerId);
  const target = findDemonCard(targetId);
  if (!attacker || !target) return;

  const { attackerRect, startX, startY, endX, endY } = getAttackGeometry(attacker, target);
  const attackerDemon = getCombatDemon(attackerId);
  const isBackLineAttack = attackerDemon && getDemonPosition(attackerDemon) === 'back';
  const startT = isBackLineAttack ? 0.12 : 0.22;
  const endT = isBackLineAttack ? 0.9 : 0.78;
  const x1 = startX + (endX - startX) * startT;
  const y1 = startY + (endY - startY) * startT;
  const x2 = startX + (endX - startX) * endT;
  const y2 = startY + (endY - startY) * endT;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const normalX = -(y2 - y1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const normalY = (x2 - x1) / Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const bend = isBackLineAttack ? 10 : 6;
  const controlX = midX + normalX * bend;
  const controlY = midY + normalY * bend;
  const bubbleCount = Number(options.bubbles) || 0;
  const bubbleHtml = bubbleCount
    ? Array.from({ length: bubbleCount }, (_, index) => {
        const t = 0.08 + (index / Math.max(1, bubbleCount - 1)) * 0.84;
        const x = ((1 - t) * (1 - t) * x1) + (2 * (1 - t) * t * controlX) + (t * t * x2);
        const y = ((1 - t) * (1 - t) * y1) + (2 * (1 - t) * t * controlY) + (t * t * y2);
        const drift = ((index % 2) ? -1 : 1) * (4 + (index % 4));
        const radius = 2.2 + ((index % 4) * 0.8);
        return `<circle class="poison-bubble" cx="${(x + normalX * drift).toFixed(1)}" cy="${(y + normalY * drift).toFixed(1)}" r="${radius.toFixed(1)}" style="animation-delay: ${scaleCombatDuration(index * 18).toFixed(0)}ms" />`;
      }).join('')
    : '';
  const flameCount = Number(options.flames) || 0;
  const flameHtml = flameCount
    ? Array.from({ length: flameCount }, (_, index) => {
        const t = 0.08 + (index / Math.max(1, flameCount - 1)) * 0.84;
        const x = ((1 - t) * (1 - t) * x1) + (2 * (1 - t) * t * controlX) + (t * t * x2);
        const y = ((1 - t) * (1 - t) * y1) + (2 * (1 - t) * t * controlY) + (t * t * y2);
        const drift = ((index % 2) ? -1 : 1) * (5 + (index % 3) * 2);
        const size = 5 + (index % 4);
        const cx = x + normalX * drift;
        const cy = y + normalY * drift;
        return `<path class="fire-spark" d="M ${cx.toFixed(1)} ${(cy - size).toFixed(1)} C ${(cx + size * 0.72).toFixed(1)} ${(cy - size * 0.2).toFixed(1)} ${(cx + size * 0.45).toFixed(1)} ${(cy + size * 0.72).toFixed(1)} ${cx.toFixed(1)} ${(cy + size).toFixed(1)} C ${(cx - size * 0.55).toFixed(1)} ${(cy + size * 0.42).toFixed(1)} ${(cx - size * 0.45).toFixed(1)} ${(cy - size * 0.32).toFixed(1)} ${cx.toFixed(1)} ${(cy - size).toFixed(1)} Z" style="animation-delay: ${scaleCombatDuration(index * 16).toFixed(0)}ms" />`;
      }).join('')
    : '';

  const zap = createCombatElement([
    'attack-zap',
    getDemonSide(attackerId) === 'player' ? 'is-player-attack' : 'is-enemy-attack',
    isBackLineAttack ? 'is-back-attack' : '',
    options.variant ? `is-${options.variant}` : '',
    options.poison ? 'is-poison-apply' : ''
  ].filter(Boolean).join(' '), attackerId, options.effect);
  zap.innerHTML = renderViewportSvg(`
      <path class="attack-zap-trail" d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${controlX.toFixed(1)} ${controlY.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" />
      ${options.variant === 'assassin' ? `<path class="attack-zap-trail attack-zap-trail-secondary" d="M ${(x1 + normalX * 7).toFixed(1)} ${(y1 + normalY * 7).toFixed(1)} Q ${(controlX + normalX * 7).toFixed(1)} ${(controlY + normalY * 7).toFixed(1)} ${(x2 + normalX * 7).toFixed(1)} ${(y2 + normalY * 7).toFixed(1)}" />` : ''}
      ${bubbleHtml}
      ${flameHtml}
      <circle class="attack-zap-impact" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${isBackLineAttack ? 5 : 4}" />
  `);
  appendTemporaryElement(zap, options.duration || 320);
}

function drawFireball(attackerId, targetId, options = {}) {
  const attacker = findDemonCard(attackerId);
  const target = findDemonCard(targetId);
  if (!attacker || !target) return;

  const { attackerRect, targetRect, startX, startY, endX, endY, angle } = getAttackGeometry(attacker, target);
  const attackerDemon = getCombatDemon(attackerId);
  const isBackLineAttack = attackerDemon && getDemonPosition(attackerDemon) === 'back';
  const startOffset = Math.min(attackerRect.width * (isBackLineAttack ? 0.28 : 0.42), 46);
  const endOffset = Math.min(targetRect.width * 0.18, 22);
  const x1 = startX + Math.cos(angle) * startOffset;
  const y1 = startY + Math.sin(angle) * startOffset;
  const x2 = endX - Math.cos(angle) * endOffset;
  const y2 = endY - Math.sin(angle) * endOffset;
  const distance = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const normalX = -(y2 - y1) / distance;
  const normalY = (x2 - x1) / distance;
  const impactRadius = Math.max(12, Math.min(24, targetRect.width * 0.18));
  const emberCount = 8;
  const emberHtml = Array.from({ length: emberCount }, (_, index) => {
    const t = 0.12 + (index / Math.max(1, emberCount - 1)) * 0.72;
    const drift = ((index % 2) ? -1 : 1) * (4 + (index % 3) * 2);
    const x = x1 + (x2 - x1) * t + normalX * drift;
    const y = y1 + (y2 - y1) * t + normalY * drift;
    const radius = 1.8 + (index % 3) * 0.8;
    return `<circle class="fireball-ember" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" style="animation-delay: ${scaleCombatDuration(70 + index * 28).toFixed(0)}ms" />`;
  }).join('');

  const fireball = createCombatElement([
    'fireball-shot',
    getDemonSide(attackerId) === 'player' ? 'is-player-attack' : 'is-enemy-attack',
    isBackLineAttack ? 'is-back-attack' : ''
  ].filter(Boolean).join(' '), attackerId, options.effect);
  fireball.innerHTML = renderViewportSvg(`
      ${emberHtml}
      <g class="fireball-projectile" style="--fireball-start-x: ${x1.toFixed(1)}px; --fireball-start-y: ${y1.toFixed(1)}px; --fireball-end-x: ${x2.toFixed(1)}px; --fireball-end-y: ${y2.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="8.5" />
        <circle class="fireball-hot" cx="3.6" cy="-2.2" r="4.2" />
      </g>
      <circle class="fireball-impact" cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${impactRadius.toFixed(1)}" />
  `);
  appendTemporaryElement(fireball, 620);
}

// Fire (type 4) group attack: a single fireball arcs from the attacker to the centre of the
// whole target group and detonates in a red nova when it lands. The travelling projectile
// reuses the regular fireball visuals (sized up a touch); the nova is scheduled at impact
// time via scheduleImpact so it stays in lockstep with combat pause/scrub.
function drawGroupFireball(attackerId, targetIds, options = {}) {
  const attacker = findDemonCard(attackerId);
  const targetCards = (targetIds || []).map(findDemonCard).filter(Boolean);
  if (prefersReducedMotion() || !attacker || !targetCards.length) return;

  const attackerRect = attacker.getBoundingClientRect();
  const startX = attackerRect.left + attackerRect.width / 2;
  const startY = attackerRect.top + attackerRect.height / 2;

  const centers = targetCards.map((card) => {
    const rect = card.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, half: Math.max(rect.width, rect.height) / 2 };
  });
  const endX = centers.reduce((sum, c) => sum + c.x, 0) / centers.length;
  const endY = centers.reduce((sum, c) => sum + c.y, 0) / centers.length;
  const angle = Math.atan2(endY - startY, endX - startX);

  const attackerDemon = getCombatDemon(attackerId);
  const isBackLineAttack = attackerDemon && getDemonPosition(attackerDemon) === 'back';
  const startOffset = Math.min(attackerRect.width * (isBackLineAttack ? 0.28 : 0.42), 46);
  const x1 = startX + Math.cos(angle) * startOffset;
  const y1 = startY + Math.sin(angle) * startOffset;
  const x2 = endX;
  const y2 = endY;
  const distance = Math.max(1, Math.hypot(x2 - x1, y2 - y1));
  const normalX = -(y2 - y1) / distance;
  const normalY = (x2 - x1) / distance;

  // Nova reaches far enough to engulf every target card around the group centre.
  const reach = clamp(
    Math.max(...centers.map((c) => Math.hypot(c.x - endX, c.y - endY) + c.half)) + 8,
    44,
    220
  );

  const emberCount = 9;
  const emberHtml = Array.from({ length: emberCount }, (_, index) => {
    const t = 0.12 + (index / Math.max(1, emberCount - 1)) * 0.72;
    const drift = ((index % 2) ? -1 : 1) * (4 + (index % 3) * 2);
    const x = x1 + (x2 - x1) * t + normalX * drift;
    const y = y1 + (y2 - y1) * t + normalY * drift;
    const radius = 1.8 + (index % 3) * 0.8;
    return `<circle class="fireball-ember" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(1)}" style="animation-delay: ${scaleCombatDuration(70 + index * 28).toFixed(0)}ms" />`;
  }).join('');

  const fireball = createCombatElement([
    'fireball-shot',
    getDemonSide(attackerId) === 'player' ? 'is-player-attack' : 'is-enemy-attack',
    isBackLineAttack ? 'is-back-attack' : ''
  ].filter(Boolean).join(' '), attackerId, options.effect);
  fireball.innerHTML = renderViewportSvg(`
      ${emberHtml}
      <g class="fireball-projectile" style="--fireball-start-x: ${x1.toFixed(1)}px; --fireball-start-y: ${y1.toFixed(1)}px; --fireball-end-x: ${x2.toFixed(1)}px; --fireball-end-y: ${y2.toFixed(1)}px;">
        <circle class="fireball-core" cx="0" cy="0" r="11" />
      </g>
  `);
  appendTemporaryElement(fireball, 620);

  const travel = Number(options.travel) || 380;
  scheduleImpact(travel, () => drawFireNova(endX, endY, reach, attackerId, options.effect));
}

// Expanding red shockwave detonation, centred on the fire group. Drawn when the shared
// fireball lands, immediately before the per-target floating numbers register.
function drawFireNova(centerX, centerY, reach, attackerId, effect) {
  if (prefersReducedMotion()) return;
  const radius = Math.max(20, Number(reach) || 60);
  const nova = createCombatElement('fire-nova', attackerId, effect);
  // Hollow-centred bloom: the inner part is transparent so the middle doesn't read as a solid
  // red disc, the colour only builds toward the outer edge of the shockwave.
  const gradientId = `fire-nova-grad-${Math.random().toString(36).slice(2, 8)}`;
  nova.innerHTML = renderViewportSvg(`
      <defs>
        <radialGradient id="${gradientId}" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
          <stop offset="52%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
          <stop offset="82%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0.62" />
          <stop offset="100%" style="stop-color: var(--combat-color, #E25041); stop-opacity: 0" />
        </radialGradient>
      </defs>
      <circle class="fire-nova-flash" cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" r="${(radius * 0.72).toFixed(1)}" style="fill: url(#${gradientId})" />
      <circle class="fire-nova-ring fire-nova-ring-hot" cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" r="${(radius * 0.62).toFixed(1)}" />
      <circle class="fire-nova-ring" cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" r="${radius.toFixed(1)}" />
      <circle class="fire-nova-ring fire-nova-ring-delayed" cx="${centerX.toFixed(1)}" cy="${centerY.toFixed(1)}" r="${radius.toFixed(1)}" />
  `);
  appendTemporaryElement(nova, 620);
}

function updateTargetCard(instanceId, hp, attackerSide = 'unknown', options = {}) {
  const card = findDemonCard(instanceId);
  if (!card) return;

  const hpElement = card.querySelector('.js-demon-hp');
  if (hpElement) hpElement.textContent = hp;

  const hpFillElement = card.querySelector('.js-demon-hp-fill');
  if (hpFillElement) {
    const maxHp = Number(hpFillElement.dataset.maxHp) || Number(hp) || 1;
    const hpPercent = Math.max(0, Math.min(100, Math.round((Number(hp) / maxHp) * 100)));
    hpFillElement.style.width = `${hpPercent}%`;
  }

  card.classList.toggle('is-defeated', Number(hp) <= 0);
}

function syncPoisonStatus(instanceId, stackCount) {
  const card = findDemonCard(instanceId);
  if (!card) return;

  const existing = card.querySelector('.demon-status-poison');
  if (Number(stackCount) <= 0) {
    card.querySelector('.demon-status-strip')?.remove();
    card.classList.remove('is-poisoned');
    return;
  }

  card.classList.add('is-poisoned');
  card.querySelector('.demon-status-strip')?.remove();
  card.insertAdjacentHTML('beforeend', renderDemonStatus({
    statusEffects: {
      poison: Array.from({ length: Math.max(1, Number(stackCount) || 1) }, () => ({}))
    }
  }));
}

function showFloatingDamage(instanceId, amount, type, attackerId, effect, options = {}) {
  const card = findDemonCard(instanceId);
  if (!card) return;

  const rect = card.getBoundingClientRect();
  const floating = createCombatElement(`floating-combat-number is-${type}`, attackerId, effect || type);
  floating.style.left = `${(rect.left + rect.width / 2).toFixed(1)}px`;
  floating.style.top = `${Math.max(6, rect.top + rect.height * 0.08).toFixed(1)}px`;
  floating.innerHTML = type === 'heal'
    ? `+${escapeHtml(amount)}`
    : `-${escapeHtml(amount)}`;
  if (type === 'poison' && Number(options.burstCount) > 1) {
    const burstCount = Math.max(1, Number(options.burstCount) || 1);
    const scale = Math.min(2.2, 1 + (burstCount - 1) * 0.12);
    floating.style.fontSize = `calc(1.22rem * ${scale.toFixed(2)})`;
  }
  appendTemporaryElement(floating, 760);
}

function drawSwordSwing(attackerId, targetId) {
  const attacker = findDemonCard(attackerId);
  const target = findDemonCard(targetId);
  if (!attacker || !target) return;

  const { attackerRect, startX, startY, endX, endY, angle } = getAttackGeometry(attacker, target);
  const height = Math.max(70, attackerRect.height * 0.92);
  const width = Math.max(18, attackerRect.width * 0.2);
  const distance = attackerRect.width * 0.58;
  const x = startX + Math.cos(angle) * distance;
  const y = startY + Math.sin(angle) * distance;
  const endOffset = Math.max(22, attackerRect.width * 0.26);
  const swing = createCombatElement('sword-swing', attackerId);
  swing.innerHTML = renderViewportSvg(`
      ${[-0.18, 0, 0.18].map((offset, index) => {
        const offsetX = x + Math.cos(angle + Math.PI / 2) * height * offset;
        const offsetY = y + Math.sin(angle + Math.PI / 2) * height * offset;
        const d = `M ${offsetX.toFixed(1)} ${(offsetY - height * 0.34).toFixed(1)} Q ${(offsetX + width).toFixed(1)} ${offsetY.toFixed(1)} ${offsetX.toFixed(1)} ${(offsetY + height * 0.34).toFixed(1)}`;
        const transform = `rotate(${(angle * 180 / Math.PI).toFixed(1)} ${offsetX.toFixed(1)} ${offsetY.toFixed(1)}) translate(${endOffset.toFixed(1)} 0)`;
        return `<path class="sword-swing-belly sword-scratch-${index + 1}" d="${d}" transform="${transform}" /><path class="sword-swing-arc sword-scratch-${index + 1}" d="${d}" transform="${transform}" />`;
      }).join('')}
  `);
  appendTemporaryElement(swing, 440);
}

function drawThornBurst(attackerId, targetId) {
  const attacker = findDemonCard(attackerId);
  const target = findDemonCard(targetId);
  if (!attacker || !target) return;

  const { attackerRect, startX, startY, angle } = getAttackGeometry(attacker, target);
  const originDistance = Math.max(42, attackerRect.width * 0.5);
  const originX = startX + Math.cos(angle) * originDistance;
  const originY = startY + Math.sin(angle) * originDistance;
  const thornLength = Math.max(22, attackerRect.width * 0.28);
  const thorns = createCombatElement('thorn-burst', attackerId);
  const offsets = [-0.48, -0.28, -0.1, 0.1, 0.28, 0.48];
  thorns.innerHTML = renderViewportSvg(`
      ${offsets.map((offset, index) => {
        const thornAngle = angle + offset;
        const length = thornLength * (0.74 + (index % 2) * 0.16);
        const spread = attackerRect.height * 0.82;
        const baseX = originX + Math.cos(angle + Math.PI / 2) * ((index / (offsets.length - 1)) - 0.5) * spread;
        const baseY = originY + Math.sin(angle + Math.PI / 2) * ((index / (offsets.length - 1)) - 0.5) * spread;
        const tipX = baseX + Math.cos(thornAngle) * length;
        const tipY = baseY + Math.sin(thornAngle) * length;
        return `<path class="thorn-spike" d="M ${baseX.toFixed(1)} ${baseY.toFixed(1)} L ${tipX.toFixed(1)} ${tipY.toFixed(1)}" />`;
      }).join('')}
  `);
  appendTemporaryElement(thorns, 520);
}

function shakeTargetCard(instanceId) {
  const card = findDemonCard(instanceId);
  if (!card) return;
  playTemporaryCardClass(card, 'is-shaking', 360);
}

function drawHealEffect(attackerId, targetId) {
  const target = findDemonCard(targetId);
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const ring = Math.max(18, rect.width * 0.18);
  const heal = createCombatElement('heal-effect', attackerId, 'heal');
  heal.innerHTML = renderViewportSvg(`
      <circle class="heal-ring" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${ring.toFixed(1)}" />
      <circle class="heal-ring heal-ring-secondary" cx="${(x - ring * 0.6).toFixed(1)}" cy="${(y + ring * 0.16).toFixed(1)}" r="${(ring * 0.72).toFixed(1)}" />
      <circle class="heal-ring heal-ring-tertiary" cx="${(x + ring * 0.58).toFixed(1)}" cy="${(y - ring * 0.14).toFixed(1)}" r="${(ring * 0.58).toFixed(1)}" />
  `);
  appendTemporaryElement(heal, 620);
}

function drawChaoticLightning(attackerId, targetId) {
  const target = findDemonCard(targetId);
  if (!target) return;

  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const top = Math.max(0, rect.top - Math.min(170, window.innerHeight * 0.24));
  const strikeY = rect.top + rect.height * 0.56;
  const branchY = rect.top + rect.height * 0.26;
  const zap = createCombatElement('chaos-lightning is-thunderstrike', attackerId);
  const boltD = `M ${(x - 12).toFixed(1)} ${top.toFixed(1)} L ${(x + 10).toFixed(1)} ${(top + 42).toFixed(1)} L ${(x - 8).toFixed(1)} ${(top + 42).toFixed(1)} L ${(x + 7).toFixed(1)} ${(branchY + 10).toFixed(1)} L ${(x - 16).toFixed(1)} ${(branchY + 10).toFixed(1)} L ${(x + 4).toFixed(1)} ${strikeY.toFixed(1)}`;
  const branchOneD = `M ${(x + 7).toFixed(1)} ${(branchY - 4).toFixed(1)} L ${(x + 34).toFixed(1)} ${(branchY + 10).toFixed(1)} L ${(x + 14).toFixed(1)} ${(branchY + 18).toFixed(1)}`;
  const branchTwoD = `M ${(x - 4).toFixed(1)} ${(branchY + 22).toFixed(1)} L ${(x - 35).toFixed(1)} ${(branchY + 34).toFixed(1)} L ${(x - 13).toFixed(1)} ${(branchY + 43).toFixed(1)}`;
  zap.innerHTML = renderViewportSvg(`
      <path class="chaos-thunder-border chaos-thunder-core" d="${boltD}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${branchOneD}" />
      <path class="chaos-thunder-border chaos-thunder-branch" d="${branchTwoD}" />
      <path class="chaos-thunder-core" d="${boltD}" />
      <path class="chaos-thunder-branch" d="${branchOneD}" />
      <path class="chaos-thunder-branch" d="${branchTwoD}" />
  `);
  appendTemporaryElement(zap, 360);
}

function drawDarkSpike(attackerId, targetId) {
  const attacker = findDemonCard(attackerId);
  const target = findDemonCard(targetId);
  if (!attacker || !target) return;

  const attackerRect = attacker.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const startX = attackerRect.left + attackerRect.width / 2;
  const startY = attackerRect.top + attackerRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;
  const angle = Math.atan2(endY - startY, endX - startX);
  const length = Math.max(24, Math.hypot(endX - startX, endY - startY));
  const spike = createCombatElement('dark-spike', attackerId);
  spike.style.left = `${startX}px`;
  spike.style.top = `${startY}px`;
  spike.style.width = `${length}px`;
  spike.style.setProperty('--dark-spike-angle', `${angle}rad`);
  appendTemporaryElement(spike, 340);
}

function getCombatTheme(attackerId, effect) {
  if (effect === 'poison' || effect === 'poison_apply') return COMBAT_THEMES.poison;
  if (effect === 'heal') return COMBAT_THEMES.heal;

  const typeId = Number(getCombatDemon(attackerId)?.typeId);
  return COMBAT_THEMES[typeId] || COMBAT_THEMES.default;
}

function applyCombatTheme(element, theme) {
  if (!element || !theme) return;
  element.style.setProperty('--combat-color', theme.color);
  element.style.setProperty('--combat-shadow', theme.shadow);
  element.style.setProperty('--combat-text-outline', theme.outline || '#fff');
}

function createCombatElement(className, attackerId, effect) {
  const element = document.createElement('div');
  element.className = className;
  applyCombatTheme(element, getCombatTheme(attackerId, effect));
  return element;
}

function appendTemporaryElement(element, duration, parent = document.body) {
  parent.appendChild(element);
  setTimeout(() => element.remove(), scaleCombatDuration(duration));
  return element;
}

function renderViewportSvg(content) {
  return `<svg viewBox="0 0 ${window.innerWidth} ${window.innerHeight}" aria-hidden="true" focusable="false">${content}</svg>`;
}

function getAttackGeometry(attacker, target) {
  const attackerRect = attacker.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const startX = attackerRect.left + attackerRect.width / 2;
  const startY = attackerRect.top + attackerRect.height / 2;
  const endX = targetRect.left + targetRect.width / 2;
  const endY = targetRect.top + targetRect.height / 2;

  return {
    attackerRect,
    targetRect,
    startX,
    startY,
    endX,
    endY,
    angle: Math.atan2(endY - startY, endX - startX)
  };
}

// Step pacing is derived from the same attack profiles that drive impact timing, plus a
// short hold so the floating number/burst can register before the next step begins.
function getCombatStepDelay(step) {
  const entries = step.entries || [];
  const isAoe = Boolean(step.isAoe) || entries.length > 1;
  const IMPACT_HOLD = 240;

  return Math.max(
    340,
    ...entries.map((entry, index) => {
      if (entry.effect === 'heal' || entry.effect === 'last_breath') return 500;
      if (entry.effect === 'poison') return 380;
      if (entry.effect === 'poison_apply') return 460;
      if (entry.effect === 'shared_pain') return 320;
      const stagger = isAoe ? index * 70 : 0;
      return getAttackProfile(entry).travel + stagger + IMPACT_HOLD;
    })
  );
}

function setBattleSpeed(speed) {
  if (!BATTLE_SPEED_OPTIONS.includes(speed)) return;
  state.battleSpeed = speed;
  localStorage.setItem(BATTLE_SPEED_KEY, String(speed));
  applyBattleSpeed();
  syncBattleSpeedButtons();
}

function applyBattleSpeed() {
  document.documentElement.style.setProperty('--battle-animation-scale', String(getBattleTimeScale()));
  [24, 34, 36, 48, 80, 150, 240, 320, 340, 360, 440, 520, 620, 760, 960].forEach((duration) => {
    document.documentElement.style.setProperty(`--battle-duration-${duration}`, `${scaleCombatDuration(duration)}ms`);
  });
}

function getBattleTimeScale() {
  return 1 / (Number(state.battleSpeed) || 1);
}

function scaleCombatDuration(duration) {
  return Math.max(0, Math.round((Number(duration) || 0) * getBattleTimeScale()));
}

function formatBattleSpeed(speed) {
  return `${Number(speed)}x`;
}

function syncBattleSpeedButtons() {
  document.querySelectorAll('[data-battle-speed]').forEach((button) => {
    const active = Number(button.dataset.battleSpeed) === state.battleSpeed;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function isTypeTwoAttack(instanceId) {
  return Number(getCombatDemon(instanceId)?.typeId) === 2;
}

function findDemonCard(instanceId) {
  const selector = `.dungeon-demon-card[data-instance-id="${cssEscape(String(instanceId))}"]`;
  return document.querySelector(`#teamGrid ${selector}, #enemyGrid ${selector}`)
    || document.querySelector(selector);
}

function playTemporaryCardClass(card, className, duration) {
  const timerKey = `${className}Timer`;
  if (card[timerKey]) {
    clearTimeout(card[timerKey]);
  }

  card.classList.remove(className);
  void card.offsetWidth;
  card.classList.add(className);
  card[timerKey] = setTimeout(() => {
    card.classList.remove(className);
    if (className === 'is-attacking' || className === 'is-hit') {
      card.classList.remove('is-player-attack', 'is-enemy-attack');
    }
    card[timerKey] = null;
  }, scaleCombatDuration(duration));
}

function renderFightLogRow(step, index) {
  const primaryEntry = step.entries[0];
  const damageText = getFightLogAmountText(step);
  const hpText = primaryEntry.effect === 'poison_apply'
    ? 'Poisoned'
    : primaryEntry.effect === 'heal'
      ? `${primaryEntry.targetHp} HP`
      : step.isAoe
        ? 'AOE'
        : `${primaryEntry.targetHp} HP`;

  return `
    <div class="fight-log-row ${getLogRowClass(primaryEntry)}" data-log-index="${index}">
      <span class="text-secondary">T${primaryEntry.tick}</span>
      <span class="fight-log-side">${getLogSideLabel(primaryEntry)}</span>
      <span class="fight-log-action">${getFightLogActionText(step)}</span>
      <span class="fight-log-damage">${damageText}</span>
      <span class="text-secondary">${hpText}</span>
    </div>
  `;
}

function groupCombatLog(combatLog) {
  const steps = [];

  for (const entry of combatLog || []) {
    const previous = steps[steps.length - 1];
    const isSameAoe = (entry.targeting === 'all' || entry.targeting === 'cleave') &&
      previous?.isAoe &&
      previous.tick === entry.tick &&
      previous.attacker === entry.attacker;
    const isSameCounterattack = (entry.effect === 'retaliate' || entry.effect === 'thorns') &&
      previous &&
      previous.tick === entry.tick &&
      previous.entries.some((previousEntry) => previousEntry.attacker === entry.target && previousEntry.target === entry.attacker);
    const isSamePoisonBurst = entry.effect === 'poison' &&
      previous?.primaryEffect === 'poison' &&
      previous.tick === entry.tick &&
      previous.entries.every((previousEntry) => previousEntry.target === entry.target);

    if (isSameAoe || isSameCounterattack || isSamePoisonBurst) {
      previous.entries.push(entry);
      continue;
    }

    steps.push({
      tick: entry.tick,
      attacker: entry.attacker,
      isAoe: entry.targeting === 'all' || entry.targeting === 'cleave',
      primaryEffect: entry.effect || null,
      entries: [entry]
    });
  }

  return steps;
}

function renderLogPosition(position) {
  if (!position) return '';
  return `<span class="fight-log-position">${position === 'front' ? 'Front' : 'Back'}</span>`;
}

function getFightLogActionText(step) {
  const entry = step.entries[0];
  const attacker = renderFightLogDemonName(entry.attacker);
  const target = `${renderFightLogDemonName(entry.target)} ${renderLogPosition(entry.targetPosition)}`;

  if (entry.effect === 'poison_apply') return `${attacker} applied poison to ${target}`;
  if (entry.effect === 'poison') return `${target} took poison damage`;
  if (entry.effect === 'heal') return `${attacker} healed ${target}`;
  if (entry.effect === 'last_breath') return `${target} survived at 1 HP`;
  if (entry.effect === 'shared_pain') return `Surviving allies gained direct damage`;
  if (entry.effect === 'chain_explosion') return `${attacker} exploded into ${target}`;
  if (entry.effect === 'retaliate') return `${attacker} retaliated against ${target}`;
  if (entry.effect === 'thorns') return `${attacker} reflected damage to ${target}`;
  if (entry.targeting === 'chaotic') return `${attacker} chaotically struck ${target}`;
  if (entry.targeting === 'cleave') return `${attacker} cleaved ${step.entries.length} demons`;
  if (step.isAoe) return `${attacker} splashed ${step.entries.length} enemies`;
  return `${attacker} ${getFightLogVerb(entry)} ${target}`;
}

function getFightLogVerb(entry) {
  if (entry.effect === 'poison_apply') return 'poisoned';
  if (entry.effect === 'poison') return 'poisoned';
  if (entry.effect === 'heal') return 'healed';
  if (entry.effect === 'last_breath') return 'survived';
  if (entry.effect === 'shared_pain') return 'empowered';
  if (entry.effect === 'chain_explosion') return 'exploded into';
  if (entry.effect === 'retaliate') return 'retaliated against';
  if (entry.effect === 'thorns') return 'reflected damage to';
  if (entry.targeting === 'chaotic') return 'chaotically struck';
  if (entry.targeting === 'cleave') return 'cleaved';
  return entry.targeting === 'all' ? 'splashed' : 'hit';
}

function getFightLogAmountText(step) {
  const entry = step.entries[0];
  const counterEntry = step.entries.find((item) => item.effect === 'retaliate' || item.effect === 'thorns');
  if (entry.effect === 'poison_apply') return 'poison';
  if (entry.effect === 'poison') {
    return `${getPoisonBurstDamage(step)} poison`;
  }
  if (entry.effect === 'heal') return `+${entry.healing || 0} hp`;
  if (entry.effect === 'last_breath') return '1 hp';
  if (entry.effect === 'shared_pain') return '+25% dmg';
  if (entry.effect === 'chain_explosion') return `${entry.dmg || 0} splash`;
  if (entry.effect === 'thorns') return `${entry.dmg || 0} thorns`;
  if (entry.effect === 'retaliate') return `${entry.dmg || 0} retaliation`;
  if (counterEntry) {
    const label = counterEntry.effect === 'thorns' ? 'thorns' : 'retaliation';
    return `${entry.dmg} dmg, ${counterEntry.dmg} ${label}`;
  }
  if (entry.targeting === 'cleave') return `${step.entries.length} x ${entry.dmg} cleave`;
  if (step.isAoe) return `${step.entries.length} x ${entry.dmg} dmg`;
  return `${entry.dmg} dmg`;
}

function getPoisonBurstDamage(step) {
  return (step.entries || [])
    .filter((entry) => entry.effect === 'poison')
    .reduce((total, entry) => total + (Number(entry.dmg) || 0), 0);
}

function createCombatDemonMap() {
  return new Map([
    ...(state.run?.team || []).map((demon) => [demon.instanceId, { ...demon, side: 'player' }]),
    ...(state.run?.enemies || []).map((demon) => [demon.instanceId, { ...demon, side: 'enemy' }])
  ]);
}

function getLogRowClass(entry) {
  if (entry.effect === 'chain_explosion' || entry.effect === 'shared_pain' || entry.effect === 'last_breath') {
    return 'is-player-action';
  }

  return getDemonSide(entry.attacker) === 'player' ? 'is-player-action' : 'is-enemy-action';
}

function getLogSideLabel(entry) {
  if (entry.effect === 'chain_explosion' || entry.effect === 'shared_pain' || entry.effect === 'last_breath') {
    return 'You';
  }

  return getDemonSide(entry.attacker) === 'player' ? 'You' : 'Enemy';
}

function getDemonSide(instanceId) {
  if ((state.run?.team || []).some((demon) => demon.instanceId === instanceId)) return 'player';
  if ((state.run?.enemies || []).some((demon) => demon.instanceId === instanceId)) return 'enemy';
  if (state.combatDemons.get(instanceId)?.side) return state.combatDemons.get(instanceId).side;
  return 'unknown';
}

function getCombatDemon(instanceId) {
  return [...(state.run?.team || []), ...(state.run?.enemies || [])]
    .find((item) => item.instanceId === instanceId) || state.combatDemons.get(instanceId) || null;
}

function renderFightLogDemonName(instanceId) {
  const demon = [...(state.run?.team || []), ...(state.run?.enemies || [])]
    .find((item) => item.instanceId === instanceId) || state.combatDemons.get(instanceId);

  if (!demon) return escapeHtml(instanceId);
  return `<span class="ad-${escapeHtml(demon.rarity)}">${escapeHtml(demon.species || 'Demon')}</span>`;
}

export {
  playCombatLog,
  pauseCombatPlayback,
  resumeCombatPlayback,
  stepCombatPlayback,
  updateTeamHp,
  syncCombatHpCards,
  setActiveLogRow,
  animateAttackerCard,
  animateCombatEntry,
  getAttackProfile,
  prefersReducedMotion,
  scheduleImpact,
  spawnImpactBurst,
  isCardShakeEnabled,
  isScreenShakeEnabled,
  hitTargetCard,
  poisonTickCard,
  healTargetCard,
  triggerScreenShake,
  maybePlayDeath,
  drawCombatAnimation,
  drawAttackZap,
  drawFireball,
  drawGroupFireball,
  drawFireNova,
  updateTargetCard,
  syncPoisonStatus,
  showFloatingDamage,
  drawSwordSwing,
  drawThornBurst,
  shakeTargetCard,
  drawHealEffect,
  drawChaoticLightning,
  drawDarkSpike,
  getCombatTheme,
  applyCombatTheme,
  createCombatElement,
  appendTemporaryElement,
  renderViewportSvg,
  getAttackGeometry,
  getCombatStepDelay,
  setBattleSpeed,
  applyBattleSpeed,
  getBattleTimeScale,
  scaleCombatDuration,
  formatBattleSpeed,
  syncBattleSpeedButtons,
  isTypeTwoAttack,
  findDemonCard,
  playTemporaryCardClass,
  renderFightLogRow,
  groupCombatLog,
  renderLogPosition,
  getFightLogActionText,
  getFightLogVerb,
  getFightLogAmountText,
  getPoisonBurstDamage,
  createCombatDemonMap,
  getLogRowClass,
  getLogSideLabel,
  getDemonSide,
  getCombatDemon,
  renderFightLogDemonName
};
