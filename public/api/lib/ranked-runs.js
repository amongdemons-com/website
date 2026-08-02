const crypto = require('crypto');
const db = require('./db');
const { calculateStatBonuses, getPlayerStatPointSummary } = require('./account-stat-points');
const {
  applyPreBattleBuffs,
  canSelectRunBuff,
  generateBuffChoices,
  getCombatBuffById,
  getNonRepeatableBuffChoiceExclusions,
  NON_REPEATABLE_COMBAT_BUFF_IDS,
  normalizeCombatBuffState,
  selectRunBuff,
  serializeCombatBuffState
} = require('./combat-buffs');
const { withDemonImageVariants } = require('./demon-images');
const {
  MAX_ENEMY_MELEE_DEMONS,
  countEnemyMeleeDemons,
  getAllowedEnemyTypeIds,
  isMeleeEnemyDemon,
  isThornsDemon
} = require('./enemy-team-rules');
const { getGameCatalog } = require('./game-data');
const { createPlayerCombatBuffState } = require('./player-combat-buffs');
const { createRng } = require('./rng');
const { getFormationSlotPosition } = require('./run-demons');
const { loadWorldBosses, getWorldBossRewardBuff } = require('./world-bosses');
const { getActiveWorldRewardBuffs } = require('./world-buffs');
const {
  ACTIVE_CAPACITY,
  COMBAT_DATA_VERSION,
  ENDLESS_SKILL_CAP,
  FORMATION_CAPACITY,
  OFFER_SIZE,
  RANKED_LIFE_LOSS_RSOUL_REWARD,
  RANKED_STARTING_RSOULS,
  RANKED_RULES_VERSION,
  RANKED_VICTORY_FLOOR,
  RARITIES,
  RESERVE_CAPACITY,
  combineRoster,
  createSnapshotPayload,
  getAvailableRerolls,
  getDivision,
  getNextRarity,
  getRankedActiveCapacity,
  getRarityOdds,
  getRankedCardCost,
  getRunEndRatingDelta,
  getRosterValidation,
  normalizeReserveSlot,
  normalizeRerolls,
  pickRarityFromOdds,
  shouldOfferPact
} = require('./ranked-rules');

const GENERATED_VARIANTS_PER_FLOOR = 4;
const GENERATED_OPPONENT_COMBAT_VERSION = `${COMBAT_DATA_VERSION}:formation-pacts-v1`;
const DEFAULT_RATING = 1000;
const RANKED_NON_REPEATABLE_PACT_IDS = NON_REPEATABLE_COMBAT_BUFF_IDS;

function parseRankedRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    playerId: row.player_id,
    seasonId: row.season_id,
    seed: Number(row.seed) || 1,
    status: row.status,
    floor: Math.max(1, Number(row.floor) || 1),
    lives: Math.max(0, Number(row.lives) || 0),
    ratingStart: Number(row.rating_start) || DEFAULT_RATING,
    ratingDelta: Number(row.rating_delta) || 0,
    state: parseJson(row.state, {}),
    lockedBonuses: parseJson(row.locked_bonuses, {}),
    rulesVersion: row.rules_version || RANKED_RULES_VERSION,
    endedAt: row.ended_at || null
  };
}

async function getCurrentRankedRun(playerId, queryable = db, options = {}) {
  const [rows] = await queryable.query(
    `SELECT *
     FROM ranked_runs
     WHERE player_id = ? AND status = 'active'
     ORDER BY updated_at DESC
     LIMIT 1${options.forUpdate ? ' FOR UPDATE' : ''}`,
    [playerId]
  );
  return rows.length ? parseRankedRun(rows[0]) : null;
}

async function getRankedRun(runId, playerId, queryable = db, options = {}) {
  const [rows] = await queryable.query(
    `SELECT *
     FROM ranked_runs
     WHERE id = ? AND player_id = ?
     LIMIT 1${options.forUpdate ? ' FOR UPDATE' : ''}`,
    [runId, playerId]
  );
  return rows.length ? parseRankedRun(rows[0]) : null;
}

async function saveRankedRun(run, queryable = db) {
  await queryable.query(
    `UPDATE ranked_runs
     SET status = ?,
         floor = ?,
         lives = ?,
         rating_delta = ?,
         state = ?,
         locked_bonuses = ?,
         ended_at = ?
     WHERE id = ? AND player_id = ?`,
    [
      run.status,
      run.floor,
      run.lives,
      run.ratingDelta,
      JSON.stringify(run.state),
      JSON.stringify(run.lockedBonuses),
      run.endedAt || null,
      run.id,
      run.playerId
    ]
  );
}

async function getOrCreateCurrentSeason(queryable = db, now = new Date()) {
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  const startsAt = new Date(Date.UTC(year, startMonth, 1));
  const endsAt = new Date(Date.UTC(quarter === 4 ? year + 1 : year, quarter === 4 ? 0 : startMonth + 3, 1));
  const id = `ranked-${year}-q${quarter}`;
  const name = `${year} Season ${quarter}`;

  await queryable.query(
    `INSERT INTO ranked_seasons (id, name, starts_at, ends_at, rules_version)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       starts_at = VALUES(starts_at),
       ends_at = VALUES(ends_at),
       rules_version = VALUES(rules_version)`,
    [id, name, startsAt, endsAt, RANKED_RULES_VERSION]
  );

  return {
    id,
    name,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    rulesVersion: RANKED_RULES_VERSION
  };
}

async function getOrCreateRankedRating(playerId, seasonId, queryable = db, options = {}) {
  await queryable.query(
    `INSERT INTO ranked_ratings (player_id, season_id, rating)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE player_id = VALUES(player_id)`,
    [playerId, seasonId, DEFAULT_RATING]
  );
  return (await getRankedRating(playerId, seasonId, queryable, options)) || serializeRating();
}

async function getRankedRating(playerId, seasonId, queryable = db, options = {}) {
  const [rows] = await queryable.query(
    `SELECT *
     FROM ranked_ratings
     WHERE player_id = ? AND season_id = ?
     LIMIT 1${options.forUpdate ? ' FOR UPDATE' : ''}`,
    [playerId, seasonId]
  );
  return rows.length ? serializeRating(rows[0]) : null;
}

function serializeRating(row = {}) {
  const rating = Math.max(0, Number(row.rating) || DEFAULT_RATING);
  return {
    rating,
    division: getDivision(rating).name,
    highestFloor: Math.max(0, Number(row.highest_floor) || 0),
    victories: Math.max(0, Number(row.victories) || 0),
    runsPlayed: Math.max(0, Number(row.runs_played) || 0)
  };
}

async function createLockedRankedBonuses(player) {
  const [summary, worldBuffs] = await Promise.all([
    getPlayerStatPointSummary(player),
    getActiveWorldRewardBuffs(player)
  ]);
  const allocations = Object.fromEntries(
    Object.entries(summary.allocations || {}).map(([key, value]) => [
      key,
      key.endsWith('_mastery')
        ? Math.min(ENDLESS_SKILL_CAP, Math.max(0, Number(value) || 0))
        : Math.max(0, Number(value) || 0)
    ])
  );
  const cappedSummary = {
    ...summary,
    allocations,
    bonuses: calculateStatBonuses(allocations)
  };
  const combatState = createPlayerCombatBuffState(cappedSummary, {
    activeBuffs: worldBuffs
  });

  return {
    allocations,
    endlessCap: ENDLESS_SKILL_CAP,
    skillBonuses: cappedSummary.bonuses,
    activeBuffs: serializeCombatBuffState(combatState).activeBuffs,
    lockedAt: new Date().toISOString()
  };
}

