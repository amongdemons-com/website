const RARITIES = Object.freeze([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic'
]);

const RANKED_RULES_VERSION = 'ranked-v2';
const COMBAT_DATA_VERSION = 'combat-v2';
const ACTIVE_CAPACITY = 9;
const RESERVE_CAPACITY = 6;
const STARTING_LIVES = 3;
const STARTING_DRAFT_PICKS = 2;
const OFFER_SIZE = 5;
const RANKED_STARTING_RSOULS = 2;
const RANKED_REROLL_RSOUL_COST = 2;
const RANKED_CARD_RARITY_COSTS = Object.freeze({
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
  mythic: 7
});
const FLOOR_TEN_SOUL_REWARD = 25;
const ENDLESS_RATING_CAP_PER_RUN = 100;
const ENDLESS_SKILL_CAP = 10;

const DIVISIONS = Object.freeze([
  { minimum: 0, name: 'Bronze III' },
  { minimum: 900, name: 'Bronze II' },
  { minimum: 1100, name: 'Bronze I' },
  { minimum: 1250, name: 'Silver III' },
  { minimum: 1400, name: 'Silver II' },
  { minimum: 1550, name: 'Silver I' },
  { minimum: 1700, name: 'Gold III' },
  { minimum: 1875, name: 'Gold II' },
  { minimum: 2050, name: 'Gold I' },
  { minimum: 2250, name: 'Platinum III' },
  { minimum: 2475, name: 'Platinum II' },
  { minimum: 2700, name: 'Platinum I' },
  { minimum: 2950, name: 'Diamond III' },
  { minimum: 3225, name: 'Diamond II' },
  { minimum: 3500, name: 'Diamond I' },
  { minimum: 3800, name: 'Demonic' }
]);

function getRarityOdds(floor) {
  const depth = Math.max(0, Math.floor(Number(floor) || 0));
  if (depth <= 2) return odds(70, 25, 5, 0, 0, 0);
  if (depth <= 4) return odds(55, 30, 12, 3, 0, 0);
  if (depth <= 6) return odds(42, 32, 18, 7, 1, 0);
  if (depth <= 9) return odds(30, 30, 23, 12, 4, 1);
  if (depth <= 14) return odds(22, 27, 25, 16, 8, 2);
  if (depth <= 24) return odds(18, 23, 26, 19, 11, 3);
  return odds(14, 20, 26, 22, 13, 5);
}

function odds(common, uncommon, rare, epic, legendary, mythic) {
  return { common, uncommon, rare, epic, legendary, mythic };
}

function pickRarityFromOdds(rng, rarityOdds) {
  const entries = RARITIES
    .map((rarity) => [rarity, Math.max(0, Number(rarityOdds?.[rarity]) || 0)])
    .filter(([, weight]) => weight > 0);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng() * (total || 1);

  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }

  return entries[0]?.[0] || 'common';
}

function getNextRarity(rarity) {
  const index = RARITIES.indexOf(String(rarity || '').toLowerCase());
  return index >= 0 && index < RARITIES.length - 1 ? RARITIES[index + 1] : null;
}

function getRankedActiveCapacity(floor) {
  return Math.min(ACTIVE_CAPACITY, Math.max(2, Math.floor(Number(floor) || 1) + 1));
}

function combineRoster(source, createUpgrade) {
  const roster = cloneRoster(source);
  const events = [];
  let combined = true;

  while (combined) {
    combined = false;
    for (const rarity of RARITIES.slice(0, -1)) {
      const groups = groupCombinableDemons(roster, rarity);
      const match = [...groups.values()].find((demons) => demons.length >= 3);
      if (!match) continue;

      const consumed = match.slice(0, 3);
      const activeConsumed = consumed.filter((entry) => entry.zone === 'active');
      const destinationEntry = activeConsumed[0] || consumed[0];
      removeRosterDemons(roster, new Set(consumed.map((entry) => entry.demon.instanceId)));
      const upgraded = createUpgrade({
        typeId: Number(consumed[0].demon.typeId),
        rarity: getNextRarity(rarity),
        consumed: consumed.map((entry) => ({ ...entry.demon })),
        destination: destinationEntry.zone,
        formationSlot: destinationEntry.demon.formationSlot,
        reserveSlot: destinationEntry.demon.reserveSlot
      });
      if (!upgraded || !upgraded.instanceId) {
        throw new Error('Ranked combination did not create a valid upgraded demon.');
      }

      const destination = destinationEntry.zone === 'active' ? roster.active : roster.reserve;
      destination.push({
        ...upgraded,
        ...(destinationEntry.zone === 'active' && Number.isInteger(Number(destinationEntry.demon.formationSlot))
          ? { formationSlot: Number(destinationEntry.demon.formationSlot) }
          : {}),
        ...(destinationEntry.zone === 'reserve' && normalizeReserveSlot(destinationEntry.demon.reserveSlot) !== null
          ? { reserveSlot: normalizeReserveSlot(destinationEntry.demon.reserveSlot) }
          : {})
      });
      events.push({
        type: 'combine',
        typeId: Number(upgraded.typeId),
        fromRarity: rarity,
        toRarity: upgraded.rarity,
        consumedInstanceIds: consumed.map((entry) => entry.demon.instanceId),
        resultInstanceId: upgraded.instanceId,
        destination: destinationEntry.zone
      });
      combined = true;
      break;
    }
  }

  return { ...roster, events };
}

