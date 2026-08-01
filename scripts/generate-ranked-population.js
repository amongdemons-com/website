const crypto = require('crypto');
const db = require('../public/api/lib/db');
const { initializeSchema } = require('../public/api/lib/schema');
const { simulateFight } = require('../public/api/lib/combat');
const {
  normalizeCombatBuffState,
  selectRunBuff,
  serializeCombatBuffState
} = require('../public/api/lib/combat-buffs');
const { countEnemyMeleeDemons } = require('../public/api/lib/enemy-team-rules');
const { getDemonTypes } = require('../public/api/lib/game-data');
const { createRng } = require('../public/api/lib/rng');
const {
  COMBAT_DATA_VERSION,
  RANKED_RULES_VERSION,
  RANKED_VICTORY_FLOOR,
  createSnapshotPayload,
  getFloorRatingGain,
  getRankedActiveCapacity,
  getRankedCardCost,
  getRunEndRatingDelta
} = require('../public/api/lib/ranked-rules');
const {
  advanceRankedFloor,
  applyRankedWorkspace,
  awardRankedSoulInterest,
  createInitialRankedState,
  getOrCreateCurrentSeason,
  getPlayerBattleBuffs,
  prepareForFight,
  _test: {
    arrangeRankedFormation,
    createGeneratedLockedBonuses,
    createGeneratedSnapshot,
    hashSeed,
    prepareOpponentTeam
  }
} = require('../public/api/lib/ranked-runs');

const POPULATION_VERSION = 'ranked-bots-v1';
const DEFAULTS = Object.freeze({
  apply: false,
  players: 12,
  maxFloor: 25,
  candidateLimit: 14,
  lineupVariants: 5,
  combatSeeds: 1,
  seed: 20260801,
  usernamePrefix: 'RankedBot'
});
const STYLE_NAMES = Object.freeze([
  'balanced',
  'tempo',
  'poison',
  'cleave',
  'sustain',
  'retaliation',
  'power'
]);

function parseOptions(argv = process.argv.slice(2)) {
  const options = { ...DEFAULTS };
  const valueFlags = new Map([
    ['--players', 'players'],
    ['--max-floor', 'maxFloor'],
    ['--candidate-limit', 'candidateLimit'],
    ['--lineup-variants', 'lineupVariants'],
    ['--combat-seeds', 'combatSeeds'],
    ['--seed', 'seed'],
    ['--username-prefix', 'usernamePrefix']
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') {
      options.apply = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    const key = valueFlags.get(argument);
    if (!key) throw new Error(`Unknown option: ${argument}`);
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`${argument} requires a value.`);
    options[key] = key === 'usernamePrefix' ? String(value) : Number(value);
    index += 1;
  }

  for (const [key, minimum, maximum] of [
    ['players', 1, 100],
    ['maxFloor', 1, 100],
    ['candidateLimit', 1, 100],
    ['lineupVariants', 1, 20],
    ['combatSeeds', 1, 20],
    ['seed', 1, 0xffffffff]
  ]) {
    const value = Math.floor(Number(options[key]));
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(`${key} must be between ${minimum} and ${maximum}.`);
    }
    options[key] = value;
  }
  if (!/^[A-Za-z][A-Za-z0-9_-]{2,47}$/.test(options.usernamePrefix)) {
    throw new Error('usernamePrefix must be 3-48 username-safe characters and start with a letter.');
  }
  return options;
}

function printHelp() {
  console.log(`Usage: npm run seed:ranked -- [options]

Generates deterministic, combat-optimized RankedBot player runs and snapshots.
The default is a read-only dry run. Pass --apply to write the reviewed population.

Options:
  --apply                 Write players, ratings, ended runs, and snapshots
  --players N             Number of bot hunters (default: ${DEFAULTS.players})
  --max-floor N           Deepest generated floor (default: ${DEFAULTS.maxFloor})
  --candidate-limit N     Lineups combat-tested per floor (default: ${DEFAULTS.candidateLimit})
  --lineup-variants N     Heuristic styles tried per shop plan (default: ${DEFAULTS.lineupVariants})
  --combat-seeds N        Fights per fallback opponent (default: ${DEFAULTS.combatSeeds})
  --seed N                Deterministic population seed (default: ${DEFAULTS.seed})
  --username-prefix TEXT  Visible bot username prefix (default: ${DEFAULTS.usernamePrefix})`);
}

