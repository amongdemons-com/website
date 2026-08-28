const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const map = require('../public/api/data/map.json');
const worldSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'app', 'js', 'world-ui.js'),
  'utf8'
);

test('requested World areas are blocked by rocks', () => {
  const expected = new Set([
    '12,-7', '13,-7', '12,-6', '13,-6', '15,-10', '15,-9', '14,-10'
  ]);
  const actual = new Set(
    map.blocks
      .filter((block) => block.type === 'rocks')
      .map((block) => `${block.x},${block.y}`)
  );

  expected.forEach((coordinate) => assert.equal(actual.has(coordinate), true, coordinate));
});

test('clicking the hunter tile clears pathing instead of opening Camp', () => {
  const currentTileBranch = worldSource.match(
    /if \(positionsEqual\(target, state\.position\)\) \{[\s\S]*?\n    \}/
  )?.[0] || '';

  assert.match(currentTileBranch, /clearRoutePreview\('blocked'\)/);
  assert.doesNotMatch(currentTileBranch, /appUrl\('\/camp'\)/);
});

function loadMarkerHarness({ atlasFails = false, defeated = false } = {}) {
  class Container {
    constructor() { this.children = []; this.position = { set() {} }; }
    addChild(child) { this.children.push(child); return child; }
    removeChildren() { return this.children.splice(0); }
    destroy() {}
  }
  class Graphics extends Container {
    circle(x, y, radius) { this.circleBounds = { x, y, radius }; return this; }
    ellipse() { return this; }
    fill() { return this; }
    stroke() { return this; }
    poly() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
  }
  class Sprite extends Container {
    constructor(texture) { super(); this.texture = texture; this.anchor = { set: value => { this.anchorValue = value; } }; }
  }
  class Rectangle {
    constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
  }
  class Texture {
    constructor(options) { Object.assign(this, options); }
  }
  const requests = [];
  const atlas = { source: { id: 'shared-map-atlas' } };
  const context = {
    window: { PIXI: { Container, Graphics, Sprite, Rectangle, Texture, Assets: {
      async load(url) {
        requests.push(url);
        if (url.includes('map-atlas.webp')) {
          if (atlasFails) throw new Error('Atlas unavailable');
          return atlas;
        }
        return { source: url };
      }
    } } },
    state: { encounterTextures: new Map(), bossTextures: new Map(), demonBackdropTextures: new Map(), bossLayer: new Container(), bosses: [] },
    tileCenter: tile => ({ x: tile.x * 64, y: tile.y * 64 }),
    rarityHex: () => 0xfac51c,
    seededRng: () => () => 0.5,
    isEncounterUnlocked: () => defeated,
    invalidateWorldEffects() {},
    console: { warn() {} }
  };
  const atlasSource = fs.readFileSync(path.join(__dirname, '../public/app/js/generated/demon-map-atlas.js'), 'utf8');
  const functions = ['getDemonMarkerBackdropType', 'addDemonMarkerPortrait', 'createEncounterMarkerNode', 'drawBossMarkers', 'getDemonMapAtlasTextures']
    .map(name => {
      const source = worldSource.match(new RegExp(`  (?:async )?function ${name}\\([\\s\\S]*?\\n  \\}`))?.[0];
      assert.ok(source, `Missing production function ${name}`);
      return source;
    }).join('\n');
  vm.runInNewContext(`${atlasSource.replaceAll('export const ', 'const ')}\nlet demonMapAtlasPromise = null;\n${functions}`, context);
  return { context, requests, atlas, Container };
}

test('world markers load all type backdrops from the shared atlas and match the actual sprite', async () => {
  const { context, requests, atlas } = loadMarkerHarness();
  await context.getDemonMapAtlasTextures();
  await context.getDemonMapAtlasTextures();
  assert.equal(requests.length, 1, 'Backgrounds reuse the portrait atlas request');
  assert.equal(context.state.demonBackdropTextures.size, 11);
  const backdrops = require('../docs/art/card-backdrops.json');
  for (const variant of backdrops.variants) {
    const texture = context.state.demonBackdropTextures.get(variant.typeId);
    assert.equal(texture.source, atlas.source);
    for (const id of variant.demonIds) {
      const typeId = context.getDemonMarkerBackdropType({ imageUrl: `/app/images/demons/map/${id}.webp?v=test`, typeId: 99 });
      assert.equal(typeId, variant.typeId);
    }
  }
  assert.equal(context.getDemonMarkerBackdropType({ typeId: '7' }), 7);
  assert.equal(context.getDemonMarkerBackdropType({ imageUrl: '/custom.png' }), 11);
});

test('encounter and boss circles place the backdrop under the demon inside one circular mask', async () => {
  const { context, Container } = loadMarkerHarness({ defeated: true });
  await context.getDemonMapAtlasTextures();
  const keyDemon = { imageUrl: '/app/images/demons/map/17.webp?v=test', rarity: 'legendary' };
  const portrait = { id: 'poison-demon' };
  context.state.encounterTextures.set(keyDemon.imageUrl, portrait);
  context.state.bossTextures.set(keyDemon.imageUrl, portrait);
  const encounterNode = context.createEncounterMarkerNode({ id: 'spot', x: 1, y: 2, keyDemon });
  context.state.bosses = [{ id: 'boss', x: 3, y: 4, keyDemon }];
  context.drawBossMarkers();
  const bossNode = context.state.bossLayer.children[0];
  for (const [node, radius] of [[encounterNode, 22], [bossNode, 25]]) {
    const art = node.children.find(child => child.mask);
    assert.ok(art, 'The composite portrait has a circular mask');
    assert.equal(art.mask.circleBounds.radius, radius);
    assert.equal(art.children[0].texture, context.state.demonBackdropTextures.get(3));
    assert.equal(art.children[1].texture, portrait);
    assert.equal(art.children[1].width, radius * 2);
    assert.equal(art.children[1].height, radius * 2);
    assert.equal(art.children[1].anchorValue, 0.5);
    assert.notEqual(node.children[0], art, 'The outer ring remains separate');
  }
  assert.notEqual(encounterNode.children.at(-1), encounterNode.children.find(child => child.mask), 'Defeated badge stays above the portrait');
  const missingPortrait = new Container();
  assert.equal(context.addDemonMarkerPortrait(missingPortrait, keyDemon, null, 22), true);
  assert.equal(missingPortrait.children.find(child => child.mask).children.length, 1);
});

test('world backdrop loading falls back to individual WebPs if the atlas fails', async () => {
  const { context, requests } = loadMarkerHarness({ atlasFails: true });
  const portraits = await context.getDemonMapAtlasTextures();
  assert.equal(portraits.size, 0);
  assert.equal(context.state.demonBackdropTextures.size, 11);
  assert.equal(requests.length, 12);
  assert.ok(requests.slice(1).every(url => /demon-card-type-\d+\.webp\?v=/.test(url)));
});
