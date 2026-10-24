import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const fixture =
  'data:text/javascript,' +
  encodeURIComponent(
    'export const unstable_cache=(fn)=>fn; export const catalogueAdmin=()=>{throw new Error("Unexpected database access");};',
  );
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only')
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (['next/cache', '@/integrations/supabase/admin'].includes(specifier))
      return { url: fixture, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(path + '.ts') ? path + '.ts' : path + '.tsx').href,
        shortCircuit: true,
      };
    }
    if (specifier === './query' && context.parentURL?.endsWith('/igdb/server.ts'))
      return { url: new URL('./query.ts', context.parentURL).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && url.endsWith('.ts') && !url.includes('node_modules'))
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
const { twitchAccessToken, cachedTwitchAccessToken } =
  await import('../../src/integrations/igdb/server.ts');
test.after(() => hooks.deregister());
test('OAuth probe aborts at its supplied deadline, then shares and caches a successful cold token without database queries', async () => {
  const original = globalThis.fetch;
  const clientId = process.env.TWITCH_CLIENT_ID,
    clientSecret = process.env.TWITCH_CLIENT_SECRET;
  process.env.TWITCH_CLIENT_ID = 'test-client';
  process.env.TWITCH_CLIENT_SECRET = 'test-secret';
  let requests = 0;
  let fail = true;
  globalThis.fetch = async (input, init) => {
    requests++;
    assert.equal(String(input), 'https://id.twitch.tv/oauth2/token');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    if (fail)
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    return Response.json({ access_token: 'private-shared-token', expires_in: 3600 });
  };
  try {
    assert.equal(cachedTwitchAccessToken(), null);
    const controller = new AbortController();
    const first = twitchAccessToken(controller.signal);
    controller.abort();
    await assert.rejects(first, /Aborted/);
    fail = false;
    const tokens = await Promise.all([twitchAccessToken(), twitchAccessToken()]);
    assert.deepEqual(tokens, ['private-shared-token', 'private-shared-token']);
    assert.equal(await twitchAccessToken(), 'private-shared-token');
    assert.equal(cachedTwitchAccessToken(), 'private-shared-token');
    assert.equal(requests, 2);
  } finally {
    globalThis.fetch = original;
    if (clientId === undefined) delete process.env.TWITCH_CLIENT_ID;
    else process.env.TWITCH_CLIENT_ID = clientId;
    if (clientSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
    else process.env.TWITCH_CLIENT_SECRET = clientSecret;
  }
});
