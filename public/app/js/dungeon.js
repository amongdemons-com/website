import { registerDungeonActions } from './dungeon/registry.js';
import { onReady } from './dungeon/utils.js';
import * as dom from './dungeon/dom.js';
import * as lifecycle from './dungeon/lifecycle.js?v=20260715-audio-v4';
import * as render from './dungeon/render.js?v=20260714-audio-v1';
import * as combat from './dungeon/combat.js?v=20260715-audio-v5';
import * as rewards from './dungeon/rewards.js?v=20260714-audio-v1';
import * as pacts from './dungeon/pacts.js?v=20260714-audio-v1';
import * as hand from './dungeon/hand.js?v=20260711-upgrade-swap-v2';
import * as recruit from './dungeon/recruit.js?v=20260706-stat-preview-v4';
import * as modals from './dungeon/modals.js?v=20260711-multi-select-v1';
import * as dragDrop from './dungeon/drag-drop.js?v=20260714-audio-v2';
import * as cards from './dungeon/cards.js?v=20260711-upgrade-glow-v2';
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
