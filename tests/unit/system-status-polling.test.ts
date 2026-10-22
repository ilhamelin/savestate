import test from 'node:test';
import assert from 'node:assert/strict';
import {
  startSystemStatusPolling,
  SYSTEM_STATUS_INTERVAL_MS,
  SYSTEM_STATUS_MAX_BACKOFF_MS,
} from '../../src/lib/system-status-polling.ts';

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
function fixture(refresh: (signal: AbortSignal) => Promise<void> = async () => {}) {
  let active = true;
  const timers = new Set<{ callback: () => void; delay: number }>();
  const signals: AbortSignal[] = [];
  const polling = startSystemStatusPolling({
    isActive: () => active,
    schedule(callback, delay) {
      const timer = { callback, delay };
      timers.add(timer);
      return () => {
        timers.delete(timer);
      };
    },
    refresh: (signal) => {
      signals.push(signal);
      return refresh(signal);
    },
  });
  return {
    polling,
    signals,
    timers,
    setActive(value: boolean) {
      active = value;
      polling.wake();
    },
    nextDelay() {
      return [...timers][0]?.delay;
    },
    tick() {
      const timer = [...timers][0];
      assert.ok(timer);
      timers.delete(timer);
      timer.callback();
    },
  };
}

test('Status polling uses 30s after completion and never overlaps requests', async () => {
  let release!: () => void;
  const state = fixture(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  assert.equal(state.signals.length, 1);
  assert.equal(state.timers.size, 0);
  state.polling.wake();
  state.polling.wake();
  assert.equal(state.signals.length, 1);
  release();
  await flush();
  assert.equal(state.nextDelay(), SYSTEM_STATUS_INTERVAL_MS);
  state.tick();
  assert.equal(state.signals.length, 2);
  assert.equal(state.timers.size, 0);
  state.polling.stop();
  assert.equal(state.signals[1]!.aborted, true);
  release();
  await flush();
  assert.equal(state.timers.size, 0);
});

test('Status polling pauses timers while hidden/offline and resumes once', async () => {
  const state = fixture();
  await flush();
  state.setActive(false);
  assert.equal(state.timers.size, 0);
  state.polling.wake();
  assert.equal(state.signals.length, 1);
  state.setActive(true);
  state.polling.wake();
  assert.equal(state.signals.length, 2);
  await flush();
  assert.equal(state.nextDelay(), 30_000);
  state.polling.stop();
  state.polling.wake();
  assert.equal(state.timers.size, 0);
  assert.equal(state.signals.length, 2);
});

test('Status polling caps error backoff at 120s and resets after recovery', async () => {
  let failing = true;
  const state = fixture(async () => {
    if (failing) throw new Error('network/HTTP failure');
  });
  await flush();
  assert.equal(state.nextDelay(), 60_000);
  state.tick();
  await flush();
  assert.equal(state.nextDelay(), SYSTEM_STATUS_MAX_BACKOFF_MS);
  state.tick();
  await flush();
  assert.equal(state.nextDelay(), SYSTEM_STATUS_MAX_BACKOFF_MS);
  failing = false;
  state.tick();
  await flush();
  assert.equal(state.nextDelay(), 30_000);
  state.polling.stop();
});

test('Status polling aborts an inactive request and handles resume before it settles', async () => {
  let release!: () => void;
  const state = fixture(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  state.setActive(false);
  assert.equal(state.signals[0]!.aborted, true);
  state.setActive(true);
  state.polling.wake();
  assert.equal(state.signals.length, 1);
  release();
  await flush();
  assert.equal(state.signals.length, 2);
  assert.equal(state.timers.size, 0);
  state.polling.stop();
  release();
  await flush();
  assert.equal(state.timers.size, 0);
});
