import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
function worker() {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const writes: string[] = [];
  const shell = new Response('public read-only shell');
  let response: Response | Error = new Response('private online HTML');
  const context = vm.createContext({
    URL,
    Request: class {
      url: string;
      constructor(url: string) { this.url = url; }
    },
    self: {
      location: { origin: 'https://savestate.test' },
      addEventListener: (key: string, callback: (event: Record<string, unknown>) => void) =>
        listeners.set(key, callback),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: {
      open: async () => ({
        addAll: async (requests: { url: string }[]) => {
          writes.push(...requests.map((x) => x.url));
        },
      }),
      keys: async () => ['savestate-guardian-shell-v3', 'savestate-library-shell-v0'],
      delete: async (key: string) => {
        writes.push('delete:' + key);
      },
      match: async () => shell,
    },
    fetch: async () => {
      if (response instanceof Error) throw response;
      return response;
    },
  });
  vm.runInContext(readFileSync('public/library-sw.js', 'utf8'), context);
  async function lifecycle(name: string) {
    let promise: Promise<unknown> | undefined;
    listeners.get(name)!({
      waitUntil: (value: Promise<unknown>) => {
        promise = value;
      },
    });
    await promise;
  }
  async function request(path: string, mode = 'navigate', method = 'GET') {
    let promise: Promise<Response> | undefined;
    listeners.get('fetch')!({
      request: { url: 'https://savestate.test' + path, method, mode },
      respondWith: (value: Promise<Response>) => {
        promise = value;
      },
    });
    return promise ? await promise : null;
  }
  return {
    writes,
    shell,
    lifecycle,
    request,
    setResponse: (value: Response | Error) => {
      response = value;
    },
  };
}
test('Offline worker caches only its public shell and preserves Guardian caches', async () => {
  const w = worker();
  await w.lifecycle('install');
  assert.deepEqual(w.writes, [
    '/offline-library/index.html',
    '/offline-library/style.css',
    '/offline-library/app.mjs',
    '/offline-library/store.mjs',
  ]);
  await w.lifecycle('activate');
  assert.ok(w.writes.includes('delete:savestate-library-shell-v0'));
  assert.ok(!w.writes.includes('delete:savestate-guardian-shell-v3'));
});
test('Offline worker never replaces server denial, SSR, API or RSC responses with private cache', async () => {
  const w = worker();
  for (const status of [200, 401, 403, 500]) {
    const expected = new Response('network response', { status });
    w.setResponse(expected);
    assert.equal(await w.request('/library'), expected);
  }
  w.setResponse(new Error('offline'));
  assert.equal(await w.request('/library'), w.shell);
  assert.equal(await w.request('/'), w.shell);
  assert.equal(await w.request('/api/library/offline-access', 'cors'), null);
  assert.equal(await w.request('/library?_rsc=test', 'cors'), null);
  assert.equal(await w.request('/guardian'), null);
  assert.equal(await w.request('/library', 'cors', 'POST'), null);
});
