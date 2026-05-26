import { dungeonActions } from './registry.js';
import { state, elements, laneResizeObserver, setLaneResizeObserver } from './state.js';
import { api, runPath, activeRunPath, storeCurrentRun, clearCurrentRun } from './api.js';
import { RUN_KEY, BATTLE_SPEED_KEY, MAX_DUNGEON_TEAM_SIZE, FORMATION_GRID_COLUMNS, FORMATION_GRID_SIZE, FORMATION_CELL_CAPACITY, BATTLE_SPEED_OPTIONS, FORMATION_DRAG_OVER_SELECTOR, REWARD_DRAG_OVER_SELECTOR, COMBAT_THEMES } from './config.js';
import { renderSharedDemonCard, renderSharedCombatStats, openDemonDetailsModal, renderIcon } from './shared-ui.js';
import { clearRecruitSelection, clearDragState, clearRecruitDrafts, resetCombatState, resetEndState, handleAuthError, showError, setMessage, withBusy, bindClick, bindClicks, getModal, setTeamChoiceModalFullscreen, syncActionButtons, capitalize, escapeHtml, cssEscape, cloneDemons, sleep } from './utils.js';

const battle = (...args) => dungeonActions.battle(...args);
const getDemonPosition = (...args) => dungeonActions.getDemonPosition(...args);
const renderDemonStatus = (...args) => dungeonActions.renderDemonStatus(...args);
const renderFightLog = (...args) => dungeonActions.renderFightLog(...args);
const renderRun = (...args) => dungeonActions.renderRun(...args);

async function playCombatLog() {
  if (!state.run) return;

  const allDemonsById = new Map([...(state.run.team || []), ...(state.run.enemies || [])].map((demon) => [demon.instanceId, demon]));
  const steps = groupCombatLog(state.combatLog);
  state.isBattleAnimating = true;
  renderRun();
  renderFightLog();

  try {
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];

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
      setActiveLogRow(index);
      if (step.primaryEffect !== 'poison') animateAttackerCard(step.attacker, step.primaryEffect);
      const attackerSide = getDemonSide(step.attacker);
      step.entries.forEach((entry, entryIndex) => {
        if (entry.effect === 'poison') {
          if (entryIndex === 0) {
            showFloatingDamage(entry.target, getPoisonBurstDamage(step), 'poison', entry.attacker, entry.effect, {
              burstCount: step.entries.length
            });
          }
          updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false });
          syncPoisonStatus(entry.target, entry.poisonStacks);
          return;
        }

        if (entry.effect === 'heal') {
          drawHealEffect(entry.attacker, entry.target);
          updateTargetCard(entry.target, entry.targetHp, attackerSide, { hit: false, healing: entry.healing });
          showFloatingDamage(entry.target, entry.healing, 'heal', entry.attacker, entry.effect);
          return;
        }

        if (entry.effect === 'poison_apply') {
          drawAttackZap(step.attacker, entry.target, { effect: entry.effect, poison: true, bubbles: 15, variant: 'poison-flame' });
          syncPoisonStatus(entry.target, entry.poisonStacks || 1);
          updateTargetCard(entry.target, entry.targetHp, attackerSide);
          return;
        }

        drawCombatAnimation(entry);
        if (Number(entry.dmg) > 0) {
          showFloatingDamage(entry.target, entry.dmg, isTypeTwoAttack(entry.attacker) ? 'dark' : 'damage', entry.attacker, entry.effect);
        }
        updateTargetCard(entry.target, entry.targetHp, attackerSide);
      });
      await sleep(scaleCombatDuration(getCombatStepDelay(step)));
    }
  } finally {
    state.isBattleAnimating = false;
    renderRun();
  }

  setActiveLogRow(-1);
}

function updateTeamHp() {
  if (!state.run) return;
  state.run.hp = (state.run.team || []).reduce((sum, demon) => sum + Math.max(0, Number(demon.hp) || 0), 0);
}

function setActiveLogRow(index) {
  document.querySelectorAll('.fight-log-row').forEach((row) => {
    row.classList.toggle('active', Number(row.dataset.logIndex) === index);
  });
}

