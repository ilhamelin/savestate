import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
test('Screen announcements require owner/session/origin and use authoritative upcoming data with rate limiting', async () => {
  const fixture =
    'data:text/javascript,' +
    encodeURIComponent(`
    import { AppError } from '@/lib/http';
    export const state={auth:true,followed:true,slot:0,filters:[],announced:null};
    export async function authenticated(){if(!state.auth)throw new AppError('Login',401);return {user:{id:'owner'},db:{from(){return {select(){return this},eq(k,v){state.filters.push([k,v]);return this},async maybeSingle(){return {data:{followed:state.followed,status:'watching',current_season:1,current_episode:0,watched_episodes:[],notes:'SECRET'},error:null}}}},async rpc(){return {data:state.slot,error:null}}}}}
    export async function getScreenMediaDetail(){return {tmdbId:94605,mediaType:'tv',title:'Canonical Title',posterUrl:null,backdropUrl:null,source:'tmdb',providers:[],seasons:[],episodes:[],nextEpisodeToAir:{season:3,episode:1,title:'Next',airDate:'2099-12-10'}}}
    export async function announceScreenUpcomingToDiscord(item){state.announced=item;return {published:true}}
  `);
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (['@/lib/session', '@/services/screen', '@/services/discord'].includes(specifier))
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
  const old = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  try {
    const route = await import('../../src/app/api/screen/announce/route.ts');
    const { state } = await import(fixture);
    const request = (origin = 'https://example.com') =>
      new Request('https://example.com/api/screen/announce', {
        method: 'POST',
        headers: { origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId: 94605,
          mediaType: 'tv',
          title: 'SPOOFED',
          nextAirDate: '2000-01-01',
          channel: 'private',
        }),
      });
    assert.equal((await route.POST(request())).status, 200);
    assert.equal(state.announced.title, 'Canonical Title');
    assert.equal(state.announced.nextAirDate, '2099-12-10');
    assert.equal(state.announced.season, 3);
    assert.ok(
      state.filters.some(([key, value]: string[]) => key === 'user_id' && value === 'owner'),
    );
    assert.ok(!JSON.stringify(state.announced).includes('SECRET'));
    state.slot = 2;
    assert.equal((await route.POST(request())).status, 429);
    state.followed = false;
    assert.equal((await route.POST(request())).status, 403);
    state.auth = false;
    assert.equal((await route.POST(request())).status, 401);
    assert.equal((await route.POST(request('https://evil.example'))).status, 403);
  } finally {
    if (old === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = old;
    hooks.deregister();
  }
});
