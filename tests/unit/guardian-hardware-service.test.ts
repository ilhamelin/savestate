import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

test('Guardian Metrics API deduplicates reads, caches for 60s, computes CPU and isolates failures', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
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
  const oldFetch = globalThis.fetch,
    oldNow = Date.now;
  const oldUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let time = 1000000,
    calls = 0,
    failed = false;
  Date.now = () => time;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'private-test-key';
  globalThis.fetch = async (url, init) => {
    calls++;
    assert.equal(String(url), 'https://fixture.supabase.co/customer/v1/privileged/metrics');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.cache, 'no-store');
    assert.equal(
      new Headers(init?.headers).get('Authorization'),
      `Basic ${Buffer.from('service_role:private-test-key').toString('base64')}`,
    );
    if (failed) throw new Error('Unavailable');
    return new Response(`node_cpu_seconds_total{service_type="db",cpu="0",mode="idle"} ${calls * 90}
node_cpu_seconds_total{service_type="db",cpu="0",mode="user"} ${calls * 10}
node_memory_MemTotal_bytes{service_type="db"} 1000
node_memory_MemAvailable_bytes{service_type="db"} 400`);
  };
  try {
    const { fetchGuardianDatabaseHardware: read } =
      await import('../../src/services/guardian-hardware.ts');
    const [a, b] = await Promise.all([read(), read()]);
    assert.equal(calls, 1);
    assert.deepEqual(a, b);
    assert.equal(a.cpuPercent, null);
    assert.equal(a.ramPercent, 60);
    assert.doesNotMatch(JSON.stringify(a), /private-test-key|service_role|cpu"/);
    time += 59999;
    await read();
    assert.equal(calls, 1);
    time += 2;
    assert.equal((await read()).cpuPercent, 10);
    failed = true;
    time += 60001;
    assert.equal((await read()).ramPercent, null);
    await read();
    assert.equal(calls, 3);
    failed = false;
    time += 60001;
    assert.equal((await read()).cpuPercent, null);
  } finally {
    hooks.deregister();
    globalThis.fetch = oldFetch;
    Date.now = oldNow;
    if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
