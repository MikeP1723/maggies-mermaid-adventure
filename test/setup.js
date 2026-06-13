// Minimal browser-environment mock — loaded at the top of the test file
// so game.js can be require()'d without a real DOM or Canvas.
//
// The canvas context Proxy silently absorbs all draw calls as no-ops,
// which lets every game-logic path run without throwing.

'use strict';

const gradMock = { addColorStop: () => {} };

function makeCtx() {
  const base = {
    createLinearGradient: () => gradMock,
    createRadialGradient: () => gradMock,
  };
  return new Proxy(base, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}

global.document = {
  getElementById(id) {
    if (id !== 'game') return null;
    return {
      getContext: () => makeCtx(),
      width: 800,
      height: 400,
      addEventListener: () => {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 400 }),
    };
  },
};

global.window = { addEventListener: () => {} };
Object.defineProperty(global, 'navigator', {
  value: { maxTouchPoints: 0 },
  configurable: true, writable: true,
});
global.requestAnimationFrame = () => {};

// Isolated localStorage mock (shared by all tests in a run)
const _ls = {};
global.localStorage = {
  getItem:    (k) => Object.prototype.hasOwnProperty.call(_ls, k) ? _ls[k] : null,
  setItem:    (k, v) => { _ls[k] = String(v); },
  removeItem: (k) => { delete _ls[k]; },
  clear:      () => { for (const k of Object.keys(_ls)) delete _ls[k]; },
};
