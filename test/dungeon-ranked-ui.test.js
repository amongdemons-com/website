const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');

test('a successful escape can continue after an earlier Ranked victory', async () => {
  const modalState = new Map();
  const calls = [];
  const harness = {
    state: {
      run: rankedResultRun(),
      combatLog: [],
      endNotice: null
    },
    elements: createElements(),
    actions: {
      async applyRunPayload(run) {
        harness.state.run = run;
      },
      async battle() {},
      async finishRun() {}
    },
    responses: [
      {
        nextFloor: 31,
        run: preparationRun(30)
      },
      {
        escaped: true,
        nextFloor: 41,
        rankedResult: rankedResult('enemy', -18, 982),
        run: preparationRun(40)
      }
    ],
    async api(url) {
      calls.push(url);
      return harness.responses.shift();
    },
    getModal(element) {
      if (!modalState.has(element)) {
        modalState.set(element, {
          hideCount: 0,
          show() {
            element.classList.add('show');
          },
          hide() {
            this.hideCount += 1;
            element.classList.remove('show');
          }
        });
      }
      return modalState.get(element);
    },
    messages: []
  };

  globalThis.__dungeonRankedUiHarness = harness;
  globalThis.window = {
    AmongDemons: {
      appUrl: (url) => url
    }
  };

  try {
    const rankedUi = await loadRankedUiModule();
    rankedUi.showRankedResultModal({
      result: harness.state.run.rankedEncounter.result,
      title: 'Ranked Victory'
    });
    await rankedUi.continueDungeonRankedResult();

    harness.state.run = {
      ...preparationRun(40),
      awaitingRecruit: false,
      rankedEncounter: {
        status: 'choice',
        floor: 40,
        opponent: { hunterName: 'Later Rival' }
      }
    };
    await rankedUi.tryDungeonRankedEscape();

    const resultModal = harness.getModal(harness.elements.dungeonRankedResultModal);
    const hideCountBeforeContinue = resultModal.hideCount;
    await rankedUi.continueDungeonRankedResult();

    assert.deepEqual(calls, [
      '/api/runs/run-a/ranked/continue',
      '/api/runs/run-a/ranked/escape'
    ]);
    assert.equal(resultModal.hideCount, hideCountBeforeContinue + 1);
    assert.equal(harness.elements.dungeonRankedResultModal.classList.contains('show'), false);
  } finally {
    delete globalThis.__dungeonRankedUiHarness;
    delete globalThis.window;
  }
});

async function loadRankedUiModule() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'public', 'app', 'js', 'dungeon', 'ranked.js')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    write: false,
    plugins: [{
      name: 'dungeon-ranked-ui-harness',
      setup(build) {
        build.onResolve({ filter: /^\.\/(registry|state|api|utils)\.js$/ }, (args) => ({
          path: args.path.slice(2, -3),
          namespace: 'ranked-ui-harness'
        }));
        build.onLoad({ filter: /.*/, namespace: 'ranked-ui-harness' }, (args) => ({
          contents: getHarnessModule(args.path),
          loader: 'js'
        }));
      }
    }]
  });
  const module = { exports: {} };
  Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require);
  return module.exports;
}

function getHarnessModule(name) {
  if (name === 'registry') {
    return 'export const dungeonActions = globalThis.__dungeonRankedUiHarness.actions;';
  }
  if (name === 'state') {
    return `
      export const state = globalThis.__dungeonRankedUiHarness.state;
      export const elements = globalThis.__dungeonRankedUiHarness.elements;
    `;
  }
  if (name === 'api') {
    return `
      export const api = (...args) => globalThis.__dungeonRankedUiHarness.api(...args);
      export const activeRunPath = (action = '') =>
        '/api/runs/' + encodeURIComponent(globalThis.__dungeonRankedUiHarness.state.run.runId) + (action ? '/' + action : '');
    `;
  }
  if (name === 'utils') {
    return `
      export const escapeHtml = (value) => String(value || '');
      export const getModal = (element) => globalThis.__dungeonRankedUiHarness.getModal(element);
      export const setMessage = (text, type) => globalThis.__dungeonRankedUiHarness.messages.push({ text, type });
      export const showError = (error) => { throw error; };
    `;
  }
  throw new Error(`Unexpected harness module: ${name}`);
}

function createElements() {
  return {
    dungeonRankedChoiceModal: createElement(),
    dungeonRankedChoiceUsername: createElement(),
    dungeonRankedChoiceFightBtn: createElement(),
    dungeonRankedChoiceEscapeBtn: createElement(),
    dungeonRankedChoiceEscapeLabel: createElement(),
    dungeonRankedChoiceChance: createElement(),
    dungeonRankedResultModal: createElement(),
    dungeonRankedResultTitle: createElement(),
    dungeonRankedResultRank: createElement(['ranked-rank']),
    dungeonRankedResultRankImage: createElement(),
    dungeonRankedResultDivision: createElement(),
    dungeonRankedResultDelta: createElement(),
    dungeonRankedResultSummary: createElement(),
    dungeonRankedResultContinueBtn: createElement()
  };
}

function createElement(initialClasses = []) {
  const classes = new Set(initialClasses);
  return {
    disabled: false,
    textContent: '',
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle(name, force) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
      contains: (name) => classes.has(name),
      forEach: (callback) => classes.forEach(callback)
    }
  };
}

function rankedResultRun() {
  return {
    runId: 'run-a',
    currentFloor: 30,
    rankedEncounter: {
      status: 'result',
      floor: 30,
      opponent: { hunterName: 'First Rival' },
      result: rankedResult('player', 18, 1018)
    }
  };
}

function preparationRun(currentFloor) {
  return {
    runId: 'run-a',
    currentFloor,
    awaitingRecruit: true
  };
}

function rankedResult(winner, delta, rating) {
  return {
    winner,
    delta,
    rating,
    division: 'Bronze II'
  };
}
