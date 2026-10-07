import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleAnimation } from '../../src/lib/visible-animation.ts';

test('animaciones: movimiento reducido es inmediato y cancela al cambiar preferencia', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  let listener: (() => void) | undefined;
  const media = {
    matches: true,
    addEventListener: (_: string, callback: () => void) => {
      listener = callback;
    },
    removeEventListener: () => {
      listener = undefined;
    },
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => media,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const id = ++nextId;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id: number) => frames.delete(id),
    },
  });
  try {
    const values: number[] = [];
    let cleanup = visibleAnimation({} as HTMLElement, (value) => values.push(value), 800);
    assert.deepEqual(values, [1]);
    assert.equal(frames.size, 0);
    cleanup();
    assert.equal(listener, undefined);
    media.matches = false;
    values.length = 0;
    cleanup = visibleAnimation({} as HTMLElement, (value) => values.push(value), 800);
    assert.equal(frames.size, 1);
    const first = [...frames.values()][0]!;
    frames.clear();
    first(0);
    assert.deepEqual(values, [0]);
    media.matches = true;
    listener!();
    assert.deepEqual(values, [0, 1]);
    assert.equal(frames.size, 0);
    cleanup();
    assert.equal(listener, undefined);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('animaciones: esperan visibilidad, terminan y limpian observadores y frames', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0,
    disconnects = 0;
  let visible: ((entries: { isIntersecting: boolean }[]) => void) | undefined;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        const id = ++nextId;
        frames.set(id, callback);
        return id;
      },
      cancelAnimationFrame: (id: number) => frames.delete(id),
      IntersectionObserver: class {
        constructor(callback: typeof visible) {
          visible = callback;
        }
        observe() {}
        disconnect() {
          disconnects++;
        }
      },
    },
  });
  try {
    const values: number[] = [];
    const cleanup = visibleAnimation({} as HTMLElement, (value) => values.push(value), 800);
    assert.equal(frames.size, 0);
    visible!([{ isIntersecting: false }]);
    assert.equal(frames.size, 0);
    visible!([{ isIntersecting: true }]);
    visible!([{ isIntersecting: true }]);
    assert.equal(frames.size, 1);
    for (const time of [0, 400, 800]) {
      const callback = [...frames.values()][0]!;
      frames.clear();
      callback(time);
    }
    assert.deepEqual(values, [0, 0.5, 1]);
    assert.equal(frames.size, 0);
    cleanup();
    assert.ok(disconnects >= 2);
    const cancel = visibleAnimation({} as HTMLElement, (value) => values.push(value), 800);
    visible!([{ isIntersecting: true }]);
    assert.equal(frames.size, 1);
    cancel();
    assert.equal(frames.size, 0);
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
