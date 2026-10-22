export const OFFLINE_DATABASE = 'savestate-offline-library';
export const OFFLINE_ACCESS_KEY = 'savestate_offline_library_access_v1';
export const OFFLINE_EVENT = 'savestate:offline-library';
export const OFFLINE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MAX_BYTES = 1024 * 1024;
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
export const OFFLINE_STATUSES = ['playing', 'backlog', 'cleared', 'platinum', 'dropped', 'wishlist'];

export function parseOfflineSnapshot(raw, ownerId, now = Date.now()) {
  try {
    if (!raw || raw.version !== 1 || raw.ownerId !== ownerId || !UUID.test(ownerId)) return null;
    const saved = Date.parse(raw.savedAt), expires = Date.parse(raw.expiresAt);
    if (!Number.isFinite(saved) || !Number.isFinite(expires) || saved > now + 60000 ||
      expires <= now || expires <= saved || expires - saved > OFFLINE_MAX_AGE_MS) return null;
    if (!Array.isArray(raw.rows) || raw.rows.length > 504 || !Number.isSafeInteger(raw.totalCount) ||
      raw.totalCount < raw.rows.length || new TextEncoder().encode(JSON.stringify(raw)).byteLength > MAX_BYTES) return null;
    const rows = [];
    const seen = new Set();
    for (const row of raw.rows) {
      if (!row || !UUID.test(row.gameId) || seen.has(row.gameId) ||
        typeof row.title !== 'string' || !row.title.trim() || row.title.length > 200 ||
        typeof row.slug !== 'string' || !/^[a-z0-9-]{1,180}$/.test(row.slug) ||
        !OFFLINE_STATUSES.includes(row.status) ||
        (row.rating !== null && (!Number.isFinite(row.rating) || row.rating < 1 || row.rating > 10 || row.rating * 2 % 1 !== 0)) ||
        !Number.isFinite(row.hours) || row.hours < 0 || row.hours > 10000000 ||
        !Number.isSafeInteger(row.sessions) || row.sessions < 0 ||
        !Array.isArray(row.platforms) || row.platforms.length > 20 ||
        row.platforms.some(p => typeof p !== 'string' || p.length > 80)) return null;
      seen.add(row.gameId);
      rows.push({ gameId: row.gameId, title: row.title, slug: row.slug, status: row.status,
        rating: row.rating, hours: row.hours, sessions: row.sessions, platforms: [...row.platforms] });
    }
    return { version: 1, ownerId, savedAt: new Date(saved).toISOString(),
      expiresAt: new Date(expires).toISOString(), totalCount: raw.totalCount, rows };
  } catch { return null; }
}
function access() {
  const raw = globalThis.localStorage.getItem(OFFLINE_ACCESS_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return value && UUID.test(value.epoch) && ['active', 'changing', 'revoked'].includes(value.status) &&
      (value.ownerId === null || UUID.test(value.ownerId)) ? value : null;
  } catch { return null; }
}
function sameAccess(lease) {
  const current = access();
  return current?.status === 'active' && current.ownerId === lease.ownerId && current.epoch === lease.epoch;
}
function notify() {
  if (!globalThis.window) return;
  globalThis.dispatchEvent(new Event(OFFLINE_EVENT));
  try {
    const channel = new BroadcastChannel(OFFLINE_EVENT);
    channel.postMessage('changed');
    channel.close();
  } catch { /* Storage events still invalidate other tabs. */ }
}
function writeAccess(value) {
  globalThis.localStorage.setItem(OFFLINE_ACCESS_KEY, JSON.stringify(value));
  notify();
}
async function transaction(mode, action) {
  if (!globalThis.indexedDB) throw new Error('IndexedDB no está disponible.');
  const db = await new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(OFFLINE_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onerror = () => reject(new Error('No se pudo abrir la copia offline.'));
    request.onblocked = () => reject(new Error('Cierra otras pestañas para preparar la copia offline.'));
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
  return new Promise((resolve, reject) => {
    let result, failure;
    const tx = db.transaction('state', mode);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = tx.onabort = () => { db.close(); reject(failure ?? new Error('No se pudo actualizar la copia offline.')); };
    try {
      action(tx.objectStore('state'), value => { result = value; }, error => {
        failure = error;
        tx.abort();
      });
    } catch (error) {
      failure = error;
      tx.abort();
    }
  });
}
export async function synchronizeOfflineLibraryAccount(ownerId) {
  if (!UUID.test(ownerId ?? '')) return revokeOfflineLibrary();
  const old = access();
  if (old?.status === 'active' && old.ownerId === ownerId) {
    const account = await transaction('readonly', (store, done) => {
      const request = store.get('account');
      request.onsuccess = () => done(request.result);
    });
    if (!sameAccess(old)) throw new Error('La cuenta cambió.');
    if (account?.ownerId === ownerId && account.epoch === old.epoch) return { ownerId, epoch: old.epoch };
  }
  const lease = { ownerId, epoch: globalThis.crypto.randomUUID() };
  writeAccess({ ...lease, status: 'changing' });
  await transaction('readwrite', (store, done, fail) => {
    try {
      if (access()?.epoch !== lease.epoch) { fail(new Error('La cuenta cambió.')); return; }
      store.clear(); store.put(lease, 'account'); done(undefined);
    } catch (error) { fail(error); }
  });
  if (access()?.epoch !== lease.epoch) throw new Error('La cuenta cambió durante la operación.');
  writeAccess({ ...lease, status: 'active' });
  return lease;
}
export function offlineLibraryLease(ownerId) {
  const current = access();
  if (current?.status !== 'active' || current.ownerId !== ownerId) throw new Error('La sesión cambió. Vuelve a abrir tu biblioteca.');
  return { ownerId, epoch: current.epoch };
}
export async function revokeOfflineLibrary() {
  // The synchronous barrier hides data in every tab before the transaction or auth request finishes.
  const epoch = globalThis.crypto.randomUUID();
  try { writeAccess({ ownerId: null, epoch, status: 'revoked' }); }
  catch { notify(); } // Reads fail closed when storage is restricted.
  await transaction('readwrite', store => {
    let current;
    try { current = access(); } catch { /* Still erase when browser storage is restricted. */ }
    if (!current || current.epoch === epoch) store.clear();
  });
  notify();
}
export async function saveOfflineLibrary(lease, raw) {
  const snapshot = parseOfflineSnapshot(raw, lease.ownerId);
  if (!snapshot || !sameAccess(lease)) throw new Error('La copia no es válida para esta sesión.');
  await transaction('readwrite', (store, done, fail) => {
    const request = store.get('account');
    request.onsuccess = () => {
      try {
      const account = request.result;
      if (!sameAccess(lease) || account?.ownerId !== lease.ownerId || account.epoch !== lease.epoch) {
        fail(new Error('La cuenta cambió antes de guardar.'));
        return;
      }
      store.put(snapshot, 'snapshot');
      done(undefined);
      } catch (error) { fail(error); }
    };
  });
  if (!sameAccess(lease)) throw new Error('La sesión se cerró durante el guardado.');
  notify();
}
export async function readOfflineLibrary(expectedOwner) {
  const current = access();
  if (current?.status !== 'active' || (expectedOwner && current.ownerId !== expectedOwner)) return null;
  const data = await transaction('readonly', (store, done) => {
    const account = store.get('account');
    account.onsuccess = () => {
      if (account.result?.ownerId !== current.ownerId || account.result?.epoch !== current.epoch) { done(null); return; }
      const snapshot = store.get('snapshot');
      snapshot.onsuccess = () => done(snapshot.result);
    };
  });
  return sameAccess(current) ? parseOfflineSnapshot(data, current.ownerId) : null;
}
export async function deleteOfflineLibrarySnapshot(lease) {
  await transaction('readwrite', (store, done, fail) => {
    const request = store.get('account');
    request.onsuccess = () => {
      try {
      if (!sameAccess(lease) || request.result?.epoch !== lease.epoch) { fail(new Error('La cuenta cambió.')); return; }
      store.delete('snapshot');
      done(undefined);
      } catch (error) { fail(error); }
    };
  });
  notify();
}
export function subscribeOfflineLibrary(listener) {
  const onStorage = event => { if (event.key === OFFLINE_ACCESS_KEY || event.key === null) listener(); };
  globalThis.addEventListener(OFFLINE_EVENT, listener);
  globalThis.addEventListener('storage', onStorage);
  let channel;
  try { channel = new BroadcastChannel(OFFLINE_EVENT); channel.onmessage = () => listener(); } catch { /* Optional. */ }
  return () => {
    globalThis.removeEventListener(OFFLINE_EVENT, listener);
    globalThis.removeEventListener('storage', onStorage);
    channel?.close();
  };
}
