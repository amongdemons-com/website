const crypto = require('crypto');
const db = require('./db');
const { calculateStatBonuses, getPlayerStatPointSummary } = require('./account-stat-points');
const {
  applyPreBattleBuffs,
  canSelectRunBuff,
  generateBuffChoices,
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
const { getActiveWorldBossRewardBuffs, loadWorldBosses, getWorldBossRewardBuff } = require('./world-bosses');
const {
  ACTIVE_CAPACITY,
  COMBAT_DATA_VERSION,
  ENDLESS_SKILL_CAP,
  FORMATION_CAPACITY,
  OFFER_SIZE,
  RANKED_STARTING_RSOULS,
  RANKED_RULES_VERSION,
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
  getRosterValidation,
  normalizeReserveSlot,
  normalizeRerolls,
  pickRarityFromOdds,
  shouldOfferPact
} = require('./ranked-rules');

const GENERATED_VARIANTS_PER_FLOOR = 4;
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
  const [rows] = await queryable.query(
    `SELECT *
     FROM ranked_ratings
     WHERE player_id = ? AND season_id = ?
     LIMIT 1${options.forUpdate ? ' FOR UPDATE' : ''}`,
    [playerId, seasonId]
  );
  return serializeRating(rows[0]);
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
    getActiveWorldBossRewardBuffs(player)
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

async function createInitialRankedState(seed) {
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
    lastBattle: null,
    highestClearedFloor: 0,
    victoryRewardClaimed: false,
    victoryPending: false,
    victoryRankGain: 0,
    pendingRating: 0,
    protectedRating: 0,
    endlessRatingEarned: 0,
    lastSnapshotId: null
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

  const lockedHand = options.preserveHand
    ? requestedHand.map((entry) => {
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
  const additionalCost = Math.max(0, Math.floor(Number(options.additionalRSoulCost) || 0));
  const totalCost = purchaseCost + additionalCost;
  const balanceBefore = getRankedSoulBalance(run);
  if (balanceBefore < totalCost) {
    throw createWorkspaceError(`This action costs ${totalCost} rSouls.`);
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
  state.rSouls = balanceBefore - totalCost;
  state.active = combined.active;
  state.reserve = combined.reserve;
  state.picksRemaining = Math.max(0, picksRemaining - selectedOfferCount);
  state.offers = [];
  state.handLocked = Boolean(options.preserveHand);
  state.lockedHand = lockedHand;
  state.combinationEvents = [...combinationEvents, ...combined.events];

  return {
    selectedOfferCount,
    purchaseCost,
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
  const currentRating = Math.max(0, Number(rating?.rating) || DEFAULT_RATING);
  const projectedRating = Math.max(0, currentRating + Number(state.pendingRating || 0));
  const pacts = serializeCombatBuffState(state.buffs || {});
  const previewStats = await createRankedPreviewStats(run);

  return {
    runId: run.id,
    status: run.status,
    phase: state.phase,
    season,
    floor: run.floor,
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
      runDelta: Number(run.ratingDelta) || 0,
      pending: Number(state.pendingRating) || 0
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
  const [rows] = await queryable.query(
    `SELECT snapshots.*,
            history.opponent_key AS previously_served
     FROM ranked_opponent_snapshots snapshots
     LEFT JOIN (
       SELECT opponent_key
       FROM ranked_opponent_history
       WHERE player_id = ? AND season_id = ? AND floor = ?
     ) history ON history.opponent_key = snapshots.id
     WHERE snapshots.season_id = ?
       AND snapshots.floor = ?
       AND snapshots.player_id <> ?
       AND snapshots.combat_version = ?
       AND snapshots.created_at < CURRENT_TIMESTAMP
       AND snapshots.rating BETWEEN ? AND ?
     ORDER BY history.opponent_key IS NULL DESC,
              ABS(snapshots.rating - ?) ASC,
              snapshots.created_at ASC
     LIMIT 12`,
    [
      run.playerId,
      run.seasonId,
      run.floor,
      run.seasonId,
      run.floor,
      run.playerId,
      COMBAT_DATA_VERSION,
      rating.rating - 300,
      rating.rating + 300,
      rating.rating
    ]
  );

  const eligibleSnapshots = rows
    .map((row) => ({ row, snapshot: parseJson(row.snapshot, {}) }))
    .filter(({ snapshot }) => (
      countEnemyMeleeDemons(snapshot.team || []) <= MAX_ENEMY_MELEE_DEMONS
    ));

  let opponent;
  if (eligibleSnapshots.length) {
    const rng = createRng(hashSeed(`${run.seed}:opponent:${run.floor}`));
    const unseen = eligibleSnapshots.filter(({ row }) => !row.previously_served);
    const pool = unseen.length ? unseen : eligibleSnapshots;
    const selected = pool[Math.floor(rng() * Math.min(pool.length, 5))] || pool[0];
    const { row, snapshot } = selected;
    opponent = {
      id: row.id,
      hunterName: row.hunter_name,
      generated: false,
      rating: Number(row.rating) || rating.rating,
      division: getDivision(row.rating).name,
      team: prepareOpponentTeam(snapshot.team || []),
      buffs: mergeSnapshotBuffs(snapshot)
    };
  } else {
    opponent = await selectGeneratedOpponent(run, rating, queryable);
  }

  await queryable.query(
    `INSERT INTO ranked_opponent_history
       (player_id, season_id, opponent_key, floor)
     VALUES (?, ?, ?, ?)`,
    [run.playerId, run.seasonId, opponent.id, run.floor]
  );
  run.state.opponent = opponent;
  return opponent;
}

async function selectGeneratedOpponent(run, rating, queryable = db) {
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
    [run.playerId, run.seasonId, run.floor, run.seasonId, run.floor, bracket, COMBAT_DATA_VERSION]
  );
  const unseen = rows.filter((row) => !row.previously_served);
  const pool = unseen.length ? unseen : rows;
  const index = hashSeed(`${run.seed}:generated:${run.floor}`) % Math.max(1, pool.length);
  const row = pool[index] || rows[0];
  const snapshot = parseJson(row.snapshot, {});
  return {
    id: row.id,
    hunterName: null,
    generated: true,
    rating: bracket,
    division: getDivision(bracket).name,
    team: prepareOpponentTeam(snapshot.team || []),
    buffs: mergeSnapshotBuffs(snapshot)
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
    if (versionsByVariant.get(variant) === COMBAT_DATA_VERSION) continue;
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
        COMBAT_DATA_VERSION
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
  const buffs = createGeneratedPacts(seed, floor);
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

function createGeneratedPacts(seed, floor) {
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
    if (choices.length) selectRunBuff(simulated, choices[0]);
  }
  return simulated.state.buffs;
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
  return `ranked-${prefix}-${run.state.rollCounter}`;
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
  createInitialRankedState,
  createLockedRankedBonuses,
  createStandardRankedDemon,
  canSelectRankedPact,
  dealOffers,
  getCurrentRankedRun,
  getOrCreateCurrentSeason,
  getOrCreateRankedRating,
  getPlayerBattleBuffs,
  getRankedSoulBalance,
  getRankedRun,
  parseRankedRun,
  prepareForFight,
  prepareNextSelection,
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
    ensureGeneratedOpponents,
    getRankedPactChoiceExclusions,
    hashSeed,
    prepareOpponentTeam
  }
};
