const test = require('node:test');
const assert = require('node:assert/strict');

const { simulateFight } = require('../public/api/lib/combat');
const {
  applyPreBattleBuffs,
  applyRunBuffStatModifiers,
  normalizeCombatBuffState
} = require('../public/api/lib/combat-buffs');
const demonTypes = require('../public/api/data/demon-types.json');

function createDemon(instanceId, typeId, stats = {}) {
  return {
    instanceId,
    typeId,
    hp: stats.hp || 500,
    maxHp: stats.hp || 500,
    atk: stats.atk || 10,
    speed: stats.speed || 1,
    position: stats.position || 'front'
  };
}

function createSkillThornsBuff() {
  return {
    id: 'skill_thorns',
    name: 'Soulbound Thorns',
    effects: [
      { type: 'thorns_flat', value: 10 },
      { type: 'thorns_percent', value: 25 }
    ]
  };
}

const ALL_COMBAT_TYPES = [
  'dungeon',
  'ranked',
  'ambush',
  'hunt_test',
  'passive_hunt',
  'pvp_challenge',
  'world_boss'
];

test('skill-tree thorns do not make a non-thorns demon retaliate', () => {
  for (const typeId of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11]) {
    const fight = simulateFight(
      () => 0.5,
      [createDemon(`player-${typeId}`, typeId)],
      [createDemon('enemy-basic', 1, { atk: 20, speed: 100 })],
      {
        demonTypes,
        playerBuffs: { activeBuffs: [createSkillThornsBuff()] }
      }
    );

    const firstTickEffects = fight.combatLog
      .filter((entry) => entry.tick === 1)
      .map((entry) => entry.effect)
      .filter(Boolean);

    assert.deepEqual(firstTickEffects, [], `type ${typeId} reflected damage`);
  }
});

test('Thorn Garden does not grant retaliation to a non-thorns demon', () => {
  const fight = simulateFight(
    () => 0.5,
    [createDemon('player-basic', 1)],
    [createDemon('enemy-basic', 1, { atk: 20, speed: 100 })],
    {
      demonTypes,
      playerBuffs: { active: ['thorn_garden'] }
    }
  );

  const firstTickEffects = fight.combatLog
    .filter((entry) => entry.tick === 1)
    .map((entry) => entry.effect)
    .filter(Boolean);

  assert.deepEqual(firstTickEffects, []);
});

test('the thorns type applies skill-tree Thorns and Thorn Garden to one retaliation stat', () => {
  const fight = simulateFight(
    () => 0.5,
    [createDemon('player-thorns', 8, { atk: 20 })],
    [createDemon('enemy-basic', 1, { atk: 10, speed: 100 })],
    {
      demonTypes,
      playerBuffs: {
        active: ['thorn_garden'],
        activeBuffs: [createSkillThornsBuff()]
      }
    }
  );

  const counters = fight.combatLog.filter((entry) => entry.tick === 1 && entry.effect === 'retaliate');

  assert.deepEqual(counters.map((entry) => [entry.effect, entry.attacker, entry.target, entry.dmg]), [
    ['retaliate', 'player-thorns', 'enemy-basic', 53]
  ]);
  assert.equal(fight.playerTeamBefore[0].effectiveAtk, 53);
  assert.equal(fight.combatLog.some((entry) => entry.effect === 'thorns'), false);
});

test('retaliation always equals the displayed stat regardless of incoming attack damage', () => {
  const fightAt = (incomingDamage) => simulateFight(
    () => 0.5,
    [createDemon('player-thorns', 8, { atk: 12 })],
    [createDemon('enemy-basic', 1, { atk: incomingDamage, speed: 100 })],
    { demonTypes, playerBuffs: { active: ['thorn_garden'] } }
  );

  for (const incomingDamage of [18, 80]) {
    const fight = fightAt(incomingDamage);
    const retaliation = fight.combatLog.find((entry) => entry.tick === 1 && entry.effect === 'retaliate');

    assert.equal(fight.playerTeamBefore[0].effectiveAtk, 17);
    assert.equal(retaliation.dmg, 17);
    assert.equal(fight.combatLog.some((entry) => entry.effect === 'thorns'), false);
  }
});

test('every battle mode uses the displayed retaliation stat', () => {
  const playerBuffs = {
    active: ['thorn_garden'],
    activeBuffs: [createSkillThornsBuff()]
  };

  for (const combatType of ALL_COMBAT_TYPES) {
    const fight = simulateFight(
      () => 0.5,
      [createDemon('player-thorns', 8, { atk: 20 })],
      [createDemon('enemy-basic', 1, { atk: 10, speed: 100 })],
      { demonTypes, combatType, playerBuffs }
    );
    const displayedDamage = fight.playerTeamBefore[0].effectiveAtk;
    const retaliation = fight.combatLog.find((entry) => entry.tick === 1 && entry.effect === 'retaliate');

    assert.equal(displayedDamage, 53, `${combatType} preview`);
    assert.equal(retaliation.dmg, displayedDamage, `${combatType} retaliation`);
    assert.equal(fight.combatLog.some((entry) => entry.effect === 'thorns'), false, `${combatType} extra Thorns hit`);
  }
});