async function createInitialRankedState(seed, runId = null) {
  const state = {
    phase: 'draft',
    active: [],
    reserve: [],
    offers: [],
    rSouls: RANKED_STARTING_RSOULS,
    offerRound: 0,
    rollCounter: 0,
    picksRemaining: 2,
    rerolls: normalizeRerolls(),
    buffs: normalizeCombatBuffState(),
    combinationEvents: [],
    handLocked: false,
    lockedHand: [],
    opponent: null,
    lastOpponentKey: null,
    lastOpponentPlayerId: null,
    lastBattle: null,
    highestClearedFloor: 0,
    victoryRewardClaimed: false,
    victoryPending: false,
    victoryRankGain: 0,
    pendingRating: 0,
    protectedRating: 0,
    floorRetryCount: 0,
    lastSnapshotId: null,
    demonIdNamespace: String(runId || Number(seed).toString(36))
  };
  const catalog = await getGameCatalog();
  const starterRng = createRng(hashSeed(`${seed}:starters`));
  const typeIds = Object.keys(catalog.types).map(Number).filter((typeId) => typeId > 0);
  const starters = [];
  for (let index = 0; index < 2; index += 1) {
    const rarity = starterRng() < 0.5 ? 'common' : 'uncommon';
    const typeId = typeIds[Math.floor(starterRng() * typeIds.length)] || typeIds[0];
    starters.push(createStandardRankedDemon(catalog, {
      typeId,
      rarity,
      instanceId: nextDemonId({ state }, 'starter')
    }));
  }
  state.active = arrangeRankedFormation(starters, 'player');
  await dealOffers({ seed, floor: 1, state }, OFFER_SIZE);
  return state;
}

async function dealOffers(run, count = OFFER_SIZE) {
  const catalog = await getGameCatalog();
  run.state.offerRound = Math.max(0, Number(run.state.offerRound) || 0) + 1;
  const rng = createRng(hashSeed(`${run.seed}:offer:${run.floor}:${run.state.offerRound}`));
  const rarityOdds = getRarityOdds(run.floor);
  run.state.offers = [];

  for (let index = 0; index < count; index += 1) {
    const rarity = pickRarityFromOdds(rng, rarityOdds);
    const typeIds = Object.keys(catalog.types).map(Number);
    const typeId = typeIds[Math.floor(rng() * typeIds.length)] || typeIds[0];
    const instanceId = nextDemonId(run, 'offer');
    run.state.offers.push({
      offerId: crypto.randomUUID(),
      demon: createStandardRankedDemon(catalog, { typeId, rarity, instanceId }),
      cost: getRankedCardCost({ rarity }),
      purchased: false
    });
  }

  run.state.rerolls = normalizeRerolls(run.state.rerolls);
  return run.state.offers;
}

function createStandardRankedDemon(catalog, options) {
  const typeId = Number(options.typeId);
  const type = catalog.types[String(typeId)];
  if (!type) throw new Error('Ranked demon type not found.');
  const requestedRarity = String(options.rarity || 'common').toLowerCase();
  const asset = catalog.demons.find((candidate) => (
    Number(candidate.type) === typeId && candidate.rarity === requestedRarity
  )) || catalog.demons.find((candidate) => Number(candidate.type) === typeId);
  if (!asset) throw new Error('Ranked demon asset not found.');
  const multiplier = Number(type.rarityMultiplier?.[asset.rarity]) || 1;
  const hp = midpointStat(type.baseStats?.hp, multiplier);
  const atk = midpointStat(type.baseStats?.atk, multiplier);
  const speed = midpointStat(type.baseStats?.speed, multiplier);
  const preferredPosition = type.preferredPosition === 'back' ? 'back' : 'front';

  return withDemonImageVariants({
    instanceId: options.instanceId,
    sourceDemonId: asset.id,
    typeId,
    species: type.name,
    role: type.role,
    targeting: type.targeting,
    preferredPosition,
    rarity: asset.rarity,
    imageUrl: asset.image_url,
    maxHp: hp,
    hp,
    atk,
    speed,
    position: preferredPosition,
    attackMeter: 0,
    ranked: true
  });
}

async function addDemonAndCombine(run, demon, destination = null) {
  const catalog = await getGameCatalog();
  const target = destination || (
    run.state.active.length < ACTIVE_CAPACITY ? 'active' : 'reserve'
  );
  if (target === 'active') {
    const used = new Set(run.state.active.map((item) => Number(item.formationSlot)));
    const formationSlot = Array.from({ length: FORMATION_CAPACITY }, (_, index) => index)
      .find((slot) => !used.has(slot));
    run.state.active.push({
      ...demon,
      formationSlot,
      position: formationSlot % 3 === 2 ? 'front' : 'back'
    });
  } else {
    const used = new Set(
      run.state.reserve.map((item, index) => normalizeReserveSlot(item.reserveSlot) ?? index)
    );
    const reserveSlot = Array.from({ length: RESERVE_CAPACITY }, (_, index) => index)
      .find((slot) => !used.has(slot));
    run.state.reserve.push({ ...demon, reserveSlot });
  }

  const combined = combineRoster(run.state, ({ typeId, rarity, destination: combinedDestination }) => (
    createStandardRankedDemon(catalog, {
      typeId,
      rarity,
      instanceId: nextDemonId(run, `combine-${combinedDestination}`)
    })
  ));
  run.state.active = combined.active;
  run.state.reserve = combined.reserve;
  run.state.combinationEvents = combined.events;
  return combined.events;
}

