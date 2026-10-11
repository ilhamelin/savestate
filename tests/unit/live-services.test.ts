import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Chat endpoints enforce session, friendship, origin and latest-message ordering', async () => {
  const fixture = `data:text/javascript,${encodeURIComponent(`
    import { AppError } from '@/lib/http';
    export const state = { authenticated: true, friends: true, missing: false, calls: [], payload: null };
    export async function authenticated() {
      if (!state.authenticated) throw new AppError('Unauthorized',401);
      return { user: { id: '11111111-1111-4111-8111-111111111111' }, db: { from(table) {
        state.calls.push(['from',table]);
        const query = { select() { return this; }, eq() { return this; }, or(value) { state.calls.push(['or',value]); return this; },
          order(column, options) { state.calls.push(['order',column,options.ascending]); return this; }, limit(value) { state.calls.push(['limit',value]); return this; },
          insert(value) { state.payload=value; return this; }, single() { return Promise.resolve({ data: { id: 'message', ...state.payload }, error: state.missing ? { code: 'PGRST205' } : null }); },
          then(success, failure) { return Promise.resolve(table === 'friendships' ? { data: state.friends ? [{ id: 'friendship' }] : [], error: null } : { data: [{ id: 'new' },{ id: 'old' }], error: state.missing ? { code: 'PGRST205' } : null }).then(success, failure); }
        }; return query;
      } } };
    }
  `)}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier === 'next/cache')
        return {
          url: 'data:text/javascript,export const unstable_cache = fn => fn;',
          shortCircuit: true,
        };
      if (specifier === '@/services/game-live-telemetry')
        return {
          url: 'data:text/javascript,export const fetchGameLiveTelemetry = async title => ({ queriedTitle: title });',
          shortCircuit: true,
        };
      if (specifier === '@/lib/session') return { url: fixture, shortCircuit: true };
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
  try {
    const { state } = await import(fixture);
    const { GET, POST } = await import('../../src/app/api/chat/route.ts');
    const id = '22222222-2222-4222-8222-222222222222';
    const history = () => GET(new Request(`http://localhost/api/chat?friendId=${id}`));
    let response = await history();
    assert.equal(response.status, 200);
    assert.deepEqual(
      (await response.json()).data.messages.map((row: { id: string }) => row.id),
      ['old', 'new'],
    );
    assert.ok(
      state.calls.some(
        (call: unknown[]) => call[0] === 'order' && call[1] === 'created_at' && call[2] === false,
      ),
    );
    assert.ok(state.calls.some((call: unknown[]) => call[0] === 'limit' && call[1] === 50));
    assert.equal((await GET(new Request('http://localhost/api/chat?friendId=bad'))).status, 400);
    state.missing = true;
    assert.deepEqual((await (await history()).json()).data, { messages: [], persisted: false });
    const send = (content: string, origin = 'http://localhost') =>
      POST(
        new Request('http://localhost/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', origin },
          body: JSON.stringify({ friendId: id, content, sender_id: id }),
        }),
      );
    assert.equal((await send('hello')).status, 503);
    state.missing = false;
    response = await send(' hello ');
    assert.equal(response.status, 200);
    assert.equal(state.payload.sender_id, '11111111-1111-4111-8111-111111111111');
    assert.equal(state.payload.content, 'hello');
    assert.equal((await send('x'.repeat(501))).status, 400);
    assert.equal((await send('hello', 'https://evil.example')).status, 403);
    state.friends = false;
    assert.equal((await history()).status, 403);
    assert.equal((await send('hello')).status, 403);
    state.authenticated = false;
    assert.equal((await history()).status, 401);
    const { friendHistory } = await import('../../src/services/friend-chat.ts');
    await assert.rejects(friendHistory(id), /Unauthorized/);
    const multi = await import('../../src/app/api/tracker/multi/inspect/route.ts');
    const request = (input: unknown) =>
      new Request('http://localhost/api/tracker/multi/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify(input),
      });
    assert.equal((await multi.POST(request({ game: 'genshin', uid: '618285856' }))).status, 401);
    state.authenticated = true;
    const radar = await import('../../src/app/api/tracker/radar/route.ts');
    const radarRequest = (title: unknown) =>
      new Request('http://localhost/api/tracker/radar', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost' },
        body: JSON.stringify({ title }),
      });
    state.authenticated = false;
    assert.equal((await radar.POST(radarRequest('Test'))).status, 401);
    state.authenticated = true;
    for (const title of ['', 'x', 'x'.repeat(101), 123])
      assert.equal((await radar.POST(radarRequest(title))).status, 400);
    assert.equal(
      (await (await radar.POST(radarRequest(' Test Game '))).json()).data.queriedTitle,
      'Test Game',
    );
    const originalFetch = globalThis.fetch,
      oldKey = process.env.RIOT_API_KEY;
    const calls: string[] = [];
    try {
      globalThis.fetch = async (input) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('enka.network'))
          return Response.json({ playerInfo: { nickname: 'Traveler', level: 60 } });
        if (url.includes('active-shards')) return new Response('', { status: 503 });
        return Response.json({ gameName: 'Player', tagLine: 'EU', puuid: 'safe-account-id' });
      };
      assert.equal((await multi.POST(request({ game: 'genshin', uid: 'invalid' }))).status, 400);
      assert.equal(calls.length, 0);
      response = await multi.POST(request({ game: 'genshin', uid: '618285856' }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.nickname, 'Traveler');
      delete process.env.RIOT_API_KEY;
      assert.equal(
        (await multi.POST(request({ game: 'valorant', riotId: 'Player#EU', region: 'eu' }))).status,
        503,
      );
      process.env.RIOT_API_KEY = 'test-key';
      response = await multi.POST(request({ game: 'valorant', riotId: 'Player#EU', region: 'eu' }));
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.activeShard, null);
      assert.ok(calls.some((url) => url.startsWith('https://europe.api.riotgames.com/')));
      globalThis.fetch = async () => {
        throw new Error('Timeout');
      };
      assert.equal((await multi.POST(request({ game: 'genshin', uid: '618285856' }))).status, 503);
    } finally {
      globalThis.fetch = originalFetch;
      if (oldKey === undefined) delete process.env.RIOT_API_KEY;
      else process.env.RIOT_API_KEY = oldKey;
    }
  } finally {
    hooks.deregister();
  }
});