test('opponent-owned Thorns use their own displayed stat in PvP-style battles', () => {
  const enemyBuffs = {
    active: ['thorn_garden'],
    activeBuffs: [createSkillThornsBuff()]
  };
  const fight = simulateFight(
    () => 0.5,
    [createDemon('player-basic', 1, { atk: 10, speed: 100 })],
    [createDemon('enemy-thorns', 8, { atk: 20 })],
    { demonTypes, combatType: 'pvp_challenge', enemyBuffs }
  );
  const displayedDamage = fight.enemyTeamBefore[0].effectiveAtk;
  const retaliation = fight.combatLog.find((entry) => entry.tick === 1 && entry.effect === 'retaliate');

  assert.equal(displayedDamage, 53);
  assert.equal(retaliation.dmg, displayedDamage);
});

test('Ranked pre-battle previews match the shared combat result without double-applying buffs', () => {
  const playerBuffs = {
    active: ['thorn_garden'],
    activeBuffs: [createSkillThornsBuff()]
  };
  const playerTeam = [createDemon('ranked-thorns', 8, { atk: 20 })];
  const rankedPreview = applyPreBattleBuffs(playerTeam, playerBuffs)[0];
  const fight = simulateFight(
    () => 0.5,
    playerTeam,
    [createDemon('ranked-enemy', 1, { atk: 10, speed: 100 })],
    { demonTypes, combatType: 'ranked', playerBuffs }
  );
  const retaliation = fight.combatLog.find((entry) => entry.tick === 1 && entry.effect === 'retaliate');

  assert.equal(rankedPreview.effectiveAtk, 53);
  assert.equal(fight.playerTeamBefore[0].effectiveAtk, rankedPreview.effectiveAtk);
  assert.equal(retaliation.dmg, rankedPreview.effectiveAtk);
});

test('a Thorns card displays the complete retaliation damage as one number', () => {
  const previousWindow = global.window;
  global.window = {
    AmongDemons: {
      ui: {
        renderIcon: () => '<svg></svg>'
      }
    }
  };

  const cardModulePath = require.resolve('../public/app/js/demon-cards.js');
  try {
    delete require.cache[cardModulePath];
    require(cardModulePath);

    const html = global.window.AmongDemons.ui.renderCombatStats({
      typeId: 8,
      atk: 12,
      hp: 100,
      maxHp: 100,
      effectiveAtk: 17
    });

    assert.match(html, /title="Retaliation: 17"/);
    assert.match(html, />17<\/span>/);
    assert.doesNotMatch(html, /17 \+ Thorns/);
  } finally {
    delete require.cache[cardModulePath];
    global.window = previousWindow;
  }
});

test('a non-thorns attacker cannot reflect a thorns demon retaliation', () => {
  const fight = simulateFight(
    () => 0.5,
    [createDemon('chu-perk', 9, { atk: 20, speed: 100 })],
    [createDemon('enemy-thorns', 8, { atk: 18 })],
    {
      demonTypes,
      playerBuffs: {
        active: ['thorn_garden'],
        activeBuffs: [createSkillThornsBuff()]
      }
    }
  );

  const firstTick = fight.combatLog.filter((entry) => entry.tick === 1);
  assert.deepEqual(firstTick.map((entry) => [entry.effect || 'attack', entry.attacker, entry.target, entry.dmg]), [
    ['attack', 'chu-perk', 'enemy-thorns', 20],
    ['retaliate', 'enemy-thorns', 'chu-perk', 18]
  ]);
});

test('preview damage matches logged damage with stacked Pacts and skill-tree stats', () => {
  const playerBuffs = normalizeCombatBuffState({
    active: ['blood_pact', 'blood_pact', 'cursed_momentum'],
    activeBuffs: [
      {
        id: 'skill_force',
        name: 'Soulbound Force',
        effects: [
          { type: 'attack_flat', value: 16, singleTargetOnly: true },
          { type: 'attack_mult', value: 1.15, singleTargetOnly: true }
        ]
      },
      {
        id: 'boss_reward_shadow_focus',
        name: 'Void Sight',
        effects: [
          { type: 'direct_damage_mult', value: 1.25 }
        ]
      }
    ]
  });
  const run = {
    state: {
      buffs: { active: ['blood_pact', 'blood_pact', 'cursed_momentum'] },
      team: [createDemon('chu-perk', 9, { atk: 41, speed: 100 })]
    }
  };

  applyRunBuffStatModifiers(run);
  const preview = applyPreBattleBuffs(run.state.team, playerBuffs)[0];
  const fight = simulateFight(
    () => 0.5,
    run.state.team,
    [createDemon('target', 1, { hp: 500 })],
    { demonTypes, playerBuffs }
  );
  const directHit = fight.combatLog.find((entry) => !entry.effect && entry.attacker === 'chu-perk');

  assert.equal(preview.atk, 66);
  assert.equal(preview.effectiveAtk, 93);
  assert.equal(directHit.dmg, preview.effectiveAtk);
});
