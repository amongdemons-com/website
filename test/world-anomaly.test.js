const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const map = require('../public/api/data/map.json');
const demonTypes = require('../public/api/data/demon-types.json');
const { renderEventsPage } = require('../lib/seo-pages');
const worldHtml = fs.readFileSync(path.join(__dirname, '../public/app/world.html'), 'utf8');
const worldUi = fs.readFileSync(path.join(__dirname, '../public/app/js/world-ui.js'), 'utf8');
const worldCss = fs.readFileSync(path.join(__dirname, '../public/app/css/world.css'), 'utf8');
const patchNotes = fs.readFileSync(path.join(__dirname, '../patch-notes.md'), 'utf8');
const {
  getBaseHealingAmount,
  selectActionAbilityType,
  simulateFight
} = require('../public/api/lib/combat');
const {
  ANOMALY_ECHO_CHANCE_PERCENT,
  ANOMALY_EVENT_NAME,
  ANOMALY_MAX_FLOOR,
  ANOMALY_SOUL_COST,
  ANOMALY_STATS,
  ANOMALY_X,
  ANOMALY_Y,
  abandonWorldAnomaly,
  continueWorldAnomaly,
  createAnomalyEnemy,
  createAnomalyFloorEnemies,
  getUncollectedMythicTypeIds,
  isAtAnomalyAltar,
  leaveWorldAnomaly,
  resolveAnomalyReward,
  resolveAnomalyRewardRolls,
  summonWorldAnomaly
} = require('../public/api/lib/world-anomaly');

test('the Altar of Many Voices occupies Area 4, 0', () => {
  const event = map.events.find((candidate) => candidate.type === 'altar-many-voices');
  assert.deepEqual([ANOMALY_X, ANOMALY_Y], [4, 0]);
  assert.equal(ANOMALY_SOUL_COST, 5_000);
  assert.equal(worldUi.includes('const ANOMALY_FALLBACK_COST = 5_000;'), true);
  assert.equal(event?.title, ANOMALY_EVENT_NAME);
  assert.equal(event?.x, ANOMALY_X);
  assert.equal(event?.y, ANOMALY_Y);
  assert.equal(event?.description, 'An altar humming with voices that do not belong together.');
  assert.equal(isAtAnomalyAltar(event), true);
  assert.equal(isAtAnomalyAltar({ x: 3, y: 0 }), false);
});

test('Patch 4 announces The Anomaly ritual and Mythic Echo reward', () => {
  assert.match(patchNotes, /Altar of Many Voices at Area 4, 0/);
  assert.match(patchNotes, /Offer 10,000 Souls to face The\s+Anomaly/);
  assert.match(patchNotes, /Defeating each Anomaly gives a 25% chance/);
});

test('Patch 5 announces the reduced Altar offering', () => {
  const patch = patchNotes.slice(
    patchNotes.indexOf('## Patch 5'),
    patchNotes.indexOf('## Patch 4')
  );

  assert.match(patch, /Altar of Many Voices offering from 10,000 to 5,000 Souls/);
});

test('the world events guide includes the Altar of Many Voices', () => {
  const page = renderEventsPage();
  assert.match(page, /Altar of Many Voices/);
  assert.match(page, /Area 4, 0/);
  assert.match(page, /5k Souls/);
  assert.match(page, /25% per Anomaly/);
  assert.match(page, /9 kinds of world events/);
  assert.match(page, /\/app\/images\/events\/marker-anomaly-altar\.webp/);
  assert.match(page, /data-lucide="messages-square"/);
});

test('the map, sidebar, and modal share one altar SVG and arrival reopens the ritual', () => {
  assert.equal(worldHtml.includes('/app/images/assets/anomaly-altar.svg'), true);
  assert.equal(worldUi.includes("const ANOMALY_ALTAR_SVG_URL = '/app/images/assets/anomaly-altar.svg'"), true);
  assert.equal(worldUi.includes('new Pixi.Sprite(state.anomalyAltarTexture)'), true);
  assert.equal(worldUi.includes('onHidden: openWorldArrivalEventAfterTravel'), true);
  assert.match(worldUi, /if \(getAnomalyAltarAt\(state\.position\)\) state\.anomalyAutoOpened = false;/);
});

