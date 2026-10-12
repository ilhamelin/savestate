import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Valorant dual integration isolates credentials, handles partial failure and preserves game semantics', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier === 'next/cache')
        return {
          url: 'data:text/javascript,export const unstable_cache = fn => fn;',
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
  const oldFetch = globalThis.fetch,
    oldRiot = process.env.RIOT_API_KEY,
    oldHenrik = process.env.HENRIK_API_KEY;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  let mode = 'henrik';
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, headers: init?.headers as Record<string, string> });
      if (url.startsWith('https://valorant-api.com'))
        return Response.json({
          data: [{ displayName: 'VALORANT', wideArt: 'https://media.valorant-api.com/banner.png' }],
        });
      if (url.includes('api.henrikdev.xyz')) {
        assert.equal((init?.headers as Record<string, string>).Authorization, 'henrik-test');
        if (mode === 'riot') return new Response('', { status: 503 });
        if (url.includes('/account/'))
          return Response.json({
            data: {
              name: 'Player',
              tag: 'TAG',
              puuid: mode === 'mismatch' ? 'other' : 'target',
              account_level: 50,
            },
          });
        if (url.includes('/mmr/'))
          return Response.json({
            data: {
              name: 'Player',
              tag: 'TAG',
              puuid: 'target',
              current_data: { currenttierpatched: 'Gold 3', mmr_change_to_last_game: 18 },
            },
          });
        return Response.json({ data: [] });
      }
      if (url.includes('accounts/by-riot-id'))
        return Response.json({ gameName: 'Player', tagLine: 'TAG', puuid: 'target' });
      if (url.includes('active-shards'))
        return Response.json({ activeShard: 'evil.example/steal' });
      if (url.includes('summoner'))
        return url.includes('la1.')
          ? Response.json({ summonerLevel: 200, profileIconId: 5 })
          : new Response('', { status: 404 });
      if (url.includes('tft/league'))
        return url.includes('la1.')
          ? Response.json([
              { queueType: 'RANKED_TFT', tier: 'DIAMOND', rank: 'II', wins: 40, losses: 20 },
            ])
          : new Response('', { status: 404 });
      if (url.includes('/val/content'))
        return Response.json({
          acts: [{ isActive: true, type: 'act', id: 'act-id', name: 'Acto de prueba' }],
        });
      if (url.includes('leaderboards'))
        return Response.json({
          players: [
            {
              puuid: 'target',
              leaderboardRank: 8,
              gameName: 'Player',
              tagLine: 'TAG',
              rankedRating: 800,
              numberOfWins: 90,
            },
            {
              leaderboardRank: 1,
              gameName: 'Top',
              tagLine: 'TOP',
              rankedRating: 1000,
              numberOfWins: 120,
            },
          ],
        });
      throw new Error('Unexpected URL');
    };
    const { inspectValorant } = await import('../../src/services/valorant.ts');
    const input = { gameName: 'Player', tagLine: 'TAG', region: 'latam' as const };
    process.env.HENRIK_API_KEY = 'henrik-test';
    delete process.env.RIOT_API_KEY;
    let data = await inspectValorant(input);
    assert.equal(data.dataSource, 'henrik_full');
    assert.equal(data.accountLevel, 50);
    assert.equal(data.currentRank, 'Gold 3');
    assert.equal(data.lastMmrChange, 18);
    mode = 'mismatch';
    process.env.RIOT_API_KEY = 'riot-test';
    data = await inspectValorant(input);
    assert.equal(data.accountLevel, null);
    assert.equal(data.currentRank, 'Gold 3');
    process.env.RIOT_API_KEY = 'riot-test';
    mode = 'riot';
    delete process.env.HENRIK_API_KEY;
    data = await inspectValorant(input);
    assert.equal(data.dataSource, 'riot_official');
    assert.equal(data.accountLevel, null);
    assert.equal(data.riotCrossProfile?.summonerLevel, 200);
    assert.equal(data.riotCrossProfile?.tftTier, 'DIAMOND II');
    assert.equal(data.currentRank, 'Clasificación regional #8');
    assert.equal(data.activeActName, 'Acto de prueba');
    assert.equal(data.activeShard, null);
    assert.ok(
      calls.some((call) => call.url.startsWith('https://latam.api.riotgames.com/val/content')),
    );
    assert.ok(calls.every((call) => !call.url.includes('evil.example')));
    process.env.HENRIK_API_KEY = 'henrik-test';
    data = await inspectValorant(input);
    assert.equal(data.dataSource, 'riot_official');
    for (const call of calls) {
      if (call.url.includes('api.riotgames.com'))
        assert.equal(call.headers.Authorization, undefined);
      if (call.url.includes('valorant-api.com'))
        assert.equal(call.headers['X-Riot-Token'], undefined);
    }
    delete process.env.RIOT_API_KEY;
    delete process.env.HENRIK_API_KEY;
    await assert.rejects(inspectValorant(input), /Configura/);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [name, value] of [
      ['RIOT_API_KEY', oldRiot],
      ['HENRIK_API_KEY', oldHenrik],
    ]) {
      if (value === undefined) delete process.env[name!];
      else process.env[name!] = value;
    }
    hooks.deregister();
  }
});