async function generateRankedPopulation(options = DEFAULTS) {
  const normalized = { ...DEFAULTS, ...options };
  const season = getSeasonWindow(new Date());
  const demonTypes = await getDemonTypes();
  const benchmarkCache = new Map();
  const bots = [];

  for (let index = 0; index < normalized.players; index += 1) {
    bots.push(await generateBot({
      index,
      options: normalized,
      season,
      demonTypes,
      benchmarkCache
    }));
  }

  return {
    version: POPULATION_VERSION,
    season,
    options: normalized,
    bots,
    snapshotCount: bots.reduce((total, bot) => total + bot.snapshots.length, 0),
    averageWinRate: average(bots.flatMap((bot) => bot.floorResults.map((result) => result.winRate)))
  };
}

async function generateBot({ index, options, season, demonTypes, benchmarkCache }) {
  const ordinal = index + 1;
  const username = `${options.usernamePrefix}${String(ordinal).padStart(3, '0')}`;
  const playerId = `ranked-bot:${options.seed}:${String(ordinal).padStart(3, '0')}`;
  const runId = stableUuid(`${POPULATION_VERSION}:run:${season.id}:${playerId}`);
  const botSeed = hashSeed(`${options.seed}:bot:${ordinal}`) || ordinal;
  const ratingStart = getBotStartingRating(index, options.players);
  const deepestFloor = Math.max(1, options.maxFloor - (index % Math.min(4, options.maxFloor)));
  const preferredStyle = STYLE_NAMES[index % STYLE_NAMES.length];
  const lockedBonuses = createGeneratedLockedBonuses(RANKED_VICTORY_FLOOR, ratingStart, index);
  let run = {
    id: runId,
    playerId,
    seasonId: season.id,
    seed: botSeed,
    status: 'active',
    floor: 1,
    lives: 3,
    ratingStart,
    ratingDelta: 0,
    state: await createInitialRankedState(botSeed, runId),
    lockedBonuses,
    rulesVersion: RANKED_RULES_VERSION,
    endedAt: null
  };
  let currentRating = ratingStart;
  const snapshots = [];
  const floorResults = [];

  for (let floor = 1; floor <= deepestFloor; floor += 1) {
    const benchmarks = await getBenchmarks({
      cache: benchmarkCache,
      seasonId: season.id,
      floor,
      rating: currentRating
    });
    run = await choosePendingPact(run, benchmarks, demonTypes, options, ordinal);
    const selection = await chooseBestLineup(run, benchmarks, demonTypes, {
      ...options,
      preferredStyle,
      botOrdinal: ordinal
    });
    run = selection.run;
    floorResults.push({
      floor,
      winRate: selection.evaluation.winRate,
      averageScore: selection.evaluation.averageScore,
      team: summarizeTeam(run.state.active)
    });

    const snapshot = createSnapshotPayload(run, {
      rating: currentRating,
      combatVersion: COMBAT_DATA_VERSION,
      gameDataVersion: `optimized:${POPULATION_VERSION}`
    });
    snapshots.push({
      id: stableUuid(`${POPULATION_VERSION}:snapshot:${season.id}:${playerId}:${floor}`),
      playerId,
      seasonId: season.id,
      floor,
      rating: currentRating,
      hunterName: username,
      snapshot,
      combatVersion: COMBAT_DATA_VERSION
    });

    run.state.highestClearedFloor = floor;
    const interest = awardRankedSoulInterest(run);
    run.state.lastInterest = interest;
    let gain = getFloorRatingGain(floor);
    if (floor < RANKED_VICTORY_FLOOR) {
      run.state.pendingRating = Math.max(0, Number(run.state.pendingRating) || 0) + gain;
    } else if (floor === RANKED_VICTORY_FLOOR) {
      gain += Math.max(0, Number(run.state.pendingRating) || 0);
      run.state.pendingRating = 0;
      run.state.victoryRewardClaimed = true;
      run.state.victoryRankGain = gain;
      currentRating += gain;
      run.ratingDelta += gain;
    }

    if (floor < deepestFloor) {
      await advanceRankedFloor(run, { offerPact: true });
    }
  }

  if (deepestFloor < RANKED_VICTORY_FLOOR) {
    const endDelta = getRunEndRatingDelta(deepestFloor, run.state.pendingRating);
    currentRating = Math.max(0, currentRating + endDelta);
    run.ratingDelta += endDelta;
  }
  run.state.pendingRating = 0;
  run.state.phase = 'ended';
  run.state.endReason = 'completed';
  run.state.endReachedFloor = deepestFloor;
  run.state.opponent = null;
  run.status = 'ended';
  run.floor = deepestFloor;
  run.endedAt = new Date();

  return {
    player: {
      id: playerId,
      username,
      souls: deepestFloor >= RANKED_VICTORY_FLOOR ? 25 : 0
    },
    rating: {
      playerId,
      seasonId: season.id,
      rating: currentRating,
      highestFloor: deepestFloor,
      victories: deepestFloor >= RANKED_VICTORY_FLOOR ? 1 : 0,
      runsPlayed: 1
    },
    run,
    snapshots,
    floorResults,
    preferredStyle
  };
}

