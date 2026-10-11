import test from 'node:test';
import assert from 'node:assert/strict';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createPresenceStore } from '../../src/lib/presence-store.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
function fixture() {
  const events = new Map<string, () => void>();
  let status: (status: string) => void = () => {};
  let state: Record<string, { user_id: unknown }[]> = {};
  let opened = 0,
    removed = 0,
    untracked = 0,
    failTrack = false;
  const tracked: Record<string, unknown>[] = [];
  const channel = {
    on(_type: string, filter: { event: string }, callback: () => void) {
      events.set(filter.event, callback);
      return channel;
    },
    subscribe(callback: (value: string) => void) {
      status = callback;
      return channel;
    },
    presenceState: () => state,
    async track(payload: Record<string, unknown>) {
      if (failTrack) throw new Error('Network unavailable');
      tracked.push(payload);
      return 'ok';
    },
    async untrack() {
      untracked++;
      return 'ok';
    },
  };
  const store = createPresenceStore(() => ({
    channel(name: string) {
      assert.equal(name, 'savestate:presence');
      opened++;
      return channel as unknown as RealtimeChannel;
    },
    async removeChannel() {
      removed++;
      return 'ok' as const;
    },
  }));
  return {
    store,
    tracked,
    events,
    status(value: string) {
      status(value);
    },
    state(value: typeof state) {
      state = value;
    },
    failTrack() {
      failTrack = true;
    },
    counts: () => ({ opened, removed, untracked }),
  };
}
test('Presence shares one channel, tracks after subscribe and preserves a user across multiple tabs', async () => {
  const f = fixture();
  const releaseHeader = f.store.retain(USER);
  const releaseWidget = f.store.retain();
  await settle();
  assert.equal(f.counts().opened, 1);
  assert.equal(f.tracked.length, 0);
  f.status('SUBSCRIBED');
  await settle();
  assert.equal(f.tracked[0]?.user_id, USER);
  assert.ok(Number.isFinite(Date.parse(String(f.tracked[0]?.online_at))));
  let signals = 0;
  const unsubscribe = f.store.subscribe(() => signals++);
  f.state({
    tab1: [{ user_id: USER }],
    tab2: [{ user_id: USER }, { user_id: OTHER }, { user_id: 'invalid' }],
  });
  f.events.get('sync')?.();
  assert.deepEqual([...f.store.getSnapshot()], [USER, OTHER]);
  const snapshot = f.store.getSnapshot();
  f.events.get('join')?.();
  assert.equal(f.store.getSnapshot(), snapshot);
  assert.equal(signals, 1);
  f.state({ tab2: [{ user_id: USER }] });
  f.events.get('leave')?.();
  assert.equal(f.store.getSnapshot().has(USER), true);
  assert.equal(f.store.getSnapshot().has(OTHER), false);
  releaseHeader();
  await settle();
  assert.equal(f.counts().untracked, 1);
  assert.equal(f.counts().removed, 0);
  unsubscribe();
  releaseWidget();
  await settle();
  assert.equal(f.counts().removed, 1);
  assert.equal(f.store.getSnapshot().size, 0);
});
test('Presence coalesces remounts, ignores stale events and clears failed/reconnecting channels', async () => {
  const f = fixture();
  let release = f.store.retain(USER);
  await settle();
  release();
  release = f.store.retain(USER);
  await settle();
  assert.equal(f.counts().opened, 1);
  f.status('SUBSCRIBED');
  await settle();
  f.state({ tab: [{ user_id: USER }] });
  f.events.get('sync')?.();
  f.status('CHANNEL_ERROR');
  assert.equal(f.store.getSnapshot().size, 0);
  f.events.get('sync')?.();
  assert.equal(f.store.getSnapshot().size, 0);
  f.status('SUBSCRIBED');
  await settle();
  assert.equal(f.tracked.length, 2);
  f.events.get('sync')?.();
  assert.equal(f.store.getSnapshot().has(USER), true);
  f.failTrack();
  f.status('SUBSCRIBED');
  await settle();
  assert.equal(f.store.getSnapshot().size, 0);
  release();
  await settle();
  f.events.get('join')?.();
  assert.equal(f.store.getSnapshot().size, 0);
});
test('Presence remains safe without configuration and never tracks anonymous viewers', async () => {
  const store = createPresenceStore(() => {
    throw new Error('Not configured');
  });
  const release = store.retain(USER);
  await settle();
  assert.equal(store.getSnapshot().size, 0);
  assert.equal(store.getServerSnapshot().size, 0);
  release();
  await settle();
  const f = fixture();
  const releaseViewer = f.store.retain();
  await settle();
  f.status('SUBSCRIBED');
  await settle();
  assert.equal(f.tracked.length, 0);
  releaseViewer();
  await settle();
});
