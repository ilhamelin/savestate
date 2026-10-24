import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { load } from 'cheerio';
import {
  formatGameHours,
  formatSpeedrunTime,
  sanitizeVideoUrl,
  mapIgdbDuration,
  normalizeProtonTier,
  mapProtonDbReport,
  mapSpeedrunRecord,
  normalizedMetaTitle,
} from '../../src/domain/game-meta.ts';

test('Duration formatter handles hours, sub-hour minutes, one decimal and absent/invalid data', () => {
  assert.equal(formatGameHours(43200), '12 h');
  assert.equal(formatGameHours(52200), '14.5 h');
  assert.equal(formatGameHours(2700), '45 min');
  assert.equal(formatGameHours(2733), '45.6 min');
  for (const value of [null, 0, -1, NaN, Infinity]) assert.equal(formatGameHours(value), '—');
  assert.deepEqual(mapIgdbDuration({ hastily: 43200, normally: 72000, completely: 108000 }), {
    mainStoryHours: 12,
    mainExtraHours: 20,
    completionistHours: 30,
  });
  assert.deepEqual(mapIgdbDuration({ hastily: '123', normally: -1, completely: 3600 }), {
    mainStoryHours: null,
    mainExtraHours: null,
    completionistHours: 1,
  });
  for (const value of [null, [], {}, { hastily: 0 }, { normally: Infinity }])
    assert.equal(mapIgdbDuration(value), null);
});
test('Speedrun time preserves hundredths, pads clocks and carries rounding into the next minute', () => {
  assert.equal(formatSpeedrunTime(5052), '1:24:12');
  assert.equal(formatSpeedrunTime(65), '01:05');
  assert.equal(formatSpeedrunTime(0), '00:00');
  assert.equal(formatSpeedrunTime(65.25), '01:05.25');
  assert.equal(formatSpeedrunTime(59.999), '01:00');
  assert.equal(formatSpeedrunTime(0.23), '00:00.23');
  for (const value of [-1, NaN, Infinity, Number.MAX_VALUE])
    assert.equal(formatSpeedrunTime(value), '—');
});
test('Video whitelist accepts public HTTPS watch/clip URLs and rejects spoofing, redirects and credentials', () => {
  for (const url of [
    'https://www.youtube.com/watch?v=HYsz1hP0BFo',
    'https://youtube.com/shorts/HYsz1hP0BFo',
    'https://m.youtube.com/watch?v=HYsz1hP0BFo',
    'https://youtu.be/HYsz1hP0BFo?t=12',
    'https://www.twitch.tv/videos/1234',
    'https://clips.twitch.tv/LegitimateClip',
    'https://twitch.tv/runner/clip/LegitimateClip',
  ])
    assert.equal(sanitizeVideoUrl(url), url);
  for (const url of [
    null,
    undefined,
    '',
    'javascript:alert(1)',
    'http://youtu.be/HYsz1hP0BFo',
    'https://youtube.com.evil.test/watch?v=HYsz1hP0BFo',
    'https://evil.test/?url=https://youtube.com/watch?v=HYsz1hP0BFo',
    'https://user:pass@www.youtube.com/watch?v=HYsz1hP0BFo',
    'https://www.youtube.com:444/watch?v=HYsz1hP0BFo',
    'https://www.youtube.com/redirect?q=https://evil.test',
    'https://www.youtube.com/watch?v=invalid',
    'https://youtube.com\n.evil.test/watch?v=HYsz1hP0BFo',
  ])
    assert.equal(sanitizeVideoUrl(url), null);
});
test('Proton tier heuristic is explicit and never marks silver/bronze/borked/pending as Deck-ready', () => {
  for (const tier of ['platinum', 'gold', 'silver', 'bronze', 'borked', 'pending']) {
    const result = mapProtonDbReport({ tier, score: 0.8, confidence: 'strong', total: 75 }, 620)!;
    assert.equal(result.tier, tier);
    assert.equal(result.steamDeckVerified, tier === 'platinum' || tier === 'gold');
    assert.equal(result.protonUrl, 'https://www.protondb.com/app/620');
    assert.equal(result.totalReports, 75);
  }
  assert.equal(normalizeProtonTier('unknown'), 'pending');
  assert.equal(mapProtonDbReport({ tier: 'bad-tier' }, 620), null);
  assert.equal(mapProtonDbReport({ tier: 'gold' }, -1), null);
  assert.equal(
    mapProtonDbReport({ tier: 'gold', total: -9, score: Infinity }, 620)?.totalReports,
    0,
  );
  assert.equal(mapProtonDbReport(null, 620), null);
});

