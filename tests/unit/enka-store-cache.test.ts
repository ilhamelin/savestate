import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

test('Enka dictionaries share concurrent loads, reuse memory for 30 minutes and retry cache errors', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`
    export const state = { calls: 0, fail: false };
    export const unstable_cache = (fn, keys, options) => {
      if(options.revalidate !== 86400) throw new Error('Unexpected cache TTL');
      return async () => {
        state.calls++;
        if(state.fail) throw new Error('Cache unavailable');
        return fn();
      };
    };
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier === 'next/cache') return { url: fixture, shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && url.endsWith('.ts'))
        return {
          format: 'module',
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = 1000,
    requests = 0;
  Date.now = () => now;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    assert.equal('next' in (init ?? {}), false);
    requests++;
    await new Promise((done) => setTimeout(done, 2));
    return Response.json({ es: { label: 'Nombre' }, en: { label: 'Name' } });
  };
  try {
    const { state } = await import(fixture);
    const { getEnkaStore } = await import('../../src/services/genshin-enka-store.ts');
    const { getHsrEnkaStore } = await import('../../src/services/hsr-enka-store.ts');
    for (const [load, expectedRequests] of [
      [getEnkaStore, 4],
      [getHsrEnkaStore, 3],
    ] as const) {
      state.calls = 0;
      requests = 0;
      const [a, b] = await Promise.all([load(), load()]);
      assert.equal(a, b);
      assert.equal(state.calls, 1);
      assert.equal(requests, expectedRequests);
      now += 30 * 60 * 1000 - 1;
      assert.equal(await load(), a);
      assert.equal(state.calls, 1);
      now++;
      state.fail = true;
      await assert.rejects(load(), /Cache unavailable/);
      state.fail = false;
      assert.notEqual(await load(), a);
      assert.equal(state.calls, 3);
      assert.equal(requests, expectedRequests * 2);
    }
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    hooks.deregister();
  }
});