async function choosePendingPact(run, benchmarks, demonTypes, options, botOrdinal) {
  const pending = serializeCombatBuffState(run.state.buffs).pendingChoices.map((pact) => pact.id);
  if (!pending.length || !run.state.active.length) return run;
  const candidates = [];
  for (const pactId of pending) {
    const candidate = cloneJson(run);
    selectRunBuff(candidate, pactId);
    const evaluation = evaluateLineup(candidate, benchmarks, demonTypes, {
      combatSeeds: options.combatSeeds,
      seed: hashSeed(`${options.seed}:pact:${botOrdinal}:${run.floor}:${pactId}`)
    });
    candidates.push({ candidate, evaluation });
  }
  candidates.sort(compareEvaluations);
  return candidates[0]?.candidate || run;
}

async function chooseBestLineup(run, benchmarks, demonTypes, options) {
  const purchasePlans = getPurchasePlans(run.state.offers, run.state.picksRemaining);
  const candidates = new Map();
  const styles = getStyleRotation(options.preferredStyle, options.lineupVariants);

  for (const purchases of purchasePlans) {
    for (const style of styles) {
      const candidate = await createLineupCandidate(run, purchases, style, demonTypes, options);
      if (!candidate) continue;
      const signature = getTeamSignature(candidate.run.state.active);
      const existing = candidates.get(signature);
      if (!existing || candidate.heuristic > existing.heuristic) candidates.set(signature, candidate);
    }
  }

  const finalists = [...candidates.values()]
    .sort((left, right) => right.heuristic - left.heuristic)
    .slice(0, options.candidateLimit);
  if (!finalists.length) throw new Error(`No legal RankedBot lineup at floor ${run.floor}.`);

  finalists.forEach((candidate, index) => {
    candidate.evaluation = evaluateLineup(candidate.run, benchmarks, demonTypes, {
      combatSeeds: options.combatSeeds,
      seed: hashSeed(`${options.seed}:fight:${options.botOrdinal}:${run.floor}:${index}`)
    });
  });
  finalists.sort((left, right) => (
    compareEvaluations(left, right) || right.heuristic - left.heuristic
  ));
  return finalists[0];
}