const board = () => ({
  data: {
    weblink: 'https://www.speedrun.com/portal2?h=Any',
    runs: [
      {
        place: 1,
        run: {
          times: { primary_t: 5052 },
          status: { status: 'verified' },
          players: [
            { rel: 'user', id: 'runner2' },
            { rel: 'guest', name: 'Guest' },
          ],
          date: '2026-10-20',
          videos: {
            links: [{ uri: 'https://evil.test/video' }, { uri: 'https://youtu.be/HYsz1hP0BFo' }],
          },
        },
      },
    ],
    players: {
      data: [
        { id: 'runner1', names: { international: 'Wrong runner' } },
        { id: 'runner2', names: { international: 'Correct runner' } },
      ],
    },
  },
});
test('Speedrun parser resolves flat embedded players by run IDs and selects a verified first-place run', () => {
  const result = mapSpeedrunRecord(board(), 'Any%', 'game123', 'cat123')!;
  assert.equal(result.runnerName, 'Correct runner & Guest');
  assert.equal(result.timeFormatted, '1:24:12');
  assert.equal(result.videoUrl, 'https://youtu.be/HYsz1hP0BFo');
  assert.equal(result.dateIso, '2026-10-20T00:00:00.000Z');
  assert.equal(mapSpeedrunRecord(null, 'Any%', 'game123', 'cat123'), null);
  assert.equal(mapSpeedrunRecord(board(), 'Any%', '../evil', 'cat123'), null);
  const bad = board();
  bad.data.runs[0]!.run.status.status = 'new';
  assert.equal(mapSpeedrunRecord(bad, 'Any%', 'game123', 'cat123'), null);
  bad.data.runs[0]!.run.status.status = 'verified';
  bad.data.runs[0]!.run.date = '2026-02-31';
  bad.data.runs[0]!.run.videos.links = [];
  assert.equal(mapSpeedrunRecord(bad, 'Any%', 'game123', 'cat123')?.dateIso, null);
  assert.equal(mapSpeedrunRecord(bad, 'Any%', 'game123', 'cat123')?.videoUrl, null);
});

const fixture =
  'data:text/javascript,' +
  encodeURIComponent(`
  export const state = { cache:new Map(), options:[], quota:true, cacheFailure:false };
  export function unstable_cache(fn,key,options){
    state.options.push({key,options});
    return async (...args)=>{
      if(state.cacheFailure)throw Error('Cache unavailable');
      const k=JSON.stringify([key,args]);
      if(!state.cache.has(k))state.cache.set(k,fn(...args));
      return state.cache.get(k);
    };
  }
  export const twitchAccessToken=async()=> 'unit-test-token';
  export const catalogueAdmin=()=>({rpc:()=>({abortSignal:async()=>({data:state.quota,error:null})})});
`);
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'server-only' || specifier.endsWith('.css'))
      return { url: 'data:text/javascript,export {};', shortCircuit: true };
    if (
      ['next/cache', '@/integrations/igdb/server', '@/integrations/supabase/admin'].includes(
        specifier,
      )
    )
      return { url: fixture, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const file = resolve('src', specifier.slice(2));
      return {
        url: pathToFileURL(existsSync(file + '.tsx') ? file + '.tsx' : file + '.ts').href,
        shortCircuit: true,
      };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url) && !url.includes('node_modules'))
      return {
        format: 'module',
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
            jsx: ts.JsxEmit.ReactJSX,
          },
        }).outputText,
        shortCircuit: true,
      };
    return next(url, context);
  },
});
const originalFetch = globalThis.fetch;
const names = ['TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET', 'SUPABASE_SERVICE_ROLE_KEY'];
const previous = names.map((name) => process.env[name]);
after(() => {
  globalThis.fetch = originalFetch;
  hooks.deregister();
  names.forEach((name, i) => {
    if (previous[i] === undefined) delete process.env[name];
    else process.env[name] = previous[i];
  });
});
const { fetchGameMeta } = await import('../../src/services/game-meta-service.ts');
const { GameMetaHub, GameMetaView } = await import('../../src/components/game-meta-hub.tsx');
const { state } = await import(fixture);
type Scenario = {
  fail?: string[];
  mismatch?: boolean;
  malformed?: boolean;
  quota?: boolean;
  categories?: { id: string; name: string; type: string }[];
  unsafeBoardLink?: boolean;
};
let requested: { url: string; options: RequestInit }[] = [];
let active = 0,
  maxActive = 0;
