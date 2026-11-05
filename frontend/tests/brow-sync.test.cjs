const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { act, create } = require('react-test-renderer');

// Exercise the real React effects without WebGL, model downloads, or a backend.
function loadComponent(filename, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../src/components', filename), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require: name => mocks[name] || require(name),
    console: { log() {}, warn() {}, error() {} },
    window: { addEventListener() {}, removeEventListener() {} },
    fetch: async () => ({ ok: false }),
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
  }, { filename });
  return exports.default;
}

function setup(t, initialScore = 0) {
  const loads = [];
  const destroyedModels = [];
  const Display = loadComponent('Live2DModelDisplay.tsx', {
    'pixi.js': {
      Application: class {
        stage = { addChild() {} };
        screen = { width: 400, height: 600 };
        renderer = { on() {} };
        ticker = { add() {} };
        destroy() {}
      },
    },
    'pixi-live2d-display-lipsyncpatch/cubism4': {
      Live2DModel: { from: () => new Promise(resolve => loads.push(resolve)) },
    },
  });
  let root;
  const render = (emotionScore, modelPath = 'first.model3.json') => {
    const element = React.createElement(Display, { modelPath, emotionScore });
    act(() => {
      if (root) root.update(element);
      else root = create(element, {
        createNodeMock: () => ({
          parentElement: { clientWidth: 400, clientHeight: 600 }, style: {},
        }),
      });
    });
  };
  render(initialScore);
  t.after(() => act(() => root.unmount()));
  return {
    render,
    loads,
    destroyedModels,
    unmount: () => act(() => root.unmount()),
    async finishLoad(index = 0) {
      const writes = [];
      const model = {
        width: 400, height: 600,
        destroy: () => destroyedModels.push(index),
        scale: { set() {} }, anchor: { set() {} }, on() {}, off() {},
        internalModel: { coreModel: { setParameterValueById: (id, value) => writes.push([id, value]) } },
      };
      await act(async () => { loads[index](model); });
      return writes;
    },
  };
}

const brows = value => [['ParamBrowLY', value], ['ParamBrowRY', value]];

for (const [score, expected] of [[0, 0], [2, 0.4], [-3, -0.6], [10, 1], [-10, -1]]) {
  test(`initial score ${score} is applied after loading without a Control tab`, async t => {
    const view = setup(t, score);
    assert.deepEqual(await view.finishLoad(), brows(expected));
  });
}

test('score changes while loading use the latest score', async t => {
  const view = setup(t, 1);
  view.render(-4);
  assert.equal(view.loads.length, 1, 'emotion updates must not reload the model');
  assert.deepEqual(await view.finishLoad(), brows(-0.8));
});

test('score changes update both brows after loading without a Control tab', async t => {
  const view = setup(t, 1);
  const writes = await view.finishLoad();
  writes.length = 0;
  view.render(4);
  assert.deepEqual(writes, brows(0.8));
  assert.equal(view.loads.length, 1);
});

test('a replacement model receives the unchanged current score', async t => {
  const view = setup(t, 3);
  await view.finishLoad();
  view.render(3, 'second.model3.json');
  assert.deepEqual(await view.finishLoad(1), brows(0.6));
});

test('score changes during a reload only reach the replacement model', async t => {
  const view = setup(t, 1);
  const oldWrites = await view.finishLoad();
  oldWrites.length = 0;
  view.render(1, 'second.model3.json');
  view.render(-20, 'second.model3.json');
  assert.deepEqual(oldWrites, []);
  assert.deepEqual(await view.finishLoad(1), brows(-1));
});

test('a model finishing after unmount is discarded without brow writes', async t => {
  const view = setup(t, 2);
  view.unmount();
  assert.deepEqual(await view.finishLoad(), []);
  assert.deepEqual(view.destroyedModels, [0]);
});

test('an out-of-order old load cannot replace the current model', async t => {
  const view = setup(t, 1);
  view.render(2, 'second.model3.json');
  const currentWrites = await view.finishLoad(1);
  const staleWrites = await view.finishLoad(0);
  assert.deepEqual(staleWrites, []);
  assert.deepEqual(view.destroyedModels, [0]);
  currentWrites.length = 0;
  view.render(4, 'second.model3.json');
  assert.deepEqual(currentWrites, brows(0.8));
  assert.deepEqual(staleWrites, []);
});

test('opening Control does not write emotion parameters again', () => {
  const writes = [];
  const ControlPanel = loadComponent('ControlPanel.tsx');
  let root;
  act(() => {
    root = create(React.createElement(ControlPanel, {
      live2dRef: { current: { setParameter: (...args) => writes.push(args) } },
      motions: [], paramValues: {}, setParamValues() {}, emotionScore: 2,
    }));
  });
  act(() => root.unmount());
  assert.deepEqual(writes, []);
});

test('App passes its emotion score to the display', () => {
  const app = fs.readFileSync(path.join(__dirname, '../src/App.tsx'), 'utf8');
  assert.match(app, /<Live2DModelDisplay\b[^>]*\bemotionScore=\{emotionScore\}/);
});