async function applyRankedWorkspace(run, lineup, options = {}) {
  const state = run.state || {};
  if (!['draft', 'selection', 'preparation'].includes(state.phase)) {
    throw createWorkspaceError('The Ranked lineup cannot be changed right now.');
  }

  const requestedActive = Array.isArray(lineup?.active) ? lineup.active : [];
  const requestedReserve = Array.isArray(lineup?.reserve) ? lineup.reserve : [];
  const requestedHand = Array.isArray(lineup?.hand) ? lineup.hand : [];
  const requestedSold = Array.isArray(lineup?.sold) ? lineup.sold : [];
  const floor = Math.max(1, Number(run.floor) || 1);
  const activeCapacity = getRankedActiveCapacity(floor);
  if (requestedActive.length > activeCapacity) {
    throw createWorkspaceError(`Active formation exceeds the Floor ${floor} limit of ${activeCapacity} demons.`);
  }
  if (requestedReserve.length > RESERVE_CAPACITY) {
    throw createWorkspaceError(`Reserve exceeds ${RESERVE_CAPACITY} demons.`);
  }

  const rosterDemons = [...(state.active || []), ...(state.reserve || [])];
  const offerDemons = (state.offers || []).map((offer) => offer.demon);
  const offersByInstanceId = new Map(
    (state.offers || []).map((offer) => [String(offer.demon?.instanceId || ''), offer])
  );
  const knownDemons = new Map(
    [...rosterDemons, ...offerDemons].map((demon) => [String(demon.instanceId), demon])
  );
  const offerIds = new Set(offerDemons.map((demon) => String(demon.instanceId)));
  const offersByOfferId = new Map(
    (state.offers || []).map((offer) => [String(offer.offerId || ''), offer])
  );
  const stagedPurchaseOfferIds = new Set(
    (Array.isArray(lineup?.purchasedOfferIds) ? lineup.purchasedOfferIds : [])
      .map((offerId) => String(offerId || ''))
      .filter(Boolean)
  );
  if (
    stagedPurchaseOfferIds.size
    !== (Array.isArray(lineup?.purchasedOfferIds) ? lineup.purchasedOfferIds.length : 0)
    || [...stagedPurchaseOfferIds].some((offerId) => !offersByOfferId.has(offerId))
  ) {
    throw createWorkspaceError('The lineup contains an invalid staged purchase.');
  }
  const automaticallySoldHand = options.autoSellPurchasedHand
    ? requestedHand.filter((entry) => isOwnedRankedHandReference(
      entry,
      offersByInstanceId,
      stagedPurchaseOfferIds
    ))
    : [];
  const automaticallySoldIds = new Set(
    automaticallySoldHand
      .map((entry) => String(entry?.instanceId || ''))
      .filter(Boolean)
  );
  const retainedRequestedHand = requestedHand.filter((entry) => (
    !automaticallySoldIds.has(String(entry?.instanceId || ''))
    && !automaticallySoldHand.includes(entry)
  ));
  const rosterIds = new Set(rosterDemons.map((demon) => String(demon.instanceId)));
  const usedIds = new Set();
  const usedSlots = new Set();
  const usedReserveSlots = new Set();
  const combinationEvents = [];
  const catalog = await getGameCatalog();
  let nextWorkspaceRollCounter = Math.max(0, Number(state.rollCounter) || 0);

  function resolveWorkspaceDemon(entry, destination, depth = 0) {
    if (entry?.combination) {
      const sources = Array.isArray(entry.combination.sources)
        ? entry.combination.sources
        : [];
      if (depth >= 6 || sources.length !== 3) {
        throw createWorkspaceError('The lineup contains an invalid combination.');
      }
      const resolvedSources = sources.map((source) => (
        resolveWorkspaceDemon(source, destination === 'hand' ? 'hand-combination' : destination, depth + 1)
      ));
      const first = resolvedSources[0]?.demon;
      const typeId = Number(first?.typeId);
      const fromRarity = String(first?.rarity || '').toLowerCase();
      const toRarity = getNextRarity(fromRarity);
      if (
        !typeId
        || !toRarity
        || resolvedSources.some(({ demon }) => (
          Number(demon?.typeId) !== typeId
          || String(demon?.rarity || '').toLowerCase() !== fromRarity
        ))
      ) {
        throw createWorkspaceError('Only three identical demons can be combined.');
      }

      nextWorkspaceRollCounter += 1;
      const upgraded = createStandardRankedDemon(catalog, {
        typeId,
        rarity: toRarity,
        instanceId: `ranked-combine-${destination}-${nextWorkspaceRollCounter}`
      });
      const sourceInstanceIds = resolvedSources.flatMap((source) => source.sourceInstanceIds);
      combinationEvents.push({
        type: 'combine',
        typeId,
        fromRarity,
        toRarity,
        consumedInstanceIds: resolvedSources.map(({ demon }) => demon.instanceId),
        sourceInstanceIds,
        resultInstanceId: upgraded.instanceId,
        destination,
        deferredPreview: true
      });
      return { demon: upgraded, sourceInstanceIds };
    }

    const instanceId = String(entry?.instanceId || '');
    if (!instanceId || !knownDemons.has(instanceId)) {
      throw createWorkspaceError('The lineup contains an unknown demon.');
    }
    if (usedIds.has(instanceId)) {
      throw createWorkspaceError('The lineup contains a duplicate demon.');
    }
    const offer = offersByInstanceId.get(instanceId);
    if (
      offer
      && !offer.purchased
      && !stagedPurchaseOfferIds.has(String(offer.offerId || ''))
      && destination === 'hand-combination'
    ) {
      throw createWorkspaceError('Stage Hand cards as purchased before combining them.');
    }
    if (
      offer
      && !offer.purchased
      && !stagedPurchaseOfferIds.has(String(offer.offerId || ''))
      && destination !== 'hand'
      && destination !== 'hand-combination'
    ) {
      throw createWorkspaceError('Stage Hand cards as purchased before adding them to your lineup.');
    }
    usedIds.add(instanceId);
    return {
      demon: cloneJson(knownDemons.get(instanceId)),
      sourceInstanceIds: [instanceId]
    };
  }

  const active = requestedActive.map((entry) => {
    const formationSlot = Number(entry?.formationSlot);
    if (!Number.isInteger(formationSlot) || formationSlot < 0 || formationSlot >= FORMATION_CAPACITY) {
      throw createWorkspaceError('The lineup contains an invalid formation slot.');
    }
    if (usedSlots.has(formationSlot)) {
      throw createWorkspaceError('The lineup contains a duplicate formation slot.');
    }
    usedSlots.add(formationSlot);
    const { demon } = resolveWorkspaceDemon(entry, 'active');
    return {
      ...demon,
      formationSlot,
      position: formationSlot % 3 === 2 ? 'front' : 'back'
    };
  });

  const reserve = requestedReserve.map((entry, index) => {
    const reserveSlot = normalizeReserveSlot(typeof entry === 'string' ? index : (entry?.reserveSlot ?? index));
    if (reserveSlot === null) {
      throw createWorkspaceError('The lineup contains an invalid reserve slot.');
    }
    if (usedReserveSlots.has(reserveSlot)) {
      throw createWorkspaceError('The lineup contains a duplicate reserve slot.');
    }
    usedReserveSlots.add(reserveSlot);
    const reference = typeof entry === 'string' ? { instanceId: entry } : entry;
    const { demon } = resolveWorkspaceDemon(reference, 'reserve');
    delete demon.formationSlot;
    demon.reserveSlot = reserveSlot;
    demon.position = demon.preferredPosition === 'back' ? 'back' : 'front';
    return demon;
  });

  const sold = [...requestedSold, ...automaticallySoldHand]
    .map((entry) => resolveWorkspaceDemon(entry, 'sold').demon);

  const lockedHand = options.preserveHand
    ? retainedRequestedHand.map((entry) => {
      const resolved = resolveWorkspaceDemon(entry, 'hand');
      const directOffer = resolved.sourceInstanceIds.length === 1
        ? offersByInstanceId.get(String(resolved.sourceInstanceIds[0]))
        : null;
      const directOfferId = String(directOffer?.offerId || '');
      const purchased = directOffer
        ? Boolean(directOffer.purchased || stagedPurchaseOfferIds.has(directOfferId))
        : true;
      const demon = resolved.demon;
      delete demon.formationSlot;
      delete demon.reserveSlot;
      demon.position = demon.preferredPosition === 'back' ? 'back' : 'front';
      return {
        offerId: directOfferId || crypto.randomUUID(),
        demon,
        cost: getRankedCardCost(demon),
        purchased
      };
    })
    : [];

  if (options.requireActive !== false && active.length < 1) {
    throw createWorkspaceError('At least one active demon is required.');
  }

  const selectedOfferCount = [...usedIds].filter((instanceId) => offerIds.has(instanceId)).length;
  const picksRemaining = Math.max(0, Number(state.picksRemaining) || 0);
  const purchaseCost = [...stagedPurchaseOfferIds]
    .map((offerId) => offersByOfferId.get(offerId))
    .filter((offer) => offer && !offer.purchased)
    .reduce((sum, offer) => sum + getRankedCardCost(offer.demon), 0);
  const saleCredit = sold.reduce(
    (sum, demon) => sum + Math.ceil(getRankedCardCost(demon) / 2),
    0
  );
  const additionalCost = Math.max(0, Math.floor(Number(options.additionalRSoulCost) || 0));
  const totalCost = purchaseCost + additionalCost;
  const balanceBefore = getRankedSoulBalance(run);
  if (balanceBefore + saleCredit < totalCost) {
    throw createWorkspaceError(`This action costs ${totalCost - saleCredit} rSouls after sales.`);
  }

  const combined = combineRoster({ active, reserve }, ({ typeId, rarity, destination }) => {
    nextWorkspaceRollCounter += 1;
    return createStandardRankedDemon(catalog, {
      typeId,
      rarity,
      instanceId: `ranked-combine-${destination}-${nextWorkspaceRollCounter}`
    });
  });
  state.rollCounter = nextWorkspaceRollCounter;
  state.rSouls = balanceBefore + saleCredit - totalCost;
  state.active = combined.active;
  state.reserve = combined.reserve;
  state.picksRemaining = Math.max(0, picksRemaining - selectedOfferCount);
  state.offers = [];
  state.handLocked = Boolean(options.preserveHand && lockedHand.length);
  state.lockedHand = lockedHand;
  state.combinationEvents = [...combinationEvents, ...combined.events];

  return {
    selectedOfferCount,
    purchaseCost,
    saleCredit,
    soldCount: sold.length,
    additionalCost,
    totalCost,
    rSoulBalance: state.rSouls,
    discardedRosterCount: [...rosterIds].filter((instanceId) => !usedIds.has(instanceId)).length,
    combinationEvents: state.combinationEvents
  };
}

