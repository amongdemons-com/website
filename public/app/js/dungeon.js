import { registerDungeonActions } from './dungeon/registry.js';
import { onReady } from './dungeon/utils.js';
import * as dom from './dungeon/dom.js';
import * as lifecycle from './dungeon/lifecycle.js?v=20260719-echo-convergence-v1';
import * as render from './dungeon/render.js?v=20260719-echo-convergence-v1';
import * as combat from './dungeon/combat.js?v=20260717-paused-skip-result-v1';
import * as rewards from './dungeon/rewards.js?v=20260719-echo-inventory-v2';
import * as pacts from './dungeon/pacts.js?v=20260716-primary-replay-controls-v1';
import * as hand from './dungeon/hand.js?v=20260711-upgrade-swap-v2';
import * as recruit from './dungeon/recruit.js?v=20260719-rarity-pacts-v1';
import * as modals from './dungeon/modals.js?v=20260719-echo-accessibility-v1';
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