function setup(scenario: Scenario = {}) {
  names.forEach((name) => (process.env[name] = 'unit-only'));
  state.cache.clear();
  state.quota = scenario.quota ?? true;
  state.cacheFailure = false;
  requested = [];
  active = 0;
  maxActive = 0;
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    requested.push({ url, options });
    active++;
    maxActive = Math.max(maxActive, active);
    try {
      await new Promise((resolve) => setTimeout(resolve, 3));
      const fail = scenario.fail?.find((fragment) => url.includes(fragment));
      if (fail) {
        if (fail === 'steam' || fail === 'speedrun') throw new TypeError('Mock network failure');
        if (fail === 'igdb') throw new DOMException('Mock timeout', 'TimeoutError');
        return new Response('not found', { status: 404 });
      }
      if (scenario.malformed) return Response.json({ data: 'malformed', items: null });
      const title = scenario.mismatch ? 'Portal 2 Soundtrack' : 'Portal 2';
      if (url.includes('/storesearch/'))
        return Response.json({ items: [{ id: 620, name: title, type: 'app' }] });
      if (url.includes('protondb.com'))
        return Response.json({ tier: 'gold', score: 0.9, total: 123, confidence: 'strong' });
      if (url.endsWith('/v4/games')) {
        assert.match(String(options.body), /fields id,name/);
        return Response.json([{ id: 100, name: title }]);
      }
      if (url.endsWith('/game_time_to_beats'))
        return Response.json([
          { game_id: 100, hastily: 43200, normally: 72000, completely: 108000 },
        ]);
      if (url.includes('/games?'))
        return Response.json({ data: [{ id: 'game123', names: { international: title } }] });
      if (url.endsWith('/categories'))
        return Response.json({
          data: scenario.categories ?? [
            { id: 'levelcat', name: 'Any%', type: 'per-level' },
            { id: 'cat100', name: '100%', type: 'per-game' },
            { id: 'cat123', name: 'Any%', type: 'per-game' },
          ],
        });
      if (url.includes('/leaderboards/')) {
        const result = board();
        if (scenario.unsafeBoardLink)
          result.data.weblink = 'https://www.speedrun.com.evil.test/redirect';
        return Response.json(result);
      }
      throw new Error('Unexpected URL ' + url);
    } finally {
      active--;
    }
  };
}
test('Unified metadata runs independent providers concurrently, caches by title and keeps all three results', async () => {
  setup();
  const result = await fetchGameMeta('Portal 2');
  assert.deepEqual(result.duration, {
    mainStoryHours: 12,
    mainExtraHours: 20,
    completionistHours: 30,
  });
  assert.equal(result.proton?.tier, 'gold');
  assert.equal(result.speedrun?.runnerName, 'Correct runner & Guest');
  assert.equal(result.speedrun?.speedrunUrl, 'https://www.speedrun.com/portal2?h=Any');
  assert.ok(requested.some((item) => item.url.includes('/category/cat123?top=1&embed=players')));
  assert.ok(maxActive >= 3);
  assert.ok(
    requested.every(
      (item) =>
        item.options.signal instanceof AbortSignal &&
        item.options.cache === 'no-store' &&
        item.options.redirect === 'error',
    ),
  );
  const count = requested.length;
  await fetchGameMeta('Portal 2');
  assert.equal(requested.length, count, '24h cache wrapper is keyed by title');
  assert.deepEqual(state.options[0], { key: ['game-meta-v1'], options: { revalidate: 86400 } });
});
test('404, network errors and timeouts never discard successful independent providers', async () => {
  setup({ fail: ['protondb.com'] });
  let result = await fetchGameMeta('Portal 2');
  assert.equal(result.proton, null);
  assert.ok(result.duration);
  assert.ok(result.speedrun);
  setup({ fail: ['igdb'] });
  result = await fetchGameMeta('Portal 2');
  assert.equal(result.duration, null);
  assert.ok(result.proton);
  assert.ok(result.speedrun);
  setup({ fail: ['speedrun'] });
  result = await fetchGameMeta('Portal 2');
  assert.equal(result.speedrun, null);
  assert.ok(result.duration);
  assert.ok(result.proton);
  setup({ fail: ['igdb', 'steam', 'speedrun'] });
  assert.deepEqual(await fetchGameMeta('Portal 2'), {
    duration: null,
    proton: null,
    speedrun: null,
  });
});
test('Missing credentials, IGDB quota denial, malformed responses and fuzzy title mismatches fail closed', async () => {
  setup();
  delete process.env.TWITCH_CLIENT_ID;
  let result = await fetchGameMeta('Portal 2');
  assert.equal(result.duration, null);
  assert.ok(result.proton);
  assert.ok(result.speedrun);
  setup({ quota: false });
  result = await fetchGameMeta('Portal 2');
  assert.equal(result.duration, null);
  assert.ok(result.proton);
  assert.ok(result.speedrun);
  assert.ok(!requested.some((item) => item.url.includes('api.igdb.com')));
  setup({ malformed: true });
  assert.deepEqual(await fetchGameMeta('Portal 2'), {
    duration: null,
    proton: null,
    speedrun: null,
  });
  setup({ mismatch: true });
  assert.deepEqual(await fetchGameMeta('Portal 2'), {
    duration: null,
    proton: null,
    speedrun: null,
  });
  assert.equal(normalizedMetaTitle('Pokémon™: Café'), normalizedMetaTitle('Pokemon Cafe'));
});
test('Speedrun falls back only to full-game categories, encodes titles, rejects unsafe links and skips invalid input', async () => {
  setup({ categories: [{ id: 'cat100', name: '100%', type: 'per-game' }], unsafeBoardLink: true });
  const result = await fetchGameMeta('Portal 2');
  assert.equal(result.speedrun?.categoryName, '100%');
  assert.equal(
    result.speedrun?.speedrunUrl,
    'https://www.speedrun.com/api/v1/leaderboards/game123/category/cat100',
  );
  assert.ok(requested.some((item) => item.url.includes('term=Portal%202')));
  setup({ categories: [{ id: '../evil', name: 'Any%', type: 'per-game' }] });
  assert.equal((await fetchGameMeta('Portal 2')).speedrun, null);
  assert.ok(!requested.some((item) => item.url.includes('/leaderboards/')));
  setup();
  for (const title of ['', ' ', 'a'.repeat(201), '™®'])
    assert.deepEqual(await fetchGameMeta(title), { duration: null, proton: null, speedrun: null });
  assert.equal(requested.length, 0);
});
test('Server-rendered panel hides absent sources, labels duration provenance and avoids false Valve certification', async () => {
  setup();
  const result = await fetchGameMeta('Portal 2');
  const $ = load(
    renderToStaticMarkup(createElement(GameMetaView, { title: 'Portal 2', data: result })),
  );
  assert.equal($('.game-meta-card').length, 3);
  assert.equal($('[data-duration="story"] dd').text(), '12 h');
  assert.equal($('[data-tier="gold"]').text(), '◆ GOLD');
  assert.match($('.game-meta-duration').text(), /IGDB/);
  assert.match($('.game-meta-deck').text(), /Steam Deck Ready/);
  assert.match($('.game-meta-proton').text(), /No equivale a la certificación de Valve/);
  assert.equal($('.game-meta-record').text(), '1:24:12');
  for (const link of $('a').toArray()) {
    assert.equal($(link).attr('target'), '_blank');
    assert.equal($(link).attr('rel'), 'noopener noreferrer');
  }
  assert.equal(
    GameMetaView({ title: 'Empty', data: { duration: null, proton: null, speedrun: null } }),
    null,
  );
  const partial = load(
    renderToStaticMarkup(
      createElement(GameMetaView, {
        title: 'Partial',
        data: { ...result, proton: null, speedrun: null },
      }),
    ),
  );
  assert.equal(partial('.game-meta-card').length, 1);
  const escaped = load(
    renderToStaticMarkup(
      createElement(GameMetaView, {
        title: '<script>x</script>',
        data: {
          ...result,
          speedrun: {
            ...result.speedrun!,
            runnerName: '<img src=x onerror=alert(1)>',
            videoUrl: 'javascript:alert(1)',
          },
        },
      }),
    ),
  );
  assert.equal(escaped('script,img').length, 0);
  assert.equal(escaped('a[href^="javascript"]').length, 0);
  state.cacheFailure = true;
  assert.equal(await GameMetaHub({ title: 'Portal 2' }), null);
});
