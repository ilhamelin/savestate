import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

const EMPTY: ReadonlySet<string> = new Set();
type PresenceClient = Pick<SupabaseClient, 'channel' | 'removeChannel'>;

// One channel is retained by all mounted consumers, including read-only widgets.
export function createPresenceStore(client: () => PresenceClient) {
  let snapshot = EMPTY;
  const listeners = new Set<() => void>();
  const consumers = new Map<symbol, string | null>();
  let channel: RealtimeChannel | null = null;
  let db: PresenceClient | null = null;
  let subscribed = false;
  let trackedUser: string | null = null;
  let operations = Promise.resolve();
  let teardown = Promise.resolve();
  let cleanup: ReturnType<typeof setTimeout> | undefined;

  function publish(next: ReadonlySet<string>) {
    if (snapshot.size === next.size && [...next].every((id) => snapshot.has(id))) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  function sync(active: RealtimeChannel) {
    if (channel !== active || !subscribed) return;
    const users = new Set<string>();
    for (const entries of Object.values(active.presenceState<{ user_id?: unknown }>())) {
      for (const entry of entries) {
        if (
          typeof entry.user_id === 'string' &&
          /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(entry.user_id)
        )
          users.add(entry.user_id);
      }
    }
    publish(users);
  }
  function updateTracking() {
    operations = operations
      .then(async () => {
        const active = channel;
        if (!active || !subscribed) return;
        const userId = [...consumers.values()].reverse().find(Boolean) ?? null;
        if (userId === trackedUser) return;
        const result = userId
          ? await active.track({ user_id: userId, online_at: new Date().toISOString() })
          : await active.untrack();
        if (channel !== active || !subscribed) return;
        if (result === 'ok') trackedUser = userId;
        else publish(EMPTY);
      })
      .catch(() => publish(EMPTY));
  }
  async function start() {
    await teardown;
    if (channel || !consumers.size) return;
    try {
      db = client();
      const active = db.channel('savestate:presence', { config: { presence: { enabled: true } } });
      channel = active;
      active
        .on('presence', { event: 'sync' }, () => sync(active))
        .on('presence', { event: 'join' }, () => sync(active))
        .on('presence', { event: 'leave' }, () => sync(active));
      active.subscribe((status) => {
        if (channel !== active) return;
        subscribed = status === 'SUBSCRIBED';
        trackedUser = null;
        if (subscribed) updateTracking();
        else publish(EMPTY);
      });
    } catch {
      channel = null;
      subscribed = false;
      publish(EMPTY);
    }
  }
  function stop() {
    if (consumers.size) return;
    const active = channel,
      currentDb = db;
    channel = null;
    subscribed = false;
    trackedUser = null;
    publish(EMPTY);
    teardown = operations
      .then(async () => {
        if (active && currentDb) await currentDb.removeChannel(active);
      })
      .catch(() => {});
  }
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => EMPTY,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    retain(userId?: string | null) {
      clearTimeout(cleanup);
      const key = Symbol();
      consumers.set(key, userId || null);
      void start();
      updateTracking();
      return () => {
        consumers.delete(key);
        // Coalesce Strict Mode remounts and navigation within the same tab.
        if (!consumers.size) cleanup = setTimeout(stop, 0);
        else updateTracking();
      };
    },
  };
}