test('Telemetry partial failures preserve independent sources and cache arguments', async () => {
  const cacheFixture = `data:text/javascript,${encodeURIComponent('export const unstable_cache = (fn) => fn;')}`;
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier === 'next/cache') return { url: cacheFixture, shortCircuit: true };
      if (specifier === '@/integrations/igdb/server')
        return {
          url: 'data:text/javascript,export const twitchAccessToken = async () => "test-token";',
          shortCircuit: true,
        };
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
  const oldClient = process.env.TWITCH_CLIENT_ID,
    oldSecret = process.env.TWITCH_CLIENT_SECRET;
  process.env.TWITCH_CLIENT_ID = 'test';
  process.env.TWITCH_CLIENT_SECRET = 'test';
  try {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes('storesearch'))
        return Response.json({ items: [{ id: 42, name: 'Test Game™ - Deluxe' }] });
      if (url.includes('GetNumberOfCurrentPlayers')) throw new Error('Timeout');
      if (url.includes('cheapshark') && url.includes('/deals'))
        return Response.json([
          {
            dealID: 'deal',
            storeID: '7',
            salePrice: '1.00',
            normalPrice: '10.00',
            savings: '90',
            gameID: '42',
          },
        ]);
      if (url.includes('cheapshark') && url.includes('/games'))
        return new Response('', { status: 503 });
      if (url.includes('helix/games')) return Response.json({ data: [{ id: '42' }] });
      if (url.includes('helix/streams'))
        return Response.json({ data: [{ id: 'live', user_login: 'test', viewer_count: 10 }] });
      throw new Error('Unexpected URL');
    };
    const { fetchGameLiveTelemetry } = await import('../../src/services/game-live-telemetry.ts');
    const result = await fetchGameLiveTelemetry('Test Game');
    assert.equal(result.steamAppId, 42);
    assert.equal(result.steamCurrentPlayers, null);
    assert.equal(result.deals.length, 1);
    assert.equal(result.historicalLow, null);
    assert.equal(result.twitchTotalTopViewers, 10);
    const fallbackCalls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      fallbackCalls.push(url);
      if (url.includes('storesearch')) return Response.json({ items: [] });
      if (url.includes('cheapshark')) return Response.json([]);
      if (url.includes('helix/games')) return Response.json({ data: [] });
      if (url.includes('search/categories')) return Response.json({ data: [{ id: 'category' }] });
      return Response.json({ data: [{ id: 'live', user_login: 'test', viewer_count: 7 }] });
    };
    const fallback = await fetchGameLiveTelemetry('Variant Game');
    assert.equal(fallback.twitchTotalTopViewers, 7);
    assert.equal(fallback.steamAppId, null);
    assert.ok(fallbackCalls.some((url) => url.includes('search/categories?query=Variant%20Game')));
    assert.ok(
      fallbackCalls.some(
        (url) =>
          url.includes('cheapshark') &&
          url.includes('title=Variant%20Game') &&
          !url.includes('exact=1'),
      ),
    );
    globalThis.fetch = async () => {
      throw new Error('Offline');
    };
    const offline = await fetchGameLiveTelemetry('Other Game');
    assert.deepEqual(offline.deals, []);
    assert.equal(offline.steamAppId, null);
    assert.deepEqual(offline.twitchStreams, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldClient === undefined) delete process.env.TWITCH_CLIENT_ID;
    else process.env.TWITCH_CLIENT_ID = oldClient;
    if (oldSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET;
    else process.env.TWITCH_CLIENT_SECRET = oldSecret;
    hooks.deregister();
  }
});