function getRankedSoulBalance(run) {
  const value = Number(run?.state?.rSouls);
  return Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : RANKED_STARTING_RSOULS;
}

function isOwnedRankedHandReference(entry, offersByInstanceId, stagedPurchaseOfferIds) {
  if (entry?.combination) return true;
  const offer = offersByInstanceId.get(String(entry?.instanceId || ''));
  if (!offer) return true;
  return Boolean(
    offer.purchased
    || stagedPurchaseOfferIds.has(String(offer.offerId || ''))
  );
}

function spendRankedSouls(run, cost) {
  const normalizedCost = Math.max(0, Math.floor(Number(cost) || 0));
  const balance = getRankedSoulBalance(run);
  if (balance < normalizedCost) {
    throw createWorkspaceError(`This action costs ${normalizedCost} rSouls.`);
  }
  run.state.rSouls = balance - normalizedCost;
  return run.state.rSouls;
}

function awardRankedSoulInterest(run) {
  const balanceBefore = getRankedSoulBalance(run);
  const earned = Math.max(1, Math.floor(Number(run?.floor) || 1))
    + Math.floor(balanceBefore / 10);

  return awardRankedSouls(run, earned);
}

function awardRankedSoulLifeLoss(run) {
  return awardRankedSouls(run, RANKED_LIFE_LOSS_RSOUL_REWARD);
}

function awardRankedSouls(run, amount) {
  const balanceBefore = getRankedSoulBalance(run);
  const earned = Math.max(0, Math.floor(Number(amount) || 0));
  run.state.rSouls = balanceBefore + earned;
  return {
    earned,
    balanceBefore,
    balance: run.state.rSouls
  };
}

function prepareNextSelection(run) {
  const reuseLockedHand = Boolean(run.state.handLocked && Array.isArray(run.state.lockedHand));
  run.state.phase = 'selection';
  run.state.offers = reuseLockedHand ? cloneJson(run.state.lockedHand) : [];
  // A lock carries the current Hand for exactly one floor. The reused cards
  // remain in the Hand, but the player must opt in again to carry them farther.
  run.state.handLocked = false;
  run.state.lockedHand = [];
  run.state.picksRemaining = 1;
  run.state.rerolls = normalizeRerolls();
  run.state.opponent = null;
  run.state.victoryPending = false;
  return reuseLockedHand;
}

async function advanceRankedFloor(run, options = {}) {
  const clearedFloor = Math.max(1, Number(run.floor) || 1);
  run.floor = clearedFloor + 1;
  run.state.floorRetryCount = 0;
  const reusedLockedHand = prepareNextSelection(run);
  if (!reusedLockedHand) {
    await dealOffers(run);
  }
  if (options.offerPact && shouldOfferPact(clearedFloor, run.state.buffs?.active?.length)) {
    generateBuffChoices(
      run,
      createRng((Number(run.seed) + Number(run.floor) * 1597334677 + 991) >>> 0),
      3,
      { excludeIds: getRankedPactChoiceExclusions(run) }
    );
  }
  return {
    clearedFloor,
    reusedLockedHand
  };
}

function prepareForFight(run) {
  run.state.phase = 'preparation';
  run.state.offers = [];
  run.state.picksRemaining = 0;
  run.state.rerolls = normalizeRerolls();
  run.state.opponent = null;
  resetTeamForBattle(run.state.active);
}

function resetTeamForBattle(team = []) {
  team.forEach((demon) => {
    demon.hp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
    demon.attackMeter = 0;
    demon.shield = 0;
    demon.statusEffects = { poison: [] };
  });
}

async function serializeRankedRun(run, rating, season) {
  const state = run.state || {};
  const rosterValidation = getRosterValidation(state, { requireActive: false });
  const rawCurrentRating = Number(rating?.rating);
  const currentRating = Math.max(
    0,
    Number.isFinite(rawCurrentRating) ? rawCurrentRating : DEFAULT_RATING
  );
  const pendingRating = Math.max(0, Number(state.pendingRating) || 0);
  const projectedRating = Math.max(0, currentRating + pendingRating);
  const runDelta = Number(run.ratingDelta) || 0;
  const endDelta = run.status === 'active'
    ? getRunEndRatingDelta(run.floor, pendingRating)
    : 0;
  const pacts = serializeCombatBuffState(state.buffs || {});
  const previewStats = await createRankedPreviewStats(run);

  return {
    runId: run.id,
    status: run.status,
    phase: state.phase,
    season,
    floor: run.floor,
    endReason: state.endReason || null,
    endReachedFloor: Math.max(1, Number(state.endReachedFloor) || Number(run.floor) || 1),
    rSouls: getRankedSoulBalance(run),
    highestClearedFloor: Math.max(0, Number(state.highestClearedFloor) || 0),
    lives: run.lives,
    active: state.active || [],
    team: state.active || [],
    reserve: state.reserve || [],
    enemies: state.opponent?.team || state.lastBattle?.enemyTeamAfter || [],
    opponent: state.opponent ? {
      id: state.opponent.id,
      hunterName: state.opponent.generated ? null : state.opponent.hunterName,
      generated: Boolean(state.opponent.generated),
      division: state.opponent.division,
      rating: state.opponent.rating
    } : null,
    offers: (state.offers || []).map((offer) => ({
      ...offer,
      cost: getRankedCardCost(offer.demon)
    })),
    picksRemaining: Math.max(0, Number(state.picksRemaining) || 0),
    handLocked: Boolean(state.handLocked),
    rarityOdds: getRarityOdds(run.floor),
    rerolls: {
      ...normalizeRerolls(state.rerolls),
      available: getAvailableRerolls(state.rerolls)
    },
    pacts,
    previewStats,
    pendingPact: pacts.pendingChoices.length > 0,
    lockedBonuses: run.lockedBonuses,
    combinationEvents: state.combinationEvents || [],
    lastBattle: state.lastBattle || null,
    rating: {
      ...rating,
      projected: projectedRating,
      runDelta,
      pending: pendingRating,
      endDelta,
      projectedEnd: Math.max(0, currentRating + endDelta),
      projectedRunDelta: runDelta + endDelta
    },
    capacities: {
      active: getRankedActiveCapacity(run.floor),
      reserve: RESERVE_CAPACITY
    },
    canFight: run.status === 'active'
      && ['draft', 'selection', 'preparation'].includes(state.phase)
      && !pacts.pendingChoices.length
      && state.active.length <= getRankedActiveCapacity(run.floor)
      && getRosterValidation(state, { requireActive: false }).valid,
    rosterValid: rosterValidation.valid,
    rosterErrors: rosterValidation.errors,
    victoryRewardClaimed: Boolean(state.victoryRewardClaimed),
    awaitingVictoryChoice: Boolean(state.victoryPending),
    victoryRankGain: Math.max(0, Number(state.victoryRankGain) || 0),
    rulesVersion: run.rulesVersion,
    combatVersion: COMBAT_DATA_VERSION
  };
}

