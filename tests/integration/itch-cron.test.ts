import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('itch cron requires a configured bearer secret before any scan and reports incomplete runs', async () => {
  const state = { scans: 0, complete: true };
  const globalState = globalThis as typeof globalThis & { __itchCron?: typeof state };
  globalState.__itchCron = state;
  const hooks = registerHooks({
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
    resolve(specifier, context, next) {
      if (specifier === '@/services/itch-tracker')
        return {
          url:
            'data:text/javascript,' +
            encodeURIComponent(
              'export async function runItchMonitor(){const s=globalThis.__itchCron;s.scans++;return {checked:0,updated:0,failed:0,remaining:s.complete?0:1,complete:s.complete}}',
            ),
          shortCircuit: true,
        };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(resolve('src', specifier.slice(2) + '.ts')).href,
          shortCircuit: true,
        };
      if (
        specifier.startsWith('.') &&
        context.parentURL?.startsWith('file:') &&
        !specifier.endsWith('.ts')
      )
        return { url: new URL(specifier + '.ts', context.parentURL).href, shortCircuit: true };
      return next(specifier, context);
    },
  });
  const previous = process.env.CRON_SECRET;
  try {
    const { GET } = await import('../../src/app/api/cron/check-itch/route.ts');
    const request = (token?: string) =>
      new Request('https://savestate.test/api/cron/check-itch', {
        headers: token ? { Authorization: token } : {},
      });
    delete process.env.CRON_SECRET;
    assert.equal((await GET(request('Bearer undefined'))).status, 503);
    process.env.CRON_SECRET = 'short';
    assert.equal((await GET(request('Bearer short'))).status, 503);
    process.env.CRON_SECRET = 'a'.repeat(64);
    for (const token of [undefined, 'Bearer wrong', `Bearer ${'b'.repeat(64)}`])
      assert.equal((await GET(request(token))).status, 401);
    assert.equal(state.scans, 0);
    const response = await GET(request(`Bearer ${process.env.CRON_SECRET}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(state.scans, 1);
    state.complete = false;
    assert.equal((await GET(request(`Bearer ${process.env.CRON_SECRET}`))).status, 503);
  } finally {
    hooks.deregister();
    delete globalState.__itchCron;
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