async function createLineupCandidate(run, purchases, style, demonTypes, options) {
  const candidate = cloneJson(run);
  const roster = [...candidate.state.active, ...candidate.state.reserve];
  const purchasedDemons = purchases.map((offer) => offer.demon);
  const pool = [...roster, ...purchasedDemons];
  const activeCapacity = getRankedActiveCapacity(candidate.floor);
  const totalCapacity = activeCapacity + 6;
  const scored = pool.map((demon) => ({
    demon,
    score: scoreDemon(demon, style, demonTypes)
      + deterministicJitter(`${options.seed}:${options.botOrdinal}:${candidate.floor}:${style}:${demon.instanceId}`)
  })).sort((left, right) => right.score - left.score);
  const requiredIds = new Set(purchasedDemons.map((demon) => String(demon.instanceId)));
  const retained = [];
  scored.filter(({ demon }) => requiredIds.has(String(demon.instanceId))).forEach(({ demon }) => retained.push(demon));
  scored.filter(({ demon }) => !requiredIds.has(String(demon.instanceId))).forEach(({ demon }) => {
    if (retained.length < totalCapacity) retained.push(demon);
  });

  const retainedScores = new Map(scored.map(({ demon, score }) => [String(demon.instanceId), score]));
  const active = [];
  let meleeCount = 0;
  [...retained].sort((left, right) => (
    retainedScores.get(String(right.instanceId)) - retainedScores.get(String(left.instanceId))
  )).forEach((demon) => {
    if (active.length >= activeCapacity) return;
    const isMelee = countEnemyMeleeDemons([demon], demonTypes) > 0;
    if (isMelee && meleeCount >= 3) return;
    active.push(demon);
    if (isMelee) meleeCount += 1;
  });
  if (!active.length) return null;

  const activeIds = new Set(active.map((demon) => String(demon.instanceId)));
  const reserve = retained.filter((demon) => !activeIds.has(String(demon.instanceId))).slice(0, 6);
  const keptIds = new Set([...active, ...reserve].map((demon) => String(demon.instanceId)));
  const sold = roster.filter((demon) => !keptIds.has(String(demon.instanceId)));
  const arranged = arrangeRankedFormation(active.map(clearPlacement), 'player');
  const lineup = {
    purchasedOfferIds: purchases.map((offer) => offer.offerId),
    active: arranged.map((demon) => ({
      instanceId: demon.instanceId,
      formationSlot: demon.formationSlot
    })),
    reserve: reserve.map((demon, index) => ({
      instanceId: demon.instanceId,
      reserveSlot: index
    })),
    hand: [],
    sold: sold.map((demon) => ({ instanceId: demon.instanceId }))
  };

  try {
    await applyRankedWorkspace(candidate, lineup, { autoSellPurchasedHand: true });
    prepareForFight(candidate);
  } catch (error) {
    if (Number(error?.status) === 409) return null;
    throw error;
  }
  if (countEnemyMeleeDemons(candidate.state.active, demonTypes) > 3) return null;

  const rosterValue = [...candidate.state.active, ...candidate.state.reserve]
    .reduce((total, demon) => total + getRankedCardCost(demon), 0);
  const styleAffinity = candidate.state.active
    .reduce((total, demon) => total + getStyleAffinity(demon, style, demonTypes), 0);
  return {
    run: candidate,
    style,
    heuristic: scoreRawTeam(candidate.state.active) + rosterValue * 12
      + Number(candidate.state.rSouls || 0) * 2 + styleAffinity * 25,
    evaluation: null
  };
}

function evaluateLineup(run, benchmarks, demonTypes, options) {
  const playerBuffs = getPlayerBattleBuffs(run);
  let wins = 0;
  let score = 0;
  let battles = 0;
  benchmarks.forEach((snapshot, opponentIndex) => {
    const enemyTeam = prepareOpponentTeam(snapshot.team || []);
    const enemyBuffs = getSnapshotBuffs(snapshot);
    for (let sample = 0; sample < options.combatSeeds; sample += 1) {
      const seed = hashSeed(`${options.seed}:${opponentIndex}:${sample}`);
      const result = simulateFight(
        createRng(seed),
        run.state.active,
        enemyTeam,
        { combatType: 'ranked', demonTypes, playerBuffs, enemyBuffs }
      );
      const won = result.winner === 'player';
      if (won) wins += 1;
      battles += 1;
      score += (won ? 10000 : 0)
        + getLivingHealthRatio(result.playerTeam) * 800
        - getLivingHealthRatio(result.enemyTeam) * 500
        - Math.min(500, Number(result.ticks) || 0);
    }
  });
  return {
    wins,
    battles,
    winRate: battles ? wins / battles : 0,
    averageScore: battles ? score / battles : 0
  };
}