function groupCombinableDemons(roster, rarity) {
  const groups = new Map();
  for (const entry of listRosterEntries(roster)) {
    if (String(entry.demon.rarity).toLowerCase() !== rarity) continue;
    const key = `${Number(entry.demon.typeId)}:${rarity}`;
    const group = groups.get(key) || [];
    group.push(entry);
    groups.set(key, group);
  }
  return groups;
}

function listRosterEntries(roster) {
  return [
    ...(roster.active || []).map((demon, index) => ({ zone: 'active', index, demon })),
    ...(roster.reserve || []).map((demon, index) => ({ zone: 'reserve', index, demon }))
  ];
}

function removeRosterDemons(roster, instanceIds) {
  roster.active = roster.active.filter((demon) => !instanceIds.has(demon.instanceId));
  roster.reserve = roster.reserve.filter((demon) => !instanceIds.has(demon.instanceId));
}

function moveRosterDemon(source, instanceId, destination, formationSlot = null, swapInstanceId = null) {
  const roster = cloneRoster(source);
  const id = String(instanceId || '');
  const targetZone = destination === 'reserve' ? 'reserve' : 'active';
  const entry = listRosterEntries(roster).find((candidate) => candidate.demon.instanceId === id);
  if (!entry) return errorResult('Demon not found.');
  const swapEntry = swapInstanceId
    ? listRosterEntries(roster).find((candidate) => candidate.demon.instanceId === String(swapInstanceId))
    : null;
  if (swapEntry && swapEntry.demon.instanceId !== id && entry.zone === 'active' && swapEntry.zone === 'active') {
    const entrySlot = normalizeFormationSlot(entry.demon.formationSlot);
    const swapSlot = normalizeFormationSlot(formationSlot ?? swapEntry.demon.formationSlot);
    entry.demon.formationSlot = swapSlot ?? swapEntry.index;
    swapEntry.demon.formationSlot = entrySlot ?? entry.index;
    entry.demon.position = getFormationSlotPosition(entry.demon.formationSlot);
    swapEntry.demon.position = getFormationSlotPosition(swapEntry.demon.formationSlot);
    return { ok: true, ...roster };
  }
  if (swapEntry && swapEntry.demon.instanceId !== id && swapEntry.zone === targetZone && entry.zone !== targetZone) {
    const sourceSlot = normalizeFormationSlot(entry.demon.formationSlot);
    const targetSlot = normalizeFormationSlot(formationSlot ?? swapEntry.demon.formationSlot);
    roster[entry.zone][entry.index] = swapEntry.demon;
    roster[swapEntry.zone][swapEntry.index] = entry.demon;

    if (targetZone === 'active') {
      entry.demon.formationSlot = targetSlot ?? swapEntry.index;
      entry.demon.position = getFormationSlotPosition(entry.demon.formationSlot);
      delete swapEntry.demon.formationSlot;
      swapEntry.demon.position = swapEntry.demon.preferredPosition === 'back' ? 'back' : 'front';
    } else {
      swapEntry.demon.formationSlot = sourceSlot ?? entry.index;
      swapEntry.demon.position = getFormationSlotPosition(swapEntry.demon.formationSlot);
      delete entry.demon.formationSlot;
      entry.demon.position = entry.demon.preferredPosition === 'back' ? 'back' : 'front';
    }
    return { ok: true, ...roster };
  }
  if (entry.zone !== targetZone) {
    const target = roster[targetZone];
    const capacity = targetZone === 'active' ? ACTIVE_CAPACITY : RESERVE_CAPACITY;
    if (target.length >= capacity) return errorResult(`${capitalize(targetZone)} is full.`);
    roster[entry.zone].splice(entry.index, 1);
    target.push(entry.demon);
  }

  if (targetZone === 'active') {
    const slot = normalizeFormationSlot(formationSlot);
    if (slot !== null) {
      const occupying = roster.active.find((demon) => (
        demon.instanceId !== id && normalizeFormationSlot(demon.formationSlot) === slot
      ));
      if (occupying) return errorResult('Formation slot is occupied.');
      const demon = roster.active.find((candidate) => candidate.instanceId === id);
      demon.formationSlot = slot;
      demon.position = getFormationSlotPosition(slot);
    }
  } else {
    const demon = roster.reserve.find((candidate) => candidate.instanceId === id);
    if (demon) {
      delete demon.formationSlot;
      demon.position = demon.preferredPosition === 'back' ? 'back' : 'front';
    }
  }

  return { ok: true, ...roster };
}

