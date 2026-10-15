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
    failed = false,
    gameState = 'unstarted',
    feedCalls = 0,
    feedMode: 'ok' | 'error' | 'empty' | 'adaptive' | 'initial' = 'ok';
  const requestedWindows: string[] = [];
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
    if (url.hostname === 'feed.lolesports.com') {
      active--;
      feedCalls++;
      if (feedMode === 'error') throw new Error('Finished map feed removed');
      if (feedMode === 'empty') return Response.json({ frames: [] });
      const later = url.searchParams.has('startingTime');
      const startingTime = url.searchParams.get('startingTime');
      if (startingTime) requestedWindows.push(startingTime);
      if (feedMode === 'adaptive' || feedMode === 'initial') {
        const offset = startingTime
          ? (Date.parse(startingTime) - Date.parse('2026-10-15T12:00:00Z')) / 60000
          : 0;
        if (feedMode === 'adaptive' && offset === 45) return new Response('', { status: 404 });
        if (feedMode === 'adaptive' && offset === 35) return Response.json({ frames: [] });
        const finished = feedMode === 'adaptive' && offset === 50;
        return Response.json({
          gameMetadata: {
            patchVersion: '16.17',
            blueTeamMetadata: { participantMetadata: [] },
            redTeamMetadata: { participantMetadata: [] },
          },
          frames: [
            {
              rfc460Timestamp: finished ? '2026-10-15T12:50:00Z' : '2026-10-15T12:00:00Z',
              gameState: finished ? 'finished' : 'in_game',
              blueTeam: { totalGold: finished ? 75000 : 2500, totalKills: finished ? 22 : 0 },
              redTeam: { totalGold: finished ? 55000 : 2500, totalKills: finished ? 8 : 0 },
            },
            ...(!finished
              ? [
                  {
                    rfc460Timestamp: '2026-10-15T12:00:01Z',
                    gameState: 'in_game',
                    blueTeam: { totalGold: 2500, totalKills: 0 },
                    redTeam: { totalGold: 2500, totalKills: 0 },
                  },
                ]
              : []),
          ],
        });
      }
      return Response.json({
        gameMetadata: {
          patchVersion: '16.17',
          blueTeamMetadata: { participantMetadata: [] },
          redTeamMetadata: { participantMetadata: [] },
        },
        frames: [
          {
            rfc460Timestamp: later ? '2026-10-15T12:40:00Z' : '2026-10-15T12:00:00Z',
            gameState: later ? 'finished' : 'in_game',
            blueTeam: { totalGold: 75000, totalKills: 22 },
            redTeam: { totalGold: 55000, totalKills: 8 },
          },
        ],
      });
    }
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
    if (url.pathname.endsWith('getTeams')) return new Response('', { status: 503 });
    return Response.json({
      data: {
        event: {
          id: url.searchParams.get('id'),
          league: { slug: 'worlds' },
          match: {
            teams: [
              { id: '98767991877340524', name: 'Cloud9 Kia', code: 'C9' },
              { id: '111692118851466302', name: 'Karmine Corp', code: 'KC' },
            ],
            games: [{ id: '55', number: 1, state: gameState, teams: [], vods: [] }],
          },
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
    assert.equal(calls, 6);
    assert.equal(feedCalls, 0);
    assert.equal(detail.rosters.C9?.players.length, 7);
    assert.deepEqual(detail.gameTelemetry, {});
    await assert.rejects(fetchWorldsMatchDetail('../bad'));
    assert.equal(calls, 6);
    now += 120000;
    await fetchWorldsMatchDetail('1');
    assert.equal(calls, 7);
    now += 60000;
    gameState = 'inProgress';
    const liveDetail = await fetchWorldsMatchDetail('1');
    assert.equal(feedCalls, 2);
    assert.equal(liveDetail.gameTelemetry[1]?.durationSeconds, 2400);
    assert.equal(liveDetail.gameTelemetry[1]?.gameState, 'finished');
    assert.equal(
      requestedWindows[0],
      new Date(Math.floor((now - 30000) / 10000) * 10000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    );
    now += 15000;
    await fetchWorldsMatchDetail('1');
    assert.equal(feedCalls, 2);
    // Finished telemetry remains cached for seven days, then survives feed failures/empty data.
    now += 2 * 86400000;
    await fetchWorldsMatchDetail('1');
    assert.equal(feedCalls, 2);
    now += 6 * 86400000;
    feedMode = 'error';
    const retained = await fetchWorldsMatchDetail('1');
    assert.equal(feedCalls, 3);
    assert.deepEqual(retained.gameTelemetry[1], liveDetail.gameTelemetry[1]);
    now += 60000;
    feedMode = 'empty';
    const emptyFeed = await fetchWorldsMatchDetail('1');
    assert.equal(feedCalls, 4);
    assert.deepEqual(emptyFeed.gameTelemetry[1], liveDetail.gameTelemetry[1]);
    // Even when a subsequent event response resets a map to unstarted, keep its prior detail.
    now += 60000;
    gameState = 'unstarted';
    const resetDetail = await fetchWorldsMatchDetail('1');
    assert.equal(feedCalls, 4);
    assert.deepEqual(resetDetail.gameTelemetry[1], liveDetail.gameTelemetry[1]);
    gameState = 'completed';
    feedMode = 'adaptive';
    requestedWindows.length = 0;
    const adaptiveModule = '../../src/services/worlds-esports.ts?adaptive';
    const adaptive = await import(adaptiveModule);
    const finalDetail = await adaptive.fetchWorldsMatchDetail('1');
    assert.deepEqual(
      requestedWindows,
      [45, 35, 40, 50].map((minutes) =>
        new Date(Date.parse('2026-10-15T12:00:00Z') + minutes * 60000)
          .toISOString()
          .replace(/\.\d{3}Z$/, 'Z'),
      ),
    );
    assert.equal(finalDetail.gameTelemetry[1]?.durationSeconds, 3000);
    assert.equal(finalDetail.gameTelemetry[1]?.blueTeam.totalKills, 22);
    assert.equal(finalDetail.gameTelemetry[1]?.gameState, 'finished');
    // If every candidate is the opening 0:01 frame, do not cache or expose it.
    feedMode = 'initial';
    requestedWindows.length = 0;
    const initialModule = '../../src/services/worlds-esports.ts?initial-only';
    const initialOnly = await import(initialModule);
    assert.deepEqual((await initialOnly.fetchWorldsMatchDetail('1')).gameTelemetry, {});
    assert.equal(requestedWindows.length, 9);
    now += 105000;
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