function compareEvaluations(left, right) {
  const leftEvaluation = left.evaluation || left;
  const rightEvaluation = right.evaluation || right;
  return rightEvaluation.winRate - leftEvaluation.winRate
    || rightEvaluation.averageScore - leftEvaluation.averageScore;
}

async function getBenchmarks({ cache, seasonId, floor, rating }) {
  const bracket = Math.round(Number(rating) / 200) * 200;
  const key = `${seasonId}:${floor}:${bracket}`;
  if (!cache.has(key)) {
    cache.set(key, Promise.all(Array.from({ length: 4 }, (_, variant) => (
      createGeneratedSnapshot(seasonId, floor, bracket, variant)
    ))));
  }
  return cache.get(key);
}

function getPurchasePlans(offers = [], picksRemaining = 0) {
  const available = (Array.isArray(offers) ? offers : []).filter((offer) => !offer.purchased);
  const maxPicks = Math.min(available.length, Math.max(0, Number(picksRemaining) || 0));
  const plans = [[]];
  if (maxPicks >= 1) available.forEach((offer) => plans.push([offer]));
  if (maxPicks >= 2) {
    for (let left = 0; left < available.length; left += 1) {
      for (let right = left + 1; right < available.length; right += 1) {
        plans.push([available[left], available[right]]);
      }
    }
  }
  return plans;
}

function getStyleRotation(preferredStyle, count) {
  const start = Math.max(0, STYLE_NAMES.indexOf(preferredStyle));
  return Array.from({ length: Math.min(count, STYLE_NAMES.length) }, (_, index) => (
    STYLE_NAMES[(start + index) % STYLE_NAMES.length]
  ));
}

function scoreDemon(demon, style, demonTypes) {
  const type = demonTypes[String(Number(demon.typeId))] || {};
  const hp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
  const atk = Math.max(0, Number(demon.atk) || 0);
  const speed = Math.max(1, Number(demon.speed) || 1);
  const base = hp * 0.9 + atk * Math.sqrt(speed) * 9;
  return base * (1 + getStyleAffinity(demon, style, demonTypes) * 0.08)
    + (type.preferredPosition === 'front' ? hp * 0.08 : speed * 3);
}

function getStyleAffinity(demon, style, demonTypes) {
  const type = demonTypes[String(Number(demon.typeId))] || {};
  const role = String(demon.role || type.role || '').toLowerCase();
  const ability = String(demon.abilityKind || demon.ability?.kind || type.ability?.kind || '').toLowerCase();
  const affinities = {
    balanced: 1,
    tempo: ['assassin', 'ranged', 'chaotic'].includes(role) ? 3 : (Number(demon.speed) >= 10 ? 2 : 0),
    poison: role === 'poisoner' || ability === 'poison' ? 4 : (role === 'counter_tank' ? 2 : 0),
    cleave: ['aoe', 'striker', 'assassin'].includes(role) ? 3 : 0,
    sustain: ['healer', 'bruiser', 'counter_tank'].includes(role) ? 3 : 0,
    retaliation: role === 'counter_tank' || ability === 'retaliate' ? 4 : (role === 'healer' ? 2 : 0),
    power: ['juggernaut', 'chaotic', 'melee'].includes(role) ? 3 : 0
  };
  return affinities[style] || 0;
}

