import test from 'node:test';
import assert from 'node:assert/strict';
import { isAudioEnabled, toggleAudio, unlockAudio, soundFx } from '../../src/lib/sound.ts';
test('audio is optional, waits for consent, schedules tones and stops on mute', () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map<string, string>();
  let created = 0,
    stopped = 0,
    tones = 0,
    resumed = 0;
  const nodes: { stop: () => void; onended: (() => void) | null }[] = [];
  class Context {
    state = 'running';
    currentTime = 0;
    destination = {};
    constructor() {
      created++;
    }
    resume() {
      resumed++;
      return Promise.resolve();
    }
    createOscillator() {
      tones++;
      const node = {
        type: '',
        frequency: { setValueAtTime() {} },
        connect() {},
        disconnect() {},
        start() {},
        stop() {
          stopped++;
        },
        onended: null as (() => void) | null,
      };
      nodes.push(node);
      return node;
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
  }
  try {
    assert.equal(isAudioEnabled(), false);
    soundFx.click();
    assert.equal(created, 0);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { AudioContext: Context, dispatchEvent() {} },
    });
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key),
        setItem: (key: string, value: string) => store.set(key, value),
      },
    });
    soundFx.levelUp();
    assert.equal(created, 0);
    assert.equal(toggleAudio(), true);
    unlockAudio();
    soundFx.levelUp();
    soundFx.criticalHit();
    assert.equal(created, 1);
    assert.equal(tones, 5);
    assert.equal(resumed, 0);
    const beforeMute = stopped;
    assert.equal(toggleAudio(), false);
    assert.equal(stopped, beforeMute + 5);
    soundFx.click();
    assert.equal(tones, 5);
    nodes.forEach((node) => node.onended?.());
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem() {
          throw new Error('blocked');
        },
        setItem() {
          throw new Error('blocked');
        },
      },
    });
    assert.equal(isAudioEnabled(), false);
    assert.equal(toggleAudio(), false);
    assert.doesNotThrow(() => soundFx.error());
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