async function createRankedPreviewStats(run) {
  const state = run.state || {};
  const typeIds = new Set([
    ...(state.active || []),
    ...(state.reserve || []),
    ...(state.offers || []).map((offer) => offer?.demon)
  ].map((demon) => Number(demon?.typeId)).filter((typeId) => typeId > 0));
  if (!typeIds.size) return {};

  const catalog = await getGameCatalog();
  const buffs = getPlayerBattleBuffs(run);
  const previews = {};
  typeIds.forEach((typeId) => {
    RARITIES.forEach((rarity) => {
      const base = createStandardRankedDemon(catalog, {
        typeId,
        rarity,
        instanceId: `ranked-preview-${typeId}-${rarity}`
      });
      const preview = applyPreBattleBuffs([base], buffs)[0];
      previews[`${typeId}:${rarity}`] = {
        maxHp: preview.maxHp,
        hp: preview.maxHp,
        atk: preview.atk,
        speed: preview.speed,
        ...(Number.isFinite(Number(preview.effectiveAtk))
          ? { effectiveAtk: preview.effectiveAtk }
          : {}),
        battleBuffs: preview.battleBuffs || {}
      };
    });
  });
  return previews;
}

async function saveReadySnapshot(run, rating, username, queryable = db) {
  const validation = getRosterValidation(run.state);
  if (run.status !== 'active' || run.state.phase !== 'preparation' || !validation.valid) return null;
  if (serializeCombatBuffState(run.state.buffs).pendingChoices.length) return null;
  if (countEnemyMeleeDemons(run.state.active) > MAX_ENEMY_MELEE_DEMONS) return null;
  const catalog = await getGameCatalog();
  const id = crypto.randomUUID();
  const snapshot = createSnapshotPayload(run, {
    rating: rating.rating,
    combatVersion: COMBAT_DATA_VERSION,
    gameDataVersion: catalog.version
  });

  await queryable.query(
    `INSERT INTO ranked_opponent_snapshots
       (id, player_id, season_id, floor, rating, hunter_name, snapshot, combat_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      run.playerId,
      run.seasonId,
      run.floor,
      rating.rating,
      username,
      JSON.stringify(snapshot),
      COMBAT_DATA_VERSION
    ]
  );
  run.state.lastSnapshotId = id;
  return id;
}

async function selectOpponent(run, rating, queryable = db) {
  const policy = getRankedMatchmakingPolicy(run, rating);
  const [rows] = await queryable.query(
    `SELECT snapshots.*,
            history.opponent_key AS previously_served
     FROM ranked_opponent_snapshots snapshots
     LEFT JOIN (
       SELECT DISTINCT opponent_key
       FROM ranked_opponent_history
       WHERE player_id = ? AND season_id = ? AND floor = ?
     ) history ON history.opponent_key = snapshots.id
     WHERE snapshots.season_id = ?
       AND snapshots.floor = ?
       AND snapshots.player_id <> ?
       AND snapshots.combat_version = ?
       AND snapshots.created_at < CURRENT_TIMESTAMP
       AND snapshots.id = (
         SELECT latest.id
         FROM ranked_opponent_snapshots latest
         WHERE latest.season_id = snapshots.season_id
           AND latest.floor = snapshots.floor
           AND latest.player_id = snapshots.player_id
           AND latest.combat_version = snapshots.combat_version
           AND latest.created_at < CURRENT_TIMESTAMP
         ORDER BY latest.created_at DESC, latest.id DESC
         LIMIT 1
       )
       AND (? = 1 OR snapshots.rating BETWEEN ? AND ?)
     ORDER BY history.opponent_key IS NULL DESC,
              CASE WHEN ? = 0 THEN ABS(snapshots.rating - ?) ELSE 0 END ASC,
              snapshots.created_at DESC
     LIMIT 100`,
    [
      run.playerId,
      run.seasonId,
      policy.floor,
      run.seasonId,
      policy.floor,
      run.playerId,
      COMBAT_DATA_VERSION,
      policy.endless ? 1 : 0,
      policy.minRating,
      policy.maxRating,
      policy.endless ? 1 : 0,
      policy.rating
    ]
  );

  const eligibleSnapshots = deduplicatePlayerSnapshots(rows
    .map((row) => ({ row, snapshot: parseJson(row.snapshot, {}) }))
    .filter(({ snapshot }) => (
      countEnemyMeleeDemons(snapshot.team || []) <= MAX_ENEMY_MELEE_DEMONS
    )))
    .filter(({ row }) => !isImmediatePlayerRepeat(row, run.state));

  let opponent;
  if (eligibleSnapshots.length) {
    const retryCount = Math.max(0, Number(run.state.floorRetryCount) || 0);
    const rng = createRng(hashSeed(`${run.seed}:opponent:${run.floor}:${retryCount}`));
    const unseen = eligibleSnapshots.filter(({ row }) => !row.previously_served);
    const pool = unseen.length ? unseen : eligibleSnapshots;
    const selectionSize = policy.endless ? pool.length : Math.min(pool.length, 5);
    const selected = pool[Math.floor(rng() * selectionSize)] || pool[0];
    const { row, snapshot } = selected;
    opponent = {
      id: row.id,
      playerId: row.player_id,
      hunterName: row.hunter_name,
      generated: false,
      rating: Number(row.rating) || rating.rating,
      division: getDivision(row.rating).name,
      team: prepareOpponentTeam(snapshot.team || []),
      buffs: mergeSnapshotBuffs(snapshot),
      skillTree: getSnapshotSkillTreeSummary(snapshot)
    };
  } else {
    opponent = await selectGeneratedOpponent(run, rating, queryable, {
      excludeOpponentKey: run.state.lastOpponentKey
    });
  }
  if (opponent.generated) {
    opponent.team = empowerEndlessGhostTeam(opponent.team, run.floor);
  }

  await queryable.query(
    `INSERT INTO ranked_opponent_history
       (player_id, season_id, opponent_key, floor)
     VALUES (?, ?, ?, ?)`,
    [run.playerId, run.seasonId, opponent.id, run.floor]
  );
  run.state.opponent = opponent;
  run.state.lastOpponentKey = opponent.id;
  run.state.lastOpponentPlayerId = opponent.generated ? null : opponent.playerId;
  return opponent;
}

function getRankedMatchmakingPolicy(run, rating) {
  const floor = Math.max(1, Number(run?.floor) || 1);
  const rawRating = Number(rating?.rating);
  const currentRating = Number.isFinite(rawRating) ? Math.max(0, rawRating) : DEFAULT_RATING;
  const endless = floor > RANKED_VICTORY_FLOOR;
  return {
    floor,
    endless,
    rating: currentRating,
    minRating: Math.max(0, currentRating - 300),
    maxRating: currentRating + 300
  };
}

function deduplicatePlayerSnapshots(candidates = []) {
  const seenPlayerIds = new Set();
  return candidates.filter(({ row }) => {
    const playerId = String(row?.player_id || '');
    if (!playerId || seenPlayerIds.has(playerId)) return false;
    seenPlayerIds.add(playerId);
    return true;
  });
}

function isImmediatePlayerRepeat(row, state = {}) {
  const previousPlayerId = String(state.lastOpponentPlayerId || '');
  if (previousPlayerId) return String(row?.player_id || '') === previousPlayerId;
  return String(row?.id || '') === String(state.lastOpponentKey || '');
}

async function selectGeneratedOpponent(run, rating, queryable = db, options = {}) {
  const bracket = Math.round(rating.rating / 200) * 200;
  await ensureGeneratedOpponents(run.seasonId, run.floor, bracket, queryable);
  const [rows] = await queryable.query(
    `SELECT generated.*,
            history.opponent_key AS previously_served
     FROM ranked_generated_opponents generated
     LEFT JOIN (
       SELECT opponent_key
       FROM ranked_opponent_history
       WHERE player_id = ? AND season_id = ? AND floor = ?
     ) history ON history.opponent_key = generated.id
     WHERE generated.season_id = ?
       AND generated.floor = ?
       AND generated.rating_bracket = ?
       AND generated.combat_version = ?
     ORDER BY history.opponent_key IS NULL DESC, generated.variant ASC`,
    [run.playerId, run.seasonId, run.floor, run.seasonId, run.floor, bracket, GENERATED_OPPONENT_COMBAT_VERSION]
  );
  const nonRepeating = rows.filter((row) => (
    String(row.id) !== String(options.excludeOpponentKey || '')
  ));
  const candidates = nonRepeating.length ? nonRepeating : rows;
  const unseen = candidates.filter((row) => !row.previously_served);
  const pool = unseen.length ? unseen : candidates;
  const retryCount = Math.max(0, Number(run.state.floorRetryCount) || 0);
  const index = hashSeed(`${run.seed}:generated:${run.floor}:${retryCount}`) % Math.max(1, pool.length);
  const row = pool[index] || rows[0];
  const snapshot = parseJson(row.snapshot, {});
  return {
    id: row.id,
    hunterName: null,
    generated: true,
    rating: bracket,
    division: getDivision(bracket).name,
    team: prepareOpponentTeam(snapshot.team || []),
    buffs: mergeSnapshotBuffs(snapshot),
    skillTree: getSnapshotSkillTreeSummary(snapshot)
  };
}

async function ensureGeneratedOpponents(seasonId, floor, ratingBracket, queryable = db) {
  const [existing] = await queryable.query(
    `SELECT variant, combat_version
     FROM ranked_generated_opponents
     WHERE season_id = ? AND floor = ? AND rating_bracket = ?`,
    [seasonId, floor, ratingBracket]
  );
  const versionsByVariant = new Map(
    existing.map((row) => [Number(row.variant), String(row.combat_version || '')])
  );
  for (let variant = 0; variant < GENERATED_VARIANTS_PER_FLOOR; variant += 1) {
    if (versionsByVariant.get(variant) === GENERATED_OPPONENT_COMBAT_VERSION) continue;
    const snapshot = await createGeneratedSnapshot(seasonId, floor, ratingBracket, variant);
    await queryable.query(
      `INSERT INTO ranked_generated_opponents
         (id, season_id, floor, rating_bracket, variant, snapshot, combat_version)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         snapshot = VALUES(snapshot),
         combat_version = VALUES(combat_version)`,
      [
        crypto.randomUUID(),
        seasonId,
        floor,
        ratingBracket,
        variant,
        JSON.stringify(snapshot),
        GENERATED_OPPONENT_COMBAT_VERSION
      ]
    );
  }
}

async function createGeneratedSnapshot(seasonId, floor, ratingBracket, variant) {
  const catalog = await getGameCatalog();
  const seed = hashSeed(`${seasonId}:${floor}:${ratingBracket}:${variant}`);
  const rng = createRng(seed);
  const run = {
    seed,
    floor,
    state: { active: [], reserve: [], rollCounter: 0 }
  };
  const draftCount = Math.min(28, 2 + Math.max(1, floor) * 2);
  for (let index = 0; index < draftCount; index += 1) {
    const typeIds = Object.keys(catalog.types).map(Number);
    const generatedRoster = [...run.state.active, ...run.state.reserve];
    const availableTypeIds = getAllowedEnemyTypeIds(typeIds, generatedRoster, catalog.types);
    const typeId = availableTypeIds[Math.floor(rng() * availableTypeIds.length)] || availableTypeIds[0];
    const rarity = pickRarityFromOdds(rng, getRarityOdds(Math.max(1, Math.ceil((index + 1) / 2))));
    const demon = createStandardRankedDemon(catalog, {
      typeId,
      rarity,
      instanceId: `generated-${variant}-${index + 1}`
    });
    if (run.state.active.length < ACTIVE_CAPACITY) {
      demon.formationSlot = run.state.active.length;
      demon.position = demon.formationSlot % 3 === 2 ? 'front' : 'back';
      run.state.active.push(demon);
    } else if (run.state.reserve.length < RESERVE_CAPACITY) {
      run.state.reserve.push(demon);
    } else {
      run.state.reserve.shift();
      run.state.reserve.push(demon);
    }
    const combined = combineRoster(run.state, ({ typeId: upgradeType, rarity: upgradeRarity, destination }) => (
      createStandardRankedDemon(catalog, {
        typeId: upgradeType,
        rarity: upgradeRarity,
        instanceId: `generated-${variant}-combine-${index + 1}-${destination}`
      })
    ));
    run.state.active = combined.active;
    run.state.reserve = combined.reserve;
  }

  const desiredTeamSize = getRankedActiveCapacity(floor);
  const generatedRoster = [...run.state.active, ...run.state.reserve];
  while (generatedRoster.length < desiredTeamSize) {
    const fillIndex = generatedRoster.length;
    const typeIds = Object.keys(catalog.types).map(Number);
    const availableTypeIds = getAllowedEnemyTypeIds(typeIds, generatedRoster, catalog.types);
    const typeId = availableTypeIds[Math.floor(rng() * availableTypeIds.length)] || availableTypeIds[0];
    generatedRoster.push(createStandardRankedDemon(catalog, {
      typeId,
      rarity: pickRarityFromOdds(rng, getRarityOdds(floor)),
      instanceId: `generated-${variant}-fill-${fillIndex + 1}`
    }));
  }
  run.state.active = arrangeRankedFormation(
    orderRankedGhostTeam(generatedRoster.slice(0, desiredTeamSize), catalog.types),
    'player'
  );
  resetTeamForBattle(run.state.active);
  const buffs = createGeneratedPacts(seed, floor, run.state.active, catalog.types);
  const lockedBonuses = createGeneratedLockedBonuses(floor, ratingBracket, variant);

  return {
    snapshotVersion: RANKED_RULES_VERSION,
    combatVersion: COMBAT_DATA_VERSION,
    gameDataVersion: catalog.version,
    seasonId,
    floor,
    rating: ratingBracket,
    division: getDivision(ratingBracket).name,
    generated: true,
    team: run.state.active,
    pacts: serializeCombatBuffState(buffs),
    lockedBuffs: lockedBonuses,
    deterministic: {
      runSeed: seed,
      floorSeed: (seed + Number(floor)) >>> 0,
      rulesVersion: RANKED_RULES_VERSION
    }
  };
}

function createGeneratedPacts(seed, floor, team = [], demonTypes = {}) {
  const simulated = { floor: 0, state: { buffs: normalizeCombatBuffState() } };
  for (let depth = 1; depth <= floor; depth += 1) {
    simulated.floor = depth;
    if (!shouldOfferPact(depth, simulated.state.buffs.active.length)) continue;
    generateBuffChoices(
      simulated,
      createRng(hashSeed(`${seed}:pact:${depth}`)),
      3,
      { excludeIds: getRankedPactChoiceExclusions(simulated) }
    );
    const choices = simulated.state.buffs.pendingChoices;
    const selectedPact = selectGeneratedPactForFormation(choices, team, demonTypes);
    if (selectedPact) selectRunBuff(simulated, selectedPact);
  }
  return simulated.state.buffs;
}

function selectGeneratedPactForFormation(choices, team, demonTypes = {}) {
  return (Array.isArray(choices) ? choices : []).reduce((best, pactId) => {
    const score = scoreGeneratedPactForFormation(pactId, team, demonTypes);
    return !best || score > best.score ? { pactId, score } : best;
  }, null)?.pactId || null;
}

function scoreGeneratedPactForFormation(pactOrId, team, demonTypes = {}) {
  const pact = typeof pactOrId === 'string' ? getCombatBuffById(pactOrId) : pactOrId;
  const formation = (Array.isArray(team) ? team : []).filter(Boolean);
  if (!pact || !formation.length) return 0;

  return (Array.isArray(pact.effects) ? pact.effects : []).reduce((score, effect) => {
    const targetRarities = new Set(
      (Array.isArray(effect?.targetRarities) ? effect.targetRarities : [])
        .map((rarity) => String(rarity).toLowerCase())
    );
    const eligible = targetRarities.size
      ? formation.filter((demon) => targetRarities.has(String(demon.rarity || '').toLowerCase()))
      : formation;
    if (!eligible.length) return score;

    const profiles = eligible.map((demon) => getGeneratedDemonProfile(demon, demonTypes));
    const allProfiles = formation.map((demon) => getGeneratedDemonProfile(demon, demonTypes));
    const effectType = String(effect?.type || '');
    let affinity = 0;

    if (['direct_damage_mult', 'damage_vs_low_hp_mult', 'damage_vs_higher_max_hp_mult'].includes(effectType)) {
      affinity = profiles.filter((profile) => profile.singleTarget).length;
    } else if (effectType === 'direct_damage_vs_poisoned_mult') {
      const poisoners = allProfiles.filter((profile) => profile.poison).length;
      affinity = poisoners
        ? profiles.filter((profile) => profile.singleTarget).length + poisoners * 0.5
        : 0;
    } else if (effectType === 'aoe_damage_mult') {
      affinity = profiles.filter((profile) => profile.aoe).length;
    } else if (['poison_tick_damage_mult', 'poison_duration_mult'].includes(effectType)) {
      affinity = profiles.filter((profile) => profile.poison).length;
    } else if (effectType === 'retaliation_damage_mult') {
      affinity = profiles.filter((profile) => profile.retaliation).length;
    } else if (['healing_mult', 'overheal_to_shield'].includes(effectType)) {
      affinity = profiles.filter((profile) => profile.healer).length;
    } else if (effectType === 'max_hp_mult') {
      affinity = profiles.reduce((total, profile) => total + (profile.front ? 1.35 : 0.75), 0);
    } else if (effectType === 'speed_mult') {
      affinity = profiles.reduce((total, profile) => total + (profile.front ? 0.85 : 1.15), 0);
    } else if (['ally_death_direct_damage_mult', 'first_ally_death_survive'].includes(effectType)) {
      affinity = profiles.length;
    } else {
      affinity = profiles.length * 0.5;
    }

    const value = Number(effect?.value);
    const isTriggeredEffect = ['overheal_to_shield', 'first_ally_death_survive'].includes(effectType);
    const strength = isTriggeredEffect ? 0.2 : (Number.isFinite(value) ? value - 1 : 0.1);
    return score + affinity * strength;
  }, 0);
}

function getGeneratedDemonProfile(demon, demonTypes = {}) {
  const typeId = Number(demon?.typeId || demon?.type_id || demon?.type);
  const type = demonTypes[String(typeId)] || {};
  const role = String(demon?.role || type.role || '').toLowerCase();
  const targeting = String(demon?.targeting || type.targeting || '').toLowerCase();
  const abilityKind = String(demon?.abilityKind || demon?.ability?.kind || type.ability?.kind || '').toLowerCase();
  const aoe = typeId === 4 || typeId === 7 || role === 'aoe' || targeting === 'all'
    || targeting === 'cleave' || abilityKind === 'aoe_attack' || abilityKind === 'cleave_attack';
  const poison = role === 'poisoner' || abilityKind === 'poison';
  const retaliation = role === 'counter_tank' || abilityKind === 'retaliate';
  const healer = role === 'healer' || abilityKind === 'heal';

  return {
    aoe,
    poison,
    retaliation,
    healer,
    singleTarget: !aoe && !poison && !retaliation && !healer,
    front: demon?.position === 'front' || Number(demon?.formationSlot) % 3 === 2
  };
}

async function retryRankedFloor(run, options = {}) {
  const retryFloor = Math.max(1, Number(run.floor) || 1);
  run.state.floorRetryCount = Math.max(0, Number(run.state.floorRetryCount) || 0) + 1;
  const reusedLockedHand = prepareNextSelection(run);
  if (!reusedLockedHand) {
    await dealOffers(run);
  }
  if (options.offerPact && shouldOfferPact(retryFloor, run.state.buffs?.active?.length)) {
    generateBuffChoices(
      run,
      createRng((
        Number(run.seed)
        + retryFloor * 1597334677
        + run.state.floorRetryCount * 2654435761
        + 991
      ) >>> 0),
      3,
      { excludeIds: getRankedPactChoiceExclusions(run) }
    );
  }
  return {
    retryFloor,
    retryCount: run.state.floorRetryCount,
    reusedLockedHand
  };
}

function getRankedPactChoiceExclusions(run) {
  return getNonRepeatableBuffChoiceExclusions(run);
}

function canSelectRankedPact(run, pactId) {
  return canSelectRunBuff(run, pactId);
}

function createGeneratedLockedBonuses(floor, ratingBracket, variant) {
  const power = Math.min(10, Math.max(0, Math.floor((Number(floor) + Math.max(0, Number(ratingBracket) - 900) / 150) / 3)));
  const activeBuffs = [];
  if (power > 0) {
    activeBuffs.push({
      id: 'generated_skill_vitality',
      name: 'Soulbound Vitality',
      description: 'A legal Ranked Skill Tree profile.',
      source: 'skill_tree',
      rarity: 'account',
      effects: [
        { type: 'max_hp_flat', value: power * 2 },
        { type: 'max_hp_mult', value: 1 + power * 0.01 }
      ]
    });
    activeBuffs.push({
      id: 'generated_skill_momentum',
      name: 'Soulbound Momentum',
      description: 'A legal Ranked Skill Tree profile.',
      source: 'skill_tree',
      rarity: 'account',
      effects: [{ type: 'speed_flat', value: power }]
    });
  }
  const bossRewards = loadWorldBosses().map(getWorldBossRewardBuff).filter(Boolean);
  if (floor >= 8 && bossRewards.length) {
    activeBuffs.push({
      ...bossRewards[variant % bossRewards.length],
      expiresAt: undefined
    });
  }
  return {
    generated: true,
    endlessCap: ENDLESS_SKILL_CAP,
    activeBuffs: serializeCombatBuffState({ activeBuffs }).activeBuffs
  };
}

function mergeSnapshotBuffs(snapshot = {}) {
  const pacts = snapshot.pacts || {};
  const locked = snapshot.lockedBuffs || {};
  return normalizeCombatBuffState({
    active: pacts.active || [],
    temporary: pacts.temporary || [],
    activeBuffs: locked.activeBuffs || []
  });
}

function arrangeRankedFormation(team = [], side = 'player') {
  const takenSlots = new Set();
  const frontColumn = side === 'enemy' ? 0 : 2;
  const backColumns = side === 'enemy' ? [2, 1] : [1, 0];
  const slotOrder = (position) => {
    const columns = position === 'front'
      ? [frontColumn, ...backColumns]
      : [...backColumns, frontColumn];
    return columns.flatMap((column) => (
      Array.from({ length: FORMATION_CAPACITY / 3 }, (_, row) => row * 3 + column)
    ));
  };

  return (team || []).slice(0, ACTIVE_CAPACITY).map((demon) => {
    const explicitSlot = Number(demon.formationSlot ?? demon.formationRow);
    const hasLegalExplicitSlot = Number.isInteger(explicitSlot)
      && explicitSlot >= 0
      && explicitSlot < FORMATION_CAPACITY
      && !takenSlots.has(explicitSlot);
    const preferredPosition = demon.preferredPosition === 'back' ? 'back' : 'front';
    const formationSlot = hasLegalExplicitSlot
      ? explicitSlot
      : slotOrder(preferredPosition).find((slot) => !takenSlots.has(slot));
    takenSlots.add(formationSlot);
    return {
      ...demon,
      formationSlot,
      position: getFormationSlotPosition(formationSlot, side)
    };
  });
}

function prepareOpponentTeam(team = []) {
  return arrangeRankedFormation(orderRankedGhostTeam(team), 'enemy');
}

function empowerEndlessGhostTeam(team = [], floor = 0) {
  const endlessDepth = Math.min(60, Math.max(0, Math.floor(Number(floor) || 0) - 20));
  if (!endlessDepth) return team;
  const maxHpMultiplier = 1 + endlessDepth * 0.25;
  const attackMultiplier = 1 + endlessDepth * 0.18;
  const speedBonus = Math.min(10, Math.ceil(endlessDepth / 2));

  return (Array.isArray(team) ? team : []).map((demon) => {
    const baseMaxHp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
    const currentHp = Math.max(0, Number(demon.hp) || baseMaxHp);
    const hpRatio = Math.max(0, Math.min(1, currentHp / baseMaxHp));
    const maxHp = Math.max(1, Math.round(baseMaxHp * maxHpMultiplier));
    const empowered = {
      ...demon,
      maxHp,
      hp: currentHp > 0 ? Math.max(1, Math.round(maxHp * hpRatio)) : 0,
      atk: Math.max(1, Math.round((Number(demon.atk) || 1) * attackMultiplier)),
      speed: Math.max(1, Math.round(Number(demon.speed) || 1) + speedBonus)
    };
    delete empowered.runBaseAtk;
    delete empowered.runBaseMaxHp;
    delete empowered.runBaseSpeed;
    delete empowered.runBuffStatsApplied;
    delete empowered.effectiveAtk;
    return empowered;
  });
}

function getSnapshotSkillTreeSummary(snapshot = {}) {
  const locked = snapshot.lockedBuffs || {};
  const allocations = locked.allocations || {};
  const activeBuffs = Array.isArray(locked.activeBuffs) ? locked.activeBuffs : [];
  const skillBuffs = activeBuffs.filter((buff) => buff?.source === 'skill_tree');
  const storedBonuses = locked.skillBonuses && typeof locked.skillBonuses === 'object'
    ? locked.skillBonuses
    : null;
  const bonuses = storedBonuses || summarizeSkillTreeEffects(skillBuffs);
  const spentPoints = Object.values(allocations)
    .reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);
  const hasBonuses = Object.values(bonuses).some((value) => Number(value) > 0);
  if (!spentPoints && !skillBuffs.length && !hasBonuses) return null;
  return {
    spentPoints: Math.max(1, spentPoints),
    bonuses
  };
}

function summarizeSkillTreeEffects(skillBuffs = []) {
  const bonuses = {};
  const effectMap = {
    max_hp_flat: ['maxHpFlat', 'flat'],
    max_hp_mult: ['maxHpPercent', 'multiplier'],
    healing_flat: ['healingFlat', 'flat'],
    healing_mult: ['healingPercent', 'multiplier'],
    thorns_flat: ['thornsFlat', 'flat'],
    thorns_percent: ['thornsPercent', 'flat'],
    speed_flat: ['speedFlat', 'flat'],
    speed_mult: ['speedPercent', 'multiplier'],
    attack_flat: ['attackFlat', 'flat'],
    attack_mult: ['attackPercent', 'multiplier'],
    aoe_damage_flat: ['aoeDamageFlat', 'flat'],
    aoe_damage_mult: ['aoeDamagePercent', 'multiplier'],
    poison_damage_flat: ['poisonDamageFlat', 'flat'],
    poison_tick_damage_mult: ['poisonDamagePercent', 'multiplier']
  };

  skillBuffs.forEach((buff) => {
    (Array.isArray(buff?.effects) ? buff.effects : []).forEach((effect) => {
      const mapping = effectMap[String(effect?.type || '')];
      if (!mapping) return;
      const [key, kind] = mapping;
      const rawValue = Number(effect.value);
      if (!Number.isFinite(rawValue)) return;
      const value = kind === 'multiplier' ? (rawValue - 1) * 100 : rawValue;
      bonuses[key] = Math.round(((Number(bonuses[key]) || 0) + value) * 10) / 10;
    });
  });
  return bonuses;
}

function namespaceRankedOpponentTeam(team, opponentKey = 'opponent') {
  const namespace = hashSeed(opponentKey).toString(36);
  return (Array.isArray(team) ? team : []).map((demon, index) => ({
    ...demon,
    instanceId: `ranked-enemy-${namespace}-${index + 1}`
  }));
}

function orderRankedGhostTeam(team = [], demonTypes) {
  return (team || [])
    .map((demon, index) => ({
      demon: clearFormationPlacement(demon),
      index,
      priority: isMeleeEnemyDemon(demon, demonTypes)
        ? 0
        : isThornsDemon(demon, demonTypes)
          ? 1
          : 2
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index)
    .map(({ demon }) => demon);
}

function clearFormationPlacement(demon = {}) {
  const unplaced = {
    ...demon,
    position: demon.preferredPosition === 'back' ? 'back' : 'front'
  };
  delete unplaced.formationSlot;
  delete unplaced.formationRow;
  return unplaced;
}

function getPlayerBattleBuffs(run) {
  return normalizeCombatBuffState({
    active: run.state.buffs?.active || [],
    temporary: run.state.buffs?.temporary || [],
    activeBuffs: run.lockedBonuses?.activeBuffs || []
  });
}

function midpointStat(bounds, multiplier) {
  const min = Number(bounds?.[0]) || 1;
  const max = Number(bounds?.[1]) || min;
  return Math.max(1, Math.round(((min + max) / 2) * multiplier));
}

function nextDemonId(run, prefix) {
  run.state.rollCounter = Math.max(0, Number(run.state.rollCounter) || 0) + 1;
  const namespace = String(
    run.state.demonIdNamespace
    || run.id
    || (Number(run.seed) ? Number(run.seed).toString(36) : 'legacy')
  );
  run.state.demonIdNamespace = namespace;
  return `ranked-${namespace}-${prefix}-${run.state.rollCounter}`;
}

function hashSeed(value) {
  const digest = crypto.createHash('sha256').update(String(value)).digest();
  return digest.readUInt32LE(0) || 1;
}

function parseJson(value, fallback) {
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value || fallback);
  } catch (error) {
    return fallback;
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createWorkspaceError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

module.exports = {
  COMBAT_DATA_VERSION,
  DEFAULT_RATING,
  RANKED_NON_REPEATABLE_PACT_IDS,
  addDemonAndCombine,
  advanceRankedFloor,
  applyRankedWorkspace,
  awardRankedSoulInterest,
  awardRankedSoulLifeLoss,
  createInitialRankedState,
  createLockedRankedBonuses,
  createStandardRankedDemon,
  canSelectRankedPact,
  dealOffers,
  getCurrentRankedRun,
  getOrCreateCurrentSeason,
  getOrCreateRankedRating,
  getRankedRating,
  getPlayerBattleBuffs,
  getRankedSoulBalance,
  getRankedRun,
  namespaceRankedOpponentTeam,
  parseRankedRun,
  prepareForFight,
  prepareNextSelection,
  retryRankedFloor,
  spendRankedSouls,
  resetTeamForBattle,
  saveRankedRun,
  saveReadySnapshot,
  selectOpponent,
  serializeRankedRun,
  _test: {
    arrangeRankedFormation,
    createGeneratedSnapshot,
    createGeneratedPacts,
    createGeneratedLockedBonuses,
    empowerEndlessGhostTeam,
    ensureGeneratedOpponents,
    getRankedMatchmakingPolicy,
    getRankedPactChoiceExclusions,
    getSnapshotSkillTreeSummary,
    isImmediatePlayerRepeat,
    hashSeed,
    namespaceRankedOpponentTeam,
    prepareOpponentTeam,
    scoreGeneratedPactForFormation,
    selectGeneratedPactForFormation
  }
};