function scoreRawTeam(team = []) {
  return team.reduce((total, demon) => {
    const hp = Math.max(1, Number(demon.maxHp) || Number(demon.hp) || 1);
    const atk = Math.max(0, Number(demon.atk) || 0);
    const speed = Math.max(1, Number(demon.speed) || 1);
    return total + hp + atk * Math.sqrt(speed) * 10;
  }, 0);
}

function getSnapshotBuffs(snapshot = {}) {
  return normalizeCombatBuffState({
    active: snapshot.pacts?.active || [],
    temporary: snapshot.pacts?.temporary || [],
    activeBuffs: snapshot.lockedBuffs?.activeBuffs || []
  });
}

function getLivingHealthRatio(team = []) {
  const maximum = team.reduce((total, demon) => total + Math.max(1, Number(demon.maxHp) || 1), 0);
  const current = team.reduce((total, demon) => total + Math.max(0, Number(demon.hp) || 0), 0);
  return maximum ? current / maximum : 0;
}

function getBotStartingRating(index, playerCount) {
  if (playerCount <= 1) return 1000;
  const minimum = 800;
  const maximum = 3800;
  return Math.round((minimum + ((maximum - minimum) * index) / (playerCount - 1)) / 100) * 100;
}

function getSeasonWindow(now) {
  const year = now.getUTCFullYear();
  const quarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const startMonth = (quarter - 1) * 3;
  return {
    id: `ranked-${year}-q${quarter}`,
    name: `${year} Ranked Q${quarter}`,
    startsAt: new Date(Date.UTC(year, startMonth, 1)),
    endsAt: new Date(Date.UTC(year, startMonth + 3, 1))
  };
}

