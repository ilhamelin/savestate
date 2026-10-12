import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('HSR store fallback and Rust private stats preserve available data without leaking Steam credentials', async () => {
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
    oldKey = process.env.STEAM_API_KEY;
  const id = '76561198000000001';
  let mode = 'private';
  let resolved = false;
  const calls: string[] = [];
  try {
    process.env.STEAM_API_KEY = 'steam-test-secret';
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      calls.push(url.href);
      assert.equal(init?.redirect, 'error');
      assert.ok(init?.signal);
      if (url.hostname === 'raw.githubusercontent.com') {
        assert.equal(url.searchParams.get('key'), null);
        assert.equal(
          (init?.headers as Record<string, string>)['User-Agent'],
          'SaveState/1.0 (+https://savestate.app)',
        );
        return url.pathname.endsWith('hsr.json')
          ? Response.json({ es: { name: '7 de Marzo' }, en: {} })
          : new Response('', { status: 503 });
      }
      if (url.hostname === 'enka.network')
        return Response.json({
          detailInfo: { uid: '800000001', nickname: 'HSR player', avatarDetailList: [] },
        });
      assert.equal(url.hostname, 'api.steampowered.com');
      assert.equal(url.searchParams.get('key'), 'steam-test-secret');
      if (url.pathname.includes('ResolveVanityURL')) {
        resolved = true;
        return Response.json({
          response: { success: 1, steamid: mode === 'invalid-id' ? 'bad' : id },
        });
      }
      assert.ok(resolved);
      if (url.pathname.includes('GetPlayerSummaries')) {
        assert.equal(url.searchParams.get('steamids'), id);
        return Response.json({
          response: { players: [{ steamid: id, personaname: 'Rust player' }] },
        });
      }
      assert.equal(url.searchParams.get('steamid'), id);
      if (url.pathname.includes('GetOwnedGames'))
        return Response.json({ response: { games: [{ appid: 252490, playtime_forever: 600 }] } });
      assert.equal(url.searchParams.get('appid'), '252490');
      if (url.pathname.includes('GetPlayerAchievements'))
        return Response.json({
          playerstats: { success: true, achievements: [{ achieved: 1 }, { achieved: 0 }] },
        });
      return mode === 'private'
        ? new Response('', { status: 403 })
        : Response.json({
            playerstats: {
              steamID: id,
              stats: [
                { name: 'kill_player', value: 10 },
                { name: 'deaths', value: 2 },
              ],
            },
          });
    };
    const { inspectCompetitive } = await import('../../src/services/competitive-tracker.ts');
    const { getHsrEnkaStore } = await import('../../src/services/hsr-enka-store.ts');
    const store = await getHsrEnkaStore();
    assert.deepEqual(store.avatars, {});
    assert.equal(store.locEs.name, '7 de Marzo');
    const hsr = await inspectCompetitive({ game: 'hsr', uid: '800000001' });
    assert.equal(hsr.game, 'hsr');
    let rust = await inspectCompetitive({ game: 'rust', steamId: 'rust_player' });
    assert.equal(rust.game, 'rust');
    if (rust.game !== 'rust') throw new Error('Unexpected game');
    assert.equal(rust.statsPublic, false);
    assert.equal(rust.hoursPlayed, 10);
    assert.equal(rust.achievementsUnlocked, 1);
    assert.equal(rust.combat, null);
    mode = 'public';
    rust = await inspectCompetitive({
      game: 'rust',
      steamId: 'https://steamcommunity.com/id/rust_player',
    });
    assert.equal(rust.game, 'rust');
    if (rust.game !== 'rust') throw new Error('Unexpected game');
    assert.equal(rust.combat?.kdRatio, 5);
    mode = 'invalid-id';
    const before = calls.length;
    await assert.rejects(inspectCompetitive({ game: 'rust', steamId: 'rust_player' }));
    assert.equal(calls.length - before, 1);
    delete process.env.STEAM_API_KEY;
    await assert.rejects(inspectCompetitive({ game: 'rust', steamId: id }), /STEAM_API_KEY/);
    assert.ok(
      calls
        .filter((url) => !url.includes('api.steampowered.com'))
        .every((url) => !url.includes('steam-test-secret')),
    );
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.STEAM_API_KEY;
    else process.env.STEAM_API_KEY = oldKey;
    hooks.deregister();
  }
});
