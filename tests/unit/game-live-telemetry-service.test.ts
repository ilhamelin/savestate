import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Telemetry starts FX alongside game queries, caches hourly and survives invalid or failed FX responses', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    export const caches=[];
    export function unstable_cache(fn,keys,options){caches.push({keys,options});return fn;}
    export async function twitchAccessToken(){throw Error('Twitch not configured');}
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (['next/cache', '@/integrations/igdb/server'].includes(specifier))
        return { url: fixture, shortCircuit: true };
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
          shortCircuit: true,
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
        };
      return next(url, context);
    },
  });
  const originalFetch = globalThis.fetch;
  const originalClient = process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_ID;
  let fx: unknown = { rates: { CLP: 976.093305 } };
  let mode = 'success';
  const requests: string[] = [];
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    requests.push(url);
    if (url === 'https://open.er-api.com/v6/latest/USD') {
      assert.equal(
        (options as RequestInit & { next: { revalidate: number } }).next.revalidate,
        3600,
      );
      assert.ok(options?.signal);
      await Promise.resolve();
      assert.ok(requests.some((request) => request.includes('storesearch')));
      if (mode === 'network') throw new Error('Offline');
      if (mode === 'http') return new Response('', { status: 503 });
      if (mode === 'json') return new Response('invalid json');
      return Response.json(fx);
    }
    if (url.includes('storesearch')) return Response.json({ items: [] });
    if (url.includes('cheapshark.com')) return Response.json([]);
    throw new Error('Unexpected upstream');
  };
  try {
    const { fetchGameLiveTelemetry } = await import('../../src/services/game-live-telemetry.ts');
    assert.equal((await fetchGameLiveTelemetry('Half-Life')).usdToClpRate, 976.093305);
    const { caches } = await import(fixture);
    assert.ok(
      caches.some(
        (entry: { keys: string[]; options: { revalidate: number } }) =>
          entry.keys.includes('usd-to-clp-rate-v1') && entry.options.revalidate === 3600,
      ),
    );
    for (const value of [
      null,
      {},
      { rates: { CLP: 0 } },
      { rates: { CLP: -1 } },
      { rates: { CLP: '975' } },
    ]) {
      fx = value;
      assert.equal((await fetchGameLiveTelemetry('Half-Life')).usdToClpRate, 975);
    }
    for (mode of ['network', 'http', 'json'])
      assert.equal((await fetchGameLiveTelemetry('Half-Life')).usdToClpRate, 975);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClient === undefined) delete process.env.TWITCH_CLIENT_ID;
    else process.env.TWITCH_CLIENT_ID = originalClient;
    hooks.deregister();
  }
});
