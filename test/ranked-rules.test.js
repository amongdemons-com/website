const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getFloorRatingGain,
  getRankedCardCost,
  getRunEndRatingDelta,
  resolveDefeat
} = require('../public/api/lib/ranked-rules');
const {
  advanceRankedFloor,
  applyRankedWorkspace,
  awardRankedSoulInterest,
  awardRankedSoulLifeLoss,
  selectOpponent
} = require('../public/api/lib/ranked-runs');
const {
  empowerEndlessGhostTeam,
  getRankedMatchmakingPolicy,
  getSnapshotSkillTreeSummary,
  isImmediatePlayerRepeat
} = require('../public/api/lib/ranked-runs')._test;

test('Endless floors track prestige without awarding additional rating', () => {
  assert.equal(getFloorRatingGain(9), 0);
  assert.equal(getFloorRatingGain(10), 3);
  assert.equal(getFloorRatingGain(19), 3);
  assert.equal(getFloorRatingGain(20), 75);
  assert.equal(getFloorRatingGain(21), 0);
  assert.equal(getFloorRatingGain(50), 0);
});

test('losing all three Ranked lives early always costs rating', () => {
  let lives = 3;
  for (let loss = 0; loss < 3; loss += 1) {
    const defeat = resolveDefeat(lives);
    lives = defeat.lives;
    assert.equal(defeat.ended, loss === 2);
  }

  assert.equal(lives, 0);
  assert.equal(getRunEndRatingDelta(1, 0), -20);
  assert.equal(getRunEndRatingDelta(9, 100), -20);
  assert.equal(getRunEndRatingDelta(10, 0), -5);
  assert.equal(getRunEndRatingDelta(11, 3), -2);
  assert.equal(getRunEndRatingDelta(20, 30), 30);
});

test('endless ghosts become substantially stronger after floor 20', () => {
  const ghost = [{ instanceId: 'ghost-1', maxHp: 100, hp: 100, atk: 20, speed: 10 }];

  assert.equal(empowerEndlessGhostTeam(ghost, 20), ghost);
  assert.deepEqual(
    empowerEndlessGhostTeam(ghost, 21).map(({ maxHp, hp, atk, speed }) => ({ maxHp, hp, atk, speed })),
    [{ maxHp: 125, hp: 125, atk: 24, speed: 11 }]
  );
  assert.deepEqual(
    empowerEndlessGhostTeam(ghost, 25).map(({ maxHp, hp, atk, speed }) => ({ maxHp, hp, atk, speed })),
    [{ maxHp: 225, hp: 225, atk: 38, speed: 13 }]
  );
});

test('Ranked matchmaking keeps rating bands before endless and opens them afterward', () => {
  assert.deepEqual(
    getRankedMatchmakingPolicy({ floor: 20 }, { rating: 2200 }),
    { floor: 20, endless: false, rating: 2200, minRating: 1900, maxRating: 2500 }
  );
  assert.deepEqual(
    getRankedMatchmakingPolicy({ floor: 21 }, { rating: 2200 }),
    { floor: 21, endless: true, rating: 2200, minRating: 1900, maxRating: 2500 }
  );
});

test('Ranked matchmaking avoids serving the same player on consecutive fights', () => {
  const state = { lastOpponentKey: 'snapshot-a', lastOpponentPlayerId: 'player-a' };

  assert.equal(isImmediatePlayerRepeat({ id: 'snapshot-b', player_id: 'player-a' }, state), true);
  assert.equal(isImmediatePlayerRepeat({ id: 'snapshot-c', player_id: 'player-b' }, state), false);
  assert.equal(isImmediatePlayerRepeat({ id: 'ghost-a' }, { lastOpponentKey: 'ghost-a' }), true);
});

test('Ranked player snapshots are selected from the exact current floor', async () => {
  const queries = [];
  const queryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes('FROM ranked_opponent_snapshots')) {
        return [[{
          id: 'snapshot-floor-7',
          player_id: 'opponent-player',
          hunter_name: 'FloorSevenHunter',
          rating: 1210,
          previously_served: null,
          snapshot: JSON.stringify({ team: [], pacts: {}, lockedBuffs: {} })
        }]];
      }
      if (sql.includes('INSERT INTO ranked_opponent_history')) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  const run = {
    playerId: 'current-player',
    seasonId: 'season-1',
    seed: 77,
    floor: 7,
    state: { floorRetryCount: 0, lastOpponentKey: null, lastOpponentPlayerId: null }
  };

  const opponent = await selectOpponent(run, { rating: 1200 }, queryable);
  const snapshotQuery = queries[0];

  assert.match(snapshotQuery.sql, /snapshots\.floor = \?/);
  assert.equal(snapshotQuery.params[2], 7);
  assert.equal(snapshotQuery.params[4], 7);
  assert.equal(opponent.id, 'snapshot-floor-7');
  assert.equal(opponent.hunterName, 'FloorSevenHunter');
  assert.equal(opponent.generated, false);
});

test('surviving a Ranked loss earns 10 rSouls and advances to the next floor', async () => {
  const run = {
    floor: 4,
    state: {
      phase: 'result',
      rSouls: 23,
      handLocked: true,
      lockedHand: [],
      buffs: { active: [], pendingChoices: [], temporary: [] },
      floorRetryCount: 2
    }
  };

  const reward = awardRankedSoulLifeLoss(run);
  await advanceRankedFloor(run, { offerPact: false });

  assert.deepEqual(reward, { earned: 10, balanceBefore: 23, balance: 33 });
  assert.equal(run.floor, 5);
  assert.equal(run.state.phase, 'selection');
  assert.equal(run.state.floorRetryCount, 0);
});

