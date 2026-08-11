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
  ANOMALY_PITY_SHARDS,
  ANOMALY_SOUL_COST,
  ANOMALY_STATS,
  ANOMALY_X,
  ANOMALY_Y,
  createAnomalyEnemy,
  getUncollectedMythicTypeIds,
  isAtAnomalyAltar,
  resolveAnomalyReward,
  summonWorldAnomaly
} = require('../public/api/lib/world-anomaly');

test('the Altar of Many Voices occupies Area 4, 0', () => {
  const event = map.events.find((candidate) => candidate.type === 'altar-many-voices');
  assert.deepEqual([ANOMALY_X, ANOMALY_Y], [4, 0]);
  assert.equal(ANOMALY_SOUL_COST, 10_000);
  assert.equal(worldUi.includes('const ANOMALY_FALLBACK_COST = 10_000;'), true);
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
  assert.match(patchNotes, /25% chance to award a random Mythic Echo/);
  assert.match(patchNotes, /guaranteed every fourth victory without an Echo/);
});

test('the world events guide includes the Altar of Many Voices', () => {
  const page = renderEventsPage();
  assert.match(page, /Altar of Many Voices/);
  assert.match(page, /Area 4, 0/);
  assert.match(page, /10k Souls/);
  assert.match(page, /25% Mythic Echo/);
  assert.doesNotMatch(page, /Guaranteed by 4 wins/);
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
  assert.equal(worldUi.includes('<dt>Learnings</dt>'), true);
  assert.equal(worldUi.includes('25)}%</dd>'), true);
  assert.equal(worldUi.includes('25)}% on victory'), false);
  assert.match(worldUi, /4 victories guarantee one Mythic Echo, drawn from species missing from your collection/);
  assert.match(worldCss, /\.world-anomaly-known \.world-anomaly-chance \{\s*color: #fac51c;/);
  assert.equal(worldUi.includes('Voice Shard'), false);
  assert.equal(worldUi.includes('renderSoulAmount(balance || 0, { compact: true })'), true);
  assert.match(worldUi, /function formatCompactNumber\(value\)[\s\S]+?suffix: 'k'/);
  assert.match(worldCss, /\.world-anomaly-modal \.modal-content \{\s*background: linear-gradient\([^;]+#080d0f\);/);
  assert.match(worldCss, /\.world-anomaly-soul-value \.soul-amount \{\s*color: #fff;/);
  assert.match(worldCss, /\.world-anomaly-soul-value \{\s*vertical-align: middle;/);
  assert.match(worldCss, /\.world-anomaly-card \.world-anomaly-card-portrait img \{\s*width: 110%;\s*height: 110%;/);
});

test('The Anomaly is rarityless, enemy-only, and uses the approved fixed stats', () => {
  const anomaly = createAnomalyEnemy();
  assert.deepEqual(ANOMALY_STATS, { hp: 10_000, atk: 250, speed: 35 });
  assert.equal(anomaly.maxHp, 10_000);
  assert.equal(anomaly.atk, 250);
  assert.equal(anomaly.speed, 35);
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
  assert.equal(getBaseHealingAmount(anomaly), 500);
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
  assert.equal(retaliation?.dmg, 250);
});

test('Anomaly victories have a 25% Mythic Echo roll and reset shards on success', () => {
  const rolls = [ANOMALY_ECHO_CHANCE_PERCENT - 1, 10];
  const reward = resolveAnomalyReward(3, { randomInt: () => rolls.shift() });

  assert.equal(reward.echoAwarded, true);
  assert.equal(reward.source, 'chance');
  assert.equal(reward.typeId, 11);
  assert.equal(reward.voiceShards, 0);
});

test('four failed reward rolls guarantee a uniformly selected Mythic Echo', () => {
  const rolls = [99, 0];
  const reward = resolveAnomalyReward(ANOMALY_PITY_SHARDS - 1, {
    randomInt: () => rolls.shift()
  });

  assert.equal(reward.echoAwarded, true);
  assert.equal(reward.source, 'pity');
  assert.equal(reward.typeId, 1);
  assert.equal(reward.voiceShards, 0);
});

test('Anomaly Echo rewards select only from the supplied uncollected Mythics', () => {
  const rolls = [0, 1];
  const reward = resolveAnomalyReward(0, {
    randomInt: () => rolls.shift(),
    candidateTypeIds: [2, 7]
  });

  assert.equal(reward.echoAwarded, true);
  assert.equal(reward.typeId, 7);
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

test('Anomaly victory awards an Echo from the remaining uncollected Mythics', async () => {
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
      simulateFight: () => createFightResult('player'),
      randomInt: () => 0,
      addEcho: async (playerId, demon) => {
        echoes.push({ playerId, demon });
        return { typeId: demon.typeId, rarity: demon.rarity, species: 'Vee-Scol' };
      }
    }
  );

  assert.equal(result.reward.typeId, 11);
  assert.deepEqual(echoes, [{
    playerId: 'hunter-one',
    demon: { typeId: 11, rarity: 'mythic' }
  }]);
});

test('defeat commits the non-refundable Soul cost without advancing pity', async () => {
  const updates = [];
  const connection = createAnomalyConnection(updates, { voiceShards: 2 });
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
  assert.equal(result.anomaly.voiceShards, 2);
  assert.equal(result.reward, null);
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
      if (/SELECT voice_shards/.test(sql)) {
        return [[{
          voiceShards: ritual.voiceShards || 0,
          attempts: ritual.attempts || 0,
          victories: ritual.victories || 0,
          lastRitualId: ritual.lastRitualId || null
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

function createFightResult(winner) {
  return {
    winner,
    endReason: winner === 'player' ? 'victory' : 'defeat',
    ticks: 1,
    combatLog: [],
    playerTeamBefore: [],
    enemyTeamBefore: [],
    playerTeam: [],
    enemyTeam: []
  };
}