test('the altar presentation follows shared modal, merchant card, and Soul amount patterns', () => {
  const modal = worldHtml.match(/<div class="modal fade world-anomaly-modal"[\s\S]+?<div class="modal fade dungeon-modal world-battle-modal"/)?.[0] || '';
  assert.match(modal, /class="btn btn-secondary"[^>]*>Leave<\/button>/);
  assert.equal(modal.includes('>Cancel</button>'), false);
  assert.equal(worldUi.includes('world-sidebar-card world-merchant-card world-anomaly-card'), true);
  assert.equal(worldUi.includes('<dt>Floors</dt>'), true);
  assert.equal(worldUi.includes('<dt>Learnings</dt>'), false);
  assert.match(worldUi, /% per Anomaly/);
  assert.doesNotMatch(worldUi, /Your team stays locked but fully heals between floors/);
  assert.match(worldUi, /Continue to Floor/);
  assert.match(worldUi, /Leaving or reloading this page counts as a loss/);
  assert.doesNotMatch(worldUi, /before choosing Leave counts as a loss/);
  assert.match(worldCss, /\.world-anomaly-known \.world-anomaly-chance \{\s*color: #fac51c;/);
  assert.equal(worldUi.includes('Voice Shard'), false);
  assert.equal(worldUi.includes('renderSoulAmount(balance || 0, { compact: true })'), true);
  assert.match(worldUi, /function formatCompactNumber\(value\)[\s\S]+?suffix: 'k'/);
  assert.match(worldCss, /\.world-anomaly-modal \.modal-content \{\s*background: linear-gradient\([^;]+#080d0f\);/);
  assert.match(worldCss, /\.world-anomaly-soul-value \.soul-amount \{\s*color: #fff;/);
  assert.match(worldCss, /\.world-anomaly-soul-value \{\s*vertical-align: middle;/);
  assert.match(worldCss, /\.world-anomaly-card \.world-anomaly-card-portrait img \{\s*width: 100%;\s*height: 100%;[^}]*object-fit: contain;/);
});

test('The Anomaly is rarityless, enemy-only, and uses the approved fixed stats', () => {
  const anomaly = createAnomalyEnemy();
  assert.deepEqual(ANOMALY_STATS, { hp: 5_000, atk: 150, speed: 20 });
  assert.equal(anomaly.maxHp, 5_000);
  assert.equal(anomaly.atk, 150);
  assert.equal(anomaly.speed, 20);
  assert.equal(anomaly.retaliationAbilityTypeId, 8);
  assert.equal(anomaly.hideRarity, true);
  assert.equal(anomaly.rarity, '');
  assert.deepEqual(anomaly.abilityTypeIds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test('The Anomaly rerolls a healer voice at full health and can select it after taking damage', () => {
  const anomaly = createAnomalyEnemy();
  const healerRoll = () => 9.2 / 11;

  assert.notEqual(selectActionAbilityType(healerRoll, anomaly, demonTypes), 10);
  anomaly.hp -= 1;
  assert.equal(selectActionAbilityType(healerRoll, anomaly, demonTypes), 10);
  assert.equal(getBaseHealingAmount(anomaly), 250);
});

test('borrowed attacks retain their type in the combat log for replay VFX and sound', () => {
  const anomaly = {
    ...createAnomalyEnemy(),
    hp: 1_000,
    maxHp: 1_000,
    speed: 100,
    abilityTypeIds: [4]
  };
  const player = [{
    instanceId: 'hunter-demon',
    typeId: 1,
    rarity: 'mythic',
    hp: 2_000,
    maxHp: 2_000,
    atk: 10,
    speed: 1,
    position: 'front'
  }];
  const result = simulateFight(() => 0, player, [anomaly], { demonTypes });
  const attack = result.combatLog.find((entry) => entry.attacker === 'the-anomaly');

  assert.equal(attack.abilityTypeId, 4);
  assert.equal(attack.targeting, 'all');
});

test('The Anomaly permanently retaliates with Type 8 regardless of its attack voice', () => {
  const anomaly = {
    ...createAnomalyEnemy(),
    abilityTypeIds: [4],
    hp: 1_000,
    maxHp: 1_000,
    speed: 1
  };
  const player = [{
    instanceId: 'hunter-attacker',
    typeId: 1,
    rarity: 'mythic',
    hp: 1_000,
    maxHp: 1_000,
    atk: 10,
    speed: 100,
    position: 'front'
  }];
  const result = simulateFight(() => 0, player, [anomaly], { demonTypes });
  const retaliation = result.combatLog.find((entry) => (
    entry.attacker === 'the-anomaly' && entry.effect === 'retaliate'
  ));

  assert.equal(retaliation?.abilityTypeId, 8);
  assert.equal(retaliation?.target, 'hunter-attacker');
  assert.equal(retaliation?.dmg, 150);
});

test('Anomaly floors spawn one distinct Anomaly per floor through Floor 9', () => {
  for (let floor = 1; floor <= ANOMALY_MAX_FLOOR; floor += 1) {
    const enemies = createAnomalyFloorEnemies(floor);
    assert.equal(enemies.length, floor);
    assert.equal(new Set(enemies.map((enemy) => enemy.instanceId)).size, floor);
    assert.equal(new Set(enemies.map((enemy) => enemy.formationSlot)).size, floor);
    assert.equal(enemies.every((enemy) => enemy.atk === 150), true);
    assert.equal(enemies.every((enemy) => (
      enemy.position === (enemy.formationSlot % 3 === 0 ? 'front' : 'back')
    )), true);
  }
});

test('each defeated Anomaly has an independent 25% Mythic Echo chance', () => {
  const rolls = [ANOMALY_ECHO_CHANCE_PERCENT - 1, 1];
  const reward = resolveAnomalyReward({
    randomInt: () => rolls.shift(),
    candidateTypeIds: [2, 7]
  });

  assert.equal(reward.echoAwarded, true);
  assert.equal(reward.source, 'chance');
  assert.equal(reward.typeId, 7);
  assert.equal(reward.chancePercent, 25);
});

test('Floor 3 makes three Echo rolls and prioritizes different missing species', () => {
  const randomValues = [0, 1, 99, 0, 0];
  const rewards = resolveAnomalyRewardRolls(3, {
    randomInt: () => randomValues.shift(),
    candidateTypeIds: [2, 7]
  });

  assert.equal(rewards.length, 3);
  assert.deepEqual(rewards.map((reward) => reward.echoAwarded), [true, false, true]);
  assert.deepEqual(rewards.map((reward) => reward.typeId), [7, null, 2]);
  assert.deepEqual(rewards.map((reward) => reward.roll), [1, 2, 3]);
});

test('Anomaly floor results handle zero or multiple Echoes in a one-line reward slider', () => {
  assert.match(worldUi, /function getAnomalyVictoryText\(reward = null,[\s\S]*?reward\?\.echoes/);
  assert.match(worldUi, /No Mythic Echo/);
  assert.match(worldUi, /rolls succeeded/);
  assert.match(worldUi, /hostRect\.height - resultHeight - 8/);
  assert.match(worldUi, /layer\.classList\.contains\('is-anomaly-result'\)[\s\S]*?removeProperty\('--world-dungeon-result-top'\)/);
  assert.match(worldUi, /mobileResultLayout \? gridTop : Math\.min\(gridTop, fullyVisibleTop\)/);
  assert.match(worldUi, /const hasSlider = echoes\.length > 4/);
  assert.match(worldUi, /data-world-anomaly-reward-scroll="-1"/);
  assert.match(worldUi, /data-world-anomaly-reward-scroll="1"/);
  assert.match(worldUi, /class="world-anomaly-reward-echo"[\s\S]*?data-tooltip=/);
  assert.match(worldUi, /data-tooltip-title="\$\{escapeAttribute\(`Mythic \$\{species\} Echo`\)\}"/);
  assert.match(worldUi, /data-world-anomaly-tooltip-title/);
  assert.match(worldUi, /data-world-anomaly-tooltip-status/);
  assert.match(worldUi, /data-world-anomaly-tooltip-total/);
  assert.match(worldUi, /data-world-anomaly-reward-tooltip role="tooltip"/);
  assert.match(worldCss, /\.world-anomaly-reward-list/);
  assert.match(worldCss, /\.world-anomaly-reward-track \{[\s\S]*?display: flex;/);
  assert.match(worldCss, /\.world-anomaly-reward-echo \{[\s\S]*?flex: 0 0 calc\(\(100% - 1\.14rem\) \/ 4\);/);
  assert.match(worldCss, /\.world-anomaly-reward-tooltip \{[\s\S]*?background: rgba\(3, 9, 11, 0\.96\);/);
  assert.match(worldCss, /\.world-dungeon-result \.world-anomaly-reward-tooltip \.world-anomaly-reward-tooltip-title \{[\s\S]*?color: #e25041;[\s\S]*?font-size: 0\.78rem;/);
  assert.match(worldCss, /\.world-anomaly-reward-tooltip-status \{[\s\S]*?color: #8ed6a6;/);
  assert.match(worldCss, /\.world-anomaly-reward-tooltip-total \{[\s\S]*?color: #e8c76a;/);
  assert.match(worldCss, /\.world-dungeon-result-layer\.is-anomaly-result \{[\s\S]*?top: 0;[\s\S]*?place-items: center;[\s\S]*?pointer-events: auto;/);
  assert.match(worldCss, /\.world-dungeon-result\.is-anomaly-modal \{[\s\S]*?width: min\(28rem, 100%\);[\s\S]*?border-radius: 12px;/);
  assert.match(worldCss, /@media \(max-width: 899\.98px\) \{[\s\S]*?\.world-dungeon-result-layer:not\(\.is-anomaly-result\) \{[\s\S]*?align-items: start;[\s\S]*?overflow-y: auto;[\s\S]*?\.world-anomaly-reward-tooltip \{[\s\S]*?position: static;[\s\S]*?display: none;[\s\S]*?\.world-anomaly-reward-tooltip\.is-visible \{[\s\S]*?display: block;/);
  assert.match(worldUi, /role="dialog" aria-modal="true" aria-labelledby="worldAnomalyResultTitle"/);
  assert.match(worldUi, /title: 'Anomaly run ended\.'/);
  assert.match(worldUi, /action: 'A new offering starts again at Floor 1\.'/);
  const echoHoverRule = /\.world-anomaly-reward-echo:hover,[\s\S]*?\.world-anomaly-reward-echo:focus-visible \{([^}]*)\}/.exec(worldCss)?.[1] || '';
  assert.doesNotMatch(echoHoverRule, /transform|translateY/);
  assert.doesNotMatch(worldUi, /Learning gained|Learnings complete/);
  const rewardRule = /\.world-anomaly-reward\s*\{([\s\S]*?)\n\}/.exec(worldCss)?.[1] || '';
  assert.match(rewardRule, /rgba\(221, 177, 66, 0\.46\)/);
  assert.match(rewardRule, /rgba\(82, 58, 13, 0\.5\)/);
  assert.doesNotMatch(rewardRule, /167, 79, 224|64, 16, 84/);
});

test('uncollected Mythics exclude species already owned at Mythic rarity', async () => {
  const queries = [];
  const queryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      return [[{ typeId: 1 }, { typeId: 6 }, { typeId: 11 }]];
    }
  };

  const typeIds = await getUncollectedMythicTypeIds('hunter-one', queryable);

  assert.deepEqual(typeIds, [2, 3, 4, 5, 7, 8, 9, 10]);
  assert.deepEqual(queries[0].params, ['hunter-one']);
  assert.match(queries[0].sql, /LOWER\(rarity\) = 'mythic'/);
});

test('Anomaly Floor 1 locks the team, restores health, and can award a Mythic Echo', async () => {
  const updates = [];
  const collectedMythicTypeIds = Array.from({ length: 10 }, (_, index) => index + 1);
  const connection = createAnomalyConnection(updates, { collectedMythicTypeIds });
  const echoes = [];
  const result = await summonWorldAnomaly(
    { id: 'hunter-one', level: 50 },
    'ritual:00000000-0000-4000-8000-000000000002',
    {
      connection,
      playerTeam: [{ instanceId: 'player', typeId: 1, hp: 10, maxHp: 10, atk: 1, speed: 1 }],
      playerBuffs: {},
      demonTypes,
      simulateFight: () => createFightResult('player', { playerHp: 4 }),
      randomInt: () => 0,
      addEcho: async (playerId, demon) => {
        echoes.push({ playerId, demon });
        return { typeId: demon.typeId, rarity: demon.rarity, species: 'Vee-Scol' };
      }
    }
  );

  assert.equal(result.reward.rolls, 1);
  assert.equal(result.reward.successfulRolls, 1);
  assert.equal(result.reward.echoes[0].typeId, 11);
  assert.equal(result.battle.floor, 1);
  assert.equal(result.anomalyRun.floor, 1);
  assert.equal(result.anomalyRun.maxFloor, ANOMALY_MAX_FLOOR);
  assert.equal(result.anomalyRun.canContinue, true);
  const ritualUpdate = updates.find((entry) => /UPDATE player_anomaly_rituals/.test(entry.sql));
  assert.equal(ritualUpdate.params[0], 1);
  assert.equal(JSON.parse(ritualUpdate.params[5])[0].hp, 10);
  assert.deepEqual(echoes, [{
    playerId: 'hunter-one',
    demon: { typeId: 11, rarity: 'mythic' }
  }]);
});

test('continuing fully heals the locked team, starts Floor 2, and does not charge Souls again', async () => {
  const updates = [];
  const runId = 'ritual:00000000-0000-4000-8000-000000000003';
  const connection = createAnomalyConnection(updates, {
    activeRunId: runId,
    activeFloor: 1,
    activeTeam: JSON.stringify([{ instanceId: 'player', typeId: 1, hp: 4, maxHp: 10, atk: 1, speed: 1 }])
  });
  let receivedTeam;
  let receivedEnemies;
  const result = await continueWorldAnomaly(
    { id: 'hunter-one', level: 50 },
    runId,
    {
      connection,
      playerBuffs: {},
      demonTypes,
      simulateFight: (rng, team, enemies) => {
        receivedTeam = team;
        receivedEnemies = enemies;
        return createFightResult('player', { playerHp: 2 });
      },
      randomInt: () => 0,
      addEcho: async (playerId, demon) => ({
        typeId: demon.typeId,
        rarity: demon.rarity,
        species: 'Baobaw'
      })
    }
  );

  assert.equal(receivedTeam[0].hp, 10);
  assert.equal(receivedEnemies.length, 2);
  assert.equal(result.battle.floor, 2);
  assert.equal(result.reward.rolls, 2);
  assert.equal(result.reward.successfulRolls, 2);
  assert.equal(result.reward.echoes.length, 2);
  assert.equal(result.anomalyRun.canContinue, true);
  assert.equal(updates.some((entry) => /souls = souls -/.test(entry.sql)), false);
});

test('clearing Floor 3 makes three rolls and can award multiple Mythic Echoes', async () => {
  const updates = [];
  const runId = 'ritual:00000000-0000-4000-8000-000000000006';
  const connection = createAnomalyConnection(updates, {
    activeRunId: runId,
    activeFloor: 2,
    collectedMythicTypeIds: [1, 3, 4, 5, 6, 8, 9, 10, 11],
    activeTeam: JSON.stringify([{ instanceId: 'player', typeId: 1, hp: 2, maxHp: 10, atk: 1, speed: 1 }])
  });
  const randomValues = [0, 1, 99, 0, 0];
  const echoes = [];
  const result = await continueWorldAnomaly(
    { id: 'hunter-one', level: 50 },
    runId,
    {
      connection,
      playerBuffs: {},
      demonTypes,
      simulateFight: () => createFightResult('player', { playerHp: 3 }),
      randomInt: () => randomValues.shift(),
      addEcho: async (playerId, demon) => {
        echoes.push({ playerId, demon });
        return { ...demon, species: demon.typeId === 2 ? 'Baobaw' : 'Plague Ravager' };
      }
    }
  );

  assert.equal(result.reward.rolls, 3);
  assert.equal(result.reward.successfulRolls, 2);
  assert.deepEqual(result.reward.echoes.map((echo) => echo.typeId), [7, 2]);
  assert.deepEqual(result.reward.results.map((reward) => reward.echoAwarded), [true, false, true]);
  assert.equal(echoes.length, 2);
  assert.equal('voiceShards' in result.anomaly, false);
  const update = updates.find((entry) => /UPDATE player_anomaly_rituals/.test(entry.sql));
  assert.equal(update.sql.includes('voice_shards'), false);
  assert.equal(JSON.parse(update.params[4])[0].hp, 10);
});

test('clearing Floor 9 awards its Echo and completes the Anomaly run', async () => {
  const updates = [];
  const runId = 'ritual:00000000-0000-4000-8000-000000000009';
  const connection = createAnomalyConnection(updates, {
    activeRunId: runId,
    activeFloor: 8,
    activeTeam: JSON.stringify([{ instanceId: 'player', typeId: 1, hp: 4, maxHp: 10, atk: 1, speed: 1 }])
  });
  const result = await continueWorldAnomaly(
    { id: 'hunter-one', level: 50 },
    runId,
    {
      connection,
      playerBuffs: {},
      demonTypes,
      simulateFight: () => createFightResult('player', { playerHp: 1 }),
      randomInt: () => 0,
      addEcho: async (playerId, demon) => ({
        typeId: demon.typeId,
        rarity: demon.rarity,
        species: 'Baobaw'
      })
    }
  );

  assert.equal(result.battle.floor, ANOMALY_MAX_FLOOR);
  assert.equal(result.reward.rolls, ANOMALY_MAX_FLOOR);
  assert.equal(result.reward.successfulRolls, ANOMALY_MAX_FLOOR);
  assert.equal(result.anomalyRun.status, 'completed');
  assert.equal(result.anomalyRun.canContinue, false);
  assert.equal(result.anomalyRun.canLeave, false);
  const update = updates.find((entry) => /UPDATE player_anomaly_rituals/.test(entry.sql));
  assert.equal(update.params[2], null);
  assert.equal(update.params[3], 0);
  assert.equal(update.params[4], null);
});

test('leaving after a cleared floor ends the run without recording a loss', async () => {
  const updates = [];
  const runId = 'ritual:00000000-0000-4000-8000-000000000005';
  const connection = createAnomalyConnection(updates, {
    activeRunId: runId,
    activeFloor: 5,
    activeTeam: '[]'
  });
  const result = await leaveWorldAnomaly('hunter-one', runId, { connection });

  assert.equal(result.ended, true);
  assert.equal(result.lost, false);
  assert.equal(result.floor, 5);
  const update = updates.find((entry) => /UPDATE player_anomaly_rituals/.test(entry.sql));
  assert.equal(update.params[0], 0);
  assert.match(update.sql, /active_run_id = NULL/);
});

test('abandoning an active Anomaly run clears it and records a loss', async () => {
  const updates = [];
  const runId = 'ritual:00000000-0000-4000-8000-000000000004';
  const connection = createAnomalyConnection(updates, {
    activeRunId: runId,
    activeFloor: 3,
    activeTeam: '[]'
  });
  const result = await abandonWorldAnomaly('hunter-one', runId, { connection });

  assert.equal(result.ended, true);
  assert.equal(result.lost, true);
  assert.equal(result.floor, 3);
  const update = updates.find((entry) => /UPDATE player_anomaly_rituals/.test(entry.sql));
  assert.equal(update.params[0], 1);
  assert.match(update.sql, /active_run_id = NULL/);
});

test('defeat commits the non-refundable Soul cost, records a loss, and ends the run', async () => {
  const updates = [];
  const connection = createAnomalyConnection(updates);
  const result = await summonWorldAnomaly(
    { id: 'hunter-one', level: 50 },
    'ritual:00000000-0000-4000-8000-000000000001',
    {
      connection,
      playerTeam: [{ instanceId: 'player', typeId: 1, hp: 10, maxHp: 10, atk: 1, speed: 1 }],
      playerBuffs: {},
      demonTypes,
      seed: 1,
      simulateFight: () => createFightResult('enemy')
    }
  );

  assert.equal(result.player.souls, 50_000 - ANOMALY_SOUL_COST);
  assert.equal(result.anomaly.attempts, 1);
  assert.equal(result.anomaly.losses, 1);
  assert.equal(result.anomalyRun.status, 'defeated');
  assert.equal(result.anomalyRun.canContinue, false);
  assert.equal(result.reward, null);
  assert.equal('voiceShards' in result.anomaly, false);
  const ritualUpdate = updates.find((entry) => /UPDATE player_anomaly_rituals/.test(entry.sql));
  assert.equal(ritualUpdate.params[0], 0);
  assert.equal(ritualUpdate.params[1], 1);
  assert.equal(ritualUpdate.sql.includes('voice_shards'), false);
  assert.equal(updates.some((entry) => entry.sql.includes('souls = souls -') && entry.params[0] === ANOMALY_SOUL_COST), true);
  assert.equal(connection.committed, true);
});

function createAnomalyConnection(updates, ritual = {}) {
  return {
    committed: false,
    async beginTransaction() {},
    async commit() { this.committed = true; },
    async rollback() {},
    async query(sql, params = []) {
      updates.push({ sql, params });
      if (/SELECT p\.\*/.test(sql)) {
        return [[{
          id: 'hunter-one',
          username: 'HunterOne',
          level: 50,
          xp: 0,
          souls: 50_000,
          highest_floor: 0,
          pvp_wins: 0,
          pvp_losses: 0,
          is_guest: 0,
          unlocks: '[]'
        }]];
      }
      if (/FROM player_world_positions/.test(sql)) return [[{ x: ANOMALY_X, y: ANOMALY_Y }]];
      if (/SELECT attempts,/.test(sql)) {
        return [[{
          attempts: ritual.attempts || 0,
          victories: ritual.victories || 0,
          losses: ritual.losses || 0,
          lastRitualId: ritual.lastRitualId || null,
          activeRunId: ritual.activeRunId || null,
          activeFloor: ritual.activeFloor || 0,
          activeTeam: ritual.activeTeam || null
        }]];
      }
      if (/SELECT DISTINCT type_id AS typeId/.test(sql)) {
        return [(ritual.collectedMythicTypeIds || []).map((typeId) => ({ typeId }))];
      }
      if (/INSERT IGNORE INTO player_anomaly_rituals/.test(sql)) return [{ affectedRows: 1 }];
      if (/UPDATE players SET souls/.test(sql)) return [{ affectedRows: 1 }];
      if (/UPDATE player_anomaly_rituals/.test(sql)) return [{ affectedRows: 1 }];
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

function createFightResult(winner, options = {}) {
  const playerHp = winner === 'player' ? Math.max(1, Number(options.playerHp) || 4) : 0;
  const player = [{ instanceId: 'player', typeId: 1, hp: playerHp, maxHp: 10, atk: 1, speed: 1 }];
  return {
    winner,
    endReason: winner === 'player' ? 'victory' : 'defeat',
    ticks: 1,
    combatLog: [],
    playerTeamBefore: [{ ...player[0], hp: 10 }],
    enemyTeamBefore: [],
    playerTeam: player,
    enemyTeam: []
  };
}
