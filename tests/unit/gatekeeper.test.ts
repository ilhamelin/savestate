import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import {
  gateCode,
  gateCodeFromKey,
  gateSecretBytes,
  validGateCode,
  createGatePass,
  validGatePass,
  GATE_PASS_SECONDS,
  gatekeeperExempt,
} from '../../src/domain/gatekeeper.ts';
import { isGuardianAdmin } from '../../src/domain/admin-access.ts';
import { saveGuardianKey } from '../../src/lib/guardian-device.ts';
const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('Guardian TOTP matches RFC 6238 SHA-1 vectors and independent 20-second HMAC counters', async () => {
  // RFC 6238 Appendix B uses 30 seconds and eight digits; compare its six-digit suffix.
  for (const [seconds, expected] of [
    [59, '287082'],
    [1111111109, '081804'],
    [1111111111, '050471'],
    [1234567890, '005924'],
    [2000000000, '279037'],
    [20000000000, '353130'],
  ] as const)
    assert.equal(await gateCode(secret, seconds * 1000, 30), expected);
  for (const time of [0, 19999, 20000, 59999, 60000, 1790000000000]) {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(time / 20000)));
    const digest = createHmac('sha1', Buffer.from('12345678901234567890')).update(counter).digest();
    const offset = digest[digest.length - 1]! & 15;
    const expected = String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
    assert.equal(await gateCode(secret, time), expected);
  }
  assert.equal(await gateCode(secret, 0), await gateCode(secret, 19999));
  assert.notEqual(await gateCode(secret, 19999), await gateCode(secret, 20000));
  assert.throws(() => gateSecretBytes('weak-default'));
});
test('Guardian accepts only six digits within one 20-second step and validates signed expiring passes', async () => {
  const now = 1800000000000;
  for (const offset of [-20000, 0, 20000])
    assert.equal(await validGateCode(secret, await gateCode(secret, now + offset), now), true);
  for (const offset of [-40000, 40000])
    assert.equal(await validGateCode(secret, await gateCode(secret, now + offset), now), false);
  for (const code of ['123', '1234567', '12345a', ' 123456', '123456\n'])
    assert.equal(await validGateCode(secret, code, now), false);
  const pass = await createGatePass(secret, now);
  assert.equal(await validGatePass(secret, pass, now), true);
  assert.equal(await validGatePass(secret, pass, now + GATE_PASS_SECONDS * 1000), false);
  assert.equal(await validGatePass(secret, pass, now - 1000), false);
  assert.equal(await validGatePass('A'.repeat(32), pass, now), false);
  assert.equal(
    await validGatePass(secret, pass.slice(0, -1) + (pass.endsWith('0') ? '1' : '0'), now),
    false,
  );
  for (const invalid of [undefined, '', 'true', '1.signature', pass + '.extra'])
    assert.equal(await validGatePass(secret, invalid, now), false);
});
test('Guardian authorization uses confirmed account email or immutable UUID, never username or unverified claims', () => {
  const user = { id: 'owner', email: 'BENJAIGANCIOREYES56@gmail.com', emailConfirmed: true };
  assert.equal(isGuardianAdmin(user, {}), true);
  assert.equal(isGuardianAdmin({ ...user, emailConfirmed: false }, {}), false);
  assert.equal(isGuardianAdmin({ ...user, email: 'attacker@example.com' }, {}), false);
  assert.equal(isGuardianAdmin(user, { userId: 'other' }), false);
  assert.equal(
    isGuardianAdmin({ ...user, email: null, emailConfirmed: false }, { userId: 'owner' }),
    true,
  );
});
test('Gatekeeper exceptions are exact login/admin/machine routes, not arbitrary API prefixes', () => {
  for (const path of [
    '/gatekeeper',
    '/login',
    '/auth/callback',
    '/guardian',
    '/api/guardian/enroll',
    '/guardian-sw.js',
    '/guardian-assets/offline.js',
    '/api/discord/interactions',
    '/api/cron/check-itch',
  ])
    assert.equal(gatekeeperExempt(path), true);
  for (const path of [
    '/',
    '/library',
    '/api/vault',
    '/api/catalogue',
    '/guardian-secret',
    '/api/guardian-secret',
    '/api/discord/messages',
    '/api/gatekeeper/verify-more',
  ])
    assert.equal(gatekeeperExempt(path), false);
});
test('Guardian offline runtime generates the same TOTP from a persisted non-exportable key without fetch', async () => {
  const key = await crypto.subtle.importKey(
    'raw',
    gateSecretBytes(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  assert.equal(key.extractable, false);
  const clonedKey = structuredClone(key);
  const now = 1800000000000;
  const nodes: Record<string, { textContent: string; value: number; disabled: boolean }> = {};
  const source = readFileSync('public/guardian-assets/offline.js', 'utf8').split(
    /\nstorage\(\)\s*\.then/,
  )[0]!;
  const result = await runInNewContext(source + '\nguardianKey = providedKey; tick();', {
    providedKey: clonedKey,
    crypto: webcrypto,
    Date: { now: () => now },
    Uint8Array,
    DataView,
    document: {
      getElementById(id: string) {
        return (nodes[id] ??= { textContent: '', value: 0, disabled: true });
      },
    },
  });
  void result;
  assert.equal(nodes.code?.textContent.replace(' ', ''), await gateCodeFromKey(clonedKey, now));
  assert.equal(nodes.copy?.disabled, false);
  const sw = readFileSync('public/guardian-sw.js', 'utf8');
  assert.doesNotMatch(sw, /cache\.put|cache\.addAll\([^)]*api\/guardian/);
  assert.match(sw, /fetch\(event.request\)\.catch/);
  assert.doesNotMatch(
    readFileSync('public/guardian-assets/offline.html', 'utf8'),
    /GATEKEEPER_SECRET/,
  );
});

test('Guardian service worker falls back only offline and never intercepts private APIs or caches account HTML', async () => {
  type Event = {
    request: { url: string; method: string; mode: string };
    respondWith: (response: Promise<Response>) => void;
  };
  const handlers: Record<string, (event: Event) => void> = {};
  let offline = true,
    reads = 0;
  runInNewContext(readFileSync('public/guardian-sw.js', 'utf8'), {
    URL,
    self: {
      location: { origin: 'https://savestate.test' },
      addEventListener(name: string, handler: (event: Event) => void) {
        handlers[name] = handler;
      },
    },
    caches: {
      async match() {
        reads++;
        return new Response('public offline shell');
      },
    },
    fetch: async () => {
      if (offline) throw new Error('Offline');
      return new Response('private online page', { status: 403 });
    },
  });
  async function navigate(path: string) {
    let response: Promise<Response> | undefined;
    handlers.fetch!({
      request: { url: `https://savestate.test${path}`, method: 'GET', mode: 'navigate' },
      respondWith(value) {
        response = value;
      },
    });
    return response;
  }
  assert.equal(await (await navigate('/guardian'))?.text(), 'public offline shell');
  assert.equal(reads, 1);
  offline = false;
  const online = await navigate('/guardian');
  assert.equal(online?.status, 403);
  assert.equal(await online?.text(), 'private online page');
  assert.equal(reads, 1);
  for (const path of ['/api/guardian/players', '/api/guardian/enroll', '/library'])
    assert.equal(await navigate(path), undefined);
});

test('Guardian device enrollment rejects unsupported CryptoKey storage instead of hanging', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  let closed = false;
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open() {
        const request = {
          onsuccess: null as (() => void) | null,
          result: {
            close() {
              closed = true;
            },
            transaction() {
              return {
                objectStore() {
                  return {
                    put() {
                      throw new Error('DataCloneError');
                    },
                  };
                },
              };
            },
          },
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    },
  });
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      gateSecretBytes(secret),
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign'],
    );
    await assert.rejects(saveGuardianKey(key), /no permite guardar/);
    assert.equal(closed, true);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else Reflect.deleteProperty(globalThis, 'indexedDB');
  }
});