test('Ranked victory interest keeps its floor and balance scaling', () => {
  const run = { floor: 4, state: { rSouls: 23 } };

  assert.deepEqual(
    awardRankedSoulInterest(run),
    { earned: 6, balanceBefore: 23, balance: 29 }
  );
});

test('Fight auto-sells purchased Hand demons even when Reserve is full', async () => {
  const createDemon = (instanceId, typeId, rarity = 'common') => ({
    instanceId,
    typeId,
    rarity,
    preferredPosition: typeId % 2 ? 'front' : 'back',
    position: typeId % 2 ? 'front' : 'back',
    maxHp: 10,
    hp: 10,
    atk: 2,
    speed: 2
  });
  const active = createDemon('active-1', 1);
  const reserve = Array.from({ length: 6 }, (_, index) => ({
    ...createDemon(`reserve-${index + 1}`, index + 2),
    reserveSlot: index
  }));
  const purchasedHandDemon = createDemon('offer-purchased', 11, 'rare');
  const run = {
    floor: 6,
    state: {
      phase: 'selection',
      active: [{ ...active, formationSlot: 0 }],
      reserve,
      offers: [{
        offerId: 'offer-purchased-id',
        purchased: true,
        demon: purchasedHandDemon
      }],
      picksRemaining: 1,
      rSouls: 20,
      rollCounter: 0,
      combinationEvents: []
    }
  };

  const result = await applyRankedWorkspace(run, {
    purchasedOfferIds: ['offer-purchased-id'],
    active: [{ instanceId: active.instanceId, formationSlot: 0 }],
    reserve: reserve.map((demon) => ({
      instanceId: demon.instanceId,
      reserveSlot: demon.reserveSlot
    })),
    hand: [{ instanceId: purchasedHandDemon.instanceId }],
    sold: []
  }, {
    preserveHand: true,
    autoSellPurchasedHand: true
  });

  const expectedSale = Math.ceil(getRankedCardCost(purchasedHandDemon) / 2);
  assert.equal(run.state.reserve.length, 6);
  assert.equal(run.state.lockedHand.length, 0);
  assert.equal(run.state.handLocked, false);
  assert.equal(result.soldCount, 1);
  assert.equal(result.saleCredit, expectedSale);
  assert.equal(run.state.rSouls, 20 + expectedSale);
});

test('selling from Reserve can return an owned demon displaced into Hand to the freed slot', async () => {
  const createDemon = (instanceId, typeId, rarity = 'common') => ({
    instanceId,
    typeId,
    rarity,
    preferredPosition: typeId % 2 ? 'front' : 'back',
    position: typeId % 2 ? 'front' : 'back',
    maxHp: 10,
    hp: 10,
    atk: 2,
    speed: 2
  });
  const active = createDemon('active-refill', 1);
  const retainedReserve = createDemon('reserve-retained', 2);
  const displacedReserve = createDemon('reserve-displaced', 3);
  const soldReserve = createDemon('reserve-sold', 4);
  const purchasedOffer = createDemon('offer-replacement', 5, 'uncommon');
  const remainingOffer = createDemon('offer-remaining', 5);
  const run = {
    floor: 6,
    state: {
      phase: 'selection',
      active: [{ ...active, formationSlot: 0 }],
      reserve: [
        { ...retainedReserve, reserveSlot: 0 },
        { ...displacedReserve, reserveSlot: 1 },
        { ...soldReserve, reserveSlot: 4 }
      ],
      offers: [
        { offerId: 'offer-replacement-id', purchased: false, demon: purchasedOffer },
        { offerId: 'offer-remaining-id', purchased: false, demon: remainingOffer }
      ],
      picksRemaining: 2,
      rSouls: 20,
      rollCounter: 0,
      combinationEvents: []
    }
  };

  const result = await applyRankedWorkspace(run, {
    purchasedOfferIds: ['offer-replacement-id'],
    active: [{ instanceId: active.instanceId, formationSlot: 0 }],
    reserve: [
      { instanceId: retainedReserve.instanceId, reserveSlot: 0 },
      { instanceId: purchasedOffer.instanceId, reserveSlot: 1 },
      { instanceId: displacedReserve.instanceId, reserveSlot: 4 }
    ],
    hand: [{ instanceId: remainingOffer.instanceId }],
    sold: [{ instanceId: soldReserve.instanceId }]
  }, {
    preserveHand: true,
    autoSellPurchasedHand: true
  });

  assert.equal(run.state.reserve.length, 3);
  assert.equal(run.state.reserve.find((demon) => demon.reserveSlot === 1)?.instanceId, purchasedOffer.instanceId);
  assert.equal(run.state.reserve.find((demon) => demon.reserveSlot === 4)?.instanceId, displacedReserve.instanceId);
  assert.equal(run.state.lockedHand.length, 1);
  assert.equal(run.state.lockedHand[0].demon.instanceId, remainingOffer.instanceId);
  assert.equal(result.soldCount, 1);
  assert.equal(result.purchaseCost, getRankedCardCost(purchasedOffer));
  assert.equal(
    run.state.rSouls,
    20 + Math.ceil(getRankedCardCost(soldReserve) / 2) - getRankedCardCost(purchasedOffer)
  );
});

test('enemy Skill Tree effects collapse into one Level Power summary', () => {
  const summary = getSnapshotSkillTreeSummary({
    lockedBuffs: {
      activeBuffs: [
        {
          source: 'skill_tree',
          effects: [
            { type: 'max_hp_flat', value: 12 },
            { type: 'max_hp_mult', value: 1.06 }
          ]
        },
        {
          source: 'skill_tree',
          effects: [{ type: 'speed_flat', value: 3 }]
        }
      ]
    }
  });

  assert.deepEqual(summary, {
    spentPoints: 1,
    bonuses: { maxHpFlat: 12, maxHpPercent: 6, speedFlat: 3 }
  });
});
