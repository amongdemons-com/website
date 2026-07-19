const { simulateFight } = require('../public/api/lib/combat');
const { createDemon } = require('../public/api/lib/demon-factory');
const {
  createDungeonEnemies,
  getDungeonConvergence,
  getDungeonEnemyTeamSize,
  getDungeonRarityWeights,
  getEnemyPressureMultipliers,
  getExpectedRarityMultiplier
} = require('../public/api/lib/dungeon-enemies');
const { getDemonTypes } = require('../public/api/lib/game-data');
const { createRng } = require('../public/api/lib/rng');

const FLOORS = [1, 3, 5, 10, 15, 18, 20, 25, 30, 35, 40, 50];
const CONVERGENCE_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const REFERENCE_RARITIES = ['rare', 'rare', 'epic', 'epic', 'legendary', 'legendary'];
const SAMPLE_COUNT = Math.max(10, Math.floor(Number(process.argv[2]) || 40));

async function main() {
  const demonTypes = await getDemonTypes();
  const referenceTeam = await createReferenceTeam();
  const rows = [];
  let previousHpBudget = 0;
  let previousAttackBudget = 0;
  let previousSpeedBudget = 0;
  let previousPactHpBudget = 0;

  for (const floor of FLOORS) {
    const weights = getDungeonRarityWeights(floor);
    const expectedRarity = getExpectedRarityMultiplier(weights);
    const pressure = getEnemyPressureMultipliers(floor, { rarityRebalanced: true });
    const pactPressure = getEnemyPressureMultipliers(floor, {
      rarityRebalanced: true,
      buffs: { active: ['many_below', 'crimson_standard', 'fallen_nobility'] }
    });
    const hpBudget = expectedRarity * pressure.hp;
    const attackBudget = expectedRarity * pressure.atk;
    const speedBudget = expectedRarity * pressure.speed;
    if (hpBudget + 0.0001 < previousHpBudget) {
      throw new Error(`Expected HP budget fell between milestone floors at ${floor}.`);
    }
    if (attackBudget + 0.0001 < previousAttackBudget) {
      throw new Error(`Expected Attack budget fell between milestone floors at ${floor}.`);
    }
    if (speedBudget + 0.0001 < previousSpeedBudget) {
      throw new Error(`Expected Speed budget fell between milestone floors at ${floor}.`);
    }
    if (pressure.speed > 1.8501) {
      throw new Error(`Enemy Speed pressure exceeded its 1.85x cap at floor ${floor}.`);
    }
    const pactHpBudget = expectedRarity * pactPressure.hp;
    if (pactHpBudget + 0.0001 < previousPactHpBudget || pactPressure.hp < pressure.hp) {
      throw new Error(`Active-Pact pressure was not monotonic at floor ${floor}.`);
    }
    if (pactPressure.speed > 1.8501) {
      throw new Error(`Active-Pact Speed pressure exceeded its 1.85x cap at floor ${floor}.`);
    }
    previousHpBudget = hpBudget;
    previousAttackBudget = attackBudget;
    previousSpeedBudget = speedBudget;
    previousPactHpBudget = pactHpBudget;

    const wins = await sampleReferenceWins(referenceTeam, demonTypes, floor);
    rows.push({
      floor,
      enemies: getDungeonEnemyTeamSize(floor, referenceTeam.length),
      expectedRarity: expectedRarity.toFixed(3),
      hpPressure: pressure.hp.toFixed(3),
      atkPressure: pressure.atk.toFixed(3),
      speedPressure: pressure.speed.toFixed(3),
      hpBudget: hpBudget.toFixed(3),
      attackBudget: attackBudget.toFixed(3),
      speedBudget: speedBudget.toFixed(3),
      wins,
      referenceWinRate: `${Math.round((wins / SAMPLE_COUNT) * 100)}%`
    });
  }

  if (rows.at(-1).wins > 0) {
    throw new Error('The fixed non-Mythic reference roster was not eventually overwhelmed.');
  }

  const deepWeights = getDungeonRarityWeights(30);
  if (!['common', 'uncommon', 'rare'].every((rarity) => Number(deepWeights[rarity]) > 0)) {
    throw new Error('Deep encounters lost one or more low rarities.');
  }

  const floor30 = rows.find((row) => row.floor === 30);
  const oldMythicHpBudget = 1.7 * (1 + (30 - 18) * 0.045);
  const redesignedRatio = Number(floor30.hpBudget) / oldMythicHpBudget;
  if (redesignedRatio < 0.97 || redesignedRatio > 1.03) {
    throw new Error(`Floor 30 HP budget drifted too far from the old Mythic baseline: ${redesignedRatio.toFixed(3)}.`);
  }

  console.log(`Reference roster: 6 demons (${REFERENCE_RARITIES.join(', ')}), ${SAMPLE_COUNT} seeded fights per floor.`);
  console.table(rows.map(({ wins, ...row }) => row));
  console.log('Floor 30 Convergence HP budgets (rarity x base Terror x temporary Host power):');
  console.table(CONVERGENCE_RARITIES.map((rarity) => {
    const convergence = getDungeonConvergence(30, rarity);
    const rarityPower = getExpectedRarityMultiplier({ [rarity]: 1 });
    const pressure = getEnemyPressureMultipliers(30, {
      rarityRebalanced: true,
      convergence
    });
    return {
      rarity,
      bonusTerror: convergence.bonusTerror,
      temporaryMultiplier: convergence.powerMultiplier.toFixed(3),
      hpBudget: (rarityPower * pressure.hp).toFixed(3)
    };
  }));
  console.log(`Floor 30 redesigned/old-Mythic HP budget ratio: ${redesignedRatio.toFixed(3)}.`);
}

async function createReferenceTeam() {
  const team = [];
  for (let index = 0; index < REFERENCE_RARITIES.length; index += 1) {
    team.push(await createDemon(createRng(91000 + index), {
      instanceId: `reference-${index + 1}`,
      typeId: index + 1,
      rarity: REFERENCE_RARITIES[index],
      position: index % 2 ? 'back' : 'front'
    }));
  }
  return team;
}

async function sampleReferenceWins(referenceTeam, demonTypes, floor) {
  let wins = 0;
  for (let sample = 0; sample < SAMPLE_COUNT; sample += 1) {
    const seed = (floor * 100003) + sample + 1;
    const enemies = await createDungeonEnemies(createRng(seed), floor, referenceTeam.length);
    const result = simulateFight(createRng(seed ^ 0x9e3779b9), referenceTeam, enemies, { demonTypes });
    if (result.winner === 'player') wins += 1;
  }
  return wins;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
