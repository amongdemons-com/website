import { registerDungeonActions } from './dungeon/registry.js';
import { onReady } from './dungeon/utils.js';
import * as dom from './dungeon/dom.js';
import * as lifecycle from './dungeon/lifecycle.js';
import * as render from './dungeon/render.js';
import * as combat from './dungeon/combat.js?v=20260627-fire-nova-v3';
import * as rewards from './dungeon/rewards.js';
import * as pacts from './dungeon/pacts.js';
import * as hand from './dungeon/hand.js';
import * as recruit from './dungeon/recruit.js';
import * as modals from './dungeon/modals.js';
import * as dragDrop from './dungeon/drag-drop.js';
import * as cards from './dungeon/cards.js';
import * as utils from './dungeon/utils.js';

registerDungeonActions({
  ...dom,
  ...lifecycle,
  ...render,
  ...combat,
  ...rewards,
  ...pacts,
  ...hand,
  ...recruit,
  ...modals,
  ...dragDrop,
  ...cards,
  ...utils
});

onReady(lifecycle.init);