function animateAttackerCard(instanceId, effect) {
  const card = findDemonCard(instanceId);
  if (!card) return;

  applyCombatTheme(card, getCombatTheme(instanceId, effect));
  card.classList.toggle('is-player-attack', getDemonSide(instanceId) === 'player');
  card.classList.toggle('is-enemy-attack', getDemonSide(instanceId) === 'enemy');
  playTemporaryCardClass(card, 'is-attacking', 320);
}

function drawCombatAnimation(entry) {
  const typeId = Number(getCombatDemon(entry.attacker)?.typeId);

  if (entry.targeting === 'chaotic') {
    drawChaoticLightning(entry.attacker, entry.target);
    return;
  }

  const typeAnimation = {
    2: () => drawDarkSpike(entry.attacker, entry.target),
    4: () => drawFireball(entry.attacker, entry.target, { effect: entry.effect }),
    5: () => drawAttackZap(entry.attacker, entry.target, { effect: entry.effect, variant: 'heavy', duration: 520 }),
    6: () => drawAttackZap(entry.attacker, entry.target, { effect: entry.effect, variant: 'assassin', duration: 240 }),
    7: () => drawSwordSwing(entry.attacker, entry.target),
    8: () => drawThornBurst(entry.attacker, entry.target),
    9: () => {
      drawAttackZap(entry.attacker, entry.target, { effect: entry.effect, variant: 'crushing', duration: 960 });
      shakeTargetCard(entry.target);
    }
  }[typeId];

  if (typeAnimation) typeAnimation();
  else drawAttackZap(entry.attacker, entry.target, { effect: entry.effect });
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

function getCombatStepDelay(step) {
  return Math.max(
    320,
    ...(step.entries || []).map((entry) => {
      const typeId = Number(getCombatDemon(entry.attacker)?.typeId);
      if (entry.effect === 'heal') return 500;
      if (typeId === 4) return 520;
      if (typeId === 5 || typeId === 8) return 520;
      if (typeId === 9) return 960;
      return 320;
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
  return Array.from(document.querySelectorAll('.hunt-demon-card'))
    .find((item) => item.dataset.instanceId === instanceId);
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
    const isSameRetaliation = entry.effect === 'retaliate' &&
      previous &&
      previous.tick === entry.tick &&
      previous.entries.some((previousEntry) => previousEntry.attacker === entry.target && previousEntry.target === entry.attacker);
    const isSamePoisonBurst = entry.effect === 'poison' &&
      previous?.primaryEffect === 'poison' &&
      previous.tick === entry.tick &&
      previous.entries.every((previousEntry) => previousEntry.target === entry.target);

    if (isSameAoe || isSameRetaliation || isSamePoisonBurst) {
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
  if (entry.effect === 'retaliate') return `${attacker} retaliated against ${target}`;
  if (entry.targeting === 'chaotic') return `${attacker} chaotically struck ${target}`;
  if (entry.targeting === 'cleave') return `${attacker} cleaved ${step.entries.length} demons`;
  if (step.isAoe) return `${attacker} splashed ${step.entries.length} enemies`;
  return `${attacker} ${getFightLogVerb(entry)} ${target}`;
}

function getFightLogVerb(entry) {
  if (entry.effect === 'poison_apply') return 'poisoned';
  if (entry.effect === 'poison') return 'poisoned';
  if (entry.effect === 'heal') return 'healed';
  if (entry.effect === 'retaliate') return 'retaliated against';
  if (entry.targeting === 'chaotic') return 'chaotically struck';
  if (entry.targeting === 'cleave') return 'cleaved';
  return entry.targeting === 'all' ? 'splashed' : 'hit';
}

function getFightLogAmountText(step) {
  const entry = step.entries[0];
  const retaliationEntry = step.entries.find((item) => item.effect === 'retaliate');
  if (entry.effect === 'poison_apply') return 'poison';
  if (entry.effect === 'poison') {
    return `${getPoisonBurstDamage(step)} poison`;
  }
  if (entry.effect === 'heal') return `+${entry.healing || 0} hp`;
  if (retaliationEntry) return `${entry.dmg} dmg, ${retaliationEntry.dmg} thorns`;
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
  return getDemonSide(entry.attacker) === 'player' ? 'is-player-action' : 'is-enemy-action';
}

function getLogSideLabel(entry) {
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
  updateTeamHp,
  setActiveLogRow,
  animateAttackerCard,
  drawCombatAnimation,
  drawAttackZap,
  drawFireball,
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