function banishRosterDemon(source, instanceId) {
  const roster = cloneRoster(source);
  const entry = listRosterEntries(roster).find((candidate) => candidate.demon.instanceId === String(instanceId || ''));
  if (!entry) return errorResult('Demon not found.');
  if (entry.zone === 'active' && roster.active.length <= 1) {
    return errorResult('The last active demon cannot be banished.');
  }
  roster[entry.zone].splice(entry.index, 1);
  return { ok: true, ...roster, banished: { ...entry.demon } };
}

function getRosterValidation(source, options = {}) {
  const roster = cloneRoster(source);
  const entries = listRosterEntries(roster);
  const ids = entries.map((entry) => String(entry.demon.instanceId || ''));
  const slots = roster.active
    .map((demon) => normalizeFormationSlot(demon.formationSlot))
    .filter((slot) => slot !== null);
  const reserveSlots = roster.reserve
    .map((demon) => normalizeReserveSlot(demon.reserveSlot))
    .filter((slot) => slot !== null);
  const errors = [];

  if (roster.active.length > ACTIVE_CAPACITY) errors.push(`Active formation exceeds ${ACTIVE_CAPACITY} demons.`);
  if (roster.reserve.length > RESERVE_CAPACITY) errors.push(`Reserve exceeds ${RESERVE_CAPACITY} demons.`);
  if (new Set(ids).size !== ids.length || ids.some((id) => !id)) errors.push('Roster contains duplicate or invalid demons.');
  if (new Set(slots).size !== slots.length) errors.push('Formation contains duplicate slots.');
  if (new Set(reserveSlots).size !== reserveSlots.length) errors.push('Reserve contains duplicate slots.');
  if (options.requireActive !== false && roster.active.length < 1) errors.push('At least one active demon is required.');

  return { valid: errors.length === 0, errors };
}

function canAcceptDemon(source) {
  const roster = cloneRoster(source);
  return roster.active.length < ACTIVE_CAPACITY || roster.reserve.length < RESERVE_CAPACITY;
}

function consumeReroll(source) {
  const rerolls = normalizeRerolls(source);
  if (!rerolls.freeUsed) {
    return {
      ok: true,
      rerolls: { ...rerolls, freeUsed: true },
      kind: 'free'
    };
  }
  if (rerolls.bonus <= 0) return errorResult('No rerolls are available.');
  return {
    ok: true,
    rerolls: { ...rerolls, bonus: rerolls.bonus - 1 },
    kind: 'banish'
  };
}

function normalizeRerolls(source = {}) {
  return {
    freeUsed: Boolean(source.freeUsed),
    bonus: Math.max(0, Math.floor(Number(source.bonus) || 0))
  };
}

function getAvailableRerolls(source = {}) {
  const rerolls = normalizeRerolls(source);
  return (rerolls.freeUsed ? 0 : 1) + rerolls.bonus;
}

function resolveDefeat(lives) {
  const nextLives = Math.max(0, Math.floor(Number(lives) || 0) - 1);
  return {
    lives: nextLives,
    ended: nextLives === 0
  };
}

function getFloorRatingGain(floor, endlessAlreadyEarned = 0) {
  const depth = Math.max(0, Math.floor(Number(floor) || 0));
  if (depth <= 4) return 0;
  if (depth <= 9) return 6;
  if (depth === 10) return 75;
  const remaining = Math.max(0, ENDLESS_RATING_CAP_PER_RUN - Math.max(0, Number(endlessAlreadyEarned) || 0));
  if (!remaining) return 0;
  const diminishing = Math.max(2, Math.ceil(10 / Math.sqrt(depth - 10)));
  return Math.min(remaining, diminishing);
}