async function applyPopulation(population) {
  await initializeSchema();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const season = await getOrCreateCurrentSeason(connection);
    if (season.id !== population.season.id) {
      throw new Error(`Generated season ${population.season.id} no longer matches current season ${season.id}.`);
    }
    await assertBotIdentitiesAvailable(connection, population.bots);
    for (const bot of population.bots) {
      await upsertBot(connection, bot);
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assertBotIdentitiesAvailable(connection, bots) {
  const ids = bots.map((bot) => bot.player.id);
  const usernames = bots.map((bot) => bot.player.username);
  const placeholders = (values) => values.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT id, username FROM players
     WHERE id IN (${placeholders(ids)}) OR username IN (${placeholders(usernames)})`,
    [...ids, ...usernames]
  );
  const expected = new Map(bots.map((bot) => [bot.player.id, bot.player.username]));
  const collision = rows.find((row) => expected.get(String(row.id)) !== String(row.username));
  if (collision) {
    throw new Error(`Bot identity collides with existing player ${collision.username} (${collision.id}).`);
  }
}

async function upsertBot(connection, bot) {
  const disabledHash = crypto.createHash('sha512').update(bot.player.id).digest('hex');
  const disabledSalt = crypto.createHash('sha256').update(bot.player.username).digest('hex');
  await connection.query(
    `INSERT INTO players
       (id, username, email, password_hash, password_salt, password_login_enabled, souls, unlocks, is_guest)
     VALUES (?, ?, NULL, ?, ?, 0, ?, ?, 0)
     ON DUPLICATE KEY UPDATE
       username = VALUES(username), password_login_enabled = 0, souls = VALUES(souls), is_guest = 0`,
    [bot.player.id, bot.player.username, disabledHash, disabledSalt, bot.player.souls, JSON.stringify([])]
  );
  await connection.query(
    `INSERT INTO ranked_ratings
       (player_id, season_id, rating, highest_floor, victories, runs_played)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       rating = VALUES(rating), highest_floor = VALUES(highest_floor),
       victories = VALUES(victories), runs_played = VALUES(runs_played)`,
    [
      bot.rating.playerId,
      bot.rating.seasonId,
      bot.rating.rating,
      bot.rating.highestFloor,
      bot.rating.victories,
      bot.rating.runsPlayed
    ]
  );
  await connection.query(
    `INSERT INTO ranked_runs
       (id, player_id, season_id, seed, status, floor, lives, rating_start, rating_delta,
        state, locked_bonuses, rules_version, ended_at)
     VALUES (?, ?, ?, ?, 'ended', ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       status = 'ended', floor = VALUES(floor), lives = VALUES(lives),
       rating_start = VALUES(rating_start), rating_delta = VALUES(rating_delta),
       state = VALUES(state), locked_bonuses = VALUES(locked_bonuses),
       rules_version = VALUES(rules_version), ended_at = VALUES(ended_at)`,
    [
      bot.run.id,
      bot.run.playerId,
      bot.run.seasonId,
      bot.run.seed,
      bot.run.floor,
      bot.run.lives,
      bot.run.ratingStart,
      bot.run.ratingDelta,
      JSON.stringify(bot.run.state),
      JSON.stringify(bot.run.lockedBonuses),
      bot.run.rulesVersion,
      bot.run.endedAt
    ]
  );
  for (const entry of bot.snapshots) {
    await connection.query(
      `INSERT INTO ranked_opponent_snapshots
         (id, player_id, season_id, floor, rating, hunter_name, snapshot, combat_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         rating = VALUES(rating), hunter_name = VALUES(hunter_name),
         snapshot = VALUES(snapshot), combat_version = VALUES(combat_version)`,
      [
        entry.id,
        entry.playerId,
        entry.seasonId,
        entry.floor,
        entry.rating,
        entry.hunterName,
        JSON.stringify(entry.snapshot),
        entry.combatVersion
      ]
    );
  }
}

function summarizePopulation(population) {
  console.log(`${population.version}: ${population.bots.length} hunters, ${population.snapshotCount} snapshots, season ${population.season.id}.`);
  console.log(`Average benchmark win rate: ${formatPercent(population.averageWinRate)}.`);
  console.table(population.bots.map((bot) => ({
    hunter: bot.player.username,
    style: bot.preferredStyle,
    rating: bot.rating.rating,
    floor: bot.rating.highestFloor,
    snapshots: bot.snapshots.length,
    winRate: formatPercent(average(bot.floorResults.map((result) => result.winRate))),
    finalTeam: bot.floorResults.at(-1)?.team || ''
  })));
}

function summarizeTeam(team = []) {
  return team.map((demon) => `${demon.typeId}:${String(demon.rarity || 'common').slice(0, 1)}`).join(' ');
}

function getTeamSignature(team = []) {
  return team.map((demon) => (
    `${demon.typeId}:${demon.rarity}:${demon.formationSlot}`
  )).sort().join('|');
}

function clearPlacement(demon) {
  const copy = { ...demon };
  delete copy.formationSlot;
  delete copy.formationRow;
  return copy;
}

function deterministicJitter(value) {
  return (hashSeed(value) % 1000) / 1000;
}

function stableUuid(value) {
  const hex = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32).split('');
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const joined = hex.join('');
  return `${joined.slice(0, 8)}-${joined.slice(8, 12)}-${joined.slice(12, 16)}-${joined.slice(16, 20)}-${joined.slice(20)}`;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function average(values = []) {
  return values.length ? values.reduce((total, value) => total + Number(value || 0), 0) / values.length : 0;
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

async function main() {
  const options = parseOptions();
  if (options.help) {
    printHelp();
    return;
  }
  console.log(options.apply
    ? 'Generating Ranked population for transactional apply...'
    : 'Generating Ranked population dry run (no database writes)...');
  const population = await generateRankedPopulation(options);
  summarizePopulation(population);
  if (!options.apply) {
    console.log('Dry run complete. Re-run with --apply to persist this deterministic population.');
    return;
  }
  await applyPopulation(population);
  console.log(`Applied ${population.bots.length} RankedBot hunters and ${population.snapshotCount} snapshots.`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.end());
}

module.exports = {
  DEFAULTS,
  POPULATION_VERSION,
  applyPopulation,
  generateRankedPopulation,
  getBotStartingRating,
  getSeasonWindow,
  parseOptions,
  stableUuid
};
