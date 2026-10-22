import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  OFFLINE_DATABASE,
  OFFLINE_ACCESS_KEY,
  OFFLINE_MAX_AGE_MS,
  parseOfflineSnapshot,
  synchronizeOfflineLibraryAccount,
  offlineLibraryLease,
  revokeOfflineLibrary,
  saveOfflineLibrary,
  readOfflineLibrary,
  deleteOfflineLibrarySnapshot,
} from '../../public/offline-library/store.mjs';
import { installOfflineLibraryAuth } from '../../src/lib/offline-library-auth.ts';
import { offlineLibraryRows, isOfflineLibraryAsset } from '../../src/domain/offline-library.ts';
import { gatekeeperExempt } from '../../src/domain/gatekeeper.ts';
import type { Game, UserGame, PlayLog } from '../../src/domain/model.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const GAME = '33333333-3333-4333-8333-333333333333';
function snapshot(ownerId = A, now = Date.now()) {
  return {
    version: 1 as const,
    ownerId,
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + OFFLINE_MAX_AGE_MS).toISOString(),
    totalCount: 1,
    rows: [
      {
        gameId: GAME,
        title: 'Celeste',
        slug: 'celeste',
        status: 'playing' as const,
        rating: 9,
        hours: 2.5,
        sessions: 1,
        platforms: ['PC'],
      },
    ],
  };
}
async function storedSnapshot() {
  return new Promise<unknown>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DATABASE, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('state', 'readonly');
      const value = tx.objectStore('state').get('snapshot');
      tx.oncomplete = () => { db.close(); resolve(value.result); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}
function environment() {
  const values = new Map<string, string>();
  const oldDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: new IDBFactory() });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return () => {
    if (oldDb) Object.defineProperty(globalThis, 'indexedDB', oldDb);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
    if (oldStorage) Object.defineProperty(globalThis, 'localStorage', oldStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  };
}
test('Offline parser limits lifetime, account, shape and private fields', () => {
  const now = Date.now(),
    value = snapshot(A, now);
  assert.equal(parseOfflineSnapshot(value, A, now)?.rows[0]?.title, 'Celeste');
  assert.equal(parseOfflineSnapshot(value, B, now), null);
  assert.equal(parseOfflineSnapshot(value, A, now + OFFLINE_MAX_AGE_MS), null);
  assert.equal(
    parseOfflineSnapshot(
      { ...value, expiresAt: new Date(now + OFFLINE_MAX_AGE_MS + 1).toISOString() },
      A,
      now,
    ),
    null,
  );
  assert.equal(
    parseOfflineSnapshot({ ...value, rows: [...value.rows, ...value.rows] }, A, now),
    null,
  );
  assert.equal(
    parseOfflineSnapshot({ ...value, rows: [{ ...value.rows[0], status: 'admin' }] }, A, now),
    null,
  );
  const clean = parseOfflineSnapshot(
    { ...value, token: 'secret', rows: [{ ...value.rows[0], note: 'private' }] },
    A,
    now,
  );
  assert.ok(clean);
  assert.doesNotMatch(JSON.stringify(clean), /secret|private|token|note/);
});
test('Offline storage changes accounts atomically and rejects stale writes', async () => {
  const restore = environment();
  try {
    const first = await synchronizeOfflineLibraryAccount(A);
    assert.ok(first);
    await saveOfflineLibrary(first, snapshot());
    assert.equal((await readOfflineLibrary(A))?.rows.length, 1);
    await synchronizeOfflineLibraryAccount(A); // Refreshing the same session preserves the copy.
    assert.ok(await readOfflineLibrary(A));
    const second = await synchronizeOfflineLibraryAccount(B);
    assert.ok(second);
    assert.equal(await readOfflineLibrary(A), null);
    assert.equal(await readOfflineLibrary(B), null);
    assert.equal(await storedSnapshot(), undefined);
    await assert.rejects(saveOfflineLibrary(first, snapshot()));
    await saveOfflineLibrary(second, snapshot(B));
    await deleteOfflineLibrarySnapshot(second);
    assert.equal(await readOfflineLibrary(B), null);
    await saveOfflineLibrary(second, snapshot(B));
    await revokeOfflineLibrary();
    assert.equal(await storedSnapshot(), undefined);
    assert.equal(await readOfflineLibrary(), null);
    assert.throws(() => offlineLibraryLease(B));
    await assert.rejects(saveOfflineLibrary(second, snapshot(B)));
  } finally {
    restore();
  }
});
test('Revocation wins against a pending save and storage restrictions fail closed', async () => {
  const restore = environment();
  try {
    const lease = await synchronizeOfflineLibraryAccount(A);
    assert.ok(lease);
    await Promise.allSettled([saveOfflineLibrary(lease, snapshot()), revokeOfflineLibrary()]);
    assert.equal(await readOfflineLibrary(), null);
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('Denied');
      },
    });
    await assert.rejects(readOfflineLibrary());
    await revokeOfflineLibrary(); // Erasure still works if the synchronous marker is unavailable.
  } finally {
    restore();
  }
});
test('Every wrapped signOut erases the offline copy before invoking Supabase', async () => {
  const restore = environment();
  try {
    const lease = await synchronizeOfflineLibraryAccount(A);
    assert.ok(lease);
    await saveOfflineLibrary(lease, snapshot());
    let calls = 0;
    const auth = {
      onAuthStateChange() {
        return {};
      },
      async signOut() {
        calls++;
        assert.equal(await readOfflineLibrary(), null);
        assert.equal(
          JSON.parse(globalThis.localStorage.getItem(OFFLINE_ACCESS_KEY)!).status,
          'revoked',
        );
        return { error: null };
      },
    } as unknown as SupabaseClient['auth'];
    installOfflineLibraryAuth(auth);
    installOfflineLibraryAuth(auth);
    await auth.signOut({ scope: 'local' });
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});

test('Offline projection includes only the owner and never exports logs or private content', () => {
  const games = [{ id: GAME, title: 'Celeste', slug: 'celeste' }] as Game[];
  const entries = [
    { id: 'entry', user_id: A, game_id: GAME, status: 'playing', rating: 9 },
    { id: 'other', user_id: B, game_id: GAME, status: 'playing', rating: null },
  ] as UserGame[];
  const logs = [
    { user_game_id: 'entry', hours_played: 2, platform_played: 'PC', note: 'secret' },
    { user_game_id: 'other', hours_played: 1000, platform_played: 'Xbox', note: 'private' },
  ] as PlayLog[];
  const rows = offlineLibraryRows(A, entries, games, logs);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.hours, 2);
  assert.equal(rows[0]?.sessions, 1);
  assert.deepEqual(rows[0]?.platforms, ['PC']);
  assert.doesNotMatch(JSON.stringify(rows), /secret|private|Xbox/);
});
test('Only explicitly listed public offline assets bypass Gatekeeper, never account APIs', () => {
  for (const path of [
    '/library-sw.js',
    '/offline-library/index.html',
    '/offline-library/style.css',
    '/offline-library/app.mjs',
    '/offline-library/store.mjs',
  ]) {
    assert.equal(isOfflineLibraryAsset(path), true);
    assert.equal(gatekeeperExempt(path), true);
  }
  for (const path of [
    '/library',
    '/api/library/offline-access',
    '/offline-library/secrets',
    '/offline-library/../api/library',
  ]) {
    assert.equal(isOfflineLibraryAsset(path), false);
    assert.equal(gatekeeperExempt(path), false);
  }
});