function getEarlyRunRatingAdjustment(highestClearedFloor) {
  const floor = Math.max(0, Math.floor(Number(highestClearedFloor) || 0));
  if (floor >= 10) return 0;
  if (floor < 5) return -20;
  return -5;
}

function getDivision(rating) {
  const value = Math.max(0, Math.floor(Number(rating) || 0));
  return [...DIVISIONS].reverse().find((division) => value >= division.minimum) || DIVISIONS[0];
}

function getFloorTenReward(state = {}) {
  const eligible = Math.max(0, Number(state.highestClearedFloor) || 0) >= 10;
  const claimed = Boolean(state.floorTenRewardClaimed);
  return {
    eligible,
    claimed,
    souls: eligible && !claimed ? FLOOR_TEN_SOUL_REWARD : 0
  };
}

function shouldOfferPact(floor, activePactCount = 0) {
  const depth = Math.max(0, Math.floor(Number(floor) || 0));
  return depth > 0;
}

function getRankedCardCost(demon) {
  const rarity = String(demon?.rarity || 'common').toLowerCase();
  return RANKED_CARD_RARITY_COSTS[rarity] || RANKED_CARD_RARITY_COSTS.common;
}

function createSnapshotPayload(run, options = {}) {
  const state = run?.state || {};
  return {
    snapshotVersion: RANKED_RULES_VERSION,
    combatVersion: options.combatVersion || COMBAT_DATA_VERSION,
    gameDataVersion: options.gameDataVersion || null,
    seasonId: run?.seasonId || null,
    floor: Math.max(1, Number(run?.floor) || 1),
    rating: Math.max(0, Number(options.rating) || 0),
    division: getDivision(options.rating).name,
    team: cloneDemons(state.active),
    reserveSummary: summarizeReserve(state.reserve),
    pacts: cloneJson(state.buffs || {}),
    lockedBuffs: cloneJson(run?.lockedBonuses || {}),
    deterministic: {
      runSeed: Number(run?.seed) || 0,
      floorSeed: ((Number(run?.seed) || 0) + (Number(run?.floor) || 0)) >>> 0,
      rulesVersion: RANKED_RULES_VERSION
    }
  };
}

function summarizeReserve(reserve = []) {
  return (reserve || []).map((demon) => ({
    typeId: Number(demon.typeId),
    rarity: demon.rarity
  }));
}

function normalizeFormationSlot(slot) {
  const number = Number(slot);
  return Number.isInteger(number) && number >= 0 && number < ACTIVE_CAPACITY ? number : null;
}

function normalizeReserveSlot(slot) {
  const number = Number(slot);
  return Number.isInteger(number) && number >= 0 && number < RESERVE_CAPACITY ? number : null;
}

function getFormationSlotPosition(slot) {
  return normalizeFormationSlot(slot) % 3 === 2 ? 'front' : 'back';
}

function cloneRoster(source = {}) {
  return {
    active: cloneDemons(source.active),
    reserve: cloneDemons(source.reserve)
  };
}

function cloneDemons(demons = []) {
  return (Array.isArray(demons) ? demons : []).map((demon) => cloneJson(demon));
}

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function errorResult(error) {
  return { ok: false, error };
}

function capitalize(value) {
  const text = String(value || '');
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
}

module.exports = {
  ACTIVE_CAPACITY,
  COMBAT_DATA_VERSION,
  DIVISIONS,
  ENDLESS_RATING_CAP_PER_RUN,
  ENDLESS_SKILL_CAP,
  FLOOR_TEN_SOUL_REWARD,
  OFFER_SIZE,
  RANKED_CARD_RARITY_COSTS,
  RANKED_REROLL_RSOUL_COST,
  RANKED_STARTING_RSOULS,
  RANKED_RULES_VERSION,
  RARITIES,
  RESERVE_CAPACITY,
  STARTING_DRAFT_PICKS,
  STARTING_LIVES,
  banishRosterDemon,
  canAcceptDemon,
  combineRoster,
  consumeReroll,
  createSnapshotPayload,
  getAvailableRerolls,
  getDivision,
  getEarlyRunRatingAdjustment,
  getFloorRatingGain,
  getFloorTenReward,
  getFormationSlotPosition,
  getNextRarity,
  getRankedActiveCapacity,
  getRarityOdds,
  getRankedCardCost,
  getRosterValidation,
  moveRosterDemon,
  normalizeFormationSlot,
  normalizeReserveSlot,
  normalizeRerolls,
  pickRarityFromOdds,
  resolveDefeat,
  shouldOfferPact
};
