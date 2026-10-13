import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Screen uses bounded server-only TMDB requests, regional providers and owner-scoped metadata-authoritative saves', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`
    export const state={auth:true,existing:false,inserted:null,updated:null,filters:[]};
    const db={from(table){if(table!=='user_screen_entries')throw Error('Unexpected table');let fields=null;let inserting=false;const q={select(){return q},order(){return q},limit(){return q},eq(key,value){state.filters.push([key,value]);return q},update(data){fields=data;state.updated=data;return q},insert(data){fields=data;inserting=true;state.inserted=data;return q},async maybeSingle(){return {data:state.existing?{id:'entry',user_id:'owner',tmdb_id:94605,media_type:'tv',...fields}:null,error:null}},async single(){state.existing=true;return {data:{id:'entry',...fields},error:null}},then(done,fail){return Promise.resolve({data:[],error:null}).then(done,fail)}};return q}};
    export const currentUser=async()=>state.auth?{id:'owner'}:null;
    export const authenticated=async()=>{if(!state.auth)throw Object.assign(Error('No session'),{status:401});return {db,user:{id:'owner'}}};
    export const serverClient=async()=>db;
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (specifier === 'server-only')
        return { url: 'data:text/javascript,export {};', shortCircuit: true };
      if (['@/lib/session', '@/integrations/supabase/server'].includes(specifier))
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
          source: stripTypeScriptTypes(readFileSync(fileURLToPath(url), 'utf8'), {
            mode: 'transform',
          }),
          shortCircuit: true,
        };
      return next(url, context);
    },
  });
  const keys = ['TMDB_API_KEY', 'TMDB_READ_TOKEN'],
    old = keys.map((key) => process.env[key]),
    original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    requests++;
    const url = new URL(String(input));
    assert.equal(url.hostname, 'api.themoviedb.org');
    assert.equal(init?.redirect, 'error');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer tmdb-test-token');
    assert.equal(url.searchParams.get('api_key'), null);
    assert.equal(url.searchParams.get('language'), 'es-ES');
    if (/(?:tv|movie)\/\d+$/.test(url.pathname))
      assert.equal(url.searchParams.get('append_to_response'), 'credits,watch/providers,videos');
    if (url.pathname.includes('/season/'))
      return Response.json({
        episodes: [{ episode_number: 1, name: 'Episode One', air_date: '2026-01-01' }],
      });
    return Response.json({
      id: 94605,
      name: 'Canonical Title',
      seasons: [
        { season_number: 1, name: 'Season 1', episode_count: 2 },
        { season_number: 2, name: 'Season 2', episode_count: 2 },
      ],
      credits: { cast: [{ name: 'Actor', character: 'Hero' }] },
      videos: {
        results: [
          { site: 'YouTube', type: 'Trailer', key: '0kAAqslOS64', official: true, iso_639_1: 'es' },
        ],
      },
      'watch/providers': {
        results: {
          CL: {
            link: 'https://www.themoviedb.org/tv/94605/watch?locale=CL',
            flatrate: [{ provider_id: 8, provider_name: 'Netflix' }],
          },
        },
      },
    });
  };
  try {
    keys.forEach((key) => delete process.env[key]);
    const service = await import('../../src/services/screen.ts');
    const demo = await service.getScreenMediaDetail(94605, 'tv');
    assert.equal(demo.source, 'demo');
    assert.equal((await service.getScreenMediaDetail(106379, 'tv')).trailerVideoId, '0kAAqslOS64');
    assert.deepEqual(demo.providers, []);
    assert.equal(requests, 0);
    assert.ok((await service.searchScreenMedia('Arcane')).some((item) => item.tmdbId === 94605));
    process.env.TMDB_READ_TOKEN = 'tmdb-test-token';
    const detail = await service.getScreenMediaDetail(94605, 'tv', 'CL');
    assert.equal(detail.trailerVideoId, '0kAAqslOS64');
    assert.equal(detail.providers[0]?.name, 'Netflix');
    assert.equal(detail.totalEpisodes, 4);
    assert.equal(detail.credits[0]?.name, 'Actor');
    assert.deepEqual((await service.getScreenMediaDetail(94605, 'tv', 'MX')).providers, []);
    const { state } = await import(fixture);
    const payload = {
      tmdbId: 94605,
      mediaType: 'tv',
      userId: 'spoof',
      title: 'Spoof Title',
      status: 'watching',
      rating: 8,
      currentSeason: 2,
      currentEpisode: 1,
      totalEpisodes: 999,
      watchedEpisodes: [10001, 20001],
      notes: 'Checkpoint',
    };
    await service.saveScreenProgress(payload);
    assert.equal(state.inserted.user_id, 'owner');
    assert.equal(state.inserted.title, 'Canonical Title');
    assert.equal(state.inserted.total_episodes, 4);
    assert.ok(
      state.filters.some(
        ([key, value]: [string, string]) => key === 'user_id' && value === 'owner',
      ),
    );
    await service.saveScreenProgress({ ...payload, status: 'completed' });
    assert.equal(state.updated.status, 'completed');
    assert.equal('user_id' in state.updated, false);
    state.auth = false;
    await assert.rejects(
      service.saveScreenProgress(payload),
      (error: unknown) => (error as { status: number }).status === 401,
    );
  } finally {
    globalThis.fetch = original;
    keys.forEach((key, index) => {
      if (old[index] === undefined) delete process.env[key];
      else process.env[key] = old[index];
    });
    hooks.deregister();
  }
});
