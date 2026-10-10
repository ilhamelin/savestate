import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

test('Rift service protects credentials, routes official APIs, limits concurrency and exposes truthful partial errors', async () => {
  const state = {
    authenticated: false,
    mode: 'ok',
    requests: [] as { url: URL; headers: Headers }[],
    cache: new Map<string, Promise<unknown>>(),
    cacheKeys: [] as string[][],
    active: 0,
    maxActive: 0,
  };
  const shared = globalThis as typeof globalThis & { __riftTest?: typeof state };
  shared.__riftTest = state;
  const http = pathToFileURL(resolve('src/lib/http.ts')).href;
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
      let source: string | undefined;
      if (specifier === 'server-only') source = 'export {};';
      if (specifier === 'next/cache')
        source =
          'export function unstable_cache(fn,keys){return async()=>{const s=globalThis.__riftTest;s.cacheKeys.push(keys);const key=JSON.stringify(keys);if(!s.cache.has(key))s.cache.set(key,fn().catch(error=>{s.cache.delete(key);throw error}));return s.cache.get(key)}}';
      if (specifier === '@/lib/session')
        source = `import {AppError} from ${JSON.stringify(http)};export async function authenticated(){if(!globalThis.__riftTest.authenticated)throw new AppError('Inicia sesión.',401);return {user:{id:'qa'}}}`;
      if (source)
        return { url: 'data:text/javascript,' + encodeURIComponent(source), shortCircuit: true };
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
  const originalFetch = globalThis.fetch,
    previousKey = process.env.RIOT_API_KEY,
    previousUrl = process.env.NEXT_PUBLIC_APP_URL;
  const puuid = 'P'.repeat(78);
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers);
    state.requests.push({ url, headers });
    if (url.hostname === 'ddragon.leagueoflegends.com') {
      assert.equal(headers.has('X-Riot-Token'), false);
      if (url.pathname === '/api/versions.json') return Response.json(['16.20.1', '16.19.1']);
      if (url.pathname.endsWith('/champion.json'))
        return Response.json({
          data: { Ahri: { key: '103', name: 'Ahri', image: { full: 'Ahri.png' } } },
        });
      if (url.pathname.endsWith('/summoner.json'))
        return Response.json({
          data: { Flash: { key: '4', name: 'Destello', image: { full: 'SummonerFlash.png' } } },
        });
      throw new Error('Unexpected Data Dragon request');
    }
    assert.ok(['americas.api.riotgames.com', 'la2.api.riotgames.com'].includes(url.hostname));
    assert.equal(headers.get('X-Riot-Token'), process.env.RIOT_API_KEY);
    assert.equal(url.searchParams.has('api_key'), false);
    if (url.pathname.includes('/accounts/by-riot-id/')) {
      const status = Number(state.mode.replace('account-', ''));
      if (state.mode.startsWith('account-'))
        return Response.json({ status: {} }, { status, headers: { 'Retry-After': '12' } });
      return Response.json({ puuid, gameName: 'Jugador Ñ', tagLine: 'LAS' });
    }
    if (url.pathname.includes('/summoner/v4/'))
      return Response.json({ summonerLevel: 400, profileIconId: 123 });
    if (url.pathname.includes('/league/v4/')) {
      if (state.mode === 'rank-failed') return Response.json({}, { status: 503 });
      return Response.json([
        {
          queueType: 'RANKED_SOLO_5x5',
          tier: 'GOLD',
          rank: 'IV',
          leaguePoints: 30,
          wins: 6,
          losses: 2,
        },
      ]);
    }
    if (url.pathname.includes('/champion-mastery/v4/')) {
      assert.equal(url.searchParams.get('count'), '3');
      if (state.mode === 'mastery-failed') return Response.json({}, { status: 503 });
      return Response.json([{ championId: 103, championLevel: 12, championPoints: 340000 }]);
    }
    if (url.pathname.endsWith('/ids')) {
      if (state.mode === 'ids-failed') return Response.json({}, { status: 503 });
      const start = Number(url.searchParams.get('start'));
      const count = state.mode === 'ids-short' ? 2 : Number(url.searchParams.get('count'));
      return Response.json(Array.from({ length: count }, (_, i) => `LA2_${start + i + 1}`));
    }
    if (url.pathname.includes('/match/v5/matches/')) {
      state.active++;
      state.maxActive = Math.max(state.maxActive, state.active);
      await new Promise((done) => setTimeout(done, 2));
      state.active--;
      const id = url.pathname.split('/').at(-1)!;
      if (state.mode === 'match-rate' && id === 'LA2_1')
        return Response.json({}, { status: 429, headers: { 'Retry-After': '10' } });
      const index = Number(id.split('_')[1]);
      return Response.json({
        metadata: { matchId: id },
        info: {
          queueId: index === 10 ? 0 : 420,
          gameType: index === 10 ? 'CUSTOM_GAME' : 'MATCHED_GAME',
          gameVersion: '16.19.1234',
          gameDuration: 1200,
          gameEndTimestamp: 1791637200000 - index * 100000,
          gameMode: 'CLASSIC',
          participants: Array.from({ length: 10 }, (_, i) => ({
            puuid: i === 0 ? puuid : `other-${i}`,
            riotIdGameName: i === 0 ? 'Jugador Ñ' : `Player${i}`,
            riotIdTagline: 'LAS',
            teamId: i < 5 ? 100 : 200,
            championId: 103,
            championName: 'Ahri',
            champLevel: 16,
            kills: 10,
            deaths: 2,
            assists: 6,
            totalMinionsKilled: 180,
            neutralMinionsKilled: 20,
            item0: 1001,
            item1: 0,
            item2: 0,
            item3: 0,
            item4: 0,
            item5: 0,
            item6: 3340,
            summoner1Id: 4,
            summoner2Id: 4,
            totalDamageDealtToChampions: 22000,
            goldEarned: 14500,
            win: i < 5,
          })),
        },
      });
    }
    throw new Error('Unexpected Riot request');
  };
  try {
    process.env.NEXT_PUBLIC_APP_URL = 'https://savestate.test';
    delete process.env.RIOT_API_KEY;
    const { POST } = await import('../../src/app/api/tracker/lol/inspect/route.ts');
    const { inspectLol } = await import('../../src/integrations/riot/server.ts');
    const request = (
      riotId = 'Jugador Ñ#LAS',
      platform = 'la2',
      origin = 'https://savestate.test',
    ) =>
      new Request('https://savestate.test/api/tracker/lol/inspect', {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ riotId, platform }),
      });
    assert.equal((await POST(request())).status, 401);
    state.authenticated = true;
    assert.equal((await POST(request('Jugador Ñ#LAS', 'la2', 'https://evil.test'))).status, 403);
    assert.equal((await POST(request('invalid'))).status, 400);
    assert.equal((await POST(request('Jugador Ñ#LAS', '__proto__'))).status, 400);
    const absent = await POST(request());
    assert.equal(absent.status, 503);
    assert.match((await absent.json()).error, /RIOT_API_KEY/);
    assert.equal(state.requests.length, 0);
    process.env.RIOT_API_KEY = 'RGAPI-unit-test-only-no-real-credentials';
    const response = await POST(request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const profile = (await response.json()).data;
    assert.equal(profile.matches.length, 9);
    assert.equal(profile.nextStart, 10);
    assert.equal(profile.hasMore, true);
    assert.equal(profile.matches[0].participants.length, 10);
    assert.equal(profile.soloQueue.winrate, 75);
    assert.equal(profile.rankStatus, 'available');
    assert.equal(profile.masteryStatus, 'available');
    assert.equal(profile.masteries[0].points, 340000);
    assert.equal(profile.masteries[0].championName, 'Ahri');
    assert.match(profile.masteries[0].championIcon, /16\.20\.1\/img\/champion\/Ahri.png/);
    assert.ok(profile.warnings.some((value: string) => value.includes('personalizadas')));
    assert.ok(state.maxActive >= 2 && state.maxActive <= 3);
    assert.equal(state.active, 0);
    assert.ok(
      state.requests.some(
        ({ url }) =>
          url.hostname === 'la2.api.riotgames.com' &&
          url.pathname === `/lol/league/v4/entries/by-puuid/${puuid}`,
      ),
    );
    assert.ok(state.requests.some(({ url }) => url.pathname.includes('/Jugador%20%C3%91/LAS')));
    assert.ok(state.requests.some(({ url }) => url.pathname.includes('/cdn/16.19.1/')));
    assert.match(profile.profileIconUrl, /\/cdn\/16.20.1\//);
    assert.equal(JSON.stringify(profile).includes(process.env.RIOT_API_KEY), false);
    assert.equal(JSON.stringify(state.cacheKeys).includes(process.env.RIOT_API_KEY), false);
    const count = state.requests.length;
    await inspectLol('Jugador Ñ#LAS', 'la2');
    assert.equal(state.requests.length, count);
    const secondPage = await inspectLol('Jugador Ñ#LAS', 'la2', 10, 10);
    assert.equal(secondPage.matches.length, 10);
    assert.equal(secondPage.nextStart, 20);
    assert.ok(
      secondPage.matches.every(
        (match) =>
          !profile.matches.some(
            (previous: { matchId: string }) => previous.matchId === match.matchId,
          ),
      ),
    );
    assert.ok(
      state.requests.some(
        ({ url }) =>
          url.pathname.endsWith('/ids') &&
          url.searchParams.get('start') === '10' &&
          url.searchParams.get('count') === '10',
      ),
    );
    const pagedRequest = new Request('https://savestate.test/api/tracker/lol/inspect', {
      method: 'POST',
      headers: { Origin: 'https://savestate.test', 'Content-Type': 'application/json' },
      body: JSON.stringify({ riotId: 'Jugador Ñ#LAS', platform: 'la2', start: 10, count: 10 }),
    });
    assert.equal((await (await POST(pagedRequest)).json()).data.nextStart, 20);
    await assert.rejects(() => inspectLol('Jugador Ñ#LAS', 'la2', -1, 10));
    await assert.rejects(() => inspectLol('Jugador Ñ#LAS', 'la2', 0, 11));
    state.cache.clear();
    state.mode = 'ids-short';
    const last = await inspectLol('Jugador Ñ#LAS', 'la2', 20, 10);
    assert.equal(last.nextStart, 22);
    assert.equal(last.hasMore, false);
    state.cache.clear();
    state.mode = 'ids-failed';
    const noList = await inspectLol('Jugador Ñ#LAS', 'la2', 20, 10);
    assert.equal(noList.nextStart, 20);
    assert.equal(noList.hasMore, true);
    for (const status of [403, 404, 429]) {
      state.cache.clear();
      state.mode = `account-${status}`;
      const result = await POST(request());
      assert.equal(result.status, status === 403 ? 503 : status);
      if (status === 429) assert.equal(result.headers.get('retry-after'), '12');
    }
    state.cache.clear();
    state.mode = 'rank-failed';
    const rankMissing = await inspectLol('Jugador Ñ#LAS', 'la2');
    assert.equal(rankMissing.rankStatus, 'unavailable');
    assert.equal(rankMissing.soloQueue, null);
    state.cache.clear();
    state.mode = 'mastery-failed';
    const masteryMissing = await inspectLol('Jugador Ñ#LAS', 'la2');
    assert.equal(masteryMissing.masteryStatus, 'unavailable');
    assert.equal(masteryMissing.matches.length, 9);
    assert.equal(masteryMissing.masteries.length, 0);
    state.cache.clear();
    state.requests = [];
    state.mode = 'match-rate';
    const limited = await inspectLol('Jugador Ñ#LAS', 'la2');
    assert.equal(limited.matches.length, 2);
    assert.equal(limited.nextStart, 3);
    assert.equal(limited.hasMore, true);
    assert.ok(limited.warnings.some((value) => value.includes('limitó')));
    assert.equal(
      state.requests.filter(({ url }) => /\/matches\/LA2_/.test(url.pathname)).length,
      3,
    );
  } finally {
    hooks.deregister();
    globalThis.fetch = originalFetch;
    delete shared.__riftTest;
    if (previousKey === undefined) delete process.env.RIOT_API_KEY;
    else process.env.RIOT_API_KEY = previousKey;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previousUrl;
  }
});
