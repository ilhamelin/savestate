import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
test('Worlds service combines paginated schedule/live, deduplicates requests, expires caches and falls back safely', async () => {
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (specifier.startsWith('@/'))
        return {
          url: pathToFileURL(
            resolve('src', specifier.slice(2) + (specifier.endsWith('.json') ? '' : '.ts')),
          ).href,
          shortCircuit: true,
        };
      return next(specifier, context);
    },
    load(url, context, next) {
      if (url.startsWith('file:') && new URL(url).pathname.endsWith('.json'))
        return {
          format: 'module',
          source: `export default ${readFileSync(fileURLToPath(url), 'utf8').replace(/^\uFEFF/, '')}`,
          shortCircuit: true,
        };
      if (url.startsWith('file:') && new URL(url).pathname.endsWith('.ts'))
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
  let now = Date.parse('2026-10-13T12:00:00Z'),
    calls = 0,
    active = 0,
    maxActive = 0,
    failed = false;
  Date.now = () => now;
  function event(id: string, blockName = 'Play-ins', state = 'unstarted') {
    return {
      startTime: '2026-10-15T18:00:00Z',
      state,
      blockName,
      league: { slug: 'worlds' },
      match: {
        id,
        teams: [
          { name: 'Cloud9 Kia', code: 'C9' },
          { name: 'Karmine Corp', code: 'KC' },
        ],
        strategy: { count: 5 },
      },
    };
  }
  globalThis.fetch = async (input, init) => {
    calls++;
    active++;
    maxActive = Math.max(maxActive, active);
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.redirect, 'error');
    const url = new URL(String(input));
    assert.equal(url.hostname, 'esports-api.lolesports.com');
    assert.equal(url.searchParams.get('hl'), 'es-ES');
    await new Promise((done) => setTimeout(done, 2));
    active--;
    if (failed) return new Response('', { status: 503 });
    if (url.pathname.endsWith('getLive'))
      return Response.json({
        data: {
          schedule: {
            events: [
              event('1', 'Play-ins', 'inProgress'),
              { ...event('9'), league: { slug: 'lck' } },
            ],
          },
        },
      });
    if (url.pathname.endsWith('getSchedule'))
      return Response.json({
        data: {
          schedule: url.searchParams.has('pageToken')
            ? { events: [event('2', 'Final')], pages: {} }
            : { events: [event('1')], pages: { newer: 'next-token' } },
        },
      });
    return Response.json({
      data: {
        event: {
          id: url.searchParams.get('id'),
          league: { slug: 'worlds' },
          match: { teams: [], games: [] },
        },
      },
    });
  };
  try {
    const { fetchWorldsSchedule, fetchWorldsMatchDetail } =
      await import('../../src/services/worlds-esports.ts');
    const [first, duplicate] = await Promise.all([fetchWorldsSchedule(), fetchWorldsSchedule()]);
    assert.equal(first, duplicate);
    assert.equal(calls, 3);
    assert.ok(maxActive >= 2);
    assert.equal(first.defaultMatchId, '1');
    assert.equal(first.liveMatchId, '1');
    assert.equal(first.source, 'official');
    assert.equal(first.stages.flatMap((stage) => stage.matches).length, 2);
    assert.equal(await fetchWorldsSchedule(), first);
    assert.equal(calls, 3);
    const [detail, detailAgain] = await Promise.all([
      fetchWorldsMatchDetail('1'),
      fetchWorldsMatchDetail('1'),
    ]);
    assert.equal(detail, detailAgain);
    assert.equal(calls, 4);
    await assert.rejects(fetchWorldsMatchDetail('../bad'));
    assert.equal(calls, 4);
    now += 120000;
    await fetchWorldsMatchDetail('1');
    assert.equal(calls, 5);
    now += 180000;
    failed = true;
    assert.equal((await fetchWorldsSchedule()).source, 'stale');
    const freshModule = '../../src/services/worlds-esports.ts?fallback';
    const fresh = await import(freshModule);
    const fallback = await fresh.fetchWorldsSchedule();
    assert.equal(fallback.source, 'fallback');
    assert.equal(
      fallback.stages.flatMap((stage: { matches: unknown[] }) => stage.matches).length,
      46,
    );
    assert.ok(fallback.stages.every((stage: { matches: unknown[] }) => stage.matches.length > 0));
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
    hooks.deregister();
  }
});
